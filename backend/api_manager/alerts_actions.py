import urdhva_base
from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import os
import pytz
import time
import json
import datetime
import requests
import traceback
import utilities
import re
import polars as pl
from pathlib import Path
import urdhva_base.redispool
import urdhva_base.utilities
import utilities.helpers as helpers
from fastapi.responses import FileResponse
import utilities.vts_mapping as vts_mapping
from dateutil.relativedelta import relativedelta
import utilities.minio_connector as minio_connector
import utilities.connection_mapping as connection_mapping
import orchestrator.analytics.vts_analysis as vts_analysis
import utilities.helpers as helpers
import orchestrator.alerting.alert_manager as alert_manager
import orchestrator.alerting.alert_factory as alert_factory
import orchestrator.actions.check_violation_count as check_violation_count
import orchestrator.analytics.dry_out_analysis as dry_out_analysis
import orchestrator.tas_analytics.hqo_blocked as hqo_blocked
import orchestrator.gen_ai.vts_nlp.core_functions as core_functions
import orchestrator.analytics.ro_analysis as ro_analysis

router = fastapi.APIRouter(prefix='/alerts')

logger = urdhva_base.logger.Logger.getInstance("api_manager")




async def get_truck_location_data(truck_number):
    transporter_code = ""
    sap_id = None

    query = f"select * from vts_truck_master where truck_no='{truck_number}'"
    res = await urdhva_base.BasePostgresModel.get_aggr_data(query)
    
    if res.get("data"):
        row = res["data"][0]
        sap_id = row.get("sap_id")
        transporter_code = row.get("transporter_code", "")
    else:
        res = await VtsAlertHistory.get_all(
            urdhva_base.queryparams.QueryParams(q=f"tl_number='{truck_number}'", limit=1),
            resp_type="plain"
        )
        if not res.get("data"):
            return None

        row = res["data"][0]
        sap_id = row.get("sap_id")
        transporter_code = row.get("vendor_id", "")

    if not sap_id:
        return None

    query =f"select * from location_master where sap_id='{sap_id}'"
    loc = await urdhva_base.BasePostgresModel.get_aggr_data(query)
    location = loc["data"][0] if loc.get("data") else {"name": "", "zone": "", "region": ""}
    location["sap_id"] = sap_id
    location["transporter_code"] = transporter_code

    return location


# Action alert_action
@router.post('/alert_action', tags=['Alerts'])
async def alerts_alert_action(data: Alerts_Alert_ActionParams):
    """
    API endpoint to perform an action on an alert.

    Args:
    - data (Alerts_Alert_ActionParams): Alert action parameters

    Returns:
    - dict: Response with status, message and empty data
    """
    try:
        logger.info(f"Alert data received to perform action: {data}")
        input_data = data.dict()
        if urdhva_base.context.context.exists():
            rpt = urdhva_base.context.context.get('rpt', {})
        else:
            rpt = {}

        if input_data.get("alert_section") == "VTS":
            alert = await Alerts.get(input_data["alert_id"])
            if not isinstance(alert, dict):
                alert = alert.__dict__
            alert_history = alert.get("alert_history", [])
            employee_id = rpt.get("username")

            already_requested = any(
                history.get("employee_id") == employee_id
                for history in alert_history
            )
            if already_requested:
                action_type = next((history.get("action_type") for history in reversed(alert_history) if history.get("employee_id") == employee_id), None)
                if already_requested and action_type in ['Justification'] and input_data.get("action_type") in ['Approved']:
                    return False, "You have already submitted a request for this alert."
                if already_requested and action_type in ['Justification'] and (alert_history[-2].get("action_type") == input_data.get("action_type") or alert_history[-1].get("action_type") == input_data.get("action_type")):
                    return False, "You have already submitted a request for this alert."
                if already_requested and action_type in ['Approved'] and input_data.get("action_type") in ['Approved']:
                    return False, "You have already approved this alert."
                if already_requested and action_type in ['SendItBack'] and (alert_history[-2].get("action_type") == input_data.get("action_type") or alert_history[-1].get("action_type") == input_data.get("action_type")):
                    return False, "You have already sent this alert back."
        return await alert_manager.AlertAction().update_alert_data(data.dict())
    except Exception as e:
        print(traceback.format_exc())
        logger.error(f"Error in performing action on alert: {e}, InputData {data.dict()}, Traceback: {traceback.format_exc()}")
        return False, "Error in performing action on alert"
        

# Action get_performance_index
@router.post('/get_performance_index', tags=['Alerts'])
async def alerts_get_performance_index(data: Alerts_Get_Performance_IndexParams):
    query = f"SELECT sap_id, name from location_master where bu='{data.bu}'"
    if not data.limit:
        data.limit = 100
    if not data.skip:
        data.skip = 0
    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=data.limit, skip=data.skip)
    for rec in resp['data']:
        rec.update({"in_charge": "Location Incharge", "score": 99, "rank": 1})
    return resp['data']


# Action upload_document
@router.post('/upload_document', tags=['Alerts'])
async def alerts_upload_document(bu: str, upload_file: fastapi.UploadFile = fastapi.File(None)):
    try:
        UPLOAD_DIR = os.path.join(urdhva_base.settings.uploads, bu)  # Directory to save the uploaded files
        os.makedirs(UPLOAD_DIR, exist_ok=True)  # Ensure the upload directory exists

        # Validate the uploaded file type
        file_extension = Path(upload_file.filename).suffix.lower()
        allowed_extensions = [".png", ".jpg", ".jpeg", ".gif", ".csv", ".xlsx", ".xls", ".pdf", ".doc", ".docx"]
        if file_extension not in allowed_extensions:
            return fastapi.responses.JSONResponse(
                status_code=400, content={"message": "Unsupported file type"}
            )

        # Save the uploaded file
        file_name = upload_file.filename
        file_path = os.path.join(UPLOAD_DIR, file_name)
        with open(file_path, "wb") as f:
            f.write(await upload_file.read())

        # Generate encryption key and encrypt the file
        encrypted_file_key = helpers.encrypt_file(file_path)

        # Delete the original file
        os.remove(file_path)

        return {
            "message": "File uploaded and encrypted successfully",
            "original_file_path": file_path,
            "encrypted_file_key": encrypted_file_key,
        }

    except Exception as e:
        return fastapi.responses.JSONResponse(
            status_code=500, content={"message": "An error occurred", "details": str(e)}
        )


