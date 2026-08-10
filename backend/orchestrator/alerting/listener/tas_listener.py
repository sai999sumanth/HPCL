import urdhva_base
import os
import json
# import pika
import asyncio
import traceback
import hpcl_ceg_model
from orchestrator.alerting.alert_manager import create_alert, close_alert
import orchestrator.alerting.listener.tas_duplicate_alert_check as duplicates_check
import orchestrator.alerting.listener.tas_maintenance_alert_check as maintenance_check
import orchestrator.tas_analytics.tas_analytics as tas_analytics

logger = urdhva_base.logger.Logger.getInstance("rabbitmq_processing_log")

def load_device_data(sap_id):
    """
    Load the device data for the given SAP ID from the json file.

    Args:
        sap_id (str): The SAP ID of the device

    Returns:
        dict: The device data loaded from the json file
    """
    try:
        if urdhva_base.settings.environment == 'prod':
            data_path = f"/opt/ceg/algo/prod/{sap_id}.json"
        elif urdhva_base.settings.environment == 'uat':
            data_path = f"/opt/ceg/algo/uat/{sap_id}.json"
        else:
            data_path = f"/opt/ceg/algo/things_board/device_data/{sap_id}.json"
        

        with open(data_path, 'r') as file:
            return json.load(file)
    except Exception as e:
        print(f"Error loading device data for SAP ID {sap_id}: {e}")
        return None

def get_sensor_id(device_name, equipment_type, device_data):
    """
    Get the sensor_id for a given device_name and equipment_type from the device_data

    Args:
        device_name (str): The name of the device
        equipment_type (str): The type of the sensor
        device_data (dict): The device data loaded from the json file

    Returns:
        str: The sensor_id if found, None if not
    """
    for device in device_data.get("data", []):
        if device.get("device_name") == device_name:
            for sensor in device.get("sensors", []):
                if sensor.get("sensor_type") == equipment_type:
                    return sensor.get("sensor_id")
    return None

def fix_additional_info(additional_info):
    """
    Fix the additional info for the alert by converting the keys to the standardized ones.
    If the additional info contains sap_id, device_name and equipment_type, it will load the device data and
    get the sensor_id by calling get_sensor_id. If the sensor_id is found, it will add the sensor_id and device_name
    to the additional info and return it.
    :param additional_info: A dictionary containing the additional info for the alert
    :return: A dictionary containing the fixed additional info
    """
    for key, value in {"interlockName": "interlock_name", "BU": "bu", "sopid": "sop_id", "SAPID": "sap_id",
                       "plantlocationid": "sap_id", "deviceId": "device_id", "deviceType": "device_type",
                       "deviceName": "device_name", "Sensor_Type":"equipment_type", "Sensor_Name":"equipment_name"}.items():
        if key in additional_info:
            additional_info[value] = additional_info[key]
    
    sap_id = additional_info.get("sap_id")
    device_name = additional_info.get("device_name")
    equipment_type = additional_info.get("equipment_type")
    #Always include the original device_name as tas_device_name
    if device_name:
        additional_info["tas_device_name"] = device_name
    if sap_id and device_name and equipment_type:
        device_data = load_device_data(sap_id)
        if device_data:
            sensor_id = get_sensor_id( device_name, equipment_type, device_data)
            if sensor_id:
                additional_info["sensor_id"] = sensor_id
                if device_name[:2].lower() != sensor_id[:2].lower():
                    additional_info["device_name"] = f"{sensor_id}_{device_name}"
                else:
                    additional_info["device_name"] = device_name  
    return additional_info

