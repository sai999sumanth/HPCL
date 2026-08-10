import urdhva_base
import traceback
import hpcl_ceg_model

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class ClearVtsCount:
    async def get_required_variables(self):
        return ["alert_id"]
    async def clearvtscount(self, params):
        """
        Clear the old count for a given VTS device name and vehicle number.
        
        Parameters:
        device_name (str): The VTS device name for which count is to be cleared.
        vehicle_number (str): The vehicle number for which count is to be cleared.
        
        Returns:
        tuple: (bool, str) A tuple indicating the success or failure of the operation and the reason.
        """
        try:
            alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id'))
            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__
            #check clear_count True or False
            if alert_data.get('clear_count'):
                query = (f"vehicle_number='{alert_data.get('vehicle_number')}' and bu='{alert_data.get('bu')}'"
                        f"and status='Open' and violation_type='{alert_data.get('violation_type')}'")
                resp = await hpcl_ceg_model.VTS.get_all(urdhva_base.queryparams.QueryParams(q=query, limit=1), resp_type='plain')
                if len(resp['data']):
                    vts_record = resp['data'][0]
                    vts_record['violation_count'] = 0
                    await hpcl_ceg_model.VTS(**vts_record).modify()
                return True, None
            
            else:
                return True, None
        
        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return False, "Failed to clear count"