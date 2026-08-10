# import urdhva_base
# import aio_pika
# import json
# import datetime
# import traceback
# import hpcl_ceg_enum
# import hpcl_ceg_model
# import utilities.helpers as helpers
# import orchestrator.alerting.alert_factory as alert_create

# logger = urdhva_base.logger.Logger.getInstance("tas_command_control_log")

# command_mapping = {
#     "gantry_shutdown": {"tag": "SmartLoad-Dual.BC-501A.PERMISSIVE_FROM_DNC", "value": 1},
#     "gantry_start": {"tag": "SmartLoad-Dual.BC-501A.PERMISSIVE_FROM_DNC", "value": 0},
#     "esd_shutdown": {"tag": "PLC.SFTPLC.ESD_FROM_DNC", "value": 1},
#     "esd_start": {"tag": "PLC.SFTPLC.ESD_FROM_DNC", "value": 0}
# }


# async def publish_command(sap_id, command, bu, location_name, user_name, employee_id, value):
#     """
#     Publishes commands to control gantry or ESD systems and creates/updates alerts.
    
#     Args:
#         sap_id (str): SAP ID of the location
#         command (str): Command to execute (gantry_shutdown, gantry_start, esd_shutdown, esd_start)
#         bu (str): Business unit
#         location_name (str): Name of the location
#         user_name (str): Name of the user initiating the command
#         employee_id (str): Employee ID of the user
#         value: Unused parameter, maintained for backward compatibility
        
#     Returns:
#         tuple: (success_status, message_or_data)
#     """
#     if command not in command_mapping:
#         logger.error(f"Invalid command requested: {command}")
#         return False, "Invalid command"

#     alert_id = None
#     if command in ("gantry_shutdown", "esd_shutdown"):
#         processed_time = datetime.datetime.now(datetime.timezone.utc)
#         is_gantry = command == "gantry_shutdown"
#         alert_message = "Gantry Permissive Off DNC_SOFT" if is_gantry else "ESD Permissive Off DNC_SOFT"
#         action_msg = f"{'Gantry' if is_gantry else 'ESD'} Shutdown command from DNC by {user_name} with employee id {employee_id}"
#         initial_history = [{
#                 "processed_time": processed_time.isoformat(),
#                 "allocated_time": processed_time.isoformat(),  # For first entry, allocated_time equals processed_time
#                 "action_type": hpcl_ceg_enum.AlertActionType.Message.value,
#                 "action_msg": action_msg,
#             }]
#         alert_data = {
#             "bu": bu,
#             "sap_id": sap_id,
#             "location_name": location_name,
#             "sop_id": "SOP028A",
#             "interlock_name": alert_message,
#             "alert_status": "Open",
#             "alert_state": "InProgress",
#             "severity": "CRITICAL",
#             "alert_section": "TAS",
#             "device_name": "",
#             "return_data": True,
#             "alert_history": initial_history
#         }

#         try:
#             camunda_url = await helpers.get_camunda_url(bu=bu, sap_id=sap_id, alert_section="TAS")
#             status, created_alert = await alert_create.AlertFactory().create_alert(alert_data=alert_data, camunda_url=camunda_url)

#             if not status or not created_alert:
#                 logger.error("Failed to create shutdown alert")
#                 return False, "Failed to create alert for shutdown command"

#             alert_id = created_alert.get("id") if isinstance(created_alert, dict) else None
#             if not alert_id:
#                 logger.error("Alert ID missing in created alert")
#                 return False, "Alert creation failed: missing alert ID"

#             new_alert = await hpcl_ceg_model.Alerts.get(alert_id)
#             if not isinstance(new_alert, dict):
#                 new_alert = new_alert.__dict__
#             print("new_alert --> ", new_alert)
#             # if 'alert_history' not in new_alert:
#             #     new_alert['alert_history'] = []