async def tas_listener(rmsg):
    """
    Process a message from the ThingsBoard Rule Engine.

    Process a message from the ThingsBoard Rule Engine. The message is expected to be a dictionary
    containing details about the alarm. The 'status' key in the message is used to determine if the
    alarm is being created or cleared. If the 'status' key is 'ACTIVE_UNACK', then the alarm is being
    created and the function calls the create_alert function with the details from the message. If
    the 'status' key is 'CLEARED_UNACK', then the alarm is being cleared and the function calls the
    close_alert function with the details from the message. If the 'status' key is anything else, the
    function prints an error message and returns False.

    Args:
        rmsg (dict): A dictionary containing details about the alarm. The dictionary should contain
            the following keys: 'status', 'details', 'id', 'type', 'severity'.

    Returns:
        bool: True if the message was processed successfully, False otherwise.
    """
    logger.info(rmsg)
    try:
        if rmsg.get("details") and rmsg["details"].get("additionalInfo"):
            rmsg["details"]["additionalInfo"] = fix_additional_info(rmsg["details"]["additionalInfo"])
        logger.info('-' * 12)
        if rmsg['status'] == 'ACTIVE_UNACK':
            alertdata = rmsg['details']['additionalInfo']
            alertdata['severity'] = rmsg['details']['additionalInfo']['severity']
            alertdata['alert_type'] = rmsg['details']['additionalInfo']['bu']
            alertdata['alert_section'] = rmsg['details']['additionalInfo']['bu']
            alertdata['alert_id'] = rmsg['id']['id']

            if alertdata.get('interlock_name') in ["Fire Engine On_Status"]: 
                data = {
                    "bu": alertdata['bu'],
                    "device_name": alertdata['device_name'],
                    "sap_id": alertdata['sap_id'],
                    "fire_engine_on_datetime": rmsg['createdTime'],
                    "status": "ON"
                }
    
                await tas_analytics.check_run_time_fire_engine(data)
                return True
            
            if alertdata.get('interlock_name') in ["ROSOV_Close Status", "MOV_Close Status"]:
                if not alertdata.get('sensor_id'):
                    return False 
            #Handle empty sensor_id case
            if not alertdata.get('sensor_id'):
                device_name = alertdata.get('device_name', '')
                if device_name:
                   if '_' in device_name:
                       parts = device_name.split('_')
                       if len(parts) >= 2:
                         alertdata["sensor_id"] = parts[0].strip() # Extract the first part
                   elif '@' in device_name:
                        alertdata["sensor_id"] = device_name.split('@')[0].strip()
                else:
                      print("No valid separator found, sensor_id not assigned")

            custom_data = rmsg['details']['additionalInfo'].get("customData", {})

            
            alertdata['message'] = ", ".join([f"{key}={value}" for key, value in custom_data.items()])
            logger.info("Create Alert bu:%s SAPID:%s for:%s " % (alertdata.get('bu', ''), alertdata.get('sap_id', ''),
                                                        rmsg['type']))

            # First, check if it's a duplicate
            is_duplicate = await duplicates_check.duplicate_check(alertdata)
            
            if is_duplicate:
                if alertdata['interlock_name'] in ["BCU Permissive Off", "BCU Permissive Off_Fail"]:
                    await create_alert(alertdata)
                else:
                    logger.info(f"Alert already exists (duplicate) for: {alertdata}")
            else:
                logger.info("*"*100)
                logger.info(f"alertdata ------> {alertdata}")
                logger.info("*"*100)
                if alertdata['interlock_name'] in [
                    "VFT_Under Maintenance", "Secondary Radar_Under Maintenance", 
                    "ROSOV_Under Maintenance", "MOV_Under Maintenance", 
                    "Rim Seal system_Under Maintenance", "Tank_Under Maintenance"]:
                    logger.info("*"*100)
                    logger.info(f"into maintenance check --> {json.dumps(alertdata, default=str)}")
                    logger.info("*"*100)
                    await maintenance_check.create_under_maintenance_alert(alertdata)
                else:
                    logger.info("*"*100)
                    logger.info(f"into normal maintenance check  ---> {json.dumps(alertdata, default=str)}")
                    logger.info("*"*100)
                    is_maintenance_alert = await maintenance_check.maintenance_alert_check(alertdata)
                    if is_maintenance_alert:
                        logger.info("*"*100)
                        logger.info(f"Maintenance alert already exists for: {json.dumps(alertdata, default=str)}")
                        logger.info("*"*100)
                    else:
                        logger.info("*"*100)
                        logger.info(f"not maintenance alert ---> {json.dumps(alertdata, default=str)}")
                        logger.info("*"*100)
                        await create_alert(alertdata)


        elif rmsg['status'] == 'CLEARED_UNACK':
            alertdata = rmsg['details']['additionalInfo']
            alertdata['alert_type'] = rmsg['details']['additionalInfo']['bu']
            alertdata['alert_id'] = rmsg['id']['id']

            if alertdata.get('interlock_name') in ["Fire Engine On_Status"]:
                
                data = {
                    "bu": alertdata['bu'],
                    "device_name": alertdata['device_name'],
                    "sap_id": alertdata['sap_id'],
                    "fire_engine_off_datetime": rmsg['clearTs'],
                    "status": "OFF"
                }
                
                await tas_analytics.check_run_time_fire_engine(data)
                return True
            logger.info("Close Alert bu:%s SAPID:%s for:%s " % (alertdata.get('bu', ''), alertdata.get('sap_id', ''),
                                                        rmsg['type']))
            await close_alert(alertdata)
        else:
            logger.info("Invalid message received:%s" % rmsg)
        return True
    except Exception as e:
        logger.info(traceback.format_exc())
        logger.info("Exception in processing RQ message:%s" % e)

# if __name__ == "__main__": 
    # asyncio.run(tas_listener())