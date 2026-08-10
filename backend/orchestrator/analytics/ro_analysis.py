import urdhva_base
import json
import time
import datetime
import pytz
import tempfile
import requests
import traceback
import polars as pl
import charts_actions
import hpcl_ceg_model
from pathlib import Path
import dashboard_studio_model
from fastapi.responses import FileResponse
import orchestrator.analytics.va_analysis as va_analysis
import utilities.cris_alert_mapping as cris_alert_mapping

logger = urdhva_base.logger.Logger.getInstance('ro_alert_log')

async def interlock_disable(params: dict):
    """

    Args:
        params: {
            "rocode": "",
            "reqno": "",
            "interlocktype": "",
            "device": "",
            "deviceid": "",
            "disablehrs": ""
        }

    Returns:

    """
    alert_id = ""
    if 'alert_id' in params.keys():
        alert_id = params['alert_id']
        del params['alert_id']
    url = urdhva_base.settings.cris_interlock_disable_url
    default_headers = {"Content-Type": "application/json"}
    log_payload = {"status_code": 401, "response": {}}
    audit_data = {
        "method": "POST", "url": url, "payload": params, "alert_id": alert_id,
        "request_no": params['reqno'], "response": str(401), "vendor": "CRIS",
        "response_msg": json.dumps(log_payload), "request_datetime":
            urdhva_base.utilities.get_present_time().isoformat(), "api_ack": None, "api_ack_datetime": None
    }
    try:
        response = requests.post(url, json=params, headers=default_headers)
        try:
            response_data = response.json()
        except (ValueError, requests.exceptions.JSONDecodeError):
            response_data = {"raw_text": response.text or "Empty response"}
        log_payload = {"status_code": response.status_code, "response": response_data}
        audit_data['response'] = str(response.status_code)
        audit_data['response_msg'] = json.dumps(log_payload)
        await api_audit_log(audit_data=audit_data)
        return response.json()
    except Exception as e:
        print(traceback.format_exc())
        print(f"Error while disabling interlock {e}")
        await api_audit_log(audit_data=audit_data)
        return {"status": False, "message": "Failed to post cris API"}

async def get_ro_alerts_count(bu: str, violation_type: str, sap_id: str):
    ro_mapping = cris_alert_mapping.Cris_Alert_Mapping
    if bu in ro_mapping.keys() and violation_type in ro_mapping[bu].keys():
        ro_mapping = ro_mapping[bu][violation_type]
        start_date, end_date = await va_analysis.get_period_datetime(ro_mapping['period'])
        query = (f"""select count(*) as "count" from alerts """
                 f"where bu = '{bu}' and "
                 f"alert_section = 'RO' and "
                 f"violation_type = '{violation_type}' and "
                 f"sap_id = '{sap_id}' and "
                 f"created_at BETWEEN TO_DATE('{start_date}', 'YYYY-MM-DD') AND TO_DATE('{end_date}', 'YYYY-MM-DD')")
        # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 1
        # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        # function = await charts_actions.charts_connection_vault_routing(
        #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        # resp = await function(query=query)
        # print("Query: ", query)
        resp = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
        resp = resp.get("data", [])
        print(resp)
        if resp:
            resp = resp[0]
            return resp.get("count", 0)
    return 0

async def get_ro_levels(bu: str, violation_type: str, sap_id: str):
    ro_mapping = cris_alert_mapping.Cris_Alert_Mapping
    if bu in ro_mapping.keys() and violation_type in ro_mapping[bu].keys():
        ro_mapping = ro_mapping[bu][violation_type]
        # ro_alert_count = await get_ro_alerts_count(bu=bu, violation_type=violation_type, sap_id=sap_id)
        ro_alert_count = await get_ro_approved_count(bu=bu, violation_type=violation_type, sap_id=sap_id)
        previous_count = 0
        for key, value in ro_mapping['escalations'].items():
            if value['condition'] == "<":
                if int(ro_alert_count) <= int(value['value']):
                    return "level - 1"
            if value['condition'] == "<>":
                if int(previous_count) < ro_alert_count <= int(value['value']):
                    return "level - 2"
            if value['condition'] == ">":
                if ro_alert_count > int(value['value']):
                    return "level - 3"
            previous_count = value['value']
    return ""

async def check_alert_exists(alert_id, violation_type, sap_id):
    query = (f"select external_id from alerts where external_id = '{alert_id}' and bu = 'RO' and "
             f"violation_type = '{violation_type}' and sap_id = '{sap_id}'")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 1
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # resp = await function(query=query)
    resp = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
    resp = resp.get("data", [])
    # print("Query: ", query)
    print("resp: ", resp)
    if resp:
        return True
    return False

async def api_audit_log(audit_data):
    """

    Args:
        audit_data:

    Returns:

    """
    return await hpcl_ceg_model.VendorApiAuditCreate(**audit_data).create()