# Action intitiate_vts_exception
@router.post('/intitiate_vts_exception', tags=['Alerts'])
async def alerts_intitiate_vts_exception(data: Alerts_Intitiate_Vts_ExceptionParams):
    data=data.dict()
    alert_id = data["alert_id"]
    IST = pytz.timezone('Asia/Kolkata')
    current_time = datetime.datetime.now(IST).strftime('%d-%m-%Y %H:%M:%S')
    alert_data = await Alerts.get(int(alert_id))
    if not isinstance(alert_data, dict):
        alert_data = alert_data.__dict__
    print("alert_data----->",alert_data)
    #user = flask.session['sessionData']['email']
    user = ''
    altcount = await check_violation_count.CheckViolationCount().check_violation_count(alert_data['sap_id'],
                                                                                    alert_data['bu'],
                                                                                    alert_data['vehicle_number'], alert_data['violation_type'], alert_data["created_at"])
    altcount = altcount['count']
    print("altcount------>",altcount)
    details=vts_mapping.vts_exception_interlock_mapping[alert_data['violation_type']]
    max_limit = int(max(list(details['alerting_rules'].keys())))
    if altcount > max_limit:
        altcount = max_limit
    future_time = details['alerting_rules'][str(altcount)]['block_duration'] * 24 * 60 * 60
    # Add future_time to the original timestamp
    unblock_time = (alert_data["created_at"] + datetime.timedelta(seconds=future_time)).strftime('%d-%m-%Y')
    # Convert original created time to the desired format
    print("Unblock_time---->",unblock_time)
    alert_message = (
                        f"Exception request raised by: {user}, Message: {data["excep_msg"]} at {current_time}"
                        f"Violation Type:{alert_data["violation_type"]}"
                        f"Vehicle :{alert_data['vehicle_number']},Total Violation for {alert_data['violation_type']} by the Tank Lorry:{str(altcount)}"
                        f"Block Duration: {details['alerting_rules'][str(altcount)]['block_msg']} From {str(alert_data["created_at"])} to {str(unblock_time)}"
                    )
    #alert_data['']
    alert_history = [
        {
            "action_msg": alert_message,
            "action_type": "Created",  # Replace with an appropriate value
            "alert_status": "Open",  # Replace with the correct alert status
        }]
    interlock_details = utilities.interlock_mapping.get_interlock_name(
        alert_data['bu'], details['alerting_rules'][str(altcount)]['interlock_name'])
    if not interlock_details:
        return False, "interlock name not found "
    vts_alert_data={"bu": alert_data["bu"],
                    "alert_section": "VTS", 
                    "alert_history": alert_history, 
                    "clear_count": details['alerting_rules'][str(altcount)]['clear_count'], 
                    "sop_id":"SOP001E", "alert_message": "exception","sap_id":alert_data['sap_id'], 
                    "interlock_name": interlock_details["interlock_name"],
                    "origin_altid": data["alert_id"],
                    "vehicle_number": alert_data["vehicle_number"],
                    "violation_type": alert_data["violation_type"],
                    "location_name": alert_data['location_name']}
    
    query = (f"sap_id='{alert_data["sap_id"]}' and bu='{alert_data["bu"]}' and vehicle_number='{alert_data["vehicle_number"]}' "
             f"and sop_id='SOP001E' and alert_status='Open' and origin_altid='{alert_id}' and interlock_name='{interlock_details["interlock_name"]}'")
    data = await Alerts.get_all(urdhva_base.queryparams.QueryParams(q=query),resp_type='plain')
    if data['total']!=0:
        logger.info("exist:%s" % (vts_alert_data))
        return True, "Exception already raised"
    else:
        camunda_url=urdhva_base.settings.camunda_url
        cls = alert_factory.AlertFactory()
        await cls.create_alert(vts_alert_data, camunda_url)


# Action get_frequent_dryout_ro
@router.post('/get_frequent_dryout_ro', tags=['Alerts'])
async def alerts_get_frequent_dryout_ro(data: Alerts_Get_Frequent_Dryout_RoParams):
    return await dry_out_analysis.current_month_frequent_dryout_ros(data)


# Action get_frequent_dryout_terminals
@router.post('/get_frequent_dryout_terminals', tags=['Alerts'])
async def alerts_get_frequent_dryout_terminals(data: Alerts_Get_Frequent_Dryout_TerminalsParams):
    return await dry_out_analysis.current_month_frequent_drout_terminals(data)


# Action get_closed_alerts_details
@router.post('/get_closed_alerts_details', tags=['Alerts'])
async def alerts_get_closed_alerts_details(data: Alerts_Get_Closed_Alerts_DetailsParams):
    if urdhva_base.context.context.exists():
        rpt = urdhva_base.context.context.get('rpt', {})
    else:
        rpt = {}

    alert_data = await Alerts.get(int(data.alert_id))
    if not isinstance(alert_data, dict):
        alert_data = alert_data.__dict__

    alert_role = alert_data['assigned_user_roles'] if alert_data['assigned_user_roles'] else ""

    close_alert_details = {
        "actions": {},
        "category": [],
        "rca_reason": []
    }

    system_roles = rpt.get("novex_role", [])

    # If both alert_role and system_role was empty return default data
    if not alert_role and not system_roles:
        return close_alert_details

    # Checking whether logged-in user has access to get alert closure reasons or not
    if alert_role:
        # One role should match between two roles
        if not any(x in system_roles for x in alert_role):
            return close_alert_details

    action_data = connection_mapping.alert_action.get(data.bu)[data.alert_section]

    close_alert_details['category'] = list(action_data.get("category", {"Others": "Others"}).keys())
    if data.alert_section in ["VTS"]:
        if not data.category:
            for key in close_alert_details['category']:
                close_alert_details['rca_reason'].extend(action_data.get('category')[key])
        else:
            close_alert_details['rca_reason'].extend(action_data.get('category')[data.category])
    else:
        close_alert_details['rca_reason'] = action_data.get("rca_reason", ["Other"])

    all_actions = {
        key: value['name'] for key, value in action_data.get("actions", {}).items()
        if any(role in value.get("roles", []) for role in alert_role)
    }

    if data.alert_section in ["TAS"]:
        all_actions = {
            key: value['name'] for key, value in action_data.get("actions", {}).items()
            if any(role in value.get("roles", []) for role in system_roles)
        }

    if data.alert_section in ["VTS"] and data.bu in ['TAS','LPG']:
        if alert_data.get("action_on","") in ['maker']:
            allowed = {"UnBlock", "Accept & Block"}
            close_alert_details['actions'] = {k: v for k, v in all_actions.items() if k in allowed}
        elif alert_data.get("action_on","") in ['checker']:
            allowed = {"Approve", "Reject", "Send It Back"}
            close_alert_details['actions'] = {k: v for k, v in all_actions.items() if k in allowed}
        else:
            close_alert_details['actions'] = all_actions
    else:
        close_alert_details['actions'] = all_actions
    return close_alert_details


