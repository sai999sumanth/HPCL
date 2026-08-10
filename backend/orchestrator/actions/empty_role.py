import urdhva_base
import traceback
import hpcl_ceg_model

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")

class EmptyRole:
    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the action.

        Returns:
            list: A list containing two strings, "alert_id" and "maintenance".
        """
        return ["alert_id", "maintenance"]
    
    async def emptyrole(self, params):
        """
        Updates the status of the alert with the given alert_id to "Under Maintenance",
        clears the role and rolelist, and sets final approval to True in the database.

        Args:
            alert_id (str): The id of the alert to be updated.
            maintenance (bool): A boolean indicating whether the maintenance status 
                should be set to True.

        Returns:
            tuple: A tuple containing a boolean indicating the success of the operation,
            and None.
        """
        try:
            alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id'))
            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__

            alert_data['role'] = ''
            alert_data['rolelist'] = []

            if params.get('maintenance'):
                alert_data['alert_status'] = "Under Maintenance"

            data_object = hpcl_ceg_model.Alerts(**alert_data)
            await data_object.modify()
            return True, None
        
        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return False, e