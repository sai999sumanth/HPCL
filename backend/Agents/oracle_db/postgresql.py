import urdhva_base
import re
import pytz
import json
import uuid
import asyncio
import psycopg2
import numpy as np
import pandas as pd
import polars as pl
import hpcl_ceg_model
from datetime import datetime, date
import orchestrator.alerting.alert_manager as alert_manager
import orchestrator.alerting.alert_factory as alert_factory

# Determine the environment
environment = urdhva_base.settings.environment

# Select the appropriate configuration file
if environment == 'prod':
    config_file = "config_prod.json"
elif environment == 'uat':
    config_file = "config_uat.json"
else:
    config_file = "config.json"

try:
    with open(config_file, "r", encoding="utf-8") as file:
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
    print(f"JSON file not found: {config_file}")
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

    # def get_connection(self):
    #     """Establish a synchronous PostgreSQL connection."""
    #     return psycopg2.connect(
    #         host=self.params['host'],
    #         port=self.params['port'],
    #         user=self.params['user_name'],
    #         password=self.params['password'],
    #         dbname=self.params['database_name']
    #     )

    # def get_default_schema(self):
    #     """Return the default schema."""
    #     return "public"


    async def cal_host_manual_fan_printed(self, data):
        """
        Calculate whether to create an alert based on manual fan count percentage.

        This function processes the input data to determine if the percentage of 
        manual fan count exceeds a specified threshold (5% in this case) of the 
        total fan count. If the threshold is exceeded, an alert is triggered.

        Parameters:
        data (list of dict): A list of dictionaries containing 'total_count' and 
                            'manual_fan_count' fields, representing fan data.

        Returns:
        tuple: A tuple containing a boolean indicating if an alert is needed, a 
            string message summarizing the alert status, and a detailed message.
            The tuple is structured as (alert_needed, summary_message, detail_message).

        Raises:
        ValueError: If there is an attempt to calculate percentage with total count
                    being zero (to prevent division by zero).
        """
        data = pd.DataFrame(data)
        
        # Get the last record of the day (assuming data is sorted by timestamp)
        if data.empty:
            return False, "No data", "No data available for analysis"
        
        # Get the total fan count and manual fan count
        total_fan_count = data['total_count'].iloc[-1]  # Get the latest record
        manual_fan_count = data['manual_fan_count'].iloc[-1]
        
        # If no manual fans printed, no alert needed
        # if manual_fan_count == 0:
        #     return False, "No alert needed", "No manual FAN was printed"
        if manual_fan_count == 0:
            return 
        
        # Calculate percentage of manual fans compared to total
        if total_fan_count > 0:  # Avoid division by zero
            manual_percentage = (manual_fan_count / total_fan_count) * 100
        else:
            return False, "Division by zero", "Total count is zero but manual count exists"
        
        # Create alert if manual percentage exceeds 5%
        if manual_percentage > 5:
            print("manual_percentage --> ", manual_percentage)
            return True, "Manual FAN printed more than 5% of total TT loaded", f"Manual percentage: {manual_percentage:.2f}% exceeds threshold of 5%"
        else:
            return 


    async def cal_unauthorized_flow(self, net_totalizer):
        """
        Calculate if unauthorized flow alert should be created based on the difference
        between end_totalizer and start_totalizer values.

        Parameters:
        start_totalizer (float): The start totalizer value.
        end_totalizer (float): The end totalizer value.

        Returns:
        tuple: A tuple containing a boolean indicating if an alert is needed, and a string
            message summarizing the alert status. If an alert is needed, the first element
            of the tuple is True and the second element is the interlock name. If an alert
            is not needed, the first element is None and the second element is also None.
        """
        if net_totalizer > 5:
            return True, "Unauthorized flow_BCU"
        return None, None

    async def create_cancel_tt_report(self, data):
        """
        Create or update cancel TT report alerts

        Parameters:
        data (dict): A dictionary containing vehicle_number, tt_load_number, and message fields.

        Returns:
        tuple: A tuple containing a boolean indicating if the alert was created or updated successfully, a string message summarizing the alert status, and the input data.
        """
        to_date = urdhva_base.utilities.get_present_time(True).strftime("%Y-%m-%d")
        query = f"""select id from alerts where interlock_name = 'Cancel TT Reported' and vehicle_number = '{data["vehicle_number"]}' and tt_load_number = '{data["tt_load_number"]}' """ \
                f"""and created_at::DATE = '{to_date}'"""
        print("create_cancel_tt_report: ", query)
        resp = await hpcl_ceg_model.Alerts.get_aggr_data(query)
        print("Resp: ", resp)
        if resp.get("data", []):
            alert_data = await hpcl_ceg_model.Alerts.get(resp.get("data", [])[0]["id"])
            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__
            data['alert_id'] = alert_data['external_id']
            action_msg = f"Load Number: {data['tt_load_number']} with Truck Number: {data['vehicle_number']} and Compartment Number: {data['message']}"
            input_data = {
                "action_type": "Cancelled",
                "action_msg": action_msg
            }
            await alert_manager.AlertAction().update_alert_history(
                        input_data=input_data, alert_data=alert_data
                    )
            return True, "Success", data
        
        status, msg = await alert_factory.AlertFactory.create_alert(data)
        return status, msg, data
    
    async def create_bay_reasignment_report(self, data, compartment_number=None):
        """
        Create or update bay reassignment report alerts.

        Parameters:
        data (dict): A dictionary containing vehicle_number, tt_load_number, and message fields.

        Returns:
        tuple: A tuple containing a boolean indicating if the alert was created or updated successfully, a string message summarizing the alert status, and the input data.
        """
        to_date = urdhva_base.utilities.get_present_time(True).strftime("%Y-%m-%d")
        query = f"""select id from alerts where interlock_name = 'Bay reassignment' and vehicle_number = '{data["vehicle_number"]}' and tt_load_number = '{data["tt_load_number"]}' """ \
                f"""and created_at::DATE = '{to_date}'"""
        resp = await hpcl_ceg_model.Alerts.get_aggr_data(query)
        if resp.get("data", []):
            alert_data = await hpcl_ceg_model.Alerts.get(resp.get("data", [])[0]["id"])
            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__
            data['alert_id'] = alert_data['external_id']
            action_msg = f"Truck Number: {data['vehicle_number']} and Compartment Number: {compartment_number}"
            input_data = {
                "action_type": "BayReAssigned",
                "action_msg": action_msg
            }
            await alert_manager.AlertAction().update_alert_history(
                        input_data=input_data, alert_data=alert_data
                    )
            return True, "Success", data
        
        status, msg = await alert_factory.AlertFactory.create_alert(data)
        return status, msg, data
    
    
    async def create_sick_tt_report(self, data):
        """
        Create or update sick TT report alerts.

        Parameters:
        data (dict): A dictionary containing vehicle_number, tt_load_number, and message fields.

        Returns:
        tuple: A tuple containing a boolean indicating if the alert was created or updated successfully, a string message summarizing the alert status, and the input data.
        """
        to_date = urdhva_base.utilities.get_present_time(True).strftime("%Y-%m-%d")
        vehicle_number = data.get("vehicle_number")
        tt_load_number = data.get("tt_load_number")
        query = f"""
        select * from alerts
        where interlock_name = 'Sick TT Reported'
        and vehicle_number = '{vehicle_number}'
        and tt_load_number = '{tt_load_number}'
        and created_at::DATE = '{to_date}'
        """   
        resp = await hpcl_ceg_model.Alerts.get_aggr_data(query)
        if resp.get("data", []):
            print(f"Sick TT alert already exists for Truck: {vehicle_number}, Load: {tt_load_number}")
            return False, "Alert already exists", data
        # If no alert exists → create new alert
        status, msg = await alert_factory.AlertFactory.create_alert(data)
        return status, msg, data
    
    async def close_created_alert(self, alert_data):
        # Extract alert_id from response (assuming response contains alert_id)
        """
        Close a previously created alert.
        
        Parameters:
        alert_data (dict): A dictionary containing the data to close the alert
            - bu (str): Business unit
            - sop_id (str): SOP ID
            - sap_id (str): SAP ID
            - interlock_name (str): Interlock name
            - alert_id (str): Unique ID of the alert to be closed
        
        Returns:
        None
        
        Raises:
        None
        """
        query = (f"""external_id='{alert_data["alert_id"]}'""")
        params = urdhva_base.queryparams.QueryParams()
        params.limit = 1
        params.q = query
        alert_resp = await hpcl_ceg_model.Alerts.get_all(params)
        
        body =  alert_resp.body
        data = json.loads(body.decode('utf-8'))
        if 'data' in data and data['data']:
            alert_id = data['data'][0]['external_id']
        else:
            print(f"Alert not found for {alert_data['alert_id']}")
            return
        # Close Alert
        close_data = {
            'bu': 'TAS',
            'sop_id': alert_data['sop_id'],
            'sap_id': alert_data['sap_id'],
            'interlock_name': alert_data['interlock_name'],
            'alert_id' : alert_data['alert_id']
            
        }
        close_success, close_msg = await alert_factory.AlertFactory.close_alert(close_data)
        print("close_msg :", close_msg)
        if not close_success:
            print(f"Failed to close alert: {close_msg}")

    async def create_table(self, schema_name, table_name, sample_records, primary_key=[], unique_key=[]):
        """
        Process records for a given table and SAP ID.

        Args:
        - schema_name (str): Schema name for the table.
        - table_name (str): Table name to process.
        - sample_records (list): List of records to process.
        - primary_key (list, optional): Primary key columns for the table. Defaults to [].
        - unique_key (list, optional): Unique key columns for the table. Defaults to [].

        Returns:
        dict: Status and message of the operation.
        """
        for record in sample_records:
            record.pop("SR_NUMBER", None)

            if "cum_start_mass_mt" in record and record["cum_start_mass_mt"] is not None:
                record["cum_start_mass_mt"] = str(record["cum_start_mass_mt"])
            if "cum_end_mass_mt" in record and record["cum_end_mass_mt"] is not None:
                record["cum_end_mass_mt"] = str(record["cum_end_mass_mt"])
            if "date" in record and isinstance(record["date"], str):
                try:
                    record["date"] = date.fromisoformat(record["date"])
                except ValueError:
                    # Alternative parsing if not in ISO format
                    record["date"] = pd.to_datetime(record["date"]).date()
            
            if "date_time" in record and isinstance(record["date_time"], str):
                try:
                    record["date_time"] = datetime.fromisoformat(record["date_time"])
                except ValueError:
                    # Alternative parsing if not in ISO format
                    record["date_time"] = pd.to_datetime(record["date_time"])
            
            for key, value in record.items():
                if value is None or (isinstance(value, float) and np.isnan(value)) or value is pd.NaT:
                    record[key] = None
                if key == "timestamp" and isinstance(value, str):  # Convert timestamp properly
                    record[key] = pd.to_datetime(value)  # Converts to datetime
                # Add these checks to your existing function
                if "created_date" in record and isinstance(record["created_date"], str):
                    record["created_date"] = pd.to_datetime(record["created_date"])
                
                if "date_time" in record and isinstance(record["date_time"], str):
                    record["date_time"] = pd.to_datetime(record["date_time"])

                if "cancelled_date" in record and isinstance(record["cancelled_date"], str):
                    record["cancelled_date"] = pd.to_datetime(record["cancelled_date"])

                if "entry_time" in record and isinstance(record["entry_time"], str):
                    record["entry_time"] = pd.to_datetime(record["entry_time"])

                if "exit_time" in record and isinstance(record["exit_time"], str):
                    record["exit_time"] = pd.to_datetime(record["exit_time"])
                    
                if "transaction_end_time" in record and isinstance(record["transaction_end_time"], str):
                    record["transaction_end_time"] = pd.to_datetime(record["transaction_end_time"])
                
                if "bay_reassignment_time" in record and isinstance(record["bay_reassignment_time"], str):
                    record["bay_reassignment_time"] = pd.to_datetime(record["bay_reassignment_time"])

                if "trans_start_time" in record and isinstance(record["trans_start_time"], str):
                    record["trans_start_time"] = pd.to_datetime(record["trans_start_time"])
                
                if "trans_end_time" in record and isinstance(record["trans_end_time"], str):
                    record["trans_end_time"] = pd.to_datetime(record["trans_end_time"])
                                
                if "current_k_factor" in record:
                    try:
                        record["current_k_factor"] = round(float(record["current_k_factor"]), 2) if record["current_k_factor"] else None
                    except (ValueError, TypeError):
                        record["current_k_factor"] = None  # Handle invalid values

                if "current_meter_factor" in record:
                    try:
                        record["current_meter_factor"] = round(float(record["current_meter_factor"]), 2) if record["current_meter_factor"] else None
                    except (ValueError, TypeError):
                        record["current_meter_factor"] = None  # Handle invalid values

                if "last_k_factor" in record:
                    try:
                        record["last_k_factor"] = str(float(record["last_k_factor"]))
                    except (ValueError, TypeError):
                        record["last_k_factor"] = None # Handle invalid values
                
        if not isinstance(sample_records, pl.DataFrame):
            sample_records = pl.DataFrame(sample_records)
               
        # Group data by SAP ID
        data_by_sap_id = {}
        for record in sample_records.to_dicts():
            sap_id = record.get("sap_id")
            if sap_id not in data_by_sap_id:
                data_by_sap_id[sap_id] = []
            data_by_sap_id[sap_id].append(record)

        # Check if the model exists in hpcl_ceg_model
        model = getattr(hpcl_ceg_model, table_name, None)
        if model is None:
            raise ValueError(f"Model '{table_name}' not found in hpcl_ceg_model.")

        table_db_name = getattr(model, '__tablename__', table_name)
        
        # Process data for each SAP ID
        for sap_id, sap_id_data in data_by_sap_id.items():
            processed_data = sap_id_data

            # Specific processing for different table types
            # if table_db_name == 'host_unauthorised_flow':
            #     processed_data = [x for x in processed_data if x['nettotalizer'] > 0]

            # Remove unconsumed columns for host_day_end_details
            if table_db_name == 'host_day_end_details':
                 columns_to_skip = ['total_cancelled_tts', 'total_loaded_tts', 'total_sick_tts']
                 processed_data = [{k: v for k, v in record.items() if k not in columns_to_skip} for record in processed_data]

            if table_db_name in ['host_mfm_factor','host_sick_tts']:
                for record in processed_data:
                    for key in model.Config.upsert_keys:
                        if record.get(key) is None or record.get(key) == '':
                            record[key] = ''
            
            if table_db_name == 'host_manual_fan_printed':
                # Step 1: Check if we need to process EOD record
                current_hour = urdhva_base.utilities.get_present_time().strftime("%H")
                current_date = urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d")
                is_eod = int(current_hour) == 18
                
                # Step 2: Get the latest record for this SAP ID from the database
                check_query = f"""SELECT manual_fan_count 
                    FROM "{table_db_name}" 
                    WHERE date::DATE = '{current_date}' 
                    AND sap_id = '{sap_id}' 
                    ORDER BY date_time DESC
                """
                latest_record_resp = await urdhva_base.BasePostgresModel.get_aggr_data(check_query)
                
                # Get the latest manual count from DB (if exists)
                latest_db_count = None
                if latest_record_resp.get("data") and latest_record_resp.get("data")[0]:
                    latest_db_count = latest_record_resp.get("data")[0].get("manual_fan_count")
                
                # Step 3: Process the current data
                filtered_data = []
                latest_processed_count = None
                
                # First, process non-zero records with count changes
                for record in sap_id_data:
                    current_manual_count = record.get('manual_fan_count', 0)
                    
                    # Case 1: Record has non-zero manual count that differs from latest DB record
                    if current_manual_count > 0:
                        if current_manual_count != latest_db_count and current_manual_count != latest_processed_count:
                            filtered_data.append(record)
                            latest_processed_count = current_manual_count
                
                # Then handle EOD case only if needed
                if is_eod and not filtered_data:  # No records inserted yet
                    # Check if we have any non-zero records for today in DB
                    zero_check_query = f"""SELECT COUNT(*) 
                        FROM "{table_db_name}" 
                        WHERE date::DATE = '{current_date}' 
                        AND sap_id = '{sap_id}' 
                        AND manual_fan_count > 0
                    """
                    zero_check_resp = await urdhva_base.BasePostgresModel.get_aggr_data(zero_check_query)
                    
                    record_count = 0
                    if zero_check_resp.get("data") and len(zero_check_resp.get("data")) > 0:
                        record_count = int(zero_check_resp.get("data")[0].get("count", 0))
                    
                    # If no non-zero records exist for today, insert the latest zero record
                    # But only if the latest DB record isn't already zero
                    if record_count == 0 and latest_db_count != 0:
                        zero_records = [x for x in sap_id_data if x.get('manual_fan_count', 0) == 0]
                        if zero_records:
                            zero_records.sort(key=lambda x: x.get('date_time', ''), reverse=True)
                            filtered_data.append(zero_records[0])
                
                # After processing, update processed_data with our filtered results
                processed_data = filtered_data

            PROTECTED_COLUMNS = [
                "bcu_start_totalizer",
                "bcu_end_totalizer",
                "bcu_net_totalizer",
                "mfm_start_totalizer",
                "mfm_end_totalizer",
                "mfm_net_totalizer",
                "invoiced_qty",
                "total_tl_qty_loaded",
                "bcu_mfm_net_totalizer_diff",
                "invoiced_total_tl_qty_diff",
                "invoiced_bcu_net_qty_diff",
                "topup_qty_local_mode",
                "sampling_qty"
            ]

            if table_db_name == "host_day_end_details":
                final_data = []
                for record in processed_data:
                    query = f"""
                    SELECT *
                    FROM host_day_end_details
                    WHERE bay_number = '{record["bay_number"]}'
                    AND bcu_number = '{record["bcu_number"]}'
                    AND stock = '{record["stock"]}'
                    AND sap_id = '{record["sap_id"]}'
                    AND date::date = '{record["date"]}'::date
                    """
                    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query)
                    existing = None
                    if isinstance(resp, dict):
                        data = resp.get("data", [])
                        if len(data):
                            existing = data[0]
                    if existing:
                        for column in PROTECTED_COLUMNS:
                            incoming_value = record.get(column)
                            existing_value = existing.get(column)
                            # Preserve existing value whenever Oracle sends 0 or NULL
                            if not incoming_value:
                                record[column] = existing_value
                    else:
                        # If no existing record, ensure that we don't have None for protected columns
                        for column in PROTECTED_COLUMNS:
                            if record.get(column) is None:
                                record[column] = 0  # Default to 0 if no existing value

                    final_data.append(record)

                processed_data = final_data
            status, msg = await model.bulk_update(processed_data, upsert=True, upsert_skip_keys=['alert_created'])

            # Alert processing logic remains the same, but with SAP ID specific filtering
            to_date = urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d")
            
            # Common query with SAP ID filter
            query = f"""select * from "{table_db_name}" where alert_created = false and sap_id = '{sap_id}'"""
            
            # Specific modifications for certain table types
            if table_db_name == 'host_manual_fan_printed':
                query = f"""select * from "{table_db_name}" where date::DATE = '{to_date}' and manual_fan_count !=0 and sap_id = '{sap_id}' and alert_created = false order by date_time asc"""
            
            if table_db_name == 'host_unauthorised_flow':
                query = f"""select * from "{table_db_name}" where alert_created = false and sap_id = '{sap_id}' and net_totalizer > 0"""

            if table_db_name == 'host_mfm_factor':
                query = f"""SELECT * FROM "{table_db_name}" 
                            WHERE last_k_factor IS NOT NULL
                            AND current_k_factor::text IS DISTINCT FROM last_k_factor::text
                            AND (
                                NULLIF(last_k_factor_change_date, '')::DATE = '{to_date}'
                                OR NULLIF(last_meter_factor_change_date, '')::DATE = '{to_date}'
                            )
                            AND sap_id = '{sap_id}' 
                            AND alert_created = false 
                            ORDER BY created_at ASC
                """
            resp = await model.get_aggr_data(query)

            # Existing alert processing logic for manual_fan_printed
            # Alert processing logic
            if table_db_name == 'host_manual_fan_printed':
                # Query to get only non-zero manual fan count records that need processing
                query = f"""SELECT * FROM "{table_db_name}" 
                    WHERE date::DATE = '{to_date}' 
                    AND manual_fan_count > 0
                    AND sap_id = '{sap_id}' 
                    AND alert_created = false 
                    ORDER BY created_at ASC
                """
                resp = await model.get_aggr_data(query)

                # Process alerts for non-zero records
                if resp.get("data", []):
                    for record in resp.get("data", []):
                        is_close_alert = False
                        interlock_name = config['interlock_name'].get(table_name)
                        severity = config['severity'].get(table_name, "Medium")
                        sop_id = config['sop_id'].get(table_name)
                        device_msg = ""

                        # Calculate alert status
                        result = await self.cal_host_manual_fan_printed([record])
                        
                        # if isinstance(result, tuple) and len(result) == 3:
                        #     is_close_alert, interlock_name, device_msg = result

                        if result is None:
                            # No alert needed, continue without doing anything
                            pass
                        else:
                            is_close_alert, interlock_name, device_msg = result
                            # Now proceed to create alert
                        
                            print("device_msg --> ", device_msg)
                            # Prepare alert data
                            if interlock_name != '' and interlock_name is not None:
                                alert_data = {
                                    'bu': 'TAS',
                                    'sop_id': sop_id,
                                    'sap_id': record.get('sap_id'),
                                    'interlock_name': interlock_name,
                                    'severity': severity,
                                    'alert_id': str(uuid.uuid1()),
                                    'device_name': str(record.get('manual_fan_count', '')),
                                    'device_type': 'Gantry',
                                    'vehicle_number': record.get('truck_number', ''),
                                    'message': device_msg,
                                    'alert_section': 'TAS'
                                }

                                # Create alert for non-zero records
                                success, msg = await alert_factory.AlertFactory.create_alert(alert_data)
                                
                                # Close alert if needed
                                if is_close_alert:
                                    await self.close_created_alert(alert_data=alert_data)
                                    
                                # Mark record as processed
                                query = f"UPDATE {table_db_name} SET alert_created = true WHERE id = {record['id']}"
                                await model.update_by_query(query)
                    
                    return {"status": "Table updated and alerts processed for non-zero records"}
                else:
                    return {"status": "No non-zero records to process for alerts"}

            if table_db_name == 'host_unauthorised_flow':
                unauthorised_records = resp.get("data", [])
                # Check each record for unauthorized flow
                for record in unauthorised_records:
                    start_totalizer = float(record.get("start_totalizer", 0))
                    end_totalizer = float(record.get("end_totalizer", 0))
                    bcu_number = record.get("bcu_number", "")
                    net_totalizer = float(record.get("net_totalizer", 0))
                    
                    # Check if unauthorized flow should be triggered based on the difference
                    is_close_alert, interlock_name = await self.cal_unauthorized_flow(net_totalizer)
                    
            # # Alert processing for unauthorized flow
            # if table_db_name == 'host_unauthorised_flow':
            #     unauthorised_records = resp.get("data", [])
            #     # Compute the total sum of all nettotalizer values
            #     total_net = sum(float(record.get("nettotalizer", 0)) for record in unauthorised_records if float(record.get("nettotalizer", 0)) != 0)
            #     # Extract unique BCU numbers
            #     bcu_numbers = sorted(set(record.get("bcu_number", "") for record in unauthorised_records))

            #     # Check if unauthorized flow should be triggered based on total_net
            #     is_close_alert, interlock_name = await self.cal_unauthorized_flow(total_net)

                    # Construct device message
                    # device_msg = f"BCU Numbers: {', '.join(bcu_numbers)}, Total Net Totalizer: {total_net}"
                    device_msg = f"BCU Numbers: {bcu_number}, Total Net Totalizer: {net_totalizer}"

                    # Create and close the alert if needed
                    if unauthorised_records and is_close_alert:
                        # Use the first record for necessary data
                        first_record = unauthorised_records[0]
                        if interlock_name != '' and interlock_name is not None:

                            alert_data = {
                                'bu': 'TAS',
                                'sop_id': config['sop_id'].get(table_name),
                                'sap_id': first_record.get('sap_id'),
                                'interlock_name': interlock_name,
                                'severity': config['severity'].get(table_name, "Medium"),
                                'alert_id': str(uuid.uuid1()),
                                'device_name': bcu_number,  # Since we're dealing with multiple BCUs
                                'device_type': 'Gantry',
                                'vehicle_number': '',  # This might need to be populated appropriately
                                'message': device_msg,
                                'alert_section': 'TAS'
                            }
                            
                            # Create Alert
                            success, msg = await alert_factory.AlertFactory.create_alert(alert_data)
                            print("msg :", msg)
                            
                            # Close alert if needed
                            if success and is_close_alert:
                                await self.close_created_alert(alert_data=alert_data)
                                
                            # Update all records as alert_created = true
                            for record in unauthorised_records:
                                query = f"update {table_db_name} set alert_created = true where id = {record['id']}"
                                await model.update_by_query(query)
                                
                            return {"status": "Unauthorized flow alerts processed"}

            # Existing alert processing for other table types
            if resp.get("data", []):
                for record in resp.get("data", []):
                    try:
                        # Fetch config based on table name
                        is_close_alert = False
                        interlock_name = config['interlock_name'].get(table_name)
                        severity = config['severity'].get(table_name, "Medium")
                        sop_id = config['sop_id'].get(table_name)
                        device_msg = ""
                        if interlock_name == 'Cancel TT Reported':
                            device_msg = f"For Compartment_Number: {record.get('compartment_number', '')}".strip()
                        
                        elif interlock_name == 'Bay reassignment':
                            device_msg = f"For Load Number: {record.get('load_number', '')} the ReAssigned Bay: {record.get('reassigned_bay', '')}".strip()

                        # Extract necessary fields from the record
                        if interlock_name != '' and interlock_name is not None:
                            
                            bcu_number = record.get('bcu_number')
                            mfm_number = record.get('mfm_number')

                            # Skip creating alert if bcu_number is missing or empty
                            if table_db_name == 'host_mfm_factor' and not bcu_number:
                                # Don't create alert
                                continue  # or return / break depending on your loop or function

                            device_name = f"{mfm_number}_{bcu_number}" if mfm_number else bcu_number

                            alert_data = {
                                'bu': 'TAS',
                                'sop_id': sop_id,
                                'sap_id': record.get('sap_id'),
                                'interlock_name': interlock_name,
                                'severity': severity,
                                'alert_id': str(uuid.uuid1()),
                                'device_name': device_name,
                                'device_type': 'Gantry',
                                'vehicle_number': record.get('truck_number', ''),
                                'tt_load_number': record.get('load_number', ''),
                                'message': device_msg,
                                'alert_section': 'TAS'
                            }

                            # Create Alert
                            if interlock_name == 'Cancel TT Reported':
                                is_close_alert = True
                                success, msg, alert_data = await self.create_cancel_tt_report(alert_data)
                            elif interlock_name == 'Bay reassignment':
                                is_close_alert = True
                                success, msg, alert_data = await self.create_bay_reasignment_report(alert_data, compartment_number=record.get('compartment_number', ''))
                            else:
                                success, msg = await alert_factory.AlertFactory.create_alert(alert_data)
                                print("msg :", msg)
                                is_close_alert = True
                                if not success:
                                    print(f"Failed to create alert: {msg}")
                                    return {"status": False, "message": f"Failed {e}", "data": []}
                            
                            # Set alert_created = true for alert created record
                            query = f"update {table_db_name} set alert_created = true where id = {record['id']}"
                            await model.update_by_query(query)

                            # Close alert
                            if is_close_alert:
                                await self.close_created_alert(alert_data=alert_data)

                    except Exception as e:
                        print(f"Error : {str(e)}")
                        return {"status": False, "message": f"Failed {e}", "data": []}

                return {"status": "Table created and alerts processed"}
            else:
                print("Bulk not posted")
                return {"status": "No data to create alert"}

        return {"status": "Table created and alerts processed for all SAP IDs"}