import urdhva_base
import datetime
import traceback
import hpcl_ceg_model
import pytz
import math
import orchestrator.alerting.alert_manager as alert_manager
import orchestrator.analytics.va_analysis as va_analysis

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class CheckRegularViolation:
    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the action.
        
        Returns:
            list: A list of strings representing the required variables.
        """
        return ["alert_id", "regular"]
    
    async def check_regular(self, params):
        """
        This function checks if the given alert is ready to be unblocked. 
        It retrieves the alert's creation time and the number of days it should wait, 
        then calculates the time difference between the current time and the creation time. 
        If the time difference is less than the specified number of days, it calculates 
        the remaining wait time and returns it in the format 'PTXMX', where X is the 
        number of minutes. Otherwise, it returns a wait time of 1 minute.
        
        Args:
            alert_id (str): The ID of the alert to check.
            days (str): The number of days the alert should wait before being unblocked.
        
        Returns:
            tuple: A tuple containing a boolean indicating success, and a dictionary with the key 
            "waitTime" set to the value of the calculated wait time.
        """
        try:
            #print("params --->", params)
            if 'regular' in params.keys():
                params['regular'] = True if params['regular'] == 'true' else False
            
            alert_data = await hpcl_ceg_model.ViolationHistoryVts.get(params.get('alert_id'))
            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__
            
            alert_history = list(reversed(alert_data.get('alert_history', [])))
            last_notified_to = ", ".join(f"'{roles_name}'" for roles_name in alert_data.get("last_notified_to",[]))
            if not params['regular']:
                #print("alert_history----->",alert_history)
                if alert_history[0]['action_type'] in ["Approved"]:
                    if alert_history[2]['action_type'] in ['Justification']:
                        alert_message = (
                            f"Justified violation approved by {last_notified_to}. The violation will be considered a false violation and the violation has been moved to the Close tab."
                        )
                    if alert_history[2]['action_type'] in ['FalseViolation']:
                        alert_message = (
                            f"False violation allegation approved by {last_notified_to}. The violation will be considered a false violation and the violation has been moved to the Close tab."
                        )
                    alert_data["action_msg"] = alert_message
                    alert_data["action_type"] = "Resolved"
                    await alert_manager.AlertAction().update_alert_history_vts(input_data=alert_data, alert_data=alert_data)
                
                await hpcl_ceg_model.ViolationHistoryVts(**{"id": alert_data["id"],
                                                            "alert_status": "Close",
                                                            "approved_status": False}).modify()
                return True, {"Violation Closed": True}
            
            if params['regular']:
                alert_message = (
                    f"The violation will be considered a true violation and the violation has been moved to the Close tab."
                )
                if alert_history[0]['action_type'] in ["AcceptViolation"]:
                    alert_message = (
                        f"Violation accepted by {last_notified_to}. The violation will be considered a true violation and the violation has been moved to the Close tab."
                    )
                if alert_history[0]['action_type'] in ["Rejected"]:
                    if alert_history[2]['action_type'] in ['Justification']:
                        alert_message = (
                            f"Justified violation rejected by {last_notified_to}. The violation will be considered a true violation and the violation has been moved to the Close tab."
                        )
                    if alert_history[2]['action_type'] in ['FalseViolation']:
                        alert_message = (
                            f"False violation allegation rejected by {last_notified_to}. The violation will be considered a true violation and the violation has been moved to the Close tab."
                        )
                alert_data["action_msg"] = alert_message
                alert_data["action_type"] = "Resolved"
                await alert_manager.AlertAction().update_alert_history_vts(input_data=alert_data, alert_data=alert_data)
                await hpcl_ceg_model.ViolationHistoryVts(**{"id": alert_data["id"],
                                                            "alert_status": "Close",
                                                            "approved_status": True}).modify()
                return True, {"sapcommandsent": True}
        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return False