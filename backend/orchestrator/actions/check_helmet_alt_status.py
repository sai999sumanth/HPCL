import urdhva_base
import traceback
import hpcl_ceg_model

logger = urdhva_base.logger.Logger("actions-processing-log")

class CheckHelmetAltStatus:
    async def get_required_variables(self):
        """
        Returns a list of strings containing the required variables for this action.
        
        In this case, the action only requires the alert_id variable.
        """
        return ["alert_id"]
    
    async def checkHelmetAltStatus(self, params):
        """
        Checks the status of a helmet alert for a given alert ID.

        This asynchronous function retrieves the alert data associated with the alert_id using 
        hpcl_ceg_model.Alerts.get(alert_id). It checks the alert history for the presence of "ATR" 
        or "Justified by", and if found, sets startCounter and closeAlt to True. If startCounter 
        is True and "http" is also found in the alert history, closeAlt is set to False. 
        The function returns a tuple containing a boolean indicating success and a dictionary 
        with the key "closeAlert" set to the value of closeAlt.

        Args:
            alert_id (str): The ID of the alert to check.

        Returns:
            tuple: A tuple containing a boolean indicating success, and a dictionary with the key 
            "closeAlert" set to the value of closeAlt.
        """
        try:
            logger.info("CHECK HELMET ATR alert_id:%s" % params.get("alert_id",''))
            alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id',''))

            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__

            alerthistory = alert_data.get('alert_history', [])
            startCounter = False
            closeAlt = True
            for item in alerthistory:
                if "ATR" in item or "Justified by" in item:
                    startCounter = True
                    closeAlt = True
                if startCounter and "http" in item:
                    closeAlt = False
            return True, {"closeAlert": closeAlt}
        
        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return False
