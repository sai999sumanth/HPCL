import urdhva_base
import re
import time
import json
import httpx
import asyncio
import datetime
import traceback
import hpcl_ceg_model
import utilities.helpers as helpers
from orchestrator.alerting.alert_manager import create_alert, close_alert

logger = urdhva_base.logger.Logger.getInstance("maintenance_alert_processing_log")

async def maintenance_alert_check(alert_data):
    """
    Check if an alert should be created based on maintenance status and existing alerts.
    
    Returns:
        bool: True if alert should be skipped (don't create), False if alert should be created
    """
    try:
        logger.info("alert_data ---> ", alert_data)
        related_equipment_names = ["VFT", "RADAR", "ROSOV", "MOV", "RIMSEAL"]
        equipment_names_str = "', '".join(related_equipment_names)
        current_equipment_name = alert_data.get('equipment_name', '')
        original_device_name = alert_data.get('device_name', '')

        # Extract tas_device_name
        if re.match(r'^[A-Z]+[- ][A-Z0-9]+_', original_device_name) and not original_device_name.startswith('TK-') :
            tas_device_name = original_device_name.split('_', 1)[1]
        else:
            tas_device_name = original_device_name

        if alert_data['interlock_name'] in ['ESD ROSOV_Close Status_Fail', 'ESD MOV_Close Status_Fail']:
            print(f"Creating alert for exception interlock_name: {alert_data['interlock_name']}")
            return False
        interlock_name = alert_data.get('interlock_name', '')
        if tas_device_name.endswith('_M'):
            tas_device_name_for_query = tas_device_name[:-2]  # remove last 2 characters
        else:
            tas_device_name_for_query = tas_device_name

        # Only perform this check if the current alert's interlock name does NOT end with "Maintenance"
        if not interlock_name.endswith("Maintenance"):
            await asyncio.sleep(3)
            logger.info(f"Checking for Tank_Under_Maintenance alert for device: {tas_device_name_for_query}")

            # Step 1 - Check if tank itself is under maintenance
            tank_maintenance_query = (
                f"""bu = 'TAS' and """
                f"""sap_id = '{alert_data.get('sap_id', '')}' and """
                f"""alert_section = 'TAS' and """
                f"""regexp_replace(tas_device_name, '_M$', '') = '{tas_device_name_for_query}' and """
                f"""interlock_name LIKE '%Tank_Under_Maintenance%' and """
                f"""alert_status != 'Close'"""
            )
            logger.info(f"Tank under maintenance check query: {tank_maintenance_query}")

            tank_maintenance_params = urdhva_base.queryparams.QueryParams(q=tank_maintenance_query)
            tank_maintenance_resp = await hpcl_ceg_model.Alerts.get_all(tank_maintenance_params, resp_type='plain')

            if tank_maintenance_resp["data"]:
                logger.info(f"Device '{tas_device_name_for_query}' has an active Tank_Under_Maintenance alert - skipping new alert for equipment '{current_equipment_name}'")
                return True

            logger.info(f"No Tank_Under_Maintenance alert found for device: {tas_device_name_for_query} - proceeding to equipment level check")

            if interlock_name in ['MOV_Close Status', 'ROSOV_Close Status', 'ROSOV_Close Status_Fail', 'MOV_Close Status_Fail']:
                effect_due_to = alert_data.get('Effect_Created_Dueto', '')
                logger.info(f"Interlock '{interlock_name}' is MOV/ROSOV type - checking if triggered due to equipment '{effect_due_to}' under maintenance for device: {tas_device_name_for_query}")

                effect_close_query = (
                    f"""bu = 'TAS' and """
                    f"""sap_id = '{alert_data.get('sap_id', '')}' and """
                    f"""alert_section = 'TAS' and """
                    f"""regexp_replace(tas_device_name, '_M$', '') = '{tas_device_name_for_query}' and """
                    f"""equipment_name = '{effect_due_to}' and """
                    f"""interlock_name LIKE '%Maintenance%' and """
                   f"""alert_status != 'Close'"""
                )
                logger.info(f"MOV/ROSOV effect due to maintenance check query: {effect_close_query}")

                effect_params = urdhva_base.queryparams.QueryParams(q=effect_close_query)
                effect_resp = await hpcl_ceg_model.Alerts.get_all(effect_params, resp_type='plain')

                if effect_resp["data"]:
                    logger.info(f"Interlock '{interlock_name}' on device '{tas_device_name_for_query}' is triggered due to equipment '{effect_due_to}' being under maintenance - skipping new alert")
                    return True

                logger.info(f"No maintenance alert found for effect equipment '{effect_due_to}' on device '{tas_device_name_for_query}' - proceeding to equipment level check")


            # Step 2 - Check equipment specific maintenance
            if current_equipment_name is not None and current_equipment_name in related_equipment_names:
                logger.info(f"Checking equipment specific maintenance alert for equipment: {current_equipment_name}, device: {tas_device_name_for_query}")
                

                equipment_maintenance_query = (
                    f"""bu = 'TAS' and """
                    f"""sap_id = '{alert_data.get('sap_id', '')}' and """
                    f"""alert_section = 'TAS' and """
                    f"""regexp_replace(tas_device_name, '_M$', '') = '{tas_device_name_for_query}' and """
                    f"""equipment_name = '{current_equipment_name}' and """
                    f"""interlock_name LIKE '%Maintenance%' and """
                    f"""alert_status != 'Close'"""
                )
                logger.info(f"Equipment maintenance check query: {equipment_maintenance_query}")

                equipment_maintenance_params = urdhva_base.queryparams.QueryParams(q=equipment_maintenance_query)
                equipment_maintenance_resp = await hpcl_ceg_model.Alerts.get_all(equipment_maintenance_params, resp_type='plain')

                if equipment_maintenance_resp["data"]:
                    logger.info(f"Equipment '{current_equipment_name}' has an active maintenance alert for device '{tas_device_name_for_query}' - skipping new alert")
                    return True

                logger.info(f"No active maintenance alert found for equipment '{current_equipment_name}' on device '{tas_device_name_for_query}' - alert will be created")

            else:
                logger.info(f"Equipment '{current_equipment_name}' is not in related equipment list - no equipment level maintenance check needed")

        logger.info(f"No blocking conditions found - alert will be created for equipment '{current_equipment_name}' on device '{tas_device_name_for_query}'")
        return False  

    except KeyError as e:
        logger.error(f"Missing key in alert_data: {e}")
        logger.error(traceback.format_exc())
        return False  # Fail open - let alert through
        
    except Exception as e:
        logger.error(f"Error in maintenance alert check: {e}")
        logger.error(traceback.format_exc())
        
        return False

