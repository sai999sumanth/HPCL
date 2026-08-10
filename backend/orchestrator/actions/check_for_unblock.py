import urdhva_base
import datetime
import traceback
import hpcl_ceg_model
import utilities.emlock_mapping as emlock_mapping
import utilities.va_alert_mapping as va_alert_mapping
import utilities.role_configuration as role_configuration
import orchestrator.analytics.vts_analysis as vts_analysis
import utilities.tas_role_configuration as tas_role_configuration

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class CheckForUnblock:
    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the action.
        
        Returns:
            list: A list of strings representing the required variables.
        """
        return ["alert_id", "va_level", "escalate_time_block"]
    
    async def checkForVehicleUnblock(self, params):
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
            totalWaitTime = "PT1H"
            # Fetch alert details from the Alerts table using the alert ID.
            alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id'))
            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__
            
            if "_sa_instance_state" in alert_data.keys():
                del alert_data["_sa_instance_state"]

            if alert_data.get("alert_section","") in ["VTS"]:
                escalation_time = params.get("escalate_time_block","")
                totalWaitTime = role_configuration.role_Mapping[alert_data["alert_section"]][alert_data.get("bu","")][alert_data.get("tt_type").lower()][alert_data["interlock_name"]]["block_time"][escalation_time]
                if escalation_time in ['0']:
                    if await vts_analysis.is_vehicle_blacklisted(alert_data['vehicle_number']):
                        return True, {"blacklist": True}
                return True, {"blacklist": False,"waitTime": totalWaitTime}
            if alert_data.get("alert_section", "") == "VA":
                va_mapping = va_alert_mapping.VA_Alert_Mapping[alert_data.get("bu","")][alert_data['violation_type']]['escalations'][params.get("va_level", "level - 1")]
                totalWaitTime = va_mapping['escalation_time']
            if alert_data.get("alert_section", "") in ["EMLock"]:
                #emlock_mappings = emlock_mapping.emlock_vehicle_mapping[alert_data.get("bu","")][alert_data['violation_type']]['escalations'][params.get("va_level", "level - 1")]
                #totalWaitTime = emlock_mappings['escalation_time']
                now = datetime.datetime.now(datetime.timezone.utc)
                # Define IST offset
                ist_offset = datetime.timedelta(hours=5, minutes=30)
                # Convert the current UTC time to IST
                now_ist = now + ist_offset
                # Calculate today's target time (1 AM IST)
                target_time_ist = now_ist.replace(hour=1, minute=0, second=0, microsecond=0)
                # If the current IST time is already past the target time, move the target to the next day
                target_time_ist += datetime.timedelta(days=1)
                # Calculate the time difference in minutes
                time_difference = target_time_ist - now_ist
                minutes = int(time_difference.total_seconds() // 60)
                totalWaitTime = "PT" + str(minutes) + "M"
            if alert_data.get('bu') == "TAS" and (alert_data.get("alert_section") == "TAS" or not alert_data.get("alert_section")):
                escalation_time = params.get("escalate_time_block","")
                totalWaitTime = tas_role_configuration.tas_role_mapping[alert_data["bu"]][alert_data["interlock_name"]]["block_time"][escalation_time]
                print("totalWaittime---------->",totalWaitTime)
            return True, {"waitTime": totalWaitTime}
        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return False