# Action stored_document
@router.get('/stored_document', tags=['Alerts'])
async def alerts_stored_document(file_name: str):
    file_path = os.path.join(urdhva_base.settings.uploads, f"{file_name}.enc")
    file_path = f"{file_name}.enc"
    return FileResponse(
        file_path, filename=os.path.basename(file_name), media_type="application/octet-stream"
    )


# Action vts_alert_manager
@router.post('/vts_alert_manager', tags=['Alerts'])
async def alerts_vts_alert_manager(data: Alerts_Vts_Alert_ManagerParams):
    print("data",data)
    print("data filters",dir(data.filters))
    alert_status_value = next(
    (f.value for f in data.filters if f.key == 'alert_status'),
    None
)
    print("alert_status_value",alert_status_value)
    query = f"alert_section='VTS' AND alert_status='{alert_status_value}'"
    query = await helpers.generate_filter_query(data.filters, query)
    print("query",query)
    alert_data = await Alerts.get_all(
        urdhva_base.queryparams.QueryParams(
            q=query, limit=0
            ), resp_type='plain')
    # print("alert_data",alert_data)
    required_columns =  [
            "bu", "tt_number", "sap_id", "location_name", "severity","zone",
            "instance_level", "instance_status", "violation_type",
            "maker", "checker", "actual_trip_end_date", "novex_alert_created_date",
            "vehicle_blocked_start_date", "vehicle_blocked_end_date", "alert_id", "id","action_type"
        ]
    
    if alert_data["data"]:
        alert_data = alert_data["data"]
        df = pl.DataFrame(alert_data)
        '''
        df = df.with_columns(
            pl.col("alert_history")
            .str.json(pl.Struct)        # convert JSON string to struct
            .struct.field("action_type")        # pick only the action_type
            .alias("action_type")
        )
        '''
        df = df.with_columns(
    pl.col("alert_history")
      .list.last()                     # get last struct in the list
      .struct.field("action_type")     # extract action_type
      .alias("action_type")
)
#         df = df.with_columns(
#     pl.col("alert_history")
#       .list.last()                     # get last struct in the list
#       .struct.field("action_by")     # extract action_type
#       .alias("action_by")
# )
        print(df['action_type'].unique())
       
        df = df.rename(
            {
                "unique_id": "alert_id", "interlock_name": "instance_level", 
                "vehicle_number": "tt_number", "device_id": "instance_status", 
                "assigned_user_roles": "maker", "last_escalated_to": "checker", 
                "external_timestamp": "actual_trip_end_date", "created_at": "novex_alert_created_date"
            }
        )
        df = df.select(required_columns)
        print("columns",df.columns)

        alert_data = df.to_dicts()
    return {"status": True, "message": "success", "data": alert_data}



# Action bulk_send_to_unblock
@router.post('/bulk_send_to_unblock', tags=['Alerts'])
async def alerts_bulk_send_to_unblock(data: Alerts_Bulk_Send_To_UnblockParams):
    try:
        if urdhva_base.context.context.exists():
            rpt = urdhva_base.context.context.get('rpt', {})
        else:
            rpt = {}

        if rpt.get("novex_role", None):
            if not any(role in rpt.get("novex_role") 
                       for role in ["Creator SOD", "Creator LPG", "Creator RO"]):
                return False, "Action not available for your Role"
        elif not rpt.get("novex_role", None):
            return False, "Session not found"
        
        alert_data = {}
        alert_data["task_type"] = "unblock"
        alert_data["alert_ids"] = data.alert_ids

        redis_queue = urdhva_base.redispool.RedisQueue('vts_unblocking_queue')
        await redis_queue.put(json.dumps(alert_data))
        return True, "Request sent successfully, Processing the request. Please wait for sometime"
    except Exception as e:
        print(traceback.format_exc())
        logger.error(e)
        return {"status": False, "message": "Error", "data": []}


# Action bulk_send_to_approve
@router.post('/bulk_send_to_approve', tags=['Alerts'])
async def alerts_bulk_send_to_approve(data: Alerts_Bulk_Send_To_ApproveParams):
    try:
        if urdhva_base.context.context.exists():
            rpt = urdhva_base.context.context.get('rpt', {})
        else:
            rpt = {}
                        
        if rpt.get("novex_role", None):
            if not any(role in rpt.get("novex_role") 
                       for role in ["Approver SOD", "Approver LPG", "Approver RO"]):
                return False, "Action not available for your Role"
        elif not rpt.get("novex_role", None):
            return False, "Session not found"
        
        alert_data = {}
        alert_data["task_type"] = "approve"
        alert_data["alert_ids"] = data.alert_ids

        redis_queue = urdhva_base.redispool.RedisQueue('vts_unblocking_queue')
        await redis_queue.put(json.dumps(alert_data))
        return True, "Approved successfully, Processing the approval. Please wait for sometime"
    except Exception as e:
        print(traceback.format_exc())
        logger.error(e)
        return {"status": False, "message": "Error", "data": []}