async def close_tas_workflow(alert_data, message_type='Message'):
    alert_data['alert_type'] = 'TAS'
    alert_data['alert_id'] = alert_data.get('external_id', '')
    logger.info(f"Closing camunda workflow for alert_id: {alert_data['id']} {alert_data}")

    data = {
        "messageName": message_type,
        "businessKey": alert_data['unique_id'],
        "processVariables": {
            "alert_id": {"value": alert_data['id'], "type": "String"},
            "closed": {"value": True, "type": "Boolean"}
        }
    }

    url = alert_data.get('workflow_url')
    if url:
        url = url.rstrip('/') + "/engine-rest/message"
    else:
        url = await helpers.get_camunda_url(
            bu=alert_data['bu'],
            sap_id=alert_data['sap_id'],
            alert_section="TAS",
            location_data=loc_dt
        )
        url = url.rstrip('/') + "/engine-rest/message"

    print("Camunda URL:", url)

    # max_retries = 5
    # initial_delay = 5  # seconds

    # await asyncio.sleep(2)  # One-time wait before retry loop

    # for attempt in range(1, max_retries + 1):
    #     try:
    #         r = httpx.post(url, headers={'Content-Type': 'application/json'}, json=data, verify=False)
    #         if r.status_code // 100 == 2:
    #             logger.info("Message sent to camunda")
    #             break
    #         else:
    #             logger.error(f"Attempt {attempt}: Error sending message to camunda: "
    #                 f"{r.status_code} - {r.text} - {alert_data['unique_id']}")
    #     except Exception as e:
    #         logger.error(f"Attempt {attempt}: Exception in closing camunda flow {e} "
    #                     f"for alert_id {alert_data['id']}, business_key {alert_data['unique_id']}")

    #     if attempt < max_retries:
    #         backoff = initial_delay * (2 ** (attempt - 1))
    #         await asyncio.sleep(backoff)
    #     else:
    #         logger.error(f"Failed to send message to camunda after {max_retries} attempts")

    # await close_alert(alert_data=alert_data)
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
                    break
                else:
                    logger.error(f"Attempt {attempt}: Error sending message to camunda: "
                                f"{r.status_code} - {r.text} - {alert_data['unique_id']}")
            except Exception as e:
                logger.error(f"Attempt {attempt}: Exception in closing camunda flow {e} "
                            f"for alert_id {alert_data['id']}, business_key {alert_data['unique_id']}")

            if attempt < max_retries:
                backoff = min(initial_delay * (2 ** (attempt - 1)), max_backoff)
                await asyncio.sleep(backoff)
            else:
                logger.error(f"Failed to send message to camunda after {max_retries} attempts")

    await close_alert(alert_data=alert_data)

