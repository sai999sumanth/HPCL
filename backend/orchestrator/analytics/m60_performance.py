import urdhva_base
import datetime
import json
import pandas as pd
import urdhva_base.utilities
from calendar import monthrange
import utilities.helpers as helpers
import hpcl_ceg_model
import dashboard_studio_model
import dateutil.parser as dt_parser
import utilities.fiscal_year as fiscal_year
import utilities.connection_mapping as connection_mapping
from orchestrator.dbconnector.widget_actions import widget_actions
import orchestrator.dbconnector.connector_factory as connector_factory
from api_manager.charts_actions import charts_connection_vault_routing
from api_manager.charts_actions import charts_get_distinct_values
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams
from dashboard_studio_model import Charts_Get_Distinct_ValuesParams
from decimal import Decimal
from collections import defaultdict

Finished_Lubes_Retail = ['Industrial Greases','Automotive Greases','Automotive Specialities','Compressed Bio Gas ','Compressed Bio Gas','Compressed Bio Gas (CBG)','Industrial Specialities']
Finished_Lubes_Distributor = ['Industrial oils','Automotive Oils']
Finished_Lubes = ['Industrial Specialities','Industrial Greases','Automotive Oils','Automotive Specialities','Industrial oils','Automotive Greases']
Finished_Lubes_Consumer = ['Automotive Specialities','Automotive Greases','Automotive Oils']

productOrders = {
    "Retail": ["MS", "HSD", "CNG", "SKO", "Compressed Bio Gas (CBG)", "LPG BLK","HP DEF-Retail"],
    "Aviation": ["ATF"],
    "I&C": ["HSD", "LDO", "LSHS", "FO", "Naptha", 'Bitumen Blk', "Bitumen Pkd", "Bitumen Modified", "Solvent 2445",
            "Solvent 1425", "JBO", "Sulphur", "Propylene"],
    "LPG": ["LPG PKD - Domestic", "LPG PKD - Non Domestic", "LPG BLK", "BULK PROPANE", "BULK BUTANE"],
    "PETCHEM": ["PETCHEM"],
    "Lubes": ["LUBES RETAIL", "Automotive Oils", "Automotive Greases", "Automotive Specialities", "Industrial oils",
              "Industrial Greases", "Industrial Specialities", "Base Oil","ALPROL","Lubes-Exports","DEF/Diesel Exhaust Fluid"],
    "GAS":['CNG','LNG','CBG']
    
}

AllProducts = {
    "Lubes": ["Industrial Greases", "DEF/Diesel Exhaust Fluid", "Automotive Greases", "Automotive Specialities",
              "Industrial oils", "Base Oil", "LUBES RETAIL", "Automotive Oils", "Industrial Specialities",
              "Miscellaneous/Minor", "Marine Lubes","ALPROL","Lubes-Exports"],
    "Aviation": ["ATF"],
    "Retail": ["LPG BLK", "MS", "Industrial Greases", "HSD", "Automotive Greases",
               "Automotive Specialities", "Compressed Bio Gas ", "Industrial oils", "Automotive Oils",
               "Industrial Specialities", "Miscellaneous/Minor", "CNG", "SKO", "Compressed Bio Gas (CBG)","HP DEF-Retail"],
   
    "I&C": ["MS", "Sulphur", "Solvent 2445", "LDO", "CBFS", "Hexane", "Solvent 1425", "FO", "JBO",
            "Propylene", "LSHS/HHS", "Naptha", "HSD", "Bitumen Pkd", "Bitumen Modified", "Bitumen Blk",
             "SKO"],
    
    "LPG": ["LPG PKD - Non Domestic", "LPG BLK", "BULK BUTANE", "BULK PROPANE", "LPG CYLINDER REGULATOR",
            "Miscellaneous/Minor", "LPG PKD - Domestic", "LPG CYLINDER ACCESSORIES"],
    "GAS": ["CNG", "LNG", "Compressed Bio Gas (CBG)"],
    "PETCHEM": ["Miscellaneous/Minor", "PETCHEM", "Solvent 2445", "CRUDE- Reporting only"]
}

HistoryKeyMapping = {'SBU_Name': '"ORGSBUNAME"', 'Zone_Name': '"ORGZONENAME"', 'Region_Name': '"ORGRONAME"',
                     'SalesArea_Name': '"ORGSANAME"'}
# Base_Filters = ['"cumulative_level"','"SBU_Name"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"','"month_name"','"ProductName"']
Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"', '"ProductName"',
                '"month_name"']
# Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"ProductName"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"',
#                '"month_name"']
APG_Filters = ['"cumulative_level"', '"ProductName"', '"month_name"']

# Base_Filters = ['"SBU_Name"', '"month_name"','"Zone_Name"', '"Region_Name"', '"SalesArea_Name"'"ProductName"'', '"ProductName"']
# Lubes_Filters = ['"month_name"', '"SBU_Name"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"', '"ProductName"']
Lubes_Filters = ['"SBU_Name"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"', '"ProductName"', '"month_name"']
Default_Filters = [""""SBU_Name" != '0'""", 
                #    """"Zone_Name" != '-'""",
                   """ "SBU_Name" not in ('Common','Mumbai Ref','Renewable Energy','Visakh Ref')"""]
# Default_Filters = [""""SBU_Name" != '0'""", """"Zone_Name" != '-'"""]
DBNames = {"m60_ta": "M60_LEVEL_METADATA", "m60_h": "MOM_LEVEL_FINAL_DATA"}
months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

sbu_order = ['Retail', 'LPG', 'I&C', 'Lubes', 'Aviation', 'PETCHEM', 'GAS']

DefaultTable = 'Day'
MandateKeys = {"actual": "ACTUAL_TMT_SALES", "history": "ACTUAL_HISTORY_TMT_SALES", "target": "TARGET_TMT_SALES",
               "YTD": "YTD_TMT_SALES"}


async def get_date_filters(start_date, end_date, resp_format='%Y-%m-%d', day_resp_format="%Y%m%d"):
    """
    Function to get multiple date filters for day level filter, month level filter
    :param start_date:
    :param end_date:
    :param resp_format:
    :return:
    """
    filter_dates = []
    day_filter_dates = []
    if DefaultTable == "Day":
        return [], [[dt_parser.parse(start_date).strftime(day_resp_format),
                     dt_parser.parse(end_date).strftime(day_resp_format)]]
    start_dt = dt_parser.parse(start_date)
    end_dt = dt_parser.parse(end_date)
    if start_dt.month == end_dt.month or (end_dt.month - start_dt.month) == 1:
        filter_dates.append([start_date, end_date])
    else:
        _, month_days = monthrange(start_dt.year, start_dt.month)
        day_filter_dates.append([start_dt.strftime(day_resp_format),
                                 start_dt.replace(day=month_days).strftime(day_resp_format)])
        _, month_days = monthrange(end_dt.year, end_dt.month)
        day_filter_dates.append([end_dt.replace(day=1).strftime(day_resp_format), end_dt.strftime(day_resp_format)])
        dt = helpers.get_time_stamp_by_delta(end_dt, months=1, ascending=False, date_time_format=None)
        _, month_days = monthrange(dt.year, dt.month)
        dt = dt.replace(day=month_days)
        filter_dates.append([helpers.get_time_stamp_by_delta(start_dt, months=1, ascending=True,
                                                             date_time_format=None).strftime(resp_format),
                             dt.strftime(resp_format)])
    # print("filters",filters)
    # filters = [condition for condition in filters if condition['key'].strip('"') not in ['resp_format']]
    return filter_dates, day_filter_dates



def calculate_pro_rate(target_data, key, start_month=None, end_month=None):
    """
    Calculating YTD data for target
    :param target_data:
    :param key:
    :param start_month:
    :param end_month:
    :return:
    """
    if not target_data or not all(isinstance(rec, dict) and 'month_name' in rec for rec in target_data):
         print("No Data Present for Current Selection")
         return {
                "status": False,
                "message": "No  Data Present for the Current Selection",
                "data": {}
            }

    if not start_month and not end_month:
        return target_data
    if start_month:
        # Calculate no of days the start month
        dt = dt_parser.parse(start_month)
        _, month_days = monthrange(dt.year, dt.month)
        pending_days = month_days - dt.day + 1
        for rec in target_data:
            if helpers.month_short_to_number(rec['month_name']) == dt.month:
                rec[key] = round((rec[key] / month_days) * pending_days)
    # validate month:
    if end_month:
        # Calculate no of days the end month
        dt = dt_parser.parse(end_month)
        _, month_days = monthrange(dt.year, dt.month)
        pending_days = dt.day
        for rec in target_data:
            if helpers.month_short_to_number(rec['month_name']) == dt.month:
                rec[key] = round((rec[key] / month_days) * pending_days)
    return target_data


async def collect_data(req_keys, table_name, where_conditions, start_date, end_date, group_by_filter,
                       date_key='"year_monthname"::DATE'):
    if group_by_filter and not isinstance(group_by_filter, list):
        group_by_filter = [group_by_filter]
    for grp_key in group_by_filter:
        if grp_key.strip('"') not in req_keys and grp_key not in req_keys:
            req_keys.append(grp_key)
    query = f"""SELECT {','.join(req_keys)} FROM "{table_name}" """
    conditions = [cond for cond in where_conditions]
    if start_date and end_date:
        if start_date == end_date:
            conditions.append(f""" {date_key}='{start_date}' """)
        else:
            conditions.append(f""" {date_key} BETWEEN '{start_date}' AND '{end_date}' """)
    if conditions:
        query += f' where {" AND ".join(conditions)}'
    if group_by_filter:
        query += f" GROUP BY {','.join(group_by_filter)}"
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    #function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    print("query",query)
    access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.M60LevelMetaData.get_clause_conditions(formated=True)]
    # if table_name == 'industry_performance':
    #     #for filter_key in access_filters:
    #     #    print("filter_key",filter_key)
    #     #    if filter_key.key =='SBU_Name':
    #     #        access_filters[access_filters.index(filter_key)][filter_key.key] == 'sbu_name'
    #     for f in access_filters:
    #             f.key = f.key.strip().lower()
    #             if f.key.strip().lower() == 'sbu_name':
    #                 if f.value =='DS':
    #                     f.value = 'I&C'
    #             #if f.key.strip().lower() == "sbu_name":
    #             #            f.key = "sbu_name"
    
    if table_name in ['industry_performance','MOM_DAY_LEVEL_DATA','M60_LEVEL_METADATA']:
        #for filter_key in access_filters:
        #    print("filter_key",filter_key)
        #    if filter_key.key =='SBU_Name':
        #        access_filters[access_filters.index(filter_key)][filter_key.key] == 'sbu_name'
        for f in access_filters:
                if table_name == 'industry_performance':
                    f.key = f.key.strip().lower()
                if f.key.strip().lower()== 'sbu_name':
                    if f.value =='DS':
                        f.value = 'I&C'
                #if f.key.strip().lower() == "sbu_name":
                #            f.key = "sbu_name"

    
    query =  await widget_actions.WidgetActions.apply_filter_drilldown(query, access_filters, drilldown = '')
    #resp = await function(query=query)
    resp = await hpcl_ceg_model.M60LevelMetaData.get_aggr_data(query, limit=1000)
    if resp.get('data',[]):
        resp = resp['data']
    return resp



def get_group_by_filter_key(cross_filters, Base_Filters, resp_format_org, cumulative=False, drill_state='',
                            time_grain=''):
    """
    Getting group by filter key based on cross filters
    :param time_grain:
    :param drill_state:
    :param cumulative:
    :param cross_filters:
    :return:
    """
    if cumulative:
        Lubes_Filters = ['"SBU_Name"', '"ProductName"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"',
                         '"month_name"']
        group_by_filter = ['"SBU_Name"'] if not cumulative else []
        APG_Filters = ['"cumulative_level"', '"ProductName"', '"month_name"']
        APG_Filters = ['"cumulative_level"', '"SBU_Name"', '"ProductName"', '"month_name"']
        if time_grain == 'Monthly':
            Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"',
                            '"ProductName"', '"month_name"']
        else:
            # print("resp_format_org", resp_format_org)
            if resp_format_org == 'summary':
                Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"',
                                '"ProductName"', '"month_name"']
            else:
                Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"ProductName"', '"Zone_Name"', '"Region_Name"',
                                '"SalesArea_Name"', '"month_name"']
            print("APG_Liters at group by filter ", APG_Filters)
            
        if time_grain == 'top_zones':
            Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"',
                            '"ProductName"', '"month_name"']
        
            print("Time grain in top_zones ")
            
        if time_grain == 'top_zones':
            APG_Filters = ['"cumulative_level"', '"Zone_Name"','"ProductName"', '"month_name"']
           
         
        if time_grain == 'top_regions':
            Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"Region_Name"', '"Zone_Name"', '"SalesArea_Name"',
                            '"ProductName"', '"month_name"']
        
            print("Time grain in top_regions ",Base_Filters)
            
        if time_grain == 'top_regions':
            Lubes_Filters = ['"cumulative_level"', '"SBU_Name"', '"Region_Name"', '"Zone_Name"', '"SalesArea_Name"',
                            '"ProductName"', '"month_name"']
            
            
        if time_grain == 'top_regions':
            APG_Filters = ['"cumulative_level"', '"Region_Name"', '"ProductName"', '"month_name"']
            
        if time_grain == 'top_sales_area':
            Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"SalesArea_Name"', '"Zone_Name"', '"Region_Name"',
                            '"ProductName"', '"month_name"']
        
            print("Time grain in top_sales_area ")
            
        if time_grain == 'top_sales_area':
            Lubes_Filters = ['"cumulative_level"', '"SBU_Name"', '"SalesArea_Name"', '"Zone_Name"', '"Region_Name"',
                            '"ProductName"', '"month_name"']
        if time_grain == 'top_sales_area':
            APG_Filters = ['"cumulative_level"','"SalesArea_Name"', '"ProductName"', '"month_name"'  ]
            
            
    else:
        group_by_filter = ['"month_name"'] if not cumulative else []
        Lubes_Filters = ['"SBU_Name"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"', '"ProductName"',
                         '"month_name"']
        # print("len opf filters are ", cross_filters)
        if len(cross_filters) == 1:
            # if cross_filters[0]['key'].strip('"') = 'month_name' and cross_filters[0]['value'].strip('"') != '':
            if cross_filters[0]['key'].strip('"') != 'month_name':
                Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"ProductName"', '"Zone_Name"', '"Region_Name"',
                                '"SalesArea_Name"', '"month_name"']
        else:
            if len(cross_filters) > 1 and cross_filters[0]['key'].strip('"') == 'month_name':
                Base_Filters = ['"month_name"', '"SBU_Name"', '"ProductName"', '"Zone_Name"', '"Region_Name"',
                                '"SalesArea_Name"']
            elif resp_format_org == 'summary':
                Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"',
                                '"ProductName"', '"month_name"']
            elif time_grain != 'Monthly':
                Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"ProductName"', '"Zone_Name"', '"Region_Name"',
                                '"SalesArea_Name"', '"month_name"']

    # group_by_filter = ['"month_name"'] if not cumulative else []
    # group_by_filter = ['"SBU_Name"'] if cumulative else []
    if cross_filters:
        index = 0
        if len([rec['value'] for rec in cross_filters if 'lubes' in rec['value'].lower()
                                                         and rec['key'].strip('"') == "SBU_Name"]):
            for key in [rec['key'] for rec in cross_filters]:
                if key in Lubes_Filters and Lubes_Filters.index(key) > index:
                    index = Lubes_Filters.index(key)
            if index > len(Lubes_Filters):
                group_by_filter = [Lubes_Filters[index + 1]]
            elif index < len(Lubes_Filters) and cumulative:
                group_by_filter = [Lubes_Filters[index + 1]]
            else:
                group_by_filter = [Lubes_Filters[index - 1]]
            return group_by_filter
            # group_by_filter = [Lubes_Filters[index + 1]]

        if ('Aviation' in [x['value'].strip('"') for x in cross_filters] or 'PETCHEM' in [x['value'].strip('"') for x in
                                                                                          cross_filters] or 'GAS' in [
            x['value'].strip('"') for x in cross_filters]):
            for key in [rec['key'] for rec in cross_filters]:

                if key in APG_Filters and APG_Filters.index(key) > index:
                    index = APG_Filters.index(key)
            if index > len(APG_Filters):
                group_by_filter = [APG_Filters[index + 1]]
            else:
                group_by_filter = [APG_Filters[index - 1]]
                # this is f
                if cumulative:
                    group_by_filter = [APG_Filters[index + 1]]
            return group_by_filter

        else:
            for key in [rec['key'] for rec in cross_filters]:
                if (key in Base_Filters or key in [x.strip('"') for x in Base_Filters]) and Base_Filters.index(
                        key) > index:
                    index = Base_Filters.index(key)
            group_by_filter = [Base_Filters[index + 1]]
            # if index>len(Base_Filters):
            #    group_by_filter = [Base_Filters[index + 1]]
            # else:
            #    group_by_filter = [Base_Filters[index-1]]
    elif drill_state:
        if not drill_state.startswith('"'):
            drill_state = f'"{drill_state}"'
        group_by_filter = [Base_Filters[Base_Filters.index(drill_state) + 1]]
    if time_grain == 'Monthly' and '"month_name"' not in group_by_filter:
        group_by_filter.append('"month_name"')
    return group_by_filter