# Action block_vts_truck
@router.post('/block_vts_truck', tags=['Alerts'])
async def alerts_block_vts_truck(data: Alerts_Block_Vts_TruckParams):
    try:
        # Get the logged-in user's session details.
        rpt = urdhva_base.context.context.get('rpt', {})
        if not rpt:
            return {"status": False, "message": "Session got expired, Please Re-Login"}
        
        if ("HQO HSE SOD" not in rpt.get('novex_role',[])) and ("HQO LPG" not in rpt.get('novex_role',[])):
            return {"status": False, "message": "Not Allowed To Perform This Action"}
        
        # Check whether the truck already has an active VTS block.
        query = (f"""vehicle_unblocked_date is null and alert_section='VTS' and vehicle_number='{data.truck_number}' """)
        alert_data = await Alerts.get_all(
            urdhva_base.queryparams.QueryParams(q=query),resp_type='plain'
            )
        
        if alert_data["data"]:
            return {"status": False, "message": "Truck has already been blocked"}
        
        # Validate the truck registration number format.
        VEHICLE_REGEX = re.compile(r'^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{1,4}$')
        # Remove spaces and convert truck number to uppercase
        data.truck_number = data.truck_number.strip().upper() if data.truck_number else None
        if data.truck_number and not VEHICLE_REGEX.match(data.truck_number):
            return {
                "status": "error",
                "message": "Please enter a valid truck number"
            }

        location_name = data.location_name
        zone = data.zone
        region = data.region
        sap_id = data.sap_id
        transporter_code = ""
        if not location_name or not zone or not region or not sap_id:
            location_data = await get_truck_location_data(data.truck_number)
            if not location_data:
                    location_data = {}
            location_name = location_data.get('name', '')
            zone = location_data.get('zone', '') 
            sap_id = location_data.get('sap_id', '') 
            region = location_data.get('region', '') 
            transporter_code = location_data.get('transporter_code', '')
        else:
            # Fetch truck location details if they were not provided in the request.
            transporter_query = f"""
                select transporter_code
                from vts_truck_master
                where truck_no = '{data.truck_number}'
            """
            transporter_res = await urdhva_base.BasePostgresModel.get_aggr_data(transporter_query)
            if transporter_res.get("data"):
                transporter_code = transporter_res["data"][0].get("transporter_code", "")
        
        # Calculate the block start and end time based on the blocking period.
        start_date_utc = urdhva_base.utilities.get_present_time(utc=True)
        end_date_utc = start_date_utc + relativedelta(days=data.blocking_days)
        
        start_date_ist = start_date_utc.astimezone(pytz.timezone('Asia/Kolkata'))
        end_date_ist = end_date_utc.astimezone(pytz.timezone("Asia/Kolkata"))

        # Convert the blocking duration into ISO-8601 format (PTxxxxM) for Camunda.
        total_wait_time_minutes = int((end_date_utc - start_date_utc).total_seconds() / 60)
        totalWaitTime = "PT" + str(total_wait_time_minutes) + "M"
        # Generate a unique transaction number for this blocking request.
        transaction_number = str(int(time.time() * 1000))[-7:] + "1"

        # Create the initial alert history entries for auditing.
        alert_history = [{
            "action_msg" : (
                f"Manual block for truck {data.truck_number} initiated by OCC Team "
                f"({rpt['username']}) from "
                f"{start_date_ist.strftime('%d-%m-%Y %I:%M:%S %p')} to "
                f"{end_date_ist.strftime('%d-%m-%Y %I:%M:%S %p')} IST"
            ),
            "action_type": "BlockInitiated",
            "action_by" : rpt['username'],
            "processed_time" : start_date_utc.isoformat()
        },
        {
            "action_msg" : (f"{data.remarks}"),
            "action_type": "OccBlockingRemarks",
            "action_by" : rpt['username'],
            "processed_time" : start_date_utc.isoformat()
        }
        ]

        alert_data = {
            "vehicle_number": data.truck_number,
            "bu": data.bu.value,
            "severity": "High",
            "sop_id": "SOP009B",
            "alert_history": alert_history,
            "vehicle_blocked_start_date": start_date_utc,
            "vehicle_blocked_end_date": end_date_utc,
            "alert_section": "VTS",
            "violation_type": data.remarks,
            "interlock_name": "Itdg Admin Blocked",
            "sap_id": sap_id,
            "blocking_days": data.blocking_days,
            "blocked_by": rpt["username"],
            "remarks": data.remarks,
            "blocked_date": start_date_utc,
            "tt_type": "bulk",
            "blocking_status": "blocked",
            "blocking_flag": "Y",
            "transaction_number": transaction_number,
            "blocking_from": start_date_utc,
            "blocking_to": end_date_utc,
            "waitTime": totalWaitTime,
            "alert_message" : data.reason,
            "location_name": location_name,
            "zone": zone,
            "transporter_code" : transporter_code,
            "region": region,
            "auto_unblock": "true",
            "block_status": BlockStatus.WaitingForBlockAck,
            "checkTicketClose": data.check_ticket_close if data.check_ticket_close is not None else False
        }

        # need to trigger camunda workflow 
        cls = alert_factory.AlertFactory()
        camunda_url = await helpers.get_camunda_url(data.bu.value,sap_id,alert_section='VTS')
        await cls.create_alert(alert_data, camunda_url)
        return {"status": True, "message": "Truck has been moved check to completed trip or not"}
    except Exception as e:
        logger.exception(f"Unhandled error during VTS block {str(e)}")
        return {"status": False, "message": "Failed to block the truck"}

