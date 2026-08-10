import urdhva_base
import hpcl_ceg_model
import dashboard_studio_model
import pyodbc
import os
import datetime
import calendar
import psycopg2
import traceback
import polars as pl
import pandas as pd
import re
import asyncio
import orchestrator.dbconnector.credential_loader as credential_loader


class SolarService:

    @classmethod
    def get_db_connection(cls, bu: str = None, db_name: str = None):
        if bu:
            db_name = f'{bu}_SOLAR'
        elif not db_name:
            db_name = 'SOLAR'

        creds = credential_loader.get_credentials(db_name)
        connection = pyodbc.connect(
            'DRIVER={ODBC Driver 18 for SQL Server};'
            f'Server={creds["host"]},{creds["port"]};'
            f'Database={creds.get("database", "ION_Data")};'
            f'UID={creds["user"]};'
            f'PWD={creds["password"]};'
            'TrustServerCertificate=yes;MARS_Connection=yes;',
        )
        return connection

    @classmethod
    async def fetch_data(cls, cursor, query, getData=False, params=None):

        if params:
            pg_conn = psycopg2.connect(
                host=params["host"],
                database=params["database"],
                user=params["user"],
                password=params["password"],
                port=params["port"]
            )
            cursor = pg_conn.cursor()

        cursor.execute(query)

        if getData:
            rows = cursor.fetchall()
            columns = [col[0] for col in cursor.description]

            if rows:
                data_dict = {
                    col: [row[i] for row in rows]
                    for i, col in enumerate(columns)
                }
                df = pl.DataFrame(data_dict)
            else:
                df = pl.DataFrame(schema=columns)

            if params:
                cursor.close()
                pg_conn.close()

            return df

        if params:
            pg_conn.commit()
            cursor.close()
            pg_conn.close()

    @staticmethod
    def get_last_completed_15min_window_ist():
        now_ist = datetime.datetime.now() + datetime.timedelta(hours=5, minutes=30)
        minute_block = (now_ist.minute // 15) * 15
        end_ist = now_ist.replace(minute=minute_block, second=0, microsecond=0)
        start_ist = end_ist - datetime.timedelta(minutes=15)

        return (
            start_ist.strftime("%Y-%m-%d %H:%M:%S"),
            end_ist.strftime("%Y-%m-%d %H:%M:%S")
        )

    @classmethod
    async def get_matched_sap_ids(cls, bu: str):
        try:
            conn = cls.get_db_connection(bu=bu)
            cursor = conn.cursor()

            sql_query = """
                SELECT DISTINCT PLANT_CD
                FROM ION_Data.dbo.vw_PMEAnalyticsConsolidated_SOLAR
                WHERE PLANT_CD IS NOT NULL
            """

            sql_df = await cls.fetch_data(cursor, sql_query, getData=True)

            postgres_query = """
                SELECT DISTINCT sap_id
                FROM public.solar_plant_capacity
                WHERE sap_id IS NOT NULL
            """

            pg_raw = await urdhva_base.BasePostgresModel.get_aggr_data(postgres_query)
            pg_data = pg_raw.get("data", [])

            plant_cd_list = set(sql_df["PLANT_CD"].cast(str).to_list())
            sap_id_list = set(str(row["sap_id"]) for row in pg_data)

            matched = list(plant_cd_list.intersection(sap_id_list))

            cursor.close()
            conn.close()

            return {"status": "success", "matched_sap_ids": matched}

        except Exception as e:
            traceback.print_exc()
            return {"status": "error", "message": str(e)}

    @staticmethod
    def extract_capacity(source_name):
        if not source_name:
            return None
        match = re.search(r'(\d+)\s*kW?', source_name, re.IGNORECASE)
        return match.group(1) if match else None

    @classmethod
    async def load_today_solar_summary(cls, bu: str):
        try:
            conn = cls.get_db_connection(bu=bu)
            cursor = conn.cursor()

            sap_result = await cls.get_matched_sap_ids(bu)

            if sap_result["status"] != "success" or not sap_result["matched_sap_ids"]:
                return {"status": "No matched SAP IDs"}

            sap_ids = sap_result["matched_sap_ids"]
            sap_ids_str = ",".join(f"'{sap_id}'" for sap_id in sap_ids)

            # =========================
            # INTERVAL LOGIC (MULTI-DAY + FIX)
            # =========================

            now_ist = datetime.datetime.now() + datetime.timedelta(hours=5, minutes=30)
            start_of_today = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)

            _, current_end = cls.get_last_completed_15min_window_ist()

            # ---- CHECK LAST TIMESTAMP ----
            check_query = """
                    SELECT MAX(timestamp_ist) as last_ts
                    FROM public.solar_generation_summary
                """
            check_result = await urdhva_base.BasePostgresModel.get_aggr_data(check_query)
            last_ts = check_result.get("data", [{}])[0].get("last_ts")

            print("Last TS from DB:", last_ts)

            intervals = []

            # =========================
            # CASE 1: TABLE EMPTY
            # =========================
            if not last_ts:
                print("No data → only today")

                await urdhva_base.BasePostgresModel.execute_query(f"""
                        DELETE FROM public.solar_generation_summary
                        WHERE DATE(timestamp_ist) = '{start_of_today.strftime("%Y-%m-%d")}'
                    """)

                await urdhva_base.BasePostgresModel.execute_query(f"""
                        DELETE FROM public.solar_outage_summary
                        WHERE DATE(timestamp_ist) = '{start_of_today.strftime("%Y-%m-%d")}'
                    """)

                intervals.append((
                    start_of_today.strftime("%Y-%m-%d %H:%M:%S"),
                    current_end
                ))

            # =========================
            # CASE 2: DATA EXISTS (FULL DAY REBUILD LOGIC - FIXED)
            # =========================
            else:
                # ---- HANDLE STRING / DATETIME ----
                if isinstance(last_ts, str):
                    try:
                        last_ts_dt = datetime.datetime.strptime(last_ts, "%Y-%m-%d %H:%M:%S")
                    except:
                        last_ts_dt = datetime.datetime.fromisoformat(last_ts)
                else:
                    last_ts_dt = last_ts

                print("Last TS parsed:", last_ts_dt)

                # =========================
                # STEP 1: REBUILD LAST DAY (ONLY IF NOT TODAY)
                # =========================
                last_day_start = last_ts_dt.replace(hour=0, minute=0, second=0, microsecond=0)
                next_day_start = last_day_start + datetime.timedelta(days=1)

                if last_day_start.date() != start_of_today.date():

                    print("Rebuilding FULL last day:", last_day_start.date())

                    # DELETE FULL LAST DAY
                    await urdhva_base.BasePostgresModel.execute_query(f"""
                        DELETE FROM public.solar_generation_summary
                        WHERE DATE(timestamp_ist) = '{last_day_start.strftime("%Y-%m-%d")}'
                    """)

                    await urdhva_base.BasePostgresModel.execute_query(f"""
                        DELETE FROM public.solar_outage_summary
                        WHERE DATE(timestamp_ist) = '{last_day_start.strftime("%Y-%m-%d")}'
                    """)

                    # ADD INTERVAL
                    intervals.append((
                        last_day_start.strftime("%Y-%m-%d %H:%M:%S"),
                        next_day_start.strftime("%Y-%m-%d %H:%M:%S")
                    ))

                    current_day = next_day_start

                else:
                    print("Last TS is TODAY → skip last-day rebuild")
                    current_day = start_of_today

                # =========================
                # STEP 2: HANDLE MISSING FULL DAYS
                # =========================
                while current_day < start_of_today:
                    print(f"Missing full day: {current_day.date()}")

                    next_day = current_day + datetime.timedelta(days=1)

                    # DELETE FULL DAY
                    await urdhva_base.BasePostgresModel.execute_query(f"""
                        DELETE FROM public.solar_generation_summary
                        WHERE DATE(timestamp_ist) = '{current_day.strftime("%Y-%m-%d")}'
                    """)

                    await urdhva_base.BasePostgresModel.execute_query(f"""
                        DELETE FROM public.solar_outage_summary
                        WHERE DATE(timestamp_ist) = '{current_day.strftime("%Y-%m-%d")}'
                    """)

                    # ADD INTERVAL
                    intervals.append((
                        current_day.strftime("%Y-%m-%d %H:%M:%S"),
                        next_day.strftime("%Y-%m-%d %H:%M:%S")
                    ))

                    current_day = next_day

                # =========================
                # STEP 3: HANDLE TODAY (ALWAYS RUN)
                # =========================
                print("Rebuilding TODAY:", start_of_today.date())

                await urdhva_base.BasePostgresModel.execute_query(f"""
                    DELETE FROM public.solar_generation_summary
                    WHERE DATE(timestamp_ist) = '{start_of_today.strftime("%Y-%m-%d")}'
                """)

                await urdhva_base.BasePostgresModel.execute_query(f"""
                    DELETE FROM public.solar_outage_summary
                    WHERE DATE(timestamp_ist) = '{start_of_today.strftime("%Y-%m-%d")}'
                """)

                intervals.append((
                    start_of_today.strftime("%Y-%m-%d %H:%M:%S"),
                    current_end
                ))

            print("Final intervals:", intervals)

            # =========================
            # LOCATION FETCH
            # =========================
            location_query = f"""
                SELECT sap_id, location_name, zone, capacity_kw
                FROM public.solar_plant_capacity 
                WHERE sap_id IN ({sap_ids_str})
            """
            location_raw = await urdhva_base.BasePostgresModel.get_aggr_data(location_query)
            location_data = location_raw.get("data", [])

            location_map = {}
            for row in location_data:
                sap_id = str(row["sap_id"])
                if sap_id not in location_map:
                    location_map[sap_id] = []
                location_map[sap_id].append({
                    "location_name": row["location_name"],
                    "zone": row["zone"],
                    "capacity_kw": str(row.get("capacity_kw"))
                })

            total_gen = 0
            total_outage = 0

            # =========================
            # LOOP (FULL DAY INTERVAL)
            # =========================
            for start_utc, end_utc in intervals:

                print("Processing FULL DAY: ", start_utc, end_utc)

                query = f""" 
                        WITH base AS (
                            SELECT
                                PLANT_CD,
                                SourceID,
                                TimestampUTC,
                                SourceName,
                                SourceType,
                                LocationName,

                                -- combine cumulative energy PER SOURCE
                                SUM(CASE WHEN QuantityID = 129 THEN Value END) AS Energy_Cumulative_kWh,
                                -- MAX(CASE WHEN QuantityID = 544 THEN Value END) AS Solar_kW,
                                COALESCE(
                                    MAX(CASE WHEN QuantityID = 544 THEN NULLIF(Value,0) END),
                                    MAX(CASE WHEN QuantityID = 518 THEN NULLIF(ABS(Value),0) END),
                                    MAX(CASE WHEN QuantityID = 519 THEN NULLIF(ABS(Value),0) END),
                                    MAX(CASE WHEN QuantityID = 520 THEN NULLIF(ABS(Value),0) END),
                                    MAX(CASE WHEN QuantityID = 515 THEN NULLIF(ABS(Value),0) END),
                                    MAX(CASE WHEN QuantityID = 516 THEN NULLIF(ABS(Value),0) END),
                                    MAX(CASE WHEN QuantityID = 517 THEN NULLIF(ABS(Value),0) END)
                                ) AS Solar_kW,

                                MAX(CASE WHEN QuantityID = 540 THEN Value END) AS Grid_Freq_Hz

                            FROM ION_Data.dbo.vw_PMEAnalyticsConsolidated_SOLAR
                            WHERE   PLANT_CD IN ({sap_ids_str})
                                AND LOWER(SourceName) NOT LIKE '%total%'
                                AND QuantityID IN (129, 544, 540, 518)
                                AND TimestampUTC  >= DATEADD(MINUTE, -330, '{start_utc}')
                                AND TimestampUTC <  DATEADD(MINUTE, -330, '{end_utc}')
                                AND DATEPART(SECOND, DATEADD(MINUTE, 330, TimestampUTC)) = 0
                                AND DATEPART(MINUTE, DATEADD(MINUTE, 330, TimestampUTC)) % 15 = 0
                            GROUP BY
                                PLANT_CD,
                                SourceID,
                                TimestampUTC,
                                SourceName,
                                SourceType,
                                LocationName
                        ),

                        w AS (
                            SELECT
                                b.*,
                                DATEADD(MINUTE, 330, b.TimestampUTC) AS TimestampIST,
                                CAST(DATEADD(MINUTE, 330, b.TimestampUTC) AS DATE) AS DayKey_IST,
                                CAST(DATEADD(MINUTE,330,b.TimestampUTC) AS TIME) AS TimeIST,

                                LAG(b.Energy_Cumulative_kWh)
                                    OVER (PARTITION BY b.PLANT_CD, b.SourceID ORDER BY b.TimestampUTC)
                                    AS Prev_Energy_Cumulative_kWh,

                                LAG(b.Solar_kW)
                                    OVER (PARTITION BY b.PLANT_CD, b.SourceID ORDER BY b.TimestampUTC)
                                    AS Prev_Solar_kW,

                                LEAD(b.TimestampUTC)
                                    OVER (PARTITION BY b.PLANT_CD, b.SourceID ORDER BY b.TimestampUTC)
                                    AS NextTimestampUTC
                            FROM base b
                        ),

                        calc1 AS (
                            SELECT
                                *,

                                CASE
                                    -- IGNORE energy during power outage
                                    WHEN ISNULL(Grid_Freq_Hz, 0) <= 0.01 THEN 0

                                    WHEN Energy_Cumulative_kWh IS NULL THEN 0
                                    WHEN Prev_Energy_Cumulative_kWh IS NULL THEN 0
                                    WHEN Energy_Cumulative_kWh < Prev_Energy_Cumulative_kWh THEN 0
                                    WHEN (Energy_Cumulative_kWh - Prev_Energy_Cumulative_kWh) > 100 THEN 0

                                    ELSE Energy_Cumulative_kWh - Prev_Energy_Cumulative_kWh
                                END AS SolarGen_kWh_entry,

                                CASE
                                    WHEN NextTimestampUTC IS NULL THEN 0.0
                                    ELSE DATEDIFF(SECOND, TimestampUTC, NextTimestampUTC) / 3600.0
                                END AS IntervalHours,

                                CASE
                                    WHEN COUNT(Solar_kW)
                                        OVER (PARTITION BY PLANT_CD, SourceID, DayKey_IST) > 0
                                    THEN 1 ELSE 0
                                END AS SolarKW_Available_Flag
                            FROM w
                        )


                    , calc AS (
                            SELECT
                                *,

                                CASE
                                    WHEN ISNULL(Grid_Freq_Hz, 0) <= 0.01 THEN 1 ELSE 0
                                END AS PowerOutageFlag,

                                CASE
                                    WHEN SolarKW_Available_Flag = 1 AND Solar_kW > 0.6 THEN 1
                                    WHEN SolarKW_Available_Flag = 0 AND ISNULL(SolarGen_kWh_entry, 0) > 0 THEN 1
                                    ELSE 0
                                END AS SolarWindowFlag,

                                CASE
                                    WHEN ISNULL(Grid_Freq_Hz, 0) > 0.01
                                    AND CAST(TimestampIST AS TIME) >= '05:00:00'
                                    AND (
                                            (SolarKW_Available_Flag = 1 AND Solar_kW > 0.6)
                                        OR (SolarKW_Available_Flag = 0 AND ISNULL(SolarGen_kWh_entry, 0) > 0)
                                        )
                                    THEN 1 ELSE 0
                                END AS SolarGeneratingFlag,

                                CASE
                                    WHEN ISNULL(Grid_Freq_Hz, 0) > 0.01
                                    AND (
                                            (SolarKW_Available_Flag = 1 AND Solar_kW <= 0.6)
                                        OR (SolarKW_Available_Flag = 0 AND ISNULL(SolarGen_kWh_entry, 0) = 0)
                                        )
                                    THEN 1 ELSE 0
                                END AS SolarZeroWhileGridOnFlag,

                                CASE
                                    WHEN SolarKW_Available_Flag = 1
                                        AND Solar_kW >= 0.5
                                    THEN 1

                                    WHEN SolarKW_Available_Flag = 0
                                        AND ISNULL(SolarGen_kWh_entry, 0) > 0.5                          
                                        AND LAG(ISNULL(SolarGen_kWh_entry, 0))
                                            OVER (PARTITION BY PLANT_CD, SourceID ORDER BY TimestampUTC) = 0
                                    THEN 1

                                    ELSE 0
                                END AS SolarStartFlag,

                                CASE
                                    WHEN SolarKW_Available_Flag = 1
                                        AND ISNULL(Prev_Solar_kW, 0) > 0.25
                                        AND ISNULL(Solar_kW, 0) <= 0.5

                                    THEN 1

                                    WHEN SolarKW_Available_Flag = 0
                                        AND ISNULL(SolarGen_kWh_entry, 0) < 0.25

                                        AND LAG(ISNULL(SolarGen_kWh_entry, 0))
                                            OVER (PARTITION BY PLANT_CD, SourceID ORDER BY TimestampUTC) > 0
                                    THEN 1

                                    ELSE 0
                                END AS SolarEndFlag
                            FROM calc1
                        ),

                        calc_window AS (
                            SELECT
                                *,
                                MIN(CASE WHEN SolarStartFlag = 1 THEN TimestampUTC END)
                                    OVER (PARTITION BY PLANT_CD, SourceID, DayKey_IST) AS SolarStart_UTC,

                                MIN(CASE 
                                        WHEN SolarStartFlag = 1 
                                        AND CAST(TimestampIST AS TIME) >= '05:30:00'
                                        THEN TimestampIST 
                                    END)
                                OVER (PARTITION BY PLANT_CD, SourceID, DayKey_IST) AS SolarStart_IST,

                                MAX(CASE WHEN SolarEndFlag = 1 THEN TimestampUTC END)
                                    OVER (PARTITION BY PLANT_CD, SourceID, DayKey_IST) AS SolarEnd_UTC,

                                MAX(CASE 
                                        WHEN SolarGeneratingFlag = 1
                                        AND CAST(TimestampIST AS TIME) >= '05:30:00'
                                        THEN TimestampIST 
                                    END)
                                OVER (PARTITION BY PLANT_CD, SourceID, DayKey_IST) AS SolarEnd_IST
                            FROM calc
                        )

                        SELECT
                            PLANT_CD,
                            SourceID,
                            TimestampUTC,
                            TimestampIST,
                            LocationName,
                            SourceName,
                            SourceType,
                            Energy_Cumulative_kWh,
                            Solar_kW,
                            Grid_Freq_Hz,
                            SolarGen_kWh_entry,
                            PowerOutageFlag,
                            (IntervalHours *
                            CASE 
                                WHEN SolarGeneratingFlag = 1 
                                AND CAST(TimestampIST AS TIME) >= '05:00:00'
                                THEN 1 ELSE 0
                            END
                        ) AS SolarGenHours_entry,
                            CASE
                                WHEN TimestampUTC >= SolarStart_UTC AND TimestampUTC <= SolarEnd_UTC
                                THEN (IntervalHours * PowerOutageFlag)
                                ELSE 0
                            END AS OutageDuringSolarHours_entry,
                            SUM(ISNULL(SolarGen_kWh_entry, 0))
                                OVER (PARTITION BY PLANT_CD, SourceID, DayKey_IST) AS SolarGen_kWh_day,
                            SUM(IntervalHours * SolarGeneratingFlag)
                                OVER (PARTITION BY PLANT_CD, SourceID, DayKey_IST) AS SolarGenHours_day,
                            SUM(CASE
                                WHEN TimestampUTC >= SolarStart_UTC AND TimestampUTC <= SolarEnd_UTC
                                THEN (IntervalHours * PowerOutageFlag)
                                ELSE 0
                            END) OVER (PARTITION BY PLANT_CD, SourceID, DayKey_IST) AS OutageDuringSolarHours_day,
                            SolarStart_UTC,
                            SolarStart_IST,
                            SolarEnd_UTC,
                            SolarEnd_IST,
                            CASE 
                                WHEN SolarStart_IST IS NOT NULL 
                                AND SolarEnd_IST IS NOT NULL
                                THEN (DATEDIFF(
                                        SECOND,
                                        SolarStart_IST,
                                        SolarEnd_IST
                                    ) / 3600.0) + 0.75
                                ELSE NULL
                            END AS SolarWindowHours_IST
                        FROM calc_window
                        ORDER BY SourceID, TimestampUTC;
                        """

                df = await cls.fetch_data(cursor, query, getData=True)

                if df.is_empty():
                    continue

                final_records = []
                outage_records = []
                outage_tracker = {}

                for row in df.to_dicts():

                    sap_id = str(row["PLANT_CD"])
                    source_id = str(row["SourceID"])
                    source_name = str(row.get("SourceName", ""))
                    timestamp = str(row.get("TimestampIST", ""))

                    power_flag = row.get("PowerOutageFlag", 0)
                    outage_hrs = float(row.get("OutageDuringSolarHours_entry", 0) or 0)

                    extracted_capacity = cls.extract_capacity(source_name)
                    loc_info_list = location_map.get(sap_id, [])

                    matched_info = {}
                    for loc in loc_info_list:
                        if extracted_capacity and str(loc["capacity_kw"]) == extracted_capacity:
                            matched_info = loc
                            break

                    if not matched_info and loc_info_list:
                        matched_info = loc_info_list[0]

                    solar_window_val = row.get("SolarWindowHours_IST")

                    # GENERATION
                    if power_flag == 0:
                        final_records.append({
                            "bu": str(bu),
                            "sap_id": sap_id,
                            "location_name": matched_info.get("location_name", row.get("LocationName", "")),
                            "zone": matched_info.get("zone", ""),
                            "source_id": source_id,
                            "source_name": source_name,
                            "source_type": str(row.get("SourceType", "")),
                            "timestamp_ist": timestamp,
                            "capacity_kw": matched_info.get("capacity_kw", ""),
                            "solar_generation_kwh": str(round(row.get("SolarGen_kWh_entry", 0), 3)),
                            "solar_generation_hrs": str(round(row.get("SolarGenHours_entry", 0), 3)),
                            "solar_start_time": str(row.get("SolarStart_IST") or timestamp),
                            "solar_end_time": str(row.get("SolarEnd_IST") or timestamp),
                            "solar_window_hrs": (
                                str(round(solar_window_val, 3)) if solar_window_val is not None else ""
                            ),
                            "solar_generation_hrs_day": str(round(row.get("SolarGenHours_day", 0), 3)),
                        })

                    # OUTAGE TRACKING
                    key = (sap_id, source_id)

                    if key not in outage_tracker:
                        outage_tracker[key] = {
                            "active": False,
                            "start": None,
                            "hrs": 0,
                            "last_outage_row": None,
                            "meta": matched_info,
                            "source_name": source_name,
                            "source_type": str(row.get("SourceType", ""))
                        }

                    tracker = outage_tracker[key]

                    if power_flag == 1:
                        if not tracker["active"]:
                            tracker["active"] = True
                            tracker["start"] = timestamp

                        tracker["hrs"] += outage_hrs
                        tracker["last_outage_row"] = row

                    else:
                        if tracker["active"]:
                            last_row = tracker["last_outage_row"]

                            outage_records.append({
                                "bu": str(bu),
                                "sap_id": sap_id,
                                "location_name": tracker["meta"].get("location_name", ""),
                                "zone": tracker["meta"].get("zone", ""),
                                "source_id": source_id,
                                "source_name": tracker["source_name"],
                                "source_type": tracker["source_type"],
                                "capacity_kw": tracker["meta"].get("capacity_kw", ""),
                                "grid_freq": str(last_row.get("Grid_Freq_Hz", "")) if last_row else "0",
                                "timestamp_ist": timestamp,
                                "solar_outage_hrs": str(round(tracker["hrs"], 3)),
                                "outage_start_time": tracker["start"],
                                "outage_end_time": timestamp,
                                "solar_outage_hrs_day": str(
                                    round(last_row.get("OutageDuringSolarHours_day", 0), 3)) if last_row else "0",
                            })

                            tracker["active"] = False
                            tracker["hrs"] = 0

                print(f"Inserted Gen: {len(final_records)}, Outage: {len(outage_records)}")

                if final_records:
                    await dashboard_studio_model.SolarGenerationSummary.bulk_update(
                        final_records, upsert=False
                    )
                    total_gen += len(final_records)

                if outage_records:
                    await dashboard_studio_model.SolarOutageSummary.bulk_update(
                        outage_records, upsert=False
                    )
                    total_outage += len(outage_records)

            cursor.close()
            conn.close()

            return {
                "status": "success",
                "generation_rows": total_gen,
                "outage_rows": total_outage
            }

        except Exception as e:
            traceback.print_exc()
            return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    result = asyncio.run(
        SolarService.load_today_solar_summary("SOD")
    )
    print(result)