import urdhva_base
import os
import io
import base64
import xlsxwriter
import json
import datetime
import time
import ast
import requests
import asyncio
import traceback
import pandas as pd
import polars as pl
import hpcl_ceg_model
import charts_actions
import mysql.connector
import urdhva_base.redispool
import dashboard_studio_model
import utilities.helpers as helpers
from hpcl_ceg_enum import IndentStatus as IndentStatus
import utilities.interlock_mapping as interlock_mapping
import orchestrator.analytics.ro_analysis as ro_analysis
from orchestrator.workflow.workflow_process import Camunda
from dashboard_studio_model import Charts_Get_Distinct_ValuesParams
from orchestrator.dbconnector.widget_actions import widget_actions
from api_manager.charts_actions import charts_connection_vault_routing
import orchestrator.dbconnector.credential_loader as credential_loader
from orchestrator.dbconnector.widget_actions.lpg_plant_queries import today
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams
from utilities.connection_mapping import product_code_mapping, connection_mapping

req_keys = {
    "TAS": ["zone", "sap_id", "name", "category", "location_onboard"],
    "LPG": ["zone", "sap_id", "name", "category"],
    "RO": ["zone", 'region', "sales_area", "terminal_plant_id", "terminal_plant_name", "category", "sap_id", "name"],
    "DS": ["zone", 'region', "sales_area", "terminal_plant_id", "terminal_plant_name", "sap_id", "name"]
}

async def flatten_zone(rows):
        out = []

        for rec in rows:
            val = rec['zone']

            # CASE 1: value is a string that looks like a list
            if isinstance(val, str) and val.startswith('[') and val.endswith(']'):
                try:
                    parsed = ast.literal_eval(val)  # convert string → actual list
                    out.extend(parsed)
                except:
                    out.append(val)

            # CASE 2: value is a real list
            elif isinstance(val, list):
                out.extend(val)

            # CASE 3: normal single string
            else:
                if val:  # skip empty strings
                    out.append(val)

        cleaned = list(set(out))

        print('*' * 100)
        print('Flattened zone:', cleaned)
        print('*' * 100)

        return cleaned

async def flatten_region(rows):
        out = []

        for rec in rows:
            val = rec['region']

            # CASE 1: value is a string that looks like a list
            if isinstance(val, str) and val.startswith('[') and val.endswith(']'):
                try:
                    parsed = ast.literal_eval(val)  # convert string → actual list
                    out.extend(parsed)
                except:
                    out.append(val)

            # CASE 2: value is a real list
            elif isinstance(val, list):
                out.extend(val)

            # CASE 3: normal single string
            else:
                if val:  # skip empty strings
                    out.append(val)

        cleaned = list(set(out))

        print('*' * 100)
        print('Flattened region:', cleaned)
        print('*' * 100)

        return cleaned

async def flatten_sales_area(rows):
        out = []

        for rec in rows:
            val = rec['sales_area']

            # CASE 1: value is a string that looks like a list
            if isinstance(val, str) and val.startswith('[') and val.endswith(']'):
                try:
                    parsed = ast.literal_eval(val)  # convert string → actual list
                    out.extend(parsed)
                except:
                    out.append(val)

            # CASE 2: value is a real list
            elif isinstance(val, list):
                out.extend(val)

            # CASE 3: normal single string
            else:
                if val:  # skip empty strings
                    out.append(val)

        cleaned = list(set(out))

        print('*' * 100)
        print('Flattened sales_area:', cleaned)
        print('*' * 100)

        return cleaned

async def get_locations(bu, zone=[], region=[], sales_area=[], plant=[], cat_a_dealers=False, dry_out_dealers=False, location_onboard=False):
    """
    This function is used to get the location information for a given BU.
    It fetches the location master data from Redis and filters based on the BU provided.
    If zone, region and sales_area are provided, then it filters based on those as well.
    :param bu:
    :param zone:
    :param region:
    :param sales_area:
    :param plant:
    :param cat_a_dealers
    :param dry_out_dealers
    :return:
    """
    bu = bu.upper()
    cond = await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)
    dry_out_plants = []
    dry_out_customers = []
    for rec in cond:        
        if rec['key'] == 'zone':
            if not zone:
                zone = []
            if isinstance(rec['value'], list):
                zone.extend(rec['value'])
            else:
                zone.append(rec['value'])
        elif rec['key'] == 'region':
            if not region:
                region = []
            if isinstance(rec['value'], list):
                region.extend(rec['value'])
            else:
                region.append(rec['value'])
            if region and not zone:
                regions = "', '".join(region)
                query = f"""select DISTINCT zone from location_master where region IN ('{regions}') and bu='{bu}' """
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
                if resp['data']:
                    zone = await flatten_zone(resp['data'])
        elif rec['key'] == 'sales_area':
            if not sales_area:
                sales_area = []
            if isinstance(rec['value'], list):
                sales_area.extend(rec['value'])
            else:
                sales_area.append(rec['value'])
            if sales_area and not zone:
                sales_areas = "', '".join(sales_area)
                query = f"""select DISTINCT zone from location_master where sales_area IN ('{sales_areas}') and bu='{bu}' """
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
                if resp['data']:
                    zone = await flatten_zone(resp['data'])
            
            if sales_area and not region:
                sales_areas = "', '".join(sales_area)
                query = f"""select DISTINCT region from location_master where sales_area IN ('{sales_areas}') and bu='{bu}' """
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
                if resp['data']:
                    region = await flatten_region(resp['data'])
        elif rec['key'] == 'sap_id':
            if not plant:
                plant = []
            if isinstance(rec['value'], list):
                plant.extend(rec['value'])
            else:
                if "," in rec['value']:
                    plant.extend([x for x in rec['value'].split(",")])
                else:
                    plant.append(rec['value'])
            if plant and not zone:
                plants = "', '".join(plant)
                query = f"""select DISTINCT zone from location_master where sap_id IN ('{plants}') and bu='{bu}' """
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
                if resp['data']:
                    zone = await flatten_zone(resp['data'])
            
            if plant and not region:
                plants = "', '".join(plant)
                query = f"""select DISTINCT region from location_master where sap_id IN ('{plants}') and bu='{bu}' """
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
                if resp['data']:
                    region = await flatten_region(resp['data'])
            
            if plant and not sales_area:
                plants = "', '".join(plant)
                query = f"""select DISTINCT sales_area from location_master where sap_id IN ('{plants}') and bu='{bu}' """
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
                if resp['data']:
                    sales_area = await flatten_sales_area(resp['data'])

    redis_client = await urdhva_base.redispool.get_redis_connection()
    location_data = await redis_client.hgetall("location_master")

    bu_data = [json.loads(helpers.normalize_string(rec)) for key, rec in location_data.items()
               if helpers.normalize_string(key).startswith(f"{bu}_")]
    bu_data = pd.DataFrame(bu_data)
    for key in req_keys[bu]:
        if key not in bu_data:
            bu_data[key] = ""
    bu_data = bu_data[req_keys[bu]]
    bu_data.fillna("", inplace=True)
    if bu.upper() in ["RO","DS"]:
        # Updating Plant Name in case if missing
        tas_data = [json.loads(helpers.normalize_string(rec)) for key, rec in location_data.items()
                    if helpers.normalize_string(key).startswith(f"TAS_")]
        terminal_name_mapping = {rec['sap_id']: rec['name'] for rec in tas_data}
        bu_data['terminal_plant_name'] = bu_data['terminal_plant_id'].apply(lambda x: terminal_name_mapping.get(x, x))
        bu_data = bu_data[bu_data['terminal_plant_name'].notna()]
    final_data = {"zone": {}, "plant": {}, "customer": {}}
    if bu.upper() in ["RO","DS"]:
        final_data.update({"region": {}, "sales_area": {}, "customer": {}})

    def check_category(category):
        if category and category.upper() == "R01":
            return "A"
        return ""

    key_mapping = {}

    # Filtering zone
    for rec in bu_data.to_dict(orient='records'):
        if rec["zone"]:
            # Shrihari commented
            # if cond and plant and rec['sap_id'] not in plant:
            if cond and zone and rec['zone'] not in zone:
                continue
            elif cond and plant and rec['sap_id'] not in plant:
                continue
            final_data["zone"][rec["zone"]] = {"name": rec["zone"], "id": rec["zone"]}
    if dry_out_dealers:
        query = """select dealer_id, terminal_plant_id
                from public.alerts where interlock_name='Dry Out Each Indent Wise MainFlow' and dry_out_in_days='1' and 
                alert_status in ('Open', 'InProgress') 
                group by dealer_id, terminal_plant_id"""
        data = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=10000)
        dry_out_plants = list(set([rec['terminal_plant_id'] for rec in data['data']]))
        dry_out_customers = list(set([rec['dealer_id'] for rec in data['data']]))
    if zone:
        key_mapping["zone"] = zone
    if bu in ["TAS", "LPG"]:
        for rec in bu_data.to_dict(orient='records'):
            skip_record = False
            if key_mapping:
                for key, value in key_mapping.items():
                    if rec.get(key) not in value:
                        skip_record = True
                        break
            if skip_record or not rec["sap_id"]:
                continue
            if rec["sap_id"]:
                if plant and rec['sap_id'] not in plant:
                    continue
                if dry_out_dealers and rec["sap_id"] not in dry_out_plants:
                    continue
                final_data["plant"][rec["sap_id"]] = {"name": rec["name"], "id": rec["sap_id"]}
        bu_data_ro = [json.loads(helpers.normalize_string(rec)) for key, rec in location_data.items()
                      if helpers.normalize_string(key).startswith(f"RO_")]
        bu_data_ro = pd.DataFrame(bu_data_ro)
        for key in ["name", "category"]:
            if key not in bu_data_ro:
                bu_data_ro[key] = ""
            bu_data_ro[key] = bu_data_ro[key].fillna("")
        # bu_data_ro['name'] = bu_data_ro['name'].fillna("")
        # bu_data_ro['category'] = bu_data_ro['category'].fillna("")
        if plant:
            key_mapping["terminal_plant_id"] = plant
        for rec in bu_data_ro.to_dict(orient='records'):
            skip_record = False
            if key_mapping:
                for key, value in key_mapping.items():
                    if rec.get(key) not in value:
                        skip_record = True
                        break
            if skip_record or not rec["sap_id"]:
                continue
            if rec["sap_id"]:
                if dry_out_dealers and rec["sap_id"] not in dry_out_customers:
                    continue
                if cat_a_dealers and check_category(rec['category']) != "A":
                    continue
                final_data["customer"][rec["sap_id"]] = {"name": str(rec["sap_id"]) + " - " + rec["name"], "id": rec["sap_id"],
                                                         "category": check_category(rec['category'])}
    else:
        if region:
            key_mapping["region"] = region

        # Filtering region
        for rec in bu_data.to_dict(orient='records'):
            skip_record = False
            if key_mapping:
                for key, value in key_mapping.items():
                    if rec.get(key) not in value:
                        skip_record = True
                        break
            if skip_record or not rec.get("region"):
                continue
            if rec.get("region"):
                final_data["region"][rec["region"]] = {"name": rec["region"], "id": rec["region"]}

        # Filtering Sales Area
        if sales_area:
            key_mapping["sales_area"] = sales_area
        for rec in bu_data.to_dict(orient='records'):
            skip_record = False
            if key_mapping:
                for key, value in key_mapping.items():
                    if rec.get(key) not in value:
                        skip_record = True
                        break
            if skip_record or not rec.get("sales_area"):
                continue
            if rec.get("sales_area"):
                final_data["sales_area"][rec["sales_area"]] = {"name": rec["sales_area"], "id": rec["sales_area"]}

        # Filtering Plant
        for rec in bu_data.to_dict(orient='records'):
            skip_record = False
            if key_mapping:
                for key, value in key_mapping.items():
                    if rec.get(key) not in value:
                        skip_record = True
                        break
            if skip_record or not rec["sap_id"]:
                continue
            if rec["sap_id"]:
                if dry_out_dealers and rec["sap_id"] not in dry_out_customers:
                    continue
                if cat_a_dealers and check_category(rec['category']) != "A":
                    continue
                final_data["customer"][rec["sap_id"]] = {"name": rec["name"], "id": rec["sap_id"],
                                                         "category": check_category(rec.get('category',None))}

    for key, details in final_data.items():
        final_data[key] = list(details.values())

    # adding products
    final_data["products"] = [{"name": val, "id": key} for val, key in product_code_mapping.items()]

    return final_data

