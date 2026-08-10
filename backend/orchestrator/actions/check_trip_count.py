import urdhva_base
import traceback
import hpcl_ceg_model

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class CheckTripCount:
    async def check_trip_count(cls, sap_id, vehicle_number, bu, violation_type):
        """
        This method is used to get the trip count for a given vehicle from the DB.
        
        Parameters:
        vehicle_number (str): The vehicle number for which trip count is to be fetched.
        sap_id (str): The sap id of the vehicle.
        device_name (str): The device name of the vehicle.
        
        Returns:
        int: The trip count of the vehicle.
        """
        try:    
            query = (f"sap_id='{sap_id}' and vehicle_number='{vehicle_number}' and bu='{bu}'"
                    f"and alert_status='Open' and violation_type='{violation_type}'"
                    f"and sop_id ='{"SOP001"}'")
            qstatus, qdata = await hpcl_ceg_model.Alerts.get_all(urdhva_base.queryparams.QueryParams(q=query, limit =1), resp_type='plain')
            if qstatus and qdata:
                rdata = qdata['data'][0]
                for fdata in rdata:
                    count = fdata["device_name"].replace(" ", "_")
            return count
        
        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return None
