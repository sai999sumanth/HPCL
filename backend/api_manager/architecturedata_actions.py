from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import json
import traceback
import pandas as pd
import polars as pl
import os
from collections import defaultdict
import utilities.connection_mapping as connection_mapping
from charts_actions import charts_connection_vault_routing
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams
from utilities.analog_data_mapping import Maintenance, Fault
# import urdhva_base.queryparams

router = fastapi.APIRouter(prefix='/architecturedata')

if urdhva_base.settings.environment == 'prod':
    base_path = "/opt/ceg/algo/prod/"
elif urdhva_base.settings.environment == 'uat':
    base_path = "/opt/ceg/algo/uat/"
else:
    base_path = "/opt/ceg/algo/things_board/device_data/"

# Action architecture_details
@router.post('/architecture_details', tags=['ArchitectureData'])
async def architecturedata_architecture_details(data: Architecturedata_Architecture_DetailsParams):
    try:
        # Setup connection
        # Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        # execute_query = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        charts_ins = Charts_Connection_Vault_RoutingParams(
            connection_id=connection_mapping.connection_mapping.get("hpcl_ceg", "1"),
            action='execute_query'
        )
        execute_query = await charts_connection_vault_routing(charts_ins)

        # Fetch TAS BU locations
        location_query = "SELECT bu, zone, sap_id, name FROM location_master WHERE bu = 'TAS'"
        location_df = await execute_query(query=location_query)
        location_df = pd.DataFrame(location_df)
        
        if location_df.empty:
            return {"status": False, "message": "No TAS locations found."}
        mfm_map = {}
        mfm_query = """SELECT sap_id, COUNT(DISTINCT mfm_number) AS mfm_count
            FROM host_mfm_factor
            WHERE bcu_number IS NOT NULL
            GROUP BY sap_id
            ORDER BY sap_id;"""
        mfm_df = await execute_query(query=mfm_query)
        mfm_df = pd.DataFrame(mfm_df)
        if not mfm_df.empty:
            mfm_map = dict(zip(mfm_df['sap_id'],mfm_df['mfm_count']))

        final_records = []

        device_type_mapping = {
            "Tank": [
                ("Primary Gauge Level", "Primary Level"),
                ("LEVEL SWITCH PROOF OK", "VFT"),
                ("RADAR HHH", "Radar"),
                ("ROSOV OPEN", "ROSOV"),
                ("MOV", "MOV"),
                ("RIMSEAL FIRE", "RIMSEAL")
            ],
            "OI": [
                ("Fire", "Fire Engine"),
                ("Jockey Pump Run", "Jockey Pump"),
                ("Pt", "PT"),
                ("PT", "PT")
            ],
            "ESD": [
                ("ESD MAINTENANCE", "ESD")
            ]
        }

        # Process each location
        for _, row in location_df.iterrows():
            sap_id = str(row['sap_id'])
            location_name = str(row['name'])
            zone = str(row['zone'])

            json_path = os.path.join(base_path, f"{sap_id}.json")
            if not os.path.exists(json_path):
                # print(f"Skipping {sap_id}: File not found.")
                continue

            try:
                with open(json_path, 'r') as file:
                    devices = json.load(file).get('data', [])
            except json.JSONDecodeError:
                print(f"Invalid JSON for {sap_id}.")
                continue

            location_counts = defaultdict(list)

            for device in devices:
                device_type = str(device.get('device_type', 'Unknown'))
                sensors = device.get('sensors', [])
                device_name = str(device.get('device_name', ''))
                if device_type in ['Tank', 'OI', 'ESD']:
                    # Tank/OI: Count based on sensors with valid tags
                    for sensor in sensors:
                        sensor_tag = str(sensor.get('sensor_tag', '')).strip()
                        if not sensor_tag:
                            continue  # Skip sensors without tags
                        sensor_name = str(sensor.get('sensor_name', '')).lower()
                        
                        # Special handling for OI "Pt/PT" at end of string
                        if device_type == 'OI':
                            for keyword, mapped_type in device_type_mapping[device_type]:
                                if keyword == 'Fire':
                                    if sensor_name.startswith(keyword.lower()):
                                        location_counts[mapped_type].append(device_name)
                                        break
                                elif keyword in ['Pt', 'PT']:
                                    if sensor_name.endswith(keyword.lower()):
                                        location_counts[mapped_type].append(device_name)
                                        break
                                elif keyword.lower() in sensor_name:
                                    location_counts[mapped_type].append(device_name)
                                    break
                        else:  # Tank devices
                            for keyword, mapped_type in device_type_mapping[device_type]:
                                if keyword.lower() in sensor_name:
                                    location_counts[mapped_type].append(device_name)
                                    break
                elif device_type in ['PLC']:
                    # Classify PLCs
                    if 'SFT PLC' in device_name.upper():
                        location_counts["Safety PLC"].append(device_name)
                    elif 'GEPLC' in device_name.upper():
                        location_counts["Process PLC"].append(device_name)
                else:
                    location_counts[device_type].append(device_name)

            # Track unique tanks associated with tank-related devices
            tank_devices = set()
            for dev_type, device_names in location_counts.items():
                # If this is a tank-related device type (from device_type_mapping["Tank"])
                if dev_type in ["Primary Level", "VFT", "Radar", "ROSOV", "MOV", "RIMSEAL"]:
                    for device_name in device_names:
                        # Extract the tank name from the device name
                        # Assuming tank name is before the '@' symbol in device_name
                        tank_name = device_name.split('@')[0] if '@' in device_name else device_name
                        tank_devices.add(tank_name)
            
            # Calculate total tank count
            total_tank_count = len(tank_devices)

            # Convert counts to final records
            for dev_type, device_names in location_counts.items():
                count = 0
                for device_name in device_names:
                    if dev_type == "Hooter" and device_name.split('@')[0].endswith("HOOTER_ACK"):
                        continue
                    if dev_type == "Pump" and any(kw in device_name.upper() for kw in ["BLUE DYE", "FO"]):
                        continue
                    count +=1
                if dev_type in ["Tank Maintenance","Fire Pump"]:
                    continue
                if dev_type == "Loading Point":
                    dev_type = "Gantry BCU" 

                if count > 0:
                    record = {
                        "sap_id": sap_id,
                        "name": location_name,
                        "zone": zone,
                        "device_type": dev_type,
                        "count": str(count)
                    }
                    
                    # Add total_tank_count field to tank-related devices
                    if dev_type in ["Primary Level", "VFT", "Radar", "ROSOV", "MOV", "RIMSEAL"]:
                        record["total_tank_count"] = total_tank_count
                    
                    final_records.append(record)
                    
            # Add MFM count if available
            if sap_id in mfm_map:
                final_records.append({
                    "sap_id": sap_id,
                    "name": location_name,
                    "zone": zone,
                    "device_type": "MFM",
                    "count": str(mfm_map[sap_id])
                })
        # Update database
        try:
            df = pl.DataFrame(final_records)
            # Step 2: Drop duplicates
            df = df.unique()
            # Step 3: Convert back to a list of dicts
            final_records = df.to_dicts()
            await ArchitectureData.bulk_update(final_records, upsert=True)
            print(f"Updated {len(final_records)} records.")
            return {"status": True, "message": "Data updated successfully."}
        except Exception as e:
            print(f"Database Error: {e}")
            return {"status": False, "message": f"Database Error: {str(e)}"}

    except Exception as e:
        print(traceback.format_exc())
        return {"status": False, "message": f"Error: {str(e)}"}
        