import pandas as pd
import numpy as np 
async def m60_performance(filters, cross_filters, drill_state="", time_grain="", resp_format=""):
    if resp_format == "file_download":
        file_path = '/downloads/final_data.csv' 
        return {
                'status': 'True',
                'message': 'Success',
                'data': 'File Downloaded Successfully',
                'file_path': file_path
            }
        print("call the function")
        status,results =  await top_ic(filters, cross_filters, drill_state, time_grain, resp_format)
        if isinstance(results,str):
            return False, "No data for current selection"
        if status:
            print("status is returning")
            df = pd.DataFrame(results)  
            # df.to_csv('/opt/ceg/algo/final_data.csv', index=False)
            # return {'status':status,'message':'Success','data':results}
            file_path = '/opt/downloads/final_data.csv'  # define file_path here
            df.to_csv(file_path, index=False)
            return {
                'status': status,
                'message': 'Success',
                'data': results,
                'file_path': file_path
            }


    
    if resp_format == "top_ic":
        print("call thhe function")
        status, results = await top_ic(filters, cross_filters, drill_state, time_grain, resp_format)
        if isinstance(results, str):
            return False, "No data for current selection"

        if status:
            df = pd.DataFrame(results)

            # Clean empty/NaN/inf
            df = df.replace(r'^\s*$', np.nan, regex=True)
            df = df.replace([np.nan, np.inf, -np.inf], 0)

            # Ensure all data is JSON serializable
            df = df.astype(object).where(pd.notnull(df), None)

            # Save CSV for debugging
            df.to_csv('/opt/downloads/final_data.csv', index=False)

            # Return JSON-safe dict
            return {'status': status,'message': 'Success','data': json.loads(df.to_json(orient='records'))}
    def get_fiscal_year(date_ui, todays_date, same_year=False, key='YTDPM'):

        end_date_ = fiscal_year.FiscalDate.fromtimestamp(int(urdhva_base.utilities.get_present_time().strftime('%s')))
        if key == 'YTDPM':
            if same_year:
                end_date = helpers.get_time_stamp_by_delta(end_date_, years=0, days=1, with_month_start_day=True,
                                                        date_time_format="%Y-%m-%d")
                
            else:
                end_date = helpers.get_time_stamp_by_delta(end_date_, years=0, days=1, with_month_start_day=True,
                                                        date_time_format="%Y-%m-%d")
                #end_date = datetime.datetime.strptime(end_date, "%Y-%m-%d")
                #end_date = datetime.datetime.strptime(end_date, "%Y-%m-%d")
                if isinstance(end_date,str):
                    end_date = datetime.datetime.strptime(end_date, "%Y-%m-%d")
                print("end_date type",type(end_date))
                first_day_of_current_month = end_date.replace(day=1)
                last_day_of_prev_month = first_day_of_current_month - datetime.timedelta(days=1)
                end_date = last_day_of_prev_month.date()
        else:
            if same_year:
                # For April 1st, we have to make days = 0
                end_date = helpers.get_time_stamp_by_delta(end_date_,
                                                           days=0 if (end_date_.month==4 and end_date_.day==1) else 1,
                                                           with_month_start_day=False, date_time_format="%Y-%m-%d")
                    
                
            else:
                '''
                end_date = helpers.get_time_stamp_by_delta(end_date_, years=1, days=1, with_month_start_day=False,
                                                                    date_time_format=None)
                '''
                end_date_check = fiscal_year.FiscalYear.current().fiscal_year_end_date
                end_date = helpers.get_time_stamp_by_delta(dt_parser.parse(end_date_check), years=1, days=0,
                                                           with_month_start_day=False,
                                                           date_time_format=None).strftime("%Y-%m-%d")

                # print("end_date", end_date)
                '''
                end_date = helpers.get_time_stamp_by_delta(end_date_,years=1,days=1, with_month_start_day=False,
                                                        date_time_format="%Y-%m-%d")
                '''
        start_date = fiscal_year.FiscalYear.current().fiscal_year_start_date
        # For History
        start_date_history = fiscal_year.FiscalYear.current().prev_fiscal_year.start.strftime(
            "%Y%m%d" if DefaultTable == "Day" else "%Y%m")
        if key == 'YTDPM':
            if same_year:
                end_date_history = helpers.get_time_stamp_by_delta(end_date_, years=1, days=1, with_month_start_day=True,
                                                                date_time_format=None)
            else:
                end_date_history = helpers.get_time_stamp_by_delta(end_date_, years=1, days=1, with_month_start_day=True,
                                                                date_time_format=None)
                
                
                if isinstance(end_date_history,str):
                    end_date_history = datetime.datetime.strptime(end_date_history, "%Y-%m-%d")
                print("end_date_history type",type(end_date_history))
                first_day_of_current_month_his = end_date_history.replace(day=1)
                last_day_of_prev_month_his = first_day_of_current_month_his - datetime.timedelta(days=1)
                print("last_day_of_prev_month_his",last_day_of_prev_month_his)
                end_date_history = datetime.date(last_day_of_prev_month_his.year, last_day_of_prev_month_his.month, last_day_of_prev_month_his.day)
                

                #end_date = last_day_of_prev_month_his.date()
                
        else:
            if same_year:
                end_date_history = helpers.get_time_stamp_by_delta(end_date_, years=1, days=1,
                                                                   with_month_start_day=False,
                                                                   date_time_format=None)
            else:
                '''
                end_date_history = fiscal_year.FiscalYear.current().prev_fiscal_year.end
                
                '''
                end_date_check = fiscal_year.FiscalYear.current().fiscal_year_end_date
                # print("end_date_check", end_date_check)
                end_date_history = helpers.get_time_stamp_by_delta(dt_parser.parse(end_date_check), years=2, days=0,
                                                                   with_month_start_day=False,
                                                                   date_time_format=None)
               
                '''
                end_date = fiscal_year.FiscalYear.current().fiscal_year_end_date
                end_date_history = helpers.get_time_stamp_by_delta(end_date_, years=1, days=0, with_month_start_day=False,
                                                                    date_time_format=None)
                '''
        end_date_history = end_date_history.strftime("%Y%m%d" if DefaultTable == "Day" else "%Y%m")
        if same_year:
            return start_date, end_date, start_date_history, end_date_history

        start_date = datetime.datetime.strptime(start_date, "%Y-%m-%d")
        if isinstance(end_date,str):
            end_date = datetime.datetime.strptime(end_date, "%Y-%m-%d")
        start_date = start_date.replace(year=start_date.year - 1).strftime("%Y-%m-%d")
        end_date = end_date.replace(year=end_date.year).strftime("%Y-%m-%d")
        if isinstance(end_date_history,str):
            end_date_history = datetime.datetime.strptime(end_date_history, "%Y%m%d")
        end_date_history = end_date_history.replace(year=end_date_history.year).strftime("%Y-%m-%d")

        start_date_history = datetime.datetime.strptime(start_date_history, "%Y%m%d")
        start_date_history = start_date_history.replace(year=start_date_history.year - 1).strftime("%Y-%m-%d")
        # print("came till returb")
        return start_date, end_date, start_date_history, end_date_history

    '''
    for the product drop-down present in the sbu wise pages we need the productname to be in payload.
    when the page is loaded for the first time 
    '''
    if 'ProductName' in [x['key'].strip('"') for x in filters]:
        product_name_values = [x['value'] for x in filters if x['key'].strip('"') == 'ProductName']
        if product_name_values and product_name_values[0] == '':
            cross_filters = [f for f in cross_filters if f.get("key", "").strip('"') != "ProductName"]
    '''
    if 'fiscal_year' in [x['key'].strip('"') for x in filters]:
        if 'YTD' in [x['key'].strip('"') for x in filters] or 'YTDPM' in [x['key'].strip('"') for x in filters]:
            if len(cross_filters) == 1:
                filters = [x for x in filters if x['key'].strip('"') != 'fiscal_year']
    '''
    resp_level = ''
    if resp_format == 'summary':
        resp_level = 'summary'
        resp_format_org = 'summary'
        resp_format = ''
    else:
        resp_format_org = ''
    # Removing extra keys like all/_empty/* to mak sure all results appear in api response
    # Filtering cross filters
    org_cross_filters = cross_filters.copy()
    cross_filters = [cross_filter for cross_filter in cross_filters if not (cross_filter.get("cond") in ['=', 'equals']
                                                                            and cross_filter.get("value") and
                                                                            cross_filter["value"].lower() in ['*',
                                                                                                              '_empty',
                                                                                                              'all'])]
    # Filtering filters
    filters = [filter_cond for filter_cond in filters
               if not (filter_cond.get("cond") in ['=', 'equals'] and filter_cond.get("value") and
                       filter_cond["value"].lower() in ['*', '_empty', 'all'])]
    sbuName_req = ''
    sbuWise = False
    # Changing BG filter to GAS
    for index, eachfilter in enumerate(cross_filters):
        if eachfilter['key'] == '"SBU_Name"':
            if eachfilter['value'] == 'NG':
                cross_filters[index]['value'] = 'GAS'
    # Changing BG filter to GAS
    for index, each_filter in enumerate(filters):
        if each_filter['key'] == '"SBU_Name"':
            if each_filter['value'] == 'NG':
                filters[index]['value'] = 'GAS'
    if '"sbu_wise"' in [x['key'] for x in cross_filters]:
        sbuWise = True
        for index, eachfilter in enumerate(cross_filters):
            if eachfilter['key'] == '"sbu_wise"':
                cross_filters.pop(index)
    if '"SBU_Name"' in [x['key'] for x in filters]:
        for index, each_filter in enumerate(filters):
            if each_filter['key'] == '"SBU_Name"':
                sbuName_req = each_filter['value']
                break
    order = 'cumulative'
    if not cross_filters:
        cross_filters = []
    # Checking Cumulative enabled or not, On cumulative we should not group by month
    cumulative = False
    for condition in filters:
        if condition['key'].strip('"') == "C":
            cumulative = True
            break
    if not cross_filters and cumulative:
        cumulative = True
        order = 'cumulative'
    if cumulative:
        Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"',
                        '"month_name"', '"ProductName"']
        Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"',
                        '"ProductName"', '"month_name"']

        Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"ProductName"', '"Zone_Name"', '"Region_Name"',
                        '"SalesArea_Name"',
                        '"month_name"']
        Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"ProductName"', '"Zone_Name"', '"Region_Name"',
                        '"SalesArea_Name"',
                        '"month_name"']
        Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"ProductName"', '"Zone_Name"', '"Region_Name"',
                        '"SalesArea_Name"',
                        '"month_name"']
        '''
        APG_Filters = ['"cumulative_level"', '"SBU_Name"', '"ProductName"','"Zone_Name"', '"Region_Name"', '"SalesArea_Name"',
                         '"month_name"']
        '''
        APG_Filters = ['"cumulative_level"', '"SBU_Name"', '"ProductName"', '"month_name"']

        if resp_level == "summary" or resp_format == 'heat_map':
            Base_Filters = ['"cumulative_level"', '"SBU_Name"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"',
                            '"ProductName"', '"month_name"']
    else:
        Base_Filters = ['"month_name"', '"SBU_Name"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"',
                        '"ProductName"']
        # Base_Filters = ['"month_name"', '"SBU_Name"', '"ProductName"','"Zone_Name"', '"Region_Name"', '"SalesArea_Name"']
        if resp_level == "summary" or resp_format == 'heat_map':
            Base_Filters = ['"month_name"', '"SBU_Name"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"',
                            '"ProductName"']
    # Fetching all group by filters, return should be a list always
    group_by_filter = get_group_by_filter_key(cross_filters, Base_Filters, resp_format_org, cumulative, drill_state,
                                              time_grain)
    # Assigning empty variables
    history = actual = target = start_date = end_date = start_date_history = end_date_history = ""
    if "fiscal_year" in [x['key'].strip('"') for x in filters]:
        fiscal_year_ui = [x['value'] for x in filters if x['key'].strip('"') == "fiscal_year"][0]
        todays_date = str(datetime.date.today())
        if todays_date.split('-')[0] == fiscal_year_ui.split('-')[0]:
            if "YTD" in [x['key'].strip('"') for x in filters]:
                start_date, end_date, start_date_history, end_date_history = get_fiscal_year(fiscal_year_ui,
                                                                                             todays_date,
                                                                                             same_year=True, key='YTD')
            elif todays_date.split('-')[0] == fiscal_year_ui.split('-')[-1]:
                start_date, end_date, start_date_history, end_date_history = get_fiscal_year(fiscal_year_ui,
                                                                                                 todays_date,
                                                                                                 same_year=True,
                                                                                                 key='YTD')
            
            else:
                end_date = fiscal_year.FiscalYear.current().fiscal_year_end_date
                start_date = fiscal_year.FiscalYear.current().fiscal_year_start_date
                # For History
                start_date_history = fiscal_year.FiscalYear.current().prev_fiscal_year.start.strftime("%Y%m%d")
                end_date_history = helpers.get_time_stamp_by_delta(dt_parser.parse(end_date), years=1, days=0,
                                                                   with_month_start_day=False,
                                                                   date_time_format=None).strftime("%Y%m%d")
        elif todays_date.split('-')[0] != fiscal_year_ui.split('-')[0]:
            if "YTD" in [x['key'].strip('"') for x in filters]:
                print("YTD is present")
                start_date, end_date, start_date_history, end_date_history = get_fiscal_year(fiscal_year_ui,
                                                                                             todays_date,
                                                                                             same_year=False, key='YTD')
            else:
                # end_date = fiscal_year.FiscalYear.current().fiscal_year_end_date
                # start_date = fiscal_year.FiscalYear.current().fiscal_year_start_date
                # For History
                start_date = fiscal_year.FiscalYear.current().prev_fiscal_year.start.strftime("%Y%m%d")
                end_date = fiscal_year.FiscalYear.current().prev_fiscal_year.end.strftime("%Y%m%d")

                start_date_history = helpers.get_time_stamp_by_delta(dt_parser.parse(start_date), years=1, days=0,
                                                                     with_month_start_day=False,
                                                                     date_time_format=None).strftime("%Y%m%d")

                end_date_history = helpers.get_time_stamp_by_delta(dt_parser.parse(end_date), years=1, days=0,
                                                                   with_month_start_day=False,
                                                                   date_time_format=None).strftime("%Y%m%d")

        else:

            end_date = fiscal_year.FiscalYear.current().fiscal_year_end_date
            start_date = fiscal_year.FiscalYear.current().fiscal_year_start_date
            # For History
            start_date_history = fiscal_year.FiscalYear.current().prev_fiscal_year.start.strftime("%Y%m%d")
            end_date_history = helpers.get_time_stamp_by_delta(dt_parser.parse(end_date), years=1, days=0,
                                                               with_month_start_day=False,
                                                               date_time_format=None).strftime("%Y%m%d")
    else:
        end_date = fiscal_year.FiscalYear.current().fiscal_year_end_date
        start_date = fiscal_year.FiscalYear.current().fiscal_year_start_date
        # For History
        start_date_history = fiscal_year.FiscalYear.current().prev_fiscal_year.start.strftime("%Y%m%d")
        end_date_history = helpers.get_time_stamp_by_delta(dt_parser.parse(end_date), years=1, days=0,
                                                           with_month_start_day=False,
                                                           date_time_format=None).strftime("%Y%m%d")

    todays_date = str(datetime.date.today())
    '''
    if todays_date.split('-')[1] == '04' or todays_date.split('-')[1] == '4':
                start_date = datetime.datetime.strptime(start_date, "%Y-%m-%d")
                end_date = datetime.datetime.strptime(end_date, "%Y-%m-%d")
                start_date = start_date.replace(year=start_date.year - 1).strftime("%Y-%m-%d")
                end_date = end_date.replace(year=end_date.year-1).strftime("%Y-%m-%d")
                
                start_date_history = datetime.datetime.strptime(start_date_history, "%Y%m%d")
                start_date_history = start_date_history.replace(year=start_date_history.year - 1).strftime("%Y-%m-%d")
                end_date_history = datetime.datetime.strptime(end_date_history, "%Y%m%d")
                end_date_history = end_date_history.replace(year=end_date_history.year-1).strftime("%Y-%m-%d")
    
    '''
    for index, _ in enumerate(cross_filters):
        cross_filters[index]['key'] = cross_filters[index]['key'].strip('"')
    cross_filters = [rec for rec in cross_filters if not (rec['key'] == 'month_name' and not rec['value'].strip('"'))]
    # Modifying month name filter for cumulative
    for filter in cross_filters:
        if filter['key'].strip('"') == 'month_name' and ',' in filter['value']:
            filter['cond'] = 'in'
            filter['value'] = filter['value'].split(',')
        if 'cumulative' in [x['key'] for x in cross_filters] and len(cross_filters) == 1:
            cross_filters = []
        else:
            print('more filters are present')
    actual_data = []
    hist_data = []
    target_data = []
    #if "SBU_Name" in [x['key'].strip('"') for x in filters] or "SBU_Name" in [x['key'].strip('"') for x in cross_filters]:
        
    #    actual_d = f""" ROUND(SUM("MOM_DAY_LEVEL_DATA"."NETWEIGHT_TMT")::numeric,2) AS "ACTUAL_TMT_SALES", "DISTRIBUTION_CHANNEL_CD" """
    #    history_d = f""" ROUND(SUM("MOM_DAY_LEVEL_DATA"."NETWEIGHT_TMT")::numeric,2) AS "ACTUAL_HISTORY_TMT_SALES","DISTRIBUTION_CHANNEL_CD" """
    #    group_by_filter.append('DISTRIBUTION_CHANNEL_CD')
    #    print("group_by_filter at query gen",group_by_filter)
        
    #else:
    actual_d = f""" ROUND(SUM("MOM_DAY_LEVEL_DATA"."NETWEIGHT_TMT")::numeric,2) AS "ACTUAL_TMT_SALES" """
    history_d = f""" ROUND(SUM("MOM_DAY_LEVEL_DATA"."NETWEIGHT_TMT")::numeric,2) AS "ACTUAL_HISTORY_TMT_SALES" """
    filters_req = [condition['key'].strip('"') for condition in filters if
                   condition['key'].strip('"') in ["A", "H", "T"]]
    if len(filters_req) == 0:
        filters.append({"key": '"A"', "cond": "equals", "value": "true"})
    # Generating filters
    for condition in filters:
        if condition['key'].strip('"') == "A":
            actual = f"""ROUND(SUM("{DBNames['m60_ta']}"."NETWEIGHT_TMT")::numeric,2) AS "ACTUAL_TMT_SALES" """
            '''
            if time_grain in ['top_zones','top_regions','top_sales_area']:
                #actual = f"""ROUND(SUM("{DBNames['m60_ta']}"."NETWEIGHT_TMT")::numeric,2) AS "ACTUAL_TMT_SALES" ,"ProductName" """
                if '"ProductName"' not in group_by_filter:
                    if 'top_zones' not in time_grain :
                        group_by_filter.append('"ProductName"')
            '''
        elif condition['key'].strip('"') == "H":
            history = f"""ROUND(SUM("{DBNames['m60_h']}"."NETWEIGHT_TMT")::numeric,2) AS "ACTUAL_HISTORY_TMT_SALES" """
            '''
            if time_grain in ['top_zones','top_regions','top_sales_area']:
                #history = f"""ROUND(SUM("{DBNames['m60_h']}"."NETWEIGHT_TMT")::numeric,2) AS "ACTUAL_HISTORY_TMT_SALES","ProductName" """
                if '"ProductName"' not in group_by_filter:
                    
                    if 'top_zones' not in time_grain :
                        group_by_filter.append('"ProductName"')
            '''
        elif condition['key'].strip('"') == "T":
            target = f""" ROUND(SUM("{DBNames['m60_ta']}"."TARGET_QTY_TMT")::numeric,2) AS "TARGET_TMT_SALES" """
            '''
            if time_grain in ['top_zones','top_regions','top_sales_area']:
                target = f""" ROUND(SUM("{DBNames['m60_ta']}"."TARGET_QTY_TMT")::numeric,2) AS "TARGET_TMT_SALES","ProductName" """
                if '"ProductName"' not in group_by_filter:
                    if 'top_zones' not in time_grain :
                        group_by_filter.append('"ProductName"')
            '''     
            
        elif condition['key'].strip('"') == "C" and '"T"' not in [x['key'] for x in filters]:
            continue
        elif condition['key'].strip('"') == "YTD":
            # Calculating start and end dates for YTD for both actual and history
            # end_date_ = fiscal_year.FiscalDate.today()
            # end_date = helpers.get_time_stamp_by_delta(end_date_, days=1, with_month_start_day=False,
            #                                           date_time_format="%Y-%m-%d")
            # start_date = fiscal_year.FiscalYear.current().fiscal_year_start_date
            '''
            todays_date = str(datetime.date.today())
            if todays_date.split('-')[1] == '04' or todays_date.split('-')[1] == '4':
                start_date = datetime.datetime.strptime(start_date, "%Y-%m-%d")
                end_date = datetime.datetime.strptime(end_date, "%Y-%m-%d")
                start_date = start_date.replace(year=start_date.year - 1).strftime("%Y-%m-%d")
                end_date = end_date.replace(year=end_date.year).strftime("%Y-%m-%d")
            
            end_date_ = fiscal_year.FiscalDate.today()
            end_date = helpers.get_time_stamp_by_delta(end_date_, days=1, with_month_start_day=False,
                                                       date_time_format="%Y-%m-%d")
            start_date = fiscal_year.FiscalYear.current().fiscal_year_start_date
            # For History
            start_date_history = fiscal_year.FiscalYear.current().prev_fiscal_year.start.strftime(
                "%Y%m%d" if DefaultTable == "Day" else "%Y%m")
            end_date_history = helpers.get_time_stamp_by_delta(end_date_, years=1, days=1, with_month_start_day=False,
                                                               date_time_format=None)
            end_date_history = end_date_history.strftime(
                "%Y%m%d" if DefaultTable == "Day" else "%Y%m")
            '''
            '''
            if todays_date.split('-')[1] == '04' or todays_date.split('-')[1] == '4':
                end_date_history = datetime.datetime.strptime(end_date_history, "%Y%m%d")
                end_date_history = end_date_history.replace(year=end_date_history.year).strftime("%Y-%m-%d")
            
                start_date_history = datetime.datetime.strptime(start_date_history, "%Y%m%d")
                start_date_history = start_date_history.replace(year=start_date_history.year-1).strftime("%Y-%m-%d")
                
            '''

            if "fiscal_year" in [x['key'].strip('"') for x in filters]:
                start_date_org = start_date
                start_date_history_org = start_date_history
                fiscal_year_ui = [x['value'] for x in filters if x['key'].strip('"') == "fiscal_year"][0]
              
                todays_date == str(datetime.date.today())
                if todays_date.split('-')[0] == fiscal_year_ui.split('-')[0]:
                    start_date, end_date, start_date_history, end_date_history = get_fiscal_year(fiscal_year_ui,
                                                                                                 todays_date,
                                                                                                 same_year=True,
                                                                                                 key='YTD')
                    
                elif todays_date.split('-')[0] == fiscal_year_ui.split('-')[-1]:
                    if todays_date.split('-')[1] == '04' and todays_date.split('-')[-1] == '01':
                        start_date, end_date, start_date_history, end_date_history = get_fiscal_year(fiscal_year_ui,
                                                                                                    todays_date,
                                                                                                    same_year=True,
                                                                                                    key='YTD')   
                    start_date, end_date, start_date_history, end_date_history = get_fiscal_year(fiscal_year_ui,
                                                                                                 todays_date,
                                                                                                 same_year=False,
                                                                                                 key='YTD')

                    if todays_date.split('-')[1] == '04' and todays_date.split('-')[-1] == '01':
                       start_date = start_date_org
                       start_date_history = start_date_history_org

                

                
                else:
                    start_date, end_date, start_date_history, end_date_history = get_fiscal_year(fiscal_year_ui,
                                                                                                 todays_date,
                                                                                                 same_year=False,
                                                                                                   key='YTD')

        elif condition['key'].strip('"') == "FYC":
            condition = [x for x in filters if x['key'] == '"DATE"']
            # Calculating start and end dates for YTD for both actual and history
            start_date, end_date = condition[0]['value'].split(",")
            start_date = fiscal_year.FiscalYear.current().fiscal_year_start_date
            # end_date = dt_parser.parse(end_date)
            start_date_history = fiscal_year.FiscalYear.current().prev_fiscal_year.start.strftime(
                "%Y%m%d" if DefaultTable == "Day" else "%Y%m")
            end_date_history = fiscal_year.FiscalYear.current().prev_fiscal_year.end.strftime(
                "%Y%m%d" if DefaultTable == "Day" else "%Y%m")

        elif condition['key'].strip('"') == "YTDPM":

            if "fiscal_year" in [x['key'].strip('"') for x in filters]:
                fiscal_year_ui = [x['value'] for x in filters if x['key'].strip('"') == "fiscal_year"][0]
                # print("todays_date.split('-')[0]", todays_date.split('-')[0])
                # print("fiscal_year_ui.split('-')[0]", fiscal_year_ui.split('-')[0])

                if ((todays_date.split('-')[1] == '04' or todays_date.split('-')[1] == '4') and
                        todays_date.split('-')[0] == fiscal_year_ui.split('-')[0]):
                    # print("in this data loop")
                    return {"status": False, "message": "No Data Present for the current selection",
                            "data": {'data': {'ACTUAL_TMT_SALES': {}, 'ACTUAL_HISTORY_TMT_SALES': {}, 'cumulative': {},
                                              'SBU_Name': {}}, 'level': {}, 'sales_unit': 'TMT'}}
                if todays_date.split('-')[0] == fiscal_year_ui.split('-')[0]:
                    start_date, end_date, start_date_history, end_date_history = get_fiscal_year(fiscal_year_ui,
                                                                                                 todays_date,
                                                                                                 same_year=True,
                                                                                                 key='YTDPM')

                elif todays_date.split('-')[0] == fiscal_year_ui.split('-')[-1]:
                    start_date, end_date, start_date_history, end_date_history = get_fiscal_year(fiscal_year_ui,
                                                                                                 todays_date,
                                                                                                 same_year=False,
                                                                                                 key='YTDPM')
                else:
                    start_date, end_date, start_date_history, end_date_history = get_fiscal_year(fiscal_year_ui,
                                                                                                 todays_date,
                                                                                                 same_year=False,
                                                                                                 key='YTDPM')

            '''
            # Calculating start and end dates for YTD for both actual and history
            end_date_ = fiscal_year.FiscalDate.today()
            end_date = helpers.get_time_stamp_by_delta(end_date_, years=0, days=1, with_month_start_day=True,
                                                       date_time_format="%Y-%m-%d")
            print("came into YTDPM")
            start_date = fiscal_year.FiscalYear.current().fiscal_year_start_date
            '''
            '''
            todays_date = str(datetime.date.today())
            if todays_date.split('-')[1] == '04' or todays_date.split('-')[1] == '4':
                start_date = datetime.datetime.strptime(start_date, "%Y-%m-%d")
                end_date = datetime.datetime.strptime(end_date, "%Y-%m-%d")
                start_date = start_date.replace(year=start_date.year - 1).strftime("%Y-%m-%d")
                end_date = end_date.replace(year=end_date.year).strftime("%Y-%m-%d")
            '''
            '''
            # For History
            start_date_history = fiscal_year.FiscalYear.current().prev_fiscal_year.start.strftime(
                "%Y%m%d" if DefaultTable == "Day" else "%Y%m")
            end_date_history = helpers.get_time_stamp_by_delta(end_date_, years=1, days=1, with_month_start_day=True,
                                                               date_time_format=None)
            end_date_history = end_date_history.strftime(
                "%Y%m%d" if DefaultTable == "Day" else "%Y%m")
            '''
            '''
            if todays_date.split('-')[1] == '04' or todays_date.split('-')[1] == '4':
                start_date_history = datetime.datetime.strptime(start_date_history, "%Y%m%d")
                start_date_history = start_date_history.replace(year=start_date_history.year-1).strftime("%Y-%m-%d")
            '''
        elif condition['key'].strip('"') == "DATE" and '"FYC"' not in [x['key'] for x in filters]:
            # Calculating start and end dates
            start_date, end_date = condition['value'].split(",")
            start_date_history = dt_parser.parse(start_date)
            start_date_history = start_date_history.replace(year=start_date_history.year - 1).strftime(
                "%Y%m%d" if DefaultTable == "Day" else "%Y%m")
            # For History
            end_date_history = dt_parser.parse(end_date)
            end_date_history = end_date_history.replace(year=end_date_history.year - 1).strftime(
                "%Y%m%d" if DefaultTable == "Day" else "%Y%m")
        elif condition['key'] == '"FISCAL_YEAR"':
            # Not considering now
            ...
        else:
            if condition['key'] != '"C"':
                # Clearing if value was an empty string
                if not condition["value"]:
                    continue
                condition["key"] = condition["key"].strip('"')
                # Giving more preference for the month's provided in filters than cross filters on drill down
                if condition["key"] == "month_name":
                    value = [mnt_name.strip() for mnt_name in condition["value"].split(",")]
                    cross_filter_append = True
                    for crs_rec in cross_filters:
                        if crs_rec["key"] == "month_name":
                            if len(value) == 1:
                                crs_rec["value"] = value[0]
                            else:
                                crs_rec["value"] = value
                                crs_rec["cond"] = 'one-off'
                            cross_filter_append = False
                    if cross_filter_append:
                        if len(value) > 1:
                            condition["cond"] = 'one-off'
                            condition["value"] = value
                        cross_filters.append(condition)
                else:
                    if condition['key'] == 'DATE':
                        if '"FYC"' not in [x['key'] for x in filters]:
                            cross_filters.append(condition)
                    else:
                        if ',' in condition['value']:
                            condition['cond'] = 'in'
                            condition['value'] = condition['value'].split(',')
                        if condition['key'].strip('"') == 'resp_format':
                            if condition['value'] != 'heat_map':
                                cross_filters.append(condition)
                        # commenting below lines on drop-down isue
                        # print("resp_format", resp_format)
                        # if 'fiscal_year' in [x['key'].strip('"') for x in filters] and time_grain != 'drop-down':
                        # if 'fiscal_year' in [x['key'].strip('"') for x in filters]:
                        if 'fiscal_year' in condition['key'].strip('"'):
                            # print("came here3", condition)
                            if 'YTD' in [x['key'].strip('"') for x in filters] or 'YTDPM' in [x['key'].strip('"') for x
                                                                                              in filters]:
                                continue
                        else:
                            cross_filters.append(condition)

    def get_group_by_columns(group_by_filter):
        if group_by_filter:
            return [rec.replace('"', '').strip() for rec in group_by_filter]
        else:
            return ""
    where_conditions = []
    clause = await widget_actions.WidgetActions.generate_filter_clause(cross_filters.copy())
    if clause:
        where_conditions = [clause]
    # For history table
    for rec in cross_filters:
        rec['key'] = rec['key'].strip('"')

    where_conditions_history = []
    clause = await widget_actions.WidgetActions.generate_filter_clause(cross_filters.copy())
    if clause:
        where_conditions_history = [clause]
    # Data Retrival for target data
    if target:
        group_keys = [key for key in group_by_filter]
        if '"month_name"' not in group_by_filter and '"C"' not in [x['key'] for x in filters]:
            group_keys.append("month_name")
        if '"C"' not in [x['key'] for x in filters]:
            target_data = await collect_data([target, 'month_name'], 'M60_LEVEL_METADATA',
                                             where_conditions + Default_Filters, start_date, end_date, group_keys)
        elif '"C"' in [x['key'] for x in filters] and '"YTD"' in [x['key'] for x in filters] and '"T"' in [x['key'] for
                                                                                                           x in
                                                                                                           filters] and (
                len(org_cross_filters) == 0 or (
                len(org_cross_filters) == 1 and org_cross_filters[0]['key'] == '"sbu_wise"')):
            group_keys.append('month_name')
            target_data = await collect_data([target, 'month_name'], 'M60_LEVEL_METADATA',
                                             where_conditions + Default_Filters, start_date, end_date, group_keys)

        elif '"C"' in [x['key'] for x in filters] and '"YTD"' not in [x['key'] for x in filters] and '"T"' in [x['key']
                                                                                                               for x in
                                                                                                               filters] and (
                len(org_cross_filters) == 0 or (
                len(org_cross_filters) == 1 and org_cross_filters[0]['key'] == '"sbu_wise"')):
            if "month_name" not in [x.strip('"') for x in group_keys]:
                group_keys.append('month_name')
            target_data = await collect_data([target, 'month_name'], 'M60_LEVEL_METADATA',
                                             where_conditions + Default_Filters, start_date, end_date, group_keys)
        elif '"DATE"' in [x['key'] for x in filters] :
        #and 'C' not in [x['key'].strip('"') for x in filters]:
            print("came into date condition") 
            if "month_name" not in [x.strip('"') for x in group_keys] : 
            #and 'C' not in [x['key'].strip('"') for x in filters]:
                group_keys.append("month_name")
            target_data = await collect_data([target], 'M60_LEVEL_METADATA',
                                             where_conditions + Default_Filters, start_date, end_date, group_keys)
        elif '"C"' in [x['key'] for x in filters] and '"YTD"' in [x['key'] for x in filters] and '"T"' in [x['key'] for
                                                                                                           x in
                                                                                                         filters]:
            # commenting the below line because month_name should not be present in the group_by_filter for cumulative mode
            #group_keys.append("month_name")
            target_data = await collect_data([target], 'M60_LEVEL_METADATA',
                                             where_conditions + Default_Filters, start_date, end_date, group_keys)
        else:
            target_data = await collect_data([target], 'M60_LEVEL_METADATA',
                                             where_conditions + Default_Filters, start_date, end_date, group_keys)
        if isinstance(target_data,dict):
            
            if not target_data.get('data',[]):
                target_data = []
        if target_data:
            # if '"C"'   in [x['key'] for x in filters] and '"YTD"'   in [x['key'] for x in filters] and '"T"'   in [x['key'] for x in filters] and len(org_cross_filters) == 0:
            if (('"YTD"' in [x['key'] for x in filters] and '"T"' in [x['key'] for x in filters]
                and (len(org_cross_filters) == 0) and '"C"' in [x['key'] for x in filters] and time_grain != 'Monthly')
                    or ('"DATE"' in [x['key'] for x in filters] and '"T"' in [x['key'] for x in filters])):

                '''
                if end_date:
                    end_month = fiscal_year.get_month_abbr(end_date)
                    print("end_mionth is ",end_month)
                    target_data = [x.update({'month_name': end_month}) or x for x in target_data]  
                '''
                target_data = pd.DataFrame(calculate_pro_rate(target_data, "TARGET_TMT_SALES", start_date, end_date))
                
                # if target_data.empty:
                #   return {
                #          "status": False,
                #          "message": "No Data Present for the Current Selection",
                #          "data": {}
                #         }
                
                #if "C"  in [x['key'].strip('"') for x in filters]:
                #    del target_data['month_name']
                if "month_name" in target_data.columns.tolist():
                    #here we are trying to drill from SA to month_name  where we are getting issue. month_name is getting deleted . thats the reason we are not deleting 
                    #month_name in  YR mode
                    
                    if "C" not in [x['key'].strip('"') for x in filters] and "DATE" not in [x['key'].strip('"') for x in filters]:
                        del target_data['month_name']
                if "TARGET_TMT_SALES" in target_data.columns.tolist():
                    sample_data = pd.DataFrame(columns=['TARGET_TMT_SALES'])
                    sample_data['TARGET_TMT_SALES'] = target_data['TARGET_TMT_SALES'].sum()
                    if not sample_data.empty:
                        target_data = sample_data
            elif '"C"' not in [x['key'] for x in filters]:
                target_data = pd.DataFrame(calculate_pro_rate(target_data, "TARGET_TMT_SALES", start_date, end_date))
            elif '"C"' in [x['key'] for x in filters] and len(org_cross_filters) == 1 and org_cross_filters[0][
                'key'] == '"sbu_wise"':
                target_data = pd.DataFrame(calculate_pro_rate(target_data, "TARGET_TMT_SALES", start_date, end_date))
            # elif isinstance(target_data,dict):
            #     if len(target_data['data']) == 0:
            #         return {"status":False,"data":'No Data Present For Current Selection'}
            elif '"YTD"' in [x['key'] for x in filters] and 'month_name' in target_data[0]:
                target_data = pd.DataFrame(calculate_pro_rate(target_data, "TARGET_TMT_SALES", start_date, end_date))
            else:
                target_data = pd.DataFrame(target_data)
            if group_by_filter and not cumulative:
                target_data = target_data.groupby(get_group_by_columns(group_by_filter))[
                    'TARGET_TMT_SALES'].sum().reset_index()
            else:
                if not cumulative:
                    target_data = pd.DataFrame([{'TARGET_TMT_SALES': target_data.sum()['TARGET_TMT_SALES']}])
            if '"month_name"' in group_by_filter and 'month_name' in target_data:
                target_data['month_name'] = pd.CategoricalIndex(target_data['month_name'], ordered=True,
                                                                categories=months)
            # For I&C if the  values for the HFHSD is zero then drop that product
            if "ProductName" in target_data.columns.tolist():
                if  "HFHSD" in target_data['ProductName'].unique().tolist():
                    if int(target_data[target_data['ProductName'] == 'HFHSD']['TARGET_TMT_SALES'].unique().tolist()[0]) == 0:
                        target_data = target_data[target_data['ProductName'] != 'HFHSD']
            print("writing tgt data to csv")
            target_data.to_csv('/tmp/tgt_data.csv',index = False)
            #remove the month column frpm the data if the cumulkative option is present in the filter
            if "C" in [x['key'].strip('"') for x in filters]:
                
                if 'month_name' in target_data.columns.tolist():
                    print("came to month name del")
                    print("group_by_filter",group_by_filter)
                    if len(group_by_filter) ==1:
                        if "month_name" not in [x.strip('"') for x in group_by_filter] :
                            del target_data['month_name']
                    #del target_data['month_name']
                    common_column = ['TARGET_TMT_SALES']
                    existing_columns = [col for col in ["SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name"] if col in target_data.columns]
                    if "month_name" not in [x.strip('"') for x in group_by_filter] :
                        if existing_columns:
                            target_data = target_data.groupby(existing_columns, as_index=False)['TARGET_TMT_SALES'].sum().reset_index()
                    target_data.to_csv('/tmp/tgt_data_latest.csv',index = False)
            if "C" in [x['key'].strip('"') for x in filters] and "month_name" not  in target_data.columns.tolist() and "DATE"  in [x['key'].strip('"') for x in filters]:
                if 'TARGET_TMT_SALES' in target_data.columns.tolist() and "ProductName" in target_data.columns.tolist():                    
                    target_data = target_data.groupby("ProductName", as_index=False)['TARGET_TMT_SALES'].sum().reset_index()                  
            target_data.to_csv('/tmp/tgt_data_latest_latest.csv',index = False)
            target_data = target_data.to_dict(orient='records')

    # Data Retrival for current financial year
    if actual:
        # Checking whether start date and end date enabled
        filter_dates = []
        day_filter_dates = []
        if start_date and end_date:
            filter_dates, day_filter_dates = await get_date_filters(start_date, end_date)
        else:
            if DefaultTable == "Day":
                day_filter_dates.append([start_date, end_date])
            else:
                filter_dates.append([start_date, end_date])
        # For Month level aggregations from month data table
        for date_range in filter_dates:
            actual_data.extend(await collect_data([actual], 'MOM_DAY_LEVEL_DATA',
                                                  where_conditions + Default_Filters, date_range[0], date_range[1],
                                                  group_by_filter))
        # For Month level aggregations from day wise data table
        # Todo:- for optimization use single query for day filter with or condition
        for date_range in day_filter_dates:
            actual_data.extend(await collect_data([actual_d], 'MOM_DAY_LEVEL_DATA',
                                                  where_conditions + Default_Filters, date_range[0], date_range[1],
                                                  group_by_filter, '"DAY_ID"'))
        if actual_data:
        # if not pd.DataFrame(actual_data).empty:
            
            if isinstance(actual_data, list) and len(actual_data) > 0 and actual_data[0] == 'data':
                    actual_data = []
            else:
                actual_data = pd.DataFrame(actual_data)
                if group_by_filter:
                    actual_data = actual_data.groupby(get_group_by_columns(group_by_filter))[
                        'ACTUAL_TMT_SALES'].sum().reset_index()
                else:
                    actual_data = pd.DataFrame([{'ACTUAL_TMT_SALES': actual_data.sum()['ACTUAL_TMT_SALES']}])
                actual_data['ACTUAL_TMT_SALES'] = actual_data['ACTUAL_TMT_SALES'].fillna(0)
                actual_data = actual_data.to_dict(orient='records')

    # Data Retrival for last financial year
    if history:
        filter_dates = []
        day_filter_dates = []
        if start_date and end_date:
            filter_dates, day_filter_dates = await get_date_filters(start_date_history, end_date_history, "%Y%m")
        else:
            if DefaultTable == "Day":
                day_filter_dates.append([start_date_history, end_date_history])
            else:
                filter_dates.append([start_date_history, end_date_history])
        for date_range in filter_dates:
            hist_data.extend(await collect_data([history], 'MOM_DAY_LEVEL_DATA',
                                                where_conditions_history + Default_Filters, date_range[0],
                                                date_range[1], group_by_filter, '"YEARMONTH"'))
        # Todo:- for optimization use single query for day filter with or condition
        for date_range in day_filter_dates:
            hist_data.extend(await collect_data([history_d], 'MOM_DAY_LEVEL_DATA',
                                                where_conditions_history + Default_Filters, date_range[0],
                                                date_range[1], group_by_filter, '"DAY_ID"'))
        if hist_data:
            hist_data = pd.DataFrame(hist_data)
            if group_by_filter:
                hist_data = hist_data.groupby(get_group_by_columns(group_by_filter))[
                    'ACTUAL_HISTORY_TMT_SALES'].sum().reset_index()
            else:
                hist_data = pd.DataFrame([{'ACTUAL_HISTORY_TMT_SALES': hist_data.sum()['ACTUAL_HISTORY_TMT_SALES']}])
            hist_data['ACTUAL_HISTORY_TMT_SALES'] = hist_data['ACTUAL_HISTORY_TMT_SALES'].fillna(0)
            hist_data = hist_data.to_dict(orient='records')
    '''
    print("actual_data",actual_data)
    print("target_data",target_data)
    print("his_data",hist_data)
    '''
    
    drill_list = ['SBU_Name','ProductName','Zone_Name','Region_Name','SalesArea_Name','month_name']
    summed_data = defaultdict(Decimal)
    tgt_result = []
    '''
    if target_data:
        #if 'productName' in target_data[0] or 'ProductName' in target_data[0]:
        for each_level in drill_list:
            print("each_lvel",each_level)
            if each_level in target_data[0]:
                print("each level present",each_level)
                for entry in target_data:
                
                    product = entry[each_level]
                    value = Decimal(entry['TARGET_TMT_SALES'])  # Ensure consistent Decimal
                    summed_data[product] += value
                #tgt_result = [{'ProductName': k, 'TARGET_TMT_SALES': round(v, 2)} for k, v in summed_data.items()]
                tgt_result = [{f"{each_level}": k, 'TARGET_TMT_SALES': round(v, 2)} for k, v in summed_data.items()]
                if resp_format != 'heat_map':
                    break
        if len(tgt_result)  == 0:
            tgt_result = target_data
        #df_ = [pd.DataFrame(d) for d in [actual_data, tgt_result, hist_data] if d]
        print("tgt_result",tgt_result)
    '''
    '''
    Copying target data into tgt_result and summing up as the merge with actual or hist data is giving error. Becaus on target_data we will calculate pro-rate
    '''
    
    matched_level = None

    if target_data:
        for each_level in drill_list:
            if each_level in target_data[0]:
                if not tgt_result:
                    area_map = {}
                    print("came here for level ",each_level)
                    matched_level = each_level
                    for entry in target_data:
                        key = entry[each_level]
                        value = Decimal(entry['TARGET_TMT_SALES'])
                        summed_data[key] += value
                        if time_grain == 'top_sales_area':
                            area_map[key] = entry.get('SalesArea_Name', None)
                        if time_grain == 'top_regions':
                            area_map[key] = entry.get('Region_Name', None)
                        if time_grain == 'top_zones':
                            area_map[key] = entry.get('Zone_Name', None)
                    print("summed_data",summed_data)
                    if time_grain == 'top_sales_area':
                        tgt_result = [{f"{matched_level}": k, 'TARGET_TMT_SALES': round(v, 2), 'SalesArea_Name': area_map.get(k)} for k, v in summed_data.items()]
                    if time_grain == 'top_regions':
                        tgt_result = [{f"{matched_level}": k, 'TARGET_TMT_SALES': round(v, 2), 'Region_Name': area_map.get(k)} for k, v in summed_data.items()]
                    if time_grain == 'top_zones':
                            tgt_result = [{f"{matched_level}": k, 'TARGET_TMT_SALES': round(v, 2), 'Zone_Name': area_map.get(k)} for k, v in summed_data.items()]
                    if resp_format != 'heat_map':
                        continue  # Continue to check for month_name
                elif each_level == 'month_name' and matched_level:
                    # Add month_name to existing tgt_result items
                    for row in tgt_result:
                        match_key = row[matched_level]
                        for entry in target_data:
                            if entry[matched_level] == match_key:
                                row['month_name'] = entry.get('month_name')
                                break
                    break
        print("tgt_result",tgt_result)
        non_month_keys = [k for k in drill_list if k != 'month_name']
        if (
            all(k not in target_data[0] for k in non_month_keys) and
            'month_name' in target_data[0] and
            len(tgt_result) == 0
        ):
            tgt_result = target_data
        
        if len(tgt_result) == 0:
            tgt_result = target_data
        
        #if any(drill_list) not in target_data[0] and len(tgt_result) == 0:
        #    tgt_result = target_data
            #if len(tgt_result) ==0:
            #    tgt_result = target_data
        #df_ = [pd.DataFrame(d) for d in [actual_data, target_data, hist_data] if d]
    df_ = [pd.DataFrame(d) for d in [actual_data, tgt_result, hist_data] if d]
    merged_df = df_[0] if len(df_) else pd.DataFrame([])
    if len(df_) > 1:
        for df in df_[1:]:
            if group_by_filter:
                merged_df = pd.merge(merged_df, df, on=get_group_by_columns(group_by_filter),
                                     how='outer')  # Outer merge with df2
            else:
                merged_df = pd.concat([merged_df, df], axis=0)
    # Creating a data frame from concated df if no group by
    if not group_by_filter:
        result_df = pd.DataFrame()
        for col in merged_df.columns:
            if col not in "month_name":
                result_df[col] = [merged_df[col].sum()]
        merged_df = result_df
    # Ordering Data for Month and SBU names
    if not merged_df.empty and ('"month_name"' in group_by_filter or '"SBU_Name"' in group_by_filter):
        sort_key = sbu_order if '"SBU_Name"' in group_by_filter else months
        order_key = 'SBU_Name' if '"SBU_Name"' in group_by_filter else 'month_name'
        merged_df["data_order"] = merged_df[order_key].map({cond: i for i, cond in enumerate(sort_key)})
        merged_df = merged_df.sort_values("data_order").drop(columns="data_order")
        merged_df = merged_df[merged_df[order_key].isin(sort_key)]
        merged_df.reset_index(drop=True, inplace=True)
    # If required keys not available keeping records with zero value
    if target:
        if MandateKeys["target"] not in merged_df:
            merged_df[MandateKeys["target"]] = 0
    if actual:
        if MandateKeys["actual"] not in merged_df:
            merged_df[MandateKeys["actual"]] = 0
    if history:
        if MandateKeys["history"] not in merged_df:
            merged_df[MandateKeys["history"]] = 0
    if group_by_filter:
        for key in get_group_by_columns(group_by_filter):
            if key not in merged_df:
                merged_df[key] = ""
    merged_df.fillna(0, inplace=True)
    #merged_df.to_csv('/tmp/nerged_df.csv',index = False)
    print("merged columns",merged_df.columns.tolist())
    
    #If Lubes and DEF is present in the products list and the actuial,tgt sakes are zero tmt then drop the products from list
    '''
    if "ProductName" in merged_df.columns.tolist():
        if "Lubes" in merged_df['ProductName'].unique().tolist():
            
            if int(merged_df[merged_df['ProductName'] == 'Lubes']['ACTUAL_TMT_SALES'].unique().tolist()[0]) == 0 and int(merged_df[merged_df['ProductName'] == 'Lubes']['ACTUAL_HISTORY_TMT_SALES'].unique().tolist()[0]) == 0:
                print("came inside the req if")
                merged_df = merged_df[merged_df['ProductName'] != 'Lubes']
                print(merged_df[merged_df['ProductName'] == 'Lubes'])
    '''
    if "ProductName" in merged_df.columns.tolist():
        if any(product in merged_df['ProductName'].unique().tolist() for product in ['Lubes', 'DEF']):
            
            for product in ['Lubes', 'DEF']:
                if product in merged_df['ProductName'].unique().tolist():
                    if (int(merged_df[merged_df['ProductName'] == product]['ACTUAL_TMT_SALES'].unique().tolist()[0]) == 0 and 
                        int(merged_df[merged_df['ProductName'] == product]['ACTUAL_HISTORY_TMT_SALES'].unique().tolist()[0]) == 0):
                        print(f"came inside the req if for {product}")
                        merged_df = merged_df[merged_df['ProductName'] != product]
                        print(merged_df[merged_df['ProductName'] == product])
            
    if time_grain == "fiscal_year":
        result = await get_sbu_sales_fiscal(
            merged_df,
            filters,
            cross_filters,
            drill_state,
            time_grain,
            resp_format
        )
        if result["status"]:
            return result

        
    if time_grain == 'top_zones':
             
        result = await get_top_and_bottom_3_zones_by_year_sbu(merged_df,filters, cross_filters, drill_state, time_grain, resp_format)
        print("RESULT",result)
        if result["status"]:
            print("Top 3 Zones:", result["data"]["top_3_zones"])
            return result
        else:
            print("Error:", result["message"])
            return result
        
    if time_grain == 'top_regions':
             
        result = await get_top_and_bottom_7_regions_by_year_sbu(merged_df,filters, cross_filters, drill_state, time_grain, resp_format)
        print("RESULT",result)
        if result["status"]:
            print("Top 7 Regions:", result["data"]["top_region"])
            return result
        else:
            print("Error:", result["message"])
            return result   
        
    if time_grain == 'top_sales_area':
             
        result = await get_top_and_bottom_10_sales_area_by_year_sbu(merged_df,filters, cross_filters, drill_state, time_grain, resp_format)
        print("RESULT",result)
        if result["status"]:
            print("Top 10 Sales Area:", result["data"]["top_sales"])
            return result
        else:
            print("Error:", result["message"])
            return result   
    
    
    # This below if condition is to show the multi month selected cummulative values in the bar graph when multiple months is selected in drop-down
    # if len(where_conditions) ==1 and "month_name" in where_conditions[0] and 'IN' in where_conditions[0] and "month_df" in merged_df.columns:
    if (len(group_by_filter) <= 1 and len(where_conditions) == 1 and "month_name" in where_conditions[0] and
            'IN' in where_conditions[0] and 'month_name' in merged_df.columns):
        amount_columns = merged_df.columns.difference(['month_name'])
        # Concatenate month names
        result_df = pd.DataFrame({
            'month_name': [','.join(merged_df['month_name'])],
        })
        for col in amount_columns:
            result_df[col] = [merged_df[col].sum()]
        merged_df = result_df
    if len(cross_filters) > 0:
        filter_order = [key.strip('"') for key in Base_Filters]
        sorted_cross_filters = sorted(cross_filters,
                                      key=lambda x: filter_order.index(x['key']) if x['key'] in filter_order else float(
                                          'inf'))
        req_key = sorted_cross_filters[-1]['key']
        req_key = f'"{req_key}"'
        # added if on drop-down isue
        # if req_key in Base_Filters:
        previous_keys = Base_Filters[:Base_Filters.index(req_key)]
        # added else on drop-down isue
        # else :
        #    previous_keys = ''
        # added if on drop-down isue
        # if previous_keys:
        if '"cumulative_level"' in previous_keys:
            previous_keys.remove('"cumulative_level"')
        previous_keys = [item.strip('"') for item in previous_keys]
        Charts_Get_Distinct_ValuesParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Get_Distinct_ValuesParams.action = 'get_distinct_values'
        Charts_Get_Distinct_ValuesParams.column = previous_keys

        if sorted_cross_filters[-1].get('cond') not in [' ', 'in', 'one-off']:
            sorted_cross_filters[-1]['cond'] = '='
        Charts_Get_Distinct_ValuesParams.where_cond = [sorted_cross_filters[-1]]
        function = await charts_connection_vault_routing(Charts_Get_Distinct_ValuesParams)
        resp = await function(schema_name='public', table_name="MOM_DAY_LEVEL_DATA",
                              column_name=Charts_Get_Distinct_ValuesParams.column,
                              where_clause=Charts_Get_Distinct_ValuesParams.where_cond)
        sorted_level = resp['data']
        if not sorted_level:
            sorted_level = {}

        for each_filter in sorted_cross_filters:
            if each_filter['key'] in sorted_level:
                if len(sorted_level[each_filter['key']]) == each_filter['value']:
                    sorted_level[each_filter['key']].append(each_filter['value'])
                else:
                    sorted_level[each_filter['key']] = [each_filter['value']]
            if sorted_cross_filters[-1]['key'] not in sorted_level:
                sorted_level[sorted_cross_filters[-1]['key']] = []
                sorted_level[sorted_cross_filters[-1]['key']].append(sorted_cross_filters[-1]['value'])
        month_keys = []

        if sorted_level and sorted_level.get("month_name") and not cumulative:
            if isinstance(sorted_level['month_name'][0], list):
                sorted_level['month_name'] = sorted_level['month_name'][0]
            month_keys = sorted_level['month_name'] = sorted(sorted_level['month_name'], key=months.index)
        if len(group_by_filter) > 1:
            '''
            if 'SalesArea_Name' in merged_df.columns.tolist() or 'Region_Name' in merged_df.columns.tolist():
                for column in list(MandateKeys.values()):
                    if column in merged_df.columns.tolist():
                        merged_df[column] = merged_df[column].fillna(0).astype(int) * 1000
            '''
            final_resp, hist_growth_details, tgt_growth_details = generate_stacked_data(drill_state, merged_df,
                                                                                        resp_format,
                                                                                        month_column='month_name')
        else:
            if not resp_format:
                final_resp = {key: value.to_dict() for key, value in merged_df.to_dict(orient='series').items()}
            else:
                final_resp, hist_growth_details, tgt_growth_details = generate_stacked_data(drill_state, merged_df,
                                                                                            resp_format,
                                                                                            month_column='month_name')
        measure_unit = 'TMT'
        """'if 'Zone_Name' in [x['key'] for x in cross_filters] or 'Region_Name' in [x['key'] for x in cross_filters] or 'SalesArea_Name' in [x['key'] for x in cross_filters]:
            measure_unit = 'MT'
        if sbuName_req =="GAS" :
            measure_unit = 'MT'"""
        if 'cumulative' not in final_resp and not drill_state:
            final_resp['cumulative'] = {}
        if isinstance(final_resp, dict) and len(final_resp.get('ACTUAL_TMT_SALES', [])) == 1 and not drill_state:
            # if '"SBU_Name"' in [x['key'] for x in filters] or 'SBU_Name' in [x['key'] for x in filters]:
            # if '"sbu_wise"' in [x['key'] for x in cross_filters] or 'sbu_wise' in [x['key'] for x in cross_filters]:
            # if resp_format == 'sbu_wise':
            if sbuWise:
                final_resp['cumulative']["0"] = sbuName_req.upper() + '_CUMMULATIVE_SALES'
            else:
                final_resp['cumulative']["0"] = 'CUMMULATIVE_SALES'

        else:
            if isinstance(final_resp, dict):
                for each_key in final_resp.get('ACTUAL_TMT_SALES', []):
                    # if 'cumulative' not in final_resp and not drill_state:
                    if 'cumulative' not in final_resp and not drill_state:
                        final_resp['cumulative'] = {}
                    if 'cumulative' not in final_resp and time_grain == 'Yearly':
                        final_resp['cumulative'] = {}
                    final_resp['cumulative'][each_key] = ''
        if resp_format == 'heat_map':
            hist_xaxis = []
            tgt_xaxis = []
            #xAxis.extend([x['title'].split('_')[0]+'_'+x['title'].split('_')[1] for x in growth_details if '_' in x else x.split()[0]])
            #print("xaxiz",xAxis)
            #hist_xaxis.extend(['_'.join(x['title'].split('_')[:2]) if '_' in x['title'] and 'hist' in x['title'].lower()  else x['title'].split()[0] if 'hist' in x['title'].lower() for x in growth_details if isinstance(x, dict) and 'title' in x])
            #hist_xaxis.extend(['_'.join(x['title'].split('_')[:2]) if '_' in x['title'] and 'hist' in x['title'].lower()  else x['title'].split()[0] if 'hist' in x['title'].lower()
            #                   else x for x in hist_growth_details if isinstance(x, dict) and 'title' in x])
            print("hist_growth_details",hist_growth_details)
            print("tgt_growth_details",tgt_growth_details)
            hist_xaxis.extend(
                ['_'.join(x['title'].split('_')[:2]) for x in hist_growth_details if 'hist' in x['title'].lower()])
            li = None
            if len(hist_xaxis) > 1:
                di = final_resp[0]
                li = merged_df['month_name'].unique().tolist()
                if len(hist_xaxis)!= 2:
                    req_index = li.index(hist_xaxis[1].split('_')[0])
                    li_req = li[:req_index]
                else:
                    req_index = li.index(hist_xaxis[0].split('_')[0])
                    li_req = li[0]
                if len(hist_xaxis)!= 2:
                    req_str = '(' + li_req[0] + '-' + li_req[-1] + ')'
                    hist_xaxis[0] = hist_xaxis[0] + req_str
                    
            if '"T"' in [x['key'] for x in filters]:
                tgt_xaxis.extend(
                    ['_'.join(x['title'].split('_')[:2]) for x in tgt_growth_details if 'tgt' in x['title'].lower()])
                if li:
                    if len(tgt_xaxis)!= 2:
                        req_index = li.index(tgt_xaxis[1].split('_')[0])
                        li = li[:req_index]
                    else:
                        req_index = li.index(tgt_xaxis[0].split('_')[0])
                        li_req = li[0]
                    if len(tgt_xaxis)!= 2:
                        req_str = '(' + li[0] + '-' + li[-1] + ')'
                        tgt_xaxis[0] = tgt_xaxis[0] + req_str
                # tgt_xaxis.extend(['_'.join(x['title'].split('_')[:2]) if '_' in x['title'] and 'tgt' in x['title'].lower() else x['title'].split()[0] if 'tgt' in x['title'].lower()
                #               else x for x in growth_details if isinstance(x, dict) and 'title' in x])
            # xAxis.extend(['YTD'])
            if len(tgt_xaxis) > 0:
                return {"status": True, "message": "Success",
                        "data": {'data': final_resp, 'hist_growth_details': hist_growth_details,
                                 'tgt_growth_details': tgt_growth_details, 'hist_xaxis': hist_xaxis,
                                 'tgt_xaxis': tgt_xaxis, 'level': sorted_level,
                                 'month_name': month_keys, 'sales_unit': measure_unit}}
            else:
                return {"status": True, "message": "Success",
                        "data": {'data': final_resp, 'hist_growth_details': hist_growth_details,
                                 'hist_xaxis': hist_xaxis, 'level': sorted_level,
                                 'month_name': month_keys, 'sales_unit': measure_unit}}

        # print("final_resp", final_resp)
        if isinstance(final_resp, dict):
            if all(not v for v in final_resp.values()):
                return {"status": False, "message": "No Data Present for the current selection",
                        "data": {'data': final_resp, 'level': sorted_level,
                                 'month_name': month_keys, 'sales_unit': measure_unit}}
            else:
                # print("final_resp is not empty")
                # print("cross_filters", cross_filters)
                '''
                if len(cross_filters) >= 1:
                        if list(set([x['key'] for x in cross_filters]))[0].strip('"') == 'SBU_Name':
                            condition = cross_filters[0]
                            if condition['key'].strip('"') == 'SBU_Name':
                                sbu_name = condition['value']
                                if sbu_name in productOrders:
                                    sort_order = productOrders[sbu_name]
                                    
                                    # Get the product name map
                                    product_name_dict = final_resp.get("ProductName", {})
                                    
                                    # Build a list of indices sorted based on product order
                                    sorted_items = sorted(
                                        product_name_dict.items(),
                                        key=lambda x: sort_order.index(x[1]) if x[1] in sort_order else float("inf")
                                    )
                                    sorted_indices = [idx for idx, _ in sorted_items]

                                    # Reorder all columns in final_resp based on sorted indices
                                    sorted_final_resp = {}
                                    for col, col_data in final_resp.items():
                                        if isinstance(col_data, dict):
                                            sorted_final_resp[col] = {
                                                new_idx: col_data[old_idx]
                                                for new_idx, old_idx in enumerate(sorted_indices)
                                                if old_idx in col_data
                                            }
                                        else:
                                            sorted_final_resp[col] = col_data  # Keep as is if not a dict (e.g., string, list)

                                    final_resp = sorted_final_resp

                '''
                if len(cross_filters) == 1 or len(cross_filters) > 1:
                    # print("insied 1st if")
                    # print("cross_filters", cross_filters)
                    if list(set([x['key'] for x in cross_filters]))[0].strip('"') == 'SBU_Name' and cross_filters[0][
                        'value'] != '' and resp_format != 'stacked':
                        # print("insied 2nd if")
                        if len(cross_filters) ==1 and cross_filters[0]['key'].strip('"') != 'month_name':
                            condition = cross_filters[0]
                        if len(cross_filters)>1 and cross_filters[1]['key'].strip('"') != 'month_name':
                            condition = cross_filters[1]
                        if condition['key'].strip('"') == 'SBU_Name':
                            '''
                            removing the PETCHEM and Misc from LPG
                            '''
                            if condition['value'] == 'I&C':
                                if final_resp.get('ProductName',{}):
                                    # Define values to exclude
                                    
                                    exclude_values = ['PETCHEM', 'Miscellaneous/Minor']

                                    # Find indices to keep
                                    indices_to_keep = [k for k, v in final_resp['ProductName'].items() if v not in exclude_values]

                                    # Filter the dictionary
                                    final_resp = {
                                        key: {i: val for i, val in value.items() if i in indices_to_keep}
                                        for key, value in final_resp.items()
                                    }


                                
                                    #if 'PETCHEM' or 'Miscellaneous/Minor' in final_resp['ProductName'].values():
                                                                            
                            if '"ProductName"' in group_by_filter and condition['value'] in productOrders:
                                sort_order = productOrders[condition['value']]
                                all_products = AllProducts.get(condition['value'], sort_order)
                                # if keys not exist in resp, creating empty dict
                                if 'ProductName' not in final_resp:
                                    final_resp['ProductName'] = {}
                                    for key_ in ['ACTUAL_TMT_SALES', 'ACTUAL_HISTORY_TMT_SALES', 'cumulative']:
                                        if key_ not in final_resp:
                                            final_resp[key_] = {}
                                # Adding missing products
                                for key in all_products:
                                    if key not in list(final_resp.get('ProductName', {}).values()):
                                        order_num = list(final_resp['ProductName'].keys())
                                        order_num.sort()
                                        order_num = order_num[-1] + 1
                                        final_resp['ProductName'][order_num] = key
                                        for key_ in final_resp:
                                            if key_ != 'ProductName':
                                                final_resp[key_][order_num] = 0
                                # Removing unnecessary products
                                cleanup_products = ['LPG CYLINDER ACCESSORIES','LPG CYLINDER REGULATOR','Miscellaneous/Minor']
                                for order_num in list(final_resp['ProductName'].keys()):
                                    if final_resp['ProductName'][order_num] in cleanup_products:
                                        for key_ in final_resp:
                                            if order_num in final_resp[key_]:
                                                del final_resp[key_][order_num]

                                # Sorting data
                                # print("final_resp", final_resp)
                                df = pd.DataFrame(final_resp)
                                
                                sbu_name = next((x['value'].strip('"') for x in filters if x['key'].strip('"') == 'SBU_Name'), None)

                                if sbu_name == "Retail":
                                    
                                    

                                        df['ProductName'] = df['ProductName'].str.strip()

                                        df.loc[df['ProductName'].isin(Finished_Lubes_Retail), 'ProductName'] = 'Finished_Lubes_Retail'
                                        df.loc[df['ProductName'].isin(Finished_Lubes_Distributor), 'ProductName'] = 'Finished_Lubes_Distributor'

                                elif sbu_name == "Lubes":
                                        

                                        df['ProductName'] = df['ProductName'].str.strip()

                                        df.loc[df['ProductName'].isin(Finished_Lubes_Consumer), 'ProductName'] = 'Finished_Lubes_Consumer'
                                        df.loc[df['ProductName'].isin(Finished_Lubes), 'ProductName'] = 'Finished_Lubes'

                                        # Ensure numeric conversion
                                df['ACTUAL_TMT_SALES'] = df['ACTUAL_TMT_SALES'].fillna(0).astype(float)
                                df['ACTUAL_HISTORY_TMT_SALES'] = df['ACTUAL_HISTORY_TMT_SALES'].fillna(0).astype(float)
                                # Group and aggregate
                                grouped_df = df.groupby('ProductName', as_index=False).agg({
                                    'ACTUAL_TMT_SALES': 'sum',
                                    'ACTUAL_HISTORY_TMT_SALES': 'sum',
                                    "TARGET_TMT_SALES": 'sum',
                                    'cumulative': lambda x: ''  # customize if needed
                                })

                                df = grouped_df
                                        
                                        
                                if 'ProductName' in df.columns.tolist():
                                    
                                    #remove empty products if any are present in the product list
                                    df = df[df['ProductName'].fillna('0') != '0']
                                    '''
                                    finsihed_lubes = ['Industrial Greases','Automotive Greases','Automotive Specialities','Compressed Bio Gas','Industrial oils',
                                    'Automotive Oils','Industrial Specialities']
                                    
                                    '''
                                    df['sort_key'] = df['ProductName'].apply(
                                        lambda x: sort_order.index(x) if x in sort_order else float('inf'))
                                    df_sorted = df.sort_values(by='sort_key').drop(columns='sort_key').reset_index(
                                        drop=True)
                                    df_sorted = df_sorted.fillna('')
                                    final_resp = {col: df_sorted[col].to_dict() for col in df_sorted.columns}
                                    print("type pf final_resp to check",final_resp)
                                    print("filters",filters)
                                    print("cross_filters",cross_filters)
                                    #if 'SBU_Name' in [x['key'].strip('"') for x in filters] and "Retail" in [x['value'].strip('"') for x in filters if x['key'.strip('"') == 'SBU_Name']]:            
                                        
        if isinstance(final_resp,list):
            if len(final_resp) == 0:
                return {"status": False, "message": "Data Not Present for the current selection", "data": {'data': final_resp, 'level': sorted_level,
                                                                'month_name': month_keys, 'sales_unit': measure_unit}}    
            else:
                return {"status": True, "message": "Success", "data": {'data': final_resp, 'level': sorted_level,
                                                                'month_name': month_keys, 'sales_unit': measure_unit}}    
        return {"status": True, "message": "Success", "data": {'data': final_resp, 'level': sorted_level,
                                                               'month_name': month_keys, 'sales_unit': measure_unit}}
    else:
        if resp_format:
            final_resp, hist_growth_details, tgt_growth_details = generate_stacked_data(drill_state, merged_df,
                                                                                        resp_format,
                                                                                        month_column='month_name')
        else:
            final_resp = {key: value.to_dict() for key, value in merged_df.to_dict(orient='series').items()}
        measure_unit = 'TMT'
        # if 'Zone_Name' in [x['key'] for x in cross_filters] or 'Region_Name' in [x['key'] for x in cross_filters] or 'SalesArea_Name' in [x['key'] for x in cross_filters]:
        #    measure_unit = 'MT'
        # if sbuName_req =="GAS" :
        #    measure_unit = 'MT'
        if 'cumulative' not in final_resp:
            final_resp['cumulative'] = {}
        if isinstance(final_resp, dict) and len(final_resp.get('ACTUAL_TMT_SALES', [])) == 1 and not drill_state:
            # if '"sbu_wise"' in [x['key'] for x in cross_filters] or 'sbu_wise' in [x['key'] for x in cross_filters]:
            # if resp_format == 'sbu_wise':
            if sbuWise:
                final_resp['cumulative']["0"] = sbuName_req.upper() + '_CUMMULATIVE_SALES'
            else:
                final_resp['cumulative']["0"] = 'CUMMULATIVE_SALES'
        else:
            if isinstance(final_resp, dict):
                for each_key in final_resp.get('ACTUAL_TMT_SALES', []):
                    if 'cumulative' not in final_resp:
                        final_resp['cumulative'] = {}
                    final_resp['cumulative'][each_key] = ''
        if all(not v for v in final_resp.values()):
            return {"status": False, "message": "No Data Present for the current selection",
                    "data": {'data': final_resp, 'level': {}, 'sales_unit': measure_unit}}
        if isinstance(final_resp, dict):
            if len(final_resp) == 0:
                return {"status": False, "message": "No Data Present for the current selection",
                "data": {'data': final_resp, 'level': {}, 'sales_unit': measure_unit}}
                
        return {"status": True, "message": "Success",
                "data": {'data': final_resp, 'level': {}, 'sales_unit': measure_unit}}
