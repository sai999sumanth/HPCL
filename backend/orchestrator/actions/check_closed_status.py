import urdhva_base
import traceback
import hpcl_ceg_model

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class CheckClosedStatus:
    async def get_required_variables(self):        
        """
        Returns a list of required variables for the CheckClosedStatus action.

        This asynchronous function specifies the variables needed to perform the action, 
        which in this case, is limited to the 'alert_id' variable.

        Returns:
            list: A list containing a single string, "alert_id".
        """
        return ["alert_id"]
    
    async def checkClosedstatus(self, params):
        """
        This asynchronous function checks if an alert has been closed.

        It retrieves the alert data associated with the given alert_id using hpcl_ceg_model.Alerts.get(alert_id), 
        and then checks if the alert history contains the string "CLOSED". If it does, the function sets closeSubmitted 
        to True and returns a tuple containing True and a dictionary with the key "closedStatus" set to the value of 
        closeSubmitted. If an exception occurs during the retrieval of the alert data, it catches the error, sets 
        closeSubmitted to False, logs the error, and returns a tuple containing False and a dictionary with the key 
        "closedStatus" set to the string "False".

        Args:
            alert_id (str): The ID of the alert to check.

        Returns:
            tuple: A tuple containing a boolean indicating success, and a dictionary with the key "closedStatus" 
            set to the value of closeSubmitted.
        """
        closeSubmitted = False
        try:
            alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id'))
            
            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__

            alerthistory = alert_data.get('alertHistory', [])
            for item in alerthistory:
                if "CLOSED" in item:
                    closeSubmitted = True
                    alert_data['alert_id'] = alert_id
                    alert_data["action_msg"] = "Closed Status"
                    alert_data["action_type"] = "ClosedStatus"
                    await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                    break
            return True, {"closedStatus": closeSubmitted}

        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return False, {"closedStatus": "False"}