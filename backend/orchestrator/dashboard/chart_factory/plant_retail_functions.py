from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import urdhva_base
import json
import os
import polars as pl
import pandas as pd
import uuid
import typing
import importlib
import traceback
import math
import locale
import utilities.helpers
import re
import logging
from decimal import Decimal
from datetime import datetime, timedelta
from fastapi.responses import FileResponse, JSONResponse
from orchestrator.dbconnector.widget_actions import widget_actions


async def get_distinct_ro_retail_info(sbu, company, zone, state, status,ro_status):
    try:
        sbu_tables = ["plant_ro_infra"]
        select_columns = "sbu, company, zone, state, status, ro_status"

        union_queries = [f"SELECT {select_columns} FROM {table}" for table in sbu_tables]
        union_block = "\nUNION\n".join(union_queries)

        # Base query
        query = f"""
            SELECT DISTINCT {select_columns}
            FROM (
                {union_block}
            ) AS combined_infra
        """

        conditions = []
        if sbu:
            conditions.append(f"sbu = '{sbu}'")
        if zone:
            zone_str = "', '".join(zone)
            conditions.append(f"zone IN ('{zone_str}')")
        if state:
            state_str = "', '".join(state)
            conditions.append(f"state IN ('{state_str}')")
        if status:
            status_str = "', '".join(status)
            conditions.append(f"status IN ('{status_str}')")
        if company:
            company_str = "', '".join(company)
            conditions.append(f"company IN ('{company_str}')")

        if ro_status:
            ro_status_str = "', '".join(ro_status)
            conditions.append(f"company IN ('{ro_status_str}')")

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        # Execute query
        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        rows = result.get("data", [])

        def add_if_valid(val, target_set):
            if val and str(val).strip():
                target_set.add(str(val).strip())

        sbu_set, company_set, zone_set, state_set, status_set, ro_status_set = set(), set(), set(), set(), set(), set()

        for row in rows:
            add_if_valid(row.get("sbu"), sbu_set)
            add_if_valid(row.get("company"), company_set)
            add_if_valid(row.get("zone"), zone_set)
            add_if_valid(row.get("state"), state_set)
            add_if_valid(row.get("status"), status_set)
            add_if_valid(row.get("ro_status"), ro_status_set)

        return {
            "status": True,
            "message": "success",
            "data": {
                "sbu": sorted(sbu_set),
                "company": sorted(company_set),
                "zone": sorted(zone_set),
                "state": sorted(state_set),
                "status": sorted(status_set),
                "ro_status": sorted(ro_status_set)
            }
        }

    except Exception as e:
        import logging
        logging.exception("Error while fetching distinct infra info")
        return {"error": str(e)}

async def get_all_plant_ro_info(filters, cross_filters, drill_state, limit, time_grain):
    query = ' * from plant_ro_infra'
    if filters:
        query = await widget_actions.WidgetActions.apply_filter_drilldown(query, filters, drill_state)
    print(query)

    result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
    rows = result.get("data", [])


    # print('rows: ',rows)
    return rows

async def get_plant_ro_count_info(filters, cross_filters, drill_state, limit, time_grain):
    try:
        query = '''  
                    SUM(CAST(retail_outlet AS INT)) AS retail_outlet,
                    SUM(CAST(ros_commissioned AS INT)) AS ros_commissioned,
                    SUM(CAST(ros_decommissioned AS INT)) AS ros_decommissioned,
                    SUM(CAST(ros_commissioned AS INT)) - SUM(CAST(ros_decommissioned AS INT)) AS netGrowth,
                    SUM(CAST(retail_outlet AS INT)) * 1.0 / COUNT(DISTINCT zone) AS avg_outlets_per_zone,
                    SUM(CASE WHEN ro_status = 'Rural' THEN CAST(retail_outlet AS INT) ELSE 0 END) * 1.0 /
                    NULLIF(SUM(CASE WHEN ro_status = 'Regular' THEN CAST(retail_outlet AS INT) ELSE 0 END), 0) 
                    AS rural_regular_ratio
                FROM plant_ro_infra
                '''

        if filters:
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, filters, drill_state)

        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        result = result.get("data", [])

        return {"status": True, "message": "success", "data": result}

    except Exception as e:
        print(f"Error in get_plant_ro_count_info: {e}")
        return {"status": False, "message": f"Failed to fetch plant RO count info: {str(e)}","data": []}