async def get_process_instance_id(business_key, camunda_url):
    camunda_url = f"{camunda_url}/engine-rest/process-instance"
    params = {"businessKey": business_key}
    response = requests.get(camunda_url, params=params)
    process_instance_id = ""
    if response.status_code == 200:
        instances = response.json()
        if instances:
            process_instance_id = instances[0]["id"]  # Get first instance ID
            return process_instance_id
    return process_instance_id

async def close_camunda_workflow(alert_data, camunda_url):
    # camunda_url = await helpers.get_alert_camunda_url(self.params['alert_id'], "error")
    MAX_RETRIES = 5
    RETRY_DELAY = 5
    headers = {"Content-Type": "application/json"}
    if camunda_url != 'error':
        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__
        # instance_id = alert_data.get("workflow_instance_id")
        business_key = alert_data.get("unique_id")
        instance_id = await get_process_instance_id(business_key, camunda_url)
        if not instance_id:
            instance_id = alert_data.get("workflow_instance_id")
        url = f"{camunda_url}/engine-rest/process-instance/{instance_id}"
        print("instance_id: ", instance_id)
        if not instance_id:
            return False
        for attempt in range(MAX_RETRIES):
            try:
                response = requests.delete(url, headers=headers)

                if response.status_code == 204:  # Success in Camunda
                    print(f"Workflow {instance_id} Deleted successfully. Alert ID {alert_data['id']}")
                    break
                else:
                    print(
                        f"Error Deleting {instance_id} {camunda_url} (attempt {attempt + 1}): {response.status_code} - {response.text}")

            except requests.RequestException as e:
                print(f"Request error for {camunda_url} {instance_id} (attempt {attempt + 1}): {e}")

            # Retry logic with exponential backoff
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY * (2 ** attempt))
            else:
                print(f"Failed to Deleting {camunda_url} {instance_id} after {MAX_RETRIES} retries.")
                return False
        return True
    return False

async def get_ro_approved_count(bu: str, violation_type: str, sap_id: str):
    ro_mapping = cris_alert_mapping.Cris_Alert_Mapping
    if bu in ro_mapping.keys() and violation_type in ro_mapping[bu].keys():
        ro_mapping = ro_mapping[bu][violation_type]
        start_date, end_date = await va_analysis.get_period_datetime(ro_mapping['period'])
        violation_type = ro_mapping['name']
        query = (f"""select count(*) as "count" from ro_interlock_disable """
                 f"where bu = '{bu}' and "
                 f"interlock_name = '{violation_type}' and "
                 f"sap_id = '{sap_id}' and "
                 f"created_at BETWEEN TO_DATE('{start_date}', 'YYYY-MM-DD') AND TO_DATE('{end_date}', 'YYYY-MM-DD')")
        resp = await hpcl_ceg_model.RoInterlockDisable.get_aggr_data(query, limit=0)
        resp = resp.get("data", [])
        print(resp)
        if resp:
            resp = resp[0]
            return resp.get("count", 0)
    return 0

async def get_ro_va_cleanliness_total_count():
    query = f"""select * from alerts where interlock_name='Restroom Cleaning Evidence Missing'
                    and created_at::date = current_date"""
    resp = await hpcl_ceg_model.Alerts.get_aggr_data(query,limit=0)
    resp = resp.get('data',[])
    if not resp:
        return 0
    
    return len(resp)

async def close_ro_va_cleanliness_unblock_of_blocked(day_end=False):
    if urdhva_base.ctx.exists():
        rpt = urdhva_base.context.context.get('rpt', {})
    else:
        rpt = {}
    query = f"""select * from alerts where interlock_name='Restroom Cleaning Evidence Missing'
                    and created_at::date = current_date and block_status = 'Blocked' and alert_status!='Close'"""
    resp = await hpcl_ceg_model.Alerts.get_aggr_data(query,limit=0)
    resp = resp.get('data',[])
    if not resp:
        return 0
    
    for data in resp:
        payload = {
            "messageName": "UnblockNozzles",
            "processInstanceId": data.get("workflow_instance_id")
        }

        camunda_url = f"{data.get('workflow_url')}/engine-rest/message"

        response = requests.post(camunda_url, json=payload)

        if response.status_code != 204:
            logger.error(
                f"Camunda unblock failed | "
                f"alert_id={data.get('id')} | "
                f"status={response.status_code} | "
                f"response={response.text}"
            )
        event_time_utc = urdhva_base.utilities.get_present_time()
        ist_time = event_time_utc.astimezone(pytz.timezone("Asia/Kolkata"))
        alert_history = data.get("alert_history", [])

        alert_history.append({
            "action_msg": (
                f"Day End Closure Unblock of {data.get('sap_id')} "
                f"initiated by {rpt.get('username','SYSTEM')} "
                f"at {ist_time.strftime('%d-%m-%Y %I:%M:%S %p')} IST"
            ),
            "action_type": "UnBlocked",
            "action_by": rpt.get('username','SYSTEM'),
            "processed_time": event_time_utc.isoformat()
        })
        alert_data = {
            "id": data.get("id"),
            "alert_history": alert_history
            }
        if day_end:
            alert_data["alert_closure_reason"] = "DAY_END"
        await hpcl_ceg_model.Alerts(**alert_data).modify()
    return len(resp)