# Action unblock_vts_truck
@router.post('/unblock_vts_truck', tags=['Alerts'])
async def alerts_unblock_vts_truck(
    unblock_id: str = fastapi.Form(...),
    remarks: str | None = fastapi.Form(None),
    upload_file: fastapi.UploadFile | None = fastapi.File(None)
):
    try: 
        remarks_unblocked = remarks.strip() if remarks else ""

        rpt = urdhva_base.context.context.get('rpt', {})
        if not rpt:
            return {"status": False, "message": "Session got expired, Please Re-Login"}

        if ("HQO HSE SOD" not in rpt.get('novex_role', []) and "HQO LPG" not in rpt.get('novex_role', [])):
            return {"status": False, "message": "Not Allowed To Perform This Action"}

        try:
            unblock_id = int(unblock_id)
        except Exception:
            logger.error(f"Invalid unblock_id value: {unblock_id}")
            return {"status": False, "message": "Invalid unblock_id"}

        query = f"id = {unblock_id}"
        alert_data = await Alerts.get_all(
            urdhva_base.queryparams.QueryParams(q=query, limit=1),
            resp_type="plain"
        )

        if not alert_data.get("data"):
            return {"status": False, "message": "No active block found for the truck"}

        alert_record = alert_data["data"][0]

        if alert_record.get("vehicle_unblocked_date") is not None:
            return {"status": False, "message": "Truck is already unblocked"}

     
        minio_path = ""
        file_path = ""

        if upload_file:
            UPLOAD_DIR = os.path.join(
                urdhva_base.settings.uploads,
                "vts_blocked"
            )
            os.makedirs(UPLOAD_DIR, exist_ok=True)

            file_name = upload_file.filename
            file_path = os.path.join(UPLOAD_DIR, file_name)

            with open(file_path, "wb") as f:
                f.write(await upload_file.read())

            status, minio_path = minio_connector.upload_to_minio(
                "alerts",         # bucket (same bucket)
                "vts_blocked",    # section/folder
                str(unblock_id),       # sub-folder
                file_path         # local filepath
            )

            if not status:
                logger.error(f"MinIO upload failed: {minio_path}")
                return {
                    "status": False,
                    "message": "MinIO upload failed",
                    "error": minio_path
                }

        payload = {
            "messageName": "Unblock",
            "processInstanceId": alert_record.get("workflow_instance_id"),
            "processVariables": {
                "auto_unblock": {
                    "value": "false",
                    "type": "String"
                }
            }
        }

        camunda_url = f"{alert_record.get('workflow_url')}/engine-rest/message"

        response = requests.post(camunda_url, json=payload)

        if response.status_code != 204:
            logger.error(
                f"Camunda unblock failed | "
                f"alert_id={alert_record.get('id')} | "
                f"status={response.status_code} | "
                f"response={response.text}"
            )
            return {"status": False, "message": "Failed to unblock the truck via workflow"}

        event_time_utc = urdhva_base.utilities.get_present_time()
        ist_time = event_time_utc.astimezone(pytz.timezone("Asia/Kolkata"))
       
        alert_history = alert_record.get("alert_history", []) 

        alert_history.extend([
            {
                "action_msg": (
                    f"Manual unblock for truck {alert_record.get('vehicle_number')} "
                    f"initiated by OCC Team ({rpt['username']}) "
                    f"at {ist_time.strftime('%d-%m-%Y %I:%M:%S %p')} IST"
                ),
            "action_type": "UnBlockInitiated",
            "action_by": rpt['username'],
            "processed_time": event_time_utc.isoformat()
        },
        {
            "action_msg": remarks_unblocked,
            "action_type": "OccUnblockingRemarks",
            "action_by": rpt['username'],
            "processed_time": event_time_utc.isoformat()
        }])

        await Alerts(**{
            "id": alert_record.get("id"),
            "alert_history": alert_history,
            "remarks_unblocked": remarks_unblocked,
            "file_uploaded_path": minio_path or ""
        }).modify()

        return {"status": True, "message": "Truck has been successfully unblocked"}

    except Exception:
        logger.exception("Unhandled error during VTS unblock")
        return {"status": False, "message": "Failed to unblock the truck"}



# Action get_vts_blocked_trucks
@router.post('/get_vts_blocked_trucks', tags=['Alerts'])
async def alerts_get_vts_blocked_trucks(data: Alerts_Get_Vts_Blocked_TrucksParams):

    tab = getattr(data, "tab", None)   

    # ============================================================
    # TAB 1: VTS BLOCKED LIST  (NO FILTERS SHOULD APPLY HERE)
    # ============================================================
    if tab == "vts":
        query =  (f"vehicle_unblocked_date is null and alert_section='VTS'"
                f"and interlock_name = 'Itdg Admin Blocked' ")

        vts_params = urdhva_base.queryparams.QueryParams(q=query, limit=0)

        alert_data = await Alerts.get_all(vts_params, resp_type='plain')
        vts_blocked_data = alert_data.get("data", [])

        return {
            "status": True,
            "message": "success",
            "data": {
                "vts_blocked_list": vts_blocked_data
            }
        }

    if tab == "alerts":
        # Extract BU filter only
        bu_value = None

        if data.cross_filters:
            for f in data.cross_filters:
                if f.key == "bu" and f.value:
                    bu_value = f.value
        # Build alert query
        alert_query = """
            alert_section = 'VTS'
            AND vehicle_unblocked_date IS NULL
            AND alert_status = 'Close'
            AND device_id IN ('Instance - 1', 'Instance - 2', 'Instance - 3')
        """

        if bu_value:
            alert_query += f" AND bu = '{bu_value}'"

        print("FINAL alert_query >>>", alert_query)
        alert_params = urdhva_base.queryparams.QueryParams(q=alert_query , limit=0)

        alert_params.fields = [
            "bu",
            "zone",
            "location_name",
            "sap_id",
            "alert_status",
            "alert_section",
            "vehicle_number",
            "vehicle_blocked_start_date",
            "vehicle_blocked_end_date",
            "transporter_code",
            "unique_id",
            "device_id"
            
        ]

        alerts_resp = await Alerts.get_all(alert_params, resp_type='plain')
        alert_blocked_data = alerts_resp.get("data", [])

        return {
            "status": True,
            "message": "success",
            "data": {
                "alert_blocked_list": alert_blocked_data
            }
        }

   
    # INVALID TAB HANDLING
    return {
        "status": False,
        "message": "Invalid tab. Valid values: 'vts', 'alerts'",
        "data": {}
    }

# Action get_vts_unblocked_trucks
@router.post('/get_vts_unblocked_trucks', tags=['Alerts'])
async def alerts_get_vts_unblocked_trucks(data: Alerts_Get_Vts_Unblocked_TrucksParams):
    query = (f"vehicle_unblocked_date is not null and alert_section='VTS'"
                f"and interlock_name = 'Itdg Admin Blocked'")
    
    alert_data = await Alerts.get_all(
        urdhva_base.queryparams.QueryParams(q=query,limit=0),resp_type='plain'
        )
    
    if alert_data["data"]:
        return {
            "status": True, 
            "message": "success", 
            "data": alert_data["data"]
            }
    return {
        "status": True, 
        "message": "No data found",
        "data": []
        }