async def get_retail_company_info(filters, cross_filters, drill_state, limit, time_grain):
    try:
        query = ''' company, SUM(retail_outlet) AS retail_outlet
                    FROM plant_ro_infra
                    GROUP BY company '''

        if filters:
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, filters, drill_state)

        retail = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        retail = retail.get("data", [])

        return {"status": True, "message": "success", "data": retail}

    except Exception as e:
        print(f"Error in get_plant_ro_count_info: {e}")
        return {"status": False, "message": f"Failed to fetch retail company info: {str(e)}","data": []}

async def get_top_five_ro_info(filters, cross_filters, drill_state, limit, time_grain):
    try:
        query = ''' 
                SELECT company,
                       SUM(ros_commissioned) AS total_ros_commissioned,
                       SUM(ros_decommissioned) AS total_ros_decommissioned
                FROM plant_ro_infra
                GROUP BY company
                ORDER BY total_ros_commissioned DESC, total_ros_decommissioned DESC
                LIMIT 5
        '''

        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        result = result.get("data", [])

        return {"status": True, "message": "success", "data": result}

    except Exception as e:
        traceback.print_exc()
        return {"status": False, "message": f"Error occurred: {str(e)}", "data": []}


async def get_zone_wise_ro_info(filters, cross_filters, drill_state, limit, time_grain):
    try:
        query = '''  zone,ro_status, SUM(CAST(retail_outlet AS INT)) AS retail_outlet
                    FROM plant_ro_infra
                    GROUP BY zone,ro_status'''

        if filters:
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, filters, drill_state)

        retail = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        retail = retail.get("data", [])

        return {"status": True, "message": "success", "data": retail}

    except Exception as e:
        print(f"Error in get_plant_ro_count_info: {e}")
        return {"status": False, "message": f"Failed to fetch retail company info: {str(e)}","data": []}


async def get_zone_table_ro_info(filters, cross_filters, drill_state, limit, time_grain):
    try:
        query = '''   zone,company,status,ro_status, SUM(CAST(retail_outlet AS INT)) AS retail_outlet,
                        SUM(CAST(ros_commissioned AS INT)) AS ros_commissioned, 
                        SUM(CAST(ros_decommissioned AS INT)) AS ros_decommissioned 
                        FROM plant_ro_infra 
                        GROUP BY zone,company,status,ro_status'''

        if filters:
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, filters, drill_state)

        retail = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        retail = retail.get("data", [])
        retail = [row for row in retail if row.get("ro_status") != "Total"]

        return {"status": True, "message": "success", "data": retail}

    except Exception as e:
        print(f"Error in get_plant_ro_count_info: {e}")
        return {"status": False, "message": f"Failed to fetch retail company info: {str(e)}","data": []}

async def get_ro_status_ro_info(filters, cross_filters, drill_state, limit, time_grain):
    try:
        query = '''  ro_status, SUM(CAST(retail_outlet AS INT)) AS retail_outlet
                    FROM plant_ro_infra
                    GROUP BY ro_status'''

        if filters:
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, filters, drill_state)

        retail = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        retail = retail.get("data", [])
        retail = [row for row in retail if row.get("ro_status") != "Total"]

        return {"status": True, "message": "success", "data": retail}

    except Exception as e:
        print(f"Error in get_plant_ro_count_info: {e}")
        return {"status": False, "message": f"Failed to fetch retail company info: {str(e)}","data": []}

async def get_plant_cng_count_info(filters, cross_filters, drill_state, limit, time_grain):
    try:
        query = ''' SUM(CAST(cng_outlet AS INT)) AS cng_outlet,
                          SUM(CAST(ros_commissioned AS INT)) AS ros_commissioned,
                          SUM(CAST(ros_decommissioned AS INT)) AS ros_decommissioned,
                          SUM(CAST(ros_commissioned AS INT)) - SUM(CAST(ros_decommissioned AS INT)) AS netGrowth,
                          ROUND(SUM(CAST(cng_outlet AS INT)) * 1.0 / COUNT(DISTINCT zone), 0) AS avg_outlets_per_zone
                   FROM plant_cng_infra'''

        if filters:
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, filters, drill_state)

        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        result = result.get("data", [])

        return {"status": True, "message": "success", "data": result}

    except Exception as e:
        print(f"Error in get_plant_cng_count_info: {e}")
        return {"status": False, "message": f"Failed to fetch plant CNG count info: {str(e)}","data": []}

