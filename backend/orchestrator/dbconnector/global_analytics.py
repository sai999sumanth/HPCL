import urdhva_base
import calendar
import psycopg2
import traceback
import json
import itertools
import polars as pl
import numpy as np
import pandas as pd
import hpcl_ceg_model
import dashboard_studio_model
import utilities.helpers as helpers
from collections import defaultdict, OrderedDict
from datetime import datetime,timedelta, timezone
from pandas.tseries.offsets import MonthEnd
from orchestrator.analytics import va_analysis
from dateutil.relativedelta import relativedelta
from orchestrator.analytics import m60_performance
from orchestrator.analytics import dry_out_analysis
from orchestrator.analytics import lpg_plant_analysis
from orchestrator.analytics import industry_performance
from orchestrator.dbconnector.widget_actions import widget_actions
import orchestrator.dbconnector.connector_factory as connector_factory
import orchestrator.analytics.lpg_monthwise_analytics as lpg_monthwise_analytics
import orchestrator.dbconnector.widget_actions.lpg_plant_queries as lpg_plant_queries
from collections import defaultdict
import utilities.analog_data_mapping as category_mapping


async def filter_data(df, _filters):
    try:        
        if _filters:
            print("-"*30)
            print("_filters :", _filters)
            print("data columns :", df.columns)
            print("length of data :", len(df))
            mask = pd.Series(True, index=df.index)
            for _filter in _filters:
                for key, value in _filter.items():
                    key = key.replace('"','')
                    mask = mask & (df[key].fillna('') == value)
            df = df[mask]
            print("length of filtered data :", len(df))
            print("-"*30)
        return df
    except Exception as e:
        print("Exception in filtering data :", str(e))
    return df

async def generate_cross_filter(cross_filters):
    _filters, daterange = [], None
    try:
        if cross_filters:
            for f in cross_filters:
                if "DATE" in f.key:
                    start = f.value.split(",")[0]
                    end = f.value.split(",")[-1]
                    daterange = f"'{start} 00:00:00' AND '{end} 23:59:59'"
                else:
                    _filters.append({f.key: f.value})
        return _filters, daterange
    except Exception as e:
        print("--- Exception in cross filters ---")
        print("Exception :", str(e))
        return _filters, daterange

async def get_drill_down_filter(filters, query):
    try:
        conditions = []
        _key = None
        if filters:
            for rec in filters:
                if (rec.key).lower().replace('"', '') in ["rejection_type"]:
                    _key = (rec.value).lower().replace('"', '')
                    continue
                values = rec.value.split(",")
                if len(values) == 1:
                    conditions.append(f'{rec.key} = \'{values[0]}\'')
                else:
                    conditions.append(f"{rec.key} IN {tuple(values)}")
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        if _key:
            return query, _key
        return query
    except Exception as e:
        print("--- Exception in drill down filters ---")
        print("Exception :", str(e))
        return query

async def addFilterValue(rec):
    if ',' in rec.value:
        rec_values = rec.value.split(',')
        rec_value_tup = tuple([i.strip() for i in rec_values])
        condition = f"{rec.key} IN {rec_value_tup} "
    else:
        condition = f"{rec.key} = '{rec.value}'"
    return condition

async def product_map():
    alert_code_to_name = {
        "2811000": "MS",
        "2812000": "HSD",
        "3912000": "TURBO",
        "2822000": "E20",
        "3672000": "POWER 95",
        "2816000": "POWER 99",
        "3373000": "POWER 100"
    }
    #
    return alert_code_to_name


def get_month_start_and_next(input_month: str):
    # Parse input like '2025-06'
    start_date = datetime.strptime(input_month, "%Y-%m").date().replace(day=1)
    next_month_date = (start_date + relativedelta(months=1)).replace(day=1)

    return start_date, next_month_date

class GlobalAnalytics:        
    @staticmethod
    async def analytics(filters, cross_filters, drill_state):
        """
        Retrieves analytics data for the given filters and drill state.

        Args:
            filters (list): List of filter objects with the following structure:
                {
                    "key": str,  # Column name
                    "value": str,  # Filter value
                    "operator": str,  # Filter operator (e.g. =, !=, LIKE)
                    "type": str  # Filter type (e.g. string, number, date)
                }
            drill_state (dict): Drill state with the following structure:
                {
                    "column": str,  # Column name
                    "value": str,  # Drill value
                    "type": str  # Drill type (e.g. string, number, date)
                }

        Returns:
            dict: Analytics data with the following structure:
                {
                    "activeLocations": int,  # Number of active locations
                    "inactiveLocations": int,  # Number of inactive locations
                    "totalAlerts": str,  # Total number of alerts (formatted with commas)
                    "alertDistribution": list,  # List of objects with the following structure:
                        {
                            "name": str,  # Interlock name
                            "value": int  # Number of alerts
                        }
                    "top10Alerts": list,  # List of objects with the following structure:
                        {
                            "name": str,  # Interlock name
                            "value": int  # Number of alerts
                        }
                    "no_of_locations": int  # Number of locations
                }
        """

        analytics_query = lpg_plant_queries.lpg_plant_query.get("analytics")
        analytics_query_ = analytics_query

        if filters:
            filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
            for filter_ in filters:
                if filter_.key:
                    # Update the key of the filter to include the alias 'a.'
                    if filter_.key == "created_at":
                        filter_.key = "(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')"
                    filter_.key = f"{filter_.key}"
                
            # After modifying the filters, send the updated filters to apply_filter_drilldown
            analytics_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(analytics_query, filters, drill_state)
        try:
            # Execute the query
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(analytics_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print("Error: ", e)
            # Retry with the base query in case of an error
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(analytics_query)

        # Process the results
        data = connector_factory.PostgreSQLConnector('LPG_PLANT').process_recommendations(keys, res)

        active_locations = set()
        inactive_locations = set()
        total_alerts = 0
        alert_distribution = defaultdict(int)
        top_alerts = defaultdict(int)
        interlock_alerts = defaultdict(lambda: defaultdict(int))

        # Process each alert
        for alert in data:
            sap_id = alert['sap_id']
            alert_status = alert['alert_status']
            severity = alert['severity']
            severity_count = alert['severity_count']
            interlock_name = alert['interlock_name']

            # Update active and inactive locations
            if alert_status == "Close":
                inactive_locations.add(sap_id)
            # elif alert_status == "Open":
            #     active_locations.add(sap_id)
            else:
                active_locations.add(sap_id)

            # Update total alerts
            total_alerts += severity_count

            # Update alert distribution by severity
            alert_distribution[severity] += severity_count

            # Update top alerts by interlock name
            top_alerts[interlock_name] += severity_count

            interlock_alerts[interlock_name][severity] += severity_count


        # Format the output
        result = {
            "activeLocations": len(active_locations),
            "inactiveLocations": len(inactive_locations),
            "totalAlerts": f"{total_alerts:,}",
            "alertDistribution": [
                {"name": severity, "value": severity_count}
                for severity, severity_count in alert_distribution.items()
            ],
            "top10Alerts": [
                {"name": name, "value": value}
                for name, value in sorted(top_alerts.items(), key=lambda x: x[1], reverse=True)[:10]
            ],
            "interlock_alerts": [
        {
            "interlock_name": interlock_name,
            **{key: value for key, value in details.items() if key != "interlock_name"}
        }
        for interlock_name, details in interlock_alerts.items()
    ]

        }

        return {"status": True, "message": "Success", "data": result}

    
    @staticmethod
    async def alert_ageing(filters, cross_filters, drill_state):
        """
        This method is used to fetch the alert ageing data for the given filters and drill state
        :param filters: The filter parameters
        :param drill_state: The drill down state
        :return: A dictionary containing the status, message and the alert ageing data
        """
        alert_ageing_query = lpg_plant_queries.lpg_plant_query.get("alert_ageing")
        alert_ageing_query_ = alert_ageing_query
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            for filter_ in filters:
                if filter_.key == "created_at":
                    filter_.key = "(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')"
            alert_ageing_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(alert_ageing_query, filters, drill_state)
            print(alert_ageing_query_)
        try:
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(alert_ageing_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(alert_ageing_query)
        data = connector_factory.PostgreSQLConnector('LPG_PLANT').process_recommendations(keys, res)
        return {"status": True, "message": "success", "data": data}
    
    @staticmethod
    async def day_wise_alerts(filters, cross_filters, drill_state):
        """
        Fetches the day-wise alerts data for the given filters and drill state.

        Parameters:
            filters (list): List of filter objects to apply to the query.
            drill_state (dict): Current drill state for processing the query.

        Returns:
            dict: Contains the status, a success message, and the day-wise alerts data.
        """
        day_wise_alerts_query = lpg_plant_queries.lpg_plant_query.get("day_wise_alerts")
        day_wise_alerts_query_ = day_wise_alerts_query
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            day_wise_alerts_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(day_wise_alerts_query, filters, drill_state)
            print(day_wise_alerts_query_)
        try:
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(day_wise_alerts_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(day_wise_alerts_query)
        data = connector_factory.PostgreSQLConnector('LPG_PLANT').process_recommendations(keys, res)
        return {"status": True, "message": "success", "data": data}
    
    @staticmethod
    async def location_severity_count(filters, cross_filters, drill_state):
        """
        Fetches the location severity count data for the given filters and drill state.

        Parameters:
            filters (list): List of filter objects to apply to the query.
            drill_state (dict): Current drill state for processing the query.

        Returns:
            dict: Contains the status, a success message, and the location severity count data.
        """
        location_severity_count_query = lpg_plant_queries.lpg_plant_query.get("location_severity_count")
        location_severity_count_query_ = location_severity_count_query

        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            for filter_ in filters:
                
                # Explicitly qualify the column with the correct table alias
                filter_.key = f"a.{filter_.key}"  # Assuming "a" is the alias for the table containing "bu"
                # filter_condition = f" WHERE {filter_key} = '{filter_.value}'"
                # Add the filter condition before GROUP BY
                # location_severity_count_query_ = location_severity_count_query_.replace("GROUP BY", f"{filter_condition} GROUP BY")
                # break
            location_severity_count_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(location_severity_count_query_, filters, drill_state)
        try:
            # resp = await function(query=location_severity_count_query_)
            resp = urdhva_base.BasePostgresModel.get_aggr_data(query=location_severity_count_query_, limit=0)
            resp = resp.get('data', [])
            # keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(location_severity_count_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            # Retry with the original query if the column is undefined
            # keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(location_severity_count_query)

        # Process the results
        # data = connector_factory.PostgreSQLConnector('LPG_PLANT').process_recommendations(keys, res)
        return {"status": True, "message": "success", "data": resp}

    @staticmethod
    async def no_of_locations(filters, cross_filters, drill_state):
        """
        Fetches the top interlocks data for the given filters and drill state.

        Parameters:
            filters (list): List of filter objects to apply to the query.
            drill_state (dict): Current drill state for processing the query.

        Returns:
            dict: Contains the status, a success message, and the top interlocks data.
        """
        no_of_locations_query = lpg_plant_queries.lpg_plant_query.get("no_of_locations")
        no_of_locations_query_ = no_of_locations_query
        if filters:
            no_of_locations_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(no_of_locations_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(no_of_locations_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(no_of_locations_query)
        no_of_locations_data = connector_factory.PostgreSQLConnector('LPG_PLANT').process_recommendations(keys, res)
        return {"status": True, "message": "success", "data": no_of_locations_data}

    @staticmethod
    async def severity_count(filters, cross_filters, drill_state):
        """
        Fetches the severity count data for the given filters and drill state.

        Parameters:
            filters (list): List of filter objects to apply to the query.
            drill_state (dict): Current drill state for processing the query.

        Returns:
            dict: Contains the status, a success message, and the severity count data.
        """
        severity_count_query = lpg_plant_queries.lpg_plant_query.get("severity_count")
        severity_count_query_ = severity_count_query
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LocationMaster.get_clause_conditions(formated=True)]
        if filters:
            for filter_ in filters:
                if filter_.key:
                    # Update the key of the filter to include the alias 'a.'
                    filter_.key = f'lm.{filter_.key}'
            severity_count_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(severity_count_query, filters, drill_state)
        try:
            # severity_count_data = await function(query=severity_count_query_)
            severity_count_data = urdhva_base.BasePostgresModel.get_aggr_data(query=severity_count_query_, limit=0)
            severity_count_data = severity_count_data.get('data', [])
            # keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(severity_count_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            # keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(severity_count_query)
        # severity_count_data = connector_factory.PostgreSQLConnector('LPG_PLANT').process_recommendations(keys, res)
        for item in severity_count_data:
            item['operability_index'] = 99
        return {"status": True, "message": "success", "data": severity_count_data}
    
    @staticmethod
    async def hourly_alerts(filters, cross_filters, drill_state):
        """
        Fetches the hourly alerts data for the given filters and drill state.

        Parameters:
            filters (list): List of filter objects to apply to the query.
            drill_state (dict): Current drill state for processing the query.

        Returns:
            dict: Contains the status, a success message, and the hourly alerts data.
        """
        hourly_alerts_query = lpg_plant_queries.lpg_plant_query.get("hourly_alerts")
        hourly_alerts_query_ = hourly_alerts_query
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            hourly_alerts_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(hourly_alerts_query, filters, drill_state)
        try:
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=hourly_alerts_query_, limit=0)
            resp = resp.get('data', [])
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
        return {"status": True, "message": "success", "data": resp}


    @staticmethod
    async def sales_performance(filters, cross_filters, drill_state):
        """
        Fetches the sales performance data for the given filters and drill state.

        Parameters:
            filters (list): List of filter objects to apply to the query.
            drill_state (dict): Current drill state for processing the query.

        Returns:
            dict: Contains the status, a success message, and the sales performance data.
        """
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

        # Reverse mapping (for returning the short form)
        reverse_month_mapping = {v: k for k, v in month_mapping.items()}

        if filters:
            filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.M60LevelMetaData.get_clause_conditions(formated=True)]
            sales_performance_query = lpg_plant_queries.lpg_plant_query.get("sales_performance")
            sales_performance_query_ = sales_performance_query
            conditions = []

            for rec in filters:
                rec.value = rec.value.split(",")
                if rec.key == '"month_name"':  # Only handle the month_name case separately
                    # Check if any value in rec.value is in month_mapping
                    rec.value = [month_mapping.get(val.strip(), val.strip()) for val in rec.value]
                
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
                sales_performance_query_ += ' WHERE '
                sales_performance_query_ += ' AND '.join(conditions)
        else:
            current_date = datetime.now()
            current_year = current_date.year
            next_year = current_year + 1
            current_month = current_date.month
            # Determine the current financial year
            if current_month >= 4:  # April or later
                fiscal_year_start = f"'FY {current_year}-{next_year}'"
            else:  # January to March
                previous_year = current_year - 1
                fiscal_year_start = f"'FY {previous_year}-{current_year}'"
            # Fallback query if no filters are provided
            sales_performance_query_ = f'''
                SELECT
                    ROUND(SUM("M60_LEVEL_METADATA"."NETWEIGHT_TMT")::numeric,0) AS "ACTUAL_TMT_SALES",
                    ROUND(SUM("M60_LEVEL_METADATA"."TARGET_QTY_TMT")::numeric,0) AS "TARGET_TMT_SALES",
                    "M60_LEVEL_METADATA"."fy_month" AS "fy_month",
                    "M60_LEVEL_METADATA"."fiscal_year" AS "fiscal_year"
                FROM
                    "M60_LEVEL_METADATA"
                WHERE
                    "M60_LEVEL_METADATA"."NETWEIGHT_TMT" != 0 and "M60_LEVEL_METADATA"."fiscal_year" = {fiscal_year_start}
                GROUP BY
                    "M60_LEVEL_METADATA"."fy_month",
                    "M60_LEVEL_METADATA"."fiscal_year"
                ORDER BY
                    "M60_LEVEL_METADATA"."fy_month" ASC;
            '''
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.M60LevelMetaData.get_clause_conditions(formated=True)]
            sales_performance_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(sales_performance_query_, access_filters, drill_state)
            print("sales_performance_query_: ",sales_performance_query_)
            # resp = await function(query=sales_performance_query_)
            resp = urdhva_base.BasePostgresModel.get_aggr_data(query=sales_performance_query_, limit=0)
            resp = resp.get('data', [])

            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)

            # Fill missing values for numerical columns
            for each_float_col in [
                "ACTUAL_TMT_SALES", "TARGET_TMT_SALES"
            ]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)

            # Fill missing values for string columns
            for each_str_col in [
                "fy_month", "month_name"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)

            return {"status": True, "message": "success", "data": resp}

        # Execute the query
        # resp = await function(query=sales_performance_query_)
        resp = urdhva_base.BasePostgresModel.get_aggr_data(query=sales_performance_query_, limit=0)
        resp = resp.get('data', [])
        # Convert the response to a DataFrame for further processing
        resp = pd.DataFrame(resp)

        # Fill missing values for numerical columns
        for each_float_col in [
            "TARGET_QTY_TMT", "Prediction_Value", "Product_Achievement", 
            "Zone_Region_Achievement", "Rate_Per_Day_Required_MMT", 
            "Rate_per_day_current_MMT", "FinalSum", "FinalActualSum", "NETWEIGHT_TMT"
        ]:
            if each_float_col in resp.columns:
                resp[each_float_col] = resp[each_float_col].fillna(0.0)

        # Fill missing values for string columns
        for each_str_col in [
            "SBU", "SBU_Name", "ZONE", "Zone_Name", "REGION", "Region_Name", "SA", 
            "SalesArea_Name", "PRODUCT", "ProductName", "UOM", "fiscal_year", 
            "month_year", "month_name"
        ]:
            if each_str_col in resp.columns:
                resp[each_str_col] = resp[each_str_col].fillna('').astype(str)

        # Apply grouping logic based on filters
        if filters:
            grouped_resp = None
            filter_keys = [rec.key.strip('"') for rec in filters]
            filter_values = [rec.value[0].strip('"') for rec in filters]
            if "month_name" in filter_keys:
            # Convert full month names to short form (e.g., "January" -> "Jan")
                resp["month_name"] = resp["month_name"].apply(
                lambda x: reverse_month_mapping.get(x, x)
            )
            sbu_order = ['Retail', 'LPG', 'I&C', 'Lubes', 'Aviation', 'PETCHEM', 'NG']

            # Create a mapping dictionary for SBU_Name replacements
            sbu_mapping = {
                "PETROCHEMICALS SBU": "PETCHEM",  # Map PETROCHEMICALS SBU to PETCHEM
                "GAS HQO": "NG",  # Map GAS HQO to NG
            }
            resp = resp[resp["SBU_Name"] != "0"]
            resp = resp[resp["Zone_Name"] != "-"]
            

            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'SBU_Name' in filter_keys:
                resp['SBU_Name'] = resp['SBU_Name'].map(sbu_mapping).fillna(resp['SBU_Name'])
                resp['SBU_Name'] = pd.Categorical(resp['SBU_Name'], categories=sbu_order, ordered=True)
                resp = resp.sort_values('SBU_Name')
                grouped_resp = resp.groupby(["SBU_Name"], as_index=False).agg({
                    "TARGET_QTY_TMT": "sum",
                    "NETWEIGHT_TMT": "sum"
                })
            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'Zone_Name' in filter_keys:
                grouped_resp = resp.groupby(["Zone_Name"], as_index=False).agg({
                    "TARGET_QTY_TMT": "sum",
                    "NETWEIGHT_TMT": "sum"
                })
            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'Region_Name' in filter_keys:
                grouped_resp = resp.groupby(["Region_Name"], as_index=False).agg({
                    "TARGET_QTY_TMT": "sum",
                    "NETWEIGHT_TMT": "sum"
                })
            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'SalesArea_Name' in filter_keys:
                grouped_resp = resp.groupby(["SalesArea_Name"], as_index=False).agg({
                    "TARGET_QTY_TMT": "sum",
                    "NETWEIGHT_TMT": "sum"
                })

            if len(filters) == 2 and "month_name" in filter_keys and "SBU_Name" in filter_keys:
                grouped_resp = resp.groupby(["month_name", "SBU_Name"], as_index=False).agg({
                    "TARGET_QTY_TMT": "sum",
                    "NETWEIGHT_TMT": "sum"
                })
            
            elif len(filters) == 2 and "month_name" in filter_keys and "Zone_Name" in filter_keys:
                grouped_resp = resp.groupby(["month_name", "Zone_Name"], as_index=False).agg({
                    "TARGET_QTY_TMT": "sum",
                    "NETWEIGHT_TMT": "sum"
                })
            
            elif len(filters) == 2 and "month_name" in filter_keys and "Region_Name" in filter_keys:
                grouped_resp = resp.groupby(["month_name", "Region_Name"], as_index=False).agg({
                    "TARGET_QTY_TMT": "sum",
                    "NETWEIGHT_TMT": "sum"
                })
            
            elif len(filters) == 2 and "month_name" in filter_keys and "SalesArea_Name" in filter_keys:
                grouped_resp = resp.groupby(["month_name", "SalesArea_Name"], as_index=False).agg({
                    "TARGET_QTY_TMT": "sum",
                    "NETWEIGHT_TMT": "sum"
                })
            
            elif len(filters) == 2 and "month_name" in filter_keys and "ProductName" in filter_keys:
                grouped_resp = resp.groupby(["month_name", "ProductName"], as_index=False).agg({
                    "TARGET_QTY_TMT": "sum",
                    "NETWEIGHT_TMT": "sum"
                })

            elif "fiscal_year" in filter_keys and "month_name" not in filter_keys:
                grouped_resp = resp.groupby(["fiscal_year"], as_index=False).agg({
                    "NETWEIGHT_TMT": "sum",
                    "TARGET_QTY_TMT": "sum"
                })

            elif "fiscal_year" in filter_keys and "month_name" in filter_keys and "SBU_Name" not in filter_keys:
                resp['SBU_Name'] = resp['SBU_Name'].map(sbu_mapping).fillna(resp['SBU_Name'])
                resp['SBU_Name'] = pd.Categorical(resp['SBU_Name'], categories=sbu_order, ordered=True)
                resp = resp.sort_values('SBU_Name')
                grouped_resp = resp.groupby(["fiscal_year", "month_name", "SBU_Name"], as_index=False).agg({
                    "NETWEIGHT_TMT": "sum",
                    "TARGET_QTY_TMT": "sum"
                })

            elif "fiscal_year" in filter_keys and "month_name" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" not in filter_keys:
                if "DS" in filter_values or 'Lubes' in filter_values or 'DS Lubes' in filter_values:
                    grouped_resp = resp.groupby(["fiscal_year", "month_name", "SBU_Name","Region_Name"], as_index=False).agg({
                        "TARGET_QTY_TMT": "sum",
                        "NETWEIGHT_TMT": "sum"
                    })
                else:    
                    grouped_resp = resp.groupby(["fiscal_year", "month_name", "SBU_Name", "Zone_Name"], as_index=False).agg({
                    "NETWEIGHT_TMT": "sum",
                    "TARGET_QTY_TMT": "sum"
                })

            elif "fiscal_year" in filter_keys and "month_name" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys and "Region_Name" not in filter_keys:
                grouped_resp = resp.groupby(["fiscal_year", "month_name", "SBU_Name", "Zone_Name", "Region_Name"], as_index=False).agg({
                    "NETWEIGHT_TMT": "sum",
                    "TARGET_QTY_TMT": "sum"
                })

            elif "fiscal_year" in filter_keys and "month_name" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys \
                                    and "Region_Name" in filter_keys and "SalesArea_Name" not in filter_keys:
                grouped_resp = resp.groupby(["fiscal_year", "month_name", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name"], as_index=False).agg({
                    "NETWEIGHT_TMT": "sum",
                    "TARGET_QTY_TMT": "sum",
                })

            elif "fiscal_year" in filter_keys and \
            "month_name" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys and \
                                    "Region_Name" in filter_keys and "SalesArea_Name" in filter_keys and "ProductName" not in filter_keys:
                grouped_resp = resp.groupby(["fiscal_year", "month_name", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"], as_index=False).agg({
                    "NETWEIGHT_TMT": "sum",
                    "TARGET_QTY_TMT": "sum",
                })
            grouped_resp["NETWEIGHT_TMT"] = grouped_resp["NETWEIGHT_TMT"].round(0)
            grouped_resp["TARGET_QTY_TMT"] = grouped_resp["TARGET_QTY_TMT"].round(0)
            # Return grouped response
            if grouped_resp is not None:
                return {"status": True, "message": "success", "data": grouped_resp.to_dict(orient='records')}

        # If no filters are applied, return the default response
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}

    
    @staticmethod
    async def calculate_ytd(current_date,df,cols,current_month=False):
        current_month_name = current_date.strftime('%B')[:3]
        today = current_date.today()
        #total_days_in_month = (today.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        total_days_in_month = (current_date.today().replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        total_days_in_month = total_days_in_month.day
        days_left_in_month = total_days_in_month - today.day
        if current_month == False:
            current_month_name = df['month_name'].unique().tolist()[0]
        for col in cols:
            df[col] = df[col].fillna(0).astype(np.float64).round(0)
            df[col] = df.apply(
                            lambda row: round(row[col] / (total_days_in_month - days_left_in_month))
                            if row["month_name"] == current_month_name
                            else row[col],  # Leave other rows unchanged
                            axis=1
                    )
        return df
    
    @staticmethod
    async def calculate_date(from_date, to_date, df, col):
        # Convert from_date and to_date to datetime objects
        # Extract abbreviated month names for comparison
        from_month_name = from_date.strftime('%b')  # 'Jan'
        to_month_name = to_date.strftime('%b')      # 'Jan'

        # Define an ordered list of abbreviated month names for proper comparison
        month_order = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

        # Filter rows within the date range based on month_name
        df[col] = df.apply(
            lambda row: round(row[col])
            if month_order.index(from_month_name) <= month_order.index(row["month_name"]) <= month_order.index(to_month_name)
            else row[col],  # Leave other rows unchanged
            axis=1,
        )
        return df
    
    @staticmethod
    async def calculate_actual_history_tmt(from_date_obj, to_date_obj, resp, column_name):
        """
        Calculate the adjusted ACTUAL_HISTORY_TMT for the specified date range based on 
        the number of days in each month within the range.

        Args:
            from_date_obj (datetime): The start date of the range.
            to_date_obj (datetime): The end date of the range.
            resp (pd.DataFrame): The response DataFrame containing the ACTUAL_HISTORY_TMT column.
            column_name (str): The column name to be adjusted.

        Returns:
            pd.DataFrame: The adjusted DataFrame with a new column.
        """
        # Calculate total days in the range
        total_days = (to_date_obj - from_date_obj).days + 1
        
        # Initialize a dictionary to store days for each month
        days_per_month = {}

        # Iterate through all months in the range
        current_date = from_date_obj
        while current_date <= to_date_obj:
            year = current_date.year
            month = current_date.month
            _, days_in_month = calendar.monthrange(year, month)
            
            # Determine the actual start and end days for the current month
            if current_date.month == from_date_obj.month and current_date.year == from_date_obj.year:
                # Start from the given day in the first month
                start_day = from_date_obj.day
            else:
                start_day = 1
            
            if current_date.month == to_date_obj.month and current_date.year == to_date_obj.year:
                # End at the given day in the last month
                end_day = to_date_obj.day
            else:
                end_day = days_in_month
            
            # Calculate days in the current month within the range
            days_in_range = end_day - start_day + 1
            days_per_month[(year, month)] = days_in_range

            # Move to the next month
            next_month = month % 12 + 1
            next_year = year + (month // 12)
            current_date = datetime(next_year, next_month, 1)
        
        # Calculate the fraction of days for each month
        days_per_month_fraction = {key: days / total_days for key, days in days_per_month.items()}

        # Adjust the ACTUAL_HISTORY_TMT values in resp
        resp[column_name] = resp[column_name].fillna(0).astype(int)
        resp[f"{column_name}_adjusted"] = resp[column_name].apply(
            lambda value: sum(value * days_per_month_fraction.get((year, month), 0) 
                            for (year, month) in days_per_month_fraction.keys())
        )

        return resp

    @staticmethod
    async def retail_tar(filters, cross_filters, drill_state, time_grain='', resp_format='',resp_level = ''):
        """
        Fetches the retail tar data for the given filters and drill state.

        Parameters:
            filters (list): List of filter objects to apply to the query.
            drill_state (dict): Current drill state for processing the query.

        Returns:
            dict: Contains the status, a success message, and the sales performance data.
            :param resp_format:
            :param filters:
            :param drill_state:
            :param cross_filters:
            :param time_grain:
        """
        return await dry_out_analysis.retail_tar([rec.dict() for rec in filters],
                                                     [rec.dict() for rec in cross_filters], drill_state, time_grain,
                                                     resp_format)

    @staticmethod
    async def m60_performance(filters, cross_filters, drill_state, time_grain='', resp_format='',resp_level = ''):
        """
        Fetches the sales performance data for the given filters and drill state.

        Parameters:
            filters (list): List of filter objects to apply to the query.
            drill_state (dict): Current drill state for processing the query.

        Returns:
            dict: Contains the status, a success message, and the sales performance data.
            :param resp_format:
            :param filters:
            :param drill_state:
            :param cross_filters:
            :param time_grain:
        """
        return await m60_performance.m60_performance([rec.dict() for rec in filters],
                                                     [rec.dict() for rec in cross_filters], drill_state, time_grain,
                                                     resp_format)

    # lpg_analysis
    @staticmethod
    async def lpg_plant_analysis(filters, cross_filters, drill_state, time_grain='', resp_format='', resp_level=''):
        """
        Fetches the lpg plant data for the given filters and drill state.

        Parameters:
            filters (list): List of filter objects to apply to the query.
            drill_state (dict): Current drill state for processing the query.

        Returns:
            dict: Contains the status, a success message, and the sales performance data.
            :param resp_format:
            :param filters:
            :param drill_state:
            :param cross_filters:
            :param time_grain:
        """
        return await lpg_plant_analysis.lpg_plant_analysis([rec.dict() for rec in filters],
                                                     [rec.dict() for rec in cross_filters], drill_state, time_grain,
                                                     resp_format)

    @staticmethod
    async def industry_performance(filters, cross_filters, drill_state, time_grain='', resp_format='',resp_level=''):
        """
        Fetches the sales performance data for the given filters and drill state.

        Parameters:
            filters (list): List of filter objects to apply to the query.
            drill_state (dict): Current drill state for processing the query.

        Returns:
            dict: Contains the status, a success message, and the sales performance data.
            :param filters:
            :param cross_filters:
            :param drill_state:
            :param resp_format:
            :param time_grain:
        """
        return await industry_performance.industry_performance([rec.dict() for rec in filters],
                                                               [rec.dict() for rec in cross_filters], drill_state,
                                                               time_grain, resp_format,resp_level)

    @staticmethod
    async def m60_performance_old(filters, cross_filters, drill_state):
        """
        Fetches the sales performance data for the given filters and drill state.

        Parameters:
            filters (list): List of filter objects to apply to the query.
            drill_state (dict): Current drill state for processing the query.

        Returns:
            dict: Contains the status, a success message, and the sales performance data.
        """
        '''
        df_pl = pl.read_excel("/opt/ceg/algo/Y2NE_Dec 24 FY2024-25_06.01.25.xlsx", sheet_name="Results", engine='xlsx2csv', engine_options={"skip_rows": 2})
        df = df_pl.to_pandas()    
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

        # Reverse mapping (for returning the short form)
        reverse_month_mapping = {v: k for k, v in month_mapping.items()}
        '''
        month_to_num = {
                "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4,
                "May": 5, "Jun": 6, "Jul": 7, "Aug": 8,
                "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
            }
        if filters and any(rec.key not in ['"H"', '"T"', '"BE"', '"RI"', '"A"', '"I"', '"YTD"', '"DATE"'] for rec in filters):
            print("into only filters")
            sales_performance_query = lpg_plant_queries.lpg_plant_query.get("sales_performance")
            sales_performance_query_ = sales_performance_query
            conditions = []

            # Define keys to exclude from the WHERE clause
            excluded_keys = {'"A"', '"H"', '"T"', '"BE"', '"RI"', '"I"', '"YTD"', '"DATE"'}

            for rec in filters:
                rec.value = rec.value.split(",")
                #if rec.key == '"month_name"':  # Only handle the month_name case separately
                # Check if any value in rec.value is in month_mapping
                #    rec.value = [month_mapping.get(val.strip(), val.strip()) for val in rec.value]

                # Skip keys that should not be added to the WHERE clause
                if rec.key in excluded_keys:
                    continue
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
                sales_performance_query_ += ' WHERE '
                sales_performance_query_ += ' AND '.join(conditions)

        elif len(filters) >= 1 and any(rec.key in ['"H"', '"T"', '"BE"', '"RI"', '"A"', '"I"', '"YTD"', '"DATE'] for rec in filters):
            print("into elif")
            selected_keys = [rec.key.strip('"') for rec in filters]
            #current_date = datetime.now()
            current_date = helpers.get_time_stamp_by_delta(days=0,with_month_start_day=False,date_time_format=None)
            print("current_date",)
            current_year = current_date.year
            next_year = current_year + 1
            current_month = current_date.month
            # Determine the current financial year
            if current_month >= 4:  # April or later
                fiscal_year_start = f"'FY {current_year}-{next_year}'"
            else:  # January to March
                previous_year = current_year - 1
                fiscal_year_start = f"'FY {previous_year}-{current_year}'"
            pres_year_date_filters = ""
            hist_year_date_filters = ""
            
            '''
            removed the below line from the query because we having data directly in DB as  January
            'TO_CHAR(TO_DATE("M60_LEVEL_METADATA"."month_name", \'Month\'), \'Mon\') AS "month_name"'
            
            'TO_CHAR(TO_DATE("M60_LEVEL_METADATA"."month_name", \'Month\'), \'Mon\')',
            '''
            # Initialize the dynamic parts of the query
            #where_conditions = [f'"M60_LEVEL_METADATA"."fiscal_year" = {fiscal_year_start} and "M60_LEVEL_METADATA"."NETWEIGHT_TMT" != 0']
            where_conditions = [f'"M60_LEVEL_METADATA"."fiscal_year" = {fiscal_year_start}']
            select_columns = [
                'ROUND(SUM("M60_LEVEL_METADATA"."NETWEIGHT_TMT")::numeric, 0) AS "ACTUAL_TMT_SALES"',
                '"M60_LEVEL_METADATA"."fy_month" AS "fy_month"',
                '"month_name"',
                '"M60_LEVEL_METADATA"."fiscal_year" AS "fiscal_year"',
            ]
            group_by_columns = [
                '"M60_LEVEL_METADATA"."fy_month"',
                '"month_name"',
                '"M60_LEVEL_METADATA"."fiscal_year"',
            ]

            #Build conditions based on selected keys
            if "H" in selected_keys:
                previous_year = current_year - 1
                where_conditions.append(f'"M60_LEVEL_METADATA"."fiscal_year" IN (\'FY {previous_year}-{current_year}\', \'FY {current_year-2}-{previous_year}\')')

            if "T" in selected_keys:
                select_columns.append('ROUND(SUM("M60_LEVEL_METADATA"."TARGET_QTY_TMT")::numeric,0) AS "TARGET_QTY_TMT"')
            
            # Construct the query dynamically
            sales_performance_query_ = f'''
                SELECT
                    {', '.join(select_columns)}
                FROM
                    "M60_LEVEL_METADATA"
                WHERE
                    {" AND ".join(where_conditions)}
                GROUP BY
                    {', '.join(group_by_columns)}
                ORDER BY
                    "M60_LEVEL_METADATA"."fy_month" ASC;
            '''

            print("Generated Query:", sales_performance_query_)  # Debugging: Print the generated query

            # resp = await function(query=sales_performance_query_)
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(sales_performance_query_, limit=0)
            resp = resp.get("data", [])
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)
            if 'H' in selected_keys:
                year_required = str(current_year-2)+'-'+str(previous_year)
                sales_his_query = f"""
                select "fiscal_year","month_name","NETWEIGHT_TMT" FROM "MOM_LEVEL_FINAL_DATA" where "FISCALYEAR" = 'FY {year_required}'

                """
                # his_data = await function(query=sales_his_query)
                his_data = await urdhva_base.BasePostgresModel.get_aggr_data(sales_his_query, limit=0)
                his_data = his_data.get("data", [])
                his_data = pd.DataFrame(his_data)
                his_data = his_data.groupby(['fiscal_year','month_name'],as_index = False)['NETWEIGHT_TMT'].sum().round(0)
                his_data.to_csv('/tmp/datahis.csv',index = False)
                resp = resp.merge(his_data[['month_name','NETWEIGHT_TMT','fiscal_year']],how='left',on='month_name')
                resp['fiscal_year'] = resp['fiscal_year'].bfill()
            
            # Fill missing values for numerical columns
            for each_float_col in ["NETWEIGHT_TMT","ACTUAL_TMT_SALES", "TARGET_QTY_TMT", 'BPCL', 'CPCL', 'GAIL',
                                    'HMEL', 'HPCL', 'IOCL', 'MRPL', 'NEL', 'NRL','OIL INDIA LIMITED', 'ONGC',
                                    'RBML', 'RIL', 'RSIL', 'SEIPL', 'SIMPL','SMAFSL']:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0).astype(np.float64)
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)
            if "NETWEIGHT_TMT" in resp.columns.tolist():
                resp = resp.rename(columns={'NETWEIGHT_TMT':'ACTUAL_HISTORY_TMT'})
            # Fill missing values for string columns
            for each_str_col in ["fy_month", "month_name"]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
            
            if 'DATE' in selected_keys:
                print("into date")
                year_required = str(current_year-1)+'-'+str(current_year)
                from_date, to_date = [
                        rec.value for rec in filters if rec.key == '"DATE"'
                    ][0].split(",")
                # Convert strings to datetime objects
                from_date_obj = datetime.strptime(from_date, '%Y-%m-%d')
                to_date_obj = datetime.strptime(to_date, '%Y-%m-%d')

                # Get abbreviated month names
                from_date_month = from_date_obj.strftime('%b')  # 'Jan'
                to_date_month = to_date_obj.strftime('%b')      # 'Jan'

                print(f"From Date Month: {from_date_month}, To Date Month: {to_date_month}")
                from_date = from_date.replace("-", "")  # Strip hyphens
                to_date = to_date.replace("-", "")  # Strip hyphens
                date_day_query = f"""
                select "fiscal_year","month_name","NETWEIGHT_TMT" FROM "MOM_DAY_LEVEL_DATA" where "FISCALYEAR" = 'FY {year_required}' and "DAY_ID" between '{from_date}' and '{to_date}'
                """
                print("date_day_query --> ", date_day_query)
                # day_data = await function(query=date_day_query)
                day_data = await urdhva_base.BasePostgresModel.get_aggr_data(date_day_query, limit=0)
                day_data = day_data.get("data", [])
                day_data = pd.DataFrame(day_data)
                day_data = day_data.groupby(['fiscal_year','month_name'],as_index = False)['NETWEIGHT_TMT'].sum().round(0)
                day_data.to_csv('/tmp/dataday.csv',index = False)
                day_data['NETWEIGHT_TMT'] = day_data['NETWEIGHT_TMT'].fillna(0).astype(int)
                resp["month_num"] = resp["month_name"].map(month_to_num)
                # Filter based on the fiscal year boundary
                from_month_num = month_to_num[from_date_month]  # e.g., Apr -> 4
                to_month_num = month_to_num[to_date_month]      # e.g., Jan -> 1
                
                if from_month_num <= to_month_num:
                    # No year boundary (e.g., Apr to Aug)
                    resp = resp[(resp["month_num"] >= from_month_num) & (resp["month_num"] <= to_month_num)]
                else:
                    # Year boundary (e.g., Apr to Jan)
                    resp = resp[(resp["month_num"] >= from_month_num) | (resp["month_num"] <= to_month_num)]

                # Drop the temporary column after filtering
                resp = resp.drop(columns=["month_num"])

                # Merge day_data with resp
                resp = resp.merge(day_data[['month_name', 'NETWEIGHT_TMT', 'fiscal_year']], how='left', on='month_name')
                
                # Rename column and fill NaN values
                resp = resp.rename(columns={"NETWEIGHT_TMT": "ACTUAL_TMT_SALES"})
                resp["ACTUAL_TMT_SALES"] = resp["ACTUAL_TMT_SALES"].fillna(0).astype(int)
                
                # Convert result to dictionary format
                resp = resp.to_dict("records")
            
            if 'T' in selected_keys  and "DATE" in selected_keys:
                print("into date")
                year_required = str(current_year)+'-'+str(current_year+1)
                from_date, to_date = [
                        rec.value for rec in filters if rec.key == '"DATE"'
                    ][0].split(",")
                # Convert strings to datetime objects
                from_date_obj = datetime.strptime(from_date, '%Y-%m-%d')
                to_date_obj = datetime.strptime(to_date, '%Y-%m-%d')

                # Get abbreviated month names
                from_date_month = from_date_obj.strftime('%b')  # 'Jan'
                to_date_month = to_date_obj.strftime('%b')      # 'Jan'

                print(f"From Date Month: {from_date_month}, To Date Month: {to_date_month}")
                from_date = from_date.replace("-", "")  # Strip hyphens
                to_date = to_date.replace("-", "")  # Strip hyphens
                print("resp", resp)
                resp = pd.DataFrame(resp)
                resp = await GlobalAnalytics.calculate_date(from_date_obj, to_date_obj, resp, 'TARGET_QTY_TMT')
                resp["TARGET_QTY_TMT"] = resp["TARGET_QTY_TMT"].fillna(0).astype(int)
                resp = resp.to_dict("records")
               
            if 'H' in selected_keys and "DATE" in selected_keys:
                print("into date")
                year_required = str(current_year)+'-'+str(current_year+1)
                from_date, to_date = [
                        rec.value for rec in filters if rec.key == '"DATE"'
                    ][0].split(",")
                # Convert strings to datetime objects
                from_date_obj = datetime.strptime(from_date, '%Y-%m-%d')
                to_date_obj = datetime.strptime(to_date, '%Y-%m-%d')

                # Get abbreviated month names
                from_date_month = from_date_obj.strftime('%b')  # 'Jan'
                to_date_month = to_date_obj.strftime('%b')      # 'Jan'

                print(f"From Date Month: {from_date_month}, To Date Month: {to_date_month}")
                from_date = from_date.replace("-", "")  # Strip hyphens
                to_date = to_date.replace("-", "")  # Strip hyphens
                print("resp", resp)
                resp = pd.DataFrame(resp)
                resp = await GlobalAnalytics.calculate_actual_history_tmt(from_date_obj, to_date_obj, resp, 'ACTUAL_HISTORY_TMT')
                resp["ACTUAL_HISTORY_TMT"] = resp["ACTUAL_HISTORY_TMT"].fillna(0).astype(int)
                resp = resp.to_dict("records")
            # added for ytd
            resultCols = []
            if 'YTD' in selected_keys:
                # resp = await GlobalAnalytics.calculate_ytd(current_date,resp,['ACTUAL_TMT_SALES'])
                resp = resp
            
            if 'T' in selected_keys  and "YTD" in selected_keys:
                resultCols.append('TARGET_QTY_TMT')
                
               
            if 'H' in selected_keys and "YTD" in selected_keys:
                resultCols.append('ACTUAL_HISTORY_TMT')
            
            if len(resultCols) >0:
                resp = await GlobalAnalytics.calculate_ytd(current_date,resp,resultCols,current_month=True)
            resp = resp.to_dict(orient = 'series')
            for each_key in resp:
                print(each_key)
                if each_key in ['ACTUAL_TMT_SALES']:
                    zero_value_keys = [k for k, v in resp[each_key].items() if v == 0.0]
                    resp[each_key] = {k: v for k, v in resp[each_key].items() if v != 0.0}

                if len(selected_keys) == 1 and 'A' in selected_keys:
                    resp['month_name'] = {k: v for k, v in resp['month_name'].items() if k not in zero_value_keys}

            return {"status": True, "message": "success", "data": resp}

        else:
            current_date = datetime.now()
            current_year = current_date.year
            next_year = current_year + 1
            current_month = current_date.month
            # Determine the current financial year
            if current_month >= 4:  # April or later
                fiscal_year_start = f"'FY {current_year}-{next_year}'"
            else:  # January to March
                previous_year = current_year - 1
                fiscal_year_start = f"'FY {previous_year}-{current_year}'"
                
            '''
            TO_CHAR(TO_DATE("M60_LEVEL_METADATA"."month_name", 'Month'), 'Mon') AS "month_name",
            removed the above line from the below query as the data is directly available as January etc
            TO_CHAR(TO_DATE("M60_LEVEL_METADATA"."month_name", 'Month'), 'Mon'),
            '''
            # Fallback query if no filters are provided
            sales_performance_query_ = f'''
                SELECT
                    ROUND(SUM("M60_LEVEL_METADATA"."NETWEIGHT_TMT")::numeric,0) AS "ACTUAL_TMT_SALES",
                    ROUND(SUM("M60_LEVEL_METADATA"."TARGET_QTY_TMT")::numeric,0) AS "TARGET_TMT_SALES",
                    "M60_LEVEL_METADATA"."fy_month" AS "fy_month",
                    "month_name",
                    "M60_LEVEL_METADATA"."fiscal_year" AS "fiscal_year"
                FROM
                    "M60_LEVEL_METADATA"
                WHERE
                    "M60_LEVEL_METADATA"."NETWEIGHT_TMT" != 0 and   "M60_LEVEL_METADATA"."fiscal_year" = {fiscal_year_start}
                GROUP BY
                    "M60_LEVEL_METADATA"."fy_month",
                    "month_name",
                    "M60_LEVEL_METADATA"."fiscal_year"
                ORDER BY
                    "M60_LEVEL_METADATA"."fy_month" ASC;
            '''
            # resp = await function(query=sales_performance_query_)
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(sales_performance_query_, limit=0)
            resp = resp.get("data", [])
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)

            # Fill missing values for numerical columns
            for each_float_col in [
                "ACTUAL_TMT_SALES"
            ]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)

            # Fill missing values for string columns
            for each_str_col in [
                "fy_month", "month_name"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)

            return {"status": True, "message": "success", "data": resp}

        # Execute the query
        # resp = await function(query=sales_performance_query_)
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(sales_performance_query_, limit=0)
        resp = resp.get("data", [])
        # Convert the response to a DataFrame for further processing
        resp = pd.DataFrame(resp)

        # Fill missing values for numerical columns
        for each_float_col in [
            "TARGET_QTY_TMT", "Prediction_Value", "Product_Achievement", 
            "Zone_Region_Achievement", "Rate_Per_Day_Required_MMT", 
            "Rate_per_day_current_MMT", "FinalSum", "FinalActualSum", "NETWEIGHT_TMT"
        ]:
            if each_float_col in resp.columns:
                resp[each_float_col] = resp[each_float_col].fillna(0.0)

        # Fill missing values for string columns
        for each_str_col in [
            "SBU", "SBU_Name", "ZONE", "Zone_Name", "REGION", "Region_Name", "SA", 
            "SalesArea_Name", "PRODUCT", "ProductName", "UOM", "fiscal_year", 
            "month_year", "month_name"
        ]:
            if each_str_col in resp.columns:
                resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
        if not filters:
            filters = []

        filters = filters + cross_filters  
        # Apply grouping logic based on filters
        if filters:
            grouped_resp = None
            filter_keys = [rec.key.strip('"') for rec in filters]
            filter_values = [rec.value[0].strip('') for rec in filters]
            '''
            if "month_name" in filter_keys:
            # Convert full month names to short form (e.g., "January" -> "Jan")
                resp["month_name"] = resp["month_name"].apply(
                lambda x: reverse_month_mapping.get(x, x)
            )
            '''
            if 'NG' in resp['SBU_Name'].unique().tolist():
                sbu_order = ['Retail', 'LPG', 'I&C', 'Lubes', 'Aviation', 'PETCHEM', 'NG']
                # Create a mapping dictionary for SBU_Name replacements
                sbu_mapping = {"Retail":"Retail", "LPG":"LPG","Lubes":"Lubes","I&C":"I&C", "Aviation":"Aviation", "PETROCHEMICALS SBU": "PETCHEM", "GAS HQO": "NG"}
            else:
                sbu_order = ['Retail', 'LPG', 'I&C', 'Lubes', 'Aviation', 'PETCHEM']
                # Create a mapping dictionary for SBU_Name replacements
                sbu_mapping = {"Retail":"Retail", "LPG":"LPG","Lubes":"Lubes","I&C":"I&C", "Aviation":"Aviation", "PETROCHEMICALS SBU": "PETCHEM"}
            
            resp = resp[resp["SBU_Name"] != "0"]
            resp = resp[resp["Zone_Name"] != "-"]

            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'SBU_Name' in filter_keys:
                # Define the set of valid keys without the quotes
                valid_keys = {'A', 'H', 'T', 'BE', 'RI'}

                # Extract user-selected keys with `value == 'true'`
                selected_keys = set()

                for rec in filters:
                    print(f"rec.key: {rec.key}, rec.value: {rec.value}")  # Debugging: Print key and value
                    if rec.key.strip('"') in valid_keys and 'true' in rec.value:
                        selected_keys.add(rec.key.strip('"'))  # Add the stripped key if valid and value is 'true'
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}

                # Group the response by the selected keys and apply the aggregation functions
                if 'T' in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                print("selected keys ", selected_keys)

                # Check if 'H' is in selected keys and update fiscal year values
                if 'H' in selected_keys:
                    current_date = datetime.now()
                    current_year = current_date.year
                    current_month = current_date.month
                    
                    if current_month >= 4:  # April or later
                        current_fiscal_year = f"FY {current_year}-{current_year + 1}"
                        previous_fiscal_year = f"FY {current_year - 1}-{current_year}"
                    else:  # January to March
                        current_fiscal_year = f"FY {current_year - 1}-{current_year}"
                        previous_fiscal_year = f"FY {current_year - 2}-{current_year - 1}"

                    for rec in filters:
                        if rec.key == "fiscal_year":
                            # Ensure rec.value is a list of fiscal years
                            fiscal_year_values = rec.value if isinstance(rec.value, list) else [rec.value]
                            
                            # Check and add the previous fiscal year
                            if current_fiscal_year in fiscal_year_values:
                                if previous_fiscal_year not in fiscal_year_values:
                                    fiscal_year_values.append(previous_fiscal_year)
                            
                            # Assign the updated list back to rec.value
                            rec.value = fiscal_year_values
                
                    resp = resp[resp["fiscal_year"].isin([current_fiscal_year, previous_fiscal_year])]

                # resp['SBU_Name'] = resp['SBU_Name'].map(sbu_mapping).fillna(resp['SBU_Name'])
                # resp['SBU_Name'] = pd.Categorical(resp['SBU_Name'], categories=sbu_order, ordered=True)
                # resp = resp.sort_values('SBU_Name')

                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["SBU_Name", "Zone_Name"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["SBU_Name", "Zone_Name"], as_index=False).agg(agg_dict)
 
            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'Zone_Name' in filter_keys:
                # Define the set of valid keys without the quotes
                valid_keys = {'A', 'H', 'T', 'BE', 'RI' ,'YTD','DATE'}

                # Extract user-selected keys with `value == 'true'`
                selected_keys = set()

                for rec in filters:
                    print(f"rec.key: {rec.key}, rec.value: {rec.value}")  # Debugging: Print key and value
                    if rec.key.strip('"') in valid_keys and 'true' in rec.value:
                        selected_keys.add(rec.key.strip('"'))  # Add the stripped key if valid and value is 'true'
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}

                # Group the response by the selected keys and apply the aggregation functions
                if 'T' in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                print("selected keys ", selected_keys)

                # Check if 'H' is in selected keys and update fiscal year values
                if 'H' in selected_keys:
                    current_date = datetime.now()
                    current_year = current_date.year
                    current_month = current_date.month
                    
                    if current_month >= 4:  # April or later
                        current_fiscal_year = f"FY {current_year}-{current_year + 1}"
                        previous_fiscal_year = f"FY {current_year - 1}-{current_year}"
                    else:  # January to March
                        current_fiscal_year = f"FY {current_year - 1}-{current_year}"
                        previous_fiscal_year = f"FY {current_year - 2}-{current_year - 1}"

                    for rec in filters:
                        if rec.key == "fiscal_year":
                            # Ensure rec.value is a list of fiscal years
                            fiscal_year_values = rec.value if isinstance(rec.value, list) else [rec.value]
                            
                            # Check and add the previous fiscal year
                            if current_fiscal_year in fiscal_year_values:
                                if previous_fiscal_year not in fiscal_year_values:
                                    fiscal_year_values.append(previous_fiscal_year)
                            
                            # Assign the updated list back to rec.value
                            rec.value = fiscal_year_values
                
                    resp = resp[resp["fiscal_year"].isin([current_fiscal_year, previous_fiscal_year])]

                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["SBU_Name", "Zone_Name", "Region_Name"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["SBU_Name", "Zone_Name", "Region_Name"], as_index=False).agg(agg_dict)                    

            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'Region_Name' in filter_keys:
                # Define the set of valid keys without the quotes
                valid_keys = {'A', 'H', 'T', 'BE', 'RI'}

                # Extract user-selected keys with `value == 'true'`
                selected_keys = set()

                for rec in filters:
                    print(f"rec.key: {rec.key}, rec.value: {rec.value}")  # Debugging: Print key and value
                    if rec.key.strip('"') in valid_keys and 'true' in rec.value:
                        selected_keys.add(rec.key.strip('"'))  # Add the stripped key if valid and value is 'true'
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}

                # Group the response by the selected keys and apply the aggregation functions
                if 'T' in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                print("selected keys ", selected_keys)

                # Check if 'H' is in selected keys and update fiscal year values
                if 'H' in selected_keys:
                    current_date = datetime.now()
                    current_year = current_date.year
                    current_month = current_date.month
                    
                    if current_month >= 4:  # April or later
                        current_fiscal_year = f"FY {current_year}-{current_year + 1}"
                        previous_fiscal_year = f"FY {current_year - 1}-{current_year}"
                    else:  # January to March
                        current_fiscal_year = f"FY {current_year - 1}-{current_year}"
                        previous_fiscal_year = f"FY {current_year - 2}-{current_year - 1}"

                    for rec in filters:
                        if rec.key == "fiscal_year":
                            # Ensure rec.value is a list of fiscal years
                            fiscal_year_values = rec.value if isinstance(rec.value, list) else [rec.value]
                            
                            # Check and add the previous fiscal year
                            if current_fiscal_year in fiscal_year_values:
                                if previous_fiscal_year not in fiscal_year_values:
                                    fiscal_year_values.append(previous_fiscal_year)
                            
                            # Assign the updated list back to rec.value
                            rec.value = fiscal_year_values
                
                    resp = resp[resp["fiscal_year"].isin([current_fiscal_year, previous_fiscal_year])]

                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name"], as_index=False).agg(agg_dict)

            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'SalesArea_Name' in filter_keys:
                # Define the set of valid keys without the quotes
                valid_keys = {'A', 'H', 'T', 'BE', 'RI'}

                # Extract user-selected keys with `value == 'true'`
                selected_keys = set()

                for rec in filters:
                    print(f"rec.key: {rec.key}, rec.value: {rec.value}")  # Debugging: Print key and value
                    if rec.key.strip('"') in valid_keys and 'true' in rec.value:
                        selected_keys.add(rec.key.strip('"'))  # Add the stripped key if valid and value is 'true'
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}

                # Group the response by the selected keys and apply the aggregation functions
                if 'T' in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                print("selected keys ", selected_keys)

                # Check if 'H' is in selected keys and update fiscal year values
                if 'H' in selected_keys:
                    current_date = datetime.now()
                    current_year = current_date.year
                    current_month = current_date.month
                    
                    if current_month >= 4:  # April or later
                        current_fiscal_year = f"FY {current_year}-{current_year + 1}"
                        previous_fiscal_year = f"FY {current_year - 1}-{current_year}"
                    else:  # January to March
                        current_fiscal_year = f"FY {current_year - 1}-{current_year}"
                        previous_fiscal_year = f"FY {current_year - 2}-{current_year - 1}"

                    for rec in filters:
                        if rec.key == "fiscal_year":
                            # Ensure rec.value is a list of fiscal years
                            fiscal_year_values = rec.value if isinstance(rec.value, list) else [rec.value]
                            
                            # Check and add the previous fiscal year
                            if current_fiscal_year in fiscal_year_values:
                                if previous_fiscal_year not in fiscal_year_values:
                                    fiscal_year_values.append(previous_fiscal_year)
                            
                            # Assign the updated list back to rec.value
                            rec.value = fiscal_year_values
                
                    resp = resp[resp["fiscal_year"].isin([current_fiscal_year, previous_fiscal_year])]
                
                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"], as_index=False).agg(agg_dict)
                
            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'ProductName' in filter_keys:
                # Define the set of valid keys without the quotes
                valid_keys = {'A', 'H', 'T', 'BE', 'RI'}

                # Extract user-selected keys with `value == 'true'`
                selected_keys = set()

                for rec in filters:
                    print(f"rec.key: {rec.key}, rec.value: {rec.value}")  # Debugging: Print key and value
                    if rec.key.strip('"') in valid_keys and 'true' in rec.value:
                        selected_keys.add(rec.key.strip('"'))  # Add the stripped key if valid and value is 'true'
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}

                # Group the response by the selected keys and apply the aggregation functions
                if 'T' in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                print("selected keys ", selected_keys)

                # Check if 'H' is in selected keys and update fiscal year values
                if 'H' in selected_keys:
                    current_date = datetime.now()
                    current_year = current_date.year
                    current_month = current_date.month
                    
                    if current_month >= 4:  # April or later
                        current_fiscal_year = f"FY {current_year}-{current_year + 1}"
                        previous_fiscal_year = f"FY {current_year - 1}-{current_year}"
                    else:  # January to March
                        current_fiscal_year = f"FY {current_year - 1}-{current_year}"
                        previous_fiscal_year = f"FY {current_year - 2}-{current_year - 1}"

                    for rec in filters:
                        if rec.key == "fiscal_year":
                            # Ensure rec.value is a list of fiscal years
                            fiscal_year_values = rec.value if isinstance(rec.value, list) else [rec.value]
                            
                            # Check and add the previous fiscal year
                            if current_fiscal_year in fiscal_year_values:
                                if previous_fiscal_year not in fiscal_year_values:
                                    fiscal_year_values.append(previous_fiscal_year)
                            
                            # Assign the updated list back to rec.value
                            rec.value = fiscal_year_values
                
                    resp = resp[resp["fiscal_year"].isin([current_fiscal_year, previous_fiscal_year])]

                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"], as_index=False).agg(agg_dict)

            if len(filters) == 2 and "month_name" in filter_keys and "SBU_Name" in filter_keys:
                # Define the set of valid keys without the quotes
                valid_keys = {'A', 'H', 'T', 'BE', 'RI'}

                # Extract user-selected keys with `value == 'true'`
                selected_keys = set()

                for rec in filters:
                    print(f"rec.key: {rec.key}, rec.value: {rec.value}")  # Debugging: Print key and value
                    if rec.key.strip('"') in valid_keys and 'true' in rec.value:
                        selected_keys.add(rec.key.strip('"'))  # Add the stripped key if valid and value is 'true'
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}

                # Group the response by the selected keys and apply the aggregation functions
                if 'T' in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                print("selected keys ", selected_keys)

                # Check if 'H' is in selected keys and update fiscal year values
                if 'H' in selected_keys:
                    current_date = datetime.now()
                    current_year = current_date.year
                    current_month = current_date.month
                    
                    if current_month >= 4:  # April or later
                        current_fiscal_year = f"FY {current_year}-{current_year + 1}"
                        previous_fiscal_year = f"FY {current_year - 1}-{current_year}"
                    else:  # January to March
                        current_fiscal_year = f"FY {current_year - 1}-{current_year}"
                        previous_fiscal_year = f"FY {current_year - 2}-{current_year - 1}"

                    for rec in filters:
                        if rec.key == "fiscal_year":
                            # Ensure rec.value is a list of fiscal years
                            fiscal_year_values = rec.value if isinstance(rec.value, list) else [rec.value]
                            
                            # Check and add the previous fiscal year
                            if current_fiscal_year in fiscal_year_values:
                                if previous_fiscal_year not in fiscal_year_values:
                                    fiscal_year_values.append(previous_fiscal_year)
                            
                            # Assign the updated list back to rec.value
                            rec.value = fiscal_year_values
                
                    resp = resp[resp["fiscal_year"].isin([current_fiscal_year, previous_fiscal_year])]

                resp['SBU_Name'] = resp['SBU_Name'].map(sbu_mapping).fillna(resp['SBU_Name'])
                resp['SBU_Name'] = pd.Categorical(resp['SBU_Name'], categories=sbu_order, ordered=True)
                resp = resp.sort_values('SBU_Name')

                if selected_keys:
                    grouped_resp = resp.groupby(["month_name", "SBU_Name"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["month_name", "SBU_Name"], as_index=False).agg(agg_dict)
            
            elif len(filters) == 2 and "month_name" in filter_keys and "Zone_Name" in filter_keys:
                # Define the set of valid keys without the quotes
                valid_keys = {'A', 'H', 'T', 'BE', 'RI'}

                # Extract user-selected keys with `value == 'true'`
                selected_keys = set()

                for rec in filters:
                    print(f"rec.key: {rec.key}, rec.value: {rec.value}")  # Debugging: Print key and value
                    if rec.key.strip('"') in valid_keys and 'true' in rec.value:
                        selected_keys.add(rec.key.strip('"'))  # Add the stripped key if valid and value is 'true'
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}

                # Group the response by the selected keys and apply the aggregation functions
                if 'T' in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                print("selected keys ", selected_keys)

                # Check if 'H' is in selected keys and update fiscal year values
                if 'H' in selected_keys:
                    current_date = datetime.now()
                    current_year = current_date.year
                    current_month = current_date.month
                    
                    if current_month >= 4:  # April or later
                        current_fiscal_year = f"FY {current_year}-{current_year + 1}"
                        previous_fiscal_year = f"FY {current_year - 1}-{current_year}"
                    else:  # January to March
                        current_fiscal_year = f"FY {current_year - 1}-{current_year}"
                        previous_fiscal_year = f"FY {current_year - 2}-{current_year - 1}"

                    for rec in filters:
                        if rec.key == "fiscal_year":
                            # Ensure rec.value is a list of fiscal years
                            fiscal_year_values = rec.value if isinstance(rec.value, list) else [rec.value]
                            
                            # Check and add the previous fiscal year
                            if current_fiscal_year in fiscal_year_values:
                                if previous_fiscal_year not in fiscal_year_values:
                                    fiscal_year_values.append(previous_fiscal_year)
                            
                            # Assign the updated list back to rec.value
                            rec.value = fiscal_year_values
                
                    resp = resp[resp["fiscal_year"].isin([current_fiscal_year, previous_fiscal_year])]

                if selected_keys:
                    grouped_resp = resp.groupby(["month_name", "Zone_Name"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["month_name", "Zone_Name"], as_index=False).agg(agg_dict)
            
            elif len(filters) == 2 and "month_name" in filter_keys and "Region_Name" in filter_keys:
                # Define the set of valid keys without the quotes
                valid_keys = {'A', 'H', 'T', 'BE', 'RI'}

                # Extract user-selected keys with `value == 'true'`
                selected_keys = set()

                for rec in filters:
                    print(f"rec.key: {rec.key}, rec.value: {rec.value}")  # Debugging: Print key and value
                    if rec.key.strip('"') in valid_keys and 'true' in rec.value:
                        selected_keys.add(rec.key.strip('"'))  # Add the stripped key if valid and value is 'true'
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}

                # Group the response by the selected keys and apply the aggregation functions
                if 'T' in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                print("selected keys ", selected_keys)

                # Check if 'H' is in selected keys and update fiscal year values
                if 'H' in selected_keys:
                    current_date = datetime.now()
                    current_year = current_date.year
                    current_month = current_date.month
                    
                    if current_month >= 4:  # April or later
                        current_fiscal_year = f"FY {current_year}-{current_year + 1}"
                        previous_fiscal_year = f"FY {current_year - 1}-{current_year}"
                    else:  # January to March
                        current_fiscal_year = f"FY {current_year - 1}-{current_year}"
                        previous_fiscal_year = f"FY {current_year - 2}-{current_year - 1}"

                    for rec in filters:
                        if rec.key == "fiscal_year":
                            # Ensure rec.value is a list of fiscal years
                            fiscal_year_values = rec.value if isinstance(rec.value, list) else [rec.value]
                            
                            # Check and add the previous fiscal year
                            if current_fiscal_year in fiscal_year_values:
                                if previous_fiscal_year not in fiscal_year_values:
                                    fiscal_year_values.append(previous_fiscal_year)
                            
                            # Assign the updated list back to rec.value
                            rec.value = fiscal_year_values
                
                    resp = resp[resp["fiscal_year"].isin([current_fiscal_year, previous_fiscal_year])]
                
                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["month_name", "Region_Name"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["month_name", "Region_Name"], as_index=False).agg(agg_dict)
            
            elif len(filters) == 2 and "month_name" in filter_keys and "SalesArea_Name" in filter_keys:
                # Define the set of valid keys without the quotes
                valid_keys = {'A', 'H', 'T', 'BE', 'RI'}

                # Extract user-selected keys with `value == 'true'`
                selected_keys = set()

                for rec in filters:
                    print(f"rec.key: {rec.key}, rec.value: {rec.value}")  # Debugging: Print key and value
                    if rec.key.strip('"') in valid_keys and 'true' in rec.value:
                        selected_keys.add(rec.key.strip('"'))  # Add the stripped key if valid and value is 'true'
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}

                # Group the response by the selected keys and apply the aggregation functions
                if 'T' in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                print("selected keys ", selected_keys)

                # Check if 'H' is in selected keys and update fiscal year values
                if 'H' in selected_keys:
                    current_date = datetime.now()
                    current_year = current_date.year
                    current_month = current_date.month
                    
                    if current_month >= 4:  # April or later
                        current_fiscal_year = f"FY {current_year}-{current_year + 1}"
                        previous_fiscal_year = f"FY {current_year - 1}-{current_year}"
                    else:  # January to March
                        current_fiscal_year = f"FY {current_year - 1}-{current_year}"
                        previous_fiscal_year = f"FY {current_year - 2}-{current_year - 1}"

                    for rec in filters:
                        if rec.key == "fiscal_year":
                            # Ensure rec.value is a list of fiscal years
                            fiscal_year_values = rec.value if isinstance(rec.value, list) else [rec.value]
                            
                            # Check and add the previous fiscal year
                            if current_fiscal_year in fiscal_year_values:
                                if previous_fiscal_year not in fiscal_year_values:
                                    fiscal_year_values.append(previous_fiscal_year)
                            
                            # Assign the updated list back to rec.value
                            rec.value = fiscal_year_values
                
                    resp = resp[resp["fiscal_year"].isin([current_fiscal_year, previous_fiscal_year])]
                
                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["month_name", "SalesArea_Name"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["month_name", "SalesArea_Name"], as_index=False).agg(agg_dict)
            
            elif len(filters) == 2 and "month_name" in filter_keys and "ProductName" in filter_keys:
                # Define the set of valid keys without the quotes
                valid_keys = {'A', 'H', 'T', 'BE', 'RI'}

                # Extract user-selected keys with `value == 'true'`
                selected_keys = set()

                for rec in filters:
                    print(f"rec.key: {rec.key}, rec.value: {rec.value}")  # Debugging: Print key and value
                    if rec.key.strip('"') in valid_keys and 'true' in rec.value:
                        selected_keys.add(rec.key.strip('"'))  # Add the stripped key if valid and value is 'true'
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}

                # Group the response by the selected keys and apply the aggregation functions
                if 'T' in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                print("selected keys ", selected_keys)

                # Check if 'H' is in selected keys and update fiscal year values
                if 'H' in selected_keys:
                    current_date = datetime.now()
                    current_year = current_date.year
                    current_month = current_date.month
                    
                    if current_month >= 4:  # April or later
                        current_fiscal_year = f"FY {current_year}-{current_year + 1}"
                        previous_fiscal_year = f"FY {current_year - 1}-{current_year}"
                    else:  # January to March
                        current_fiscal_year = f"FY {current_year - 1}-{current_year}"
                        previous_fiscal_year = f"FY {current_year - 2}-{current_year - 1}"

                    for rec in filters:
                        if rec.key == "fiscal_year":
                            # Ensure rec.value is a list of fiscal years
                            fiscal_year_values = rec.value if isinstance(rec.value, list) else [rec.value]
                            
                            # Check and add the previous fiscal year
                            if current_fiscal_year in fiscal_year_values:
                                if previous_fiscal_year not in fiscal_year_values:
                                    fiscal_year_values.append(previous_fiscal_year)
                            
                            # Assign the updated list back to rec.value
                            rec.value = fiscal_year_values
                
                    resp = resp[resp["fiscal_year"].isin([current_fiscal_year, previous_fiscal_year])]
                
                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["month_name", "ProductName"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["month_name", "ProductName"], as_index=False).agg(agg_dict)

            elif "fiscal_year" in filter_keys and "month_name" not in filter_keys:
                # Define the set of valid keys without the quotes
                valid_keys = {'A', 'H', 'T', 'BE', 'RI','YTD'}

                # Extract user-selected keys with `value == 'true'`
                selected_keys = set()

                for rec in filters:
                    print(f"rec.key: {rec.key}, rec.value: {rec.value}")  # Debugging: Print key and value
                    if rec.key.strip('"') in valid_keys and 'true' in rec.value:
                        selected_keys.add(rec.key.strip('"'))  # Add the stripped key if valid and value is 'true'
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}

                # Group the response by the selected keys and apply the aggregation functions
                if 'T' in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                print("selected keys ", selected_keys)
            
                # Check if 'H' is in selected keys and update fiscal year values
                if 'H' in selected_keys:
                    current_date = datetime.now()
                    current_year = current_date.year
                    current_month = current_date.month
                    
                    if current_month >= 4:  # April or later
                        current_fiscal_year = f"FY {current_year}-{current_year + 1}"
                        previous_fiscal_year = f"FY {current_year - 1}-{current_year}"
                    else:  # January to March
                        current_fiscal_year = f"FY {current_year - 1}-{current_year}"
                        previous_fiscal_year = f"FY {current_year - 2}-{current_year - 1}"

                    for rec in filters:
                        if rec.key == "fiscal_year":
                            # Ensure rec.value is a list of fiscal years
                            fiscal_year_values = rec.value if isinstance(rec.value, list) else [rec.value]
                            
                            # Check and add the previous fiscal year
                            if current_fiscal_year in fiscal_year_values:
                                if previous_fiscal_year not in fiscal_year_values:
                                    fiscal_year_values.append(previous_fiscal_year)
                            
                            # Assign the updated list back to rec.value
                            rec.value = fiscal_year_values
                
                    resp = resp[resp["fiscal_year"].isin([current_fiscal_year, previous_fiscal_year])]
                    year_required = str(current_year-2)+'-'+str(current_year-1)
                    sales_his_query = f"""
                    select "fiscal_year","month_name","NETWEIGHT_TMT" FROM "MOM_LEVEL_FINAL_DATA" where "FISCALYEAR" = 'FY {year_required}'

                    """

                    # his_data = await function(query=sales_his_query)
                    his_data = await urdhva_base.BasePostgresModel.get_aggr_data(query=sales_his_query, limit=0)
                    his_data = his_data.get("data", [])
                    his_data = pd.DataFrame(his_data)
                    his_data = his_data.groupby(['fiscal_year','month_name'],as_index = False)['NETWEIGHT_TMT'].sum().round(0)
                    his_data = his_data.rename(columns = {'NETWEIGHT_TMT':'ACTUAL_HISTORY_TMT'})
                    resp['month_name'] = resp['month_name'].apply(lambda x:x[:3] if len(x)>=3 else x)
                    resp = resp.merge(his_data[['month_name','ACTUAL_HISTORY_TMT','fiscal_year']],how='left',on='month_name')
                    resp['fiscal_year'] = resp['fiscal_year'].bfill()
                    if "ACTUAL_HISTORY_TMT" in resp.columns.tolist():
                        resp['ACTUAL_HISTORY_TMT'] = resp['ACTUAL_HISTORY_TMT'].fillna(0).astype(int)
                    agg_dict["ACTUAL_HISTORY_TMT"] = "max"
                    
                    
                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["fiscal_year", "month_name"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["fiscal_year", "month_name"], as_index=False).agg(agg_dict)  
                resultCols = []
                
                if "H" in selected_keys and "YTD" in selected_keys:
                        resultCols.append("ACTUAL_HISTORY_TMT")
                        
                if "T" in selected_keys and "YTD" in selected_keys:
                    resultCols.append("TARGET_QTY_TMT")
                    
                if len(resultCols)>0:
                    current_date = helpers.get_time_stamp_by_delta(days=0,with_month_start_day=False,date_time_format=None)
                    grouped_resp = await GlobalAnalytics.calculate_ytd(current_date,grouped_resp,resultCols,current_month=False)

                    
            elif "fiscal_year" in filter_keys and "month_name" in filter_keys and "SBU_Name" not in filter_keys:
                # Define the set of valid keys without the quotes
                valid_keys = {'A', 'H', 'T', 'BE', 'RI','YTD','DATE'}

                # Extract user-selected keys with `value == 'true'`
                selected_keys = set()

                for rec in filters:
                    print(f"rec.key: {rec.key}, rec.value: {rec.value}")  # Debugging: Print key and value
                    if rec.key.strip('"') in valid_keys and 'true' in rec.value:
                        selected_keys.add(rec.key.strip('"'))  # Add the stripped key if valid and value is 'true'
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}

                # Group the response by the selected keys and apply the aggregation functions
                if 'T' in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                print("selected keys ", selected_keys)
                
                # Check if 'H' is in selected keys and update fiscal year values
                if 'H' in selected_keys:
                    current_date = datetime.now()
                    current_year = current_date.year
                    current_month = current_date.month
                    
                    if current_month >= 4:  # April or later
                        current_fiscal_year = f"FY {current_year}-{current_year + 1}"
                        previous_fiscal_year = f"FY {current_year - 1}-{current_year}"
                    else:  # January to March
                        current_fiscal_year = f"FY {current_year - 1}-{current_year}"
                        previous_fiscal_year = f"FY {current_year - 2}-{current_year - 1}"

                    for rec in filters:
                        if rec.key == "fiscal_year":
                            # Ensure rec.value is a list of fiscal years
                            fiscal_year_values = rec.value if isinstance(rec.value, list) else [rec.value]
                            
                            # Check and add the previous fiscal year
                            if current_fiscal_year in fiscal_year_values:
                                if previous_fiscal_year not in fiscal_year_values:
                                    fiscal_year_values.append(previous_fiscal_year)
                            
                            # Assign the updated list back to rec.value
                            rec.value = fiscal_year_values
                
                    resp = resp[resp["fiscal_year"].isin([current_fiscal_year, previous_fiscal_year])]
                    year_required = str(current_year-2)+'-'+str(current_year-1)
                    sales_his_query = f"""
                                        SELECT "fiscal_year","month_name","ORGSBUNAME","NETWEIGHT_TMT" 
                                        FROM "MOM_LEVEL_FINAL_DATA" 
                                        WHERE "FISCALYEAR" = 'FY {year_required}'
                    """
                    if "month_name" in filter_keys:
                        ## Find the filter with key "month_name"
                        month_filter = next((rec for rec in filters if rec.key.strip('"') == "month_name"), None)
                        if month_filter:
                            # Extract the month name value (handle string or list values)
                            month_name = month_filter.value if isinstance(month_filter.value, str) else month_filter.value[0]
                            sales_his_query += f""" and "month_name" = '{month_name[:3]}'"""
                    print("sales_his_query",sales_his_query)
                    # his_data = await function(query=sales_his_query)
                    his_data = await urdhva_base.BasePostgresModel.get_aggr_data(query=sales_his_query, limit=0)
                    his_data = his_data.get("data", [])
                    his_data = pd.DataFrame(his_data)
                    his_data['ORGSBUNAME'] = his_data['ORGSBUNAME'].str.strip("DS").str.strip()
                    his_data = his_data.groupby(['fiscal_year','month_name','ORGSBUNAME'],as_index = False)['NETWEIGHT_TMT'].sum().round(0)
                    his_data['ORGSBUNAME'] = his_data['ORGSBUNAME'].fillna('').astype(str)
                    his_data = his_data.rename(columns = {'NETWEIGHT_TMT':'ACTUAL_HISTORY_TMT'})
                    resp['month_name'] = resp['month_name'].apply(lambda x:x[:3] if len(x)>=3 else x)
                    resp = resp.merge(his_data[['month_name','ACTUAL_HISTORY_TMT','fiscal_year','ORGSBUNAME']],how='left',left_on=['month_name','SBU_Name'],right_on = ['month_name','ORGSBUNAME'])
                    resp['fiscal_year'] = resp['fiscal_year'].bfill()
                    if "ACTUAL_HISTORY_TMT" in resp.columns.tolist():
                        resp['ACTUAL_HISTORY_TMT'] = resp['ACTUAL_HISTORY_TMT'].fillna(0).astype(int)
                    agg_dict["ACTUAL_HISTORY_TMT"] = lambda x: ', '.join(map(str, x.unique()))

                resp['SBU_Name'] = resp['SBU_Name'].map(sbu_mapping).fillna(resp['SBU_Name'])
                resp['SBU_Name'] = pd.Categorical(resp['SBU_Name'], categories=sbu_order, ordered=True)
                resp = resp.sort_values('SBU_Name')
                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["fiscal_year", "month_name", "SBU_Name"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["fiscal_year", "month_name", "SBU_Name"], as_index=False).agg(agg_dict)
                
                resultCols = []
                
                if "H" in selected_keys and "YTD" in selected_keys:
                        resultCols.append("ACTUAL_HISTORY_TMT")
                        
                if "T" in selected_keys and "YTD" in selected_keys:
                    resultCols.append("TARGET_QTY_TMT")
                        
                if len(resultCols)>0:
                    current_date = helpers.get_time_stamp_by_delta(days=0,with_month_start_day=False,date_time_format=None)
                    grouped_resp = await GlobalAnalytics.calculate_ytd(current_date,grouped_resp,resultCols,current_month=False)
            
            elif "fiscal_year" in filter_keys and "month_name" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" not in filter_keys:
                # Define the set of valid keys without the quotes
                valid_keys = {'A', 'H', 'T', 'BE', 'RI','YTD','DATE'}

                # Extract user-selected keys with `value == 'true'`
                selected_keys = set()

                for rec in filters:
                    print(f"rec.key: {rec.key}, rec.value: {rec.value}")  # Debugging: Print key and value
                    if rec.key.strip('"') in valid_keys and 'true' in rec.value:
                        selected_keys.add(rec.key.strip('"'))  # Add the stripped key if valid and value is 'true'
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}

                # Group the response by the selected keys and apply the aggregation functions
                if 'T' in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                print("selected keys ", selected_keys)

                # Check if 'H' is in selected keys and update fiscal year values
                if 'H' in selected_keys:
                    current_date = datetime.now()
                    current_year = current_date.year
                    current_month = current_date.month
                    
                    if current_month >= 4:  # April or later
                        current_fiscal_year = f"FY {current_year}-{current_year + 1}"
                        previous_fiscal_year = f"FY {current_year - 1}-{current_year}"
                    else:  # January to March
                        current_fiscal_year = f"FY {current_year - 1}-{current_year}"
                        previous_fiscal_year = f"FY {current_year - 2}-{current_year - 1}"

                    for rec in filters:
                        if rec.key == "fiscal_year":
                            # Ensure rec.value is a list of fiscal years
                            fiscal_year_values = rec.value if isinstance(rec.value, list) else [rec.value]
                            
                            # Check and add the previous fiscal year
                            if current_fiscal_year in fiscal_year_values:
                                if previous_fiscal_year not in fiscal_year_values:
                                    fiscal_year_values.append(previous_fiscal_year)
                            
                            # Assign the updated list back to rec.value
                            rec.value = fiscal_year_values
                
                    resp = resp[resp["fiscal_year"].isin([current_fiscal_year, previous_fiscal_year])]
                    year_required = str(current_year-2)+'-'+str(current_year-1)
                    sales_his_query = f"""
                    select "fiscal_year","month_name","ORGSBUNAME","ORGZONENAME","NETWEIGHT_TMT" FROM "MOM_LEVEL_FINAL_DATA" where "FISCALYEAR" = 'FY {year_required}'
                    """
                    if "month_name" in filter_keys:
                        sales_his_query += f""" and "month_name" = '{filter_values[1][:3]}'"""
                    # his_data = await function(query=sales_his_query)
                    his_data = await urdhva_base.BasePostgresModel.get_aggr_data(query=sales_his_query, limit=0)
                    his_data = his_data.get("data", [])
                    his_data = pd.DataFrame(his_data)
                    his_data['ORGSBUNAME'] = his_data['ORGSBUNAME'].str.strip("DS").str.strip()
                    his_data = his_data.groupby(['fiscal_year','month_name','ORGSBUNAME','ORGZONENAME'],as_index = False)['NETWEIGHT_TMT'].sum().round(0)
                    his_data['ORGSBUNAME'] = his_data['ORGSBUNAME'].fillna('').astype(str)
                    his_data['ORGZONENAME'] = his_data['ORGZONENAME'].fillna('').astype(str)
                    his_data = his_data.rename(columns = {'NETWEIGHT_TMT':'ACTUAL_HISTORY_TMT'})
                    resp['month_name'] = resp['month_name'].apply(lambda x:x[:3] if len(x)>=3 else x)
                    resp = resp.merge(his_data[['month_name','ACTUAL_HISTORY_TMT','fiscal_year','ORGSBUNAME','ORGZONENAME']],
                                      how='left',left_on=['month_name','SBU_Name','Zone_Name'],
                                      right_on = ['month_name','ORGSBUNAME','ORGZONENAME'])
                    resp['fiscal_year'] = resp['fiscal_year'].bfill()
                    if "ACTUAL_HISTORY_TMT" in resp.columns.tolist():
                        resp['ACTUAL_HISTORY_TMT'] = resp['ACTUAL_HISTORY_TMT'].fillna(0).astype(int)
                    agg_dict["ACTUAL_HISTORY_TMT"] = lambda x: ', '.join(map(str, x.unique()))

                # resp['SBU_Name'] = resp['SBU_Name'].map(sbu_mapping).fillna(resp['SBU_Name'])
                # resp['SBU_Name'] = pd.Categorical(resp['SBU_Name'], categories=sbu_order, ordered=True)
                # resp = resp.sort_values('SBU_Name')

                # If any valid keys are selected, group the data
                grouped_keys = ["fiscal_year", "month_name", "SBU_Name"]

                # If valid keys are selected, apply conditional grouping
                if selected_keys:
                    # Check the last filter's value for specific keywords
                    if "DS Lubes" in filter_values or "DS" in filter_values or "Lubes" in filter_values:
                        print("DS Lubes selected")
                        grouped_keys.extend(["Region_Name"])
                    else:
                        print("No DS Lubes selected")
                        grouped_keys.extend(["Zone_Name"])
                else:
                    print("No keys selected")
                    if "DS Lubes" in filter_values or "DS" in filter_values or "Lubes" in filter_values:
                        print("DS Lubes selected")
                        grouped_keys.extend(["Region_Name"])
                    else:
                        # If no valid keys are selected, group by all keys
                        grouped_keys.extend(["Zone_Name"])

                # Add grouping logic based on the updated grouped_keys
                grouped_resp = resp.groupby(grouped_keys, as_index=False).agg(agg_dict)
                resultCols= []
                
                if "H" in selected_keys and "YTD" in selected_keys:
                        resultCols.append("ACTUAL_HISTORY_TMT")
                        
                if "T" in selected_keys and "YTD" in selected_keys:
                    resultCols.append("TARGET_QTY_TMT")
                        
                if len(resultCols)>0:
                    current_date = helpers.get_time_stamp_by_delta(days=0,with_month_start_day=False,date_time_format=None)
                    grouped_resp = await GlobalAnalytics.calculate_ytd(current_date,grouped_resp,resultCols,current_month=False)

            elif "fiscal_year" in filter_keys and "month_name" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys and "Region_Name" not in filter_keys:
                # Define the set of valid keys without the quotes
                valid_keys = {'A', 'H', 'T', 'BE', 'RI','YTD','DATE'}

                # Extract user-selected keys with `value == 'true'`
                selected_keys = set()

                for rec in filters:
                    print(f"rec.key: {rec.key}, rec.value: {rec.value}")  # Debugging: Print key and value
                    if rec.key.strip('"') in valid_keys and 'true' in rec.value:
                        selected_keys.add(rec.key.strip('"'))  # Add the stripped key if valid and value is 'true'
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}

                # Group the response by the selected keys and apply the aggregation functions
                if 'T' in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                print("selected keys ", selected_keys)

                # Check if 'H' is in selected keys and update fiscal year values
                if 'H' in selected_keys:
                    current_date = datetime.now()
                    current_year = current_date.year
                    current_month = current_date.month
                    
                    if current_month >= 4:  # April or later
                        current_fiscal_year = f"FY {current_year}-{current_year + 1}"
                        previous_fiscal_year = f"FY {current_year - 1}-{current_year}"
                    else:  # January to March
                        current_fiscal_year = f"FY {current_year - 1}-{current_year}"
                        previous_fiscal_year = f"FY {current_year - 2}-{current_year - 1}"

                    for rec in filters:
                        if rec.key == "fiscal_year":
                            # Ensure rec.value is a list of fiscal years
                            fiscal_year_values = rec.value if isinstance(rec.value, list) else [rec.value]
                            
                            # Check and add the previous fiscal year
                            if current_fiscal_year in fiscal_year_values:
                                if previous_fiscal_year not in fiscal_year_values:
                                    fiscal_year_values.append(previous_fiscal_year)
                            
                            # Assign the updated list back to rec.value
                            rec.value = fiscal_year_values
                
                    resp = resp[resp["fiscal_year"].isin([current_fiscal_year, previous_fiscal_year])]
                    year_required = str(current_year-2)+'-'+str(current_year-1)
                    sales_his_query = f"""
                    select "fiscal_year","month_name","ORGSBUNAME","ORGZONENAME","ORGRONAME","NETWEIGHT_TMT" FROM "MOM_LEVEL_FINAL_DATA" where "FISCALYEAR" = 'FY {year_required}'

                    """
                    if "month_name" in filter_keys:
                        sales_his_query += f""" and "month_name" = '{filter_values[1][:3]}'"""
                    # his_data = await function(query=sales_his_query)
                    his_data = await urdhva_base.BasePostgresModel.get_aggr_data(query=sales_his_query, limit=0)
                    his_data = his_data.get("data", [])
                    his_data = pd.DataFrame(his_data)
                    his_data['ORGSBUNAME'] = his_data['ORGSBUNAME'].str.strip("DS").str.strip()
                    his_data = his_data.groupby(['fiscal_year','month_name','ORGSBUNAME','ORGZONENAME','ORGRONAME'],as_index = False)['NETWEIGHT_TMT'].sum().round(0)
                    his_data['ORGSBUNAME'] = his_data['ORGSBUNAME'].fillna('').astype(str)
                    his_data['ORGZONENAME'] = his_data['ORGZONENAME'].fillna('').astype(str)
                    his_data['ORGRONAME'] = his_data['ORGRONAME'].fillna('').astype(str)
                    his_data = his_data.rename(columns = {'NETWEIGHT_TMT':'ACTUAL_HISTORY_TMT'})
                    resp['month_name'] = resp['month_name'].apply(lambda x:x[:3] if len(x)>=3 else x)
                    resp = resp.merge(his_data[['month_name','ACTUAL_HISTORY_TMT','fiscal_year','ORGSBUNAME','ORGZONENAME','ORGRONAME']],
                                      how='left',left_on=['month_name','SBU_Name','Zone_Name','Region_Name'],
                                      right_on = ['month_name','ORGSBUNAME','ORGZONENAME','ORGRONAME'])
                    resp['fiscal_year'] = resp['fiscal_year'].bfill()
                    if "ACTUAL_HISTORY_TMT" in resp.columns.tolist():
                        resp['ACTUAL_HISTORY_TMT'] = resp['ACTUAL_HISTORY_TMT'].fillna(0).astype(int)
                    agg_dict["ACTUAL_HISTORY_TMT"] = lambda x: ', '.join(map(str, x.unique()))
                
                # resp['SBU_Name'] = resp['SBU_Name'].map(sbu_mapping).fillna(resp['SBU_Name'])
                # resp['SBU_Name'] = pd.Categorical(resp['SBU_Name'], categories=sbu_order, ordered=True)
                # resp = resp.sort_values('SBU_Name')

                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["fiscal_year", "month_name", "SBU_Name", "Zone_Name", "Region_Name"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["fiscal_year", "month_name", "SBU_Name", "Zone_Name", "Region_Name"], as_index=False).agg(agg_dict)

                resultCols=[]
                if "H" in selected_keys and "YTD" in selected_keys:
                        resultCols.append("ACTUAL_HISTORY_TMT")
                        
                if "T" in selected_keys and "YTD" in selected_keys:
                    resultCols.append("TARGET_QTY_TMT")
                        
                if len(resultCols)>0:
                    current_date = helpers.get_time_stamp_by_delta(days=0,with_month_start_day=False,date_time_format=None)
                    grouped_resp = await GlobalAnalytics.calculate_ytd(current_date,grouped_resp,resultCols,current_month=False)
                    
            elif "fiscal_year" in filter_keys and "month_name" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys \
                                    and "Region_Name" in filter_keys and "SalesArea_Name" not in filter_keys:
                # Define the set of valid keys without the quotes
                valid_keys = {'A', 'H', 'T', 'BE', 'RI','YTD','DATE'}
                # Extract user-selected keys with `value == 'true'`
                selected_keys = set()
                for rec in filters:
                    print(f"rec.key: {rec.key}, rec.value: {rec.value}")  # Debugging: Print key and value
                    if rec.key.strip('"') in valid_keys and 'true' in rec.value:
                        selected_keys.add(rec.key.strip('"'))  # Add the stripped key if valid and value is 'true'
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}

                # Group the response by the selected keys and apply the aggregation functions
                if 'T' in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                print("selected keys ", selected_keys)
                
                # Check if 'H' is in selected keys and update fiscal year values
                if 'H' in selected_keys:
                    current_date = datetime.now()
                    current_year = current_date.year
                    current_month = current_date.month
                    
                    if current_month >= 4:  # April or later
                        current_fiscal_year = f"FY {current_year}-{current_year + 1}"
                        previous_fiscal_year = f"FY {current_year - 1}-{current_year}"
                    else:  # January to March
                        current_fiscal_year = f"FY {current_year - 1}-{current_year}"
                        previous_fiscal_year = f"FY {current_year - 2}-{current_year - 1}"

                    for rec in filters:
                        if rec.key == "fiscal_year":
                            # Ensure rec.value is a list of fiscal years
                            fiscal_year_values = rec.value if isinstance(rec.value, list) else [rec.value]
                            
                            # Check and add the previous fiscal year
                            if current_fiscal_year in fiscal_year_values:
                                if previous_fiscal_year not in fiscal_year_values:
                                    fiscal_year_values.append(previous_fiscal_year)
                            
                            # Assign the updated list back to rec.value
                            rec.value = fiscal_year_values
                
                    resp = resp[resp["fiscal_year"].isin([current_fiscal_year, previous_fiscal_year])]
                    year_required = str(current_year-2)+'-'+str(current_year-1)
                    sales_his_query = f"""
                                        SELECT "fiscal_year","month_name","ORGSBUNAME","ORGZONENAME","ORGRONAME","ORGSANAME","NETWEIGHT_TMT" 
                                        FROM "MOM_LEVEL_FINAL_DATA" 
                                        WHERE "FISCALYEAR" = 'FY {year_required}'
                    """
                    if "month_name" in filter_keys:
                        sales_his_query += f""" and "month_name" = '{filter_values[1][:3]}'"""
                    # his_data = await function(query=sales_his_query)
                    his_data = await urdhva_base.BasePostgresModel.get_aggr_data(query=sales_his_query, limit=0)
                    his_data = his_data.get("data", [])
                    his_data = pd.DataFrame(his_data)
                    his_data['ORGSBUNAME'] = his_data['ORGSBUNAME'].str.strip("DS").str.strip()
                    his_data = his_data.groupby(['fiscal_year','month_name','ORGSBUNAME','ORGZONENAME','ORGRONAME','ORGSANAME'],as_index = False)['NETWEIGHT_TMT'].sum().round(0)
                    his_data['ORGSBUNAME'] = his_data['ORGSBUNAME'].fillna('').astype(str)
                    his_data['ORGZONENAME'] = his_data['ORGZONENAME'].fillna('').astype(str)
                    his_data['ORGRONAME'] = his_data['ORGRONAME'].fillna('').astype(str)
                    his_data['ORGSANAME'] = his_data['ORGSANAME'].fillna('').astype(str)
                    his_data = his_data.rename(columns = {'NETWEIGHT_TMT':'ACTUAL_HISTORY_TMT'})
                    resp['month_name'] = resp['month_name'].apply(lambda x:x[:3] if len(x)>=3 else x)
                    resp = resp.merge(his_data[['month_name','ACTUAL_HISTORY_TMT','fiscal_year','ORGSBUNAME','ORGZONENAME','ORGRONAME','ORGSANAME']],
                                      how='left',left_on=['month_name','SBU_Name','Zone_Name','Region_Name','SalesArea_Name'],
                                      right_on = ['month_name','ORGSBUNAME','ORGZONENAME','ORGRONAME','ORGSANAME'])
                    resp['fiscal_year'] = resp['fiscal_year'].bfill()
                    if "ACTUAL_HISTORY_TMT" in resp.columns.tolist():
                        resp['ACTUAL_HISTORY_TMT'] = resp['ACTUAL_HISTORY_TMT'].fillna(0).astype(int)
                    agg_dict["ACTUAL_HISTORY_TMT"] = lambda x: ', '.join(map(str, x.unique()))
                
                # resp['SBU_Name'] = resp['SBU_Name'].map(sbu_mapping).fillna(resp['SBU_Name'])
                # resp['SBU_Name'] = pd.Categorical(resp['SBU_Name'], categories=sbu_order, ordered=True)
                # resp = resp.sort_values('SBU_Name')

                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["fiscal_year", "month_name", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["fiscal_year", "month_name", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name"], as_index=False).agg(agg_dict)

                resultCols = []
                if "H" in selected_keys and "YTD" in selected_keys:
                        resultCols.append("ACTUAL_HISTORY_TMT")
                        
                if "T" in selected_keys and "YTD" in selected_keys:
                    resultCols.append("TARGET_QTY_TMT")
                        
                if len(resultCols)>0:
                    current_date = helpers.get_time_stamp_by_delta(days=0,with_month_start_day=False,date_time_format=None)
                    grouped_resp = await GlobalAnalytics.calculate_ytd(current_date,grouped_resp,resultCols,current_month=False)
                    
            elif "fiscal_year" in filter_keys and \
            "month_name" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys and \
                                    "Region_Name" in filter_keys and "SalesArea_Name" in filter_keys and "ProductName" not in filter_keys:
                # Define the set of valid keys without the quotes
                valid_keys = {'A', 'H', 'T', 'BE', 'RI','YTD'}

                # Extract user-selected keys with `value == 'true'`
                selected_keys = set()

                for rec in filters:
                    print(f"rec.key: {rec.key}, rec.value: {rec.value}")  # Debugging: Print key and value
                    if rec.key.strip('"') in valid_keys and 'true' in rec.value:
                        selected_keys.add(rec.key.strip('"'))  # Add the stripped key if valid and value is 'true'
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}

                # Group the response by the selected keys and apply the aggregation functions
                if 'T' in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                print("selected keys ", selected_keys)
                
                # Check if 'H' is in selected keys and update fiscal year values
                if 'H' in selected_keys:
                    current_date = datetime.now()
                    current_year = current_date.year
                    current_month = current_date.month
                    
                    if current_month >= 4:  # April or later
                        current_fiscal_year = f"FY {current_year}-{current_year + 1}"
                        previous_fiscal_year = f"FY {current_year - 1}-{current_year}"
                    else:  # January to March
                        current_fiscal_year = f"FY {current_year - 1}-{current_year}"
                        previous_fiscal_year = f"FY {current_year - 2}-{current_year - 1}"

                    for rec in filters:
                        if rec.key == "fiscal_year":
                            # Ensure rec.value is a list of fiscal years
                            fiscal_year_values = rec.value if isinstance(rec.value, list) else [rec.value]
                            
                            # Check and add the previous fiscal year
                            if current_fiscal_year in fiscal_year_values:
                                if previous_fiscal_year not in fiscal_year_values:
                                    fiscal_year_values.append(previous_fiscal_year)
                            
                            # Assign the updated list back to rec.value
                            rec.value = fiscal_year_values
                
                    resp = resp[resp["fiscal_year"].isin([current_fiscal_year, previous_fiscal_year])]
                    year_required = str(current_year-2)+'-'+str(current_year-1)
                    sales_his_query = f"""
                                        SELECT "fiscal_year","month_name","ORGSBUNAME","ORGZONENAME","ORGRONAME","ORGSANAME","NETWEIGHT_TMT" 
                                        FROM "MOM_LEVEL_FINAL_DATA" 
                                        WHERE "FISCALYEAR" = 'FY {year_required}'
                    """
                    if "month_name" in filter_keys:
                        sales_his_query += f""" and "month_name" = '{filter_values[1][:3]}'"""
                    # his_data = await function(query=sales_his_query)
                    his_data = await urdhva_base.BasePostgresModel.get_aggr_data(query=sales_his_query, limit=0)
                    his_data = his_data.get("data", [])
                    his_data = pd.DataFrame(his_data)
                    his_data['ORGSBUNAME'] = his_data['ORGSBUNAME'].str.strip("DS").str.strip()
                    his_data = his_data.groupby(['fiscal_year','month_name','ORGSBUNAME','ORGZONENAME','ORGRONAME','ORGSANAME'],as_index = False)['NETWEIGHT_TMT'].sum().round(0)
                    his_data['ORGSBUNAME'] = his_data['ORGSBUNAME'].fillna('').astype(str)
                    his_data['ORGZONENAME'] = his_data['ORGZONENAME'].fillna('').astype(str)
                    his_data['ORGRONAME'] = his_data['ORGRONAME'].fillna('').astype(str)
                    his_data['ORGSANAME'] = his_data['ORGSANAME'].fillna('').astype(str)
                    his_data = his_data.rename(columns = {'NETWEIGHT_TMT':'ACTUAL_HISTORY_TMT'})
                    resp['month_name'] = resp['month_name'].apply(lambda x:x[:3] if len(x)>=3 else x)
                    resp = resp.merge(his_data[['month_name','ACTUAL_HISTORY_TMT','fiscal_year','ORGSBUNAME','ORGZONENAME','ORGRONAME','ORGSANAME']],
                                      how='left',left_on=['month_name','SBU_Name','Zone_Name','Region_Name','SalesArea_Name'],
                                      right_on = ['month_name','ORGSBUNAME','ORGZONENAME','ORGRONAME','ORGSANAME'])
                    resp['fiscal_year'] = resp['fiscal_year'].bfill()
                    if "ACTUAL_HISTORY_TMT" in resp.columns.tolist():
                        resp['ACTUAL_HISTORY_TMT'] = resp['ACTUAL_HISTORY_TMT'].fillna(0).astype(int)
                    agg_dict["ACTUAL_HISTORY_TMT"] = lambda x: ', '.join(map(str, x.unique()))
                

                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["fiscal_year", "month_name", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["fiscal_year", "month_name", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"], as_index=False).agg(agg_dict)
                resultCols = []
                
                if "H" in selected_keys and "YTD" in selected_keys:
                        resultCols.append("ACTUAL_HISTORY_TMT")
                        
                if "T" in selected_keys and "YTD" in selected_keys:
                    resultCols.append("TARGET_QTY_TMT")
                        
                if len(resultCols)>0:
                    current_date = helpers.get_time_stamp_by_delta(days=0,with_month_start_day=False,date_time_format=None)
                    grouped_resp = await GlobalAnalytics.calculate_ytd(current_date,grouped_resp,resultCols,current_month=False)
            if "NETWEIGHT_TMT" in  grouped_resp.columns:   
                grouped_resp["NETWEIGHT_TMT"] = grouped_resp["NETWEIGHT_TMT"].round(0)
            if "TARGET_QTY_TMT" in grouped_resp.columns:
                grouped_resp["TARGET_QTY_TMT"] = grouped_resp["TARGET_QTY_TMT"].round(0)
            # Return grouped response
            if grouped_resp is not None:
                return {"status": True, "message": "success", "data": grouped_resp.to_dict(orient='records')}

        # If no filters are applied, return the default response
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}

    
    @staticmethod
    async def sales_growth(filters, cross_filters, drill_state):
        """
        Fetches the sales performance data for the given filters and drill state.

        Parameters:
            filters (list): List of filter objects to apply to the query.
            drill_state (dict): Current drill state for processing the query.

        Returns:
            dict: Contains the status, a success message, and the sales performance data.
        """
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

        # Reverse mapping (for returning the short form)
        reverse_month_mapping = {v: k for k, v in month_mapping.items()}

        if filters:
            filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.MomLevelFinalMetaData.get_clause_conditions(formated=True)]
            sales_growth_query = lpg_plant_queries.lpg_plant_query.get("sales_growth")
            sales_growth_query_ = sales_growth_query
            print("sales_growth_query_",sales_growth_query_)
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                #commenting this as the lastest table is having month_name as Jan,Feb etc
                #if rec.key == '"month_name"':  # Only handle the month_name case separately
                    # Check if any value in rec.value is in month_mapping
                #    rec.value = [month_mapping.get(val.strip(), val.strip()) for val in rec.value]

                # result = [value.strip() for value in rec.value.split(",")]

                if isinstance(rec.value, str):
                    print("in if ")
                    condition = f" and {rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        print("if in else")
                        if rec.key =='"SBU_Name"':
                            rec.key = '"ORGSBUNAME"'
                        elif rec.key == '"Zone_Name"':
                            rec.key = '"ORGZONENAME"'
                        elif rec.key == '"SalesArea_Name"':
                            rec.key = '"ORGSANAME"'
                        elif rec.key == '"Region_Name"':
                            rec.key = '"ORGRONAME"'

                        condition = f" and {rec.key} = '{rec.value[0]}'"
                    else:
                        print("else in else")
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)

            if conditions:
                #sales_growth_query_ += ' WHERE '
                sales_growth_query_ += ''.join(conditions)
        else:
            # Fallback query if no filters are provided
            sales_growth_query_ = """  
                SELECT
                    ROUND(SUM("MOM_LEVEL_FINAL_DATA"."NETWEIGHT_TMT")) AS "total_sales",
                    "MOM_LEVEL_FINAL_DATA"."fiscal_year" AS "fiscal_year",
                    "MOM_LEVEL_FINAL_DATA"."month_name"
                FROM
                    "hpcl_ceg"."public"."MOM_LEVEL_FINAL_DATA"
                WHERE
                    "MOM_LEVEL_FINAL_DATA"."fiscal_year" in ('2023-2024','2024-2025')
                GROUP BY
                  "MOM_LEVEL_FINAL_DATA"."fiscal_year","MOM_LEVEL_FINAL_DATA"."month_name"
                ORDER BY
                    "MOM_LEVEL_FINAL_DATA"."fiscal_year" ASC

            """
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.MomLevelFinalMetaData.get_clause_conditions(formated=True)]
            sales_growth_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(sales_growth_query_, access_filters, drill_state)
            print("sales_growth_query_: ", sales_growth_query_)
            # resp = await function(query=sales_growth_query_)
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=sales_growth_query_, limit=0)
            resp = resp.get("data", [])
            print("resp: ", resp)
            month_map = {'Apr': '0', 'May': '1', 'Jun': '2', 'Jul': '3', 'Aug': '4', 'Sep': '5', 'Oct': '6', 'Nov': '7',
                         'Dec': '8', 'Jan': '9', 'Feb': '10', 'Mar': '11'}
            d = {"2023-2024": {"0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0,
                               "11": 0},
                 "2024-2025": {"0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0,
                               "11": 0},
                 "fy_month": {"0": "1", "1": "2", "2": "3", "3": "4", "4": "5", "5": "6", "6": "7", "7": "8", "8": "9",
                              "9": "10", "10": "11", "11": "12"},
                 "month_name": {"0": "Apr", "1": "May", "2": "Jun", "3": "Jul", "4": "Aug", "5": "Sep", "6": "Oct",
                                "7": "Nov", "8": "Dec", "9": "Jan", "10": "Feb", "11": "Mar"}}

            for rec in resp:
                if rec['fiscal_year'] == "2024-2025":
                    d['2024-2025'][month_map[rec['month_name']]] = rec['total_sales']
                else:
                    d['2023-2024'][month_map[rec['month_name']]] = rec['total_sales']
            return {"status": True, "message": "success", "data": d}
        
        # resp = await function(query=sales_growth_query_)
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=sales_growth_query_, limit=0)
        resp = resp.get("data", [])
        resp = pd.DataFrame(resp)
        resp =resp.rename(columns = {'ORGSBUCD':'SBU','ORGSBUNAME':'SBU_Name','ORGZONECD':'ZONE','ORGZONENAME':'Zone_Name','ORGRONAME':'Region_Name',
            'NETWEIGHT_TMT':'total_sales', 'ORGSANAME':'SalesArea_Name',"ORGSACD":"SA","ORGROCD":"REGION"})

        # Fill missing values for numeric columns
        for each_float_col in ["sum_total_sales", "total_sales"]:
            if each_float_col in resp.columns.tolist():
                resp[each_float_col] = resp[each_float_col].fillna(0.0)

        # Fill missing values for string columns
        for each_str_col in [
             "month_name", "SBU", "ZONE", "REGION", "SA",

            "Zone_Name", "Region_Name", "SalesArea_Name", "fiscal_year",
            "month_name"
        ]:
            resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
        
        if filters:
            filter_keys = [rec.key.strip('"') for rec in filters]
            filter_keys = [x.replace('ORGSBUNAME', 'SBU_Name') if 'ORGSBUNAME' in x else x.replace('ORGZONENAME', 'Zone_Name') if 'ORGZONENAME' in x else x.replace('ORGSANAME','SalesArea_Name') if 'ORGSANAME'in x else x.replace('ORGRONAME','Region_Name') if 'ORGRONAME' in x else x for x in filter_keys]
            resp["month_name"] = resp["month_name"].apply(
                lambda x: reverse_month_mapping.get(x, x)
            )
            grouped_keys = ["fiscal_year", "month_name"]
            # this is for getting all the months data for the specific SBU and fiscal year
            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'SBU_Name' in filter_keys:
                grouped_keys.extend(["SBU_Name"])
            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'Zone_Name' in filter_keys:
                grouped_keys.extend(["Zone_Name"])
            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'Region_Name' in filter_keys:
                grouped_keys.extend(["Region_Name"])
            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'SalesArea_Name' in filter_keys:
                grouped_keys.extend(["SalesArea_Name"])
            
            if "month_name" in filter_keys and "SBU_Name" not in filter_keys:
                grouped_keys.append("SBU_Name")
            elif "month_name" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" not in filter_keys:
                if "DS Lubes" in filters[-1].value[0] or 'DS' in filters[-1].value[0] or 'Lubes' in filters[-1].value[0]:
                    grouped_keys.extend(["SBU_Name", "Region_Name"])
                else:
                    grouped_keys.extend(["SBU_Name", "Zone_Name"])
            elif ("month_name" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys and
                  "Region_Name" not in filter_keys):
                grouped_keys.extend(["SBU_Name", "Zone_Name", "Region_Name"])
            elif ("month_name" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys
                  and "Region_Name" in filter_keys and "SalesArea_Name" not in filter_keys):
                grouped_keys.extend(["SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name"])
            elif ("month_name" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys and
                  "Region_Name" in filter_keys and "SalesArea_Name" in filter_keys):
                grouped_keys.extend(["SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name","MATERIALGROUPNAME"])
            grouped_resp = resp.groupby(grouped_keys, as_index=False).agg({
                "total_sales": lambda x: round(sum(x),2),
            })
            print("grouped_keys->>",grouped_keys)
            if grouped_resp is not None:
                if "sbu_name" in resp.columns.tolist():
                    sub_name = list(set(rec['SBU_Name'] for rec in grouped_resp.to_dict(orient='records')))
                transformed_data = []
                data = grouped_resp.to_dict(orient='records')
                print("data-->>",data)
                '''
                for sbu_name in sub_name:
                    entry = {
                        "month_name": "Jan",
                        "SBU_Name": sbu_name,
                        "2024-2025": next((item['total_sales'] for item in data if
                                           item['SBU_Name'] == sbu_name and item['fiscal_year'] == '2024-2025'), 0),
                        "2023-2024": next((item['total_sales'] for item in data if
                                           item['SBU_Name'] == sbu_name and item['fiscal_year'] == '2023-2024'), 0)
                    }
                    for key in ["Zone_Name", "Region_Name", "SalesArea_Name"]:
                        if key in grouped_keys:
                            if key in data[0]:
                            entry[key] = next((item[key] for item in data if item['SBU_Name'] == sbu_name), None)
                    
                    transformed_data.append(entry)
                return {"status": True, "message": "success", "data": transformed_data}
                '''
                # added the below lines from 685 to 696 for dorrect drill data from backend 
                '''
                for record in data:
                    entry = {
                        "month_name": record["month_name"],
                        "SBU_Name": record["SBU_Name"],
                        "2024-2025": record["total_sales"] if record["fiscal_year"] == "2024-2025" else 0,
                        "2023-2024": record["total_sales"] if record["fiscal_year"] == "2023-2024" else 0,
                        "fiscal_year": record["fiscal_year"]
                    }
                    for key in grouped_keys:
                        if key in record:
                            entry[key] = record[key]
                    transformed_data.append(entry)
                '''
                if "sbu_name" in resp.columns.tolist():
                    grouped_data = defaultdict(lambda: {'2023-2024': 0, '2024-2025': 0, 'month_name': '', 'SBU_Name': ''})
                else:
                    grouped_data = defaultdict(lambda: {'2023-2024': 0, '2024-2025': 0, 'month_name': ''})
                #grouped_keys =  ['fiscal_year', 'month_name', 'SBU_Name']
                key_fields = [key for key in grouped_keys if key != 'fiscal_year']  # Exclude 'fiscal_year'

                for record in data:
                    key = tuple(record[field] for field in key_fields)    
                    #key = (record['month_name'], record['SBU_Name'],record['Zone_Name'])
                    for field in key_fields:
                        grouped_data[key][field] = record.get(field, '')
                    grouped_data[key][record['fiscal_year']] = record['total_sales']
                result = list(grouped_data.values())
                return {"status": True, "message": "success", "data": result}

        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}

    @staticmethod
    async def sales_yearly_performance(filters, cross_filters, drill_state):
        """
        Fetches the sales performance data for the given filters and drill state.

        Parameters:
            filters (list): List of filter objects to apply to the query.
            drill_state (dict): Current drill state for processing the query.

        Returns:
            dict: Contains the status, a success message, and the sales performance data.
        """
        # Get the filter keys from the filters list
        filter_keys = [rec.key.strip('"') for rec in filters]

        sales_yearly_preformance_query = lpg_plant_queries.lpg_plant_query.get("sales_performance")
        sales_yearly_preformance_query_ = sales_yearly_preformance_query
        
        if filters:
            sales_performance_query = lpg_plant_queries.lpg_plant_query.get("sales_performance")
            sales_performance_query_ = sales_performance_query
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                # result = [value.strip() for value in rec.value.split(",")]

                if isinstance(rec.value, str):
                    condition = f"{rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f"{rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)

            if conditions:
                sales_performance_query_ += ' WHERE '
                sales_performance_query_ += ' AND '.join(conditions)
        
        else:
            sales_performance_query_ = f'''
                SELECT
                    ROUND(SUM("M60_LEVEL_METADATA"."NETWEIGHT_TMT")::NUMERIC, 2) AS "ACTUAL_TMT_SALES",
                    ROUND(SUM("M60_LEVEL_METADATA"."TARGET_QTY_TMT")::NUMERIC, 2) AS "TARGET_TMT_SALES",
                    "M60_LEVEL_METADATA"."FISCAL_YEAR" AS "FISCAL_YEAR"
                FROM
                    "hpcl_ceg"."public"."M60_LEVEL_METADATA"
                GROUP BY
                    "M60_LEVEL_METADATA"."FISCAL_YEAR"
                ORDER BY
                    "M60_LEVEL_METADATA"."FISCAL_YEAR" ASC

            '''

            # resp = await function(query=sales_performance_query_)
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=sales_performance_query_, limit=0)
            resp = resp.get("data", [])
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)

            # Fill missing values for numerical columns
            for each_float_col in [
                "ACTUAL_TMT_SALES", "TARGET_TMT_SALES"
            ]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)

            # Fill missing values for string columns
            for each_str_col in [
                "FISCAL_YEAR"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)

            return {"status": True, "message": "success", "data": resp}
        
        # Execute the query
        # resp = await function(query=sales_performance_query_)
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=sales_performance_query_, limit=0)
        resp = resp.get("data", [])
        # Convert the response to a DataFrame for further processing
        resp = pd.DataFrame(resp)

        # Fill missing values for numerical columns
        for each_float_col in [
            "TARGET_QTY_TMT", "Prediction_Value", "Product_Achievement", 
            "Zone_Region_Achievement", "Rate_Per_Day_Required_MMT", 
            "Rate_per_day_current_MMT", "FinalSum", "FinalActualSum", "NETWEIGHT_TMT"
        ]:
            if each_float_col in resp.columns:
                resp[each_float_col] = resp[each_float_col].fillna(0.0)

        # Fill missing values for string columns
        for each_str_col in [
            "SBU", "SBU_Name", "ZONE", "Zone_Name", "REGION", "Region_Name", "SA", 
            "SalesArea_Name", "PRODUCT", "ProductName", "UOM", "FISCAL_YEAR", 
            "month_year", "month_name"
        ]:
            if each_str_col in resp.columns:
                resp[each_str_col] = resp[each_str_col].fillna('').astype(str)

        # Apply grouping logic based on filters
        if filters:
            grouped_resp = None
            filter_keys = [rec.key.strip('"') for rec in filters]

            if "FISCAL_YEAR" in filter_keys and "SBU_Name" not in filter_keys:
                grouped_resp = resp.groupby(["FISCAL_YEAR", "SBU_Name"], as_index=False).agg({
                    "NETWEIGHT_TMT": "sum",
                    "TARGET_QTY_TMT": "sum"
                })

            elif "FISCAL_YEAR" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" not in filter_keys:
                grouped_resp = resp.groupby(["FISCAL_YEAR","SBU_Name","Zone_Name"], as_index=False).agg({
                    "NETWEIGHT_TMT": "sum",
                    "TARGET_QTY_TMT": "sum"
                })

            elif "FISCAL_YEAR" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys and "Region_Name" not in filter_keys:
                grouped_resp = resp.groupby(["FISCAL_YEAR","SBU_Name","Zone_Name","Region_Name"], as_index=False).agg({
                    "NETWEIGHT_TMT": "sum",
                    "TARGET_QTY_TMT": "sum"
                })

            elif "FISCAL_YEAR" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys \
                    and "Region_Name" in filter_keys and "SalesArea_Name" not in filter_keys:
                grouped_resp = resp.groupby(["FISCAL_YEAR","SBU_Name","Zone_Name","Region_Name","SalesArea_Name"], as_index=False).agg({
                    "NETWEIGHT_TMT": "sum",
                    "TARGET_QTY_TMT": "sum",
                })

            elif "FISCAL_YEAR" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys and \
                    "Region_Name" in filter_keys and "SalesArea_Name" in filter_keys and "ProductName" not in filter_keys:
                grouped_resp = resp.groupby(["FISCAL_YEAR","SBU_Name","Zone_Name","Region_Name","SalesArea_Name","ProductName"], as_index=False).agg({
                    "NETWEIGHT_TMT": "sum",
                    "TARGET_QTY_TMT": "sum",
                })


            # Return grouped response
            if grouped_resp is not None:
                return {"status": True, "message": "success", "data": grouped_resp.to_dict(orient='records')}


        # If no filters are applied, return the default response
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}

    @staticmethod
    async def yearly_sales_performance(filters, cross_filters, drill_state):
        """
        Fetches the sales performance data for the given filters and drill state.

        Parameters:
            filters (list): List of filter objects to apply to the query.
            drill_state (dict): Current drill state for processing the query.

        Returns:
            dict: Contains the status, a success message, and the sales performance data.
        """
        # Get the filter keys from the filters list
        filter_keys = [rec.key.strip('"') for rec in filters]

        sales_yearly_preformance_query = lpg_plant_queries.lpg_plant_query.get("sales_performance")
        sales_yearly_preformance_query_ = sales_yearly_preformance_query
        
        if filters and any(rec.key not in ['"H"', '"T"', '"BE"', '"RI"', '"A"'] for rec in filters):
            sales_performance_query = lpg_plant_queries.lpg_plant_query.get("sales_performance")
            sales_performance_query_ = sales_performance_query
            conditions = []
            
            # Define keys to exclude from the WHERE clause
            excluded_keys = {"A", "H", "T", "BE", "RI"}
            
            for rec in filters:
                rec.value = rec.value.split(",")
                if rec.key == '"month_name"':  # Only handle the month_name case separately
                    # Check if any value in rec.value is in month_mapping
                    rec.value = [month_mapping.get(val.strip(), val.strip()) for val in rec.value]
                
                # Skip keys that should not be added to the WHERE clause
                if rec.key in excluded_keys:
                    continue
                
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
                sales_performance_query_ += ' WHERE '
                sales_performance_query_ += ' AND '.join(conditions) 

        elif len(filters) >= 1 and (filters[0].key in ['"H"', '"T"', '"BE"', '"RI"', '"A"']):
            print("into elif")
            selected_keys = [rec.key.strip('"') for rec in filters]
            current_date = datetime.now()
            current_year = current_date.year
            next_year = current_year + 1
            current_month = current_date.month
            # Determine the current financial year
            if current_month >= 4:  # April or later
                fiscal_year_start = f"'FY {current_year}-{next_year}'"
            else:  # January to March
                previous_year = current_year - 1
                fiscal_year_start = f"'FY {previous_year}-{current_year}'"

            # Initialize the dynamic parts of the query
            where_conditions = []
            select_columns = [
                'ROUND(SUM("M60_LEVEL_METADATA"."NETWEIGHT_TMT")::NUMERIC, 2) AS "ACTUAL_TMT_SALES"',
                '"M60_LEVEL_METADATA"."FISCAL_YEAR" AS "FISCAL_YEAR"',
            ]
            group_by_columns = [
                '"M60_LEVEL_METADATA"."FISCAL_YEAR"',
            ]

            # Build conditions based on selected keys
            if "H" in selected_keys:
                previous_year = current_year - 1
                where_conditions.append(f'"M60_LEVEL_METADATA"."FISCAL_YEAR" IN (\'FY {previous_year}-{current_year}\', \'FY {current_year}-{next_year}\')')

            if "T" in selected_keys:
                select_columns.append('ROUND(SUM("M60_LEVEL_METADATA"."TARGET_QTY_TMT")::NUMERIC, 2) AS "TARGET_TMT_SALES"')

            where_clause = f"WHERE {' AND '.join(where_conditions)}" if where_conditions else ""
            # Construct the query dynamically
            sales_performance_query_ = f'''
                SELECT
                    {', '.join(select_columns)}
                FROM
                    "M60_LEVEL_METADATA"
                {where_clause}
                GROUP BY
                    {', '.join(group_by_columns)}
                ORDER BY
                    "M60_LEVEL_METADATA"."FISCAL_YEAR" ASC
            '''
            
            print("Generated Query:", sales_performance_query_)  # Debugging: Print the generated query

            # resp = await function(query=sales_performance_query_)
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(sales_performance_query_, limit=0)
            resp = resp.get("data", [])
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)

            # Fill missing values for numerical columns
            for each_float_col in ["ACTUAL_TMT_SALES", "TARGET_QTY_TMT"]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)

            # Fill missing values for string columns
            for each_str_col in ["fy_month", "month_name"]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
            
            return {"status": True, "message": "success", "data": resp}
            
        else:
            sales_performance_query_ = f'''
                SELECT
                    ROUND(SUM("M60_LEVEL_METADATA"."NETWEIGHT_TMT")::NUMERIC, 2) AS "ACTUAL_TMT_SALES",
                    "M60_LEVEL_METADATA"."FISCAL_YEAR" AS "FISCAL_YEAR"
                FROM
                    "hpcl_ceg"."public"."M60_LEVEL_METADATA"
                GROUP BY
                    "M60_LEVEL_METADATA"."FISCAL_YEAR"
                ORDER BY
                    "M60_LEVEL_METADATA"."FISCAL_YEAR" ASC
            '''

            # resp = await function(query=sales_performance_query_)
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(sales_performance_query_, limit=0)
            resp = resp.get("data", [])
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)

            # Fill missing values for numerical columns
            for each_float_col in [
                "ACTUAL_TMT_SALES"
            ]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)

            # Fill missing values for string columns
            for each_str_col in [
                "FISCAL_YEAR"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)

            return {"status": True, "message": "success", "data": resp}
        
        # Execute the query
        # resp = await function(query=sales_performance_query_)
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(sales_performance_query_, limit=0)
        resp = resp.get("data", [])
        # Convert the response to a DataFrame for further processing
        resp = pd.DataFrame(resp)

        # Fill missing values for numerical columns
        for each_float_col in [
            "TARGET_QTY_TMT", "Prediction_Value", "Product_Achievement", 
            "Zone_Region_Achievement", "Rate_Per_Day_Required_MMT", 
            "Rate_per_day_current_MMT", "FinalSum", "FinalActualSum", "NETWEIGHT_TMT"
        ]:
            if each_float_col in resp.columns:
                resp[each_float_col] = resp[each_float_col].fillna(0.0)

        # Fill missing values for string columns
        for each_str_col in [
            "SBU", "SBU_Name", "ZONE", "Zone_Name", "REGION", "Region_Name", "SA", 
            "SalesArea_Name", "PRODUCT", "ProductName", "UOM", "FISCAL_YEAR", 
            "month_year", "month_name"
        ]:
            if each_str_col in resp.columns:
                resp[each_str_col] = resp[each_str_col].fillna('').astype(str)

        # Apply grouping logic based on filters
        if filters:
            grouped_resp = None
            filter_keys = [rec.key.strip('"') for rec in filters]

            if "FISCAL_YEAR" in filter_keys and "SBU_Name" not in filter_keys:
                # Define the set of valid keys
                valid_keys = {"A", "H", "T", "BE", "RI"}
                
                # Extract user-selected keys with `value == 'true'`
                selected_keys = {rec.key for rec in filters if rec.key in valid_keys and rec.value == 'true'}
                
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}
                
                if "T" in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                
                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["FISCAL_YEAR", "SBU_Name"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["FISCAL_YEAR", "SBU_Name"], as_index=False).agg(agg_dict)

            elif "FISCAL_YEAR" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" not in filter_keys:
                # Define the set of valid keys
                valid_keys = {"A", "H", "T", "BE", "RI"}
                
                # Extract user-selected keys with `value == 'true'`
                selected_keys = {rec.key for rec in filters if rec.key in valid_keys and rec.value == 'true'}
                
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}
                
                if "T" in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                
                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["FISCAL_YEAR", "SBU_Name", "Zone_Name"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["FISCAL_YEAR", "SBU_Name", "Zone_Name"], as_index=False).agg(agg_dict)

            elif "FISCAL_YEAR" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys and "Region_Name" not in filter_keys:
                # Define the set of valid keys
                valid_keys = {"A", "H", "T", "BE", "RI"}
                
                # Extract user-selected keys with `value == 'true'`
                selected_keys = {rec.key for rec in filters if rec.key in valid_keys and rec.value == 'true'}
                
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}
                
                if "T" in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                
                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["FISCAL_YEAR", "SBU_Name", "Zone_Name", "Region_Name"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["FISCAL_YEAR", "SBU_Name", "Zone_Name", "Region_Name"], as_index=False).agg(agg_dict)

            elif "FISCAL_YEAR" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys \
                    and "Region_Name" in filter_keys and "SalesArea_Name" not in filter_keys:
                # Define the set of valid keys
                valid_keys = {"A", "H", "T", "BE", "RI"}
                
                # Extract user-selected keys with `value == 'true'`
                selected_keys = {rec.key for rec in filters if rec.key in valid_keys and rec.value == 'true'}
                
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}
                
                if "T" in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                
                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["FISCAL_YEAR", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["FISCAL_YEAR", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name"], as_index=False).agg(agg_dict)

            elif "FISCAL_YEAR" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys and \
                    "Region_Name" in filter_keys and "SalesArea_Name" in filter_keys and "ProductName" not in filter_keys:
                # Define the set of valid keys
                valid_keys = {"A", "H", "T", "BE", "RI"}
                
                # Extract user-selected keys with `value == 'true'`
                selected_keys = {rec.key for rec in filters if rec.key in valid_keys and rec.value == 'true'}
                
                # Define the aggregation dictionary dynamically
                agg_dict = {"NETWEIGHT_TMT": "sum"}
                
                if "T" in selected_keys:
                    agg_dict["TARGET_QTY_TMT"] = "sum"
                
                # If any valid keys are selected, group the data
                if selected_keys:
                    grouped_resp = resp.groupby(["FISCAL_YEAR", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"], as_index=False).agg(agg_dict)
                else:
                    grouped_resp = resp.groupby(["FISCAL_YEAR", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"], as_index=False).agg(agg_dict)

            # Return grouped response
            if grouped_resp is not None:
                return {"status": True, "message": "success", "data": grouped_resp.to_dict(orient='records')}


        # If no filters are applied, return the default response
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
    
    @staticmethod
    async def sales_yearly_growth(filters, cross_filters, drill_state):
        """
        Fetches the sales performance data for the given filters and drill state.

        Parameters:
            filters (list): List of filter objects to apply to the query.
            drill_state (dict): Current drill state for processing the query.

        Returns:
            dict: Contains the status, a success message, and the sales performance data.
        """
        # Get the filter keys from the filters list
        filter_keys = [rec.key.strip('"') for rec in filters]

        sales_yearly_growth_query = lpg_plant_queries.lpg_plant_query.get("sales_growth")
        sales_yearly_growth_query_ = sales_yearly_growth_query
        
        if filters:
            sales_yearly_growth_query = lpg_plant_queries.lpg_plant_query.get("sales_growth")
            sales_yearly_growth_query_ = sales_yearly_growth_query
            conditions = []
            for rec in filters:
                rec.value = rec.value.split(",")
                # result = [value.strip() for value in rec.value.split(",")]

                if isinstance(rec.value, str):
                    condition = f" and {rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        condition = f" and {rec.key} = '{rec.value[0]}'"
                    else:
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)

            if conditions:
                #sales_performance_query_ += ' WHERE '
                sales_yearly_growth_query_ += ' AND '.join(conditions)
        
        else:
            sales_yearly_growth_query_ = f'''
                SELECT
                    ROUND(SUM("MOM_LEVEL_SALES_TEST1"."total_sales")::NUMERIC, 2) AS "ACTUAL_TMT_SALES",
                    
                    "MOM_LEVEL_SALES_TEST1"."fiscal_year" AS "fiscal_year"
                FROM
                    "hpcl_ceg"."public"."MOM_LEVEL_SALES_TEST1"
                WHERE 
                    "fiscal_year" in ('2023-2024','2024-2025')
                GROUP BY
                    "MOM_LEVEL_SALES_TEST1"."fiscal_year"
                ORDER BY
                    "MOM_LEVEL_SALES_TEST1"."fiscal_year" ASC

            '''
            
            # resp = await function(query=sales_yearly_growth_query_)
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=sales_yearly_growth_query_, limit=0)
            resp = resp.get("data", [])
            return {"status": True, "message": "success", "data": resp}
            # Convert the response to a DataFrame for further processing
            resp = pd.DataFrame(resp)

            # Fill missing values for numerical columns
            for each_float_col in [
                "ACTUAL_TMT_SALES", "TARGET_TMT_SALES"
            ]:
                if each_float_col in resp.columns:
                    resp[each_float_col] = resp[each_float_col].fillna(0.0)

            # Fill missing values for string columns
            for each_str_col in [
                "FISCAL_YEAR"
            ]:
                if each_str_col in resp.columns:
                    resp[each_str_col] = resp[each_str_col].fillna('').astype(str)

            return {"status": True, "message": "success", "data": resp}
        
        # Execute the query
        # resp = await function(query=sales_yearly_growth_query_)
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=sales_yearly_growth_query_, limit=0)
        resp = resp.get("data", [])
        # Convert the response to a DataFrame for further processing
        resp = pd.DataFrame(resp)

        # Fill missing values for numerical columns
        for each_float_col in [
            "TARGET_QTY_TMT", "Prediction_Value", "Product_Achievement", 
            "Zone_Region_Achievement", "Rate_Per_Day_Required_MMT", 
            "Rate_per_day_current_MMT", "FinalSum", "FinalActualSum", "NETWEIGHT_TMT"
        ]:
            if each_float_col in resp.columns:
                resp[each_float_col] = resp[each_float_col].fillna(0.0)

        # Fill missing values for string columns
        for each_str_col in [
            "SBU", "SBU_Name", "ZONE", "Zone_Name", "REGION", "Region_Name", "SA", 
            "SalesArea_Name", "PRODUCT", "ProductName", "UOM", "FISCAL_YEAR", 
            "month_year", "month_name"
        ]:
            if each_str_col in resp.columns:
                resp[each_str_col] = resp[each_str_col].fillna('').astype(str)

        # Apply grouping logic based on filters
        if filters:
            grouped_resp = None
            filter_keys = [rec.key.strip('"') for rec in filters]

            if "FISCAL_YEAR" in filter_keys and "SBU_Name" not in filter_keys:
                grouped_resp = resp.groupby(["FISCAL_YEAR", "SBU_Name"], as_index=False).agg({
                    "NETWEIGHT_TMT": "sum",
                    "TARGET_QTY_TMT": "sum"
                })
                grouped_resp = resp.groupby(["fiscal_year", "month_name", "SBU_Name"], as_index=False).agg({
                    "total_sales": lambda x: sum(round(x)),
                })

            elif "FISCAL_YEAR" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" not in filter_keys:
                grouped_resp = resp.groupby(["FISCAL_YEAR","SBU_Name","Zone_Name"], as_index=False).agg({
                    "NETWEIGHT_TMT": "sum",
                    "TARGET_QTY_TMT": "sum"
                })

            elif "FISCAL_YEAR" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys and "Region_Name" not in filter_keys:
                grouped_resp = resp.groupby(["FISCAL_YEAR","SBU_Name","Zone_Name","Region_Name"], as_index=False).agg({
                    "NETWEIGHT_TMT": "sum",
                    "TARGET_QTY_TMT": "sum"
                })

            elif "FISCAL_YEAR" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys \
                    and "Region_Name" in filter_keys and "SalesArea_Name" not in filter_keys:
                grouped_resp = resp.groupby(["FISCAL_YEAR","SBU_Name","Zone_Name","Region_Name","SalesArea_Name"], as_index=False).agg({
                    "NETWEIGHT_TMT": "sum",
                    "TARGET_QTY_TMT": "sum",
                })

            elif "FISCAL_YEAR" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys and \
                    "Region_Name" in filter_keys and "SalesArea_Name" in filter_keys and "ProductName" not in filter_keys:
                grouped_resp = resp.groupby(["FISCAL_YEAR","SBU_Name","Zone_Name","Region_Name","SalesArea_Name","ProductName"], as_index=False).agg({
                    "NETWEIGHT_TMT": "sum",
                    "TARGET_QTY_TMT": "sum",
                })


            # Return grouped response
            if grouped_resp is not None:
                return {"status": True, "message": "success", "data": grouped_resp.to_dict(orient='records')}


        # If no filters are applied, return the default response
        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
                            
        
    @staticmethod
    async def card_chart(filters, cross_filters, drill_state):
        try:
            card_query = lpg_plant_queries.lpg_plant_query.get(drill_state.split(",")[0])
            
            if cross_filters:
                conditions = []
                for rec in cross_filters:
                    if "DATE" in rec.key:
                        start = rec.value.split(",")[0]
                        end = rec.value.split(",")[-1]
                        conditions.append(f"process_date BETWEEN '{start} 00:00:00' AND '{end} 23:59:59' ")
                        card_query = card_query.split("WHERE")[0].split("where")[0]
                        continue
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
                    if not "where" in card_query.lower():
                        card_query  += ' WHERE '
                    else:
                        card_query += ' AND '
                    card_query  += ' AND '.join(conditions)
            
            today = datetime.now()
            current_month = datetime.now().strftime("%B") # format : January, February
            if today.month < 4:
                start_year = today.year - 1
            else:
                start_year = today.year
            end_year = start_year + 1
            financial_year = f"{start_year}-{end_year}" # Format : 2024-2025
            if not "," in drill_state:
                if "financial_year" in card_query.lower().split("where")[-1] and not "month" in card_query.lower().split("where")[-1]:
                    card_query = card_query.format(financial_year=financial_year)
                elif "financial_year" in card_query.lower().split("where")[-1] and "month" in card_query.lower().split("where")[-1]:
                    card_query = card_query.format(financial_year=financial_year, current_month=current_month)
            elif "," in drill_state and "financial_year" in drill_state.lower() and "month" in drill_state.lower():
                financial_year = drill_state.split(",")[-2].split("=")[-1].replace("'","")
                current_month = drill_state.split(",")[-1].split("=")[-1].replace("'","")
                card_query = card_query.format(financial_year=financial_year, current_month=current_month)
            elif "," in drill_state and "financial_year" in drill_state.lower() and not "month" in drill_state.lower():
                financial_year = drill_state.split(",")[-1].split("=")[-1].replace("'","")
                card_query = card_query.format(financial_year=financial_year)            
            if "cdcms" in drill_state.lower():
                access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgSalesSummaryData.get_clause_conditions(formated=True)]
                card_query =  await widget_actions.WidgetActions.apply_filter_drilldown(card_query, access_filters, drill_state)
            else:
                access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                        for rec in await hpcl_ceg_model.LpgOperationsSummary.get_clause_conditions(formated=True)]
                card_query =  await widget_actions.WidgetActions.apply_filter_drilldown(card_query, access_filters, drill_state)
            
            print("-"*50)
            print("card_query ---->", card_query)
            print("-"*50)
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=card_query, limit=0)
            resp = resp.get("data", [])
            resp = pd.DataFrame(resp)
            return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
        except Exception as e:
            print("Exception in BigNumber Chart :", str(e))
            return {"status": True, "message": "success", "data": []}
            

    @staticmethod
    async def carry_forward_analysis(filters, cross_filters, drill_state):
        """
        For Dry Out and Indent Carry Forward Analysis
        :param filters:
        :param drill_state:
        :return:
        """
        query = lpg_plant_queries.lpg_plant_query.get("carry_forward_analysis")
        query = lpg_plant_queries.lpg_plant_query.get("carry_fwd_indent")
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
            query += f" WHERE {' AND '.join(conditions)}"
        query += " GROUP BY execution_date::DATE"
        # resp = await function(query=query)
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
        resp = resp.get("data", [])
        return resp

    @staticmethod
    async def location_wise_distribution(filters, cross_filters, drill_state):
        location_wise_distribution_query = lpg_plant_queries.lpg_plant_query.get("location_wise_distribution")
        location_wise_distribution_query_ = location_wise_distribution_query
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            location_wise_distribution_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(location_wise_distribution_query, filters, drill_state)
        try:
            # resp = await function(query=location_wise_distribution_query_)
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=location_wise_distribution_query_, limit=0)
            resp = resp.get("data", [])
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
        return {"status": True, "message": "success", "data": resp}            
        
    
    @staticmethod
    async def cp_total_locations(filters, cross_filters, drill_state):
        cp_locations_query = lpg_plant_queries.lpg_plant_query.get('cp_total_locations')
        
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.ConsumerPumpTankDelivery.get_clause_conditions(formated=True)]
        if filters:
            cp_locations_query = await widget_actions.WidgetActions.apply_filter_drilldown(cp_locations_query, filters, drill_state)
        
        print("query before execution: ", cp_locations_query)
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=cp_locations_query, limit=0)
        resp = resp.get("data", [])

        return {"status": True, "message": "success", "data": resp}
    
    @staticmethod
    async def cp_total_dus(filters, cross_filters, drill_state):
        cp_dus_query = lpg_plant_queries.lpg_plant_query.get('cp_total_dus')
        
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.ConsumperPumpTransaction.get_clause_conditions(formated=True)]
        if filters:
            cp_dus_query = await widget_actions.WidgetActions.apply_filter_drilldown(cp_dus_query, filters, drill_state)
        
        print("query before execution: ", cp_dus_query)
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=cp_dus_query, limit=0)
        resp = resp.get("data", [])

        return {"status": True, "message": "success", "data": resp}
    

    @staticmethod
    async def cp_total_tanks(filters, cross_filters, drill_state):
        cp_dus_query = lpg_plant_queries.lpg_plant_query.get('cp_total_tanks')
        
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.ConsumerPumpTankDelivery.get_clause_conditions(formated=True)]
        if filters:
            cp_dus_query = await widget_actions.WidgetActions.apply_filter_drilldown(cp_dus_query, filters, drill_state)
        
        print("query before execution: ", cp_dus_query)
        # resp = await function(query=cp_dus_query)
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=cp_dus_query, limit=0)
        resp = resp.get("data", [])

        return {"status": True, "message": "success", "data": resp}

    @staticmethod
    async def cp_avg_monthly_consumption(filters, cross_filters, drill_state):
        cp_query = lpg_plant_queries.lpg_plant_query.get('cp_avg_monthly_consumption')
        
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.ConsumerPumpTankDelivery.get_clause_conditions(formated=True)]
        if filters:
            cp_query = await widget_actions.WidgetActions.apply_filter_drilldown(cp_query, filters, drill_state)
        
        print("query before execution: ", cp_query)
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=cp_query, limit=0)
        resp = resp.get("data", [])

        return {"status": True, "message": "success", "data": resp}

    @staticmethod
    async def cp_avg_monthly_consumption_by_location(filters, cross_filters, drill_state):

        cp_query = lpg_plant_queries.lpg_plant_query.get('cp_avg_monthly_consumption_by_location')
        
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.ConsumerPumpTankDelivery.get_clause_conditions(formated=True)]
        if filters:
            cp_query = await widget_actions.WidgetActions.apply_filter_drilldown(cp_query, filters, drill_state)
        
        print("query before execution: ", cp_query)
        # resp = await function(query=cp_query)
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=cp_query, limit=0)
        resp = resp.get("data", [])

        return {"status": True, "message": "success", "data": resp}

    @staticmethod
    async def cp_total_volume_consumption(filters, cross_filters, drill_state):
        cp_query = lpg_plant_queries.lpg_plant_query.get('cp_total_volume_consumption')
        
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.ConsumerPumpTankDelivery.get_clause_conditions(formated=True)]
        if filters:
            cp_query = await widget_actions.WidgetActions.apply_filter_drilldown(cp_query, filters, drill_state)
        
        print("query before execution: ", cp_query)
        # resp = await function(query=cp_query)
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=cp_query, limit=0)
        resp = resp.get("data", [])
        return {"status": True, "message": "success", "data": resp}

    @staticmethod
    async def cp_total_volume_sales(filters, cross_filters, drill_state):

        cp_query = lpg_plant_queries.lpg_plant_query.get('cp_total_volume_sales')
        
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.ConsumperPumpTransaction.get_clause_conditions(formated=True)]
        if filters:
            cp_query = await widget_actions.WidgetActions.apply_filter_drilldown(cp_query, filters, drill_state)
        
        print("query before execution: ", cp_query)
        # resp = await function(query=cp_query)
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=cp_query, limit=0)
        resp = resp.get("data", [])
        return {"status": True, "message": "success", "data": resp}

    @staticmethod
    async def plants_connected(filters, cross_filters, drill_state):
        try:            
            lpg_query = f"SELECT DISTINCT(short_name) as plant_name FROM lpg_operations_summary where DATE(process_date)='{datetime.now().strftime('%Y-%m-%d')}'"
            master_query = "SELECT DISTINCT(plant) as plant_name FROM lpg_plant_operations_masters"
            df = await urdhva_base.BasePostgresModel.get_aggr_data(query=lpg_query, limit=0)
            master_df = await urdhva_base.BasePostgresModel.get_aggr_data(query=master_query, limit=0)
            df = df.get("data", [])
            master_df = master_df.get("data", [])
            df = pl.DataFrame(df)
            master_df = pl.DataFrame(master_df)
            master_df = master_df.with_columns(
                pl.when(pl.col("plant_name").is_in(df["plant_name"])
                ).then(pl.lit("Connected")).otherwise(pl.lit("Not Connected")).alias("status"))
            master_df = master_df.sort("status")
            return {"status": True, "message": "success", "data": master_df.to_dicts()}
        except Exception as e:
            print(traceback.format_exc())
            return {"status": False, "message": f"Error: {e}"}

    @staticmethod
    async def lpg_operations_productivity_zone(filters, cross_filters, drill_state):
        try:
            # Cross filters
            _filters, daterange = await generate_cross_filter(cross_filters)
            current_date = datetime.now().strftime("%Y-%m-%d")
            query = lpg_plant_queries.lpg_plant_query.get("lpg_operations_productivity_zone")
            # Drill Down filters
            query = await get_drill_down_filter(filters, query)

            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                            for rec in await hpcl_ceg_model.LpgOperationsSummary.get_clause_conditions(formated=True)]
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, access_filters, drill_state)
            
            clause = "WHERE" if "where" not in query.lower() else "AND"
            if daterange:
                query += f" {clause} process_date BETWEEN {daterange}"
            else:
                query += f" {clause} CAST(process_date AS DATE) = '{current_date}'"

            query += ' GROUP BY "zone", "sap_id", "process_date", "filling_head", "location_name"'

            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
            df = pd.DataFrame(resp.get("data", []))

            df = await filter_data(df, _filters)
            if df.empty:
                return {"status": True, "message": "success", "data": []}

            def process_productivity(df, group_cols):
                df = df.groupby(group_cols, as_index=False).agg({
                    "total_production": "sum",
                    "total_net_hours": "sum"
                })
                for col in ["total_production", "total_net_hours"]:
                    df[col] = df[col].fillna(0).astype(np.float64)
                df["productivity"] = (df["total_production"] / df["total_net_hours"]).fillna(0).round(2)
                return df

            if filters:
                filter_keys = [rec.key.strip('"') for rec in filters]
                if "zone" in filter_keys and "plant" not in filter_keys:
                    df = process_productivity(df, ["zone", "plant", "carousel_type"]).rename(columns={"plant": "name"})
                else:
                    if "productivity" in df.columns:
                        df["productivity"] = df["productivity"].fillna(0).round(2)
            else:
                df = process_productivity(df, ["zone", "carousel_type"])

            for col in ["zone", "plant", "carousel_type"]:
                if col in df.columns:
                    df[col] = df[col].fillna("").astype(str)
            df = df.replace([np.inf, -np.inf], np.nan).fillna(0)
            return {"status": True, "message": "success", "data": df}
        except Exception as e:
            print("-- Exception in zone wise productivity widget --")
            print("traceback :", traceback.format_exc())            
            
    
    @staticmethod
    async def lpg_operations_production_zone(filters, cross_filters, drill_state):        
        try:
            _filters, daterange = await generate_cross_filter(cross_filters)

            current_date = datetime.now().strftime("%Y-%m-%d")
            query = lpg_plant_queries.lpg_plant_query.get("lpg_operations_production_zone")

            # Apply drill down filter
            query = await get_drill_down_filter(filters, query)

            # Apply access filters + drilldown
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                            for rec in await hpcl_ceg_model.LpgOperationsSummary.get_clause_conditions(formated=True)]
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, access_filters, drill_state)
            
            clause = "WHERE" if "where" not in query.lower() else "AND"

            if daterange:
                query += f" {clause} process_date BETWEEN {daterange}"
            else:
                query += f" {clause} DATE(process_date) = '{current_date}'"

            query += ' GROUP BY "zone", "sap_id", "location_name", "filling_head"'

            # Execute query
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
            resp = pd.DataFrame(resp.get("data", []))

            resp = await filter_data(resp, _filters)
            if resp.empty:
                return {"status": True, "message": "success", "data": []}

            def process_production(df, group_cols):
                df = df.groupby(group_cols, as_index=False).agg({
                    "14_kg": "sum",
                    "19_kg": "sum"
                })
                df["14_kg"] = df["14_kg"].fillna(0).astype(np.float64) * 14.2
                df["19_kg"] = df["19_kg"].fillna(0).astype(np.float64) * 19
                df["Productions"] = ((df["14_kg"].fillna(0) + df["19_kg"].fillna(0)) / 1000).round(2)
                return df

            if filters:
                filter_keys = [rec.key.strip('"') for rec in filters]
                if "zone" in filter_keys and "plant" not in filter_keys:
                    resp = process_production(resp, ["zone", "plant"]).rename(columns={"plant": "name"})
                else:
                    for col in ["Productions"]:
                        if col in resp.columns:
                            resp[col] = resp[col].fillna(0.0).round(2)
            else:
                resp = process_production(resp, ["zone"])

            for col in ["zone", "plant"]:
                if col in resp.columns:
                    resp[col] = resp[col].fillna("").astype(str)
            return {"status": True, "message": "success", "data": resp.to_dict(orient="records")}
        except Exception as e:
            print("-- Exception in zone wise production widget --")
            print("traceback :", traceback.format_exc())            


    @staticmethod
    async def lpg_operations_filled_cylinder(filters, cross_filters, drill_state):
        try:
            _filters, daterange = await generate_cross_filter(cross_filters)

            current_date = datetime.now().strftime("%Y-%m-%d")
            query = lpg_plant_queries.lpg_plant_query.get("lpg_operations_production_zone")

            # Apply drill down filter
            query = await get_drill_down_filter(filters, query)    
            
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                            for rec in await hpcl_ceg_model.LpgOperationsSummary.get_clause_conditions(formated=True)]
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, access_filters, drill_state)
            
            clause = "WHERE" if "where" not in query.lower() else "AND"
            if daterange:
                query += f" {clause} process_date BETWEEN {daterange}"
            else:
                query += f" {clause} DATE(process_date) = '{current_date}'"

            query += ' GROUP BY "zone", "sap_id", "location_name", "filling_head"'

            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
            df = pd.DataFrame(resp.get("data", []))

            df = await filter_data(df, _filters)
            if df.empty:
                return {"status": True, "message": "success", "data": []}

            def process_cylinders(df, group_cols):
                df = df.groupby(group_cols, as_index=False).agg({
                    "14_kg": "sum",
                    "19_kg": "sum"
                })
                df["Cylinder_Filled"] = (
                    df["14_kg"].fillna(0).astype(np.float64) +
                    df["19_kg"].fillna(0).astype(np.float64)
                ) / 100000
                df["Cylinder_Filled"] = df["Cylinder_Filled"].fillna(0.0).round(2)
                return df

            if filters:
                filter_keys = [rec.key.strip('"') for rec in filters]
                if "zone" in filter_keys and "plant" not in filter_keys:
                    df = process_cylinders(df, ["zone", "plant"])
            else:
                df = process_cylinders(df, ["zone"])

            for col in ["zone", "plant"]:
                if col in df.columns:
                    df[col] = df[col].fillna("").astype(str)

            return {"status": True, "message": "success", "data": df.to_dict(orient="records")}
        except Exception as e:
            print("-- Exception in zone wise filled cylinder --")
            print("traceback :", traceback.format_exc())


    @staticmethod
    async def productivity_overtime_vs_break_production(filters, cross_filters, drill_state):
        try:    
            _filters, daterange = await generate_cross_filter(cross_filters)
            query = lpg_plant_queries.lpg_plant_query.get("productivity_overtime_vs_break_production")
            current_date = datetime.now().strftime("%Y-%m-%d")        

            # Apply drill down filter
            query = await get_drill_down_filter(filters, query)
            
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                            for rec in await hpcl_ceg_model.LpgOperationsSummary.get_clause_conditions(formated=True)]
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, access_filters, drill_state)
            
            clause = "WHERE" if "where" not in query.lower() else "AND"
            if daterange:
                query += f" {clause} process_date BETWEEN {daterange} AND zone IS NOT NULL"
            else:
                query += f" {clause} DATE(process_date) = '{current_date}' AND zone IS NOT NULL"

            query += ' GROUP BY "zone", "sap_id", "location_name", "filling_head"'

            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
            df = pd.DataFrame(resp.get("data", []))

            df = await filter_data(df, _filters)
            if df.empty:
                return {"status": True, "message": "success", "data": []}

            def process_production_hours(df, group_cols):
                df = df.groupby(group_cols, as_index=False).agg({
                    "break_production": "sum",
                    "overtime_production": "sum"
                })
                df["break_production"] = df["break_production"].fillna(0).round(2)
                df["overtime_production"] = df["overtime_production"].fillna(0).round(2)
                return df

            if filters:
                filter_keys = [rec.key.strip('"') for rec in filters]
                if "zone" in filter_keys and "plant" not in filter_keys:
                    df = process_production_hours(df, ["zone", "plant"])
            else:
                df = process_production_hours(df, ["zone"])

            for col in ["zone", "plant"]:
                if col in df.columns:
                    df[col] = df[col].fillna("").astype(str)

            return {"status": True, "message": "success", "data": df.to_dict(orient="records")}
        except Exception as e:
            print("-- Exception in zone wise filled cylinder --")
            print("traceback :", traceback.format_exc())
    

    @staticmethod
    async def lpg_operations_rejections(filters, cross_filters, drill_state):
        try:
            _filters, daterange = await generate_cross_filter(cross_filters)
            query = lpg_plant_queries.lpg_plant_query.get("lpg_operations_pq_rejection")
            current_date = datetime.now().strftime("%Y-%m-%d")        

            # Apply drill down filter
            query, _key = await get_drill_down_filter(filters, query)
            
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                            for rec in await hpcl_ceg_model.LpgOperationsSummary.get_clause_conditions(formated=True)]
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, access_filters, drill_state)
            
            clause = "WHERE" if "where" not in query.lower() else "AND"
            if daterange:
                query += f" {clause} process_date BETWEEN {daterange} AND zone IS NOT NULL"
            else:
                query += f" {clause} DATE(process_date) = '{current_date}' AND zone IS NOT NULL"

            query += ' GROUP BY "zone", "sap_id", "location_name", "filling_head"'

            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
            df = pd.DataFrame(resp.get("data", []))

            df = await filter_data(df, _filters)
            if df.empty:
                return {"status": True, "message": "success", "data": []}

            def process_production_hours(df, group_cols):
                df = df.groupby(group_cols, as_index=False).agg({
                    "cs_handled": "sum",
                    "cs_sortout": "sum",                    
                    "pt_handled": "sum",
                    "pt_sortout": "sum",
                    "gd_handled": "sum",
                    "gd_sortout": "sum"
                })
                return df

            if filters:                
                filter_keys = [rec.key.strip('"') for rec in filters]
                if "rejection_type" in filter_keys and "zone" not in filter_keys:
                    df = process_production_hours(df, ["zone"])
                else:
                    df = process_production_hours(df, ["zone", "plant"])
            
            df["Rejections"] = (df[f"{_key.lower()}_sortout"] / df[f"{_key.lower()}_handled"]) * 100

            for col in df.columns:
                if f"{_key.lower()}_sortout" in df.columns:
                    del df[f"{_key.lower()}_sortout"]
                if f"{_key.lower()}_handled" in df.columns:
                    del df[f"{_key.lower()}_handled"]
            df["Rejections"] = df["Rejections"].fillna(0).astype(np.float64).round(2)

            return {"status": True, "message": "success", "data": df.to_dict(orient="records")}
        except Exception as e:
            print("-- Exception in zone wise filled cylinder --")
            print("traceback :", traceback.format_exc())


    @staticmethod
    async def lpg_operations_monthwise_productivity(filters, cross_filters, drill_state):
        try:
            # Extract date range from cross_filters
            _filters, daterange = await generate_cross_filter(cross_filters)
            start_date = None
            end_date = None
            if daterange:
                # Extract start and end dates from daterange string like "'2024-01-01 00:00:00' AND '2024-12-31 23:59:59'"
                import re
                date_matches = re.findall(r"'(\d{4}-\d{2}-\d{2})", daterange)
                if len(date_matches) >= 2:
                    start_date = date_matches[0]
                    end_date = date_matches[1]
                elif len(date_matches) == 1:
                    start_date = date_matches[0]
                    end_date = date_matches[0]
            
            # Extract zones and locations from filters
            zones = None
            locations = None
            zone_level_req = True
            location_level_req = True
            
            if filters:
                for rec in filters:
                    key_lower = rec.key.lower().replace('"', '').strip()
                    if key_lower == "zone":
                        zones = rec.value.split(",") if isinstance(rec.value, str) else rec.value
                        zones = [z.strip() for z in zones] if isinstance(zones, list) else [zones]
                    elif key_lower in ["sap_id", "location", "location_id"]:
                        locations = rec.value.split(",") if isinstance(rec.value, str) else rec.value
                        locations = [l.strip() for l in locations] if isinstance(locations, list) else [locations]
                    elif key_lower == "zone_level_req":
                        zone_level_req = rec.value.lower() in ["true", "1", "yes"] if isinstance(rec.value, str) else bool(rec.value)
                    elif key_lower == "location_level_req":
                        location_level_req = rec.value.lower() in ["true", "1", "yes"] if isinstance(rec.value, str) else bool(rec.value)
            
            # Determine aggregation_level based on filters (for backward compatibility)
            aggregation_level = "overall"
            if filters:
                filter_keys = [rec.key.lower().replace('"', '').strip() for rec in filters]
                if "zone" in filter_keys and "sap_id" not in filter_keys and "location" not in filter_keys:
                    aggregation_level = "zone"
                elif "sap_id" in filter_keys or "location" in filter_keys or "location_id" in filter_keys:
                    aggregation_level = "location"
            
            # Call the monthwise productivity function
            result = await lpg_monthwise_analytics.lpg_operations_monthwise_productivity(
                start_date=start_date,
                end_date=end_date,
                zones=zones,
                locations=locations,
                aggregation_level=aggregation_level,
                zone_level_req=zone_level_req,
                location_level_req=location_level_req
            )
            
            return result
        except Exception as e:
            print("-- Exception in monthwise productivity widget --")
            print("traceback :", traceback.format_exc())
            return {"status": False, "message": f"Error: {e}"}


    @staticmethod
    async def lpg_operations_daywise_productivity(filters, cross_filters, drill_state):
        daywise_productivity_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_operations_daywise_productivity")
        current_date = datetime.now().strftime("%Y-%m-%d")
        _filters = []
        daterange = None
        if cross_filters:
            for filter in cross_filters:
                if "DATE" in filter.key:
                    start = filter.value.split(",")[0]
                    end = (datetime.strptime(filter.value.split(",")[-1], "%Y-%m-%d") + relativedelta(days=1)).strftime("%Y-%m-%d")
                    daterange = f" '{start}' AND '{end}' "
                    continue
                _filters.append({f"{filter.key}": f"{filter.value}"})
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
                daywise_productivity_query_ += ' WHERE ' 
                daywise_productivity_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgOperationsSummary.get_clause_conditions(formated=True)]
            daywise_productivity_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(daywise_productivity_query_, access_filters, drill_state)
            if daterange:
                daywise_productivity_query_ += f' AND "process_date" BETWEEN {daterange} '
            else:
                daywise_productivity_query_ += f' AND "process_date" >= CURRENT_DATE - INTERVAL \'30 day\' AND DATE("process_date") <= \'{current_date}\' '
            daywise_productivity_query_ += ' GROUP BY DATE("process_date"), "zone", "sap_id", "location_name", "filling_head" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgOperationsSummary.get_clause_conditions(formated=True)]
            daywise_productivity_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(daywise_productivity_query_, access_filters, drill_state)
            if not "where" in daywise_productivity_query_.lower() and daterange:
                daywise_productivity_query_ += f' WHERE "process_date" BETWEEN {daterange} '
            elif not "where" in daywise_productivity_query_.lower() and not daterange:
                daywise_productivity_query_ += f' WHERE "process_date" >= CURRENT_DATE - INTERVAL \'30 day\' AND DATE("process_date") <= \'{current_date}\' '
            elif daterange:
                daywise_productivity_query_ += f' AND "process_date" BETWEEN {daterange} '
            else:
                daywise_productivity_query_ += f' AND "process_date" >= CURRENT_DATE - INTERVAL \'30 day\' AND DATE("process_date") <= \'{current_date}\' '
            daywise_productivity_query_ += ' GROUP BY DATE("process_date"), "zone", "sap_id", "location_name", "filling_head" '
        try:
            query_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=daywise_productivity_query_, limit=0)
            query_resp = query_resp.get("data", [])
            resp = pl.DataFrame(query_resp)
            resp = await filter_data(resp.to_pandas(), _filters)
            resp = pl.from_pandas(resp)
            resp = resp.group_by(["process_date"]).agg([
                    pl.sum("total_production").fill_null(0).cast(pl.Float64).round(2).alias("total_production"),
                    pl.sum("total_net_hours").fill_null(0).cast(pl.Float64).round(2).alias("total_net_hours"),
                ])
            resp = resp.with_columns(
                (pl.col("total_production")/pl.col("total_net_hours")
                ).fill_null(0).cast(pl.Float64).round(2).alias("avg_productivity"))
            
            resp = resp.sort("process_date")
            resp = resp.with_columns(pl.col("process_date").dt.strftime("%Y-%m-%d").alias("process_date"))
            return {"status": True, "message": "success", "data": resp.to_dicts()}
        except Exception as e:
            print(traceback.format_exc())
            print(f"Error executing query: {e}")
            return {"status": False, "message": f"Error: {e}"}

    @staticmethod
    async def lpg_operations_monthwise_rejections(filters, cross_filters, drill_state):
        try:
            # Extract date range from cross_filters
            _filters, daterange = await generate_cross_filter(cross_filters)
            start_date = None
            end_date = None
            if daterange:
                # Extract start and end dates from daterange string like "'2024-01-01 00:00:00' AND '2024-12-31 23:59:59'"
                import re
                date_matches = re.findall(r"'(\d{4}-\d{2}-\d{2})", daterange)
                if len(date_matches) >= 2:
                    start_date = date_matches[0]
                    end_date = date_matches[1]
                elif len(date_matches) == 1:
                    start_date = date_matches[0]
                    end_date = date_matches[0]
            
            # Extract zones and locations from filters
            zones = None
            locations = None
            zone_level_req = True
            location_level_req = True
            rejection_type = "all"  # Default to all
            
            if filters:
                for rec in filters:
                    key_lower = rec.key.lower().replace('"', '').strip()
                    if key_lower == "zone":
                        zones = rec.value.split(",") if isinstance(rec.value, str) else rec.value
                        zones = [z.strip() for z in zones] if isinstance(zones, list) else [zones]
                    elif key_lower in ["sap_id", "location", "location_id"]:
                        locations = rec.value.split(",") if isinstance(rec.value, str) else rec.value
                        locations = [l.strip() for l in locations] if isinstance(locations, list) else [locations]
                    elif key_lower == "rejection_type":
                        rejection_type = rec.value.lower().strip() if isinstance(rec.value, str) else str(rec.value).lower()
                        # Map to valid types: cs, pt, gd, all
                        if rejection_type not in ["cs", "pt", "gd", "all"]:
                            rejection_type = "all"
                    elif key_lower == "zone_level_req":
                        zone_level_req = rec.value.lower() in ["true", "1", "yes"] if isinstance(rec.value, str) else bool(rec.value)
                    elif key_lower == "location_level_req":
                        location_level_req = rec.value.lower() in ["true", "1", "yes"] if isinstance(rec.value, str) else bool(rec.value)
            
            # Determine aggregation_level based on filters (for backward compatibility)
            aggregation_level = "overall"
            if filters:
                filter_keys = [rec.key.lower().replace('"', '').strip() for rec in filters]
                if "zone" in filter_keys and "sap_id" not in filter_keys and "location" not in filter_keys:
                    aggregation_level = "zone"
                elif "sap_id" in filter_keys or "location" in filter_keys or "location_id" in filter_keys:
                    aggregation_level = "location"
            
            # Call the monthwise rejections function
            result = await lpg_monthwise_analytics.lpg_operations_monthwise_rejections(
                start_date=start_date,
                end_date=end_date,
                zones=zones,
                locations=locations,
                aggregation_level=aggregation_level,
                rejection_type=rejection_type,
                zone_level_req=zone_level_req,
                location_level_req=location_level_req
            )
            
            return result
        except Exception as e:
            print("-- Exception in monthwise rejections widget --")
            print("traceback :", traceback.format_exc())
            return {"status": False, "message": f"Error: {e}"}

    @staticmethod
    async def lpg_operations_daywise_production(filters ,cross_filters, drill_state):
        daywise_production_query_ = lpg_plant_queries.lpg_plant_query.get("lpg_operations_daywise_production")        
        current_date = datetime.now().strftime("%Y-%m-%d")
        _filters = []
        daterange = None
        if cross_filters:
            for filter in cross_filters:
                if "DATE" in filter.key:
                    start = filter.value.split(",")[0]
                    end = (datetime.strptime(filter.value.split(",")[-1], "%Y-%m-%d") + relativedelta(days=1)).strftime("%Y-%m-%d")
                    daterange = f" '{start}' AND '{end}' "
                    continue
                _filters.append({f"{filter.key}": f"{filter.value}"})
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
                daywise_production_query_ += ' WHERE ' 
                daywise_production_query_ += ' AND '.join(conditions)
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgOperationsSummary.get_clause_conditions(formated=True)]
            daywise_production_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(daywise_production_query_, access_filters, drill_state)
            if daterange:
                daywise_production_query_ += f' AND "process_date" BETWEEN {daterange} '
            else:
                daywise_production_query_ += f' AND "process_date" >= CURRENT_DATE - INTERVAL \'30 day\' AND DATE("process_date") <= \'{current_date}\' '
            daywise_production_query_ += ' GROUP BY DATE("process_date"), "zone", "sap_id", "location_name", "filling_head" '
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgOperationsSummary.get_clause_conditions(formated=True)]
            daywise_production_query_ =  await widget_actions.WidgetActions.apply_filter_drilldown(daywise_production_query_, access_filters, drill_state)            
            if not "where" in daywise_production_query_.lower() and not daterange:
                daywise_production_query_ += f' WHERE "process_date" >= CURRENT_DATE - INTERVAL \'30 day\' AND DATE("process_date") <= \'{current_date}\' '
            elif not "where" in daywise_production_query_.lower() and daterange:
                daywise_production_query_ += f' WHERE "process_date" BETWEEN {daterange} '
            elif daterange:
                daywise_production_query_ += f' AND "process_date" BETWEEN {daterange} '
            else:
                daywise_production_query_ += f' AND "process_date" >= CURRENT_DATE - INTERVAL \'30 day\' AND DATE("process_date") <= \'{current_date}\' '
            daywise_production_query_ += ' GROUP BY DATE("process_date"), "zone", "sap_id", "location_name", "filling_head" '
        try:
            query_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=daywise_production_query_, limit=0)
            query_resp = query_resp.get("data", [])
            resp = pl.DataFrame(query_resp)
            resp = await filter_data(resp.to_pandas(), _filters)
            resp = pl.from_pandas(resp)
            resp = resp.with_columns(
                ((pl.col("14_kg").fill_null(0).cast(pl.Float64)*14.2) + 
                 (pl.col("19_kg").fill_null(0).cast(pl.Float64)*19)
                 ).round(2).alias("sum_production"))
            resp = resp.group_by(["process_date"]).agg([
                    (pl.sum("sum_production") / 1000).round(2).alias("sum_production"),
                ])
            resp = resp.sort("process_date")
            resp = resp.with_columns(pl.col("process_date").dt.strftime("%Y-%m-%d").alias("process_date"))
            return {"status": True, "message": "success", "data": resp.to_dicts()}
        except Exception as e:
            print(traceback.format_exc())
            print(f"Error executing query: {e}")
            return {"status": False, "message": f"Error: {e}"}

    
    @staticmethod
    async def sales_growth_ytd(filters, cross_filters, drill_state):
        sales_growth_ytd_query_ = lpg_plant_queries.lpg_plant_query.get("sales_growth_ytd")
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

        # Reverse mapping (for returning the short form)
        reverse_month_mapping = {v: k for k, v in month_mapping.items()}
        conditions = []
        if filters:
            for rec in filters:
                rec.value = rec.value.split(",")
                if isinstance(rec.value, str):
                    print("in if")
                    condition = f" and {rec.key} = '{rec.value}'"
                else:
                    if len(rec.value) == 1:
                        print("if in else")
                        if rec.key =='"SBU_Name"':
                            rec.key = '"ORGSBUNAME"'
                        elif rec.key == '"Zone_Name"':
                            rec.key = '"ORGZONENAME"'
                        elif rec.key == '"SalesArea_Name"':
                            rec.key = '"ORGSANAME"'
                        elif rec.key == '"Region_Name"':
                            rec.key = '"ORGRONAME"'
                        condition = f" and {rec.key} = '{rec.value[0]}'"
                    else:
                        print("else in else")
                        condition = f"{rec.key} in {tuple(rec.value)}"
                conditions.append(condition)

            if conditions:
                #sales_growth_query_ += ' WHERE '
                sales_growth_ytd_query_ += ''.join(conditions)
            sales_growth_ytd_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(sales_growth_ytd_query_, filters, drill_state)
        else:
            # Fallback query if no filters are provided
            sales_growth_ytd_query_ = """  
                SELECT
                    ROUND(SUM("MOM_DAY_LEVEL_DATA"."NETWEIGHT_TMT")) AS "total_sales",
                    "MOM_DAY_LEVEL_DATA"."fiscal_year" AS "fiscal_year",
                    "MOM_DAY_LEVEL_DATA"."month_name"
                FROM
                    "hpcl_ceg"."public"."MOM_DAY_LEVEL_DATA"
                WHERE
                    "MOM_DAY_LEVEL_DATA"."fiscal_year" in ('2023-2024','2024-2025')
                GROUP BY
                  "MOM_DAY_LEVEL_DATA"."fiscal_year","MOM_DAY_LEVEL_DATA"."month_name"
                ORDER BY
                    "MOM_DAY_LEVEL_DATA"."fiscal_year" ASC;
            """

            # resp = await function(query=sales_growth_ytd_query_)
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=sales_growth_ytd_query_, limit=0)
            resp = resp.get("data", [])
            month_map = {'Apr': '0', 'May': '1', 'Jun': '2', 'Jul': '3', 'Aug': '4', 'Sep': '5', 'Oct': '6', 'Nov': '7',
                         'Dec': '8', 'Jan': '9', 'Feb': '10', 'Mar': '11'}
            d = {"2023-2024": {"0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0,
                               "11": 0},
                 "2024-2025": {"0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0,
                               "11": 0},
                 "fy_month": {"0": "1", "1": "2", "2": "3", "3": "4", "4": "5", "5": "6", "6": "7", "7": "8", "8": "9",
                              "9": "10", "10": "11", "11": "12"},
                 "month_name": {"0": "Apr", "1": "May", "2": "Jun", "3": "Jul", "4": "Aug", "5": "Sep", "6": "Oct",
                                "7": "Nov", "8": "Dec", "9": "Jan", "10": "Feb", "11": "Mar"}}

            for rec in resp:
                if rec['fiscal_year'] == "2024-2025":
                    d['2024-2025'][month_map[rec['month_name']]] = rec['total_sales']
                else:
                    d['2023-2024'][month_map[rec['month_name']]] = rec['total_sales']
            return {"status": True, "message": "success", "data": d}
        
        # resp = await function(query=sales_growth_ytd_query_)
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=sales_growth_ytd_query_, limit=0)
        resp = resp.get("data", [])
        resp = pd.DataFrame(resp)
        resp =resp.rename(columns = {'ORGSBUCD':'SBU','ORGSBUNAME':'SBU_Name','ORGZONECD':'ZONE','ORGZONENAME':'Zone_Name','ORGRONAME':'Region_Name',
            'NETWEIGHT_TMT':'total_sales', 'ORGSANAME':'SalesArea_Name',"ORGSACD":"SA","ORGROCD":"REGION"})

        # Fill missing values for numeric columns
        for each_float_col in ["sum_total_sales", "total_sales"]:
            if each_float_col in resp.columns.tolist():
                resp[each_float_col] = resp[each_float_col].fillna(0.0)

        # Fill missing values for string columns
        for each_str_col in [
             "month_name", "SBU", "ZONE", "REGION", "SA",

            "Zone_Name", "Region_Name", "SalesArea_Name", "fiscal_year",
            "month_name"
        ]:
            resp[each_str_col] = resp[each_str_col].fillna('').astype(str)
        
        if filters:
            filter_keys = [rec.key.strip('"') for rec in filters]
            filter_keys = [x.replace('ORGSBUNAME', 'SBU_Name') if 'ORGSBUNAME' in x else x.replace('ORGZONENAME', 'Zone_Name') if 'ORGZONENAME' in x else x.replace('ORGSANAME','SalesArea_Name') if 'ORGSANAME'in x else x.replace('ORGRONAME','Region_Name') if 'ORGRONAME' in x else x for x in filter_keys]
            resp["month_name"] = resp["month_name"].apply(
                lambda x: reverse_month_mapping.get(x, x)
            )
            grouped_keys = ["fiscal_year", "month_name"]
            # this is for getting all the months data for the specific SBU and fiscal year
            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'SBU_Name' in filter_keys:
                grouped_keys.extend(["SBU_Name"])
            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'Zone_Name' in filter_keys:
                grouped_keys.extend(["Zone_Name"])
            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'Region_Name' in filter_keys:
                grouped_keys.extend(["Region_Name"])
            if "month_name" not in filter_keys and 'fiscal_year' not in filter_keys and 'SalesArea_Name' in filter_keys:
                grouped_keys.extend(["SalesArea_Name"])
            
            if "month_name" in filter_keys and "SBU_Name" not in filter_keys:
                grouped_keys.append("SBU_Name")
            elif "month_name" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" not in filter_keys:
                if "DS Lubes" in filters[-1].value[0] or 'DS' in filters[-1].value[0] or 'Lubes' in filters[-1].value[0]:
                    grouped_keys.extend(["SBU_Name", "Region_Name"])
                else:
                    grouped_keys.extend(["SBU_Name", "Zone_Name"])
            elif ("month_name" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys and
                  "Region_Name" not in filter_keys):
                grouped_keys.extend(["SBU_Name", "Zone_Name", "Region_Name"])
            elif ("month_name" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys
                  and "Region_Name" in filter_keys and "SalesArea_Name" not in filter_keys):
                grouped_keys.extend(["SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name"])
            elif ("month_name" in filter_keys and "SBU_Name" in filter_keys and "Zone_Name" in filter_keys and
                  "Region_Name" in filter_keys and "SalesArea_Name" in filter_keys):
                grouped_keys.extend(["SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name","MATERIALGROUPNAME"])
            grouped_resp = resp.groupby(grouped_keys, as_index=False).agg({
                "total_sales": lambda x: round(sum(x),2),
            })
            print("grouped_keys->>",grouped_keys)
            if grouped_resp is not None:
                if "sbu_name" in resp.columns.tolist():
                    sub_name = list(set(rec['SBU_Name'] for rec in grouped_resp.to_dict(orient='records')))
                transformed_data = []
                data = grouped_resp.to_dict(orient='records')
                print("data-->>",data)
                '''
                for sbu_name in sub_name:
                    entry = {
                        "month_name": "Jan",
                        "SBU_Name": sbu_name,
                        "2024-2025": next((item['total_sales'] for item in data if
                                           item['SBU_Name'] == sbu_name and item['fiscal_year'] == '2024-2025'), 0),
                        "2023-2024": next((item['total_sales'] for item in data if
                                           item['SBU_Name'] == sbu_name and item['fiscal_year'] == '2023-2024'), 0)
                    }
                    for key in ["Zone_Name", "Region_Name", "SalesArea_Name"]:
                        if key in grouped_keys:
                            if key in data[0]:
                            entry[key] = next((item[key] for item in data if item['SBU_Name'] == sbu_name), None)
                    
                    transformed_data.append(entry)
                return {"status": True, "message": "success", "data": transformed_data}
                '''
                # added the below lines from 685 to 696 for dorrect drill data from backend 
                '''
                for record in data:
                    entry = {
                        "month_name": record["month_name"],
                        "SBU_Name": record["SBU_Name"],
                        "2024-2025": record["total_sales"] if record["fiscal_year"] == "2024-2025" else 0,
                        "2023-2024": record["total_sales"] if record["fiscal_year"] == "2023-2024" else 0,
                        "fiscal_year": record["fiscal_year"]
                    }
                    for key in grouped_keys:
                        if key in record:
                            entry[key] = record[key]
                    transformed_data.append(entry)
                '''
                if "sbu_name" in resp.columns.tolist():
                    grouped_data = defaultdict(lambda: {'2023-2024': 0, '2024-2025': 0, 'month_name': '', 'SBU_Name': ''})
                else:
                    grouped_data = defaultdict(lambda: {'2023-2024': 0, '2024-2025': 0, 'month_name': ''})
                #grouped_keys =  ['fiscal_year', 'month_name', 'SBU_Name']
                key_fields = [key for key in grouped_keys if key != 'fiscal_year']  # Exclude 'fiscal_year'

                for record in data:
                    key = tuple(record[field] for field in key_fields)    
                    #key = (record['month_name'], record['SBU_Name'],record['Zone_Name'])
                    for field in key_fields:
                        grouped_data[key][field] = record.get(field, '')
                    grouped_data[key][record['fiscal_year']] = record['total_sales']
                result = list(grouped_data.values())
                return {"status": True, "message": "success", "data": result}

        return {"status": True, "message": "success", "data": resp.to_dict(orient='records')}
        

    @staticmethod
    async def sales_drop_down(filters, cross_filters, drill_state):
        _query = ''' select * from alerts '''
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=_query, limit=0)
        resp = resp.get("data", [])
        df = pl.from_pandas(pd.DataFrame(resp))
        _filters = []
        if filters:
            for filter in filters:
                _filters.append({f"{filter.key}": f"{filter.value}"})
        if _filters:
            filter_expr = pl.lit(True)
            for _filter in _filters:
                for key, value in _filter.items():
                    key = key.replace('"', '')
                    filter_expr = filter_expr & (pl.col(key).fill_null("") == value)
            df = df.filter(filter_expr)
        df = df.filter(pl.col("zone").fill_null("") != "")
        df = df.filter(pl.col("region").fill_null("") != "")
        df = df.filter(pl.col("sales_area").fill_null("")!="")

        data = {"zone": df['zone'].unique().to_list(),
                "region": df['region'].unique().to_list(), "sales_area": df['sales_area'].unique().to_list()}
        return data

    @staticmethod
    async def present_previous_month_sales_by_product(filters, cross_filters, drill_state, limit, time_grain):
        present_month_sales = lpg_plant_queries.lpg_plant_query.get('i_previous_current_month_sales_by_product')
        cross_filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                          for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if cross_filters:
            conditions = [await addFilterValue(rec) for rec in cross_filters]
            if conditions:
                present_month_sales_query = present_month_sales.split("'Completed')")
                present_month_sales = present_month_sales_query[0] + "'Completed')" + ' AND ' + ' AND '.join(
                    conditions) + present_month_sales_query[1]
            # present_month_sales += f' {sort_by}'
            if limit:
                present_month_sales += f' LIMIT {limit}'
            print(present_month_sales)

        pres_mon_sales_query = present_month_sales.format(time_grain=time_grain.lower())
        # pres_mon_sales_resp = await function(query=pres_mon_sales_query)
        pres_mon_sales_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=pres_mon_sales_query, limit=0)
        pres_mon_sales_resp = pres_mon_sales_resp.get("data", [])
        distinct_periods = list(set(item['period'] for item in pres_mon_sales_resp))
        print("distinct_periods--> ", distinct_periods)
        formatted_results = {}

        # Iterate over the response and group the data by product_name
        for row in pres_mon_sales_resp:
            product_name = row["product_name"]
            period = row["period"]
            avg_total_sales = row["avg_total_sales"]

            if product_name not in formatted_results:
                formatted_results[product_name] = {"product_name": product_name}

            # Add the period and its corresponding average sales value to the dictionary
            formatted_results[product_name][period] = avg_total_sales

        # Convert the dictionary to a list of results
        final_result = list(formatted_results.values())
        for res in final_result:
            for p_ in distinct_periods:
                res.setdefault(p_, 0)

        return {"status": True, "message": "success", "data": final_result}

    
    @staticmethod
    async def maintenance_fault(filters, cross_filters, drill_state):
        """
        This method is used to fetch the alert ageing data for the given filters and drill state
        :param filters: The filter parameters
        :param drill_state: The drill down state
        :return: A dictionary containing the status, message and the alert ageing data
        """
        alert_status = drill_state
        daterange = None

        if cross_filters:
            for filter in cross_filters:
                if "DATE" in filter.key:
                    daterange = f" '{filter.value.split(',')[0]}' AND '{filter.value.split(',')[-1]}' "
        
        if daterange:
            query = f""" 
                SELECT 
                    DATE(created_at) AS created_date,
                    alert_category,
                    COUNT(*) AS alert_count,
                    CASE 
                        WHEN interlock_name LIKE '%Under Maintenance%' THEN 'maintenance'
                        ELSE 'fault'
                    END AS interlock_status
                FROM alerts
                WHERE alert_section = 'TAS' 
                    AND created_at BETWEEN {daterange} 
                    AND alert_status = '{alert_status}'
                    AND alert_category IS NOT NULL
                GROUP BY created_date, alert_category, interlock_status
                ORDER BY created_date DESC, alert_count DESC;
            """
        else:
            query = f""" 
                SELECT 
                    DATE(created_at) AS created_date,
                    alert_category,
                    COUNT(*) AS alert_count,
                    CASE 
                        WHEN interlock_name LIKE '%Under Maintenance%' THEN 'maintenance'
                        ELSE 'fault'
                    END AS interlock_status
                FROM alerts
                WHERE alert_section = 'TAS' 
                    AND created_at::DATE >= CURRENT_DATE - INTERVAL '7 days' 
                    AND alert_status = '{alert_status}'
                    AND alert_category IS NOT NULL
                GROUP BY created_date, alert_category, interlock_status
                ORDER BY created_date DESC, alert_count DESC;
            """
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
        resp = resp.get("data", [])
        print("resp :", resp)
        resp = pl.DataFrame(resp)
        
        if resp.is_empty():
            return []

        result = {}

        # Process data and create category-specific keys
        for created_date in resp["created_date"].unique().to_list():
            filtered_resp = resp.filter(pl.col("created_date") == created_date)
            date_result = {}

            for category in filtered_resp["alert_category"].unique().to_list():
                category_resp = filtered_resp.filter(pl.col("alert_category") == category)
                
                for status in ["maintenance", "fault"]:
                    key = f"{category.lower()}_{status}"
                    date_result[key] = category_resp.filter(pl.col("interlock_status") == status)["alert_count"].sum()

            result[created_date] = date_result

        return result
    

    @staticmethod
    async def indent_dryout_counts(filters, cross_filters, drill_state):
        dryout_query = lpg_plant_queries.lpg_plant_query.get('i_dryout_ro_count')
        intraday_query = lpg_plant_queries.lpg_plant_query.get('i_intraday_dryout_ro_count')
        potential_query = lpg_plant_queries.lpg_plant_query.get('i_potential_dryout_ro_count')

        if filters:
            filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                        for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
            conditions = [await addFilterValue(rec) for rec in filters]

            for rec in filters:
                if ',' in rec.value:
                    rec_values = rec.value.split(',')
                    rec_value_tup = tuple([i.strip() for i in rec_values])
                    condition = f''' "alerts_view"."{rec.key}" IN {rec_value_tup} '''
                else:
                    condition = f''' "alerts_view"."{rec.key}" = '{rec.value}' '''
                conditions.append(condition)
            dryout_query += ' AND '+' AND '.join(conditions)
            intraday_query += ' AND '+' AND '.join(conditions)
            potential_query += ' AND '+' AND '.join(conditions)
        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                              for rec in
                              await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
            dryout_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                dryout_query, access_filters, drill_state)

            intraday_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                intraday_query, access_filters, drill_state)

            potential_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                potential_query, access_filters, drill_state)

        print("dryout_resp: ", dryout_query)
        print("intraday_resp: ", intraday_query)
        print("potential_resp: ", potential_query)

        # dryout_resp = await function(query=dryout_query)
        # intraday_resp = await function(query=intraday_query)
        # potential_resp = await function(query=potential_query)
        dryout_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=dryout_query, limit=0)
        intraday_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=intraday_query, limit=0)
        potential_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=potential_query, limit=0)

        dryout_resp = dryout_resp.get("data", [])
        intraday_resp = intraday_resp.get("data", [])
        potential_resp = potential_resp.get("data", [])
        print("dryout_resp: ", dryout_resp)
        print("intraday_resp: ", intraday_resp)
        print("potential_resp: ", potential_resp)

        return {"status": True, "message": "success", "data": [
            {
                "dryout_count": dryout_resp[0]['total_count'] or 0,
                "intraday_count": intraday_resp[0]['total_count'] or 0,
                "potential_count": potential_resp[0]['total_count'] or 0
            }
        ]}

    @staticmethod
    async def indent_status_summary(filters, cross_filters, drill_state):
        """
        Args:
            filters:
            cross_filters:
            drill_state:

        Returns:
            [
                {
                    "indent_status": "status of the indent",
                    "dryout_status": "total_ro"
                }
            ]
        """
        indent_status_query = lpg_plant_queries.lpg_plant_query.get('i_indent_status_summary')

        if filters:
            filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                        for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
            indent_status_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                indent_status_query, filters, drill_state)

        else:
            access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                              for rec in
                              await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
            indent_status_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                indent_status_query, access_filters, drill_state)
        print("indent_status_query: ", indent_status_query)
        # indent_status_resp = await function(query=indent_status_query)
        indent_status_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=indent_status_query, limit=0)
        indent_status_resp = indent_status_resp.get("data", [])
        transformed_response = [
            {
                'indent_status': item['indent_status'],
                item['dryout_status']: item['total_ro']
            }
            for item in indent_status_resp
        ]
        print(transformed_response)
        return {"status": True, "message": "success", "data": transformed_response}

    @staticmethod
    async def dryout_summary_by_product(filters, cross_filters, drill_state):
        """
        Args:
            filters:
            cross_filters:
            drill_state:

        Returns:
            [
                {
                    "indent_status": "status of the indent",
                    "dryout_status": "total_ro"
                }
            ]
        """
        dryout_by_prod_query = lpg_plant_queries.lpg_plant_query.get('i_dryout_summary_by_product')

        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                    for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            conditions = [await addFilterValue(rec) for rec in filters]

            splitted_query = dryout_by_prod_query.split("MainFlow')")
            dryout_by_prod_query = splitted_query[0] + "MainFlow') AND " + ' AND '.join(conditions) + splitted_query[1]

        print("dryout_by_prod_query: ", dryout_by_prod_query)
        dryout_by_prod_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=dryout_by_prod_query, limit=0)
        dryout_by_prod_resp = dryout_by_prod_resp.get("data", [])

        grouped_data = defaultdict(dict)

        for item in dryout_by_prod_resp:
            product = item['product']
            grouped_data[product]['product'] = product
            grouped_data[product][item['dryout_status']] = item['total_ro']

        transformed_response = list(grouped_data.values())
        print(transformed_response)
        return {"status": True, "message": "success", "data": transformed_response}

    @staticmethod
    async def detailed_dryout_summary(filters, cross_filters, drill_state):
        """
        Args:
            filters:
            cross_filters:
            drill_state:

        Returns:

        """
        detailed_dryout_query = lpg_plant_queries.lpg_plant_query.get('i_detailed_dryout_summary')
        conditions = []
        display_col = f''' "View 1"."zone" as "zone" '''
        grp_col = f''' "View 1"."zone" '''
        col_ = 'zone'
        if cross_filters:
            col = cross_filters[-1].key
            print("col---> ", col)
            if col == 'zone':
                display_col = f''' "View 1"."region" as "region" '''
                grp_col = f''' "View 1"."region" '''
                col_ = 'region'
            elif col == 'region':
                display_col = f''' "View 1"."sales_area" as "sales_area" '''
                grp_col = f''' "View 1"."sales_area" '''
                col_ = 'sales_area'
            elif col == 'sales_area':
                display_col = f''' "View 1"."location_name" as "location_name" '''
                grp_col = f''' "View 1"."location_name" '''
                col_ = 'location_name'
            conditions.extend([await addFilterValue(cr_filter) for cr_filter in cross_filters])

        detailed_dryout_query = detailed_dryout_query.format(display_col=display_col, grp_col= grp_col)

        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                    for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            conditions.extend([await addFilterValue(rec) for rec in filters])
        if conditions:
            splitted_query = detailed_dryout_query.split("MainFlow')")
            detailed_dryout_query = splitted_query[0] + "MainFlow') AND " + ' AND '.join(conditions) + splitted_query[1]

        print("detailed_dryout_query: ", detailed_dryout_query)
        # detailed_dryout_resp = await function(query=detailed_dryout_query)
        detailed_dryout_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=detailed_dryout_query, limit=0)
        detailed_dryout_resp = detailed_dryout_resp.get("data", [])
        print("col_ value:", col_)
        # transformed_response = [
        #     {
        #         col_: item[col_],
        #         item['dryout_status']: item['total_ro']
        #     }
        #     for item in detailed_dryout_resp
        # ]
        grouped_data = defaultdict(dict)

        for item in detailed_dryout_resp:
            product = item[col_]
            grouped_data[product][col_] = product
            grouped_data[product][item['dryout_status']] = item['total_ro']

        transformed_response = list(grouped_data.values())
        print(transformed_response)
        return {"status": True, "message": "success", "data": transformed_response}

    @staticmethod
    async def detailed_indent_status_summary(filters, cross_filters, drill_state):
        detailed_indent_status_query = lpg_plant_queries.lpg_plant_query.get('i_detailed_indent_status_summary')

        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                    for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            conditions = []
            for rec in filters:
                condition = f"{rec.key} = '{rec.value}' "
                conditions.append(condition)

            splitted_query = detailed_indent_status_query.split("MainFlow')")
            detailed_indent_status_query = splitted_query[0] + "MainFlow') AND " + ' AND '.join(conditions) + splitted_query[1]

        print("detailed_indent_status_query: ", detailed_indent_status_query)
        # detailed_indent_status_resp = await function(query=detailed_indent_status_query)
        detailed_indent_status_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=detailed_indent_status_query, limit=0)
        detailed_indent_status_resp = detailed_indent_status_resp.get("data", [])
        transformed_response = [
            {
                'zone': item['zone'],
                'region': item['region'],
                'sales_area': item['sales_area'],
                'product_name': item['product_name'],
                item['indent_status']: item['total_ro']
            }
            for item in detailed_indent_status_resp
        ]
        print(transformed_response)
        return {"status": True, "message": "success", "data": transformed_response}

    @staticmethod
    async def dryout_product_report(filters, cross_filters, drill_state):
        detailed_indent_status_query = lpg_plant_queries.lpg_plant_query.get('i_product_report')

        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                    for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            conditions = []
            for rec in filters:
                condition = f"{rec.key} = '{rec.value}' "
                conditions.append(condition)

            splitted_query = detailed_indent_status_query.split("MainFlow'")
            detailed_indent_status_query = splitted_query[0] + "MainFlow' AND " + ' AND '.join(conditions) + \
                                           splitted_query[1]

        print("detailed_indent_status_query: ", detailed_indent_status_query)
        # detailed_indent_status_resp = await function(query=detailed_indent_status_query)
        detailed_indent_status_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=detailed_indent_status_query, limit=0)
        detailed_indent_status_resp = detailed_indent_status_resp.get("data", [])
        df = pd.DataFrame(detailed_indent_status_resp)
        return {"status": True, "message": "success", "data": df.to_dict(orient='records')}

    @staticmethod
    async def dryout_indent_report(filters, cross_filters, drill_state):
        detailed_indent_status_query = lpg_plant_queries.lpg_plant_query.get('i_indent_report')
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                    for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            conditions = []
            for rec in filters:
                condition = f"{rec.key} = '{rec.value}' "
                conditions.append(condition)

            splitted_query = detailed_indent_status_query.split("MainFlow'")
            detailed_indent_status_query = splitted_query[0] + "MainFlow' AND " + ' AND '.join(conditions) + \
                                           splitted_query[1]

        print("detailed_indent_status_query: ", detailed_indent_status_query)
        # detailed_indent_status_resp = await function(query=detailed_indent_status_query)
        detailed_indent_status_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=detailed_indent_status_query, limit=0)
        detailed_indent_status_resp = detailed_indent_status_resp.get("data", [])
        df = pd.DataFrame(detailed_indent_status_resp)
        return {"status": True, "message": "success", "data": df.to_dict(orient='records')}

    @staticmethod
    async def product_quantity_by_location(filters, cross_filters, drill_state):
        prod_qty_query = lpg_plant_queries.lpg_plant_query.get('i_product_wise_quantity_by_location')
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                    for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            conditions = [await addFilterValue(rec) for rec in filters]
            splitted_query = prod_qty_query.split("MainFlow'")
            prod_qty_query = splitted_query[0] + "MainFlow' AND " + ' AND '.join(conditions) + splitted_query[1]

        print("prod_qty_query: ", prod_qty_query)
        prod_qty_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=prod_qty_query, limit=0)
        prod_qty_resp = prod_qty_resp.get("data", [])
        df = pl.DataFrame(prod_qty_resp)
        if not df.is_empty():
            result = df.pivot(
                values="Quantity",
                index="Location Name",
                columns="Product Name"
            )
            return {"status": True, "message": "success", "data": result.to_dicts()}
        return {"status": False, "message": "No data", "data": []}

    @staticmethod
    async def ims_report(filters, cross_filters, drill_state):
        ims_report_query = lpg_plant_queries.lpg_plant_query.get('i_ims_report')
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                    for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            conditions = []
            for rec in filters:
                condition = f"{rec.key} = '{rec.value}' "
                conditions.append(condition)

            splitted_query = ims_report_query.split("MainFlow'")
            ims_report_query = splitted_query[0] + "MainFlow' AND " + ' AND '.join(conditions) + splitted_query[1]

        print("ims_report_query: ", ims_report_query)
        # ims_report_resp = await function(query=ims_report_query)
        ims_report_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=ims_report_query, limit=0)
        ims_report_resp = ims_report_resp.get("data", [])
        df = pl.DataFrame(ims_report_resp)
        if not df.is_empty():
            return {"status": True, "message": "success", "data": df.to_dicts()}
        return {"status": False, "message": "No data", "data": []}
    
    @staticmethod
    async def operations_dropdown(filters, cross_filters, drill_state):
        _query = ''' select * from lpg_plant_operations_masters '''
        access_filters = [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.LpgOperationsSummary.get_clause_conditions(formated=True)]
        _query =  await widget_actions.WidgetActions.apply_filter_drilldown(_query, access_filters, drill_state)
        # resp = await function(query=_query)
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=_query, limit=0)
        resp = resp.get("data", [])
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
                    filter_expr = filter_expr & (pl.col(key).fill_null("") == value)
            df = df.filter(filter_expr)
        data = {"zone": df["zone"].unique().to_list(), "plant": df["plant"].unique().to_list(),
                "carousel_type": ["12H", "24H", "48H", "72H"]}
        return data

    @staticmethod
    def get_latest_processed_time(alert_history):

        if not alert_history:
            return None

        try:
            history = alert_history if isinstance(alert_history, list) else json.loads(alert_history)

            filtered = [
                h for h in history
                if h.get("action_type") == "Maintenance"
                   and h.get("maintenance_exception") == True
            ]

            if not filtered:
                return None

            # get latest processed_time
            latest = max(
                filtered,
                key=lambda x: x.get("processed_time") or ""
            )

            pt = latest.get("processed_time")
            if pt:
                return datetime.fromisoformat(pt.replace("Z", "+00:00"))

        except Exception:
            return None

        return None

    @staticmethod
    def get_action_type_logic(alert_history):
        import json

        if not alert_history:
            return None

        try:
            history = alert_history if isinstance(alert_history, list) else json.loads(alert_history)
            for h in reversed(history):  # latest first
                if h.get("is_approved") is True:
                    return h.get("action_type")

            for h in reversed(history):
                if h.get("maintenance_exception") is True:
                    return h.get("action_type")

        except Exception:
            return None
        
        return None
    
    @staticmethod
    async def interlock_name_count(filters, cross_filters, drill_state):
        """
        This method is used to fetch the alert ageing data for the given filters and drill state
        :param filters: The filter parameters
        :param drill_state: The drill down state
        :return: A dictionary containing the status, message and the alert ageing data
        """
        try:
            # Initialize date flag
            date = False
            if "date" in drill_state:
                date = True
            print("date --> ", date)

            # Check if zone or plant filters are present
            zone_filter = ''
            plant_filter = ''
            bcu_number = ''
            status = ''
            if filters:
                for filter in filters:
                    if "zone" in filter.key:
                        zone_filter = filter.value
                    if "sap_id" in filter.key:
                        plant_filter = filter.value
                    if "bcu_number" in filter.key:
                        bcu_number = filter.value
                    if "status" in filter.key:
                        status = filter.value
            # Initialize date filter variables
            date_filter_applied = False
            start_date = None
            end_date = None

            # Process cross filters for date
            if cross_filters:
                for filter in cross_filters:
                    if "DATE" in filter.key:
                        date_parts = filter.value.split(',')
                        start_date = datetime.strptime(date_parts[0].strip("'"), '%Y-%m-%d')
                        end_date = datetime.strptime(date_parts[-1].strip("'"), '%Y-%m-%d')
                        date_filter_applied = True

            normal_interlocks = {item["interlock_name"]: {"alert_category": item["alert_category"],
                                "equipment_name": item.get("equipment_name", item["interlock_name"])}
                                for item in category_mapping.Normal}
            # Construct base SQL Query
            query = f"""SELECT DATE(created_at) AS created_date,
                    sap_id,
                    zone,
                    interlock_name,
                    location_name,
                    device_name,
                    COUNT(*) AS alert_count
                FROM alerts
                WHERE bu = 'TAS' AND alert_section = 'TAS'
            """

            # Add zone filter if present
            if zone_filter:
                query += f" AND zone IN ('{zone_filter}')"

            # Add plant/location filter if present
            if plant_filter:
                query += f" AND sap_id IN ('{plant_filter}')"

            if status:
                query += f" AND alert_status IN ('{status}')"
            # Add date filter directly to SQL if applied
            if date_filter_applied and start_date and end_date:
                query += f" AND DATE(created_at) BETWEEN ('{start_date.strftime('%Y-%m-%d')}') AND ('{end_date.strftime('%Y-%m-%d')}')"

            
            # Complete the query
            query += """
                GROUP BY created_date, zone, interlock_name, sap_id, location_name, device_name
                ORDER BY created_date DESC, alert_count DESC
            """
            try:
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=100000)
                resp = resp.get('data', [])
            except Exception as e:
                return {"status": False, "message": f"Query execution failed: {str(e)}", "data": {}}

            if not resp:
                return {"status": False, "message": "Data Not found", "data": {}}

            # Convert response to Polars DataFrame
            resp_df = pl.DataFrame(resp)
            if resp_df.is_empty():
                return {"status": True, "data": {}}

            resp_df = resp_df.with_columns(pl.col("created_date").cast(pl.Date))
            resp_df = resp_df.filter(pl.col("interlock_name").is_in(list(normal_interlocks.keys())))

            # Filter for interlocks where equipment_name is "Loading Point" AND alert_category is "Gantry"
            # filtered_interlocks = [
            #     interlock_name for interlock_name, details in normal_interlocks.items()
            #     if (details.get("equipment_name") in ["Loading Point", "BCU"] and 
            #         details.get("alert_category") in ["Gantry", "Process"])
            # ]

            required_bcu_interlocks = {
                "SickTT Reported",
                "BCU K- Factor Change",
                "BCU Local Loading",
                "Unauthorized flow_BCU",
                "TT Overloaded",
                "MFM K Factor Change",
            }

            # Filter interlocks for BCU and Loading Point
            filtered_interlocks = [
                interlock_name for interlock_name, details in normal_interlocks.items()
                if (
                    (details.get("equipment_name") == "BCU" and interlock_name in required_bcu_interlocks and details.get("alert_category") in ["Gantry", "Process"]) or
                    (details.get("equipment_name") == "Loading Point" and details.get("alert_category") in ["Gantry", "Process"])
                )
            ]

            # Filter to keep only the interlocks that match both criteria
            resp_df = resp_df.filter(pl.col("interlock_name").is_in(filtered_interlocks))

            # Add the alert_category and alert_type columns
            resp_df = resp_df.with_columns([
                pl.col("interlock_name").map_elements(
                    lambda name: normal_interlocks.get(name)["alert_category"]
                ).alias("alert_category"),
                pl.lit("Normal").alias("alert_type")
            ])
            resp_df = resp_df.filter(pl.col("alert_category").is_not_null())
            # Extract the middle part of device_name
            # def extract_middle_part(device_name):
            #     if isinstance(device_name, str) and '_' in device_name and '-' in device_name:
            #         try:
            #             # Split by _ and get the second part
            #             second_part = device_name.split('_')[1]
            #             # Get the first two parts of the split by -
            #             parts = second_part.split('-')
            #             if len(parts) >= 2:
            #                 return f"{parts[0]}-{parts[1]}"
            #         except:
            #             pass
            #     return ""

            # # Apply the function using map_elements
            # resp_df = resp_df.with_columns([
            #     pl.col("device_name").map_elements(lambda x: extract_middle_part(x)).alias("device_name")
            # ])
            def extract_or_use_device_name(device_name):
                """
                Handle device name extraction with fallback to original name
                
                Args:
                    device_name (str): Original device name
                
                Returns:
                    str: Extracted middle part or original device name
                """
                # If not a string or doesn't meet extraction criteria, return as is
                if not isinstance(device_name, str) or '_' not in device_name or '-' not in device_name:
                    return device_name
                
                try:
                    # Split by _ and get the second part
                    second_part = device_name.split('_')[1]
                    
                    # Get the first two parts of the split by -
                    parts = second_part.split('-')
                    
                    # Return extracted part if at least two parts exist
                    if len(parts) >= 2:
                        return f"{parts[0]}-{parts[1]}"
                except Exception:
                    pass
                
                # Fallback to original device name if extraction fails
                return device_name

            # Apply the function with a more robust approach
            resp_df = resp_df.with_columns([
                pl.col("device_name").map_elements(extract_or_use_device_name).alias("device_name")
            ])
            resp_df.write_csv("/tmp/normal_alerts_data.csv")

            # Apply date filtering at DataFrame level if not already applied in SQL
            if date and not date_filter_applied:
                # If 'date' is true but no date filter applied, filter last 30 days
                last_30_days = datetime.now() - timedelta(days=30)
                resp_df = resp_df.filter(pl.col("created_date") >= last_30_days.date())

            if bcu_number:
                resp_df = resp_df.filter(pl.col("device_name") == bcu_number)
            # Handle daily data
            if date:
                # Determine grouping level based on filters
                if zone_filter or plant_filter:
                    # Group by zone/plant level if those filters are present
                    group_cols = ["sap_id", "zone", "location_name", "interlock_name", "created_date", "alert_category", "alert_type", "device_name"]

                    grouped = resp_df.group_by(group_cols).agg(
                        pl.sum("alert_count").alias("total")
                    )
                else:
                    # Group by interlock level (default) without sap_id and location_name
                    grouped = resp_df.group_by(["sap_id", "zone", "location_name", "interlock_name", "created_date", "alert_category", "alert_type", "device_name"]).agg(
                        pl.sum("alert_count").alias("total")
                    )

                result = {}
                total_alert_count = grouped.select(pl.sum("total")).item()
                for row in grouped.iter_rows(named=True):
                    category = row["alert_category"].lower()

                    result.setdefault(category, {}).setdefault(str(row["created_date"]), {}).setdefault(row["alert_type"], {
                        "details": [],
                        "total": 0
                    })

                    detail_item = {}

                    if zone_filter or plant_filter:
                        # For zone or plant filters, include sap_id and other details
                        if "zone" in row:
                            detail_item["zone"] = row["zone"]

                        if "location_name" in row:
                            detail_item["location_name"] = row["location_name"]

                        if "sap_id" in row:
                            detail_item["sap_id"] = row["sap_id"]

                        if "interlock_name" in row:
                            detail_item["interlock_name"] = row["interlock_name"]

                        if "device_name" in row:
                            detail_item["bcu_number"] = row["device_name"]
                    else:
                        if "sap_id" in row:
                            detail_item["sap_id"] = row["sap_id"]

                        if "zone" in row:
                            detail_item["zone"] = row["zone"]

                        if "location_name" in row:
                            detail_item["location_name"] = row["location_name"]

                        if "device_name" in row:
                            detail_item["bcu_number"] = row["device_name"]
                        # For interlock level, only include the interlock name
                        detail_item["interlock_name"] = row["interlock_name"]
                                                
                    detail_item["count"] = row["total"]
                    result[category][str(row["created_date"])][row["alert_type"]]["details"].append(detail_item)
                    # Update total count for this category, date, and alert_type
                    result[category][str(row["created_date"])][row["alert_type"]]["total"] += row["total"]
                print({"daily_data": result})
                return {"status": True, "message": "success", "daily_data": result}

            else:
                # Monthly aggregation
                resp_df = resp_df.with_columns( pl.col("created_date").dt.strftime("%b-%Y").alias("month_year") ).sort("created_date")
                resp_df = resp_df.with_columns(pl.col("created_date").dt.strftime("%b-%Y").alias("month_year"))

                # Determine grouping level based on filters
                if zone_filter or plant_filter:
                    # Group by zone/plant level if those filters are present
                    group_cols = ["sap_id", "zone", "location_name", "interlock_name", "month_year", "alert_category", "alert_type", "device_name"]

                    grouped = resp_df.group_by(group_cols).agg(
                        pl.sum("alert_count").alias("total")
                    )
                else:
                    # Group by interlock level (default) without sap_id and location_name
                    grouped = resp_df.group_by(["sap_id", "zone", "location_name", "interlock_name", "month_year", "alert_category", "alert_type", "device_name"]).agg(
                        pl.sum("alert_count").alias("total")
                    )

                result = {}
                total_alert_count = grouped.select(pl.sum("total")).item()
                for row in grouped.iter_rows(named=True):
                    category = row["alert_category"].lower()

                    result.setdefault(category, {}).setdefault(row["month_year"], {}).setdefault(row["alert_type"], {
                        "details": [],
                        "total": 0
                    })


                    detail_item = {}

                    if zone_filter or plant_filter:
                        # For zone or plant filters, include sap_id and other details
                        if "zone" in row:
                            detail_item["zone"] = row["zone"]

                        if "location_name" in row:
                            detail_item["location_name"] = row["location_name"]

                        if "sap_id" in row:
                            detail_item["sap_id"] = row["sap_id"]

                        if "sop_id" in row:
                            detail_item["sop_id"] = row["sop_id"]

                        if "interlock_name" in row:
                            detail_item["interlock_name"] = row["interlock_name"]

                        if "device_name" in row:
                            detail_item["bcu_number"] = row["device_name"]
                    else:
                        if "sap_id" in row:
                            detail_item["sap_id"] = row["sap_id"]

                        if "zone" in row:
                            detail_item["zone"] = row["zone"]

                        if "location_name" in row:
                            detail_item["location_name"] = row["location_name"]

                        if "device_name" in row:
                            detail_item["bcu_number"] = row["device_name"]
                        # For interlock level, only include the interlock name
                        detail_item["interlock_name"] = row["interlock_name"]

                    detail_item["count"] = row["total"]
                    result[category][row["month_year"]][row["alert_type"]]["details"].append(detail_item)
                    # Update total count for this category, date, and alert_type
                    result[category][row["month_year"]][row["alert_type"]]["total"] += row["total"]
                return {"status": True, "message": "success", "monthly_data": result}

        except Exception as e:
            print(traceback.format_exc())
            print(e)

    
    @staticmethod
    async def tas_maintenance_fault(filters, cross_filters, drill_state):
        """
        Asynchronously retrieves and processes alert data for TAS maintenance and fault interlocks based on provided filters.

        This function constructs and executes a SQL query to fetch alert data from a database. It filters the data
        based on zone, plant, and date filters specified in the input parameters. The results are then processed
        to aggregate either daily or monthly data, which is returned as a structured dictionary.

        Parameters:
        - filters (list): A list of filters to apply, typically including zone and plant filters.
        - cross_filters (list): A list of additional filters, primarily used for date filtering.
        - drill_state (dict): A dictionary indicating the state of the data drill-down, specifically if date-based
        data aggregation is required.

        Returns:
        - dict: A dictionary with the status of the operation, a message, and the aggregated alert data structured
        as either daily or monthly data, depending on the drill_state.

        Raises:
        - Exception: If there is an error during query execution or data processing, an exception is caught and
        returned within the result dictionary.
        
        Asynchronously retrieves and processes alert data for TAS maintenance and fault interlocks based on provided filters.
        Merged function: previousl+ tas_alert_summary_v2. #tas_maintenance_fault
        Runs a single DB query, computes daily_data, monthly_data, alert_summary,
        and the v2 date-based detail output — all from the same DataFrame.
        """
        try:
            # Interlock mapping (keeping existing code)
            maintenance_interlocks = {
                item["interlock_name"]: {
                    "alert_category": item["alert_category"],
                    "equipment_name": item.get("equipment_name", item["interlock_name"]),
                    "sop_id": item.get("sop_id", None)
                } for item in category_mapping.Maintenance
            }

            fault_interlocks = {
                item["interlock_name"]: {
                    "alert_category": item["alert_category"],
                    "equipment_name": item.get("equipment_name", item["interlock_name"]),
                    "sop_id": item.get("sop_id", None)
                } for item in category_mapping.Fault
            }

            sop_ids = (
                {item.get("sop_id") for item in maintenance_interlocks.values()} |
                {item.get("sop_id") for item in fault_interlocks.values()}
            )

            # Build filters (keeping existing code)
            zone_filter = plant_filter = sensor_id_filter = equipment_name_filter = ''
            if filters:
                for f in filters:
                    if "zone" in f.key:
                        zone_filter = f.value
                    if "sap_id" in f.key:
                        plant_filter = f.value
                    if "sensor_id" in f.key:
                        sensor_id_filter = f.value
                    if "equipment_name" in f.key:
                        equipment_name_filter = f.value

            # Get current date in IST
            current_date = datetime.now().date()

            if not cross_filters or not any(getattr(cf, "value", None) for cf in cross_filters):
                selected_start_date = current_date - timedelta(days=30)
                start_date = selected_start_date.strftime('%Y-%m-%d 00:00:00')
                end = current_date.strftime('%Y-%m-%d')
                end_date = f'{end} 23:59:59'
            else:
                for date_range in cross_filters:
                    value = date_range.value if hasattr(date_range, 'value') else None
                
                start_date = value.split(',')[0]
                end = value.split(',')[1]
                end_date = f'{end} 23:59:59'
                selected_start_date = datetime.strptime(start_date.split()[0], '%Y-%m-%d').date()

            end_date_parsed = datetime.strptime(end.split()[0], '%Y-%m-%d').date()

            date_condition = ""
            if cross_filters and any(getattr(cf, 'value', None) for cf in cross_filters):
                date_condition = f"""
                AND (created_at <= '{end_date}' AND (closed_at IS NULL OR closed_at >= '{start_date}'))
                """
            
            # SINGLE DB QUERY
            
            sop_ids_str = ", ".join(f"'{s}'" for s in sop_ids if s)
            sop_id_clause = f"AND sop_id IN ({sop_ids_str})" if sop_ids_str else ''

            # Simplified SQL Query for day-wise alert counts
            query = f"""
                SELECT 
                    DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS created_date,
                    DATE(closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS closed_date,
                    sap_id,
                    zone,id,
                    location_name,
                    interlock_name,
                    alert_category,
                    sensor_id,
                    equipment_name,
                    device_name,
                    alert_status,
                    created_at,
                    unique_id,alert_section,severity
                    closed_at,
                    updated_at,
                    maintenance_time,
                    alert_history
                FROM alerts
                WHERE bu = 'TAS' AND alert_section = 'TAS'
                {sop_id_clause}
                {f"AND zone IN ('{zone_filter}')" if zone_filter else ''}
                {f"AND sap_id IN ('{plant_filter}')" if plant_filter else ''}
                {f"AND sensor_id IN ('{sensor_id_filter}')" if sensor_id_filter else ''}
                {f"AND equipment_name ILIKE ('%{equipment_name_filter}%')" if equipment_name_filter else ''}
                {date_condition}
                ORDER BY created_at ASC
            """
            print("query:", query)

            # Execute query
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=100000)
            data = resp.get("data", [])
            if not data:
                return {"status": False, "message": "Data Not found", "data": {}}

            df = pl.DataFrame(data, infer_schema_length=100000)

            df = df.with_columns([
                pl.col("created_at").cast(pl.Datetime, strict=False),
                pl.col("closed_at").cast(pl.Datetime,  strict=False),
                pl.col("updated_at").cast(pl.Datetime, strict=False),
            ])

            # Map alert_category and equipment name from interlock mappings
            df = df.with_columns([
                pl.col("interlock_name").map_elements(
                    lambda name: (
                        maintenance_interlocks.get(name) or fault_interlocks.get(name) or {}
                    ).get("alert_category"),
                    return_dtype=pl.Utf8
                ).alias("alert_category"),
                pl.lit("Equipment").alias("alert_type"),
                pl.col("interlock_name").map_elements(
                    lambda name: (
                        "Tank" if name == "Tank_Under Maintenance"
                        else (
                            maintenance_interlocks.get(name) or fault_interlocks.get(name) or {}
                        ).get("equipment_name", name)
                    ),
                    return_dtype=pl.Utf8
                ).alias("mapped_equipment_name"),
                pl.col("created_date").cast(pl.Date),
                pl.col("closed_date").cast(pl.Date),
                pl.col("created_date").dt.strftime("%b-%Y").alias("month_year")
            ])

            # Filter out rows without alert_category
            df = df.filter(pl.col("alert_category").is_not_null())
            df = df.sort("created_at", descending=True).unique(
                subset=["device_name"], 
                keep="first"
            )
            print(f"AFTER DEDUP: {len(df)} rows, {df['device_name'].n_unique()} unique devices")


            # Apply additional filtering if equipment_name or sensor_id filters are provided
            if equipment_name_filter or sensor_id_filter:
                conditions = []
                if equipment_name_filter:
                    conditions.append(pl.col("equipment_name").str.contains(equipment_name_filter, literal=False))
                if sensor_id_filter:
                    conditions.append(pl.col("sensor_id") == sensor_id_filter)
                combined = conditions[0]
                for c in conditions[1:]:
                    combined = combined & c
                df = df.filter(combined)

            # Initialize results
            result_daily = {}

            # DAILY PROCESSING - Fixed logic
            # Get all unique dates from created_date and closed_date
            all_dates = set()
            
            # Add created dates
            # Add created dates within selected range
            created_dates = df.select(pl.col("created_date")).filter(
                pl.col("created_date").is_not_null() & (pl.col("created_date") >= selected_start_date)
            ).to_series().to_list()
            all_dates.update(created_dates)

            closed_dates = df.select(pl.col("closed_date")).filter(
                (pl.col("closed_date").is_not_null()) &
                (pl.col("closed_date") >= selected_start_date) &
                (pl.col("closed_date") <= end_date_parsed)
            ).to_series().to_list()
            all_dates.update(closed_dates)

            date_cursor = selected_start_date
            while date_cursor <= end_date_parsed:
                all_dates.add(date_cursor)
                date_cursor += timedelta(days=1)

            for date in sorted(all_dates):
                date_key = str(date)

                closed_today = df.filter(pl.col("closed_date") == date)
                open_alerts_on_date = df.filter(
                    (pl.col("created_date") <= date) &
                    (pl.col("closed_date").is_null() | (pl.col("closed_date") > date))
                )
                carry_forward_alerts = open_alerts_on_date.filter(pl.col("created_date") < date)
                current_day_alerts = open_alerts_on_date.filter(pl.col("created_date") == date)

                # Process closed alerts
                if len(closed_today) > 0:
                    closed_grouped = closed_today.group_by(["alert_category", "alert_type"]).agg([
                        pl.col("device_name").n_unique().alias("unique_device_count"),
                        pl.col("device_name").unique().alias("unique_device_names")
                    ])
                    
                    for row in closed_grouped.iter_rows(named=True):
                        cat = row["alert_category"].lower()
                        alert_type = row["alert_type"]
                        details = []
                        for device_name in row["unique_device_names"]:
                            device_row = (
                                closed_today.filter(pl.col("device_name") == device_name)
                                .sort("created_at", descending=True).row(0, named=True)
                            )
                            details.append({
                                "sap_id": device_row["sap_id"], "zone": device_row["zone"],
                                "location_name": device_row["location_name"],
                                "equipment_name": device_row["equipment_name"],
                                "device_name": device_name, "sensor_id": device_row["sensor_id"],
                                "open_alerts_current_carry_count": 0,
                                "open_alerts_current_day": 0,
                                "close_alerts_current_day": 1,
                                "count": 1, "type": "closed"
                            })

                        result_daily.setdefault(cat, {}).setdefault(date_key, {}).setdefault(alert_type, {
                            "open_alerts_current_carry_count": 0,
                            "open_alerts_current_day": 0,
                            "close_alerts_current_day": 0,
                            "details": []
                        })
                        result_daily[cat][date_key][alert_type]["close_alerts_current_day"] = row["unique_device_count"]
                        result_daily[cat][date_key][alert_type]["details"].extend(details)

                # Process open alerts (carry forward + current day) - Always process even if no activity
                # This ensures we show open alerts for last 7 days even with no new activity
                open_grouped = open_alerts_on_date.group_by(["alert_category", "alert_type"]).agg([
                    pl.col("device_name").n_unique().alias("unique_device_count"),
                    pl.col("device_name").unique().alias("unique_device_names")
                ]) if len(open_alerts_on_date) > 0 else pl.DataFrame()
                
                # If there are open alerts or we need to show last 7 days data
                if len(open_alerts_on_date) > 0 or (current_date - date).days < 7:
                    
                    if len(open_grouped) > 0:
                        for row in open_grouped.iter_rows(named=True):
                            cat = row["alert_category"].lower()
                            alert_type = row["alert_type"]

                            cf_alerts  = carry_forward_alerts.filter(pl.col("alert_category") == row["alert_category"])
                            cd_alerts  = current_day_alerts.filter(pl.col("alert_category") == row["alert_category"])
                            carry_count       = len(cf_alerts.select(pl.col("device_name")).unique()) if len(cf_alerts) > 0 else 0
                            current_day_count = len(cd_alerts.select(pl.col("device_name")).unique()) if len(cd_alerts) > 0 else 0

                            details = []
                            for device_name in row["unique_device_names"]:
                                device_row     = open_alerts_on_date.filter(pl.col("device_name") == device_name).row(0, named=True)
                                is_carry       = device_row["created_date"] < date
                                details.append({
                                    "sap_id": device_row["sap_id"], "zone": device_row["zone"],
                                    "location_name": device_row["location_name"],
                                    "equipment_name": device_row["equipment_name"],
                                    "device_name": device_name, "sensor_id": device_row["sensor_id"],
                                    "open_alerts_current_carry_count": 1 if is_carry else 0,
                                    "open_alerts_current_day": 0 if is_carry else 1,
                                    "close_alerts_current_day": 0,
                                    "count": 1,
                                    "type": "carry_forward" if is_carry else "open"
                                })

                            result_daily.setdefault(cat, {}).setdefault(date_key, {}).setdefault(alert_type, {
                                "open_alerts_current_carry_count": 0,
                                "open_alerts_current_day": 0,
                                "close_alerts_current_day": 0,
                                "details": []
                            })
                            result_daily[cat][date_key][alert_type]["open_alerts_current_carry_count"] = carry_count
                            result_daily[cat][date_key][alert_type]["open_alerts_current_day"]         = current_day_count
                            existing = {d["device_name"] for d in result_daily[cat][date_key][alert_type]["details"]}
                            for detail in details:
                                if detail["device_name"] not in existing:
                                    result_daily[cat][date_key][alert_type]["details"].append(detail)

            
            #  MONTHLY PROCESSING           
            result_monthly = {}
            def parse_month(m): return datetime.strptime(m, "%b-%Y")

            earliest_created  = df["created_date"].min()
            all_months = []
            month_cursor = earliest_created.replace(day=1)
            current_month_start = current_date.replace(day=1)

            while month_cursor <= current_month_start:
                all_months.append(month_cursor.strftime("%b-%Y"))
                month_cursor = (
                    month_cursor.replace(year=month_cursor.year + 1, month=1)
                    if month_cursor.month == 12
                    else month_cursor.replace(month=month_cursor.month + 1)
                )

            categories = (
                df.select(pl.col("alert_category")).unique()
                .filter(pl.col("alert_category").is_not_null())
                .to_series().to_list()
            )

            for month in all_months:
                month_date = parse_month(month)
                month_start = month_date.replace(day=1).date()
                month_end   = (
                    month_date.replace(year=month_date.year + 1, month=1, day=1).date() - timedelta(days=1)
                    if month_date.month == 12
                    else month_date.replace(month=month_date.month + 1, day=1).date() - timedelta(days=1)
                )

                for category in categories:
                    cat = category.lower()
                    alert_type = "Equipment"
                    cat_df     = df.filter(pl.col("alert_category") == category)
                    if len(cat_df) == 0:
                        continue

                    created_open = cat_df.filter(
                        (pl.col("created_date") >= month_start) & (pl.col("created_date") <= month_end) &
                        (pl.col("closed_date").is_null() | (pl.col("closed_date") > month_end))
                    )
                    closed_month = cat_df.filter(
                        pl.col("closed_date").is_not_null() & (pl.col("alert_status") != "Open") &
                        (pl.col("closed_date") >= month_start) & (pl.col("closed_date") <= month_end)
                    )
                    carry_fwd = cat_df.filter(
                        (pl.col("created_date") < month_start) &
                        (pl.col("closed_date").is_null() | (pl.col("closed_date") > month_end))
                    )

                    created_and_open_devices = set(created_open.select("device_name").unique().to_series().to_list()) if len(created_open) > 0 else set()
                    closed_devices           = set(closed_month.select("device_name").unique().to_series().to_list()) if len(closed_month) > 0 else set()
                    carry_devices            = set(carry_fwd.select("device_name").unique().to_series().to_list())    if len(carry_fwd)    > 0 else set()
                    all_devices              = created_and_open_devices | closed_devices | carry_devices

                    if not all_devices:
                        continue
                    details = []
                    for device_name in all_devices:
                        device_row       = cat_df.filter(pl.col("device_name") == device_name).sort("created_at", descending=True).row(0, named=True)
                        carry_flag       = 1 if device_name in carry_devices            else 0
                        current_flag     = 1 if device_name in created_and_open_devices else 0
                        closed_flag      = 1 if device_name in closed_devices           else 0
                        alert_flag       = "carry_forward" if carry_flag else ("closed" if closed_flag else "open")

                        details.append({
                            "sap_id": device_row["sap_id"], "zone": device_row["zone"],
                            "location_name": device_row["location_name"],
                            "equipment_name": device_row["equipment_name"],
                            "device_name": device_name, "sensor_id": device_row["sensor_id"],
                            "open_alerts_current_carry_count": carry_flag,
                            "open_alerts_current_day": current_flag,
                            "close_alerts_current_day": closed_flag,
                            "count": 1, "type": alert_flag
                        })

                    result_monthly.setdefault(cat, {}).setdefault(month, {})[alert_type] = {
                        "open_alerts_current_carry_count": len(carry_devices),
                        "open_alerts_current_day":         len(created_and_open_devices),
                        "close_alerts_current_day":        len(closed_devices),
                        "details": details
                    }

            # Sort daily / monthly
            for cat in result_daily:
                result_daily[cat] = OrderedDict(
                    sorted(result_daily[cat].items(), key=lambda x: datetime.strptime(x[0], "%Y-%m-%d"))
                )
            for cat in result_monthly:
                result_monthly[cat] = OrderedDict(
                    sorted(result_monthly[cat].items(), key=lambda x: datetime.strptime(x[0], "%b-%Y"))
                )

            # ALERT SUMMARY
            
            alert_summary = {}
            for row in df.iter_rows(named=True):
                created_date = row["created_date"]
                closed_date  = row["closed_date"]
                category     = row["alert_category"].lower()
                alert_type   = "Equipment"

                if "date" in drill_state:
                    date_key = str(created_date) if created_date else str(end_date_parsed)
                else:
                    date_key = (
                        closed_date.strftime("%b-%Y") if closed_date
                        else (created_date.strftime("%b-%Y") if created_date else None)
                    )

                if not date_key:
                    continue

                alert_summary.setdefault(category, {}).setdefault(date_key, {}).setdefault(alert_type, {
                    "open_alerts_current_carry_count": 0,
                    "open_alerts_current_day": 0,
                    "close_alerts_current_day": 0,
                    "details": []
                })

                is_closed = closed_date is not None

                if not is_closed:
                    carry_days    = (end_date_parsed - created_date).days if created_date else 0
                    is_carry      = created_date < end_date_parsed
                    is_today      = created_date == end_date_parsed
                    detail = {
                        "sap_id": row["sap_id"], "zone": row["zone"],
                        "location_name": row["location_name"], "equipment_name": row["equipment_name"],
                        "device_name": row["device_name"],     "sensor_id": row["sensor_id"],
                        "created_date": str(created_date),     "till_date": str(end_date_parsed),
                        "carry_forward_days": carry_days,
                        "open_alerts_current_carry_count": 1 if is_carry  else 0,
                        "open_alerts_current_day":         1 if is_today  else 0,
                        "close_alerts_current_day": 0,
                        "count": 1, "type": "carry_forward" if is_carry else "open"
                    }
                    if is_carry:  alert_summary[category][date_key][alert_type]["open_alerts_current_carry_count"] += 1
                    if is_today:  alert_summary[category][date_key][alert_type]["open_alerts_current_day"]         += 1
                else:
                    days_to_close = (closed_date - created_date).days if created_date and closed_date else 0
                    detail = {
                        "sap_id": row["sap_id"], "zone": row["zone"],
                        "location_name": row["location_name"], "equipment_name": row["equipment_name"],
                        "device_name": row["device_name"],     "sensor_id": row["sensor_id"],
                        "created_date": str(created_date),     "closed_date": str(closed_date),
                        "days_to_close": days_to_close,
                        "open_alerts_current_carry_count": 0,
                        "open_alerts_current_day": 0,
                        "close_alerts_current_day": 1,
                        "count": 1, "type": "closed"
                    }
                    alert_summary[category][date_key][alert_type]["close_alerts_current_day"] += 1

                alert_summary[category][date_key][alert_type]["details"].append(detail)

            
            #  V2 SUMMARY
            # Build device → dates + type mapping from result_daily (already computed above)
            device_to_dates     = {}
            device_to_date_type = defaultdict(dict)

            for category, dates_dict in result_daily.items():
                for date_str, equip_dict in dates_dict.items():
                    for equip_type, d in equip_dict.items():
                        for detail in d.get("details", []):
                            dev = detail.get("device_name")
                            if dev:
                                device_to_dates.setdefault(dev, set()).add(date_str)
                                if detail.get("type"):
                                    device_to_date_type[dev][date_str] = detail["type"]

            device_to_dates = {dev: sorted(list(dates)) for dev, dates in device_to_dates.items()}

            alert_summary_v2 = {}

            for row in df.iter_rows(named=True):
                created_date     = row["created_date"]
                closed_date      = row["closed_date"]
                category         = row["alert_category"]
                alert_type       = "Equipment"
                maintenance_time = row.get("maintenance_time")
                processed_time   = GlobalAnalytics.get_latest_processed_time(row.get("alert_history"))
                action_type_logic = GlobalAnalytics.get_action_type_logic(row.get("alert_history"))

                maintenance_days = 0
                if maintenance_time and processed_time:
                    try:
                        mt = datetime.fromisoformat(maintenance_time) if isinstance(maintenance_time, str) else maintenance_time
                        if mt.tzinfo is None:           mt            = mt.replace(tzinfo=timezone.utc)
                        if processed_time.tzinfo is None: processed_time = processed_time.replace(tzinfo=timezone.utc)
                        maintenance_days = (mt - processed_time).days
                    except Exception as e:
                        print("maintenance_days error:", e)

                if "date" in drill_state:
                    date_key = str(created_date)
                else:
                    date_key = (
                        closed_date.strftime("%b-%Y") if closed_date
                        else (created_date.strftime("%b-%Y") if created_date else None)
                    )

                if not date_key:
                    continue

                is_closed        = closed_date is not None and row["alert_status"] != "Open"
                filter_by_dates  = device_to_dates.get(row["device_name"], [])

                alert_summary_v2.setdefault(category, {}).setdefault(date_key, {}).setdefault(alert_type, {
                    "open_alerts_current_carry_count": 0,
                    "open_alerts_current_day": 0,
                    "close_alerts_current_day": 0,
                    "details": []
                })

                if not is_closed:
                    is_carry   = created_date < end_date_parsed
                    is_today   = created_date == end_date_parsed
                    carry_days = (end_date_parsed - created_date).days if created_date else 0
                    detail = {
                        "sap_id": row["sap_id"],             "zone": row["zone"],
                        "alert_category": row["alert_category"],
                        "location_name": row["location_name"], "equipment_name": row["equipment_name"],
                        "device_name": row["device_name"],     "sensor_id": row["sensor_id"],
                        "interlock_name": row["interlock_name"],
                        "created_at": str(row["created_at"]),  "updated_at": str(row.get("updated_at")),
                        "created_date": str(created_date),     "till_date": str(end_date_parsed),
                        "carry_forward_days": carry_days,
                        "open_alerts_current_carry_count": 1 if is_carry else 0,
                        "open_alerts_current_day":         1 if is_today else 0,
                        "close_alerts_current_day": 0,
                        "alert_history": row.get("alert_history"),
                        "id": row.get("id"),
                        "unique_id": row.get("unique_id"),
                        "alert_section": row.get("alert_section"),
                        "severity": row.get("severity"),
                        "maintenance_time": str(maintenance_time) if maintenance_time else None,
                        "processed_time":   str(processed_time)   if processed_time   else None,
                        "maintenance_days": maintenance_days,
                        "action_type": action_type_logic,
                        "filter_by": filter_by_dates,
                        "count": 1, "type": "carry_forward" if is_carry else "open"
                    }
                    if is_carry: alert_summary_v2[category][date_key][alert_type]["open_alerts_current_carry_count"] += 1
                    if is_today: alert_summary_v2[category][date_key][alert_type]["open_alerts_current_day"]         += 1
                else:
                    days_to_close = (closed_date - created_date).days if created_date and closed_date else 0
                    detail = {
                        "sap_id": row["sap_id"],             "zone": row["zone"],
                        "alert_category": row["alert_category"],
                        "location_name": row["location_name"], "equipment_name": row["equipment_name"],
                        "device_name": row["device_name"],     "sensor_id": row["sensor_id"],
                        "interlock_name": row["interlock_name"],
                        "created_at": str(row["created_at"]),  "updated_at": str(row.get("updated_at")),
                        "closed_at": str(row["closed_at"]),
                        "created_date": str(created_date),     "closed_date": str(closed_date),
                        "days_to_close": days_to_close,
                        "maintenance_time": str(maintenance_time) if maintenance_time else None,
                        "processed_time":   str(processed_time)   if processed_time   else None,
                        "maintenance_days": maintenance_days,
                        "action_type": action_type_logic,
                        "id": row.get("id"),
                        "filter_by": filter_by_dates,
                        "unique_id": row.get("unique_id"),
                        "alert_section": row.get("alert_section"),
                        "severity": row.get("severity"),
                        "alert_history": row.get("alert_history"),
                        "open_alerts_current_carry_count": 0,
                        "open_alerts_current_day": 0,
                        "close_alerts_current_day": 1,
                        "count": 1, "type": "closed"
                    }
                    alert_summary_v2[category][date_key][alert_type]["close_alerts_current_day"] += 1

                alert_summary_v2[category][date_key][alert_type]["details"].append(detail)

            # Transform v2: group details by filter_by dates
            date_based = defaultdict(lambda: defaultdict(list))
            for category, dates_dict in alert_summary_v2.items():
                for date_key, equip_dict in dates_dict.items():
                    for alert_type, d in equip_dict.items():
                        for detail in d.get("details", []):
                            device          = detail.get("device_name")
                            filter_by_dates = detail.get("filter_by", [])
                            for fd in filter_by_dates:
                                detail_copy         = detail.copy()
                                main_type_val       = device_to_date_type.get(device, {}).get(fd, "")
                                detail_copy["type2"] = detail_copy.pop("type", None)
                                detail_copy["type"]  = main_type_val
                                date_based[fd][category].append(detail_copy)            
                final_v2_data = {d: dict(date_based[d]) for d in sorted(date_based.keys())}
            
            return {
                "status": True,
                "message": "success",
                "daily_data": result_daily if "date" in drill_state else {},
                "monthly_data": result_monthly if "date" not in drill_state else {},
                "alert_summary": alert_summary,
                "data": {
                    "status": True,
                    "message": "success",
                    "data": final_v2_data
                }
            }

        except Exception:
            print(traceback.format_exc())
            return {"status": False, "message": "Internal error occurred", "data": {}}

        finally:
            print("Execution completed")


    @staticmethod
    async def tas_maintenance_fault_dropdown(filters, cross_filters, drill_state):
        """
        Asynchronously retrieves and filters data from the location master for TAS maintenance and fault dropdowns.

        This function constructs and executes a SQL query to fetch location data from a database. 
        It filters the data based on the provided filters and returns a list of unique zones 
        and plant names for use in dropdown menus.

        Parameters:
        - filters (list): A list of filters to apply, typically including zone and plant filters.
        - cross_filters (list): A list of additional filters, although not utilized in this function.
        - drill_state (dict): A dictionary indicating the state of the data drill-down, not used in this function.

        Returns:
        - dict: A dictionary containing the status, a success message, and the filtered data 
        including unique zones and plant names.

        Raises:
        - Exception: If there is an error during query execution, the function will raise an exception 
        which should be handled by the caller.
        """
        _query = ''' select * from location_master where bu = 'TAS' '''
        # resp = await function(query=_query)
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=_query, limit=0)
        resp = resp.get("data", [])
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
                    filter_expr = filter_expr & (pl.col(key).fill_null("") == value)
            df = df.filter(filter_expr)
        months = [month for month in calendar.month_name if month]
        data = {"zone": df["zone"].unique().to_list(), "plant": df["name"].unique().to_list()}
        return {"status": True, "message": "Success","data": data}
    
    @staticmethod
    async def tas_normal_count(filters, cross_filters, drill_state):
        """
        Asynchronously retrieves and processes alert data for TAS normal interlocks, based on provided filters.

        This function constructs and executes a SQL query to fetch alert data from a database. 
        It filters the data based on zone, plant, and date filters specified in the input parameters. 
        The results are then processed to either aggregate daily or monthly data, which is returned 
        as a structured dictionary.

        Parameters:
        - filters (list): A list of filters to apply, typically including zone and plant filters.
        - cross_filters (list): A list of additional filters, primarily used for date filtering.
        - drill_state (dict): A dictionary indicating the state of the data drill-down, 
        specifically if date-based data aggregation is required.

        Returns:
        - dict: A dictionary with the status of the operation, a message, and the aggregated alert data 
        structured as either daily or monthly data, depending on the drill_state.

        Raises:
        - Exception: If there is an error during query execution or data processing, an exception is caught 
        and returned within the result dictionary.
        """
        try:
            # Initialize date flag
            date = False
            if "date" in drill_state:
                date = True
            print("date --> ", date)
            
            # Check if zone or plant filters are present
            zone_filter = ''
            plant_filter = ''
            status = ''
            if filters:
                for filter in filters:
                    if "zone" in filter.key:
                        zone_filter = filter.value
                    if "sap_id" in filter.key:
                        plant_filter = filter.value
                    if "status" in filter.key:
                        status = filter.value
            # Initialize date filter variables
            date_filter_applied = False
            start_date = None
            end_date = None
            
            # Process cross filters for date
            if cross_filters:
                for filter in cross_filters:
                    if "DATE" in filter.key:
                        date_parts = filter.value.split(',')
                        start_date = datetime.strptime(date_parts[0].strip("'"), '%Y-%m-%d')
                        end_date = datetime.strptime(date_parts[-1].strip("'"), '%Y-%m-%d')
                        date_filter_applied = True

            equipment_categories = [
                "VFT",
                "Radar",
                "Esd",
                "Hcd",
                "Dyke",
                "Plc",
                "Tank Leakage",
                "Ups",
                "Primary Level",
                "Lrc Switchover",
                "Gantry Override",
                "K Factor Main"
            ]

            # Modified to store equipment_name alongside alert_category
            normal_interlocks = {item["interlock_name"]: {"alert_category": item["alert_category"], "equipment_name": item.get("equipment_name", item["interlock_name"])} for item in category_mapping.Normal}

            # Map interlock names to equipment categories based on your list
            category_to_interlocks = {
                "VFT": ["HHH alarm from VFT", "Proof Test_VFT_Sucess"],
                "Radar": ["HHH alarm from Secondary Radar guage", "Proof Test_Secondary Radar Guage_Success"],
                "Esd": ["Plant ESD activated"],
                "Hcd": ["HCD_20% LEL activated", "HCD_40% LEL activated"],
                "Dyke": ["Dykevalve_Activated"],
                "Plc": ["SafetyPLC_Communication fail", "ProcessPLC_Communication fail"],
                "Tank Leakage": ["Tank level change during dormant mode"],
                "Ups": ["UPS_Fail"],
                "Primary Level": ["Primary Radar Guage_H alarm", "Primary Radar Guage_HH alarm"],
                "Lrc Switchover": ["LRC Master Switchover required in 30 days"],
                "Gantry Override": ["Gantry Permissive_Override"],
                "K Factor Main": ["K Factor Change_BCU"]
            }

            # Create a flat list of all specified interlock names
            all_specific_interlocks = [item for sublist in category_to_interlocks.values() for item in sublist]

            # Construct base SQL Query
            query = f"""SELECT DATE(created_at) AS created_date,
                    sap_id,
                    zone,
                    interlock_name,
                    location_name,
                    closed_at,
                    COUNT(*) AS alert_count
                FROM alerts
                WHERE bu = 'TAS' AND alert_section = 'TAS'
            """

            # Add zone filter if present
            if zone_filter:
                query += f" AND zone IN ('{zone_filter}')"

            # Add plant/location filter if present
            if plant_filter:
                query += f" AND sap_id IN ('{plant_filter}')"

            # Add status filter if present
            if status:
                query += f" AND alert_status IN ('{status}')"
            # Add date filter directly to SQL if applied
            if date_filter_applied and start_date and end_date:
                query += f" AND DATE(created_at) BETWEEN ('{start_date.strftime('%Y-%m-%d')}') AND ('{end_date.strftime('%Y-%m-%d')}')"

            # Add direct filter for specific interlock names in the SQL query for efficiency
            interlock_names_str = "', '".join(all_specific_interlocks)
            query += f" AND interlock_name IN ('{interlock_names_str}')"

            # Complete the query
            query += """
                GROUP BY created_date, zone, interlock_name, sap_id, location_name,closed_at
                ORDER BY created_date DESC, alert_count DESC
            """

            try:
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
                resp = resp.get('data', '')
            except Exception as e:
                return {"status": False, "message": f"Query execution failed: {str(e)}", "data": {}}

            if not resp:
                return {"status": False, "message": "Data Not found", "data": {}}

            # Convert response to Polars DataFrame
            resp_df = pl.DataFrame(resp)
            if resp_df.is_empty():
                return {"status": True, "data": {}}

            resp_df = resp_df.with_columns(pl.col("created_date").cast(pl.Date))

            # Add equipment category based on interlock name
            def get_equipment_category(interlock_name):
                for category, interlocks in category_to_interlocks.items():
                    if interlock_name in interlocks:
                        return category
                return None

            # Add categories and equipment_name
            resp_df = resp_df.with_columns([
                pl.col("interlock_name").map_elements(lambda name: normal_interlocks.get(name, {}).get("alert_category")).alias("alert_category"),
                pl.lit("Normal").alias("alert_type"),
                pl.col("interlock_name").map_elements(get_equipment_category).alias("equipment_name")
            ])

            # Only keep rows where we successfully assigned an equipment category
            resp_df = resp_df.filter(pl.col("equipment_name").is_not_null())
            resp_df.write_csv("/tmp/normal_alerts_data.csv")

            # Apply date filtering at DataFrame level if not already applied in SQL
            if date and not date_filter_applied:
                # If 'date' is true but no date filter applied, filter last 30 days
                last_30_days = datetime.now() - timedelta(days=30)
                resp_df = resp_df.filter(pl.col("created_date") >= last_30_days.date())
            
            # Handle daily data
            if date:
                # Determine grouping level based on filters
                if zone_filter or plant_filter:
                    # Group by zone/plant level if those filters are present
                    group_cols = ["sap_id", "zone", "location_name", "equipment_name", "created_date", "alert_category", "alert_type"]

                        
                    grouped = resp_df.group_by(group_cols).agg(
                        pl.sum("alert_count").alias("total")
                    )
                else:
                    # Group by equipment level (default)
                    grouped = resp_df.group_by(["sap_id", "zone", "location_name", "equipment_name", "created_date", "alert_category", "alert_type"]).agg(
                        pl.sum("alert_count").alias("total")
                    )

                # NEW RESPONSE FORMAT FOR DAILY DATA
                result = {}
                for row in grouped.iter_rows(named=True):
                    # Get the equipment name
                    equipment_name = row["equipment_name"] if row["equipment_name"] else "Unknown"
                    
                    # Initialize the equipment entry if it doesn't exist
                    if equipment_name not in result:
                        result[equipment_name] = []
                    
                    # Create a detail item with all the relevant fields
                    detail_item = {
                        "date": str(row["created_date"]),
                        "alert_category": row["alert_category"],
                        "alert_type": row["alert_type"],
                        "count": row["total"]
                    }
                    
                    # Add optional fields if they exist in the row
                    if "zone" in row:
                        detail_item["zone"] = row["zone"]
                    if "location_name" in row:
                        detail_item["location_name"] = row["location_name"]
                    if "sap_id" in row:
                        detail_item["sap_id"] = row["sap_id"]
                    
                    # Add the detail item to the equipment's array
                    result[equipment_name].append(detail_item)

                return {"status": True, "message": "success", "daily_data": result}

            else:
                # Monthly aggregation
                resp_df = resp_df.with_columns(pl.col("created_date").dt.strftime("%b-%Y").alias("month_year"),pl.col("created_date").dt.strftime("%Y-%m").alias("sort_key"))
                
                # Determine grouping level based on filters
                if zone_filter or plant_filter:
                    # Group by zone/plant level if those filters are present
                    group_cols = ["sap_id", "zone", "location_name", "equipment_name", "month_year", "alert_category", "alert_type", "sort_key"]
                        
                    grouped = resp_df.group_by(group_cols).agg(
                        pl.sum("alert_count").alias("total")
                    )
                else:
                    # Group by equipment level (default)
                    grouped = resp_df.group_by(["sap_id", "zone", "location_name", "equipment_name", "month_year", "alert_category", "alert_type", "sort_key"]).agg(
                        pl.sum("alert_count").alias("total")
                    )

                grouped = grouped.sort("sort_key", descending=False)
                # NEW RESPONSE FORMAT FOR MONTHLY DATA
                result = {}
                for row in grouped.iter_rows(named=True):
                    # Get the equipment name
                    equipment_name = row["equipment_name"] if row["equipment_name"] else "Unknown"
                    
                    # Initialize the equipment entry if it doesn't exist
                    if equipment_name not in result:
                        result[equipment_name] = []
                    
                    # Create a detail item with all the relevant fields
                    detail_item = {
                        "month": row["month_year"],
                        "alert_category": row["alert_category"],
                        "alert_type": row["alert_type"],
                        "count": row["total"]
                    }
                    
                    # Add optional fields if they exist in the row
                    if "zone" in row:
                        detail_item["zone"] = row["zone"]
                    if "location_name" in row:
                        detail_item["location_name"] = row["location_name"]
                    if "sap_id" in row:
                        detail_item["sap_id"] = row["sap_id"]
                    
                    # Add the detail item to the equipment's array
                    result[equipment_name].append(detail_item)

                return {"status": True, "message": "success", "monthly_data": result}

        except Exception as e:
            print(traceback.format_exc())
            print(e)
            return {"status": False, "message": f"An error occurred: {str(e)}", "data": {}}

    @staticmethod
    async def tas_analog_count(filters, cross_filters, drill_state):        
        """
        Fetches TAS Analog alert count data.

        Args:
            filters (list): List of filters, each being a dictionary with keys "key" and "value".
            cross_filters (list): List of cross filters, each being a dictionary with keys "key" and "value".
            drill_state (dict): Dictionary containing the date filter state.

        Returns:
            dict: Dictionary containing the response status, message and data.
        """
        try:
            date = "date" in drill_state  # Check if date filtering is required
            print("date --> ", date)

            # Extract filters dynamically
            zone_filter, plant_filter, interlock_filter = '', '', ''
            for filter in (filters or []):
                if filter.key == "zone":
                    zone_filter = filter.value
                elif filter.key == "plant":
                    plant_filter = filter.value

            # Extract date and interlock filters
            date_filter_applied = False
            start_date, end_date = None, None
            for filter in (cross_filters or []):
                if filter.key == "DATE":
                    date_parts = filter.value.split(',')
                    start_date = datetime.strptime(date_parts[0].strip("'"), '%Y-%m-%d')
                    end_date = datetime.strptime(date_parts[-1].strip("'"), '%Y-%m-%d')
                    date_filter_applied = True
                elif filter.key == "interlock_name":
                    interlock_filter = filter.value  # Assuming single or multiple values comma-separated

            # Base Query
            query = """SELECT DATE(created_at) AS created_date, interlock_name, sap_id, sop_id, COUNT(*) AS alert_count"""

            # Conditionally include `zone` and `plant`
            if zone_filter:
                query += ", zone"
            if plant_filter:
                query += ", location_name AS plant"

            query += " FROM alerts WHERE bu = 'TAS' AND alert_section = 'TAS'"

            # Apply filters
            if zone_filter:
                query += f" AND zone IN ('{zone_filter}')"
            if plant_filter:
                query += f" AND sap_id IN ('{plant_filter}')"
            if interlock_filter:
                interlock_values = "','".join(interlock_filter.split(','))  # Handling multiple values
                query += f" AND interlock_name IN ('{interlock_values}')"
            if date_filter_applied:
                query += f" AND DATE(created_at) BETWEEN ('{start_date.strftime('%Y-%m-%d')}') AND ('{end_date.strftime('%Y-%m-%d')}')"

            # Group By clause
            query += " GROUP BY created_date, interlock_name, sap_id, sop_id"
            if zone_filter:
                query += ", zone"
            if plant_filter:
                query += ", location_name"

            query += " ORDER BY created_date DESC, alert_count DESC;"
            try:
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
                resp = resp.get('data', '')
            except Exception as e:
                return {"status": False, "message": f"Query execution failed: {str(e)}", "data": {}}

            if not resp:
                return {"status": False, "message": "Data Not found", "data": {}}

            # Convert response to Polars DataFrame
            resp_df = pl.DataFrame(resp)
            if resp_df.is_empty():
                return {"status": True, "data": {}}

            resp_df = resp_df.with_columns(pl.col("created_date").cast(pl.Date))

            # Date filtering if not applied in SQL
            if date and not date_filter_applied:
                last_30_days = datetime.now() - timedelta(days=30)
                resp_df = resp_df.filter(pl.col("created_date") >= last_30_days.date())

            # Columns for grouping
            group_cols = ["created_date", "interlock_name", "sap_id", "sop_id"]
            if zone_filter:
                group_cols.append("zone")
            if plant_filter:
                group_cols.append("plant")

            if date:
                # **Daily Data Aggregation**
                grouped = resp_df.group_by(group_cols).agg(pl.sum("alert_count").alias("total"))

                result = {}
                for row in grouped.iter_rows(named=True):
                    created_date = str(row["created_date"])
                    entry = {
                        "interlock_name": row["interlock_name"],
                        "sap_id": row["sap_id"],
                        "sop_id": row["sop_id"],
                        "total_alerts": row["total"]
                    }
                    if zone_filter:
                        entry["zone"] = row["zone"]
                    if plant_filter:
                        entry["plant"] = row["plant"]

                    result.setdefault(created_date, []).append(entry)

                # # Sort results
                # sorted_daily_data = {
                #     date: result[date] for date in sorted(
                #         result.keys(), key=lambda x: datetime.strptime(x, "%Y-%m-%d"), reverse=True
                #     )
                # }
                return {"status": True, "message": "success", "daily_data": result}

            else:
                # **Monthly Data Aggregation**
                resp_df = resp_df.with_columns(pl.col("created_date").dt.strftime("%b-%Y").alias("month_year"))

                grouped = resp_df.group_by(["month_year"] + group_cols[1:]).agg(pl.sum("alert_count").alias("total"))

                result = {}
                for row in grouped.iter_rows(named=True):
                    month = row["month_year"]
                    entry = {
                        "interlock_name": row["interlock_name"],
                        "sap_id": row["sap_id"],
                        "sop_id": row["sop_id"],
                        "total_alerts": row["total"]
                    }
                    if zone_filter:
                        entry["zone"] = row["zone"]
                    if plant_filter:
                        entry["plant"] = row["plant"]

                    result.setdefault(month, []).append(entry)

                # Sort results
                # sorted_monthly_data = {
                #     month: result[month] for month in sorted(
                #         result.keys(), key=lambda x: datetime.strptime(x, "%b-%Y"), reverse=True
                #     )
                # }
                return {"status": True, "message": "success", "monthly_data": result}

        except Exception as e:
            print(traceback.format_exc())
            return {"status": False, "message": f"Error: {str(e)}", "data": {}}
    
    @staticmethod
    async def local_loaded(filters, cross_filters, drill_state):
        try:
            # Check date flag once
            date = "date" in drill_state
            # Extract filter values efficiently in a single pass
            zone_filter = ''
            plant_filter = ''
            bcu_number = ''
            if filters:
                for filter in filters:
                    if "zone" in filter.key:
                        zone_filter = filter.value
                    if "sap_id" in filter.key:
                        plant_filter = filter.value
                    if "bcu_number" in filter.key:
                        bcu_number = filter.value
            
            date_filter_applied = False
            start_date = None
            end_date = None
            
            # Process cross filters for date
            if cross_filters:
                for filter in cross_filters:
                    if "DATE" in filter.key:
                        date_parts = filter.value.split(',')
                        start_date = datetime.strptime(date_parts[0].strip("'"), '%Y-%m-%d')
                        end_date = datetime.strptime(date_parts[-1].strip("'"), '%Y-%m-%d')
                        date_filter_applied = True
                        break
            
            query = """WITH localloaded AS (
                SELECT 
                    DATE(created_at) AS created_date,
                    zone,
                    location_name,
                    sap_id,
                    bcu_number,
                    SUM(loaded_qty) AS total_loaded_qty
                FROM 
                    host_local_loaded_tts
                WHERE 1=1
            """
            
            if zone_filter:
                query += f" AND zone IN ('{zone_filter}')"
            
            # Add plant/location filter if present
            if plant_filter:
                query += f" AND sap_id IN ('{plant_filter}')"
            
            # Add date filter directly to SQL if applied
            if date_filter_applied and start_date and end_date:
                query += f" AND DATE(created_at) BETWEEN '{start_date.strftime('%Y-%m-%d')}' AND '{end_date.strftime('%Y-%m-%d')}'"
            
            # Complete the query with JOIN instead of subquery for better performance
            query += f"""
                            GROUP BY 
                                DATE(created_at), zone, location_name, sap_id, bcu_number
                        )
                        SELECT 
                            l.created_date,
                            l.zone,
                            l.location_name,
                            l.sap_id,
                            l.bcu_number,
                            COALESCE(COUNT(a.id), 0) AS alert_count,
                            l.total_loaded_qty
                        FROM 
                            localloaded l
                        LEFT JOIN 
                            alerts a ON a.device_name = l.bcu_number 
                            AND a.interlock_name = 'BCU Local Loading'
                            AND DATE(a.created_at) = l.created_date
                            AND a.sap_id = l.sap_id
                        GROUP BY 
                            l.created_date, l.zone, l.location_name, l.sap_id, l.bcu_number, l.total_loaded_qty
                        ORDER BY 
                            l.created_date DESC, alert_count DESC
                """
            
            # Execute query with parameters
            try:
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query,limit=0)
                data = resp.get('data', '')
                if not data:
                    return {"status": False, "message": "Data Not found", "data": {}}
            except Exception as e:
                return {"status": False, "message": f"Query execution failed: {str(e)}", "data": {}}
            
            # Process data more efficiently
            resp_df = pl.DataFrame(data)
            if resp_df.is_empty():
                return {"status": True, "data": {}}
            
            # Apply type conversion and filters once
            resp_df = resp_df.with_columns(pl.col("created_date").cast(pl.Date))
    
            if bcu_number: 
                resp_df = resp_df.filter(pl.col("bcu_number") == bcu_number)
            # Apply default date filter if needed
            if not date and date_filter_applied:
                last_30_days = datetime.now() - timedelta(days=30)
                resp_df = resp_df.filter(pl.col("created_date") >= last_30_days.date())
            
            # Define aggregation operations once
            agg_ops = [
                pl.sum("alert_count").alias("total_alerts"),
                pl.sum("total_loaded_qty").alias("total_loaded")
            ]
            
            # Process data according to aggregation type
            if date:
                # Daily aggregation
                group_cols = ["created_date", "zone", "sap_id", "location_name", "bcu_number"]
                grouped_df = resp_df.group_by(group_cols).agg(agg_ops)
                
                # Create result dictionary efficiently
                result = {}
                for row in grouped_df.iter_rows(named=True):
                    created_date = str(row["created_date"])
                    entry = {
                        "zone": row["zone"],
                        "sap_id": row["sap_id"],
                        "location_name": row["location_name"],
                        "bcu_number": row["bcu_number"],
                        "total_alerts": row["total_alerts"],
                        "total_loaded_qty": row["total_loaded"]
                    }
                    result.setdefault(created_date, []).append(entry)
                
                return {"status": True, "message": "success", "daily_data": result}
            else:
                # Monthly aggregation - create month_year column once
                resp_df = resp_df.with_columns([
                    pl.col("created_date").dt.strftime("%b-%Y").alias("month_year"),
                    pl.col("created_date").dt.truncate("1mo").alias("month_sort")
                ])

                group_cols = ["month_year", "month_sort", "zone", "sap_id", "location_name", "bcu_number"]
                grouped_df = resp_df.group_by(group_cols).agg(agg_ops)

                grouped_df = grouped_df.sort("month_sort", descending=False)
                
                # Create result dictionary efficiently
                result = {}
                for row in grouped_df.iter_rows(named=True):
                    month = row["month_year"]
                    entry = {
                        "zone": row["zone"],
                        "sap_id": row["sap_id"],
                        "location_name": row["location_name"],
                        "bcu_number": row["bcu_number"],
                        "total_alerts": row["total_alerts"],
                        "total_loaded_qty": row["total_loaded"]
                    }
                    result.setdefault(month, []).append(entry)
            
                return {"status": True, "message": "success", "monthly_data": result}

        except Exception as e:
            return {"status": False, "message": f"Error: {str(e)}", "data": {}}

    @staticmethod
    async def unauthorised_flow(filters, cross_filters, drill_state):
        try:
            # Determine if we need daily or monthly aggregation
            date = "date" in drill_state
            zone_filter = ''
            plant_filter = ''
            bcu_number = ''
            if filters:
                for filter in filters:
                    if "zone" in filter.key:
                        zone_filter = filter.value
                    if "sap_id" in filter.key:
                        plant_filter = filter.value
                    if "bcu_number" in filter.key:
                        bcu_number = filter.value
            
            # Initialize date filter variables
            date_filter_applied = False
            start_date = None
            end_date = None
            
            # Process cross filters for date
            if cross_filters:
                for filter in cross_filters:
                    if "DATE" in filter.key:
                        date_parts = filter.value.split(',')
                        start_date = datetime.strptime(date_parts[0].strip("'"), '%Y-%m-%d')
                        end_date = datetime.strptime(date_parts[-1].strip("'"), '%Y-%m-%d')
                        date_filter_applied = True
                        break
            query = """with unauthorized_with_totals AS (SELECT 
                                DATE(created_at) as created_date,
                                zone,
                                location_name,
                                sap_id,
                                bcu_number,
                                CAST(SUM(net_totalizer) AS FLOAT) AS total_net_totalizer,
                                COUNT(*) AS unauthorized_count
                            FROM host_unauthorised_flow 
                            where net_totalizer != 0
                """
            
            # Add zone filter if present
            if zone_filter:
                query += f" AND zone IN ('{zone_filter}')"
            
            # Add plant/location filter if present
            if plant_filter:
                query += f" AND sap_id IN ('{plant_filter}')"
            
            # Add date filter directly to SQL if applied
            if date_filter_applied and start_date and end_date:
                query += f" AND DATE(created_at) BETWEEN '{start_date.strftime('%Y-%m-%d')}' AND '{end_date.strftime('%Y-%m-%d')}'"

            query += f"""GROUP BY created_date, zone, location_name, sap_id, bcu_number) SELECT 
                                u.created_date,
                                u.zone,
                                u.location_name,
                                u.sap_id,
                                u.bcu_number,
                                u.total_net_totalizer,
                                u.unauthorized_count
                            FROM unauthorized_with_totals u
                            ORDER BY u.created_date DESC, u.unauthorized_count DESC;
                        """
            
            # Execute query with parameters
            try:
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query,limit=0)
                data = resp.get('data', '')
                if not data:
                    return {"status": False, "message": "Data Not found", "data": {}}
            except Exception as e:
                return {"status": False, "message": f"Query execution failed: {str(e)}", "data": {}}
            
            # Convert to Polars DataFrame once
            resp_df = pl.DataFrame(data)
            if resp_df.is_empty():
                return {"status": True, "data": {}}
            
            # Apply type conversion once
            resp_df = resp_df.with_columns(pl.col("created_date").cast(pl.Date))
            
            # Apply BCU filter directly to the DataFrame
            if bcu_number:
                resp_df = resp_df.filter(pl.col("bcu_number") == bcu_number)
            
            # Apply default date filter if needed
            if not date and date_filter_applied:
                last_30_days = datetime.now() - timedelta(days=30)
                resp_df = resp_df.filter(pl.col("created_date") >= last_30_days.date())
            
            # Prepare common aggregation operations
            agg_ops = [pl.sum("unauthorized_count").alias("log_count")]
            
            if date:
                # Daily aggregation
                group_cols = ["created_date", "zone", "sap_id", "location_name", "bcu_number", "total_net_totalizer"]
                grouped_df = resp_df.group_by(group_cols).agg(agg_ops)
                
                # Convert to result format efficiently
                result = {}
                for row in grouped_df.iter_rows(named=True):
                    created_date = str(row["created_date"])
                    entry = {
                        "zone": row["zone"],
                        "sap_id": row["sap_id"],
                        "location_name": row["location_name"],
                        "bcu_number": row["bcu_number"],
                        "log_count": row["log_count"],
                        "total_net_totalizer": row["total_net_totalizer"]
                    }
                    result.setdefault(created_date, []).append(entry)
                
                return {"status": True, "message": "success", "daily_data": result}
            else:
                # Monthly aggregation - create month_year column once
                # resp_df = resp_df.with_columns(pl.col("created_date").dt.strftime("%b").alias("month_year"))
                resp_df = resp_df.with_columns([
                    pl.col("created_date").dt.strftime("%b-%Y").alias("month_year"),
                    pl.col("created_date").dt.truncate("1mo").alias("month_sort")
                ])

                group_cols = ["month_year", "month_sort", "zone", "sap_id", "location_name", "bcu_number", "total_net_totalizer"]
                grouped_df = resp_df.group_by(group_cols).agg(agg_ops)

                grouped_df = grouped_df.sort("month_sort", descending=False)
                
                # Convert to result format efficiently
                result = {}
                for row in grouped_df.iter_rows(named=True):
                    month = row["month_year"]
                    entry = {
                        "zone": row["zone"],
                        "sap_id": row["sap_id"],
                        "location_name": row["location_name"],
                        "bcu_number": row["bcu_number"],
                        "log_count": row["log_count"],
                        "total_net_totalizer": row["total_net_totalizer"]
                    }
                    result.setdefault(month, []).append(entry)
                
                return {"status": True, "message": "success", "monthly_data": result}

        except Exception as e:
            return {"status": False, "message": f"Error: {str(e)}", "data": {}}
    
    @staticmethod
    async def sick_tts(filters, cross_filters, drill_state):
        try:
            zone_filter = ''
            plant_filter = ''

            # Read filters
            if filters:
                for f in filters:
                    if "zone" in f.key:
                        zone_filter = f.value
                    if "sap_id" in f.key:
                        plant_filter = f.value

            start_date = None
            end_date = None

            # Read date filters
            if cross_filters:
                for f in cross_filters:
                    if "DATE" in f.key:
                        dates = f.value.split(',')
                        start_date = dates[0].strip("'")
                        end_date = dates[-1].strip("'")

            # Determine if monthly aggregation is needed
            monthly = drill_state.lower() != 'date'

            # Base query
            query = """
            SELECT
                {date_col} AS created_date,
                zone,
                sap_id,
                location_name,
                truck_number,
                load_number,
                SUM(required_qty) AS total_required_qty,
                SUM(loaded_qty) AS total_loaded_qty,
                ARRAY_AGG(CONCAT(required_qty, ' ', product_name) ORDER BY required_qty) AS indent_breakup,
                COUNT(DISTINCT DATE(date_time)) AS total_alerts
            FROM host_sick_tts
            WHERE 1=1
            """

            # Date column depends on daily or monthly
            date_col = "date_trunc('month', date_time)" if monthly else "DATE(date_time)"
            query = query.format(date_col=date_col)

            if zone_filter:
                query += f" AND zone IN ('{zone_filter}')"
            if plant_filter:
                query += f" AND sap_id IN ('{plant_filter}')"
            if start_date and end_date:
                query += f" AND DATE(date_time) BETWEEN '{start_date}' AND '{end_date}'"

            # Grouping
            group_by_cols = "zone, sap_id, location_name, truck_number, load_number"
            query += f"""
            GROUP BY {date_col}, {group_by_cols}
            ORDER BY {date_col} DESC
            """

            # Execute query
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
            resp = resp.get("data", [])

            if not resp:
                return {"status": False, "message": "Data Not Found", "data": {}}

            result = {}

            for row in resp:
                # Format date key
                key_date = row["created_date"]
                if monthly:
                    key_date = key_date.strftime("%b-%Y")
                else:
                    key_date = str(key_date)

                # Remarks logic
                remarks = "Truck breakdown" if row["total_required_qty"] == row["total_loaded_qty"] else "Wtare verification due to dip variation"

                entry = {
                    "zone": row["zone"],
                    "sap_id": row["sap_id"],
                    "location_name": row["location_name"],
                    "tt_number": row["truck_number"],
                    "load_number": row["load_number"],
                    "total_fan_qty": row["total_required_qty"],
                    "total_loaded_qty": row["total_loaded_qty"],
                    "total_alerts": row["total_alerts"],
                    "remarks": remarks,
                    "indent_breakup": " + ".join(row["indent_breakup"]) if row.get("indent_breakup") else ""
                }

                result.setdefault(key_date, []).append(entry)

            # Return with proper key for daily/monthly
            if monthly:
                return {"status": True, "message": "success", "monthly_data": result}
            else:
                return {"status": True, "message": "success", "daily_data": result}

        except Exception as e:
            return {"status": False, "message": str(e)}
    
    @staticmethod
    async def cancelled_tts(filters, cross_filters, drill_state):
        try:
            date = "date" in drill_state
            zone_filter = ''
            plant_filter = ''
            load_number = ''
            if filters:
                for filter in filters:
                    if "zone" in filter.key:
                        zone_filter = filter.value
                    if "sap_id" in filter.key:
                        plant_filter = filter.value
                    if "load_number" in filter.key:
                        load_number = filter.value

            date_filter_applied = False
            start_date = None
            end_date = None

            if cross_filters:
                for filter in cross_filters:
                    if "DATE" in filter.key:
                        date_parts = filter.value.split(',')
                        start_date = datetime.strptime(date_parts[0].strip("'"), '%Y-%m-%d')
                        end_date = datetime.strptime(date_parts[-1].strip("'"), '%Y-%m-%d')
                        date_filter_applied = True
                        break
            query = """WITH cancelled_tts AS (
                SELECT 
                    DATE(created_at) AS created_date,
                    zone,
                    location_name,
                    sap_id,
                    truck_number,
                    load_number,
                    SUM(required_qty) AS total_required_qty,
                    ARRAY_AGG(CONCAT(required_qty,' ',product_name)) AS indent_breakup
                FROM 
                    host_cancelled_tts
                WHERE 1=1
            """
            if zone_filter:
                query += f" AND zone IN ('{zone_filter}')"
            if plant_filter:
                query += f" AND sap_id IN ('{plant_filter}')"
            if date_filter_applied and start_date and end_date:
                query += f" AND DATE(created_at) BETWEEN '{start_date.strftime('%Y-%m-%d')}' AND '{end_date.strftime('%Y-%m-%d')}'"
            query += f"""
                    GROUP BY 
                        DATE(created_at), zone, location_name, sap_id, truck_number, load_number
                )
                SELECT 
                    c.created_date,
                    c.zone,
                    c.location_name,
                    c.sap_id,
                    c.truck_number,
                    c.load_number,
                    COALESCE(COUNT(a.id), 0) AS alert_count,
                    c.total_required_qty,
                    c.indent_breakup
                FROM 
                    cancelled_tts c
                LEFT JOIN 
                    alerts a ON a.tt_load_number = c.load_number::text 
                    AND a.interlock_name = 'Cancel TT Reported'
                    AND DATE(a.created_at) = c.created_date
                GROUP BY 
                    c.created_date,
                    c.zone,
                    c.location_name,
                    c.sap_id,
                    c.truck_number,
                    c.load_number,
                    c.total_required_qty,
                    c.indent_breakup
                ORDER BY 
                    c.created_date DESC,
                    alert_count DESC
            """

            try:
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
                data = resp.get('data', '')
                if not data:
                    return {"status": False, "message": "Data Not found", "data": {}}
            except Exception as e:
                return {"status": False, "message": f"Query execution failed: {str(e)}", "data": {}}
            resp_df = pl.DataFrame(data)
            if resp_df.is_empty():
                return {"status": True, "data": {}}
            resp_df = resp_df.with_columns(pl.col("created_date").cast(pl.Date))
            if load_number:
                resp_df = resp_df.filter(pl.col("load_number") == load_number)
            if not date and date_filter_applied:
                last_30_days = datetime.now() - timedelta(days=30)
                resp_df = resp_df.filter(pl.col("created_date") >= last_30_days.date())
            if date:
                graph_data = resp_df.group_by("created_date").agg([
                    pl.sum("alert_count").alias("total_alerts"),
                    pl.sum("total_required_qty").alias("total_fan_qty")
                ]).with_columns(
                    pl.col("created_date").cast(pl.Utf8)
                )

                graph_dict = {
                    str(row["created_date"]): {
                        "total_alerts": row["total_alerts"],
                        "total_fan_qty": row["total_fan_qty"]
                    }
                    for row in graph_data.iter_rows(named=True)
                }

                group_cols = ["created_date", "zone", "sap_id", "location_name", "truck_number", "load_number"]
                grouped_df = resp_df.group_by(group_cols).agg([
                    pl.sum("alert_count").alias("total_alerts"),
                    pl.sum("total_required_qty").alias("total_fan_qty"),
                    pl.first("indent_breakup").alias("indent_breakup")
                ])

                result = {}

                for row in grouped_df.iter_rows(named=True):
                    created_date = str(row["created_date"])

                    entry = {
                        "zone": row["zone"],
                        "sap_id": row["sap_id"],
                        "location_name": row["location_name"],
                        "truck_number": row["truck_number"],
                        "load_number": row["load_number"],
                        "total_alerts": row["total_alerts"],
                        "total_fan_qty": row["total_fan_qty"],
                        "indent_breakup": " + ".join(row["indent_breakup"]) if row["indent_breakup"] else ""
                    }
                    result.setdefault(created_date, []).append(entry)

                return {
                    "status": True,
                    "message": "success",
                    "daily_data": result,
                    "graph_data": graph_dict
                }

            else:

                resp_df = resp_df.with_columns([
                    pl.col("created_date").dt.strftime("%b-%Y").alias("month_year"),
                    pl.col("created_date").dt.truncate("1mo").alias("month_sort")
                ])

                graph_data = resp_df.group_by(["month_year", "month_sort"]).agg([
                    pl.sum("alert_count").alias("total_alerts"),
                    pl.sum("total_required_qty").alias("total_fan_qty")
                ]).sort("month_sort", descending=False)

                graph_dict = {
                    row["month_year"]: {
                        "total_alerts": row["total_alerts"],
                        "total_fan_qty": row["total_fan_qty"]
                    }
                    for row in graph_data.iter_rows(named=True)
                }

                group_cols = ["month_year", "month_sort", "zone", "sap_id", "location_name", "truck_number", "load_number"]
                grouped_df = resp_df.group_by(group_cols).agg([
                    pl.sum("alert_count").alias("total_alerts"),
                    pl.sum("total_required_qty").alias("total_fan_qty"),
                    pl.first("indent_breakup").alias("indent_breakup")
                ]).sort("month_sort", descending=False)
                result = {}
                for row in grouped_df.iter_rows(named=True):
                    month = row["month_year"]
                    entry = {
                        "zone": row["zone"],
                        "sap_id": row["sap_id"],
                        "location_name": row["location_name"],
                        "truck_number": row["truck_number"],
                        "load_number": row["load_number"],
                        "total_alerts": row["total_alerts"],
                        "total_fan_qty": row["total_fan_qty"],
                        "indent_breakup": " + ".join(row["indent_breakup"]) if row["indent_breakup"] else ""
                    }

                    result.setdefault(month, []).append(entry)

                return {
                    "status": True,
                    "message": "success",
                    "monthly_data": result,
                    "graph_data": graph_dict
                }

        except Exception as e:
            return {"status": False, "message": f"Error: {str(e)}", "data": {}}
    
    @staticmethod
    async def kfactor(filters, cross_filters, drill_state):
        try:
            # Check date flag once
            date = "date" in drill_state
            # Check if zone or plant filters are present
            zone_filter = ''
            plant_filter = ''
            bcu_number = ''
            if filters:
                for filter in filters:
                    if "zone" in filter.key:
                        zone_filter = filter.value
                    if "sap_id" in filter.key:
                        plant_filter = filter.value
                    if "bcu_number" in filter.key:
                        bcu_number = filter.value
            
            # Initialize date filter variables
            date_filter_applied = False
            start_date = None
            end_date = None
            
            # Process cross filters for date
            if cross_filters:
                for filter in cross_filters:
                    if "DATE" in filter.key:
                        date_parts = filter.value.split(',')
                        start_date = datetime.strptime(date_parts[0].strip("'"), '%Y-%m-%d')
                        end_date = datetime.strptime(date_parts[-1].strip("'"), '%Y-%m-%d')
                        date_filter_applied = True
                        break
            
            # Construct base SQL Query with CTE for better performance
            query = """WITH k_factor_data AS (SELECT 
                        DATE(created_at) AS created_date,
                        zone,
                        location_name,
                        sap_id,
                        bcu_number
                    FROM 
                        host_k_factor_changes
                    WHERE 1=1
            """
            
            if zone_filter:
                query += f" AND zone IN ('{zone_filter}')"
            
            # Add plant/location filter if present
            if plant_filter:
                query += f" AND sap_id IN ('{plant_filter}')"
            
            # Add date filter directly to SQL if applied
            if date_filter_applied and start_date and end_date:
                query += f" AND DATE(created_at) BETWEEN '{start_date.strftime('%Y-%m-%d')}' AND '{end_date.strftime('%Y-%m-%d')}'"
            
            # Complete the CTE and main query
            query += f"""
                    GROUP BY 
                        DATE(created_at), zone, location_name, sap_id, bcu_number
                )
                SELECT 
                    k.created_date,
                    k.zone,
                    k.location_name,
                    k.sap_id,
                    k.bcu_number,
                    COALESCE(COUNT(a.id), 0) AS alert_count
                FROM 
                    k_factor_data k
                LEFT JOIN 
                    alerts a ON a.device_name = k.bcu_number
                    AND a.interlock_name = 'BCU K- Factor Change'
                    AND DATE(a.created_at) = k.created_date
                GROUP BY
                    k.created_date, k.zone, k.location_name, k.sap_id, k.bcu_number
                ORDER BY 
                    k.created_date DESC, alert_count DESC
            """
            print("query --> ", query)
            try:
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
                data = resp.get('data', '')
            except Exception as e:
                return {"status": False, "message": f"Query execution failed: {str(e)}", "data": {}}

            if not data:
                return {"status": False, "message": "Data Not found", "data": {}}

            # Convert response to Polars DataFrame
            resp_df = pl.DataFrame(data)
            if resp_df.is_empty():
                    return {"status": True, "data": {}}

            resp_df = resp_df.with_columns(pl.col("created_date").cast(pl.Date))

            # Date filtering if not applied in SQL - default to last 30 days
            if not date and date_filter_applied:
                last_30_days = datetime.now() - timedelta(days=30)
                resp_df = resp_df.filter(pl.col("created_date") >= last_30_days.date())

            if bcu_number:
                resp_df = resp_df.filter(pl.col("bcu_number") == bcu_number)
            # Generate appropriate result format based on date flag
            if date:
                # Daily Data Aggregation
                group_cols = ["created_date", "zone", "sap_id", "location_name", "bcu_number"]
                grouped_df = resp_df.group_by(group_cols).agg(
                    pl.sum("alert_count").alias("total_alerts")
                )

                result = {}
                for row in grouped_df.iter_rows(named=True):
                    created_date = str(row["created_date"])
                    entry = {
                        "zone": row["zone"],
                        "sap_id": row["sap_id"],
                        "location_name": row["location_name"],
                        "bcu_number": row["bcu_number"],
                        "total_alerts": row["total_alerts"]
                    }
                    result.setdefault(created_date, []).append(entry)
                return {"status": True, "message": "success", "daily_data": result}
            else:
                # Monthly Data Aggregation
                # resp_df = resp_df.with_columns(pl.col("created_date").dt.strftime("%b").alias("month_year"))
                resp_df = resp_df.with_columns([
                    pl.col("created_date").dt.strftime("%b-%Y").alias("month_year"),
                    pl.col("created_date").dt.truncate("1mo").alias("month_sort")
                ])

                group_cols = ["month_year", "month_sort", "zone", "sap_id", "location_name", "bcu_number"]
                grouped_df = resp_df.group_by(group_cols).agg(
                    pl.sum("alert_count").alias("total_alerts")
                )
                grouped_df = grouped_df.sort("month_sort", descending=False)
                result = {}
                for row in grouped_df.iter_rows(named=True):
                    month = row["month_year"]
                    entry = {
                        "zone": row["zone"],
                        "sap_id": row["sap_id"],
                        "location_name": row["location_name"],
                        "bcu_number": row["bcu_number"],
                        "total_alerts": row["total_alerts"]
                    }
                    result.setdefault(month, []).append(entry)
                return {"status": True, "message": "success", "monthly_data": result}

        except Exception as e:
            print(traceback.format_exc())
            return {"status": False, "message": f"Error: {str(e)}", "data": {}}
    
    @staticmethod
    async def manualfanprinted(filters, cross_filters, drill_state):
        # try:
        #     date_flag = "date" in drill_state  # Simplified check

        #     # Extract zone and plant filters
        #     zone_filter = next((f.value for f in filters if "zone" in f.key), None)
        #     plant_filter = next((f.value for f in filters if "plant" in f.key), None)

        #     # Extract date filter
        #     start_date, end_date = None, None
        #     if cross_filters:
        #         for f in cross_filters:
        #             if "DATE" in f.key:
        #                 date_parts = f.value.split(',')
        #                 start_date = datetime.strptime(date_parts[0].strip("'"), '%Y-%m-%d')
        #                 end_date = datetime.strptime(date_parts[-1].strip("'"), '%Y-%m-%d')
        #                 break  # Stop looping after finding the first date

        #     date_filter_applied = bool(start_date and end_date)

        #     # Construct Base SQL Query with CTE
        #     query = f"""WITH manual_fan_data AS (SELECT 
        #             DATE(created_at) AS created_date,
        #             zone,
        #             location_name,
        #             sap_id,
        #             manual_fan_count AS total_manual_fan_count,
        #             total_count
        #         FROM host_manual_fan_printed
        #         WHERE 1=1
        #         {f"AND zone IN ('{zone_filter}')" if zone_filter else ""}
        #         {f"AND sap_id IN ('{plant_filter}')" if plant_filter else ""}
        #         {f"AND DATE(created_at) BETWEEN '{start_date.strftime('%Y-%m-%d')}' AND '{end_date.strftime('%Y-%m-%d')}'" if date_filter_applied else ""}
        #         GROUP BY created_date, zone, location_name, sap_id, manual_fan_count, total_count
        #     )
        #     SELECT 
        #         m.created_date,
        #         m.zone,
        #         m.location_name,
        #         m.sap_id,
        #         (SELECT COUNT(*) 
        #         FROM alerts a 
        #         WHERE a.interlock_name = 'Manual FAN printed more than 5% of total TT loaded'
        #         AND DATE(a.created_at) = m.created_date
        #         AND a.location_name = m.location_name) AS alert_count,
        #         m.total_manual_fan_count,
        #         m.total_count
        #     FROM manual_fan_data m
        #     ORDER BY m.created_date DESC, alert_count DESC;
        #     """

        #     print("Query -->", query)

        #     # Execute Query
        #     try:
        #         resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
        #         resp_data = resp.get("data", [])
        #     except Exception as e:
        #         return {"status": False, "message": f"Query execution failed: {str(e)}", "data": {}}

        #     if not resp_data:
        #         return {"status": False, "message": "Data Not found", "data": {}}

        #     # Convert response to Polars DataFrame
        #     resp_df = pl.from_dicts(resp_data)

        #     if resp_df.is_empty():
        #         return {"status": True, "data": {}}

        #     resp_df = resp_df.with_columns(pl.col("created_date").cast(pl.Date))

        #     # Apply date filter if not already applied
        #     if not date_filter_applied:
        #         last_30_days = datetime.now() - timedelta(days=30)
        #         resp_df = resp_df.filter(pl.col("created_date") >= last_30_days.date())

        #     # Aggregation based on date flag
        #     if date_flag:
        #         group_cols = ["created_date", "zone", "sap_id", "location_name"]
        #         grouped = resp_df.group_by(group_cols).agg(
        #             pl.sum("alert_count").alias("total_alerts")
        #             # pl.sum("total_manual_fan_count").alias("total_manual_fan_count"),
        #             # pl.sum("total_count").alias("total_count")
        #         )

        #         result = {}
        #         for row in grouped.iter_rows(named=True):
        #             created_date = str(row["created_date"])
        #             entry = {
        #                 "zone": row["zone"],
        #                 "sap_id": row["sap_id"],
        #                 "location_name": row["location_name"],
        #                 "total_alerts": row["total_alerts"],
        #                 "total_manual_fan_count": row["total_manual_fan_count"],
        #                 "total_count": row["total_count"]
        #             }
        #             result.setdefault(created_date, []).append(entry)
        #         return {"status": True, "message": "success", "daily_data": result}
            
        #     else:
        #         # Monthly Data Aggregation
        #         resp_df = resp_df.with_columns(pl.col("created_date").dt.strftime("%Y-%m").alias("month_year"))

        #         group_cols = ["month_year", "zone", "sap_id", "location_name"]
        #         grouped = resp_df.group_by(group_cols).agg(
        #             pl.sum("alert_count").alias("total_alerts")
        #             # pl.sum("total_manual_fan_count").alias("total_manual_fan_count"),
        #             # pl.sum("total_count").alias("total_count")
        #         )

        #         result = {}
        #         for row in grouped.iter_rows(named=True):
        #             month = row["month_year"]
        #             entry = {
        #                 "zone": row["zone"],
        #                 "sap_id": row["sap_id"],
        #                 "location_name": row["location_name"],
        #                 "total_alerts": row["total_alerts"],
        #                 "total_manual_fan_count": row["total_manual_fan_count"],
        #                 "total_count": row["total_count"]
        #             }
        #             result.setdefault(month, []).append(entry)
        #         return {"status": True, "message": "success", "monthly_data": result}

        # except Exception as e:
        #     print(traceback.format_exc())
        #     return {"status": False, "message": f"Error: {str(e)}", "data": {}}
        try:
            # Check date flag once
            date = "date" in drill_state
            zone_filter = ''
            plant_filter = ''
            if filters:
                for filter in filters:
                    if "zone" in filter.key:
                        zone_filter = filter.value
                    if "sap_id" in filter.key:
                        plant_filter = filter.value
            
            # Initialize date filter variables
            date_filter_applied = False
            start_date = None
            end_date = None
            
            # Process cross filters for date
            if cross_filters:
                for filter in cross_filters:
                    if "DATE" in filter.key:
                        date_parts = filter.value.split(',')
                        start_date = datetime.strptime(date_parts[0].strip("'"), '%Y-%m-%d')
                        end_date = datetime.strptime(date_parts[-1].strip("'"), '%Y-%m-%d')
                        date_filter_applied = True
                        break

            query = f"""WITH manual_fan_data AS (SELECT 
                    DATE(created_at) AS created_date,
                    zone,
                    location_name,
                    sap_id,
                    manual_fan_count AS total_manual_fan_count,
                    total_count
                FROM host_manual_fan_printed
                WHERE 1=1
            """

            if zone_filter:
                query += f" AND zone IN ('{zone_filter}')"
            
            # Add plant/location filter if present
            if plant_filter:
                query += f" AND sap_id IN ('{plant_filter}')"
            
            # Add date filter directly to SQL if applied
            if date_filter_applied and start_date and end_date:
                query += f" AND DATE(created_at) BETWEEN '{start_date.strftime('%Y-%m-%d')}' AND '{end_date.strftime('%Y-%m-%d')}'"
            
            # Complete the CTE and main query
            query += f"""
                    GROUP BY created_date, zone, location_name, sap_id, manual_fan_count, total_count
                )
                SELECT 
                    m.created_date,
                    m.zone,
                    m.location_name,
                    m.sap_id,
                    COALESCE(COUNT(a.id), 0) AS alert_count,
                    m.total_manual_fan_count,
                    m.total_count,
                    MAX(a.device_msg) AS device_message
                FROM 
                    manual_fan_data m
                LEFT JOIN
                    alerts a ON a.interlock_name = 'Manual FAN printed more than 5% of total TT loaded'
                    AND DATE(a.created_at) = m.created_date
                    AND a.device_name = m.total_manual_fan_count::VARCHAR
                WHERE 
                    m.total_manual_fan_count != 0 and
                    a.device_msg != ''
                GROUP BY 
                    m.created_date, m.zone, m.location_name, m.sap_id, m.total_manual_fan_count, m.total_count
                ORDER BY 
                    m.created_date DESC, alert_count DESC;
            """
            print("Query -->", query)

            # Execute Query
            try:
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
                data = resp.get("data", '')
            except Exception as e:
                return {"status": False, "message": f"Query execution failed: {str(e)}", "data": {}}

            if not data:
                return {"status": False, "message": "Data Not found", "data": {}}

            # Convert response to Polars DataFrame
            resp_df = pl.DataFrame(data)

            if resp_df.is_empty():
                return {"status": True, "data": {}}

            resp_df = resp_df.filter(pl.col("alert_count") != 0)
            resp_df = resp_df.with_columns(pl.col("created_date").cast(pl.Date))
            if resp_df.is_empty():
                return {"status": True, "message": "No data after alert_count filtering", "daily_data": {}}
            resp_df = resp_df.with_columns([
                pl.col("device_message")
                .str.extract(r"Manual percentage:\s*([\d.]+)%", 1)
                .cast(pl.Float64)
                .alias("manual_fan_percentage")
            ])

            # Apply date filter if not already applied
            if not date and date_filter_applied:
                last_30_days = datetime.now() - timedelta(days=30)
                resp_df = resp_df.filter(pl.col("created_date") >= last_30_days.date())

            # Aggregation based on date flag
            if date:
                group_cols = ["created_date", "zone", "sap_id", "location_name", "manual_fan_percentage"]
                grouped_df = resp_df.group_by(group_cols).agg(
                    pl.sum("alert_count").alias("total_alerts"),
                    pl.sum("total_manual_fan_count").alias("total_manual_fan_count"),
                    pl.sum("total_count").alias("total_count")
                )

                result = {}
                for row in grouped_df.iter_rows(named=True):
                    created_date = str(row["created_date"])
                    entry = {
                        "zone": row["zone"],
                        "sap_id": row["sap_id"],
                        "location_name": row["location_name"],
                        "total_alerts": row["total_alerts"],
                        "total_manual_fan_count": row["total_manual_fan_count"],
                        "total_count": row["total_count"],
                        "manual_fan_percentage": row["manual_fan_percentage"]
                    }
                    result.setdefault(created_date, []).append(entry)
                return {"status": True, "message": "success", "daily_data": result}
            
            else:
                # Monthly Data Aggregation
                # resp_df = resp_df.with_columns(pl.col("created_date").dt.strftime("%b").alias("month_year"))
                resp_df = resp_df.with_columns([
                    pl.col("created_date").dt.strftime("%b-%Y").alias("month_year"),
                    pl.col("created_date").dt.truncate("1mo").alias("month_sort")
                ])

                group_cols = ["month_year", "month_sort", "zone", "sap_id", "location_name", "manual_fan_percentage"]
                grouped_df = resp_df.group_by(group_cols).agg(
                    pl.sum("alert_count").alias("total_alerts"),
                    pl.sum("total_manual_fan_count").alias("total_manual_fan_count"),
                    pl.sum("total_count").alias("total_count")
                )
                grouped_df = grouped_df.sort("month_sort", descending=False)
                result = {}
                for row in grouped_df.iter_rows(named=True):
                    month = row["month_year"]
                    entry = {
                        "zone": row["zone"],
                        "sap_id": row["sap_id"],
                        "location_name": row["location_name"],
                        "total_alerts": row["total_alerts"],
                        "total_manual_fan_count": row["total_manual_fan_count"],
                        "total_count": row["total_count"],
                        "manual_fan_percentage": row["manual_fan_percentage"]
                    }
                    result.setdefault(month, []).append(entry)
                return {"status": True, "message": "success", "monthly_data": result}

        except Exception as e:
            print(traceback.format_exc())
            return {"status": False, "message": f"Error: {str(e)}", "data": {}}

    @staticmethod
    async def overloaded_tts(filters, cross_filters, drill_state):
        try:
            # Check date flag once
            date = "date" in drill_state
            # Check if zone or plant filters are present
            zone_filter = ''
            plant_filter = ''
            bcu_number = ''
            if filters:
                for filter in filters:
                    if "zone" in filter.key:
                        zone_filter = filter.value
                    if "sap_id" in filter.key:
                        plant_filter = filter.value
                    if "bcu_number" in filter.key:
                        bcu_number = filter.value
            
            # Initialize date filter variables
            date_filter_applied = False
            start_date = None
            end_date = None
            
            # Process cross filters for date
            if cross_filters:
                for filter in cross_filters:
                    if "DATE" in filter.key:
                        date_parts = filter.value.split(',')
                        start_date = datetime.strptime(date_parts[0].strip("'"), '%Y-%m-%d')
                        end_date = datetime.strptime(date_parts[-1].strip("'"), '%Y-%m-%d')
                        date_filter_applied = True
                        break
            
            # Construct base SQL Query with Common Table Expression (CTE)
            query = """WITH host_data AS (SELECT 
                        DATE(created_at) AS created_date,
                        zone,
                        location_name,
                        sap_id,
                        bcu_number,
                        SUM(required_qty) AS total_required_qty,
                        SUM(loaded_qty) AS total_loaded_qty,
                        SUM(loaded_qty - required_qty) AS qty_difference
                    FROM 
                        host_over_loaded_tts
                    WHERE 1=1
            """
            
            if zone_filter:
                query += f" AND zone IN ('{zone_filter}')"
            
            # Add plant/location filter if present
            if plant_filter:
                query += f" AND sap_id IN ('{plant_filter}')"
            
            # Add date filter directly to SQL if applied
            if date_filter_applied and start_date and end_date:
                query += f" AND DATE(created_at) BETWEEN '{start_date.strftime('%Y-%m-%d')}' AND '{end_date.strftime('%Y-%m-%d')}'"
            
            # Complete the query with JOIN instead of subquery for better performance
            query += f"""
                            GROUP BY 
                        DATE(created_at), zone, location_name, sap_id, bcu_number
                )
                SELECT 
                    h.created_date,
                    h.zone,
                    h.location_name,
                    h.sap_id,
                    h.bcu_number,
                    COALESCE(COUNT(a.id), 0) AS alert_count,
                    h.total_required_qty,
                    h.total_loaded_qty,
                    h.qty_difference
                FROM 
                    host_data h
                LEFT JOIN 
                    alerts a ON a.device_name = h.bcu_number
                    AND a.interlock_name = 'TT Overloaded'
                    AND DATE(a.created_at) = h.created_date
                GROUP BY
                    h.created_date, h.zone, h.location_name, h.sap_id, h.bcu_number,h.total_required_qty,h.total_loaded_qty,h.qty_difference
                ORDER BY 
                    h.created_date DESC, alert_count DESC
            """
            
            print("query --> ", query)
            try:
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
                data = resp.get('data', '')
            except Exception as e:
                return {"status": False, "message": f"Query execution failed: {str(e)}", "data": {}}

            if not data:
                return {"status": False, "message": "Data Not found", "data": {}}

            # Convert response to Polars DataFrame
            resp_df = pl.DataFrame(data)
            if resp_df.is_empty():
                    return {"status": True, "data": {}}

            resp_df = resp_df.with_columns(pl.col("created_date").cast(pl.Date))

            # Date filtering if not applied in SQL - default to last 30 days
            if not date and date_filter_applied:
                last_30_days = datetime.now() - timedelta(days=30)
                resp_df = resp_df.filter(pl.col("created_date") >= last_30_days.date())

            if bcu_number:
                resp_df = resp_df.filter(pl.col("bcu_number") == bcu_number)
            # Generate appropriate result format based on date flag
            if date:
                # Daily Data Aggregation
                group_cols = ["created_date", "zone", "sap_id", "location_name", "bcu_number"]
                grouped_df = resp_df.group_by(group_cols).agg(
                    pl.sum("alert_count").alias("total_alerts"),
                    pl.sum("total_required_qty").alias("total_required_quantity"),
                    pl.sum("total_loaded_qty").alias("total_loaded_quantity"),
                    pl.sum("qty_difference").alias("total_quantity_difference")
                )

                result = {}
                for row in grouped_df.iter_rows(named=True):
                    created_date = str(row["created_date"])
                    entry = {
                        "zone": row["zone"],
                        "sap_id": row["sap_id"],
                        "location_name": row["location_name"],
                        "bcu_number": row["bcu_number"],
                        "total_alerts": row["total_alerts"],
                        "total_required_qty": row["total_required_quantity"],
                        "total_loaded_qty": row["total_loaded_quantity"],
                        "total_quantity_difference": row["total_quantity_difference"]
                    }
                    result.setdefault(created_date, []).append(entry)
                return {"status": True, "message": "success", "daily_data": result}
            else:
                # Monthly Data Aggregation
                # resp_df = resp_df.with_columns(pl.col("created_date").dt.strftime("%b").alias("month_year"))
                resp_df = resp_df.with_columns([
                    pl.col("created_date").dt.strftime("%b-%Y").alias("month_year"),
                    pl.col("created_date").dt.truncate("1mo").alias("month_sort")
                ])

                group_cols = ["month_year", "month_sort", "zone", "sap_id", "location_name", "bcu_number"]
                grouped_df = resp_df.group_by(group_cols).agg(
                    pl.sum("alert_count").alias("total_alerts"),
                    pl.sum("total_required_qty").alias("total_required_quantity"),
                    pl.sum("total_loaded_qty").alias("total_loaded_quantity"),
                    pl.sum("qty_difference").alias("total_quantity_difference")
                )
                grouped_df = grouped_df.sort("month_sort", descending=False)
                result = {}
                for row in grouped_df.iter_rows(named=True):
                    month = row["month_year"]
                    entry = {
                        "zone": row["zone"],
                        "sap_id": row["sap_id"],
                        "location_name": row["location_name"],
                        "bcu_number": row["bcu_number"],
                        "total_alerts": row["total_alerts"],
                        "total_required_qty": row["total_required_quantity"],
                        "total_loaded_qty": row["total_loaded_quantity"],
                        "total_quantity_difference": row["total_quantity_difference"]
                    }
                    result.setdefault(month, []).append(entry)
                return {"status": True, "message": "success", "monthly_data": result}

        except Exception as e:
            print(traceback.format_exc())
            return {"status": False, "message": f"Error: {str(e)}", "data": {}}

    @staticmethod
    async def mfmkfactor(filters, cross_filters, drill_state):
        try:
            # Determine if date drill-down is applied
            is_date_drill = "date" in drill_state

            # Extract filters
            def get_filter_value(key_part):
                return next((f.value for f in filters if key_part in f.key), '')

            zone_filter = get_filter_value("zone")
            plant_filter = get_filter_value("sap_id")
            bcu_number = get_filter_value("bcu_number")

            # Date filter setup
            date_filter_applied = False
            start_date = None
            end_date = None

            if cross_filters:
                for f in cross_filters:
                    if "DATE" in f.key:
                        date_parts = f.value.split(',')
                        start_date = datetime.strptime(date_parts[0].strip("'"), '%Y-%m-%d')
                        end_date = datetime.strptime(date_parts[-1].strip("'"), '%Y-%m-%d')
                        date_filter_applied = True
                        break

            # Build SQL
            query_parts = [
                "WITH mfmfactor AS (",
                "    SELECT",
                "        DATE(created_at) AS created_date,",
                "        zone, location_name, sap_id, bcu_number, mfm_number",
                "    FROM host_mfm_factor",
                "    WHERE 1=1",
                "    AND last_meter_factor IS NOT NULL"
            ]
            if zone_filter:
                query_parts.append(f" AND zone = '{zone_filter}'")
            if plant_filter:
                query_parts.append(f" AND sap_id = '{plant_filter}'")
            if date_filter_applied:
                query_parts.append(f" AND created_at BETWEEN DATE '{start_date:%Y-%m-%d}' AND DATE '{end_date:%Y-%m-%d}'")
            query_parts.append(")")

            query_parts.extend([
                "SELECT",
                "    created_date, zone, location_name, sap_id, bcu_number, mfm_number,",
                "    COUNT(*) AS alert_count",          # ← counts rows in host_mfm_factor
                "FROM mfmfactor",
                "GROUP BY created_date, zone, location_name, sap_id, bcu_number, mfm_number",
                "ORDER BY created_date DESC, alert_count DESC"
            ])

            query = "\n".join(query_parts)

            # Execute SQL
            try:
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=10000)
                data = resp.get('data', '')
            except Exception as e:
                return {"status": False, "message": f"Query execution failed: {str(e)}", "data": {}}

            if not data:
                return {"status": False, "message": "Data Not found", "data": {}}

            # Convert to Polars DataFrame
            df = pl.DataFrame(data)
            if df.shape[0] == 0:
                return {"status": True, "data": {}}

            # Transform columns
            df = df.with_columns([
                pl.col("created_date").cast(pl.Date)
            ])

            # Apply additional filtering (if needed)
            if not is_date_drill and date_filter_applied:
                last_30_days = datetime.now().date() - timedelta(days=30)
                df = df.filter(pl.col("created_date") >= last_30_days)

            if bcu_number:
                df = df.filter(pl.col("bcu_number") == bcu_number)

            # Aggregation
            if is_date_drill:
                # Daily aggregation
                group_cols = ["created_date", "zone", "sap_id", "location_name", "bcu_number"]
                grouped = df.group_by(group_cols).agg(
                    pl.sum("alert_count").alias("total_alerts")
                )

                result = {}
                for row in grouped.iter_rows(named=True):
                    date_key = str(row["created_date"])
                    entry = {
                        "zone": row["zone"],
                        "sap_id": row["sap_id"],
                        "location_name": row["location_name"],
                        "bcu_number": row["bcu_number"],
                        "total_alerts": row["total_alerts"]
                    }
                    result.setdefault(date_key, []).append(entry)
                return {"status": True, "message": "success", "daily_data": result}

            else:
                # Monthly aggregation
                # df = df.with_columns([pl.col("created_date").dt.strftime("%b").alias("month_year")])
                df = df.with_columns([
                    pl.col("created_date").dt.strftime("%b-%Y").alias("month_year"),
                    pl.col("created_date").dt.truncate("1mo").alias("month_sort")
                ])
                group_cols = ["month_year", "month_sort", "zone", "sap_id", "location_name", "bcu_number"]
                grouped = df.group_by(group_cols).agg(
                    pl.sum("alert_count").alias("total_alerts")
                ).sort("month_sort", descending=False)

                result = {}
                for row in grouped.iter_rows(named=True):
                    month = row["month_year"]
                    entry = {
                        "zone": row["zone"],
                        "sap_id": row["sap_id"],
                        "location_name": row["location_name"],
                        "bcu_number": row["bcu_number"],
                        "total_alerts": row["total_alerts"]
                    }
                    result.setdefault(month, []).append(entry)
                return {"status": True, "message": "success", "monthly_data": result}

        except Exception as e:
            print(traceback.format_exc())
            return {"status": False, "message": f"Error: {str(e)}", "data": {}}
    
    
    @staticmethod
    async def bay_reassignment(filters, cross_filters, drill_state):
        try:
            # Check date flag once
            date = "date" in drill_state
            # Extract filter values efficiently in a single pass
            # Check if zone or plant filters are present
            zone_filter = ''
            plant_filter = ''
            assigned_bay = ''
            if filters:
                for filter in filters:
                    if "zone" in filter.key:
                        zone_filter = filter.value
                    if "sap_id" in filter.key:
                        plant_filter = filter.value
                    if "assigned_bay" in filter.key:
                        assigned_bay = filter.value
            
            # Initialize date filter variables
            date_filter_applied = False
            start_date = None
            end_date = None
            
            # Process cross filters for date
            if cross_filters:
                for filter in cross_filters:
                    if "DATE" in filter.key:
                        date_parts = filter.value.split(',')
                        start_date = datetime.strptime(date_parts[0].strip("'"), '%Y-%m-%d')
                        end_date = datetime.strptime(date_parts[-1].strip("'"), '%Y-%m-%d')
                        date_filter_applied = True
                        break

            # Construct base SQL Query with CTE for better performance
            query = """WITH bay_reassignment AS (SELECT 
                        DATE(created_at) AS created_date,
                        zone,
                        location_name,
                        sap_id,
                        assigned_bay,
                        load_number,
                        truck_number,
                        reassigned_bay
                    FROM 
                        host_bay_re_assignment
                    WHERE 1=1
            """
            
            if zone_filter:
                query += f" AND zone IN ('{zone_filter}')"
            
            # Add plant/location filter if present
            if plant_filter:
                query += f" AND sap_id IN ('{plant_filter}')"
            
            # Add date filter directly to SQL if applied
            if date_filter_applied and start_date and end_date:
                query += f" AND DATE(created_at) BETWEEN '{start_date.strftime('%Y-%m-%d')}' AND '{end_date.strftime('%Y-%m-%d')}'"
            
            # Complete the CTE and main query
            query += f"""
                GROUP BY 
                        DATE(created_at), zone, location_name, sap_id, load_number, assigned_bay, truck_number, reassigned_bay
                )
                SELECT 
                    k.created_date,
                    k.zone,
                    k.location_name,
                    k.sap_id,
                    k.assigned_bay,
                    k.load_number,
                    k.truck_number,
                    k.reassigned_bay,
                    COALESCE(COUNT(a.id), 0) AS alert_count
                FROM 
                    bay_reassignment k
                LEFT JOIN
                    alerts a ON a.interlock_name = 'Bay reassignment'
                    AND a.tt_load_number = k.load_number::VARCHAR
                    AND DATE(a.created_at) = k.created_date
                GROUP BY
                    k.created_date, k.zone, k.location_name, k.sap_id, k.load_number, k.assigned_bay, k.truck_number, k.reassigned_bay
                ORDER BY 
                    k.created_date DESC, alert_count DESC
            """
            
            print("query --> ", query)
            
            try:
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
                data = resp.get('data', '')
            except Exception as e:
                return {"status": False, "message": f"Query execution failed: {str(e)}", "data": {}}

            if not data:
                return {"status": False, "message": "Data Not found", "data": {}}

            # Convert response to Polars DataFrame
            resp_df = pl.DataFrame(data)
            if resp_df.is_empty():
                    return {"status": True, "data": {}}

            resp_df = resp_df.with_columns(pl.col("created_date").cast(pl.Date))

            # Date filtering if not applied in SQL - default to last 30 days
            if not date and date_filter_applied:
                last_30_days = datetime.now() - timedelta(days=30)
                resp_df = resp_df.filter(pl.col("created_date") >= last_30_days.date())

            if assigned_bay:
                resp_df = resp_df.filter(pl.col("assigned_bay") == assigned_bay)
            # Generate appropriate result format based on date flag
            if date:
                # Daily Data Aggregation
                group_cols = ["created_date", "zone", "sap_id", "location_name", "load_number", "assigned_bay", "truck_number", "reassigned_bay"]
                grouped_df = resp_df.group_by(group_cols).agg(
                    pl.sum("alert_count").alias("total_alerts")
                )

                result = {}
                for row in grouped_df.iter_rows(named=True):
                    created_date = str(row["created_date"])
                    entry = {
                        "zone": row["zone"],
                        "sap_id": row["sap_id"],
                        "location_name": row["location_name"],
                        "assigned_bay": row["assigned_bay"],
                        "load_number": row["load_number"],
                        "total_alerts": row["total_alerts"],
                        "truck_number": row["truck_number"],
                        "reassigned_bay": row["reassigned_bay"],
                    }
                    result.setdefault(created_date, []).append(entry)
                return {"status": True, "message": "success", "daily_data": result}
            else:
                # Monthly Data Aggregation
                # resp_df = resp_df.with_columns(pl.col("created_date").dt.strftime("%b").alias("month_year"))
                resp_df = resp_df.with_columns([
                    pl.col("created_date").dt.strftime("%b-%Y").alias("month_year"),
                    pl.col("created_date").dt.truncate("1mo").alias("month_sort")
                ])

                group_cols = ["month_year", "month_sort", "zone", "sap_id", "location_name", "load_number", "assigned_bay","truck_number", "reassigned_bay"]
                grouped_df = resp_df.group_by(group_cols).agg(
                    pl.sum("alert_count").alias("total_alerts")
                )

                grouped_df = grouped_df.sort("month_sort", descending=False)

                result = {}
                for row in grouped_df.iter_rows(named=True):
                    month = row["month_year"]
                    entry = {
                        "zone": row["zone"],
                        "sap_id": row["sap_id"],
                        "location_name": row["location_name"],
                        "assigned_bay": row["assigned_bay"],
                        "load_number": row["load_number"],
                        "total_alerts": row["total_alerts"],
                        "truck_number": row["truck_number"],
                        "reassigned_bay": row["reassigned_bay"],
                    }
                    result.setdefault(month, []).append(entry)
                return {"status": True, "message": "success", "monthly_data": result}

        except Exception as e:
            print(traceback.format_exc())
            return {"status": False, "message": f"Error: {str(e)}", "data": {}}
    
    @staticmethod
    async def carry_forward_analysis(filters, cross_filters, drill_state):
        start_date, end_date = await va_analysis.get_period_datetime(period='oneweek')
        filter_map = defaultdict(list)
        _filters = []
        daterange = f""" c.created_at::date BETWEEN '{start_date.strftime("%Y-%m-%d")}' AND '{end_date.strftime("%Y-%m-%d")}' """

        if cross_filters:
            for filter in cross_filters:
                if "DATE" in filter.key:
                    start_date, end_date = filter.value.split(",")[0], filter.value.split(",")[-1]
                    if start_date == end_date:
                        daterange = f""" c.created_at::date = '{start_date}' """
                    else:
                        daterange = f""" c.created_at::date BETWEEN '{start_date}' AND '{end_date}' """
                    continue
                #_filters.append(f"{filter.key} = '{filter.value}'")
                filter_map[filter.key].append(filter.value)

        if filters:
            for filter in filters:
                filter_map[filter.key].append(filter.value)
                #_filters.append(f"{filter.key} = '{filter.value}'")
        
        for key, values in filter_map.items():
            if len(values) > 1:
                _filters.append(f"a.{key} IN ({', '.join([f"'{v}'" for v in values])})")
            else:
                _filters.append(f"a.{key} = '{values[0]}'")


        # Construct WHERE clause
        where_clauses = [daterange]
        if _filters:
            where_clauses.extend(_filters)

        where_clause = " AND ".join(where_clauses)

        query = (
            f"""
            SELECT
                DATE(c.created_at) AS date,
                COUNT(*) AS cf_indents,
                COUNT(*) FILTER (WHERE c.dry_out_in_days = '1') AS dryout_count,
                COUNT(*) FILTER (WHERE c.dry_out_in_days = '2') AS intra_day_dry_count,
                COUNT(*) FILTER (WHERE c.category = 'R01') AS category_a_count
            FROM public.carry_fwd_indent c
            INNER JOIN public.alerts a
                ON c.sap_id = a.sap_id
            WHERE {where_clause} AND a.indent_no=c.indent_no
            GROUP BY DATE(c.created_at)
            ORDER BY date
            """
        )

        print("CARRY FORWARD QUERY -->", query)

        # query = (f"SELECT DATE(created_at) AS date, COUNT(*) AS cf_indents, "
        #          f"COUNT(*) FILTER (WHERE dry_out_in_days = '1') AS dryout_count, "
        #          f"COUNT(*) FILTER (WHERE dry_out_in_days = '2') AS intra_day_dry_count, "
        #          f"COUNT(*) FILTER (WHERE category = 'R01') AS category_a_count "
        #          f"FROM public.carry_fwd_indent where {where_clause} "
        #          f"GROUP BY DATE(created_at) ORDER BY date")
        data = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
        df = pl.DataFrame(data.get("data", []))
        #data = pd.DataFrame(data.get('data', []))
        # if not data.empty:
        #     data['date'] = pd.to_datetime(data['date'])
        #     full_range = pd.date_range(start=data['date'].min(), end=data['date'].max(), freq='D')
        #     data = data.set_index('date').reindex(full_range).fillna(0).rename_axis('date').reset_index()
        #     cols_to_int = ['cf_indents', 'dryout_count', 'intra_day_dry_count', 'category_a_count']
        #     data[cols_to_int] = data[cols_to_int].astype(int)
        #     data['date'] = data['date'].dt.strftime('%Y-%b-%d')
        #     data['other_cf_indents'] = data['cf_indents'] - (data['dryout_count'] + data['intra_day_dry_count'] + data['category_a_count'])
        #     print(data)
        #     return {"status": True, "message": "Success", "data": data.to_dict(orient='records')}
        if not df.is_empty():
            df = df.with_columns(pl.col("date").cast(pl.Date))
            full_df = pl.select(pl.date_range(start=df["date"].min(), end=df["date"].max(), interval="1d").alias("date"))
            df = full_df.join(df, on="date", how="left").fill_null(0)
            df = df.with_columns([
                pl.col("cf_indents").cast(pl.Int64),
                pl.col("dryout_count").cast(pl.Int64),
                pl.col("intra_day_dry_count").cast(pl.Int64),
                pl.col("category_a_count").cast(pl.Int64),
            ])
            df = df.with_columns([
                pl.col("date").dt.strftime('%Y-%b-%d').alias("date"),
                (pl.col("cf_indents") - (pl.col("dryout_count") + pl.col("intra_day_dry_count") + pl.col("category_a_count"))).alias("other_cf_indents")
            ])
            return {"status": True, "message": "Success", "data": df.to_dicts()}

        return {"status": False, "message": "No Data Found", "data": []}

    @staticmethod
    async def dry_out_analysis_count(filters, cross_filters, drill_state):
        # resp_dict = {}
        # query = (f"SELECT COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '1') AS dryout_total, "
        #          f"COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '1' AND progress_rate = 1) AS dryout_indent_not_raised, "
        #          f"COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '1' AND progress_rate IN (2, 3)) AS dryout_pending_indent, "
        #          f"COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '1' AND progress_rate > 3) AS dryout_indent_wip, "
        #          f"COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '2') AS intra_dryout_total, "
        #          f"COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '2' AND progress_rate = 1) AS intra_indent_not_raised, "
        #          f"COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '2' AND progress_rate IN (2, 3)) AS intra_pending_indent, "
        #          f"COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '2' AND progress_rate > 3) AS intra_indent_wip "
        #          f"FROM public.alerts WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow' and "
        #          f"alert_status != 'Close' and mark_as_false = true ")

        # data = await hpcl_ceg_model.Alerts.get_aggr_data(query=query, limit=0)
        # data = data.get("data")[0] if data.get("data", {}) else {}
        # resp_dict['dryoutData'] = {
        #     "Indent Not Raised": data.get("dryout_indent_not_raised", 0),
        #     "Pending Indent": data.get("dryout_pending_indent", 0),
        #     "Indent WIP": data.get("dryout_indent_wip", 0),
        # }

        # resp_dict['intraDryoutData'] = {
        #     "Indent Not Raised": data.get("intra_indent_not_raised", 0),
        #     "Pending Indent": data.get("intra_pending_indent", 0),
        #     "Indent WIP": data.get("intra_indent_wip", 0),
        # }
        # carry_fwd_data = await dry_out_analysis.sync_carry_fwd_indent(insert_to_db=False)
        # carry_fwd_data = pd.DataFrame(carry_fwd_data)
        # if carry_fwd_data.empty:
        #     carry_fwd_data = pd.DataFrame({"dry_out_in_days": [], "category": []})
        # resp_dict['carryForwardData'] = {
        #     "Carry Fwd DryOut Indents": len(carry_fwd_data[carry_fwd_data['dry_out_in_days'].fillna("") == '1']),
        #     "Carry Fwd IntraDay DryOut Indents": len(carry_fwd_data[carry_fwd_data['dry_out_in_days'].fillna("") == '1']),
        #     "Carry Fwd CATA Indents": len(carry_fwd_data[carry_fwd_data['category'].fillna("") != '']) if len(carry_fwd_data) else 0,
        # }

        # resp_dict['totalCount'] = {
        #     "dryoutData": data.get("dryout_total", 0),
        #     "intraDryoutData": data.get("intra_dryout_total", 0),
        #     "carryForwardData": len(carry_fwd_data),
        # }
        # resp_dict['carryForwardData']['Other Carry Fwd Indents'] = (resp_dict['totalCount']['carryForwardData'] -
        #                                                     resp_dict['carryForwardData']['Carry Fwd DryOut Indents'] -
        #                                                     resp_dict['carryForwardData']['Carry Fwd IntraDay DryOut Indents'] -
        #                                                     resp_dict['carryForwardData']['Carry Fwd CATA Indents'])
        # return {"status": True, "message": "Success", "data": resp_dict}

        resp_dict = {}
        filter_map = defaultdict(list)
        where_clauses = []

        if cross_filters:
            for filter in cross_filters:
                filter_map[filter.key].append(filter.value)

        if filters:
            for filter in filters:
                filter_map[filter.key].append(filter.value)
        
        for key, values in filter_map.items():
            if len(values) > 1:
                where_clauses.append(f" {key} IN ({', '.join([f"'{v}'" for v in values])})")
            else:
                where_clauses.append(f" {key} = '{values[0]}'")
        
        dynamic_where = ""
        if where_clauses:
            dynamic_where =" AND " + " AND ".join(where_clauses)
        
        # query = (f"SELECT COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '1') AS dryout_total, "
        #         f"COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '1' AND progress_rate = 1) AS dryout_indent_not_raised, "
        #         f"COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '1' AND progress_rate IN (2, 3)) AS dryout_pending_indent, "
        #         f"COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '1' AND progress_rate > 3) AS dryout_indent_wip, "
        #         f"COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '2') AS intra_dryout_total, "
        #         f"COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '2' AND progress_rate = 1) AS intra_indent_not_raised, "
        #         f"COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '2' AND progress_rate IN (2, 3)) AS intra_pending_indent, "
        #         f"COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '2' AND progress_rate > 3) AS intra_indent_wip "
        #         f"FROM public.alerts WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow' AND "
        #         f"alert_status != 'Close' and mark_as_false = true {dynamic_where} ")
        
        query = f"""WITH classified AS (
                    SELECT
                        sap_id,
                        dry_out_in_days,
                        MIN(progress_rate) AS min_progress  -- ensures priority (1 > 2/3 > >3)
                    FROM public.alerts
                    WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow'
                    AND alert_status != 'Close'
                    AND mark_as_false = true
                    {dynamic_where}
                    GROUP BY sap_id, dry_out_in_days
                )

                SELECT
                    -- ================= DRYOUT =================
                    COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '1') AS dryout_total,

                    COUNT(DISTINCT sap_id) FILTER (
                        WHERE dry_out_in_days = '1' AND min_progress = 1
                    ) AS dryout_indent_not_raised,

                    COUNT(DISTINCT sap_id) FILTER (
                        WHERE dry_out_in_days = '1' AND min_progress IN (2, 3)
                    ) AS dryout_pending_indent,

                    COUNT(DISTINCT sap_id) FILTER (
                        WHERE dry_out_in_days = '1' AND min_progress > 3
                    ) AS dryout_indent_wip,

                    -- ================= INTRA DRYOUT =================
                    COUNT(DISTINCT sap_id) FILTER (WHERE dry_out_in_days = '2') AS intra_dryout_total,

                    COUNT(DISTINCT sap_id) FILTER (
                        WHERE dry_out_in_days = '2' AND min_progress = 1
                    ) AS intra_indent_not_raised,

                    COUNT(DISTINCT sap_id) FILTER (
                        WHERE dry_out_in_days = '2' AND min_progress IN (2, 3)
                    ) AS intra_pending_indent,

                    COUNT(DISTINCT sap_id) FILTER (
                        WHERE dry_out_in_days = '2' AND min_progress > 3
                    ) AS intra_indent_wip

                FROM classified;"""

        
        print("dry_out_analysis_count_query-------------", query)

        data = await hpcl_ceg_model.Alerts.get_aggr_data(query=query, limit=0)
        data = data.get("data")[0] if data.get("data", {}) else {}
        resp_dict['dryoutData'] = {
            "Indent Not Raised": data.get("dryout_indent_not_raised", 0),
            "Pending Indent": data.get("dryout_pending_indent", 0),
            "Indent WIP": data.get("dryout_indent_wip", 0),
        }

        resp_dict['intraDryoutData'] = {
            "Indent Not Raised": data.get("intra_indent_not_raised", 0),
            "Pending Indent": data.get("intra_pending_indent", 0),
            "Indent WIP": data.get("intra_indent_wip", 0),
        }

        carry_fwd_data = await dry_out_analysis.sync_carry_fwd_indent(insert_to_db=False, filters=filters)
        carry_fwd_df = pl.DataFrame(carry_fwd_data)
        if carry_fwd_df.is_empty():
            carry_fwd_df = pl.DataFrame(schema={ "dry_out_in_days": pl.Utf8,"category": pl.Utf8,})
        
        carry_fwd_dryout = carry_fwd_df.filter(pl.col("dry_out_in_days").fill_null("") == "1").height
        carry_fwd_intraday = carry_fwd_df.filter(pl.col("dry_out_in_days").fill_null("") == "2").height
        carry_fwd_cata = carry_fwd_df.filter(pl.col("category").fill_null("") != "").height if carry_fwd_df.height else 0

        resp_dict["carryForwardData"] = { "Carry Fwd DryOut Indents": carry_fwd_dryout,
                                         "Carry Fwd IntraDay DryOut Indents": carry_fwd_intraday,
                                         "Carry Fwd CATA Indents": carry_fwd_cata,}
        
        resp_dict["totalCount"] = {"dryoutData": data.get("dryout_total", 0),
                                    "intraDryoutData": data.get("intra_dryout_total", 0),
                                    "carryForwardData": carry_fwd_df.height,}
        
        resp_dict["carryForwardData"]["Other Carry Fwd Indents"] = (resp_dict["totalCount"]["carryForwardData"]- 
                                                                    resp_dict["carryForwardData"]["Carry Fwd DryOut Indents"]- 
                                                                    resp_dict["carryForwardData"]["Carry Fwd IntraDay DryOut Indents"]- 
                                                                    resp_dict["carryForwardData"]["Carry Fwd CATA Indents"])
        
        return {"status": True, "message": "Success", "data": resp_dict}

    @staticmethod
    async def dry_out_bucket_trends(filters, cross_filters, drill_state):
        _filters = []
        _date = urdhva_base.utilities.get_present_time().strftime("%Y-%m")
        daterange = f""" TO_CHAR(created_at, 'YYYY-MM') = '{_date}' """

        if cross_filters:
            for filter in cross_filters:
                if "DATE" in filter.key:
                    _date = filter.value
                    daterange = f""" TO_CHAR(created_at, 'YYYY-MM') = '{filter.value}' """
                    continue
                _filters.append(f"{filter.key} = '{filter.value}'")

        if filters:
            for filter in filters:
                _filters.append(f"{filter.key} = '{filter.value}'")

        # Construct WHERE clause
        where_clauses = ["interlock_name = 'Dry Out Each Indent Wise MainFlow'", "indent_status not in ('Cancelled', 'TempClosed', 'ProductLowLevel', 'OfflineOrFalseAlarm', 'NotAvailable')", daterange]
        if _filters:
            where_clauses.extend(_filters)

        where_clause = " AND ".join(where_clauses)
        start_date, end_date = get_month_start_and_next(_date)
        query = f"""WITH dryout_periods AS (
                        SELECT
                            sap_id,
                            zone,
                            region,
                            sales_area,
                            location_name,
                            product_code,
                            GREATEST(created_at, DATE '{start_date}') AS period_start,
                            LEAST(updated_at, DATE '{end_date}') AS period_end
                        FROM alerts
                        WHERE
                            created_at < DATE '{start_date}'
                            AND updated_at >= DATE '{end_date}'
                            AND {where_clause}
                    ),
                    durations AS (
                        SELECT
                            sap_id,
                            zone,
                            region,
                            sales_area,
                            location_name,
                            product_code,
                            period_end - period_start AS duration
                        FROM dryout_periods
                    )
                    SELECT
                        sap_id,
                        zone,
                        region,
                        sales_area,
                        location_name,
                        product_code,
                        FLOOR(SUM(EXTRACT(EPOCH FROM duration)) / 86400) AS total_days,
                        FLOOR(MOD(SUM(EXTRACT(EPOCH FROM duration)), 86400) / 3600) AS total_hours,
                        FLOOR(MOD(SUM(EXTRACT(EPOCH FROM duration)), 3600) / 60) AS total_minutes
                    FROM durations
                    GROUP BY sap_id, product_code, zone, region, sales_area, location_name
                    ORDER BY sap_id, product_code, zone, region, sales_area, location_name;"""
        data = await hpcl_ceg_model.Alerts.get_aggr_data(query=query, limit=0)
        data = pd.DataFrame(data.get("data", []))
        if not data.empty:
            data['product_code'] = data['product_code'].astype(str).map(await product_map())
            return {
                "status": True, "message": "Success",
                "counts": data.to_dict(orient='records'),
                "data": data.to_dict(orient='records')
            }

        return {"status": False, "message": "No Data Found", "counts": [], "data": []}

    @staticmethod
    async def dry_out_trends(filters, cross_filters, drill_state):
        _filters = []
        filter_map = defaultdict(list)
        daterange = f""" created_at::date = '{urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d")}' """

        if cross_filters:
            for filter in cross_filters:
                if "DATE" in filter.key:
                    start_date, end_date = filter.value.split(",")[0], filter.value.split(",")[-1]
                    if start_date == end_date:
                        daterange = f""" created_at::date = '{start_date}' """
                    else:
                        daterange = f""" created_at::date BETWEEN '{start_date}' AND '{end_date}' """
                    continue
                #_filters.append(f"{filter.key} = '{filter.value}'")
                filter_map[filter.key].append(filter.value)

        if filters:
            for filter in filters:
                filter_map[filter.key].append(filter.value)
                #_filters.append(f"{filter.key} = '{filter.value}'")
        
        for key, values in filter_map.items():
            if len(values) > 1:
                _filters.append(f"{key} IN ({', '.join([f"'{v}'" for v in values])})")
            else:
                _filters.append(f"{key} = '{values[0]}'")

        # Construct WHERE clause
        where_clauses = [f"interlock_name = 'Dry Out Each Indent Wise MainFlow'", "indent_status not in ('Cancelled', 'TempClosed', 'ProductLowLevel', 'OfflineOrFalseAlarm', 'NotAvailable')", daterange, "mark_as_false = 'true'"]
        if _filters:
            where_clauses.extend(_filters)

        where_clause = " AND ".join(where_clauses)

        # Final query
        query = (
            f"SELECT zone, sap_id, location_name, terminal_plant_id, product_code, created_at, count(sap_id) total_count "
            f"FROM alerts "
            f"WHERE {where_clause} "
            f"GROUP BY zone, sap_id, product_code, location_name, terminal_plant_id, created_at "
            f"ORDER BY zone, sap_id, product_code"
        )
        data = await hpcl_ceg_model.Alerts.get_aggr_data(query=query, limit=0)
        data = pd.DataFrame(data.get("data", []))
        if not data.empty:
            data['product_code'] = data['product_code'].astype(str).map(await product_map())
            data['created_date'] = pd.to_datetime(data['created_at']).dt.date
            data['created_at'] = pd.to_datetime(data['created_at']).dt.strftime('%Y-%b-%d %H:%M:%S')

            daily_counts = data.groupby(['created_date', 'product_code'])['total_count'].sum().reset_index()

            date_range = pd.date_range(start=daily_counts['created_date'].min(),
                                       end=daily_counts['created_date'].max()).date

            products = daily_counts['product_code'].unique()

            full_index = pd.MultiIndex.from_tuples(itertools.product(date_range, products),
                                                   names=['created_date', 'product_code'])

            daily_counts = daily_counts.set_index(['created_date', 'product_code']).reindex(full_index,
                                                                                            fill_value=0).reset_index()

            daily_counts = daily_counts.rename(columns={'created_date': 'report_date', 'total_count': 'total_dryouts'})
            data = data.rename(columns={'created_date': 'report_date', 'total_count': 'total_dryouts'})
            return {
                "status": True, "message": "Success",
                "counts": daily_counts.to_dict(orient='records'),
                "data": data.to_dict(orient='records')
            }

        return {"status": False, "message": "No Data Found", "counts": [], "data": []}

    @staticmethod
    async def permanent_dry_out_trends(filters, cross_filters, drill_state):
        filter_map = defaultdict(list)
        _filters = []
        where_clauses = []

        if cross_filters:
            for filter in cross_filters:
                filter_map[filter.key].append(filter.value)
        
        if filters:
            for filter in filters:
                filter_map[filter.key].append(filter.value)
        
        for key, values in filter_map.items():
            if len(values) > 1:
                _filters.append(f"{key} IN ({', '.join([f"'{v}'" for v in values])})")
            else:
                _filters.append(f"{key} = '{values[0]}'")
        
        if _filters:
            where_clauses.extend(_filters)

        where_clause = " AND " + " AND ".join(where_clauses)

        query = (f"SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month, sap_id, product_code, "
                 f"COUNT(*) AS total_count FROM alerts WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow' "
                 f"AND alert_status = 'Open' AND created_at <= NOW() - INTERVAL '5 days' AND "
                 f"created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months' {where_clause} "
                 f"GROUP BY month, sap_id, product_code ORDER BY month, sap_id, product_code")
        
        data = await hpcl_ceg_model.Alerts.get_aggr_data(query=query, limit=0)
        data = pd.DataFrame(data.get("data", []))
        if data.empty:
            return {"status": False, "message": "No Data Found", "counts": [], "data": []}

        data['product_code'] = data['product_code'].astype(str).map(await product_map())
        data['month'] = pd.to_datetime(data['month'], format="%Y-%m") + MonthEnd(0)
        full_months = pd.date_range(end=data['month'].max(), periods=3, freq='M')
        products = data['product_code'].unique()
        full_index = pd.MultiIndex.from_product(
            [full_months, products],
            names=['month', 'product_code']
        )

        df = data.groupby(['month', 'product_code'])['total_count'].sum().reset_index()
        df = df.set_index(['month', 'product_code']).reindex(full_index, fill_value=0).reset_index()
        df = df.rename(columns={'total_count': 'permanent_dryout_count'})
        df['month'] = df['month'].dt.strftime('%Y-%b')
        data['month'] = data['month'].dt.strftime('%Y-%b')
        return {
            "status": True, "message": "Success",
            "counts": df.to_dict(orient='records'),
            "data": data.to_dict(orient='records')
        }

    @staticmethod
    async def frequently_dry_out_trends(filters, cross_filters, drill_state):
        filter_map = defaultdict(list)
        _filters = []
        where_clauses = []

        if cross_filters:
            for filter in cross_filters:
                filter_map[filter.key].append(filter.value)
        
        if filters:
            for filter in filters:
                filter_map[filter.key].append(filter.value)
        
        for key, values in filter_map.items():
            if len(values) > 1:
                _filters.append(f"{key} IN ({', '.join([f"'{v}'" for v in values])})")
            else:
                _filters.append(f"{key} = '{values[0]}'")
        
        if _filters:
            where_clauses.extend(_filters)

        where_clause = " AND " + " AND ".join(where_clauses)

        query = f"""WITH product_level_dryouts AS (
                      SELECT DISTINCT
                        sap_id,
                        product_code,
                        location_name,
                        DATE(indent_raised_date) AS dryout_day,
                        TO_CHAR(created_at, 'YYYY-Mon') AS month
                      FROM alerts
                      WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow' and indent_status not in ('Cancelled', 'TempClosed', 'ProductLowLevel', 'OfflineOrFalseAlarm', 'NotAvailable')
                        AND created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months' {where_clause}
                    )
                    
                    SELECT
                      month,
                      sap_id,
                      product_code,
                      location_name,
                      COUNT(*) AS dryout_count
                    FROM product_level_dryouts
                    GROUP BY month, sap_id, product_code, location_name
                    HAVING COUNT(*) > 3
                    ORDER BY month, sap_id, product_code, dryout_count DESC"""

        data = await hpcl_ceg_model.Alerts.get_aggr_data(query=query, limit=0)
        data = pd.DataFrame(data.get("data", []))
        if data.empty:
            return {
                "status": False,
                "message": "No data found",
                "counts": [],
                "data": []
            }
        data['product_code'] = data['product_code'].astype(str).map(await product_map())
        # Convert month column to datetime for range filling
        data['month'] = pd.to_datetime(data['month'], format="%Y-%b") + MonthEnd(0)

        # Get full month range (3 months) and product list
        full_months = pd.date_range(end=data['month'].max(), periods=3, freq='M')
        products = data['product_code'].unique()

        # Create full index and reindex for missing combinations
        full_index = pd.MultiIndex.from_product(
            [full_months, products],
            names=['month', 'product_code']
        )
        monthly_counts = data.groupby(["sap_id", "product_code", "month"]).size().reset_index(name="dryout_count")
        monthly_counts = monthly_counts.groupby(["product_code", "month"])["dryout_count"].sum().reset_index()
        monthly_counts['month'] = monthly_counts['month'].dt.strftime('%Y-%b')

        # Format raw data month as well
        data['month'] = data['month'].dt.strftime('%Y-%b')

        return {
            "status": True,
            "message": "Success",
            "counts": monthly_counts.rename(columns={'dryout_count': 'frequent_dryout_count'}).to_dict(
                orient='records'),
            "data": data.to_dict(orient='records')
        }

    @staticmethod
    async def dry_out_ro_loss(filters, cross_filters, drill_state, resp_level='all'):
        print("resp_level: ", resp_level)
        _filters = []
        daterange = ""
        group_by_col = []
        if cross_filters:
            for filter in cross_filters:
                if "DATE" in filter.key:
                    start_date, end_date = filter.value.split(",")[0], filter.value.split(",")[-1]
                    if filter.val == 'monthly':
                        _today = datetime.strptime(filter.value.split(",")[0], '%Y-%m-%d')
                        start_date, end_date = await va_analysis.get_period_datetime(period='monthly', today=_today)
                    if start_date == end_date:
                        daterange = f""" loss_month = '{start_date.strftime("%Y-%b")}' """
                    else:
                        months = pd.date_range(start=start_date, end=end_date, freq='MS').strftime('%Y-%b')
                        months_tuple = tuple(months)
                        if len(months_tuple) > 1:
                            daterange = f""" loss_month IN {months_tuple} """
                        else:
                            daterange = f""" loss_month = '{months_tuple[0]}' """
                    continue
                _filters.append(f"{filter.key} = '{filter.value}'")

        if filters:
            for filter in filters:
                if filter.key == 'month':
                    group_by_col.append("zone")
                    continue
                if filter.key == 'zone':
                    group_by_col.append("region")
                if filter.key == 'region':
                    group_by_col.append("sales_area")
                if filter.key == 'sales_area':
                    group_by_col.append("location_name")
                _filters.append(f"{filter.key} = '{filter.value}'")

        # Construct WHERE clause
        where_clauses = []
        if _filters:
            where_clauses.extend(_filters)

        if daterange:
            where_clauses.append(daterange)

        where_clause = " AND ".join(where_clauses)
        query = "select * from dry_out_ro_loss"
        if where_clause:
            query = f"""select * from dry_out_ro_loss where {where_clause}"""

        data = await hpcl_ceg_model.DryOutRoLoss.get_aggr_data(query=query, limit=0)
        data = pd.DataFrame(data.get("data", []))
        for col in ['id', 'created_at', 'updated_at', 'entity_id']:
            if col in data.columns:
                del data[col]
        if data.empty:
            return {
                "status": False,
                "message": "No data found",
                "counts": [],
                "data": []
            }
        data['loss_month_dt'] = pd.to_datetime(data['loss_month'], format='%Y-%b')
        data = data.sort_values('loss_month_dt')
        data = data.drop(columns='loss_month_dt')
        if resp_level == 'pie-chart':
            group_by_col = []
        data["estimated_loss"] = data["estimated_loss"] / 1000
        data_count = data.groupby(['loss_month', 'product_name'] + group_by_col)[[
            'estimated_loss', 'estimated_loss_amount']].sum().reset_index()
        data_count["estimated_loss"] = data_count["estimated_loss"].round(2)
        data_count["estimated_loss_amount"] = data_count["estimated_loss_amount"].round(2)
        data_count['loss_month_dt'] = pd.to_datetime(data_count['loss_month'], format='%Y-%b')
        data_count = data_count.sort_values('loss_month_dt')
        data_count = data_count.drop(columns='loss_month_dt')

        if resp_level in ['count', 'pie-chart']:
            return {
                "status": True,
                "message": "Success",
                "counts": data_count.to_dict(orient='records'),
                "data": []
            }
        data = data[
            ["loss_month", "zone", "sales_area", "region", "location_name",
             "sap_id", "product_name", "tank_no", "avg_daily_sales", "estimated_loss",
             "avg_daily_sales_amount", "estimated_loss_amount", "dryout_days"]
        ]
        return {
            "status": True,
            "message": "Success",
            "count": data_count.to_dict(orient='records'),
            "data": data.to_dict(orient='records')
        }
    
    @staticmethod
    async def vts_violation_analytics(filters, cross_filters, drill_state):

        analytics_query = lpg_plant_queries.lpg_plant_query.get("vts_violation_analytics")
        analytics_query_ = analytics_query

        if filters:
            filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
            for filter_ in filters:
                if filter_.key:
                    # Update the key of the filter to include the alias 'a.'
                    filter_.key = f"{filter_.key}"
                
            # After modifying the filters, send the updated filters to apply_filter_drilldown
            analytics_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(analytics_query, filters, drill_state)
        try:
            # Execute the query
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(analytics_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print("Error: ", e)
            # Retry with the base query in case of an error
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(analytics_query)

        # Process the results
        data = connector_factory.PostgreSQLConnector('LPG_PLANT').process_recommendations(keys, res)

        active_locations = set()
        inactive_locations = set()
        total_alerts = 0
        alert_distribution = defaultdict(int)
        top_alerts = defaultdict(int)
        interlock_alerts = defaultdict(lambda: defaultdict(int))

        # Process each alert
        for alert in data:
            sap_id = alert['sap_id']
            alert_status = alert['alert_status']
            severity = alert['severity']
            severity_count = alert['severity_count']
            interlock_name = alert['violation_name']

            # Update active and inactive locations
            if alert_status == "Close":
                inactive_locations.add(sap_id)
            # elif alert_status == "Open":
            #     active_locations.add(sap_id)
            else:
                active_locations.add(sap_id)

            # Update total alerts
            total_alerts += severity_count

            # Update alert distribution by severity
            alert_distribution[severity] += severity_count

            # Update top alerts by interlock name
            top_alerts[interlock_name] += severity_count

            interlock_alerts[interlock_name][severity] += severity_count


        # Format the output
        result = {
            "activeLocations": len(active_locations),
            "inactiveLocations": len(inactive_locations),
            "totalAlerts": f"{total_alerts:,}",
            "alertDistribution": [
                {"name": severity, "value": severity_count}
                for severity, severity_count in alert_distribution.items()
            ],
            "top10Alerts": [
                {"name": name, "value": value}
                for name, value in sorted(top_alerts.items(), key=lambda x: x[1], reverse=True)[:10]
            ],
            "interlock_alerts": [
        {
            "interlock_name": interlock_name,
            **{key: value for key, value in details.items() if key != "interlock_name"}
        }
        for interlock_name, details in interlock_alerts.items()
    ]

        }

        return {"status": True, "message": "Success", "data": result}
