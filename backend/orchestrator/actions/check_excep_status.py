import urdhva_base
import traceback
import hpcl_ceg_model

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class CheckExcepStatus:
    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the action.

        Returns:
            list: A list containing a single string, "alert_id".
        """
        return ["alert_id"]

    async def checkExcepstatus(self, params):
        """
        Checks if an exception has been taken for a given alert ID.

        Retrieves the alert data associated with the alert_id using hpcl_ceg_model.Alerts.get(alert_id), 
        and then checks if the alert history contains the string "Exception". 
        If it does, the function sets exceptaken to True and returns a tuple containing True and a 
        dictionary with the key "excepStatus" set to the value of exceptaken.

        Args:
            alert_id (str): The ID of the alert to check.

        Returns:
            tuple: A tuple containing a boolean indicating success, and a dictionary with the key "excepStatus" 
            set to the value of exceptaken.
        """
        exceptaken = False
        try:
            print("Check Exception request raised alert_id:%s" % params.get('alert_id'))
            alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id'))

            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__

            alerthistory = alert_data.get('alertHistory', [])
            for item in alerthistory:
                if "no_exception" in item:
                    exceptaken = True
                    alert_data['alert_id'] = params.get('alert_id')
                    alert_data["action_msg"] = ""
                    alert_data["action_type"] = ""
                    await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                    break
            return True, {"excepStatus": exceptaken}

        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return False, {"excepStatus": "False"}