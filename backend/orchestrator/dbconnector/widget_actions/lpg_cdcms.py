import urdhva_base
import calendar
import traceback
import polars as pl
pl.Config(set_fmt_float="full")
import numpy as np
import pandas as pd
import hpcl_ceg_model
import dashboard_studio_model
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
import utilities.connection_mapping as connection_mapping
from orchestrator.dbconnector.widget_actions import widget_actions
from api_manager.charts_actions import charts_connection_vault_routing
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams
import orchestrator.dbconnector.widget_actions.lpg_plant_queries as lpg_plant_queries

month_mapping = {
            "Jan": "January",
            "Feb": "February",
            "Mar": "March",
            "Apr": "April",
            "May": "May",
            "Jun": "June",
            "Jul": "July",
            "Aug": "August",
            "Sep": "September",
            "Oct": "October",
            "Nov": "November",
            "Dec": "December"
    }

async def filter_data(df, _filters):
        try:
            if _filters:
                mask = pd.Series(True, index=df.index)
                for _filter in _filters:
                    for key, value in _filter.items():
                        key = key.replace('"','')
                        mask = mask & (df[key].fillna('') == value)
                df = df[mask]
                return df
        except Exception as e:
            print("Exception in filtering data :", str(e))
        return df
    
async def get_financial_year():
    today = datetime.now()
    if today.month < 4:
        start_year = today.year - 1
    else:
        start_year = today.year
    end_year = start_year + 1
    financial_year = f"{start_year}-{end_year}"
    return financial_year

async def get_fy_list():
    today = datetime.now()
    financial_years = []
    if today.month >= 4:
        current_fy_start = today.year
    else:
        current_fy_start = today.year - 1
    for i in range(4):
        start_year = current_fy_start - i
        end_year = start_year + 1
        financial_year = f"{start_year}-{end_year}"
        financial_years.append(financial_year)
    return financial_years

# Tempory Commented
# async def days_since_financial_year_start():
#     today = date.today()
#     fy_start_year = today.year if today >= date(today.year, 4, 1) else today.year - 1
#     fy_start_date = date(fy_start_year, 4, 1)
#     days_elapsed = (today - fy_start_date).days
#     return days_elapsed

async def days_since_financial_year_start():
    today = date.today()
    if today.month == 4 and today.day < 10:
        today = today.replace(month=3, day=31)
    fy_start_year = today.year if today >= date(today.year, 4, 1) else today.year - 1
    fy_start_date = date(fy_start_year, 4, 1)
    days_elapsed = (today - fy_start_date).days
    return days_elapsed