async def close_ro_va_cleanliness_open_alerts(day_end=False):
    if urdhva_base.ctx.exists():
        rpt = urdhva_base.context.context.get('rpt', {})
    else:
        rpt = {}
    query = f"""
                SELECT *
                FROM alerts
                WHERE interlock_name = 'Restroom Cleaning Evidence Missing'
                AND alert_status = 'Open'
                AND (
                        block_status is null
                        OR block_status = 'WaitingForBlockAck'
                    )
                """
    resp = await hpcl_ceg_model.Alerts.get_aggr_data(query,limit=0)
    resp = resp.get('data',[])
    if not resp:
        return 0
    
    for data in resp:
        delete_url = f"{data.get('workflow_url')}/engine-rest/process-instance/{data.get("workflow_instance_id")}"
        delete_response = requests.delete(delete_url)
        print("workflow_deletion Status code:", delete_response.status_code)
        print("workflow_deletion Response body:", delete_response.text)
        event_time_utc = urdhva_base.utilities.get_present_time()
        ist_time = event_time_utc.astimezone(pytz.timezone("Asia/Kolkata"))
        alert_history = data.get("alert_history", [])
        alert_history.append({
            "action_msg": (
                f"Day End Closure of {data.get('sap_id')} "
                f"initiated by {rpt.get('username','SYSTEM')} "
                f"at {ist_time.strftime('%d-%m-%Y %I:%M:%S %p')} IST"
            ),
            "action_type": "Message",
            "action_by": rpt.get('username','SYSTEM'),
            "processed_time": event_time_utc.isoformat()
        })
        alert_data = {
            "id": data.get("id"),
            "alert_history": alert_history,
            "alert_status": "Close",
            "alert_state": "Resolved",
            "block_status": data.get("block_status")
        }
        if day_end:
            alert_data["alert_closure_reason"] = "DAY_END"
        if alert_data['block_status'] == 'WaitingForBlockAck':
            alert_data["block_status"] = None
        await hpcl_ceg_model.Alerts(**alert_data).modify()
    return len(resp)

async def ro_va_day_end_closure():
    try:
        await close_ro_va_cleanliness_unblock_of_blocked()
        await close_ro_va_cleanliness_open_alerts(day_end=True)
        return {"status": True, "message": "Successfully Closed All Alerts"}
    except Exception as e:
        return {
            "status": False,
            "message": "Failed at day end closure",
            "error": str(e)
        }


async def create_va_cleanliness_summary(data: hpcl_ceg_model.Alerts_Va_Cleanliness_SummaryParams):
    query_extension = []
    has_date = False
    for extension in data.cross_filters:
        if extension.key == 'created_at':
            has_date = True
            extension.key = "created_at::DATE"
        query_extension.append(
            f"{extension.key}='{extension.value if extension.value else extension.val}'")
    if not has_date:
        query_extension.append(f"created_at::DATE=CURRENT_DATE")
    analytical_data = {
        "total": 0,
        "blocked": 0,
        "unblocked": 0,
        "waiting_block_confirmation": 0,
        "waiting_sales_stop_confirmation": 0,
        "waiting_unblock_confirmation": 0,
        "waiting_sales_resume_confirmation": 0,
        "manually_unblocked": 0,
        "automatically_unblocked": 0,
        "no_connectivity": 0,
        "pending_unblocks": 0
    }

    # Query to get all required for the requested time period
    query = f"""select distinct block_status, alert_status, alert_state, ro_offline, alert_closure_reason, COUNT(*) from alerts 
        where interlock_name='Restroom Cleaning Evidence Missing' AND {' AND '.join(query_extension)} 
        group by block_status, alert_status, alert_state, ro_offline, alert_closure_reason
    """
    query_data = await hpcl_ceg_model.Alerts.get_aggr_data(query)
    resp = query_data['data']
    analytical_data['total'] = sum([rec['count'] for rec in resp])
    analytical_data['blocked'] = sum([rec['count'] for rec in resp
                                      if rec['block_status'] == 'Blocked'])
    analytical_data['unblocked'] = sum([rec['count'] for rec in resp
                                        if rec['block_status'] == 'UnBlocked'])
    analytical_data['waiting_block_confirmation'] = 0
    analytical_data['waiting_sales_stop_confirmation'] = sum([rec['count'] for rec in resp
                                                              if rec['block_status'] == 'Blocked'])
    analytical_data['waiting_unblock_confirmation'] = 0
    analytical_data['waiting_sales_resume_confirmation'] = sum([rec['count'] for rec in resp
                                                                if
                                                                rec['block_status'] == 'UnBlocked'])
    analytical_data['manually_unblocked'] = sum([rec['count'] for rec in resp
                                                 if rec['block_status'] == 'UnBlocked' and
                                                 rec['alert_closure_reason'] == 'DNC_UNBLOCKED'])
    analytical_data['automatically_unblocked'] = sum([rec['count'] for rec in resp
                                                      if rec['alert_closure_reason'] == 'PICTURE_UPLOADED'])
    analytical_data['no_connectivity'] = sum([rec['count'] for rec in resp
                                                      if rec['alert_status'] == 'Open' and rec['ro_offline']])


    return True, analytical_data

