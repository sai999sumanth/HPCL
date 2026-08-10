import os
import asyncio
import datetime
import random
import json
import pandas as pd
import pika
from typing import Dict, List, Any
from rabbitmq_producer import RabbitMQProducer

# Function to track changes in the records
# Function to track changes in the records
def track_changes(df: pd.DataFrame, table_name: str) -> List[Dict[str, Any]]:
    """
    Track changes in the dataframe for a specific table.
    For now, it just returns all records.
    Modify this function based on your change-tracking logic.
    """
    return df.to_dict(orient="records")

# Modify file processors to return changed records
async def host_unauthorized(file_name):
    col = ["BAY_NUMBER", "BCU_NUMBER", "METER_NUMBER", "TIMESTAMP", "START_TOTALIZER", "END_TOTALIZER", "NET_TOTALIZER", "sap_id", "date", "date_time"]
    df = pd.read_csv(file_name, header=None, names=col)
    df = df.drop_duplicates()
    df = df.drop_duplicates(subset=["BAY_NUMBER", "BCU_NUMBER", "METER_NUMBER", "START_TOTALIZER", "END_TOTALIZER", "NET_TOTALIZER"])
    df['sap_id'] = '1128'
    df['date'] = df['TIMESTAMP'].apply(lambda x: datetime.datetime.strptime(x, "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d"))
    df['date_time'] = df['TIMESTAMP'].apply(
        lambda x: datetime.datetime.strptime(x, "%Y-%m-%d %H:%M:%S").isoformat())
    
    # Track changes
    changed_records = track_changes(df, "HOST_UNAUTHORIZEDFLOW")
    return changed_records

async def host_overloadedtts(file_name):
    col = ["LOAD_NUMBER", "TRUCK_NUMBER", "COMPARTMENT_NUMBER", "PRODUCT_NAME", "REQUIRED_QTY", "LOADED_QTY", "TIMESTAMP", "sap_id", "date", "date_time"]
    df = pd.read_csv(file_name, header=None, names=col)
    df = df.drop_duplicates()
    df['sap_id'] = '1128'
    if 'TIMESTAMP' in df.columns and not df['TIMESTAMP'].isna().all():
        df['date'] = df['TIMESTAMP'].apply(
            lambda x: datetime.datetime.strptime(x, "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d"))
        df['date_time'] = df['TIMESTAMP'].apply(
            lambda x: datetime.datetime.strptime(x, "%Y-%m-%d %H:%M:%S").isoformat())
    
    # Track changes
    changed_records = track_changes(df, "HOST_OVERLOADEDTTS")
    return changed_records

async def host_mfmkfactor(file_name):
    col = ["MFM_NUMBER", "ASSOCIATED_DEVICE_NUMBER", "STOCK_CODE", "CURRENT_K_FACTOR", "LAST_K_FACTOR",
           "LAST_K_FACTOR_CHANGE_DATE", "CURRENT_METER_FACTOR", "LAST_METER_FACTOR",
           "LAST_METER_FACTOR_CHANGE_DATE", "sap_id", "date", "date_time"]
    df = pd.read_csv(file_name, header=None, names=col)
    df = df.drop_duplicates()
    df['sap_id'] = '1128'
    
    # Track changes
    changed_records = track_changes(df, "HOST_MFMKFACTOR")
    return changed_records

async def host_manual_fan_printed(file_name):
    col = ["MANUAL_FAN_COUNT", "AUTO_FAN_COUNT", "TOTAL_COUNT", "sap_id", "date", "date_time"]
    df = pd.read_csv(file_name, header=None, names=col)
    df = df.drop_duplicates()
    df['sap_id'] = '1128'
    
    # Track changes
    changed_records = track_changes(df, "HOST_MANUALFANPRINTED")
    return changed_records

async def host_local_loadedtts(file_name):
    col = ["SR_NUMBER", "BAY_NUMBER", "BCU_NUMBER", "RECIPE_NAME", "TRUCK_NUMBER", "CARD_NUMBER", 
           "START_TOTALIZER", "END_TOTALIZER", "LOADED_QTY", "TRANSACTION_END_TIME", "sap_id", "date", "date_time"]
    df = pd.read_csv(file_name, header=None, names=col)
    df = df.drop_duplicates()
    df['sap_id'] = '1128'
    if 'TRANSACTION_END_TIME' in df.columns and not df['TRANSACTION_END_TIME'].isna().all():
        df['date'] = df['TRANSACTION_END_TIME'].apply(
            lambda x: datetime.datetime.strptime(x, "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d"))
        df['date_time'] = df['TRANSACTION_END_TIME'].apply(
            lambda x: datetime.datetime.strptime(x, "%Y-%m-%d %H:%M:%S").isoformat())
    
    # Track changes
    changed_records = track_changes(df, "HOST_LOCALLOADEDTTS")
    return changed_records

# # async def host_kfactor_changes(file_name):
# #     col = ["DEVICE_NUMBER", "STOCK_CODE", "OLD_K_FACTOR", "NEW_K_FACTOR", "CHANGE_DATE", "CHANGED_BY", 
# #            "sap_id", "date", "date_time"]
# #     df = pd.read_csv(file_name, header=None, names=col)
# #     df = df.drop_duplicates()
# #     df['sap_id'] = '1128'
# #     if 'CHANGE_DATE' in df.columns and not df['CHANGE_DATE'].isna().all():
# #         df['date'] = df['CHANGE_DATE'].apply(
# #             lambda x: datetime.datetime.strptime(x, "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d"))
# #         df['date_time'] = df['CHANGE_DATE'].apply(
# #             lambda x: datetime.datetime.strptime(x, "%Y-%m-%d %H:%M:%S").isoformat())
    