async def create_under_maintenance_alert(alert_data):
    if alert_data['interlock_name'] == 'Tank_Under Maintenance':
        tas_device_name = alert_data.get('device_name','')
        if tas_device_name.endswith('_M'):
            tas_device_name_for_query = tas_device_name[:-2]
        else:
            tas_device_name_for_query = tas_device_name
        
        logger.info("*" * 100)
        logger.info(f"Processing Tank_Under Maintenance alert for: {alert_data['tas_device_name']}")
        logger.info("*" * 100)

        await asyncio.sleep(10)
        logger.info("Checking for existing maintenance alerts after 10 seconds...")

        maintenance_query = (
            f"""bu = 'TAS' and """
            f"""sap_id = '{alert_data.get('sap_id', '')}' and """
            f"""alert_section = 'TAS' and """
            f"""regexp_replace(tas_device_name, '_M$', '') = '{tas_device_name_for_query}' and """
            f"""created_at >= NOW() - INTERVAL '5 minutes' and """
            f"""alert_status != 'Close'"""
        )

        maintenance_params = urdhva_base.queryparams.QueryParams(q=maintenance_query)
        logger.info(f"maintenance_query --> {json.dumps(maintenance_params, default=str)}")

        maintenance_resp = await hpcl_ceg_model.Alerts.get_all(maintenance_params, resp_type='plain')
        logger.info(f"maintenance_resp --> {json.dumps(maintenance_resp, default=str)}")

        if maintenance_resp.get("data"):
            for data in maintenance_resp["data"]:
                logger.info(f"Closing existing alert: {json.dumps(data, default=str)}")
                await close_tas_workflow(data, message_type='Message')
            await create_alert(alert_data=alert_data)
        else:
            await create_alert(alert_data=alert_data)
        return

    
    if alert_data['interlock_name'] != 'Tank_Under Maintenance':
        logger.info("*" * 100)
        logger.info(f"Checking for existing 'Tank_Under Maintenance' alert for device_id: {alert_data.get('device_id', '')}")
        logger.info("*" * 100)

        maintenance_query = (
            f"bu = 'TAS' AND "
            f"sap_id = '{alert_data.get('sap_id', '')}' AND "
            f"alert_section = 'TAS' AND "
            f"device_id = '{alert_data.get('device_id', '')}' AND "
            f"interlock_name = 'Tank_Under Maintenance' AND "
            f"alert_status != 'Close'"
        )
        logger.info(f"Maintenance query: {maintenance_query}")

        maintenance_params = urdhva_base.queryparams.QueryParams(q=maintenance_query)
        maintenance_resp = await hpcl_ceg_model.Alerts.get_all(maintenance_params, resp_type='plain')

        logger.info(f"Maintenance response: {maintenance_resp}")

        if maintenance_resp and maintenance_resp.get("data"):
            logger.info("*" * 100)
            logger.info(f"Not creating alert; existing Tank Under Maintenance alert found: {maintenance_resp['data']}")
            logger.info("*" * 100)
        else:
            await create_alert(alert_data=alert_data)