# Action alerts_get_vts_query
@router.post('/alerts_get_vts_query', tags=['Alerts'])
async def alerts_alerts_get_vts_query(data: Alerts_Alerts_Get_Vts_QueryParams):
    """
    API endpoint to process VTS queries using LLM.
    Accepts vehicle_number with cross_filters.
    Returns vehicle details, prompt, or SQL query results.
    """
    try:
        logger.info(f"VTS Query request received: vehicle_number={data.vehicle_number}")
        
        # Log the cross_filters structure for debugging
        if data.cross_filters:
            logger.info(f"Cross filters received: {len(data.cross_filters)} items")
            for i, filter_item in enumerate(data.cross_filters):
                logger.info(f"Filter {i}: {filter_item.dict()}")
        
        result = await core_functions.process_vts_query(vehicle_number=data.vehicle_number, cross_filters=data.cross_filters)
        return result
        
    except Exception as e:
        logger.error(f"Error in get_vts_query: {e}")
        logger.error(f"Input data: {data.dict() if hasattr(data, 'dict') else 'Unable to serialize'}")
        return {
            "success": False,
            "error": str(e),
            "message": "Internal error processing VTS query",
            "generated_sql": None
        }


# Action unblock_alert_truck
@router.post('/unblock_alert_truck', tags=['Alerts'])
async def alerts_unblock_alert_truck(
    unique_id: str = fastapi.Form(...),
    remarks_unblocked: str | None = fastapi.Form(None),
    upload_file: fastapi.UploadFile | None = fastapi.File(None)
    ):
    try:
        rpt = urdhva_base.context.context.get("rpt", {})

        if not rpt:
            return {"status": False, "message": "Session got expired, Please Re-Login"}
         
        if ("HQO HSE SOD" not in rpt.get('novex_role',[])) and ("HQO LPG" not in rpt.get('novex_role',[])):
            return {"status": False, "message": "Not Allowed To Perform This Action"}

        if unique_id is None:
            logger.error("unblock_id missing in request payload")
            return { "status": False, "message": "unblock_id is required"}

        username = rpt.get("username")

        # ----------------------------
        # FETCH ALERT BY unique_id
        # ----------------------------
        params = urdhva_base.queryparams.QueryParams(
            q=f"unique_id='{unique_id}'", limit=1
        )
        
        alert_resp = await Alerts.get_all(params, resp_type="plain")

        if not alert_resp or not alert_resp.get("data"):
            return {"status": False, "message": "Alert not found"}
        
        alert = alert_resp["data"][0]

        if alert.get("vehicle_unblocked_date") is not None:
            return {"status": False,"message": "Truck is already unblocked"}
        
        minio_path = ""
        file_path = ""

        if upload_file:
            UPLOAD_DIR = os.path.join(urdhva_base.settings.uploads, "vts_blocked")
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            file_name = upload_file.filename
            file_path = os.path.join(UPLOAD_DIR, file_name)
            with open(file_path, "wb") as f:
                f.write(await upload_file.read())
            
        status, minio_path = minio_connector.upload_to_minio(
            "alerts",         # bucket (same bucket)
            "vts_blocked",    # section/folder
            str(unique_id),       # sub-folder
            file_path         # local filepath
        )

        if not status:
            return {"status": False,"message": "MinIO upload failed", "error": minio_path}
        
        alert_id = alert["id"]
        #history = alert.get("alert_history", []) or []
        transaction_id = f"{alert['id']}0"
        closed_at = alert.get('closed_at')
        process_instance_id = alert['workflow_instance_id']
        camunda_url = alert['workflow_url']
        for key in ['created_at', 'updated_at', '_sa_instance_state', '']:
            if key in alert:
                del alert[key]
        vehicle_number = alert['vehicle_number']
        if alert["bu"] in ["TAS"]:
            try:
                payload = [{
                    "blockingFlag": "N", 
                    "transactNo": transaction_id,
                    "truckRegNo": alert['vehicle_number'],
                    "blockingFrom": alert['vehicle_blocked_start_date'].strftime("%Y%m%d"),
                    "blockingTo": alert['vehicle_blocked_end_date'].strftime("%Y%m%d")
                }]

                unblocking_status,error_msg = await vts_analysis.post_blocked_tt_ims(payload)
                
                unblock_query = f"update vts_truck_details set truck_status = 'UNBLOCKED', blacklist='false' where truck_regno = '{vehicle_number}'"
                await VtsTruckDetails.update_by_query(unblock_query)
                vehicle_unblocked_date = datetime.datetime.now(tz=datetime.timezone.utc)
                
                if closed_at:
                    await Alerts(**{"id": alert_id,
                                    "vehicle_unblocked_date": vehicle_unblocked_date,
                                    "remarks_unblocked": remarks_unblocked,
                                    "file_uploaded_path": minio_path if minio_path else "",
                                    "mark_as_false": True}).modify()
                else:
                    if not username:
                        username = "Approver SOD"
                    alert["action_msg"] = f"Vehicle unblocked by {username}"
                    alert["action_type"] = "Approved"
                    await alert_manager.AlertAction.update_alert_history(input_data=alert, alert_data=alert)
                    await Alerts(**{"id": alert_id,
                                    "vehicle_unblocked_date": vehicle_unblocked_date,
                                    "closed_at": vehicle_unblocked_date,
                                    "alert_status": "Close",
                                    "alert_state": "Resolved",
                                    "device_msg": "unblocked_by_hqo_officer",
                                    "remarks_unblocked": remarks_unblocked,
                                    "file_uploaded_path": minio_path if minio_path else "",
                                    "mark_as_false": True}).modify()

                print("Status:", unblocking_status)
                print("Response JSON:", unblocking_status)
                delete_url = f"{camunda_url}/engine-rest/process-instance/{process_instance_id}"
                delete_response = requests.delete(delete_url)
                print("workflow_deletion Status code:", delete_response.status_code)
                print("workflow_deletion Response body:", delete_response.text)
            except requests.exceptions.HTTPError as e:
                print("HTTP error:", e, "Body:", getattr(e.response, "text", None))
            except requests.exceptions.RequestException as e:
                print("Request failed:", e)
        elif alert["bu"] in ["LPG"]:
            try:
                payload = {
                    "Request":{
                        "Request_ID": transaction_id,
                        "Vehicle_ID": alert['vehicle_number'],
                        "Status": "U",
                        "User_ID": "NOVEX_SYSTEM",
                        "IP_Address": "10.90.38.218"
                    }
                }
                
                unblocking_status,error_msg = await vts_analysis.post_lpg_tt(payload)
            
                unblock_query = f"update vts_truck_details set truck_status = 'UNBLOCKED', blacklist='false' where truck_regno = '{vehicle_number}'"
                await VtsTruckDetails.update_by_query(unblock_query)
                vehicle_unblocked_date = datetime.datetime.now(tz=datetime.timezone.utc)
                if closed_at:
                    await Alerts(**{"id": alert_id,
                                    "vehicle_unblocked_date": vehicle_unblocked_date,
                                    "remarks_unblocked": remarks_unblocked,
                                    "file_uploaded_path": minio_path if minio_path else "",
                                    "mark_as_false": True}).modify()
                else:
                    if not username:
                        username = "Approver LPG"
                    alert["action_msg"] = f"Vehicle unblocked by {username}"
                    alert["action_type"] = "Approved"
                    await alert_manager.AlertAction.update_alert_history(input_data=alert, alert_data=alert)
                    await Alerts(**{"id": alert_id,
                                    "vehicle_unblocked_date": vehicle_unblocked_date,
                                    "closed_at": vehicle_unblocked_date,
                                    "alert_status": "Close",
                                    "alert_state": "Resolved",
                                    "remarks_unblocked": remarks_unblocked,
                                    "file_uploaded_path": minio_path if minio_path else "",
                                    "device_msg": "unblocked_by_hqo_officer",
                                    "mark_as_false": True}).modify()
                
                print("Status:", unblocking_status)
                print("Response JSON:", unblocking_status)
                delete_url = f"{camunda_url}/engine-rest/process-instance/{process_instance_id}"
                delete_response = requests.delete(delete_url)
                print("workflow_deletion Status code:", delete_response.status_code)
                print("workflow_deletion Response body:", delete_response.text)
            except requests.exceptions.HTTPError as e:
                print("HTTP error:", e, "Body:", getattr(e.response, "text", None))
            except requests.exceptions.RequestException as e:
                print("Request failed:", e)

        return {"status": True, "message": "Alert unblocked successfully"}

    except Exception as e:
        print("Error:", e)
        return {"status": False, "message": "Failed to unblock alert"}


