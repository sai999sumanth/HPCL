import urdhva_base
import math
import sys
import asyncio
import numpy as np
import traceback
import pandas as pd
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from orchestrator.dbconnector.widget_actions import lpg_config
from utilities.helpers import calculate_productivity
import math
import glob
import re
import numpy as np
import traceback
import polars as pl
import os
from collections import defaultdict


def build_plant_monthly_aggregated(data):

    month_order = []
    seen = set()

    for row in data:
        m = row["Month"]
        if m not in seen:
            seen.add(m)
            month_order.append(m)

    plant_dict = defaultdict(dict)

    for row in data:
        plant = row["Plant"]
        month = row["Month"]
        plant_dict[plant][month] = row

    result = []

    for plant, month_data in plant_dict.items():

        ordered_months = []
        for m in month_order:
            if m in month_data:
                ordered_months.append(month_data[m])

        result.append({
            "plant": plant,
            "zone": ordered_months[0]["Zone"] if ordered_months else None,
            "months": ordered_months
        })

    return result


def build_zone_monthly_aggregated(data):

    month_order = []
    seen = set()

    for row in data:
        m = row["Month"]
        if m not in seen:
            seen.add(m)
            month_order.append(m)

    zone_dict = defaultdict(lambda: defaultdict(dict))

    for row in data:
        zone = row["Zone"]
        plant = row["Plant"]
        month = row["Month"]

        zone_dict[zone][plant][month] = row

    result = []

    for zone, plants in zone_dict.items():

        plant_list = []

        for plant, month_data in plants.items():

            ordered_months = []
            for m in month_order:
                if m in month_data:
                    ordered_months.append(month_data[m])

            plant_list.append({
                "plant": plant,
                "months": ordered_months
            })

        result.append({
            "zone": zone,
            "plants": plant_list
        })

    return result

