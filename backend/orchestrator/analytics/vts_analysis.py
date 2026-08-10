import urdhva_base
import pandas as pd
import typing
import json
import httpx
import aiohttp
import asyncio
import requests
import datetime
import pytz
import numpy as np
import polars as pl
import hpcl_ceg_model
import hpcl_ceg_enum
import charts_actions
import traceback
from datetime import time
import dashboard_studio_model
from collections import Counter
from geopy.distance import geodesic
import utilities.helpers as helpers
import utilities.vts_mapping as vts_mapping
import utilities.interlock_mapping as interlock_mapping
import orchestrator.alerting.alert_helper as alert_helper
import utilities.connection_mapping as connection_mapping
import utilities.vts_instance_mapping as vts_instance_mapping
from orchestrator.workflow.workflow_process import Camunda
import orchestrator.analytics.va_analysis as va_analysis
import orchestrator.alerting.alert_manager as alert_manager
import orchestrator.alerting.alert_factory as alert_factory
import orchestrator.dbconnector.credential_loader as credential_loader
import utilities.role_configuration as vts_role_mapping
import cache_gateway.cache_api_actions as cache_api_actions

logger = urdhva_base.logger.Logger.getInstance('vts_alert_log')

default_headers = {"Content-Type": "application/json"}

POLARS_OPERATOR_MAP = {
    ">": "gt",
    ">=": "ge",
    "<": "lt",
    "<=": "le",
    "=": "eq",
    "==": "eq",
    "!=": "ne"
}

async def get_creds(db_name: str):
    creds = credential_loader.get_credentials(db_name)
    return creds

async def is_vts_enabled(truck_no: str) -> bool:
    """

    Args:
        truck_no: "TN01SS1234"

    Returns:

    """
    creds = await get_creds("VTS")
    url = f"http://{creds['host']}:{creds['port']}/api/TTDetails/VTSEnabled"
    session = requests.Session()
    session.auth = (creds['user'], creds['password'])
    try:
        response = session.post(url, params={"TT_No": truck_no}, headers=default_headers)
        if response.status_code // 100 == 2:
            return response.json()
        return response.json()
    finally:
        session.close()

async def get_tt_current_location(truck_no: str) -> typing.Dict[typing.Any, typing.Any]:
    """

    Args:
        truck_no: "TN01SS1234"

    Returns:

    """
    creds = credential_loader.get_credentials("VTS")
    url = f"http://{creds['host']}:{creds['port']}/api/TTDetails/VTSCurrentLocation"
    session = requests.Session()
    session.auth = (creds['user'], creds['password'])
    try:
        response = session.post(url, params={"TT_No": truck_no}, headers=default_headers)
        if response.status_code // 100 == 2:
            return response.json()
        return response.json()
    finally:
        session.close()

async def get_trucks_available_in_terminal(terminal_plant_id: str) -> typing.List[typing.Any]:
    """

    Args:
        terminal_plant_id: "1234"

    Returns:

    """
    creds = credential_loader.get_credentials("VTS")
    url = f"http://{creds['host']}:{creds['port']}/api/TTDetails/TT_Inside_Depot"
    session = requests.Session()
    session.auth = (creds['user'], creds['password'])
    try:
        response = session.post(url, params={"DEPOT_ERP_CODE": terminal_plant_id}, headers=default_headers)
        if response.status_code // 100 == 2:
            return response.json()
        return response.json()
    finally:
        session.close()

async def get_trucks_returning_to_terminal() -> typing.List[typing.Any]:
    """

    Returns:

    """
    creds = credential_loader.get_credentials("VTS")
    url = f"http://{creds['host']}:{creds['port']}/api/TTDetails/TT_Approching_Depot"
    session = requests.Session()
    session.auth = (creds['user'], creds['password'])
    try:
        response = session.post(url, params={}, headers=default_headers)
        if response.status_code // 100 == 2:
            return response.json()
        return response.json()
    finally:
        session.close()

async def get_all_blocked_tt() -> typing.List[typing.Any]:
    """

    Returns:

    """
    creds = credential_loader.get_credentials("VTS")
    url = f"http://{creds['host']}:{creds['port']}/api/TTDetails/TT_Blocked_List"
    session = requests.Session()
    session.auth = (creds['user'], creds['password'])
    try:
        response = session.get(url, params={}, headers=default_headers)
        if response.status_code // 100 == 2:
            return response.json()
        return response.json()
    finally:
        session.close()

async def get_today_blocked_tt() -> typing.List[typing.Any]:
    """

    Returns:

    """
    creds = credential_loader.get_credentials("VTS")
    url = f"http://{creds['host']}:{creds['port']}/api/TTDetails/TT_Blocked_Today"
    session = requests.Session()
    session.auth = (creds['user'], creds['password'])
    try:
        response = session.get(url, params={}, headers=default_headers)
        if response.status_code // 100 == 2:
            return response.json()
        return response.json()
    finally:
        session.close()

async def get_today_unblocked_tt() -> typing.List[typing.Any]:
    """

    Returns:

    """
    creds = credential_loader.get_credentials("VTS")
    url = f"http://{creds['host']}:{creds['port']}/api/TTDetails/TT_UnBlocked_Today"
    session = requests.Session()
    session.auth = (creds['user'], creds['password'])
    try:
        response = session.get(url, params={}, headers=default_headers)
        if response.status_code // 100 == 2:
            return response.json()
        return response.json()
    finally:
        session.close()

async def post_unblocked_tt(input_data: dict) -> typing.List[typing.Any]:
    """

    Args:
        input_data: {
            "TT_No": "",
            "UnBlockedBy": "",
            "UnBlockedDateTime": "",
            "UnBlockedRemarks": "",
            "ApprovedBy": "",
            "ApprovedDateTime": "",
            "ApprovedRemarks": "",
            "BlockStartDate": "",
            "BlockEndDate": "",
            "WaivedOff": 0/1, # 0 to false (when tt accept violation), 1 - true to go one level instance back if tt provides violation is wrong
            "AlertID": "",
            "DocLink": {
                "DocPaths": ["https://example.com/doc1.pdf"]
            }
        }

    Returns:

    """
    creds = credential_loader.get_credentials("VTS")
    url = f"http://{creds['host']}:{creds['port']}/api/TTDetails/TT_UnBlocked"
    session = requests.Session()
    session.auth = (creds['user'], creds['password'])
    try:
        response = session.post(url, json=input_data, headers=default_headers)
        if response.status_code // 100 == 2:
            return response.json()
        return response.json()
    finally:
        session.close()

async def post_blocked_tt(input_data: dict) -> typing.List[typing.Any]:
    """

    Args:
        input_data: {
            "TT_No": <String>,
            "BlockStartDate": <String>,
            "BlockEndDate": <String>,
            "BlockedRemarks": <String>
        }

    Returns:

    """
    creds = credential_loader.get_credentials("VTS")
    url = f"http://{creds['host']}:{creds['port']}/api/TTDetails/TT_Blocked"
    session = requests.Session()
    session.auth = (creds['user'], creds['password'])
    try:
        response = session.post(url, json=input_data, headers=default_headers)
        if response.status_code // 100 == 2:
            return response.json()
        return response.json()
    finally:
        session.close()

async def post_blocked_tt_ims(input_data: typing.List[typing.Dict[str, typing.Any]]) -> typing.List[typing.Any]:
    """
    Args:
        input_data: List of dicts, e.g.:
        [
            {
               "transactNo" : "1234567899",
               "truckRegNo" : "KA01AJ4588",
               "blockingFlag" : "Y",
               "blockingFrom" : "20231225",
               "blockingTo" : "20240112"
            }
        ]

    Returns:
        The response JSON parsed as a list. If the response is a single dict,
        it is wrapped in a list.
    """
    url = urdhva_base.settings.post_to_ims_url
    session = requests.Session()
    ims_response = None
    error_msg = None
    max_retries = 3
    try:
        for attempt in range(1, max_retries + 1):
            try:
                logger.info(f"IMS Post Attempt {attempt}/{max_retries}")
                response = session.post(url, json=input_data, headers=default_headers)
                if response.status_code // 100 == 2:
                    logger.info(f"Data successfully posted to IMS {response.json()}")
                    ims_response = response.json()
                    return ims_response, error_msg
                error_msg = f"IMS responded with {response.status_code}: {response.text}"
                logger.error(f"IMS responded with {response.status_code}. Response: {response.text}")
            except requests.exceptions.RequestException as e:
                error_msg = f"IMS Post failed {str(e)}"
                logger.error(f"IMS Post failed (Attempt {attempt}/{max_retries}): {e}")
            # retry delay
            if attempt < max_retries:
                logger.info(f"Retrying in 10 seconds...")
                await asyncio.sleep(10)
        # after max retries
        logger.error(f"IMS post failed after 3 attempts for data: {input_data}")
        return ims_response, error_msg
    finally:
        session.close()

async def get_distance_of_truck(start_lat: float, start_lon: float, end_lat: float, end_lon: float):
    # Note: this is straight line route for actual need to use OSRM, google maps
    start_coords = (start_lat, start_lon)
    end_coords = (end_lat, end_lon)
    distance_km = geodesic(start_coords, end_coords).kilometers
    return round(distance_km, 2)

async def create_vts_alert(alert_data: dict):
    # entry['vendor_alert_id'] = entry.pop("alert_id")
    alert_data['device_name'] = alert_data.get('vehicle_blocked_instance_no', '').strip()
    alert_data['device_id'] = alert_data.get('vehicle_blocked_instance_no', '').strip()
    alert_data['alert_type'] = "VTS"
    alert_data['vehicle_number'] = alert_data.pop('tt_no')
    alert_data['violation_type'] = alert_data.pop('vehicle_blocked_instance_type')
    alert_data['sap_id'] = alert_data.pop('location_id')
    alert_data['bu'] = str(alert_data.pop('location_type'))

    cls = alert_factory.AlertFactory()
    return await cls.create_alert(alert_data, urdhva_base.settings.camunda_url)

async def update_alert_id_to_vts_history(alert_id: str, vts_alert_id: list[str]):
    if vts_alert_id:
        if not isinstance(vts_alert_id, list):
            vts_alert_id = [vts_alert_id]

        vts_alert_id = "', '".join(vts_alert_id)
        #query = (f"""update violation_history_vts set alert_id='{alert_id}' """
        #         f"""where id in ('{vts_alert_id}')""")
        #await hpcl_ceg_model.ViolationHistoryVts.update_by_query(query)
        
        query = (f"""update vts_alert_history set alert_id='{alert_id}' """
                 f"""where id in ('{vts_alert_id}')""")
        await hpcl_ceg_model.VtsAlertHistory.update_by_query(query)

async def insert_violation_count(file_name):
    df = pd.read_excel(file_name, header=4)
    df1 = pd.read_excel(file_name, sheet_name="Trip Deatils", header=4)

    df = df[[
        "TT Number", "Device Removed Loaded Trip", "Route Deviation Loaded Trip",
        "Speed Violation Loaded Trip", "Stoppage Violation Loaded Trip",
        "Power Disconnected Loaded Trip", "Night Driving Loaded Trip",
        "Route Deviation  & Stoppage Loaded Trip"
    ]]

    df1 = df1[["TT Number", "Actual Trip Start Location"]]
    df1 = df1.drop_duplicates()
    df = pd.merge(
        df, df1, on=["TT Number"], how='left'
    )

    print(df[df['_merge'] != 'both'])

    df = df.to_dict(orient="records")
    for record in df:
        ...