async def get_retail_company_cng_info(filters, cross_filters, drill_state, limit, time_grain):
    try:
        query = ''' company, SUM(cng_outlet) AS cng_outlet
                    FROM plant_cng_infra
                    GROUP BY company '''

        if filters:
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, filters, drill_state)

        retail = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        retail = retail.get("data", [])

        return {"status": True, "message": "success", "data": retail}

    except Exception as e:
        print(f"Error in get_retail_company_cng_info: {e}")
        return {"status": False, "message": f"Failed to fetch retail company info: {str(e)}","data": []}

async def get_plant_ev_count_info(filters, cross_filters, drill_state, limit, time_grain):
    try:
        query = '''  
                COUNT(status) AS total_stations,
                SUM(CAST(battery_swapping_stations AS INT)) AS battery_swapping_stations,
                SUM(CAST(vehicle_charging_stations AS INT)) AS vehicle_charging_stations,
                COUNT(CASE WHEN fame_status ILIKE '%FAME%' THEN 1 END) AS fame_stations,
                COUNT(CASE WHEN non_fame_status ILIKE '%FAME%' THEN 1 END) AS non_fame_stations,
                COUNT(CASE WHEN status ILIKE 'Active' THEN 1 END) AS active_stations,
                COUNT(CASE WHEN status ILIKE 'Inactive' THEN 1 END) AS inactive_stations
            FROM plant_ev_infra
        '''

        if filters:
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, filters, drill_state)

        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        result = result.get("data", [])

        return {"status": True, "message": "success", "data": result}

    except Exception as e:
        print(f"Error in get_plant_ev_count_info: {e}")
        return {
            "status": False, "message": f"Failed to fetch plant EV count info: {str(e)}", "data": []}



async def get_all_ev_info(filters, cross_filters, drill_state, limit, time_grain):
    query = ' * from plant_ev_infra'
    if filters:
        query = await widget_actions.WidgetActions.apply_filter_drilldown(query, filters, drill_state)

    result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
    rows = result.get("data", [])
    return rows

async def get_distinct_ev_retail_info(sbu, company, zone, state, status):
    try:
        sbu_tables = ["plant_ev_infra"]
        select_columns = "sbu, company, zone, state, status"

        union_queries = [f"SELECT {select_columns} FROM {table}" for table in sbu_tables]
        union_block = "\nUNION\n".join(union_queries)

        # Base query
        query = f"""
            SELECT DISTINCT {select_columns}
            FROM (
                {union_block}
            ) AS combined_infra
        """

        conditions = []
        if sbu:
            conditions.append(f"sbu = '{sbu}'")
        if zone:
            zone_str = "', '".join(zone)
            conditions.append(f"zone IN ('{zone_str}')")
        if state:
            state_str = "', '".join(state)
            conditions.append(f"state IN ('{state_str}')")
        if status:
            status_str = "', '".join(status)
            conditions.append(f"status IN ('{status_str}')")
        if company:
            company_str = "', '".join(company)
            conditions.append(f"company IN ('{company_str}')")

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        # Execute query
        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        rows = result.get("data", [])

        def add_if_valid(val, target_set):
            if val and str(val).strip():
                target_set.add(str(val).strip())

        sbu_set, company_set, zone_set, state_set, status_set = set(), set(), set(), set(), set()

        for row in rows:
            add_if_valid(row.get("sbu"), sbu_set)
            add_if_valid(row.get("company"), company_set)
            add_if_valid(row.get("zone"), zone_set)
            add_if_valid(row.get("state"), state_set)
            add_if_valid(row.get("status"), status_set)

        return {
            "status": True,
            "message": "success",
            "data": {
                "sbu": sorted(sbu_set),
                "company": sorted(company_set),
                "zone": sorted(zone_set),
                "state": sorted(state_set),
                "status": sorted(status_set),
            }
        }

    except Exception as e:
        import logging
        logging.exception("Error while fetching distinct infra info")
        return {"error": str(e)}

