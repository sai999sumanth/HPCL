import urdhva_base
import decimal
import datetime
import polars as pl
import urdhva_base.utilities
import utilities.helpers as helpers
import utilities.fiscal_year as fiscal_year
import utilities.connection_mapping as connection_mapping
from charts_actions import charts_connection_vault_routing
import orchestrator.analytics.m60_performance as m60_performance
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams

actual = {"key": "\"A\"", "cond": "equals", "value": "true"}
history = {"key": "\"H\"", "cond": "equals", "value": "true"}
target = {"key": "\"T\"", "cond": "equals", "value": "true"}
ytd = {"key": "\"YTD\"", "cond": "equals", "value": "true"}
ytpm = {"key": "\"YTDPM\"", "cond": "equals", "value": "true"}
cumulative = {"key": "\"C\"", "cond": "equals", "value": "true"}


def round_off(value, input_type='growth'):
    """Round off functionality with rules"""
    # For growth it should be one decimal point
    # For value if > 10 no decimal, < 10 one decimal and < 1 two decimals if round to one was 0
    if (isinstance(value, decimal.Decimal) or isinstance(value, float) or isinstance(value, int) or
            (isinstance(value, str) and value.isdigit())):
        if input_type == 'growth':
            return round(float(value), 1)
        if float(value) > 10:
            return round(float(value))
        elif 1 > float(value) > 0:
            return round(float(value), 2) if round(float(value), 1) == 0 else round(float(value), 1)
        return round(float(value), 1)
    return value


def get_growth_percentage(current, hist):
    """
    Function to calculate growth percentage
    :param current:
    :param hist:
    :return:
    """
    if current and hist:
        return round_off(((current - hist) / hist) * 100)
    elif current and not hist:
        return round_off(100)
    elif not current and hist:
        return round_off(-100)
    else:
        return round_off(0)