#     # Track changes
#     changed_records = track_changes(df, "HOST_KFACTORCHANGES")
#     return changed_records

async def host_cancelled_tts(file_name):
    col = ["LOAD_NUMBER", "TRUCK_NUMBER", "CREATED_DATE", "CUSTOMER_NAME", "COMPARTMENT_NUMBER", "PRODUCT_NAME", 
           "REQUIRED_QTY", "CANCELLED_BY", "CANCELLED_DATE", "sap_id", "date", "date_time"]
    df = pd.read_csv(file_name, header=None, names=col)
    df = df.drop_duplicates()
    print("df --> ", df.columns)
    print("df --> ", df)
    df['sap_id'] = '1128'
    if 'CANCELLED_DATE' in df.columns and not df['CANCELLED_DATE'].isna().all():
        df['date'] = df['CANCELLED_DATE'].apply(
            lambda x: datetime.datetime.strptime(x, "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d"))
        df['date_time'] = df['CANCELLED_DATE'].apply(
            lambda x: datetime.datetime.strptime(x, "%Y-%m-%d %H:%M:%S").isoformat())
    
    # Track changes
    changed_records = track_changes(df, "HOST_CANCELLEDTTS")
    return changed_records

async def host_bay_reassignment(file_name):
    col = ["CREATED_DATE", "LOAD_NUMBER", "FAN_NUMBER", "TRUCK_NUMBER", "CUSTOMER_NAME", 
           "COMPARTMENT_NUMBER", "PRODUCT_NAME", "REQUIRED_QTY", "ASSIGNED_BAY", "LOADED_QTY", 
           "REASSIGNED_BAY", "REASSIGN_LOADED_QTY", "BAY_REASSIGNMENT_TIME", "REMARKS", 
           "sap_id", "date", "date_time"]
    df = pd.read_csv(file_name, header=None, names=col)
    df = df.drop_duplicates()
    df['sap_id'] = '1128'
    if 'BAY_REASSIGNMENT_TIME' in df.columns and not df['BAY_REASSIGNMENT_TIME'].isna().all():
        df['date'] = df['BAY_REASSIGNMENT_TIME'].apply(
            lambda x: datetime.datetime.strptime(x, "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d"))
        df['date_time'] = df['BAY_REASSIGNMENT_TIME'].apply(
            lambda x: datetime.datetime.strptime(x, "%Y-%m-%d %H:%M:%S").isoformat())
    
    # Track changes
    changed_records = track_changes(df, "HOST_BAYREASSIGNMENT")
    return changed_records

def add_random_created_at(data_dict: Dict[str, List[Dict[str, Any]]]) -> Dict[str, List[Dict[str, Any]]]:
    """Add random created_at dates to the records."""
    today = datetime.datetime.now()
    for key, records in data_dict.items():
        if len(records) > 38:
            records = records[:38]
            data_dict[key] = records
            
        for record in records:
            days_ago = random.randint(0, 30)
            hours = random.randint(0, 23)
            minutes = random.randint(0, 59)
            seconds = random.randint(0, 59)
            
            created_at = today - datetime.timedelta(days=days_ago, 
                                                   hours=hours, 
                                                   minutes=minutes, 
                                                   seconds=seconds)
            
            record['created_at'] = created_at.strftime("%Y-%m-%d %H:%M:%S")
    
    return data_dict
    
async def process_all_files(directory):
    """Process all CSV files in the given directory and only return changed records."""
    changed_data = {}  # To store only changed records per table

    file_processors = {
        "HOST_UNAUTHORIZEDFLOW.csv": host_unauthorized,
        "HOST_OVERLOADEDTTS.csv": host_overloadedtts,
        "HOST_MFMKFACTOR.csv": host_mfmkfactor,
        "HOST_MANUALFANPRINTED.csv": host_manual_fan_printed,
        "HOST_LOCALLOADEDTTS.csv": host_local_loadedtts,
        # "HOST_KFACTORCHANGES.csv": host_kfactor_changes,
        "HOST_CANCELLEDTTS.csv": host_cancelled_tts,
        "HOST_BAYREASSIGNMENT.csv": host_bay_reassignment
    }
    
    for filename, processor in file_processors.items():
        filepath = os.path.join(directory, filename)
        if os.path.exists(filepath):
            try:
                changed_records = await processor(filepath)
                if changed_records:
                    table_name = filename.split(".")[0]
                    changed_data[table_name] = changed_records
                print(f"Successfully processed {filename}")
            except Exception as e:
                print(f"Error processing {filename}: {e}")
        else:
            print(f"File not found: {filepath}")
    
    # Add random 'created_at' timestamp to all records
    changed_data = add_random_created_at(changed_data)
    
    return changed_data


async def main():
    changed_data = await process_all_files("/Users/mac_1/Downloads/ANALOG_DATA")
    if changed_data:
        RabbitMQProducer().send_to_rabbitmq(changed_data)
    print(f"Processed and sent {len(changed_data)} tables with changes to RabbitMQ.")

if __name__ == "__main__":
    asyncio.run(main())