async def get_vts_violation(entry):
    vts_violation = []
    violation_list = [
        "stoppage_violations_count", "route_deviation_count", "speed_violation_count", "main_supply_removal_count",
        "night_driving_count", "no_halt_zone_count", "device_offline_count", "device_tamper_count", "continuous_driving_count"
    ]
    for violation in violation_list:
        if entry.get(violation, 0) > 0:
            vts_violation.append(violation)
    return vts_violation

async def insert_truck_details(data):
    data = pd.DataFrame(data)
    data.rename(columns={"LOCATION_CODE": "sap_id"}, inplace=True)
    data.columns = data.columns.str.lower()
    data['instance_1'] = data['instance_1'].fillna(0)
    data['instance_2'] = data['instance_2'].fillna(0)
    data['instance_3'] = data['instance_3'].fillna(0)
    if not 'bu' in data.columns:
        data['bu'] = ""
    data = data.fillna("")
    await hpcl_ceg_model.VtsTruckDetails.bulk_update(data.to_dict(orient="records"), upsert=True)


async def get_instance_packed(tt_number: str, sap_id: str, bu: str, get_raw_data=False):
    query = f"select * from vts_truck_details where truck_regno = '{tt_number}'"
    vts_truck_data = await hpcl_ceg_model.VtsTruckDetails.get_aggr_data(query, limit=0)
    if get_raw_data:
        return vts_truck_data.get("data", [])
    if not vts_truck_data.get("data", []):
        vts_truck_record = {
            "truck_regno": tt_number,
            "sap_id": sap_id,
            "bu": bu,
            "truck_status": "UNBLOCKED", 
            "violation_type": "",
            "block_start_datetime": None,
            "block_end_datetime": None, 
            "instance_1": 0, 
            "instance_2": 0,
            "instance_3": 0,
            "instance_4": 0,
            "instance_5": 0,
            "instance_6": 0,
            "alert_id": "",
            "blacklist": False,
            "truck_history": []
        }
        #print("vts_truck_record",vts_truck_record)
        await hpcl_ceg_model.VtsTruckDetailsCreate(**vts_truck_record).create()
        return "0"
    vts_truck_data = vts_truck_data.get("data", [])[0]
    print(vts_truck_data)
    if not vts_truck_data['instance_1']:
        return "0"
    if not vts_truck_data['instance_2']:
        return "1"
    if not vts_truck_data['instance_3']:
        return "2"
    if not vts_truck_data['instance_4']:
        return "3"
    if not vts_truck_data['instance_5']:
        return "4"
    return "5"


async def get_instance(tt_number: str, sap_id: str, bu: str, get_raw_data=False):
    query = f"select * from vts_truck_details where truck_regno = '{tt_number}'"
    vts_truck_data = await hpcl_ceg_model.VtsTruckDetails.get_aggr_data(query, limit=0)
    if get_raw_data:
        return vts_truck_data.get("data", [])
    if not vts_truck_data.get("data", []):
        vts_truck_record = {
            "truck_regno": tt_number,
            "sap_id": sap_id,
            "bu": bu,
            "truck_status": "UNBLOCKED", 
            "violation_type": "",
            "block_start_datetime": None,
            "block_end_datetime": None, 
            "instance_1": 0, 
            "instance_2": 0,
            "instance_3": 0,
            "alert_id": "",
            "blacklist": False,
            "truck_history": []
        }
        #print("vts_truck_record",vts_truck_record)
        await hpcl_ceg_model.VtsTruckDetailsCreate(**vts_truck_record).create()
        return "0"
    vts_truck_data = vts_truck_data.get("data", [])[0]
    print(vts_truck_data)
    if not vts_truck_data['instance_1']:
        return "0"
    if not vts_truck_data['instance_2']:
        return "1"
    return "2"

async def is_vehicle_blacklisted(tl_number: str):
    black_list_query = f"select * from vts_truck_details where truck_regno = '{tl_number}' and blacklist='true'"
    vts_blacklist_data = await hpcl_ceg_model.VtsTruckDetails.get_aggr_data(black_list_query, limit=0)
    if vts_blacklist_data.get("data", []):
        return True
    return False

async def is_alert_exists(tl_number: str):
    query = f"select id from alerts where vehicle_number = '{tl_number}' and vehicle_unblocked_date is null and alert_section = 'VTS'"
    print("query: ", query)
    vts_alert_data = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
    print("vts_alert_data: ", vts_alert_data)
    if vts_alert_data.get("data", []):
        return True
    return False

async def last_closed_at(tt_number: str):
    query = f"""
                select * from alerts 
                where vehicle_number = '{tt_number}'
                and alert_status = 'Close'
                and alert_section = 'VTS'
                and vehicle_unblocked_date is not null
                order by vehicle_unblocked_date desc
            """
    # query = f"vehicle_number = '{tt_number}' and alert_status = 'Close' and alert_section = 'VTS' and vehicle_unblocked_date is not null order by vehicle_unblocked_date desc"
    # vts_alert_data = await hpcl_ceg_model.Alerts.get_all(urdhva_base.queryparams.QueryParams(q=query,limit=5),resp_type='plain')
    print("query: ", query)
    vts_alert_data = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=1)
    # print("vts_alert_data: ", vts_alert_data)
    if len(vts_alert_data['data']):
        return vts_alert_data['data'][0]['closed_at']
    return None

async def is_vehicle_blacklisted_in_alerts(tl_number, sap_id, bu):
    query = (f"vehicle_number = '{tl_number}' and bu = '{bu}' and alert_section = 'VTS' and "
            f"violation_type in ('device_tamper_count','main_supply_removal_count')")
    vts_alert_data = await hpcl_ceg_model.Alerts.get_all(urdhva_base.queryparams.QueryParams(q=query,limit=5),resp_type='plain')
    if len(vts_alert_data['data']):
        query = (f"update vts_truck_details set blacklist='true' "
                 f"where truck_regno = '{tl_number}'")
        await hpcl_ceg_model.VtsTruckDetails.update_by_query(query)
        return True
    return False

async def last_opened_at(tt_number: str):
    query = f"vehicle_number = '{tt_number}' and vehicle_unblocked_date is null and alert_section = 'VTS'"
    print("query: ", query)
    vts_alert_data = await hpcl_ceg_model.Alerts.get_all(urdhva_base.queryparams.QueryParams(q=query,limit=5),resp_type='plain')
    #print("vts_alert_data: ", vts_alert_data)
    if len(vts_alert_data['data']):
        alert_history = list(reversed(vts_alert_data['data'][0]['alert_history']))
        created_at = vts_alert_data['data'][0]['created_at']
        for record in alert_history:
            action_msg = record.get("action_msg", "")
            if action_msg.startswith("Instance Updated for this Vehicle Number:"):
                created_at = datetime.datetime.fromisoformat(record.get("processed_time"))
                #print("First processed_time:", created_at)
                break
        return created_at, vts_alert_data['data'][0]['id']
    return None, None

async def get_updated_vts_instance(tt_number: str, sap_id: str, bu: str, tt_type: str):
    vts_map = vts_mapping.vts_interlock_mapping[bu][tt_type.lower()]
    instance_mapping = vts_instance_mapping.instance_mapping
    start_date, end_date = await va_analysis.get_period_datetime(period='fortnight')
    start_date = start_date.strftime("%Y-%m-%d")
    end_date = end_date.strftime("%Y-%m-%d")
    vts_opened_alert_data, alert_id = await last_opened_at(tt_number)
    vts_alert_data = []
    if vts_opened_alert_data:
        last_updated_at_ist = vts_opened_alert_data + datetime.timedelta(hours=5, minutes=30)
        start_date_ = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
        end_date_ = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
        if start_date_ <= last_updated_at_ist.date() <= end_date_:
            query = (f"select DISTINCT ON (tl_number, invoice_number) violation_type, id from vts_alert_history where tl_number = '{tt_number}' "
                    f"and vts_end_datetime::date between '{start_date}' and '{end_date}' and created_at > '{vts_opened_alert_data}'")
            vts_alert_data = await hpcl_ceg_model.VtsAlertHistory.get_aggr_data(query, limit=0)
        else:
            query = (f"select DISTINCT ON (tl_number, invoice_number) violation_type, id from vts_alert_history where tl_number = '{tt_number}' "
                    f"and vts_end_datetime::date between '{start_date}' and '{end_date}'")
            vts_alert_data = await hpcl_ceg_model.VtsAlertHistory.get_aggr_data(query, limit=0)
    else:
        query = (f"select DISTINCT ON (tl_number, invoice_number) violation_type, id from vts_alert_history where tl_number = '{tt_number}' "
                f"and vts_end_datetime::date between '{start_date}' and '{end_date}'")
        vts_alert_data = await hpcl_ceg_model.VtsAlertHistory.get_aggr_data(query, limit=0)
    if not vts_alert_data:
        return False
    vts_alert_data = vts_alert_data.get("data", [])
    print("vts_alert_data: ", vts_alert_data)
    all_violations = [violation for d in vts_alert_data for violation in d["violation_type"]]
    #violations_ids = [str(d["id"]) for d in vts_alert_data]
    violations_ids = []
    violation_counts = dict(Counter(all_violations))
    instance = {}
    violation_name = ""
    if tt_type.lower() in ['bulk']:
        current_instance = await get_instance(tt_number,sap_id,bu)
    if tt_type.lower() in ['packed']:
        current_instance = await get_instance_packed(tt_number,sap_id,bu)
    instance_data = instance_mapping[bu][tt_type.lower()].get(current_instance,{})
    for key, violation_data in instance_data.items():
        if key in violation_counts.keys() and violation_counts[key] > violation_data['violation_count']:
            if key in ['device_tamper_count', 'main_supply_removal_count'] and bu in ['TAS']:
                await is_vehicle_blacklisted_in_alerts(tt_number,sap_id,bu)
            violations_ids = [
                str(d["id"])
                for d in vts_alert_data
                if key in d["violation_type"]
            ]
            instance = vts_map[key]['alerting_rules'][current_instance]
            instance['severity'] = vts_map[key]["severity"]
            violation_name = key
            break
    return instance, violation_name, violations_ids, alert_id

