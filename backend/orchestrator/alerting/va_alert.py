import urdhva_base
import re
import json
import datetime
import traceback
import urdhva_base.redispool
import utilities.interlock_mapping
import utilities.helpers as helpers
import utilities.va_alert_mapping as va_alert_mapping
import orchestrator.alerting.alert_helper as alert_helper
import orchestrator.alerting.alert_factory as alert_factory

logger = urdhva_base.logger.Logger.getInstance("va_alert_processing")


class VAAlertManager(alert_factory.AlertFactory):
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

            # here record['alert_section'] will be alert_type of VA
            # Getting location_id in this form from payload example "location_id": "ACC, Bandra, 11073010, 11073010",
            location_id = alert_data['location_id'].split(",")[-1].strip()

            if not location_id:
                logger.info("Invalid data format: location_id is missing")
                return {"status": False, "message": "Invalid data format: location_id is missing", "alert_data": alert_data}


            # Retrieve necessary fields from the alert_data
            status, loc_dt = await alert_helper.get_location_details(bu=alert_data['location_type'],
                                                                     sap_id=location_id)
            if not status:
                logger.info(f"Error in finding location {location_id} "
                            f"for bu {alert_data['location_type']} - {loc_dt}")
                loc_dt = {'name': ""}

            recv_time = datetime.datetime.now(tz=datetime.timezone.utc)
            if isinstance(alert_data, dict):
                alert_records = [alert_data]  # Wrap single record in a list for uniform processing
            elif isinstance(alert_data, list):
                alert_records = alert_data  # Use directly if it's already a list
            else:
                logger.error("Invalid alert_data format. Expected dict or list of dicts.")
                return
            for record in alert_records:
                try:
                    exception_msg = " ".join([
                        f"New Alert created at {recv_time} for",
                        f"alert_type - {record['alert_section']},",
                        f"alert_description - {record['alert_description']},",
                        f"device_id - {record['device_id']},",
                        f"video_url - {record['video_url']}"
                        ])
                    allocated_time = datetime.datetime.now(datetime.timezone.utc)
                    processed_time = datetime.datetime.now(datetime.timezone.utc)
                    alert_history = [{
                        "action_msg": exception_msg,
                        "action_type": "Created",
                        "alert_status": "Open",
                        "allocated_time": allocated_time.isoformat(),
                        "processed_time": processed_time.isoformat()
                        }]
                    # here record['alert_section'] will be alert_type of VA
                    # Retrieving the alert_mapping details for alert_type based on location_type and alert_type.
                    va_alert_data = va_alert_mapping.VA_Alert_Mapping[record['location_type']].get(
                        record['alert_section'], {})
                    logger.info(f"va alert data: {va_alert_data}")
                    if not va_alert_data:
                        logger.info("interlock_details not found")
                        continue

                    # Generate a unique key using sap_id, location_type, interlock_name of alert_type and device_id 
                    # for alert identification using multiple parameters
                    keys = [location_id, record['location_type'], "VA", record['device_id'],
                            va_alert_data['name']]
                    
                    # Generate a unique alert_id using the keys
                    alert_id = helpers.generate_hash(keys)
                    redis_ins = await urdhva_base.redispool.get_redis_connection()

                    # Checking if the alert_id for the given alert_type already exists in Redis.
                    # This is because we store the alert_id in Redis with a 3-hour expiration time.
                    # If the same alert_type is received from the same device_id within the expiration period,
                    # it will be considered a duplicate, and processing will be skipped.
                    # Retrieving Interlock_mapping details like sop_id, interlock_name for the alert_type 
                    # based on location_type and interlock_name.
                    interlock_details = utilities.interlock_mapping.get_interlock_name(
                        record['location_type'],
                        va_alert_data["name"])
                    logger.info(f"va interlock data: {interlock_details}")
                    
                    # preparing alert_data for VA
                    interlock_details.update({"bu": record['location_type'],
                                              "location_name": loc_dt['name'],
                                              "sap_id": location_id,
                                              "device_id": record['device_id'],
                                              "device_name": record['device_id'],
                                              "message": record['video_url'],
                                              "severity": va_alert_data["severity"],
                                              "alert_id": alert_id,
                                              "alert_section": "VA",
                                              "alert_history":alert_history,
                                              "vendor_alert_id": record.get("alert_id", alert_id),
                                              "alert_timestamp": record.get("alert_timestamp", None),
                                              "violation_type": record['alert_section']
                                              })
                    
                    camunda_url = await helpers.get_camunda_url(bu=alert_data['location_type'], sap_id=location_id,
                                                        alert_section="VA")
                    await cls.create_alert(interlock_details, camunda_url)
                except Exception as e:
                    print(traceback.format_exc())
                    logger.error(f"Exception in processing alert data {e}, Traceback "
                                 f"{traceback.format_exc()}, data {alert_data}")

        except Exception as e:
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
            return await cls.close_alert(alert_data)

        except Exception as e:
            raise Exception(status_code=500, detail="Error closing alert.") from e