#             # processed_time = datetime.datetime.now(datetime.timezone.utc)
#             # action_entry = {
#             #     'processed_time': processed_time.isoformat(),
#             #     'allocated_time': processed_time.isoformat(),  # For first entry, allocated_time equals processed_time
#             #     'action_type': hpcl_ceg_enum.AlertActionType.Message.value,
#             #     'action_msg': action_msg,
#             # }
#             # new_alert['alert_history'].append(action_entry)
#             # # Fix: Use string key "id" instead of the built-in id function
#             # update_data = {
#             #     "id": alert_id,  # Fixed: Using string key instead of built-in function
#             #     "alert_history": new_alert['alert_history']
#             # }
#             # print("update_data --> ", update_data)
#             # await hpcl_ceg_model.Alerts(**update_data).modify()
#             # logger.info(f"Successfully created new {alert_message} alert with ID: {alert_id}")
#         except Exception as e:
#             logger.error(f"Error creating shutdown alert: {str(e)}\n{traceback.format_exc()}")
#             return False, f"Error creating alert: {str(e)}"
    
#     # Handle alert management for start commands
#     elif command in ("gantry_start", "esd_start"):
#         try:
#             processed_time = datetime.datetime.now(datetime.timezone.utc)
#             cleared_alert_message = "Gantry Permissive off DNC_Soft_Cleared" if command == "gantry_start" else "ESD Permissive off DNC_Soft_Cleared"
#             original_alert_message = "Gantry Permissive Off DNC_SOFT" if command == "gantry_start" else "ESD Permissive Off DNC_SOFT"

#             # Initial alert history entry for the DNC_Soft_Cleared alert
#             action_msg = f"{'Gantry' if command == 'gantry_start' else 'ESD'} Signal command from DNC by {user_name} with employee id {employee_id}"
#             initial_history = [{
#                 "processed_time": processed_time.isoformat(),
#                 "allocated_time": processed_time.isoformat(),  # For first entry, allocated_time equals processed_time
#                 "action_type": hpcl_ceg_enum.AlertActionType.Message.value,
#                 "action_msg": action_msg,
#             }]

#             cleared_alert_data = {
#                 "bu": bu,
#                 "sap_id": sap_id,
#                 "location_name": location_name,
#                 "sop_id": "SOP028A",
#                 "interlock_name": cleared_alert_message,
#                 "alert_status": "Open",
#                 "alert_state": "InProgress",
#                 "severity": "CRITICAL",
#                 "alert_section": "TAS",
#                 "device_name": "",
#                 "return_data": True,
#                 "alert_history": initial_history
#             }

#             camunda_url = await helpers.get_camunda_url(bu=bu, sap_id=sap_id, alert_section="TAS")
#             status, cleared_alert = await alert_create.AlertFactory().create_alert(
#                 alert_data=cleared_alert_data,
#                 camunda_url=camunda_url
#             )

#             if not status or not cleared_alert:
#                 logger.error("Failed to create cleared alert")
#                 return False, "Failed to create cleared alert"

#             # Update the DNC_Soft_Cleared alert with a follow-up entry
#             cleared_alert_id = cleared_alert.get("id")
#             if cleared_alert_id:
#                 fetched_alert = await hpcl_ceg_model.Alerts.get(cleared_alert_id)
#                 if not isinstance(fetched_alert, dict):
#                     fetched_alert = fetched_alert.__dict__

#                 history = fetched_alert.get("alert_history", [])
                
#                 # Get the processed_time from the last history entry to use as allocated_time
#                 previous_processed_time = processed_time.isoformat()
#                 if history and isinstance(history[-1], dict):
#                     previous_processed_time = history[-1].get("processed_time", previous_processed_time)
                
#                 followup_msg = f"{'Gantry' if command == 'gantry_start' else 'ESD'} Clear Acknowledged by {user_name} with employee id {employee_id}"
                
#                 new_processed_time = datetime.datetime.now(datetime.timezone.utc)
#                 history.append({
#                     "processed_time": new_processed_time.isoformat(),
#                     "allocated_time": previous_processed_time,  # Use previous entry's processed_time
#                     "action_type": hpcl_ceg_enum.AlertActionType.Message.value,
#                     "action_msg": followup_msg,
#                 })