async def get_vts_instance(tt_number: str, sap_id: str, bu: str, tt_type: str):
    # Load VTS Interlock and Instance Mapping Configuration
    vts_map = vts_mapping.vts_interlock_mapping[bu][tt_type.lower()]
    instance_mapping = vts_instance_mapping.instance_mapping
    # Get Current Fortnight Date Range Alerts are evaluated only within the current fortnight.
    start_date, end_date = await va_analysis.get_period_datetime(period='fortnight')
    start_date = start_date.strftime("%Y-%m-%d")
    end_date = end_date.strftime("%Y-%m-%d")
    # Used to decide whether only alerts created after the last closed alert should be considered.
    vts_closed_alert_data = await last_closed_at(tt_number)
    vts_alert_data = []
    if vts_closed_alert_data:
        # Convert UTC timestamp to IST
        last_updated_at_ist = vts_closed_alert_data + datetime.timedelta(hours=5, minutes=30)
        start_date_ = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
        end_date_ = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
        # If the last closed alert falls within the current fortnight, consider only alerts created after it.
        if start_date_ <= last_updated_at_ist.date() <= end_date_:
            query = (f"select DISTINCT ON (tl_number, invoice_number) violation_type, id from vts_alert_history where tl_number = '{tt_number}' "
                    f"and vts_end_datetime::date between '{start_date}' and '{end_date}' and created_at > '{vts_closed_alert_data}'")
            vts_alert_data = await hpcl_ceg_model.VtsAlertHistory.get_aggr_data(query, limit=0)
        # Fetch All Alerts in Current Fortnight
        else:
            query = (f"select DISTINCT ON (tl_number, invoice_number) violation_type, id from vts_alert_history where tl_number = '{tt_number}' "
                    f"and vts_end_datetime::date between '{start_date}' and '{end_date}'")
            vts_alert_data = await hpcl_ceg_model.VtsAlertHistory.get_aggr_data(query, limit=0)
    else:
        query = (f"select DISTINCT ON (tl_number, invoice_number) violation_type, id from vts_alert_history where tl_number = '{tt_number}' "
                f"and vts_end_datetime::date between '{start_date}' and '{end_date}'")
        vts_alert_data = await hpcl_ceg_model.VtsAlertHistory.get_aggr_data(query, limit=0)
    # Exit if No Alert History Exists
    if not vts_alert_data:
        return False
    vts_alert_data = vts_alert_data.get("data", [])
    print("vts_alert_data: ", vts_alert_data)
    # Count Violations Across All Trips
    all_violations = [violation for d in vts_alert_data for violation in d["violation_type"]]
    #violations_ids = [str(d["id"]) for d in vts_alert_data]
    # Stores the IDs of alerts contributing to the current violation.
    violations_ids = []
    violation_counts = dict(Counter(all_violations))
    instance = {}
    violation_name = ""
    #current_instance = await get_instance(tt_number,sap_id,bu)
    # Fetch the current blocking instance based on TT Type (Bulk/Packed).
    if tt_type.lower() in ['bulk']:
        current_instance = await get_instance(tt_number,sap_id,bu)
    if tt_type.lower() in ['packed']:
        current_instance = await get_instance_packed(tt_number,sap_id,bu)
    # Fetch the configured violation rules for the current instance.
    instance_data = instance_mapping[bu][tt_type.lower()].get(current_instance,{})
    # Compare actual violation counts with configured thresholds. The first violation exceeding its limit is selected.
    for key, violation_data in instance_data.items():
        if key in violation_counts.keys() and violation_counts[key] > violation_data['violation_count']:
            # For TAS Device Tamper and Main Supply Removal, verify if the vehicle should be blacklisted.
            if key in ['device_tamper_count', 'main_supply_removal_count'] and bu in ['TAS']:
                await is_vehicle_blacklisted_in_alerts(tt_number,sap_id,bu)
            # Collect all VTS Alert History IDs associated with the matched violation.
            violations_ids = [
                str(d["id"])
                for d in vts_alert_data
                if key in d["violation_type"]
            ]
            # Fetch alert configuration
            instance = vts_map[key]['alerting_rules'][current_instance]
            instance['severity'] = vts_map[key]["severity"]
            violation_name = key
            break
    # if "device_tamper_count" in violation_counts.keys() and violation_counts['device_tamper_count'] > 1:
    #     instance = vts_map["device_tamper_count"]['alerting_rules'][await get_instance(tt_number,sap_id,bu)]
    #     instance['severity'] = vts_map["device_tamper_count"]["severity"]
    #     violation_name = "device_tamper_count"

    # elif "main_supply_removal_count" in violation_counts.keys() and violation_counts['main_supply_removal_count'] > 1:
    #     instance = vts_map["main_supply_removal_count"]['alerting_rules'][await get_instance(tt_number,sap_id,bu)]
    #     instance['severity'] = vts_map["main_supply_removal_count"]["severity"]
    #     violation_name = "main_supply_removal_count"

    # elif "route_deviation_count" in violation_counts.keys() and violation_counts['route_deviation_count'] > 5:
    #     instance = vts_map["route_deviation_count"]['alerting_rules'][await get_instance(tt_number,sap_id,bu)]
    #     instance['severity'] = vts_map["route_deviation_count"]["severity"]
    #     violation_name = "route_deviation_count"

    # elif "stoppage_violations_count" in violation_counts.keys() and violation_counts['stoppage_violations_count'] > 5:
    #     instance = vts_map["stoppage_violations_count"]['alerting_rules'][await get_instance(tt_number,sap_id,bu)]
    #     instance['severity'] = vts_map["stoppage_violations_count"]["severity"]
    #     violation_name = "stoppage_violations_count"

    # elif "speed_violation_count" in violation_counts.keys() and violation_counts['speed_violation_count'] > 3:
    #     instance = vts_map["speed_violation_count"]['alerting_rules'][await get_instance(tt_number,sap_id,bu)]
    #     instance['severity'] = vts_map["speed_violation_count"]["severity"]
    #     violation_name = "speed_violation_count"

    # elif "night_driving_count" in violation_counts.keys() and violation_counts['night_driving_count'] > 3:
    #     instance = vts_map["night_driving_count"]['alerting_rules'][await get_instance(tt_number,sap_id,bu)]
    #     instance['severity'] = vts_map["night_driving_count"]["severity"]
    #     violation_name = "night_driving_count"

    # elif "continuous_driving_count" in violation_counts.keys() and violation_counts['continuous_driving_count'] > 3:
    #     instance = vts_map["continuous_driving_count"]['alerting_rules'][await get_instance(tt_number,sap_id,bu)]
    #     instance['severity'] = vts_map["continuous_driving_count"]["severity"]
    #     violation_name = "continuous_driving_count"

    return instance, violation_name, violations_ids

async def update_vts_instance(alert_data):
    vts_end_datetime = alert_data.get('vts_end_datetime',None)
    instance_data, violation_name, vts_alert_history_ids, alert_id = await get_updated_vts_instance(alert_data['tl_number'],alert_data['base_location_id'],alert_data['location_type'],alert_data['tt_type'])
    if not instance_data:
        logger.info(f"No Max Violation for TT {alert_data['tl_number']}")
        return
    
    if not alert_id:
        logger.info(f"Alert Got Blocked From Admin Module {alert_data['tl_number']}")
        return
    
    alert_data = await hpcl_ceg_model.Alerts.get(alert_id)
    if not isinstance(alert_data, dict):
        alert_data = alert_data.__dict__
    if "_sa_instance_state" in alert_data.keys():
        del alert_data["_sa_instance_state"]
        
    current_device_name = alert_data.get("device_name")

    device_name = current_device_name

    if current_device_name:
        try:
            instance_no = int(current_device_name.split("-")[-1].strip())
            device_name = f"Instance - {instance_no + 1}"
        except Exception:
            device_name = current_device_name
    
    if alert_data.get('interlock_name') in ['Itdg Admin Block', 'No VTS No Load']:
        return

    alert_message = (
        f"Instance Updated for this Vehicle Number: {alert_data['vehicle_number']} from {alert_data['device_name']} to {device_name} with violation {violation_name}"
        )    
    alert_data["action_msg"] = alert_message
    alert_data["action_type"] = "Blocked"
    await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)

    vehicle_blocked_end_date = (
        alert_data['vehicle_blocked_start_date'] +
        datetime.timedelta(days=instance_data['block_duration'])
        )
    
    await hpcl_ceg_model.Alerts(**{"id": alert_data['id'], 
                                        "vehicle_blocked_end_date": vehicle_blocked_end_date,
                                        "device_id": instance_data['instance'],
                                        "external_timestamp": vts_end_datetime,
                                        "device_name": device_name}).modify()
    
    if instance_data['instance'] == 'Instance - 1':
        query = (f"update vts_truck_details set instance_1 = 1, truck_status = 'BLOCKED', block_start_datetime = '{alert_data['vehicle_blocked_start_date']}', block_end_datetime = '{vehicle_blocked_end_date}' "
                 f"where truck_regno = '{alert_data['vehicle_number']}'")
    if instance_data['instance'] == 'Instance - 2':
        query = (f"update vts_truck_details set instance_2 = 1, truck_status = 'BLOCKED', block_start_datetime = '{alert_data['vehicle_blocked_start_date']}', block_end_datetime = '{vehicle_blocked_end_date}' "
                 f"where truck_regno = '{alert_data['vehicle_number']}'")
    if instance_data['instance'] == 'Instance - 3':
        query = (f"update vts_truck_details set instance_3 = 1, truck_status = 'BLOCKED', block_start_datetime = '{alert_data['vehicle_blocked_start_date']}', block_end_datetime = '{vehicle_blocked_end_date}' "
                 f"where truck_regno = '{alert_data['vehicle_number']}'")
    if instance_data['instance'] == 'Instance - 4':
        query = (f"update vts_truck_details set instance_4 = 1, truck_status = 'BLOCKED', block_start_datetime = '{alert_data['vehicle_blocked_start_date']}', block_end_datetime = '{vehicle_blocked_end_date}' "
                 f"where truck_regno = '{alert_data['vehicle_number']}'")
    if instance_data['instance'] == 'Instance - 5':
        query = (f"update vts_truck_details set instance_5 = 1, truck_status = 'BLOCKED', block_start_datetime = '{alert_data['vehicle_blocked_start_date']}', block_end_datetime = '{vehicle_blocked_end_date}' "
                 f"where truck_regno = '{alert_data['vehicle_number']}'")
    if instance_data['instance'] == 'Instance - 6':
        query = (f"update vts_truck_details set instance_6 = 1, truck_status = 'BLOCKED', block_start_datetime = '{alert_data['vehicle_blocked_start_date']}', block_end_datetime = '{vehicle_blocked_end_date}' "
                 f"where truck_regno = '{alert_data['vehicle_number']}'")
    if query:
        await hpcl_ceg_model.VtsTruckDetails.update_by_query(query)

    await update_alert_id_to_vts_history(alert_id=str(alert_data['id']), vts_alert_id=vts_alert_history_ids)

    return True

async def is_violation_exists(tl_number,invoice_number,violation):
    query = (f"select * from violation_history_vts where tl_number = '{tl_number}' and invoice_number= '{invoice_number}' and violation_name='{violation}'")
    vts_alert_data = await hpcl_ceg_model.ViolationHistoryVts.get_aggr_data(query, limit=0)
    if vts_alert_data.get("data", []):
        return True
    return False