async def get_filtered_location_data(bu, request_parameter, filters):
    """
    Fetch and filter location data for a given business unit (BU).

    :param bu: Business Unit (e.g., "RO", "TAS")
    :param request_parameter: The key to retrieve (e.g., "name", "zone", "dry-out", etc.)
    :param filters: A list of filter objects containing `key`, `value`, and `cond` (condition: "contains" or "equals").
    :return: Filtered location data as a list of dictionaries.
    """
    # Ensure business unit is in uppercase
    bu = bu.upper()

    # Connect to Redis and fetch location data
    redis_client = await urdhva_base.redispool.get_redis_connection()
    location_data = await redis_client.hgetall("location_master")

    # Filter data by business unit
    bu_data = [
        json.loads(helpers.normalize_string(rec))
        for key, rec in location_data.items()
        if helpers.normalize_string(key).startswith(f"{bu}_")
    ]

    # Convert the filtered data to a pandas DataFrame
    bu_data = pd.DataFrame(bu_data)

    # Ensure required keys are present in the DataFrame, filling with empty strings if missing
    for key in req_keys[bu]:
        if key not in bu_data:
            bu_data[key] = ""

    # Restrict DataFrame to only the required keys
    bu_data = bu_data[req_keys[bu]]

    # Replace NaN values with empty strings
    bu_data.fillna("", inplace=True)
    dry_out_locations = False
    if request_parameter == "dry-out":
        dry_out_locations = True
        request_parameter = "name"

    # Apply filters to the DataFrame
    for filter in filters:
        if filter.cond.lower() == "contains":
            # Filter rows where the value of the key contains any of the strings in filter.value
            bu_data = bu_data[bu_data[filter.key].str.contains('|'.join(filter.value), case=False, na=False)]
        else:
            # Filter rows where the value of the key matches exactly with filter.value
            bu_data = bu_data[bu_data[filter.key].isin(filter.value)]

    # If the request is for names, process the output accordingly
    if request_parameter == "name":
        fields = ["sap_id", "name"]
        if bu == "RO":
            # Add "category" field for RO business unit
            fields.append("category")

        # Restrict DataFrame to the required fields and rename "sap_id" to "id"
        bu_data = bu_data[fields]
        bu_data.rename(columns={"sap_id": "id"}, inplace=True)

        # Drop rows where "id" is null
        bu_data = bu_data[bu_data.id.notna()]

        # Convert DataFrame to a list of dictionaries
        return bu_data.to_dict(orient='records')

    else:
        # Process the DataFrame to get unique values for the requested parameter
        bu_data = bu_data[[request_parameter]]
        unique_keys_list = [key for key in list(bu_data[request_parameter].unique()) if key]

        # Convert unique values into a list of dictionaries with "id" and "name"
        resp = [{'id': key, "name": key} for key in unique_keys_list]
        # Filtering dry out locations
        if dry_out_locations:
            query = ("select DISTINCT(sap_id) from alerts where interlock_name = 'Dry Out Each Indent Wise MainFlow' "
                     "and alert_status='Open'")
            data = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=10000)
            dry_out_locations = [rec['sap_id'] for rec in data['data']]
            resp = [rec for rec in resp if rec['id'] in dry_out_locations]
        return resp

async def get_carry_fwd_indent(get_only_dry_out_ro: bool):
    query = f"""SELECT DISTINCT 
                    "LOCN_CODE", 
                    SUBSTR("DEALER_CODE", 3, 8) AS "DEALER_CODE",
                    "PROD_REQD_DT",
                    "INDENT_NO"
                FROM 
                    "IMS_SAP"."INDENT_REQUEST"
                WHERE 
                    "PROD_REQD_DT" < SYSDATE
                    AND "TRUCK_REGNO" IS NULL
                    AND "CANCEL_INDENT" IS NULL
                    AND "VALID_INDENT" IN ('Y', 'H')
                ORDER BY 
                    "LOCN_CODE" """

    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get("ims", "1")
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    data = await function(query=query)
    data = pd.DataFrame(data)
    data['DEALER_CODE'] = str(data['DEALER_CODE']) + '-' + str(data['INDENT_NO'])

    if get_only_dry_out_ro:
        query = f"""SELECT DISTINCT 
                        ir."LOCN_CODE",
                        SUBSTR(ir."DEALER_CODE", 3, 8) AS "DEALER_CODE",
                       ir. "INDENT_NO",
                       ir."PROD_REQD_DT"
                    FROM 
                        "IMS_SAP"."INDENT_REQUEST" ir
                    INNER JOIN 
                        "alerts" a
                    ON 
                        SUBSTR(ir."DEALER_CODE", 3, 8) = a."dealer_id"
                        AND ir."INDENT_NO"::TEXT = a."indent_no"::TEXT
                    WHERE 
                        ir."PROD_REQD_DT" < CURRENT_DATE
                        AND ir."TRUCK_REGNO" IS NULL
                        AND ir."CANCEL_INDENT" IS NULL
                        AND ir."VALID_INDENT" IN ('Y', 'H')"""

    return data['DEALER_CODE'].unique().tolist()

