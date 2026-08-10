import urdhva_base
import traceback
import hpcl_ceg_model

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class CheckInterlockName:
    async def check_interlock_name(cls, sap_id, vehicle_number, bu, interlock_name):
        """
        This function is used to check if the given interlock name exists in the alerts table.
        
        Parameters:
        vehicle_number (str): The vehicle number for which the check is to be done.
        sap_id (str): The sap id for which the check is to be done.
        interlock_name (str): The interlock name for which the check is to be done.
        
        Returns:
        str: The interlock name with spaces replaced by underscore if it exists in the alerts table, else None.
        """        
        try:
            interlockn = {}
            query = (f"vehicle_number='{vehicle_number}' and bu='{bu}"
                        f"and sap_id='{sap_id}' and alert_status='Open' and interlock_name='{interlock_name}'"
                        f"and sop_id ='{"SOP001"}'")
            qstatus, resp = await hpcl_ceg_model.Alerts.get_all(urdhva_base.queryparams.QueryParams(q=query, limit =1), resp_type='plain')
            if qstatus and resp:
                rdata=resp['data'][0]
                for fdata in rdata:
                    interlockn = fdata["interlock_name"].replace(" ","_")
            return interlockn
        
        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return None