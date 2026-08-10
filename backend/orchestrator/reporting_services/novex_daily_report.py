import urdhva_base
import os
import ast
import json
import jinja2
import decimal
import asyncio
import datetime
import hpcl_ceg_model
import indentdryout_actions
import urdhva_base.utilities
from types import SimpleNamespace
import utilities.helpers as helpers
import dateutil.parser as dt_parser
import utilities.fiscal_year as fiscal_year
import utilities.connection_mapping as connection_mapping
from charts_actions import charts_connection_vault_routing
import orchestrator.analytics.m60_performance as m60_performance
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams
import orchestrator.notification_manager.notification_factory as notification_factory
# from datetime import datetime, timedelta

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


async def fetch_sales_data():
    present_month = int(datetime.datetime.now(datetime.timezone.utc).strftime("%m"))
    sales_data = {}
    # Filter for YTD
    filters = {"filters": [actual, history, cumulative, ytd, target], "cross_filters": [],
               "drill_state": "", "time_grain": ""}
    resp = await m60_performance.m60_performance(**filters)
    
    # exit()
    sales_data['current_sales'] = round_off(resp['data']['data']['ACTUAL_TMT_SALES'][0], "")
    
    sales_data['history_sales'] = round_off(resp['data']['data']['ACTUAL_HISTORY_TMT_SALES'][0], "")
    sales_data['pro_rate_sales_target'] = round_off(resp['data']['data']['TARGET_TMT_SALES'][0], "")

    # Filter for yesterday's data
    yesterday_date = helpers.get_time_stamp_by_delta(datetime.datetime.now(datetime.timezone.utc), days=1,
                                                     with_month_start_day=False, date_time_format="%Y-%m-%d")

    def create_data_list(input):
        return [f'''{round_off(rec[0], "")} ({round_off(rec[1])}%)''' for rec in input]

    sbu_level_zones, sbu_level_regions = await get_m60_sales_data()
    for sbu in ['Retail', 'LPG', 'Lubes']:
        sales_data[f'{sbu}_growing_zones'] = len([rec for rec in sbu_level_zones[sbu] if rec[1] > 0])
        sales_data[f'{sbu}_declining_zones'] = len([rec for rec in sbu_level_zones[sbu] if rec[1] < 0])

    for sbu, dat in sbu_level_zones.items():
        top, bottom = process_performance_data(dat, 2)
        sales_data[f'top_performing_{sbu}_zones'] = create_data_list(top)
        sales_data[f'bottom_performing_{sbu}_zones'] = create_data_list(bottom)
    for sbu, dat in sbu_level_regions.items():
        top, bottom = process_performance_data(dat, 3)
        sales_data[f'top_performing_{sbu}_regions'] = create_data_list(top)
        sales_data[f'bottom_performing_{sbu}_regions'] = create_data_list(bottom)
    filters = {"filters": [actual, history, cumulative,
                           {"key": "\"DATE\"", "cond": "equals", "value": f"{yesterday_date},{yesterday_date}"}],
               "cross_filters": [], "drill_state": ""}
    resp = await m60_performance.m60_performance(**filters)
    yesterday_act = float(resp['data']['data']['ACTUAL_TMT_SALES'][0])
    yesterday_hist = float(resp['data']['data']['ACTUAL_HISTORY_TMT_SALES'][0])
    sales_data['yesterday_growth_loss'] = round(yesterday_act - yesterday_hist, 1)
    # ((CY sales-PY sales)/PY sales)*100
    sales_data['yesterday_growth_loss_percentage'] = get_growth_percentage(yesterday_act, yesterday_hist)

    sales_data['total_growth_loss'] = round(float(sales_data['current_sales']) - float(sales_data['history_sales']))
    sales_data['total_growth_loss_percentage'] = get_growth_percentage(float(sales_data['current_sales']),
                                                                       float(sales_data['history_sales']))
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
    

def dict_to_object(d):
    """Convert dictionary to object (recursively for nested dictionaries)."""
    if isinstance(d, list):
        return [dict_to_object(i) for i in d]
    if isinstance(d, dict):
        return SimpleNamespace(**{k: dict_to_object(v) for k, v in d.items()})
    return d


