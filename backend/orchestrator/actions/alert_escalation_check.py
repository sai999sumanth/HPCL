import urdhva_base
import time
import datetime
import traceback
import hpcl_ceg_model
import utilities.helpers as helpers

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")

class AlertEscalationCheck:
    async def get_required_variables(self):
        return ["BU", "sap_id", "sop_id", "device_id", 
                "device_type", "device_name", "alert_id", 
                "interlock_name"]

    async def alert_escalation_check(self, params):
        """
        Check if a maintenance alert is already present for the given device.

        Args:
        - params (dict): A dictionary containing the following required keys:
            - 'interlock_name' (str): The name of the interlock.
            - 'device_name' (str): The name of the device.
            - 'alert_id' (str): The ID of the current alert.

        Returns:
        - A tuple of (success, data), where:
            - success (bool): True if the action was successful, False otherwise.
            - data (dict): A dictionary containing the following key:
                - 'escalate' (bool): True if escalation is needed, False otherwise.

        Raises:
        - No exceptions are raised. If an error occurs, the function will return
          success=False and the error will be logged.
        """
        try:
            interlock_name = params.get('interlock_name', '')
            device_name = params.get('device_name', '')
            current_alert_id = params.get('alert_id', '')

            # Clean interlock name for query
            if interlock_name.endswith('_M'):
                interlock_name_for_query = interlock_name[:-2]
            else:
                interlock_name_for_query = interlock_name

            print(f"Checking maintenance alerts for device: {device_name}")
            logger.debug(f"Checking maintenance alerts for device: {device_name}")

            # Query for *any* maintenance alerts for the same device (not time-based)
            maintenance_query = (
                f"""bu = 'TAS' and """
                f"""alert_section = 'TAS' and """
                f"""regexp_replace(tas_device_name, '_M$', '') = '{interlock_name_for_query}' and """
                f"""interlock_name LIKE '%Maintenance%' and """
                f"""id != '{current_alert_id}'"""  # Exclude the current alert
            )

            print(f"Maintenance alert check query: {maintenance_query}")
            logger.debug(f"Maintenance alert check query: {maintenance_query}")

            maintenance_params = urdhva_base.queryparams.QueryParams(q=maintenance_query)
            maintenance_resp = await hpcl_ceg_model.Alerts.get_all(maintenance_params, resp_type='plain')

            if maintenance_resp.get("data"):
                # Maintenance alert exists for the same device
                print(f"Found maintenance alert for device - escalation allowed.")
                logger.info(f"Found maintenance alert for device - escalation allowed.")
                return True, {"escalate": False}
            else:
                # No maintenance alert, escalate
                print(f"No maintenance alert found for device - escalation needed.")
                logger.info(f"No maintenance alert found for device - escalation needed.")
                return True, {"escalate": True}

        except Exception as e:
            logger.error(f"Error in alert escalation check: {e}")
            logger.error(traceback.format_exc())
            # In case of error, let the escalation through by default
            return True, {"escalate": True}
