import urdhva_base
import traceback
import hpcl_ceg_model

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class CheckAtrStatus:
    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the action.
        
        Returns:
            list: A list of strings representing the required variables.
        """
        return ["alert_id"]
    
    async def checkATRStatus(self, params):
        """
        Checks if an ATR has been submitted for a given alert ID.

        Retrieves the alert data associated with the alert_id using hpcl_ceg_model.Alerts.get(alert_id), 
        and then checks if the alert history contains the string "ATR" or "Justified by". 
        If it does, the function sets atrSubmitted to True and returns a tuple containing True and a 
        dictionary with the key "atrStatus" set to the value of atrSubmitted.

        Args:
            alert_id (str): The ID of the alert to check.

        Returns:
            tuple: A tuple containing a boolean indicating success, and a dictionary with the key "atrStatus" 
            set to the value of atrSubmitted.
        """
        try:
            logger.info("Check ATR Status alert_id:%s" % params.get('alert_id'))
            alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id'))
            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__
            atrSubmitted = False
            alerthistory = alert_data.get('alertHistory', [])
            for item in alerthistory:
                if ("atr_uploaded" in item and item["atr_uploaded"] is True) or \
                    ("Justified by" in item and item["Justified by"] is True):
                    atrSubmitted = True
                    alert_data['alert_id'] = alert_id
                    # Set action_msg based on the condition
                    if "atr_uploaded" in item and item["atr_uploaded"] is True:
                        alert_data["action_msg"] = "ATR Uploaded"
                        alert_data["action_type"] = "ATR Uploaded"
                    elif "Justified by" in item and item["Justified by"] is True:
                        alert_data["action_msg"] = f"Justified by {item['Justified by']}"
                        alert_data["action_type"] = f"Justified by"
                    await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                    break
            return True, {"atrStatus": atrSubmitted}
        
        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return False, {"atrStatus": "False"}