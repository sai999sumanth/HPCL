import datetime
import urdhva_base
import re
import json
import asyncio
import os
import uuid
import tempfile
import pandas as pd
import numpy as np
from typing import List, Dict
from fastapi import HTTPException
from collections import defaultdict
import utilities.helpers as helpers
import dateutil.parser as dt_parser
import utilities.fiscal_year as fiscal_year
import utilities.minio_connector as minio_connector
import orchestrator.analytics.m60_performance as m60
import utilities.connection_mapping as connection_mapping
from orchestrator.dbconnector.widget_actions import widget_actions
from dashboard_studio_model import Charts_Get_Distinct_ValuesParams
from api_manager.charts_actions import charts_connection_vault_routing
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams

Base_Filters = ['"cumulative_level"', '"sbu_name"', '"region_name"', '"statename"', '"distname"',
                '"month_name"', '"productname"']
OMC = {
    "PVT": ["BORL", "HMEL", "RIL", "NEL", "SHELL", "SMA"],
    "OtherPSU": ["NRL", "CPCL", "GAIL", "ONGC", "MRPL", "OIL"],
    "MPSU": ["HPCL", "BPCL", "IOCL"],
}
OMC["PSU"] = OMC["OtherPSU"] + OMC["MPSU"]
OMC["PSU+PVT"] = OMC["PSU"] + OMC["PVT"]
fy_months =  ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar']


# Define keyword mapping for key extraction
KEYWORDS = {'sbu_name': ['SBU', 'BUSINESS UNIT'],
            'coname': ['COMPANY', 'HPCL', 'BPCL', 'IOCL'],
            'ro': ['ZONE', 'REGION'],
            'statename': ['STATE', 'STATENAME'],
            'distname': ['DISTRICT', 'DISTNAME'],
            'month_name': ['MONTH', 'MONTH NAME'],
            'productname': ['PRODUCT', 'FUEL', 'PETROL', 'DIESEL']
            }


def generate_group_by_conditions(filters, cross_filters, cumulative=False, drill_state='', time_grain='',
                                 resp_level=''):
    """
    Getting group by filter key based on cross filters
    :param time_grain:
    :param drill_state:
    :param cumulative:
    :param cross_filters:
    :return:
    """
    
    group_by_filter = ['"month_name"'] if not cumulative else []
    if cross_filters:
        index = 0
        for key in [rec['key'] for rec in cross_filters]:
            if key in Base_Filters and Base_Filters.index(key) > index:
                index = Base_Filters.index(key)
        group_by_filter = [Base_Filters[index + 1]]
    elif drill_state:
        if not drill_state.startswith('"'):
            drill_state = f'"{drill_state}"'
        group_by_filter = [Base_Filters[Base_Filters.index(drill_state) + 1]]
    if time_grain == 'Monthly' and '"month_name"' not in group_by_filter:
        group_by_filter.append('"month_name"')
    if "fiscal_year" not in group_by_filter:
        group_by_filter.append("fiscal_year")
    # if isinstance(resp_level,list):
    #    for x in resp_level:
    #        group_by_filter.append(x)
    if resp_level == 'sbu_level':
        group_by_filter.append("sbu_name")
    if resp_level == 'product_level':
        group_by_filter.append("productname")
    if resp_level == "sbu_level,product_level":
        group_by_filter.extend(['sbu_name', 'productname'])
    if isinstance(resp_level, list):
        group_by_filter.extend(['sbu_name', 'productname'])
    return group_by_filter


async def get_zones_and_regions(filters, cross_filters, drill_state, time_grain, resp_format):
    try:
        # 1. Pre-process and validate filters
        filter_map = {f["key"].strip('"').lower(): f for f in filters}
        
        def get_filter_value(key):
            f = filter_map.get(key)
            if f and f.get("value") and f["value"].strip() and f["value"].upper() != "ALL":
                return f["value"].strip(), f["cond"].lower() if "cond" in f else None
            return None, None

        zone_filter, _ = get_filter_value("zone_name")
        ro_filter, _ = get_filter_value("region_name")  # store as ro_filter
        fiscal_year, _ = get_filter_value("fiscal_year")
        product_filter, product_cond = get_filter_value("productname")
        district_filter, district_cond = get_filter_value("distname")
        state_filter, state_cond = get_filter_value("statename")
        company_filter, _ = get_filter_value("coname")

        if product_filter is not None and not product_filter.strip():
            return False, {"zones": [], "regions": [], "districts": []}, None

        curr_year, his_year = None, None
        if fiscal_year:
            parts = fiscal_year.split("-")
            curr_year = fiscal_year
            try:
                his_year = f"{int(parts[0]) - 1}-{int(parts[1]) - 1}"
            except (ValueError, IndexError):
                his_year = None
        else:
            return False, {"zones": [], "regions": [], "districts": []}, None

        # 2. Build dynamic WHERE clause
        def build_dynamic_clause(filter_val, cond, column):
            if not filter_val:
                return ""
            if cond == "equals":
                return f"AND {column} = '{filter_val}'"
            elif cond == "in":
                vals = [f"'{v.strip()}'" for v in filter_val.split(",") if v.strip()]
                return f"AND {column} IN ({', '.join(vals)})" if vals else ""
            return ""

        def build_other_filters(filters):
            clauses = []
            for f in filters:
                key = f["key"].strip('"').lower()
                val = f["value"].strip()
                cond = f["cond"].lower()
                if key not in ["zone_name", "region_name", "fiscal_year", "productname", "distname", "statename"]:
                    clause = build_dynamic_clause(val, cond, key)
                    if clause:
                        clauses.append(clause[4:])  # Remove 'AND ' prefix
            
            valid_zones_clause = "zone_name IS NOT NULL AND TRIM(zone_name) <> '' AND TRIM(zone_name) <> '-'"
            clauses.append(valid_zones_clause)
            return " AND ".join(clauses) if clauses else "1=1"

        base_where = build_other_filters(filters)
        product_sql = build_dynamic_clause(product_filter, product_cond, "productname")
        district_sql = build_dynamic_clause(district_filter, district_cond, "distname")
        state_sql = build_dynamic_clause(state_filter, state_cond, "statename")
        zone_cond = f"AND zone_name = '{zone_filter}'" if zone_filter else ""
        ro_cond = f"AND ro = '{ro_filter}'" if ro_filter else ""  # use ro column
        company_cond = f"AND coname = '{company_filter}'" if company_filter else ""

       
      
        def build_query(fiscal_year, group_by_col):
            cols = {
                "zone_name": "zone_name",
                "region_name": "ro",
                "distname": "distname",
            }
            valid_clause = f"AND {group_by_col} IS NOT NULL AND TRIM({group_by_col}) <> '' AND TRIM({group_by_col}) <> '-'" if group_by_col != 'zone_name' else ""

            # Ensure valid column values
            valid_clause = f"AND {cols[group_by_col]} IS NOT NULL AND TRIM({cols[group_by_col]}) <> '' AND TRIM({cols[group_by_col]}) <> '-'"

            # Base filters common to all
            where_parts = [base_where, product_sql, company_cond, state_sql]

            # Apply only relevant filters per level
            if group_by_col == "zone_name":
                if zone_filter:
                    where_parts.append(zone_cond)
            elif group_by_col == "region_name":
                if zone_filter:
                    where_parts.append(zone_cond)
                if ro_filter:
                    where_parts.append(ro_cond)
            elif group_by_col == "distname":
                if zone_filter:
                    where_parts.append(zone_cond)
                if ro_filter:
                    where_parts.append(ro_cond)
                if district_filter:
                    where_parts.append(district_sql)

            # Remove any None values before joining
            where_clause = " ".join([x for x in where_parts if x])

            # Build final query
            
            query = f"""
                SELECT {cols[group_by_col]}, 
                    ROUND(COALESCE(SUM(netweight_tmt) / 1000, 0), 2) AS total_sales
                FROM industry_performance
                WHERE {where_clause} {valid_clause} AND fiscal_year = '{fiscal_year}'
                GROUP BY {cols[group_by_col]}
                ORDER BY total_sales DESC
            """
            return query
        print("Zone Query:\n", build_query(curr_year, "zone_name"))
        print("Region Query:\n", build_query(curr_year, "region_name"))
        print("District Query:\n", build_query(curr_year, "distname"))


        # 4. Execute queries concurrently
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)

        query_tasks = [
            function(query=build_query(curr_year, "zone_name")),
            function(query=build_query(his_year, "zone_name")),
            function(query=build_query(curr_year, "region_name")),
            function(query=build_query(his_year, "region_name")),
            function(query=build_query(curr_year, "distname")),
            function(query=build_query(his_year, "distname")),
            function(query=f"SELECT ROUND(COALESCE(SUM(netweight_tmt) / 1000, 0), 2) AS total_sales FROM industry_performance WHERE {base_where} {product_sql} AND fiscal_year = '{curr_year}'"),
            function(query=f"SELECT ROUND(COALESCE(SUM(netweight_tmt) / 1000, 0), 2) AS total_sales FROM industry_performance WHERE {base_where} {product_sql} AND fiscal_year = '{his_year}'")
        ]

        (zones_curr_resp, zones_his_resp, regions_curr_resp, regions_his_resp, 
         districts_curr_resp, districts_his_resp, grand_total_curr_resp, grand_total_his_resp) = await asyncio.gather(*query_tasks)

        grand_total_curr = float(grand_total_curr_resp[0]["total_sales"]) if grand_total_curr_resp and grand_total_curr_resp[0] else 0
        grand_total_his = float(grand_total_his_resp[0]["total_sales"]) if grand_total_his_resp and grand_total_his_resp[0] else 0

        # 5. Process and merge data
        def process_data(curr_data, his_data, name_col, grand_total_curr, grand_total_his):
            curr_df = pd.DataFrame(curr_data) if curr_data else pd.DataFrame(columns=[name_col, "total_sales"])
            his_df = pd.DataFrame(his_data) if his_data else pd.DataFrame(columns=[name_col, "total_sales"])
            
            merged_df = pd.merge(curr_df, his_df, on=name_col, how="outer", suffixes=('_curr', '_his')).fillna(0)
            
            merged_df["total_sales_curr"] = merged_df["total_sales_curr"].astype(float)
            merged_df["total_sales_his"] = merged_df["total_sales_his"].astype(float)

            merged_df["curr_mkt"] = (merged_df["total_sales_curr"] / grand_total_curr * 100).round(2) if grand_total_curr > 0 else 0
            merged_df["his_mkt"] = (merged_df["total_sales_his"] / grand_total_his * 100).round(2) if grand_total_his > 0 else 0
            
            merged_df["gain_loss"] = (merged_df["curr_mkt"] - merged_df["his_mkt"]).round(2)
            merged_df["growth"] = (
                ((merged_df["total_sales_curr"] - merged_df["total_sales_his"]) / merged_df["total_sales_his"] * 100)
                .replace([np.inf, -np.inf], 0).fillna(0).round(2)
            )
            return merged_df

        zones_merged = process_data(zones_curr_resp, zones_his_resp, "zone_name", grand_total_curr, grand_total_his)
        regions_merged = process_data(regions_curr_resp, regions_his_resp, "ro", grand_total_curr, grand_total_his)
        districts_merged = process_data(districts_curr_resp, districts_his_resp, "distname", grand_total_curr, grand_total_his)

        # 6. Format and sort output
        sort_ascending = (resp_format.lower() == "bottom_performers")

        def format_output(df, name_col):
            return df.rename(columns={
                "total_sales_curr": "total_sales",
                "curr_mkt": "curr_mkt",
                "his_mkt": "his_mkt",
                "growth": "growth",
                "gain_loss": "gain_loss"
            })[[name_col, "total_sales", "curr_mkt", "his_mkt", "growth", "gain_loss"]].sort_values(by="gain_loss", ascending=sort_ascending)

        zones_output = format_output(zones_merged, "zone_name")
        regions_output = format_output(regions_merged, "ro").rename(columns={"ro": "region_name"}).head(10)
        districts_output = format_output(districts_merged, "distname").head(10)

        # 7. Convert to JSON and save to CSV
        if zones_output.empty and regions_output.empty and districts_output.empty:
            return False, {"zones": [], "regions": [], "districts": []}, None

        combined_df = pd.concat(
            [zones_output, regions_output, districts_output],
            axis=0,
            ignore_index=True
        )

        # ================= CREATE TEMP FILE =================

        temp_dir = tempfile.gettempdir()

        file_name = f"final_data_indus_{uuid.uuid4().hex}.csv"

        local_file_path = os.path.join(temp_dir, file_name)

        combined_df.to_csv(local_file_path, index=False)

        print("CSV saved:", local_file_path)

        # ================= UPLOAD TO MINIO =================

        unique_id = str(uuid.uuid4())

        upload_status, upload_response = minio_connector.upload_to_minio(
            "industry",          # bu
            "reports",           # section
            unique_id,           # unique_id
            local_file_path      # filepath
        )

        if not upload_status:
            raise HTTPException(
                status_code=500,
                detail=f"MinIO upload failed: {upload_response}"
            )

        print("Uploaded to MinIO:", upload_response)

        # ================= REMOVE LOCAL FILE =================

        if os.path.exists(local_file_path):
            os.remove(local_file_path)

        # ================= RETURN RESPONSE =================

        return True, {
            "zones": json.loads(zones_output.to_json(orient="records")),
            "regions": json.loads(regions_output.to_json(orient="records")),
            "districts": json.loads(districts_output.to_json(orient="records")),
            "file_attachment": [upload_response],
            "file_attachment_name": file_name
        }, None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


