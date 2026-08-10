import urdhva_base
import hpcl_ceg_model
import datetime
import asyncio
import traceback
import orchestrator.notification_manager.notify_email as notify_email
import orchestrator.alerting.alert_manager as alert_manager



async def notify_prooftest():
    """
    This function checks the tas_proof_test table for proof_test_created_at and next_proof_test_date.
    If the current date is the 84th or 89th day before the next_proof_test_date, it sends a notification.
    """
    try:
        # Query the tas_proof_test table to get the required data
        query = """
            SELECT device_name, sap_id, location_name, interlock_name, proof_test_created_at, next_proof_test_date
            FROM tas_proof_test
        """
        try:
            resp = await hpcl_ceg_model.TasProofTest.get_aggr_data(query)
        except Exception as e:
            print(f"Error executing query: {e}")
            return

        # Check if the response contains data
        if not resp.get("data", []):
            print("No data found in tas_proof_test table.")
            return

        # Process the response
        today = datetime.datetime.now().date()
        for record in resp.get("data", []):
            device_name = record.get("device_name")
            interlock_name = record.get("interlock_name")
            sap_id = record.get("sap_id")
            location_name = record.get("location_name")
            proof_test_created_at = record.get("proof_test_created_at")
            next_proof_test_date = record.get("next_proof_test_date")

            if not (device_name and sap_id and proof_test_created_at and next_proof_test_date and interlock_name):
                print(f"Missing required fields in record: {record}")
                continue

            # Convert dates to datetime objects
            if isinstance(proof_test_created_at, str):
                proof_test_created_at = datetime.datetime.strptime(proof_test_created_at, "%Y-%m-%d %H:%M:%S")
            if isinstance(next_proof_test_date, str):
                next_proof_test_date = datetime.datetime.strptime(next_proof_test_date, "%Y-%m-%d %H:%M:%S")

            # Calculate the 84th and 89th days before the next proof test date
            day_84 = next_proof_test_date - datetime.timedelta(days=6)
            day_89 = next_proof_test_date - datetime.timedelta(days=1)

            # Check if today matches the 84th or 89th day
            if today == day_84.date() or today == day_89.date():

                recipients = []
                roles = ["Safety Officer SOD", "Maintenance Officer SOD", "Planning Officer SOD"]
                
                for role in roles:
                    email_query = f"""
                        SELECT email
                        FROM users
                        WHERE 'TAS' = ANY (bu) 
                        AND '{sap_id}' = ANY (sap_id) 
                        AND '{role}' = ANY(novex_role)
                    """
                    
                    try:
                        mail_resp = await hpcl_ceg_model.Users.get_aggr_data(email_query)
                        if mail_resp.get("data"):
                            recipients.extend([m.get("email") for m in mail_resp["data"] if m.get("email")])
                    except Exception as e:
                        print(f"Error executing email query for role {role}: {e}")
                        continue
                    
                email_instance = notify_email.NotifyEMail()
                resp = await email_instance.publish_message(
                    **{
                        'recipients': recipients,
                        'subject': f"Proof Test Notification for {device_name} - {interlock_name} on {location_name} - {sap_id} ",
                        'body': alert_manager.read_template("/opt/ceg/algo/orchestrator/notification_templates/proof_test_alert.html", data=record),
                        'html_content': True,
                        'force_send': True
                    }
                )
                             

    except Exception as e:
        print(f"Error in notify_prooftest: {traceback.format_exc()}")


if __name__ == "__main__":
    asyncio.run(notify_prooftest())