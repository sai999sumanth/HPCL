import urdhva_base
import asyncio
import hpcl_ceg_model
import datetime
import aiohttp
from orchestrator.workflow.workflow_process import Camunda


async def is_workflow_running(business_key: str, camunda_url: str) -> bool:
    """
    Returns True if workflow with given businessKey is already running
    """
    url = f"{camunda_url}/engine-rest/process-instance"
    params = {
        "businessKey": business_key,
        "active": "true"
    }

    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params, timeout=10) as resp:
            if resp.status != 200:
                raise Exception(
                    f"Camunda check failed: {resp.status} - {await resp.text()}"
                )

            data = await resp.json()
            return len(data) > 0

def to_iso_string(dt):
    if isinstance(dt, datetime.datetime):
        return dt.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + "Z"
    return dt or ""

async def trigger_workflow_for_missing_data():
    query = f"""select * from alerts 
                where interlock_name = 'Dry Out Each Indent Wise MainFlow'
                and alert_status!='Close' and workflow_instance_id=''
            """
    
    print('*'*20)
    print("query to find missing data alerts for triggering workflow:", query)
    print('*'*20)

    alerts_data = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)

    if not alerts_data.get("data", []):
        print("No missing data alerts found for triggering workflow.")
        return

    alert_level = 'level - 1'
    workflow_id = 'DryOutEachIndentWiseMainFlow'

    not_running_alerts = []

    print('*'*20)
    print('length of records',len(alerts_data.get("data", [])))
    print('*'*20)
    
    for alert in alerts_data.get("data", []):
        workflow_datetiem = alert.get('workflow_datetime')
        print('*'*20)
        print('workflow_datetime from alert data:', workflow_datetiem)
        print('*'*20)
        prod_reqd_dt = ''
        payload = {"businessKey": alert.get('unique_id', ''),
                   "variables": {"alert_id": {"value": alert['id'], "type": "String"},
                                 "interlock_name": {"value": alert.get('interlock_name'), "type": "String"},
                                 "interlock_id": {"value": alert.get('interlock_id'), "type": "String"},
                                 "location_device_id": {"value": alert.get('device_id', ''), "type": "String"},
                                 "location_type": {"value": alert.get('bu'), "type": "String"},
                                 "sap_id": {"value": alert.get('sap_id'), "type": "String"},
                                 "sop_id": {"value": alert.get('sop_id'), "type": "String"},
                                 "dealer_id": {"value": alert.get('dealer_id', ''), "type": "String"},
                                 "product_code": {"value": str(alert.get('product_code', '')), "type": "String"},
                                 "workflow_datetime": {"value": to_iso_string(alert.get('workflow_datetime')),"type": "String"},
                                 "indent_no": {"value": alert.get('indent_no', ''), "type": "String"},
                                 "indent_raised_date": {"value": to_iso_string(alert.get('indent_raised_date')),"type": "String"},
                                 "terminal_plant_name": {"value": alert.get('terminal_plant_name', ''), "type": "String"},
                                 "prod_reqd_dt": {"value": prod_reqd_dt, "type": "String"},
                                 "va_level": {"value": alert_level, "type": "String"},
                                 "terminal_plant_id": {"value": alert.get('terminal_plant_id', ''), "type": "String"},
                                 "cause_effect": {"value": alert.get('Cause_Effect', ''), "type": "String"},
                                 "alert_section": {"value": alert.get('alert_section', ''), "type": "String"},
                                 "cause_sop_id": {"value": alert.get('cause_sop_id', ''), "type": "String"},
                                 "effect_sop_id": {"value": alert.get('effect_sop_id', ''), "type": "String"},
                                 "device_id": {"value": alert.get('device_id', ''), "type": "String"},
                                 "device_name": {"value": alert.get('device_name', ''), "type": "String"},
                                 "device_type": {"value": alert.get('device_type', ''), "type": "String"},
                                 "tas_device_name": {"value": alert.get('tas_device_name', ''), "type": "String"},
                                }}
        
        print('*'*20)
        print('Payload for triggering workflow:', payload)
        print('*'*20)
        CAMUNDA_BASE_URL = f"{alert.get('workflow_url')}"
        if await is_workflow_running(business_key=alert.get('unique_id', ''), camunda_url=CAMUNDA_BASE_URL):
            print(f"Workflow already running for businessKey={alert.get('unique_id', '')}, skipping trigger")
            continue
        else:
            not_running_alerts.append(alert.get('id'))
            try:
                await Camunda().start_workflow(payload, workflow_id, camunda_url=CAMUNDA_BASE_URL)
                print(f"Workflow triggered successfully for alert id {alert.get('id')}")
            except Exception as e:
                print(f"Failed to trigger workflow for alert id {alert.get('id')}. Error: {str(e)}")
    print('*'*20)
    print('Alerts for which workflow is not running and can be triggered:', not_running_alerts)
    print('*'*20)
        
if __name__ == "__main__":
    asyncio.run(trigger_workflow_for_missing_data())