import pandas as pd

ALL_MONTHS = ["APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR"]

async def get_fiscal_sales(filters: list, cross_filters: list, resp_format: str):
    conditions = []
    for f in filters:
        key = f["key"].replace('"', '')
        cond = f["cond"].lower()
        values = f["value"]
        if key.lower() == "region_name":
            key = "ro"

        # Skip "All", empty string, None, or empty list
        if values in ["All", ["All"], "", None, []]:
            continue

        if isinstance(values, list) and cond == "in":
            values_str = ",".join([f"'{str(v)}'" for v in values if v not in ["", None]])
            if values_str:  # only add if list is not empty after cleaning
                conditions.append(f"{key} IN ({values_str})")

        elif cond == "in" and isinstance(values, str):
            conditions.append(f"{key} IN ('{values}')")

        elif cond == "equals":
            conditions.append(f"{key} = '{str(values)}'")

        else:
            conditions.append(f"{key} {cond.upper()} '{values}'")

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    query = f"""
       SELECT fiscal_year,
            month_name,
            zone_name,
            ROUND(COALESCE(SUM(netweight_tmt)/ 1000, 0), 2) AS total_sales
        FROM industry_performance
        WHERE {where_clause}
        AND distname IS NOT NULL AND TRIM(distname) <> '' AND TRIM(distname) <> '-'
        AND zone_name IS NOT NULL AND TRIM(zone_name) <> '' AND TRIM(zone_name) <> '-'
        GROUP BY fiscal_year, month_name, zone_name
        ORDER BY fiscal_year DESC, month_name, zone_name;
    """
    print("query", query)

    Charts_Connection_Vault_RoutingParams.connection_id = "1"
    Charts_Connection_Vault_RoutingParams.action = "execute_query"
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    resp = await function(query=query)

    df = pd.DataFrame(resp)
    df.columns = [str(col).strip() for col in df.columns]

    if "fiscal_year" not in df.columns:
        return {"status": False, "message": "fiscal_year column not found", "data": []}
    
    response = []
    prev_year_total = None  # to calculate YoY difference
    # Compute full month totals ignoring zone filter
    
    query_all_zones = f"""
        SELECT fiscal_year, month_name, zone_name, ROUND(COALESCE(SUM(netweight_tmt)/1000, 2), 2) AS total_sales
        FROM industry_performance
        WHERE distname IS NOT NULL AND TRIM(distname) <> '' AND TRIM(distname) <> '-'
        AND zone_name IS NOT NULL AND TRIM(zone_name) <> '' AND TRIM(zone_name) <> '-'
        GROUP BY fiscal_year, month_name, zone_name
    """

    resp_all_zones = await function(query=query_all_zones)
    df_all = pd.DataFrame(resp_all_zones)
    df_all.columns = [str(col).strip() for col in df_all.columns]
    

    # This replaces your previous df_all calculation
    month_totals_all_zones = df_all.groupby(["fiscal_year", "month_name"])["total_sales"].sum().to_dict()



    for year, year_df in df.groupby("fiscal_year"):
        total_sales = float(year_df["total_sales"].sum())
        months_list = []
        
        monthly_sales_series = year_df.groupby("month_name")["total_sales"].sum()
        monthly_sales_series = monthly_sales_series.astype(float)  # convert to float
        mean_sales = monthly_sales_series.mean()
        std_dev_sales = monthly_sales_series.std()

        prev_month_sales = None  # track last month’s sales for MoM difference

        for month in ALL_MONTHS:
            month_df = year_df[year_df["month_name"] == month]
            month_sales = float(month_df["total_sales"].sum()) if not month_df.empty else 0.0
            month_market_share_percentage = (month_sales / total_sales * 100) if total_sales > 0 else 0.0
            
            full_month_total = float(month_totals_all_zones.get((year, month), 0.0))
            


             # --- Categorize season based on std deviation ---
            if month_sales > mean_sales + std_dev_sales:
                season_category = "High Season"
            elif month_sales < mean_sales - std_dev_sales:
                season_category = "Low Season"
            else:
                season_category = "Normal Season"

            # ---- Add zone level data inside each month ----
            zones_list = []
            month_all_zones_df = df_all[(df_all["fiscal_year"] == year) & (df_all["month_name"] == month)]
            month_total_sales_all_zones = float(month_all_zones_df["total_sales"].sum())


            for zone, zone_df in month_df.groupby("zone_name"):
                zone_sales = float(zone_df["total_sales"].sum())
                

                # zone_market_share_percentage = (zone_sales / month_sales * 100) if month_sales > 0 else 0.0
                # zone_market_share_percentage = (zone_sales / full_month_total * 100) if full_month_total > 0 else 0.0
                zone_market_share_percentage = (
                    (zone_sales / month_total_sales_all_zones * 100)
                    if month_total_sales_all_zones > 0 else 0.0
                )

                zones_list.append({
                    "zone_name": zone,
                    "total_sales": zone_sales,
                    "market_share_percentage": round(zone_market_share_percentage, 2)
                })

            # ---- Add month difference (MoM) ----
            month_diff = month_sales - prev_month_sales if prev_month_sales is not None else 0.0
            prev_month_sales = month_sales

            months_list.append({
                "month": month.upper(),
                "fiscal_year": year,
                "total_sales": round(month_sales, 2),
                "market_share_percentage": round(month_market_share_percentage, 2),
                "season_category": season_category,
                "difference": f"{month_diff:+.2f}",  
                "zones": zones_list   
            })
            
        # ---- Add year difference (YoY) ----
        year_diff = total_sales - prev_year_total if prev_year_total is not None else 0.0
        prev_year_total = total_sales

        response.append({
            "Year": year,
            "Total_sales": round(total_sales, 2),     
            "difference": f"{year_diff:+.2f}",  
            "months": months_list
        })

    return {"status": True, "message": "Success", "data": response}




def get_date_filters(filters, months_list = None,cumulative = None,resp_type="months"):
    """
    Creates actual, history fiscal years and selected months
    :param filters:
    :param resp_type:
    :return:
    """
    print("resp_type",resp_type)
    print("months_list in get_date_filters",months_list )
    print("filters in get_date_filters",filters)
    org_filters = filters
    fiscal_year_pre = ''
    fiscal_year_last = ''

    end_date = fiscal_year.FiscalYear.current().fiscal_year_end_date
    start_date = fiscal_year.FiscalYear.current().fiscal_year_start_date

    # For History
    start_date_history = fiscal_year.FiscalYear.current().prev_fiscal_year.start.strftime("%Y-%m-%d")
    end_date_history = helpers.get_time_stamp_by_delta(dt_parser.parse(end_date), years=1, days=0,
                                                       with_month_start_day=False)
    months = []
    for condition in filters:
        if condition['key'].strip('"') == "A":
            fiscal_year_pre = (f"{fiscal_year.FiscalYear.current().start.year}-"
                               f"{fiscal_year.FiscalYear.current().end.year}")
        elif condition['key'].strip('"') == "H":
            fiscal_year_last = (f"{fiscal_year.FiscalYear.current().prev_fiscal_year.start.year}-"
                                f"{fiscal_year.FiscalYear.current().prev_fiscal_year.end.year}")
        elif condition['key'].strip('"') == "YTM":
            end_date = helpers.get_time_stamp_by_delta(months=1, with_month_start_day=False, with_month_end_day=True)
            end_date_history = helpers.get_time_stamp_by_delta(dt_parser.parse(end_date), years=1, days=0,
                                                               with_month_start_day=False)
        elif condition['key'].strip('"') == "DATE":
            start_date, end_date = condition['value'].split(",")
            start_date = helpers.get_time_stamp_by_delta(dt_parser.parse(start_date))
            end_date = helpers.get_time_stamp_by_delta(dt_parser.parse(end_date), with_month_start_day=False,
                                                       with_month_end_day=True)
            start_date_history = dt_parser.parse(start_date)
            start_date_history = start_date_history.replace(year=start_date_history.year - 1).strftime("%Y-%m-%d")

            # For History
            end_date_history = dt_parser.parse(end_date)
            # Handling for february
            end_date_history = end_date_history.replace(day=end_date_history.day - 1, year=end_date_history.year - 1)
            end_date_history = helpers.get_time_stamp_by_delta(end_date_history, with_month_start_day=False,
                                                               with_month_end_day=True)
        elif condition['key'] == '"fiscal_year"':
            if "," in condition['value']:
                fiscal_year_last = condition['value'].split(',')[0]
                fiscal_year_pre = condition['value'].split(',')[-1]
            else:
                fiscal_year_pre = condition['value']
        elif condition["key"] == "month_name" or condition["key"] == '"month_name"':
            
            print("months_list",months_list)
            
            # months = [mnt_name.strip() for mnt_name in condition["value"].split(",")]
            
            # if months_list:
            #     start_index = months_list.index(months[0])
            #     end_index = months_list.index(months[1])
            #     months = months_list[start_index:end_index + 1]
            
            
            months = [mnt_name.strip() for mnt_name in condition["value"].split(",") if mnt_name.strip()]
    
            if months_list and months:
                start_index = months_list.index(months[0])
                
                # If only one month is provided, use last month as fallback
                if len(months) < 2:
                    months.append(months_list[-1])
                
                end_index = months_list.index(months[1])
                months = months_list[start_index:end_index + 1]

            print("months", months)
            
            
            print("months",months)
    discard_filters = ['YTM', 'DATE', 'month_name', 'ind_sbu_cumulative', 'ind_analytics','table_graph', 'fiscal_year',
                       'company_name', 'table', 'table_month','cumulative', 'inc', 'OMC', 'A', 'H', 'C', 'cogroup']
    filters = [condition for condition in filters if condition['key'].strip('"') not in discard_filters]
    print("months",months)
    if not months:
        months = pd.date_range(start=start_date, end=end_date, freq='MS').strftime('%b').tolist()
    print("filters at end in get date filters",org_filters)
    if "table_month" in [x['key'].strip('"') for x in org_filters]:
        print("in req if")
        print("cumulative",cumulative)
        if not cumulative:
            months = [x['value'] for x in org_filters if x['key'].strip('"') == 'table_month']
            
        else:
            req_month = [x['value'] for x in org_filters if x['key'].strip('"') == 'table_month'][0]
            print("req_month",req_month)
            print("months_list",months_list)
            months = months_list[:months_list.index(req_month)+1]
        print("months in table months",months)
        
        return filters, fiscal_year_pre, fiscal_year_last, months    
    return filters, fiscal_year_pre, fiscal_year_last, [key.upper() for key in months]