# Action attach_alert_blocked_file
@router.post('/attach_alert_blocked_file', tags=['Alerts'])
async def alerts_attach_alert_blocked_file(
    unique_id: str = fastapi.Form(...),
    remarks_unblocked: str = fastapi.Form(None),
    upload_file: fastapi.UploadFile = fastapi.File(...)
):
    try:
        # -----------------------------------
        # 1. Fetch alert record
        # -----------------------------------
        params = urdhva_base.queryparams.QueryParams(
            q=f"unique_id='{unique_id}'", limit=1
        )
        record_resp = await Alerts.get_all(params, resp_type="plain")

        if not record_resp.get("data"):
            return {
                "status": False,
                "message": "Record not found for given unique_id"
            }

        record = record_resp["data"][0]
        row_id = record["id"]

        # -----------------------------------
        # 2. TEMP FILE SAVE (LIKE NOTICE API)
        # -----------------------------------
        UPLOAD_DIR = os.path.join(urdhva_base.settings.uploads, "alerts")
        os.makedirs(UPLOAD_DIR, exist_ok=True)

        file_name = upload_file.filename
        file_path = os.path.join(UPLOAD_DIR, file_name)

        with open(file_path, "wb") as f:
            f.write(await upload_file.read())

        # -----------------------------------
        # 3. MINIO UPLOAD (PATH BASED)
        # -----------------------------------
        status, minio_path = minio_connector.upload_to_minio(
            "alerts",        # bucket
            "blocked_files", # section
            unique_id,       # folder
            file_path        # filepath
        )

        if not status:
            return {
                "status": False,
                "message": "MinIO upload failed",
                "error": minio_path
            }

        # -----------------------------------
        # 4. UPDATE SAME COLUMN
        # -----------------------------------
        update_data = {
            "id": row_id,
            "file_uploaded_path": minio_path
        }

        if remarks_unblocked:
            update_data["remarks_unblocked"] = remarks_unblocked

        await Alerts(**update_data).modify()

        return {
            "status": True,
            "message": "Attachment uploaded successfully",
            "file_uploaded_path": minio_path,
            "remarks_unblocked": remarks_unblocked
        }

    except Exception as e:
        return {
            "status": False,
            "message": "Failed to upload file",
            "error": str(e)
        }


