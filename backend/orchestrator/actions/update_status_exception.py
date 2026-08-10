import urdhva_base
import traceback
import hpcl_ceg_model
import orchestrator.alerting.alert_manager as alert_manager

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class Update_Status_Exception:
    async def get_required_variables(self):
        """
        Returns a list of required variables for the Update_Status_Exception action.

        Returns:
            list: A list containing a single string, "alert_id".
        """
        return ["alert_id"]

    async def updatestatusexception(self, params):        
        """
        Updates the status of the alert with the given alert_id to "Exception Approved",
        sets the role and rolelist to empty string and list, and sets the finalapproval to True.

        Args:
            alert_id (str): The id of the alert to be updated.

        Returns:
            tuple: A tuple containing a boolean indicating the success of the operation,
            and a dictionary with the updated alert data.
        """
        try:
            alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id'))

            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__
            
            if "_sa_instance_state" in alert_data.keys():
                del alert_data["_sa_instance_state"]
        
            alert_data['role'] = ''
            alert_data['rolelist'] = []
            alert_data['finalapproval'] = True
            alert_data['alert_id'] = params.get('alert_id')
            alert_data["action_msg"] = "Exception Approved"
            alert_data["action_type"] = "ExceptionApproved"
            await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)

            data_object = hpcl_ceg_model.Alerts(**alert_data)
            await data_object.modify()
            return True, None
        
        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return False, e