def calculate_market_share(df, group_by, fiscal_year_pre, fiscal_year_last, drill_state, time_grain, resp_format,
                           resp_level,
                           filters, resp_format_org, sales_key="sales"):
    # Convert Decimal to float for Pandas compatibility
    if "sales" in  df.columns.tolist():
        df["sales"] = df["sales"].astype(float)
        
    # new_geo_filters = ["zone_name", "region_name", "distname", "statename"]
    # cleaned_filters = []
    # for cond in filters:
    #     cond['key'] = cond['key'].strip('"')

    #     # Skip "All" for geo filters
    #     if cond['key'] in new_geo_filters and isinstance(cond['value'], str) and cond['value'].strip().lower() == "all":
    #         continue

    #     # Convert comma-separated strings to list if needed
    #     if isinstance(cond["value"], str):
    #         value = [v.strip() for v in cond["value"].split(",")]
    #         if len(value) > 1:
    #             cond["cond"] = "one-off"
    #             cond["value"] = value
    #         else:
    #             cond["value"] = value[0]  # keep as string if only one

    #     cleaned_filters.append(cond)

    # filters = cleaned_filters

    # Calculate total sales per fiscal year
    if 'sbu_name' in df.columns.tolist():
        df.loc[df['sbu_name'] == '', 'sbu_name'] = 'Unknown'
    total_sales = df.groupby(group_by)["sales"].sum().reset_index()
    total_sales.rename(columns={"sales": "market_share"}, inplace=True)
    unique_companies = list(df['coname'].unique()) if resp_format == "company_level" else ["HPCL"]
    summary = total_sales
    summary.to_csv('/tmp/summarydata.csv',index = False)
    if resp_format == "company_level":
        for company in unique_companies:
            print("group_by",group_by)
            company_share = df[df["coname"] == company].groupby(group_by)["sales"].sum().reset_index()
            company_share.rename(columns={"sales": f"{company.lower()}_share"}, inplace=True)
            # Merge results
            summary = summary.merge(company_share, on=group_by, how="left").fillna(0)
            company_share.to_csv('/tmp/company_share.csv',index = False)
    else:
        # Calculate HPCL's total sales per fiscal year
        hpcl_sales_per_year = df[df["coname"] == "HPCL"].groupby(group_by)["sales"].sum().reset_index()
        hpcl_sales_per_year.rename(columns={"sales": "hpcl_share"}, inplace=True)

        # Merge results
        summary = summary.merge(hpcl_sales_per_year, on=group_by, how="left").fillna(0)
    # Mapping fiscal years to prefixes
    prefix_map = {}
    if fiscal_year_pre:
        prefix_map[fiscal_year_pre] = "actual"
    if fiscal_year_last:
        prefix_map[fiscal_year_last] = "history"

    # if group by was less than sending an extra key  cumulative
    if not drill_state:
        if len(group_by) <= 1:
            summary['cumulative'] = "CUMMULATIVE_SALES"
            group_items = ["cumulative"]
        else:
            group_items = []
            for key in Base_Filters[::-1]:
                key = key.strip('"')
                if key in group_by:
                    group_items = [key]
                    if key != 'productname':
                        break
    else:
        if not drill_state.startswith('"'):
            drill_state = f'"{drill_state}"'

        if time_grain == "Monthly":
            group_items = [Base_Filters[Base_Filters.index(drill_state) + 1].strip('"'), "month_name"]
        else:
                group_items = [Base_Filters[Base_Filters.index(drill_state) + 1].strip('"')]
    if '"ind_sbu_cumulative"' in [x['key'] for x in filters]:
        months_list = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR']
        req_month = [x['value'] for x in filters if x['key'] =='"month_name"'][0]
        req_index = months_list.index(req_month.strip('"'))
        cumulative_months = months_list[:req_index+1] 
        req_df = summary[summary['month_name'] == req_month.strip('"')]
        cum_df = summary[summary['month_name'].isin(cumulative_months)]
        
        for each_filter in filters:
            if each_filter['key'] == '"company_name"' or each_filter['key'] == 'company_name':
                #com_name = [x['value'] for x in filters if x['key'] =='"company_name"'][0]
                com_name = each_filter['value'].split(",")
                req_df = req_df[[col for col in req_df.columns if any(name.lower() in col.lower() for name in com_name)]+['sbu_name']]
                cum_df = cum_df[[col for col in cum_df.columns if any(name.lower() in col.lower() for name in com_name)]+['month_name','sbu_name']]
        data = req_df.to_dict(orient='records')
        cumulative_data = {'cumulative':[]}
        cumulative_data['month_name'] = df['month_name'].unique().tolist()
        if 'sbu_name' in cum_df.columns.unique():
            for each_sbu in cum_df['sbu_name'].unique().tolist():
                df_sbu = cum_df[cum_df['sbu_name'] ==each_sbu]
                sample = {}
                for index, row in df_sbu.iterrows():
                    for company in com_name:
                        column_name = company.lower() + '_share'
                        if column_name in df_sbu.columns:
                            sample[row['month_name'] + f'_{company.lower()}_cum'] = row[column_name]

                    #column_name = com_name.lower() + '_share'  # Correct column name
                    # if column_name in df_sbu.columns:  # Ensure column exists
                    #       sample[row['month_name'] + '_cum'] = row[column_name]
                sample['sbu_name'] = each_sbu
                cumulative_data['cumulative'].append(sample)
        if data and cumulative_data:
            return {'message':'Industry month cumulative','data':data,'cumulative':cumulative_data,'status':True}
        
        req_df.to_csv('/tmp/req_df.csv',index = False)
        cum_df.to_csv('/tmp/cum_df.csv',index = False)
    if '"ind_analytics"' in [x['key'] for x in filters]:
        final_output = []
        data = summary.to_dict(orient='records')
        transformed_data = defaultdict(lambda: defaultdict(dict))
        company_columns = [col for col in data[0].keys() if col.endswith("_share") and col not in ["market_share"]]
        companies = [col.replace("_share", "").upper() for col in company_columns]

        for entry in data:
            sbu = entry["sbu_name"]
            product = entry["productname"]
            year = entry["fiscal_year"]
            market_share = entry["market_share"]
            # Store sales data
            transformed_data[(sbu, product)][f"Total_Sales_{year}"] = market_share
            for company in companies:
                transformed_data[(sbu, product)][f"{company}_Sales_{year}"] = entry[f"{company.lower()}_share"]

        # Convert to list format
        final_output = []

        for (sbu, product), values in transformed_data.items():
            entry = {"SBU": sbu, "PROD": product}
            
            years = sorted([y.split("-")[1] for y in values.keys() if "Total_Sales" in y])
            
            for i in range(len(years)):
                curr_year = years[i]
                prev_year = str(int(curr_year) - 1)
                fiscal_year = f"{prev_year}-{curr_year}"
                prev_fiscal_year = f"{int(prev_year)-1}-{prev_year}"
                
                total_sales = values.get(f"Total_Sales_{fiscal_year}", 0)
                prev_total_sales = values.get(f"Total_Sales_{prev_fiscal_year}", 0)
                
                for company in companies:
                    sales = values.get(f"{company}_Sales_{fiscal_year}", 0)
                    prev_sales = values.get(f"{company}_Sales_{prev_fiscal_year}", 0)
                    
                    growth = 100.0 if prev_sales == 0 else ((sales - prev_sales) / prev_sales) * 100
                    market_share = (sales / total_sales) * 100 if total_sales else 0
                    
                    entry[f"{company}_Sales_{fiscal_year}"] = sales
                    entry[f"{company}_Gr_{fiscal_year}"] = round(growth, 1)
                    entry[f"{company}_MktSh_{fiscal_year}"] = round(market_share, 1)
            
            final_output.append(entry)
        return {'message':'Industry Analytics','data':final_output,'status':True,'company':unique_companies}
        for entry in data:
            sbu = entry["sbu_name"]
            product = entry["productname"]
            year = entry["fiscal_year"]
            market_share = entry["market_share"]

            # Store sales data
            transformed_data[(sbu, product)][f"Total_Sales_{year}"] = market_share
            transformed_data[(sbu, product)][f"HPCL_Sales_{year}"] = entry["hpcl_share"]
            transformed_data[(sbu, product)][f"BPCL_Sales_{year}"] = entry["bpcl_share"]
            transformed_data[(sbu, product)][f"IOC_Sales_{year}"] = entry["iocl_share"]

            # Convert to list format
            final_output = []

            for (sbu, product), values in transformed_data.items():
                entry = {"SBU": sbu, "PROD": product}

                years = sorted([y.split("-")[1] for y in values.keys() if "Total_Sales" in y])

                for i in range(len(years)):
                    curr_year = years[i]
                    prev_year = str(int(curr_year) - 1)
                    fiscal_year = f"{prev_year}-{curr_year}"
                    prev_fiscal_year = f"{int(prev_year) - 1}-{prev_year}"

                    total_sales = values.get(f"Total_Sales_{fiscal_year}", 0)
                    prev_total_sales = values.get(f"Total_Sales_{prev_fiscal_year}", 0)

                    for company in ["HPCL", "BPCL", "IOC"]:
                        sales = values.get(f"{company}_Sales_{fiscal_year}", 0)
                        prev_sales = values.get(f"{company}_Sales_{prev_fiscal_year}", 0)

                        growth = 100.0 if prev_sales == 0 else ((sales - prev_sales) / prev_sales) * 100
                        market_share = (sales / total_sales) * 100 if total_sales else 0

                        entry[f"{company}_Sales_{fiscal_year}"] = sales
                        entry[f"{company}_Gr_{fiscal_year}"] = round(growth, 1)
                        entry[f"{company}_MktSh_{fiscal_year}"] = round(market_share, 1)

                final_output.append(entry)
        return {'message': 'Industry Analytics', 'data': final_output, 'status': True, "company": unique_companies}
        # print("updated_dicts",data)
    if 'sbu_level' in resp_level or 'product_level' in resp_level:
        # Transforming data
        summary = summary.fillna('0')
        #for item in summary.to_dict(orient= 'records'):
        li = summary.to_dict(orient='records')
        transformed_data = []
        if 'sbu_level' in resp_level:
            for item in li:
                transformed_data.append(
                    {
                        f"{prefix_map[item['fiscal_year']]}_market_share": item["market_share"],
                        **{f"{prefix_map[item['fiscal_year']]}_{company.lower()}_share":
                               item[f"{company.lower()}_share"] for company in unique_companies},
                        **{grp_item: item[grp_item] for grp_item in group_items},
                        f"sbu_name": item["sbu_name"]
                    }
                )
        if 'product_level' in resp_level:
            for item in li:
                transformed_data.append(
                    {
                        f"{prefix_map[item['fiscal_year']]}_market_share": item["market_share"],
                        **{f"{prefix_map[item['fiscal_year']]}_{company.lower()}_share":
                               item[f"{company.lower()}_share"] for company in unique_companies},
                        **{grp_item: item[grp_item] for grp_item in group_items},
                        f"productname": item["productname"]
                    }
                )
        # print("transformed_data", transformed_data)
        if len(resp_level) == 2:
            for item in li:
                transformed_data.append(
                    {
                        f"{prefix_map[item['fiscal_year']]}_market_share": item["market_share"],
                        **{f"{prefix_map[item['fiscal_year']]}_{company.lower()}_share":
                               item[f"{company.lower()}_share"] for company in unique_companies},
                        **{grp_item: item[grp_item] for grp_item in group_items},
                        f"sbu_name": item["sbu_name"],
                        f"productname": item['productname']
                    }
                )
    else:
        if '"table_graph"' in [x['key'] for x in filters]:
            summary.to_csv('/tmp/summry_latest.csv',index = False)
            #summary_py = summary[summary['fiscal_year'] == summary['fiscal_year'].unique().tolist()[0]]
            
            
            #summary = summary[summary['fiscal_year'] == summary['fiscal_year'].unique().tolist()[-1]]
            #summary.to_csv('/tmp/summry_latest1.csv',index = False)
        
        print("prefix_map",prefix_map)
        transformed_data = [
            {
                f"{prefix_map[item['fiscal_year']]}_market_share": item["market_share"],
                **{f"{prefix_map[item['fiscal_year']]}_{company.lower()}_share":
                       item[f"{company.lower()}_share"] for company in unique_companies},
                **{grp_item: item[grp_item] for grp_item in group_items}
            }
            for item in summary.to_dict(orient='records')
        ]
    # Merging records based on 'group_item'
    merged_data = defaultdict(dict)

    for item in transformed_data:
        if len(group_items) == 1:
            sbu = item[group_items[0]]
            merged_data[sbu].update(item)
            merged_data[sbu][group_items[0]] = sbu  # Ensure group_item is retained
        else:
            base_key = group_items[0]
            for grp_item in group_items[1:]:
                sbu = item[grp_item]
                merged_data[f"{sbu}_{item[base_key]}"].update(item)
                merged_data[f"{sbu}_{item[base_key]}"][grp_item] = sbu  # Ensure group_item is retained
    if drill_state:
        return generate_stacked_data(pd.DataFrame(list(merged_data.values())), resp_format, "month_name")
    # Convert back to list of dictionaries
    df = pd.DataFrame(list(merged_data.values())).fillna(0)
    if resp_level in ['sbu_level', 'product_level']:
        df = pd.DataFrame(transformed_data)
    if resp_format == 'company_level' and time_grain != 'Monthly':
        data = df.to_dict(orient='records')
        print("data",data)
        
        input_dict = data[0]
        companies = sorted(set(
            re.sub(r'^(history|actual)_|_share$', '', key)
            for key in input_dict.keys()
            if key.startswith(('history_', 'actual_'))  # Only process valid keys
        ))
        history_shares = {str(i): input_dict.get(f'history_{company}_share', 0.0) for i, company in
                          enumerate(companies)}
        actual_shares = {str(i): input_dict.get(f'actual_{company}_share', 0.0) for i, company in enumerate(companies)}

        # Construct final output dictionary
        output_dict = {
            "history_share": history_shares,
            "company": {str(i): company for i, company in enumerate(companies)},
            "actual_share": actual_shares
        }
        #transformed_data = json.dumps(output_dict, indent=4, ensure_ascii=False)
        transformed_data = output_dict
        return {'message': 'Industry Cummulative company_level Data', 'data': transformed_data, 'status': True}
    if "month_name" in df.columns:
        df["month_name"] = pd.Categorical(df["month_name"], categories=[m.upper() for m in m60.months], ordered=True)
        df = df.sort_values('month_name').reset_index(drop=True)
    if resp_format == 'company_level' and time_grain == 'Monthly' and '"inc"' in [x['key'] for x in filters]:
        getCumulative = False
        if '"cumulative"' in [x['key'] for x in filters]:
            getCumulative = True
        cols_to_cumsum = [col for col in df.columns if col != 'month_name']
        
        if not getCumulative:
            df[cols_to_cumsum] = df[cols_to_cumsum].cumsum()
        
                    
        """
        below code is for line graph combining all opsu as psu companies and all pvt companies as pvt in the result
        """
        required_companies = [x['value'] for x in filters if x['key'].strip('"') == 'company_name'][0].split(",")
        base_companies = ['HPCL', 'BPCL', 'IOCL']
        selected_columns = [col for col in df.columns if any(comp.lower() in col for comp in base_companies)]
        if required_companies:
            for company in base_companies:
                if company in required_companies:
                    required_companies.remove(company)
        
        actual_columns = [f"actual_{company.lower()}_share" for company in required_companies if f"actual_{company.lower()}_share" in df.columns]
        history_columns = [f"history_{company.lower()}_share" for company in required_companies if f"history_{company.lower()}_share" in df.columns]  
        if len(required_companies) == 6:
            for company in required_companies:
                if f"actual_{company.lower()}_share" not in df:
                    df[f"actual_{company.lower()}_share"] = 0
                if f"history_{company.lower()}_share" not in df:
                    df[f"history_{company.lower()}_share"] = 0
            df["actual_psu_share"] = df[[f"actual_{company.lower()}_share" for company in required_companies]].sum(axis=1)
            df["history_psu_share"] = df[[f"history_{company.lower()}_share" for company in required_companies]].sum(axis=1)
            new_df = df[selected_columns + ["month_name","actual_psu_share", "history_psu_share"]]
        if len(required_companies) > 6:
            
            #oth_psu = [x.lower() for x in OMC['OtherPSU']]
            actual_opsu_columns = [f"actual_{company.lower()}_share" for company in required_companies if f"actual_{company.lower()}_share" in df.columns and company in OMC['OtherPSU']]
            history_opsu_columns = [f"history_{company.lower()}_share" for company in required_companies if f"history_{company.lower()}_share" in df.columns and company in OMC['OtherPSU']]  
            actual_pvt_columns = [f"actual_{company.lower()}_share" for company in required_companies if f"actual_{company.lower()}_share" in df.columns and company in OMC['PVT']]
            history_pvt_columns = [f"history_{company.lower()}_share" for company in required_companies if f"history_{company.lower()}_share" in df.columns and company in OMC['PVT']]  
            
            # df["actual_pvt_share"] = df[[f"actual_{company.lower()}_share" for company in required_companies]].sum(axis=1)
            # df["history_pvt_share"] = df[[f"history_{company.lower()}_share" for company in required_companies]].sum(axis=1)
            
            
            df["actual_psu_share"] = df[actual_opsu_columns].sum(axis=1)
            df["history_psu_share"] = df[history_opsu_columns].sum(axis=1)
            df["actual_pvt_share"] = df[actual_pvt_columns].sum(axis=1)
            df["history_pvt_share"] = df[history_pvt_columns].sum(axis=1)
            
            new_df = df[selected_columns + ["month_name","actual_psu_share","history_psu_share","actual_pvt_share", "history_pvt_share"]]           
        if len(required_companies) <=3:
            li = df.columns.tolist()
            #line_axis will give the name of distint company categories that will come in response
            line_axis = [x.split('_')[1] for x in li if 'market' not in x and 'actual' not in x  and 'name' not in x]
            return {'message': 'Industry_Performance_LineGraph', 'status': True,
                'data': {key: value.to_dict() for key, value in df.to_dict(orient='series').items()},'axis':line_axis}
        li = new_df.columns.tolist()
        line_axis = [x.split('_')[1] for x in li if 'market' not in x and 'actual' not in x  and 'name' not in x]
        return {'message': 'Industry_Performance_LineGraph', 'status': True,
                'data': {key: value.to_dict() for key, value in new_df.to_dict(orient='series').items()},'axis':line_axis}
    if resp_format == 'company_level' and (resp_level == 'sbu_level' or resp_level == 'product_level') and resp_format_org == 'company_level_heatmap':
        print("filters",filters)
        com_name = [x['value'] for x in filters if x['key'].strip('"') == 'company_name'][0]
        cols = [col for col in df.columns if
                com_name in col or 'month_name' in col or 'sbu_name' in col or 'productname' in col]
        df = df[cols]
        for col in df.columns:
            if 'actual' in col or 'history' in col:
                #df[col] = df[col].fillna(0).astype(float)
                df[col] = df[col].astype(str).replace('nan', '0').astype(float)

        import json
        month_mapper = {m: m.capitalize() for m in ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]}
        list1 = df.to_dict(orient='records')
        output = {}
        if resp_level == 'sbu_level':
            req_key = 'sbu_name'
            req_names = set(item['sbu_name'] for item in list1)
        if resp_level == 'product_level':
            req_names = set(item['productname'] for item in list1)
            req_key = 'productname'
        for entry in list1:
            req_name = entry[req_key].upper()  # Ensure consistent uppercase handling
            month = month_mapper[entry["month_name"]]
            actual = entry[f"actual_{com_name}_share"] if entry[f"actual_{com_name}_share"] is not None else 0.0
            history = entry[f"history_{com_name}_share"] if entry[f"history_{com_name}_share"] is not None else 0.0

            if req_name not in output and 'sbu_level' in resp_level:
                output[req_name] = {"sbu_name": req_name.capitalize()}  # Convert back to title case for output
            if req_name not in output and 'product_level' in resp_level:
                output[req_name] = {"productname": req_name.capitalize()}
            # Sum values if they exist already
            output[req_name][f"{month}_actual"] = output[req_name].get(f"{month}_actual", 0.0) + actual
            output[req_name][f"{month}_history"] = output[req_name].get(f"{month}_history", 0.0) + history
        return {'message': 'Industry Cummulative company_level Data', 'data': list(output.values()), 'status': True,
                'company': unique_companies}

    if resp_format == 'company_level' and (resp_level == 'sbu_level' or resp_level == 'product_level') and resp_format == 'company_level':
        months = df['month_name'].unique().tolist()
        company = [x['value'].strip('"') for x in filters if x['key'] == '"company_name"'][0].lower()
        for col in df.columns.tolist():
            if 'actual' in col or 'history' in col:
                df[col] = df[col].fillna(0)
        list1 = df.to_dict(orient='records')
        list2 = []
        # Define the months in order
        #months = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR']

        # Group by sbu_name
        if resp_level == 'sbu_level':
            req_key = 'sbu_name'
            req_names = set(item['sbu_name'] for item in list1)
        if resp_level == 'product_level':
            req_names = set(item['productname'] for item in list1)
            req_key = 'productname'
        for req_name in req_names:
            req_data = {
                'name': req_name,
                'Data': []
            }

            for month in months:
                month_data = {
                    'name': month.capitalize(),
                    'actual': 0,
                    'history': 0
                }

                # Find the actual and history data for the current month and sbu_name
                for item in list1:
                    if item['month_name'] == month and item[req_key] == req_name:
                        # Extract data for the specified company
                        actual_key = f'actual_{company}_share'
                        history_key = f'history_{company}_share'

                        if actual_key in item:
                            month_data['actual'] = item[actual_key]
                        if history_key in item:
                            month_data['history'] = item[history_key]

                req_data['Data'].append(month_data)

            list2.append(req_data)
        if len(data) == 0:
            return {'message':'Industry_Performance_SBU_Level_Graphs','status':False,'data':list2,'company':unique_companies}
        return {'message':'Industry_Performance_SBU_Level_Graphs','status':True,'data':list2,'company':unique_companies}

    if '"table_graph"' in [x['key'] for x in filters]:
        df.to_csv('/tmp/df_graph.csv',index = False)
        companies = [col.replace("actual_", "").replace("_share", "") for col in df.columns 
             if col.startswith("actual_") and "market" not in col]

        output_list = []

        for company in companies:
            actual_col = f"actual_{company}_share"
            history_col = f"history_{company}_share"
            
            total_actual = df[actual_col].sum()
            # total_history = df[history_col].sum()
            if history_col in df.columns:
                total_history = df[history_col].sum()
            else:
                total_history = 0.0 # Or some other appropriate default value
            
            # Handle division by zero scenarios
            if total_history == 0:
                market_share = 100 if total_actual > 0 else None  # If actual > 0 & history = 0 -> 100%, else None
            elif total_actual == 0:
                market_share = -100  # If actual = 0 & history > 0 -> -100%
            else:
                market_share = round(((total_actual - total_history) / total_history) * 100, 1)
            
            entry = {
                "company": company.upper(),
                "market_share": market_share,
                "tmt": int(total_actual)  # Total actual share
            }
            
            output_list.append(entry)
        print("output_list",output_list)
        if len(output_list) ==0:
            return {'message':'Industry_Performance_SBU_Level_Graphs','status':False,'data':output_list,'company':unique_companies}
        return {'message':'Industry_Performance_SBU_Level_Graphs','status':True,'data':output_list,'company':unique_companies}

        companies = [col.replace("actual_", "").replace("_share", "") for col in df.columns if col.startswith("actual_")]
        for company in companies:
            actual_col = f"actual_{company}_share"
            history_col = f"history_{company}_share"
            growth_col = f"{company}_growth"
            df[growth_col] = np.where(df[history_col] == 0,np.where(df[actual_col] > 0, 100, np.nan),np.where(df[actual_col] == 0, -100,round(((df[actual_col] - df[history_col]) / df[history_col]) * 100, 1)))
            #df[growth_col] = round(((df[actual_col] - df[history_col]) / df[history_col]) * 100,1)
            df.dropna(subset=[col for col in df.columns if 'growth' in col], how='all', inplace=True)

        df.to_csv('/tmp/df_revised.csv',index = False)
        company_columns = [col for col in df.columns if col not in ['actual_market_share', 'month_name']]
        company_totals = df[company_columns].sum()
        total_market_share = df['actual_market_share'].sum()
        
        
        '''
        # Construct output list
        output = [
            {
                "company": company.upper().replace("ACTUAL_", "").replace("_SHARE", ""),
                "market_share": round((share / total_market_share) * 100, 2),
                "tmt": int(share)
            }
            for company, share in company_totals.items()
        ]
        '''
        if len(output) == 0:
            return {'message':'Industry_Performance_SBU_Level_Graphs','status':False,'data':output,'company':unique_companies}    
        return {'message':'Industry_Performance_SBU_Level_Graphs','status':True,'data':output,'company':unique_companies}

    if '"table_month"' in [x['key'] for x in filters]:
        print("came into table month")
        getCumulative = False
        if '"cumulative"' in [x['key'] for x in filters]:
            getCumulative = True
            req_month = [x['value'] for x in filters if x['key'] == '"table_month"'][0]
            if req_month:
                if req_month.lower() =='apr':
                    months_list = ['apr']
                else:
                    months_list = fy_months[:fy_months.index(req_month.lower())+1]
                    
        req_month = [x['value'] for x in filters if x['key'] == '"table_month"'][0]
        if req_month:
            for col in df.columns.tolist():
                if 'actual' in col or 'history' in col:
                    df[col] = df[col].astype(np.float64).fillna(0) 
            df_filtered = df[df["month_name"] == req_month.strip('"')]
            # print(df_filtered.columns.tolist())
            # df_filtered.to_csv('/tmp/df_filtered.csv', index=False)
            
            # Extract company names dynamically
            company_columns = [col.replace("actual_", "").replace("_share", "") for col in df.columns if col.startswith("actual_") and col != "actual_market_share"]

            output = []
            for company in company_columns:
                actual_volume = df_filtered[f"actual_{company}_share"].sum()
                historical_volume = df_filtered[f"history_{company}_share"].sum()
                
                # Compute market volume excluding the current company
                market_volume = df_filtered[[col for col in df_filtered.columns if col.startswith("actual_") and col == "actual_market_share"]].sum().sum()
                historical_market_volume = df_filtered[[col for col in df_filtered.columns if col.startswith("history_") and col == "history_market_share"]].sum().sum()
                if not getCumulative:
                    cumulative_market_volume = df[[col for col in df.columns if col.startswith("actual_") and col == "actual_market_share"]].sum().sum()
                    cumulative_historical_market_volume = df[[col for col in df.columns if col.startswith("history_") and col == "history_market_share"]].sum().sum()
                else:
                    
                    cumulative_market_volume = df[df['month_name'].str.lower().isin(months_list)][[col for col in df.columns if col.startswith("actual_") 
                                                                                   and col == "actual_market_share"]].sum().sum()
                    cumulative_historical_market_volume = df[df['month_name'].str.lower().isin(months_list)][[col for col in df.columns if col.startswith("history_") 
                                                                                   and col == "history_market_share"]].sum().sum()
                # market_share_change = historical_volume - actual_volume
                market_share_change = ((actual_volume - historical_volume) / historical_volume * 100) if historical_volume else 0
                if not getCumulative:
                    cumulative_actual = df[f"actual_{company}_share"].sum()
                    cumulative_historical = df[f"history_{company}_share"].sum()
                else:
                    cumulative_actual = df[df['month_name'].str.lower().isin(months_list)][f"actual_{company}_share"].sum()
                    cumulative_historical = df[df['month_name'].str.lower().isin(months_list)][f"history_{company}_share"].sum()
                # cumulative_market_share_change = cumulative_historical - cumulative_actual
                cumulative_market_share_change = ((cumulative_actual - cumulative_historical) / cumulative_historical * 100) if cumulative_historical else 0
                output.append({
                    "company": company.upper(),
                    "monthly": {
                        "volume": {
                            "actual": round(actual_volume, 2),
                            "historical": round(historical_volume, 2)
                        },
                        "marketShare": {
                            "actual": round((actual_volume / market_volume) * 100, 2) if market_volume > 0 else 0,
                            "historical": round((historical_volume / historical_market_volume) * 100, 2) if historical_market_volume > 0 else 0,
                            "change": round(market_share_change, 2)
                        }
                    },
                    "cumulative": {
                        "volume": {
                            "actual": round(cumulative_actual, 2),
                            "historical": round(cumulative_historical, 2)
                        },
                        
                        "marketShare": {
                        "actual": round((cumulative_actual / cumulative_market_volume) * 100, 2) if cumulative_market_volume > 0 else 0,
                        "historical": round((cumulative_historical / cumulative_historical_market_volume) * 100, 2) if cumulative_historical_market_volume > 0 else None,
                        "change": round(cumulative_market_share_change, 2)
                    }

                    }
                })
                #below lines are before adding the cumulative button for the table in industry
                '''
                        "marketShare": {
                            "actual": round((actual_volume / market_volume) * 100, 2) if market_volume else 0,
                            "historical": round((historical_volume / historical_market_volume) * 100, 2) if historical_market_volume else 0,
                            "change": round(market_share_change, 2)
                        }
                '''
                '''
                        "marketShare": {
                            "actual": round((cumulative_actual / cumulative_market_volume )* 100, 2) if cumulative_historical else 0,
                            "historical": round((cumulative_historical / cumulative_historical_market_volume) * 100, 2) if "history_market_share" in df.columns else None,
                            "change": round(cumulative_market_share_change, 2)
                        }
                '''
            for each in output:
                for each_ele in each:
                    if each[each_ele] is None:
                        each[each_ele] = ''
            return {'message': 'Industry_Performance__latest_TableData', 'status': True, 'data': output}

    # Print the transformed list2
    data = {key: value.to_dict() for key, value in df.to_dict(orient='series').items()}
    companies = sorted(set(key.split("_")[1] for key in data.keys() if "_" in key and key != "cumulative" and "actual" not in key and "month_name" not in key))
    data['company'] = companies
    return {'message': 'Industry_Performance', 'status': True, 'data': data}