def generate_stacked_data(drill_state, df, resp_format='', month_column=''):
    hist_growth_details = []
    tgt_growth_details = []
    columns = df.columns.to_list()
    numeric_cols = [col for col in columns if col in list(MandateKeys.values())]
    if month_column:
        df[month_column] = pd.Categorical(df[month_column], categories=months, ordered=True)
        for column in numeric_cols:
            df[column].fillna(0, inplace=True)
        other_columns = list(set(columns) - set(numeric_cols + [month_column]))
    else:
        other_columns = list(set(columns) - set(numeric_cols))
    if other_columns:
        # For Non-Stacked for data table to display month wise AHT data
        if not resp_format:
            # Renaming columns to lower case
            df.rename(columns={value: key for key, value in MandateKeys.items() if value in numeric_cols}, inplace=True)

            # Actual numeric columns
            numeric_cols = [key for key, value in MandateKeys.items() if value in numeric_cols]

            # Pivot Data - Creating separate columns for Actual, History, and Target
            df_pivot = df.pivot(index=other_columns[0], columns=month_column, values=numeric_cols)

            # Flatten MultiIndex Columns and rename them
            df_pivot.columns = [f"{month}_{metric.split('_')[0]}" for metric, month in df_pivot.columns]

            # Reset Index to include 'Zone_Name'
            df_pivot.reset_index(inplace=True)

            # Keeping all nan's as zero's
            df_pivot.fillna(0, inplace=True)

            # Convert to Dictionary Format
            return df_pivot.to_dict(orient="records"), hist_growth_details, tgt_growth_details
        elif resp_format == 'stacked' and month_column:
            # For sending data in stacked format
            # Renaming columns to lower case
            df.rename(columns={value: key for key, value in MandateKeys.items() if value in numeric_cols}, inplace=True)

            # Actual numeric columns
            numeric_cols = [key for key, value in MandateKeys.items() if value in numeric_cols]

            # Extract unique months from the dataset
            unique_months = sorted(df[month_column].unique(), key=lambda x: months.index(x))
            series_data = []
            for zone in df[other_columns[0]].unique():
                zone_data = df[df[other_columns[0]] == zone].set_index(month_column)
                # print("zone_data", zone_data.dtypes)
                for col in zone_data.columns:
                    if zone_data[col].dtype == 'int64' or zone_data[col].dtype == 'np.int64':
                        zone_data[col] = zone_data[col].astype(object)
                for column in numeric_cols:
                    # Creating series data
                    series_data.append({"name": f"{zone} {column.title()}", "stack": column.title(),
                                        "data": [zone_data.loc[m, column] if m in zone_data.index else 0
                                                 for m in unique_months]})
            return {"months": unique_months, "series": series_data}, hist_growth_details, tgt_growth_details
        elif resp_format == 'heat_map' and month_column:
            # making Cumulative sum of data for n-3
            present_month = datetime.datetime.now().strftime('%b')
            if present_month.lower() == 'apr':
                present_month = 'Apr'
            
            # Filtering cumulative_months
            cumulative_months = []
            if months.index(present_month) > 2:
                print("months",months.index(present_month))
                cumulative_months = months[0:months.index(present_month)+1]
                non_cumulative_months = [cumulative_months[-1]] 
                cumulative_months = cumulative_months[:-1]
                print("cumulative_months--->", cumulative_months)
            else:
                cumulative_months = ['Apr']
                non_cumulative_months = ['Apr']
            # Summing data for cumulative data
            sum_cols = []
            for col in df.columns.tolist():
                # if df[col].dtype in ['float','np.float64','float64','int','int64','np.int64']:
                if 'SALES' in col:
                    df[col] = df[col].fillna(0).astype(float)
                    sum_cols.append(col)
            cumulative_data = {}
            non_cumulative_data = pd.DataFrame()
            if drill_state.strip('"') == 'SBU_Name':
                # cumulative_data = df[df['month_name'].isin(cumulative_months)].groupby('Zone_Name', as_index=False)[sum_cols].sum()
                if resp_format == "heat_map":
                    cumulative_data = df[df['month_name'].isin(cumulative_months)].groupby(['Zone_Name'], as_index=False)[
                        sum_cols].sum()
                    #.reset_index(drop=True)
                    
                    print("cummu columns",cumulative_data.columns)
                    if non_cumulative_months:
                        non_cumulative_data = df[df['month_name'].isin(non_cumulative_months)]
                    sample = df[df['month_name'].isin(cumulative_months)]
                    sample.to_csv('/tmp/sample.csv',index = False)
                    print("came here in sbu_name heatmap")
                    print("cumulative_months",cumulative_months)
                    print("cumulative_data",cumulative_data)
                    cumulative_data.to_csv('/tmp/cumulative_data.csv',index = False)
                else:
                    cumulative_data = \
                    df[df['month_name'].isin(cumulative_months)].groupby('ProductName', as_index=False)[sum_cols].sum()
            if drill_state.strip('"') == 'Zone_Name':
                # cumulative_data = df[df['month_name'].isin(cumulative_months)].groupby('Region_Name', as_index=False)[sum_cols].sum()
                cumulative_data = df[df['month_name'].isin(cumulative_months)].groupby('Region_Name', as_index=False)[
                    sum_cols].sum()
            if drill_state.strip('"') == 'Region_Name':
                cumulative_data = \
                df[df['month_name'].isin(cumulative_months)].groupby('SalesArea_Name', as_index=False)[sum_cols].sum()
            if len(cumulative_months) ==1 and cumulative_months[0] != 'Apr':
                cumulative_data['month_name'] = 'Cum'
                if non_cumulative_data:
                    non_cumulative_data = df[~df['month_name'].isin(cumulative_months)]
            else:
                #if len(cumulative_data['month_name'].unique().tolist()) != 1:
                    cumulative_data['month_name'] = 'Apr-Jun'
            
            print("cummulative_data",cumulative_data)
            print("non cumu data",non_cumulative_data)
            df = pd.concat([cumulative_data, non_cumulative_data])
            # making zonal summary above the exisiting heatmap
            if "month_name" in df.columns.tolist():
                # df['YTD_TMT_SALES'] =  df['ACTUAL_TMT_SALES'] +df['ACTUAL_HISTORY_TMT_SALES']
                # numeric_cols.append('YTD_TMT_SALES')
                df_cum = df_prev = df_pres = pd.DataFrame()
                curr_value = prev_value = tgt_value = cum_growth = tgt_growth = 0
                df_list = []
                for i in df['month_name'].unique().tolist():
                    df_cum = df[df['month_name'] == 'Cum']
                    if len(df['month_name'].unique().tolist()) > 1:
                        #df_prev = df[df['month_name'] == df['month_name'].unique().tolist()[1]]
                        df_prev = df[df['month_name'].isin(df['month_name'].unique().tolist()[:-1])]
                    if len(df["month_name"].unique().tolist()) >= 3:
                        df_pres = df[df['month_name'] == df['month_name'].unique().tolist()[-1]]
                    # df_prev = df[df['month_name'] == df['month_name'].unique().tolist()[1]]
                    # df_pres = df[df['month_name'] == df['month_name'].unique().tolist()[-1]]
                if len(df['month_name'].unique().tolist()) ==1 and df['month_name'].unique().tolist()[0] =='Apr':
                    df_pres = df
                if not df_cum.empty and not df_prev.empty and not df_pres.empty:
                    df_list = [df_cum, df_prev, df_pres]
                if df_cum.empty and df_prev.empty and not df_pres.empty:
                    df_list = [df_pres]
                for idx, df_month in enumerate(df_list):
                    if 'ACTUAL_TMT_SALES' in df_month.columns.tolist():
                        df_month['ACTUAL_TMT_SALES'] = df_month['ACTUAL_TMT_SALES'].fillna(0).astype(float)
                        curr_value = df_month['ACTUAL_TMT_SALES'].sum()
                    if 'ACTUAL_HISTORY_TMT_SALES' in df_month.columns.tolist():
                        df_month['ACTUAL_HISTORY_TMT_SALES'] = df_month['ACTUAL_HISTORY_TMT_SALES'].fillna(0).astype(
                            float)
                        prev_value = df_month['ACTUAL_HISTORY_TMT_SALES'].sum()
                    if 'TARGET_TMT_SALES' in df_month.columns.tolist():
                        df_month['TARGET_TMT_SALES'] = df_month['TARGET_TMT_SALES'].fillna(0).astype(float)
                        tgt_value = df_month['TARGET_TMT_SALES'].sum()
                    if curr_value or prev_value:
                        if prev_value != 0:
                            cum_growth = ((curr_value - prev_value) / prev_value) * 100
                        if prev_value == 0:
                            cum_growth = 100
                        if 'TARGET_TMT_SALES' in df_month.columns.tolist():
                            if tgt_value != 0:
                                tgt_growth = ((curr_value - tgt_value) / tgt_value) * 100
                            else:
                                tgt_growth = 100

                        if idx == 0:
                            if len(df_list) !=1 :
                                hist_growth_details.append({"title": "Cum_Hist_Growth", "value": cum_growth})
                                if 'TARGET_TMT_SALES' in df_month.columns.tolist():
                                    tgt_growth_details.append({"title": "Cum_Tgt_Growth", "value": tgt_growth}) 
                            if len(df_list) ==1:
                                hist_growth_details.append({"title": "Apr_Hist_Growth", "value": cum_growth})
                                if 'TARGET_TMT_SALES' in df_month.columns.tolist():
                                    tgt_growth_details.append({"title": "Apr_Tgt_Growth", "value": tgt_growth}) 
                                
                        if idx == 1:
                            hist_growth_details.append(
                                {"title": f"{df['month_name'].unique().tolist()[1]}_Hist_Growth", "value": cum_growth})
                            if 'TARGET_TMT_SALES' in df_month.columns.tolist():
                                tgt_growth_details.append(
                                    {"title": f"{df['month_name'].unique().tolist()[1]}_Tgt_Growth",
                                     "value": tgt_growth})
                        if idx == 2:
                            hist_growth_details.append(
                                {"title": f"{df['month_name'].unique().tolist()[-1]}_Hist_Growth", "value": cum_growth})
                            if 'TARGET_TMT_SALES' in df_month.columns.tolist():
                                tgt_growth_details.append(
                                    {"title": f"{df['month_name'].unique().tolist()[-1]}_Tgt_Growth",
                                     "value": tgt_growth})

            # Renaming columns to lower case
            df.rename(columns={value: key for key, value in MandateKeys.items() if value in numeric_cols}, inplace=True)
            # Actual numeric columns
            numeric_cols = [key for key, value in MandateKeys.items() if value in numeric_cols]
            # Pivot Data - Creating separate columns for Actual, History, and Target
            df_pivot = df.pivot(index=other_columns[0], columns=month_column, values=numeric_cols)
            # Flatten MultiIndex Columns and rename them
            # df_pivot.columns = [f"{month}{metric.split('')[0]}" for metric, month in df_pivot.columns]
            df_pivot.columns = [f"{month}_{metric.split(',')[0]}" for metric, month in df_pivot.columns]
            # Reset Index to include 'Zone_Name'
            df_pivot.reset_index(inplace=True)
            # Keeping all nan's as zero's
            df_pivot.fillna(0, inplace=True)
            df_pivot.to_csv('/tmp/df_pivot.csv', index=False)
            df_pivot["YTD_actual"] = df_pivot.filter(like="_actual").sum(axis=1)
            df_pivot["YTD_history"] = df_pivot.filter(like="_history").sum(axis=1)
            df_pivot["YTD_target"] = df_pivot.filter(like="_target").sum(axis=1)
            df_pivot.to_csv('/tmp/df_pivot.csv', index=False)
            # df_pivot["YTD"] = df_pivot.select_dtypes(include="number").sum(axis=1)
            if 'YTD_actual' in df_pivot.columns.tolist() or 'YTD_history' in df_pivot.columns.tolist():
                if df_pivot['YTD_history'].sum() != 0:
                    ytd_hist_growth = ((df_pivot['YTD_actual'].sum() - df_pivot['YTD_history'].sum()) / df_pivot[
                        'YTD_history'].sum()) * 100
                elif df_pivot['YTD_history'].sum() == 0:
                    ytd_hist_growth = 100
                elif df_pivot['YTD_actual'].sum() == 0:
                    ytd_hist_growth = -100
                if 'YTD_target' in df_pivot.columns.tolist():
                    if df_pivot['YTD_target'].sum() != 0:
                        ytd_tgt_growth = ((df_pivot['YTD_actual'].sum() - df_pivot['YTD_target'].sum()) / df_pivot[
                            'YTD_target'].sum()) * 100
                    elif df_pivot['YTD_target'].sum() == 0:
                        ytd_tgt_growth = 100
                    elif df_pivot['YTD_actual'].sum() == 0:
                        ytd_tgt_growth = -100

                hist_growth_details.append({"title": "YTD_Hist_Growth", "value": ytd_hist_growth})
                if 'YTD_target' in df_pivot.columns.tolist():
                    tgt_growth_details.append({"title": "YTD_Tgt_Growth", "value": ytd_tgt_growth})
                    # Convert to Dictionary Format
            return df_pivot.to_dict(orient="records"), hist_growth_details, tgt_growth_details
        elif resp_format == 'cummulative' and month_column:
            df.iloc[:, 1:] = df.iloc[:, 1:].cumsum()
            return {key: value.to_dict() for key, value in
                    df.to_dict(orient='series').items()}, hist_growth_details, tgt_growth_details
        elif resp_format == 'grouped':
            # For Grouped data
            # Converting data to month wise report
            return [{"month_name": month, **{key: group[key].tolist() for key in numeric_cols + other_columns}}
                    for month, group in df.groupby("month_name")], hist_growth_details, tgt_growth_details
    else:
        if resp_format == 'cummulative' and month_column:
            df.iloc[:, 1:] = df.iloc[:, 1:].cumsum()

        # For regular drill down widgets
        return {key: value.to_dict() for key, value in
                df.to_dict(orient='series').items()}, hist_growth_details, tgt_growth_details



