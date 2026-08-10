import urdhva_base
import traceback
import hpcl_ceg_model
import pandas as pd
import polars as pl
import utilities.helpers as helpers
from utilities.analog_data_mapping import Maintenance, Fault
from datetime import datetime, timezone
import pytz


async def generate_sod_engineering_location_stats(sap_id):
#     status, location_data = await helpers.get_location_details('TAS', sap_id)
#     if not status:
#         return {"status": False, "data": "Invalid Location / Location not found"}

#     device_types = (
#         'MOV', 'HCD', 'Dyke', 'Hooter', 'Primary Level', 'Jockey Pump', 'VFT',
#         'PT', 'ROSOV', 'ESD', 'Pump', 'Radar', 'Fire Engine', 'Barrier Gate',
#         'Gantry BCU', 'MFM', 'RIMSEAL', 'Dyke Valve', 'OI Tags', 'LRC Switchover',
#         'PLC', 'Fire Effect', 'UPS', 'Gantry override', 'Power ESD', 'ESD Effect'
#     )

#     try:
#         query = f"sap_id = '{location_data['sap_id']}' and device_type in {device_types}"
#         params = urdhva_base.queryparams.QueryParams()
#         params.fields = []
#         params.q = query
#         res = await hpcl_ceg_model.ArchitectureData.get_all(params, resp_type="plain")
#         resp = res.get('data', '')

#         if not resp:
#             return {"status": False, "message": "No data found"}

#         global_interlock = set()  # Use a set to avoid duplicates
#         interlocks = []
#         maintenance_map = {}
#         fault_map = {}

#         # Build maintenance map and populate global_interlock
#         for maintenance_item in Maintenance:
#             equipment_names = maintenance_item.get("equipment_name", [])
#             if isinstance(equipment_names, str):
#                 equipment_names = [equipment_names]  # Ensure it's a list

#             for equip in equipment_names:
#                 equip = equip.strip().upper()
#                 # Avoid duplicates in global_interlock and interlocks
#                 if maintenance_item["alert_category"] == 'Safety':
#                     if maintenance_item["interlock_name"] not in global_interlock:
#                         global_interlock.add(maintenance_item["interlock_name"])
#                         interlocks.append(maintenance_item["interlock_name"])
#                         maintenance_map.setdefault(equip, set()).add(maintenance_item["interlock_name"])

#                 if maintenance_item["alert_category"] == 'Process':
#                     if maintenance_item["interlock_name"] not in global_interlock:
#                         global_interlock.add(maintenance_item["interlock_name"])
#                         interlocks.append(maintenance_item["interlock_name"])
#                         maintenance_map.setdefault(equip, set()).add(maintenance_item["interlock_name"])

#         # Build fault map and populate global_interlock
#         for fault_item in Fault:
#             equipment_names = fault_item.get("equipment_name", [])
#             if isinstance(equipment_names, str):
#                 equipment_names = [equipment_names]

#             for equip in equipment_names:
#                 equip = equip.strip().upper()
#                 if fault_item["alert_category"] == 'Safety':
#                     if fault_item["interlock_name"] not in global_interlock:
#                         global_interlock.add(fault_item["interlock_name"])
#                         interlocks.append(fault_item["interlock_name"])
#                         fault_map.setdefault(equip, set()).add(fault_item["interlock_name"])


#         df = pd.DataFrame(resp)
#         df["count"] = pd.to_numeric(df["count"], errors="coerce").fillna(0).astype(int)
#         grouped_df = df.groupby("device_type", as_index=False)["count"].sum()