async def fetch_dryout_data():
    payload_dict = {"filters": [{"key": "interlock_name", "cond": "=", "value": ["Dry Out Each Indent Wise MainFlow"]},
                                {"key": "zone", "cond": "=", "value": []}, {"key": "plant", "cond": "=", "value": []},
                                {"key": "dealer_id", "cond": "=", "value": []},
                                {"key": "product_code", "cond": "=", "value": ["2811000", "2812000", "2822000"]},
                                {"key": "region", "cond": "=", "value": []},
                                {"key": "sales_area", "cond": "=", "value": []},
                                {"key": "progress_rate", "cond": "=", "value": []},
                                {"key": "dry_out_in_days", "cond": "=", "value": ["1"]},
                                {"key": "category", "cond": "=", "value": []}]}
    payload_obj = indentdryout_actions.Indentdryout_Get_Dried_Out_RoParams(**payload_dict)
    response = await indentdryout_actions.indentdryout_get_dried_out_ro(payload_obj)
    cat_a = carry_fwd_dry_out = carry_fwd_indent = indent_not_raised = indent_raised = 0
    dry_out_details = {stat['section']: int(stat['value']) for stat in response['stats']}
    for stat in response['stats']:
        if stat['section'] == "CATA Carry Fwd Indent":
            cat_a = stat['value']
        elif stat['section'] == "DryOut Carry Fwd Indent":
            carry_fwd_dry_out = stat['value']
        elif stat['section'] == "Carry Fwd Indent":
            carry_fwd_indent = stat['value']
        elif stat['section'] == 'Indent Not Raised':
            indent_not_raised = stat['value']
        elif stat['section'] == 'Indent Raised':
            indent_raised = stat['value']

    dry_out_cf = {
        'cat_a': cat_a,
        'dry_out': carry_fwd_dry_out,
        'others': carry_fwd_indent - carry_fwd_dry_out - cat_a,
        'total': carry_fwd_indent
    }
    dry_out = {
        "dry_out": indent_not_raised + indent_raised,
        'indent_not_raised': indent_not_raised,
        "indent_raised": indent_raised
    }

    print("dry_out_cf :", dry_out_cf)
    print("dry_out :", dry_out)
    return {"dry_out_cf": dry_out_cf, "dry_out": dry_out, 'dry_out_details': dry_out_details}


async def get_lpg_rejection():
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    query = f""" SELECT count(interlock_name) as total_count FROM alerts where interlock_name in ('O-Ring Leak Rejection','Valve Leak Rejection','Check Scale Rejection') and created_at>='{today}' """
    rejections = await function(query=query)
    if rejections:
        return {"pq_critical_lpg": rejections[-1]["total_count"], "pq_high_lpg": 0}
    return {"pq_critical_lpg": 0, "pq_high_lpg": 0}


async def get_ro_alerts():
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    query = f""" SELECT count(interlock_name) as total_count, severity FROM alerts where bu='RO' and 
    interlock_name != 'Dry Out Each Indent Wise MainFlow' and alert_section='RO' and 
    created_at>='{today}' and alert_status='Open' GROUP BY severity; """
    alerts = await function(query=query)
    data = {}
    if alerts:
        for alert in alerts:
            if alert["severity"] == "Critical":
                data = {"automation_critical_ro": alert["total_count"]}
            if alert["severity"] == "High":
                data = {"automation_high_ro": alert["total_count"]}
    for key in ["automation_critical_ro", "automation_high_ro"]:
        if key not in data.keys():
            data.update({key: 0})
    return data


async def get_tas_alerts():
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    query = f""" SELECT count(interlock_name) as total_count, severity FROM alerts where bu='TAS' and created_at>='{today}' and alert_status='Open' GROUP BY severity; """
    alerts = await function(query=query)
    data = {}
    if alerts:
        for alert in alerts:
            if alert["severity"] == "Critical":
                data = {"tas_critical_sod": alert["total_count"]}
            if alert["severity"] == "High":
                data = {"tas_high_sod": alert["total_count"]}
    for key in ["tas_critical_sod", "tas_high_sod"]:
        if key not in data.keys():
            data.update({key: 0})
    return data


async def get_alert_data(alert_section):
    # Making sure alerts considering only after May 31st in prod
    date = urdhva_base.utilities.get_present_time()
    date_yes = helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                               date_time_format=None)
    month_start = helpers.get_time_stamp_by_delta(date_yes, days=0, with_month_start_day=True,
                                               date_time_format="%Y-%m-%d")
    date_filter = f"created_at::DATE >= '{month_start}' AND created_at::DATE <= '{date_yes.strftime('%Y-%m-%d')}'" # As per HPCL request changed the date to be in the present month
    query = f"""SELECT count(alert_section), bu, alert_section, severity FROM alerts where alert_status='Open' and 
    alert_section='{alert_section}' and {date_filter} GROUP BY bu, alert_section, severity"""
    alerts = await hpcl_ceg_model.Alerts.get_aggr_data(query)
    data = {}
    for alert in alerts['data']:
        if alert["severity"] == "Critical":
            data.update({f"{alert_section.lower()}_critical_{alert['bu'].lower()}": alert["count"]})
        if alert["severity"] == "High":
            data.update({f"{alert_section.lower()}_high_{alert['bu'].lower()}": alert["count"]})
    for severity in ["critical", "high"]:
        for bu in ["lpg", "ro", "tas"]:
            if f"{alert_section.lower()}_{severity}_{bu}" not in data.keys():
                data.update({f"{alert_section.lower()}_{severity}_{bu}": 0})
    return data


