import urdhva_base
import hpcl_ceg_model
import hpcl_ceg_enum


logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class CheckExtendedContract:
    
    async def get_required_variables(self):
        return ["alert_id", "device_installation_id", "sap_id", "vehicle_number", "location_name", 
                "bu", "zone", "contract_valid_upto", "alert_section", "interlock_name"]
    
    async def check_extented_contract(self,params):
         
         try:
            # we have to check the contract is extended or not if not exteneted return false
            # if extended return true 
            
            # if contract Extended
            query = f"""
                     select tibco_expiry_date from device_installation where sap_tt_no = '{params.get("vehicle_number")}'
                     order by created_at desc limit 1
                     """
            result = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
            data = result.get("data", [])
            if data:
                for record in data:
                    tibco_expiry_date = record.get("tibco_expiry_date")  # could be None
                    contract_valid_upto = params.get("contract_valid_upto")
                    if tibco_expiry_date is not None and tibco_expiry_date > contract_valid_upto:
                        return True , {"contractExtended": True}
            
            logger.info(f"No records found for vehicle {params.get('vehicle_number')} in device_installation")
            return True , {"contractExtended": False}
            
         except Exception as e:
                logger.error(f"Error while checking and creating alerts for extended contract: {str(e)}")
                return {"status": False, "message": "Error while checking and creating alerts for extended contract"}