async def get_indent_pattern(is_cat_a: bool, dealer_code: str = None):
    if is_cat_a:
        dealer_code_condition = []
        dealer_code_condition = ", ".join(f"'{code}'" for code in dealer_code_condition)
        where_clause = f"""
            WHERE 
                SUBSTR(a."DEALER_CODE", 1, 10) = '{dealer_code_condition}'
                AND a."CANCEL_INDENT" IS NULL 
                AND a."VALID_INDENT" != 'N'
                AND a."INDENT_DATE" >= ADD_MONTHS(SYSDATE, -3)
            """
    elif dealer_code:
        # dealer_codes = ", ".join(f"'{code}'" for code in dealer_code)
        where_clause = f"""
            WHERE 
                SUBSTR(a.DEALER_CODE, 1, 10) = '{dealer_code}'
                AND a."CANCEL_INDENT" IS NULL 
                AND a."VALID_INDENT" != 'N'
                AND a."INDENT_DATE" >= ADD_MONTHS(SYSDATE, -3)
            """
    else:
        where_clause = """
            WHERE 
                a."CANCEL_INDENT" IS NULL 
                AND a."VALID_INDENT" != 'N'
                AND a."INDENT_DATE" >= ADD_MONTHS(SYSDATE, -3)
            """
    query = f"""WITH base_data AS (
                    SELECT 
                        TRUNC(a."INDENT_DATE") AS "INDENT_DATE", 
                        a."INDENT_NO", 
                        a."DEALER_CODE", 
                        a."LOCN_CODE", 
                        b."PROD"
                    FROM 
                        "IMS_SAP"."INDENT_REQUEST" a
                    INNER JOIN 
                        "IMS_SAP"."INDENT_PRODUCTS" b
                    ON 
                        a."INDENT_NO" = b."INDENT_NO" AND a."LOCN_CODE" = b."LOCN_CODE"
                    {where_clause}
                ),
                frequency_calculation AS (
                    SELECT 
                        "INDENT_DATE", 
                        "INDENT_NO", 
                        "PROD",
                        LEAD("INDENT_DATE") OVER (PARTITION BY "DEALER_CODE", "PROD" ORDER BY "INDENT_DATE") AS "NEXT_INDENT_DATE",
                        "DEALER_CODE", 
                        "LOCN_CODE"
                    FROM 
                        base_data
                )
                SELECT 
                    b."INDENT_DATE", 
                    f."NEXT_INDENT_DATE",
                    b."DEALER_CODE", 
                    b."LOCN_CODE", 
                    b."PROD",
                    b."INDENT_NO",
                    CASE 
                        WHEN f."NEXT_INDENT_DATE" IS NOT NULL THEN f."NEXT_INDENT_DATE" - b."INDENT_DATE"
                        ELSE NULL
                    END AS frequency_in_days
                FROM 
                    base_data b
                INNER JOIN 
                    frequency_calculation f
                ON 
                    b."LOCN_CODE" = f."LOCN_CODE" 
                    AND b."INDENT_NO" = f."INDENT_NO"
                    AND b."PROD" = f."PROD"
                ORDER BY 
                    b."INDENT_DATE" DESC, b."PROD" """
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get("ims", "1")
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_actions.charts_connection_vault_routing(
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    data = await function(query=query)
    return data

async def get_ro_with_no_indent_in_ims():
    ...

async def get_category_sync():
    query = f"""SELECT SUBSTR("DEALER_CODE", 1, 10) AS "DEALER_CODE", "CATEGORY1" FROM "IMS_SAP"."DEALER_DETAILS"
                WHERE "CATEGORY1" = 'R01'"""
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get("ims", "1")
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_actions.charts_connection_vault_routing(
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    data = await function(query=query)
    data = pd.DataFrame(data)
    data['DEALER_CODE'] = data['DEALER_CODE'].astype(str).str.lstrip('0')

    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get("hpcl_ceg", "1")
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'upsert_data'
    function = await charts_actions.charts_connection_vault_routing(
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    return await function(
        schema_name="IMS_SAP",
        table_name="DEALER_DETAILS_CATA",
        records=data.to_dict(orient="records"),
        conflict_columns=["DEALER_CODE"]
    )

async def generate_filters(data):
    filters = {}

    for record in data:
        key = record.key
        value = record.value

        if not value:
            continue

        # Always treat values as list
        if not isinstance(value, list):
            value = [value]

        if key == "dealer_id":
            filters.setdefault("DEALER_CODE", []).extend(value)

        elif key == "sales_area":
            filters.setdefault("SALES_AREA", []).extend(value)

        elif key == "product_code":
            filters.setdefault("PROD", []).extend(value)

        elif key == "region":
            regions = "', '".join(value)
            query = f"""
                SELECT DISTINCT sales_area
                FROM location_master
                WHERE region IN ('{regions}') AND bu='RO'
            """
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)

            if resp["data"]:
                sales_areas = await flatten_sales_area(resp["data"])
                filters.setdefault("RSALES_AREA", []).extend(sales_areas)

        elif key == "zone":
            zones = "', '".join(value)
            query = f"""
                SELECT DISTINCT sales_area
                FROM location_master
                WHERE zone IN ('{zones}') AND bu='RO'
            """
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)

            if resp["data"]:
                sales_areas = await flatten_sales_area(resp["data"])
                filters.setdefault("ZSALES_AREA", []).extend(sales_areas)

    # Remove duplicates
    return [
        {"key": k, "value": list(set(v))}
        for k, v in filters.items()
    ]

async def sync_carry_fwd_indent(insert_to_db: bool, filters=None):
    conditions = await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)
    where_clause = []
    for rec in conditions:
        if rec['key'] == 'sap_id':
            if isinstance(rec['value'], str):
                where_clause.append(f"terminal_plant_id='{rec['value']}'")
            else:
                if len(rec['value']) == 1:
                    where_clause.append(f"terminal_plant_id='{rec['value'][0]}'")
                else:
                    where_clause.append(f"terminal_plant_id in {tuple(rec['value'])}")
    base_conditions = " AND ".join(where_clause)
    if base_conditions:
        combined_query = " where a." + " AND a.".join(where_clause)
        cd_query = " where cd." + " AND cd.".join(where_clause)
        where_clause = " AND " + base_conditions
    else:
        where_clause = ""
        combined_query = ""
        cd_query = ""

    ims_clause = []
    if filters:
        ims_conditions = await generate_filters(filters)
        for condition in ims_conditions:
            condition_key = condition['key']
            condition_value = condition['value']
            if condition_key == 'DEALER_CODE':
                dealers = "', '".join(condition_value)
                ims_clause.append(f"""SUBSTR(a."DEALER_CODE",3,8) IN ('{dealers}')""")
            elif condition_key == 'SALES_AREA':
                sales_area = "', '".join(condition_value)
                ims_clause.append(f"""dd."SAREA_DESC" IN ('{sales_area}')""")
            elif condition_key == 'PROD':
                product_code = "', '".join(condition_value)
                ims_clause.append(f"""b."PROD" IN ('{product_code}')""")
            elif condition_key == 'RSALES_AREA':
                rsales_area = "', '".join(condition_value)
                ims_clause.append(f"""dd."SAREA_DESC" IN ('{rsales_area}')""")
            elif condition_key == 'ZSALES_AREA':
                zsales_area = "', '".join(condition_value)
                ims_clause.append(f"""dd."SAREA_DESC" IN ('{zsales_area}')""")
    
    ims_query = ""
    if ims_clause:
        ims_query +=  ' AND ' + ' AND '.join(ims_clause)

    query = f"""WITH INDENT_DATA AS (
                    SELECT DISTINCT 
                        SUBSTR(a."DEALER_CODE", 3, 8) AS sap_id, 
                        a."PROD_REQD_DT" AS prod_reqd_dt,
                        a."INDENT_NO" AS indent_no,
                        a."LOCN_CODE" AS locn_code
                    FROM 
                        "IMS_SAP"."INDENT_REQUEST" a,
                        "IMS_SAP"."INDENT_PRODUCTS" b,
                        "IMS_SAP"."DEALER_DETAILS" dd
                    WHERE 
                        a."PROD_REQD_DT" < CURRENT_DATE AND a."PROD_REQD_DT" >= CURRENT_DATE - INTERVAL '5 days'
                        AND a."LOCN_CODE" = b."LOCN_CODE" AND a."INDENT_NO" = b."INDENT_NO"
                        AND a."TRUCK_REGNO" IS NULL
                        AND a."DEALER_CODE" = dd."DEALER_CODE"
                        AND a."CANCEL_INDENT" IS NULL
                        AND a."VALID_INDENT" IN ('Y', 'H')
                        AND SUBSTR(a."DEALER_CODE", 11, 7) = '7000111'
                        AND b."PROD" in ('2811000','2812000','3912000','2822000', '3672000','2816000','3373000')
                        {ims_query}
                ),
                ALERT_DATA AS (
                    SELECT DISTINCT ON (sap_id, 
                        "indent_no", 
                        "terminal_plant_id")
                        sap_id, 
                        "indent_no", 
                        "terminal_plant_id",
                        dry_out_in_days, 
                        "indent_status",
                        TRUE AS dried_out
                    FROM 
                        "alerts"
                    WHERE
                        alert_status != 'Close' AND indent_status NOT IN ('Cancelled', 'Completed') {where_clause}
                ),
                COMBINED_DATA AS (
                    SELECT 
                        i.sap_id, 
                        i.locn_code as terminal_plant_id, 
                        i.indent_no, 
                        i.prod_reqd_dt,
                        NOW() AT TIME ZONE 'Asia/Kolkata' AS reported_date,
                        a.dry_out_in_days, 
                        a.dried_out,
                        a.indent_status
                    FROM 
                        INDENT_DATA i
                    LEFT JOIN 
                        ALERT_DATA a
                    ON 
                        i.sap_id::TEXT = a.sap_id::TEXT AND TRIM(i.indent_no::TEXT) = TRIM(a.indent_no::TEXT)
                    {combined_query}
                )
                SELECT 
                    cd.sap_id, 
                    cd.terminal_plant_id, 
                    cd.indent_no, 
                    cd.prod_reqd_dt, 
                    cd.reported_date, 
                    cd.dry_out_in_days, 
                    cd.dried_out, 
                    d."CATEGORY1" AS category,
                    cd.indent_status
                FROM 
                    COMBINED_DATA cd
                LEFT JOIN 
                    "IMS_SAP"."DEALER_DETAILS_CATA" d
                ON 
                    d."DEALER_CODE" = cd.sap_id
                {cd_query}
                ORDER BY 
                    cd.sap_id;"""

    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get("hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # data = await function(query=query)
    data = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    data = data.get("data", [])
    data = pd.DataFrame(data)
    for key in ['dry_out_in_days', 'indent_no', 'category']:
        if key in data.columns:
            data[key] = data[key].fillna("").astype(str)

    data['reported_date'] = urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d %H:%M:%S")
    if not insert_to_db:
        return data.to_dict(orient="records")

    for each_record in data.to_dict(orient="records"):
        await hpcl_ceg_model.CarryFwdIndentCreate(**each_record).create()
    return

async def ro_not_in_ims():
    query = f"""SELECT DISTINCT a.rosapcode
                FROM "HPCL_HOS".sch_inventory_forecast_dashboard a
                WHERE a.rosapcode NOT IN (
                    SELECT DISTINCT SUBSTR("DEALER_CODE", 3, 8)
                    FROM "IMS_SAP"."INDENT_REQUEST"
                );"""
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get("hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # data = await function(query=query)
    data = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    data = data.get("data", [])
    data = pd.DataFrame(data)
    redis_cli = await urdhva_base.redispool.get_redis_connection()
    locations = {key.decode(): json.loads(value.decode())
                 for key, value in (await redis_cli.hgetall('location_master')).items()}
    conditions = await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)
    rosapcodes = data['rosapcode'].unique().tolist()
    plants = []
    for rec in conditions:
        if rec['key'] == 'sap_id':
            plants = [rec['value']] if isinstance(rec['value'], str) else rec['value']
            break
    if plants:
        allowed_dealers = []
        for dealer in rosapcodes:
            if f'RO_{dealer}' in locations and locations[f'RO_{dealer}'].get('terminal_plant_id', '') in plants:
                if f'RO_{dealer}' in locations.keys():
                    allowed_dealers.append({dealer: locations[f'RO_{dealer}'].get("name", "")})
                else:
                    allowed_dealers.append({dealer: ""})
        return allowed_dealers
    else:
        sap_code = []
        for dealer in rosapcodes:
            if f'RO_{dealer}' in locations.keys():
                sap_code.append({dealer: locations[f'RO_{dealer}'].get("name", "")})
            else:
                sap_code.append({dealer: ""})
        return sap_code

async def _generate_where_clause(where_clause):
    # where_clause = ["interlock_name = 'Dry Out Each Indent Wise MainFlow'"]
    where_clause.extend(await hpcl_ceg_model.Alerts.get_clause_conditions(
        extra_key_mapping={"sap_id": "terminal_plant_id"}))
    for record in where_clause:
        if record['key'] == "progress_rate":
            if record['value']:
                where_clause.append(f"progress_rate={int(record['value'][0])}")
        else:
            if record['value']:
                if record['key'] == 'dry_out_in_days':
                    dry_out_in_days_query = record['value'][0]
                if record['key'] == "plant":
                    record['key'] = "terminal_plant_id"
                if len(record['value']) == 1:
                    where_clause.append(f"{record['key']}='{record['value'][0]}'")
                else:
                    where_clause.append(f"{record['key']} in {tuple(record['value'])}")
    conditions = ' AND '.join(where_clause)
    return conditions

async def _get_ims_day_wise_report(report_date: str):
    query = f"""SELECT 
                    ir.LOCN_CODE,
                    ir.INDENT_NO,
                    ir.INDENT_DATE,
                    ir.PROD_REQD_DT,
                    ir.DEALER_CODE,
                    ir.BATCH_FLAG,
                    ir.TRUCK_REGNO,
                    ir.VALID_INDENT,
                    ir.SEND_TO_JDE_TIME,
                    ir.DELIVERY_DATE,
                    ir.INDENT_HOLD_RELEASE_TIME,
                    ir.INDENT_EXECUTABLE_TIME,
                    ip.PROD,
                    ip.QTY,
                    ip.PROD_ALLOT_TIME,
                    ip.SALES_ORDERNO,
                    ip.INVOICE_NO,
                    ip.JDE_TRUCK_NO,
                    tse.LOADED_ON,
                    tse.CARD_STATUS,
                    ROW_NUMBER() OVER (
                            PARTITION BY COALESCE(ir."LOCN_CODE"::TEXT, ''), 
                                         COALESCE(ir."INDENT_NO"::TEXT, ''), 
                                         COALESCE(ir."DEALER_CODE"::TEXT, ''), 
                                         COALESCE(ip."PROD"::TEXT, '') 
                            ORDER BY tse."LOADED_ON" ASC
                        ) AS rn
                FROM 
                    (
                        SELECT * FROM "IMS_SAP"."INDENT_REQUEST" WHERE PROD_REQD_DT = TO_DATE('{report_date}', 'YYYY-MM-DD')
                    ) AS ir
                LEFT JOIN 
                    "IMS_SAP"."INDENT_PRODUCTS" ip
                ON 
                    ir.LOCN_CODE = ip.LOCN_CODE
                    AND ir.DEALER_CODE = ip.DEALER_CODE
                    AND ir.INDENT_NO = ip.INDENT_NO
                LEFT JOIN 
                    "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" tse
                ON 
                    ir.LOCN_CODE = tse.LOCN_CODE
                    AND ir.TRUCK_REGNO = tse.TRUCK_REGNO
                    AND tse.CARD_STATUS = 'O'
                    AND tse."LOADED_ON" >= ir."PROD_REQD_DT"
                    AND tse."LOADED_ON" <= ir."PROD_REQD_DT" + INTERVAL '1 day'
                WHERE
                    cd.rn = 1
                    AND ir.PROD_REQD_DT = TO_DATE('{report_date}', 'YYYY-MM-DD') 
                ORDER BY 
                    ir.INDENT_NO"""
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
        "ims", "1")
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_actions.charts_connection_vault_routing(
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    stats_resp = await function(
        query=query
    )
    stats_resp = pd.DataFrame(stats_resp)
    stats_resp = stats_resp.drop_duplicates(subset=["LOCN_CODE", "INDENT_NO", "DEALER_CODE", "PROD"], keep='first')
    return stats_resp.to_dict(orient='records')


async def _get_dry_out_ims_report(
        dry_out_in_days=['DRY_OUT'],
        page=1,
        page_size=100,
        action=None):

    dry_out_in_days_str = "', '".join(x for x in dry_out_in_days)

    column_mapping = {
        'zone': 'ZONE', 'region': 'REGION', 'sales_area': 'SALES_AREA', 'sap_id': 'SAP_ID', 'location_name': 'LOCATION_NAME',
        'terminal_plant_id': 'TERMINAL_PLANT_ID', 'indent_no': 'INDENT_NO', 'product_code': 'PRODUCT_CODE',
        'indent_status': 'INDENT_STATUS', 'dry_out_types': 'DRY_OUT_TYPES', 'assigned_to_locn': 'ASSIGNED_TO_LOCN',
        'prod_reqd_dt': 'PROD_REQD_DT', 'truck_regno': 'TRUCK_REGNO', 'valid_indent': 'VALID_INDENT', 'sent_to_sap_time': 'SENT_TO_SAP_TIME', 
        'delivery_date': 'DELIVERY_DATE', 'indent_hold_release_time': 'INDENT_HOLD_RELEASE_TIME',
        'indent_executable_time': 'INDENT_EXECUTABLE_TIME', 'qty_kl': 'QTY (KL)', 'prod_allot_time': 'PROD_ALLOT_TIME',
        'sales_orderno': 'SALES_ORDERNO', 'invoice_no': 'INVOICE_NO', 'loaded_on': 'LOADED_ON', 'avgsales_7days': 'AVGSALES_7DAYS'
    }

    remove_cols = {'run_id', 'alert_id'}

    if action == "download":
        query = f"""
            SELECT * FROM public.dry_out_indent_report
            WHERE dry_out_types IN ('{dry_out_in_days_str}')
            ORDER BY indent_no DESC;
        """

        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
        data = resp.get("data", [])

        if not data:
            return {"status": False, "message": "No data found"}

        df = pd.DataFrame(data)
        df.rename(columns=column_mapping, inplace=True)
        df = df.drop(columns=remove_cols, errors='ignore')
        del data  

        # ---- Write Excel in a thread so event loop doesn't block ----
        def build_excel(dataframe: pd.DataFrame) -> io.BytesIO:
            output = io.BytesIO()
            workbook = xlsxwriter.Workbook(output, {
                'in_memory': True,
                'constant_memory': True,   # row-by-row write, low RAM
                'strings_to_urls': False,  # skip URL detection (big speed gain)
            })
            worksheet = workbook.add_worksheet("Report")

            # Write header
            for col_idx, col_name in enumerate(dataframe.columns):
                worksheet.write(0, col_idx, col_name)

            # Write rows
            for row_idx, row in enumerate(dataframe.itertuples(index=False), start=1):
                for col_idx, value in enumerate(row):
                    if not isinstance(value, str) and pd.isna(value):
                        worksheet.write(row_idx, col_idx, "")
                    else:
                        worksheet.write(row_idx, col_idx, value)

            workbook.close()
            output.seek(0)
            return output

        # Run CPU-heavy Excel generation in threadpool so async server doesn't freeze
        loop = asyncio.get_event_loop()
        excel_buffer = await loop.run_in_executor(None, build_excel, df)
        del df  # free memory
        if len(dry_out_in_days) > 1:
            file_name = f"DRYOUT_&_INTRA_DAY_DRYOUT_REPORT{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        else:
            file_name = f"{dry_out_in_days_str}_REPORT{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
       
        # ---- Convert to base64 so middleware doesn't reject it ----
        excel_bytes = excel_buffer.read()
        excel_base64 = base64.b64encode(excel_bytes).decode("utf-8")
        del excel_bytes  # free memory

        return {
            "status": True,
            "message": "File generated successfully",
            "file_name": file_name,
            "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "file_data": excel_base64  # base64 encoded excel
        }
    
    offset = (page - 1) * page_size

    query = f"""
        SELECT *
        FROM public.dry_out_indent_report
        WHERE dry_out_types IN ('{dry_out_in_days_str}')
        ORDER BY indent_no DESC
        LIMIT {page_size}
        OFFSET {offset};
    """

    count_query = f"""
        SELECT COUNT(*) AS total_count
        FROM public.dry_out_indent_report
        WHERE dry_out_types IN ('{dry_out_in_days_str}');
    """

    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)

    count_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=count_query, limit=0)

    data = resp.get("data", [])
    total_count = count_resp.get("data", [{}])[0].get("total_count", 0)

    final_data = [
        {
            column_mapping.get(k, k): v
            for k, v in row.items()
            if k not in remove_cols
        }
        for row in data
    ]
    return {"data": final_data, "total_count": total_count}


