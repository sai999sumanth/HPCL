import urdhva_base
import hpcl_ceg_model
import hpcl_ceg_enum


logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class CheckVTSBlocked:
    
    async def get_required_variables(self):
        return ["alert_id"]
    
    async def check_vts_blocked(self,params):
         
         try:
           alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id'))
           if alert_data.block_status == 'Blocked':
               return True , {"vtsBlocked": True}
            
           logger.info(f"No records found")
           return True , {"vtsBlocked": False}
            
         except Exception as e:
                logger.error(f"Error while checking and creating alerts for extended contract: {str(e)}")
                return False, {"status": False, "message": "Error while checking and creating alerts for extended contract"}