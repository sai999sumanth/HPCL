import urdhva_base
import traceback
import hpcl_ceg_model
import sys
sys.path.append("/opt/ceg/algo/orchestrator")
from datetime import datetime, timedelta

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")

class TasUpdateProofTest:

    async def get_required_variables(self):
        return ["alert_id"]
    
    async def handle_updateProofTest(self, params):
        """
        Check and update the proof test data in the tas_proof_test table.
        If the data already exists, update the proof_test_created_at and next_proof_test_date.
        Otherwise, insert a new record.
        """
        try:
            # Get the alert data
            alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id'))
            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__
            
            if "_sa_instance_state" in alert_data.keys():
                del alert_data["_sa_instance_state"]

            # Extracting required parameters from alert data
            interlock_name = alert_data.get('interlock_name')
            equipment_name = alert_data.get('tas_device_name') or alert_data.get('device_name')
            location_name = alert_data.get('location_name')
            device_id = alert_data.get('device_id')
            created_at = alert_data.get('created_at')
            sap_id = alert_data.get('sap_id')

            failed_proof_interlocks = ["Proof Test_VFT_Failed", "Proof Test_Secondary Radar Guage_Fail"]
            if interlock_name in failed_proof_interlocks:
                return True ,{"message":"Moved to next block"} 

            if not (interlock_name and equipment_name and sap_id and created_at and device_id and location_name): 
                print("Missing required fields")

            # Convert created_at to a datetime object
            if isinstance(created_at, str):
                created_at = datetime.strptime(created_at, "%Y-%m-%d %H:%M:%S")

            # Calculate the next proof test date (90 days from created_at)
            next_proof_test_date = created_at + timedelta(days=90)

            # Check if the record already exists in the tas_proof_test table
            interlock_names = ["Proof Test_VFT_Success", "Proof Test_Secondary Radar Guage_Success"]

            if interlock_name in interlock_names:
                #check if the record already exists in the tas_proof_test table
                query = f"""
                    SELECT id, device_name, sap_id, device_id, interlock_name, location_name, proof_test_created_at, next_proof_test_date
                    FROM tas_proof_test
                    WHERE device_name = '{equipment_name}' AND sap_id = '{sap_id}' AND device_id = '{device_id}' AND interlock_name = '{interlock_name}'
                    AND location_name = '{location_name}'
                """
                existing_record = await hpcl_ceg_model.TasProofTest.get_aggr_data(query)
            
            else:
                existing_record = {}

            if existing_record.get("data", []):
                record = existing_record["data"][0]

                if "id" not in record:
                    print(f"Missing ID in record: {record}")
                    return False, {"message": "Missing ID in record"}

                record["proof_test_created_at"] = created_at.strftime("%Y-%m-%d %H:%M:%S")
                record["next_proof_test_date"] = next_proof_test_date.strftime("%Y-%m-%d %H:%M:%S")
                data_obj = hpcl_ceg_model.TasProofTest(**record)
                await data_obj.modify()
                print(f"Updated proof test record for device: {equipment_name}, SAP ID: {sap_id}")
                return True , {"message": "Moved to next block"}
            else:
                data = {
                    "interlock_name": interlock_name,
                    "device_name": equipment_name,
                    "device_id": device_id,
                    "location_name": location_name,
                    "sap_id": sap_id,
                    "proof_test_created_at": created_at.strftime("%Y-%m-%d %H:%M:%S"),
                    "next_proof_test_date": next_proof_test_date
                }
                await hpcl_ceg_model.TasProofTestCreate(**data).create()
                return True, { "message": "Moved to next block"}

        except Exception as e:
            logger.error(f"Error in check_proof_test: {traceback.format_exc()}")
            print(f"Error in check_proof_test: {traceback.format_exc()}")
            return  False,  {"message": "An error occurred while processing the proof test"}