import urdhva_base
from datetime import datetime, timedelta, timezone
import traceback
import hpcl_ceg_model
import aiohttp
import asyncio
from orchestrator.alerting.alert_manager import close_alert
from orchestrator.alerting.listener.tas_duplicate_alert_check import get_thingsboard_jwt, check_tb_alert_status

THINGSBOARD_URL = urdhva_base.settings.things_board_url
THINGSBOARD_USERNAME = urdhva_base.settings.things_board_username
THINGSBOARD_PASSWORD = urdhva_base.settings.things_board_password

async def close_all_cleared_alerts():
    query = "bu = 'TAS' and alert_section = 'TAS' and alert_status != 'Close'"
    params = urdhva_base.queryparams.QueryParams(q=query, limit=0)
    resp = await hpcl_ceg_model.Alerts.get_all(params, resp_type='plain')
    
    if not resp.get("data"):
        print("No alerts found to close.")
        return

    jwt_token = await get_thingsboard_jwt()

    for alert in resp["data"]:
        external_id = alert.get("external_id", "").strip()
        workflow_instance_id = alert.get("workflow_instance_id", "")

        print(f"Processing alert with external_id: {external_id}")
        try:
            tb_status = await check_tb_alert_status(external_id, jwt_token)
            print(f"Alert status from ThingsBoard: {tb_status}")
        except Exception as e:
            print(f"Error fetching TB status: {e}")
           

        if tb_status == "CLEARED_UNACK":
            if not workflow_instance_id:
                 # Prepare the update data
                alert_update = alert.copy()
                alert_update.update({
                    "alert_status": "Close",
                    "alert_state" : "Resolved",
                    "closed_at": datetime.now(timezone.utc).isoformat(),
                })
                alert_update["id"] = alert.get("id")  # Ensure the primary key is set

                # Create the Alerts model instance and modify
                alert_obj = hpcl_ceg_model.Alerts(**alert_update)
                try:
                    result = await alert_obj.modify()
                    print(f"Closed alert in DB with external_id: {external_id} | DB id: {alert_update['id']} | Result: {result}")
                except Exception as e:
                    print(f"Error closing alert in DB with external_id: {external_id} | Exception: {e}")
                    print(traceback.format_exc())
            else:
                alert_data = {
                    "bu": alert.get("bu"),
                    "sap_id": alert.get("sap_id"),
                    "sop_id": alert.get("sop_id"),
                    "alert_type": 'TAS',
                    "interlock_name": alert.get("interlock_name", ""),
                    "alert_id": external_id,
                    "device_name": alert.get("device_name", "")
                }
                try:
                    success = await close_alert(alert_data)
                    print(f"Closed alert with external_id: {external_id} | Success: {success}")
                except Exception as e:
                    print(f"Error closing alert with external_id: {external_id} | Exception: {e}")
                    print(traceback.format_exc())

async def main():
    try:
        await close_all_cleared_alerts()
    except Exception as e:
        print(f"Error in main: {e}")
        print(traceback.format_exc())
if __name__ == "_main_":
    import asyncio
    asyncio.run(main())