async def trigger_vts_alarm_alert(entry):
    violation_fields = vts_instance_mapping.instance_mapping[entry['location_type']]["0"]
    camunda_url = await helpers.get_camunda_url(bu=entry['location_type'], sap_id=entry['location_id'],
                                                alert_section="VTS")
    location_data = entry.get("location_data", {})
    if not location_data:
        retries = 3
        for attempt in range(retries):
            if urdhva_base.ctx.exists(): 
                _, location_data = await alert_helper.get_location_details(entry['location_type'], entry['location_id'])
                break
            else:
                _, location_data = await cache_api_actions.get_location_data(bu=entry['location_type'], location_id=entry['location_id'])
            
            if location_data:
                break
            
            print(f"Retrying to fetch location data for {entry['location_type']} {entry['location_id']}... Attempt {attempt + 1}/{retries}")
            await asyncio.sleep(3)
    # print("location_data --> ", location_data)
    # if not status:
    #     return False, location_data
    base_data = {
        key: location_data.get(key, '') for key in [
            'state', 'city', 'zone', 'region', 'district', 'sales_area'
        ]
    }
    base_data.update({"location_name": location_data.get('name', '')})

    for v_field in violation_fields.keys():
        violation_data_mapping = vts_instance_mapping.violation_mapping["VTS"][entry['location_type']][v_field]
        violation_name = violation_data_mapping['violation_name']
        sop_id = violation_data_mapping['sop_id']
        severity = violation_data_mapping['severity']
        if entry[v_field] <= 0:
            continue
        if not await is_violation_exists(entry['tl_number'],entry['invoice_number'],violation_name):
            async with httpx.AsyncClient(verify=False) as client:
                base_url = f"http://{urdhva_base.settings.cache_gateway_host}:{urdhva_base.settings.cache_gateway_port}"
                resp = await client.get(f"{base_url}/api_cache/v1/get_unique_alert_id", params={"bu": "VTS",
                                                                                                "sap_id": entry['location_id'],
                                                                                                "sop_id": sop_id})
                if resp.status_code // 100 == 2:
                    unique_id = resp.text.strip('"')
            alert_message = (
                f"Vehicle Number: {entry['tl_number']} \n"
                f"Violation Type: {violation_name} \n"
                f"Reported at: {entry['vts_end_datetime']}"
            )
            allocated_time = datetime.datetime.now(datetime.timezone.utc)
            processed_time = datetime.datetime.now(datetime.timezone.utc)
            alert_history = [
                {
                    "action_msg": alert_message,
                    "action_type": "Created",
                    "alert_status": "Open",
                    "allocated_time": allocated_time.isoformat(),
                    "processed_time": processed_time.isoformat()
                }
            ]
            #print("alert_history",alert_history)
            violation_data = {
                "vendor_id": entry['vendor_id'],
                "sap_id": str(entry['location_id']),
                "bu": entry['location_type'],
                "vehicle_number": entry['tl_number'],
                "unique_id": unique_id,
                "sop_id": sop_id,
                "alert_section": "VTS",
                "severity": severity.capitalize() if severity else "Medium",
                "report_duration": entry['report_duration'],
                "scheduled_trip_start_datetime": entry['scheduled_trip_start_datetime'],
                "scheduled_trip_end_datetime":entry['scheduled_trip_end_datetime'],
                "vts_start_datetime": entry['vts_start_datetime'],
                "vts_end_datetime": entry['vts_end_datetime'],
                "total_trips": entry['total_trips'],
                "violation_name": violation_name,
                "violation_type": v_field,
                "violation_count": entry[v_field],
                "alert_status": hpcl_ceg_enum.AlertStatus.Open,
                "approved_status": False,
                "invoice_number": entry['invoice_number'],
                "tt_type": entry['tt_type'],
                "workflow_datetime": urdhva_base.utilities.get_present_time().replace(tzinfo=None).isoformat(),
                "workflow_url": camunda_url,
                "workflow_port": camunda_url.split(":")[2],
                "alert_history": alert_history,
                "last_sms_to": [], 
                "last_mailed_to": [],
                "last_escalated_to": [],
                "last_notified_to": [], 
                "assigned_to": '',
                "assigned_to_role": '',
                "assigned_users": [],
                "assigned_user_roles": []
            }
            violation_data.update(base_data)
            vts_history_resp = await hpcl_ceg_model.ViolationHistoryVtsCreate(**violation_data).create()
            alert_level = "level - 1"
            payload = {"businessKey": unique_id,
                        "variables": {"alert_id": {"value": vts_history_resp['id'], "type": "String"},
                                      "interlock_name": {"value": violation_name, "type": "String"},
                                      "bu": {"value": entry['location_type'], "type": "String"},
                                      "sap_id": {"value": entry['location_id'], "type": "String"},
                                      "sop_id": {"value": sop_id, "type": "String"},
                                      "tt_type": {"value": entry['tt_type'], "type": "String"},
                                      "vts_level": {"value": alert_level, "type": "String"},
                                      "alert_section": {"value": "VTS", "type": "String"},
                                      "violation_type": {"value": v_field, "type": "String"},
                                      "invoice_number": {"value": entry['invoice_number'], "type": "String"},
                                      "vehicle_number": {"value": entry['tl_number'], "type": "String"},
                                      "transporter_code": {"value": entry['vendor_id'], "type": "String"},
                                      "workflow_datetime": {"value": datetime.datetime.now(datetime.UTC)
                                                            .strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + "Z", "type": "String"}
                                    }}
            interlock_name = interlock_mapping.get_interlock_name(bu=entry['location_type'], interlock_name=violation_name,sop_id=sop_id)
            workflowid = interlock_name.get("workflow_name") or interlock_name.get("interlock_name") or None
            workflow_id = interlock_mapping.fmt_il_name(workflowid)
            await Camunda().start_workflow_vts(payload=payload, workflowId=workflow_id, camunda_url=camunda_url)

async def create_vts_violation_alerts(enriched_data):
    try:
        #print("enriched_data",enriched_data)
        for entry in enriched_data:
            entry['auto_unblock'] = True
            entry['vts_start_datetime'], entry['vts_end_datetime'] = map(
                lambda x: datetime.datetime.strptime(x, "%Y-%m-%d %H:%M:%S"), entry['report_duration'].split(" to "))
            await trigger_vts_alarm_alert(entry)
    except Exception as e:
        logger.error(f"Error creating VTS Alert : {str(e)}")

async def get_delivered_location_packed(invoice_number,supply_location,vehicle_number):
    MAX_RETRIES = 3
    RETRY_DELAY = 10

    delivery_location_resp = {}

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            # Fetching customer from TIBCO DB
            #dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 6
            #dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            #function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
            query = f"""SELECT DISTINCT CUSTOMER AS CONSUMER_ERP_CODE FROM ZSDCV_AY_INV3_STG WHERE LOAD_NO1 = '{invoice_number}' 
                        AND SUPPLY_LOC = '{supply_location}' AND VEHICLE_ID = '{vehicle_number}'"""

            print('*'*100)
            print('query',query)
            print('*'*100)

            # delivery_location_resp = await function(query=query) 

            if len(delivery_location_resp.get('CONSUMER_ERP_CODE',[])):
                break

        except Exception as e:
            print(traceback.format_exc())
            logger.error(f"Vehicle Track DB query failed for getting delivery_location : Traceback: {traceback.format_exc()}")
            logger.error(
                f"Vehicle Track DB query failed (attempt {attempt}/{MAX_RETRIES}) "
                f"Invoice={invoice_number}, Location={supply_location}, Error={e}"
                )
            
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY)
    
    ship_to_list = delivery_location_resp.get("CONSUMER_ERP_CODE") or []

    return ship_to_list

async def get_delivered_location(invoice_number,supply_location,vehicle_number):
    MAX_RETRIES = 3
    RETRY_DELAY = 10

    delivery_location_resp = {}

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            # Fetching voilations from VTS DB
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 5
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
            query = f"""
                        SELECT DISTINCT CONSUMER_ERP_CODE FROM COMPLETED_TRIP 
                            WHERE CHALLAN_NO = '{invoice_number}' 
                            AND VEHICLE_RTO_NO = '{vehicle_number}' 
                            AND DEPOT_ERP_CODE = '{supply_location}'
                    """
            
            print('*'*100)
            print('query',query)
            print('*'*100)

            delivery_location_resp = await function(query=query)
            # Break retry loop if valid response received
            if len(delivery_location_resp.get('CONSUMER_ERP_CODE',[])):
                break
            
            # invoice_no = invoice_number.split("-")[0]
            # # Fetching voilations from VTS DB
            # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 6
            # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            # function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
            # query = f"""SELECT DISTINCT CUSTOMER AS CONSUMER_ERP_CODE FROM ZSDCV_AY_INV3_STG WHERE INVOICE_NO = '{invoice_no}' 
            #             AND SUPPLY_LOC = '{supply_location}'"""

            # print('*'*100)
            # print('query',query)
            # print('*'*100)

            # delivery_location_resp = await function(query=query) 

            # if len(delivery_location_resp.get('CONSUMER_ERP_CODE',[])):
            #     break

        except Exception as e:
            print(traceback.format_exc())
            logger.error(f"Vehicle Track DB query failed for getting delivery_location : Traceback: {traceback.format_exc()}")
            logger.error(
                f"Vehicle Track DB query failed (attempt {attempt}/{MAX_RETRIES}) "
                f"Invoice={invoice_number}, Location={supply_location}, Error={e}"
                )
            
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY)
    
    ship_to_list = delivery_location_resp.get("CONSUMER_ERP_CODE") or []

    return ship_to_list
    