def generate_stacked_data(df, resp_format='', month_column=''):
    columns = df.columns.to_list()
    numeric_cols = [col for col in columns if col.startswith('history') or col.startswith('actual')]
    if month_column and month_column in df.columns:
        df[month_column] = pd.Categorical(df[month_column], categories=[month.upper() for month in m60.months],
                                          ordered=True)
        for column in numeric_cols:
            df[column].fillna(0, inplace=True)
        other_columns = list(set(columns) - set(numeric_cols + [month_column]))
    else:
        other_columns = list(set(columns) - set(numeric_cols))
    if other_columns:
        # For Non-Stacked for data table to display month wise AHT data
        if not resp_format:

            # Pivot Data - Creating separate columns for Actual, History, and Target
            df_pivot = df.pivot(index=other_columns[0], columns=month_column, values=numeric_cols)

            # Flatten MultiIndex Columns and rename them
            df_pivot.columns = [f"{month}_{metric}" if metric in numeric_cols else metric for metric, month in
                                df_pivot.columns]

            # Reset Index to include 'Zone_Name'
            df_pivot.reset_index(inplace=True)

            # Keeping all nan's as zero's
            df_pivot.fillna(0, inplace=True)

            # Convert to Dictionary Format
            return df_pivot.to_dict(orient="records")
        elif resp_format == 'stacked' and month_column:
            # For sending data in stacked format

            # Extract unique months from the dataset
            unique_months = sorted(df[month_column].unique(), key=lambda x: m60.months.index(x))
            series_data = []
            for zone in df[other_columns[0]].unique():
                zone_data = df[df[other_columns[0]] == zone].set_index(month_column)
                for column in numeric_cols:
                    # Creating series data
                    series_data.append({"name": f"{zone} {column.title()}", "stack": column.title(),
                                        "data": [zone_data.loc[m, column] if m in zone_data.index else 0
                                                 for m in unique_months]})
            return {"months": unique_months, "series": series_data}
        elif resp_format == 'cummulative' and month_column:
            df.iloc[:, 1:] = df.iloc[:, 1:].cumsum()
            return {key: value.to_dict() for key, value in df.to_dict(orient='series').items()}
        elif resp_format == 'grouped':
            # For Grouped data
            # Converting data to month wise report
            return [{"month_name": month, **{key: group[key].tolist() for key in numeric_cols + other_columns}}
                    for month, group in df.groupby("month_name")]
    else:
        if resp_format == 'cummulative' and month_column:
            df.iloc[:, 1:] = df.iloc[:, 1:].cumsum()

    # For regular drill down widgets
    df.fillna(0, inplace=True)
    return {key: value.to_dict() for key, value in df.to_dict(orient='series').items()}

