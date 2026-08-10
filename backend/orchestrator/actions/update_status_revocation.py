import urdhva_base
import hpcl_ceg_model
import traceback
import orchestrator.alerting.alert_manager as alert_manager

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class UpdateStatusRevocation:
    async def get_required_variables(self):
        """
        Returns a list of required variables for the UpdateStatusRevocation action.

        Returns:
            list: A list containing a single string, "alert_id".
        """
        return ["alert_id"]

    async def updatestatusrevocation(self, params):  
        """
        Updates the status of the alert with the given alert_id to "Revocation Approved",
        clears the role and rolelist, and sets final approval to True in the database.

        Args:
            alert_id (str): The id of the alert to be updated.

        Returns:
            tuple: A tuple containing a boolean indicating the success of the operation,
            and None.
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
            alert_data["action_msg"] = "Revocation Approved"
            alert_data["action_type"] = "RevocationApproved"
            await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)

            # data_object = hpcl_ceg_model.Alerts(**alert_data)
            # await data_object.modify()
            return True, None
        
        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return False, e