class LPGCDCMSActions:        

    @staticmethod
    def get_next_level_drill_params(present_group):
        ...
    
    
    @staticmethod
    async def cdcms_dropdown(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)        
        _query = ''' select * from cdcms_masters '''
        access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
        _query =  await widget_actions.WidgetActions.apply_filter_drilldown(_query, access_filters, drill_state)
        resp = await function(query=_query)
        df = pl.from_pandas(pd.DataFrame(resp))
        _filters = []
        if filters:
            for filter in filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if _filters:
            filter_expr = pl.lit(True)
            for _filter in _filters:
                for key, value in _filter.items():
                    key = key.replace('"','')
                    if key in ["Month", "CylType", "ConsumerType", "Financial_Year"]:
                        continue
                    filter_expr = filter_expr & (pl.col(key).fill_null("") == value)
            df = df.filter(filter_expr)
        months = [month for month in calendar.month_name if month]
        df = df.filter(pl.col("ZOName").fill_null("") != "NULL")
        df = df.filter(pl.col("DistributorName").fill_null("") != "NULL")
        data = {"Month": months, "ZOName": df['ZOName'].unique().to_list(),
                "ROName": df['ROName'].unique().to_list(), "SAName": df['SAName'].unique().to_list(),
                "DistributorName": df["DistributorName"].unique().to_list(),
                "StateCode": df["StateCode"].unique().to_list(), "StateName": df["StateName"].unique().to_list(),
                "CylType": ['C142','C5'], "ConsumerType": ['PMUY', 'NPMUY'], "Financial_Year": await get_fy_list()}
        return data
    
    
    # Actual vs Historic Sales
    @staticmethod
    async def lpg_cdcms_actual_vs_historic_sales(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        lpg_cdcms_sales_comparision_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_actual_vs_historic_sales")
        today = datetime.now()
        if today.month < 4:
            start_year = today.year - 1
            prev_start_year = today.year - 2
        else:
            start_year = today.year
            prev_start_year = today.year - 1
        end_year = start_year + 1
        prev_end_year = prev_start_year + 1
        financial_year = f"{start_year}-{end_year}"
        prev_financial_year = f"{prev_start_year}-{prev_end_year}"
        
        _fy = None
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                if "financial_year" in f"{filter.key}":
                    _fy = f"{filter.value}"
                    continue
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if _fy:
            financial_year = _fy
        if filters:
            # filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
            #                           for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if rec.key == '"Month"':
                    rec.value = [month_mapping.get(val.strip(), val.strip()) for val in rec.value]
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                lpg_cdcms_sales_comparision_query_ += ' WHERE '
                lpg_cdcms_sales_comparision_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_sales_comparision_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_sales_comparision_query_, access_filters, drill_state)
            if _fy:
                start_year, end_year = _fy.split("-")
                prev_financial_year = f"{int(start_year) - 1}-{start_year}"
                lpg_cdcms_sales_comparision_query_ += f' AND "ZOName"  NOT IN (\'Null\') AND "Financial_Year" IN (\'{str(_fy)}\', \'{str(prev_financial_year)}\')'
            else:
                lpg_cdcms_sales_comparision_query_ += f' AND "ZOName"  NOT IN (\'Null\') AND "Financial_Year" IN (\'{str(financial_year)}\', \'{str(prev_financial_year)}\')'
            lpg_cdcms_sales_comparision_query_ += ' GROUP BY "Month", "Month_Number", "Quarter", "Financial_Year", "ZOName", "ROName", "SAName", "ConsumerType", "CylType", "DistributorName"'
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_sales_comparision_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_sales_comparision_query_, access_filters, drill_state)
            if "where" not in lpg_cdcms_sales_comparision_query_.lower() and not _fy:   
                lpg_cdcms_sales_comparision_query_ += f' WHERE "ZOName"  NOT IN (\'Null\') AND "Financial_Year" IN (\'{str(financial_year)}\', \'{str(prev_financial_year)}\')'
            elif "where" not in lpg_cdcms_sales_comparision_query_.lower() and _fy:
                start_year, end_year = _fy.split("-")
                prev_financial_year = f"{int(start_year) - 1}-{start_year}"
                lpg_cdcms_sales_comparision_query_ += f' WHERE "ZOName"  NOT IN (\'Null\') AND "Financial_Year" IN (\'{str(_fy)}\', \'{str(prev_financial_year)}\')'
            else:
                if _fy:
                    start_year, end_year = _fy.split("-")
                    prev_financial_year = f"{int(start_year) - 1}-{start_year}"
                    lpg_cdcms_sales_comparision_query_ += f' AND "ZOName"  NOT IN (\'Null\') AND "Financial_Year" IN (\'{str(_fy)}\', \'{str(prev_financial_year)}\')'
                else:
                    lpg_cdcms_sales_comparision_query_ += f' AND "ZOName"  NOT IN (\'Null\') AND "Financial_Year" IN (\'{str(financial_year)}\', \'{str(prev_financial_year)}\')'
            lpg_cdcms_sales_comparision_query_ += ' GROUP BY "Month", "Month_Number", "Quarter", "Financial_Year", "ZOName", "ROName", "SAName", "ConsumerType", "CylType", "DistributorName"'
            resp = await function(query=lpg_cdcms_sales_comparision_query_)
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)
            print("Length of resp :", len(resp))
            resp = await filter_data(resp, _filters)
            print("Length of after filter resp :", len(resp))
            
            if resp.empty:
                return {"status": True, "message": "success", "data": []}
            current_year = resp[resp['Financial_Year'] == financial_year].groupby('Quarter')['sales_volume'].sum().reset_index()
            previous_year = resp[resp['Financial_Year'] == prev_financial_year].groupby('Quarter')['sales_volume'].sum().reset_index()
            resp = pd.merge(current_year, previous_year, on='Quarter', how='outer', suffixes=('_current', '_previous'))
            
            final_data = []
            for _, row in resp.iterrows():
                comparison = {
                    "Quarter": row['Quarter'],
                    "Current_Year": financial_year,
                    "Previous_Year": prev_financial_year,
                    "Current_Sales": round(float(row['sales_volume_current'])/1000000) if pd.notnull(row['sales_volume_current']) else 0,
                    "Previous_Sale": round(float(row['sales_volume_previous'])/1000000) if pd.notnull(row['sales_volume_previous']) else 0
                }
                final_data.append(comparison)            
            return {"status": True, "message": "success", "data": final_data}
        # Execute the query
        resp = await function(query=lpg_cdcms_sales_comparision_query_)
        # Convert the response to a DataFrame for further processing
        resp = pd.DataFrame(resp)
        resp = await filter_data(resp, _filters)
        if filters:
            filter_keys = [rec.key.strip('"') for rec in filters]
            if "Quarter" in filter_keys and "Month" not in filter_keys:
                current_year = resp[resp['Financial_Year'] == financial_year].groupby('Month')['sales_volume'].sum().reset_index()
                previous_year = resp[resp['Financial_Year'] == prev_financial_year].groupby('Month')['sales_volume'].sum().reset_index()
                resp = pd.merge(current_year, previous_year, on='Month', how='outer', suffixes=('_current', '_previous'))
                
                final_data = []
                for _, row in resp.iterrows():
                    comparison = {
                        "Month": row['Month'][:3],
                        "Current_Year": financial_year,
                        "Previous_Year": prev_financial_year,
                        "Current_Sales": round(float(row['sales_volume_current'])/1000000, 2) if pd.notnull(row['sales_volume_current']) else 0,
                        "Previous_Sale": round(float(row['sales_volume_previous'])/1000000, 2) if pd.notnull(row['sales_volume_previous']) else 0
                    }
                    final_data.append(comparison)
                month_order = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
                final_data.sort(key=lambda x: month_order.index(x['Month']))
                return {"status": True, "message": "success", "data": final_data}
            
            elif "Month" in filter_keys and "ZOName" not in filter_keys:
                current_year = resp[resp['Financial_Year'] == financial_year].groupby(["Month", "ZOName"])['sales_volume'].sum().reset_index()
                previous_year = resp[resp['Financial_Year'] == prev_financial_year].groupby(["Month", "ZOName"])['sales_volume'].sum().reset_index()
                resp = pd.merge(current_year, previous_year, on=["Month", "ZOName"], how='outer', suffixes=('_current', '_previous'))
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                current_year = resp[resp['Financial_Year'] == financial_year].groupby(["Month", "ZOName", "ROName"])['sales_volume'].sum().reset_index()
                previous_year = resp[resp['Financial_Year'] == prev_financial_year].groupby(["Month", "ZOName", "ROName"])['sales_volume'].sum().reset_index()
                resp = pd.merge(current_year, previous_year, on=["Month", "ZOName", "ROName"], how='outer', suffixes=('_current', '_previous'))
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                current_year = resp[resp['Financial_Year'] == financial_year].groupby(["Month", "ZOName", "ROName","SAName"])['sales_volume'].sum().reset_index()
                previous_year = resp[resp['Financial_Year'] == prev_financial_year].groupby(["Month", "ZOName", "ROName","SAName"])['sales_volume'].sum().reset_index()
                resp = pd.merge(current_year, previous_year, on=["Month", "ZOName", "ROName", "SAName"], how='outer', suffixes=('_current', '_previous'))
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                current_year = resp[resp['Financial_Year'] == financial_year].groupby(["Month", "ZOName", "ROName","SAName","DistributorName"])['sales_volume'].sum().reset_index()
                previous_year = resp[resp['Financial_Year'] == prev_financial_year].groupby(["Month", "ZOName", "ROName","SAName","DistributorName"])['sales_volume'].sum().reset_index()
                resp = pd.merge(current_year, previous_year, on=["Month", "ZOName", "ROName", "SAName", "DistributorName"], how='outer', suffixes=('_current', '_previous'))
            final_data = []
            for _, row in resp.iterrows():
                comparison = {
                    "Month": row['Month'][:3],
                    "Current_Year": financial_year,
                    "Previous_Year": prev_financial_year,
                    "Current_Sales": round(float(row['sales_volume_current'])/1000000, 2) if pd.notnull(row['sales_volume_current']) else 0,
                    "Previous_Sale": round(float(row['sales_volume_previous'])/1000000, 2) if pd.notnull(row['sales_volume_previous']) else 0
                }
                if "ZOName" in row:
                    comparison.update({"ZOName": row["ZOName"]})
                if "ROName" in row.keys():
                    comparison.update({"ROName": row["ROName"]})
                if "SAName" in row.keys():
                    comparison.update({"SAName": row["SAName"]})
                if "DistributorName" in row.keys():
                    comparison.update({"DistributorName": row["DistributorName"]})
                final_data.append(comparison)
            month_order = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
            final_data.sort(key=lambda x: month_order.index(x['Month']))
            return {"status": True, "message": "success", "data": final_data}
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}

    
    # Monthly Sales    
    @staticmethod
    async def lpg_cdcms_monthly_sales(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        # Reverse mapping (for returning the short form)
        reverse_month_mapping = {v: k for k, v in month_mapping.items()}
        lpg_cdcms_month_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_monthly_sales")

        financial_year = await get_financial_year()
        
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if filters:
            filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if rec.key == '"Month"':
                    rec.value = [month_mapping.get(val.strip(), val.strip()) for val in rec.value]
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)

            if conditions:
                lpg_cdcms_month_query_ += ' WHERE '
                lpg_cdcms_month_query_ += ' AND '.join(conditions)
            lpg_cdcms_month_query_ += f' AND "ZOName"  NOT IN (\'Null\') AND "Financial_Year"=\'{str(financial_year)}\''
            lpg_cdcms_month_query_ += ' GROUP BY "Month_Number", "Month", "ZOName", "ROName", "SAName", "ConsumerType", "CylType", "DistributorName"'
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_month_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_month_query_, access_filters, drill_state)
            if "where" not in lpg_cdcms_month_query_.lower():   
                lpg_cdcms_month_query_ += f' WHERE "ZOName"  NOT IN (\'Null\') AND "Financial_Year"=\'{str(financial_year)}\''
            else:
                lpg_cdcms_month_query_ += f' AND "ZOName"  NOT IN (\'Null\') AND "Financial_Year"=\'{str(financial_year)}\''
            lpg_cdcms_month_query_ += ' GROUP BY "Month_Number", "Month", "ZOName", "ROName", "SAName", "ConsumerType", "CylType", "DistributorName"'
            resp = await function(query=lpg_cdcms_month_query_)
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)
            resp = await filter_data(resp, _filters)
            if resp.empty:
                return {"status": True, "message": "success", "data": resp}
            resp['Month_Number'] = resp['Month_Number'].astype(str)
            resp = resp.groupby(["Month", "Month_Number"], as_index=False).agg({
                    "Total Sales": "sum"
                })
            resp['Total Sales'] = resp['Total Sales']/1000000
            resp['Total Sales'] = resp['Total Sales'].round(2)
            
            resp['Month_Number'] = resp['Month_Number'].round(0)
            resp = resp.sort_values(by="Month_Number")
            del resp["Month_Number"]
            # Fill missing values for numerical columns
            for each_float_col in [
                "Total Sales"
            ]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)

            # Fill missing values for string columns
            for each_str_col in [
                "Month", "ZOName"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
            return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
                
        resp = await function(query=lpg_cdcms_month_query_)
        resp = pd.DataFrame(resp)
        resp = await filter_data(resp, _filters)
        
        for each_float_col in [
            "Total Sales"
        ]:
            if each_float_col in resp.columns:
                resp[each_float_col] = resp[each_float_col].fillna(0.0)
        for each_str_col in [
            "Month", "ZOName"
        ]:
            if each_str_col in resp.columns:
                resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
        if filters:
            grouped_resp = None
            filter_keys = [rec.key.strip('"') for rec in filters]
            if "Month" in filter_keys:
            # Convert full month names to short form (e.g., "January" -> "Jan")
                resp["Month"] = resp["Month"].apply(
                lambda x: reverse_month_mapping.get(x, x)
            )
            if "Month" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.groupby(["Month", "ZOName"], as_index=False).agg({
                    "Total Sales": "sum"
                })
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.groupby(["Month", "ZOName","ROName"], as_index=False).agg({
                    "Total Sales": "sum"
                })
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.groupby(["Month", "ZOName","ROName","SAName"], as_index=False).agg({
                    "Total Sales": "sum"
                })            
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.groupby(["Month", "ZOName","ROName","SAName","DistributorName"],
                as_index=False).agg({
                    "Total Sales": "sum"
                    })
            if grouped_resp is not None:
                grouped_resp['Total Sales'] = grouped_resp['Total Sales']/10000000
                grouped_resp['Total Sales'] = grouped_resp['Total Sales'].round(2)
                return {"status": True, "message": "success", "data": grouped_resp.to_dict(orient='records')}
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
    
    
    # Bookings vs Sales vs Pendings
    @staticmethod
    async def lpg_cdcms_booking_vs_sales_vs_pending(filters, cross_filters, drill_state,payload):
        if isinstance(payload,dict):
            type = payload.get("type",'')
        else:
            type = ''

        
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        lpg_cdcms_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_booking_vs_sales_vs_pending")
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if filters:
            filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)

            if conditions:
                lpg_cdcms_query_ += ' WHERE '
                lpg_cdcms_query_ += ' AND '.join(conditions)
            lpg_cdcms_query_ += ' GROUP BY "ZOName", "ROName", "SAName", "DistributorName", "ConsumerType", "CylType"'
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_query_, access_filters, drill_state)
            lpg_cdcms_query_ += ' GROUP BY "ZOName", "ROName", "SAName", "DistributorName", "ConsumerType", "CylType"'
            resp = await function(query=lpg_cdcms_query_)
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)
            if resp.empty:
                return {"status": True, "message": "success", "data": []}
            resp = await filter_data(resp, _filters)
            resp = resp.groupby(["ZOName"], as_index=False).agg({
                    "Bookings": "sum",
                    "Sales": "sum",
                    "Pending": "sum"
                })
            # Fill missing values for numerical columns
            for each_float_col in ["Bookings", "Sales", "Pending"]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col]/1000
                    resp[each_float_col] = resp[each_float_col].round(0)
            for each_str_col in ["ZOName"]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
            return {"status": True, "message": "success", "data": resp}
        
        resp = await function(query=lpg_cdcms_query_)
        resp = pd.DataFrame(resp)
        if resp.empty:
            return {"status": True, "message": "success", "data": []}
        resp = await filter_data(resp, _filters)
        for each_str_col in ["ZOName"]:
            if each_str_col in resp.columns:
                resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
        if filters:
            grouped_resp = None
            filter_keys = [rec.key.strip('"') for rec in filters]
            if "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.groupby(["ZOName","ROName"], as_index=False).agg({
                    "Bookings": "sum",
                    "Sales": "sum",
                    "Pending": "sum"
                })
            elif "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.groupby(["ZOName","ROName","SAName"], as_index=False).agg({
                    "Bookings": "sum",
                    "Sales": "sum",
                    "Pending": "sum"
                })        
            elif "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.groupby(["ZOName","ROName","SAName","DistributorName"],
                as_index=False).agg({
                    "Bookings": "sum",
                    "Sales": "sum",
                    "Pending": "sum"
                    })
            if grouped_resp is not None:
                for each_float_col in ["Bookings", "Sales", "Pending"]:
                    if each_float_col in grouped_resp.columns:
                        grouped_resp[each_float_col] = grouped_resp[each_float_col]/1000
                        grouped_resp[each_float_col] = grouped_resp[each_float_col].fillna(0.0).round(2)
                return {"status": True, "message": "success", "data": grouped_resp.to_dict(orient='records')}
        # If no filters are applied, return the default response
        for each_float_col in ["Bookings", "Sales", "Pending"]:
            if each_float_col in resp.columns and type == "cyl":
                resp.loc[resp["CylType"] == "C142", each_float_col] = resp.loc[resp["CylType"] == "C142", each_float_col] * 14.2
                resp.loc[resp["CylType"] == "C5", each_float_col] = resp.loc[resp["CylType"] == "C5", each_float_col] * 5
            else:
                resp[each_float_col] = resp[each_float_col]/1000
                resp[each_float_col] = resp[each_float_col].round(2)

        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
    
    
    # Total Bookings (Order Source)
    @staticmethod
    async def lpg_cdcms_bookings_order_source_wise(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        cdcms_order_source_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_bookings_order_source_wise")
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if filters:
            filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                # Now handle other cases
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                cdcms_order_source_query_ += ' WHERE '
                cdcms_order_source_query_ += ' AND '.join(conditions)
            cdcms_order_source_query_ += ' GROUP BY "OrderSourceName", "ZOName", "ROName", "SAName", "Execution_Date", "DistributorName", "ConsumerType", "CylType"'
        else:      
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            cdcms_order_source_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(cdcms_order_source_query_, access_filters, drill_state)
            if "where" not in cdcms_order_source_query_.lower():
                cdcms_order_source_query_ += f' WHERE "ZOName"  NOT IN (\'Null\')'
            else:
                cdcms_order_source_query_ += f' AND "ZOName"  NOT IN (\'Null\')'
            cdcms_order_source_query_ += ' GROUP BY "OrderSourceName", "ZOName", "ROName", "SAName", "Execution_Date", "DistributorName", "ConsumerType", "CylType"'

            resp = await function(query=cdcms_order_source_query_)
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)
            if resp.empty:
                return {"status": True, "message": "success", "data": []}
            resp = await filter_data(resp, _filters)
            resp = resp.groupby(["OrderSourceName"], as_index=False).agg({
                    "Total_Bookings": "sum"
                })
            # Fill missing values for numerical columns
            for each_float_col in [
                "Total_Bookings"
            ]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)

            # Fill missing values for string columns
            for each_str_col in [
                "OrderSourceName"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
            resp["Total_Bookings"] = resp["Total_Bookings"]/1000
            resp["Total_Bookings"] = resp["Total_Bookings"].fillna(0).round(0)
            return {"status": True, "message": "success", "data": resp}
        resp = await function(query=cdcms_order_source_query_)
        # Convert the response to a DataFrame for further processing
        resp = pd.DataFrame(resp)
        if resp.empty:
            return {"status": True, "message": "success", "data": []}
        resp = await filter_data(resp, _filters)
        for each_float_col in [
            "Total_Bookings"
        ]:
            if each_float_col in resp.columns:
                resp[each_float_col] = resp[each_float_col].fillna(0.0)
        for each_str_col in [
            "OrderSourceName","ZOName","ROName","SAName","DistributorName"
        ]:
            if each_str_col in resp.columns:
                resp[each_str_col] = resp[each_str_col].fillna('').astype(str)

        if filters:
            grouped_resp = None
            filter_keys = [rec.key.strip('"') for rec in filters]
            if "OrderSourceName" in filter_keys and "ZOName" not in filter_keys:    
                grouped_resp = resp.groupby(["OrderSourceName","ZOName"], as_index=False).agg({
                    "Total_Bookings": "sum"
                })
            elif "OrderSourceName" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.groupby(["OrderSourceName","ZOName","ROName"], as_index=False).agg({
                    "Total_Bookings": "sum"
                })
            elif "OrderSourceName" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.groupby(["OrderSourceName","ZOName","ROName","SAName"],
                as_index=False).agg({
                    "Total_Bookings": "sum"
                    })
            elif "OrderSourceName" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.groupby(["OrderSourceName","ZOName","ROName","SAName","DistributorName"],
                as_index=False).agg({
                    "Total_Bookings": "sum"
                    })
            if grouped_resp is not None:
                grouped_resp["Total_Bookings"] = grouped_resp["Total_Bookings"]/1000
                grouped_resp["Total_Bookings"] = grouped_resp["Total_Bookings"].round(2)
                return {"status": True, "message": "success", "data": grouped_resp.to_dict(orient='records')}
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
    
    
    # Overall Pending (ConsumerType)
    @staticmethod
    async def lpg_cdcms_pending_cosumer_type_wise(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        lpg_pending_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_pending_cosumer_type_wise")
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if filters:
            filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                # Now handle other cases
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)

            if conditions:
                lpg_pending_query_  += ' WHERE '
                lpg_pending_query_  += ' AND '.join(conditions)
                lpg_pending_query_  += f' AND "ZOName"  NOT IN (\'Null\')'
            lpg_pending_query_  += ' GROUP BY "ZOName" ,"ROName","SAName","ConsumerType" ,"DistributorName", "CylType"'
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_pending_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_pending_query_, access_filters, drill_state)
            if "where" not in lpg_pending_query_.lower():                
                lpg_pending_query_  += f' WHERE "ZOName"  NOT IN (\'Null\')'
            else:
                lpg_pending_query_  += f' AND "ZOName"  NOT IN (\'Null\')'
            lpg_pending_query_  += ' GROUP BY "ZOName", "ROName", "SAName", "ConsumerType", "DistributorName", "CylType"'
            
            resp = await function(query=lpg_pending_query_)
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)
            if resp.empty:
                return {"status": True, "message": "success", "data": []}
            resp = await filter_data(resp, _filters)
            resp = resp.groupby(["ConsumerType"], as_index=False).agg({
                        "Total_pending": "sum",
                    })
            # Fill missing values for numerical columns
            for each_float_col in ["Total_pending"]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)/100000
                    resp[each_float_col] = resp[each_float_col].fillna(0).round(0)
            # Fill missing values for string columns
            for each_str_col in [
                "ZOName",
                "ROName",
                "SAName",
                "ConsumerType",
                "DistributorName"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)

            return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}

        # Execute the query
        resp = await function(query=lpg_pending_query_ )
        if resp:
            resp = pd.DataFrame(resp)
            if resp.empty:
                return {"status": True, "message": "success", "data": []}
            resp = await filter_data(resp, _filters)
            # Fill missing values for numerical columns
            for each_float_col in [
                "Total_pending"
            ]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)

            # Fill missing values for string columns
            for each_str_col in [
                "ZOName",
                "ROName",
                "SAName",
                "ConsumerType",
                "DistributorName"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
            if filters:
                grouped_resp = None
                filter_keys = [rec.key.strip('"') for rec in filters]
                if "ConsumerType" in filter_keys and "ZOName" not in filter_keys:
                    grouped_resp = resp.groupby(["ConsumerType", "ZOName"], as_index=False).agg({
                        "Total_pending": "sum",
                    })
                if "ConsumerType" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                    grouped_resp = resp.groupby(["ConsumerType","ZOName", "ROName"], as_index=False).agg({
                        "Total_pending": "sum",
                    })
                elif "ConsumerType" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                    grouped_resp = resp.groupby(["ConsumerType","ZOName", "ROName", "SAName"], as_index=False).agg({
                        "Total_pending": "sum",
                    })
                elif "ConsumerType" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                    grouped_resp = resp.groupby(["ConsumerType","ZOName", "ROName", "SAName", "DistributorName"],
                                                as_index=False).agg({
                        "Total_pending": "sum",
                    })
                if grouped_resp is not None:
                    grouped_resp["Total_pending"] = grouped_resp["Total_pending"]/100000
                    grouped_resp["Total_pending"] = grouped_resp["Total_pending"].round(2)
                    return {"status": True, "message": "success", "data": grouped_resp.to_dict(orient='records')}
        else:
            return {"status": True, "message":"success", "data":[]}
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
    
    
    # Overall Ageing Analysis
    @staticmethod
    async def lpg_cdcms_ageing(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        lpg_pending_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_ageing")
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if filters:
            filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            conditions = []
            for rec in filters:
                if rec.key.replace('"', '') in ["pending_1_3_days", "pending_4_7_days", "pending_8_15_days", "pending_beyond_15_days"]:
                    continue
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                lpg_pending_query_  += ' WHERE '
                lpg_pending_query_  += ' AND '.join(conditions)
            if not conditions:
                lpg_pending_query_  += f' WHERE "ZOName" NOT IN ( \'Null\')'
            else:
                lpg_pending_query_  += f' AND "ZOName" NOT IN ( \'Null\')'
            lpg_pending_query_  += ' GROUP BY "ZOName", "ROName", "SAName", "ConsumerType", "DistributorName", "CylType" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_pending_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_pending_query_, access_filters, drill_state)
            if "where" not in lpg_pending_query_.lower():
                lpg_pending_query_ += f' WHERE "ZOName"  NOT IN (\'Null\')'
            else:
                lpg_pending_query_ += f' AND "ZOName"  NOT IN (\'Null\')'
            lpg_pending_query_  += ' GROUP BY "ZOName", "ROName", "SAName", "ConsumerType", "DistributorName", "CylType" '
            resp = await function(query=lpg_pending_query_ )
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)
            if resp.empty:
                return {"status": True, "message": "success", "data": []}
            resp = await filter_data(resp, _filters)
            
            # for col in ["pending_1_3_days", "pending_4_7_days", "pending_8_15_days", "pending_beyond_15_days"]:
            #     if col in resp.columns:
            #         resp[col] = resp[col].fillna(0).astype(np.float64)
            #         resp[col] = np.where(
            #                         resp['CylType'].fillna('') == 'C142',
            #                         resp[col] * 14.2,
            #                         np.where(
            #                             resp['CylType'].fillna('') == 'C5',
            #                             resp[col] * 5,
            #                             resp[col]
            #                         )
            #                     )
            
            resp["Age"] = "Ageing"
            resp = resp.groupby(["Age"], as_index=False).agg({
                    "pending_1_3_days": "sum",
                    "pending_4_7_days": "sum",
                    "pending_8_15_days": "sum",
                    "pending_beyond_15_days": "sum"
                })
            del resp["Age"]
            for col in ["pending_1_3_days", "pending_4_7_days", "pending_8_15_days", "pending_beyond_15_days"]:
                resp[col] = resp[col]/1000
                resp[col] = resp[col].fillna(0).astype(np.float64).round(2)
            return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}

        resp = await function(query=lpg_pending_query_)
        resp = pd.DataFrame(resp)
        if resp.empty:
            return {"status": True, "message": "success", "data": []}
        resp = await filter_data(resp, _filters)
        
        # for col in ["pending_1_3_days", "pending_4_7_days", "pending_8_15_days", "pending_beyond_15_days"]:
        #     if col in resp.columns:
        #         resp[col] = resp[col].fillna(0).astype(np.float64)
        #         resp[col] = np.where(
        #                         resp['CylType'].fillna('') == 'C142',
        #                         resp[col] * 14.2,
        #                         np.where(
        #                             resp['CylType'].fillna('') == 'C5',
        #                             resp[col] * 5,
        #                             resp[col]
        #                         )
        #                     )
        for each_str_col in ["ZOName", "ROName", "SAName", "ConsumerType", "DistributorName"]:
            if each_str_col in resp.columns:
                resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
        if filters:
            grouped_resp = None
            filter_keys = [rec.key.strip('"') for rec in filters]
            if "pending_1_3_days" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType", "ZOName"], as_index=False).agg({
                    "pending_1_3_days": "sum"
                })
                grouped_resp = grouped_resp.pivot(index="ZOName", columns="ConsumerType", values="pending_1_3_days").fillna(0)
                _index = "ZOName"
            elif "pending_1_3_days" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType", "ZOName", "ROName"], as_index=False).agg({
                    "pending_1_3_days": "sum",
                })
                grouped_resp = grouped_resp.pivot(index="ROName", columns="ConsumerType", values="pending_1_3_days").fillna(0)
                _index = "ROName"
            elif "pending_1_3_days" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType", "ZOName", "ROName", "SAName"],
                                            as_index=False).agg({
                    "pending_1_3_days": "sum",
                })
                grouped_resp = grouped_resp.pivot(index="SAName", columns="ConsumerType", values="pending_1_3_days").fillna(0)
                _index = "SAName"
            elif "pending_1_3_days" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName"  in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType", "ZOName", "ROName", "SAName","DistributorName"],
                                            as_index=False).agg({
                    "pending_1_3_days": "sum",
                })
                grouped_resp = grouped_resp.pivot(index="DistributorName", columns="ConsumerType", values="pending_1_3_days").fillna(0)
                _index = "DistributorName"
            elif "pending_4_7_days" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType", "ZOName"], as_index=False).agg({
                    "pending_4_7_days": "sum"
                })
                grouped_resp = grouped_resp.pivot(index="ZOName", columns="ConsumerType", values="pending_4_7_days").fillna(0)
                _index = "ZOName"
            elif "pending_4_7_days" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType", "ZOName", "ROName"], as_index=False).agg({
                    "pending_4_7_days": "sum",
                })
                grouped_resp = grouped_resp.pivot(index="ROName", columns="ConsumerType", values="pending_4_7_days").fillna(0)
                _index = "ROName"
            elif "pending_4_7_days" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType", "ZOName", "ROName", "SAName"],
                                            as_index=False).agg({
                    "pending_4_7_days": "sum",
                })
                grouped_resp = grouped_resp.pivot(index="SAName", columns="ConsumerType", values="pending_4_7_days").fillna(0)
                _index = "SAName"
            elif "pending_4_7_days" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName"  in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType", "ZOName", "ROName", "SAName","DistributorName"],
                                            as_index=False).agg({
                    "pending_4_7_days": "sum",
                })
                grouped_resp = grouped_resp.pivot(index="DistributorName", columns="ConsumerType", values="pending_4_7_days").fillna(0)
                _index = "DistributorName"
            elif "pending_8_15_days" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType", "ZOName"], as_index=False).agg({
                    "pending_8_15_days": "sum"
                })
                grouped_resp = grouped_resp.pivot(index="ZOName", columns="ConsumerType", values="pending_8_15_days").fillna(0)
                _index = "ZOName"
            elif "pending_8_15_days" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType", "ZOName", "ROName"], as_index=False).agg({
                    "pending_8_15_days": "sum",
                })
                grouped_resp = grouped_resp.pivot(index="ROName", columns="ConsumerType", values="pending_8_15_days").fillna(0)
                _index = "ROName"
            elif "pending_8_15_days" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType", "ZOName", "ROName", "SAName"],
                                            as_index=False).agg({
                    "pending_8_15_days": "sum",
                })
                grouped_resp = grouped_resp.pivot(index="SAName", columns="ConsumerType", values="pending_8_15_days").fillna(0)
                _index = "SAName"
            elif "pending_8_15_days" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName"  in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType", "ZOName", "ROName", "SAName","DistributorName"],
                                            as_index=False).agg({
                    "pending_8_15_days": "sum",
                })
                grouped_resp = grouped_resp.pivot(index="DistributorName", columns="ConsumerType", values="pending_8_15_days").fillna(0)
                _index = "DistributorName"
            elif "pending_beyond_15_days" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType", "ZOName"], as_index=False).agg({
                    "pending_beyond_15_days": "sum"
                })
                grouped_resp = grouped_resp.pivot(index="ZOName", columns="ConsumerType", values="pending_beyond_15_days").fillna(0)
                _index = "ZOName"
            elif "pending_beyond_15_days" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType", "ZOName", "ROName"], as_index=False).agg({
                    "pending_beyond_15_days": "sum",
                })
                grouped_resp = grouped_resp.pivot(index="ROName", columns="ConsumerType", values="pending_beyond_15_days").fillna(0)
                _index = "ROName"
            elif "pending_beyond_15_days" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType", "ZOName", "ROName", "SAName"],
                                            as_index=False).agg({
                    "pending_beyond_15_days": "sum",
                })
                grouped_resp = grouped_resp.pivot(index="SAName", columns="ConsumerType", values="pending_beyond_15_days").fillna(0)
                _index = "SAName"
            elif "pending_beyond_15_days" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName"  in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType", "ZOName", "ROName", "SAName","DistributorName"],
                                            as_index=False).agg({
                    "pending_beyond_15_days": "sum",
                })
                grouped_resp = grouped_resp.pivot(index="DistributorName", columns="ConsumerType", values="pending_beyond_15_days").fillna(0)
                _index = "DistributorName"
            for col in ["PMUY", "NPMUY"]:
                if col in grouped_resp.columns:
                    grouped_resp[col] = grouped_resp[col]/1000
                    grouped_resp[col] = grouped_resp[col].round(2)
            grouped_resp = grouped_resp.assign(Total=grouped_resp["PMUY"] + grouped_resp["NPMUY"]
                                               ).sort_values(by="Total", ascending=False).drop(columns=["Total"])
            result = [
                        {
                            "PMUY": row.get("PMUY", 0),
                            "NPMUY": row.get("NPMUY", 0),
                            _index: index
                        }
                        for index, row in grouped_resp.iterrows()
                     ]
            return {"status": True, "message": "success", "data": result}
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
    
    
    # Domestic Sales Table
    @staticmethod
    async def lpg_cdcms_domestic_sales_table(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        lpg_sale_table_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_domestic_sales_table")
        
        access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
        lpg_sale_table_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_sale_table_, access_filters, drill_state)
        
        if not filters and not cross_filters:
            lpg_sale_table_ += f' WHERE "ZOName" IS NOT NULL'
            lpg_sale_table_ += ' GROUP BY "ZOName", "CylType", "ConsumerType" '
        
        resp = await function(query=lpg_sale_table_)
        if not resp:
            return {"status": True, "message": "No data available", "data": []}
        
        resp = pd.DataFrame(resp)
        for each_float_col in ["Total_Booking", "Total_Sales", "Total_Pending"]:
            if each_float_col in resp.columns:
                resp[each_float_col] = resp[each_float_col].fillna(0.0) / 1000
        for each_str_col in ["ZOName", "CylType", "ConsumerType"]:
            if each_str_col in resp.columns:
                resp[each_str_col] = resp[each_str_col].fillna("").astype(str)
        resp = resp.groupby(["ZOName", "CylType", "ConsumerType"], as_index=False).agg({
            "Total_Booking": "sum",
            "Total_Sales": "sum",
            "Total_Pending": "sum"
        })
        for each_float_col in ["Total_Booking", "Total_Sales", "Total_Pending"]:
            if each_float_col in resp.columns:
                resp[each_float_col] = resp[each_float_col].fillna(0).astype(int)
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
    
    
    # Current Year Sales (ConsumerType)
    @staticmethod
    async def lpg_cdcms_current_financial_year_sales(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        _fy = None
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                if "financial_year" in f"{filter.key}":
                    _fy = f"{filter.value}"
                    continue
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if _fy:
            financial_year = _fy
        else:
            financial_year = await get_financial_year()
        cumulative_sales_pmuy_npmuy_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_current_financial_year_sales")
        if filters:
            filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                # Now handle other cases
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)

            if conditions:
                cumulative_sales_pmuy_npmuy_query_ += ' WHERE '
                cumulative_sales_pmuy_npmuy_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            cumulative_sales_pmuy_npmuy_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(cumulative_sales_pmuy_npmuy_query_, access_filters, drill_state)
            cumulative_sales_pmuy_npmuy_query_ += f' AND "ZOName" IS NOT NULL AND "Financial_Year"=\'{str(financial_year)}\''
            cumulative_sales_pmuy_npmuy_query_ += ' GROUP BY "ZOName", "ROName", "SAName", "ConsumerType", "CylType", "DistributorName"'
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            cumulative_sales_pmuy_npmuy_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(cumulative_sales_pmuy_npmuy_query_, access_filters, drill_state)

            if not "where" in cumulative_sales_pmuy_npmuy_query_.lower():
                cumulative_sales_pmuy_npmuy_query_ += f' WHERE "ZOName" IS NOT NULL AND "Financial_Year"=\'{str(financial_year)}\''
            else:
                cumulative_sales_pmuy_npmuy_query_ += f' AND "ZOName" IS NOT NULL AND "Financial_Year"=\'{str(financial_year)}\''
            cumulative_sales_pmuy_npmuy_query_ += ' GROUP BY "ZOName", "ROName", "SAName", "ConsumerType", "CylType", "DistributorName"'
                                 
            resp = await function(query=cumulative_sales_pmuy_npmuy_query_)
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)
            if resp.empty:
                return {"status": True, "message": "success", "data": []}
            resp = await filter_data(resp, _filters)
            resp = resp.groupby(["ConsumerType"], as_index=False).agg({
                    "Sales": lambda x: x.sum() / 1000000
                })
            resp["Sales"] = resp["Sales"].round(0)
            
            # Fill missing values for string columns
            for each_str_col in [
                "ConsumerType"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)

            return {"status": True, "message": "success", "data": resp}
        
        # Execute the query
        resp = await function(query=cumulative_sales_pmuy_npmuy_query_)
        # Convert the response to a DataFrame for further processing
        resp = pd.DataFrame(resp)
        resp = await filter_data(resp, _filters)
        if resp.empty:
            return {"status": True, "message": "success", "data": []}
        # Fill missing values for numerical columns
        for each_float_col in ["Sales"]:
            if each_float_col in resp.columns:
                resp[each_float_col] = resp[each_float_col].fillna(0.0)
        for each_str_col in ["ConsumerType", "ZOName", "ROName", "SAName", "DistributorName"]:
            if each_str_col in resp.columns:
                resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
        if filters:
            grouped_resp = None
            filter_keys = [rec.key.strip('"') for rec in filters]
            if "ConsumerType" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType","ZOName"], 
                as_index=False).agg({"Sales": "sum"})
            elif "ConsumerType" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType","ZOName","ROName"], 
                as_index=False).agg({"Sales": "sum"})
            elif "ConsumerType" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType","ZOName","ROName","SAName"],
                as_index=False).agg({"Sales": "sum"})
            elif "ConsumerType" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.groupby(["ConsumerType","ZOName","ROName","SAName","DistributorName"],
                as_index=False).agg({"Sales": "sum"})
            if grouped_resp is not None:
                grouped_resp["Sales"] = grouped_resp["Sales"]/1000000
                grouped_resp["Sales"] = grouped_resp["Sales"].round(2)
                return {"status": True, "message": "success", "data": grouped_resp.to_dict(orient='records')}
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
    
    
    @staticmethod
    async def lpg_cdcms_sakhi_registrations(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        financial_year = await get_financial_year()
        sakhi_registrations_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_sakhi_registrations")
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                sakhi_registrations_query_  += ' WHERE '
                sakhi_registrations_query_  += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            sakhi_registrations_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(sakhi_registrations_query_, access_filters, drill_state)
            sakhi_registrations_query_  += f' AND "Financial_Year" IN (\'{financial_year}\')'
            sakhi_registrations_query_  += ' GROUP BY "Month", "Month_Number", "ZOName", "ROName", "SAName", "DistributorName" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            sakhi_registrations_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(sakhi_registrations_query_, access_filters, drill_state)
            if "where" not in sakhi_registrations_query_:
                sakhi_registrations_query_  += f' WHERE "Financial_Year" IN (\'{financial_year}\')'
            else:
                sakhi_registrations_query_  += f' AND "Financial_Year" IN (\'{financial_year}\')'
            sakhi_registrations_query_  += ' GROUP BY "Month", "Month_Number", "ZOName", "ROName", "SAName", "DistributorName" '
            resp = await function(query=sakhi_registrations_query_)
            resp = pl.DataFrame(resp)
            resp = await filter_data(resp.to_pandas(), _filters)
            resp = pl.from_pandas(resp)
            resp = resp.group_by(["Month"]).agg([
                    pl.sum("SakhiRegistered").alias("SakhiRegistered"),
                    pl.first("Month_Number").alias("Month_Number"),
                ])
            resp = resp.sort('Month_Number')
            return {"status": True, "message": "success", "data": resp.to_dicts()}
            
        resp = await function(query=sakhi_registrations_query_)
        resp = pl.DataFrame(resp)
        resp = await filter_data(resp.to_pandas(), _filters)
        resp = pl.from_pandas(resp)
        # Fill missing values
        numerical_columns = ["Month_Number", "SakhiRegistered"]
        string_columns = ["Month", "ZOName", "ROName", "SAName"]

        for col in numerical_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null(0.0))

        for col in string_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null("").cast(pl.Utf8))

        # Grouping and filtering
        if filters:
            grouped_resp = None
            filter_keys = [rec.key.strip('"') for rec in filters]

            if "Month" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.group_by(["Month", "ZOName"]).agg([
                    pl.sum("SakhiRegistered").alias("SakhiRegistered")
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.group_by(["Month", "ZOName", "ROName"]).agg([
                    pl.sum("SakhiRegistered").alias("SakhiRegistered")
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.group_by(["Month", "ZOName", "ROName", "SAName"]).agg([
                    pl.sum("SakhiRegistered").alias("SakhiRegistered")
                ])
            if grouped_resp is not None:
                return {"status": True, "message": "success", "data": grouped_resp.to_dicts()}
        # Convert the result to a dictionary for the response
        return {"status": True, "message": "success", "data": resp.to_dicts()}
    
    
    @staticmethod
    async def lpg_cdcms_dbc_enrollments(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        financial_year = await get_financial_year()
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        dbc_enrollments_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_dbc_enrollments")
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):  # Use dot notation instead of subscription
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                dbc_enrollments_query_ += ' WHERE ' 
                dbc_enrollments_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            dbc_enrollments_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(dbc_enrollments_query_, access_filters, drill_state)
            dbc_enrollments_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            dbc_enrollments_query_ += ' GROUP BY "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "ConsumerType" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            dbc_enrollments_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(dbc_enrollments_query_, access_filters, drill_state)
            if "where" not in dbc_enrollments_query_.lower():
                dbc_enrollments_query_ += f' WHERE "Financial_Year" IN (\'{financial_year}\')'
            else:
                dbc_enrollments_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            dbc_enrollments_query_ += ' GROUP BY "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "ConsumerType" '
        resp = await function(query=dbc_enrollments_query_)
        resp = pl.DataFrame(resp)
        resp = await filter_data(resp.to_pandas(), _filters)
        resp = pl.from_pandas(resp)
        numerical_columns = ["month_number", "DBCIssued"]
        string_columns = ["Month", "ZOName", "ROName", "SAName"]

        for col in numerical_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null(0.0))

        for col in string_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null("").cast(pl.Utf8))
        if filters:
            filter_keys = [rec.key.strip('"') for rec in filters]
            grouped_resp = None
            if "Month" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.group_by(["Month", "ZOName"]).agg([
                    pl.sum("DBCIssued").alias("DBCIssued"),
                    pl.sum("month_number").alias("month_number"),
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.group_by(["Month", "ZOName", "ROName"]).agg([
                    pl.sum("DBCIssued").alias("DBCIssued"),
                    pl.sum("month_number").alias("month_number"),
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.group_by(["Month", "ZOName", "ROName", "SAName"]).agg([
                    pl.sum("DBCIssued").alias("DBCIssued"),
                    pl.sum("month_number").alias("month_number"),
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.group_by(["Month", "ZOName", "ROName", "SAName", "DistributorName"]).agg([
                    pl.sum("DBCIssued").alias("DBCIssued"),
                    pl.sum("month_number").alias("month_number"),
                ])
            if grouped_resp is not None:    
                return {"status": True, "message": "success", "data": grouped_resp.to_dicts()}
        resp = resp.group_by(["Month"]).agg([
                pl.sum("DBCIssued").alias("DBCIssued"),
                pl.first("month_number").alias("month_number"),
            ])
        resp = resp.sort("month_number")
        return {"status": True, "message": "success", "data": resp.to_dicts()}
    
    
    @staticmethod
    async def lpg_cdcms_nc_stats(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        financial_year = await get_financial_year()
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        lpg_cdcms_nc_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_nc_query")
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                lpg_cdcms_nc_query_ += ' WHERE ' 
                lpg_cdcms_nc_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_nc_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_nc_query_, access_filters, drill_state)
            lpg_cdcms_nc_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_nc_query_ += ' GROUP BY "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "ConsumerType" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_nc_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_nc_query_, access_filters, drill_state)
            if "where" not in lpg_cdcms_nc_query_.lower():
                lpg_cdcms_nc_query_ += f' WHERE "Financial_Year" IN (\'{financial_year}\')'
            else:
                lpg_cdcms_nc_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_nc_query_ += ' GROUP BY "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "ConsumerType" '
        resp = await function(query=lpg_cdcms_nc_query_)
        resp = pl.DataFrame(resp)
        resp = await filter_data(resp.to_pandas(), _filters)
        resp = pl.from_pandas(resp)
        numerical_columns = ["month_number", "new_connection"]
        string_columns = ["Month", "ZOName", "ROName", "SAName"]

        for col in numerical_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null(0.0))

        for col in string_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null("").cast(pl.Utf8))
        if filters:
            filter_keys = [rec.key.strip('"') for rec in filters]
            grouped_resp = None
            if "Month" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.group_by(["Month", "ZOName"]).agg([
                    pl.sum("new_connection").alias("new_connection"),
                    pl.first("month_number").alias("month_number"),
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.group_by(["Month", "ZOName", "ROName"]).agg([
                    pl.sum("new_connection").alias("new_connection"),
                    pl.first("month_number").alias("month_number"),
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.group_by(["Month", "ZOName", "ROName", "SAName"]).agg([
                    pl.sum("new_connection").alias("new_connection"),
                    pl.first("month_number").alias("month_number"),
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.group_by(["Month", "ZOName", "ROName", "SAName", "DistributorName"]).agg([
                    pl.sum("new_connection").alias("new_connection"),
                    pl.first("month_number").alias("month_number"),
                ])
            if grouped_resp is not None:
                return {"status": True, "message": "success", "data": grouped_resp.to_dicts()}
        resp = resp.group_by(["Month"]).agg([
                pl.sum("new_connection").alias("new_connection"),
                pl.first("month_number").alias("month_number"),
            ])
        resp = resp.sort("month_number")
        return {"status": True, "message": "success", "data": resp.to_dicts()}
    
    
################################################################# CONSUMER STATS ###################################################################################
    @staticmethod
    async def lpg_cdcms_total_consumers(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        df = pd.read_csv("/opt/ceg/algo/DistributorMappings.csv")
        total_consumers_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_total_consumers")
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})

        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                total_consumers_query_  += ' WHERE '
                total_consumers_query_  += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            total_consumers_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(total_consumers_query_, access_filters, drill_state)
            total_consumers_query_ +=  ' AND "Category" NOT IN (\'Others\') AND "ZOName" IS NOT NULL '
            total_consumers_query_  += ' GROUP BY "ZOName" ,"ROName","SAName","Category","SubCategory" ,"JDEDistributorCode"'
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            total_consumers_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(total_consumers_query_, access_filters, drill_state)
            if not "where" in total_consumers_query_.lower():
                total_consumers_query_ +=  ' WHERE "Category" NOT IN (\'Others\') AND "ZOName" IS NOT NULL'
            else:
                total_consumers_query_ +=  ' AND "Category" NOT IN (\'Others\') AND "ZOName" IS NOT NULL'
            total_consumers_query_  += ' GROUP BY "ZOName" ,"ROName","SAName", "Category", "SubCategory", "JDEDistributorCode"'
            resp = await function(query=total_consumers_query_ )
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)
            resp.rename({"SubCategory": "ConsumerType"}, inplace=True)
            resp = pd.merge(resp, df, on='JDEDistributorCode', how='left')
            resp = await filter_data(resp, _filters)
            if resp.empty:
                return {"status": True, "message": "success", "data": []}
            resp = resp.groupby(["ZOName"], as_index=False).agg({
                        "Total_Consumers": "sum",
                    })
            # Fill missing values for numerical columns
            for each_float_col in [
                "Total_Consumers"
            ]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)
            # Fill missing values for string columns
            for each_str_col in [
                "ZOName",
                "ROName",
                "SAName",
                "Category",
                "SubCategory",
                "JDEDistributorCode"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
            return {"status": True, "message": "success", "data": resp}
        resp = await function(query=total_consumers_query_ )
        if resp:
            resp = pd.DataFrame(resp)
            resp = await filter_data(resp, _filters)
            if resp.empty:
                return {"status": True, "message": "success", "data": []}
            resp = pd.merge(resp, df, on='JDEDistributorCode', how='left')
            for each_float_col in [
                "Total_Consumers"
            ]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)
            for each_str_col in [
                "ZOName",
                "ROName",
                "SAName",
                "Category",
                "SubCategory",
                "JDEDistributorCode"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
            if filters:
                grouped_resp = None
                filter_keys = [rec.key.strip('"') for rec in filters]
                
                if "ZOName" in filter_keys and "ROName" not in filter_keys:
                    grouped_resp = resp.groupby(["ZOName", "ROName"], as_index=False).agg({
                        "Total_Consumers": "sum",
                    })
                elif "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                    grouped_resp = resp.groupby(["ZOName", "ROName", "SAName"], as_index=False).agg({
                        "Total_Consumers": "sum",
                    })
                elif "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                    grouped_resp = resp.groupby(["ZOName", "ROName", "SAName", "DistributorName"],
                                                as_index=False).agg({
                        "Total_Consumers": "sum",
                    })
                if grouped_resp is not None:
                    return {"status": True, "message": "success", "data": grouped_resp.to_dict(orient='records')}
        else:
            return {"status": True, "message":"success", "data":[]}
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
    
    
    @staticmethod
    async def lpg_cdcms_ekyc_statistics(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        df = pd.read_csv("/opt/ceg/algo/DistributorMappings.csv")
        ekyc_statistics_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_ekyc_statistics")        
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                ekyc_statistics_query_ += ' WHERE '
                ekyc_statistics_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            ekyc_statistics_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(ekyc_statistics_query_, access_filters, drill_state)
            ekyc_statistics_query_ += f'  AND "ZOName"  NOT IN ( \'Null\') '
            ekyc_statistics_query_ += ' GROUP BY   "ROName","SAName" ,"JDEDistributorCode","ZOName" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            ekyc_statistics_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(ekyc_statistics_query_, access_filters, drill_state)
            if not "where" in ekyc_statistics_query_.lower():
                ekyc_statistics_query_ += f' WHERE "ZOName"  NOT IN ( \'Null\')'
            else:
                ekyc_statistics_query_ += f' AND "ZOName"  NOT IN ( \'Null\')'
            ekyc_statistics_query_ += ' GROUP BY   "ROName","SAName" ,"JDEDistributorCode","ZOName"'
            resp = await function(query=ekyc_statistics_query_)
            resp = pd.DataFrame(resp)
            if resp.empty:
                return {"status": True, "message": "success", "data": []}
            resp["temp"] = "temp"
            resp_pie = resp.groupby(["temp"], as_index=False).agg({
                    "Completed": "sum",
                    "Pending": "sum"
                })
            del resp_pie["temp"]
            resp = resp.groupby(["ZOName"], as_index=False).agg({
                    "Completed": "sum",
                    "Pending": "sum"
                })
            for each_float_col in [
                "Completed","Pending"
            ]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)
            for each_str_col in [
                "ROName", "SAName", "JDEDistributorCode","ZOName"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
            return {"status": True, "message": "success", "data_pie": resp_pie.to_dict(orient="records"), "data": resp}

        resp = await function(query=ekyc_statistics_query_)
        # Convert the response to a DataFrame for further processing
        resp = pd.DataFrame(resp)
        resp = await filter_data(resp, _filters)
        resp["temp"] = "temp"
        resp_pie = resp.groupby(["temp"], as_index=False).agg({
                "Completed": "sum",
                "Pending": "sum"
            })
        del resp_pie["temp"]
        if resp.empty:
            return {"status": True, "message": "success", "data": []}
        resp = pd.merge(resp, df, on='JDEDistributorCode', how='left')
        for each_float_col in [
                "Completed","Pending"
        ]:
            if each_float_col in resp.columns:
                resp[each_float_col] = resp[each_float_col].fillna(0.0)
        # Fill missing values for string columns
        for each_str_col in [
                 "ROName", "SAName", "JDEDistributorCode","ZOName"
        ]:
            if each_str_col in resp.columns:
                resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
        if filters:
            grouped_resp = None
            filter_keys = [rec.key.strip('"') for rec in filters]
            if "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.groupby(["ZOName", "ROName"], as_index=False).agg({
                    "Completed": "sum",
                    "Pending": "sum"
                })
            elif "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.groupby(["ZOName", "ROName", "SAName"], as_index=False).agg({
                    "Completed": "sum",
                    "Pending": "sum"                
                })
            elif "ZonesNames" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.groupby(["ZOName", "ROName", "SAName", "DistributorName"],
                                            as_index=False).agg({"Completed": "sum", "Pending": "sum"})
            if grouped_resp is not None:
                return {"status": True, "message": "success", "data_pie": resp_pie.to_dict(orient='records'), "data": grouped_resp.to_dict(orient='records')}
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
    
    
    @staticmethod
    async def lpg_cdcms_total_suvidha(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        df = pd.read_csv("/opt/ceg/algo/DistributorMappings.csv")
        total_suvidha_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_total_suvidha")
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                total_suvidha_query_  += ' WHERE '
                total_suvidha_query_  += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            total_suvidha_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(total_suvidha_query_, access_filters, drill_state)
            total_suvidha_query_ +=  ' AND "Category" = \'Domestic\' AND "ZOCode" NOT IN (\'Null\') AND "SubCategory" IN (\'NPMUY\',\'PMUY\')'
            total_suvidha_query_  += ' GROUP BY "ZOName", "ROName", "SAName", "SubCategory", "Category", "JDEDistributorCode"'
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            total_suvidha_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(total_suvidha_query_, access_filters, drill_state)
            if "where" not in total_suvidha_query_.lower():
                total_suvidha_query_ +=  ' WHERE "Category" = \'Domestic\''
            else:
                total_suvidha_query_ +=  ' AND "Category" = \'Domestic\''
            total_suvidha_query_  += ' GROUP BY "ZOName", "ROName", "SAName", "SubCategory", "Category", "JDEDistributorCode"'
            
            resp = await function(query=total_suvidha_query_)
            resp = pd.DataFrame(resp)            
            resp = await filter_data(resp, _filters)            
            if resp.empty:
                return {"status": True, "message": "success", "data": []}
            pie_resp = resp.groupby(["SubCategory"], as_index=False).agg({
                    "SuvidhaClub": "sum"
                })
            resp = resp.groupby(["ZOName"], as_index=False).agg({
                        "SuvidhaClub": "sum",
                    })
            for each_float_col in [
                "SuvidhaClub"
            ]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)

            # Fill missing values for string columns
            for each_str_col in [
                "ZOName",
                "ROName",
                "SAName",
                "SubCategory",
                "Category"
                "JDEDistributorCode"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)

            return {"status": True, "message": "success", "data_pie": pie_resp.to_dict(orient='records'), "data": resp.to_dict(orient='records')}

        resp = await function(query=total_suvidha_query_)
        if resp:
            resp = pd.DataFrame(resp)
            resp = await filter_data(resp, _filters)
            pie_resp = resp.groupby(["SubCategory"], as_index=False).agg({
                    "SuvidhaClub": "sum"
                })
            resp = pd.merge(resp, df, on='JDEDistributorCode', how='left')
            
            for each_float_col in ["SuvidhaClub"]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)
            for each_str_col in [
                "ZOName",
                "ROName",
                "SAName",
                "SubCategory",
                "Category",
                "JDEDistributorCode"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
            if filters:
                grouped_resp = None
                filter_keys = [rec.key.strip('"') for rec in filters]
                if "ZOName" in filter_keys and "ROName" not in filter_keys:
                    grouped_resp = resp.groupby(["ZOName", "ROName"], as_index=False).agg({
                        "SuvidhaClub": "sum",
                    })
                elif "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                    grouped_resp = resp.groupby(["ZOName", "ROName", "SAName"], as_index=False).agg({
                        "SuvidhaClub": "sum",
                    })  
                elif "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                    grouped_resp = resp.groupby(["ZOName", "ROName", "SAName", "DistributorName"],
                                                as_index=False).agg({
                        "SuvidhaClub": "sum",
                    })
                if grouped_resp is not None:
                    return {"status": True, "message": "success", "data_pie": pie_resp.to_dict(orient='records'), "data": grouped_resp.to_dict(orient='records')}
        else:
            return {"status": True, "message":"success", "data_pie": [], "data":[]}
        return {"status": True, "message": "success", "data_pie": [], "data": resp.to_dict(orient='records')}
    
    
    @staticmethod
    async def lpg_cdcms_overall_ctc_statistics(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        df = pd.read_csv("/opt/ceg/algo/DistributorMappings.csv")
        overall_ctc_statistics_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_overall_ctc_statistics")
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                # Now handle other cases
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)

            if conditions:
                overall_ctc_statistics_query_ += ' WHERE '
                overall_ctc_statistics_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            overall_ctc_statistics_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(overall_ctc_statistics_query_, access_filters, drill_state)
            overall_ctc_statistics_query_  += f' AND "ZOName"  NOT IN ( \'Null\') AND "Category" NOT IN (\'Others\')'
            overall_ctc_statistics_query_ += ' GROUP BY "Category", "ZOName", "ROName", "SAName", "JDEDistributorCode"'
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            overall_ctc_statistics_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(overall_ctc_statistics_query_, access_filters, drill_state)
            if not "where" in overall_ctc_statistics_query_.lower():
                overall_ctc_statistics_query_  += f' WHERE "ZOName"  NOT IN ( \'Null\') AND "Category" NOT IN (\'Others\')'
            else:
                overall_ctc_statistics_query_  += f' AND "ZOName"  NOT IN ( \'Null\') AND "Category" NOT IN (\'Others\')'
            overall_ctc_statistics_query_ += ' GROUP BY "Category", "ZOName", "ROName", "SAName", "JDEDistributorCode"'
            resp = await function(query=overall_ctc_statistics_query_)
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)
            resp = await filter_data(resp, _filters)
            resp["temp"] = "temp"
            resp_pie = resp.groupby(["temp"], as_index=False).agg({
                    "ACTC": "sum",
                    "BCTC": "sum",
                    "NCTC": "sum"
                })
            del resp_pie["temp"]
            
            resp = resp.groupby(["Category"], as_index=False).agg({
                    "ACTC": "sum",
                    "BCTC": "sum",
                    "NCTC": "sum"
                })
            if resp.empty:
                return {"status": True, "message": "success", "data": []}
            # Fill missing values for numerical columns
            for each_float_col in [
                "ACTC","BCTC","NCTC"
            ]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)

            # Fill missing values for string columns
            for each_str_col in [
                "Category"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)

            return {"status": True, "message": "success", "data_pie": resp_pie.to_dict(orient='records'), "data": resp}
        
        # Execute the query
        resp = await function(query=overall_ctc_statistics_query_)        
        # Convert the response to a DataFrame for further processing
        resp = pd.DataFrame(resp)
        resp = await filter_data(resp, _filters)
        if resp.empty:
            return {"status": True, "message": "success", "data": []}
        resp = pd.merge(resp, df, on='JDEDistributorCode', how='left')
        # Fill missing values for numerical columns
        for each_float_col in ["ACTC","BCTC","NCTC"]:
            if each_float_col in resp.columns:
                resp[each_float_col] = resp[each_float_col].fillna(0.0)
        # Fill missing values for string columns
        for each_str_col in [
            "Category","ZOName","ROName","SAName","JDEDistributorCode"
        ]:
            if each_str_col in resp.columns:
                resp[each_str_col] = resp[each_str_col].fillna('').astype(str)

        if filters:
            resp["temp"] = "temp"
            resp_pie = resp.groupby(["temp"], as_index=False).agg({
                    "ACTC": "sum",
                    "BCTC": "sum",
                    "NCTC": "sum"
                })
            del resp_pie["temp"]
            
            grouped_resp = None
            filter_keys = [rec.key.strip('"') for rec in filters]

            if "Category" in filter_keys and "ZOName" not in filter_keys:    
                grouped_resp = resp.groupby(["Category","ZOName"], as_index=False).agg({
                    "ACTC": "sum",
                    "BCTC": "sum",
                    "NCTC": "sum"
                })

            elif "Category" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.groupby(["Category","ZOName","ROName"], as_index=False).agg({
                    "ACTC": "sum",
                    "BCTC": "sum",
                    "NCTC": "sum"
                })
            
            elif "Category" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.groupby(["Category","ZOName","ROName","SAName"],
                as_index=False).agg({
                    "ACTC": "sum",
                    "BCTC": "sum",
                    "NCTC": "sum"
                    })
            elif "Category" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "JDEDistributorCode" not in filter_keys:
                grouped_resp = resp.groupby(["Category","ZOName","ROName","SAName","JDEDistributorCode"],
                as_index=False).agg({
                    "ACTC": "sum",
                    "BCTC": "sum",
                    "NCTC": "sum"
                    })
            if grouped_resp is not None:
                return {"status": True, "message": "success", "data_pie": resp_pie.to_dict(orient='records'), "data": grouped_resp.to_dict(orient='records')}
        return {"status": True, "message": "success", "data_pie": resp_pie.to_dict(orient='records'), "data": resp.to_dict(orient='records')}
    
    
    @staticmethod
    async def lpg_cdcms_daywise_overall_ctc_statistics(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        daywise_overall_ctc_statistics_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_daywise_overall_ctc_statistics")
        _filters = []
        daterange = None
        if cross_filters:
            for filter in cross_filters:
                if "DATE" in filter.key:
                    daterange = f" '{filter.value.split(",")[0]}' AND '{filter.value.split(",")[-1]}' "
                    continue
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                daywise_overall_ctc_statistics_query_ += ' WHERE '
                daywise_overall_ctc_statistics_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            daywise_overall_ctc_statistics_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(daywise_overall_ctc_statistics_query_, access_filters, drill_state)
            daywise_overall_ctc_statistics_query_ += ' GROUP BY TO_CHAR("Execution_Datetime", \'Month\'), "ZoneNames", "ROName", "SAName", "SubCategory" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            daywise_overall_ctc_statistics_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(daywise_overall_ctc_statistics_query_, access_filters, drill_state)
            daywise_overall_ctc_statistics_query_ += ' GROUP BY TO_CHAR("Execution_Datetime", \'Month\'), "ZoneNames", "ROName", "SAName", "SubCategory" '
        try:
            query_resp = await function(query=daywise_overall_ctc_statistics_query_)
            resp = pl.DataFrame(query_resp)
            resp = await filter_data(resp.to_pandas(), _filters)
            resp = pl.from_pandas(resp)
            for col in ["ACTC", "BCTC", "NCTC"]:                
                resp = resp.with_columns(pl.col(col).fill_null(0).cast(pl.Float64).alias(col))
            
            resp = resp.group_by(["Month"]).agg([
                    pl.sum("ACTC").round(2).alias("ACTC"),
                    pl.sum("BCTC").round(2).alias("BCTC"),
                    pl.sum("NCTC").round(2).alias("NCTC"),
                ])
            numerical_columns = ["ACTC", "BCTC", "NCTC"]
            string_columns = ["ZOName", "ROName", "SAName", "ConsumerType"]
            for col in numerical_columns:
                if col in resp.columns:
                    resp = resp.with_columns(pl.col(col).fill_null(0.0))
            for col in string_columns:
                if col in resp.columns:
                    resp = resp.with_columns(pl.col(col).fill_null("").cast(pl.Utf8))
            
            resp = resp.with_columns(pl.col("Month").str.strip_chars().alias("Month"))
            resp = resp.to_dicts()
            month_order = ['April', 'May', 'June', 'July', 'August', 'September', 
                           'October', 'November', 'December', 'January', 'February', 'March']
            resp.sort(key=lambda x: month_order.index(x['Month']))
            
            return {"status": True, "message": "success", "data": resp}
        except Exception as e:
            print(f"Error executing query: {e}")
            return {"status": False, "message": f"Error: {e}"}
    
    
    @staticmethod
    async def lpg_cdcms_safety_check_pending(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        df = pd.read_csv("/opt/ceg/algo/DistributorMappings.csv")
        overall_safety_check_pending_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_safety_check_pending")
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                overall_safety_check_pending_query_ += ' WHERE '
                overall_safety_check_pending_query_ += ' AND '.join(conditions)
            overall_safety_check_pending_query_  += f' AND "ZOName"  NOT IN (\'Null\') AND "Category" IN (\'Domestic\')'
            overall_safety_check_pending_query_ += ' GROUP BY "SubCategory", "ZOName", "ROName", "SAName", "JDEDistributorCode"'
        else:
            if not "where" in overall_safety_check_pending_query_.lower():
                overall_safety_check_pending_query_  += f' WHERE "ZOName"  NOT IN (\'Null\') AND "Category" IN (\'Domestic\')'
            else:
                overall_safety_check_pending_query_  += f' AND "ZOName"  NOT IN (\'Null\') AND "Category" IN (\'Domestic\')'
            overall_safety_check_pending_query_ += ' GROUP BY "SubCategory", "ZOName", "ROName", "SAName", "JDEDistributorCode"'
            
            resp = await function(query=overall_safety_check_pending_query_)
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)
            resp = await filter_data(resp, _filters)
            if resp.empty:
                return {"status": True, "message": "success", "data": []}
            pie_resp = resp.groupby(["SubCategory"], as_index=False).agg({
                    "SafetyCheckPending": "sum"
                })
            resp = resp.groupby(["ZOName"], as_index=False).agg({
                    "SafetyCheckPending": "sum"
                })
            # Fill missing values for numerical columns
            for each_float_col in ["SafetyCheckPending"]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)
            for each_str_col in ["SubCategory"]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
            return {"status": True, "message": "success", "data_pie": pie_resp.to_dict(orient='records'), "data": resp.to_dict(orient='records')}
        resp = await function(query=overall_safety_check_pending_query_)
        resp = pd.DataFrame(resp)
        resp = await filter_data(resp, _filters)
        pie_resp = resp.groupby(["SubCategory"], as_index=False).agg({
                    "SafetyCheckPending": "sum"
                })
        resp = pd.merge(resp, df, on='JDEDistributorCode', how='left')
        # Fill missing values for numerical columns
        for each_float_col in [
            "SafetyCheckPending"
        ]:
            if each_float_col in resp.columns:
                resp[each_float_col] = resp[each_float_col].fillna(0.0)

        # Fill missing values for string columns
        for each_str_col in [
            "SubCategory","ZOName","ROName","SAName","JDEDistributorCode"
        ]:
            if each_str_col in resp.columns:
                resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
        if filters:
            grouped_resp = None
            filter_keys = [rec.key.strip('"') for rec in filters]
            if "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.groupby(["ZOName","ROName"], as_index=False).agg({
                    "SafetyCheckPending": "sum"
                })
            elif "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.groupby(["ZOName","ROName","SAName"],
                as_index=False).agg({
                    "SafetyCheckPending": "sum"
                    })
            elif "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.groupby(["ZOName","ROName","SAName","DistributorName"],
                as_index=False).agg({
                    "SafetyCheckPending": "sum"
                    })
            if grouped_resp is not None:
                return {"status": True, "message": "success", "data_pie": pie_resp.to_dict(orient='records'), "data": grouped_resp.to_dict(orient='records')}
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
    
    
    @staticmethod
    async def lpg_cdcms_consumer_statistics_table(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        lpg_consumer_table_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_consumer_statistics_table")
        if not filters and not cross_filters:
            lpg_consumer_table_ += f' WHERE "ZOName" IS NOT NULL'
            lpg_consumer_table_ += ' GROUP BY "ZoneNames", "CylinderType", "SubCategory" '
        resp = await function(query=lpg_consumer_table_)
        if not resp:
            return {"status": True, "message": "No data available", "data": []}
        resp = pd.DataFrame(resp)
        for each_float_col in ["Total_Consumers", "eKYCCompleted", "eKYCPending", "SafetyCheckPending","SuvidhaClub"]:
            if each_float_col in resp.columns:
                resp[each_float_col] = resp[each_float_col].fillna(0.0)
        for each_str_col in ["ZoneNames", "CylinderType", "SubCategory"]:
            if each_str_col in resp.columns:
                resp[each_str_col] = resp[each_str_col].fillna("").astype(str)
        resp = resp.groupby(["ZoneNames", "CylinderType", "SubCategory"], as_index=False).agg({
            "Total_Consumers": "sum",
            "eKYCCompleted": "sum",
            "eKYCPending": "sum",
            "SafetyCheckPending": "sum",
            "SuvidhaClub": "sum"

        })
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
    
    

############################################################# SUBSIDY FAILURE STATISTICS ########################################################
    @staticmethod
    async def lpg_cdcms_subsidy_failure_stats(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        lpg_failure_stats_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_subsidy_failure_stats")
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if filters:
            filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSubsidyFailureData.get_clause_conditions(formated=True)]
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)

            if conditions:
                lpg_failure_stats_  += ' WHERE '
                lpg_failure_stats_  += ' AND '.join(conditions)
            lpg_failure_stats_  += ' AND "ZOName" IS NOT NULL'
            lpg_failure_stats_  += ' GROUP BY "ZOName", "ROName", "SAName", "DistributorName", "PaymentErrorName"'
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSubsidyFailureData.get_clause_conditions(formated=True)]
            lpg_failure_stats_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_failure_stats_, access_filters, drill_state)
            if "where" not in lpg_failure_stats_.lower():
                lpg_failure_stats_  += ' WHERE "ZOName" IS NOT NULL'
            else:
                lpg_failure_stats_  += ' AND "ZOName" IS NOT NULL'
            lpg_failure_stats_  += ' GROUP BY "ZOName", "ROName", "SAName", "DistributorName", "PaymentErrorName"'
            resp = await function(query=lpg_failure_stats_)
            resp = pd.DataFrame(resp)
            resp = await filter_data(resp, _filters)
            if resp.empty:
                return {"status": True, "message": "success", "data": []}
            resp = resp.groupby(["PaymentErrorName"], as_index=False
                                ).agg({"Consumers": "sum","Refills": "sum" })
            for each_float_col in ["Consumers", "Refills"]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)
            for each_str_col in [
                "ZOName", "ROName", "SAName", "DistributorName", "PaymentErrorName"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
            return {"status": True, "message": "success", "data": resp}

        # Execute the query
        resp = await function(query=lpg_failure_stats_ )
        if resp:
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)
            resp = await filter_data(resp, _filters)
            for each_float_col in ["Consumers", "Refills"]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)

            for each_str_col in ["ZOName", "ROName", "SAName", "DistributorName", "PaymentErrorName"]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)

            if filters:
                grouped_resp = None
                filter_keys = [rec.key.strip('"') for rec in filters]
                if "PaymentErrorName" in filter_keys  and "ZOName" not in filter_keys:
                    grouped_resp = resp.groupby(["PaymentErrorName","ZOName"], as_index=False).agg({
                        "Consumers": "sum","Refills": "sum" })
                if "PaymentErrorName" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                    grouped_resp = resp.groupby(["PaymentErrorName", "ZOName", "ROName"], as_index=False).agg({
                        "Consumers": "sum","Refills": "sum"})
                elif "PaymentErrorName" in filter_keys  and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                    grouped_resp = resp.groupby(["PaymentErrorName","ZOName", "ROName", "SAName"], as_index=False).agg({
                        "Consumers": "sum","Refills": "sum"})
                elif "PaymentErrorName" in filter_keys  and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                    grouped_resp = resp.groupby(["PaymentErrorName","ZOName", "ROName", "SAName", "DistributorName"],
                                                as_index=False).agg({"Consumers": "sum","Refills": "sum"})
                if grouped_resp is not None:
                    return {"status": True, "message": "success", "data": grouped_resp.to_dict(orient='records')}

        else:
            return {"status": True, "message":"success", "data":[]}
        # If no filters are applied, return the default response
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}    
    
    
    @staticmethod
    async def lpg_cdcms_daywise_subsidy_failure_statistics(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        if not drill_state=='financial_year':
            daywise_failure_stats_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_daywise_subsidy_failure_statistics")
        else:
            daywise_failure_stats_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_daywise_subsidy_failure_statistics_m")
        _filters = []
        daterange = None
        if cross_filters:
            for filter in cross_filters:
                if "DATE" in filter.key:
                    daterange = f" '{filter.value.split(",")[0]}' AND '{filter.value.split(",")[-1]}' "
                    continue
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                daywise_failure_stats_query_ += ' WHERE '
                daywise_failure_stats_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            daywise_failure_stats_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(daywise_failure_stats_query_, access_filters, drill_state)
            if not daterange and not drill_state == "financial_year":
                daywise_failure_stats_query_ += ' AND "Delivery_Date" >= CURRENT_DATE - INTERVAL \'130 Day\' AND "Delivery_Date" <= NOW() '
            if daterange and not drill_state == "financial_year":
                daywise_failure_stats_query_ += f' AND "Delivery_Date" BETWEEN {daterange} '
            if not drill_state == "financial_year":
                daywise_failure_stats_query_ += ' GROUP BY "Delivery_Date", "ZOName", "ROName", "SAName", "DistributorName", "PaymentErrorName", "Financial_Year" '
            else:
                daywise_failure_stats_query_ += ' GROUP BY "Month", "ZOName", "ROName", "SAName", "DistributorName", "PaymentErrorName", "Financial_Year" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            daywise_failure_stats_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(daywise_failure_stats_query_, access_filters, drill_state)
            if not "where" in daywise_failure_stats_query_.lower() and not daterange and not drill_state == "financial_year":
                daywise_failure_stats_query_ += ' WHERE "Delivery_Date" >= CURRENT_DATE - INTERVAL \'130 Day\' AND "Delivery_Date" <= NOW() '
            elif not "where" in daywise_failure_stats_query_.lower() and daterange and not drill_state == "financial_year":
                daywise_failure_stats_query_ += f' WHERE "Delivery_Date" BETWEEN {daterange} '
            elif not daterange and not drill_state == "financial_year":
                daywise_failure_stats_query_ += ' AND "Delivery_Date" >= CURRENT_DATE - INTERVAL \'130 Day\' AND "Delivery_Date" <= NOW() '
            elif daterange and not drill_state == "financial_year":
                daywise_failure_stats_query_ += f' AND "Delivery_Date" BETWEEN {daterange} '
            if not drill_state == "financial_year":
                daywise_failure_stats_query_ += ' GROUP BY "Delivery_Date", "ZOName", "ROName", "SAName", "DistributorName", "PaymentErrorName", "Financial_Year" '
            else:
                daywise_failure_stats_query_ += ' GROUP BY "Month", "ZOName", "ROName", "SAName", "DistributorName", "PaymentErrorName", "Financial_Year" '
        try:
            query_resp = await function(query=daywise_failure_stats_query_)
            resp = pl.DataFrame(query_resp)
            resp = await filter_data(resp.to_pandas(), _filters)
            resp = pl.from_pandas(resp)
            resp = resp.with_columns(pl.col('Refills').fill_null(0).cast(pl.Float64).alias('Refills'))
            if drill_state == "financial_year":
                resp = resp.group_by(["Month", "Financial_Year"]).agg([
                        pl.sum("Refills").round(2).alias("Refills"),
                    ])
            else:
                resp = resp.group_by(["Delivery_Date", "PaymentErrorName"]).agg([
                        pl.sum("Refills").round(2).alias("Refills"),
                    ])
                resp = resp.with_columns(pl.col("Delivery_Date").dt.strftime("%Y-%m-%d").alias("Delivery_Date"))
            numerical_columns = ["Refills"]
            string_columns = ["Delivery_Date"]
            for col in numerical_columns:
                if col in resp.columns:
                    resp = resp.with_columns(pl.col(col).fill_null(0.0))
            for col in string_columns:
                if col in resp.columns:
                    resp = resp.with_columns(pl.col(col).fill_null("").cast(pl.Utf8))
            return {"status": True, "message": "success", "data": resp.to_dicts()}
        except Exception as e:
            print(f"Error executing query: {e}")
            return {"status": False, "message": f"Error: {e}"}
    
    
    @staticmethod
    async def lpg_cdcms_exception_stats(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        lpg_exception_stats_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_exception_stats")
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if filters:
            filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSubsidyExceptionData.get_clause_conditions(formated=True)]
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)

            if conditions:
                lpg_exception_stats_  += ' WHERE '
                lpg_exception_stats_  += ' AND '.join(conditions)
            lpg_exception_stats_  += ' AND "ZOName" IS NOT NULL'
            lpg_exception_stats_  += ' GROUP BY "ZOName", "ROName", "SAName", "DistributorName","ExceptionName"'
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSubsidyExceptionData.get_clause_conditions(formated=True)]
            lpg_exception_stats_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_exception_stats_, access_filters, drill_state)
            if "where" not in lpg_exception_stats_.lower():
                lpg_exception_stats_  += ' WHERE "ZOName" IS NOT NULL'
            else:
                lpg_exception_stats_  += ' AND "ZOName" IS NOT NULL'
            lpg_exception_stats_  += ' GROUP BY "ZOName", "ROName", "SAName", "DistributorName", "ExceptionName"'
            resp = await function(query=lpg_exception_stats_ )
            resp = pd.DataFrame(resp)
            resp = await filter_data(resp, _filters)
            if resp.empty:
                return {"status": True, "message": "success", "data": []}
            resp = resp.groupby(["ExceptionName"], as_index=False
                                ).agg({"Consumers": "sum","Refills": "sum" })
            
            for each_float_col in ["Consumers", "Refills"]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)
            resp["ExceptionName"] = resp["ExceptionName"].fillna('').astype(str)
            return {"status": True, "message": "success", "data": resp}
        resp = await function(query=lpg_exception_stats_)
        if resp:
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)
            resp = await filter_data(resp, _filters)
            for each_float_col in ["Consumers", "Refills"]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)
            for each_str_col in ["ZOName", "ROName", "SAName", "DistributorName", "ExceptionName"]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
            if filters:
                grouped_resp = None
                filter_keys = [rec.key.strip('"') for rec in filters]
                if "ExceptionName" in filter_keys  and "ZOName" not in filter_keys:
                    grouped_resp = resp.groupby(["ExceptionName","ZOName"], as_index=False).agg({
                        "Consumers": "sum","Refills": "sum" })
                if "ExceptionName" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                    grouped_resp = resp.groupby(["ExceptionName", "ZOName", "ROName"], as_index=False).agg({
                        "Consumers": "sum","Refills": "sum"})
                elif "ExceptionName" in filter_keys  and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                    grouped_resp = resp.groupby(["ExceptionName","ZOName", "ROName", "SAName"], as_index=False).agg({
                        "Consumers": "sum","Refills": "sum"})
                elif "ExceptionName" in filter_keys  and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                    grouped_resp = resp.groupby(["ExceptionName","ZOName", "ROName", "SAName", "DistributorName"],
                                                as_index=False).agg({"Consumers": "sum","Refills": "sum"})
                if grouped_resp is not None:
                    return {"status": True, "message": "success", "data": grouped_resp.to_dict(orient='records')}
        else:
            return {"status": True, "message":"success", "data":[]}
        # If no filters are applied, return the default response
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
    
    
    @staticmethod
    async def lpg_cdcms_daywise_subsidy_exception_statistics(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        if not drill_state=='financial_year':
            daywise_exception_stats_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_daywise_subsidy_exception_statistics")
        else:
            daywise_exception_stats_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_daywise_subsidy_exception_statistics_m")
        _filters = []
        daterange = None
        if cross_filters:
            for filter in cross_filters:
                if "DATE" in filter.key:
                    daterange = f" '{filter.value.split(",")[0]}' AND '{filter.value.split(",")[-1]}' "
                    continue
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                daywise_exception_stats_query_ += ' WHERE '
                daywise_exception_stats_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            daywise_exception_stats_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(daywise_exception_stats_query_, access_filters, drill_state)
            if not daterange and not drill_state == "financial_year":
                daywise_exception_stats_query_ += ' AND "Delivery_Date" >= CURRENT_DATE - INTERVAL \'130 Day\' AND "Delivery_Date" <= NOW() '
            elif daterange and not drill_state == "financial_year":
                daywise_exception_stats_query_ += f' AND "Delivery_Date" BETWEEN {daterange} '
            if not drill_state == "financial_year":
                daywise_exception_stats_query_ += ' GROUP BY "Delivery_Date", "Month", "ZOName", "ROName", "SAName", "DistributorName", "ExceptionName", "Financial_Year" '
            else:
                daywise_exception_stats_query_ += ' GROUP BY "Month", "ZOName", "ROName", "SAName", "DistributorName", "ExceptionName", "Financial_Year" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            daywise_exception_stats_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(daywise_exception_stats_query_, access_filters, drill_state)
            if not "where" in daywise_exception_stats_query_.lower() and not daterange and not drill_state == "financial_year":
                daywise_exception_stats_query_ += ' WHERE "Delivery_Date" >= CURRENT_DATE - INTERVAL \'130 Day\' AND "Delivery_Date" <= NOW() '
            elif not "where" in daywise_exception_stats_query_.lower() and daterange and not drill_state == "financial_year":
                daywise_exception_stats_query_ += f' WHERE "Delivery_Date" BETWEEN {daterange} '
            elif not daterange and not drill_state == "financial_year":
                daywise_exception_stats_query_ += ' AND "Delivery_Date" >= CURRENT_DATE - INTERVAL \'130 Day\' AND "Delivery_Date" <= NOW() '
            elif daterange and not drill_state == "financial_year":
                daywise_exception_stats_query_ += f' AND "Delivery_Date" BETWEEN {daterange} '
            if not drill_state == "financial_year":
                daywise_exception_stats_query_ += ' GROUP BY "Delivery_Date", "Month", "ZOName", "ROName", "SAName", "DistributorName", "ExceptionName", "Financial_Year" '
            else:
                daywise_exception_stats_query_ += ' GROUP BY "Month", "ZOName", "ROName", "SAName", "DistributorName", "ExceptionName", "Financial_Year" '
        try:    
            query_resp = await function(query=daywise_exception_stats_query_)
            resp = pl.DataFrame(query_resp)
            resp = await filter_data(resp.to_pandas(), _filters)
            resp = pl.from_pandas(resp)
            resp = resp.with_columns(pl.col('Refills').fill_null(0).cast(pl.Float64).alias('Refills'))
            if drill_state == "financial_year":
                resp = resp.group_by(["Month", "Financial_Year"]).agg([
                        pl.sum("Refills").round(2).alias("Refills"),
                    ])
            else:
                resp = resp.group_by(["Delivery_Date", "ExceptionName"]).agg([
                        pl.sum("Refills").round(2).alias("Refills"),
                    ])
                resp = resp.with_columns(pl.col("Delivery_Date").dt.strftime("%Y-%m-%d").alias("Delivery_Date"))
            numerical_columns = ["Refills"]
            string_columns = ["Delivery_Date"]
            for col in numerical_columns:
                if col in resp.columns:
                    resp = resp.with_columns(pl.col(col).fill_null(0.0))
            for col in string_columns:
                if col in resp.columns:
                    resp = resp.with_columns(pl.col(col).fill_null("").cast(pl.Utf8))
            return {"status": True, "message": "success", "data": resp.to_dicts()}
        except Exception as e:
            print(f"Error executing query: {e}")
            return {"status": False, "message": f"Error: {e}"}

    
    @staticmethod
    async def lpg_cdcms_subsidy_central_consumers(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        financial_year = await get_financial_year()
        _filters = []
        _fy = False
        if cross_filters:
            for filter in cross_filters:
                if "Financial_Year" in filter.key:
                    _fy = True
                _filters.append({f"{filter.key}": f"{filter.value}"})
        lpg_cdcms_subsidy_central_consumers_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_subsidy_central_consumers")
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                lpg_cdcms_subsidy_central_consumers_query_ += ' WHERE ' 
                lpg_cdcms_subsidy_central_consumers_query_ += ' AND '.join(conditions)
                        
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_central_consumers_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_central_consumers_query_, access_filters, drill_state)
            if not _fy:
                lpg_cdcms_subsidy_central_consumers_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_central_consumers_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_central_consumers_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_central_consumers_query_, access_filters, drill_state)
            if "where" not in lpg_cdcms_subsidy_central_consumers_query_.lower() and not _fy:
                lpg_cdcms_subsidy_central_consumers_query_ += f' WHERE "Financial_Year" IN (\'{financial_year}\')'
            elif not _fy:
                lpg_cdcms_subsidy_central_consumers_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_central_consumers_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        resp = await function(query=lpg_cdcms_subsidy_central_consumers_query_)
        resp = pl.DataFrame(resp)
        resp = await filter_data(resp.to_pandas(), _filters)
        resp = pl.from_pandas(resp)
        numerical_columns = ["month_number", "consumer_count"]
        string_columns = ["ConsumerType", "Month", "ZOName", "ROName", "SAName", "DistributorName"]

        for col in numerical_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null(0.0))

        for col in string_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null("").cast(pl.Utf8))
        if filters:
            filter_keys = [rec.key.strip('"') for rec in filters]
            grouped_resp = None
            if "Month" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName"]).agg([
                    pl.sum("consumer_count").alias("consumer_count"),
                ])
                _index = "ZOName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName"]).agg([
                    pl.sum("consumer_count").alias("consumer_count"),
                ])
                _index = "ROName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName", "SAName"]).agg([
                    pl.sum("consumer_count").alias("consumer_count"),
                ])
                _index = "SAName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName", "SAName", "DistributorName"]).agg([
                    pl.sum("consumer_count").alias("consumer_count"),
                ])
                _index = "DistributorName"
            if grouped_resp is not None:
                grouped_resp = grouped_resp.with_columns(pl.col("consumer_count").fill_null(0).cast(pl.Float64).alias("consumer_count"))
                grouped_resp = grouped_resp.pivot(index=_index, on="ConsumerType", values="consumer_count")
                grouped_resp = grouped_resp.with_columns(pl.all().fill_null(0))
                result = []
                for row in grouped_resp.iter_rows(named=True):
                    result.append({
                        "PMUY": row.get("PMUY", 0),
                        "NPMUY": row.get("NPMUY", 0),
                        _index: row.get(_index, "")
                    })
                return {"status": True, "message": "success", "data": result}
        resp = resp.group_by(["ConsumerType", "Month"]).agg([
                pl.sum("consumer_count").alias("consumer_count"),
                pl.first("month_number").alias("month_number"),
            ])
        resp = resp.sort("month_number")
        resp = resp.with_columns(pl.col("consumer_count").fill_null(0).cast(pl.Float64).alias("consumer_count"))
        resp = resp.pivot(index="Month", on="ConsumerType", values="consumer_count")
        _index = "Month"
        result = []
        for row in resp.iter_rows(named=True):
            result.append({
                "PMUY": row.get("PMUY", 0),
                "NPMUY": row.get("NPMUY", 0),
                _index: row.get(_index, "")
            })
        return {"status": True, "message": "success", "data": result}

    
    @staticmethod
    async def lpg_cdcms_subsidy_central_transaction(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        financial_year = await get_financial_year()
        _filters = []
        _fy = False
        if cross_filters:
            for filter in cross_filters:
                if "Financial_Year" in filter.key:
                    _fy = True
                _filters.append({f"{filter.key}": f"{filter.value}"})
        lpg_cdcms_subsidy_central_transaction_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_subsidy_central_transaction")
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                lpg_cdcms_subsidy_central_transaction_query_ += ' WHERE ' 
                lpg_cdcms_subsidy_central_transaction_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_central_transaction_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_central_transaction_query_, access_filters, drill_state)
            if not _fy:
                lpg_cdcms_subsidy_central_transaction_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_central_transaction_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '            
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_central_transaction_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_central_transaction_query_, access_filters, drill_state)
            if "where" not in lpg_cdcms_subsidy_central_transaction_query_.lower() and not _fy:
                lpg_cdcms_subsidy_central_transaction_query_ += f' WHERE "Financial_Year" IN (\'{financial_year}\')'
            elif not _fy:
                lpg_cdcms_subsidy_central_transaction_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_central_transaction_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        resp = await function(query=lpg_cdcms_subsidy_central_transaction_query_)
        resp = pl.DataFrame(resp)
        resp = await filter_data(resp.to_pandas(), _filters)
        resp = pl.from_pandas(resp) 
        numerical_columns = ["month_number", "transaction_count"]
        string_columns = ["Month", "ZOName", "ROName", "SAName", "DistributorName"]

        for col in numerical_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null(0.0))

        for col in string_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null("").cast(pl.Utf8))
        if filters:
            filter_keys = [rec.key.strip('"') for rec in filters]
            grouped_resp = None
            if "Month" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName"]).agg([
                    pl.sum("transaction_count").alias("transaction_count"),
                ])
                _index = "ZOName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName"]).agg([
                    pl.sum("transaction_count").alias("transaction_count"),
                ])
                _index = "ROName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName", "SAName"]).agg([
                    pl.sum("transaction_count").alias("transaction_count"),
                ])
                _index = "SAName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName", "SAName", "DistributorName"]).agg([
                    pl.sum("transaction_count").alias("transaction_count"),
                ])
                _index = "DistributorName"
            if grouped_resp is not None:
                grouped_resp = grouped_resp.with_columns(pl.col("transaction_count").fill_null(0).cast(pl.Float64).alias("transaction_count"))
                grouped_resp = grouped_resp.pivot(index=_index, on="ConsumerType", values="transaction_count")
                grouped_resp = grouped_resp.with_columns(pl.all().fill_null(0))
                result = []
                for row in grouped_resp.iter_rows(named=True):
                    result.append({
                        "PMUY": row.get("PMUY", 0),
                        "NPMUY": row.get("NPMUY", 0),
                        _index: row.get(_index, "")
                    })
                return {"status": True, "message": "success", "data": result}
        resp = resp.group_by(["ConsumerType", "Month"]).agg([
                pl.sum("transaction_count").alias("transaction_count"),
                pl.first("month_number").alias("month_number"),
            ])
        resp = resp.sort("month_number")
        resp = resp.with_columns(pl.col("transaction_count").fill_null(0).cast(pl.Float64).alias("transaction_count"))
        resp = resp.pivot(index="Month", on="ConsumerType", values="transaction_count")
        _index = "Month"
        result = []
        for row in resp.iter_rows(named=True):
            result.append({
                "PMUY": row.get("PMUY", 0),
                "NPMUY": row.get("NPMUY", 0),
                _index: row.get(_index, "")
            })
        return {"status": True, "message": "success", "data": result}
    
    
    @staticmethod
    async def lpg_cdcms_subsidy_central_amount(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        financial_year = await get_financial_year()
        _filters = []
        _fy = False
        if cross_filters:
            for filter in cross_filters:
                if "Financial_Year" in filter.key:
                    _fy = True
                _filters.append({f"{filter.key}": f"{filter.value}"})
        lpg_cdcms_subsidy_central_amount_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_subsidy_central_amount")
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                lpg_cdcms_subsidy_central_amount_query_ += ' WHERE ' 
                lpg_cdcms_subsidy_central_amount_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_central_amount_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_central_amount_query_, access_filters, drill_state)
            if not _fy:
                lpg_cdcms_subsidy_central_amount_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_central_amount_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_central_amount_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_central_amount_query_, access_filters, drill_state)
            if "where" not in lpg_cdcms_subsidy_central_amount_query_.lower() and not _fy:
                lpg_cdcms_subsidy_central_amount_query_ += f' WHERE "Financial_Year" IN (\'{financial_year}\')'
            elif not _fy:
                lpg_cdcms_subsidy_central_amount_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_central_amount_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        resp = await function(query=lpg_cdcms_subsidy_central_amount_query_)
        resp = pl.DataFrame(resp)
        resp = await filter_data(resp.to_pandas(), _filters)
        resp = pl.from_pandas(resp)
        numerical_columns = ["month_number", "SubsidyAmount"]
        string_columns = ["ConsumerType", "Month", "ZOName", "ROName", "SAName", "DistributorName"]

        for col in numerical_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null(0.0))

        for col in string_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null("").cast(pl.Utf8))
        if filters:
            filter_keys = [rec.key.strip('"') for rec in filters]
            grouped_resp = None
            if "Month" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName"]).agg([
                    pl.sum("SubsidyAmount").alias("SubsidyAmount"),
                ])
                _index = "ZOName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName"]).agg([
                    pl.sum("SubsidyAmount").alias("SubsidyAmount"),
                ])
                _index = "ROName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName", "SAName"]).agg([
                    pl.sum("SubsidyAmount").alias("SubsidyAmount"),
                ])
                _index = "SAName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName", "SAName", "DistributorName"]).agg([
                    pl.sum("SubsidyAmount").alias("SubsidyAmount"),
                ])
                _index = "DistributorName"
            if grouped_resp is not None:
                grouped_resp = grouped_resp.with_columns(pl.col("SubsidyAmount").fill_null(0).cast(pl.Float64).alias("SubsidyAmount"))
                grouped_resp = grouped_resp.pivot(index=_index, on="ConsumerType", values="SubsidyAmount")
                grouped_resp = grouped_resp.with_columns(pl.all().fill_null(0))
                result = []
                for row in grouped_resp.iter_rows(named=True):
                    result.append({
                        "PMUY": row.get("PMUY", 0),
                        "NPMUY": row.get("NPMUY", 0),
                        _index: row.get(_index, "")
                    })
                return {"status": True, "message": "success", "data": result}
        resp = resp.group_by(["ConsumerType", "Month"]).agg([
                pl.sum("SubsidyAmount").alias("SubsidyAmount"),
                pl.first("month_number").alias("month_number"),
            ])
        resp = resp.sort("month_number")
        resp = resp.with_columns(pl.col("SubsidyAmount").fill_null(0).cast(pl.Float64).alias("SubsidyAmount"))
        resp = resp.pivot(index="Month", on="ConsumerType", values="SubsidyAmount")
        _index = "Month"
        result = []
        for row in resp.iter_rows(named=True):
            result.append({
                "PMUY": row.get("PMUY", 0),
                "NPMUY": row.get("NPMUY", 0),
                _index: row.get(_index, "")
            })
        return {"status": True, "message": "success", "data": result}
    
    
    @staticmethod
    async def lpg_cdcms_subsidy_state_consumers(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        financial_year = await get_financial_year()
        _filters = []
        _fy = False
        if cross_filters:
            for filter in cross_filters:
                if "Financial_Year" in filter.key:
                    _fy = True
                _filters.append({f"{filter.key}": f"{filter.value}"})
        lpg_cdcms_subsidy_state_consumers_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_subsidy_state_consumers")
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                lpg_cdcms_subsidy_state_consumers_query_ += ' WHERE ' 
                lpg_cdcms_subsidy_state_consumers_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_state_consumers_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_state_consumers_query_, access_filters, drill_state)            
            if not _fy:
                lpg_cdcms_subsidy_state_consumers_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_state_consumers_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_state_consumers_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_state_consumers_query_, access_filters, drill_state)            
            if "where" not in lpg_cdcms_subsidy_state_consumers_query_.lower() and not _fy:
                lpg_cdcms_subsidy_state_consumers_query_ += f' WHERE "Financial_Year" IN (\'{financial_year}\')'
            elif not _fy:
                lpg_cdcms_subsidy_state_consumers_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_state_consumers_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        resp = await function(query=lpg_cdcms_subsidy_state_consumers_query_)
        resp = pl.DataFrame(resp)
        resp = await filter_data(resp.to_pandas(), _filters)
        resp = pl.from_pandas(resp)
        numerical_columns = ["month_number", "consumer_count"]
        string_columns = ["ConsumerType", "Month", "ZOName", "ROName", "SAName", "DistributorName"]

        for col in numerical_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null(0.0))

        for col in string_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null("").cast(pl.Utf8))
        if filters:
            filter_keys = [rec.key.strip('"') for rec in filters]
            grouped_resp = None
            if "Month" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName"]).agg([
                    pl.sum("consumer_count").alias("consumer_count"),
                ])
                _index = "ZOName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName"]).agg([
                    pl.sum("consumer_count").alias("consumer_count"),
                ])
                _index = "ROName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName", "SAName"]).agg([
                    pl.sum("consumer_count").alias("consumer_count"),
                ])
                _index = "SAName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName", "SAName", "DistributorName"]).agg([
                    pl.sum("consumer_count").alias("consumer_count"),
                ])
                _index = "DistributorName"
            if grouped_resp is not None:
                grouped_resp = grouped_resp.with_columns(pl.col("consumer_count").fill_null(0).cast(pl.Float64).alias("consumer_count"))
                grouped_resp = grouped_resp.pivot(index=_index, on="ConsumerType", values="consumer_count")
                grouped_resp = grouped_resp.with_columns(pl.all().fill_null(0))
                result = []
                for row in grouped_resp.iter_rows(named=True):
                    result.append({
                        "PMUY": row.get("PMUY", 0),
                        "NPMUY": row.get("NPMUY", 0),
                        _index: row.get(_index, "")
                    })
                return {"status": True, "message": "success", "data": result}
        resp = resp.group_by(["ConsumerType", "Month"]).agg([
                pl.sum("consumer_count").alias("consumer_count"),
                pl.first("month_number").alias("month_number"),
            ])
        resp = resp.sort("month_number")
        resp = resp.with_columns(pl.col("consumer_count").fill_null(0).cast(pl.Float64).alias("consumer_count"))
        resp = resp.pivot(index="Month", on="ConsumerType", values="consumer_count")
        _index = "Month"
        result = []
        for row in resp.iter_rows(named=True):
            result.append({
                "PMUY": row.get("PMUY", 0),
                "NPMUY": row.get("NPMUY", 0),
                _index: row.get(_index, "")
            })
        return {"status": True, "message": "success", "data": result}
    
    
    @staticmethod
    async def lpg_cdcms_subsidy_state_consumers_stacked_state(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        financial_year = await get_financial_year()
        _filters = []
        _fy = False
        if cross_filters:
            for filter in cross_filters:
                if "Financial_Year" in filter.key:
                    _fy = True
                _filters.append({f"{filter.key}": f"{filter.value}"})
        lpg_cdcms_subsidy_state_consumers_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_subsidy_state_consumers")
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                lpg_cdcms_subsidy_state_consumers_query_ += ' WHERE ' 
                lpg_cdcms_subsidy_state_consumers_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_state_consumers_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_state_consumers_query_, access_filters, drill_state)
            if not _fy:
                lpg_cdcms_subsidy_state_consumers_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_state_consumers_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_state_consumers_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_state_consumers_query_, access_filters, drill_state)
            if "where" not in lpg_cdcms_subsidy_state_consumers_query_.lower() and not _fy:
                lpg_cdcms_subsidy_state_consumers_query_ += f' WHERE "Financial_Year" IN (\'{financial_year}\')'                
            elif not _fy:
                lpg_cdcms_subsidy_state_consumers_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_state_consumers_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        resp = await function(query=lpg_cdcms_subsidy_state_consumers_query_)
        resp = pl.DataFrame(resp)
        resp = await filter_data(resp.to_pandas(), _filters)
        resp = pl.from_pandas(resp)
        numerical_columns = ["month_number", "consumer_count"]
        string_columns = ["StateCode", "Month", "ZOName", "ROName", "SAName", "DistributorName"]
        for col in numerical_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null(0.0))
        for col in string_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null("").cast(pl.Utf8))
        if filters:
            filter_keys = [rec.key.strip('"') for rec in filters]
            grouped_resp = None
            if "Month" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.group_by(["StateCode", "Month", "ZOName"]).agg([
                    pl.sum("consumer_count").alias("consumer_count"),
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.group_by(["StateCode", "Month", "ZOName", "ROName"]).agg([
                    pl.sum("consumer_count").alias("consumer_count"),
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.group_by(["StateCode", "Month", "ZOName", "ROName", "SAName"]).agg([
                    pl.sum("consumer_count").alias("consumer_count"),
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.group_by(["StateCode", "Month", "ZOName", "ROName", "SAName", "DistributorName"]).agg([
                    pl.sum("consumer_count").alias("consumer_count"),
                ])
            if grouped_resp is not None:
                return {"status": True, "message": "success", "data": grouped_resp.to_dicts()}
        resp = resp.group_by(["StateCode", "Month"]).agg([
                pl.sum("consumer_count").alias("consumer_count"),
                pl.first("month_number").alias("month_number"),
            ])
        resp = resp.sort("month_number")
        return {"status": True, "message": "success", "data": resp.to_dicts()}
    
    
    @staticmethod
    async def lpg_cdcms_subsidy_state_transaction(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        financial_year = await get_financial_year()
        _filters = []
        _fy = False
        if cross_filters:
            for filter in cross_filters:
                if "Financial_Year" in filter.key:
                    _fy = True
                _filters.append({f"{filter.key}": f"{filter.value}"})
        lpg_cdcms_subsidy_state_transaction_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_subsidy_state_transaction")
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                lpg_cdcms_subsidy_state_transaction_query_ += ' WHERE ' 
                lpg_cdcms_subsidy_state_transaction_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_state_transaction_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_state_transaction_query_, access_filters, drill_state)
            if not _fy:
                lpg_cdcms_subsidy_state_transaction_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_state_transaction_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_state_transaction_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_state_transaction_query_, access_filters, drill_state)
            if "where" not in lpg_cdcms_subsidy_state_transaction_query_.lower() and not _fy:
                lpg_cdcms_subsidy_state_transaction_query_ += f' WHERE "Financial_Year" IN (\'{financial_year}\')'
            elif not _fy:
                lpg_cdcms_subsidy_state_transaction_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_state_transaction_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        resp = await function(query=lpg_cdcms_subsidy_state_transaction_query_)
        resp = pl.DataFrame(resp)
        resp = await filter_data(resp.to_pandas(), _filters)
        resp = pl.from_pandas(resp) 
        numerical_columns = ["month_number", "transaction_count"]
        string_columns = ["Month", "ZOName", "ROName", "SAName", "DistributorName"]

        for col in numerical_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null(0.0))

        for col in string_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null("").cast(pl.Utf8))
        if filters:
            filter_keys = [rec.key.strip('"') for rec in filters]
            grouped_resp = None
            if "Month" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName"]).agg([
                    pl.sum("transaction_count").alias("transaction_count"),
                ])
                _index = "ZOName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName"]).agg([
                    pl.sum("transaction_count").alias("transaction_count"),
                ])
                _index = "ROName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName", "SAName"]).agg([
                    pl.sum("transaction_count").alias("transaction_count"),
                ])
                _index = "SAName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName", "SAName", "DistributorName"]).agg([
                    pl.sum("transaction_count").alias("transaction_count"),
                ])
                _index = "DistributorName"
            if grouped_resp is not None:
                grouped_resp = grouped_resp.with_columns(pl.col("transaction_count").fill_null(0).cast(pl.Float64).alias("transaction_count"))
                grouped_resp = grouped_resp.pivot(index=_index, on="ConsumerType", values="transaction_count")
                grouped_resp = grouped_resp.with_columns(pl.all().fill_null(0))
                result = []
                for row in grouped_resp.iter_rows(named=True):
                    result.append({
                        "PMUY": row.get("PMUY", 0),
                        "NPMUY": row.get("NPMUY", 0),
                        _index: row.get(_index, "")
                    })
                return {"status": True, "message": "success", "data": result}
        resp = resp.group_by(["ConsumerType", "Month"]).agg([
                pl.sum("transaction_count").alias("transaction_count"),
                pl.first("month_number").alias("month_number"),
            ])
        resp = resp.sort("month_number")
        resp = resp.with_columns(pl.col("transaction_count").fill_null(0).cast(pl.Float64).alias("transaction_count"))
        resp = resp.pivot(index="Month", on="ConsumerType", values="transaction_count")
        _index = "Month"
        result = []
        for row in resp.iter_rows(named=True):
            result.append({
                "PMUY": row.get("PMUY", 0),
                "NPMUY": row.get("NPMUY", 0),
                _index: row.get(_index, "")
            })
        return {"status": True, "message": "success", "data": result}
    
    
    @staticmethod
    async def lpg_cdcms_subsidy_state_transaction_stacked_state(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        financial_year = await get_financial_year()
        _filters = []
        _fy = False
        if cross_filters:
            for filter in cross_filters:
                if "Financial_Year" in filter.key:
                    _fy = True
                _filters.append({f"{filter.key}": f"{filter.value}"})
        lpg_cdcms_subsidy_state_transaction_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_subsidy_state_transaction")
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                lpg_cdcms_subsidy_state_transaction_query_ += ' WHERE ' 
                lpg_cdcms_subsidy_state_transaction_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_state_transaction_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_state_transaction_query_, access_filters, drill_state)
            if not _fy:
                lpg_cdcms_subsidy_state_transaction_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_state_transaction_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_state_transaction_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_state_transaction_query_, access_filters, drill_state)
            if "where" not in lpg_cdcms_subsidy_state_transaction_query_.lower() and not _fy:
                lpg_cdcms_subsidy_state_transaction_query_ += f' WHERE "Financial_Year" IN (\'{financial_year}\')'
            elif not _fy:
                lpg_cdcms_subsidy_state_transaction_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_state_transaction_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        resp = await function(query=lpg_cdcms_subsidy_state_transaction_query_)
        resp = pl.DataFrame(resp)
        resp = await filter_data(resp.to_pandas(), _filters)
        resp = pl.from_pandas(resp) 
        numerical_columns = ["month_number", "transaction_count"]
        string_columns = ["Month", "ZOName", "ROName", "SAName", "DistributorName"]
        for col in numerical_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null(0.0))
        for col in string_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null("").cast(pl.Utf8))
        if filters:
            filter_keys = [rec.key.strip('"') for rec in filters]
            grouped_resp = None
            if "Month" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.group_by(["StateCode", "Month", "ZOName"]).agg([
                    pl.sum("transaction_count").alias("transaction_count"),
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.group_by(["StateCode", "Month", "ZOName", "ROName"]).agg([
                    pl.sum("transaction_count").alias("transaction_count"),
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.group_by(["StateCode", "Month", "ZOName", "ROName", "SAName"]).agg([
                    pl.sum("transaction_count").alias("transaction_count"),
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.group_by(["StateCode", "Month", "ZOName", "ROName", "SAName", "DistributorName"]).agg([
                    pl.sum("transaction_count").alias("transaction_count"),
                ])
            if grouped_resp is not None:
                return {"status": True, "message": "success", "data": grouped_resp.to_dicts()}
        resp = resp.group_by(["StateCode", "Month"]).agg([
                pl.sum("transaction_count").alias("transaction_count"),
                pl.first("month_number").alias("month_number"),
            ])
        resp = resp.sort("month_number")
        return {"status": True, "message": "success", "data": resp.to_dicts()}
    
    
    @staticmethod
    async def lpg_cdcms_subsidy_state_amount(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        financial_year = await get_financial_year()
        _filters = []
        _fy = False
        if cross_filters:
            for filter in cross_filters:
                if "Financial_Year" in filter.key:
                    _fy = True
                _filters.append({f"{filter.key}": f"{filter.value}"})
        lpg_cdcms_subsidy_state_amount_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_subsidy_state_amount")
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                lpg_cdcms_subsidy_state_amount_query_ += ' WHERE ' 
                lpg_cdcms_subsidy_state_amount_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_state_amount_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_state_amount_query_, access_filters, drill_state)
            if not _fy:
                lpg_cdcms_subsidy_state_amount_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_state_amount_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_state_amount_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_state_amount_query_, access_filters, drill_state)
            if "where" not in lpg_cdcms_subsidy_state_amount_query_.lower() and not _fy:
                lpg_cdcms_subsidy_state_amount_query_ += f' WHERE "Financial_Year" IN (\'{financial_year}\')'
            elif not _fy:
                lpg_cdcms_subsidy_state_amount_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_state_amount_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        resp = await function(query=lpg_cdcms_subsidy_state_amount_query_)
        resp = pl.DataFrame(resp)
        resp = await filter_data(resp.to_pandas(), _filters)
        resp = pl.from_pandas(resp)
        numerical_columns = ["month_number", "SubsidyAmount"]
        string_columns = ["ConsumerType", "Month", "ZOName", "ROName", "SAName", "DistributorName"]

        for col in numerical_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null(0.0))

        for col in string_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null("").cast(pl.Utf8))
        if filters:
            filter_keys = [rec.key.strip('"') for rec in filters]
            grouped_resp = None
            if "Month" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName"]).agg([
                    pl.sum("SubsidyAmount").alias("SubsidyAmount"),
                ])
                _index = "ZOName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName"]).agg([
                    pl.sum("SubsidyAmount").alias("SubsidyAmount"),
                ])
                _index = "ROName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName", "SAName"]).agg([
                    pl.sum("SubsidyAmount").alias("SubsidyAmount"),
                ])
                _index = "SAName"
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.group_by(["ConsumerType", "Month", "ZOName", "ROName", "SAName", "DistributorName"]).agg([
                    pl.sum("SubsidyAmount").alias("SubsidyAmount"),
                ])
                _index = "DistributorName"
            if grouped_resp is not None:
                grouped_resp = grouped_resp.with_columns(pl.col("SubsidyAmount").fill_null(0).cast(pl.Float64).alias("SubsidyAmount"))
                grouped_resp = grouped_resp.pivot(index=_index, on="ConsumerType", values="SubsidyAmount")
                grouped_resp = grouped_resp.with_columns(pl.all().fill_null(0))
                result = []
                for row in grouped_resp.iter_rows(named=True):
                    result.append({
                        "PMUY": row.get("PMUY", 0),
                        "NPMUY": row.get("NPMUY", 0),
                        _index: row.get(_index, "")
                    })
                return {"status": True, "message": "success", "data": result}
        resp = resp.group_by(["ConsumerType", "Month"]).agg([
                pl.sum("SubsidyAmount").alias("SubsidyAmount"),
                pl.first("month_number").alias("month_number"),
            ])
        resp = resp.sort("month_number")
        resp = resp.with_columns(pl.col("SubsidyAmount").fill_null(0).cast(pl.Float64).alias("SubsidyAmount"))
        resp = resp.pivot(index="Month", on="ConsumerType", values="SubsidyAmount")
        _index = "Month"
        result = []
        for row in resp.iter_rows(named=True):
            result.append({
                "PMUY": row.get("PMUY", 0),
                "NPMUY": row.get("NPMUY", 0),
                _index: row.get(_index, "")
            })
        return {"status": True, "message": "success", "data": result}
    
    
    @staticmethod
    async def lpg_cdcms_subsidy_state_amount_stacked_state(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        financial_year = await get_financial_year()
        _filters = []
        _fy = False
        if cross_filters:
            for filter in cross_filters:
                if "Financial_Year" in filter.key:
                    _fy = True
                _filters.append({f"{filter.key}": f"{filter.value}"})
        lpg_cdcms_subsidy_state_amount_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_subsidy_state_amount")
        if filters:
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)
            if conditions:
                lpg_cdcms_subsidy_state_amount_query_ += ' WHERE ' 
                lpg_cdcms_subsidy_state_amount_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_state_amount_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_state_amount_query_, access_filters, drill_state)
            if not _fy:
                lpg_cdcms_subsidy_state_amount_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_state_amount_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_subsidy_state_amount_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_subsidy_state_amount_query_, access_filters, drill_state)
            if "where" not in lpg_cdcms_subsidy_state_amount_query_.lower() and not _fy:
                lpg_cdcms_subsidy_state_amount_query_ += f' WHERE "Financial_Year" IN (\'{financial_year}\')'
            elif not _fy:
                lpg_cdcms_subsidy_state_amount_query_ += f' AND "Financial_Year" IN (\'{financial_year}\')'
            lpg_cdcms_subsidy_state_amount_query_ += ' GROUP BY "Financial_Year", "ConsumerType", "Month", "month_number", "ZOName", "ROName", "SAName", "DistributorName", "StateCode" '
        resp = await function(query=lpg_cdcms_subsidy_state_amount_query_)
        resp = pl.DataFrame(resp)
        resp = await filter_data(resp.to_pandas(), _filters)
        resp = pl.from_pandas(resp)
        numerical_columns = ["month_number", "SubsidyAmount"]
        string_columns = ["StateCode", "Month", "ZOName", "ROName", "SAName", "DistributorName"]

        for col in numerical_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null(0.0))

        for col in string_columns:
            if col in resp.columns:
                resp = resp.with_columns(pl.col(col).fill_null("").cast(pl.Utf8))
        if filters:
            filter_keys = [rec.key.strip('"') for rec in filters]
            grouped_resp = None
            if "Month" in filter_keys and "ZOName" not in filter_keys:
                grouped_resp = resp.group_by(["StateCode", "Month", "ZOName"]).agg([
                    pl.sum("SubsidyAmount").alias("SubsidyAmount"),
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" not in filter_keys:
                grouped_resp = resp.group_by(["StateCode", "Month", "ZOName", "ROName"]).agg([
                    pl.sum("SubsidyAmount").alias("SubsidyAmount"),
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" not in filter_keys:
                grouped_resp = resp.group_by(["StateCode", "Month", "ZOName", "ROName", "SAName"]).agg([
                    pl.sum("SubsidyAmount").alias("SubsidyAmount"),
                ])
            elif "Month" in filter_keys and "ZOName" in filter_keys and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                grouped_resp = resp.group_by(["StateCode", "Month", "ZOName", "ROName", "SAName", "DistributorName"]).agg([
                    pl.sum("SubsidyAmount").alias("SubsidyAmount"),
                ])
            if grouped_resp is not None:
                return {"status": True, "message": "success", "data": grouped_resp.to_dicts()}
        resp = resp.group_by(["StateCode", "Month"]).agg([
                pl.sum("SubsidyAmount").alias("SubsidyAmount"),
                pl.first("month_number").alias("month_number"),
            ])
        resp = resp.sort("month_number")
        return {"status": True, "message": "success", "data": resp.to_dicts()}
    
    
    @staticmethod
    async def lpg_cdcms_backlogs(filters, cross_filters, drill_state):
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        lpg_cdcms_backlogs_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_backlogs")
        lpg_cdcms_backlogs_today_ = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_backlogs_today")
        _filters = []
        if cross_filters:
            for filter in cross_filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if filters:
            filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSubsidyExceptionData.get_clause_conditions(formated=True)]
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)

            if conditions:
                lpg_cdcms_backlogs_  += ' WHERE '
                lpg_cdcms_backlogs_  += ' AND '.join(conditions)
                lpg_cdcms_backlogs_today_  += ' WHERE '
                lpg_cdcms_backlogs_today_  += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_backlogs_today_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_backlogs_today_, access_filters, drill_state)
            lpg_cdcms_backlogs_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_backlogs_, access_filters, drill_state)
            
            lpg_cdcms_backlogs_  += ' AND "CylType" = \'C142\' AND "Execution_Date" >= CURRENT_DATE - INTERVAL \'91 days\''
            lpg_cdcms_backlogs_  += ' GROUP BY  "ZOName" ,"ROName", "SAName", "DistributorName", "ConsumerType" '
            lpg_cdcms_backlogs_today_ += ' AND "CylType" = \'C142\' '
            lpg_cdcms_backlogs_today_ += ' GROUP BY  "ZOName" ,"ROName","SAName" ,"DistributorName", "ConsumerType" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
            lpg_cdcms_backlogs_today_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_backlogs_today_, access_filters, drill_state)
            lpg_cdcms_backlogs_ =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_backlogs_, access_filters, drill_state)
            
            if "where" not in lpg_cdcms_backlogs_.lower():
                lpg_cdcms_backlogs_  += ' WHERE "CylType" = \'C142\' AND "Execution_Date" >= CURRENT_DATE - INTERVAL \'91 days\''
                lpg_cdcms_backlogs_today_ += ' WHERE "CylType" = \'C142\' '
            else:
                lpg_cdcms_backlogs_  += ' AND "CylType" = \'C142\' AND "Execution_Date" >= CURRENT_DATE - INTERVAL \'91 days\''
                lpg_cdcms_backlogs_today_ += ' AND "CylType" = \'C142\' '
            lpg_cdcms_backlogs_  += ' GROUP BY  "ZOName" ,"ROName","SAName" ,"DistributorName", "ConsumerType"'
            lpg_cdcms_backlogs_today_ += ' GROUP BY  "ZOName" ,"ROName","SAName" ,"DistributorName", "ConsumerType"'
            
            average_sales = await function(query=lpg_cdcms_backlogs_)
            latest_pending_bookings = await function(query=lpg_cdcms_backlogs_today_)
            average_sales = pl.DataFrame(average_sales)
            latest_pending_bookings = pl.DataFrame(latest_pending_bookings)
            
            average_sales = await filter_data(average_sales.to_pandas(), _filters)
            latest_pending_bookings = await filter_data(latest_pending_bookings.to_pandas(), _filters)     
            average_sales = pl.from_pandas(average_sales)
            latest_pending_bookings = pl.from_pandas(latest_pending_bookings)       
            
            # Overall Number
            overall_average_sales = average_sales.with_columns(pl.lit("temp").alias("temp"))
            overall_average_sales = overall_average_sales.group_by("temp").agg((pl.col("TotalSalesYesterday").sum() / 90).alias("AverageSales"))
            overall_latest_pending_bookings = latest_pending_bookings.with_columns(pl.lit("temp").alias("temp"))
            overall_latest_pending_bookings = overall_latest_pending_bookings.group_by("temp").agg(pl.col("Total_Pending").sum().alias("TotalPendingBookings"))
            overall_backlog = overall_latest_pending_bookings.join(overall_average_sales, on="temp", how="left").with_columns((pl.col("TotalPendingBookings") / pl.col("AverageSales")).alias("Backlog"))
            
            
            average_sales = average_sales.group_by("ZOName").agg((pl.col("TotalSalesYesterday").sum() / 90).alias("AverageSales"))
            latest_pending_bookings = latest_pending_bookings.group_by("ZOName").agg(pl.col("Total_Pending").sum().alias("TotalPendingBookings"))
            backlog = latest_pending_bookings.join(average_sales, on="ZOName", how="left").with_columns((pl.col("TotalPendingBookings") / pl.col("AverageSales")).alias("Backlog"))

            return {"status": True, "message": "success", "overall_number": overall_backlog["Backlog"][-1], "data": backlog.to_dicts()}
                        
        average_sales = await function(query=lpg_cdcms_backlogs_)
        latest_pending_bookings = await function(query=lpg_cdcms_backlogs_today_)
        average_sales = pl.DataFrame(average_sales)
        latest_pending_bookings = pl.DataFrame(latest_pending_bookings)
        
        average_sales = await filter_data(average_sales.to_pandas(), _filters)
        latest_pending_bookings = await filter_data(latest_pending_bookings.to_pandas(), _filters)
        average_sales = pl.from_pandas(average_sales)
        latest_pending_bookings = pl.from_pandas(latest_pending_bookings)       
        
        # Overall Number
        overall_average_sales = average_sales.with_columns(pl.lit("temp").alias("temp"))
        overall_average_sales = overall_average_sales.group_by("temp").agg((pl.col("TotalSalesYesterday").sum() / 90).alias("AverageSales"))
        overall_latest_pending_bookings = latest_pending_bookings.with_columns(pl.lit("temp").alias("temp"))
        overall_latest_pending_bookings = overall_latest_pending_bookings.group_by("temp").agg(pl.col("Total_Pending").sum().alias("TotalPendingBookings"))
        overall_backlog = overall_latest_pending_bookings.join(overall_average_sales, on="temp", how="left").with_columns((pl.col("TotalPendingBookings") / pl.col("AverageSales")).alias("Backlog"))
        
        if filters:
            filter_keys = [rec.key.strip('"') for rec in filters]
            backlog = None
            if "ZOName" in filter_keys  and "ROName" not in filter_keys:
                average_sales = average_sales.group_by("ROName").agg((pl.col("TotalSalesYesterday").sum() / 90).alias("AverageSales"))
                latest_pending_bookings = latest_pending_bookings.group_by("ROName").agg(pl.col("Total_Pending").sum().alias("TotalPendingBookings"))
                backlog = latest_pending_bookings.join(average_sales, on="ROName", how="left").with_columns((pl.col("TotalPendingBookings") / pl.col("AverageSales")).alias("Backlog"))
            elif "ZOName" in filter_keys  and "ROName" in filter_keys and "SAName" not in filter_keys:
                average_sales = average_sales.group_by("SAName").agg((pl.col("TotalSalesYesterday").sum() / 90).alias("AverageSales"))
                latest_pending_bookings = latest_pending_bookings.group_by("SAName").agg(pl.col("Total_Pending").sum().alias("TotalPendingBookings"))
                backlog = latest_pending_bookings.join(average_sales, on="SAName", how="left").with_columns((pl.col("TotalPendingBookings") / pl.col("AverageSales")).alias("Backlog"))
            elif "ZOName" in filter_keys  and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                average_sales = average_sales.group_by("DistributorName").agg((pl.col("TotalSalesYesterday").sum() / 90).alias("AverageSales"))
                latest_pending_bookings = latest_pending_bookings.group_by("DistributorName").agg(pl.col("Total_Pending").sum().alias("TotalPendingBookings"))
                backlog = latest_pending_bookings.join(average_sales, on="DistributorName", how="left").with_columns((pl.col("TotalPendingBookings") / pl.col("AverageSales")).alias("Backlog"))
            if backlog is not None:
                backlog = backlog.with_columns(pl.col("Backlog").cast(pl.Utf8).cast(pl.Float64).round(2).alias("Backlog"))
                return {"status": True, "message": "success", "overall_number": overall_backlog["Backlog"][-1], "data": backlog.to_dicts()}
        else:
            return {"status": True, "message": "success", "data": []}
    
    
    @staticmethod
    async def lpg_cdcms_pcc(filters, cross_filters, drill_state):
        try:
            Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
            Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
            df = pl.read_csv("/opt/ceg/algo/DistributorMappings.csv")
            lpg_cdcms_april_consumer_stats = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_april_consumer_stats")
            lpg_cdcms_current_consumer_stats = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_current_consumer_stats")
            lpg_cdcms_pcc_sales = lpg_plant_queries.lpg_plant_query.get("lpg_cdcms_pcc_sales")
            
            financial_year = await get_financial_year()
            # hard_code table to be replaced with lpg_consumers_summary_april
            financial_start_date = financial_year.split("-")[0] + "-04-01"
            _filters = []
            if cross_filters:
                for filter in cross_filters:
                    _filters.append({f"{filter.key}": f"{filter.value}"})
            if filters:
                filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                        for rec in await hpcl_ceg_model.LpgSubsidyExceptionData.get_clause_conditions(formated=True)]
                conditions = []
                for rec in filters:
                    rec.value = rec.value.split(",")
                    if isinstance(rec.value, str):
                        condition = f"{rec.key} = '{rec.value}'"
                    else:
                        if len(rec.value) == 1:
                            condition = f"{rec.key} = '{rec.value[0]}'"
                        else:
                            condition = f"{rec.key} in {tuple(rec.value)}"
                    conditions.append(condition)
                if conditions:
                    lpg_cdcms_april_consumer_stats  += ' WHERE '
                    lpg_cdcms_april_consumer_stats  += ' AND '.join(conditions)
                    lpg_cdcms_current_consumer_stats  += ' WHERE '
                    lpg_cdcms_current_consumer_stats  += ' AND '.join(conditions)
                    lpg_cdcms_pcc_sales  += ' WHERE '
                    lpg_cdcms_pcc_sales  += ' AND '.join(conditions)
                lpg_cdcms_april_consumer_stats += f' AND "SummaryDate" = \'{financial_start_date}\' AND "Category" = \'Domestic\' AND "CategoryStatus" = \'Active\' AND "RelationshipStatus" = \'A\' AND "RelationshipSubStatus" = \'1A\' AND "ConsumerCategory" = \'A\' '
                lpg_cdcms_april_consumer_stats += ' GROUP BY "DistributorName", "SubCategory", "ZOName", "SAName", "ROName" '
                
                lpg_cdcms_current_consumer_stats += ' AND "Category" = \'Domestic\' AND "CategoryStatus" = \'Active\' AND "RelationshipStatus" = \'A\' AND "RelationshipSubStatus" = \'1A\' AND "ConsumerCategory" = \'A\' '
                lpg_cdcms_current_consumer_stats += ' GROUP BY  "JDEDistributorCode", "SubCategory", "ZOName", "SAName", "ROName" '
                
                lpg_cdcms_pcc_sales  += f' AND "Financial_Year"=\'{financial_year}\' AND "ZOName" IS NOT NULL'
                lpg_cdcms_pcc_sales  += ' GROUP BY "ConsumerType", "ZOName", "SAName", "ROName", "CylType", "DistributorName" '
            else:
                access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                        for rec in await hpcl_ceg_model.LpgSubsidyExceptionData.get_clause_conditions(formated=True)]
                lpg_cdcms_pcc_sales =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_pcc_sales, access_filters, drill_state)
                lpg_cdcms_april_consumer_stats =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_april_consumer_stats, access_filters, drill_state)
                lpg_cdcms_current_consumer_stats =  await widget_actions.WidgetActions.apply_filter_drilldown(lpg_cdcms_current_consumer_stats, access_filters, drill_state)
                
                if "where" not in lpg_cdcms_pcc_sales.lower():
                    lpg_cdcms_april_consumer_stats  += f' WHERE "SummaryDate" = \'{financial_start_date}\' AND "Category" = \'Domestic\' AND "CategoryStatus" = \'Active\' AND "RelationshipStatus" = \'A\' AND "RelationshipSubStatus" = \'1A\' AND "ConsumerCategory" = \'A\' '
                    lpg_cdcms_current_consumer_stats += ' WHERE "Category" = \'Domestic\' AND "CategoryStatus" = \'Active\' AND "RelationshipStatus" = \'A\' AND "RelationshipSubStatus" = \'1A\' AND "ConsumerCategory" = \'A\' '
                    lpg_cdcms_pcc_sales += f' WHERE "Financial_Year"=\'{financial_year}\' AND "ZOName" IS NOT NULL'
                else:
                    lpg_cdcms_april_consumer_stats  += f' AND "SummaryDate" = \'{financial_start_date}\' AND "Category" = \'Domestic\' AND "CategoryStatus" = \'Active\' AND "RelationshipStatus" = \'A\' AND "RelationshipSubStatus" = \'1A\' AND "ConsumerCategory" = \'A\' '
                    lpg_cdcms_current_consumer_stats += ' AND "Category" = \'Domestic\' AND "CategoryStatus" = \'Active\' AND "RelationshipStatus" = \'A\' AND "RelationshipSubStatus" = \'1A\' AND "ConsumerCategory" = \'A\' '
                    lpg_cdcms_pcc_sales  += f' AND "Financial_Year"=\'{financial_year}\' AND "ZOName" IS NOT NULL'
                lpg_cdcms_april_consumer_stats += ' GROUP BY "DistributorName", "SubCategory", "ZOName", "SAName", "ROName" '
                lpg_cdcms_current_consumer_stats += ' GROUP BY  "JDEDistributorCode", "SubCategory", "ZOName", "SAName", "ROName" '
                lpg_cdcms_pcc_sales  += ' GROUP BY "ConsumerType", "ZOName", "SAName", "ROName", "CylType", "DistributorName" '
            
            april_consumer_stats = await function(query=lpg_cdcms_april_consumer_stats)
            current_consumer_stats = await function(query=lpg_cdcms_current_consumer_stats)
            lpg_cdcms_pcc_sales = await function(query=lpg_cdcms_pcc_sales)
            
            april_consumer_stats = pl.DataFrame(april_consumer_stats)
            current_consumer_stats = pl.DataFrame(current_consumer_stats)
            lpg_cdcms_pcc_sales = pl.DataFrame(lpg_cdcms_pcc_sales)       
            current_consumer_stats = current_consumer_stats.rename({"SubCategory": "ConsumerType"})
            april_consumer_stats = april_consumer_stats.rename({"SubCategory": "ConsumerType"})
            
            april_consumer_stats = await filter_data(april_consumer_stats.to_pandas(), _filters)
            current_consumer_stats = await filter_data(current_consumer_stats.to_pandas(), _filters)
            lpg_cdcms_pcc_sales = await filter_data(lpg_cdcms_pcc_sales.to_pandas(), _filters)
            
            april_consumer_stats = pl.from_pandas(april_consumer_stats)
            current_consumer_stats = pl.from_pandas(current_consumer_stats)
            lpg_cdcms_pcc_sales = pl.from_pandas(lpg_cdcms_pcc_sales)                
            
            current_consumer_stats = current_consumer_stats.join(df, on='JDEDistributorCode', how='left')
            
            lpg_cdcms_pcc_sales = lpg_cdcms_pcc_sales.with_columns(pl.col("TotalSalesYesterday").cast(pl.Float64).alias("TotalSalesYesterday"))
            lpg_cdcms_pcc_sales = lpg_cdcms_pcc_sales.with_columns(
                pl.when(pl.col("CylType") == "C5"
                        ).then(pl.col("TotalSalesYesterday")*5 / 14.2
                            ).otherwise(pl.col("TotalSalesYesterday")).alias("TotalRefillSales"))
            
            if filters:
                filter_keys = [rec.key.strip('"') for rec in filters]
                pcc = None
                if "ZOName" in filter_keys  and "ROName" not in filter_keys:
                    april_consumer_stats = april_consumer_stats.group_by("ROName").agg((pl.col("ConsumerCount").sum()).alias("ConsumerCount_start"))
                    current_consumer_stats = current_consumer_stats.group_by("ROName").agg((pl.col("ConsumerCount").sum()).alias("ConsumerCount_current"))
                    avg_consumer_count = april_consumer_stats.join(current_consumer_stats, on="ROName", how="outer"
                                                                ).with_columns(((pl.col("ConsumerCount_start") + pl.col("ConsumerCount_current")) / 2).alias("avg_consumer_count")).drop("ROName_right")
                    lpg_cdcms_pcc_sales = lpg_cdcms_pcc_sales.group_by("ROName").agg((pl.col("TotalRefillSales").sum()).alias("TotalRefillSales"))
                    pcc = avg_consumer_count.join(lpg_cdcms_pcc_sales, on="ROName", how="outer").drop("ROName_right")
                elif "ZOName" in filter_keys  and "ROName" in filter_keys and "SAName"  not in filter_keys:
                    april_consumer_stats = april_consumer_stats.group_by("SAName").agg((pl.col("ConsumerCount").sum()).alias("ConsumerCount_start"))
                    current_consumer_stats = current_consumer_stats.group_by("SAName").agg((pl.col("ConsumerCount").sum()).alias("ConsumerCount_current"))
                    avg_consumer_count = april_consumer_stats.join(current_consumer_stats, on="SAName", how="outer"
                                                                ).with_columns(((pl.col("ConsumerCount_start") + pl.col("ConsumerCount_current")) / 2).alias("avg_consumer_count")).drop("SAName_right")
                    lpg_cdcms_pcc_sales = lpg_cdcms_pcc_sales.group_by("SAName").agg((pl.col("TotalRefillSales").sum()).alias("TotalRefillSales"))
                    pcc = avg_consumer_count.join(lpg_cdcms_pcc_sales, on="SAName", how="outer").drop("SAName_right")
                elif "ZOName" in filter_keys  and "ROName" in filter_keys and "SAName" in filter_keys and "DistributorName" not in filter_keys:
                    april_consumer_stats = april_consumer_stats.group_by("DistributorName").agg((pl.col("ConsumerCount").sum()).alias("ConsumerCount_start"))
                    current_consumer_stats = current_consumer_stats.group_by("DistributorName").agg((pl.col("ConsumerCount").sum()).alias("ConsumerCount_current"))
                    avg_consumer_count = april_consumer_stats.join(current_consumer_stats, on="DistributorName", how="outer"
                                                                ).with_columns(((pl.col("ConsumerCount_start") + pl.col("ConsumerCount_current")) / 2).alias("avg_consumer_count")).drop("DistributorName_right")
                    lpg_cdcms_pcc_sales = lpg_cdcms_pcc_sales.group_by("DistributorName").agg((pl.col("TotalRefillSales").sum()).alias("TotalRefillSales"))
                    pcc = avg_consumer_count.join(lpg_cdcms_pcc_sales, on="DistributorName", how="outer").drop("DistributorName_right")
            else:
                april_consumer_stats = april_consumer_stats.group_by("ZOName").agg((pl.col("ConsumerCount").sum()).alias("ConsumerCount_start"))
                current_consumer_stats = current_consumer_stats.group_by("ZOName").agg((pl.col("ConsumerCount").sum()).alias("ConsumerCount_current"))
                avg_consumer_count = april_consumer_stats.join(current_consumer_stats, on="ZOName", how="outer"
                                                            ).with_columns(((pl.col("ConsumerCount_start") + pl.col("ConsumerCount_current")) / 2).alias("avg_consumer_count")).drop("ZOName_right")
                lpg_cdcms_pcc_sales = lpg_cdcms_pcc_sales.group_by("ZOName").agg((pl.col("TotalRefillSales").sum()).alias("TotalRefillSales"))
                pcc = avg_consumer_count.join(lpg_cdcms_pcc_sales, on="ZOName", how="outer").drop("ZOName_right")

            if isinstance(pcc, pl.DataFrame) and pcc.is_empty():
                return {"status": True, "message": "success", "overal_number": 0,"data": []}
            days_in_fy_till_yesterday = await days_since_financial_year_start()
            pcc = pcc.with_columns(pl.lit("temp").alias("temp"))
            overall_num = pcc.group_by("temp").agg((pl.col("TotalRefillSales").sum()).alias("TotalRefillSales"), (pl.col("avg_consumer_count").sum()).alias("avg_consumer_count"))
            overall_num = overall_num.with_columns(
                                                pl.when(pl.col("avg_consumer_count") > 0)
                                                .then(pl.col("TotalRefillSales")/pl.col("avg_consumer_count"))
                                                .otherwise(0)  # or some other default value
                                                .alias("pcc")
                                            )
            
            
            overall_num = overall_num.with_columns((pl.col("pcc")* 365 / days_in_fy_till_yesterday).alias("pcc_prorated")).drop("pcc")
            overall_num = overall_num.with_columns(pl.col("pcc_prorated").round(2).alias("pcc_prorated"))
            pcc = pcc.with_columns(
                                    pl.when(pl.col("avg_consumer_count") > 0)
                                    .then(pl.col("TotalRefillSales")/pl.col("avg_consumer_count"))
                                    .otherwise(0)  # or some other default value
                                    .alias("pcc")
                                )
            
            pcc = pcc.with_columns((pl.col("pcc")* 365 / days_in_fy_till_yesterday).alias("pcc_prorated")).drop("pcc")
            pcc = pcc.with_columns(pl.col("pcc_prorated").round(2).alias("pcc_prorated"))
            return {"status": True, "message": "success", "overal_number": overall_num["pcc_prorated"][-1],"data": pcc.to_dicts()}
        except Exception as e:
            print("traceback :", traceback.format_exc())
            raise Exception(e)
            