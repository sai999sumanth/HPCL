import urdhva_base
import time
import json
import httpx
import asyncio
import datetime
import traceback
import hpcl_ceg_model
import utilities.helpers as helpers
import orchestrator.alerting.alert_helper as alert_helper
import cache_gateway.cache_api_actions as cache_api_actions
import orchestrator.alerting.alert_factory as alert_factory

logger = urdhva_base.logger.Logger.getInstance("tas_alert_processing")


class TASAlertManager(alert_factory.AlertFactory):
    @classmethod

    async def create_bu_alert(cls, alert_data, camunda_url=urdhva_base.settings.camunda_url):
        """
        Create a business unit level alert

        Parameters:
            alert_data (dict): A dictionary containing the data to create the alert
                - bu (str): Business unit
                - sap_id (str): SAP ID
                - sop_id (str): SOP ID
                - staticalert_data (dict): Additional static data to be stored in the alert document
                - deviceId (str): Device ID
                - interlockName (str): Interlock name
                - severity (str): Severity of the alert
                - message (str): Alert message
                - alertHistory (list): List of alert history messages
            camunda_url:

        Returns:
            dict: A dictionary containing the status, message and the created alert document
        """
        try:
            logger.info(f"alert_data received to create alert {alert_data}")
            # Retrieve necessary fields from the alert_data
            status, loc_dt = await cache_api_actions.get_location_data(bu=alert_data['bu'], location_id=alert_data['sap_id'])
            #status, loc_dt = await alert_helper.get_location_details(bu=alert_data['bu'], sap_id=alert_data['sap_id'])
            if status:
                alert_data['location_data'] = loc_dt
            else:
                logger.info(f"Error getting location details {loc_dt} for {alert_data['bu']} / {alert_data['sap_id']}, "
                            f"Skipping alert creation")
                return {"status": False, "message": f"Location details not found for {alert_data['sap_id']}",
                        "alert_data": None}
            
            if urdhva_base.settings.environment == "prod":
                basepath = "/opt/ceg/algo/prod/"
            elif urdhva_base.settings.environment == "uat":
                basepath = "/opt/ceg/algo/uat/"
            else:
                basepath = "/opt/ceg/algo/things_board/device_data/"
            with open(f"{basepath}{alert_data['sap_id']}.json") as f:
                device_data = json.load(f)
            device_keys = []
            for rec in device_data["data"]:
                if rec['device_name'] == alert_data['device_name']:
                    for sensor in rec['sensors']:
                        if sensor['sensor_name'] in alert_data:
                            device_keys.append(f"{sensor['sensor_name']}: {alert_data[sensor['sensor_name']]}")
                    break
            device_data = f"{alert_data['device_name']}"
            processed_time = datetime.datetime.now(datetime.timezone.utc)
            
            if "alert_history" not in alert_data:
                alert_data["alert_history"] = [{
                    "processed_time": processed_time.isoformat(),
                    "allocated_time": processed_time.isoformat(),
                    "action_msg": f"{alert_data['interlock_name']} Interlock created",
                    "action_type": "InterlockCreated"
                }]

            camunda_url = await helpers.get_camunda_url(
                bu=alert_data['bu'], 
                sap_id=alert_data['sap_id'],
                alert_section="TAS", 
                location_data=loc_dt
            )
            alert_data['workflow_url'] = camunda_url
            alert_data['workflow_port'] = camunda_url.split(":")[2]

            return await cls.create_alert(alert_data, camunda_url)

        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return {"status": False, "message": str(e), "alert_data": None}

    @classmethod
    async def close_bu_alert(cls, alert_data):
        """
        Close a BU level alert asynchronously.

        Parameters:
            alert_data (dict): A dictionary containing the data to close the alert
                - bu (str): Business unit
                - sap_id (str): SAP ID
                - sop_id (str): SOP ID
                - alert_id (str): Unique alert ID

        Returns:
            dict: A dictionary containing the status, message, and the closed alert document.

        Raises:
            Exception: If the alert is not found or there's an error in closing the alert.
        """
        try:
            logger.info(f"Alert data received to close alert: {alert_data}")
            print("-- In Close Alert ---")
            
            
            if urdhva_base.settings.environment == "prod":
                basepath = "/opt/ceg/algo/prod/"
            elif urdhva_base.settings.environment == "uat":
                basepath = "/opt/ceg/algo/uat/"
            else:
                basepath = "/opt/ceg/algo/things_board/device_data/"
                
            with open(f"{basepath}{alert_data['sap_id']}.json") as f:
                device_data = json.load(f)

            device_keys = []
            for rec in device_data["data"]:
                if alert_data.get('device_name'):
                    if rec['device_name'] == alert_data['device_name']:
                        for sensor in rec['sensors']:
                            if sensor['sensor_name'] in alert_data:
                                device_keys.append(f"{sensor['sensor_name']}: {alert_data[sensor['sensor_name']]}")
                        break

            device_data_str = f"{alert_data.get('device_name')}({', '.join(device_keys)})"
            processed_time = datetime.datetime.now(datetime.timezone.utc)
            
            if "alert_history" not in alert_data:
                alert_data["alert_history"] = {
                    "processed_time": processed_time.isoformat(),
                    "allocated_time": processed_time.isoformat(),
                    "action_msg": f"{alert_data['interlock_name']} Interlock cleared",
                    "action_type": "InterlockCleared"
                }

            query = (f"external_id='{alert_data['alert_id']}' and bu='{alert_data['bu']}' and "
                    f"sap_id='{alert_data['sap_id']}' and alert_status!='Close'")
            resp_data = await hpcl_ceg_model.Alerts.get_all(
                urdhva_base.queryparams.QueryParams(q=query, limit=100), resp_type='plain'
            )
            # status, loc_dt = await cache_api_actions.get_location_data(bu=alert_data['bu'], location_id=alert_data['sap_id'])
            loc_dt = {}
            print("resp_data query : %s", query)
            print("resp_data :", resp_data)
            if len(resp_data['data']):
                for alert in resp_data['data']:
                    alert_id = alert['id']
                    tas_alert_data = await hpcl_ceg_model.Alerts.get(alert_id)
                    if not isinstance(tas_alert_data, dict):
                        tas_alert_data = tas_alert_data.__dict__

                    data = {
                        "messageName": "interLockOk",
                        "businessKey": tas_alert_data['unique_id'],
                        "processVariables": {
                            "alert_id": {"value": alert_id, "type": "String"},
                            "closed": {"value": True, "type": "Boolean"}
                        }
                    }
                    # await redis_ins.hdel("alert_camunda_url", str(alert['id']))

                    url = tas_alert_data.get('workflow_url')
                    logger.info("url --> %s", url)
                    if url:
                        url = url.rstrip('/') + "/engine-rest/message"
                    else:
                        url = await helpers.get_camunda_url(
                            bu=tas_alert_data['bu'],
                            sap_id=tas_alert_data['sap_id'],
                            alert_section="TAS",
                            location_data=loc_dt
                        )
                        url = url.rstrip('/') + "/engine-rest/message"

                    print("Camunda URL:", url)
                    # Retry logic
                    # max_retries = 5
                    # initial_delay = 5  # seconds

                    # for attempt in range(1, max_retries + 1):
                    #     # await asyncio.sleep(5)  # wait before the first send
                    #     print("attempt:", attempt)
                    #     try:
                    #         r = httpx.post(url, headers={'Content-Type': 'application/json'}, json=data, verify=False)
                    #         if r.status_code // 100 == 2:
                    #             print("Message sent to camunda")
                    #             break
                    #         else:
                    #             print(f"Attempt {attempt}: Error sending message to camunda: "
                    #                 f"{r.status_code} - {r.text} - {alert_data['unique_id']}")
                    #     except Exception as e:
                    #         logger.error(f"Attempt {attempt}: Exception in closing camunda flow {e} for alert_id {alert_id}, "
                    #                     f"business_key {tas_alert_data['unique_id']}")

                    #     if attempt < max_retries:
                    #         backoff = initial_delay * (2 ** (attempt - 1))
                    #         await asyncio.sleep(backoff)
                    #     else:
                    #         logger.error(f"Failed to send message to camunda after {max_retries} attempts")
                    max_retries = 5
                    initial_delay = 1  # seconds
                    max_backoff = 10  # seconds

                    await asyncio.sleep(1)  # Optional initial delay

                    async with httpx.AsyncClient(verify=False) as client:
                        for attempt in range(1, max_retries + 1):
                            try:
                                r = await client.post(url, headers={'Content-Type': 'application/json'}, json=data)
                                if r.status_code // 100 == 2:
                                    logger.info("Message sent to camunda")
                                    break
                                elif r.status_code in {400, 403, 404}:
                                    logger.error(f"Non-retryable error: {r.status_code} - {r.text}")
                                    logger.error(f"Attempt {attempt}: Non-retryable error sending message to camunda: "
                                            f"for alert_id {alert_id}, business_key {tas_alert_data['unique_id']}")
                                else:
                                    logger.error(f"Attempt {attempt}: Error sending message to camunda: "
                                                f"{r.status_code} - {r.text} - {tas_alert_data['unique_id']}")
                            except Exception as e:
                                logger.error(f"Attempt {attempt}: Exception in closing camunda flow {e} "
                                            f"for alert_id {alert_id}, business_key {tas_alert_data['unique_id']}")

                            if attempt < max_retries:
                                backoff = min(initial_delay * (2 ** (attempt - 1)), max_backoff)
                                await asyncio.sleep(backoff)
                            else:
                                logger.error(f"Failed to send message to camunda after {max_retries} attempts")
            else:
                await cls.close_alert(alert_data)

            return "Successfully sent message to camunda"

        except Exception as e:
            raise Exception(f"Error closing alert {e}")