async def fetch_sales_data():
    present_month = int(datetime.datetime.now(datetime.timezone.utc).strftime("%m"))
    sales_data = {}

    # Filter for yesterday's data
    yesterday_date = helpers.get_time_stamp_by_delta(datetime.datetime.now(datetime.timezone.utc), days=1,
                                                     with_month_start_day=False, date_time_format="%Y-%m-%d")

    final_data = {"sales_data": sales_data}

    sbu_mapping = {'': '', "Retail": 'retail', 'LPG': 'lpg', 'I&C': 'i_c', 'Lubes': 'lubes', 'Aviation': 'aviation',
                   'PETCHEM': 'petchem', 'GAS': 'gas'}
    today_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")

    for sbu_name, map_key in sbu_mapping.items():
        sbu_filter = {}
        if sbu_name:
            sbu_filter = {"key": "\"SBU_Name\"", "cond": "equals", "value": f"{sbu_name}"}
        sbu_sales_data = {}
        # Filter for today's data
        filters = {"filters": [actual, history, cumulative,
                               {"key": "\"DATE\"", "cond": "equals", "value": f"{yesterday_date},{yesterday_date}"}],
                   "cross_filters": [], "drill_state": ""}
        if sbu_filter:
            filters['filters'].append(sbu_filter)
        resp = await m60_performance.m60_performance(**filters)
        print(resp)
        current = float(resp['data']['data']['ACTUAL_TMT_SALES'][0])
        hist = float(resp['data']['data']['ACTUAL_HISTORY_TMT_SALES'][0])
        sbu_sales_data['yesterday_current'] = round_off(current, "")
        sbu_sales_data['yesterday_historical'] = round_off(hist, "")
        sbu_sales_data['yesterday_growth'] = get_growth_percentage(current, hist)
        

        # For current month data
       # month_start = helpers.get_time_stamp_by_delta(with_month_start_day=True)

        date = urdhva_base.utilities.get_present_time()
        date_yes = helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                   date_time_format=None)
        month_start = helpers.get_time_stamp_by_delta(date_yes, days=0, with_month_start_day=True,
                                                   date_time_format="%Y-%m-%d")
        #if month_start.split('-')[-1] == '01' and( datetime.datetime.today().strftime('%d-%m-%Y').split('-')[0] == '01' or datetime.datetime.today().strftime('%d-%m-%Y').split('-')[0] == '1'): 
        #    yesterday_temp_date = month_start
        #print("yesterday_date",yesterday_temp_date)
        filters = {"filters": [actual, history, cumulative,
                               {"key": "\"DATE\"", "cond": "equals", "value": f"{month_start},{date_yes}"}],
                   "cross_filters": [], "drill_state": ""}
        
        if sbu_filter:
            filters['filters'].append(sbu_filter)
            
        resp = await m60_performance.m60_performance(**filters)

        present_month_act = float(resp['data']['data']['ACTUAL_TMT_SALES'][0])
        present_month_hist = float(resp['data']['data']['ACTUAL_HISTORY_TMT_SALES'][0])
        sbu_sales_data['present_month_historical'] = round_off(present_month_hist, "")
        sbu_sales_data['present_month_current'] = round_off(present_month_act, "")
        sbu_sales_data['present_month_growth'] = get_growth_percentage(present_month_act, present_month_hist)
        sbu_sales_data['ytpm_historical'] = sbu_sales_data['ytpm_current'] = sbu_sales_data['ytpm_growth'] = 'NA'
        
        today = datetime.datetime.today()
        first_day_current_month = today.replace(day=1)
        last_day_prev_month = first_day_current_month - datetime.timedelta(days=1)
        first_day_prev_month = last_day_prev_month.replace(day=1)

        prev_month_start = first_day_prev_month.strftime("%Y-%m-%d")
        prev_month_end = last_day_prev_month.strftime("%Y-%m-%d")

        filters = {
            "filters": [actual, history, cumulative,
                        {"key": "\"DATE\"", "cond": "equals", "value": f"{prev_month_start},{prev_month_end}"}],
            "cross_filters": [],
            "drill_state": ""
        }
        
        
        # For ytpm data
        if present_month != 4:
            filters = {"filters": [actual, history, ytpm, cumulative], "cross_filters": [], "drill_state": ""}
            if ytpm:
                # filters['filters'].append({"key": "\"fiscal_year\"", "cond": "equals", "value": "2025-2026"})
                dyn_fis_year=f"{fiscal_year.FiscalYear.current().start.year}-{fiscal_year.FiscalYear.current().end.year}"
                print("fiscal_year---------------->>>>>",dyn_fis_year)
                filters['filters'].append({"key": "\"fiscal_year\"", "cond": "equals", "value": dyn_fis_year})
                
                # ---------------- YTDPM DATE FIX (ADD HERE) ----------------
                today = datetime.date.today()

                fy_start_year = today.year if today.month >= 4 else today.year - 1

                current_start = datetime.date(fy_start_year, 4, 1)

                # last day of current month
                first_day_current_month = today.replace(day=1)
                current_end = first_day_current_month - datetime.timedelta(days=1)

                filters['filters'].append({
                    "key": "\"DATE\"",
                    "cond": "equals",
                    "value": f"{current_start},{current_end}"
                })
                # ------------------------------------------------------------
                
            if sbu_filter:
                filters['filters'].append(sbu_filter)
            print("checking ytpm --------------------------->filters",filters)

            resp = await m60_performance.m60_performance(**filters)
            print("resp",resp)
    
            ytpm_act = float(resp['data']['data']['ACTUAL_TMT_SALES'][0])
            ytpm_hist = float(resp['data']['data']['ACTUAL_HISTORY_TMT_SALES'][0])
            sbu_sales_data['ytpm_historical'] = round_off(ytpm_hist, "")
            sbu_sales_data['ytpm_current'] = round_off(ytpm_act, "")
            sbu_sales_data['ytpm_growth'] = get_growth_percentage(ytpm_act, ytpm_hist)
        if sbu_name:
            final_data[f"sales_data_{map_key}"] = sbu_sales_data
        else:
            final_data["sales_data"].update(sbu_sales_data)
    return final_data


