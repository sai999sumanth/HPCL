import urdhva_base
import json
import datetime
import traceback
import hpcl_ceg_enum
import hpcl_ceg_model
import urdhva_base.redispool
import utilities.helpers as helpers
import utilities.interlock_mapping as interlock_mapping
import orchestrator.analytics.va_analysis as va_analysis
import orchestrator.analytics.ro_analysis as ro_analysis
import orchestrator.alerting.alert_helper as alert_helper
from orchestrator.workflow.workflow_process import Camunda
import orchestrator.analytics.vts_analysis as vts_analysis
import cache_gateway.cache_api_actions as cache_api_actions
import asyncio
import httpx
import orchestrator.alerting.vts_load_type_update as vts_load_type_update
logger = urdhva_base.logger.Logger.getInstance('alert_factory_log')


class AlertFactory:
    @classmethod
    async def create_bu_alert(cls, alert_data, camunda_url=None):
        """
        For translating bu level data into unique alert format
        """
        ...

    @classmethod
    async def close_bu_alert(cls, alert_data):
        """
        For translating bu level data into unique alert format
        """
        ...

    @classmethod
    async def create_alert(cls, alert_data, camunda_url=urdhva_base.settings.camunda_url):
        """
        For translating device level data into unique alert format and creating it in the database

        Parameters:
            alert_data (dict): A dictionary containing the data to create the alert
                - bu (str): Business unit
                - sopid (str): SOP ID
                - sapid (str): SAP ID
                - interlockName (str): Interlock name
                - severity (str): Severity of the alert
                - message (str): Alert message
                - alertHistory (list): List of alert history messages
                - location_data (dict): Dictionary containing location related data
            camunda_url (String): Camunda connection URL
        Returns:
            dict: A dictionary containing the status, message and the created alert document
        """
        try:
            # print("Alert data:", alert_data)
            return_data = False
            if 'return_data' in alert_data.keys():
                return_data = alert_data.get("return_data", False)
            alert_data['workflow_url'] = camunda_url
            alert_data['workflow_port'] = camunda_url.split(":")[2]
            bu = alert_data['bu']
            sop_id = alert_data.get('sop_id', '')
            sap_id = alert_data['sap_id']
            interlock_name = alert_data.get('interlock_name', '')
            location_data = alert_data.get("location_data", {})
            device_name = alert_data.get("device_name", '')
            if not location_data:
                retries = 3
                for attempt in range(retries):
                    if urdhva_base.ctx.exists(): 
                            _, location_data = await alert_helper.get_location_details(bu, sap_id)
                            break
                    else:
                            _, location_data = await cache_api_actions.get_location_data(bu=bu, location_id=sap_id)
                    
                    if location_data:
                        break
                    
                    print(f"Retrying to fetch location data for {bu} {sap_id}... Attempt {attempt + 1}/{retries}")
                    await asyncio.sleep(3)
            # print("location_data --> ", location_data)
            # if not status:
            #     return False, location_data
            base_data = {
                key: location_data.get(key, '') for key in [
                    'state', 'city', 'zone', 'region', 'district', 'terminal_plant_id',
                    'terminal_plant_name', 'sales_area', 'category'
                ]
            }
            base_data.update({key: alert_data.get(key, '') for key in ['device_id', 'device_type', 'device_name']})
            base_data.update({"sop_id": sop_id, "sap_id": sap_id, "bu": bu,
                              "location_name": location_data.get('name', '')})

            # Create Alert
            #alert_id = await alert_helper.get_alert_unique_id(bu, sap_id, sop_id, alert_data.get('device_id'))
            async with httpx.AsyncClient(verify=False) as client:
                base_url = f"http://{urdhva_base.settings.cache_gateway_host}:{urdhva_base.settings.cache_gateway_port}"
                resp = await client.get(f"{base_url}/api_cache/v1/get_unique_alert_id", params={"bu": bu, 
                                                                                                "sap_id": sap_id,
                                                                                                  "sop_id": sop_id, 
                                                                                                  "device_id": alert_data.get('device_id')})
                if resp.status_code // 100 == 2:
                    alert_id = resp.text.strip('"')

            if not alert_data.get('alert_id'):
                alert_data['alert_id'] = alert_id
            #unique_id = await alert_helper.get_alert_unique_id(bu, sap_id, sop_id)
            async with httpx.AsyncClient(verify=False) as client:
                base_url = f"http://{urdhva_base.settings.cache_gateway_host}:{urdhva_base.settings.cache_gateway_port}"
                resp = await client.get(f"{base_url}/api_cache/v1/get_unique_alert_id", params={"bu": bu, 
                                                                                                "sap_id": sap_id,
                                                                                                "sop_id": sop_id})
                
                if resp.status_code // 100 == 2:
                    unique_id = resp.text.strip('"')

            if alert_data.get("alert_section", "") == 'VTS':
                async with httpx.AsyncClient(verify=False) as client:
                    base_url = f"http://{urdhva_base.settings.cache_gateway_host}:{urdhva_base.settings.cache_gateway_port}"
                    resp = await client.get(f"{base_url}/api_cache/v1/get_unique_alert_id", params={"bu": alert_data.get("alert_section"), 
                                                                                                    "sap_id": sap_id,
                                                                                                    "sop_id": sop_id})
                    if resp.status_code // 100 == 2:
                        unique_id = resp.text.strip('"')

            # assign roles for emlock and ro alerts
            if alert_data.get("alert_section", bu) == 'EMLock':
                assigned_user_roles = ["Planning Officer SOD"]
            elif alert_data.get("alert_section", bu) == 'RO' and interlock_name not in ['Dry Out Each Indent Wise MainFlow','Restroom Cleaning Evidence Missing']:
                assigned_user_roles = ["RO Dealer"]
            else:
                assigned_user_roles = []
            if "alert_timestamp" in alert_data.keys():
                try:
                    alert_data['alert_timestamp'] = alert_data['alert_timestamp'].replace(tzinfo=None)
                except:
                    ...

           
           
            alert_resp = await hpcl_ceg_model.AlertsCreate(**{**base_data,
                                                        'severity': alert_data.get('severity').capitalize() if alert_data.get('severity') else "Medium",
                                                        'alert_category': alert_data.get('alert_category'),
                                                        'alert_status': hpcl_ceg_enum.AlertStatus.Open,
                                                        'alert_state': hpcl_ceg_enum.AlertState.InProgress,
                                                        'unique_id': unique_id, 'alert_section': alert_data.get("alert_section", bu),
                                                        'external_id': alert_data.get('vendor_alert_id', str(alert_data['alert_id'])),
                                                        'interlock_name': interlock_name,
                                                        'interlock_id': '',
                                                        'vehicle_number': alert_data.get('vehicle_number',''),
                                                        'violation_type': alert_data.get('violation_type',''),
                                                        'clear_count': alert_data.get('clear_count',False),
                                                        'alert_history': alert_data.get('alert_history',[]),
                                                        'device_msg': alert_data.get('message', ''),
                                                        'equipment_type': alert_data.get('equipment_type',''),
                                                        'equipment_name': alert_data.get('equipment_name',''),
                                                        'sensor_id': alert_data.get('sensor_id', ''),
                                                        'tas_device_name': alert_data.get('tas_device_name', ''),
                                                        'alert_message': alert_data.get('alert_message',''),
                                                        'last_sms_to': [], 'last_mailed_to': [],
                                                        'last_escalated_to': [],
                                                        'last_notified_to': [], 'assigned_to': '',
                                                        'assigned_to_role': '',
                                                        'assigned_users': [],
                                                        'assigned_user_roles': assigned_user_roles,
                                                        'indent_status': hpcl_ceg_enum.IndentStatus.Pending,
                                                        'dealer_id': str(alert_data.get('dealer_id', '')),
                                                        'product_code': str(alert_data.get('product_code', '')),
                                                        'indent_no': str(alert_data.get('indent_no', '')),
                                                        'workflow_datetime': alert_data.get(
                                                            'workflow_datetime',
                                                            urdhva_base.utilities.get_present_time().replace(tzinfo=None).isoformat()
                                                        ),
                                                        'indent_raised_date': alert_data.get('indent_raised_date', None),
                                                        'dry_out_in_days': str(alert_data.get('dry_out_in_days', '1')),
                                                        'servicing_plant_id': str(alert_data.get('servicing_plant_id', '')),
                                                        'servicing_plant_name': str(alert_data.get('servicing_plant_name', '')),
                                                        'progress_rate': 1,
                                                        'transporter_name': alert_data.get("transporter_name", ""),
                                                        'transporter_code': alert_data.get("transporter_code", ""),
                                                        'vehicle_blocked_start_date': alert_data.get("vehicle_blocked_start_date", None),
                                                        'vehicle_blocked_end_date': alert_data.get("vehicle_blocked_end_date", None),
                                                        'dry_out_start_time': alert_data.get("dry_out_start_time", None),
                                                        'intra_day_dry_out_start_time': alert_data.get("intra_day_dry_out_start_time", None),
                                                        'vehicle_unblocked_date': alert_data.get("vehicle_unblocked_date", None),
                                                        'dry_out_end_time': alert_data.get("dry_out_end_time",None),
                                                        'intra_day_dry_out_end_time': alert_data.get("intra_day_dry_out_end_time",None),
                                                        'origin_altid': alert_data.get('origin_altid',''),
                                                        'mark_as_false': alert_data.get('mark_as_false', False),
                                                        'temporary_close': alert_data.get('temporary_close', False),
                                                        'permanent_close': alert_data.get('permanent_close', False),
                                                        'alert_message': alert_data.get('alert_message', ''),
                                                        'ro_offline': alert_data.get('ro_offline', False),
                                                        'external_timestamp': alert_data.get('alert_timestamp', urdhva_base.utilities.get_present_time().replace(tzinfo=None).isoformat()),
                                                        'tt_load_number': str(alert_data.get('tt_load_number', '')),
                                                        'cause_effect': alert_data.get('Cause_Effect', ''),
                                                        'workflow_url': alert_data.get('workflow_url', ''),
                                                        'workflow_port': alert_data.get('workflow_port', ''),
                                                        'vts_alert_history_ids': alert_data.get('vts_alert_history_ids',[]),
                                                        'block_status': alert_data.get('block_status',None),
                                                        'tt_type': (alert_data.get('tt_type') or '').lower(),
                                                        'raw_data': {}}).create()

            if alert_data.get("alert_section", '') in ["VTS"]:
                await vts_load_type_update.enqueue_vts_load_type_processing({
                    "id": alert_resp.get("id"),
                    "bu": bu,
                    "vehicle_number": alert_data.get("vehicle_number"),
                    "unique_id": unique_id,
                    "interlock_name": interlock_name,
                    "sap_id": sap_id
                })

            redis_ins = await urdhva_base.redispool.get_redis_connection()
            alert_level = "level - 1"
            if alert_data.get("alert_section",'') in ["VA"]:
                if alert_data.get("alert_section",'') == "VA":
                    if alert_data.get('bu','') in ['LPG'] and alert_data.get("interlock_name","") not in ["LPG Leakages","LPG Leakages thru Filling Gun"]:
                        alert_level = "level - 1"
                    else:
                        alert_level = await va_analysis.get_va_levels(
                            bu=base_data['bu'], violation_type=alert_data.get('violation_type',''), sap_id=str(base_data['sap_id'])
                            )
            elif alert_data.get("alert_section",'') in ["LPG"] and alert_data.get("interlock_name","") in ["Valve Leak Rejection","Check Scale Rejection","O-Ring Leak Rejection"]:
                alert_level = await va_analysis.get_lpg_levels(
                    bu=base_data['bu'], violation_type=alert_data.get('violation_type',''), sap_id=str(base_data['sap_id'])
                )
            elif alert_data.get("alert_section", '') == "RO" and alert_data.get("interlock_name","") not in ["Restroom Cleaning Evidence Missing"]:
                alert_level = await ro_analysis.get_ro_levels(
                    bu=base_data['bu'], violation_type=alert_data.get('violation_type', ''),
                    sap_id=str(base_data['sap_id'])
                )
            elif alert_data.get("alert_section", '') in ["VTS"] and alert_data.get("interlock_name","") not in ["No VTS No Load","Itdg Admin Blocked"]:
                alert_level = await vts_analysis.get_vts_levels(
                    bu=base_data['bu'], vehicle_number=alert_data.get('vehicle_number', ''),
                    sap_id=str(base_data['sap_id']),
                    alert_section=alert_data.get('alert_section',''),
                    tt_type=alert_data.get('tt_type','')
                )
                print("alert_level----->",alert_level)
            else:
                await redis_ins.hset("alert_mapping", alert_data['alert_id'], alert_resp['id'])
            payload = {"businessKey": unique_id,
                        "variables": {"alert_id": {"value": alert_resp['id'], "type": "String"},
                                    "interlock_name": {"value": interlock_name, "type": "String"},
                                    "interlock_id": {"value": "", "type": "String"},
                                    "location_device_id": {"value": alert_data.get('device_id', ''), "type": "String"},
                                    "location_type": {"value": bu, "type": "String"},
                                    "sap_id": {"value": sap_id, "type": "String"},
                                    "sop_id": {"value": sop_id, "type": "String"},
                                    "dealer_id": {"value": alert_data.get('dealer_id', ''), "type": "String"},
                                    "product_code": {"value": str(alert_data.get('product_code', '')), "type": "String"},
                                    "workflow_datetime": {"value": alert_data.get(
                                        'workflow_datetime',
                                        datetime.datetime.now(datetime.UTC)
                                        .strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + "Z"), "type": "String"},
                                    "indent_no": {"value": alert_data.get('indent_no', ''), "type": "String"},
                                    "indent_raised_date": {"value": alert_data.get('indent_raised_date', ''), "type": "String"},
                                    "terminal_plant_name": {"value": alert_data.get('terminal_plant_name', ''), "type": "String"},
                                    "prod_reqd_dt": {"value": alert_data.get('prod_reqd_dt', ''), "type": "String"},
                                    "va_level": {"value": alert_level, "type": "String"},
                                    "terminal_plant_id": {"value": alert_data.get('terminal_plant_id', ''), "type": "String"},
                                    "cause_effect": {"value": alert_data.get('Cause_Effect', ''), "type": "String"}, # Added for TAS use
                                    "alert_section": {"value": alert_data.get('alert_section', ''), "type": "String"}, # Added for TAS use
                                    "cause_sop_id": {"value": alert_data.get('cause_sop_id', ''), "type": "String"}, # Added for TAS use
                                    "effect_sop_id": {"value": alert_data.get('effect_sop_id', ''), "type": "String"}, # Added for TAS use
                                    "device_id": {"value": alert_data.get('device_id', ''), "type": "String"}, # Added for TAS use
                                    "device_name": {"value": alert_data.get('device_name', ''), "type": "String"}, # Added for TAS use
                                    "device_type": {"value": alert_data.get('device_type', ''), "type": "String"}, # Added for TAS use
                                    "tas_device_name": {"value": alert_data.get('tas_device_name', ''), "type": "String"}, # Added for TAS use
                                    }}
            
            if alert_data.get("interlock_name") == "Itdg Admin Blocked":
                 payload['variables'].update({"waitTime": {"value": alert_data.get('waitTime', ''), "type": "String"},
                                               "bu": {"value": alert_data.get('bu', ''), "type": "String"},
                                               "auto_unblock": {"value": alert_data.get('auto_unblock', ''), "type": "String"},
                                               "vehicle_number":{"value": alert_data.get('vehicle_number', ''), "type": "String"},
                                               "checkTicketClose":{"value": alert_data.get('checkTicketClose', False), "type": "Boolean"}})
                 
            if alert_data.get("interlock_name") == 'Truck Contract Validity Status':
                payload['variables'].update({"contract_valid_upto": {"value": alert_data.get('contract_valid_upto', ''), "type": "String"},
                                             "bu": {"value": alert_data.get('bu', ''), "type": "String"},
                                             "vehicle_number":{"value": alert_data.get('vehicle_number', ''), "type": "String"},
                                             "device_installation_id":{"value": alert_data.get('device_installation_id', ''), "type": "String"},
                                             "before30days":{"value": alert_data.get('before30days', False), "type": "Boolean"},
                                             "waitTime":{"value": alert_data.get('waitTime', ''), "type": "String"},
                                             "days_remaining":{"value": alert_data.get('days_remaining', ''), "type": "String"}
                                             })
            # Create Interlock
            # Start workflow after creating the interlock
            if interlock_name:
                # Create Interlock
                interlock = await hpcl_ceg_model.InterlockCreate(**{**base_data,
                                                                    'interlock_name': interlock_name,
                                                                    'interlock_status': hpcl_ceg_enum.AlertStatus.Open}
                                                                 ).create()

                # Fetch the updated alert data
                alert_data = await hpcl_ceg_model.Alerts.get(alert_resp['id'])

                # Update the interlock ID in the alert
                alert_data.interlock_id = str(interlock['id'])

                # Convert alert_data to a dictionary
                alert_data_dict = alert_data.dict() if hasattr(alert_data, 'dict') else alert_data.__dict__

                if "_sa_instance_state" in alert_data_dict.keys():
                    del alert_data_dict["_sa_instance_state"]
                    
                # Modify the alert with the updated data             
                alert_update = await hpcl_ceg_model.Alerts(**alert_data_dict).modify()

                payload["variables"]["interlock_id"] = {"value": interlock['id'], "type": "String"}
                interlock_name = interlock_mapping.get_interlock_name(bu=bu, interlock_name=interlock_name,sop_id=sop_id)
                # workflowid = interlock_name["workflow_name"] if interlock_name["workflow_name"] else interlock_name["interlock_name"]
                # workflowid = interlock_name["workflow_name"] if "workflow_name" in interlock_name.keys() else interlock_name["interlock_name"]
                workflowid = interlock_name.get("workflow_name") or interlock_name.get("interlock_name") or None
                workflow_id = interlock_mapping.fmt_il_name(workflowid)
                # Uncomment below line to stop workflow for VA
                # if alert_data_dict.get("alert_section") not in ["VA", "VTS"]:
                #     await Camunda().start_workflow(payload=payload, workflowId=workflow_id, camunda_url=camunda_url)
                #     await redis_ins.hset("alert_camunda_url", str(alert_resp['id']), camunda_url)

                # Updating for VTS Alert history with alert_id
                if alert_data_dict.get("alert_section") == "VTS" and alert_data_dict.get("interlock_name","") not in ["No VTS No Load"]:
                    await vts_analysis.update_alert_id_to_vts_history(alert_id=str(alert_resp['id']), vts_alert_id=alert_data_dict.get("vts_alert_history_ids", []))
                    blocked_tt_data = dict()
                    blocked_tt_data['TT_No'] = alert_data_dict.get('vehicle_number','')
                    blocked_tt_data['BlockStartDate'] = alert_data_dict['vehicle_blocked_start_date'].strftime("%d/%b/%Y 00:00")
                    blocked_tt_data['BlockEndDate'] = alert_data_dict['vehicle_blocked_end_date'].strftime("%d/%b/%Y 00:00")
                    blocked_tt_data['BlockedRemarks'] = alert_data_dict['device_name']
                    print("blocked_tt_data: ", blocked_tt_data)
                    # resp = await vts_analysis.post_blocked_tt(blocked_tt_data)
                    # print("Data Pushed to VTS Vendor", resp)

                if alert_data_dict.get("alert_section") in ["VA"] and alert_data_dict.get("bu") in ["RO"]:
                    return True, "alert created"
                if alert_data_dict.get("alert_section") in ["RO"] and interlock_name.get("interlock_name") not in ['Dry Out Each Indent Wise MainFlow','Restroom Cleaning Evidence Missing']:
                    # print(f"alert skipped: {alert_data_dict}")
                    if return_data:
                        return True, alert_data_dict
                    return True, "alert created"
                if alert_data_dict.get("alert_section") in ["EMLock"]:
                    print("Workflow Skipped")
                    return True, "alert created"
                # Analog data dont have workflows so skippng it.
                Analog_data = ['BCU Local Loading',
                                'Unauthorized flow_BCU',
                                'Cancel TT Reported',
                                'Manual FAN printed less than 5% of total TT loaded',
                                'Manual FAN printed more than 5% of total TT loaded',
                                'TT Overloaded', 'BCU K- Factor Change',
                                'Bay reassignment',
                                'Manual Bay assignment of more than 5% of total TT loaded',
                                'SickTT Reported',
                                'MFM K Factor Change',
                                'Day End Report',
                                'TAS User access report'
                                 ]
                if alert_data_dict.get("alert_section") in ["TAS"] and interlock_name.get("interlock_name") in Analog_data:
                    print("Workflow Skipped for TAS No Workflow ILs")
                    logger.info(f"Workflow Skipped for TAS No Workflow ILs: {interlock_name.get('interlock_name')}")
                    return True, "alert created"
                await Camunda().start_workflow(payload=payload, workflowId=workflow_id, camunda_url=camunda_url)
                await redis_ins.hset("alert_camunda_url", str(alert_resp['id']), camunda_url)
            else:
                print(f"Unable to find Camunda workflow for interlock: {interlock_name}, BU: {bu}")
                logger.info(f"Unable to find Camunda workflow for interlock: {interlock_name}, BU: {bu}")
            if return_data:
                return True, alert_data_dict
            return True, "Alert Created"

        except Exception as e:
            print(traceback.format_exc())
            logger.error(f"Error in alert creation {e}, traceback {traceback.format_exc()}")
            return False, f"Error in alert creation {e}"


    @classmethod
    async def close_alert(cls, alert_data):
        """
        Close Alert and Interlock for the given BU, SOP ID and SAP ID

        Parameters:
            alert_data (dict): A dictionary containing the data to close the alert
                - bu (str): Business unit
                - sop_id (str): SOP ID
                - sap_id (str): SAP ID

        Returns:
            tuple: (success, result_dict) where success is a boolean and result_dict contains status details
        """
        logger.info(f"Attempting to close alert with data: {alert_data}")
        redis_ins = None
        
        try:
            # Normalize bu key
            bu = alert_data.get('BU', alert_data.get('bu'))
            if not bu:
                return False, {"status": "Error", "message": "Business unit not provided"}
                
            # Get redis connection for later use
            redis_ins = await urdhva_base.redispool.get_redis_connection()

            interlock_closed = False
            alert_closed = False
            
            # Handle case with explicit interlock_id
            if 'interlock_id' in alert_data:
                # Close interlock if ID is available
                if alert_data.get("interlock_id", ""):
                    try:
                        il_data = await hpcl_ceg_model.Interlock.get(alert_data['interlock_id'])
                        if not isinstance(il_data, dict):
                            il_data = il_data.__dict__

                        if "_sa_instance_state" in il_data.keys():
                            del il_data["_sa_instance_state"]

                        il_data['interlock_status'] = hpcl_ceg_enum.AlertStatus.Close.value
                        data_obj = hpcl_ceg_model.Interlock(**il_data)
                        await data_obj.modify()
                        logger.info(f"Closed interlock with ID: {alert_data['interlock_id']}")
                    except Exception as e:
                        logger.error(f"Failed to close interlock with ID {alert_data['interlock_id']}: {e}")
                else:
                    logger.info(f"Interlock ID not available {alert_data}")
                
                # Close alert
                try:
                    al_data = await hpcl_ceg_model.Alerts.get(alert_data['alert_id'])
                    if not isinstance(al_data, dict):
                        al_data = al_data.__dict__
                    if "_sa_instance_state" in al_data.keys():
                        del al_data["_sa_instance_state"]
                    al_data['alert_status'] = hpcl_ceg_enum.AlertStatus.Close.value
                    al_data['alert_state'] = hpcl_ceg_enum.AlertState.Resolved.value
                    al_data['closed_at'] = datetime.datetime.now()
                    
                    # Clean up redis entries
                    try:
                        if await redis_ins.hexists("alert_mapping", al_data.get('external_id', '')):
                            await redis_ins.hdel("alert_mapping", al_data['external_id'])
                        await redis_ins.hdel("alert_camunda_url", str(al_data['id']))
                    except Exception as e:
                        print("failed to delete from redis")
                    # Update the alert record
                    data_obj = hpcl_ceg_model.Alerts(**al_data)
                    await data_obj.modify()
                    interlock_closed = True
                    alert_closed = True
                    logger.info(f"Closed alert with ID: {alert_data['alert_id']}")
                except Exception as e:
                    print(traceback.format_exc())
                    logger.error(f"Failed to close alert with ID {alert_data['alert_id']}: {e}")
                    return False, {"status": "Error", "message": f"Error closing alert: {str(e)}"}
                    
            # Handle case with interlock_name (lookup by query)
            else:
                # Query for Interlock
                interlock_closed = False
                alert_closed = False
                
                try:
                    query = f"interlock_name='{alert_data['interlock_name']}' AND bu='{bu}' AND sop_id='{alert_data['sop_id']}' AND sap_id='{alert_data['sap_id']}'"
                    params = urdhva_base.queryparams.QueryParams()
                    params.limit = 1
                    params.q = query
                    il_resp = await hpcl_ceg_model.Interlock.get_all(params)
                    il_data = []
                    if il_resp and hasattr(il_resp, '__dict__') and il_resp.__dict__.get('body'):
                        # Decode and parse Interlock response
                        body_str = il_resp.__dict__['body'].decode('utf-8')
                        il_json = json.loads(body_str)
                        il_data = il_json.get("data", [])
                        logger.info(f"Found {len(il_data)} interlock records")
                except Exception as e:
                    logger.error(f"Error querying for interlock: {e}")
                    il_data = []

                # Query for Alert
                try:
                    query = f"external_id='{alert_data['alert_id']}'"
                    params = urdhva_base.queryparams.QueryParams()
                    params.limit = 1
                    params.q = query
                    alert_resp = await hpcl_ceg_model.Alerts.get_all(params)
                    alert_data_list = []
                    if alert_resp and hasattr(alert_resp, '__dict__') and alert_resp.__dict__.get('body'):
                        # Decode and parse Alert response
                        body_str = alert_resp.__dict__['body'].decode('utf-8')
                        alert_json = json.loads(body_str)
                        alert_data_list = alert_json.get("data", [])
                        logger.info(f"Found {len(alert_data_list)} alert records")
                except Exception as e:
                    logger.error(f"Error querying for alert: {e}")
                    alert_data_list = []

                # Handle case where both Interlock and Alert are not found
                if not alert_data_list and not il_data:
                    print("alert_data_list ", alert_data_list)
                    print("il_data ", il_data)
                    logger.warning("Both Interlock and Alert records not found. Skipping closure.")
                    return False, {"status": "Error", "message": "No matching interlock or alert records found"}

                # Modify Interlock if found
                if il_data:
                    try:
                        interlock = il_data[0]
                        interlock['interlock_status'] = hpcl_ceg_enum.AlertStatus.Close.value
                        data_obj = hpcl_ceg_model.Interlock(**interlock)
                        await data_obj.modify()
                        interlock_closed = True
                        logger.info(f"Closed interlock with name: {alert_data['interlock_name']}")
                    except Exception as e:
                        logger.error(f"Error closing interlock: {e}")

                # Modify Alert if found
                if alert_data_list:
                    try:
                        for alert in alert_data_list:
                            if alert_data.get("alert_history"):
                                if not alert.get("alert_history"):
                                    alert["alert_history"] = alert_data["alert_history"]
                                else:
                                    alert_data["alert_history"]["allocated_time"] = alert["alert_history"][-1].get("processed_time")
                                    alert["alert_history"].append(alert_data["alert_history"])
                                    
                            alert['severity'] = alert_data.get('severity', "Medium").capitalize()
                            alert['alert_status'] = hpcl_ceg_enum.AlertStatus.Close.value
                            alert['alert_state'] = hpcl_ceg_enum.AlertState.Resolved.value
                            alert['interlock_name'] = alert_data.get('interlock_name', '')
                            alert['closed_at'] = datetime.datetime.now()
                            
                            if il_data:
                                alert['interlock_id'] = str(il_data[0]['id'])
                                
                            data_obj = hpcl_ceg_model.Alerts(**alert)
                            await data_obj.modify()
                            try:    
                                await redis_ins.hdel("alert_camunda_url", str(alert['id']))
                            except Exception as e:
                                print("Failed to del in redis")
                            alert_closed = True
                            logger.info(f"Closed alert with external ID: {alert_data['alert_id']}")
                    except Exception as e:
                        print(traceback.format_exc())
                        logger.error(f"Error closing alert: {e}")
                        return False, {"status": "Error", "message": f"Error closing alert: {str(e)}"}

                if interlock_closed or alert_closed:
                    logger.info("Successfully closed alerts and/or interlocks")
                else:
                    logger.warning("Failed to close any alerts or interlocks")
                    return False, {"status": "Warning", "message": "Failed to close any alerts or interlocks"}

            return True, {"status": "Success", "message": "Alert Closed", "alert_closed": alert_closed, "interlock_closed": interlock_closed}
            
        except Exception as e:
            logger.error(f"Error in alert closure: {str(e)}")
            logger.debug(f"Detailed error: {traceback.format_exc()}")
            return False, {"status": "Error", "message": f"Error in alert closure: {str(e)}"}
        
        finally:
            # Always close Redis connection if it was opened
            if redis_ins:
                try:
                    await redis_ins.close()
                except Exception as e:
                    logger.error(f"Error closing Redis connection: {e}")