async def _get_on_hold_data(dry_out_in_days='1'):
    where_clause = {
        "a.interlock_name": ["Dry Out Each Indent Wise MainFlow"],
        "a.progress_rate": ["2"],
        "a.dry_out_in_days": [dry_out_in_days]
    }
    conditions = _generate_where_clause(where_clause)
    stats_query = f"""SELECT 
                            a.sap_id,
                            a.indent_no,
                            a.product_code,
                            a.progress_rate AS present_stage,
                            ir."PROD_REQD_DT",
                            ir."VALID_INDENT",
                            ir."INDENT_HOLD_RELEASE_TIME",
                            ir."INDENT_EXECUTABLE_TIME",
                            ir."CANCEL_INDENT"
                        FROM 
                            alerts a
                        JOIN 
                            "IMS_SAP"."INDENT_REQUEST" ir 
                        ON 
                            a.sap_id::TEXT = SUBSTR(ir."DEALER_CODE", 3, 8)::TEXT
                            AND a.indent_no::TEXT = ir."INDENT_NO"::TEXT
                            AND ir."CANCEL_INDENT" IS NULL
                        WHERE 
                            {conditions}
                            AND a.indent_status NOT IN ('Cancelled', 'Completed')
                        order by a.sap_id"""
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get("hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # stats_resp = await function(
    #     query=stats_query
    # )
    stats_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=stats_query, limit=0)
    stats_resp = stats_resp.get("data", [])
    stats_resp = pd.DataFrame(stats_resp)
    return stats_resp.to_dict(orient='records')

async def _get_pending_indents(dry_out_in_days='1'):
    where_clause = {
        "a.interlock_name": ["Dry Out Each Indent Wise MainFlow"],
        "a.progress_rate": ["3"],
        "a.dry_out_in_days": [dry_out_in_days]
    }

async def constant_dryout_ros(days=7):
    now = datetime.datetime.now(datetime.timezone.utc)
    run_id = [
        (now - datetime.timedelta(days=i)).strftime('%y%m%d-2300') for i in range(1, days+1)
    ]
    run_ids = tuple(run_id)
    # print(run_ids)
    query = f"""
    WITH forecast_dashboard AS (
        SELECT
            site_id,
            fcc_code,
            rosapcode,
            run_id,
            COUNT(DISTINCT tank_no) AS tank_cnt,
            STRING_AGG(CAST(tank_no AS TEXT), ',') AS tank_no,
            CASE
                WHEN SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) <= 0 THEN 1
                WHEN SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) < (SUM(sch.avgsales_7days) / 7) THEN 2
                WHEN SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) >= (SUM(sch.avgsales_7days) / 7)
                     AND SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) <= (SUM(sch.avgsales_7days) / 7) * 3 THEN 3
                WHEN SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) > (SUM(sch.avgsales_7days) / 7) * 3
                     AND SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) <= (SUM(sch.avgsales_7days) / 7) * 6 THEN 4
                ELSE 6
            END AS newstatus
        FROM "HPCL_HOS".sch_inventory_forecast_dashboard AS sch
        WHERE run_id IN {run_ids}
        GROUP BY site_id, fcc_code, rosapcode, run_id
        ORDER BY run_id, site_id, fcc_code, rosapcode
    )
    SELECT *
    FROM forecast_dashboard
    WHERE newstatus = 1
    """

    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
    #     "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # stats_resp = await function(
    #     query=query
    # )
    stats_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    stats_resp = stats_resp.get("data", [])
    df = pl.DataFrame(stats_resp)
    df = df.with_columns(
        pl.col("run_id")
        .str.slice(0, 6)
        .str.strptime(pl.Date, format="%y%m%d")
        .alias("run_id_date")
    )
    # print("days: ", days)
    aggregated_df = df.group_by("rosapcode").agg(
        pl.col("run_id_date").n_unique().alias("unique_days_count")
    )

    filtered_df = aggregated_df.filter(
        pl.col("unique_days_count") == days
    )
    data = df.join(filtered_df.select("rosapcode"), on="rosapcode", how="inner")
    redis_cli = await urdhva_base.redispool.get_redis_connection()
    locations = {key.decode(): json.loads(value.decode())
                 for key, value in (await redis_cli.hgetall('location_master')).items()}
    loc_data = [value for key, value in locations.items()]
    locations_data = pl.DataFrame(loc_data)
    result = data.join(locations_data.select(["sap_id", "name"]).unique(subset="sap_id", keep='first'), left_on = "rosapcode", right_on = "sap_id", how = "left")
    # print('printing columns')
    # print(result.columns)
    return result.select(["rosapcode", "name"]).to_dicts()

async def current_month_frequent_dryout_ros(data):
    datetime_condition = ""
    if data.start_date and data.end_date:
        datetime_condition = f" AND workflow_datetime BETWEEN '{data.start_date}' AND '{data.end_date}' "

    where_condition = ''' interlock_name = 'Dry Out Each Indent Wise MainFlow'
                                AND location_name != '' AND  indent_status != 'Cancelled' 
                                AND (workflow_datetime >= DATE_TRUNC('month', CURRENT_DATE)
                                    AND workflow_datetime < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
                            ) ''' + datetime_condition

    dry_out_query = f'''WITH unique_sap_ids AS (
                              SELECT location_name, sap_id, DATE(workflow_datetime) AS workflow_date
                              FROM alerts
                              WHERE {where_condition}
                              GROUP BY location_name, sap_id, DATE(workflow_datetime)
                            ),
                            monthly_sap_count AS (
                              SELECT location_name, sap_id, COUNT(sap_id) AS total_count
                              FROM unique_sap_ids
                              GROUP BY location_name, sap_id
                            )
                            SELECT location_name, sap_id, SUM(total_count) AS "Total_Count"
                            FROM monthly_sap_count
                            WHERE total_count > 1
                            GROUP BY location_name, sap_id
                            ORDER BY "Total_Count" DESC '''

    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
    #     "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # dryout_resp = await function(
    #     query=dry_out_query
    # )
    dryout_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=dry_out_query, limit=0)
    dryout_resp = dryout_resp.get("data", [])

    return dryout_resp

async def current_month_frequent_drout_terminals(data):
    datetime_condition = ""
    if data.start_date and data.end_date:
        datetime_condition = f" AND workflow_datetime BETWEEN '{data.start_date}' AND '{data.end_date}' "

    where_condition = ''' interlock_name = 'Dry Out Each Indent Wise MainFlow'
                                    AND location_name != '' AND  indent_status != 'Cancelled' 
                                    AND (workflow_datetime >= DATE_TRUNC('month', CURRENT_DATE)
                                        AND workflow_datetime < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
                                    AND category != ''
                                ) ''' + datetime_condition

    dry_out_query = f'''WITH unique_terminal_plant_ids AS (
                          SELECT location_name, terminal_plant_id, category, DATE(workflow_datetime) AS workflow_date
                          FROM alerts
                          WHERE {where_condition}
                          GROUP BY location_name, terminal_plant_id, category, DATE(workflow_datetime)
                        ),
                        monthly_sap_count AS (
                          SELECT location_name, terminal_plant_id, category, COUNT(terminal_plant_id) AS total_count
                          FROM unique_terminal_plant_ids
                          GROUP BY location_name, terminal_plant_id, category
                        )
                        SELECT location_name, terminal_plant_id, category, SUM(total_count) AS "Total_Count"
                        FROM monthly_sap_count
                        WHERE total_count > 1
                        GROUP BY location_name, terminal_plant_id, category
                        ORDER BY "Total_Count" DESC '''

    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
    #     "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # dryout_resp = await function(
    #     query=dry_out_query
    # )
    dryout_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=dry_out_query, limit=0)
    dryout_resp = dryout_resp.get("data", [])
    return dryout_resp