async def get_top_and_bottom_3_zones_by_year_sbu(merged_df, filters, cross_filters, drill_state="", time_grain="", resp_format=""):
    try:
        import pandas as pd

        def get_filter_value(filters, field_name):
            if isinstance(filters, list):
                return next(
                    (f.get("value") for f in filters if f.get("field") == field_name or f.get("key") == field_name),
                    None
                )
            elif isinstance(filters, dict):
                return filters.get(field_name)
            return None

        df = pd.DataFrame(merged_df)
        print("DF", df)

        # Extract SBU from filters (handles both 'sbu' and 'SBU_Name')
        sbu_filter = get_filter_value(filters, "sbu") or get_filter_value(filters, "SBU_Name")
        print("Resolved SBU from filters:", sbu_filter)

        # Exclude unwanted SBUs
        if sbu_filter in ["I&C", "Lubes"]:
            return {
                "status": False,
                "message": "No Zone Data Present for the Current Selection",
                "data": {}
            }

        if "Zone_Name" in df.columns:
            # Exclude blank, empty, null or "-" zone names
            df = df[df["Zone_Name"].notna() & (df["Zone_Name"].str.strip() != "") & (df["Zone_Name"] != "-")]

            # Group and aggregate
            zone_sales = df.groupby(["Zone_Name"])["ACTUAL_TMT_SALES"].sum().reset_index()

            # Sort and get top/bottom 3
            top_3_zones = zone_sales.sort_values("ACTUAL_TMT_SALES", ascending=False).head(3)
            bottom_3_zones = zone_sales.sort_values("ACTUAL_TMT_SALES", ascending=True).head(3)

            # Prepare result
            top_3_zones_data = top_3_zones.to_dict(orient="records")
            bottom_3_zones_data = bottom_3_zones.to_dict(orient="records")

            fiscal_year = get_filter_value(filters, "fiscal_year")

            return {
                "status": True,
                "message": "Successfully retrieved top and bottom 3 zones",
                "data": {
                    "top_3_zones": top_3_zones_data,
                    "bottom_3_zones": bottom_3_zones_data,
                    "year": fiscal_year,
                    "sbu": sbu_filter
                }
            }
        else:
            return {
                "status": False,
                "message": "Zone_Name column not found in the data",
                "data": {}
            }

    except Exception as e:
        return {
            "status": False,
            "message": f"Error retrieving top and bottom 3 zones: {str(e)}",
            "data": {}
        }



