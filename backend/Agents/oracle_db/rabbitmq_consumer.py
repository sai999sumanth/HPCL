import urdhva_base
import json
import aio_pika
from datetime import datetime
import asyncio
import traceback
import numpy as np
import pandas as pd
import hpcl_ceg_model
from postgresql import Postgresql
import utilities.helpers as helpers

class RabbitMQConsumer:
    def __init__(self):
        """Load RabbitMQ configuration from JSON file for the consumer."""
       
        # Determine the environment
        environment = urdhva_base.settings.environment

        # Select the appropriate configuration file
        if environment == 'prod':
            config_file = "config_prod.json"
        elif environment == 'uat':
            config_file = "config_uat.json"
        else:
            config_file = "config.json"
        with open(config_file, "r") as file:
            config = json.load(file)

        self.rabbitmq_host = config.get('conn_host', '')
        self.rabbitmq_port = int(config.get('conn_port', 5672))
        self.rabbitmq_user = config.get('conn_user', '')
        self.rabbitmq_password = config.get('conn_secret', '')
        self.queue_name = config.get('conn_channel', '')
        self.virtualhost = config.get('conn_vhost', '')

        self.table_rename_map = config.get("rename_tables", {})
        self.column_rename_map = config.get("column_rename", {})

    def rename_table(self, table_name):
        """Rename table based on config mapping."""
        return self.table_rename_map.get(table_name, table_name)

    def rename_columns(self, record):
        """Rename columns based on config mapping."""
        return {self.column_rename_map.get(k, k): v for k, v in record.items()}
    
    async def get_loc_details(self, sap_id):
        """Fetch location details asynchronously."""
        bu = 'TAS'
        return await helpers.get_location_details(bu, sap_id)
        
    async def process_message(self, body):
        """Process received RabbitMQ messages and store them in PostgreSQL asynchronously."""
        print("body --> ", body)
        try:
            data = json.loads(body)  # Convert JSON string to dict

            if not isinstance(data, dict):
                print(f"⚠ Warning: Expected dict, but got {type(data)}")
                return

            db = Postgresql()

            for table_name, records in data.items():
                new_table_name = self.rename_table(table_name)

                if isinstance(records, list) and all(isinstance(record, dict) for record in records):
                    renamed_records = [self.rename_columns(record) for record in records]

                    print(f"Processing table: {new_table_name} with {len(records)} records")

                    # Convert to DataFrame
                    df = pd.DataFrame(renamed_records)
                    if new_table_name == "HostLocalLoadedTts":
                         compare_cols = [col for col in df.columns if col != 'SR_NUMBER']
                         df = df.drop_duplicates(subset=compare_cols, keep='first')
                    # Convert all float to float, int to int, str to str, datetime to datetime, and handle NaN/Null values
                    for col in df.columns:
                        if df[col].dtype == np.float64 or df[col].dtype == np.float32:
                            # Convert NaN to None for database compatibility
                            df[col] = df[col].replace({np.nan: None})
                        elif pd.api.types.is_datetime64_any_dtype(df[col]):
                            # Convert NaT to None for datetime fields
                            df[col] = df[col].replace({pd.NaT: None})
                        elif df[col].dtype == np.int64 or df[col].dtype == np.int32:
                            # Convert NaN to None for integer fields
                            df[col] = df[col].replace({np.nan: None})
                    # Fetch location details in bulk and update DataFrame
                    if "sap_id" in df.columns:
                        unique_sap_ids = df["sap_id"].dropna().unique()
                        location_mapping = {sap_id: await self.get_loc_details(sap_id) for sap_id in unique_sap_ids}

                        df["location_name"] = df["sap_id"].map(lambda sap_id: location_mapping.get(sap_id, [None, {}])[1].get("name", ""))
                        df["zone"] = df["sap_id"].map(lambda sap_id: location_mapping.get(sap_id, [None, {}])[1].get("zone", ""))
                    # Convert back to list of dictionaries
                    cleaned_records = df.to_dict(orient="records")
                    for record in cleaned_records:
                        if 'sick_date' in record and isinstance(record['sick_date'], str):
                           record['sick_date'] = datetime.strptime(record['sick_date'], '%Y-%m-%d %H:%M:%S')
                    #     for key, value in record.items():
                    #         if isinstance(value, pd.Timestamp):
                    #             record[key] = value.to_pydatetime() if not pd.isna(value) else None
                    #         elif isinstance(value, float) and np.isnan(value):
                    #             record[key] = None  # Replace NaN floats with None
                    #         elif isinstance(value, int) and np.isnan(value):
                    #             record[key] = None  # Handle cases where NaN appears in integer fields
                    #         elif isinstance(value, (float, int)) and key in ["mfm_number", "bcu_number", "stock_code", "current_k_factor", "last_k_factor", "current_meter_factor", "last_meter_factor"]:
                    #             record[key] = str(value)  # Convert numbers to string format for safe SQL insertion
                    print("cleaned_records --> ", cleaned_records)

                    # Ensure await is used while creating the table
                    await db.create_table("public", new_table_name, cleaned_records)

                else:
                    print(f"Warning: Invalid data format for {table_name}")
        except Exception as e:
            print(traceback.format_exc())
            print(e)

    
    async def consume_from_rabbitmq(self):
        """Consume messages from RabbitMQ asynchronously with auto-reconnect on failure."""
        while True:  # Infinite loop to handle reconnections
            try:
                print("Connecting to RabbitMQ...")
                connection = await aio_pika.connect_robust(
                    host=self.rabbitmq_host,
                    port=self.rabbitmq_port,
                    virtualhost=self.virtualhost,
                    login=self.rabbitmq_user,
                    password=self.rabbitmq_password,
                    heartbeat=60
                )

                async with connection:
                    channel = await connection.channel()
                    queue = await channel.declare_queue(self.queue_name, durable=True)

                    print(f"Connected! Listening on queue: {self.queue_name}")

                    async with queue.iterator() as queue_iter:
                        async for message in queue_iter:
                            async with message.process():
                                try:
                                    body = message.body.decode()
                                    await self.process_message(body)  # Process message asynchronously
                                except Exception as e:
                                    print(f"⚠ Error processing message: {e}")

            except (aio_pika.exceptions.AMQPConnectionError, ConnectionError) as e:
                print(f"Connection lost! Reconnecting in 5 seconds... Error: {e}")
                await asyncio.sleep(5)  # Fixed 5-second retry delay

            except Exception as e:
                print(f"Unexpected error: {e}. Retrying in 5 seconds...")
                await asyncio.sleep(5)  # Fixed 5-second retry delay

if __name__ == "__main__":
    consumer = RabbitMQConsumer()
    asyncio.run(consumer.consume_from_rabbitmq())
