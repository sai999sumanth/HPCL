import urdhva_base
import pytz
import requests
import datetime
import charts_actions
import hpcl_ceg_model
import dashboard_studio_model
from more_itertools import batched
import orchestrator.alerting.alert_manager as alert_manager
import orchestrator.alerting.alert_factory as alert_factory
import orchestrator.dbconnector.credential_loader as credential_loader
from utilities.connection_mapping import product_code_mapping, connection_mapping


async def get_emlock_headers():
    redis_ins = await urdhva_base.redispool.get_redis_connection()
    vendor = "hpcl_emlock"
    db_access_key = ""
    if await redis_ins.hexists("vendor_auth", f"{vendor}_access_key"):
        db_access_key = await redis_ins.hget("vendor_auth", f"{vendor}_access_key")
    headers = {
        "Content-Type": "application/json",
        "ceg-auth-token": db_access_key
    }
    return headers

async def close_emlock_alert(alert_data: dict):
    """
    Args:
        alert_data:{
            "emlockExceptionId":"6146",
            "terminalCode":"location code",
            "truckNumber":"TT Reg No",
            "exceptionType":"exception name",
            "status":"1",
            "acknowledgedUser":"Employee code",
            "acknowledgedTime":"2025-02-01 17:00:00",
            "remarks":"",
            "metaData": "{'loadNumber':'456123','fanNumber':'987456', 'invoiceNumber':'987456-
123','tripType':'single', 'roCode':'123', 'terminalCode':''}"
        }

    Returns:

    """

    headers = await get_emlock_headers()
    creds = credential_loader.get_credentials("EM_LOCK")
    url = f"http://{creds['host']}:{creds['port']}/api/exceptionCloseAlert"
    response = requests.post(
        url=url, json=alert_data, headers=headers
    )
    print("response: ", response.json())
    if response.status_code // 100 == 2:
        return {"status": True, "message": "Data posted successfully", "data": response.json()}
    return {"status": False, "message": "Data posting unsuccessfully", "data": response.json()}

async def close_alerts_by_schedule():
    time_stamp = datetime.datetime.now(datetime.timezone.utc)
    to_day = time_stamp.astimezone(pytz.timezone('Asia/Kolkata')) - datetime.timedelta(1)

    query = f"select id from alerts where alert_status != 'Close' and external_timestamp::date = '{to_day}' and alert_section = 'EMLock'"
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
    #     "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # alerts = await function(query=query)
    alerts = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
    alerts = alerts.get("data", [])
    for alert in alerts:
        alert_data = await hpcl_ceg_model.Alerts.get(alert['id'])
        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__
        alert_data['alert_id'] = alert_data['id']
        input_data = {
            "action_type": "Message",
            "action_msg": "SYSTEM Auto Closed On EOD"
        }
        # Updating Alert History
        await alert_manager.AlertAction().update_alert_history(input_data, alert_data)

        # Closing Alert Data.
        await alert_factory.AlertFactory().close_alert(alert_data)
    return {"status": True, "message": "Alerts Closed"}

async def close_alerts_by_vendor():
    query = (f"select id, external_id from alerts where alert_section = 'EMLock' and alert_status != 'Close' and "
             f"created_at BETWEEN NOW() - INTERVAL '30 minutes' AND NOW();")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
    #     "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # alerts = await function(query=query)
    alerts = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
    alerts = alerts.get("data", [])
    alert_mapping = {str(x['external_id']): str(x['id']) for x in alerts}
    creds = credential_loader.get_credentials("EM_LOCK")
    url = f"http://{creds['host']}:{creds['port']}/api/exceptionStatusCheck"
    headers = await get_emlock_headers()
    for batch in batched(list(alert_mapping.keys()), 1000):
        response = requests.post(
            url=url, json={"emlockExceptionIds": list(batch)}, headers=headers
        )
        response = response.json()
        response = response.get("data", {}).get("exceptionStatus", [])
        for status in response:
            if status['emlockExceptionStatus'] == 'INACTIVE':
                alert_data = await hpcl_ceg_model.Alerts.get(alert_mapping.get(str(status["emlockExceptionId"])))
                if not isinstance(alert_data, dict):
                    alert_data = alert_data.__dict__
                alert_data['alert_id'] = alert_data['id']
                input_data = {
                    "action_type": "Message",
                    "action_msg": "SYSTEM Auto Closed Response From Vendor"
                }
                # Updating Alert History
                await alert_manager.AlertAction().update_alert_history(input_data, alert_data)

                # Closing Alert Data.
                await alert_factory.AlertFactory().close_alert(alert_data)
    return {"status": True, "message": "Alerts Closed"}

async def is_alert_exists(alert_data):
    query = (f"select id from alerts where vehicle_number = '{alert_data['truck_number']}' and alert_status != 'Close' and alert_section = 'EMLock' " 
            f"and external_id = '{alert_data['emlock_exception_id']}' and violation_type='{alert_data['exception_type']}' "
            f"and sap_id = '{alert_data['location_id']}' and bu='{alert_data['location_type']}'")
    print("query: ", query)
    emlock_alert_data = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
    print("emlock_alert_data: ", emlock_alert_data)
    if emlock_alert_data.get("data", []):
        return True
    return False
