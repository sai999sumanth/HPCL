import sys
import traceback

import urdhva_base
import hpcl_ceg_enum
import hpcl_ceg_model

sys.path.append("/opt/ceg/algo/orchestrator")

import utilities.helpers as helpers
import tas_operations.send_rabbitmq as send_rabbitmq
import orchestrator.alerting.alert_factory as alert_create
import tas_operations.find_matching_csv as find_matching_csv


logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class SendWriteCommand:
    async def get_required_variables(self):
        # Remove empty string at the end of the list
        return ["alert_id", "interrupt", "interlock_name", "equipment_name", "sap_id", "BU"]

    async def check_and_create_gantry_alert(self, bu, sap_id, location_name):
        """
        Check conditions and create a new Gantry Permissive Off_DNC alert if needed.
        Conditions:
        1. SOP028 alert in open state
        2. BCU Permissive Off is not present
        3. BCU Permissive Off_Fail is present and open
        4. Gantry Permissive Off_DNC alert is not already present
        """
        return True, {"message": "This action is deprecated and will be removed in future versions."}
        # try:
            # Check for SOP028 alerts in open state
            # params = urdhva_base.queryparams.QueryParams(
            #     q=f"""bu = '{bu}' and sap_id = '{sap_id}' and sop_id = 'SOP028' and alert_status = 'Open'"""
            # )
            # sop028_alerts = await hpcl_ceg_model.Alerts.get_all(params, resp_type='plain')

            # # Check for BCU Permissive Off alerts
            # params = urdhva_base.queryparams.QueryParams(
            #     q=f"""bu = '{bu}' and sap_id = '{sap_id}' and alert_status = 'Open' and interlock_name = 'BCU Permissive Off'"""
            # )
            # bcu_permissive_off_alerts = await hpcl_ceg_model.Alerts.get_all(params, resp_type='plain')

            # # Check for BCU Permissive Off_Fail alerts
            # params = urdhva_base.queryparams.QueryParams(
            #     q=f"""bu = '{bu}' and sap_id = '{sap_id}' and alert_status = 'Open' and interlock_name = 'BCU Permissive Off_Fail'"""
            # )
            # bcu_permissive_off_fail_alerts = await hpcl_ceg_model.Alerts.get_all(params, resp_type='plain')

            # # Check for existing Gantry Permissive Off_DNC alerts - THIS IS THE NEW CHECK
            # params = urdhva_base.queryparams.QueryParams(
            #     q=f"""bu = '{bu}' and sap_id = '{sap_id}' and alert_status = 'Open' and interlock_name = 'Gantry Permissive Off_DNC'"""
            # )
            # existing_gantry_alerts = await hpcl_ceg_model.Alerts.get_all(params, resp_type='plain')

            # has_sop028_open = sop028_alerts.get('data') and len(sop028_alerts.get('data', [])) > 0
            # has_bcu_permissive_off = bcu_permissive_off_alerts.get('data') and len(bcu_permissive_off_alerts.get('data', [])) > 0
            # has_bcu_permissive_off_fail = bcu_permissive_off_fail_alerts.get('data') and len(bcu_permissive_off_fail_alerts.get('data', [])) > 0
            # has_existing_gantry_alert = existing_gantry_alerts.get('data') and len(existing_gantry_alerts.get('data', [])) > 0

            # # Only create new alert if all conditions are met AND there's no existing Gantry alert
            # if has_sop028_open and not has_bcu_permissive_off and has_bcu_permissive_off_fail and not has_existing_gantry_alert:
            #     logger.info(f"Creating new Gantry Permissive Off_DNC alert for {bu}, {sap_id}")
                
            #     alert_message = "Gantry Permissive Off_DNC"
            #     alert_data = {
            #         "bu": bu,
            #         "sap_id": sap_id,
            #         "location_name": location_name,
            #         "sop_id": "SOP028A",
            #         "interlock_name": alert_message,
            #         "alert_status": "Open",
            #         "alert_state": "InProgress",
            #         "severity": "CRITICAL",
            #         "alert_section": "TAS",
            #         "device_name": "",
            #         "return_data": True
            #     }

            #     camunda_url = await helpers.get_camunda_url(bu=bu, sap_id=sap_id, alert_section="TAS")
            #     status, created_alert = await alert_create.AlertFactory().create_alert(alert_data=alert_data, camunda_url=camunda_url)

            #     if not status or not created_alert:
            #         logger.error("Failed to create alert")
            #         return None

            #     if isinstance(created_alert, dict):
            #         alert_id = created_alert.get("id")
            #         if not alert_id:
            #             logger.error("Alert ID missing in created alert")
            #             return None

            #         new_alert = await hpcl_ceg_model.Alerts.get(alert_id)
            #         if not isinstance(new_alert, dict):
            #             new_alert = new_alert.__dict__

            #         if 'alert_history' not in new_alert:
            #             new_alert['alert_history'] = []

            #         action_entry = {
            #             'action_type': hpcl_ceg_enum.AlertActionType.Message.value,
            #             'action_msg': "System Generated alert"
            #         }
            #         new_alert['alert_history'].append(action_entry)

            #         await hpcl_ceg_model.Alerts(id=alert_id, alert_history=new_alert['alert_history']).modify()
            #         logger.info(f"Successfully created new Gantry Permissive Off_DNC alert with ID: {alert_id}")
            #         return True, {"Status": "Success", "alert_id": alert_id}

            #     logger.error("Created alert is not a dictionary")
            # return True, {"error": "Created alert is not a dictionary"}

        #     else:
        #         reason = ""
        #         if has_existing_gantry_alert:
        #             reason = "An open Gantry Permissive Off_DNC alert already exists"
        #         else:
        #             reason = "Alert creation conditions not met"
                    
        #         logger.info(f"No need to create new alert - {reason}")
        #         return False, {"Status": "Success", "reason": reason}

        # except Exception as e:
        #     logger.error(f"Error in check_and_create_gantry_alert: {e}")
        #     logger.error(traceback.format_exc())
        #     return False, {"error": str(e)}

    async def handle_write_command(self, params):
        """
        Handle write command for alerts.
        """
        return True, {"message": "This action is deprecated and will be removed in future versions."}
        # csv_file_path = "/opt/ceg/algo/orchestrator/tas_operations/write_tag.csv"
        # try:
        #     alert_id = params.get('alert_id')
        #     if not alert_id:
        #         return False, "Missing alert_id parameter"

        #     alert_data = await hpcl_ceg_model.Alerts.get(alert_id)
        #     logger.info(f"Send write command alert_data: {alert_data}")

        #     if not alert_data:
        #         return False, f"Alert with ID {alert_id} not found"

        #     if not isinstance(alert_data, dict):
        #         alert_data = alert_data.__dict__

        #     interlock_name = alert_data.get('interlock_name')
        #     equipment_name = alert_data.get('tas_device_name', '')
        #     sap_id = alert_data.get('sap_id')
        #     bu = alert_data.get('bu')
        #     location_name = alert_data.get('location_name')

        #     if not (interlock_name and sap_id):
        #         return False, "Missing required fields"

        #     # Only check for gantry alert creation if being called for specific interlocks
        #     # This prevents unnecessary alert creation on every write command
        #     if interlock_name in ['BCU Permissive Off_Fail', 'BCU Permissive Off']:
        #         await self.check_and_create_gantry_alert(bu=bu, sap_id=sap_id, location_name=location_name)

        #     match_criteria = {
        #         "equipment_name": equipment_name,
        #         "sap_id": sap_id
        #     }

        #     matched_row = await find_matching_csv.find_matching_row(csv_file_path, match_criteria)

        #     if not matched_row:
        #         print(f"No matching row found for sap_id: {sap_id} and equipment name: {equipment_name}")

        #     tag = matched_row['tag']
        #     interrupt = params.get('interrupt')

        #     if interrupt == "shutdown":
        #         write_control = matched_row['set']
        #     elif interrupt == "open":
        #         write_control = matched_row['clear']
        #     else:
        #         print(f"Invalid interrupt name: {interrupt}")

        #     message = {
        #         "command": "write",
        #         "sensor_tag": tag,
        #         "value": str(write_control)
        #     }
        #     print("message  ---> ", message)

        #     status, response = await send_rabbitmq.send_command_rabbitmq(message, queue_name=f"command_write_{sap_id}")
        #     print("response  ---> ", response)
        #     if not status:
        #         return False, {"status": "Error", "message": "Failed to send command"}
        #     return True, response

        # except Exception as e:
        #     logger.error(f"Exception in handle_write_command: {e}")
        #     logger.error(traceback.format_exc())
        #     return False, str(e)