# async def get_atg_ack(sap_id: str, product_code: str):
#     to_day = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
#     query = f"""select Site_id, (select erp_code from "HPCL_HOS".ms_site ms where ms.site_id = trd.site_id) as "sap_ro_code", Tank_no, Product_no, Recptentrydate """ \
#             f"""from "HPCL_HOS".tr_delivery_data trd where enable = true and net_volume > 0 """ \
#             f"""and sap_ro_code = '{sap_id}' and "Product_no" = '{product_code}' """ \
#             f"""and Recptentrydate::DATE = '{to_day}'"""
#     query = f"""
#         SELECT trd.Site_id, 
#                ms.erp_code AS sap_ro_code, 
#                trd.Tank_no, 
#                trd.Product_no, 
#                trd.Product_no as item_name,
#                trd.Recptentrydate
#         FROM "HPCL_HOS".tr_delivery_data trd
#         JOIN "HPCL_HOS".ms_site ms 
#             ON trd.site_id = ms.site_id
#         WHERE trd.enable = true 
#             AND trd.net_volume > 0
#             AND ms.erp_code = '{sap_id}'
# --             AND trd.Product_no = '{product_code}'
#             AND trd.Recptentrydate::DATE = '{to_day}'
#     """
#     dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
#         "cris", "1")
#     dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
#     function = await charts_actions.charts_connection_vault_routing(
#         dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
#     # atg_resp = await function(
#     #     query=query
#     # )
#     atg_resp = await helpers.retry_async(function, retries=3, delay=10, query=query)
#     # print("atg_resp: ", atg_resp)
#     atg_resp = pd.DataFrame(atg_resp)
#     if 'item_name' in atg_resp.columns:
#         atg_resp['item_name'] = atg_resp['item_name'].astype(str)
#     atg_resp.replace({"item_name": await cris_product_mapping()}, inplace=True)
#     # print("atg_resp: ", atg_resp)

#     # query = f"""select distinct sap_id from alerts where interlock_name = 'Dry Out Each Indent Wise MainFlow' and alert_status = 'Open' and dry_out_in_days = '{dry_out_in_days}'"""
#     # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
#     #     "hpcl_ceg", "1")
#     # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
#     # function = await charts_actions.charts_connection_vault_routing(
#     #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
#     # resp = await function(
#     #     query=query
#     # )
#     # alert_df = pd.DataFrame(resp)
#     #
#     # df = pd.merge(
#     #     atg_ack_df.drop_duplicates(subset="sap_ro_code"), alert_df,
#     #     left_on=["sap_ro_code"], right_on=["sap_id"], how="inner")
#     if atg_resp.empty:
#         return []
#     atg_resp = atg_resp[atg_resp['item_name'] == product_code]
#     # print("atg_resp: ", atg_resp)
#     return atg_resp.to_dict(orient='records')

async def get_atg_ack(sap_id: str, product_code: str):
    """
    Fetches today's ATG acknowledgment records for a given SAP RO code
    and product from the `HPCL_HOS.atg_ack_confirmation` table.

    Filters data by:
    - sap_ro_code (sap_id)
    - item_name (product_code)
    - current UTC date

    Returns:
        List[dict]: Matching records, or empty list if no data found.
    """
    to_day = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")

    query = f"""
            SELECT *
            FROM "HPCL_HOS".atg_ack_confirmation
            WHERE sap_ro_code = '{sap_id}'
            AND item_name = '{product_code}'
            AND recptentrydate::DATE = '{to_day}'
        """
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
        "hpcl_ceg", "1")
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_actions.charts_connection_vault_routing(
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    
    atg_resp = await helpers.retry_async(function, retries=3, delay=10, query=query)
    atg_resp = pd.DataFrame(atg_resp)

    if atg_resp.empty:
        return []
    return atg_resp.to_dict(orient='records')

async def update_dry_out_from_cris(records):
    records = pd.DataFrame(records)
    records["product_code"] = records["product_grp"].replace(product_code_mapping)
    records = records.astype(str)

    query = f"""select sap_id as rosapcode, product_code from alerts where interlock_name = 'Dry Out Each Indent Wise MainFlow' and alert_status != 'Close' and dry_out_in_days in ('1','2')"""
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
    #     "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # dryout_resp = await function(
    #     query=query
    # )
    dryout_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    dryout_resp = dryout_resp.get("data", [])
    dryout_resp = pd.DataFrame(dryout_resp)
    dryout_resp = dryout_resp.astype(str)
    dryout_resp = dryout_resp.drop_duplicates(subset=["rosapcode", "product_code"])

    final_resp = pd.merge(
        records, dryout_resp,
        left_on=["rosapcode", "product_code"],
        right_on=["rosapcode", "product_code"],
        how='outer', indicator=True
    )
    right_df = final_resp[final_resp['_merge'] == 'right_only']
    # print(right_df)
    for right in right_df.to_dict(orient='records'):
        query = f"""update alerts set mark_as_false=false where alert_status != 'Close' and sap_id = '{right["rosapcode"]}' and product_code = '{right["product_code"]}' and interlock_name = 'Dry Out Each Indent Wise MainFlow'"""
        await hpcl_ceg_model.Alerts.update_by_query(query)

    for both in final_resp[final_resp['_merge'] == 'both'].to_dict(orient='records'):
        query = f"""update alerts set mark_as_false=true where alert_status != 'Close' and sap_id = '{both["rosapcode"]}' and product_code = '{both["product_code"]}' and interlock_name = 'Dry Out Each Indent Wise MainFlow'"""
        await hpcl_ceg_model.Alerts.update_by_query(query)

async def update_atg_ack(alert_id: str, sap_id: str, product_code: str):
    # print(f"alert_id: {alert_id} sap_id: {sap_id} product_code: {product_code}")
    alert_data = await hpcl_ceg_model.Alerts.get(alert_id)
    if not isinstance(alert_data, dict):
        alert_data = alert_data.__dict__

    atg_resp = await get_atg_ack(sap_id=sap_id, product_code=product_code)
    if atg_resp:
        atg_resp = atg_resp[0]
        if not alert_data.get("atg_ack", False):
            query = f"""update alerts set atg_ack=true, atg_ack_time='{atg_resp.get("recptentrydate").strftime("%Y-%m-%d %H:%M:%S")}' where id = {alert_id}"""
            # print(f"update query for atg: {query}")
            await hpcl_ceg_model.Alerts.update_by_query(query)

async def get_atg_ack_count(dry_out_in_days='1'):
    to_day = urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d")
    query = (f"select count(distinct sap_id) from alerts where interlock_name = 'Dry Out Each Indent Wise MainFlow' "
             f"and dry_out_in_days='{dry_out_in_days}' and atg_ack=true and atg_ack_time::DATE = '{to_day}'")
    data = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=10000)
    # print("Data: ", data)
    if data.get("data", []):
        data = data.get("data", [])
        return data[0].get("count", 0)
    return 0

async def cris_product_mapping():
    product_mapping = {
        "3672000": "POWER 95",
        "2821000": "MS",
        "3925000": "POWER 95",
        "2812000": "HSD",
        "3373000": "POWER 100",
        "1683000": "HSD",
        "4211000": "MS",
        "1322100": "POWER 95",
        # "2822000": "E20",
        "2822000": "MS",
        "1683100": "TURBO",
        "1322000": "MS",
        "2823000": "MS",
        "2682000": "POWER 99",
        "2811000": "MS",
        "3912000": "TURBO",
        "2816000": "POWER 99"
    }
    return product_mapping

async def dry_out_diff():
    cris_query = f'''select site_id, fcc_code, item_name,item_name product_grp, rosapcode, tank_no, status, tank_cnt
                        from (
                                select site_id, fcc_code,product_grp item_name,count(distinct tank_no) tank_cnt, 
                                rosapcode, STRING_AGG(CAST(tank_no AS TEXT), ',') tank_no,
                                case when sum(case when pumpable_Stock>=0 then pumpable_Stock else 0 end) <=0 then 1 
                                when sum(case when pumpable_Stock>=0 then pumpable_Stock else 0 end) < 
                                (sum(sch.avgsales_7days)/7) then 2
                                when sum(case when pumpable_Stock>=0 then pumpable_Stock else 0 end) >= 
                                (sum(sch.avgsales_7days)/7) and sum(case when pumpable_Stock>=0 
                                then pumpable_Stock else 0 end) <= (sum(sch.avgsales_7days)/7)*3 then 3
                                when sum(case when pumpable_Stock>=0 then pumpable_Stock else 0 end) > 
                                (sum(sch.avgsales_7days)/7)*3 and sum(case when pumpable_Stock>=0 then 
                                pumpable_Stock else 0 end) <=(sum(sch.avgsales_7days)/7)*6 then 4 
                                else 5 end status
                                from "HPCL_HOS".sch_inventory_forecast_dashboard sch
                                where sch.volume>0
                                group by site_id, fcc_code, product_grp,rosapcode
                                order by site_id, fcc_code, product_grp
                            ) result1
                            where result1.status in ('1', '2')
            '''
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
        "cris", "1")
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_actions.charts_connection_vault_routing(
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # cris_resp = await function(
    #     query=cris_query
    # )
    cris_resp = await helpers.retry_async(function, retries=3, delay=10, query=cris_query)
    novex_query = (f"select bu, sap_id, sop_id, id, product_code, indent_no, dealer_id, workflow_instance_id, workflow_datetime, dry_out_in_days, "
                   f"mark_as_false from alerts where interlock_name = 'Dry Out Each Indent Wise MainFlow' and alert_status != 'Close'")
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
        "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # novex_resp = await function(
    #     query=novex_query
    # )
    novex_resp = await hpcl_ceg_model.Alerts.get_aggr_data(novex_query, limit=0)
    novex_resp = novex_resp.get("data", [])

    cris_resp = pd.DataFrame(cris_resp)
    novex_resp = pd.DataFrame(novex_resp)
    novex_resp.replace({"product_code": await cris_product_mapping()}, inplace=True)

    cris_resp = cris_resp.astype(str)
    novex_resp = novex_resp.astype(str)
    cris_resp = cris_resp.drop_duplicates(subset=['item_name', 'rosapcode', 'status'])
    novex_resp = novex_resp.drop_duplicates(subset=['product_code', 'sap_id', 'dry_out_in_days'])

    resp = pd.merge(
        cris_resp, novex_resp,
        left_on=['item_name', 'rosapcode', 'status'],
        right_on=['product_code', 'sap_id', 'dry_out_in_days'],
        how='outer',
        indicator=True
    )
    resp = resp[resp['_merge'] != 'both']
    resp.to_csv("/tmp/dryout_difference.csv", index=False)
    return resp

async def dry_out_report(dry_out_in_days='1'):
    alerts_query = f"""
            SELECT sap_id, indent_no, product_code, zone, region, sales_area, 
                   location_name, terminal_plant_id, indent_status, dry_out_in_days
            FROM alerts 
            WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow'
            AND indent_status NOT IN ('Cancelled', 'Completed')
            AND dry_out_in_days = '{dry_out_in_days}';
            """
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
    #     "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # alerts_resp = await function(
    #     query=alerts_query
    # )
    alerts_resp = await hpcl_ceg_model.Alerts.get_aggr_data(alerts_query, limit=0)
    alerts_resp = alerts_resp.get("data", [])
    alerts_resp = pd.DataFrame(alerts_resp)

    query_combined = f"""
                    SELECT ir."LOCN_CODE", ir."INDENT_NO", ir."PROD_REQD_DT", ir."DEALER_CODE", 
                           ir."TRUCK_REGNO", ip."PROD" AS "PRODUCT_CODE", ip."QTY",
                           tse."LOADED_ON"
                    FROM (select * from "IMS_SAP"."INDENT_REQUEST" where substr(run_id, 1, 6) = '250317') ir
                    LEFT JOIN (select * from "IMS_SAP"."INDENT_PRODUCTS" where substr(run_id, 1, 6) = '250317') ip
                        ON ir."LOCN_CODE" = ip."LOCN_CODE"
                        AND ir."DEALER_CODE" = ip."DEALER_CODE"
                        AND ir."INDENT_NO" = ip."INDENT_NO"
                        AND substr(ip.run_id, 1, 6) = %s
                    LEFT JOIN (select * from "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" where substr(run_id, 1, 6) = '250317') tse
                        ON ir."LOCN_CODE" = tse."LOCN_CODE"
                        AND ir."TRUCK_REGNO" = tse."TRUCK_REGNO"
                        AND tse."CARD_STATUS" = 'O'
                        AND substr(tse.run_id, 1, 6) = %s;
                    """

    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
    #     "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # combined_resp = await function(
    #     query=query_combined
    # )
    combined_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query_combined, limit=0)
    combined_resp = combined_resp.get("data", [])
    combined_resp = pd.DataFrame(combined_resp)

    query_sales = """
                    SELECT rosapcode, 
                           CASE item_name
                               WHEN 'HSD' THEN '2812000'
                               WHEN 'MS' THEN '2811000'
                               WHEN 'TURBO' THEN '3912000'
                               WHEN 'E20' THEN '2822000'
                               WHEN 'POWER 95' THEN '3672000'
                               WHEN 'POWER 99' THEN '2816000'
                               WHEN 'POWER 100' THEN '3373000'
                           END AS item_name_code,
                           avgsales_7days
                    FROM "HPCL_HOS"."sch_inventory_forecast_dashboard"
                    WHERE run_id = '250317';
                    """
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
    #     "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # sales_resp = await function(
    #     query=query_sales
    # )
    sales_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query_sales, limit=0)
    sales_resp = sales_resp.get("data", [])
    sales_resp = pd.DataFrame(sales_resp)

    final_df = alerts_resp.merge(
        combined_resp,
        left_on=['sap_id', 'indent_no', 'product_code'],
        right_on=['DEALER_CODE', 'INDENT_NO', 'PRODUCT_CODE'],
        how='left'
    ).merge(
        sales_resp,
        left_on=['sap_id', 'product_code'],
        right_on=['rosapcode', 'item_name_code'],
        how='left'
    )
    final_df = final_df.sort_values(by="LOADED_ON", ascending=True).groupby("INDENT_NO").first().reset_index()
    # print(final_df)
    return final_df.to_dict(orient="records")