async def get_top_and_bottom_7_regions_by_year_sbu(merged_df, filters, cross_filters, drill_state="", time_grain="", resp_format=""):
    try:
        import pandas as pd

        def get_filter_value(filters, field_name):
            if isinstance(filters, list):
                return next(
                    (f.get("value") for f in filters if f.get("field") == field_name or f.get("key") == field_name),
                    None
                )
            elif isinstance(filters, dict):
                return filters.get(field_name)
            return None

        df = pd.DataFrame(merged_df)
        print("DF", df)

        # Extract SBU from filters
        sbu_filter = get_filter_value(filters, "sbu") or get_filter_value(filters, "SBU_Name")
        print("Resolved SBU from filters:", sbu_filter)

        # Exclude unwanted SBUs
        if sbu_filter in ["I&C", "Lubes"]:
            num_top_bottom = 5  # Set to 5 if SBU is I&C or Lubes
        else:
            num_top_bottom = 7  # Set to 7 for all other cases

        # Check if Region_Name column exists in the DataFrame
        if "Region_Name" in df.columns:
            # Exclude blank, empty, null or "-" region names
            df = df[df["Region_Name"].notna() & (df["Region_Name"].str.strip() != "") & (df["Region_Name"] != "-")]

            # Group and aggregate
            region_sales = df.groupby(["Region_Name"])["ACTUAL_TMT_SALES"].sum().reset_index()

            # Sort and get top/bottom regions based on the number of regions specified
            top_region = region_sales.sort_values("ACTUAL_TMT_SALES", ascending=False).head(num_top_bottom)
            bottom_regions = region_sales.sort_values("ACTUAL_TMT_SALES", ascending=True).head(num_top_bottom)

            # Prepare result
            top_data = top_region.to_dict(orient="records")
            bottom_data = bottom_regions.to_dict(orient="records")

            fiscal_year = get_filter_value(filters, "fiscal_year")

            return {
                "status": True,
                "message": f"Successfully retrieved top and bottom {num_top_bottom} regions",
                "data": {
                    "top_region": top_data,
                    "bottom_regions": bottom_data,
                    "year": fiscal_year,
                    "sbu": sbu_filter
                }
            }

        else:
            return {
                "status": False,
                "message": "Region_Name column not found in the data",
                "data": {}
            }

    except Exception as e:
        return {
            "status": False,
            "message": f"Error retrieving top and bottom regions: {str(e)}",
            "data": {}
        }

      

