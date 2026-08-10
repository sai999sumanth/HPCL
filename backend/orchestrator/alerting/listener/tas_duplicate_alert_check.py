import urdhva_base
from datetime import datetime
import traceback
import hpcl_ceg_model
import aiohttp
from orchestrator.alerting.alert_manager import close_alert

logger = urdhva_base.logger.Logger.getInstance("alert_factory_log")

THINGSBOARD_URL = urdhva_base.settings.things_board_url
THINGSBOARD_USERNAME = urdhva_base.settings.things_board_username
THINGSBOARD_PASSWORD = urdhva_base.settings.things_board_password


async def duplicate_check(alertdata):
    query = (
        f"""bu = 'TAS' and """
        f"""sap_id = '{alertdata.get('sap_id', '')}' and """
        f"""alert_section = 'TAS' and """
        f"""device_id = '{alertdata.get('device_id', '')}' and """
        f"""device_name = '{alertdata.get('device_name', '')}' and """
        f"""interlock_name = '{alertdata.get('interlock_name', '')}' and """
        f"""alert_status != 'Close'"""
    )
    logger.info("query --> %s", query)
    params = urdhva_base.queryparams.QueryParams(q=query)
    resp = await hpcl_ceg_model.Alerts.get_all(params,resp_type='plain')

    if resp["data"]:
        #check in Thingsboard if the alerts are in CLEARED_UNCAK state
        #if they are in CLEARED_UNCAK state then close the alert in the DB'
        jwt_token = await get_thingsboard_jwt()

        for alert in resp["data"]:
            external_id = alert.get("external_id", "").strip()
            if external_id:
                print("external_id -->", external_id)
                tb_status = await check_tb_alert_status(external_id, jwt_token)
                print("status --->", tb_status)
                if tb_status == "CLEARED_UNACK":

                    alert_data = {
                        "bu": alert.get("bu"),
                        "sap_id": alert.get("sap_id"),
                        "sop_id": alert.get("sop_id"),
                        "alert_type": 'TAS',
                        "interlock_name": alert.get("interlock_name", ""),
                        "alert_id": external_id,  
                        "device_name": alert.get("device_name", "")
                    } 

                    await close_alert(alert_data)
        #TDO: Check in the thingsboard using the device id where the
        # already the respective alert is in CLEARED_UNCAK if it is CLEARED_UNCAK then close the alert in the DB also manually
        return True
    return False


async def check_tb_alert_status(external_id, jwt_token):
    """
    Query ThingsBoard for the alert status of a given external_id.
    Returns the status string (e.g., "CLEARED_UNCAK") or None if not found.
    """
    url = f"{THINGSBOARD_URL}/api/alarm/{external_id}"
    headers = {
        "Content-Type": "application/json",
        "X-Authorization": f"Bearer {jwt_token}"
    }
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as resp:
            if resp.status == 200:
                data = await resp.json()
                # Adjust this according to your ThingsBoard alert JSON structure
                return data.get("status", "")
            else:
                logger.error(f"Failed to fetch alert from ThingsBoard: {resp.status}")
    return None


async def get_thingsboard_jwt():
    url = f"{THINGSBOARD_URL}/api/auth/login"
    payload = {
        "username": THINGSBOARD_USERNAME,
        "password": THINGSBOARD_PASSWORD
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data.get("token")
            else:
                raise Exception(f"Failed to authenticate with ThingsBoard: {resp.status}")

async def alert_history_check(alertdata, month_check=None):
    date_check = datetime.now().strftime("%Y-%m-%d")
    if month_check:
        month = datetime.now().strftime("%Y-%b")
        query = (
            f"""bu = 'TAS' and """
            f"""sap_id = '{alertdata.get('sap_id', '')}' and """
            f"""alert_section = 'TAS' and """
            f"""device_id = '{alertdata.get('device_id', '')}' and """
            f"""device_name = '{alertdata.get('device_name', '')}' and """
            f"""interlock_name = '{alertdata.get('interlock_name', '')}' and """
            f"""TO_CHAR(created_at, 'YYYY-Mon') = '{month}' and alert_status='Close'"""
        )
    else:
        query = (
            f"""bu = 'TAS' and """
            f"""sap_id = '{alertdata.get('sap_id', '')}' and """
            f"""alert_section = 'TAS' and """
            f"""device_id = '{alertdata.get('device_id', '')}' and """
            f"""device_name = '{alertdata.get('device_name', '')}' and """
            f"""interlock_name = '{alertdata.get('interlock_name', '')}' and """
            f"""DATE(created_at) = '{date_check}' and alert_status='Close' """
        )
    params = urdhva_base.queryparams.QueryParams(q=query)
    resp = await hpcl_ceg_model.Alerts.get_all(params,resp_type='plain')
    if resp["data"]:
        return True
    return False

async def duplicate_loss_of_comm_check(alertdata):
    query = (
        f"""bu = 'TAS' and """
        f"""sap_id = '{alertdata.get('sap_id', '')}' and """
        f"""alert_section = 'TAS' and """
        f"""device_id = '{alertdata.get('device_id', '')}' and """
        f"""device_name = '{alertdata.get('device_name', '')}' and """
        f"""interlock_name = '{alertdata.get('interlock_name', '')}' and """
        f"""alert_status != 'Close'"""
    )
    params = urdhva_base.queryparams.QueryParams(q=query)
    resp = await hpcl_ceg_model.Alerts.get_all(params,resp_type='plain')
    if resp["data"]:
        return False
    return True