async def get_dryout_aging(conditions):
    query = f"""WITH distinct_alerts AS (
                SELECT DISTINCT ON (sap_id) sap_id, created_at
                FROM alerts
                WHERE {conditions} AND progress_rate = '1' AND indent_status NOT IN ('TempClosed', 'ProductLowLevel', 'OfflineOrFalseAlarm', 'NotAvailable')
                ORDER BY sap_id, created_at ASC
            )
            SELECT 
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '2 days' THEN 1 END) AS "less_than_2_days",
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' AND created_at < NOW() - INTERVAL '2 days' THEN 1 END) AS "from_3_to_7_days",
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '15 days' AND created_at < NOW() - INTERVAL '7 days' THEN 1 END) AS "from_8_to_15_days",
                COUNT(CASE WHEN created_at < NOW() - INTERVAL '15 days' THEN 1 END) AS "more_than_15_days"
            FROM distinct_alerts;"""
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
    #     "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # resp = await function(
    #     query=query
    # )
    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    resp = resp.get("data", [])
    return resp[0] if resp else {}

async def get_ro_count_less_50(condition):
    query = (f"SELECT SUBSTRING(CUST_CD, 3) AS CUST_CD, SUM(QTY_KL) AS Total_Net_Weight "
             f"FROM PS.EDW_PRIMARY_SALES_FACT "
             f"WHERE "
             f"INVOICE_DT >= CURDATE() - INTERVAL 30 DAY "
             f"GROUP BY CUST_CD "
             f"HAVING Total_Net_Weight < 50;")
    creds = credential_loader.get_credentials('TIBCO')
    params = {
        "host": creds['host'],
        "database": creds['database'],
        "user": creds['user'],
        "password": creds['password'],
        "port": creds['port'],
        "connection_type": "mssql"
    }
    try:
        conn = get_db_connection(params)
        cursor = conn.cursor()
        cursor.execute(query)
        data = cursor.fetchall()
        columns = [column[0] for column in cursor.description]
        data = pd.DataFrame.from_records(data, columns=columns)
        if data.empty:
            data = pd.DataFrame(columns=['CUST_CD'])
    except Exception as ex:
        print(f"Exception while fetching data from TIBCO: {ex}\nTraceback: {traceback.format_exc()}")
        data = pd.DataFrame(columns=['CUST_CD'])
    data['CUST_CD'] = data['CUST_CD'].astype(str)

    query = (f"select distinct on (sap_id) sap_id, created_at from alerts where {condition} "
             f"and progress_rate = '1' and alert_status != 'Close' "
             f"order by sap_id, created_at asc")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
    #     "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # resp = await function(
    #     query=query
    # )
    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    resp = resp.get("data", [])
    resp = pd.DataFrame(resp)
    if resp.empty:
        resp = pd.DataFrame({"sap_id": [], "created_at": []})
    resp['sap_id'] = resp['sap_id'].astype(str)

    resp = pd.merge(
        data.drop_duplicates(subset=['CUST_CD']),
        resp.drop_duplicates(subset=['sap_id']),
        left_on=['CUST_CD'], right_on=['sap_id'],
        how='left', indicator=True
    )
    return len(resp[resp['_merge'] == 'both'])

def get_db_connection(params):
    """
    Establish a database connection
    Args:
        connection_string (str): Database connection string
    Returns:
        pyodbc connection
    """
    connection = mysql.connector.connect(
        host=params['host'],
        user=params['user'],
        passwd=params["password"],
        port=params["port"]
        #database=database
    )
    return connection