# Action attach_vts_blocked_file
@router.post('/attach_vts_blocked_file', tags=['Alerts'])
async def alerts_attach_vts_blocked_file(
    unblock_id: str = fastapi.Form(...),
    remarks_unblocked: str = fastapi.Form(None),
    upload_file: fastapi.UploadFile | None = fastapi.File(None)
):
    try:
        rpt = urdhva_base.context.context.get('rpt', {})
        if not rpt:
            return {"status": False, "message": "Session got expired, Please Re-Login"}
        
        if ("HQO HSE SOD" not in rpt.get('novex_role',[])) and ("HQO LPG" not in rpt.get('novex_role',[])):
            return {"status": False, "message": "Not Allowed To Perform This Action"}
        
        # -----------------------------------
        # 1. Fetch VTS blocked record
        # -----------------------------------
        params = urdhva_base.queryparams.QueryParams(
            q=f"id='{unblock_id}'", limit=1
        )
        record_resp = await VtsManualBlocked.get_all(params, resp_type="plain")

        if not record_resp.get("data"):
            return {
                "status": False,
                "message": "Record not found for given unblock_id"
            }

        record = record_resp["data"][0]
        row_id = record["id"]

        # -----------------------------------
        # 2. TEMP FILE SAVE (SAME AS ALERT API)
        # -----------------------------------
        minio_path = ""
        if upload_file:
            UPLOAD_DIR = os.path.join(urdhva_base.settings.uploads, "vts_blocked")
            os.makedirs(UPLOAD_DIR, exist_ok=True)

            file_name = upload_file.filename
            file_path = os.path.join(UPLOAD_DIR, file_name)

            with open(file_path, "wb") as f:
                f.write(await upload_file.read())

            # -----------------------------------
            # 3. MINIO UPLOAD (PATH BASED)
            # -----------------------------------
            status, minio_path = minio_connector.upload_to_minio(
                "alerts",         # bucket (same bucket)
                "vts_blocked",    # section/folder
                unblock_id,       # sub-folder
                file_path         # local filepath
            )

            if not status:
                return {
                    "status": False,
                    "message": "MinIO upload failed",
                    "error": minio_path
                }

        # -----------------------------------
        # 4. UPDATE DB (SAME COLUMN)
        # -----------------------------------
        _date = urdhva_base.utilities.get_present_time()
        if record['bu'] in ['TAS']:
            payload = [
                {
                    "transactNo": str(record["transaction_number"]) + "0",
                    "truckRegNo": record["truck_number"],
                    "blockingFlag": "N",
                    "blockingFrom": (record['blocking_from'] + datetime.timedelta(hours=5, minutes=30)).strftime("%Y%m%d"),
                    "blockingTo": (record['blocking_to'] + datetime.timedelta(hours=5, minutes=30)).strftime("%Y%m%d")
                }
            ]
            print("-"*20)
            print("payload :", payload)
            print("-"*20)
            await vts_analysis.post_blocked_tt_ims(payload)
        
        if record['bu'] in ['LPG']:
            payload = {
                    "Request":{
                        "Request_ID": str(record["transaction_number"]) + "0",
                        "Vehicle_ID": record["truck_number"],
                        "Status": "U",
                        "User_ID": "NOVEX_SYSTEM",
                        "IP_Address": urdhva_base.settings.server_ip
                    }
            }
            print("-"*20)
            print("payload :", payload)
            print("-"*20)
            await vts_analysis.post_lpg_tt(payload)

        update_data = {
            "id": int(row_id),
            "unblocked_by": rpt["username"],
            "blocking_status": "unblocked",
            "blocking_flag": "N",
            "unblocked_date": _date,
            "file_uploaded_path": minio_path
        }

        if remarks_unblocked:
            update_data["remarks_unblocked"] = remarks_unblocked

        await VtsManualBlocked(**update_data).modify()

        return {
            "status": True,
            "message": "Attachment Uploaded to Minio And TT Unblocked successfully",
            "file_uploaded_path": minio_path,
            "remarks_unblocked": remarks_unblocked
        }

    except Exception as e:
        return {
            "status": False,
            "message": "Failed to upload file",
            "error": str(e)
        }


# Action hqo_blocked_vehicles
@router.post('/hqo_blocked_vehicles', tags=['Alerts'])
async def alerts_hqo_blocked_vehicles(data: Alerts_Hqo_Blocked_VehiclesParams):
    service = hqo_blocked.BlockedTruckService()
    return await service.get_blocked_trucks_service(
        data.alert_status,
        data.start_date,
        data.end_date
    )


# Action add_rca_reason
@router.post('/add_rca_reason', tags=['Alerts'])
async def alerts_add_rca_reason(data: Alerts_Add_Rca_ReasonParams):
    try:
        rpt = urdhva_base.context.context.get('rpt', {})
        if not rpt:
            return {"status": False, "message": "Session got expired, Please Re-Login"}
        alert_id = data.alert_id
        reason = data.reason
        query = f"""select * from alerts where id='{alert_id}'"""
        resp = await Alerts.get_aggr_data(query, limit=1)
        if not resp['data']:
            return {
                "status": True,
                "message": "Alert Not Found"
            }
        now_utc = urdhva_base.utilities.get_present_time(utc=True)
        ist_time = now_utc.astimezone(pytz.timezone("Asia/Kolkata"))

        alert = resp['data'][0]
        existing_rca = alert['rca']

        new_entry = (
            f"{reason} initiated by {rpt.get('username','')} "
            f"at {ist_time.strftime('%d-%m-%Y %I:%M:%S %p')} IST"
        )

        if existing_rca:
            rca = f"{existing_rca}\n{new_entry}"
        else:
            rca = new_entry

        alert["action_msg"] = new_entry
        alert["action_type"] = "Remarks"
        await alert_manager.AlertAction.update_alert_history(input_data=alert, alert_data=alert)

        await Alerts(**{"id": alert_id,
                        "rca": rca}).modify()
        
        return {
            "status": True,
            "message": "Remarks updated successfully"
        }
    except Exception as e:
        return {
            "status": False,
            "message": "Failed to update remarks",
            "error": str(e)
        }


# Action day_end_closure
@router.post('/day_end_closure', tags=['Alerts'])
async def alerts_day_end_closure(data: Alerts_Day_End_ClosureParams):
    try:
        rpt = urdhva_base.context.context.get('rpt', {})
        if not rpt:
            return {"status": False, "message": "Session got expired, Please Re-Login"}
        print("Unblocking all blocked alerts")
        await ro_analysis.close_ro_va_cleanliness_unblock_of_blocked(day_end=True)
        print("Closing all pending non blocked alerts")
        await ro_analysis.close_ro_va_cleanliness_open_alerts(day_end=True)
        return {"status": True, "message": "Successfully Closed All Alerts"}
    except Exception as e:
        print(traceback.format_exc())
        return {
            "status": False,
            "message": "Failed at day end closure",
            "error": str(e)
        }


# Action va_cleanliness_summary
@router.post('/va_cleanliness_summary', tags=['Alerts'])
async def alerts_va_cleanliness_summary(data: Alerts_Va_Cleanliness_SummaryParams):
    return await ro_analysis.create_va_cleanliness_summary(data)


# Action download_excel_report
@router.post('/download_excel_report', tags=['Alerts'])
async def alerts_download_excel_report(data: Alerts_Download_Excel_ReportParams):
    # Create Download models as per the report_model key
    if data.report_model == "VA_Cleanliness_Alerts":
        return await ro_analysis.generate_va_download_excel_report(data)
    return False, "Not Implemented"


# Action get_va_cleanliness_last_synced_time
@router.post('/get_va_cleanliness_last_synced_time', tags=['Alerts'])
async def alerts_get_va_cleanliness_last_synced_time(data: Alerts_Get_Va_Cleanliness_Last_Synced_TimeParams):
    last_synced_time = "-"
    try:
        redis_ins = await urdhva_base.redispool.get_redis_connection()
        last_synced_time = await redis_ins.get("va_cleanliness_last_sync")
        await redis_ins.close()
    except Exception as e:
        print(traceback.format_exc())
        print(e)
    return last_synced_time