def get_zones_by_performance(actual, target, by_sbu=False, req_key='Zone_Name'):
    # Getting top and least performing zones
    if not by_sbu:
        resp_actual = {f"{rec['SBU_Name']}_{rec[req_key]}": float(rec['ACTUAL_TMT_SALES']) for rec in actual}
        resp_target = {f"{rec['SBU_Name']}_{rec[req_key]}": float(rec['TARGET_TMT_SALES']) for rec in target}
        # Calculate percentage achieved
        percentage_achieved = {}
        for key in resp_target:
            actual_value = resp_actual.get(key, 0)  # Get actual value, default to 0 if missing
            target_value = resp_target[key]
            if target_value == 0:
                percentage_achieved[key] = 0 if not actual_value else 100# Avoid division by zero
            else:
                percentage_achieved[key] = round(float(((actual_value - target_value) /
                                                        target_value) * 100), 1)
        sorted_zones = sorted(percentage_achieved.items(), key=lambda x: x[1], reverse=True)

        return sorted_zones
    sbu_level_data = {}
    resp_actual = {}
    resp_target = {}
    for rec in actual:
        sbu = rec['SBU_Name']
        zone = rec[req_key]
        value = rec['ACTUAL_TMT_SALES']
        if sbu not in resp_actual:
            resp_actual[sbu] = {}
        resp_actual[sbu][zone] = value

    for rec in target:
        sbu = rec['SBU_Name']
        zone = rec[req_key]
        value = rec['TARGET_TMT_SALES']
        if sbu not in resp_target:
            resp_target[sbu] = {}
        resp_target[sbu][zone] = value

    # Calculate percentage achieved
    for sbu in resp_target:
        percentage_achieved = {}
        for zone in resp_target[sbu]:
            actual_value = resp_actual.get(sbu, {}).get(zone, 0)  # Get actual value, default to 0 if missing
            target_value = resp_target.get(sbu, {}).get(zone, 0)  # Get actual value, default to 0 if missing
            if target_value == 0:
                percentage_achieved[zone] = 0 if not actual_value else 100# Avoid division by zero
            else:
                percentage_achieved[zone] = round(float(((actual_value - target_value) /
                                                        target_value) * 100), 1)
        sorted_zones = sorted(percentage_achieved.items(), key=lambda x: x[1], reverse=True)
        sbu_level_data[sbu] = sorted_zones
    return sbu_level_data


async def get_m60_sales_data():
    current = fiscal_year.FiscalYear.current()
    if int(datetime.datetime.now(datetime.timezone.utc).month) == 4:
        current = current.prev_fiscal_year
    prev = current.prev_fiscal_year
    pres_year = f"FY {current.start.strftime('%Y')}-{current.end.strftime('%Y')}"
    prev_year = f"FY {prev.start.strftime('%Y')}-{prev.end.strftime('%Y')}"

    # target = f"""select ROUND(SUM("TARGET_QTY_TMT")::numeric,2)
    # AS "TARGET_TMT_SALES", "Zone_Name","SBU_Name" from "M60_LEVEL_METADATA"
    # where fiscal_year='{pres_year}' AND "Zone_Name" not in ('-', '')  AND "SBU_Name" in ('Retail', 'LPG', 'Lubes')
    # group by "Zone_Name","SBU_Name" """
    dt = datetime.datetime.today()
    yesterday = helpers.get_time_stamp_by_delta(dt, days=1, ascending=False,
                                                with_month_start_day=False,
                                                date_time_format="%Y%m%d")
    yesterday_last_year = helpers.get_time_stamp_by_delta(dt, days=1, years=1,
                                                         ascending=False,
                                                         with_month_start_day=False,
                                                         date_time_format="%Y%m%d")

    target = f""" select ROUND(SUM("NETWEIGHT_TMT")::numeric,2) 
    AS "TARGET_TMT_SALES", "Zone_Name","SBU_Name" from "MOM_DAY_LEVEL_DATA" 
    where "FISCALYEAR"='{prev_year}' AND "Zone_Name" not in ('-', '') AND "SBU_Name" in ('Retail', 'LPG', 'Lubes') 
    AND "DAY_ID" <= '{yesterday_last_year}'
    group by "Zone_Name","SBU_Name" """

    actual = f""" select ROUND(SUM("NETWEIGHT_TMT")::numeric,2) 
    AS "ACTUAL_TMT_SALES", "Zone_Name","SBU_Name" from "MOM_DAY_LEVEL_DATA" 
    where "FISCALYEAR"='{pres_year}' AND "Zone_Name" not in ('-', '') AND "SBU_Name" in ('Retail', 'LPG', 'Lubes') 
    AND "DAY_ID" <= '{yesterday}'
    group by "Zone_Name","SBU_Name" """

    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    resp_target = await function(query=target)
    resp_actual = await function(query=actual)
    sbu_level_zones = get_zones_by_performance(resp_actual, resp_target, by_sbu=True, req_key='Zone_Name')

    # By Region
    target = f""" select ROUND(SUM("NETWEIGHT_TMT")::numeric,2) 
            AS "TARGET_TMT_SALES", "Region_Name","SBU_Name" from "MOM_DAY_LEVEL_DATA" 
            where "FISCALYEAR"='{prev_year}' AND "Region_Name" not in ('-', '') 
            AND "DAY_ID" <= '{yesterday_last_year}' group by "Region_Name","SBU_Name" """

    actual = f""" select ROUND(SUM("NETWEIGHT_TMT")::numeric,2) 
        AS "ACTUAL_TMT_SALES", "Region_Name","SBU_Name" from "MOM_DAY_LEVEL_DATA" 
        where "FISCALYEAR"='{pres_year}' AND "Region_Name" not in ('-', '') 
        AND "DAY_ID" <= '{yesterday}' group by "Region_Name","SBU_Name" """

    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    resp_target = await function(query=target)
    resp_actual = await function(query=actual)
    sbu_level_regions = get_zones_by_performance(resp_actual, resp_target, by_sbu=True, req_key='Region_Name')

    return sbu_level_zones, sbu_level_regions