def get_mappers():
   
    mappers = {
        'MPSU':['HPCL','BPCL','IOCL'],
        'PSU':['HPCL','BPCL','IOCL','GAIL','CPCL','MRPL','NRL','OIL','ONGC'],
        'PVT':['RIL','NEL','HMEL','SHELL','SMA'],
        'PSU+PVT':['HPCL','BPCL','IOCL','GAIL','CPCL','MRPL','NRL','OIL','ONGC','RIL','NEL','HMEL','SHELL','SMA'],
        'order':['HPCL','BPCL','IOCL','GAIL','CPCL','MRPL','NRL','OIL','ONGC','RIL','NEL','HMEL','SHELL','SMA'],

        'const_colors' : [
            { "name": "HPCL", "color": "#1D4ED8" }, # Blue-700
            { "name": "BPCL", "color": "#FBBF24" }, # Amber-400
            { "name": "IOCL", "color": "#EA580C" }, # Orange-600
            { "name": "RIL", "color": "#A855F7" }, # Purple-500
            { "name": "Nyra", "color": "#14B8A6" }, # Teal-500
            { "name": "Shell","color": "#A16207" }, # Yellow-700
            { "name": "MRPL", "color": "#4D7C0F" }, # Lime-700
            { "name": "GALE", "color": "#991B1B" }, # Red-800
            { "name": "CPCL", "color": "#44403C" }, # Stone-700
            { "name": "HMEL", "color": "#052E16" }, # Green-950
            { "name": "NRL", "color": "#3B0764" }, # Purple-950
            { "name": "NEL", "color": "#0048A8" }, # nayarablue
            { "name": "OIL", "color": "#1F2937" }, # Gray-800
            { "name": "SMA", "color": "#4A044E" }, # Violet-900
            { "name": "BURL", "color": "#9D174D" } # Pink-800
            ]

    }
    return mappers
    
