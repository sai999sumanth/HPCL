import urdhva_base
import datetime
import traceback
import hpcl_ceg_model
import pytz
import math
# import utilities.emlock_mapping as emlock_mapping
# import utilities.va_alert_mapping as va_alert_mapping
# import utilities.role_configuration as role_configuration
# import orchestrator.analytics.vts_analysis as vts_analysis
# import utilities.tas_role_configuration as tas_role_configuration
import orchestrator.analytics.va_analysis as va_analysis

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class VTSViolationWaitTime:
    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the action.
        
        Returns:
            list: A list of strings representing the required variables.
        """
        return ["alert_id", "va_level", "escalate_time_block"]
    
    async def wait_time(self, params):
        """
        This function checks if the given alert is ready to be unblocked. 
        It retrieves the alert's creation time and the number of days it should wait, 
        then calculates the time difference between the current time and the creation time. 
        If the time difference is less than the specified number of days, it calculates 
        the remaining wait time and returns it in the format 'PTXMX', where X is the 
        number of minutes. Otherwise, it returns a wait time of 1 minute.
        
        Args:
            alert_id (str): The ID of the alert to check.
            days (str): The number of days the alert should wait before being unblocked.
        
        Returns:
            tuple: A tuple containing a boolean indicating success, and a dictionary with the key 
            "waitTime" set to the value of the calculated wait time.
        """
        try:
            totalWaitTime = "PT24H"
            ist = pytz.timezone('Asia/Kolkata')
            today_time = datetime.datetime.now(ist)
            start_date, end_date = await va_analysis.get_period_datetime(period='fortnight')

            if end_date.tzinfo is None:
                end_date = ist.localize(end_date)
            else:
                end_date = end_date.astimezone(ist)
            
            waiting_time = end_date - today_time
            total_seconds = waiting_time.total_seconds()

            if total_seconds > 86400:
                return True, {"waitTime": totalWaitTime}
            
            if total_seconds > 3600:
                total_seconds = total_seconds - 3600
                totalWaitTime = f"PT{total_seconds}S"
                return True, {"waitTime": totalWaitTime}
            
            return True, {"waitTime": "PT10S"}
        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return False