async def create_vts_alerts(enriched_data):
    try:
        # Fetch base location details for all trucks
        base_location_data = await get_base_location_details()
        # Process each VTS event received from ingestion
        for entry in enriched_data:
            # Avoid duplicate alert creation using
            # TL Number + Invoice Number + Location ID
            vts_duplicate_check_query = f"""select * from vts_alert_history where tl_number = '{entry['tl_number']}'
                                                and invoice_number = '{entry['invoice_number']}' and location_id = '{entry['location_id']}'"""
            vts_duplicate_check_data = await hpcl_ceg_model.VtsAlertHistory.get_aggr_data(vts_duplicate_check_query, limit=0)
            vts_duplicate_data = vts_duplicate_check_data.get('data',[])
            # Skip duplicate events unless the data is marked
            if vts_duplicate_data:
                if not entry.get('data_reprocessed',False):
                    logger.info(f"Received duplicate Event {entry} with existing data {vts_duplicate_check_data}")
                    continue
                else:
                    logger.info(f"Received duplicate Event {entry} with existing data {vts_duplicate_check_data} but data_reprocessed is True, so processing the event")
                    violation_history = vts_duplicate_data[0].get('violation_history') or []
                    violation_history.append({
                        "stoppage_violations_count": vts_duplicate_data[0]["stoppage_violations_count"],
                        "route_deviation_count": vts_duplicate_data[0]["route_deviation_count"],
                        "route_deviation_count_orig": vts_duplicate_data[0]["route_deviation_count_orig"],
                        "speed_violation_count": vts_duplicate_data[0]["speed_violation_count"],
                        "main_supply_removal_count": vts_duplicate_data[0]["main_supply_removal_count"],
                        "night_driving_count": vts_duplicate_data[0]["night_driving_count"],
                        "no_halt_zone_count": vts_duplicate_data[0]["no_halt_zone_count"],
                        "device_offline_count": vts_duplicate_data[0]["device_offline_count"],
                        "device_tamper_count": vts_duplicate_data[0]["device_tamper_count"],
                        "continuous_driving_count": vts_duplicate_data[0]["continuous_driving_count"],
                        "last_event_datetime": vts_duplicate_data[0]["created_at"].isoformat() if isinstance(vts_duplicate_data[0]["created_at"], datetime.datetime) else vts_duplicate_data[0]["created_at"]})
                    await hpcl_ceg_model.VtsAlertHistory(**{
                        "id": vts_duplicate_data[0]['id'],
                        "invoice_number": vts_duplicate_data[0]['invoice_number'],
                        "location_id": vts_duplicate_data[0]['location_id'], 
                        "tl_number": entry.get('tl_number'),
                        "total_trips": entry.get('total_trips'),
                        "stoppage_violations_count": entry.get('stoppage_violations_count'),
                        "route_deviation_count_orig": entry.get('route_deviation_count'),
                        "speed_violation_count": entry.get('speed_violation_count'),
                        "main_supply_removal_count": entry.get('main_supply_removal_count'),
                        "night_driving_count": entry.get('night_driving_count'),
                        "no_halt_zone_count": entry.get('no_halt_zone_count'),
                        "device_offline_count": entry.get('device_offline_count'),
                        "device_tamper_count": entry.get('device_tamper_count'),
                        "continuous_driving_count": entry.get('continuous_driving_count'),
                        "data_reprocessed": entry.get('data_reprocessed'),
                        "destination_name": entry.get("destination_name"),
                        "violation_history": violation_history}).modify()

            # Moving counts got from VTS route deviation into _orig key, 
            # Validating VTS Route Deviation DB to verify Invoices > 15 minutes
            # Preserve original Route Deviation count
            entry['route_deviation_count_orig'] = entry.get("route_deviation_count", 0)
            if entry.get("route_deviation_count") and entry.get("tt_type", "").lower() in ["bulk"]:
                # Fetching voilations from VTS DB
                dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 5
                dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
                function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
                query = f"""SELECT COUNT(*) FROM ROUTE_DEVIATION WHERE TT_NUMBER = '{entry['tl_number']}'
                            AND INVOICE_NO = '{entry['invoice_number']}' AND DURATION > 15 AND TRIP_STATUS = 'LOADED'
                            """
                route_deviation_resp = await function(query=query)
                count_value = list(route_deviation_resp.values())[0][0]
                if int(count_value) > 0:
                    entry['route_deviation_count'] = int(count_value)
                    
            entry['auto_unblock'] = True
            entry['violation_history'] = []
            entry['violation_type'] = await get_vts_violation(entry)
            entry['vts_start_datetime'], entry['vts_end_datetime'] = map(
                lambda x: datetime.datetime.strptime(x, "%Y-%m-%d %H:%M:%S"), entry['report_duration'].split(" to "))
            
            entry["bu"] = entry["location_type"]
            entry["sap_id"] = str(entry["location_id"])

            if entry.get('destination_code',''):
                destination_code = entry.get('destination_code','')
                entry['destination_code'] = destination_code.lstrip('00').lstrip('P')

            if entry['location_type'] == 'TAS':
                if base_location_data.get(entry['tl_number'], ""):
                    entry['base_location_id'] = base_location_data.get(entry['tl_number'], "")
                else:
                    base_locn = await get_base_location_details_ims(entry['tl_number'],entry["sap_id"])
                    if base_locn:
                        entry['base_location_id'] = base_locn

            if entry['location_type'] in ['LPG'] and entry.get("tt_type", "").lower() in ["bulk"]:
                # ship_to_list = await get_delivered_location(entry['invoice_number'],entry['location_id'],entry['tl_number'])
                # if len(ship_to_list) > 0 and entry['location_type'] in ['LPG']:
                #     entry["base_location_id"] = ship_to_list[0].lstrip("P").lstrip("00")
                # if len(ship_to_list) > 0:
                #     entry['destination_code']  = ship_to_list[0].lstrip("P").lstrip("00")
                entry["base_location_id"] = entry.get('destination_code','')
            
            if entry['location_type'] in ['LPG'] and entry.get("tt_type", "").lower() in ["packed"]:
                ship_to_list = await get_delivered_location_packed(entry['invoice_number'],entry['location_id'],entry['tl_number'])
                if len(ship_to_list) > 0:
                    entry['destination_code']  = ship_to_list[0].lstrip("P").lstrip("00")


            _, location_data = await cache_api_actions.get_location_data(
                bu=entry["location_type"],
                location_id=entry["location_id"]  
               )

            if entry.get('base_location_id'):
                base_location_data = {}
                if entry['base_location_id'].startswith('4'):
                    query = (f"select * from location_master where sap_id = '{entry["base_location_id"]}'")
                    vts_location_data = await hpcl_ceg_model.LocationMaster.get_aggr_data(query, limit=0)
                    if vts_location_data.get("data", []):
                        base_location_data = vts_location_data['data'][0]
                else:
                    _, base_location_data = await cache_api_actions.get_location_data(
                        bu=entry["location_type"],
                        location_id=entry["base_location_id"]
                    )
                entry["base_region"] = base_location_data.get("region","")
                entry["base_zone"] = base_location_data.get("zone","")
                entry["base_location_name"] = base_location_data.get("name","")
            else:
                entry['base_location_id'] = entry['location_id']
                entry["base_region"] = location_data.get("region")
                entry["base_zone"] = location_data.get("zone")
                entry["base_location_name"] = location_data.get("name")
            
            entry["region"] = location_data.get("region")
            entry["zone"] = location_data.get("zone")
            entry["location_name"] = location_data.get("name")
            entry['tt_type'] = entry.get("tt_type", "").lower()
            
            # Insert only if it is not a duplicate.
            if not vts_duplicate_data:
                await hpcl_ceg_model.VtsAlertHistoryCreate(**entry).create()

            # Skip LUB Business Unit
            if entry['location_type'] in ['LUB']:
                continue

            # Skipping if the truck is already blacklisted
            if await is_vehicle_blacklisted(entry['tl_number']):
                black_list_query = f"select * from vts_truck_details where truck_regno = '{entry['tl_number']}'"
                vts_blacklist_data = await hpcl_ceg_model.VtsTruckDetails.get_aggr_data(black_list_query, limit=0)
                vts_truck_data = vts_blacklist_data['data'][0]
                truck_history = vts_truck_data.get("truck_history") or []
                truck_history.append({
                    "violated_date": entry["vts_end_datetime"].isoformat() if isinstance(entry["vts_end_datetime"], datetime.datetime) else entry["vts_end_datetime"],
                    "transporter_code": entry["vendor_id"],
                    "invoice_number": entry["invoice_number"],
                    "stoppage_violations_count": entry["stoppage_violations_count"],
                    "route_deviation_count": entry["route_deviation_count"],
                    "route_deviation_count_orig": entry["route_deviation_count_orig"],
                    "speed_violation_count": entry["speed_violation_count"],
                    "main_supply_removal_count": entry["main_supply_removal_count"],
                    "night_driving_count": entry["night_driving_count"],
                    "no_halt_zone_count": entry["no_halt_zone_count"],
                    "device_offline_count": entry["device_offline_count"],
                    "device_tamper_count": entry["device_tamper_count"],
                    "continuous_driving_count": entry["continuous_driving_count"],
                    "last_violated_date": truck_history[-1]['violated_date'] if len(truck_history) else ""})
                await hpcl_ceg_model.VtsTruckDetails(**{"id": vts_truck_data['id'], "truck_history": truck_history}).modify()
                continue
            # Create a new VTS alert if one doesn't exist. Otherwise update the existing alert.
            if not await is_alert_exists(entry['tl_number']):                
                await alert_manager.create_alert({**entry, "alert_type": "VTS"})
            else:
                await update_vts_instance(entry)
    except Exception as e:
        print(traceback.format_exc())
        logger.error(f"Error creating VTS Alert : Traceback: {traceback.format_exc()}")
        logger.error(f"Error creating VTS Alert : {str(e)}")

async def close_camunda_workflow(alert_id):
    MAX_RETRIES = 5
    RETRY_DELAY = 5
    headers = {"Content-Type": "application/json"}
    alert_data = await hpcl_ceg_model.Alerts.get(alert_id)

    if not isinstance(alert_data, dict):
        alert_data = alert_data.__dict__

    instance_id = alert_data.get("workflow_instance_id")
    camunda_url = alert_data.get("workflow_url")
    url = f"{camunda_url}/engine-rest/process-instance/{instance_id}"
    async with aiohttp.ClientSession() as session:
        for attempt in range(MAX_RETRIES):
            try:
                async with session.delete(url, headers=headers) as response:
                    if response.status == 204:  # Success in Camunda
                        print(f"{instance_id} Deleted successfully.")
                        break
                    else:
                        error_text = await response.text()
                        print(
                            f"Error Deleting {alert_id} {instance_id} {camunda_url} (attempt {attempt + 1}): {response.status} - {error_text}")

            except aiohttp.ClientError as e:
                print(f"Request error for {camunda_url} {instance_id} {alert_id} (attempt {attempt + 1}): {e}")

        # Retry logic with exponential backoff
        if attempt < MAX_RETRIES - 1:
            await asyncio.sleep(RETRY_DELAY * (2 ** attempt))
        else:
            print(f"Failed to Deleting {camunda_url} {instance_id} after {MAX_RETRIES} retries.")
            return False
    return True

async def close_vts_alerts(alert_id):
    alert_data = await hpcl_ceg_model.Alerts.get(alert_id)
    if not isinstance(alert_data, dict):
        alert_data = alert_data.__dict__
    alert_history = alert_data.get('alert_history', []) if isinstance(alert_data, dict) else getattr(alert_data,
                                                                                                     'alert_history',
                                                                                                     [])
    allocated_time = alert_data.get('updated_at', datetime.datetime.now(datetime.timezone.utc))
    if alert_history and alert_history[-1].get("processed_time"):
        allocated_time = alert_history[-1]["processed_time"]
    processed_time = datetime.datetime.now(datetime.timezone.utc)
    alert_message = (
        f"Vehicle Number: {alert_data['vehicle_number']} \n"
        f"Violation Type: {alert_data['violation_type']} \n"
        f"Vehicle Blocked Time: {alert_data['vehicle_blocked_start_date']} to {alert_data['vehicle_blocked_end_date']} \n"
    )
    alert_history.append(
        {
            'processed_time': processed_time.isoformat(),
            'allocated_time': allocated_time,  # For first entry, allocated_time equals processed_time
            'action_type': "Resolved",
            'action_msg': alert_message,
            "action_by": "VTS_VENDOR"
        }
    )
    alert_data['alert_status'] = 'Close'
    alert_data['alert_state'] = 'Resolved'
    await hpcl_ceg_model.Alerts(**{"id": alert_id, "alert_history": alert_history, "alert_status": "Close", "alert_state": "Resolved"}).modify()

async def fetch_access_token():
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "client_credentials",
        "client_id": urdhva_base.settings.lpg_vts_client_id,
        "client_secret": urdhva_base.settings.lpg_vts_client_secret_key,
        "client_authentication": "send_as_basic_auth_header"
    }
    token = None
    error_msg = None
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Fetching token… Attempt {attempt}/{max_retries}")
            response = requests.post(urdhva_base.settings.lpg_vts_auth_url, headers=headers, data=data, timeout=30, verify=False)
            response.raise_for_status()
            token_data = response.json()
            token = token_data.get("access_token")
            if token:
                logger.info(f"Token fetched successfully.")
                return token, error_msg
            else:
                error_msg = "Token API succeeded but access_token missing"
                logger.error(error_msg)
        except requests.exceptions.RequestException as e:
            error_msg = f"Token API failed: {str(e)}"
            logger.error(f"Token API failed (Attempt {attempt}/{max_retries}): {e}")
        
        if attempt < max_retries:
            logger.info(f"Retrying in 15 seconds...")
            await asyncio.sleep(15)
    logger.error(f"All attempts to fetch token failed.")
    return token, error_msg