#                 # Should we close the DNC_Soft_Cleared alert too? If yes, include closed_at
#                 update_data = {
#                     "id": cleared_alert_id,  # Fixed: Using string key instead of built-in function
#                     "alert_history": history,
#                     "alert_status": "Close",  # Close this alert too
#                     "alert_state": "Resolved",
#                     "closed_at": new_processed_time.isoformat()
#                 }
#                 print("update_data --> ", update_data)
#                 await hpcl_ceg_model.Alerts(**update_data).modify()
#                 logger.info(f"Updated and closed alert for cleared alert ID: {cleared_alert_id}")

#             # Close original alert
#             existing_alerts = await hpcl_ceg_model.Alerts.get_all(
#                 urdhva_base.queryparams.QueryParams(
#                     q=f"sap_id='{sap_id}' AND interlock_name='{original_alert_message}' AND alert_status='Open'"
#                 ), resp_type="plain"
#             )
#             print("existing_alerts --> ", existing_alerts)

#             if existing_alerts['data']:
#                 print("into existing_alerts --> ", existing_alerts)
#                 for alert in existing_alerts['data']:
#                     if not isinstance(alert, dict):
#                         alert = alert.__dict__

#                     alert_id = alert.get("id")
#                     if alert_id:
#                         alert_history = alert.get('alert_history', [])
                        
#                         # Get the processed_time from the last history entry to use as allocated_time
#                         previous_processed_time = processed_time.isoformat()
#                         if alert_history and isinstance(alert_history[-1], dict):
#                             previous_processed_time = alert_history[-1].get("processed_time", previous_processed_time)
                        
#                         close_processed_time = datetime.datetime.now(datetime.timezone.utc)
                        
#                         alert_history.append({
#                             "processed_time": close_processed_time.isoformat(),
#                             "allocated_time": previous_processed_time,  # Use previous entry's processed_time
#                             "action_type": hpcl_ceg_enum.AlertActionType.Message.value,
#                             "action_msg": f"{'Gantry' if command == 'gantry_start' else 'ESD'} Signal Clear off by {user_name} with employee id {employee_id}"
#                         })
#                         print("alert_id --> ", alert_id)
#                         # Update alert with closed status, state, history and closed_at timestamp
#                         update_data = {
#                             "id": alert_id,  # Fixed: Using string key instead of built-in function
#                             "alert_status": "Close",
#                             "alert_state": "Resolved",
#                             "alert_history": alert_history,
#                             "closed_at": close_processed_time.isoformat()
#                         }
#                         print("update_data --> ", update_data)
#                         await hpcl_ceg_model.Alerts(**update_data).modify()

#                         logger.info(f"Closed {original_alert_message} alert with ID: {alert_id}")
#             else:
#                 logger.warning(f"No open alert found for {original_alert_message} to close.")
#         except Exception as e:
#             logger.error(f"Error handling start command alert: {str(e)}\n{traceback.format_exc()}")
#             return False, f"Error handling alert: {str(e)}"


#     # Publish command to RabbitMQ
#     try:
#         connection = await aio_pika.connect_robust(
#             host=urdhva_base.settings.rabbitmq_host,
#             port=urdhva_base.settings.rabbitmq_port,
#             virtualhost=urdhva_base.settings.rabbitmq_vhost,
#             login=urdhva_base.settings.rabbitmq_username,
#             password=urdhva_base.settings.rabbitmq_password
#         )
        
#         message = {
#             "command": "write",
#             "sensor_tag": command_mapping[command]['tag'],
#             "value": f"{command_mapping[command]['value']}"
#         }
        
#         async with connection:
#             channel = await connection.channel()
#             queue_name = f'command_write_{sap_id}'
#             logger.info(f"Publishing to queue: {queue_name}")
            
#             # Declare the queue
#             await channel.declare_queue(queue_name, durable=True)
            
#             # Create and send the message
#             await channel.default_exchange.publish(
#                 aio_pika.Message(
#                     body=json.dumps(message).encode(),
#                     delivery_mode=aio_pika.DeliveryMode.PERSISTENT
#                 ),
#                 routing_key=queue_name
#             )
            
#         logger.info(f"Successfully published {command} command to {sap_id}")
#         return True, {"message": f"Command sent to location {sap_id}"}
    
#     except Exception as e:
#         error_msg = f"Error publishing command to RabbitMQ: {str(e)}"
#         logger.error(f"{error_msg}\n{traceback.format_exc()}")
#         return False, error_msg