async def industry_performance(filters, cross_filters, drill_state="", time_grain="", resp_format="", resp_level=""):
    print("going to top ")
   
    if resp_format == "historical_years":
    # Call new function to get last 6 fiscal years (with multi-select filters support)
        results = await get_fiscal_sales(
            filters=filters,
            cross_filters=cross_filters,
            resp_format=resp_format
        )

        if not results or not results.get("data"):
            return {
                'status': False,
                'message': "No historical data present for current selection",
                'data': [],
            }

        return {
            'status': True,
            'message': "Success",
            'data': results["data"]
        }
            
    resp_format_lower = resp_format.lower()
    if resp_format_lower == "file_download":
    # Get the data first
        status, results, _ = await get_zones_and_regions(filters, cross_filters, drill_state, time_grain, resp_format_lower)

        if not status:
            return {
                'status': False,
                'message': "No data present for current selection",
                'data': [],
                'file_path': None
            }

        # Convert each part of results to DataFrame separately
        zones_df = pd.DataFrame(results.get("zones", []))
        regions_df = pd.DataFrame(results.get("regions", []))
        districts_df = pd.DataFrame(results.get("districts", []))

        # Combine all into a single DataFrame
        df = pd.concat([zones_df, regions_df, districts_df], ignore_index=True)

        # Clean empty/NaN/inf
        df = df.replace(r'^\s*$', np.nan, regex=True)
        df = df.replace([np.nan, np.inf, -np.inf], 0)

        # Save CSV in /downloads
        file_path = '/downloads/final_data_indus.csv'
        # df.to_csv('/opt/'+file_path, index=False)

        # return {
        #     'status': True,
        #     'message': 'Success',
        #     'data': 'File Downloaded Successfully',
        #     'file_path': file_path
        # }
        with open('/opt/' + file_path, 'w', newline='') as f:
            # Write zones
            f.write("zone_name,total_sales,curr_mkt,his_mkt,gain_loss\n")
            zones_df.to_csv(f, index=False, header=False)
            f.write("\n\n")  # Blank lines between tables

            # Write regions
            f.write("region_name,total_sales,curr_mkt,his_mkt,gain_loss\n")
            regions_df.to_csv(f, index=False, header=False)
            f.write("\n\n")

            # Write districts
            f.write("dist_name,total_sales,curr_mkt,his_mkt,gain_loss\n")
            districts_df.to_csv(f, index=False, header=False)

        return {
            'status': True,
            'message': 'Success',
            'data': 'File Downloaded Successfully',
            'file_path': file_path
        }
   

    if resp_format_lower in ("top_performers", "bottom_performers"):
        status, results, file_path = await get_zones_and_regions(filters, cross_filters, drill_state, time_grain, resp_format_lower)
        if not status:
            # Custom message for no data present (e.g. empty productname)
            return {
                'status': False,
                'message': "No data present for current selection",
                'data': [],
                'file_path': None
            }
        return {
            'status': True,
            'message': 'Success',
            'data': results,
            'file_path': file_path
        }



    if len(filters) ==1 :
        if filters[0]['key'] == '"mappers"':
            return get_mappers()
        
    resp_format_org = resp_format
    if resp_format == 'company_level_heatmap':
        resp_format = 'company_level'
        resp_format_org = 'company_level_heatmap'
    if resp_format == 'growth_table':
        return await industry_performance_compare(filters, [])
    elif resp_format == 'omc_cumulative':
        return await get_category_wise_cumulative_data(filters)
    elif resp_format == 'omc_compare':
        return await generate_omc_compare_data(filters, drill_state)
    if not cross_filters:
        cross_filters = []
    # Checking Cumulative enabled or not, On cumulative we should not group by month
    cumulative = False
    for condition in filters:
        if condition['key'].strip('"') == "C" or condition['key'].strip('"') == "cumulative":
            cumulative = True
            break
    # omc_compare = ["BPCL", "HPCL"]
    omc_compare = list(set([company for sublist in OMC.values() for company in sublist]))
    if ',' in resp_level:
        resp_level = resp_level.split(',')
    # Fetching all group by filters, return should be a list always
    group_by_filter = generate_group_by_conditions(filters,cross_filters, cumulative, drill_state, time_grain,resp_level)
    org_filters = filters
    # OMC comparing filters
    for filter in filters:
        if filter['key'].strip('"') == "OMC" and filter['value']:
            if OMC.get(filter['value']):
                omc_compare = list(set(OMC[filter['value']]+["HPCL"]))
            else:

                omc_compare = list(set([filter['value'].split(",")[0]] + ["HPCL"]))
            break

    # Assigning empty variables
    history = actual = target = start_date = end_date = start_date_history = end_date_history = ""
    filters, fiscal_year_pre, fiscal_year_last, months = get_date_filters(filters,months_list = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR'],cumulative= cumulative)
    
    print("months from get_date_dfilters",months)
    #Added for the purpose of FY2025-2026 Apr ist
    
    # fiscal_year_pre = '2025-2026'
    # fiscal_year_last = '2024-2025'
    fiscal_year_pre = '2026-2027'
    fiscal_year_last = '2025-2026'
    
    for each_filter in org_filters:
        
        if each_filter['key'].strip('"')  =='fiscal_year':
            if each_filter['value'].strip('"') == '2025-2026':
                fiscal_year_pre = '2025-2026'
                fiscal_year_last = '2024-2025'
            if each_filter['value'].strip('"') == '2026-2027':
                fiscal_year_pre = '2026-2027'
                fiscal_year_last = '2025-2026'
            if 'in' in each_filter['cond']:
                fiscal_year_pre = each_filter['value'].split(',')[-1]
                fiscal_year_last = each_filter['value'].split(',')[0]
            if '2024-2025,2025-2026' in each_filter['value'].strip('"'):
                fiscal_year_pre = '2025-2026'
                fiscal_year_last = '2024-2025'
                
    if fiscal_year_pre and not fiscal_year_last:
        filters.append({"key": "fiscal_year", "cond": "equals", "value": fiscal_year_pre})
    elif not fiscal_year_pre and fiscal_year_last:
        filters.append({"key": "fiscal_year", "cond": "equals", "value": fiscal_year_last})
    elif fiscal_year_pre and fiscal_year_last:
        filters.append({"key": "fiscal_year", "cond": "one-off", "value": [fiscal_year_pre, fiscal_year_last]})
    for index, _ in enumerate(cross_filters):
        cross_filters[index]['key'] = cross_filters[index]['key'].strip('"')

    cross_filters = [rec for rec in cross_filters if rec['key'].strip('"') not in ["C", "cumulative"] and
                     not (rec['key'] == 'month_name' and not rec['value'].strip('"'))]

    # Modifying month name filter for cumulative
    month_filter = False
    #print("filters before",org_filters)
    for cond in cross_filters:
        if (cond['key'].strip('"') == 'month_name'  or cond['key'].strip('"') == 'table_month')and ',' in cond['value']:
            cond['cond'] = 'in'
            cond['value'] = cond['value'].split(',')
            month_filter = True
        cond['key'] = cond['key'].strip('"')
    #print("filters before",org_filters)
    '''
    for cond in org_filters:
        if (cond['key'].strip('"') == 'month_name'  or cond['key'].strip('"') == 'table_month'):
            cond['cond'] = 'eqauls'
            cond['value'] = cond['value'].split(',')[0]
            month_filter = True
        cond['key'] = cond['key'].strip('"')
    '''
    
    print("month_filter",month_filter)
    if not month_filter and months:
        print("months",months)
        print("filters before",filters)
        filters.append({"key": "month_name", "cond": "one-off", "value": months})
        print("filters after",filters)
    if "company_name" not in [x['key'].strip('"') for x in org_filters] :
        filters.append({"key": "coname", "cond": "one-off", "value": omc_compare})
    else:
        for each_filter in org_filters:
            if each_filter['key'].strip('"') == 'company_name':
                filters.append({"key": "coname", "cond": "one-off", "value": [x.upper()for x in each_filter['value'].split(",")]})
    print("changed here")
    print("filters",filters)
    for cond in filters:
        cond['key'] = cond['key'].strip('"')
        if isinstance(cond['value'],str):
            print("cond",cond)
            value = [mnt_name.strip() for mnt_name in cond["value"].split(",")]
            if len(value) > 1:
             cond["cond"] = 'one-off'
             cond["value"] = value
    
    where_conditions = []
    where_conditions.extend(['"category" NOT IN (\'O\')'])
    clause = await widget_actions.WidgetActions.generate_filter_clause(cross_filters +filters)
    '''
    if '"ind_analytics"' in [x['key'] for x in filters]:
        print("inside ind") 
        key_mapping = {
            '"sbu_level"': 'sbu_name',
            '"product_level"': 'product_name'
        }
        where_filters = filters
        for item in where_filters:
            if item['key'] in key_mapping:
                item['key'] = key_mapping[item['key']]
        where_filters = [x for x in where_filters if x['key']!= '"ind_analytics"']
        clause = await widget_actions.WidgetActions.generate_filter_clause(cross_filters + where_filters)
    else:
        clause = await widget_actions.WidgetActions.generate_filter_clause(cross_filters + filters)
    '''
    if clause:
        where_conditions.extend([clause])
    group_keys = [key.strip('"') for key in group_by_filter]
    req_keys = f"""ROUND(SUM("netweight_tmt")/1000::numeric,0) AS "sales" """
    print("where_conditions",where_conditions)
    
    resp_data = await m60.collect_data([req_keys], 'industry_performance', where_conditions,
                                       "", "", group_by_filter + ["coname"], "")
    print("fiscal_year_+pre",fiscal_year_pre) 
    print("fiscal_year_last",fiscal_year_last) 
    
    pd.DataFrame(resp_data).to_csv('/tmp/response.csv',index = False)
    print("writing data to csv")
    print("fiscal_year_+pre",fiscal_year_pre) 
    print("fiscal_year_last",fiscal_year_last) 
    # Convert query result to DataFrame
    df = pd.DataFrame(resp_data)

    # Normalize column names to lowercase (or whatever your code expects)
    df.columns = [c.lower() for c in df.columns]
    print("df---",df)
    print("df.columns------->",df.columns)
    return calculate_market_share(pd.DataFrame(resp_data), group_keys, fiscal_year_pre, fiscal_year_last,
                                  drill_state, time_grain, resp_format, resp_level, org_filters, resp_format_org)


def generate_growth_query(
        table_name: str,
        companies: List[str],
        drop_company: str,
        growth_company: str,
        overall_growth_companies: List[str],
        filter_conditions: str,
        drop_threshold: float = 0.98,
        drop_threshold_cond: str = '<',
        growth_threshold: float = 1.00,
        growth_threshold_cond: str = '<',
        overall_growth_threshold: float = 1.10,
        overall_threshold_cond: str = '<'
):
    # Build CASE WHEN for each company
    company_cases = ",\n".join(
        [
            f"SUM(CASE WHEN coname = '{company}' THEN current_year_amount ELSE 0 END) AS {company.lower()}_current,\n"
            f"SUM(CASE WHEN coname = '{company}' THEN last_year_amount ELSE 0 END) AS {company.lower()}_last"
            for company in companies if company in [growth_company, drop_company]
        ]
    )
    company_cases += ",\n"
    company_cases += ",\n".join([
                                    f"SUM(CASE WHEN coname in {tuple(overall_growth_companies)} THEN current_year_amount ELSE 0 END) AS market_share_current",
                                    f"SUM(CASE WHEN coname in {tuple(overall_growth_companies)} THEN last_year_amount ELSE 0 END) AS market_share_last"])

    # Combined growth check for selected companies
    overall_condition = "(" + " + ".join(
        [f"{company.lower()}_current" for company in ['market_share']]
    ) + ")"
    overall_last_condition = "(" + " + ".join(
        [f"{company.lower()}_last" for company in ['market_share']]
    ) + ")"

    # Final Query
    query = f"""
WITH current_year_sales AS (
    SELECT
        sbu_name,
        coname,
        month_name,
        ROUND(SUM(netweight_tmt), 2) AS current_year_amount
    FROM {table_name}
    WHERE fiscal_year='2026-2027'
        {'AND ' + filter_conditions if filter_conditions else ''}
    GROUP BY sbu_name, coname, month_name
),
last_year_sales AS (
    SELECT
        sbu_name,
        coname,
        month_name,
        ROUND(SUM(netweight_tmt), 2) AS last_year_amount
    FROM {table_name}
    WHERE fiscal_year='2025-2026'
        {'AND ' + filter_conditions if filter_conditions else ''}
    GROUP BY sbu_name, coname, month_name
),
combined AS (
    SELECT
        c.sbu_name,
        c.coname,
        c.month_name,
        c.current_year_amount,
        l.last_year_amount
    FROM current_year_sales c
    LEFT JOIN last_year_sales l
        ON c.sbu_name = l.sbu_name
        AND c.coname = l.coname
        AND c.month_name = l.month_name
),
company_growth AS (
    SELECT
        sbu_name,
        month_name,
        {company_cases}
    FROM combined
    GROUP BY sbu_name, month_name
)
SELECT
    sbu_name,
    month_name,
    {', '.join([f"{c.lower()}_current, {c.lower()}_last" for c in companies if c in [drop_company, growth_company]])},
    market_share_last, market_share_current
FROM company_growth
WHERE
    {drop_company.lower()}_last > 0
    AND {growth_company.lower()}_last > 0
    AND ROUND((({drop_company.lower()}_current - {drop_company.lower()}_last / {drop_company.lower()}_last) * 100), 2) {drop_threshold_cond} {drop_threshold}
    AND ROUND(((({growth_company.lower()}_current - {growth_company.lower()}_last)/ {growth_company.lower()}_last) * 100), 2) {growth_threshold_cond} {growth_threshold}
    AND ROUND(((({overall_condition} - {overall_last_condition}) / {overall_last_condition}) * 100), 2) {overall_threshold_cond} {overall_growth_threshold}
ORDER BY sbu_name, month_name;
"""
    return query


async def industry_performance_compare(filters, cross_filters, drill_state="", time_grain="", resp_format=""):
    companies = []
    omcs = []
    all_companies = list(set([company for sublist in OMC.values() for company in sublist]))
    for cond_filter in filters:
        if cond_filter['key'].strip('"') in all_companies:
            companies.append(cond_filter)
        elif cond_filter['key'].strip('"') in OMC:
            omcs.append(cond_filter)
    drop_company = 'HPCL'
    growth_company = ''
    drop_threshold = 0
    drop_threshold_cond = '>'
    growth_threshold = 0
    growth_threshold_cond = '>'
    overall_growth_threshold = 0
    overall_threshold_cond = '>'
    if len(omcs):
        overall_growth_threshold = omcs[0]['value']
        overall_threshold_cond = omcs[0]['cond']
    if not len(companies):
        companies = [{"key": "\"HPCL\"", "cond": ">", "value": 20}]
    if len(companies):
        drop_threshold = companies[0]['value']
        drop_threshold_cond = companies[0]['cond']
        drop_company = companies[0]['key'].strip('"')
    if len(companies) > 1:
        growth_threshold = companies[1]['value']
        growth_threshold_cond = companies[1]['cond']
        growth_company = companies[1]['key'].strip('"')

    # Removing all filters related to company
    filters = [cond_filter for cond_filter in filters if cond_filter['key'].strip('"') not in OMC and
               cond_filter['key'].strip('"') not in all_companies]

    # Getting filters and years to include or exclude
    omc_companies = list(set([company for cond_filter in omcs for company in OMC[cond_filter['key'].strip('"')]]))
    filters, fiscal_year_pre, fiscal_year_last, months = get_date_filters(filters)
    filters.append({"key": "coname", "cond": "one-off",
                    "value": list(set(omc_companies + [cond_filter['key'].strip('"') for cond_filter in companies]))})
    where_conditions = []
    where_conditions.extend(['"category" NOT IN (\'O\')'])
    clause = await widget_actions.WidgetActions.generate_filter_clause(filters)
    if clause:
        where_conditions.extend([clause])
    query = generate_growth_query("industry_performance",
                                  list(set([cond_filter['key'].strip('"') for cond_filter in companies])),
                                  drop_company, growth_company,
                                  list(set(omc_companies + [cond_filter['key'].strip('"') for cond_filter in companies])),
                                  " AND ".join(where_conditions), drop_threshold, drop_threshold_cond,
                                  growth_threshold, growth_threshold_cond, overall_growth_threshold,
                                  overall_threshold_cond)
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    resp = await function(query=query)
    df = pd.DataFrame(resp)
    # Convert Decimal to float for pandas compatibility
    df[[f'{drop_company.lower()}_current', f'{drop_company.lower()}_last',
        f'{growth_company.lower()}_current', f'{growth_company.lower()}_last',
        'market_share_last', 'market_share_current']] = df[
        [f'{drop_company.lower()}_current', f'{drop_company.lower()}_last',
         f'{growth_company.lower()}_current', f'{growth_company.lower()}_last',
         'market_share_last', 'market_share_current']
    ].astype(float)

    # Group by 'sbu_name'
    result = {}
    for sbu, group in df.groupby('sbu_name'):
        financials_drop = {}
        financials_growth = {}
        financials_market = {}

        for _, row in group.iterrows():
            month = row['month_name']

            financials_drop[month] = {
                'actual': row[f'{drop_company.lower()}_current'],
                'history': row[f'{drop_company.lower()}_last']
            }

            financials_growth[month] = {
                'actual': row[f'{growth_company.lower()}_current'],
                'history': row[f'{growth_company.lower()}_last']
            }

            financials_market[month] = {
                'actual': row['market_share_current'],
                'history': row['market_share_last']
            }

        result[sbu] = [
            {"company": f"{drop_company}", "sales": financials_drop},
            {"company": f"{growth_company}", "sales": financials_growth},
            {"company": "Market", "sales": financials_market},
        ]

    return result


async def get_category_wise_cumulative_data(filters):
    """
    Generating data for pie charts for category-wise cumulative data
    :param filters:
    :return:
    """
    org_filters = filters
    print("filters in omc_cumulative",filters)
    months_list = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR']
    present_month = datetime.datetime.now().strftime('%b').upper()
    print("present_month",present_month)
    months_list = months_list[:months_list.index(present_month)]
    print("months_list",months_list)
    print("callimg get date filtere hgere")
    filters, fiscal_year_pre, fiscal_year_last, months = get_date_filters(filters,months_list = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR'])
    print("months",months)
    if not months:
        months = months_list
    where_conditions = []
    where_conditions.extend(['"category" NOT IN (\'O\')'])
    fiscal_years = []
    print("filters",filters)
    for each_filter in org_filters:
        print("each_filter",each_filter)
        if each_filter['key'].strip('"')  =='fiscal_year':
            if each_filter['value'].strip('"') == '2025-2026':
                fiscal_years = ["2024-2025", "2025-2026"]
            if each_filter['value'].strip('"') == '2026-2027':
                fiscal_years = ["2025-2026", "2026-2027"]
    print("fiscal_years",fiscal_years)
    filters.append({"key": "\"fiscal_year\"", "cond": "one-off", "value": fiscal_years})
    for filter_cond in filters:
        filter_cond['key'] = filter_cond['key'].strip('"')
    if months:
        filters.append({'key': 'month_name', 'cond': 'one-off', 'value': months})
     # Modifying filters to handle list conditions
    for cond in filters:
        cond['key'] = cond['key'].strip('"')
        if isinstance(cond["value"], str):
            value = [mnt_name.strip() for mnt_name in cond["value"].split(",")]
            if len(value) > 1:
                cond["cond"] = 'one-off'
                cond["value"] = value
    clause = await widget_actions.WidgetActions.generate_filter_clause(filters)
    if clause:
        
        where_conditions.extend([clause])
    group_by = ["coname", "company_name", "fiscal_year"]
    req_keys = [f"""ROUND(SUM("netweight_tmt")/1000::numeric,0) AS "sales" """, "coname", "company_name", "fiscal_year"]
    resp_data = await m60.collect_data(req_keys, 'industry_performance', where_conditions, "", "",
                                       group_by, "")
    print("resp_data",resp_data)
    df = pd.DataFrame(resp_data)
    if df.empty:
        df = pd.DataFrame(columns=["sales", "coname", "company_name", "fiscal_year"])
    else:
        df["sales"] = df["sales"].astype(str).apply(float)
    
    # resp_data = await m60.collect_data(req_keys, 'industry_performance', where_conditions, "", "", group_by, "")
    # print("resp_data", resp_data)

    # # Insert this block immediately after the above line
    # df = pd.DataFrame(resp_data.get('data', []))  # if resp_data is a dict with 'data'
    # if df.empty:
    #     df = pd.DataFrame(columns=["sales", "coname", "company_name", "fiscal_year"])
    # else:
    #     df["sales"] = df["sales"].astype(float)
    
    # fiscal_years = sorted(df["fiscal_year"].unique())
    # if len(fiscal_years) ==1:
    #     if fiscal_years[0] =='2024-2025':
    #         fiscal_years.extend('2025-2026')
    #     else:
    #         fiscal_years.extend('2024-2025')
            
    # if df.empty:
    #     fiscal_years = ["2024-2025", "2025-2026"]  # default fiscal years when no data
    # else:
    #     fiscal_years = sorted(df["fiscal_year"].unique())
    #     if len(fiscal_years) == 1:
    #         if fiscal_years[0] == '2024-2025':
    #             fiscal_years.append('2025-2026')
    #         else:
    #             fiscal_years.append('2024-2025')
    if df.empty:
        fiscal_years = ["2025-2026", "2026-2027"]  # default fiscal years when no data
    else:
        fiscal_years = sorted(df["fiscal_year"].unique())
        if len(fiscal_years) == 1:
            selected_year = fiscal_years[0]
            # Extract start year from string like '2024-2025'
            start_year = int(selected_year.split("-")[0])
            prev_year = f"{start_year-1}-{start_year}"
            # Append previous year
            fiscal_years.append(prev_year)

    print("fiscal_years------>", fiscal_years)
    
    
    
    result_dict = {year: {} for year in fiscal_years}
    for year in fiscal_years:
        filtered_df = df[df["fiscal_year"] == year]
        filtered_df_mpsu = filtered_df[filtered_df['coname'].isin(OMC['MPSU'])]
        filtered_df_mpsu['company_name'] = 'MPSU'
        filtered_df_psu = filtered_df[filtered_df['coname'].isin(OMC['MPSU']+OMC['OtherPSU'])]
        filtered_df_psu['company_name'] = 'PSU'
        filtered_df_pvt = filtered_df[filtered_df['coname'].isin(OMC['PSU']+OMC['PVT'])]
        filtered_df_pvt['company_name'] = 'PSU+PVT'
        filtered_df = pd.concat([filtered_df_mpsu, filtered_df_psu, filtered_df_pvt])
        for category in filtered_df["company_name"].unique():
            category_df = filtered_df[filtered_df["company_name"] == category]
            result_dict[year][category] = {
                row["coname"]: row["sales"] for _, row in category_df.iterrows()
            }
    # Compute growth percentage
    growth_dict = {}

    for key, details in result_dict.items():
        tuned_data = {}
        for co in details:
            total = sum(list(details[co].values()))
            if co == "MPSU":
                tuned_data[co] = [
                    {"category": c, "value": v, "percentage": round((v / total) * 100, 2) if total != 0 else 0,
                     "subData": [{"category": c, "value": v,
                                  "percentage": round((v / total) * 100, 2) if total != 0 else 0}]} for c, v in
                    details[co].items()]
            elif co == "PSU":
                mpsu = [{"category": c, "value": v, "percentage": round((v / total) * 100, 2) if total != 0 else 0,
                         "subData": [{"category": c, "value": v,
                                      "percentage": round((v / total) * 100, 2) if total != 0 else 0}]} for c, v in
                        details[co].items() if c in OMC['MPSU']]
                other_psu = [
                    {"category": c, "value": v, "percentage": round((v / total) * 100, 2) if total != 0 else 0} for
                    c, v in details[co].items() if c in OMC['OtherPSU']]
                mpsu.append({"category": "Other PSU", "value": sum([r['value'] for r in other_psu]),
                             "percentage": round((sum([r['value'] for r in other_psu]) / total) * 100, 2) if total != 0 else 0,
                             "subData": other_psu})
                tuned_data[co] = mpsu
            elif co == "PSU+PVT":
                mpsu = [{"category": c, "value": v, "percentage": round((v / total) * 100, 2) if total != 0 else 0,
                         "subData": [{"category": c, "value": v,
                                      "percentage": round((v / total) * 100, 2) if total != 0 else 0}]} for c, v in
                        details[co].items() if c in OMC['MPSU']]
                other_psu = [
                    {"category": c, "value": v, "percentage": round((v / total) * 100, 2) if total != 0 else 0} for
                    c, v in details[co].items() if c in OMC['OtherPSU']]
                pvt = [{"category": c, "value": v, "percentage": round((v / total) * 100, 2) if total != 0 else 0}
                       for c, v in details[co].items() if c in OMC['PVT']]
                mpsu.append({"category": "Other PSU", "value": sum([r['value'] for r in other_psu]),
                             "percentage": round((sum([r['value'] for r in other_psu]) / total) * 100, 2) if total != 0 else 0,
                             "subData": other_psu})
                mpsu.append({"category": "PVT", "value": sum([r['value'] for r in pvt]),
                             "percentage": round((sum([r['value'] for r in pvt]) / total) * 100, 2) if total != 0 else 0, "subData": pvt})
                tuned_data[co] = mpsu
        result_dict[key] = tuned_data
    for cogroup, details in result_dict[fiscal_years[-1]].items():
        growth_dict[cogroup] = {}
        cat_prev = {rec['category']: rec for rec in result_dict[fiscal_years[0]][cogroup]}
        print("cat_prev",cat_prev)
        cat_pres = {rec['category']: rec for rec in result_dict[fiscal_years[1]][cogroup]}
        print ("cat_pres",cat_pres)
        for company, data in cat_pres.items():
            if len(data['subData']) <= 1:
                prev_percentage = cat_prev.get(company, {}).get('percentage', 0)
                growth_dict[cogroup][company] = round(data['percentage'] - prev_percentage, 2)
                # growth_dict[cogroup][company] = round(data['percentage'] - cat_prev[company]['percentage'], 2)
                #growth_dict[cogroup][company] = round(((data['percentage'] - cat_prev[company]['percentage']) / cat_prev[company]['percentage']) * 100, 1) if cat_prev[company]['percentage'] != 0 else 100  # If previous value is 0, assume 100% growth

            else:
                cat_prev_sub = {rec['category']: rec for rec in cat_prev[company]['subData']}
                print("cat_prev_sub",cat_prev_sub)
                cat_pres_sub = {rec['category']: rec for rec in data['subData']}
                print("cat_pres_sub----->",cat_pres_sub)
                for co, dt in cat_pres_sub.items():
                    print("co, dt", co, dt)
                    prev_dt = cat_prev_sub.get(co, {"percentage": 0})  # default percentage = 0
                    print("cat_prev_sub.get(co, {}) -->", prev_dt)

                    # Use prev_dt here, NOT cat_prev_sub[co]
                    growth_dict[cogroup][co] = round(dt['percentage'] - prev_dt['percentage'], 2)
                    
                    '''
                    if cat_prev_sub[co]['percentage'] != 0:
                        growth_dict[cogroup][co] = round(
                            ((dt['percentage'] - cat_prev_sub[co]['percentage']) / cat_prev_sub[co]['percentage']) * 100, 1
                        )
                    else:
                        growth_dict[cogroup][co] = 100 if dt['percentage'] != 0 else None  # Avoid ZeroDivisionError
                    '''

    '''
    growth_dict = {
    category: {company: value for company, value in data.items() if value != 0.0 and value != -0.0}
    for category, data in growth_dict.items()
}
    '''
    result_dict["growth_percentage"] = growth_dict
    print("result_dict-----------------------------",result_dict)
    fiscal_years = [k for k in result_dict.keys() if k != "growth_percentage"]
    fiscal_years = sorted(fiscal_years)

    # Ensure growth_percentage key exists
    result_dict.setdefault("growth_percentage", {})

    # If we have at least 2 years, check last and previous
    if len(fiscal_years) >= 2:
        prev_year, curr_year = fiscal_years[-2], fiscal_years[-1]

        prev_empty = not result_dict.get(prev_year)
        curr_data = result_dict.get(curr_year, {})

        # Case 1: Both empty → just keep current year empty
        if prev_empty and not curr_data:
            result_dict[curr_year] = {}

        # Case 2: Prev empty, curr has data → set 100% for all companies
        elif prev_empty and curr_data:
            for category, companies in curr_data.items():
                result_dict["growth_percentage"][category] = {}
                for comp_entry in companies:
                    comp_name = comp_entry["category"]
                    result_dict["growth_percentage"][category][comp_name] = 100

        # Case 3: Curr empty → set it as empty dict
        elif not prev_empty and not curr_data:
            result_dict[curr_year] = {}

        # Case 4: Both have data → leave as is (you can compute actual growth elsewhere)
        else:
            pass

    print("updated result_dict-----------------------------", result_dict)
    return result_dict


async def generate_omc_compare_data(filters, drill_state):
    """
    Generating data for omc compare
    :param filters:
    :param drill_state:
    :return:
    """
    
    org_filters  = filters
    months_list = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR']
    months = []
    ind_sbu_cumulative = [x['value'] for x in filters if 'ind_sbu_cumulative' in x['key'].lower()]

    # Fetching all selected Company groups
    selected_co = [x['value'].strip() for x in filters if x['key'].strip('"') == 'cogroup']

    # Fetching all selected companies which will send for display
    required_companies = list(set([[rec.strip() for rec in x['value'].split(',')]
                                   for x in filters if x['key'].strip('"') == 'coname'][0]))

    # If no group selected then considering only MPSU
    if not selected_co and not required_companies:
        selected_co = ["MPSU"]

    # Companies required for market share
    market_share_companies = []
    for co in selected_co:
        market_share_companies.extend(OMC.get(co, []))

    market_share_companies = list(set(market_share_companies))

    if not market_share_companies and required_companies:
        market_share_companies = required_companies.copy()

    if not required_companies:
        required_companies = market_share_companies.copy()

    # Discarding extra filters
    filters = [x for x in filters if x['key'].strip('"') not in ['cogroup', 'coname', 'ind_sbu_cumulative'] and x['value']]
    # If ind_sbu_cumulative is true doing Cumulative upto given month else only for the given month
    if True in ind_sbu_cumulative or 'true' in ind_sbu_cumulative:
        req_month = [x['value'] for x in filters if x['key'] == '"month_name"']
        req_month = req_month[0] if req_month else ""
        if len(req_month.split(",")) >= 2:
            start_month = req_month.split(",")[0].strip()
            end_month = req_month.split(",")[-1].strip()
            months = months_list[months_list.index(start_month):months_list.index(end_month) + 1]
        else:
            if req_month and req_month in months_list:
                req_index = months_list.index(req_month.strip())
                months = months_list[:req_index + 1]

    # Getting all filters
    filters, fiscal_year_pre, fiscal_year_last, months_ = get_date_filters(filters)
    print("filters after get_date ",filters)
    print("months",months_)
    if "ind_sbu_cumulative" in [x['key'].strip('"') for x in org_filters]:
        if months:
            months = months_
        print("months in req check",months)        
    if not months:
        months = months_
    where_conditions = []
    where_conditions.extend(['"category" NOT IN (\'O\')'])
    filters = [cond_filter for cond_filter in filters if cond_filter['key'].strip('"') not in ["fiscal_year", 'month_name']]

    
    for filter_cond in filters:
        filter_cond['key'] = filter_cond['key'].strip('"')
    if months:
        filters.append({'key': 'month_name', 'cond': 'one-off', 'value': months})

    filters.append({'key': 'coname', 'cond': 'one-off', 'value': market_share_companies})
    year_filters = [filter for filter in org_filters if filter['key'].strip('"') == 'fiscal_year']
    print("year_filters",year_filters)
    fiscal_year_pre = (f"{fiscal_year.FiscalYear.current().start.year}-"
                       f"{fiscal_year.FiscalYear.current().end.year}")
    print("fiscal_year_pre---->",fiscal_year_pre)
    fiscal_year_last = (f"{fiscal_year.FiscalYear.current().prev_fiscal_year.start.year}-"
                        f"{fiscal_year.FiscalYear.current().prev_fiscal_year.end.year}")
    print("fiscal_year_last--->",fiscal_year_last)

    if year_filters[0]['value'].strip('"') != fiscal_year_pre:
        print("coming---->")
        if abs(int(year_filters[0]['value'].split('-')[0]) - int(fiscal_year_pre.split('-')[0])) != 2:
             print("coming in if")
             fiscal_year_pre = fiscal_year_last
             fiscal_year_last = str(int(fiscal_year_last.split('-')[0])-1)+'-'+str(int(fiscal_year_last.split('-')[-1]) -1)
             filters.append({"key": "\"fiscal_year\"", "cond": "in", "value": [fiscal_year_pre, fiscal_year_last]})
        else:
            fiscal_year_pre = '2025-2026'
            fiscal_year_last = '2024-2025'
    else:
        filters.append({"key": "\"fiscal_year\"", "cond": "in", "value": ["2025-2026", "2026-2027"]})
    present_month = datetime.datetime.now().strftime('%b')
    #if present_month.lower() == 'apr':
    #            fiscal_year_pre = fiscal_year_last
    #            fiscal_year_last =str(int(fiscal_year_last.split('-')[0]) - 1 )+'-'+ str(int(fiscal_year_last.split('-')[0]))
    print("fiscal_year_pre",fiscal_year_pre)
    print("fiscal_year_last",fiscal_year_last)
    
    # Modifying filters to handle list conditions
    # for cond in filters:
    #     cond['key'] = cond['key'].strip('"')
    #     if isinstance(cond["value"], str):
    #         value = [mnt_name.strip() for mnt_name in cond["value"].split(",")]
    #         if len(value) > 1:
    #             cond["cond"] = 'one-off'
    #             cond["value"] = value
    
    new_geo_filters = ["zone_name", "region_name", "distname", "statename"]
    cleaned_filters = []
    for cond in filters:
        cond['key'] = cond['key'].strip('"')
        # Skip if value is "All" (means no filter)
        if cond['key'] in new_geo_filters and cond['value'].strip().lower() == "all":
            continue
        # Handle comma-separated multiple values
        if isinstance(cond["value"], str):
            value = [v.strip() for v in cond["value"].split(",")]
            if len(value) > 1:
                cond["cond"] = "one-off"
                cond["value"] = value
            else:
                cond["value"] = value[0]  # keep as string if only one
        cleaned_filters.append(cond)

    filters = cleaned_filters

    clause = await widget_actions.WidgetActions.generate_filter_clause(filters)
    
    if clause:
        where_conditions.extend([clause])

    group_by = ["coname", "fiscal_year"]
    req_keys = [f"""ROUND(SUM("netweight_tmt")/1000::numeric,0) AS "sales" """, "fiscal_year", "coname"]
    if drill_state and drill_state not in group_by:
        group_by.append(drill_state)
        req_keys.append(drill_state)
    resp_data = await m60.collect_data(req_keys, 'industry_performance', where_conditions, "", "",
                                       group_by, "")
    # Transform data
    table = defaultdict(lambda: {"History": {}, "Market Share": {}, "Growth": {}, "Sales": {},
                                 "Market Share History": {}})

    for entry in resp_data:
        drill_key = entry[drill_state] if drill_state else "cumulative"
        company = entry["coname"]
        # sales = float(entry["sales"])  # Convert Decimal to int
        sales = entry.get("sales")
        sales = 0 if sales is None or (isinstance(sales, str) and sales.strip() == "") else sales
        if entry["fiscal_year"] == fiscal_year_pre:
            table[drill_key]["Sales"][company] = sales
        elif entry["fiscal_year"] == fiscal_year_last:
            table[drill_key]["History"][company] = sales

    # Convert table to list format
    structured_data = [{f"{drill_state if drill_state else 'cumulative'}": key, **values} for key, values in table.items() if key]

    cumulative_data = {"sbu_name": "Total", "History": {}, "Market Share": {}, "Growth": {}, "Sales": {},
                       "Market Share History": {}}
    for rec in structured_data:
        if 'cumulative' in rec:
            del rec['cumulative']
            continue
        if drill_state:
            for key, value in rec.items():
                if key not in ['History', 'Sales']:
                    continue
                for co, val in value.items():
                    if co not in cumulative_data[key]:
                        cumulative_data[key][co] = 0
                    cumulative_data[key][co] += val
    if drill_state:
        structured_data = [cumulative_data] + structured_data
    '''
    # Calculating Market Share
    for entry in structured_data:
        total_sales = sum(entry['Sales'].values())
        total_history_sales = sum(entry['History'].values())
        for company in entry['Sales']:
            entry['Market Share'][company] = round((entry['Sales'].get(company, 0) / total_sales) * 100, 2)
        for company in entry['History']:
            entry['Market Share History'][company] = (round((entry['History'].get(company, 0) / total_history_sales * 100), 2))
        for company in entry['Sales']:
            if entry['History'].get(company, 0):
                entry['Growth'][company] = round(((entry['Sales'].get(company, 0) -entry['History'].get(company, 0)) /entry['History'].get(company, 0)) * 100, 1)
            else:
                entry['Growth'][company] = 100
        for name in entry:
            if isinstance(entry[name], dict):
                entry[name] = {key: value for key, value in entry[name].items() if key in required_companies}
    '''
    for entry in structured_data:
        total_sales = sum(entry['Sales'].values())
        total_history_sales = sum(entry['History'].values())
        
        # Check for division by zero
        if total_sales != 0:
            for company in entry['Sales']:
                entry['Market Share'][company] = round((entry['Sales'].get(company, 0) / total_sales) * 100, 2)
        else:
            for company in entry['Sales']:
                entry['Market Share'][company] = 0
        
        # Check for division by zero
        if total_history_sales != 0:
            for company in entry['History']:
                entry['Market Share History'][company] = round((entry['History'].get(company, 0) / total_history_sales) * 100, 2)
        else:
            for company in entry['History']:
                entry['Market Share History'][company] = 0
        
        for company in entry['Sales']:
            if company in entry['History'] and entry['History'].get(company, 0) != 0:
                entry['Growth'][company] = round(((entry['Sales'].get(company, 0) - entry['History'].get(company, 0)) / entry['History'].get(company, 0)) * 100, 1)
            elif company in entry['History'] and entry['History'].get(company, 0) == 0 and entry['Sales'].get(company, 0) != 0:
                entry['Growth'][company] = 100  # or some other value that makes sense for your use case
            elif company in entry['History'] and entry['History'].get(company, 0) == 0 and entry['Sales'].get(company, 0) == 0:
                entry['Growth'][company] = 0  # or some other value that makes sense for your use case
            else:
                entry['Growth'][company] = None  # or some other value that makes sense for your use case

        for name in entry:
            if isinstance(entry[name], dict):
                entry[name] = {key: value for key, value in entry[name].items() if key in required_companies}
    
    for rec in structured_data:
        if 'cumulative' in rec:
            del rec['cumulative']
            continue
    return structured_data


async def generate_response(question):
    question = question.upper()  # Convert to lowercase
    extracted = {key: [] for key in KEYWORDS}  # Initialize output keys
    # Match keywords to fields
    for key, words in KEYWORDS.items():
        for word in words:
            if word in question:
                extracted[key].append(word)  # Assign the found keyword (or later a matched value)
    return extracted


async def generate_industry_recommendations():
    # Generating auto recommendations
    # Compare HPCL last year vs this year lower by state, district, product
    ...