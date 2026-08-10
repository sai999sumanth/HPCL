import urdhva_base
import pytz
import datetime
import hpcl_ceg_model
import hpcl_ceg_enum
import orchestrator.analytics.vts_analysis as vts_analysis
import orchestrator.alerting.alert_manager as alert_manager

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class SendVtsCommand:

    async def get_required_variables(self):
        return ["alert_id", "interrupt", "WaivedOff", "auto_unblock", "BU"]
    
    # It fetches alert details, sends the request to IMS/SAP,
    async def sendvtscommand(self, params):
        print("params --->", params)
        # Convert string values ('true'/'false') into Python boolean values.
        if 'WaivedOff' in params.keys():
            params['WaivedOff'] = True if params['WaivedOff'] == 'true' else False
        if 'auto_unblock' in params.keys():
            params['auto_unblock'] = True if params['auto_unblock'] == 'true' else False
        
        # Fetch complete alert information using alert_id.
        alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id'))
        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__
        
        if "_sa_instance_state" in alert_data.keys():
            del alert_data["_sa_instance_state"]

        if urdhva_base.context.context.exists():
            rpt = urdhva_base.context.context.get('rpt', {})
        else:
            rpt = {}
            
        # Execute vehicle Block operation.
        if params.get("interrupt").lower() == 'block':         
            # Blocking in IMS blockingFlag="Y"
            blocking_status = None
            
            # TAS Bulk and LPG Packed vehicles are blocked through IMS API.
            if (alert_data['bu'] in ['TAS'] and alert_data.get('tt_type','').lower() in ['bulk']) or (alert_data['bu'] in ['LPG'] and alert_data.get('tt_type','').lower() in ['packed']):

                # if alert_data.get('tt_type','').lower() in ['packed']:
                #     return True, {"blocked": False}
                # Prepare IMS request payload for vehicle blocking.
                payload = [{
                    "transactNo": str(alert_data['id']) + "1",
                    "truckRegNo": alert_data['vehicle_number'],
                    "blockingFlag": "Y",
                    "blockingFrom": (alert_data['vehicle_blocked_start_date'] + datetime.timedelta(hours=5, minutes=30)).strftime("%Y%m%d"),
                    "blockingTo": (alert_data['vehicle_blocked_end_date'] + datetime.timedelta(hours=5, minutes=30)).strftime("%Y%m%d")
                }]
                blocking_status,error_msg = await vts_analysis.post_blocked_tt_ims(payload)
                
                # If IMS API call failed, record failure and stop processing.
                if not blocking_status:
                    logger.error(f"Blocking Payload Not posted to IMS {alert_data['unique_id']} {alert_data['id']}")
                    alert_message = (
                        f"{error_msg}"
                    )
                    alert_data["action_msg"] = alert_message
                    alert_data["action_type"] = "BlockFailed"
                    await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                    return True, {"blocked": False}
                elif blocking_status and isinstance(blocking_status, list) and blocking_status[0]['successFlag'] not in ['Y']:
                    logger.error(f"Blocking Payload Not posted to IMS {alert_data['unique_id']} {alert_data['id']}")
                    alert_message = (
                        f"{blocking_status[0]['message']}"
                    )
                    alert_data["action_msg"] = alert_message
                    alert_data["action_type"] = "BlockFailed"
                    await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                    return True, {"blocked": False}
                elif isinstance(blocking_status,dict):
                    logger.error(f"Blocking Payload Not posted to IMS {alert_data['unique_id']} {alert_data['id']}")
                    alert_message = (
                        f"{blocking_status.get('message','Blocking Payload Not posted to IMS')}"
                    )
                    alert_data["action_msg"] = alert_message
                    alert_data["action_type"] = "BlockFailed"
                    await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                    return True, {"blocked": False}
                elif blocking_status and not isinstance(blocking_status, list):
                    logger.error(f"Blocking Payload Not posted to IMS {alert_data['unique_id']} {alert_data['id']}")
                    alert_message = f"{blocking_status}"
                    alert_data["action_msg"] = alert_message
                    alert_data["action_type"] = "BlockFailed"
                    await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                    return True, {"blocked": False}
                
            # LPG Bulk vehicles are blocked through SAP API.
            if alert_data['bu'] in ['LPG'] and alert_data.get('tt_type','').lower() in ['bulk']:

                # Prepare SAP request payload for vehicle blocking.
                payload = {
                    "Request":{
                        "Request_ID": str(alert_data['id'])+"1",
                        "Vehicle_ID": alert_data['vehicle_number'],
                        "Status": "B",
                        "User_ID": "NOVEX_SYSTEM",
                        "IP_Address": urdhva_base.settings.server_ip
                    }
                }
                blocking_status,error_msg = await vts_analysis.post_lpg_tt(payload)
                if not blocking_status:
                    logger.error(f"Blocking Payload Not posted to SAP {alert_data['unique_id']} {alert_data['id']}")
                    alert_message = (
                        f"{error_msg}"
                    )
                    alert_data["action_msg"] = alert_message
                    alert_data["action_type"] = "BlockFailed"
                    await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                    return True, {"blocked": False}
                if (
                    blocking_status 
                    and blocking_status.get("Response", {}).get("Status") not in ['S']
                    and blocking_status.get("Response", {}).get("Remark") not in ['Request already processed with the given Request ID']
                ):
                    logger.error(f"Blocking Payload Not posted to SAP {alert_data}")
                    alert_message = (
                        f"{blocking_status.get("Response", {}).get("Remark")}"
                    )
                    alert_data["action_msg"] = alert_message
                    alert_data["action_type"] = "BlockFailed"
                    await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                    return True, {"blocked": False}

            alert_message = (
                f"Alert details Alert ID: {alert_data.get('unique_id', '')}, status: Block, Vehicle: {alert_data.get('vehicle_number', '')} trip details are sent successfully to VTS to block the Vehicle "
            )
            alert_data["action_msg"] = alert_message
            alert_data["action_type"] = "VTS"
            await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
            await hpcl_ceg_model.Alerts(**{"id": alert_data["id"],
                                           "block_status": hpcl_ceg_enum.BlockStatus.Blocked}).modify()
            return True, {"blocked": True}

        if params.get("interrupt").lower() == 'unblock':
            # UnBlocking in IMS blockingFlag="N"
            unblocking_status = None
            if (alert_data['bu'] in ['TAS'] and alert_data.get('tt_type','').lower() in ['bulk']) or (alert_data['bu'] in ['LPG'] and alert_data.get('tt_type','').lower() in ['packed']):

                # if alert_data.get('tt_type','').lower() in ['packed']:
                #     return True, {"unblocked": False}
                
                payload = [{
                    "transactNo": str(alert_data['id']) + "0",
                    "truckRegNo": alert_data['vehicle_number'],
                    "blockingFlag": "N",
                    "blockingFrom": (alert_data['vehicle_blocked_start_date'] + datetime.timedelta(hours=5, minutes=30)).strftime("%Y%m%d"),
                    "blockingTo": (alert_data['vehicle_blocked_end_date'] + datetime.timedelta(hours=5, minutes=30)).strftime("%Y%m%d")
                }]
                unblocking_status,error_msg = await vts_analysis.post_blocked_tt_ims(payload)

                if not unblocking_status:
                    logger.error(f"UnBlocking Payload Not posted to IMS {alert_data['unique_id']} {alert_data['id']}")
                    alert_message = (
                        f"{error_msg}"
                    )
                    alert_data["action_msg"] = alert_message
                    alert_data["action_type"] = "UnblockFailed"
                    await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                    return True, {"unblocked": False}
                elif unblocking_status and isinstance(unblocking_status,list) and unblocking_status[0]['successFlag'] not in ['Y']:
                    logger.error(f"UnBlocking Payload Not posted to IMS {alert_data['unique_id']} {alert_data['id']}")
                    alert_message = (
                        f"{unblocking_status[0]['message']}"
                    )
                    alert_data["action_msg"] = alert_message
                    alert_data["action_type"] = "UnblockFailed"
                    await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                    return True, {"unblocked": False}
                elif isinstance(unblocking_status,dict):
                    logger.error(f"UnBlocking Payload Not posted to IMS {alert_data['unique_id']} {alert_data['id']}")
                    alert_message = (
                        f"{unblocking_status.get('message','UnBlocking Payload Not posted to IMS')}"
                    )
                    alert_data["action_msg"] = alert_message
                    alert_data["action_type"] = "UnblockFailed"
                    await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                    return True, {"unblocked": False}
                elif unblocking_status and not isinstance(unblocking_status,list):
                    logger.error(f"UnBlocking Payload Not posted to IMS {alert_data['unique_id']} {alert_data['id']}")
                    alert_message = f"{unblocking_status}"
                    alert_data["action_msg"] = alert_message
                    alert_data["action_type"] = "UnblockFailed"
                    await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                    return True, {"unblocked": False}

            if alert_data['bu'] in ['LPG'] and alert_data.get('tt_type','').lower() in ['bulk']:
                
                payload = {
                    "Request":{
                    "Request_ID": str(alert_data['id'])+"0",
                    "Vehicle_ID": alert_data['vehicle_number'],
                    "Status": "U",
                    "User_ID": "NOVEX_SYSTEM",
                    "IP_Address": urdhva_base.settings.server_ip
                    }
                }
                unblocking_status,error_msg = await vts_analysis.post_lpg_tt(payload)
                if not unblocking_status:
                    logger.error(f"UnBlocking Payload Not posted to SAP {alert_data['unique_id']} {alert_data['id']}")
                    alert_message = (
                        f"{error_msg}"
                    )
                    alert_data["action_msg"] = alert_message
                    alert_data["action_type"] = "UnblockFailed"
                    await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                    return True, {"unblocked": False}
                if (
                    unblocking_status 
                    and unblocking_status.get("Response", {}).get("Status") not in ['S']
                    and unblocking_status.get("Response", {}).get("Remark") not in ['Request already processed with the given Request ID','Vehicle is already unblocked in SAP']
                ):
                    logger.error(f"UnBlocking Payload Not posted to SAP {alert_data['unique_id']} {alert_data['id']}")
                    alert_message = (
                        f"{unblocking_status.get("Response", {}).get("Remark")}"
                    )
                    alert_data["action_msg"] = alert_message
                    alert_data["action_type"] = "UnblockFailed"
                    await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                    return True, {"unblocked": False}
                
            # Handle manual vehicle unblock (auto_unblock = False).
            if not params['auto_unblock']:
                # Skip updating truck details for these special interlock types.
                if alert_data['interlock_name'] not in ['No VTS No Load', 'Itdg Admin Blocked']:
                    # Find previous VTS alert history records for the same vehicle,
                    query = (f"location_id='{alert_data['sap_id']}' and tl_number='{alert_data['vehicle_number']}' "
                            f"and {alert_data['violation_type']}>=1 and created_at<'{alert_data['created_at']}' and location_type='{alert_data['bu']}' "
                            f"and auto_unblock!='false'")
                    data = await hpcl_ceg_model.VtsAlertHistory.get_all(urdhva_base.queryparams.QueryParams(q=query),
                                                                        resp_type='plain')

                    # If previous alert history records exist, disable their auto_unblock flag.
                    if len(data['data']):
                        for vts_alt_hist in data['data']:
                            vts_alt_hist['auto_unblock'] = False
                            await hpcl_ceg_model.VtsAlertHistory(**vts_alt_hist).modify()
                    
                    # Mark the vehicle as UNBLOCKED and remove it from the blacklist in the VTS truck details table.
                    unblock_query = f"update vts_truck_details set truck_status = 'UNBLOCKED', blacklist='false' where truck_regno = '{alert_data['vehicle_number']}'"
                    await hpcl_ceg_model.VtsTruckDetails.update_by_query(unblock_query)

                alert_message = (
                    f"Alert details Alert ID: {alert_data.get('unique_id', '')}, status: Unblock, Vehicle: {alert_data.get('vehicle_number', '')} trip details are sent successfully to VTS to Unblock the Vehicle "
                )
                vehicle_unblocked_date = datetime.datetime.now(tz=datetime.timezone.utc)
                alert_data["action_msg"] = alert_message
                alert_data["action_type"] = "VTS"
                await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                # Update the Alerts table by 1. Marking the alert as false 2. Saving the vehicle unblock timestamp 3. Changing the block status to UnBlocked.
                await hpcl_ceg_model.Alerts(**{"id": alert_data["id"],
                                               "mark_as_false": True,
                                               "vehicle_unblocked_date": vehicle_unblocked_date,
                                               "block_status": hpcl_ceg_enum.BlockStatus.UnBlocked}).modify()
                return True, {"unblocked": True}
            
            if params['auto_unblock']:
                # Execute automatic vehicle unblock logic.
                alert_message = (
                    f"Alert details Alert ID: {alert_data.get('unique_id', '')}, status: Unblock, Vehicle: {alert_data.get('vehicle_number', '')} trip details are sent successfully to VTS to Unblock the Vehicle "
                )
                # Record the current UTC time as the vehicle unblock time.
                vehicle_unblocked_date = datetime.datetime.now(tz=datetime.timezone.utc)
                alert_data["action_msg"] = alert_message
                alert_data["action_type"] = "VTS"
                await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)

                # Update truck status only for supported interlock types.
                if alert_data['interlock_name'] not in ['No VTS No Load', 'Itdg Admin Blocked']:
                    # Prepare SQL query to mark the truck as UNBLOCKED and remove it from the blacklist.
                    unblock_query = f"update vts_truck_details set truck_status = 'UNBLOCKED', blacklist='false' where truck_regno = '{alert_data['vehicle_number']}'"
                    await hpcl_ceg_model.VtsTruckDetails.update_by_query(unblock_query)

                # Update the Alerts table with the automatic unblock time and UnBlocked status.
                await hpcl_ceg_model.Alerts(**{"id": alert_data["id"],
                                               "vehicle_unblocked_date": vehicle_unblocked_date,
                                               "block_status": hpcl_ceg_enum.BlockStatus.UnBlocked}).modify()
                return True, {"unblocked": True}
            
        return False, {"sapcommandsent": False}