import urdhva_base
import traceback
# import ThingsBoardApi
import hpcl_ceg_model
import orchestrator.alerting.alert_manager as alert_manager

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class InterlockStatus:
    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the action.
        
        Returns:
            list: A list containing a single string, "alert_id".
        """
        return ["alert_id"]
    
    async def checkInterlockStatus(self, params):
        """
        Checks the interlock status for a given alert ID.

        This asynchronous function retrieves alert data associated with the alert_id
        using hpcl_ceg_model.Alerts.get(alert_id). It attempts to fetch the alert status
        from an external system (e.g., ThingsBoard) using the provided business unit and sap_id.
        If successful, it returns a tuple containing a boolean indicating success and a dictionary
        with the key "interlockcleared" set to the value of tbAltStatus. In case of an error,
        it logs the error and returns a tuple containing False and a dictionary with the key
        "interlockcleared" set to False.

        Args:
            params (dict): A dictionary containing the alert_id to check.

        Returns:
            tuple: A tuple containing a boolean indicating success and a dictionary with the key
            "interlockcleared" set to the value of tbAltStatus.
        """
        try:
            tbAltStatus = False
            print("params --> ", params)
            alert_id = params.get('alert_id')
            alert_data = await hpcl_ceg_model.Alerts.get(alert_id)

            if alert_data:
                if not isinstance(alert_data, dict):
                    alert_data = alert_data.__dict__
                else:
                    alert_data = alert_data
                
                tbAlertId = alert_data['external_id']
                bu = alert_data.get('bu', "")
                sap_id = alert_data.get('sap_id', '0')

                # tb = ThingsBoardApi.TB(bu, sap_id)
                try:
                    # tbAltStatus = await tb.getTbAlertStatus(tbAlertId)
                    tbAltStatus = False
                    #TODO: Might change the action msg as reuired for the 
                    if tbAltStatus:
                        alert_data['alert_id'] = alert_id
                        alert_data["action_msg"] = "Interlock Cleared"
                        alert_data["action_type"] = "InterlockCleared"
                        await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                    else:
                        alert_data['alert_id'] = alert_id
                        alert_data["action_msg"] = "Interlock not Cleared"
                        alert_data["action_type"] = "InterlockNotCleared"
                        await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                except Exception as e:
                    print("Exception in getting current Alert status in thingsboard %s" % (e))
            return True, {"interlockcleared": tbAltStatus}
        
        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return False, {"interlockcleared": False}
            