#         # DEVICE_TYPE_MAPPING = {
#         #     "MOV": "MOV",
#         #     "HCD": "HCD",
#         #     "Dyke": "Dyke",
#         #     "Hooter": "Hooter",
#         #     "Primary Level": "Primary Radar",
#         #     "Jockey Pump": "Jockey Pump",
#         #     "VFT": "VFT",
#         #     "PT": "PT Hydrant",
#         #     "ROSOV": "Rosov",
#         #     "ESD": "ESD",
#         #     "Pump": "Pumps",
#         #     "Radar": "Secondary Radar",
#         #     "Fire Engine": "Fire Engine",
#         #     "Barrier Gate": "Barrier Gate",
#         #     "Gantry BCU": "Gantry BCU",
#         #     "MFM": "MFM"
#         # }
#         DEVICE_TYPE_MAPPING = {
#             "MOV": "MOV",
#             "RIMSEAL": "RIMSEAL",
#             "Dyke Valve": "Dyke Valve",
#             "HCD": "HCD",
#             "DYKE": "Dyke",
#             "HOOTER": "Hooter",
#             "PRIMARY LEVEL": "Primary Radar",
#             "LRC SWITCHOVER": "LRC Switchover",
#             "PLC": "PLC",
#             "JOCKEY PUMP": "Jockey Pump",
#             "FIRE EFFECT": "Fire Effect",
#             "UPS": "UPS",
#             "GANTRY OVERRIDE": "Gantry override",
#             "VFT": "VFT",
#             "PT": "PT Hydrant",
#             "ROSOV": "Rosov",
#             "ESD": "ESD",
#             "PUMP": "Pumps",
#             "OI TAGS": "OI Tags",
#             "RADAR": "Secondary Radar",
#             "FIRE ENGINE": "Fire Engine",
#             "ESD Effect": "ESD Effect",
#             "BARRIER GATE": "Barrier Gate",
#             "POWER ESD": "Power ESD",
#             "GANTRY BCU": "Gantry BCU",
#             "MFM": "MFM",
#             "AIR COMPRESSOR": "Air Compressor"
#         } 

#         query = f"sap_id = '{sap_id}' and active_server_name in ('LRCA', 'LRCB')"
#         params = urdhva_base.queryparams.QueryParams()
#         params.limit = 1
#         params.q = query
#         params.sort = {"created_at": "desc"}
#         resp = await hpcl_ceg_model.MasterStatus.get_all(params, resp_type="plain")

#         hardcoded_status = [
#             {"id": "lrca", "name": "LRCA", "status": "standby"},
#             {"id": "lrcb", "name": "LRCB", "status": "online"},
#             {"id": "safety_plc_a", "name": "PLC A", "status": "online"},
#             {"id": "safety_plc_b", "name": "PLC B", "status": "standby"},
#             {"id": "process_plc_a", "name": "PLC A", "status": "online"},
#             {"id": "process_plc_b", "name": "PLC B", "status": "standby"},
#         ]

#         if resp.get("data"):
#             df = pl.DataFrame(resp["data"]).select(["active_server_name", "status"])
#             master_record = df.filter(pl.col("status").cast(pl.Int32) == 1).select("active_server_name")

#             if master_record.height > 0:
#                 master_id = master_record[0, "active_server_name"].lower()
#                 for server in hardcoded_status:
#                     if server["id"] in ["lrca", "lrcb"]:
#                         server["status"] = "master" if server["id"] == master_id else "slave"

#         result_dict = {item["id"]: item for item in hardcoded_status}

#         for _, row in grouped_df.iterrows():
#             device_name = row["device_type"].strip().upper()
#             total = row["count"]

#             mapped_name = DEVICE_TYPE_MAPPING.get(device_name, device_name)
#             device_id = mapped_name.lower().replace(" ", "_")
#             maintenance_interlocks = maintenance_map.get(device_name, set())
#             fault_interlocks = fault_map.get(device_name, set())

#             total_maintenance_count = await get_alert_count_for_interlock_set(maintenance_interlocks, mapped_name, sap_id)
#             total_fault_count = await get_alert_count_for_interlock_set(fault_interlocks, mapped_name, sap_id)

#             result_dict[device_id] = {
#                 "id": device_id,
#                 "name": mapped_name,
#                 "status": None,
#                 "total": total,
#                 "faulty": total_fault_count,
#                 "maintanance": total_maintenance_count
#             }

