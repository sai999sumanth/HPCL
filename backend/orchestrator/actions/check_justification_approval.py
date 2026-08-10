import asyncio
import datetime
import urdhva_base
import traceback
import hpcl_ceg_model

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class CheckJustificationApproval:
    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the action.
        
        Returns:
            list: A list of strings representing the required variables.
        """
        return ["alert_id"]
    
    async def check_justification_approval(self, params):
        """
        Checks if the alert has a justification and message in its history.

        Args:
            params (dict): A dictionary containing the required parameters.

        Returns:
            bool: True if the alert has a justification and message, False otherwise.
        """
        resp = await hpcl_ceg_model.Alerts.get(params.get("alert_id", ''))
        print("resp --> ", resp)

        if resp:
            alert_history = resp.alert_history if hasattr(resp, "alert_history") else []

            has_justification = any(item.get("action_type") == "Justification" for item in alert_history)
            has_message = any(item.get("action_type") == "Message" for item in alert_history)

            if has_justification and has_message:
                return True, {"checkjustifiedapproved": True}
            else:
                return True, {"checkjustifiedapproved": False}
        else:
            return True, {"checkjustifiedapproved": False}

