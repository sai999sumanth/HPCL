import urdhva_base
import re
import json
import uuid
import asyncio
import psycopg2
import numpy as np
import pandas as pd
import polars as pl
import hpcl_ceg_model
from datetime import datetime, date
import orchestrator.alerting.alert_factory as alert_factory


# Path to the JSON file
json_file = "config.json"

try:
    with open(json_file, "r", encoding="utf-8") as file:
        config = json.load(file)
    print("JSON loaded successfully!")

    # Optional: Print some sample data to verify it's loaded correctly
    print(f"Oracle Host: {config['oracle']['host']}")
    print(f"PostgreSQL Database: {config['postgresql']['database_name']}")
    print(f"First Oracle Table: {config['oracle_tables'][0]}")

except json.JSONDecodeError as e:
    print(f"JSON parsing error: {e}")
    config = None  # Prevent using an invalid config
except FileNotFoundError:
    print(f"JSON file not found: {json_file}")
    config = None
except Exception as e:
    print(f"Unexpected error: {e}")
    config = None

class Postgresql:
    def __init__(self):
        """Initialize PostgreSQL connection details."""
        if config is None:
            raise ValueError("Configuration not loaded. Cannot proceed.")
        self.params = config['postgresql']

    def get_connection(self):
        """Establish a synchronous PostgreSQL connection."""
        return psycopg2.connect(
            host=self.params['host'],
            port=self.params['port'],
            user=self.params['user_name'],
            password=self.params['password'],
            dbname=self.params['database_name']
        )

    def get_default_schema(self):
        """Return the default schema."""
        return "public"

    async def cal_host_manual_fan_printed(self, data):
        """
        Calculate whether to create an actionable alert based on manual vs auto fan count comparison.
        Returns a tuple (close_alert, interlock_name, message) based on the comparison.
        """
        try:
            data = pd.DataFrame(data)
            
            # Check if data is empty
            if data.empty:
                return False, "No Data Available", "No records found for manual FAN printed"
            
            # Get the last record of the day (assuming data is sorted by timestamp)
            total_fan_count = data['total_count'].iloc[-1]  # Get the latest record
            manual_fan_count = data['manual_fan_count'].iloc[-1]
            
            # If manual fan count is zero, no alert needed
            if manual_fan_count == 0:
                return False, "Manual FAN Count is Zero", "No manual FAN was printed"
            
            # Calculate 5% threshold of total fan count
            five_percent_threshold = total_fan_count * 0.05
            
            # Compare manual fan count with 5% of total fan count
            if manual_fan_count > five_percent_threshold:
                return (True, 
                        "Manual FAN printed more than 5% of total TT loaded", 
                        f"Manual count {manual_fan_count} is greater than {five_percent_threshold:.2f} (5% of {total_fan_count})"
                       )
            else:
                return (True, 
                        "Manual FAN printed less than 5% of total TT loaded", 
                        f"Manual count {manual_fan_count} is less than {five_percent_threshold:.2f} (5% of {total_fan_count})"
                       )
        except Exception as e:
            print(f"Error in cal_host_manual_fan_printed: {str(e)}")
            return False, "Error in calculation", f"Error: {str(e)}"

    async def cal_unauthorized_flow(self, total_net):
        """
        Check if unauthorized flow alert should be created based on total net totalizer value.
        Returns a tuple (create_alert, message).
        """
        try:
            if total_net > 0:
                return True, "Unauthorized flow_BCU"
            return True, "Unauthorized flow_BCU"
        except Exception as e:
            print(f"Error in cal_unauthorized_flow: {str(e)}")
            return False, f"Error: {str(e)}"

    async def create_cancel_tt_report(self, data):
        """
        Create or update cancel TT report alerts.
        """
        try:
            to_date = urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d")
            query = f"""select id from alerts where interlock_name = 'Cancel TT Reported' and vehicle_number = '{data["vehicle_number"]}' """ \
                    f"""and created_at::DATE = '{to_date}'"""
            
            resp = await hpcl_ceg_model.Alerts.get_aggr_data(query)
            
            if resp.get("data", []):
                alert_data = await hpcl_ceg_model.Alerts.get(resp.get("data", [])[0]["id"])
                data['alert_id'] = alert_data['external_id']
                action_msg = f"Truck Number: {data['vehicle_number']} \n Compartment Number: {data['device_msg']}"
                input_data = {
                    "action_type": "Cancelled",
                    "action_msg": data.get("device_msg", "")
                }
                await alert_manager.AlertAction().update_alert_history(
                    input_data=input_data, alert_data=alert_data
                )
                return True, "Success", data
            
            status, msg = await alert_factory.AlertFactory.create_alert(data)
            return status, msg, data
        except Exception as e:
            print(f"Error in create_cancel_tt_report: {str(e)}")
            return False, f"Error: {str(e)}", data
    
    async def close_created_alert(self, alert_data):
        """
        Close a previously created alert.
        """
        try:
            # Extract alert_id from response
            query = f"""external_id='{alert_data["alert_id"]}'"""
            params = urdhva_base.queryparams.QueryParams()
            params.limit = 1
            params.q = query
            
            alert_resp = await hpcl_ceg_model.Alerts.get_all(params)
            
            try:
                body = alert_resp.body
                data = json.loads(body.decode('utf-8'))
                
                if 'data' in data and data['data']:
                    alert_id = data['data'][0]['external_id']
                else:
                    print(f"Alert not found for {alert_data['alert_id']}")
                    return False, "Alert not found"
            except (json.JSONDecodeError, AttributeError) as e:
                print(f"Error parsing alert response: {e}")
                return False, f"Error parsing response: {str(e)}"
            
            # Close Alert
            close_data = {
                'bu': 'TAS',
                'sop_id': alert_data['sop_id'],
                'sap_id': alert_data['sap_id'],
                'interlock_name': alert_data['interlock_name'],
                'alert_id': alert_data['alert_id']
            }
            
            close_success, close_msg = await alert_factory.AlertFactory.close_alert(close_data)
            print(f"Close alert result: {close_success}, Message: {close_msg}")
            
            return close_success, close_msg
        except Exception as e:
            print(f"Error in close_created_alert: {str(e)}")
            return False, f"Error: {str(e)}"

    async def process_host_manual_fan_printed(self, data, table_db_name, model):
        """
        Process host_manual_fan_printed table data and create/close alerts as needed.
        """
        try:
            to_date = urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d")
            current_hour = urdhva_base.utilities.get_present_time().strftime("%H")
            
            # Get records for today where manual_fan_count is not zero
            query = f"""select * from "{table_db_name}" where date::DATE = '{to_date}' and manual_fan_count != 0 order by date_time asc"""
            resp = await model.get_aggr_data(query)
            
            # Only process at end of day (19:00)
            if int(current_hour) == 19 and resp.get("data", []):
                # Calculate whether to close the alert
                is_close_alert = False
                interlock_name = config['interlock_name'].get("host_manual_fan_printed", "Manual FAN Printed")
                severity = config['severity'].get("host_manual_fan_printed", "Medium")
                sop_id = config['sop_id'].get("host_manual_fan_printed")
                
                # Get the first record to extract metadata
                first_record = resp.get("data", [])[0]
                
                # Calculate alert conditions
                result = await self.cal_host_manual_fan_printed(resp.get("data", []))
                
                if isinstance(result, tuple) and len(result) >= 3:
                    is_close_alert, interlock_name, device_msg = result
                
                # Create alert data
                alert_data = {
                    'bu': 'TAS',
                    'sop_id': sop_id,
                    'sap_id': first_record.get('sap_id'),
                    'interlock_name': interlock_name,
                    'severity': severity,
                    'alert_id': str(uuid.uuid1()),
                    'device_name': first_record.get('bcu_number'),
                    'device_type': 'Gantry',
                    'vehicle_number': first_record.get('truck_number', ''),
                    'device_msg': device_msg
                }
                
                # Create alert
                success, msg = await alert_factory.AlertFactory.create_alert(alert_data)
                print(f"Manual FAN alert creation result: {success}, Message: {msg}")
                
                # Update records to mark as processed
                update_query = f"""update {table_db_name} set alert_created = true where date::DATE = '{to_date}' and manual_fan_count != 0"""
                await model.update_by_query(update_query)
                
                # Close alert if needed
                if is_close_alert:
                    close_success, close_msg = await self.close_created_alert(alert_data=alert_data)
                    print(f"Manual FAN alert closure result: {close_success}, Message: {close_msg}")
                
                return True, "Manual FAN printed alerts processed"
            return False, "No Manual FAN printed processing needed at this time"
        except Exception as e:
            print(f"Error in process_host_manual_fan_printed: {str(e)}")
            return False, f"Error processing manual FAN printed: {str(e)}"

    async def process_host_unauthorised_flow(self, data, table_db_name, model):
        """
        Process host_unauthorised_flow table data and create/close alerts as needed.
        """
        try:
            # Get records where alert has not been created
            query = f"""select * from "{table_db_name}" where alert_created = false"""
            resp = await model.get_aggr_data(query)
            
            if not resp.get("data", []):
                return False, "No unauthorized flow records to process"
            
            # Get unauthorized flow records
            unauthorised_records = resp.get("data", [])
            
            # Compute total net totalizer (only considering positive values)
            total_net = sum(float(record.get("nettotalizer", 0)) 
                           for record in unauthorised_records 
                           if float(record.get("nettotalizer", 0)) > 0)
            
            # If total net is not positive, no need to create alert
            if total_net <= 0:
                return False, "Total net totalizer is not positive, no alert needed"
            
            # Extract unique BCU numbers
            bcu_numbers = sorted(set(record.get("bcu_number", "") 
                                   for record in unauthorised_records))
            
            # Check if unauthorized flow should be triggered
            is_close_alert, interlock_name = await self.cal_unauthorized_flow(total_net)
            
            # Construct device message
            device_msg = f"BCU Numbers: {', '.join(bcu_numbers)}, Total Net Totalizer: {total_net:.2f}"
            
            # Get configuration
            severity = config['severity'].get("host_unauthorised_flow", "High")
            sop_id = config['sop_id'].get("host_unauthorised_flow")
            
            # Create alert data from first record
            first_record = unauthorised_records[0]
            alert_data = {
                'bu': 'TAS',
                'sop_id': sop_id,
                'sap_id': first_record.get('sap_id'),
                'interlock_name': interlock_name,
                'severity': severity,
                'alert_id': str(uuid.uuid1()),
                'device_name': ', '.join(bcu_numbers),
                'device_type': 'Gantry',
                'vehicle_number': first_record.get('truck_number', ''),
                'device_msg': device_msg
            }
            
            # Create alert
            success, msg = await alert_factory.AlertFactory.create_alert(alert_data)
            print(f"Unauthorized flow alert creation result: {success}, Message: {msg}")
            
            if success:
                # Mark all records as having alerts created
                record_ids = [str(record['id']) for record in unauthorised_records]
                update_query = f"""update {table_db_name} set alert_created = true where id in ({','.join(record_ids)})"""
                await model.update_by_query(update_query)
                
                # Close alert if needed
                if is_close_alert:
                    close_success, close_msg = await self.close_created_alert(alert_data=alert_data)
                    print(f"Unauthorized flow alert closure result: {close_success}, Message: {close_msg}")
                
                return True, "Unauthorized flow alerts processed"
            else:
                return False, f"Failed to create unauthorized flow alert: {msg}"
        except Exception as e:
            print(f"Error in process_host_unauthorised_flow: {str(e)}")
            return False, f"Error processing unauthorized flow: {str(e)}"

    async def create_table(self, schema_name, table_name, sample_records, primary_key=[], unique_key=[]):
        """Create a table and upsert sample records."""
        try:
            # Process date fields in the records
            for record in sample_records:
                # Process date fields
                self._process_date_fields(record)
            
            # Convert to polars DataFrame if not already
            if not isinstance(sample_records, pl.DataFrame):
                sample_records = pl.DataFrame(sample_records)
            
            data = sample_records.to_dicts()
            
            # Check if the model exists in hpcl_ceg_model
            model = getattr(hpcl_ceg_model, table_name, None)
            if model is None:
                raise ValueError(f"Model '{table_name}' not found in hpcl_ceg_model.")
            
            # Get the actual table name from the model
            table_db_name = getattr(model, '__tablename__', table_name)
            
            # Filter out records with non-positive nettotalizer for unauthorized flow
            if table_db_name == 'host_unauthorised_flow':
                data = [x for x in data if x.get('nettotalizer', 0) > 0]
            
            # Bulk upsert the data
            status, msg = await model.bulk_update(data, upsert=True, upsert_skip_keys=['alert_created'])
            if not status:
                print(f"Bulk update failed: {msg}")
                return {"status": "Failed to update data", "message": msg}
            
            # Process specific table types
            if table_db_name == 'host_manual_fan_printed':
                status, message = await self.process_host_manual_fan_printed(data, table_db_name, model)
                return {"status": "Table created and processed", "message": message}
            
            elif table_db_name == 'host_unauthorised_flow':
                status, message = await self.process_host_unauthorised_flow(data, table_db_name, model)
                return {"status": "Table created and processed", "message": message}
            
            # Process generic records that need alerts
            else:
                await self.process_generic_alerts(table_name, table_db_name, model)
                return {"status": "Table created and generic alerts processed"}
        
        except Exception as e:
            print(f"Error in create_table: {str(e)}")
            return {"status": "Error", "message": str(e)}
    
    def _process_date_fields(self, record):
        """Helper method to process date and time fields in records."""
        try:
            # Process date field
            if "date" in record and isinstance(record["date"], str):
                try:
                    record["date"] = date.fromisoformat(record["date"])
                except ValueError:
                    record["date"] = pd.to_datetime(record["date"]).date()
            
            # Process date_time field
            if "date_time" in record and isinstance(record["date_time"], str):
                try:
                    record["date_time"] = datetime.fromisoformat(record["date_time"])
                except ValueError:
                    record["date_time"] = pd.to_datetime(record["date_time"])
            
            # Process timestamp field
            if "timestamp" in record and isinstance(record["timestamp"], str):
                record["timestamp"] = pd.to_datetime(record["timestamp"])
            
            # Process created_date field
            if "created_date" in record and isinstance(record["created_date"], str):
                record["created_date"] = pd.to_datetime(record["created_date"])
            
            # Process cancelled_date field
            if "cancelled_date" in record and isinstance(record["cancelled_date"], str):
                record["cancelled_date"] = pd.to_datetime(record["cancelled_date"])
            
            # Process entry_time field
            if "entry_time" in record and isinstance(record["entry_time"], str):
                record["entry_time"] = pd.to_datetime(record["entry_time"])
            
            # Process exit_time field
            if "exit_time" in record and isinstance(record["exit_time"], str):
                record["exit_time"] = pd.to_datetime(record["exit_time"])
            
            # Process transaction_end_time field
            if "transaction_end_time" in record and isinstance(record["transaction_end_time"], str):
                record["transaction_end_time"] = pd.to_datetime(record["transaction_end_time"])
            
            # Handle None values and NaN values
            for key, value in record.items():
                if value is None or (isinstance(value, float) and np.isnan(value)) or value is pd.NaT:
                    record[key] = None
        
        except Exception as e:
            print(f"Error processing date fields in record: {str(e)}")
    
    async def process_generic_alerts(self, table_name, table_db_name, model):
        """Process generic alerts for standard tables."""
        try:
            # Get records where alert has not been created
            query = f"""select * from "{table_db_name}" where alert_created = false"""
            resp = await model.get_aggr_data(query)
            
            if not resp.get("data", []):
                return
            
            # Process each record
            for record in resp.get("data", []):
                try:
                    # Get config for this table
                    interlock_name = config['interlock_name'].get(table_name)
                    severity = config['severity'].get(table_name, "Medium")
                    sop_id = config['sop_id'].get(table_name)
                    device_msg = ""
                    
                    # Special handling for Cancel TT Reported
                    if interlock_name == 'Cancel TT Reported':
                        device_msg = str(record.get("compartment_number", ""))
                    
                    # Create alert data
                    alert_data = {
                        'bu': 'TAS',
                        'sop_id': sop_id,
                        'sap_id': record.get('sap_id'),
                        'interlock_name': interlock_name,
                        'severity': severity,
                        'alert_id': str(uuid.uuid1()),
                        'device_name': record.get('bcu_number'),
                        'device_type': 'Gantry',
                        'vehicle_number': record.get('truck_number', ''),
                        'device_msg': device_msg
                    }
                    
                    # Create the alert
                    is_close_alert = False
                    
                    # Special handling for Cancel TT Reported
                    if interlock_name == 'Cancel TT Reported':
                        is_close_alert = True
                        success, msg, alert_data = await self.create_cancel_tt_report(alert_data)
                    else:
                        success, msg = await alert_factory.AlertFactory.create_alert(alert_data)
                    
                    if not success:
                        print(f"Failed to create alert: {msg}")
                        continue
                    
                    # Mark this record as processed
                    update_query = f"""update "{table_db_name}" set alert_created = true where id = {record['id']}"""
                    await model.update_by_query(update_query)
                    
                    # Close alert if needed
                    if is_close_alert:
                        await self.close_created_alert(alert_data=alert_data)
                
                except Exception as e:
                    print(f"Error processing record {record.get('id')}: {str(e)}")
        
        except Exception as e:
            print(f"Error in process_generic_alerts: {str(e)}")
            return