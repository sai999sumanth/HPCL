import urdhva_base
import traceback
import hpcl_ceg_model

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class CheckDealer:
    async def get_required_variables(self):
        """
        Returns a list of required variables for the action.

        Returns:
            list: A list of strings representing the required variables.
        """
        return ["alert_id"]
    
    async def checkdealer(self, params):
        """
        Checks if the dealer status for a given alert has been set to true.

        This asynchronous function retrieves alert data using the provided alert_id,
        and checks if the 'Dealer' field in the retrieved data is set to True.
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
            logger.info("checkdealer in k-factor Status alert_id:%s" % params.get('alert_id'))
            alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id'))

            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__

            atrSubmitted = False
            if alert_data['Dealer']== True:
                atrSubmitted = True
            return True, {"atrStatus": atrSubmitted}
        
        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return False, {"atrStatus": "False"}