#         result = list(result_dict.values())
#         return {"status": True, "message": "Success", "data": result}

#     except Exception as e:
#         print(traceback.format_exc())
#         return {"status": False, "message": f"Error: {str(e)}", "data": []}


# async def get_alert_count_for_interlock_set(interlocks, equipment, sap_id):
#     if not interlocks or not equipment:
#         return 0

#     interlock_filter = ",".join(f"'{i}'" for i in interlocks)
#     query = f"""
#         sap_id = '{sap_id}'
#         AND interlock_name IN ({interlock_filter}) 
#         AND alert_status = 'Open'
#     """
#     params = urdhva_base.queryparams.QueryParams()
#     params.q = query
#     params.fields = ['device_name']
#     print("query --> ", query)
#     result = await hpcl_ceg_model.Alerts.get_all(params, resp_type="plain")
#     if not result.get("data"):
#         return 0

#     #Return number of distinct devices affected
#     return len({entry['device_name'] for entry in result['data'] if 'device_name' in entry})

    status, location_data = await helpers.get_location_details('TAS', sap_id)
    if not status:
        return {"status": False, "data": "Invalid Location / Location not found"}

    device_types = (
        'MOV', 'HCD', 'Dyke', 'Hooter', 'Primary Level', 'Jockey Pump', 'VFT',
        'PT', 'ROSOV', 'ESD', 'Pump', 'Radar', 'Fire Engine', 'Barrier Gate',
        'Gantry BCU', 'MFM', 'RIMSEAL', 'Dyke Valve', 'OI Tags', 'LRC Switchover',
        'Process PLC', 'Safety PLC', 'UPS', 'Power ESD', 'ESD Effect',
    )

    try:
        query = f"sap_id = '{location_data['sap_id']}' and device_type in {device_types}"
        params = urdhva_base.queryparams.QueryParams()
        params.fields = []
        params.q = query
        res = await hpcl_ceg_model.ArchitectureData.get_all(params, resp_type="plain")
        resp = res.get('data', '')

        if not resp:
            return {"status": False, "message": "No data found"}

        global_interlock = set()
        interlocks = []
        maintenance_map = {}
        fault_map = {}

        for maintenance_item in Maintenance:
            equipment_names = maintenance_item.get("equipment_name", [])
            if isinstance(equipment_names, str):
                equipment_names = [equipment_names]
            for equip in equipment_names:
                equip = equip.strip().upper()
                if maintenance_item["alert_category"] in ('Safety', 'Process'):
                    if maintenance_item["interlock_name"] not in global_interlock:
                        global_interlock.add(maintenance_item["interlock_name"])
                        interlocks.append(maintenance_item["interlock_name"])
                        maintenance_map.setdefault(equip, set()).add(maintenance_item["interlock_name"])

        for fault_item in Fault:
            equipment_names = fault_item.get("equipment_name", [])
            if isinstance(equipment_names, str):
                equipment_names = [equipment_names]
            for equip in equipment_names:
                equip = equip.strip().upper()
                if fault_item["alert_category"] == 'Safety':
                    if fault_item["interlock_name"] not in global_interlock:
                        global_interlock.add(fault_item["interlock_name"])
                        interlocks.append(fault_item["interlock_name"])
                        fault_map.setdefault(equip, set()).add(fault_item["interlock_name"])

        df = pd.DataFrame(resp)
        df["count"] = pd.to_numeric(df["count"], errors="coerce").fillna(0).astype(int)
        grouped_df = df.groupby("device_type", as_index=False)["count"].sum()

        DEVICE_TYPE_MAPPING = {
            "MOV": "MOV", "RIMSEAL": "RIMSEAL", "Dyke Valve": "Dyke Valve",
            "HCD": "HCD", "DYKE": "Dyke", "HOOTER": "Hooter", "PRIMARY LEVEL": "Primary Radar",
            "LRC": "LRC", "PROCESS PLC": "Process PLC","SAFETY PLC":"Safety PLC", "JOCKEY PUMP": "Jockey Pump", "UPS": "UPS",
            "VFT": "VFT", "PT": "PT Hydrant", "ROSOV": "Rosov", "ESD": "ESD", "PUMP": "Pumps",
            "OI TAGS": "OI Tags", "RADAR": "Secondary Radar", "FIRE ENGINE": "Fire Engine",
            "ESD EFFECT": "ESD Effect", "BARRIER GATE": "Barrier Gate", "POWER ESD": "Power ESD",
            "GANTRY BCU": "Gantry BCU", "MFM": "MFM", "AIR COMPRESSOR": "Air Compressor"
        }

        query = f"sap_id = '{sap_id}'"
        params = urdhva_base.queryparams.QueryParams()
        params.limit = 1
        params.q = query
        params.sort = {"created_at": "desc"}
        resp = await hpcl_ceg_model.MasterStatus.get_all(params, resp_type="plain")

        hardcoded_status = [
            {"id": "lrca", "name": "LRCA", "status": "slave"},
            {"id": "lrcb", "name": "LRCB", "status": "slave"}
        ]
        
        LRC_NAME_MAP = {
            "lrca": "lrca", "lrc1": "lrca",
            "lrcb": "lrcb", "lrc2": "lrcb"
        }
        if resp.get("data"):
            df = pl.DataFrame(resp["data"]).select(["active_server_name", "status"])
            master_record = df.filter(pl.col("status").cast(pl.Int32) == 1).select("active_server_name")
            if master_record.height > 0:
                raw_id = master_record[0, "active_server_name"].lower()
                master_id = LRC_NAME_MAP.get(raw_id, raw_id) 
                for server in hardcoded_status:
                    server["status"] = "master" if server["id"] == master_id else "slave"

        result_dict = {item["id"]: item for item in hardcoded_status}

        for _, row in grouped_df.iterrows():
            device_name = row["device_type"].strip().upper()
            total = row["count"]
            mapped_name = DEVICE_TYPE_MAPPING.get(device_name, device_name)
            device_id = mapped_name.lower().replace(" ", "_")
            maintenance_interlocks = maintenance_map.get(device_name, set())
            fault_interlocks = fault_map.get(device_name, set())

            maintenance_device_names, total_maintenance_count = await get_alert_count_for_interlock_set(maintenance_interlocks, mapped_name, sap_id)
            fault_device_names, total_fault_count = await get_alert_count_for_interlock_set(fault_interlocks, mapped_name, sap_id)

            result_dict[device_id] = {
                "id": device_id,
                "name": mapped_name,
                "status": None,
                "total": total,
                "faulty": total_fault_count,
                "faulty_device_names": fault_device_names,
                "maintanance": total_maintenance_count,
                "maintenance_device_names": maintenance_device_names
            }

        # Handle PLC status from helper
        plc_status_data = await helpers.check_plc_status()
        matching_plcs = [entry for entry in plc_status_data if entry["sap_id"] == str(sap_id)]

        def classify_plc(device_name):
            name_upper = device_name.upper()
            if name_upper.startswith("SFT PLC"):
                return "safety"
            elif name_upper.startswith("GEPLC"):
                return "process"
            return None

        plc_status_dict = {
            "safety_plc_a": {"id": "safety_plc_a", "name": "PLC A", "status": "slave"},
            "safety_plc_b": {"id": "safety_plc_b", "name": "PLC B", "status": "slave"},
            "process_plc_a": {"id": "process_plc_a", "name": "PLC A", "status": "slave"},
            "process_plc_b": {"id": "process_plc_b", "name": "PLC B", "status": "slave"},
        }

        for plc in matching_plcs:
            plc_type = classify_plc(plc["device_name"])
            if plc_type:
                a_key = f"{plc_type}_plc_a"
                b_key = f"{plc_type}_plc_b"
                if plc_status_dict[a_key]["status"] != "master" and plc["plc_a_status"] in ("master", "slave"):
                    plc_status_dict[a_key]["status"] = plc["plc_a_status"]
                if plc_status_dict[b_key]["status"] != "master" and plc["plc_b_status"] in ("master", "slave"):
                    plc_status_dict[b_key]["status"] = plc["plc_b_status"]

        result_dict.update(plc_status_dict)

        return {"status": True, "message": "Success", "data": list(result_dict.values())}

    except Exception as e:
        print(traceback.format_exc())
        return {"status": False, "message": f"Error: {str(e)}", "data": []}


