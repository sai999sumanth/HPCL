import urdhva_base
import traceback
import hpcl_ceg_model

logger = urdhva_base.logger.Logger("actions-processing-log")


class CheckDealerCounter:
    async def get_required_variables(self):
        """
        Returns a list of required variables for the CheckDealerCounter action.

        This asynchronous function specifies the variables needed to perform the action, 
        which in this case, is limited to the 'alert_id' variable.

        Returns:
            list: A list containing a single string, "alert_id".
        """
        return ["alert_id"]
    
    async def checkdealercounter(self, params):
        """
        Checks if the dealer counter for a given alert has reached 1.

        This asynchronous function retrieves alert data using the provided alert_id,
        and checks if the 'Dealercount' field in the retrieved data is equal to 1.
        If it is, the function sets atrSubmitted to True, and returns a tuple containing
        True and a dictionary with the key "atrStatus" set to the value of atrSubmitted.
        If an exception occurs during the retrieval of the alert data, it catches the error,
        sets atrSubmitted to False, logs the error, and returns a tuple containing False and
        a dictionary with the key "atrStatus" set to the string "False".

        Args:
            alert_id (str): The ID of the alert to check.

        Returns:
            tuple: A tuple containing a boolean indicating success, and a dictionary with the key "atrStatus"
            set to the value of atrSubmitted.
        """
        try:
            alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id'))
            
            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__

            atrSubmitted = False
            dealercount = alert_data.get("Dealercount", 0)
            if dealercount == 1:
                atrSubmitted = True
            return True, {"atrStatus": atrSubmitted}
        
        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return False, {"atrStatus": "False"}