async def get_top_and_bottom_10_sales_area_by_year_sbu(merged_df, filters, cross_filters, drill_state="", time_grain="", resp_format=""):
    
    try:
        import pandas as pd

        def get_filter_value(filters, field_name):
            if isinstance(filters, list):
                return next(
                    (f.get("value") for f in filters if f.get("field") == field_name or f.get("key") == field_name),
                    None
                )
            elif isinstance(filters, dict):
                return filters.get(field_name)
            return None

        df = pd.DataFrame(merged_df)
        print("DF", df)

        # Extract SBU from filters
        sbu_filter = get_filter_value(filters, "sbu") or get_filter_value(filters, "SBU_Name")
        print("Resolved SBU from filters:", sbu_filter)

        # Set number of top/bottom entries based on SBU
        if sbu_filter in ["I&C", "Lubes"]:
            num_top_bottom = 7
        else:
            num_top_bottom = 10

        if "SalesArea_Name" in df.columns:
            # Exclude blank, empty, null or "-" sales area names
            df = df[df["SalesArea_Name"].notna() & (df["SalesArea_Name"].str.strip() != "") & (df["SalesArea_Name"] != "-")]
            print("df columns",df.columns)
            # Group and aggregate
            sales_area_sales = df.groupby(["SalesArea_Name"])["ACTUAL_TMT_SALES"].sum().reset_index()

            # Sort and get top/bottom
            top_sales = sales_area_sales.sort_values("ACTUAL_TMT_SALES", ascending=False).head(num_top_bottom)
            bottom_sales_area = sales_area_sales.sort_values("ACTUAL_TMT_SALES", ascending=True).head(num_top_bottom)

            # Prepare result
            top_data = top_sales.to_dict(orient="records")
            bottom_data = bottom_sales_area.to_dict(orient="records")

            fiscal_year = get_filter_value(filters, "fiscal_year")

            return {
                "status": True,
                "message": f"Successfully retrieved top and bottom {num_top_bottom} sales areas",
                "data": {
                    "top_sales": top_data,
                    "bottom_sales_area": bottom_data,
                    "year": fiscal_year,
                    "sbu": sbu_filter
                }
            }

        else:
            return {
                "status": False,
                "message": "SalesArea_Name column not found in the data",
                "data": {}
            }

    except Exception as e:
        return {
            "status": False,
            "message": f"Error retrieving top and bottom sales areas: {str(e)}",
            "data": {}
        }