async def get_alert_count_for_interlock_set(interlocks, equipment, sap_id):
    if not interlocks or not equipment:
        return {},0

    interlock_filter = ",".join(f"'{i}'" for i in interlocks)
    query = f"""
        sap_id = '{sap_id}'
        AND interlock_name IN ({interlock_filter}) 
        AND alert_status = 'Open'
    """
    params = urdhva_base.queryparams.QueryParams()
    params.q = query
    params.fields = ['device_name', 'created_at']
    result = await hpcl_ceg_model.Alerts.get_all(params, resp_type="plain")
    if not result.get("data"):
        return {},0

    ist = pytz.timezone('Asia/Kolkata')

    device_dict = {}
    for entry in result['data']:
        if "device_name" in entry and "created_at" in entry:
            device_name = entry['device_name'].split("@")[0]
            raw_time = entry["created_at"]
            
            if isinstance(raw_time, str):
                 dt = datetime.fromisoformat(raw_time.replace("Z", "+00:00"))
            else:
                  dt = raw_time
                  
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            created_at_ist = dt.astimezone(ist).strftime("%Y-%m-%d %H:%M:%S")
            
            device_dict[device_name] = created_at_ist
        
    
    return device_dict, len(device_dict)

async def get_filtered_location_data(bu, location_onboard, specific_zone=None, specific_sap_id=None):
    """
    This function is used to get the filtered location data based on the location onboard flag, specific zone and specific sap_id.
    
    Parameters:
    bu (str): The business unit identifier.
    location_onboard (bool): The location onboard flag.
    specific_zone (str): The specific zone to filter by.
    specific_sap_id (str): The specific sap_id to filter by.
    
    Returns:
    dict: A dictionary containing the filtered zone and sap_id lists.
    """
    query = f"bu = '{bu}' and location_onboard = '{location_onboard}'"
    params = urdhva_base.queryparams.QueryParams(q=query)
    resp = await hpcl_ceg_model.LocationMaster.get_all(params, resp_type='plain')

    if not resp.get("data"):
        return {"status": False, "message": "No Data found", "data": []}

    data = resp.get("data", '')
    # Now create zone and sap_id lists
    zone_list = []
    sap_id_list = []

    for item in data:
        zone = item.get("zone")
        sap_id = item.get("sap_id")
        name = item.get("name", "")

        # If specific_zone is provided, only collect sap_ids for that zone
        if specific_zone and zone == specific_zone:
            zone_list.append({"id": zone, "name": zone})
            sap_id_list.append({"id": sap_id, "name": name})

        # If specific_sap_id is provided, only collect zones for that sap_id
        elif specific_sap_id and sap_id == specific_sap_id:
            zone_list.append({"id": zone, "name": zone})
            sap_id_list.append({"id": sap_id, "name": name})

        # If no specific filters, collect all data
        elif not specific_zone and not specific_sap_id:
            zone_list.append({"id": zone, "name": zone})
            sap_id_list.append({"id": sap_id, "name": name})

    # Remove duplicates
    zone_list = [dict(t) for t in {tuple(d.items()) for d in zone_list}]
    sap_id_list = [dict(t) for t in {tuple(d.items()) for d in sap_id_list}]

    return {
        "status": True,
        "message": "Success",
        "data": {
            "zone": zone_list,
            "sap_id": sap_id_list
        }
    }