async def get_ev_company_info(filters, cross_filters, drill_state, limit, time_grain):
    try:
        query = ''' company, SUM(CAST(battery_swapping_stations AS INT)) AS battery_swapping_stations,
                            SUM(CAST(vehicle_charging_stations AS INT)) AS vehicle_charging_stations
                    FROM plant_ev_infra
                    GROUP BY company '''

        if filters:
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, filters, drill_state)

        retail = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        retail = retail.get("data", [])

        return {"status": True, "message": "success", "data": retail}

    except Exception as e:
        print(f"Error in get_plant_ro_count_info: {e}")
        return {"status": False, "message": f"Failed to fetch retail company info: {str(e)}","data": []}

async def get_zone_wise_ev_info(filters, cross_filters, drill_state, limit, time_grain):
    try:
        query = '''  zone, SUM(CAST(battery_swapping_stations AS INT)) AS battery_swapping_stations,
                            SUM(CAST(vehicle_charging_stations AS INT)) AS vehicle_charging_stations
                    FROM plant_ev_infra
                    GROUP BY zone '''

        if filters:
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, filters, drill_state)

        retail = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        retail = retail.get("data", [])

        return {"status": True, "message": "success", "data": retail}

    except Exception as e:
        print(f"Error in get_plant_ro_count_info: {e}")
        return {"status": False, "message": f"Failed to fetch retail company info: {str(e)}","data": []}

async def get_top_five_cng_info(filters, cross_filters, drill_state, limit, time_grain):
    try:
        query = ''' 
                SELECT company,
                       SUM(ros_commissioned) AS total_ros_commissioned,
                       SUM(ros_decommissioned) AS total_ros_decommissioned
                FROM plant_cng_infra
                GROUP BY company
                ORDER BY total_ros_commissioned DESC, total_ros_decommissioned DESC
                LIMIT 5
        '''

        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        result = result.get("data", [])

        return {"status": True, "message": "success", "data": result}

    except Exception as e:
        traceback.print_exc()
        return {"status": False, "message": f"Error occurred: {str(e)}", "data": []}


async def get_distinct_cng_retail_info(sbu, company, zone, state, status):
    try:
        sbu_tables = ["plant_cng_infra"]
        select_columns = "sbu, company, zone, state, status"

        union_queries = [f"SELECT {select_columns} FROM {table}" for table in sbu_tables]
        union_block = "\nUNION\n".join(union_queries)

        query = f"""
            SELECT DISTINCT {select_columns}
            FROM (
                {union_block}
            ) AS combined_infra
        """

        conditions = []
        if sbu:
            conditions.append(f"sbu = '{sbu}'")
        if zone:
            zone_str = "', '".join(zone)
            conditions.append(f"zone IN ('{zone_str}')")
        if state:
            state_str = "', '".join(state)
            conditions.append(f"state IN ('{state_str}')")
        if status:
            status_str = "', '".join(status)
            conditions.append(f"status IN ('{status_str}')")
        if company:
            company_str = "', '".join(company)
            conditions.append(f"company IN ('{company_str}')")

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        rows = result.get("data", [])

        def add_if_valid(val, target_set):
            if val and str(val).strip():
                target_set.add(str(val).strip())

        sbu_set, company_set, zone_set, state_set, status_set = set(), set(), set(), set(), set()

        for row in rows:
            add_if_valid(row.get("sbu"), sbu_set)
            add_if_valid(row.get("company"), company_set)
            add_if_valid(row.get("zone"), zone_set)
            add_if_valid(row.get("state"), state_set)
            add_if_valid(row.get("status"), status_set)

        return {
            "status": True,
            "message": "success",
            "data": {
                "sbu": sorted(sbu_set),
                "company": sorted(company_set),
                "zone": sorted(zone_set),
                "state": sorted(state_set),
                "status": sorted(status_set),
            }
        }

    except Exception as e:
        logging.exception("Error while fetching distinct infra info")
        return {"error": str(e)}


async def get_zone_wise_cng_info(filters, cross_filters, drill_state, limit, time_grain):
    try:
        query = ''' 
                sum(cng_outlet) as cng_outlet ,zone from plant_cng_infra group by zone
        '''
        if filters:
            query = await widget_actions.WidgetActions.apply_filter_drilldown(query, filters, drill_state)

        cng = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        cng = cng.get("data", [])

        return {"status": True, "message": "success", "data": cng}
    except Exception as e:
        logging.exception("Error while fetching distinct infra info")
        return {"error": str(e)}