async def sbu_sales_fiscal(merged_df, filters, cross_filters, drill_state="", time_grain="", resp_format=""):
    """
    API to return SBU sales aggregated set-wise for a fiscal year,
    ignoring NULL or 0 SBU names.
    """
    data = pd.DataFrame(merged_df)
    print("DF", data)

    fiscal_year = data['fiscal_year'].iloc[0]
    try:
        start_year, end_year = map(int, fiscal_year.split("-"))
    except:
        return {"error": "Invalid fiscal_year format, use YYYY-YYYY"}

    results = []
    SETS = [
        ["Apr", "May", "Jun"],
        ["Jul", "Aug", "Sep"],
        ["Oct", "Nov", "Dec"],
        ["Jan", "Feb", "Mar"]
    ]

    for idx, months in enumerate(SETS):
        sql = """
            SELECT 
                "SBU_Name", 
                SUM("NETWEIGHT_TMT") as total_netweight
            FROM "MOM_DAY_LEVEL_DATA"
            WHERE "month_name" = ANY($1)
              AND "fiscal_year" = $2
            GROUP BY "SBU_Name"
            ORDER BY total_netweight DESC
        """
        rows = await conn.fetch(sql, months, fiscal_year)

        set_data = []
        for row in rows:
            sbu = row["SBU_Name"]
            if sbu is None or sbu.strip() == "" or sbu == "0":
                continue
            set_data.append({
                "sbu": sbu,
                "total_netweight": float(row["total_netweight"])
            })
        results.append({
            "months": months,
            "data": set_data
        })

    return results



# def filter_and_map_sales_area(results, excel_path, sheet_name):
#     import pandas as pd

#     # Convert your results list to DataFrame
#     results_df = pd.DataFrame(results)

#     # Load Excel data
#     mapping_df = pd.read_excel(excel_path, sheet_name=sheet_name)
#     print("mapping_df types",mapping_df.dtypes)
#     print("resuylt types",results_df.dtypes)
#     # Perform the join on 'icSalesArea' and 'IC Sales Area Name'
#     merged_df = results_df.merge(mapping_df, how='left', left_on='icSalesArea', right_on='IC Sales Area Name')

#     # Split into matched and unmatched
#     matched_df = merged_df[~merged_df['IC Sales Area code'].isna()].copy()
#     # unmatched_df = merged_df[merged_df['IC Sales Area code'].isna()].copy()

#     # Drop extra columns if needed
#     matched_df.drop(columns=['IC Sales Area Name'], inplace=True, errors='ignore')
#     # unmatched_df.drop(columns=['IC Sales Area Name'], inplace=True, errors='ignore')

#     return matched_df

def filter_and_map_sales_area(results, excel_path, sheet_name, second_excel_path, second_sheet_name,second_sheet_name_second):
    import pandas as pd

    # Helper to clean and normalize spaces
    def normalize_spaces(series):
        return series.astype(str).str.replace(r'\s+', ' ', regex=True).str.strip()

    # Step 1: Convert results to DataFrame
    results_df = pd.DataFrame(results)

    # Step 2: Load Excel 1 - Contains IC Sales Area Name and Code
    mapping_df = pd.read_excel(excel_path, sheet_name=sheet_name)

    # Step 3: Merge results with mapping file using 'icSalesArea'
    merged_df = results_df.merge(
        mapping_df,
        how='left',
        left_on='icSalesArea',
        right_on='IC Sales Area Name'
    )
    # Step 4: Filter matched rows only
    matched_df = merged_df.copy()
    #matched_df = merged_df[~merged_df['IC Sales Area code'].isna()].copy()
    #matched_df.drop(columns=['IC Sales Area Name'], inplace=True, errors='ignore')
    
    # Step 5: Load Excel 2 - Contains actual month-wise performance
    additional_df = pd.read_excel(second_excel_path, sheet_name=second_sheet_name, header=1)
    
    # print('additional_df', additional_df['IC Sales Area'].unique().tolist())
    # print("Second Excel Columns:", additional_df.columns.tolist())

    # Step 6: Normalize sales area names in both DataFrames
    #matched_df['icSalesArea'] = normalize_spaces(matched_df['icSalesArea'])
    #additional_df['IC Sales Area'] = normalize_spaces(additional_df['IC Sales Area'])
    matched_df['icSalesArea'] = matched_df['icSalesArea'].apply(
                lambda x: ' '.join(x.split()).upper() if x != x.upper() and '-' not in x else x.upper()
            )
    matched_df['icSalesArea']  = matched_df['icSalesArea'].str.strip()
    
    matched_df['icSalesArea'] = matched_df['icSalesArea'].apply(lambda x: ' '.join(x.split()) if '-' not in x else x)
    additional_df['IC Sales Area'] = additional_df['IC Sales Area'].str.strip()

    additional_df['IC Sales Area'] = additional_df['IC Sales Area'].fillna('').astype(str).apply(lambda x :x.replace('S/A','DS SA'))
    additional_df['IC Sales Area'] = additional_df['IC Sales Area'].str.upper()
    additional_df['IC Sales Area'] = additional_df['IC Sales Area'].apply(lambda x: ' '.join(x.split()) if '-' not in x else x)
    additional_df['IC Sales Area'] = additional_df['IC Sales Area'].replace({
    'BANGALORE DS SA': 'BANGALORE-1 DS SA',
    'TRIVANDRUM DS SA': 'ERNAKULAM-1 DS SA',
    'KOZHIKODE DS SA': 'ERNAKULAM-2 DS SA',
    })
    
    
   
    ic_sales_area_list = matched_df['icSalesArea'].tolist()
    ic_additional = additional_df['IC Sales Area'].tolist()
    
    ''' 
    # Step 7: Show unmatched sales area names (for debug)
    unmatched = matched_df[~matched_df['icSalesArea'].isin(additional_df['IC Sales Area'])]
    if not unmatched.empty:
        print(" Warning: Some 'icSalesArea' values not found in second Excel:")
        print(unmatched['icSalesArea'].unique())
    print(len(matched_df))
    print(len(additional_df))
    matched_df.to_csv('/tmp/matched_df.csv',index = False)
    '''
    # Step 8: Merge with performance data
    enriched_df = matched_df.merge(
        additional_df,
        how='left',
        left_on='icSalesArea',
        right_on='IC Sales Area',
        indicator  = True
        
    )
    print('additional_df--->', additional_df['IC Sales Area'].unique().tolist())
    master_data_df = pd.read_excel(second_excel_path, sheet_name=second_sheet_name_second)
    # print('matched_df--->', matched_df['IC Sales Area code ID'].unique().tolist())
    print('master_data_df--->', master_data_df['IC Sales Area code'].unique().tolist())
    master_data_df = master_data_df.drop_duplicates(subset=['IC Sales Area code'])
    

    # Step 9: Drop duplicate column
    #enriched_df.drop(columns=['IC Sales Area'], inplace=True, errors='ignore')
    # print("Final enriched_df full data:\n", enriched_df)
    # print('enriched_df', enriched_df['IC Sales Area'].unique().tolist())    

    enriched_df = enriched_df.merge(
        master_data_df,
        how='left',
        left_on='IC Sales Area code',              # SAP ID in enriched_df
        right_on='IC Sales Area code' # IC Sales Area code in Master Data
    )
    print('enriched_df--->', enriched_df['IC Sales Area code'].unique().tolist())
    if 'IC Sales Area code' in enriched_df.columns:
        enriched_df['IC Sales Area code'] = (
        enriched_df['IC Sales Area code']
        .replace(r'^\s*$', np.nan, regex=True)  # blank → NaN
        .replace(['nan', 'NaN'], np.nan)        # text nan → NaN
    )
        enriched_df['IC Sales Area code'] = (
        pd.to_numeric(enriched_df['IC Sales Area code'], errors='coerce')
        .fillna(0)
        .astype(int)
    )

    # areas_to_remove = [
    # 'I&C HQO',
    # 'DEHRADUN LPG SA',
    # 'CHENNAI MARINE DS SA',
    # 'NAVI MUMBAI CON-LUB'
    # ]

    # # Print sample values to verify matching
    # print(enriched_df['IC Sales Area'].unique())

    # # Apply filtering on 'icSalesArea' (or change to correct column)
    # enriched_df = enriched_df[~enriched_df['IC Sales Area'].isin(areas_to_remove)]


    enriched_df.to_csv('/tmp/heelo.csv',index = False)
    
    return enriched_df