def process_performance_data(data, limit=3):
    """
    Process data to find top performers (>0) and bottom performers (<0)
    Returns both in descending order
    """

    # Convert to list of tuples if needed
    if isinstance(data[0], dict):
        # Handle dictionary format
        items = []
        for item in data:
            for key, value in item.items():
                items.append((key, value))
    else:
        # Handle list format
        items = [(item[0], item[1]) for item in data]

    # Separate positive and negative values
    positive_items = [(key, value) for key, value in items if value >= 0]
    negative_items = [(key, value) for key, value in items if value < 0]

    # Sort in descending order
    top_performers = sorted(positive_items, key=lambda x: x[1], reverse=True)
    bottom_performers = sorted(negative_items, key=lambda x: x[1], reverse=True)

    # Get top 2/3 and bottom 2/3
    top_x = top_performers[:limit]
    bottom_x = bottom_performers[:limit]

    return top_x, bottom_x



async def get_sales_tmt(date_filter: str):

    date_condition = ""

    if date_filter == 'day':
        date_condition = """AND "DAY_ID" = TO_CHAR(CURRENT_DATE - INTERVAL '1 day', 'YYYYMMDD')::bigint"""

    elif date_filter == 'month':
        date_condition = """
            AND "DAY_ID" >= TO_CHAR(
                CASE
                    WHEN CURRENT_DATE = date_trunc('month', CURRENT_DATE)::date
                    THEN date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                    ELSE date_trunc('month', CURRENT_DATE)
                END,
                'YYYYMMDD'
            )::bigint
            AND "DAY_ID" < TO_CHAR(
                CASE
                    WHEN CURRENT_DATE = date_trunc('month', CURRENT_DATE)::date
                    THEN date_trunc('month', CURRENT_DATE)
                    ELSE CURRENT_DATE
                END,
                'YYYYMMDD'
            )::bigint
        """
    
    sales_tmt_query = f"""
        SELECT "Zone_Name", "Region_Name", "SalesArea_Name",
            ROUND(SUM(
                CASE WHEN "ProductName" = 'MS'
                THEN "NETWEIGHT_TMT" END
            )::numeric,2) AS "MS_SALES_TMT",
            ROUND(SUM(
                CASE WHEN "ProductName" = 'HSD'
                THEN "NETWEIGHT_TMT" END
            )::numeric,2) AS "HSD_SALES_TMT"
        FROM "MOM_DAY_LEVEL_DATA"
        WHERE
            "SBU_Name" = 'Retail'
            {date_condition}
        GROUP BY "Zone_Name", "Region_Name", "SalesArea_Name"
        ORDER BY "Zone_Name", "Region_Name", "SalesArea_Name"
    """

    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'

    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)

    sales_tmt= await function(query= sales_tmt_query)
    sales_tmt_df = pl.DataFrame(sales_tmt)

    sales_tmt_df = sales_tmt_df.rename({"SalesArea_Name": "sales_area"})

    total_row = sales_tmt_df.select([
        pl.lit(None).alias("Zone_Name"),
        pl.lit(None).alias("Region_Name"),
        pl.lit("GRAND TOTAL").alias("sales_area"),
        pl.sum("MS_SALES_TMT").alias("MS_SALES_TMT"),
        pl.sum("HSD_SALES_TMT").alias("HSD_SALES_TMT")
    ])

    sales_tmt_df = pl.concat([sales_tmt_df, total_row])
    return sales_tmt_df