async def post_lpg_tt(payload):
    access_token,error_msg = await fetch_access_token()
    if not access_token:
        logger.error(f"Failed to fetch token {payload}")
        return None, error_msg
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    sap_response = None
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Attempt {attempt} to publish LPG TT...")
            response = requests.post(urdhva_base.settings.lpg_publish_url, headers=headers, data=json.dumps(payload),
                                     timeout=30, verify=False)
            response.raise_for_status()
            post_sap_response = {
                "request_id": str(response.json().get("Response", {}).get("Request_ID")),
                "vehicle_number": response.json().get("Response", {}).get("Vehicle_ID"),
                "status": response.json().get("Response", {}).get("Status"),
                "remark": response.json().get("Response", {}).get("Remark"),
                "updated_date": str(response.json().get("Response", {}).get("Updated_Date")),
                "updated_time": str(response.json().get("Response", {}).get("Updated_Time"))
            }
            await hpcl_ceg_model.LpgDataPostingAuditCreate(**post_sap_response).create()
            print("response->",response.json())
            sap_response = response.json()
            return sap_response, error_msg
        except requests.exceptions.RequestException as e:
            logger.error(f"Publish API failed (Attempt {attempt}/{max_retries}): {e}")
            if attempt < max_retries:
                await asyncio.sleep(15)  # wait before retry
            else:
                ist = pytz.timezone("Asia/Kolkata")
                now_ist = datetime.datetime.now(ist)
                post_sap_response = {
                    "request_id": str(payload["Request"]["Request_ID"]),
                    "vehicle_number": str(payload["Request"]["Vehicle_ID"]),
                    "status": 'F',
                    "remark": str(e),
                    "updated_date": now_ist.strftime("%Y%m%d"),
                    "updated_time": now_ist.strftime("%H%M%S")
                }
                await hpcl_ceg_model.LpgDataPostingAuditCreate(**post_sap_response).create()
                error_msg = f"Publish API failed {str(e)}"
                logger.error(f"All retry attempts failed while posting block/unblock details to SAP {payload}")
                return sap_response, error_msg

async def get_vts_alerts_count(bu: str, vehicle_number: str, sap_id: str, alert_section:str, tt_type:str):
    vts_mapping = vts_role_mapping.vts_unblocking_matrix[alert_section]
    lpg_vts_with_one_officer = vts_role_mapping.lpg_locations_with_one_officer
    lpg_vts_with_no_officer = vts_role_mapping.lpg_locations_with_no_officer
    top_sod_sap_ids = vts_role_mapping.top_sod_sap_ids

    if sap_id in top_sod_sap_ids:
        vts_mapping = vts_role_mapping.vts_sod_top_unblocking_matrix[alert_section]
    elif tt_type.lower() in ["packed"]:
        vts_mapping = vts_role_mapping.lpg_packed_unblocking_matrix[alert_section]
    elif sap_id in lpg_vts_with_one_officer:
        vts_mapping = vts_role_mapping.lpg_one_officer_unblocking_matrix[alert_section]
    elif sap_id in lpg_vts_with_no_officer or sap_id.startswith('4'):
        vts_mapping = vts_role_mapping.lpg_no_officer_unblocking_matrix[alert_section]
        
    if bu in vts_mapping.keys():
        query = (f"""select count(*) as "count" from alerts """
                 f"where bu = '{bu}' and "
                 f"alert_section = 'VTS' and "
                 f"vehicle_number = '{vehicle_number}'")
        #           f"sap_id = '{sap_id}'")
        # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 1
        # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        # function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        # resp = await function(query=query)
        resp = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
        resp = resp.get("data", [])
        if resp:
            resp = resp[0]
            return resp.get("count", 0)
    return 0

async def get_vts_levels(bu: str, vehicle_number: str, sap_id: str, alert_section:str, tt_type:str):
    vts_mapping = vts_role_mapping.vts_unblocking_matrix[alert_section]
    lpg_vts_with_one_officer = vts_role_mapping.lpg_locations_with_one_officer
    lpg_vts_with_no_officer = vts_role_mapping.lpg_locations_with_no_officer
    top_sod_sap_ids = vts_role_mapping.top_sod_sap_ids

    if sap_id in top_sod_sap_ids:
        vts_mapping = vts_role_mapping.vts_sod_top_unblocking_matrix[alert_section]
    elif tt_type.lower() in ["packed"]:
        vts_mapping = vts_role_mapping.lpg_packed_unblocking_matrix[alert_section]
    elif sap_id in lpg_vts_with_one_officer:
        vts_mapping = vts_role_mapping.lpg_one_officer_unblocking_matrix[alert_section]
    elif sap_id in lpg_vts_with_no_officer or sap_id.startswith('4'):
        vts_mapping = vts_role_mapping.lpg_no_officer_unblocking_matrix[alert_section]

    if bu in vts_mapping.keys():
        vts_level_data = vts_mapping[bu]
        vts_alert_count = await get_vts_alerts_count(bu=bu, vehicle_number=vehicle_number, sap_id=sap_id, alert_section=alert_section, tt_type=tt_type)
        previous_count = 0
        for key, value in vts_level_data.items():
            if value['condition'] == "<":
                if int(vts_alert_count) <= int(value['value']):
                    return key
            if value['condition'] == "<>":
                if int(previous_count) < vts_alert_count <= int(value['value']):
                    return key
            if value['condition'] == ">":
                if vts_alert_count > int(value['value']):
                    return key
            previous_count = value['value']
    return ""

# device_tamper_count
# main_supply_removal_count
# route_deviation_count
# stoppage_violations_count
# speed_violation_count
# night_driving_count
# continuous_driving_count

async def get_base_location_details():
    query = """SELECT "TRUCK_REGNNO", "BASE_LOCN" FROM "IMS_SAP"."VTS_TRUCK_DETAILS" WHERE "RECORD_STATUS" = 'A' AND "BASE_LOCN" IS NOT NULL AND "BASE_LOCN" <> '' """
    charts_ins = dashboard_studio_model.Charts_Connection_Vault_RoutingParams(
        connection_id=1,
        action='get_data'
    )
    function = await charts_actions.charts_connection_vault_routing(charts_ins)
    base_location_data = await function(query=query, schema_name="IMS_SAP", table_name="VTS_TRUCK_DETAILS")
    return dict(zip(base_location_data["TRUCK_REGNNO"].to_list(), base_location_data["BASE_LOCN"].to_list()))

async def get_base_location_details_ims(vehicle_number, sap_id):
    MAX_RETRIES = 3
    RETRY_DELAY = 10

    base_location_resp = []
    base_locn = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            base_location_query = f"""SELECT "LOCN_CODE", "TRUCK_REGNNO", "RECORD_STATUS", "BASE_LOCN" FROM "IMS_SAP"."TRUCK_DETAILS" 
                                        WHERE "TRUCK_REGNNO" = '{vehicle_number}' AND "LOCN_CODE" = '{sap_id}' AND "RECORD_STATUS" = 'A' 
                                        AND "BASE_LOCN" IS NOT NULL """
            charts_ins = dashboard_studio_model.Charts_Connection_Vault_RoutingParams(
                connection_id=connection_mapping.connection_mapping.get("ims", "1"),
                action='execute_query'
            )
            function = await charts_actions.charts_connection_vault_routing(charts_ins)
            base_location_resp = await function(query=base_location_query)
            print("before return", base_location_resp)
            break

        except Exception as e:
            print(traceback.format_exc())
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY)

    if len(base_location_resp) > 0:
        base_locn = base_location_resp[0].get("BASE_LOCN")

    return base_locn

def get_geofence_data():
    GEOFENCE_RENAME_MAP = {
        "geofence_name": "GEOFENCE_NAME",
        "latitude": "LATITUDE",
        "longitude": "LONGITUDE",
        "radius": "RADIUS",
        "latlon": "latlon",
        "geofence_type": "GEOFENCE_TYPE",
    }

    geofence_df = (
        pl.read_csv(
            f"{urdhva_base.settings.mft_path}/geofence_master.csv")
        .rename(GEOFENCE_RENAME_MAP)
        .rename({c: c.upper() for c in map(str.upper, GEOFENCE_RENAME_MAP.values())})
        .with_columns([
            pl.col("LATITUDE").cast(pl.Float64),
            pl.col("LONGITUDE").cast(pl.Float64),
            pl.col("RADIUS").cast(pl.Float64),
        ])
    )
    geofence_df = geofence_df.with_columns([
        (pl.col("LATITUDE") * np.pi / 180).alias("LAT_RAD"),
        (pl.col("LONGITUDE") * np.pi / 180).alias("LON_RAD"),
    ])
    return geofence_df

def compute_geofence_batch(batch: pl.DataFrame, geofence_df: pl.DataFrame) -> pl.DataFrame:
    """
    Batch-wise computation.
    Input: batch of data_stp rows (ALERT_LAT_RAD, ALERT_LON_RAD)
    Output: same batch with ALERT_GEOFENCE_TYPE column added
    """
    gf_lat = geofence_df["LAT_RAD"].to_numpy()
    gf_lon = geofence_df["LON_RAD"].to_numpy()
    gf_rad = geofence_df["RADIUS"].to_numpy()
    gf_type = geofence_df["GEOFENCE_TYPE"].to_list()
    R = 6371
    lat = batch["ALERT_LAT_RAD"].to_numpy()
    lon = batch["ALERT_LON_RAD"].to_numpy()

    result = []

    for lat1, lon1 in zip(lat, lon):
        dlat = gf_lat - lat1
        dlon = gf_lon - lon1

        a = (
            np.sin(dlat / 2) ** 2
            + np.cos(lat1) * np.cos(gf_lat) * np.sin(dlon / 2) ** 2
        )

        c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
        dist = R * c

        inside = dist <= gf_rad

        if inside.any():
            nearest = np.argmin(dist)
            result.append(gf_type[nearest])
        else:
            result.append("NA")

    return batch.with_columns(
        pl.Series("ALERT_GEOFENCE_TYPE", result)
    )

async def _get_data_from_vts(query, connection_id):
    charts_ins = dashboard_studio_model.Charts_Connection_Vault_RoutingParams(
        connection_id=connection_id,
        action='get_data'
    )
    function = await charts_actions.charts_connection_vault_routing(charts_ins)
    return await function(query=query)

async def itdg_speed_violation_old():
    speed_violation_cfg = {
        "speed": 60,
        "speed_condition": ">",
        "max_violation_count": 3,
        "max_violation_count_condition": ">",
        "trip_status": ["LOADED", "RETURN"],
        "max_violation_time": 3,
        "max_violation_time_condition": ">",
        "group_by": ["TT_NUMBER", "INVOICE_NO", "LOAD_NO"]
    }

    query = f"""SELECT "TRIP_STATUS", "START_SPEED", "START_SPEED", "DURATION", "LOCATION_TYPE", "TT_NUMBER", "INVOICE_NO",
            "ZONE", "LOCATION", "LOAD_NO", "TRANSPORTER_ID" FROM "SPEED_VIOLATION" WHERE "LOCATION_TYPE" = 'TAS'"""
    data = await _get_data_from_vts(query=query, connection_id=5)
    data = data.lazy()
    data = data.with_columns([
        pl.col("START_SPEED").cast(pl.Int64),
        pl.col("DURATION").cast(pl.Int64)
    ])
    data = (
        data.filter(
            (
                pl.col("TRIP_STATUS").is_in(speed_violation_cfg["trip_status"])
            )
            & (pl.col("START_SPEED") > speed_violation_cfg["speed"])
            & (pl.col("DURATION") > speed_violation_cfg["max_violation_time"])
            & (pl.col("LOCATION_TYPE") == 'TAS')
        )
    )

    # Group by TT_NUMBER + INVOICE_NO
    data = (
        data
        .group_by(speed_violation_cfg["group_by"])
        .agg([
            pl.col("ZONE").first(),
            pl.col("LOCATION").first(),
            pl.col("TRANSPORTER_ID").first(),
            pl.col("START_SPEED").max().alias("MAX_START_SPEED"),
            pl.col("DURATION").max().alias("MAX_DURATION"),
            pl.len().alias("VIOLATION_COUNT"),
        ]).filter(pl.col("VIOLATION_COUNT") >= speed_violation_cfg["max_violation_count"])
    )
    return data.collect()