async def publish_daily_novex_status_email():
    date = urdhva_base.utilities.get_present_time()
    date_yes = helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                       date_time_format=None)
    report_generated_time = date.strftime('%I:%M %p')
    if date.strftime('%Y-%m-%d').split('-')[-1] == '01' or date.strftime('%Y-%m-%d').split('-')[-1] == '1':
        print("datde inside if",date)
        status_yes_date = date
        tmp_date = urdhva_base.utilities.get_present_time()
        tmp_date_yes = helpers.get_time_stamp_by_delta(tmp_date, days=1, with_month_start_day=False,
                                               date_time_format=None)
        tmp_date_start = helpers.get_time_stamp_by_delta(tmp_date, days=1, with_month_start_day=True,
                                               date_time_format=None)

        status_data = {'today_date': date.strftime('%d-%B-%Y'), 'report_generated_time': report_generated_time,
                   'yesterday_date': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                               date_time_format='%d-%B-%Y'),
                   'today_week': date.strftime('%A'), 'yesterday_week':
                       helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                 date_time_format='%A'),
                   'today': date.strftime('%d-%B-%Y'),
                   'yesterday': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                          date_time_format='%d-%B-%Y'),
                   'present_month': f"01-{tmp_date_start.strftime('%b')} to {tmp_date_yes.strftime('%d')}-{tmp_date_yes.strftime('%b')}"}
                  # 'present_month': f"01-{date.strftime('%b')} to {date_yes.strftime('%d')}-{date_yes.strftime('%b')}"}
    else:
         status_data = {'today_date': date.strftime('%d-%B-%Y'), 'report_generated_time': report_generated_time,
                   'yesterday_date': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                               date_time_format='%d-%B-%Y'),
                   'today_week': date.strftime('%A'), 'yesterday_week':
                       helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                 date_time_format='%A'),
                   'today': date.strftime('%d-%B-%Y'),
                   'yesterday': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                          date_time_format='%d-%B-%Y'),
                  # 'present_month': f"01-{tmp_date_start.strftime('%b')} to {tmp_date_yes.strftime('%d')}-{tmp_date_yes.strftime('%b')}"}
                   'present_month': f"01-{date.strftime('%b')} to {date_yes.strftime('%d')}-{date_yes.strftime('%b')}"}

    status_data.update(await fetch_sales_data())
    # print("status_data before :", status_data)
    status_data.update(await fetch_dryout_data())
    status_data.update(await get_lpg_rejection())
    status_data.update(await get_ro_alerts())
    status_data.update(await get_tas_alerts())

    for alert_section in ["VA", "VTS", "EMLock", "TAS"]:
        status_data.update(await get_alert_data(alert_section))
    # print("-" * 50)
    # print("status_data :", json.dumps(status_data))
    # print("-" * 50)
    # print("-------->status_data",status_data)
    await send_notification(status_data)


async def send_notification(notification_data):
    template_path = os.path.join(os.path.dirname(hpcl_ceg_model.__file__), '..', 'orchestrator', 'reporting_services',
                                 'templates', 'novex_daily_email.html')
    with open(template_path, 'r') as f:
        template_data = jinja2.Template(f.read())
    final_data = template_data.render(**notification_data)

    with open(f'/tmp/novex_daily_email.html', 'w') as f:
        f.write(final_data)
    # Send email
    ins = await notification_factory.get_notification_module("email")
    for recipient in [
        ["sanjayk@hpcl.in", "gkpatel@hpcl.in","gargam@hpcl.in"],
        ["cvmallinath@hpcl.in","purushm@hpcl.in", "sachinkwarghane@hpcl.in", "dinesh.kumar@hpcl.in"],
        ["rujutadoiphode@hpcl.in"],
        ["venu@algofusiontech.com", "sreedhar.maddipati@algofusiontech.com", "aditya@algofusiontech.com", "yesu.p@algofusiontech.com"]
        ]:
        await ins.publish_message(
            subject="Novex Daily Report",
            recipients=recipient,
            html_content=True,
            body=final_data,
            force_send=True
        )


if __name__ == "__main__":
    asyncio.run(publish_daily_novex_status_email())