class LPGOperationsActions:
    # async def plants_dropdown(data: dict):
    #     query = """ select * from lpg_plant_operations_masters """
    #     try:
    #         result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)

    #         plants = []
    #         zones = set()
    #         regions = set()

    #         if result and "data" in result and result["data"]:
    #             for row in result["data"]:
    #                 plants.append({
    #                     "sap_id": str(row["sap_id"]),
    #                     "plant": row["plant_name"]
    #                 })
    #                 if not row["zone"] is None:
    #                     zones.add(row["zone"])
    #                 if not row["region"] is None:
    #                     regions.add(row["region"])

    #         return {
    #             "status": True,
    #             "message": "Success",
    #             "data": {
    #                 "plant": plants,
    #                 "zone": list(zones),
    #                 "region": list(regions),
    #                 "carousel_type": ["12H", "24H", "48H", "72H"]
    #             }
    #         }

    #     except Exception:
    #         print("Exception in plants_dropdown")
    #         print("traceback :", traceback.format_exc())

    @staticmethod
    async def plants_dropdown(data=None):

        print("DATA RECEIVED:", data)

        query = """
            select DISTINCT sap_id, plant_name, zone, region 
            from lpg_plant_operations_masters
        """

        try:
            print("coming in try")
            where_conditions = []

            filters = None

            #  data will now be dictionary (because you wrapped inside payload)
            if isinstance(data, dict):
                filters = data.get("filters")

            print("filters:", filters)

            if filters:
                print("Applying filters...")

                for f in filters:

                    # Now filters are dictionaries
                    key = f.get("key", "").replace('"', '').strip()
                    value = f.get("value")

                    if key.lower() == "zone" and value:
                        where_conditions.append(f"zone = '{value}'")

                    if key.lower() == "sap_id" and value:
                        where_conditions.append(f"sap_id = '{value}'")

            #  Attach WHERE condition
            if where_conditions:
                query += " WHERE " + " AND ".join(where_conditions)

            print("Final Query:", query)

            result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)

            plants = []
            zones = set()
            regions = set()

            if result and "data" in result and result["data"]:
                for row in result["data"]:
                    plants.append({
                        "sap_id": str(row["sap_id"]),
                        "plant": row["plant_name"]
                    })

                    if row.get("zone"):
                        zones.add(row["zone"])

                    if row.get("region"):
                        regions.add(row["region"])

            return {
                "status": True,
                "message": "Success",
                "data": {
                    "plant": plants,
                    "zone": sorted(list(zones)),
                    "region": sorted(list(regions)),
                    "carousel_type": ["12H", "24H", "48H", "72H"]
                }
            }

        except Exception as e:
            print("Exception in plants_dropdown:", str(e))
            raise


    async def get_breaks(plant_id, carousal_id):
        query = f"""SELECT start_time, stop_time FROM public.breaks WHERE plant_id = {plant_id} AND carousal_id = {carousal_id}"""
        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
        if result['data']:
            result = result['data']
        else:
            return False
        breaks = []
        for row in result:
            breaks.append({
                "from": row['start_time'],
                "to": row['stop_time']
            })
        return breaks

    async def get_plant_short_name(sap_id):
        query = f""" SELECT short_name FROM public.plants WHERE erp_id = {sap_id} """
        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=1)
        if result["data"]:
            return result["data"][0]["short_name"]
        return None

    async def get_plant_id_by_short_name(plantShortName):
        query = f""" SELECT MAX(id) as id from public.plants where short_name = '{plantShortName}' """
        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
        if result['data']:
            plant_id = result['data']
            return plant_id[0]['id']
        else:
            return 0

    async def get_carousals_config(sap_id):
        # query = f""" SELECT carousal_id, heads, rated_productivity, production_hrs, breaks FROM public.lpg_carousals WHERE sap_id = {sap_id} """
        # fetching day_end_cutoff from lpg_plants_master
        query = f""" SELECT
                        c.carousal_id,
                        c.heads,
                        c.rated_productivity,
                        c.production_hrs,
                        c.breaks,
                        p.day_end_cutoff
                    FROM public.lpg_carousals c
                    JOIN public.lpg_plants_master p
                        ON c.sap_id = p.sap_id
                    WHERE c.sap_id = {sap_id}
                """
        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
        if not result["data"]:
            return False
        config = {}
        day_end_cutoff = result["data"][0].get("day_end_cutoff") or "05:00:00"
        for row in result["data"]:
            production_hrs = row["production_hrs"]
            breaks = row["breaks"]
            if isinstance(production_hrs, str):
                production_hrs = json.loads(production_hrs)
            if isinstance(breaks, str):
                breaks = json.loads(breaks)
            shift = production_hrs[0]
            config[row["carousal_id"]] = {
                "heads": row["heads"],
                "stdOutput": row["rated_productivity"],
                "times": {
                    "start": shift["start_time"],
                    "end": shift["stop_time"],
                    "breaks": [
                        {
                            "from": b["start_time"],
                            "to": b["stop_time"]
                        }
                        for b in breaks
                    ]
                }
            }
        return {
            "carousals": config,
            "day_end_cutoff": day_end_cutoff
        }

    async def get_carousals(type: str, sap_id: str):
        # plant_short_name = await LPGOperationsActions.get_plant_short_name(sap_id=sap_id)
        # carousal_config = await LPGOperationsActions.get_carousals_config(plant_short_name)
        print(f"Fetching carousal config for sap_id: {sap_id}")
        result = await LPGOperationsActions.get_carousals_config(sap_id=sap_id)
        carousal_config = result["carousals"] if isinstance(result, dict) and "carousals" in result else result
        keys = list(carousal_config.keys())
        if type == 'string':
            return ", ".join(map(str, keys))
        if type == 'array':
            return keys
        if type == 'full':
            return carousal_config
        else:
            return ", ".join(map(str, list(carousal_config.keys())))

    @staticmethod
    async def get_gd_rejection(data: dict):
        try:
            # Single production day range: from_date 05:00 AM → next day 05:00 AM (plant day_end_cutoff)
            production_range = await LPGOperationsActions.get_production_day_range(data["from_date"], data["to_date"], sap_id=data["sap_id"])
            from_date = production_range["start"]
            to_date = production_range["end"]

            if not data.get("carousal", None):
                carousal = await LPGOperationsActions.get_carousals('string', data.get("sap_id"))
                processId = '3,23'

            query = f"""SELECT
                            system_id,
                            process_status,
                            COUNT(event_log_id)
                        FROM event_log
                        WHERE process_date >= '{from_date}'
                            AND process_date < '{to_date}'
                            AND system_id IN ({carousal})
                            AND process_id IN ({processId})
                            AND sap_id = {data['sap_id']}
                        GROUP BY  process_status, system_id """

            results = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
            if results['data']:
                results = results['data']
            else:
                return {}

            if results:
                carousal_wise_data = {}

                for row in results:
                    sys_id = row['system_id']
                    if sys_id not in carousal_wise_data:
                        carousal_wise_data[sys_id] = {
                            'handled': 0,
                            'sortout': 0
                        }

                    carousal_wise_data[sys_id]['handled'] += row['count']
                    if row['process_status'] != 0:
                        carousal_wise_data[sys_id]['sortout'] += row['count']

                # compute rejection_rate per system_id
                for sys_id, stats in carousal_wise_data.items():
                    if stats['handled'] > 0:
                        stats['rejection_rate'] = round((stats['sortout'] / stats['handled']) * 100,
                                                        4)
                    else:
                        stats['rejection_rate'] = 0.0

                return carousal_wise_data
            return False, "No data found"
        except Exception as e:
            print("Exception in gd_rejection :", str(e))
            print("Traceback :", traceback.format_exc())
            return False, "No data found"

    @staticmethod
    async def get_pt_rejection(data: dict):
        try:
            # Single production day range: from_date 05:00 AM → next day 05:00 AM (plant day_end_cutoff)
            production_range = await LPGOperationsActions.get_production_day_range(data["from_date"], data["to_date"], sap_id=data["sap_id"])
            from_date = production_range["start"]
            to_date = production_range["end"]

            if not data.get("carousal", None):
                carousal = await LPGOperationsActions.get_carousals('string', data.get("sap_id"))
            processId = '4,24'

            query = f"""SELECT
                            system_id,
                            process_status,
                            COUNT(event_log_id)
                        FROM event_log
                        WHERE process_date >= '{from_date}'
                            AND process_date < '{to_date}'
                            AND system_id IN ({carousal})
                            AND process_id IN ({processId})
                            AND sap_id = {data['sap_id']}
                        GROUP BY  process_status, system_id"""

            results = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
            if results['data']:
                results = results['data']
            else:
                return {}

            if results:
                carousal_wise_data = {}

                for row in results:
                    sys_id = row['system_id']
                    if sys_id not in carousal_wise_data:
                        carousal_wise_data[sys_id] = {
                            'handled': 0,
                            'sortout': 0
                        }

                    carousal_wise_data[sys_id]['handled'] += row['count']
                    if row['process_status'] != 0:
                        carousal_wise_data[sys_id]['sortout'] += row['count']

                # compute rejection_rate per system_id
                for sys_id, stats in carousal_wise_data.items():
                    if stats['handled'] > 0:
                        stats['rejection_rate'] = round((stats['sortout'] / stats['handled']) * 100,
                                                        4)
                    else:
                        stats['rejection_rate'] = 0.0

                return carousal_wise_data
            return False, "No data found"
        except Exception as e:
            print("Exception in pt_rejection :", str(e))
            print("Traceback :", traceback.format_exc())
            return False, "No data found"

    async def get_cs_rejection(data: dict):
        try:
            # Single production day range: from_date 05:00 AM → next day 05:00 AM (plant day_end_cutoff)
            production_range = await LPGOperationsActions.get_production_day_range(data["from_date"], data["to_date"], sap_id=data["sap_id"])
            from_date = production_range["start"]
            to_date = production_range["end"]

            carousals = await LPGOperationsActions.get_carousals('string', data.get("sap_id"))
            carousal_array = await LPGOperationsActions.get_carousals('array', data.get("sap_id"))

            query = f"""SELECT
                            system_id,
                            process_status,
                            COUNT(production_log_id)
                        FROM production_log
                        WHERE process_date >= '{from_date}'
                            AND process_date < '{to_date}'
                            AND sap_id = {data['sap_id']}
                            AND system_id IN ({carousals})
                            AND process_id IN (2,22)
                        GROUP BY  process_status, system_id"""
            results = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
            if results['data']:
                results = results['data']
            else:
                return {}
            data = {}
            total = {}
            totalSortout = {}
            otherErrors = {}
            commErrorSortout = {}

            for c in carousal_array:
                total[c] = 0
                totalSortout[c] = 0
                otherErrors[c] = 0
                commErrorSortout[c] = 0
            sortoutStatuses = [1040, 2064, 1296, 17424, 1048, 4120, 5392]
            otherErrorStatuses = [1041, 1042, 2192, 4112, 4113, 5136, 6160]
            for row in results:
                carID = row['system_id']
                processID = row['process_status']
                if carID not in data:
                    data[carID] = {}
                data[carID][processID] = row['count']
                total[carID] += row['count']
                if row['process_status'] in otherErrorStatuses:
                    otherErrors[carID] += row['count']
                if row['process_status'] in sortoutStatuses + otherErrorStatuses:
                    totalSortout[carID] += row['count']
                if row['process_status'] < 0 or row['process_status'] == 4096:
                    commErrorSortout[carID] += row['count']

            refData = {}
            for id in carousal_array:
                refData[id] = {
                    'handled': int(total[id]),
                    'cylinder_filled': int(total[id] - totalSortout[id]),
                    'underfilled': int(data.get(id, {}).get(1040, 0)),
                    'overfilled': int(data.get(id, {}).get(2064, 0)),
                    'negative_tare': int(
                        data.get(id, {}).get(1296, 0) + (data.get(id, {}).get(5392, 0))),
                    'positive_tare': int(data.get(id, {}).get(17424, 0)),
                    'timeout': int(data.get(id, {}).get(1048, 0) + data.get(id, {}).get(4120, 0)),
                    'other_errors': int(otherErrors[id]),
                    'sortout': int(totalSortout[id]),
                    'commErrorSortout': int(commErrorSortout[id]),
                    'rejection_rate': round((int(totalSortout[id]) / int(total[id])) * 100,
                                            4) if int(total[id]) > 0 else 0.0
                }
            # print("CS Rejection Data:", refData)
            return refData
        except Exception as e:
            print("Exception in cs_rejection :", str(e))
            print("Traceback :", traceback.format_exc())
            return False, "No data found"

    async def get_cs_rejection_card(data: dict):
        try:
            # Single production day range: from_date 05:00 AM → next day 05:00 AM (plant day_end_cutoff)
            production_range = await LPGOperationsActions.get_production_day_range(data["from_date"], data["to_date"], sap_id=data["sap_id"])
            from_date = production_range["start"]
            to_date = production_range["end"]

            carousals = await LPGOperationsActions.get_carousals('string', data.get("sap_id"))
            carousal_array = await LPGOperationsActions.get_carousals('array', data.get("sap_id"))

            query = f"""SELECT
                            system_id,
                            process_status,
                            COUNT(production_log_id)
                        FROM production_log
                        WHERE process_date >= '{from_date}'
                            AND process_date < '{to_date}'
                            AND sap_id = {data['sap_id']}
                            AND system_id IN ({carousals})
                            AND process_id IN (2,22)
                        GROUP BY  process_status, system_id"""

            results = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
            if results['data']:
                results = results['data']
            else:
                return {}
            data = {}
            total = {}
            totalSortout = {}
            otherErrors = {}
            commErrorSortout = {}

            for c in carousal_array:
                total[c] = 0
                totalSortout[c] = 0
                otherErrors[c] = 0
                commErrorSortout[c] = 0
            sortoutStatuses = [1040, 2064, 1296, 17424, 1048, 4120, 5392]
            otherErrorStatuses = [1041, 1042, 2192, 4112, 4113, 5136, 6160]
            for row in results:
                carID = row['system_id']
                processID = row['process_status']
                if carID not in data:
                    data[carID] = {}
                data[carID][processID] = row['count']
                total[carID] += row['count']
                if row['process_status'] in otherErrorStatuses:
                    otherErrors[carID] += row['count']
                if row['process_status'] in sortoutStatuses + otherErrorStatuses:
                    totalSortout[carID] += row['count']
                if row['process_status'] < 0 or row['process_status'] == 4096:
                    commErrorSortout[carID] += row['count']

            refData = {
                "handled": 0,
                "sortout": 0
            }
            for id in carousal_array:
                refData["handled"] += int(total[id])
                refData["sortout"] += int(totalSortout[id])
            refData["rejection_rate"] = round(
                (int(refData["sortout"]) / int(refData["handled"])) * 100, 4)
            return refData
        except Exception as e:
            print("Exception in getting filling accuracy :", str(e))
            print("Traceback :", traceback.format_exc())
            return False, "No data found"

    #################### Productivity ####################
    async def get_start_end_times(carousal, data):
        # plant_short_name = await LPGOperationsActions.get_plant_short_name(sap_id=data["sap_id"])
        # carousal_config = await LPGOperationsActions.get_carousals_config(plant_short_name)
        carousal_config = await LPGOperationsActions.get_carousals_config(data["sap_id"])
        if not carousal_config:
            raise Exception("Error Processing Request", 1)

        carousals = carousal_config.get("carousals", carousal_config)
        return {
            'start': carousals[carousal]['times']['start'],
            'end': carousals[carousal]['times']['end']
        }

    async def get_production_day_range(from_date: str, to_date: str, sap_id=None):
        # Single production day: from_date 05:00 AM → next day 05:00 AM (day_end_cutoff from lpg_plants_master; default 05:00:00)
        day_end_cutoff = "05:00:00"
        if sap_id:
            query = f"""SELECT day_end_cutoff FROM lpg_plants_master WHERE sap_id = {sap_id}"""
            result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=1)
            if result.get("data") and result["data"][0].get("day_end_cutoff"):
                day_end_cutoff = result["data"][0]["day_end_cutoff"]

        hour = int(str(day_end_cutoff).split(":")[0])
        start = datetime.strptime(from_date, "%Y-%m-%d") + timedelta(hours=hour)
        end = datetime.strptime(to_date, "%Y-%m-%d") + timedelta(days=1, hours=hour)
        # Same as day_end_cutoff (time only); used to decide which production day a timestamp belongs to
        day_boundary = str(day_end_cutoff).split(".")[0]

        return {
            "start": start.strftime("%Y-%m-%d %H:%M:%S"),
            "end": end.strftime("%Y-%m-%d %H:%M:%S"),
            "day_boundary": day_boundary,
        }

    async def build_ot_production_period_query(carousal, data):
        # Production window: from_date 05:00 AM → next day 05:00 AM
        production_range = await LPGOperationsActions.get_production_day_range(data["from_date"], data["to_date"], sap_id=data["sap_id"])
        day_boundary = production_range["day_boundary"]  # e.g. 05:00:00
        from_date = production_range["start"]
        to_date = production_range["end"]

        startEndTimes = await LPGOperationsActions.get_start_end_times(carousal, data)
        endTime = startEndTimes['end']  # shift end; OT starts after this
        # This query only measures OT hours (not normal/break).
        # OT windows:
        #   1) post_shift  : shift end → 23:59:59
        #   2) overnight   : 00:00:00 → before day_boundary (05:00)
        queryString = f"""WITH day_wise_data as (
                select
                    -- Map early-morning records (before 05:00) to previous production day
                    CASE
                        WHEN process_date::time < '{day_boundary}'::time
                        THEN process_date::date - 1
                        ELSE process_date::date
                    END as process_day,
                    to_char(process_date, 'HH24:MI:SS.MS') as process_time,
                    process_date
                FROM production_log
                    where process_date >= '{from_date}'
                    AND process_date < '{to_date}'
                    AND sap_id = {data['sap_id']}
                    AND process_id IN (2, 22)
                    AND cyl_type IN (1, 2)
                    and system_id = {carousal}
                    order by production_log_id asc
            ),
            -- OT evening: cylinders after shift end till midnight
            post_shift_ot_periods as (
                select 
                    process_day,
                    max(process_time::time) - min(process_time::time) as production_time
                from day_wise_data
                where 
                    process_time::time between '{endTime}'::time and '23:59:59.999'::time
                    group by process_day
            ),
            -- OT overnight: cylinders after midnight till before day cutoff (05:00)
            overnight_ot_periods as (
                select 
                    process_day,
                    max(process_time::time) - min(process_time::time) as production_time
                from day_wise_data
                where 
                    process_time::time < '{day_boundary}'::time
                    group by process_day
            )
            select 
                EXTRACT(EPOCH from (select sum(production_time) from overnight_ot_periods)) / 3600 as total_overnight_time,
                EXTRACT(EPOCH from (select sum(production_time) from post_shift_ot_periods)) / 3600 as total_post_shift_time;"""

        return queryString

    async def build_production_gap_query(carousal, phases, from_date, to_date, sap_id):
        minInterruption = lpg_config.min_interruption
        # Single production day range: from_date 05:00 AM → next day 05:00 AM (plant day_end_cutoff)
        production_range = await LPGOperationsActions.get_production_day_range(str(from_date), str(to_date), sap_id=sap_id)
        from_date = production_range["start"]
        to_date = production_range["end"]

        normalGapStringArray = []
        normalGapString = ""
        for working_phase in phases['working']:
            normalGapStringArray.append(
                f"""getGapBetweenTimes(process_time, prev_process_time, '{working_phase['from']}'::text, '{working_phase['to']}'::text)""")
        normalGapString = " + ".join(normalGapStringArray)

        breakGapStringArray = []
        for break_phase in phases['breaks']:
            breakGapStringArray.append(
                f"""getGapBetweenTimes(process_time, prev_process_time, '{break_phase['from']}'::text, '{break_phase['to']}'::text)""")
        breakGapString = " + ".join(breakGapStringArray) if breakGapStringArray else "'0 seconds'::interval"

        overtimeGapStringArray = []
        overtimeGapString = ""
        for over_time_phase in phases['overtime']:
            overtimeGapStringArray.append(
                f"""(process_time::time between '{over_time_phase['from']}'::time and '{over_time_phase['to']}'::time and prev_process_time:: time between '{over_time_phase['from']}'::time and '{over_time_phase['to']}'::time )""")
        overtimeGapString = " or ".join(overtimeGapStringArray)

        normalEndGapStringArray = []
        normalEndGapString = ""
        for normal_end_phase in phases['working']:
            normalEndGapStringArray.append(
                f"""getEndGapForPhase(last_cyl_time, '{normal_end_phase['from']}', '{normal_end_phase['to']}')""")
        normalEndGapString = " + ".join(normalEndGapStringArray)

        breakEndGapStringArray = []
        for break_end_phase in phases['breaks']:
            breakEndGapStringArray.append(
                f"""getEndGapForPhase(last_cyl_time, '{break_end_phase['from']}', '{break_end_phase['to']}')""")
        breakEndGapString = " + ".join(breakEndGapStringArray) if breakEndGapStringArray else "'0 seconds'::interval"

        day_boundary = production_range["day_boundary"]
        queryString = f"""WITH day_wise_data as (
                select
                    -- If time is before day_boundary (e.g. 03:00 < 05:00), count it as previous production day
                    CASE
                        WHEN process_date::time < '{day_boundary}'::time
                        THEN process_date::date - 1
                        ELSE process_date::date
                    END as process_day,
                    to_char(process_date, 'HH24:MI:SS.MS') as process_time,
                    process_date,
                    system_id,
                    process_status,
                    cyl_type,
                    production_log_id
                FROM production_log
                where 
                    -- OLD: process_date between '{from_date} 00:00:00' and '{to_date} 23:59:59.999'
                    process_date >= '{from_date}'
                    AND process_date < '{to_date}'
                    AND sap_id = {sap_id}
                    AND process_id IN (2,22)
                    AND cyl_type IN (1,2)
                    and system_id = {carousal}
                    order by production_log_id asc
            ),
            time_gaps as ( 
                select
                process_day,
                    production_log_id,
                    system_id,
                    process_date,
                    process_time,
                    LAG(process_time) OVER (PARTITION BY system_id, process_day ORDER BY process_time) AS prev_process_time
                FROM day_wise_data
            ),
            grouped_gaps as (
                select 
                    process_day,
                    system_id,
                    process_time,
                    prev_process_time,
                    case 
                        when prev_process_time is not null and ({overtimeGapString})
                        then process_time:: time - prev_process_time:: time
                    else '0 seconds'::interval
                    end as overtime_gap,
                    {breakGapString} as break_gap,
                    {normalGapString} as normal_gap
                from
                time_gaps
            ),
            last_cyl_data as (
                select
                process_day,
                MAX(process_time::time) as last_cyl_time
                from
                day_wise_data
                group by process_day		
            ),
            end_gap_data as ( 
                select 
                process_day,
                last_cyl_time,
                {normalEndGapString} as normal_end_gap,
                {breakEndGapString} as break_end_gap
                from
                last_cyl_data
            ),
            process_days as (
                select 
                    distinct process_day 
                from day_wise_data
            ),
            intervening_gaps_data as (
                SELECT 
                    pd.process_day,
                    COALESCE(SUM(gg.break_gap), interval '0') AS total_break_gap,
                    COALESCE(SUM(gg.normal_gap), interval '0') AS total_normal_gap,
                    COALESCE(SUM(gg.overtime_gap), interval '0') AS total_overtime_gap
                FROM
                    process_days pd
                LEFT JOIN grouped_gaps gg
                    ON pd.process_day = gg.process_day
                    AND (gg.break_gap + gg.normal_gap + gg.overtime_gap) > '{minInterruption} seconds'::interval
                GROUP BY pd.process_day
            )
            select  
                EXTRACT(EPOCH from sum(igd.total_normal_gap + egd.normal_end_gap)) / 3600 as total_normal_gap,
                EXTRACT(EPOCH from sum(igd.total_break_gap + egd.break_end_gap)) / 3600 as total_break_gap,
                EXTRACT(EPOCH FROM sum(igd.total_overtime_gap)) / 3600 as total_overtime_gap
            from intervening_gaps_data igd 
            left join end_gap_data egd on igd.process_day = egd.process_day;"""

        return queryString

    async def get_non_operating_days(carousal, data):
        # Single production day range: from_date 05:00 AM → next day 05:00 AM (plant day_end_cutoff)
        production_range = await LPGOperationsActions.get_production_day_range(data["from_date"], data["to_date"], sap_id=data["sap_id"])
        day_boundary = production_range["day_boundary"]
        from_date = production_range["start"]
        to_date = production_range["end"]
        queryString = F"""WITH all_dates AS (
                      SELECT generate_series('{data["from_date"]}'::date, '{data["to_date"]}'::date, '1 day'::interval) AS process_day),
                        row_counts AS (
                            SELECT
                                CASE
                                    WHEN process_date::time < '{day_boundary}'::time
                                    THEN process_date::date - 1
                                    ELSE process_date::date
                                END AS process_day,
                                COUNT(*) AS row_count
                            FROM
                                production_log
                            WHERE
                                process_date >= '{from_date}'
                                AND process_date < '{to_date}'
                                AND sap_id = {data['sap_id']}
                                AND system_id = {carousal}
                                AND process_id IN (1,2,22)
                                AND process_status NOT IN (16)
                            GROUP BY
                                CASE
                                    WHEN process_date::time < '{day_boundary}'::time
                                    THEN process_date::date - 1
                                    ELSE process_date::date
                                END
                        ),
                        empty_days as (
                          SELECT
                              ad.process_day as days,
                              COALESCE(rc.row_count, 0) AS row_count
                          FROM
                              all_dates ad
                          LEFT JOIN
                              row_counts rc ON ad.process_day = rc.process_day
                          WHERE
                              COALESCE(rc.row_count, 0) < 1
                        )
                        select count(days) from empty_days;"""
        data = await urdhva_base.BasePostgresModel.get_aggr_data(queryString, limit=0)
        if data['data']:
            data = data['data']

        if (data and len(data) > 0):
            return data[0]['count']
        return 0

    async def get_production_gaps(carousal, data):
        from_date = datetime.strptime(f"{data['from_date']}", "%Y-%m-%d").date()
        to_date = datetime.strptime(f"{data['to_date']}", "%Y-%m-%d").date()
        phases = await LPGOperationsActions.get_phases(data)
        queryString = await LPGOperationsActions.build_production_gap_query(carousal,
                                                                            phases[carousal],
                                                                            from_date, to_date,
                                                                            data["sap_id"])
        query3 = await urdhva_base.BasePostgresModel.get_aggr_data(queryString, limit=0)
        if query3['data']:
            query3 = query3['data']
        return query3[0]

    async def get_daily_operating_hours(data):
        phases = await LPGOperationsActions.get_phases(data)
        operating_time = {}

        for key, value in phases.items():
            totalWorkingSeconds = 0
            totalBreakSeconds = 0

            for working_period in value['working']:
                from_date = datetime.strptime(f'{working_period['from']}', "%H:%M:%S")
                to_date = datetime.strptime(f'{working_period['to']}', "%H:%M:%S")
                interval = to_date - from_date
                interval = interval.total_seconds()
                totalWorkingSeconds += interval

            for break_period in value['breaks']:
                from_date = datetime.strptime(f'{break_period['from']}', "%H:%M:%S")
                to_date = datetime.strptime(f'{break_period['to']}', "%H:%M:%S")
                interval = to_date - from_date
                interval = interval.total_seconds()
                totalBreakSeconds += interval

            totalWorkingHours = totalWorkingSeconds / 3600
            totalBreakHours = totalBreakSeconds / 3600
            operating_time[key] = {
                'normal': totalWorkingHours,
                'break': totalBreakHours,
            }
        return operating_time

    async def config_to_phases(config, data=None):
        phases = {}
        carousals = config.get("carousals", config)
        day_end_cutoff = str(config.get("day_end_cutoff") or "05:00:00").split(".")[0]

        # First cylinder per carousel → Normal start = Max(5AM, Min(shift start, first cyl))
        first_cyl_times = {}
        if data and data.get("from_date") and data.get("to_date") and data.get("sap_id"):
            production_range = await LPGOperationsActions.get_production_day_range(
                data["from_date"], data["to_date"], sap_id=data["sap_id"]
            )
            carousal_ids = ",".join(str(k) for k in carousals.keys())
            query = f"""
                SELECT system_id, MIN(process_date)::time AS first_cyl
                FROM production_log
                WHERE process_date >= '{production_range["start"]}'
                  AND process_date < '{production_range["end"]}'
                  AND sap_id = {data["sap_id"]}
                  AND system_id IN ({carousal_ids})
                  AND process_id IN (2, 22)
                  AND cyl_type IN (1, 2)
                GROUP BY system_id
            """
            result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
            for row in (result.get("data") or []):
                t = str(row["first_cyl"]).split(".")[0]
                first_cyl_times[row["system_id"]] = t
                first_cyl_times[str(row["system_id"])] = t

        for key, value in carousals.items():
            start = value['times']['start']
            end = value['times']['end']
            breaks = value['times']['breaks']

            first_cyl = first_cyl_times.get(key) or first_cyl_times.get(str(key))
            if first_cyl:
                start = max(day_end_cutoff, min(start, first_cyl))

            working_periods = []
            break_periods = []
            overtime_periods = []

            # NORMAL : start → shift end (breaks excluded)
            # OT     : shift end → 23:59:59, and 00:00:00 → day_end_cutoff
            current_start = start

            for b in breaks:
                break_start = b['from']
                break_end = b['to']
                if break_end <= current_start:
                    continue
                if break_start < current_start:
                    break_start = current_start
                if current_start < break_start:
                    working_periods.append({
                        'from': current_start,
                        'to': break_start
                    })
                break_periods.append({
                    'from': break_start,
                    'to': break_end
                })
                current_start = break_end

            if current_start < end:
                working_periods.append({
                    'from': current_start,
                    'to': end
                })

            overtime_periods.append({
                'from': end,
                'to': '23:59:59'
            })
            overtime_periods.append({
                'from': '00:00:00',
                'to': day_end_cutoff
            })

            phases[key] = {
                'working': working_periods,
                'breaks': break_periods,
                'overtime': overtime_periods
            }

        return phases

    async def get_phases(data):
        # plant_short_name = await LPGOperationsActions.get_plant_short_name(sap_id=data["sap_id"])
        # carousal_config = await LPGOperationsActions.get_carousals_config(plant_short_name)
        carousal_config = await LPGOperationsActions.get_carousals_config(data["sap_id"])
        if not carousal_config:
            raise Exception("Error Processing Request")
        phases = await LPGOperationsActions.config_to_phases(carousal_config, data)
        return phases

    async def get_phased_production_data_query_string(carousal, data):
        # Single production day range: from_date 05:00 AM → next day 05:00 AM (plant day_end_cutoff)
        production_range = await LPGOperationsActions.get_production_day_range(data["from_date"], data["to_date"], sap_id=data["sap_id"])
        range_start = production_range["start"]
        range_end = production_range["end"]

        excludedStatuses = ", ".join(map(str, lpg_config.process_statuses['negativeTare'] +
                                         lpg_config.process_statuses['positiveTare']))
        phases = await LPGOperationsActions.get_phases(data)
        normalPhaseStringArray = []
        normalPhaseString = ""
        for working_phase in phases[carousal]['working']:
            normalPhaseStringArray.append(
                f"""process_date::time between '{working_phase['from']}'::time and '{working_phase['to']}'::time""")
        normalPhaseString = " or ".join(normalPhaseStringArray)

        breakPhaseStringArray = []
        for break_phase in phases[carousal]['breaks']:
            breakPhaseStringArray.append(
                f""" process_date::time between '{break_phase['from']}'::time and '{break_phase['to']}'::time """)
        breakPhaseString = " or ".join(breakPhaseStringArray) if breakPhaseStringArray else "false"

        # explicit OT windows (only after shift end)
        overtimePhaseStringArray = []
        for over_time_phase in phases[carousal]['overtime']:
            overtimePhaseStringArray.append(
                f"""process_date::time between '{over_time_phase['from']}'::time and '{over_time_phase['to']}'::time""")
        overtimePhaseString = " or ".join(overtimePhaseStringArray) if overtimePhaseStringArray else "false"

        queryString = f"""WITH phased_data as (
                    select 
                    *,
                    case 
                        when {normalPhaseString}
                        then 'normal'
                        when {breakPhaseString} 
                        then 'break'
                        when {overtimePhaseString}
                        then 'overtime'
                        else null
                        -- OLD: else 'overtime'
                    end as phase
                    from production_log
                    where 
                        -- OLD: process_date between '{data["from_date"]} 00:00:00' and '{data["to_date"]} 23:59:59.999'
                        process_date >= '{range_start}'
                        AND process_date < '{range_end}'
                        AND sap_id = {data['sap_id']}
                        AND process_id in (2, 22)
                        AND process_status NOT IN ({excludedStatuses})
                        AND system_id = {carousal}
                )
                select 
                    phase,
                    sum(
                    case 
                        when cyl_type = 1 then 1 else 0
                    end 
                    ) as prod_14_2,
                    sum(
                    case 
                        when cyl_type = 2 then 1 else 0
                    end 
                    ) as prod_19
                from 
                    phased_data
                where phase is not null
                group by phase;"""

        return queryString

    async def get_phase_wise_production(carousal, data):
        queryString = await LPGOperationsActions.get_phased_production_data_query_string(carousal,
                                                                                         data)
        data = await urdhva_base.BasePostgresModel.get_aggr_data(queryString, limit=0)

        blankProdData = {
            'prod_14_2': 0,
            'prod_19': 0
        }

        returnData = {
            'normal': blankProdData,
            'break': blankProdData,
            'overtime': blankProdData
        }
        if data['data']:
            for phase_data in data['data']:
                returnData[phase_data['phase']] = phase_data

        return returnData

    async def bottling_data(data: dict):
        carousalsArray = await LPGOperationsActions.get_carousals("array", data["sap_id"])
        bottling = {}
        for carousal in carousalsArray:
            prodData = await LPGOperationsActions.get_phase_wise_production(carousal, data)
            bottling[carousal] = prodData
        return bottling

    async def production_hours_data(data: dict):
        def none_to_zero(d):
            for k, v in d.items():
                if isinstance(v, dict):
                    none_to_zero(v)
                elif v is None:
                    d[k] = 0.0
            return d

        from_date = datetime.strptime(f"{data['from_date']}", "%Y-%m-%d").date()
        to_date = datetime.strptime(f"{data['to_date']}", "%Y-%m-%d").date()
        if from_date > to_date:
            return False
        interval_days = (to_date - from_date).days
        total_intervening_days = interval_days + 1
        carousalsArray = await LPGOperationsActions.get_carousals("array", data["sap_id"])
        dailyOperatingHours = await LPGOperationsActions.get_daily_operating_hours(data)

        production_hours = {}
        for carousal in carousalsArray:
            production_hours[carousal] = await LPGOperationsActions.get_production_gaps(carousal,
                                                                                        data)
            production_hours = {k: none_to_zero(v) for k, v in production_hours.items()}
            production_hours[carousal]['carousal'] = carousal
            production_hours[carousal]['intervening_days'] = total_intervening_days
            production_hours[carousal][
                'non_op_days'] = await LPGOperationsActions.get_non_operating_days(carousal, data)
            production_hours[carousal]['net_op_days'] = total_intervening_days - \
                                                        production_hours[carousal]['non_op_days']
            production_hours[carousal]['daily_op_hours'] = dailyOperatingHours[carousal]
            production_hours[carousal]['max_op_hours'] = {}
            production_hours[carousal]['max_op_hours']['normal'] = dailyOperatingHours[carousal][
                                                                       'normal'] * \
                                                                   production_hours[carousal][
                                                                       'net_op_days']
            production_hours[carousal]['max_op_hours']['break'] = dailyOperatingHours[carousal][
                                                                      'break'] * \
                                                                  production_hours[carousal][
                                                                      'net_op_days']
            production_hours[carousal]['net_op_hours'] = {}
            production_hours[carousal]['net_op_hours']['normal'] = float(
                (production_hours[carousal]['max_op_hours']['normal']) - float(
                    production_hours[carousal]['total_normal_gap']))
            production_hours[carousal]['net_op_hours']['break'] = float(
                (production_hours[carousal]['max_op_hours']['break']) - float(
                    production_hours[carousal]['total_break_gap']))
        return production_hours

    async def get_ot_production_period(carousal, data):
        queryString = await LPGOperationsActions.build_ot_production_period_query(carousal, data)
        data = await urdhva_base.BasePostgresModel.get_aggr_data(queryString, limit=0)
        if data['data']:
            data = data['data']
        return data[0]

    async def ot_production_time(data: dict):
        carousalsArray = await LPGOperationsActions.get_carousals("array", data["sap_id"])
        ot_production = {}
        for carousal in carousalsArray:
            ot_production[carousal] = await LPGOperationsActions.get_ot_production_period(carousal,
                                                                                          data)
        return ot_production

    async def get_prodash_hours(carousal, data):
        """
        Calculate bottling hrs, stoppage hrs, net bottling hrs,
        first cylinder and last cylinder.
        """
        production_range = await LPGOperationsActions.get_production_day_range(data["from_date"], data["to_date"], sap_id=data["sap_id"])
        from_date = production_range["start"]
        to_date = production_range["end"]
        query = f"""
        WITH base AS (

            SELECT
                process_date,
                LAG(process_date) OVER(ORDER BY process_date) prev_time
            FROM production_log
            WHERE process_date >= '{from_date}'
            AND process_date < '{to_date}'
            AND sap_id={data["sap_id"]}
            AND process_id IN (2,22)
            AND cyl_type IN (1,2)
            AND system_id={carousal}
        )
        SELECT
            MIN(process_date) AS first_cylinder,
            MAX(process_date) AS last_cylinder,
            ROUND(
                (
                    EXTRACT(
                        EPOCH FROM (
                            MAX(process_date)
                            -
                            MIN(process_date)
                        )
                    ) / 3600
                ),
                4
            ) AS bottling_hours,
            ROUND(
                (
                    COALESCE(
                        SUM(
                            CASE
                                WHEN
                                EXTRACT(
                                    EPOCH FROM (
                                        process_date
                                        -
                                        prev_time
                                    )
                                ) > 60

                                THEN
                                EXTRACT(
                                    EPOCH FROM (
                                        process_date
                                        -
                                        prev_time
                                    )
                                )

                                ELSE 0
                            END
                        ),
                        0
                    ) / 3600
                ),
                4
            ) AS stoppage_hours

        FROM base
        """
        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)

        if result["data"]:
            row = result["data"][0]
            row["first_cylinder"] = row["first_cylinder"].isoformat() if row["first_cylinder"] else None
            row["last_cylinder"] = row["last_cylinder"].isoformat() if row["last_cylinder"] else None
            row["bottling_hours"] = round(float(row["bottling_hours"] or 0),4)
            row["stoppage_hours"] = round(float(row["stoppage_hours"] or 0),4)
            row["net_bottling_hours"] = round(row["bottling_hours"] - row["stoppage_hours"], 4)
            return row

        return {
            "first_cylinder": None,
            "last_cylinder": None,
            "bottling_hours": 0,
            "stoppage_hours": 0,
            "net_bottling_hours": 0
        }

    async def get_lpg_breakdown(carousal, data, prodash_hours):
        # late_start / early_stop: detail fields for display only (vs configured shift).
        # lpg_breakdown = total_normal_gap (already includes that idle; do not add again).
        # Phases use configured shift start only (no first-cyl adjust).
        shift = await LPGOperationsActions.get_start_end_times(carousal, data)
        late_start = 0.0
        early_stop = 0.0
        first_cyl = prodash_hours.get("first_cylinder")
        last_cyl = prodash_hours.get("last_cylinder")
        prod_day = datetime.strptime(str(data["from_date"])[:10], "%Y-%m-%d").date()
        shift_start_str = str(shift["start"]).split(".")[0]
        shift_end_str = str(shift["end"]).split(".")[0]
        if first_cyl:
            ft = datetime.fromisoformat(str(first_cyl).replace("Z", "+00:00"))
            if ft.tzinfo:
                ft = ft.replace(tzinfo=None)
            ss = datetime.strptime(f"{prod_day} {shift_start_str}", "%Y-%m-%d %H:%M:%S")
            late_start = max(0.0, (ft - ss).total_seconds() / 3600)
        if last_cyl:
            lt = datetime.fromisoformat(str(last_cyl).replace("Z", "+00:00"))
            if lt.tzinfo:
                lt = lt.replace(tzinfo=None)
            se = datetime.strptime(f"{prod_day} {shift_end_str}", "%Y-%m-%d %H:%M:%S")
            early_stop = max(0.0, (se - lt).total_seconds() / 3600)
        late_start = round(late_start, 4)
        early_stop = round(early_stop, 4)

        carousal_config = await LPGOperationsActions.get_carousals_config(data["sap_id"])
        phases_all = await LPGOperationsActions.config_to_phases(carousal_config)
        phases = phases_all.get(carousal) or phases_all.get(str(carousal))
        from_date = datetime.strptime(f"{data['from_date']}", "%Y-%m-%d").date()
        to_date = datetime.strptime(f"{data['to_date']}", "%Y-%m-%d").date()
        query_string = await LPGOperationsActions.build_production_gap_query(
            carousal, phases, from_date, to_date, data["sap_id"]
        )
        gap_result = await urdhva_base.BasePostgresModel.get_aggr_data(query_string, limit=0)
        gap_row = (gap_result.get("data") or [{}])[0]
        total_normal_gap = round(float(gap_row.get("total_normal_gap") or 0), 4)
        # Mid-shift idle only (approx): total normal gap minus late/early display fields
        intervening_gaps = max(0.0, round(total_normal_gap - late_start - early_stop, 4))
        print(
            f"LPG breakdown carousal {carousal}: "
            f"late_start={late_start}, early_stop={early_stop}, "
            f"intervening_gaps={intervening_gaps}, lpg_breakdown={total_normal_gap}"
        )
        return {
            "late_start": late_start,
            "early_stop": early_stop,
            "intervening_gaps": intervening_gaps,
            "gaps": total_normal_gap,
            "lpg_breakdown": total_normal_gap,
        }

    async def get_productivity(data: dict):
        try:
            # STEP 1: phase-wise cylinder counts (NOT get_bottling_summary)
            bottling_data = await LPGOperationsActions.bottling_data(data)
            production_hours_data = await LPGOperationsActions.production_hours_data(data)
            ot_production_time = await LPGOperationsActions.ot_production_time(data)
            phases = ['normal', 'break', 'overtime']
            productivityData = {}
            for key, value in bottling_data.items():
                prodash_hours = await LPGOperationsActions.get_prodash_hours(key, data)
                if not prodash_hours:
                    prodash_hours = {"first_cylinder": None, "last_cylinder": None, "bottling_hours": 0, "stoppage_hours": 0, "net_bottling_hours": 0}

                productivityData[key] = {}
                # Prodash Metrics
                productivityData[key]["first_cylinder"] = prodash_hours["first_cylinder"]
                productivityData[key]["last_cylinder"] = prodash_hours["last_cylinder"]
                productivityData[key]["bottling_hours"] = float(prodash_hours["bottling_hours"] or 0)
                productivityData[key]["stoppage_hours"] = float(prodash_hours["stoppage_hours"] or 0)
                productivityData[key]["net_bottling_hours"] = float(prodash_hours["net_bottling_hours"] or 0)
                breakdown = await LPGOperationsActions.get_lpg_breakdown(key, data, prodash_hours)
                productivityData[key]["late_start"] = breakdown["late_start"]
                productivityData[key]["early_stop"] = breakdown["early_stop"]
                productivityData[key]["intervening_gaps"] = breakdown["intervening_gaps"]
                productivityData[key]["lpg_breakdown"] = breakdown["lpg_breakdown"]
                carousal_total_production = 0.0
                for phase in phases:
                    prod_14_2 = float(bottling_data[key][phase].get('prod_14_2') or 0)
                    prod_19 = float(bottling_data[key][phase].get('prod_19') or 0)
                    # FORMULA: total_production = 14.2kg count + 1.25 * 19kg count
                    totalProduction = prod_14_2 + 1.25 * prod_19
                    gapHours = production_hours_data[key]["total_" + phase + "_gap"]
                    
                    # No Production => Net Hours = 0
                    if totalProduction == 0:
                        productivityData[key][phase] = {"net_hours": 0, "total_production": 0, "gaps": float(gapHours or 0), "productivity": 0}
                        continue
                    productivityData[key][phase] = {}
                    if phase != 'overtime':
                        maxHours = production_hours_data[key]['max_op_hours'][phase]
                        productivityData[key][phase]['net_hours'] = abs(
                            float(maxHours) - float(gapHours))
                    else:
                        #Overnight (00:00 → day cutoff) + evening (shift end → 23:59)
                        total_overnight_time = ot_production_time[key].get('total_overnight_time') or 0
                        total_post_shift_time = ot_production_time[key].get('total_post_shift_time') or 0
                        productivityData[key][phase]['net_hours'] = abs(
                            float(total_overnight_time) + float(total_post_shift_time) - float(gapHours or 0))
                    productivityData[key][phase]['total_production'] = totalProduction
                    productivityData[key][phase]['gaps'] = float(gapHours or 0)
                    carousal_total_production += float(totalProduction)
                    if not (productivityData[key][phase]['net_hours']):
                        productivityData[key][phase]['productivity'] = 0
                    else:
                        productivityData[key][phase]['productivity'] = abs(round(
                            float(totalProduction) / float(
                                productivityData[key][phase]['net_hours']), 4))
            print("Productivity Data :", productivityData)
            return productivityData
        except Exception as e:
            print("Exception in getting productivity :", str(e))
            print("Traceback :", traceback.format_exc())
            return False, "No data found"

    async def get_productivity_summary(data: dict):
        # Read from lpg_plant_operations summary table (not live get_productivity)
        try:
            from_date = data["from_date"]
            to_date = data.get("to_date") or from_date
            query = f"""
                SELECT * FROM lpg_plant_operations
                WHERE sap_id = '{data["sap_id"]}'
                  AND process_date::date BETWEEN '{from_date}'::date AND '{to_date}'::date
                ORDER BY carousel::int
            """
            rows = (await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)).get("data") or []
            if not rows:
                return {}

            def f(v):
                return float(v or 0)

            def phase(prod, net, gaps):
                prod, net, gaps = f(prod), f(net), f(gaps)
                return {
                    "net_hours": net,
                    "total_production": prod,
                    "gaps": gaps,
                    "productivity": round(prod / net, 4) if net else 0,
                }

            def ts(v):
                if not v or str(v).startswith("1970"):
                    return None
                return v.isoformat() if hasattr(v, "isoformat") else str(v)

            summary = {}
            for r in rows:
                key = str(r["carousel"])
                summary[key] = {
                    "first_cylinder": ts(r.get("fst_cyl_production")),
                    "last_cylinder": ts(r.get("lst_cyl_production")),
                    "bottling_hours": f(r.get("total_bottling_hours")),
                    "stoppage_hours": f(r.get("stoppage_hours")),
                    "net_bottling_hours": f(r.get("net_bottling_hours")),
                    "lpg_breakdown": f(r.get("lpg_breakdown")),
                    "late_start": f(r.get("late_start")),
                    "early_stop": f(r.get("early_stop")),
                    "intervening_gaps": f(r.get("intervening_gaps")),
                    "normal": phase(r.get("normal_total_production"), r.get("normal_net_hours"), r.get("normal_gap_hrs")),
                    "break": phase(r.get("break_total_production"), r.get("break_net_hours"), r.get("break_gap_hrs")),
                    "overtime": phase(r.get("overtime_total_production"), r.get("overtime_net_hours"), r.get("overtime_gap_hrs")),
                    "total": phase(
                        r.get("total_production"),
                        r.get("total_net_hours"),
                        f(r.get("normal_gap_hrs")) + f(r.get("break_gap_hrs")) + f(r.get("overtime_gap_hrs")),
                    ),
                }

            # Build "all" from carousel rows already fetched
            cars = [v for k, v in summary.items()]
            all_data = {
                "first_cylinder": min((c["first_cylinder"] for c in cars if c["first_cylinder"]), default=None),
                "last_cylinder": max((c["last_cylinder"] for c in cars if c["last_cylinder"]), default=None),
                "bottling_hours": sum(c["bottling_hours"] for c in cars),
                "stoppage_hours": sum(c["stoppage_hours"] for c in cars),
                "net_bottling_hours": sum(c["net_bottling_hours"] for c in cars),
                "lpg_breakdown": sum(c["lpg_breakdown"] for c in cars),
                "late_start": sum(c["late_start"] for c in cars),
                "early_stop": sum(c["early_stop"] for c in cars),
                "intervening_gaps": sum(c["intervening_gaps"] for c in cars),
            }
            for p in ("normal", "break", "overtime", "total"):
                prod = sum(c[p]["total_production"] for c in cars)
                net = sum(c[p]["net_hours"] for c in cars)
                gaps = sum(c[p]["gaps"] for c in cars)
                all_data[p] = phase(prod, net, gaps)
            summary["all"] = all_data
            print("summary :", summary)
            return summary
        except Exception as e:
            print("Exception in get_productivity_summary:", str(e))
            print("Traceback :", traceback.format_exc())
            return False, "No data found"

    ##########################  Filling Accuracy  ################################
    async def get_filling_accuracy(data: dict):
        try:
            cyl_types = ",".join(map(str, lpg_config.cyl_types))
            carousal = await LPGOperationsActions.get_carousals('string', data["sap_id"])
            # Single production day range: from_date 05:00 AM → next day 05:00 AM (plant day_end_cutoff)
            production_range = await LPGOperationsActions.get_production_day_range(data["from_date"], data["to_date"], sap_id=data["sap_id"])
            from_date = production_range["start"]
            to_date = production_range["end"]
            query = f"""
                SELECT
                system_id,
                MAX(sap_id) AS sap_id,
                SUM(CASE WHEN
                            ((cyl_type = 1) AND (check_net - 14200) = 0)
                            OR
                            ((cyl_type = 2) AND (check_net - 19000) = 0)
                        THEN 1
                        ELSE 0
                    END) AS nil_var,
                SUM(CASE WHEN
                            ((cyl_type = 1) AND (check_net - 14200) > 0 AND (check_net - 14200) <= 50)
                            OR
                            ((cyl_type = 1) AND (check_net - 14200) < 0 AND (check_net - 14200) >= -50)
                            OR
                            ((cyl_type = 2) AND (check_net - 19000) > 0 AND (check_net - 19000) <= 50)
                            OR
                            ((cyl_type = 2) AND (check_net - 19000) < 0 AND (check_net - 19000) >= -50)
                        THEN 1
                        ELSE 0
                    END) AS zero_fifty,
                SUM(CASE WHEN
                            ((cyl_type = 1) AND (check_net - 14200) > 50 AND (check_net - 14200) <= 100)
                            OR
                            ((cyl_type = 1) AND (check_net - 14200) < -50 AND (check_net - 14200) >= -100)
                            OR
                            ((cyl_type = 2) AND (check_net - 19000) > 50 AND (check_net - 19000) <= 100)
                            OR
                            ((cyl_type = 2) AND (check_net - 19000) < -50 AND (check_net - 19000) >= -100)
                        THEN 1
                        ELSE 0
                    END) AS fifty_hundred,
                SUM(CASE WHEN
                            ((cyl_type = 1) AND (check_net - 14200) > 100 AND (check_net - 14200) <= 200)
                            OR
                            ((cyl_type = 1) AND (check_net - 14200) < -100 AND (check_net - 14200) >= -200)
                            OR
                            ((cyl_type = 2) AND (check_net - 19000) > 100 AND (check_net - 14200) <= 200)
                            OR
                            ((cyl_type = 2) AND (check_net - 19000) < -100 AND (check_net - 14200) >= -200)
                        THEN 1
                        ELSE 0
                    END) AS hundred_plus,
                    SUM(CASE WHEN ((check_net - 14200) >= -200 AND (check_net - 14200) <= 200) THEN (check_net - 14200)
                    WHEN ((check_net - 14200) < -200) THEN -200
                    WHEN ((check_net - 14200) > 200) THEN 200
                    ELSE 0 END)/(COUNT(production_log_id)::float) AS average,
                    COUNT(production_log_id) AS count,
                    STDDEV_POP(CASE WHEN ((check_net - 14200) >= -200 AND (check_net - 14200) <= 200) THEN (check_net - 14200)
                    WHEN ((check_net - 14200) < -200) THEN -200
                    WHEN ((check_net - 14200) > 200) THEN 200
                    ELSE 0 END) AS stddev
                FROM production_log
                WHERE process_date >= '{from_date}'
                    AND process_date < '{to_date}'
                    AND system_id IN ({carousal})
                    AND process_id IN (2, 22)
                    AND cyl_type IN ({cyl_types})
                    AND process_status IN (0, 1040, 2064)
                    AND sap_id = {data['sap_id']}
                    GROUP BY system_id
                    ORDER BY system_id ASC
                    """
            stats = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
            if stats['data']:
                return stats['data']
            return False, "No data found"
        except Exception as e:
            print("Exception in getting filling accuracy :", str(e))
            print("Traceback :", traceback.format_exc())
            return False, "No data found"

    async def get_bottling_summary(data: dict):
        try:
            excludedStatuses = ", ".join(
                map(str, lpg_config.process_statuses['negativeTare'] + lpg_config.process_statuses[
                    'positiveTare'])
            )
            # Single production day range: from_date 05:00 AM → next day 05:00 AM (plant day_end_cutoff)
            production_range = await LPGOperationsActions.get_production_day_range(data["from_date"], data["to_date"], sap_id=data["sap_id"])
            from_date = production_range["start"]
            to_date = production_range["end"]

            carousal = await LPGOperationsActions.get_carousals('string', data["sap_id"])
            queryString = f"""SELECT
                    system_id as carousal,
                    SUM(CASE
                        WHEN (cyl_type = 1)
                        THEN 1
                        ELSE 0
                        END) AS production_14_2,
                    SUM(CASE
                        WHEN (cyl_type = 2)
                        THEN 1
                        ELSE 0
                        END) AS production_19
                    FROM production_log
                    WHERE process_date >= '{from_date}'
                        AND process_date < '{to_date}'
                        AND sap_id = {data['sap_id']}
                        AND process_id IN (2,22)
                        AND system_id IN ({carousal})
                        AND cyl_type IN (1,2)
                        AND process_status NOT IN ({excludedStatuses})
                    GROUP BY system_id 
                    ORDER BY system_id;"""
            print("Bottling Summary Query :", queryString)
            bottling_data = await urdhva_base.BasePostgresModel.get_aggr_data(queryString, limit=0)
            if bottling_data['data']:
                bottling_data = bottling_data['data']
            else:
                return {}
            carousals = await LPGOperationsActions.get_carousals('array', data["sap_id"])
            result = {}

            if (bottling_data and (bottling_data[0]["production_14_2"] > 0 or bottling_data[0][
                "production_19"] > 0)):
                for d in bottling_data:
                    for c in carousals:
                        if c == d["carousal"]:
                            result[c] = d
                return result
            return False, "No data found"
        except Exception as e:
            print("Exception in getting bottling summary :", str(e))
            print("Traceback :", traceback.format_exc())
            return False, "No data found"

    ############## Hourly Production Data ###################
    async def hourly_production_data(data: dict):
        # Single production day range: date 05:00 AM → next day 05:00 AM (plant day_end_cutoff; use request dates, else today)
        day = data.get("from_date") or datetime.now().strftime("%Y-%m-%d")
        to_day = data.get("to_date") or day
        production_range = await LPGOperationsActions.get_production_day_range(day, to_day, sap_id=data["sap_id"])
        from_date = production_range["start"]
        to_date = production_range["end"]

        cyl_type = ", ".join(map(str, lpg_config.cyl_types))
        carousal = await LPGOperationsActions.get_carousals('string', data['sap_id'])

        excludedStatuses = ", ".join(map(str, lpg_config.process_statuses['negativeTare'] +
                                         lpg_config.process_statuses['positiveTare']))
        queryString = f"""
        SELECT
            DATE_TRUNC('hour', process_date) as hour,
            SUM(CASE WHEN (system_id = 1 AND cyl_type = 1) THEN 1 ELSE 0 END) AS c1_t1,
            SUM(CASE WHEN (system_id = 1 AND cyl_type = 2) THEN 1 ELSE 0 END) AS c1_t2,
            SUM(CASE WHEN (system_id = 2 AND cyl_type = 1) THEN 1 ELSE 0 END) AS c2_t1,
            SUM(CASE WHEN (system_id = 2 AND cyl_type = 2) THEN 1 ELSE 0 END) AS c2_t2
        FROM production_log
        WHERE process_date >= '{from_date}'
            AND process_date < '{to_date}'
            AND sap_id = {data['sap_id']}
            AND process_id IN (2,22)
            AND system_id IN ({carousal})
            AND cyl_type IN ({cyl_type})
            AND process_status NOT IN ({excludedStatuses})
        GROUP BY DATE_TRUNC('hour', process_date)
        ORDER BY hour ASC;
        """
        stats = await urdhva_base.BasePostgresModel.get_aggr_data(queryString, limit=0)
        if stats['data']:
            return stats['data']
        return False

    async def get_hourly_production(data: dict):
        try:
            rawData = await LPGOperationsActions.hourly_production_data(data=data)
            print("rawData :", rawData)
            data = {
                1: [],
                2: [],
                'labels': [],
                'total1': 0,
                'total2': 0
            }
            if len(rawData) == 0:
                return data
            labels = []
            car1Data = []
            car2Data = []
            total1 = 0
            total2 = 0

            for row in rawData:
                timeLow = row['hour']
                timeHigh = row['hour'] + timedelta(hours=1)

                label = timeLow.strftime('%H') + '00 - ' + timeHigh.strftime('%H') + '00'
                labels.append(label)

                count1 = row['c1_t1'] + row['c1_t2']
                count2 = row['c2_t1'] + row['c2_t2']

                total1 += count1
                total2 += count2

                car1Data.append(count1)
                car2Data.append(count2)

            data['labels'] = labels
            data['total1'] = total1
            data['total2'] = total2
            data[1] = car1Data
            data[2] = car2Data

            return data
        except Exception as e:
            print("Exception in getting bottling summary :", str(e))
            print("Traceback :", traceback.format_exc())
            return False, "No data found"

    async def get_total_production_today_data(data: dict):
        # process_date on lpg_plant_operations is the production-day label (not calendar midnight)
        today = data["from_date"]
        yesterday = (datetime.strptime(today, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")

        query = f"""
            SELECT
                COALESCE(SUM(CASE WHEN process_date = '{today}' THEN total_production END), 0) AS today_total,
                COALESCE(SUM(CASE WHEN process_date = '{yesterday}' THEN total_production END), 0) AS yesterday_total
            FROM lpg_plant_operations
            WHERE sap_id = '{data["sap_id"]}';
        """

        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
        print(f"Query result for total production today data: {result}")
        row = result["data"][0]

        today_total = round(float(row["today_total"]), 4)
        print(f"Today's total production: {today_total}")
        yesterday_total = round(float(row["yesterday_total"]), 4)
        print(f"Yesterday's total production: {yesterday_total}")

        return {
            "Total Production": today_total,
            "Yesterday Production": yesterday_total,
            "Change (%)": round(((today_total / yesterday_total) - 1) * 100, 4) if yesterday_total else 0
        }
        
    async def get_total_productivity_today_data(data: dict):
        # process_date on lpg_plant_operations is the production-day label (not calendar midnight)
        today = data["from_date"]
        yesterday = (datetime.strptime(today, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")

        query = f"""
            SELECT
                COALESCE(SUM(CASE WHEN process_date = '{today}' THEN total_production END), 0) AS today_production,
                COALESCE(SUM(CASE WHEN process_date = '{today}' THEN total_net_hours END), 0) AS today_hours,
                COALESCE(SUM(CASE WHEN process_date = '{yesterday}' THEN total_production END), 0) AS yesterday_production,
                COALESCE(SUM(CASE WHEN process_date = '{yesterday}' THEN total_net_hours END), 0) AS yesterday_hours
            FROM lpg_plant_operations
            WHERE sap_id = '{data["sap_id"]}';
        """

        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
        row = result["data"][0]

        today_productivity = round(float(row["today_production"]) / float(row["today_hours"]), 4) if float(row["today_hours"]) else 0
        yesterday_productivity = round(float(row["yesterday_production"]) / float(row["yesterday_hours"]), 4) if float(row["yesterday_hours"]) else 0

        return {
            "Productivity": today_productivity,
            "Yesterday Productivity": yesterday_productivity,
            "Change (%)": round(((today_productivity / yesterday_productivity) - 1) * 100, 4)
            if yesterday_productivity else 0
        }

    async def get_productivity_raw_data(data: dict):
        try:
            sap_id = data["sap_id"]
            # Single production day range: date 05:00 AM → next day 05:00 AM (plant day_end_cutoff; use request dates, else today)
            day = data.get("from_date") or datetime.now().strftime("%Y-%m-%d")
            to_day = data.get("to_date") or day
            production_range = await LPGOperationsActions.get_production_day_range(day, to_day, sap_id=sap_id)
            from_date = production_range["start"]
            to_date = production_range["end"]

            # Get carousals dynamically
            carousal = await LPGOperationsActions.get_carousals(
                'string', sap_id
            )

            if not carousal:
                return []

            # Get interval & avg duration from LPG operations (or set defaults internally)
            interval = 15
            avg_duration = 30

            interval = interval if interval else 15
            avg_duration = avg_duration if avg_duration else 30

            excluded_statuses = "1296,5392,17424"

            # 🔹 Dynamic SUM columns per carousal
            dynamic_columns = []
            for cid in carousal.split(","):
                dynamic_columns.append(f"""
                    SUM(CASE WHEN (system_id = {cid.strip()} AND cyl_type = 1) THEN 1
                            WHEN (system_id = {cid.strip()} AND cyl_type = 2) THEN 1.25
                            ELSE 0 END) AS c{cid.strip()}
                """)

            dynamic_columns_sql = ", ".join(dynamic_columns)

            query = f"""
                SELECT
                    date_part('epoch', 
                        date_trunc('hour', process_date) +  
                        (((date_part('minute', process_date)::integer / {interval}) * {interval}) || ' minutes')::interval
                    ) AS period_end,
                    {dynamic_columns_sql}
                FROM production_log
                WHERE process_date >= '{from_date}'
                AND process_date < '{to_date}'
                AND process_id IN (2, 22)
                AND system_id IN ({carousal})
                AND cyl_type IN (1, 2)
                AND process_status NOT IN ({excluded_statuses})
                AND sap_id = {sap_id}
                GROUP BY period_end
                ORDER BY period_end ASC;
            """

            print("query:", query)
            results = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)

            if results.get("data"):
                return results["data"], avg_duration, carousal

            return [], avg_duration, carousal

        except Exception as e:
            print("Exception in get_productivity_raw_data:", str(e))
            print(traceback.format_exc())
            return [], 30, ""

    async def get_productivity_moving_average(data: dict):
        try:
            raw_data, avg_duration, carousal_string = await LPGOperationsActions.get_productivity_raw_data(
                data)

            if not raw_data:
                return False, "No data found"

            df = pd.DataFrame(raw_data)
            df["period_end"] = df["period_end"].astype(np.int64)

            for col in df.columns:
                if col != "period_end":
                    df[col] = df[col].astype(float)

            avg_duration_secs = avg_duration * 60
            hourly_factor = 3600 / avg_duration_secs
            adjustment_factor = 8.5 / 7.75

            carousals = [c.strip() for c in carousal_string.split(",")]

            output = {
                "labels": [],
                "overall": {}
            }

            for cid in carousals:
                output[f"c{cid}_rate"] = []
                output["overall"][f"c{cid}"] = 0

            for _, row in df.iterrows():
                current_ts = row["period_end"]

                window_df = df[
                    (df["period_end"] >= current_ts - avg_duration_secs) &
                    (df["period_end"] < current_ts)
                    ]

                output["labels"].append(
                    datetime.fromtimestamp(current_ts).strftime("%H:%M")
                )

                for cid in carousals:
                    col = f"c{cid}"
                    window_sum = window_df[col].sum() if col in window_df else 0
                    rate = round(window_sum * hourly_factor, 4)
                    output[f"c{cid}_rate"].append(rate)

            # 🔹 Overall Adjusted Productivity
            for cid in carousals:
                rates = [r for r in output[f"c{cid}_rate"] if r > 0]
                if rates:
                    output["overall"][f"c{cid}"] = round(
                        (sum(rates) / len(rates)) * adjustment_factor,
                        4
                    )

            print("*" * 40)
            print("Moving Average Productivity")
            print("Overall:", output["overall"])
            print("*" * 40)

            return output

        except Exception as e:
            print("Exception in get_productivity_moving_average:", str(e))
            print(traceback.format_exc())
            return False, "Error occurred"

    async def get_eld_old_rejections(data: dict):
        eld_data = await LPGOperationsActions.get_gd_rejection(data)
        old_data = await LPGOperationsActions.get_pt_rejection(data)

        eld_data = eld_data if eld_data else {}
        old_data = old_data if old_data else {}

        output = {}
        output['ELD'] = eld_data
        output['OLD'] = old_data

        return output

    async def get_eld_drill_down(data: dict):
        try:
            # Single production day range: from_date 05:00 AM → next day 05:00 AM (plant day_end_cutoff)
            production_range = await LPGOperationsActions.get_production_day_range(data["from_date"], data["to_date"], sap_id=data["sap_id"])
            from_date = production_range["start"]
            to_date = production_range["end"]
            if not data.get("carousal", None):
                carousal = await LPGOperationsActions.get_carousals('string', data.get("sap_id"))
                processId = '3,23'

            query = f"""SELECT
                        system_id,
                        process_status,
                        COUNT(event_log_id),
                        device_id
                    FROM event_log
                    WHERE process_date >= '{from_date}'
                        AND process_date < '{to_date}'
                        AND system_id IN ({carousal})
                        AND process_id IN ({processId})
                        AND sap_id = {data['sap_id']}
                    GROUP BY  process_status, system_id,device_id """
            print(query)
            results = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
            print(results)
            if results['data']:
                results = results['data']
            else:
                return {}

            if results:
                carousal_wise_data = {}

                for row in results:
                    sys_id = row['system_id']
                    device_id = row['device_id']

                    # initialize system_id dict
                    if sys_id not in carousal_wise_data:
                        carousal_wise_data[sys_id] = {}

                    # initialize device_id dict
                    if device_id not in carousal_wise_data[sys_id]:
                        carousal_wise_data[sys_id][device_id] = {
                            'handled': 0,
                            'sortout': 0
                        }

                    # update handled
                    carousal_wise_data[sys_id][device_id]['handled'] += row['count']

                    # update sortout
                    if row['process_status'] != 0:
                        carousal_wise_data[sys_id][device_id]['sortout'] += row['count']

                return carousal_wise_data
            return False, "No data found"

        except Exception as e:
            print("Exception in gd_rejection :", str(e))
            print("Traceback :", traceback.format_exc())
            return False, "No data found"

    async def get_old_drill_down(data: dict):
        try:
            # Single production day range: from_date 05:00 AM → next day 05:00 AM (plant day_end_cutoff)
            production_range = await LPGOperationsActions.get_production_day_range(data["from_date"], data["to_date"], sap_id=data["sap_id"])
            from_date = production_range["start"]
            to_date = production_range["end"]
            if not data.get("carousal", None):
                carousal = await LPGOperationsActions.get_carousals('string', data.get("sap_id"))
                processId = '4,24'
            else:
                carousal = '1,2'
            query = f"""SELECT
                        system_id,
                        process_status,
                        COUNT(event_log_id),
                        device_id
                    FROM event_log
                    WHERE process_date >= '{from_date}'
                        AND process_date < '{to_date}'
                        AND system_id IN ({carousal})
                        AND process_id IN ({processId})
                        AND sap_id = {data['sap_id']}
                    GROUP BY  process_status, system_id,device_id """
            print(query)
            results = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
            print(results)
            if results['data']:
                results = results['data']
            else:
                return {}

            if results:
                carousal_wise_data = {}

                for row in results:
                    sys_id = row['system_id']
                    device_id = row['device_id']

                    # initialize system_id dict
                    if sys_id not in carousal_wise_data:
                        carousal_wise_data[sys_id] = {}

                    # initialize device_id dict
                    if device_id not in carousal_wise_data[sys_id]:
                        carousal_wise_data[sys_id][device_id] = {
                            'handled': 0,
                            'sortout': 0
                        }

                    # update handled
                    carousal_wise_data[sys_id][device_id]['handled'] += row['count']

                    # update sortout
                    if row['process_status'] != 0:
                        carousal_wise_data[sys_id][device_id]['sortout'] += row['count']

                return carousal_wise_data
            return False, "No data found"

        except Exception as e:
            print("Exception in gd_rejection :", str(e))
            print("Traceback :", traceback.format_exc())
            return False, "No data found"

    async def get_scale_id(row: dict) -> int:
        return row.get("device_id") or row.get("machine_id")

    async def get_scales_efficiency_data(sap_id, carousal_list, from_date, to_date):
        query = f"""
            WITH ScaleAggregates AS (
                SELECT 
                    system_id, 
                    machine_id, 
                    device_id, 
                    COUNT(*) AS scale_count,
                    MIN(process_date) as scale_first,
                    MAX(process_date) as scale_last
                FROM production_log
                WHERE process_date >= '{from_date}'
                AND process_date < '{to_date}'
                AND process_id IN (2, 22)
                AND system_id IN ({carousal_list})
                AND cyl_type IN (1, 2)
                AND process_status NOT IN (1296, 5392, 17424)
                AND sap_id = {sap_id}
                GROUP BY system_id, machine_id, device_id
            )
            SELECT 
                *,
                MIN(scale_first) OVER (PARTITION BY system_id) AS first_cyl_time_overall,
                MAX(scale_last) OVER (PARTITION BY system_id) AS last_cyl_time_overall
            FROM ScaleAggregates
            ORDER BY system_id ASC, machine_id ASC
        """

        raw_data = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)

        meta_data = {}
        if raw_data and raw_data.get('data'):
            for row in raw_data['data']:
                s_id = row["system_id"]
                if s_id not in meta_data:
                    meta_data[s_id] = {
                        "first_cyl_time": row["first_cyl_time_overall"],
                        "last_cyl_time": row["last_cyl_time_overall"],
                    }
            return {"rows": raw_data['data'], "metaData": meta_data}
        return False

    async def under_performance_scales(data: dict):

        if not data.get('time'):
            # Single production day range: today 05:00 AM → next day 05:00 AM (plant day_end_cutoff)
            day = datetime.now().strftime("%Y-%m-%d")
            production_range = await LPGOperationsActions.get_production_day_range(day, day, sap_id=data.get("sap_id"))
            from_date = production_range["start"]
            to_date = production_range["end"]
        else:
            now = datetime.now()
            tg = data['time'].lower()

            if tg.endswith('m'):  # minutes
                delta = timedelta(minutes=int(tg[:-1]))
            elif tg.endswith('h'):  # hours
                delta = timedelta(hours=int(tg[:-1]))
            elif tg.endswith('d'):  # days
                delta = timedelta(days=int(tg[:-1]))
            else:
                raise ValueError("Invalid time_grain format")

            from_date = now - delta
            to_date = now
        print(from_date, to_date)
        sap_id = data.get("sap_id")

        carousals_data = await LPGOperationsActions.get_carousals('full', sap_id)
        c_ids = list(carousals_data.keys())
        carousal_list = ", ".join(map(str, c_ids))

        scales_count = await LPGOperationsActions.get_scales_efficiency_data(sap_id, carousal_list,
                                                                             from_date, to_date)

        if not scales_count:
            return {"rows": [], "meta": {f"car{c}Eff": "0%" for c in c_ids}}

        meta_data = scales_count["metaData"]
        raw_rows = scales_count["rows"]

        intervals = {}
        std_output_per_head = {}
        car_speeds = {1: 50, 2: 48, 3: 48}

        for c_id in c_ids:
            if c_id in meta_data:
                first_time = meta_data[c_id]["first_cyl_time"]
                last_time = meta_data[c_id]["last_cyl_time"]

                # Convert if string
                if isinstance(first_time, str):
                    first_time = datetime.fromisoformat(first_time)

                if isinstance(last_time, str):
                    last_time = datetime.fromisoformat(last_time)

                diff = (last_time - first_time).total_seconds()
                intervals[c_id] = diff if diff > 0 else 0.0
            else:
                intervals[c_id] = 0.0

            interval = intervals[c_id]
            if c_id in carousals_data and interval > 0:
                std_output_per_head[c_id] = (carousals_data[c_id]["stdOutput"] * (
                            interval / 3600)) / carousals_data[c_id]["heads"]
            elif c_id in car_speeds and interval > 0:
                std_output_per_head[c_id] = (1 / car_speeds[c_id]) * interval
            else:
                std_output_per_head[c_id] = 0.0

        overall_count = {c_id: 0 for c_id in c_ids}
        processed_rows = []
        for row in raw_rows:
            s_id = row["system_id"]
            denom = std_output_per_head.get(s_id, 0)
            eff = row["scale_count"] / denom if denom > 0 else 0.0

            tag = "above-average"
            if eff <= 0.75:
                tag = "below-average"
            elif eff <= 1.0:
                tag = "average"

            processed_rows.append({
                "scale": await LPGOperationsActions.get_scale_id(row),
                "carousal": s_id,
                "efficiency": eff,
                "efficiency_display": f"{round(eff * 100)}%",
                "tag": tag,
                "count": row["scale_count"]
            })
            overall_count[s_id] += row["scale_count"]

        meta = {}
        for c_id in c_ids:
            key = f"car{c_id}Eff"
            heads = carousals_data.get(c_id, {}).get("heads", 24)
            total_std_output = std_output_per_head.get(c_id, 0) * heads
            overall_eff = overall_count[c_id] / total_std_output if total_std_output > 0 else 0.0
            meta[key] = f"{round(overall_eff * 100)}%"

        processed_rows.sort(key=lambda x: x["efficiency"])
        return {"rows": processed_rows[:10], "meta": meta}

    async def underfill_overfill_scales(data: dict):

        if not data.get('time'):
            # Single production day range: today 05:00 AM → next day 05:00 AM (plant day_end_cutoff)
            day = datetime.now().strftime("%Y-%m-%d")
            production_range = await LPGOperationsActions.get_production_day_range(day, day, sap_id=data.get("sap_id"))
            from_date = production_range["start"]
            to_date = production_range["end"]
        else:
            now = datetime.now()
            tg = data['time'].lower()

            if tg.endswith('m'):  # minutes
                delta = timedelta(minutes=int(tg[:-1]))
            elif tg.endswith('h'):  # hours
                delta = timedelta(hours=int(tg[:-1]))
            elif tg.endswith('d'):  # days
                delta = timedelta(days=int(tg[:-1]))
            else:
                raise ValueError("Invalid time_grain format")

            from_date = now - delta
            to_date = now
        print(from_date, to_date)
        sap_id = data.get("sap_id")
        carousals_data = await LPGOperationsActions.get_carousals('full', sap_id)
        c_ids = list(carousals_data.keys())
        c_list = ", ".join(map(str, c_ids))

        query = f"""
            SELECT system_id, machine_id, device_id, 
                COUNT(*) as total,
                SUM(CASE WHEN 
                        ((cyl_type = 1) AND (ABS(check_net - 14200) > 100 AND ABS(check_net - 14200) <= 200))
                        OR
                        ((cyl_type = 2) AND (ABS(check_net - 19000) > 100 AND ABS(check_net - 19000) <= 200))
                    THEN 1 ELSE 0 END) AS hundred_plus
            FROM production_log
            WHERE process_date >= '{from_date}'
            AND process_date < '{to_date}'
            AND process_id IN (2, 22)
            AND system_id IN ({c_list})
            AND sap_id = {sap_id}
            GROUP BY system_id, machine_id, device_id
        """
        print("query:", query)
        res = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
        rows = res.get('data', [])
        print(len(rows))
        overall = {c_id: {"total": 0, "h_plus": 0} for c_id in c_ids}
        processed_rows = []

        for row in rows:
            s_id = row["system_id"]
            total = row["total"] or 1
            acc = 1 - (row["hundred_plus"] / total)

            tag = "above-average"
            if acc <= 0.97:
                tag = "below-average"
            elif acc <= 1.0:
                tag = "average"

            processed_rows.append({
                "scale": await LPGOperationsActions.get_scale_id(row),
                "carousal": s_id,
                "accuracy": acc,
                "accuracy_display": f"{round(acc * 100)}%",
                "tag": tag,
                "total": row["total"]
            })

            if s_id in overall:
                overall[s_id]["total"] += row["total"]
                overall[s_id]["h_plus"] += row["hundred_plus"]

        meta = {}
        for c_id in c_ids:
            denom = overall[c_id]["total"] or 1
            overall_acc = 1 - (overall[c_id]["h_plus"] / denom)
            meta[f"car{c_id}Acc"] = f"{(overall_acc * 100):.2f}%"

        processed_rows.sort(key=lambda x: x["accuracy"])
        return {"rows": processed_rows[:10], "meta": meta}

    @staticmethod
    async def plant_month_analysis(data):

        CURRENT_FILE = os.path.abspath(__file__)
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_FILE)))
        MASTER_PATH = os.path.join(BASE_DIR, "masters", "lpg_production_cost")

        MONTH_ORDER = [
            "April", "May", "June", "July",
            "August", "September", "October",
            "November", "December",
            "January", "February", "March"
        ]

        MONTH_FILE_PREFIX = {
            "January": "Jan",
            "February": "Feb",
            "March": "Mar",
            "April": "April",
            "May": "May",
            "June": "June",
            "July": "July",
            "August": "Aug",
            "September": "Sep",
            "October": "Oct",
            "November": "Nov",
            "December": "Dec"
        }

        #  Define once (fixes COLUMNS error)
        COLUMNS = [
            "Production (MT) - CY",
            "Production (MT) - LY",
            "Manpower Expenses (CY)",
            "Manpower Expenses (LY)",
            "Other OPEX Expenses (CY)",
            "Other OPEX Expenses (LY)",
            "M&R CVR Expenses (CY)",
            "M&R CVR Expenses (LY)",
            "Depreciation Expenses (CY)",
            "Depreciation Expenses (LY)"
        ]

        requested_sap_id = str(data.get("sap_id")).strip() if data.get("sap_id") else None
        requested_zone = str(data.get("zone")).strip() if data.get("zone") else None

        months_to_process = (
            [data.get("month").capitalize()]
            if data.get("month")
            else MONTH_ORDER
        )

        # ===============================
        # Fetch DB SAP IDs
        # ===============================
        query = """ SELECT DISTINCT sap_id FROM lpg_plant_operations_masters """
        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)

        db_sap_ids = [
            str(row["sap_id"]).strip()
            for row in result.get("data", [])
            if row.get("sap_id")
        ]

        db_df = pl.DataFrame({"sap_id": db_sap_ids})

        final_results = []
        prev_month_cost_df = None
        april_base_cost_df = None
        august_base_cost_df = None
        # =====================================
        # PRELOAD APRIL BASE (Always Load)
        # =====================================
        april_prefix = MONTH_FILE_PREFIX["April"]
        april_files = glob.glob(os.path.join(MASTER_PATH, f"{april_prefix}-*.xlsx"))

        if april_files:
            april_df = pl.read_excel(april_files[0], sheet_name="Sheet1")

            if "Plant" in april_df.columns:
                april_df = april_df.with_columns(
                    pl.col("Plant")
                    .cast(pl.Utf8)
                    .str.split(" - ")
                    .list.get(0)
                    .alias("sap_id")
                ).join(db_df, on="sap_id", how="inner")

            april_df = april_df.with_columns([
                (
                        (pl.col("Manpower Expenses (CY)") / pl.col(
                            "Production (MT) - CY")).fill_null(0) +
                        (pl.col("Other OPEX Expenses (CY)") / pl.col(
                            "Production (MT) - CY")).fill_null(0) +
                        (pl.col("M&R CVR Expenses (CY)") / pl.col(
                            "Production (MT) - CY")).fill_null(0) +
                        (pl.col("Depreciation Expenses (CY)") / pl.col(
                            "Production (MT) - CY")).fill_null(0)
                ).alias("Base Total Cost (CY)"),

                (
                        (pl.col("Manpower Expenses (LY)") / pl.col(
                            "Production (MT) - LY")).fill_null(0) +
                        (pl.col("Other OPEX Expenses (LY)") / pl.col(
                            "Production (MT) - LY")).fill_null(0) +
                        (pl.col("M&R CVR Expenses (LY)") / pl.col(
                            "Production (MT) - LY")).fill_null(0) +
                        (pl.col("Depreciation Expenses (LY)") / pl.col(
                            "Production (MT) - LY")).fill_null(0)
                ).alias("Base Total Cost (LY)")
            ])
            april_df = april_df.with_columns([

                (
                        pl.col("Base Total Cost (CY)") *
                        pl.col("Production (MT) - CY")
                ).alias("Base Total Prod Cost (CY)"),

                (
                        pl.col("Base Total Cost (LY)") *
                        pl.col("Production (MT) - LY")
                ).alias("Base Total Prod Cost (LY)")
            ])
            april_base_cost_df = april_df.select([
                "sap_id",
                "Base Total Cost (CY)",
                "Base Total Cost (LY)",
                "Base Total Prod Cost (CY)",
                "Base Total Prod Cost (LY)"
            ])

        # =====================================
        # PRELOAD AUGUST BASE (Always Load)
        # =====================================
        aug_prefix = MONTH_FILE_PREFIX["August"]
        aug_files = glob.glob(os.path.join(MASTER_PATH, f"{aug_prefix}-*.xlsx"))

        if aug_files:
            aug_df = pl.read_excel(aug_files[0], sheet_name="Sheet1")

            if "Plant" in aug_df.columns:
                aug_df = aug_df.with_columns(
                    pl.col("Plant")
                    .cast(pl.Utf8)
                    .str.split(" - ")
                    .list.get(0)
                    .alias("sap_id")
                ).join(db_df, on="sap_id", how="inner")

            aug_df = aug_df.with_columns([
                (
                        (pl.col("Manpower Expenses (CY)") / pl.col(
                            "Production (MT) - CY")).fill_null(0) +
                        (pl.col("Other OPEX Expenses (CY)") / pl.col(
                            "Production (MT) - CY")).fill_null(0) +
                        (pl.col("M&R CVR Expenses (CY)") / pl.col(
                            "Production (MT) - CY")).fill_null(0) +
                        (pl.col("Depreciation Expenses (CY)") / pl.col(
                            "Production (MT) - CY")).fill_null(0)
                ).alias("Base Total Cost (CY)"),

                (
                        (pl.col("Manpower Expenses (LY)") / pl.col(
                            "Production (MT) - LY")).fill_null(0) +
                        (pl.col("Other OPEX Expenses (LY)") / pl.col(
                            "Production (MT) - LY")).fill_null(0) +
                        (pl.col("M&R CVR Expenses (LY)") / pl.col(
                            "Production (MT) - LY")).fill_null(0) +
                        (pl.col("Depreciation Expenses (LY)") / pl.col(
                            "Production (MT) - LY")).fill_null(0)
                ).alias("Base Total Cost (LY)")
            ])
            aug_df = aug_df.with_columns([

                (
                        pl.col("Base Total Cost (CY)") *
                        pl.col("Production (MT) - CY")
                ).alias("Base Total Prod Cost (CY)"),

                (
                        pl.col("Base Total Cost (LY)") *
                        pl.col("Production (MT) - LY")
                ).alias("Base Total Prod Cost (LY)")
            ])
            august_base_cost_df = aug_df.select([
                "sap_id",
                "Base Total Cost (CY)",
                "Base Total Cost (LY)",
                "Base Total Prod Cost (CY)",
                "Base Total Prod Cost (LY)"
            ])

        # ==========================================================
        # LOOP THROUGH MONTHS
        # ==========================================================
        for month in months_to_process:
            # =========================================
            #  PRELOAD AUGUST BASE COST
            # =========================================

            file_prefix = MONTH_FILE_PREFIX[month]
            files = glob.glob(os.path.join(MASTER_PATH, f"{file_prefix}-*.xlsx"))
            print("===================================")
            print("Month:", month)
            print("File Prefix:", file_prefix)
            print("Search Path:", os.path.join(MASTER_PATH, f"{file_prefix}-*.xlsx"))
            print("Files Found:", files)
            print("===================================")

            if not files:
                continue

            current_file = files[0]
            year_match = re.search(r"-(\d+)\.xlsx$", current_file)
            if not year_match:
                continue

            current_year = int(year_match.group(1))
            print("DEBUG → Processing Month:", month)
            print("DEBUG → Current Year:", current_year)
            current_df = pl.read_excel(current_file, sheet_name="Sheet1")

            # Extract sap_id
            if "Plant" in current_df.columns:
                current_df = current_df.with_columns(
                    pl.col("Plant")
                    .cast(pl.Utf8)
                    .str.split(" - ")
                    .list.get(0)
                    .alias("sap_id")
                ).join(db_df, on="sap_id", how="inner")

            # ===============================
            # SUBTRACTION LOGIC (UNCHANGED)
            # ===============================
            if month == "April":
                merged = current_df
                merged = merged.with_columns([
                    pl.lit(0).alias("Manpower Expenses (LY)"),
                    pl.lit(0).alias("Manpower Expenses (CY)")
                ])

            else:
                month_index = MONTH_ORDER.index(month)
                prev_month = MONTH_ORDER[month_index - 1]
                prev_year = current_year - 1 if month == "January" else current_year

                prev_prefix = MONTH_FILE_PREFIX[prev_month]
                prev_pattern = os.path.join(MASTER_PATH, f"{prev_prefix}-{prev_year}.xlsx")

                if os.path.exists(prev_pattern):

                    prev_df = pl.read_excel(prev_pattern, sheet_name="Sheet1")

                    if "Plant" in prev_df.columns:
                        prev_df = prev_df.with_columns(
                            pl.col("Plant")
                            .cast(pl.Utf8)
                            .str.split(" - ")
                            .list.get(0)
                            .alias("sap_id")
                        ).join(db_df, on="sap_id", how="inner")

                    merged = current_df.join(
                        prev_df,
                        on=["SBU", "Zone", "Regional Office", "Plant", "sap_id"],
                        how="left",
                        suffix="_prev"
                    )
                    merged = merged.with_columns([
                        pl.lit(0).alias("Manpower Expenses (LY)"),
                        pl.lit(0).alias("Manpower Expenses (CY)")
                    ])

                    for col in COLUMNS:
                        prev_col = f"{col}_prev"
                        if col in merged.columns and prev_col in merged.columns:
                            merged = merged.with_columns(
                                (pl.col(col) - pl.col(prev_col).fill_null(0)).alias(col)
                            )
                        # FORCE MANPOWER TO ZERO AFTER SUBTRACTION
                        merged = merged.with_columns([
                            pl.lit(0).alias("Manpower Expenses (CY)"),
                            pl.lit(0).alias("Manpower Expenses (LY)")
                        ])

                else:
                    merged = current_df
                    merged = merged.with_columns([
                        pl.lit(0).alias("Manpower Expenses (LY)"),
                        pl.lit(0).alias("Manpower Expenses (CY)")
                    ])

            # ===============================
            # Inject missing columns (SAFE)
            # ===============================
            for col in COLUMNS:
                if col not in merged.columns:
                    merged = merged.with_columns(pl.lit(0).alias(col))

            # ===============================
            # COST CALCULATION
            # ===============================
            merged = merged.with_columns([

                (pl.col("Manpower Expenses (CY)") / pl.col("Production (MT) - CY"))
                .fill_nan(0).fill_null(0).alias("Manpower Cost (CY)"),

                (pl.col("Other OPEX Expenses (CY)") / pl.col("Production (MT) - CY"))
                .fill_nan(0).fill_null(0).alias("Other OPEX Cost (CY)"),

                (pl.col("M&R CVR Expenses (CY)") / pl.col("Production (MT) - CY"))
                .fill_nan(0).fill_null(0).alias("M&R CVR Cost (CY)"),

                (pl.col("Depreciation Expenses (CY)") / pl.col("Production (MT) - CY"))
                .fill_nan(0).fill_null(0).alias("Depreciation Cost (CY)"),

                (pl.col("Manpower Expenses (LY)") / pl.col("Production (MT) - LY"))
                .fill_nan(0).fill_null(0).alias("Manpower Cost (LY)"),

                (pl.col("Other OPEX Expenses (LY)") / pl.col("Production (MT) - LY"))
                .fill_nan(0).fill_null(0).alias("Other OPEX Cost (LY)"),

                (pl.col("M&R CVR Expenses (LY)") / pl.col("Production (MT) - LY"))
                .fill_nan(0).fill_null(0).alias("M&R CVR Cost (LY)"),

                (pl.col("Depreciation Expenses (LY)") / pl.col("Production (MT) - LY"))
                .fill_nan(0).fill_null(0).alias("Depreciation Cost (LY)")
            ])
            # ===============================
            # FORCE OTHER OPEX COST = 0
            # # ===============================

            merged = merged.with_columns([

                (
                        pl.col("Manpower Cost (CY)") +
                        pl.col("Other OPEX Cost (CY)") +
                        pl.col("M&R CVR Cost (CY)") +
                        pl.col("Depreciation Cost (CY)")
                ).alias("Total Cost (CY)"),

                (
                        pl.col("Manpower Cost (LY)") +
                        pl.col("Other OPEX Cost (LY)") +
                        pl.col("M&R CVR Cost (LY)") +
                        pl.col("Depreciation Cost (LY)")
                ).alias("Total Cost (LY)")
            ])

            # ===============================
            # SAVINGS (Dynamic Base Logic)
            # ===============================

            if month in ["April", "May", "June", "July"] and april_base_cost_df is not None:

                merged = merged.join(
                    april_base_cost_df,
                    on="sap_id",
                    how="left"
                )

            elif month in ["August", "September", "October", "November", "December", "January",
                           "February", "March"] and august_base_cost_df is not None:

                merged = merged.join(
                    august_base_cost_df,
                    on="sap_id",
                    how="left"
                )
                merged = merged.with_columns([
                    pl.lit(0).alias("Manpower Expenses (LY)"),
                    pl.lit(0).alias("Manpower Expenses (CY)")
                ])

            # Force April & August savings = 0
            if month in ["April", "August"]:

                merged = merged.with_columns([
                    pl.lit(0).alias("Savings (CY)"),
                    pl.lit(0).alias("Savings (LY)")
                ])
            else:
                merged = merged.with_columns([
                    (
                        (pl.col("Base Total Cost (CY)") - pl.col("Total Cost (CY)"))
                    ).fill_null(0).alias("Savings (CY)"),
                    (
                        (pl.col("Base Total Cost (LY)") - pl.col("Total Cost (LY)"))
                    ).fill_null(0).alias("Savings (LY)")
                ])
            # ===============================
            # TOTAL PROD COST
            # ===============================
            merged = merged.with_columns([

                (pl.col("Total Cost (CY)") *
                 pl.col("Production (MT) - CY"))
                .alias("Total Prod Cost (CY)"),

                (pl.col("Total Cost (LY)") *
                 pl.col("Production (MT) - LY"))
                .alias("Total Prod Cost (LY)")
            ])
            # ===============================
            # NEW SAVINGS BASED ON TOTAL PROD COST
            # ===============================

            if month in ["April", "August"]:

                merged = merged.with_columns([
                    pl.lit(0).alias("savings_cy"),
                    pl.lit(0).alias("savings_ly")
                ])

            else:

                merged = merged.with_columns([

                    (
                            pl.col("Base Total Prod Cost (CY)") -
                            pl.col("Total Prod Cost (CY)")
                    ).fill_null(0).alias("savings_cy"),
                    (
                            pl.col("Base Total Prod Cost (LY)") -
                            pl.col("Total Prod Cost (LY)")
                    ).fill_null(0).alias("savings_ly")
                ])
            # Store for next month
            prev_month_cost_df = merged.select([
                "sap_id",
                "Total Cost (CY)",
                "Total Cost (LY)"
            ])

            merged = merged.with_columns(pl.lit(month).alias("Month"))
            float_cols = [
                col for col, dtype in zip(merged.columns, merged.dtypes)
                if dtype in (pl.Float32, pl.Float64)
            ]

            merged = merged.with_columns([
                pl.col(col).round(0).cast(pl.Int64) for col in float_cols
            ])
            # Apply filters
            if requested_sap_id:
                merged = merged.filter(pl.col("sap_id") == requested_sap_id)

            if requested_zone:
                merged = merged.filter(pl.col("Zone") == requested_zone)

            final_results.extend(
                merged.select([
                    "Month",
                    "SBU",
                    "Zone",
                    "Regional Office",
                    "Plant",
                    "sap_id",
                    pl.col("Production (MT) - LY").alias("production_mt_ly"),
                    pl.col("Production (MT) - CY").alias("production_mt_cy"),

                    pl.col("Manpower Cost (CY)").alias("manpower_cost_mt_cy"),
                    pl.col("Other OPEX Cost (CY)").alias("other_opex_cost_mt_cy"),
                    pl.col("M&R CVR Cost (CY)").alias("mr_cvr_cost_mt_cy"),
                    pl.col("Depreciation Cost (CY)").alias("depreciation_cost_mt_cy"),

                    pl.col("Manpower Cost (LY)").alias("manpower_cost_mt_ly"),
                    pl.col("Other OPEX Cost (LY)").alias("other_opex_cost_mt_ly"),
                    pl.col("M&R CVR Cost (LY)").alias("mr_cvr_cost_mt_ly"),
                    pl.col("Depreciation Cost (LY)").alias("depreciation_cost_mt_ly"),

                    pl.col("Total Cost (CY)").alias("total_cost_mt_cy"),
                    pl.col("Total Cost (LY)").alias("total_cost_mt_ly"),

                    pl.col("Total Prod Cost (CY)").alias("total_prod_cost_cy"),
                    pl.col("Total Prod Cost (LY)").alias("total_prod_cost_ly"),

                    pl.col("Savings (CY)").alias("savings_mt_cy"),
                    pl.col("Savings (LY)").alias("savings_mt_ly"),
                    pl.col("savings_cy"),
                    pl.col("savings_ly")
                ]).to_dicts()
            )

        overall_row = {}
        monthly_aggregated = []

        # return {"data": final_results}
        if final_results:

            final_df = pl.DataFrame(final_results)

            sum_columns = [
                "production_mt_ly",
                "production_mt_cy",

                "total_prod_cost_cy",
                "total_prod_cost_ly",

                "savings_cy",
                "savings_ly"
            ]

            avg_columns = [
                "manpower_cost_mt_cy",
                "other_opex_cost_mt_cy",
                "mr_cvr_cost_mt_cy",
                "depreciation_cost_mt_cy",

                "manpower_cost_mt_ly",
                "other_opex_cost_mt_ly",
                "mr_cvr_cost_mt_ly",
                "depreciation_cost_mt_ly",

                "total_cost_mt_cy",
                "total_cost_mt_ly",

                "savings_mt_cy",
                "savings_mt_ly",
            ]

            overall_row = final_df.select([
                                              pl.sum(col).round(0).alias(col) for col in sum_columns
                                          ] + [pl.mean(col).round(0).alias(col) for col in
                                               avg_columns
                                               ])

            overall_row = overall_row.with_columns([
                (pl.col("total_prod_cost_cy") / pl.col("production_mt_cy"))
                .fill_nan(0).fill_null(0).alias("total_cost_mt_cy"),
                (pl.col("total_prod_cost_ly") / pl.col("production_mt_ly"))
                .fill_nan(0).fill_null(0).alias("total_cost_mt_ly")
            ]).to_dicts()[0]

            monthly_aggregated = final_df.group_by("Month").agg(
                [pl.sum(col).round(0).alias(col) for col in sum_columns] +
                [pl.mean(col).round(0).alias(col) for col in avg_columns]
            )

            monthly_aggregated = monthly_aggregated.with_columns([
                (pl.col("total_prod_cost_cy") / pl.col("production_mt_cy"))
                .fill_nan(0).fill_null(0).alias("total_cost_mt_cy"),
                (pl.col("total_prod_cost_ly") / pl.col("production_mt_cy"))
                .fill_nan(0).fill_null(0).alias("total_cost_mt_ly")
            ]).to_dicts()

            # If sap_id filter applied
            if requested_sap_id:
                overall_row.update({

                    "SBU": final_results[0]["SBU"],
                    "Zone": final_results[0]["Zone"],
                    "Regional Office": final_results[0]["Regional Office"],
                    "Plant": final_results[0]["Plant"],
                    "sap_id": final_results[0]["sap_id"]
                })
                for rec in monthly_aggregated:
                    rec.update({
                        "SBU": final_results[0]["SBU"],
                        "Zone": final_results[0]["Zone"],
                        "Regional Office": final_results[0]["Regional Office"],
                        "Plant": final_results[0]["Plant"],
                        "sap_id": final_results[0]["sap_id"]
                    })
            else:
                # No sap_id filter → sum of all plants
                overall_row.update({
                    "SBU": "All",
                    "Zone": "All",
                    "Regional Office": "All",
                    "Plant": "All Plants",
                    "sap_id": "All"
                })
                for rec in monthly_aggregated:
                    rec.update({
                        "SBU": "All",
                        "Zone": "All",
                        "Regional Office": "All",
                        "Plant": "All Plants",
                        "sap_id": "All"
                    })

        # return {
        #     "data": final_results,
        #     "overall": overall_row,
        #     "monthly_aggregated": monthly_aggregated
        # }
        plant_monthly_aggregated = build_plant_monthly_aggregated(final_results)
        zone_monthly_aggregated = build_zone_monthly_aggregated(final_results)

        return {
            "data": final_results,
            "overall": overall_row,
            "monthly_aggregated": monthly_aggregated,
            "plant_monthly_aggregated": plant_monthly_aggregated,
            "zone_monthly_aggregated": zone_monthly_aggregated
        }