async def get_tar_analysis(condition):
    query = (f"SELECT DISTINCT ON (rosapcode) "
             f"rosapcode, "
             f"exposure, "
             f"CASE "
             f"WHEN exposure >= 0 AND exposure <= 2500000 THEN 1 "
             f"WHEN exposure > 2500000 AND exposure <= 5000000 THEN 2 "
             f"WHEN exposure > 5000000 AND exposure <= 7500000 THEN 3 "
             f"ELSE 4 "
             f"END AS category "
             f"""FROM "HPCL_HOS".customer_balance;""")
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
        "cris", "1")
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_actions.charts_connection_vault_routing(
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # cust_resp = await function(
    #     query=query
    # )
    cust_resp = await helpers.retry_async(function, retries=3, delay=10, query=query)
    cust_resp = pd.DataFrame(cust_resp)
    cust_resp['rosapcode'] = cust_resp['rosapcode'].astype(str)

    query = f"""select distinct on (sap_id) sap_id, created_at from alerts where {condition} and progress_rate = '1' 
                and indent_status not in ('TempClosed', 'ProductLowLevel', 'OfflineOrFalseAlarm', 'NotAvailable') 
                order by sap_id, created_at asc"""
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
    #     "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # resp = await function(
    #     query=query
    # )
    resp = await hpcl_ceg_model.Alerts.get_aggr_data(query=query, limit=0)
    resp = resp.get("data", [])
    resp = pd.DataFrame(resp)
    if resp.empty:
        resp = pd.DataFrame({"sap_id": [], "created_at": []})
    resp['sap_id'] = resp['sap_id'].astype(str)

    resp = pd.merge(
        cust_resp.drop_duplicates(subset=['rosapcode']),
        resp.drop_duplicates(subset=['sap_id']),
        left_on=['rosapcode'], right_on=['sap_id'],
        how='left', indicator=True
    )

    _dict = {
        "less_1_cr": len(resp[(resp['_merge'] == 'both') & (resp['category'] == 1)]),
        "less_2_cr": len(resp[(resp['_merge'] == 'both') & (resp['category'] == 2)]),
        "less_5_cr": len(resp[(resp['_merge'] == 'both') & (resp['category'] == 3)]),
        "greater_5_cr": len(resp[(resp['_merge'] == 'both') & (resp['category'] == 4)])
    }
    return _dict

async def get_tt_counts(condition):
    query = f"""select truck_regnno, substr(dealer_code, 3, 8) as dealer_code from "IMS_SAP"."TRUCK_DETAILS" """
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
    #     "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # dealer_tt_resp = await function(
    #     query=query
    # )
    dealer_tt_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    dealer_tt_resp = dealer_tt_resp.get("data", [])
    dealer_tt_resp = pd.DataFrame(dealer_tt_resp)
    dealer_tt_resp['dealer_code'] = dealer_tt_resp['dealer_code'].fillna("")
    dealer_tt_resp['dealer_code'] = dealer_tt_resp['dealer_code'].astype(str)

    # query = f"select distinct on (sap_id) sap_id, created_at from alerts where {condition} and progress_rate = '1' order by sap_id, created_at asc"
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
    #     "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # resp = await function(
    #     query=query
    # )
    # resp = pd.DataFrame(resp)
    # resp['sap_id'] = resp['sap_id'].astype(str)
    locn_code = []
    for key, value in condition.items():
        if key == "zone":
            if len(value) == 1:
                value = f"('{value[0]}')"
            else:
                value = f"{tuple(value)}"
            locn_code = await _get_distinct_plants("TAS", value)
        if key == "terminal_plant_id":
            locn_code = value
    if locn_code:
        if len(locn_code) == 1:
            locn_code = f"AND \"LOCN_CODE\" in ('{locn_code[0]}')"
        else:
            locn_code = f"AND \"LOCN_CODE\" in {tuple(locn_code)}"
    else:
        locn_code = ""
    query = f"""WITH LatestR3 AS (
                SELECT 
                    "TRUCK_REGNO", 
                    MAX("LOADED_ON") AS last_r3_time
                FROM "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP"
                WHERE 
                    "CARD_STATUS" = 'O'
                    AND "LOADED_ON"::DATE = CURRENT_DATE
                GROUP BY "TRUCK_REGNO"
            ),
            FilteredR1 AS (
                SELECT 
                    "TRUCK_REGNO",
                    "CARD_STATUS",
                    "LOADED_ON",
                    ROW_NUMBER() OVER (
                        PARTITION BY "TRUCK_REGNO"
                        ORDER BY "LOADED_ON" DESC
                    ) AS rn
                FROM "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" ts
                WHERE 
                    ts."CARD_STATUS" = 'R'
                    AND ts."LOADED_ON"::DATE = CURRENT_DATE
                    AND EXISTS (
                        SELECT 1 
                        FROM LatestR3 r3 
                        WHERE ts."TRUCK_REGNO" = r3."TRUCK_REGNO"
                          AND ts."LOADED_ON" > r3.last_r3_time
                    )
            )
            SELECT "TRUCK_REGNO", "CARD_STATUS", "LOADED_ON"
            FROM FilteredR1
            WHERE rn = 1;"""
    current_data = urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d")
    query = f"""SELECT DISTINCT "TRUCK_REGNO"
                FROM "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP"
                WHERE "CARD_STATUS" = 'R'
                  AND "LOADED_ON"::date >= '{current_data}'
                  {locn_code}
                  AND "TRUCK_REGNO" NOT IN (
                      SELECT "TRUCK_REGNO"
                      FROM "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP"
                      WHERE "CARD_STATUS" = 'O'
                        AND "LOADED_ON"::date >= '{current_data}'
                  )"""
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
    #     "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # resp = await function(
    #     query=query
    # )
    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    resp = resp.get("data", [])
    resp = pd.DataFrame(resp)
    if resp.empty:
        resp = pd.DataFrame({"TRUCK_REGNO": []})
    if dealer_tt_resp.empty:
        dealer_tt_resp = pd.DataFrame({"truck_regnno": [], "dealer_code": []})

    resp = pd.merge(
        dealer_tt_resp.drop_duplicates(subset=['truck_regnno']),
        resp.drop_duplicates(subset=['TRUCK_REGNO']),
        left_on=['truck_regnno'], right_on=['TRUCK_REGNO'],
        how='left', indicator=True
    )
    _dict = {
        "dealer_tt": len(resp[(resp['_merge'] == 'both') & (resp['dealer_code'] != '')]),
        "transport_tt": len(resp[(resp['_merge'] == 'both') & (resp['dealer_code'] == '')])
    }

    return _dict

async def retail_tar(filters, cross_filters, drill_state="", time_grain="", resp_format=""):
    # Removing extra keys like all/_empty/* to mak sure all results appear in api response
    # Filtering cross filters
    base_path = os.path.join(os.path.dirname(helpers.__file__), '..', 'orchestrator', 'masterdata')
    cross_filters = [cross_filter for cross_filter in cross_filters if not (cross_filter.get("cond") in ['=', 'equals']
                                                                            and cross_filter.get("value") and
                                                                            cross_filter["value"].lower() in ['*',
                                                                                                              '_empty',
                                                                                                              'all'])]
    # Filtering filters
    filters = [filter_cond for filter_cond in filters
               if not (filter_cond.get("cond") in ['=', 'equals'] and filter_cond.get("value") and
                       filter_cond["value"].lower() in ['*', '_empty', 'all'])]
    sales_area_df = pd.read_csv(f"{base_path}/Retail_SalesArea_mapping.csv").astype(str)
    region_df = pd.read_csv(f"{base_path}/Retail_Region_mapping.csv").astype(str)
    region_df['JDE_RO_CD'] = region_df['JDE_RO_CD'].apply(lambda x: x[0]+'0'+x[1:])
    drill_order = ["zone", "region", "salesarea", "site_name"]

    cross_filters = cross_filters + filters
    for cond in cross_filters:
        cond['key'] = cond['key'].strip('"')
        if cond['key'] == 'region':
            df = region_df[region_df['JDE_RO_NM'] == cond['value']]
            cond['value'] = list(df['JDE_RO_CD'].values)
            cond['cond'] = 'one-off'
        elif cond['key'] == 'salesarea':
            df = sales_area_df[sales_area_df['ORG_RO_NM'] == cond['value']]
            cond['value'] = list(df['ORG_SA_CD'].values)
            cond['cond'] = 'one-off'

    clause = await widget_actions.WidgetActions.generate_filter_clause(cross_filters)
    group_by_key = "zone" if not drill_state else drill_order[drill_order.index(drill_state)+1]
    query = f''' select SUM(exposure) as amount, {group_by_key} from "HPCL_HOS".customer_balance '''
    if clause:
        if isinstance(clause, str):
            clause = [clause]
        query += f' where {" AND ".join(clause)}'
    if group_by_key:
        query += f" GROUP BY {group_by_key}"
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get("cris", "2")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    # resp = await function(query=query)
    resp = await helpers.retry_async(function, retries=3, delay=10, query=query)
    if not resp:
        return []
    df = pd.DataFrame(resp)
    df = df[df['amount'] != 0]
    if 'region' in df.columns:
        df = df.merge(region_df, how='left', left_on='region', right_on='JDE_RO_CD')
        df = df[['amount', 'JDE_RO_NM']]
        df = df.rename(columns={'JDE_RO_NM': 'region'})
        df = df.groupby("region", as_index=False).sum()
    if 'salesarea' in df.columns:
        df = df.merge(sales_area_df, how='left', left_on='salesarea', right_on='ORG_SA_CD')
        df = df[['amount', 'ORG_RO_NM']]
        df = df.rename(columns={'ORG_RO_NM': 'salesarea'})
        df = df.groupby("salesarea", as_index=False).sum()
    if not df.empty:
        df['amount'] = df['amount'].astype(int)
    return df.to_dict(orient='records')

async def get_dryout_aging_data():
    query = f"""WITH distinct_alerts AS (
                    SELECT DISTINCT ON (sap_id) sap_id, location_name, zone, region,
                    indent_status, created_at, product_code, terminal_plant_id, terminal_plant_name,
                    dry_out_in_days
                    FROM alerts
                    WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow' AND mark_as_false = true AND progress_rate = '1'
                    AND indent_status NOT IN ('TempClosed', 'ProductLowLevel', 'OfflineOrFalseAlarm', 'NotAvailable')
                    ORDER BY sap_id, created_at ASC
                )
                SELECT *,
                    CASE 
                        WHEN created_at >= NOW() - INTERVAL '2 days' THEN '1 - 2 days'
                        WHEN created_at >= NOW() - INTERVAL '7 days' AND created_at < NOW() - INTERVAL '2 days' THEN '3 - 7 days'
                        WHEN created_at >= NOW() - INTERVAL '15 days' AND created_at < NOW() - INTERVAL '7 days' THEN '8 - 15 days'
                        WHEN created_at < NOW() - INTERVAL '15 days' THEN 'More than 15 days'
                    END AS age_category
                FROM distinct_alerts;"""
    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    resp = resp.get("data", [])
    resp = pd.DataFrame(resp)
    resp.rename(columns={
        "sap_id": "DEALER_CODE", "location_name": "LOCATION_NAME", "zone": "ZONE", "region": "REGION",
        "indent_status": "INDENT_STATUS", "product_code": "PRODUCT_CODE", "age_category": "AGE_CATEGORY",
        "terminal_plant_id": "SUPPLY_PLANT_ID", "terminal_plant_name": "SUPPLY_PLANT_NAME",
        "dry_out_in_days": "DRY_OUT_IN_DAYS"
    }, inplace=True)
    del resp['created_at']
    return resp.to_dict(orient='records')

async def generate_dry_out_report(records):
    records = pd.DataFrame(records)
    query = f"select * from location_master where bu = 'RO'"
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
    #     "hpcl_ceg", "1")
    # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_actions.charts_connection_vault_routing(
    #     dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # location_data = await function(
    #     query=query
    # )
    location_data = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    location_data = location_data.get("data", [])
    location_data = pd.DataFrame(location_data)
    records['rosapcode'] = records['rosapcode'].astype(str)
    records['status'] = records['status'].astype(str)
    location_data['sap_id'] = location_data['sap_id'].astype(str)

    records = pd.merge(
        records,
        location_data.drop_duplicates(subset=['sap_id'])[['sap_id', 'zone', 'region', 'sales_area', 'name', 'terminal_plant_id', 'category']],
        left_on='rosapcode', right_on='sap_id', how='left'
    )
    records.rename(
        columns={"name": "location_name", "status": "dry_out_in_days", "product_no": "product_code"},
        inplace=True)
    records = records[[
        'zone', 'region', 'sales_area', 'sap_id', 'location_name', 'terminal_plant_id',
        'tank_no', 'capacity', 'product_code', 'dry_out_in_days', 'avgsales_7days',
        'avgsales_daily', 'category', 'tank_capacity'
    ]]
    records['dryout_start_datetime'] = urdhva_base.utilities.get_present_time()
    records['dryout_end_datetime'] = None
    records['dryout_date'] = urdhva_base.utilities.get_present_time().replace(hour=0, minute=0, second=0, microsecond=0)
    records['alert_status'] = 'Open'
    await hpcl_ceg_model.DryOutAlertReport.bulk_update(records.to_dict(orient='records'), upsert=True)

    query = f"SELECT id, sap_id, product_code from dry_out_alert_report where alert_status='Open'"
    dry_out_history = await hpcl_ceg_model.DryOutAlertReport.get_aggr_data(query, limit=0)
    dry_out_hist_data = {f"{rec['sap_id']}_{rec['product_code']}": rec for rec in dry_out_history['data']}
    dry_out_alert = {f"{rec['sap_id']}_{rec['product_code']}": rec for rec in records.to_dict(orient='records')}
    closed_alerts = list(set(list(dry_out_hist_data.keys())) - set(list(dry_out_alert.keys())))
    closed_ids = list({dry_out_hist_data[key]['id'] for key in closed_alerts})
    for index in range(0, len(closed_ids), 1000):
        ids = [f"{key}" for key in closed_ids[index:index + 1000]]
        conditions = [f"id in {tuple(ids)}" if len(ids) > 1 else f"id={ids[0]}"]
        query = (f"Update dry_out_alert_report set "
                 f"alert_status='Close',dryout_end_datetime='{urdhva_base.utilities.get_present_time()}' "
                 f"where {' AND '.join(conditions)}")
        await hpcl_ceg_model.DryOutAlertReport.update_by_query(query)

async def get_previous_day_carry_fwd_indent(today=None, data='count'):
    if not today:
        today = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    if data == 'count':
        query = (f"SELECT COUNT(*) AS cf_indents, "
                 f"COUNT(*) FILTER (WHERE dry_out_in_days != '') AS dryout_count, "
                 f"COUNT(*) FILTER (WHERE category = 'R01') AS category_a_count "
                 f"FROM public.carry_fwd_indent where created_at::DATE = '{today}' ")
        data = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
        return data.get('data', [])[0] if data.get('data', []) else {}
    else:
        query = (f"""select sap_id as "SAP ID", terminal_plant_id as "Terminal Plant Id", indent_no as "Indent No", """
                 f"""prod_reqd_dt as "Prod Req Date", dry_out_in_days as "DryOut Days", category as "Category" """ 
                 f"""from carry_fwd_indent where created_at::DATE = '{today}' """)
        data = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
        return data.get('data', [])

async def get_closed_outlet(conditions=None, dry_out_in_days='1'):
    query = f"""select erp_code from "HPCL_HOS"."ms_site" where tempclose = true"""
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
        "cris", "1")
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_actions.charts_connection_vault_routing(
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # site_data = await function(
    #     query=query
    # )
    site_data = await helpers.retry_async(function, retries=3, delay=10, query=query)
    site_data = pd.DataFrame(site_data)

    query = (f"select sap_id from alerts where dry_out_in_days = '{dry_out_in_days}' and "
             f"mark_as_false = true and alert_status != 'Close' and interlock_name = 'Dry Out Each Indent Wise MainFlow'")
    
    if conditions:
        query = (f"select sap_id from alerts where dry_out_in_days = '{dry_out_in_days}' and {conditions} and alert_status!='Close'")

    alert_data = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
    alert_data = pd.DataFrame(alert_data.get("data", []))

    close_outlet = pd.merge(
        site_data.drop_duplicates(),
        alert_data.drop_duplicates(),
        left_on='erp_code', right_on='sap_id',
        how='inner'
    )
    return len(close_outlet)

async def trigger_camunda_workflow(alert_data):
    if not isinstance(alert_data, dict):
        alert_data = alert_data.__dict__
    camunda_url = await helpers.get_camunda_url(bu=alert_data['bu'], sap_id=alert_data['sap_id'],
                                                alert_section="RO")
    alert_level = await ro_analysis.get_ro_levels(
        bu=alert_data['bu'], violation_type=alert_data.get('violation_type', ''),
        sap_id=str(alert_data['sap_id'])
    )
    payload = {"businessKey": alert_data['unique_id'],
               "variables": {"alert_id": {"value": alert_data['id'], "type": "String"},
                             "interlock_name": {"value": alert_data['interlock_name'], "type": "String"},
                             "interlock_id": {"value": "", "type": "String"},
                             "location_device_id": {"value": alert_data.get('device_id', ''), "type": "String"},
                             "location_type": {"value": alert_data['bu'], "type": "String"},
                             "sap_id": {"value": alert_data['sap_id'], "type": "String"},
                             "sop_id": {"value": alert_data['sop_id'], "type": "String"},
                             "dealer_id": {"value": alert_data.get('dealer_id', ''), "type": "String"},
                             "product_code": {"value": str(alert_data.get('product_code', '')), "type": "String"},
                             "workflow_datetime": {"value": datetime.datetime.now(datetime.UTC)
                                                            .strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + "Z", "type": "String"},
                             "indent_no": {"value": alert_data.get('indent_no', ''), "type": "String"},
                             "indent_raised_date": {"value": alert_data.get('indent_raised_date', ''),
                                                    "type": "String"},
                             "terminal_plant_name": {"value": alert_data.get('terminal_plant_name', ''),
                                                     "type": "String"},
                             "prod_reqd_dt": {"value": alert_data.get('prod_reqd_dt', ''), "type": "String"},
                             "va_level": {"value": alert_level, "type": "String"},
                             "terminal_plant_id": {"value": alert_data.get('terminal_plant_id', ''), "type": "String"},
                             "cause_effect": {"value": alert_data.get('Cause_Effect', ''), "type": "String"},
                             # Added for TAS use
                             "alert_section": {"value": alert_data.get('alert_section', ''), "type": "String"},
                             # Added for TAS use
                             "cause_sop_id": {"value": alert_data.get('cause_sop_id', ''), "type": "String"},
                             # Added for TAS use
                             "effect_sop_id": {"value": alert_data.get('effect_sop_id', ''), "type": "String"},
                             # Added for TAS use
                             "device_id": {"value": alert_data.get('device_id', ''), "type": "String"},
                             # Added for TAS use
                             "device_name": {"value": alert_data.get('device_name', ''), "type": "String"},
                             # Added for TAS use
                             "device_type": {"value": alert_data.get('device_type', ''), "type": "String"}
                             # Added for TAS use
                             }}
    interlock_name = interlock_mapping.get_interlock_name(
        bu=alert_data['bu'], interlock_name=alert_data['interlock_name'], sop_id=alert_data['sop_id'])
    workflowid = interlock_name.get("workflow_name") or interlock_name.get("interlock_name") or None
    workflow_id = interlock_mapping.fmt_il_name(workflowid)
    await Camunda().start_workflow(payload=payload, workflowId=workflow_id, camunda_url=camunda_url)
    redis_ins = await urdhva_base.redispool.get_redis_connection()
    await redis_ins.hset("alert_camunda_url", str(alert_data['id']), camunda_url)

async def get_nozzle_sales(conditions=None, dry_out_in_days='1'):
    query = (f"select sap_id from alerts where dry_out_in_days = '{dry_out_in_days}' and "
             f"mark_as_false = true and alert_status != 'Close' and interlock_name = 'Dry Out Each Indent Wise MainFlow'")
    
    if conditions:
        query = (f"select sap_id from alerts where dry_out_in_days = '{dry_out_in_days}' and "
                 f"alert_status != 'Close' and {conditions}")
        
    alert_data = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
    alert_data = pd.DataFrame(alert_data.get("data", []))
    # print(alert_data)

    query = f"""SELECT DISTINCT 
                s.erp_code
            FROM "HPCL_HOS".ms_nozzle_list n
            INNER JOIN "HPCL_HOS".ms_site s ON n.site_id = s.site_id
            WHERE s.erp_code IN {tuple(alert_data['sap_id'].unique().tolist())}
              AND NOT EXISTS (
                SELECT 1
                FROM "HPCL_HOS".ms_nozzle_list n2
                INNER JOIN "HPCL_HOS".ms_site s2 ON n2.site_id = s2.site_id
                WHERE n2.site_id = n.site_id
--                   AND n2.noz_last_trxn_date::date = CURRENT_DATE
                  AND n2.noz_last_trxn_date is not null
                  AND n2.enable = true
            )
            AND n.enable = true"""

    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get(
        "cris", "1")
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_actions.charts_connection_vault_routing(
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    # site_data = await function(
    #     query=query
    # )
    site_data = await helpers.retry_async(function, retries=3, delay=10, query=query)
    site_data = pd.DataFrame(site_data)
    # print(site_data['erp_code'].unique().tolist())
    return len(site_data['erp_code'].unique().tolist()) if 'erp_code' in site_data.columns else 0

async def _get_distinct_plants(bu, zone):
    query = f"""select distinct sap_id from location_master where zone in {zone} and bu = '{bu}'"""
    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    resp = pd.DataFrame(resp.get("data", []))
    return resp['sap_id'].unique().tolist() if 'sap_id' in resp.columns else []

async def mark_as_false_for_potential_records(potential_records):
    query = ("select id, sap_id, product_code from alerts where "
             "interlock_name = 'Dry Out Each Indent Wise MainFlow' and "
             "mark_as_false = true and alert_status != 'Close' ")
    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    resp = pd.DataFrame(resp.get("data", []))
    potential_records = potential_records.to_pandas()
    records = pd.merge(
        left=resp.drop_duplicates(subset=['sap_id', 'product_code'], keep='first'),
        right=potential_records, left_on=['sap_id', 'product_code'],
        right_on=['rosapcode', 'product_no'], how='left', indicator=True
    )
    records = records[records['_merge'] == 'both']
    print("records: ", records)
    del records['_merge']
    for record in records.to_dict(orient='records'):
        # update_query = f"""update alerts set mark_as_false=false and dry_out_in_days = '{int(record["status"])}' where id = '{record["id"]}' """
        update_query = f"""update alerts set mark_as_false=false where id = '{record["id"]}' """
        print("update_query: ", update_query)
        await hpcl_ceg_model.Alerts.update_by_query(update_query)

async def remove_ro_not_available_in_cris(dry_out_in_days='1'):
    records = await dry_out_diff()
    records = records[
        (records['_merge'] == 'right_only') &
        (records['mark_as_false'].isin(["True", "TRUE", True])) &
        (records['dry_out_in_days'] == str(dry_out_in_days))
    ]
    print("records: ", records)
    for record in records.to_dict(orient='records'):
        # update_query = f"""update alerts set mark_as_false=false and dry_out_in_days = '{int(record["status"])}' where id = '{record["id"]}' """
        update_query = f"""update alerts set mark_as_false=false where id = '{record["id"]}' """
        print("update_query: ", update_query)
        await hpcl_ceg_model.Alerts.update_by_query(update_query)

async def delete_with_retry(url, max_retries=3, backoff=3):
    for attempt in range(max_retries):
        try:
            response = requests.delete(url, timeout=20)  # Adjust timeout as needed
            if response.status_code in [200, 204, 404]:
                return response
            else:
                print(f"Attempt {attempt+1}: Unexpected response {response.status_code}: {response.text}")
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
            print(f"Attempt {attempt+1}: Timeout or connection error: {str(e)}")
        except Exception as e:
            print(f"Attempt {attempt+1}: Unknown error: {str(e)}")
        if attempt < max_retries - 1:
            time.sleep(backoff * (attempt+1))  # Exponential backoff
    print(f"Failed to delete after {max_retries} attempts: {url}")
    return None

async def is_ro_temporary_closed():
    try:
        query = """SELECT sap_id, tempclose FROM "HPCL_HOS".ms_site_temp_closed WHERE tempclose='true'"""
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.get("hpcl_ceg", "1")
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'

        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams
        )
        temporary_close_data = await function(query=query)
        temporary_close_data = pd.DataFrame(temporary_close_data)

        if temporary_close_data.empty:
            print("No temporarily closed ROs found.")
            return

        async def handle_single_alert(record):
            try:
                q = (
                    f"sap_id='{record['sap_id']}' AND bu='RO' "
                    f"AND interlock_name='Dry Out Each Indent Wise MainFlow' "
                    f"AND mark_as_false='true' AND alert_status!='Close' "
                    f"AND temporary_close!='true'"
                )
                temp_ro_close_data = await hpcl_ceg_model.Alerts.get_all(
                    urdhva_base.queryparams.QueryParams(q=q),
                    resp_type='plain'
                )

                for data in temp_ro_close_data.get('data', []):
                    try:
                        camunda_url = data['workflow_url']
                        process_instance_id = data['workflow_instance_id']
                        instance_url = f"{camunda_url}/engine-rest/process-instance/{process_instance_id}"

                        # Check if the instance exists
                        try:
                            resp = requests.get(instance_url, timeout=10)
                        except Exception as e_check:
                            print(f"[{record['sap_id']}] Error checking instance: {str(e_check)}")
                            continue

                        instance_exists = resp.status_code == 200

                        # If instance exists, try delete with retry
                        if instance_exists:
                            delete_response = await delete_with_retry(instance_url)
                            if delete_response is None or delete_response.status_code not in [200, 204, 404]:
                                print(f"[{record['sap_id']}] Camunda delete failed. Skipping alert update.")
                                continue
                            print(f"[{record['sap_id']}] Workflow deleted → {delete_response.status_code}: {delete_response.text}")

                        elif resp.status_code == 404:
                            print(f"[{record['sap_id']}] Instance already deleted.")

                        else:
                            print(f"[{record['sap_id']}] Camunda API error: {resp.status_code}")
                            continue  # Do not update alert if unsure

                        # Now update the alert
                        await hpcl_ceg_model.Alerts(
                            **{
                                "id": data['id'],
                                "temporary_close": True,
                                "closed_at": datetime.datetime.now(tz=datetime.timezone.utc),
                                "alert_status": "Close",
                                "alert_state": "Resolved",
                                "indent_status": IndentStatus.TempClosed,
                            }
                        ).modify()
                        print(f"[{record['sap_id']}] Alert {data['id']} marked as temporarily closed.")

                    except Exception as e_inner:
                        print(f"Error processing alert for sap_id={record['sap_id']}: {str(e_inner)}")
            except Exception as e_mid:
                print(f"Error querying alerts for sap_id={record.get('sap_id')}: {str(e_mid)}")

        # Batch process alerts
        batch_size = 50  # Control concurrency to avoid overload
        to_handle = [record for _, record in temporary_close_data.iterrows()]
        for i in range(0, len(to_handle), batch_size):
            batch = [handle_single_alert(rec) for rec in to_handle[i:i+batch_size]]
            await asyncio.gather(*batch)

    except Exception as e_outer:
        print(f"Fatal error in is_ro_temporary_closed(): {str(e_outer)}")