def utc_to_ist(ts: str | None):
    if not ts:
        return None
    IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    dt = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
    return dt.astimezone(IST)

def extract_block_details(alert_history: list):
    block_time = None
    unblock_time = None

    for event in alert_history:
        action = event.get("action_type")
        action_msg = event.get("action_msg", "")

        if action_msg in ["Outlet Not Communicating"]:
            return None, None, None

        if action == "Blocked" and not block_time:
            block_time = utc_to_ist(event.get("processed_time"))

        elif action == "UnBlocked" and not unblock_time:
            unblock_time = utc_to_ist(event.get("processed_time"))

    # Calculate duration
    block_duration_minutes = None
    if block_time and unblock_time:
        block_duration_minutes = int(
            (unblock_time - block_time).total_seconds() / 60
        )

    return block_time, unblock_time, block_duration_minutes


async def generate_va_download_excel_report(data: hpcl_ceg_model.Alerts_Download_Excel_ReportParams):
    query_extension = ["bu='RO'"]
    has_date = False
    for extension in data.cross_filters:
        if extension.key == 'created_at':
            has_date = True
            extension.key = "created_at::DATE"
        else:
            continue
        query_extension.append(
            f"{extension.key}='{extension.value if extension.value else extension.val}'")
    if not has_date:
        query_extension.append(f"created_at::DATE=CURRENT_DATE")

    key_mapping = [
        {"location_name": "RO Name"},
        {"zone": "Zone"},
        {"region": "Region"},
        {"sales_area": "Sales Area"},
        {"ro_offline": "RO Offline"},
        {"alert_closure_reason": "Alert Closure Reason"},
        {"sap_id": "RO ID"},
        {"rca": "Comments"},
        {"alert_status": "Alert Status"},
        {"block_status": "Block Status"},
        {"image_uploaded": "Image Uploaded"},
        {"created_at": "Alert Created Date"},
        {"alert_history": "Alert History"}
    ]
    keys_required = ", ".join(list(rec.keys())[0] for rec in key_mapping)
    query = (f"SELECT {keys_required} from alerts where "
             f"interlock_name='Restroom Cleaning Evidence Missing' AND {' AND '.join(query_extension)} ")
    resp = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
    if not resp['data']:
        return "No Data Found"
    
    for row in resp['data']:
        alert_history = row.get("alert_history", [])
        block_time, unblock_time, block_duration = extract_block_details(alert_history)
        row["block_time"] = block_time.strftime("%Y-%m-%d %H:%M:%S") if block_time else ""
        row["unblock_time"] = unblock_time.strftime("%Y-%m-%d %H:%M:%S") if unblock_time else ""
        row["block_duration_minutes"] = block_duration if block_duration is not None else ""
    

    key_mapping.extend([
        {"block_time": "Block Time (IST)"},
        {"unblock_time": "Unblock Time (IST)"},
        {"block_duration_minutes": "Block Duration (Minutes)"}
    ])

    # Convert mapping to dict (old -> new)
    rename_map = {
        old: new
        for item in key_mapping
        for old, new in item.items()
    }

    # Extract column order (after rename)
    ordered_columns = list(rename_map.values())

    # Create Polars DataFrame
    df = pl.DataFrame(resp['data'], infer_schema_length=100000)

    # Rename columns
    df = df.rename(rename_map)

    # Reorder columns (only those that exist)
    df = df.select([col for col in ordered_columns if col in df.columns])

    # Drop alert_history column
    df = df.drop("Alert History")

    # Write to Excel
    with tempfile.NamedTemporaryFile(
            suffix=".xlsx", delete=False
    ) as tmp:
        temp_path = Path(tmp.name)

    df.write_excel(temp_path)
    return FileResponse(temp_path, filename="VA_Cleanliness_Alerts.xlsx")