async def top_ic(filters, cross_filters, drill_state, time_grain, resp_formatt):
    MONTH_DAY_RANGES = {
        "Apr": ("04", "30"),
        "May": ("05", "31"),
        "Jun": ("06", "30"),
        "Jul": ("07", "31"),
        "Aug": ("08", "31"),
        "Sep": ("09", "30"),
        "Oct": ("10", "31"),
        "Nov": ("11", "30"),
        "Dec": ("12", "31"),
        "Jan": ("01", "31"),
        "Feb": ("02", "28"),
        "Mar": ("03", "31"),
    }

    def get_cumulative_months(selected_month):
        months_order = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
        if selected_month not in months_order:
            return []
        end_index = months_order.index(selected_month)
        return months_order[: end_index + 1]

    print("MONTH_DAY_RANGES", MONTH_DAY_RANGES)

    def get_day_id_ranges(fy: str, selected_month: str, filters):
        fiscal_start, fiscal_end = fy.split("-")
        if selected_month:
            mon_code, end_day = MONTH_DAY_RANGES.get(selected_month, ("04", "30"))

            if selected_month in ["Jan", "Feb", "Mar"]:
                cur_year = fiscal_end
                hist_year = str(int(fiscal_end) - 1)
            else:
                cur_year = fiscal_start
                hist_year = str(int(fiscal_start) - 1)

            # current_start = f"{cur_year}{mon_code}01"
            # current_end = f"{cur_year}{mon_code}{end_day}"
            # hist_start = f"{hist_year}{mon_code}01"
            # hist_end = f"{hist_year}{mon_code}{end_day}"
            current_start = f"{cur_year}{mon_code}01"
            hist_start = f"{hist_year}{mon_code}01"
            today = datetime.datetime.today()
            yesterday = today - datetime.timedelta(days=1)

            # check if selected month is the CURRENT month
            if today.strftime("%b").upper() == selected_month.upper():
                # use yesterday for both current and historical
                current_end = yesterday.strftime("%Y%m%d")
                hist_end = yesterday.replace(year=int(hist_year)).strftime("%Y%m%d")
            else:
                # use month-end normally
                current_end = f"{cur_year}{mon_code}{end_day}"
                hist_end = f"{hist_year}{mon_code}{end_day}"
        else:
            today = datetime.datetime.today()
            yesterday = today - datetime.timedelta(days=1)
            current_start_dt = today.replace(day=1)
            current_end_dt = yesterday

            mon = today.month
            if mon >= 4:
                cur_year = fiscal_start
                hist_year = str(int(fiscal_start) - 1)
            else:
                cur_year = fiscal_end
                hist_year = str(int(fiscal_end) - 1)

            current_start = current_start_dt.strftime("%Y%m%d")
            current_end = current_end_dt.strftime("%Y%m%d")

            hist_start_dt = current_start_dt.replace(year=int(hist_year))
            hist_end_dt = current_end_dt.replace(year=int(hist_year))

            hist_start = hist_start_dt.strftime("%Y%m%d")
            hist_end = hist_end_dt.strftime("%Y%m%d")

        return current_start, current_end, hist_start, hist_end

    try:
        # print("came from day id ranges")
        print("filters", filters)

        # Safely get required_year and required_month or return error
        required_year = next((x['value'].strip('"') for x in filters if x['key'].strip('"') == 'fiscal_year'), None)
        required_month = next((x['value'].strip('"') for x in filters if x['key'].strip('"') == 'month_name'), None)

        if not required_year or not required_month:
            return False, "Missing required fiscal_year or month_name"

        cur_start, cur_end, hist_start, hist_end = get_day_id_ranges(required_year, required_month, filters)
        print("req_month", required_month)

        base_query = f"""
            SELECT
                "Zone_Name" AS Zone_Name,
                "Region_Name" AS Region_Name,
                "SalesArea_Name" AS SalesArea_Name,
                    SUM("NETWEIGHT_TMT")FILTER (
                        WHERE "DAY_ID" BETWEEN'{cur_start}' AND '{cur_end}'
                    )
                 AS cur_sales,
                SUM("NETWEIGHT_TMT") FILTER (
                        WHERE "DAY_ID" BETWEEN '{hist_start}' AND '{hist_end}'
                    )
                AS his_sales
            FROM public."MOM_DAY_LEVEL_DATA"
            WHERE "SBU_Name" = 'I&C'
            AND "Zone_Name" IS NOT NULL
            AND "Region_Name" IS NOT NULL
            AND "SalesArea_Name" IS NOT NULL
            
            """

        # Add filter conditions only if non-empty
        conditions = []
        # if 'Zone_Name' in [x['key'].strip('"') for x in filters]:
        #     req_zone = [x['value'].strip('"') for x in filters if x['key'].strip('"') == 'Zone_Name'][0]
        #     # if req_zone != "":
        #     if req_zone not in ["", "All"]:
        #         conditions.append(f'"Zone_Name" = \'{req_zone}\'')
        # if 'Region_Name' in [x['key'].strip('"') for x in filters]:
        #     req_region = [x['value'].strip('"') for x in filters if x['key'].strip('"') == 'Region_Name'][0]
        #     # if req_region != "":
        #     if req_region not in ["", "All"]:
        #         conditions.append(f'"Region_Name" = \'{req_region}\'')
        # if 'SalesArea_Name' in [x['key'].strip('"') for x in filters]:
        #     req_salesarea = [x['value'].strip('"') for x in filters if x['key'].strip('"') == 'SalesArea_Name'][0]
        #     # if req_salesarea != "":
        #     if req_salesarea not in ["", "All"]:
        #         conditions.append(f'"SalesArea_Name" = \'{req_salesarea}\'')
        for col in ['Zone_Name', 'Region_Name', 'SalesArea_Name']:
            for f in filters:
                key = f['key'].strip('"')
                cond = f.get('cond', '').lower()
                value = f.get('value', '').strip()

                if key == col:
                    if cond == 'in':
                        val_list = [v.strip() for v in value.split(',') if v not in ["", "All"]]
                        if val_list:
                            in_clause = ", ".join(f"'{v}'" for v in val_list)
                            conditions.append(f'"{col}" IN ({in_clause})')
                    elif cond == 'equals':
                        if value not in ["", "All"]:
                            conditions.append(f'"{col}" = \'{value}\'')



        if conditions:
            base_query += " AND " + " AND ".join(conditions)

        base_query += """
            GROUP BY Zone_Name, Region_Name, SalesArea_Name
            ORDER BY Zone_Name, Region_Name, SalesArea_Name
        """

        result = await urdhva_base.BasePostgresModel.get_aggr_data(base_query, limit=0, skip=0)
        data = result['data']
        # print("result", result)

        fiscal_year_str = f"FY {required_year}" if not required_year.startswith("FY") else required_year
        target_query = f"""
            SELECT
                "Zone_Name" AS Zone_Name,
                "Region_Name" AS Region_Name,
                "SalesArea_Name" AS SalesArea_Name,
                SUM("TARGET_QTY_TMT") AS target
            FROM public."M60_LEVEL_METADATA"
            WHERE "SBU_Name" = 'I&C'
              AND "FISCALYEAR" = '{fiscal_year_str}'
              AND "month_name" = '{required_month}'
              AND "Zone_Name" IS NOT NULL
              AND "Region_Name" IS NOT NULL
              AND "SalesArea_Name" IS NOT NULL
        """
        if conditions:
            target_query += " AND " + " AND ".join(conditions)

        target_query += """
            GROUP BY "Zone_Name", "Region_Name", "SalesArea_Name"
        """

        target_rows = await urdhva_base.BasePostgresModel.get_aggr_data(target_query, limit=0, skip=0)
        target_rows = target_rows['data']
        # print("target_rows", target_rows)

        target_dict = {
            (
                r.get("Zone_Name") or r.get("zone_name"),
                r.get("Region_Name") or r.get("region_name"),
                r.get("SalesArea_Name") or r.get("salesarea_name")
            ): float(r.get("target", 0))
            for r in target_rows
        }

        cumulative_months = get_cumulative_months(required_month)
        cumulative_ranges = [get_day_id_ranges(required_year, m, filters) for m in cumulative_months]

        cur_conditions = " ".join(
            [f"WHEN \"DAY_ID\" BETWEEN '{start}' AND '{end}' THEN \"NETWEIGHT_TMT\"" for start, end, _, _ in cumulative_ranges]
        )
        his_conditions = " ".join(
            [f"WHEN \"DAY_ID\" BETWEEN '{hist_start}' AND '{hist_end}' THEN \"NETWEIGHT_TMT\"" for _, _, hist_start, hist_end in cumulative_ranges]
        )

        cumulative_query = f"""
            SELECT
                "Zone_Name" AS Zone_Name,
                "Region_Name" AS Region_Name,
                "SalesArea_Name" AS SalesArea_Name,
                SUM(CASE {cur_conditions} ELSE 0 END) AS cum_cur_sales,
                SUM(CASE {his_conditions} ELSE 0 END) AS cum_his_sales
            FROM public."MOM_DAY_LEVEL_DATA"
            WHERE "SBU_Name" = 'I&C'
              AND "Zone_Name" IS NOT NULL
              AND "Region_Name" IS NOT NULL
              AND "SalesArea_Name" IS NOT NULL
        """
        if conditions:
            cumulative_query += " AND " + " AND ".join(conditions)

        cumulative_query += """
            GROUP BY Zone_Name, Region_Name, SalesArea_Name
            ORDER BY Zone_Name, Region_Name, SalesArea_Name
        """

        cumulative_result = await urdhva_base.BasePostgresModel.get_aggr_data(cumulative_query, limit=0, skip=0)
        cum_data = cumulative_result.get('data', [])

        cum_sales_dict = {
            (r.get("zone_name"), r.get("region_name"), r.get("salesarea_name")): {
                "cum_cur_sales": float(r.get("cum_cur_sales", 0)),
                "cum_his_sales": float(r.get("cum_his_sales", 0))
            }
            for r in cum_data
        }

        cumulative_target_dict = {}
        if cumulative_months:
            cumulative_target_query = f"""
                SELECT
                    "Zone_Name" AS Zone_Name,
                    "Region_Name" AS Region_Name,
                    "SalesArea_Name" AS SalesArea_Name,
                    SUM("TARGET_QTY_TMT") AS target
                FROM public."M60_LEVEL_METADATA"
                WHERE "SBU_Name" = 'I&C'
                  AND "FISCALYEAR" = '{fiscal_year_str}'
                  AND "month_name" IN ({','.join([f"'{m}'" for m in cumulative_months])})
                  AND "Zone_Name" IS NOT NULL
                  AND "Region_Name" IS NOT NULL
                  AND "SalesArea_Name" IS NOT NULL
            """
            if conditions:
                cumulative_target_query += " AND " + " AND ".join(conditions)

            cumulative_target_query += """
                GROUP BY "Zone_Name", "Region_Name", "SalesArea_Name"
            """

            cumulative_target_rows = await urdhva_base.BasePostgresModel.get_aggr_data(cumulative_target_query, limit=0, skip=0)
            cumulative_target_rows = cumulative_target_rows.get('data', [])

            cumulative_target_dict = {
                (
                    r.get("Zone_Name") or r.get("zone_name"),
                    r.get("Region_Name") or r.get("region_name"),
                    r.get("SalesArea_Name") or r.get("salesarea_name")
                ): float(r.get("target", 0))
                for r in cumulative_target_rows
            }

        results = []
        for idx, row in enumerate(data, start=1):
            z = row.get("zone_name")
            r = row.get("region_name")
            s = row.get("salesarea_name")
            n = row.get('Name_x','')
            cur_sales = float(row.get("cur_sales", 0) or 0)
            his_sales = float(row.get("his_sales", 0) or 0)
            target = target_dict.get((z, r, s), 0.0)
            

            cum_cur = cum_sales_dict.get((z, r, s), {}).get("cum_cur_sales", 0.0)
            cum_his = cum_sales_dict.get((z, r, s), {}).get("cum_his_sales", 0.0)
            monthly_diff_value = round(((cur_sales - his_sales) / his_sales) * 100, 2) if his_sales != 0 else None
            cum_target = cumulative_target_dict.get((z, r, s), 0.0)
            cur_sales = cur_sales * 1000
            his_sales = his_sales * 1000
            target_mt = target * 1000
            cum_cur_mt = cum_cur * 1000
            cum_his_mt = cum_his *1000
            cum_target_mt = cum_target *1000
        
            # print("cur_sales: ", cur_sales_mt, "his_sales: ", his_sales_mt, "target: ", target_mt, "cum_cur: ", cum_cur_mt, "cum_his: ", cum_his_mt, "cum_target: ", cum_target_mt)
            # print("cur_sales:----------- ", cur_sales, "his_sales:------------- ", his_sales, "target:--------------- ", target, "cum_cur: -----------", cum_cur, "cum_his:------- ", cum_his, "cum_target:---------- ", cum_target)


            monthly_diff_value = round(((cur_sales - his_sales) / his_sales) * 100, 2) if his_sales != 0 else None
            monthly_target_diff = round((cur_sales / target) * 100, 2) if target != 0 else None
            
            # monthly_diff_value = round(((cur_sales - his_sales) / his_sales) * 100, 2) if his_sales != 0 else None
            # monthly_target_diff = round((cur_sales / target_mt) * 100, 2) if target_mt != 0 else None
            
            # monthly_diff_value = min(round(((cur_sales - his_sales) / his_sales) * 100, 2), 100) if his_sales != 0 else None

            # monthly_target_diff = min(round((cur_sales / target_mt) * 100, 2), 100) if target_mt != 0 else None

            # cumulative_diff_value = min(round(((cum_cur_mt - cum_his_mt) / cum_his_mt) * 100, 2), 100) if cum_his_mt != 0 else None

            # cumulative_target_diff = min(round((cum_cur_mt / cum_target_mt) * 100, 2), 100) if cum_target_mt != 0 else None

            cumulative_diff_value = round(((cum_cur - cum_his) / cum_his) * 100, 2) if cum_his != 0 else None
            cumulative_target_diff = round((cum_cur / cum_target) * 100, 2) if cum_target != 0 else None
            # cumulative_diff_value = round(((cum_cur_mt - cum_his_mt) / cum_his_mt) * 100, 2) if cum_his_mt != 0 else None
            # cumulative_target_diff = round((cum_cur_mt / cum_target_mt) * 100, 2) if cum_target_mt != 0 else None
            results.append({
                "id": idx,
                "region": r,
                "icSalesArea": s,
                "SalesOfficer": n,
                "monthly": {
                    "cur": round(cur_sales, 2),
                    "his": round(his_sales, 2),
                    "target": round(target_mt, 2),
                    "diff_value": monthly_diff_value,
                    "target_achieved": monthly_target_diff,
                    "month_name": required_month
                },
                "cumulative": {
                    "cur": round(cum_cur_mt, 2),
                    "his": round(cum_his_mt, 2),
                    "cumulativeTarget": round(cum_target_mt, 2),
                    "diff_value": cumulative_diff_value,
                    "target_achieved": cumulative_target_diff
                }
            })
            
 
 
        # if results:
        #     print("results are here", results)
        #     print(f"Number of  records: {len(results)}")


        #     # Call your filter_and_map_sales_area function here
        #     excel_path = "/tmp/Data_names.xlsx"   # <-- put your real path here
        #     sheet_name = "Sheet1"                          # <-- your actual sheet name
            
        #     matched_df = filter_and_map_sales_area(results, excel_path, sheet_name)

        #     # If you want to return the filtered DataFrame as a dict or list of dicts, convert it:
        #     results = matched_df.to_dict(orient='records')
        #     for record in results:
        #         print(f"Number of  records: {len(results)}")
            
        #     # Return only matched records
        #     return True, results

        # else:
        #     return False, "No data for current selection"
        
        if results:
            print("results are here", results)
           

            # Excel path and sheet
            excel_path = "/home/novex/Data_names.xlsx"
            sheet_name = "Sheet1"
            
            # second_excel_path = "/home/novex/IC_SA_Perf_Monitor.xlsx"
            second_excel_path = "/home/novex/Copy_IC_SA.xlsx"
            second_sheet_name = "SA_Wise_Monthly_Targets"
            second_sheet_name_second = "Master Data"
            
            
            

            
            # Filter results using Excel mapping
            enriched_df = filter_and_map_sales_area(
                        results,
                        excel_path,
                        sheet_name,
                        second_excel_path,
                        second_sheet_name,
                        second_sheet_name_second
                    )

            # print("enriched df len",len(enriched_df))
            if enriched_df.empty:
                print("No data for current selection")
                return False, "No data for current selection"
            results = pd.DataFrame(results)
            results['icSalesArea'] = results['icSalesArea'].apply(lambda x: ' '.join(x.split()) if '-' not in x else x)
            results['icSalesArea'] = results['icSalesArea'].apply(
                lambda x: ' '.join(x.split()).upper() if x != x.upper() and '-' not in x else x.upper()
            )
            # results["icSalesArea"] = results["icSalesArea"].apply(
            #     lambda x: x if "DS SA" in x else f"{x} DS SA"
            # )
            # print("Filtered results length----->>>>:", len(results))
            # print('ic', results['icSalesArea'].unique().tolist())
          
            
            results = results.merge(enriched_df[['icSalesArea','Name_x']], how='left', left_on='icSalesArea', right_on='icSalesArea')
            results = results[results['Name_x'].notna()]

            print("results",results)
            # Your areas to remove
            areas_to_remove = [
                'I&C HQO',
                'DEHRADUN LPG SA',
                'CHENNAI MARINE DS SA',
                'NAVI MUMBAI CON-LUB',
                'LUBES HQO BASE OIL'
            ]

            # Normalize column to uppercase and strip spaces for reliable filtering
            results['icSalesArea'] = results['icSalesArea'].astype(str).str.strip().str.upper()
            print("areas_to_remove", areas_to_remove)
            areas_to_remove_upper = [x.upper() for x in areas_to_remove]
            print("areas_to_remove---------->", areas_to_remove)

            # Filter out unwanted sales areas from merged results
            results = results[~results['icSalesArea'].isin(areas_to_remove_upper)]

            
            # results = enriched_df
            if 'SalesOfficer' in results.columns:
                results['Officer'] = results['Name_x']
            # results = results[results['Name'].notna()]
            # print("results len",len(results))
            # results.to_csv('/Users/apple/Downloads/res_updated.csv',index = False)
            # print('results columns', results.columns)
            
            import ast
            #results["monthly"] = results["monthly"].apply(ast.literal_eval)
            results["month_name"] = results["monthly"].apply(lambda x: x.get("month_name", "").strip())
            results["month_column"] = results["month_name"].str.upper()
            # print("Converted month_column to uppercase:\n", results["month_column"].unique())
            
            monitor_df_clean = pd.read_excel('/home/novex/Copy_IC_SA.xlsx', sheet_name='SA_Wise_Monthly_Targets', skiprows=1)
            # print("Monitor sheet loaded:", monitor_df_clean.shape)
            monitor_df_clean["IC Sales Area"] = (
                monitor_df_clean["IC Sales Area"]
                .astype(str)
                .str.replace("S/A", "DS SA")
                .str.upper()
            )

            # Ensure results column is string too
            results["icSalesArea"] = results["icSalesArea"].astype(str)
            results["icSalesArea"] = results["icSalesArea"].astype(str).str.replace("S/A", "DS SA").str.upper().str.strip()
            # print("results---->",len(results))
            # print("Results DataFrame row count:", len(results))
            # print("Unique icSalesArea in results:\n", results["icSalesArea"].unique()[:5])


            def get_updated_month_value(row):
                monthly_data = row["monthly"].copy()
                area = row["icSalesArea"].strip().upper()
                month_col = row["month_column"]

                # match = monitor_df_clean[monitor_df_clean["IC Sales Area"] == area]
                match = enriched_df[enriched_df["icSalesArea"] == area]

                if not match.empty and month_col in match.columns:
                    try:
                        new_target = float(match.iloc[0][month_col])
                    except:
                        new_target = 0.0

                    monthly_data["target"] = new_target
                    cur = monthly_data.get("cur", 0.0)

                    if new_target != 0:
                        monthly_data["target_achieved"] = round((cur / new_target) * 100, 2)
                        # target_achieved = round((cur / new_target) * 100, 2)
                        # target_achieved = min(target_achieved, 100)  # Cap at 100%
                        # monthly_data["target_achieved"] = target_achieved

                    else:
                        monthly_data["target_achieved"] = None

                return monthly_data


            def get_updated_cumulative_value(row):
                cumulative_data = row["cumulative"].copy()
                area = row["icSalesArea"].strip().upper()
                selected_month = row["month_column"]

                # match = monitor_df_clean[monitor_df_clean["IC Sales Area"] == area]
                match = enriched_df[enriched_df["icSalesArea"] == area]

                if not match.empty:
                    month_order = ["APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR"]
                    if selected_month in month_order:
                        idx = month_order.index(selected_month)
                        cumulative_months = month_order[:idx + 1]

                        try:
                            new_cum_target = sum(
                                float(match.iloc[0][m]) if m in match.columns and pd.notnull(match.iloc[0][m]) else 0.0
                                for m in cumulative_months
                            )
                        except:
                            new_cum_target = 0.0

                        cumulative_data["cumulativeTarget"] = round(new_cum_target, 2)
                        cum_cur = cumulative_data.get("cur", 0.0)

                        if new_cum_target != 0:
                            cumulative_data["target_achieved"] = round((cum_cur / new_cum_target) * 100, 2)
                            # target_achieved = round((cum_cur / new_cum_target) * 100, 2)
                            # target_achieved = min(target_achieved, 100)
                            # cumulative_data["target_achieved"] = target_achieved
                        else:
                            cumulative_data["target_achieved"] = None

                return cumulative_data


            # Apply to results
            results["monthly"] = results.apply(get_updated_month_value, axis=1)
            results["cumulative"] = results.apply(get_updated_cumulative_value, axis=1)

        #print("cal completed")
        #results.to_csv('/tmp/results_updasted.csv', index=False)
        #enriched_df.to_csv('/tmp/enriched_df.csv', index=False)
        # Replace 'results' with only matched records
        #enriched_df = enriched_df.fillna('')
        #results = results.fillna('')
        #results = results.to_dict(orient='records')
        #print(f"Matched Records (final results): {len(results)}")
        #for r in results:
        #    print(r)
        #for idx, row in enumerate(results, start=1):
        #    row["id"] = idx

            
            # results["monthly_updated"] = results.apply(get_updated_month_value, axis=1)
            # results['monthly'] = results["monthly_updated"]
            # del results["monthly_updated"]
            #print("cal completed")
            #results.to_csv('/tmp/results_updasted.csv', index=False)
            #enriched_df.to_csv('/tmp/enriched_df.csv', index=False)
            # Replace 'results' with only matched records
            #enriched_df = enriched_df.fillna('')
            # print("dict conversion done")
            results = results.astype({col: str for col in results.select_dtypes(include='category').columns})
            results = results.fillna('')
            # results.to_csv('/Users/apple/Downloads/res_upd.csv', index=False) 
            results = results.to_dict(orient='records')
            
            print(f"Matched Records (final results): {len(results)}")
            #for r in results:
            #    print(r)
            for idx, row in enumerate(results, start=1):
                row["id"] = idx
            
            return True, results

        else:
            return False, "No data for current selection"

        

        
    except Exception as e:
        print("Error:", e)
        return False, str(e)