async def itdg_speed_violation():
    speed_violation_cfg = {
        "normal_speed": 60,
        "normal_speed_condition": ">",
        "max_violation_count_normal_speed": 3,
        "accident_speed": 30,
        "accident_speed_condition": ">",
        "max_violation_count_accident_speed": 3,
        "max_violation_count_condition": ">",
        "trip_status": ["LOADED", "RETURN"],
        "max_violation_time": 3,
        "earth_radius": 6371.0,
        "max_violation_time_condition": ">",
        "group_by": ["TT_NUMBER", "INVOICE_NO", "LOAD_NO"]
    }

    query = f"""SELECT "TRIP_STATUS", "START_SPEED", "START_SPEED", "DURATION", "LOCATION_TYPE", "TT_NUMBER", "INVOICE_NO",
            "ZONE", "LOCATION", "LOAD_NO", "TRANSPORTER_ID" FROM "SPEED_VIOLATION" WHERE "LOCATION_TYPE" = 'TAS'"""
    data = await _get_data_from_vts(query=query, connection_id=5)
    data = data.lazy()
    geofence_df = get_geofence_data()
    data = data.with_row_index("ALERT_ID")
    data = data.with_columns([
        (pl.col("START_LATITUDE") * np.pi / 180).alias("ALERT_LAT_RAD"),
        (pl.col("START_LONGITUDE") * np.pi / 180).alias("ALERT_LON_RAD"),
    ])
    data = (
        data.lazy()
        .map_batches(lambda batch: compute_geofence_batch(batch, geofence_df=geofence_df),
                     validate_output_schema=False)
        .collect()
    )
    # joined = (
    #     data
    #     .join(geofence_df.lazy(), how="cross")
    #     .with_columns([
    #         (pl.col("LAT_RAD") - pl.col("ALERT_LAT_RAD")).alias("DLAT"),
    #         (pl.col("LON_RAD") - pl.col("ALERT_LON_RAD")).alias("DLON"),
    #     ])
    #     .with_columns([
    #         # Haversine
    #         (
    #                 2
    #                 * pl.arctan2(
    #             ((pl.col("DLAT") / 2).sin().pow(2)
    #              + pl.col("ALERT_LAT_RAD").cos() * pl.col("LAT_RAD").cos()
    #              * (pl.col("DLON") / 2).sin().pow(2)
    #              ).sqrt(),
    #             (
    #                     1 - (
    #                     (pl.col("DLAT") / 2).sin().pow(2)
    #                     + pl.col("ALERT_LAT_RAD").cos() * pl.col("LAT_RAD").cos()
    #                     * (pl.col("DLON") / 2).sin().pow(2)
    #             )
    #             ).sqrt()
    #         ) * speed_violation_cfg['earth_radius']
    #         ).alias("DIST_KM")
    #     ])
    #     # Keep only geofences where DIST <= RADIUS
    #     .filter(pl.col("DIST_KM") <= pl.col("RADIUS"))
    #     # Sort geofences per alert
    #     .sort(["ALERT_ID", "DIST_KM"])
    #     # Pick nearest geofence
    #     .group_by("ALERT_ID")
    #     .agg([
    #         pl.first("GEOFENCE_TYPE").alias("ALERT_GEOFENCE_TYPE")
    #     ])
    #     .collect()
    # )
    # data = data.join(joined.lazy(), on="ALERT_ID", how="left").with_columns(
    #     pl.col("ALERT_GEOFENCE_TYPE").fill_null("NA")
    # )
    data = (
        data
        .with_columns([
            # Normal overspeed
            (
                    (pl.col("ALERT_GEOFENCE_TYPE") != "Accident Prone Area") &
                    (pl.col("START_SPEED") > speed_violation_cfg['normal_speed']) &
                    (pl.col("DURATION") >= speed_violation_cfg['max_violation_count_normal_speed'])
            ).alias("is_normal_over"),

            # Accident-prone overspeed
            (
                    (pl.col("ALERT_GEOFENCE_TYPE") == "Accident Prone Area") &
                    (pl.col("START_SPEED") > speed_violation_cfg['accident_speed']) &
                    (pl.col("DURATION") >= speed_violation_cfg['max_violation_count_accident_speed'])
            ).alias("is_acc_over"),
        ])
        .group_by(["TT_NUMBER", "INVOICE_NO"])
        .agg([
            pl.col("ZONE").first(),
            pl.col("LOCATION").first(),
            pl.col("TRANSPORTER_ID").first(),
            pl.col("START_SPEED").max().alias("MAX_START_SPEED"),
            pl.col("DURATION").max().alias("MAX_DURATION"),
            pl.sum("is_normal_over").alias("normal_streaks"),
            pl.sum("is_acc_over").alias("acc_streaks"),

            # Violations = floor(streaks / 3)
            (pl.sum("is_normal_over") // speed_violation_cfg['max_violation_count_normal_speed']).alias("normal_violation"),
            (pl.sum("is_acc_over") // speed_violation_cfg['max_violation_count_normal_speed']).alias("accident_violation"),

            # Total
            ((pl.sum("is_normal_over") // speed_violation_cfg['max_violation_count_normal_speed']) +
             (pl.sum("is_acc_over") // speed_violation_cfg['max_violation_count_normal_speed'])).alias("total_violations")
        ])
    )
    return data

async def itdg_stoppage_violation():
    geofence_df = get_geofence_data()
    stoppage_violation_cfg = {
        "unauth_stoppage_with_rd": 30,
        "max_violation_count_unauth_stoppage_with_rd": 1,
        "max_violation_count_unauth_stoppage_with_rd_condition": ">",
        "unauth_stoppage_without_rd": 60,
        "max_violation_count_unauth_stoppage_without_rd": 1,
        "max_violation_count_unauth_stoppage_without_rd_condition": ">",
        "cumulative_stoppage": 120,
        "cumulative_stoppage_condition": ">",
        "cumulative_stoppage_ignore": 10,
        "cumulative_stoppage_ignore_condition": "<",
        "trip_status": ["LOADED", "RETURN", "UN LOADED"],
        "group_by": ["TT_NUMBER", "INVOICE_NO", "LOAD_NO"],
        "violation_label": "Stoppage Violation"
    }
    query_with_rd = f"""SELECT "TRIP_STATUS", "START_SPEED", "START_SPEED", "DURATION", "LOCATION_TYPE", "TT_NUMBER", "INVOICE_NO",
              "ZONE", "LOCATION", "LOAD_NO", "TRANSPORTER_ID" FROM "STOPPAGE" WHERE "LOCATION_TYPE" = 'TAS'"""
    query_only_rd = f"""SELECT "TRIP_STATUS", "START_SPEED", "START_SPEED", "DURATION", "LOCATION_TYPE", "TT_NUMBER", "INVOICE_NO",
              "ZONE", "LOCATION", "LOAD_NO", "TRANSPORTER_ID" FROM "STOPPAGE_ROUTE_DEVIATION" WHERE "LOCATION_TYPE" = 'TAS'"""

    data_with_rd = await _get_data_from_vts(query=query_with_rd, connection_id=5)
    data_only_rd = await _get_data_from_vts(query=query_only_rd, connection_id=5)
    data_with_rd = data_with_rd.rename({"STOPPAGE_LATITUDE": "START_LATITUDE", "STOPPAGE_LONGITUDE": "START_LONGITUDE"})
    data_with_rd = data_with_rd.filter(pl.col("TRIP_STATUS").is_in(stoppage_violation_cfg["trip_status"]))

    data_only_rd = data_only_rd.filter(pl.col("TRIP_STATUS").is_in(stoppage_violation_cfg["trip_status"]))

    data_with_rd = data_with_rd.with_columns([
        pl.col("DURATION").cast(pl.Int64)
    ])
    data_only_rd = data_only_rd.with_columns([
        pl.col("DURATION").cast(pl.Int64)
    ])

    match_cols = [
        "DESTINATION",
        "TT_NUMBER",
        "TRANSPORTER_ID",
        "INVOICE_NO",
        "LOAD_NO",
        "START_LATITUDE",
        "START_LONGITUDE",
    ]

    data_with_rd = (
        data_with_rd.lazy()
        .join(
            data_only_rd.lazy().select(match_cols),
            on=match_cols,
            how="anti"
        )
    )
    data_with_rd = data_with_rd.collect()
    data_with_rd = data_with_rd.with_row_index("ALERT_ID")
    data_with_rd = data_with_rd.with_columns([
        (pl.col("START_LATITUDE") * np.pi / 180).alias("ALERT_LAT_RAD"),
        (pl.col("START_LONGITUDE") * np.pi / 180).alias("ALERT_LON_RAD"),
    ])
    data_with_rd = (
        data_with_rd.lazy()
        .map_batches(lambda batch: compute_geofence_batch(batch, geofence_df=geofence_df),
                     validate_output_schema=False)
        .collect()
    )
    data_only_rd = (
        data_only_rd.filter(
            (
                pl.col("TRIP_STATUS").is_in(stoppage_violation_cfg["trip_status"])
            )
            & (pl.col("DURATION") > stoppage_violation_cfg["unauth_stoppage_with_rd"])
            & (pl.col("LOCATION_TYPE") != 'LPG')
        )
    )
    data_only_rd = (
        data_only_rd
        .group_by(stoppage_violation_cfg['group_by'])
        .agg([
            pl.col("ZONE").first(),
            pl.col("LOCATION").first(),
            pl.col("TRANSPORTER_ID").first(),
            pl.col("DURATION").max().alias("MAX_DURATION"),
            pl.len().alias("VIOLATION_COUNT"),
        ]).filter(
            pl.col("VIOLATION_COUNT") >= stoppage_violation_cfg["max_violation_count_unauth_stoppage_with_rd"])
    )

    rule_a = (
        data_with_rd.filter((pl.col("ALERT_GEOFENCE_TYPE") == "UnAuthorised") &
                            (pl.col("DURATION") > stoppage_violation_cfg['unauth_stoppage_without_rd']))
        .group_by(["TT_NUMBER", "INVOICE_NO", "LOAD_NO"])
        .agg([
            pl.col("ZONE").first(),
            pl.col("LOCATION").first(),
            pl.col("TRANSPORTER_ID").first(),
            pl.col("DURATION").max(),
            pl.len().alias("violation_rule_a"),
        ])
    )
    rule_b = (
        data_with_rd.filter((pl.col("ALERT_GEOFENCE_TYPE") == "UnAuthorised") & (pl.col("DURATION") > stoppage_violation_cfg['cumulative_stoppage_ignore']))
        .group_by(["TT_NUMBER", "INVOICE_NO", "LOAD_NO"])
        .agg([
            pl.sum("DURATION").alias("DURATION"),
            pl.col("ZONE").first(),
            pl.col("LOCATION").first(),
            pl.col("TRANSPORTER_ID").first(),
        ])
        .with_columns(
            (pl.col("DURATION") > stoppage_violation_cfg['cumulative_stoppage'])
            .cast(pl.Int8)
            .alias("violation_rule_b")
        )
    )
    data_with_rd = (
        rule_a.join(rule_b, on=["TT_NUMBER", "INVOICE_NO", "LOAD_NO", "ZONE", "LOCATION", "TRANSPORTER_ID"], how="full",
                    coalesce=True)
        .fill_null(0)
        .with_columns(
            (pl.col("violation_rule_a") + pl.col("violation_rule_b"))
            .alias("total_violations")
        ).rename({"DURATION_right": "SUM_DURATION", "DURATION": "MAX_DURATION"})
    )
    return pl.concat([data_with_rd, data_only_rd], how="diagonal_relaxed")

async def itdg_route_deviation():
    route_deviation_config = {
        "min_duration_minutes": 15,
        "duration_condition": ">",
        "max_violation_count": 1,
        "max_violation_count_condition": ">",
        "trip_status": ["LOADED"],
        "group_by": ["TT_NUMBER", "INVOICE_NO", "LOAD_NO"],
        "violation_label": "Route Deviation Violation"
    }
    query = f"""SELECT "TRIP_STATUS", "START_SPEED", "START_SPEED", "DURATION", "LOCATION_TYPE", "TT_NUMBER", "INVOICE_NO",
                "ZONE", "LOCATION", "LOAD_NO", "TRANSPORTER_ID" FROM "ROUTE_DEVIATION" WHERE "LOCATION_TYPE" = 'TAS'"""
    data = await _get_data_from_vts(query=query, connection_id=5)
    data = data.lazy()
    data = data.with_columns([
        pl.col("DURATION").cast(pl.Int64)
    ])

    data = (
        data.filter(
            (pl.col("TRIP_STATUS").is_in(route_deviation_config["trip_status"]))
            & (pl.col("DURATION") > route_deviation_config["min_duration_minutes"])
        )
    )

    data = (
        data
        .group_by(route_deviation_config['group_by'])
        .agg([
            pl.col("ZONE").first(),
            pl.col("LOCATION").first(),
            pl.col("TRANSPORTER_ID").first(),
            pl.col("START_SPEED").max().alias("MAX_START_SPEED"),
            pl.col("DURATION").max().alias("MAX_DURATION"),
            pl.len().alias("VIOLATION_COUNT"),
        ]).filter(pl.col("VIOLATION_COUNT") > route_deviation_config["max_violation_count"])
    )

    return data.collect()

async def itdg_night_driving():
    night_driving_config = {
        "start_time": "23:00:00",
        "end_time": "05:00:00",
        "min_duration_minutes": 30,
        "duration_condition": ">",
        "max_violation_count": 0,
        "max_violation_count_condition": ">",
        "trip_status": ["LOADED", "RETURN", "UN LOADED"],
        "group_by": ["TT_NUMBER", "INVOICE_NO", "LOAD_NO"],
        "violation_label": "Night Driving Violation"
    }
    # Time range boundaries
    start_t = time.fromisoformat(night_driving_config["start_time"])
    end_t = time.fromisoformat(night_driving_config["end_time"])

    query = f"""SELECT "TRIP_STATUS", "START_SPEED", "START_SPEED", "DURATION", "LOCATION_TYPE", "TT_NUMBER", "INVOICE_NO",
                    "ZONE", "LOCATION", "LOAD_NO", "TRANSPORTER_ID", "EVENT_DATE"  FROM "NIGHT_DRIVING" WHERE "LOCATION_TYPE" = 'TAS'"""
    data = await _get_data_from_vts(query=query, connection_id=5)
    data = data.lazy()
    # data = (
    #     data
    #     .with_columns([
    #         pl.col("DURATION").cast(pl.Int64),
    #         pl.col("EVENT_DATE").str.strptime(pl.Datetime).alias("EVENT_DATETIME"),
    #     ])
    #     .with_columns([
    #         pl.col("EVENT_DATETIME").dt.time().alias("EVENT_TIME")
    #     ])
    # )
    #
    #
    # # Apply filters
    # data = (
    #     data.filter(
    #         (pl.col("TRIP_STATUS").is_in(night_driving_config["trip_status"]))
    #         & (pl.col("EVENT_TIME") >= start_t) | (pl.col("EVENT_TIME") <= end_t)
    #         & (pl.col("DURATION") > night_driving_config["min_duration_minutes"])
    #     )
    # )

    # other logic
    # Build violations logic exactly like your Pandas version
    data = data.with_columns([
        pl.col("START_DATETIME").str.strptime(pl.Datetime),
        pl.col("END_DATETIME").str.strptime(pl.Datetime),
        pl.col("DURATION").cast(pl.Int64)
    ])

    data = data.with_columns([
        pl.col("START_DATETIME").dt.time().alias("START_TIME"),
        pl.col("END_DATETIME").dt.time().alias("END_TIME")
    ])

    # Case 1: Fully within night window
    case1 = (
            (pl.col("START_TIME") >= start_t) |
            (pl.col("START_TIME") <= end_t)
    )

    # Case 2: Crosses midnight: start < 23:00 and end > 05:00
    case2 = (
            (pl.col("START_TIME") < start_t) &
            (pl.col("END_TIME") > end_t)
    )

    # Case 3: Partial overlap
    case3 = (
            ((pl.col("START_TIME") < start_t) & (pl.col("END_TIME") >= start_t)) |
            ((pl.col("START_TIME") <= end_t) & (pl.col("END_TIME") > end_t))
    )

    # Combine cases + minimum duration
    data = (
        data
        .filter(pl.col("DURATION") > night_driving_config["min_duration_minutes"])
        .filter(case1 | case2 | case3)
    )

    # Grouping violations
    data = (
        data
        .group_by(night_driving_config["group_by"])
        .agg([
            pl.col("ZONE").first(),
            pl.col("LOCATION").first(),
            pl.col("TRANSPORTER_ID").first(),
            pl.col("DURATION").max().alias("MAX_DURATION"),
            pl.len().alias("VIOLATION_COUNT"),
        ]).filter(pl.col("VIOLATION_COUNT") > night_driving_config["max_violation_count"])
    )
    return data.collect()

async def itdg_power_disconnect():
    power_disconnect_config = {
        "min_duration_minutes": 1,
        "duration_condition": ">",
        "max_violation_count": 0,
        "max_violation_count_condition": ">",
        "trip_status": ["LOADED", "RETURN", "UN LOADED"],
        "group_by": ["TT_NUMBER", "INVOICE_NO", "LOAD_NO"],
        "violation_label": "Power Disconnect Violation"
    }
    query = f"""SELECT "TRIP_STATUS", "START_SPEED", "START_SPEED", "DURATION", "LOCATION_TYPE", "TT_NUMBER", "INVOICE_NO",
                       "ZONE", "LOCATION", "LOAD_NO", "TRANSPORTER_ID"  FROM "POWER_DISCONNECT" WHERE "LOCATION_TYPE" = 'TAS'"""
    data = await _get_data_from_vts(query=query, connection_id=5)
    data = data.lazy()
    data = data.with_columns([
        pl.col("DURATION").cast(pl.Int64)
    ])
    data = (
        data.filter(
            (pl.col("TRIP_STATUS").is_in(power_disconnect_config["trip_status"]))
            & (pl.col("DURATION") > power_disconnect_config["min_duration_minutes"])
        )
    )

    data = (
        data
        .group_by(power_disconnect_config['group_by'])
        .agg([
            pl.col("ZONE").first(),
            pl.col("LOCATION").first(),
            pl.col("TRANSPORTER_ID").first(),
            pl.col("START_SPEED").max().alias("MAX_START_SPEED"),
            pl.col("DURATION").max().alias("MAX_DURATION"),
            pl.len().alias("VIOLATION_COUNT"),
        ]).filter(pl.col("VIOLATION_COUNT") > power_disconnect_config["max_violation_count"])
    )

    return data.collect()

async def itdg_device_tampering():
    device_tamper_config = {
        "min_duration_minutes": 1,
        "duration_condition": ">",
        "max_violation_count": 0,
        "max_violation_count_condition": ">",
        "trip_status": ["LOADED", "RETURN", "UN LOADED"],
        "group_by": ["TT_NUMBER", "INVOICE_NO", "LOAD_NO"],
        "violation_label": "Device Tamper Violation"
    }
    query = f"""SELECT "TRIP_STATUS", "START_SPEED", "START_SPEED", "DURATION", "LOCATION_TYPE", "TT_NUMBER", "INVOICE_NO",
                       "ZONE", "LOCATION", "LOAD_NO", "TRANSPORTER_ID"  FROM "DEVICE_REMOVED" WHERE "LOCATION_TYPE" = 'TAS'"""
    data = await _get_data_from_vts(query=query, connection_id=5)
    data = data.lazy()
    data = data.with_columns([
        pl.col("DURATION").cast(pl.Int64)
    ])
    data = (
        data.filter(
            (pl.col("TRIP_STATUS").is_in(device_tamper_config["trip_status"]))
            & (pl.col("DURATION") > device_tamper_config["min_duration_minutes"])
        )
    )

    data = (
        data
        .group_by(device_tamper_config['group_by'])
        .agg([
            pl.col("ZONE").first(),
            pl.col("LOCATION").first(),
            pl.col("TRANSPORTER_ID").first(),
            pl.col("START_SPEED").max().alias("MAX_START_SPEED"),
            pl.col("DURATION").max().alias("MAX_DURATION"),
            pl.len().alias("VIOLATION_COUNT"),
        ]).filter(pl.col("VIOLATION_COUNT") > device_tamper_config["max_violation_count"])
    )

    return data.collect()

async def itdg_continuous_driving():
    continuous_driving_config = {
        "min_duration_minutes": 240,
        "duration_condition": ">",
        "max_violation_count": 0,
        "max_violation_count_condition": ">",
        "trip_status": ["LOADED", "RETURN", "UN LOADED"],
        "group_by": ["TT_NUMBER", "INVOICE_NO", "LOAD_NO"],
        "violation_label": "Continuous Driving Violation"
    }
    query = f"""SELECT "TRIP_STATUS", "START_SPEED", "START_SPEED", "DURATION", "LOCATION_TYPE", "TT_NUMBER", "INVOICE_NO",
                       "ZONE", "LOCATION", "LOAD_NO", "TRANSPORTER_ID"  FROM "CONTINUOUS_DRIVING" WHERE "LOCATION_TYPE" = 'TAS'"""
    data = await _get_data_from_vts(query=query, connection_id=5)
    data = data.lazy()
    data = data.with_columns([
        pl.col("DURATION").cast(pl.Int64)
    ])
    data = (
        data.filter(
            (pl.col("TRIP_STATUS").is_in(continuous_driving_config["trip_status"]))
            & (pl.col("DURATION") > continuous_driving_config["min_duration_minutes"])
        )
    )

    data = (
        data
        .group_by(continuous_driving_config['group_by'])
        .agg([
            pl.col("ZONE").first(),
            pl.col("LOCATION").first(),
            pl.col("TRANSPORTER_ID").first(),
            pl.col("START_SPEED").max().alias("MAX_START_SPEED"),
            pl.col("DURATION").max().alias("MAX_DURATION"),
            pl.len().alias("VIOLATION_COUNT"),
        ]).filter(pl.col("VIOLATION_COUNT") > continuous_driving_config["max_violation_count"])
    )
    return data.collect()