import urdhva_base
import math
import sys
import asyncio
import traceback
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from orchestrator.dbconnector.widget_actions import lpg_config
from psycopg2.extras import RealDictCursor



class LPGOperationsActions:
    def __init__(self,conn,run_on_plant):
        self.conn = conn
        self.run_on_plant = run_on_plant

    def query_executer(self, query):
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(query)
        rows = cursor.fetchall()
        pure_dict_rows ={'data' :[dict(r) for r in rows]}
        return pure_dict_rows


    async def plants_dropdown(data: dict):
        query = """ select * from lpg_plant_operations_masters """
        try:
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
                    if not row["zone"] is None:
                        zones.add(row["zone"])
                    if not row["region"] is None:
                        regions.add(row["region"])

            return {
                "status": True,
                "message": "Success",
                "data": {
                    "plant": plants,
                    "zone": list(zones),
                    "region": list(regions),
                    "carousel_type": ["12H", "24H", "48H", "72H"]
                }
            }

        except Exception:
            print("Exception in plants_dropdown")
            print("traceback :", traceback.format_exc())

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
                "from" : row['start_time'],
                "to" : row['stop_time']
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
    
    async def get_carousals_config(plant_short_name):
        plant_id = await LPGOperationsActions.get_plant_id_by_short_name(plant_short_name)

        query = f""" SELECT carousal_id, heads, rated_productivity, start_time, stop_time FROM public.carousals WHERE plant_id = {plant_id} """
        result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
        if result['data']:
            result = result['data']
        else:
            return False
        config = {}
        for row in result:
            config[row['carousal_id']] = {
                'heads' : row['heads'],
                'stdOutput' : row['rated_productivity'],
                'times' : {
                    'start' : row['start_time'],
                    'end' : row['stop_time'],
                    'breaks' : await LPGOperationsActions.get_breaks(plant_id, row['carousal_id'])
                }
            }
        return config

    async def get_carousals(type: str, sap_id: str):
        plant_short_name = await LPGOperationsActions.get_plant_short_name(sap_id=sap_id)
        carousal_config = await LPGOperationsActions.get_carousals_config(plant_short_name)
        keys = list(carousal_config.keys())
        if type == 'string':
            return ", ".join(map(str, keys))
        if type == 'array':
            return  keys
        if type == 'full':
            return carousal_config
        else:
            return  ", ".join(map(str, list(carousal_config.keys())))

    async def get_gd_rejection(self,data : dict):
        try:
            from_date = datetime.strptime(f"{data['from_date']} 00:00:00", "%Y-%m-%d %H:%M:%S")
            to_date = datetime.strptime(f"{data['to_date']} 23:59:59","%Y-%m-%d %H:%M:%S")

            if not data.get("carousal", None):
                carousal = await LPGOperationsActions.get_carousals('string', data.get("sap_id"))
                processId = '3,23'

            query = f"""SELECT
                            system_id,
                            process_status,
                            COUNT(event_log_id)
                        FROM event_log
                        WHERE process_date BETWEEN '{from_date}' AND '{to_date}'
                            AND system_id IN ({carousal})
                            AND process_id IN ({processId})
                        GROUP BY  process_status, system_id """
            
            if not self.run_on_plant:
                results = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
            else:
                results = self.query_executer(query)
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
                        stats['rejection_rate'] = round((stats['sortout'] / stats['handled']) * 100, 2)
                    else:
                        stats['rejection_rate'] = 0.0

                return carousal_wise_data
            return False, "No data found"
        except Exception as e:
            print("Exception in gd_rejection :", str(e))
            print("Traceback :", traceback.format_exc())
            return False, "No data found"
    

    async def get_pt_rejection(self,data : dict):
        try:
            from_date = datetime.strptime(
                f"{data['from_date']} 00:00:00", "%Y-%m-%d %H:%M:%S"
                )
            to_date = datetime.strptime(
                f"{data['to_date']} 23:59:59","%Y-%m-%d %H:%M:%S"
                )

            if not data.get("carousal", None):
                carousal = await LPGOperationsActions.get_carousals('string', data.get("sap_id"))
            processId = '4,24'
            
            query = f"""SELECT
                            system_id,
                            process_status,
                            COUNT(event_log_id)
                        FROM event_log
                        WHERE process_date BETWEEN '{from_date}' AND '{to_date}'
                            AND system_id IN ({carousal})
                            AND process_id IN ({processId})
                        GROUP BY  process_status, system_id"""

            if not self.run_on_plant:
                results = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
            else:
                results = self.query_executer(query)

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
                        stats['rejection_rate'] = round((stats['sortout'] / stats['handled']) * 100, 2)
                    else:
                        stats['rejection_rate'] = 0.0

                return carousal_wise_data
            return False, "No data found"
        except Exception as e:
            print("Exception in pt_rejection :", str(e))
            print("Traceback :", traceback.format_exc())
            return False, "No data found"
    

    async def get_cs_rejection(self, data : dict):
        try:
            from_date = datetime.strptime(
                f"{data['from_date']} 00:00:00", "%Y-%m-%d %H:%M:%S"
                )
            to_date = datetime.strptime(
                f"{data['to_date']} 23:59:59","%Y-%m-%d %H:%M:%S"
                )
            
            carousals = await LPGOperationsActions.get_carousals('string', data.get("sap_id"))
            carousal_array = await LPGOperationsActions.get_carousals('array', data.get("sap_id"))
            
            query =f"""SELECT
                            system_id,
                            process_status,
                            COUNT(production_log_id)
                        FROM production_log
                        WHERE process_date BETWEEN '{from_date}' AND '{to_date}'
                            AND system_id IN ({carousals})
                            AND process_id IN (2,22)
                        GROUP BY  process_status, system_id"""

            if not self.run_on_plant:
                results = await urdhva_base.BasePostgresModel.get_aggr_data(query)
            else:
                results = self.query_executer(query)

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
                'handled' : int(total[id]),
                'cylinder_filled':int(total[id] - totalSortout[id]),
                'underfilled': int(data.get(id, {}).get(1040, 0)),
                'overfilled' : int(data.get(id, {}).get(2064, 0)),
                'negative_tare'	: int(data.get(id, {}).get(1296, 0)+(data.get(id, {}).get(5392,0))),
                'positive_tare' : int(data.get(id, {}).get(17424, 0)),
                'timeout':int(data.get(id, {}).get(1048, 0) + data.get(id,{}).get(4120, 0)),
                'other_errors'	: int(otherErrors[id]),
                'sortout':int(totalSortout[id]),
                'commErrorSortout':int(commErrorSortout[id]),
                'rejection_rate' : round((int(totalSortout[id]) / int(total[id])) * 100, 2) if int(total[id]) > 0 else 0.0
                }

            return refData
        except Exception as e:
            print("Exception in cs_rejection :", str(e))
            print("Traceback :", traceback.format_exc())
            return False, "No data found"
    
    async def get_cs_rejection_card(self,data : dict):
        try:
            from_date = datetime.strptime(
                f"{data['from_date']} 00:00:00", "%Y-%m-%d %H:%M:%S"
                )
            to_date = datetime.strptime(
                f"{data['to_date']} 23:59:59","%Y-%m-%d %H:%M:%S"
                )
            
            carousals = await LPGOperationsActions.get_carousals('string', data.get("sap_id"))
            carousal_array = await LPGOperationsActions.get_carousals('array', data.get("sap_id"))
            
            query =f"""SELECT
                            system_id,
                            process_status,
                            COUNT(production_log_id)
                        FROM production_log
                        WHERE process_date BETWEEN '{from_date}' AND '{to_date}'
                            AND system_id IN ({carousals})
                            AND process_id IN (2,22)
                        GROUP BY  process_status, system_id"""

            if not self.run_on_plant:
                results = await urdhva_base.BasePostgresModel.get_aggr_data(query)
            else:
                results = self.query_executer(query)

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
            refData["rejection_rate"] = round((int(refData["sortout"]) / int(refData["handled"])) * 100, 2)
            return refData
        except Exception as e:
            print("Exception in getting filling accuracy :", str(e))
            print("Traceback :", traceback.format_exc())
            return False, "No data found"

    #################### Productivity ####################
    async def get_start_end_times(carousal, data):
        plant_short_name = await LPGOperationsActions.get_plant_short_name(sap_id=data["sap_id"])
        carousal_config = await LPGOperationsActions.get_carousals_config(plant_short_name)
        if carousal_config is None:
            raise Exception("Error Processing Request", 1)
        return {
        'start' : carousal_config[carousal]['times']['start'],
        'end' : carousal_config[carousal]['times']['end']
        }

    async def build_ot_production_period_query(carousal, data):
        from_date = datetime.strptime(f"{data['from_date']}", "%Y-%m-%d").date()
        to_date = datetime.strptime(f"{data['to_date']}","%Y-%m-%d").date()

        startEndTimes = await LPGOperationsActions.get_start_end_times(carousal, data)
        startTime = startEndTimes['start']
        endTime = startEndTimes['end']
        queryString  = f"""WITH day_wise_data as (
                select
                    process_date::date as process_day,
                    to_char(process_date, 'HH24:MI:SS.MS') as process_time,
                    process_date
                FROM production_log
                    where process_date between '{from_date} 00:00:00' and '{to_date} 23:59:59.999'
                    AND process_id IN (2, 22)
                    AND cyl_type IN (1, 2)
                    and system_id = {carousal}
                    order by production_log_id asc
            ),
            pre_shift_ot_periods as (
                select 
                    process_day,
                    max(process_time::time) - min(process_time::time) as production_time
                from day_wise_data
                where 
                    process_time::time between '00:00:00'::time and '{startTime}'::time
                    group by process_day
            ),
            post_shift_ot_periods as (
                select 
                    process_day,
                    max(process_time::time) - min(process_time::time) as production_time
                from day_wise_data
                where 
                    process_time::time between '{endTime}'::time and '23:59:59.999'::time
                    group by process_day
            )
            select 
                EXTRACT(EPOCH from (select sum(production_time) from pre_shift_ot_periods)) / 3600 as total_pre_shift_time,
                EXTRACT(EPOCH from (select sum(production_time) from post_shift_ot_periods)) / 3600 as total_post_shift_time;"""

        return queryString

    async def build_production_gap_query(carousal, phases, from_date, to_date, sap_id):
        minInterruption = lpg_config.min_interruption

        normalGapStringArray = []
        normalGapString = ""
        for working_phase in phases['working']:
            normalGapStringArray.append(f"""getGapBetweenTimes(process_time, prev_process_time, '{working_phase['from']}'::text, '{working_phase['to']}'::text)""")
        normalGapString = " + ".join(normalGapStringArray)

        breakGapStringArray = []
        breakGapString = ""
        for break_phase in phases['breaks']:
            breakGapStringArray.append(f"""getGapBetweenTimes(process_time, prev_process_time, '{break_phase['from']}'::text, '{break_phase['to']}'::text)""")
        breakGapString = " + ".join(breakGapStringArray)

        overtimeGapStringArray = []
        overtimeGapString = ""
        for over_time_phase in phases['overtime']:
            overtimeGapStringArray.append(f"""(process_time::time between '{over_time_phase['from']}'::time and '{over_time_phase['to']}'::time and prev_process_time:: time between '{over_time_phase['from']}'::time and '{over_time_phase['to']}'::time )""")
        overtimeGapString = " or ".join(overtimeGapStringArray)

        normalEndGapStringArray = []
        normalEndGapString = ""
        for normal_end_phase in phases['working']:
            normalEndGapStringArray.append(f"""getEndGapForPhase(last_cyl_time, '{normal_end_phase['from']}', '{normal_end_phase['to']}')""")
        normalEndGapString = " + ".join(normalEndGapStringArray)

        breakEndGapStringArray = []
        breakEndGapString = ""
        for break_end_phase in phases['breaks']:
            breakEndGapStringArray.append(f"""getEndGapForPhase(last_cyl_time, '{break_end_phase['from']}', '{break_end_phase['to']}')""")
        breakEndGapString = " + ".join(breakEndGapStringArray)

        queryString  = f"""WITH day_wise_data as (
                select
                    process_date::date as process_day,
                    to_char(process_date, 'HH24:MI:SS.MS') as process_time,
                    process_date,
                    system_id,
                    process_status,
                    cyl_type,
                    production_log_id
                FROM production_log
                where 
                    process_date between '{from_date} 00:00:00' and '{to_date} 23:59:59.999'
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
        from_date = datetime.strptime(f"{data['from_date']}", "%Y-%m-%d").date()
        to_date = datetime.strptime(f"{data['to_date']}","%Y-%m-%d").date()
        queryString = F"""WITH all_dates AS (
                      SELECT generate_series('{from_date}'::date, '{to_date}'::date, '1 day'::interval) AS process_day),
                        row_counts AS (
                            SELECT
                                process_date::date AS process_day,
                                COUNT(*) AS row_count
                            FROM
                                production_log
                            WHERE
                                process_date BETWEEN '{from_date} 00:00:00' AND '{to_date} 23:59:59'
                                AND system_id = {carousal}
                                AND process_id IN (1,2,22)
                                AND process_status NOT IN (16)
                            GROUP BY
                                process_date::date
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

        if(data and len(data) > 0):
            return data[0]['count']
        return 0
    
    async def get_production_gaps(self,carousal, data):
        from_date = datetime.strptime(f"{data['from_date']}", "%Y-%m-%d").date()
        to_date = datetime.strptime(f"{data['to_date']}","%Y-%m-%d").date()
        phases = await LPGOperationsActions.get_phases(data)
        queryString = await LPGOperationsActions.build_production_gap_query(carousal, phases[carousal], from_date, to_date, data["sap_id"])
        if not self.run_on_plant:       
            query3 = await urdhva_base.BasePostgresModel.get_aggr_data(queryString, limit=0)
        else:
            query3 = self.query_executer(queryString)

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
                from_date = datetime.strptime(f'{working_period['from']}', "%H:%M:%S" )
                to_date = datetime.strptime(f'{working_period['to']}', "%H:%M:%S")
                interval =  to_date - from_date
                interval = interval.total_seconds()
                totalWorkingSeconds += interval
            
            for break_period in value['breaks']:
                from_date = datetime.strptime(f'{break_period['from']}', "%H:%M:%S" )
                to_date = datetime.strptime(f'{break_period['to']}', "%H:%M:%S")
                interval = to_date - from_date
                interval = interval.total_seconds()
                totalBreakSeconds += interval

            totalWorkingHours = totalWorkingSeconds / 3600
            totalBreakHours = totalBreakSeconds / 3600
            operating_time[key] = {
            'normal' : totalWorkingHours,
            'break' : totalBreakHours,
              }
        return  operating_time

    async def config_to_phases(config):
        phases = {}
        for key, value in config.items():
            start = value['times']['start']
            end = value['times']['end']
            breaks = value['times']['breaks']

            working_periods = []
            break_periods = []
            overtime_periods = []

            current_start = start

            for b in breaks:
                break_start = b['from']
                break_end = b['to']
                if current_start < break_start:
                    working_periods.append({
                        'from': current_start,
                        'to': break_start
                    })
                break_periods.append(b)
                current_start = break_end

            if current_start < end:
                working_periods.append({
                    'from': current_start,
                    'to': end
                })

            overtime_periods.append({
                'from': '00:00:00',
                'to': start
            })
            overtime_periods.append({
                'from': end,
                'to': '23:59:59'
            })

            phases[key] = {
                'working': working_periods,
                'breaks': break_periods,
                'overtime': overtime_periods
            }

        return phases

    async def get_phases(data):
        plant_short_name = await LPGOperationsActions.get_plant_short_name(sap_id=data["sap_id"])
        carousal_config = await LPGOperationsActions.get_carousals_config(plant_short_name)
        if carousal_config is None:
            raise Exception("Error Processing Request")
        phases = await LPGOperationsActions.config_to_phases(carousal_config)
        return phases

    async def get_phased_production_data_query_string(carousal, data):
        from_date = datetime.strptime(f"{data['from_date']}", "%Y-%m-%d").date()
        to_date = datetime.strptime(f"{data['to_date']}","%Y-%m-%d").date()

        excludedStatuses = ", ".join(map(str, lpg_config.process_statuses['negativeTare'] + lpg_config.process_statuses['positiveTare']))
        phases = await LPGOperationsActions.get_phases(data)
        normalPhaseStringArray = []
        normalPhaseString = ""
        for working_phase in phases[carousal]['working']:
            normalPhaseStringArray.append(f"""process_date::time between '{working_phase['from']}'::time and '{working_phase['to']}'::time""")
        normalPhaseString = " or ".join(normalPhaseStringArray)
      
        breakPhaseStringArray = []
        breakPhaseString = ""
        for break_phase in phases[carousal]['breaks']:
            breakPhaseStringArray.append(f""" process_date::time between '{break_phase['from']}'::time and '{break_phase['to']}'::time """)
        breakPhaseString = " or ".join(breakPhaseStringArray)
    
        queryString = f"""WITH phased_data as (
                    select 
                    *,
                    case 
                        when {normalPhaseString}
                        then 'normal'
                        when {breakPhaseString} 
                        then 'break'
                        else 'overtime'
                    end as phase
                    from production_log
                    where 
                        process_date between '{from_date} 00:00:00' and '{to_date} 23:59:59.999'
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
                group by phase;"""

        return queryString

    async def get_phase_wise_production(self,carousal, data):
        queryString = await LPGOperationsActions.get_phased_production_data_query_string(carousal, data)
        # data = await urdhva_base.BasePostgresModel.get_aggr_data(queryString, limit=0)
        data = self.query_executer(queryString)

        
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

    async def bottling_data(self,data : dict):        
        carousalsArray = await LPGOperationsActions.get_carousals("array", data["sap_id"])
        bottling = {}
        for carousal in carousalsArray:
            prodData = await self.get_phase_wise_production(carousal, data)
            bottling[carousal] = prodData
        return bottling

    async def production_hours_data(self,data: dict):   
        def none_to_zero(d):
            for k, v in d.items():
                if isinstance(v, dict):
                    none_to_zero(v)
                elif v is None:
                    d[k] = 0.0
            return d     
        from_date = datetime.strptime(f"{data['from_date']}", "%Y-%m-%d").date()
        to_date = datetime.strptime(f"{data['to_date']}","%Y-%m-%d").date()
        if from_date > to_date:
            return False
        interval_days = (to_date - from_date).days
        total_intervening_days = interval_days + 1
        carousalsArray = await LPGOperationsActions.get_carousals("array", data["sap_id"])
        dailyOperatingHours = await LPGOperationsActions.get_daily_operating_hours(data)

        production_hours = {}
        for carousal in carousalsArray: 
            production_hours[carousal] = await self.get_production_gaps(carousal, data)
            production_hours = {k: none_to_zero(v) for k, v in production_hours.items()}
            production_hours[carousal]['carousal'] = carousal
            production_hours[carousal]['intervening_days'] = total_intervening_days
            production_hours[carousal]['non_op_days'] = await LPGOperationsActions.get_non_operating_days(carousal, data)
            production_hours[carousal]['net_op_days'] = total_intervening_days - production_hours[carousal]['non_op_days']
            production_hours[carousal]['daily_op_hours'] = dailyOperatingHours[carousal]
            production_hours[carousal]['max_op_hours']= {}
            production_hours[carousal]['max_op_hours']['normal'] = dailyOperatingHours[carousal]['normal'] * production_hours[carousal]['net_op_days']
            production_hours[carousal]['max_op_hours']['break'] = dailyOperatingHours[carousal]['break'] * production_hours[carousal]['net_op_days']
            production_hours[carousal]['net_op_hours'] = {}
            production_hours[carousal]['net_op_hours']['normal'] = float((production_hours[carousal]['max_op_hours']['normal']) - float(production_hours[carousal]['total_normal_gap']))
            production_hours[carousal]['net_op_hours']['break'] = float((production_hours[carousal]['max_op_hours']['break']) - float(production_hours[carousal]['total_break_gap']))
        return production_hours
    
    async def get_ot_production_period(self,carousal, data):
        queryString = await LPGOperationsActions.build_ot_production_period_query(carousal, data)
        if not self.run_on_plant:
            data = await urdhva_base.BasePostgresModel.get_aggr_data(queryString, limit=0)
        else:
            data = self.query_executer(queryString)

        if data['data']:
            data = data['data']
        return data[0]
    
    async def ot_production_time(self,data:dict):
        carousalsArray = await LPGOperationsActions.get_carousals("array", data["sap_id"])
        ot_production = {}
        for carousal in carousalsArray: 
            ot_production[carousal] = await self.get_ot_production_period(carousal, data)
        return ot_production
    
    async def get_productivity(self,data: dict):
        try:
            bottling_data = await self.bottling_data(data)

            production_hours_data = await self.production_hours_data(data)

            ot_production_time = await self.ot_production_time(data)

            phases = ['normal', 'break', 'overtime']
            productivityData = {}

            for key, value in bottling_data.items():

                for phase in phases:
                    print(f"\n--> Phase: {phase}")

                    # Production Calculation
                    prod_14_2 = bottling_data[key][phase]['prod_14_2']
                    prod_19 = bottling_data[key][phase]['prod_19']
                    totalProduction = prod_14_2 + 1.25 * prod_19


                    gapHours = production_hours_data[key]["total_" + phase + "_gap"]
                    print(f"Gap Hours = {gapHours}")

                    if key not in productivityData:
                        productivityData[key] = {}

                    productivityData[key][phase] = {}

                    if phase != 'overtime':
                        maxHours = production_hours_data[key]['max_op_hours'][phase]
                        net_hours = abs(float(maxHours) - float(gapHours))

                        print(f"Max Hours ({phase}) = {maxHours}")
                        print(f"Net Hours ({phase}) = {net_hours}")

                    else:
                        total_pre_shift_time = ot_production_time[key]['total_pre_shift_time'] or 0
                        total_post_shift_time = ot_production_time[key]['total_post_shift_time'] or 0

                        
                        net_hours = abs(total_pre_shift_time + total_post_shift_time - gapHours)

                    productivityData[key][phase]['net_hours'] = net_hours
                    productivityData[key][phase]['total_production'] = totalProduction

                    if not net_hours:
                        productivity = 0
                    else:
                        productivity = abs(round(float(totalProduction) / float(net_hours), 2))

                    productivityData[key][phase]['productivity'] = productivity

                    print(f"Productivity ({phase}) = {productivity}")

            return productivityData

        except Exception as e:
            print("\n!!! ERROR in get_productivity !!!")
            print("Error:", str(e))
            raise

    ##########################  Filling Accuracy  ################################
    async def get_filling_accuracy(self,data: dict):
        try:
            cyl_types = ",".join(map(str, lpg_config.cyl_types))
            carousal = await LPGOperationsActions.get_carousals('string', data["sap_id"])
            from_date = datetime.strptime(f"{data['from_date']} 00:00:00", "%Y-%m-%d %H:%M:%S")
            to_date = datetime.strptime(f"{data['to_date']} 23:59:59","%Y-%m-%d %H:%M:%S")
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
                WHERE process_date BETWEEN '{from_date}' AND '{to_date}'
                    AND system_id IN ({carousal})
                    AND process_id IN (2, 22)
                    AND cyl_type IN ({cyl_types})
                    AND process_status IN (0, 1040, 2064)
                    GROUP BY system_id
                    ORDER BY system_id ASC
                    """
            if not self.run_on_plant:
                results = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
            else:
                results = self.query_executer(query)

            if results['data']:
                return results['data']
            return False, "No data found"
        except Exception as e:
            print("Exception in getting filling accuracy :", str(e))
            print("Traceback :", traceback.format_exc())
            return False, "No data found"
    
    async def get_bottling_summary(self,data: dict):
        try:
            excludedStatuses = ", ".join(
                map(str, lpg_config.process_statuses['negativeTare'] + lpg_config.process_statuses['positiveTare'])
                )
            from_date = datetime.strptime(f"{data['from_date']} 00:00:00", "%Y-%m-%d %H:%M:%S")
            to_date = datetime.strptime(f"{data['to_date']} 23:59:59","%Y-%m-%d %H:%M:%S")
            
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
                    WHERE process_date BETWEEN '{from_date}' AND '{to_date}'
                        AND process_id IN (2,22)
                        AND system_id IN ({carousal})
                        AND cyl_type IN (1,2)
                        AND process_status NOT IN ({excludedStatuses})
                    GROUP BY system_id 
                    ORDER BY system_id;"""        
            if not self.run_on_plant:
                bottling_data = await urdhva_base.BasePostgresModel.get_aggr_data(queryString, limit=0)
            else:
                bottling_data = self.query_executer(queryString)
            if bottling_data['data']:
                bottling_data = bottling_data['data']
            else:
                return {}
            carousals = await LPGOperationsActions.get_carousals('array', data["sap_id"])
            result = {}

            if(bottling_data and (bottling_data[0]["production_14_2"] > 0 or bottling_data[0]["production_19"] > 0)):
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
    async def hourly_production_data(self,data: dict):
        # from_date = datetime.strptime(f"{data['from_date']} 00:00:00", "%Y-%m-%d %H:%M:%S")
        # to_date = datetime.strptime(f"{data['to_date']} 23:59:59","%Y-%m-%d %H:%M:%S")
        from_date = datetime.now().strftime("%Y-%m-%d") + " 00:00:00"
        to_date = datetime.now().strftime("%Y-%m-%d") + " 23:59:59"
        
        cyl_type = ", ".join(map(str, lpg_config.cyl_types))
        carousal = await LPGOperationsActions.get_carousals('string', data['sap_id'])

        excludedStatuses = ", ".join(map(str, lpg_config.process_statuses['negativeTare'] + lpg_config.process_statuses['positiveTare']))
        queryString = f"""
        SELECT
            DATE_TRUNC('hour', process_date) as hour,
            SUM(CASE WHEN (system_id = 1 AND cyl_type = 1) THEN 1 ELSE 0 END) AS c1_t1,
            SUM(CASE WHEN (system_id = 1 AND cyl_type = 2) THEN 1 ELSE 0 END) AS c1_t2,
            SUM(CASE WHEN (system_id = 2 AND cyl_type = 1) THEN 1 ELSE 0 END) AS c2_t1,
            SUM(CASE WHEN (system_id = 2 AND cyl_type = 2) THEN 1 ELSE 0 END) AS c2_t2
        FROM production_log
        WHERE process_date BETWEEN '{from_date}' AND '{to_date}'
            AND process_id IN (2,22)
            AND system_id IN ({carousal})
            AND cyl_type IN ({cyl_type})
            AND process_status NOT IN ({excludedStatuses})
        GROUP BY DATE_TRUNC('hour', process_date)
        ORDER BY hour ASC;
        """
        if not self.run_on_plant:
            stats = await urdhva_base.BasePostgresModel.get_aggr_data(queryString, limit=0)
        else:
            stats = self.query_executer(queryString)

        if stats['data']:
            return stats['data']
        return False

    async def get_hourly_production(self,data : dict):
        try:
            rawData = await LPGOperationsActions.hourly_production_data(data=data)
            print("rawData :", rawData)
            data = {
                1 : [],
                2 : [],
                'labels' : [],
                'total1' : 0,
                'total2' : 0
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
                count1 = math.floor(row['c1_t1'] + 0.5)
                count2 = math.floor(row['c2_t2'] + 0.5)
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