# Action architecture_data
@router.post('/architecture_data', tags=['ArchitectureData'])
async def architecturedata_architecture_data(data: Architecturedata_Architecture_DataParams):
    try:
        arch_result = await architecturedata_architecture_details(Architecturedata_Architecture_DetailsParams())
        if not arch_result.get('status'):
            return {"status": False, "message": "Failed to referesh the architecture data"}
                                                                
        limit = 10000
        skip = 0
        res = []

        # Fetch all data in chunks
        while True:
            resp = await ArchitectureData.get_all(
                urdhva_base.queryparams.QueryParams(
                    limit=limit, 
                    skip=skip, 
                    sort=json.dumps({'created_at': 'DESC'})
                ),
                resp_type='plain'
            )
            if not resp['data']:
                break
            res.extend(resp['data'])
            if len(resp['data']) < limit:
                break
            skip += limit  # Increase skip to fetch next batch

        # Convert to DataFrame if data exists
        if res:
            df = pd.DataFrame(res)  # Convert list of dictionaries to DataFrame
            
            # Convert 'count' to integer (handle any invalid data gracefully)
            df['count'] = pd.to_numeric(df['count'], errors='coerce').fillna(0).astype(int)
            # Select only required columns
            df = df[['sap_id', 'name', 'count', 'device_type', 'zone']]
 
            # Convert DataFrame to list of dictionaries
            return {"status": True, "message": "Success", "data": df.to_dict(orient='records')}

        return {"status": False, "message": "No data found"}

    except Exception as e:
        return {"status": False, "message": f"Error: {str(e)}"}
