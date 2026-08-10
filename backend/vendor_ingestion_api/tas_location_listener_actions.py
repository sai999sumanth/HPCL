import json

from ingestion_api_enum import *
from ingestion_api_model import *
import fastapi
import uuid
from orchestrator.alerting.alert_manager import create_alert, close_alert
import hpcl_ceg_model
import traceback
import pytz
import httpx
from orchestrator.alerting.listener.tas_duplicate_alert_check import duplicate_loss_of_comm_check

router = fastapi.APIRouter(prefix='/tas_location_listener')

ist = pytz.timezone('Asia/Kolkata')

# Action get_agent_service_status
@router.post('/get_agent_service_status', tags=['TAS_Location_Listener'])
async def tas_location_listener_get_agent_service_status(data: Tas_Location_Listener_Get_Agent_Service_StatusParams):
        if data:
            sap_id = data.sap_id
            status = data.status
            message = data.message
            now = datetime.datetime.now(ist).isoformat()

        redis_client = await urdhva_base.redispool.get_redis_connection()
        if status == "success":
            await redis_client.hset("tas_agent_up_status", sap_id, now )# update the current date
            
        if status == "failed":
            failure_data = json.dumps({
                "status": status,
                "message": message,
                "timestamp": now
            })
            await redis_client.hset("tas_agent_failure_status", sap_id, failure_data)


# Action get_agent_comm_status
@router.post('/get_agent_comm_status', tags=['TAS_Location_Listener'])
async def tas_location_listener_get_agent_comm_status(data: Tas_Location_Listener_Get_Agent_Comm_StatusParams):
    if data:
        sap_id = data.sap_id
        status = data.status
        message = data.message
        opcda_status = data.opcda_status
        data_receiving_status = data.data_receiving_status
        configuration_healthy = data.configuration_healthy
        last_opc_failure = data.last_opc_failure
        last_rabbit_failure = data.last_rabbit_failure

        await check_and_trigger_alert(sap_id, status, message)

        last_status_query = f"""sap_id = '{sap_id}'"""
        last_record = await TasAgentCommStatus.get_all(
            urdhva_base.queryparams.QueryParams(
                q=last_status_query,
                limit=1,
                sort=json.dumps({"created_at": "desc"})
            ),
            resp_type='plain'
        )

        last_status = None
        last_opcda_status = None
        last_data_receiving_status = None
        last_configuration_healthy = None

        if last_record.get("data"):
            last_data = last_record["data"][0]
            last_status = last_data.get("status")
            last_opcda_status = last_data.get("opcda_status")
            last_data_receiving_status = last_data.get("data_receiving_status")
            last_configuration_healthy = last_data.get("configuration_healthy")

    
        if (last_status == status and 
            last_opcda_status == opcda_status and 
            last_data_receiving_status == data_receiving_status and 
            last_configuration_healthy == configuration_healthy):
            print(f"Skipping No change Status for SAP ID: {sap_id}")
            return {"message": "No change in status"}

        query = f"""
            SELECT name FROM location_master
            WHERE bu = 'TAS' AND sap_id = '{sap_id}' AND location_onboard = true
        """
        location_name = await hpcl_ceg_model.LocationMaster.get_aggr_data(query)
        if location_name.get("data", []):
            location_name = location_name["data"][0].get("name")
        else:
            location_name = None

        data1 = {
            "sap_id": sap_id,
            "status": status,
            "message": message,
            "opcda_status": opcda_status,
            "data_receiving_status": data_receiving_status,
            "configuration_healthy": configuration_healthy,
            "last_opc_failure": last_opc_failure,
            "last_rabbit_failure": last_rabbit_failure,
            "location_name": location_name
        }

        await TasAgentCommStatusCreate(**data1).create()
        return {"message": "Status updated successfully"}
    
async def check_and_trigger_alert(sap_id: str, status: str, message: str):
    """Independent function to check and trigger/close alerts based on 1 hour failure logic"""
    
    if status == "failed":
        processed_time = datetime.datetime.now(datetime.timezone.utc)
        alert_history = [{
            "processed_time": processed_time.isoformat(),
            "allocated_time": processed_time.isoformat(),
            "action_msg": message,
            "action_type": "InterlockCreated",
        }]
        
        alert_data = {
            "bu": "TAS",
            "sap_id": sap_id,
            "sop_id": "SOP099",
            "interlock_name": "Loss Of Communication",
            "device_name": "Communication Loss",
            "alert_type": "TAS",
            "device_type": message,
            "severity": "critical",
            "alert_id": str(uuid.uuid1()),
            "alert_history": alert_history,
        }
        
        not_duplicate = await duplicate_loss_of_comm_check(alert_data)
        if not_duplicate:
            success = await create_alert(alert_data)
            print(f"{'Alert created successfully' if success else 'Failed to create alert'} for SAP ID: {sap_id}")
        else:
            print(f"Duplicate alert skipped for SAP ID: {sap_id}")
            
    elif status == "success":
        query = f"interlock_name = 'Loss Of Communication' and bu = 'TAS' and sap_id = '{sap_id}' and alert_section = 'TAS' and alert_status != 'Close'"
        params = urdhva_base.queryparams.QueryParams(q=query, limit=0)
        resp = await hpcl_ceg_model.Alerts.get_all(params, resp_type='plain')
        
        if not resp.get("data"):
            print(f"No open alerts found to close for SAP ID: {sap_id}")
            return
        
        async with httpx.AsyncClient() as client:
            for alert in resp["data"]:
                process_instance_id = alert.get("workflow_instance_id")
                workflow_url = alert.get("workflow_url")
                if process_instance_id and workflow_url:
                    camunda_payload = {
                        "messageName": "Healthy",
                        "processInstanceId": process_instance_id
                    }
                    url = f"{workflow_url}/engine-rest/message"
                    try:
                        response = await client.post(url=url, json=camunda_payload, timeout=10)
                        if response.status_code in [200, 204]:
                            print(f"Sent Healthy message to Camunda for alert ID: {alert.get('unique_id')}")
                    except Exception as e:
                        print(f"Error sending Healthy to Camunda for alert ID {alert.get('unique_id')}: {str(e)}")
                        traceback.print_exc()