import datetime
import calendar
import traceback
import hashlib
import json
import functools
import io
import os
import pandas as pd
import urdhva_base
import polars as pl
import dashboard_studio_model
from fastapi.responses import StreamingResponse
import datetime ,time
from collections import defaultdict
import calendar
import polars as pl


import orchestrator.dbconnector.widget_actions.widget_actions as widget_actions

class SolarCapacity:

    @classmethod
    async def route_action(
        cls,
        data: dashboard_studio_model.Solarpanelcleaning_Get_Solar_Dashboard_SummaryParams
    ):
        """
        Routes to the appropriate function based on the action parameter.
        """

        function_mapping = {
            "get_total_installed_capacity": cls.get_total_installed_capacity,
            "get_actual_generated": cls.get_actual_generated,
            "get_estimated_generated_today": cls.get_estimated_generated_today,
            "get_estimated_generated": cls.get_estimated_generated,
            "get_energy_generated": cls.get_energy_generated,
            "get_efficiency": cls.get_efficiency,
            "get_active_inactive_total_plants": cls.get_active_inactive_total_plants,
            "get_solar_summary": cls.get_solar_summary,
            "get_efficiency_last_30_days": cls.get_efficiency_last_30_days,
            "get_insights": cls.get_insights,
            "get_overall_insights": cls.get_overall_insights,
        }

        action = getattr(data, "action", None) or "get_total_installed_capacity"

        # Invalid action handling
        if action not in function_mapping:
            return {
                "status": "error",
                "message": f"Unknown action: {action}",
                "error": f"Action '{action}' is not supported. Available actions: {list(function_mapping.keys())}"
            }

        try:
            handler_function = function_mapping[action]

            if callable(handler_function):
                return await handler_function(data)

            return {
                "status": "error",
                "message": f"Handler for action '{action}' is not callable"
            }

        except Exception as e:
            traceback.print_exc()
            return {
                "status": "error",
                "message": "Something went wrong while processing the request",
                "error": str(e)
            }

    @classmethod
    async def get_matched_sap_ids(cls, data):
        try:
            # ---------------- BASE QUERY ----------------
            base_query = """
                FROM public.solar_generation_summary
                WHERE sap_id IS NOT NULL
            """

            # ---------------- APPLY FILTERS ----------------
            if getattr(data, "filters", None):
                base_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                    base_query,
                    data.filters,
                    getattr(data, "drill_state", None)
                )


            # ---------------- FINAL QUERY ----------------
            final_query = f"""
                SELECT DISTINCT sap_id
                {base_query}
            """

            print("Final Query:", final_query)

            # ---------------- FETCH DATA ----------------
            sql_df = await urdhva_base.BasePostgresModel.get_aggr_data(final_query,limit=0)
            sql_df = sql_df.get("data", [])
            print("sql_dfL ",sql_df)

            if not sql_df or len(sql_df) == 0:
                return {"status": "No SQL Server data"}

            plant_cd_list = {str(row["sap_id"]) for row in sql_df if row.get("sap_id")}

            # ---------------- FETCH POSTGRES SAP IDs ----------------
            postgres_query = """
                SELECT DISTINCT sap_id
                FROM public.solar_plant_capacity
                WHERE sap_id IS NOT NULL AND LOWER(TRIM("monitoring")) = 'yes' AND LOWER(TRIM("doc")) <> 'pending'
            """

            pg_raw = await urdhva_base.BasePostgresModel.get_aggr_data(postgres_query,limit=0)
            pg_data = pg_raw.get("data", [])

            sap_id_list = {str(row["sap_id"]) for row in pg_data if row.get("sap_id")}

            # ---------------- MATCHING ----------------
            matched_sap_ids = list(plant_cd_list.intersection(sap_id_list))

            print("matched_sap_ids:", matched_sap_ids)

            return {
                "status": "success",
                "matched_sap_ids": matched_sap_ids,
                "count": len(matched_sap_ids)
            }

        except Exception as e:
            traceback.print_exc()
            return {"status": "error", "message": str(e)}

    @classmethod
    async def get_total_installed_capacity(cls, data):
        try:
            # ---------------- BASE QUERY ----------------
            base_query = """
                FROM public.solar_plant_capacity
                WHERE LOWER(TRIM("monitoring")) = 'yes' AND LOWER(TRIM("doc")) <> 'pending'
            """

            # ---------------- APPLY FILTERS ----------------
            if getattr(data, "filters", None):

                cleaned_filters = []

                for f in data.filters:
                    # get column safely (dict or object)
                    col = (
                        f.get("key")
                        if isinstance(f, dict)
                        else getattr(f, "key", None)
                    )

                    # skip TimestampUTC
                    if col and col.lower() == "timestamp_ist":
                        continue

                    cleaned_filters.append(f)

                if cleaned_filters:
                    base_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                        base_query,
                        cleaned_filters,
                        getattr(data, "drill_state", None)
                    )

            # ---------------- FINAL QUERY ----------------
            overall_query = f"""
                SELECT COALESCE(SUM(capacity_kw::numeric), 0) AS total_capacity_kw
                {base_query}
            """
            print("overall_query: ",overall_query)

            # ---------------- EXECUTE ----------------
            overall_res = await urdhva_base.BasePostgresModel.get_aggr_data(
                overall_query,
                limit=0,
                skip=0
            )

            overall_rows = overall_res.get("data", [])
            total_capacity = overall_rows[0]["total_capacity_kw"] if overall_rows else 0

            return {
                "status": "success",
                "total_installed_capacity": round(float(total_capacity),2)
            }

        except Exception as e:
            traceback.print_exc()
            return {
                "status": "error",
                "message": "Failed to fetch total installed capacity",
                "error": str(e)
            }

    @classmethod
    async def get_actual_generated(cls, data):
        try:



            # ---------------- BASE QUERY ----------------
            base_query = """
                FROM public.solar_generation_summary
            """

            # ---------------- APPLY FILTERS ----------------
            if getattr(data, "filters", None):
                base_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                    base_query,
                    data.filters,
                    getattr(data, "drill_state", None)
                )

            # ---------------- OVERALL ENERGY ----------------
            overall_query = f"""
                SELECT 
                    COALESCE(SUM(solar_generation_kwh::numeric), 0) AS total_energy
                {base_query}
            """

            overall_res = await urdhva_base.BasePostgresModel.get_aggr_data(
                overall_query, limit=0, skip=0
            )

            overall_energy = (
                overall_res.get("data", [{}])[0].get("total_energy", 0)
            )

            # ---------------- LOCATION-WISE ----------------
            location_query = f"""
                SELECT 
                    location_name AS "location_name",
                    sap_id AS "sap_id",
                    DATE(timestamp_ist) AS "date",
                    COALESCE(SUM(solar_generation_kwh::numeric), 0) AS energy_generated
                {base_query}
                GROUP BY location_name, sap_id,DATE(timestamp_ist)
                ORDER BY location_name
            """

            location_res = await urdhva_base.BasePostgresModel.get_aggr_data(
                location_query, limit=0, skip=0
            )

            location_data = location_res.get("data", [])

            # ---------------- ZONE-WISE ----------------
            zone_query = f"""
                SELECT 
                    zone,
                    location_name AS "location_name",
                    sap_id AS "sap_id",
                    DATE(timestamp_ist) AS "date",
                    COALESCE(SUM(solar_generation_kwh::numeric), 0) AS energy_generated
                {base_query}
                GROUP BY zone, location_name, sap_id, DATE(timestamp_ist)
                ORDER BY zone
            """

            zone_res = await urdhva_base.BasePostgresModel.get_aggr_data(
                zone_query, limit=0, skip=0
            )

            zone_data = zone_res.get("data", [])

            # ---------------- FORMAT RESPONSE ----------------
            return {
                "status": "success",
                "actual_energy": round(float(overall_energy), 2),

                "location_wise": [
                    {
                        "timestamp_ist": str(row["date"]),
                        "location_name": row["location_name"],
                        "sap_id": row["sap_id"],
                        "energy_generated": round(float(row["energy_generated"]), 2)
                    }
                    for row in location_data
                ],

                "zone_wise": [
                    {
                        "timestamp_ist": str(row["date"]),
                        "zone": row["zone"],
                        "location_name": row["location_name"],
                        "sap_id": row["sap_id"],
                        "energy_generated": round(float(row["energy_generated"]), 2)
                    }
                    for row in zone_data
                ]
            }

        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }

    @classmethod
    async def get_estimated_generated_today(cls, data, sap_ids=None):
        try:
            raw_filters = getattr(data, "filters", None) or {}

            # ALL MASTER SAP IDS
            if sap_ids:
                matched_sap_ids = sap_ids
            else:
                sap_filter = raw_filters.get("sap_id") if isinstance(raw_filters, dict) else None

                if sap_filter:
                    matched_sap_ids = sap_filter if isinstance(sap_filter, list) else [sap_filter]
                else:
                    matched_result = await cls.get_matched_sap_ids(data)
                    if matched_result.get("status") != "success":
                        return matched_result
                    matched_sap_ids = matched_result.get("matched_sap_ids", [])

            if not matched_sap_ids:
                return {"status": "success", "estimated_energy": 0}

            sap_ids_str = ",".join(f"'{sap}'" for sap in matched_sap_ids)

            # ---------------- FETCH METADATA ----------------
            meta_query = f"""
                SELECT sap_id, location_name, zone
                FROM public.solar_plant_capacity
                WHERE sap_id IN ({sap_ids_str})
            """

            meta_res = await urdhva_base.BasePostgresModel.get_aggr_data(meta_query, limit=0,skip=0)
            meta_map = {row["sap_id"]: row for row in meta_res.get("data", [])}

            # ---------------- BASE QUERY ----------------
            base_query = f"""
                FROM public.solar_plant_capacity
                WHERE LOWER(TRIM("monitoring")) = 'yes'
                  AND LOWER(TRIM("doc")) <> 'pending'
                  AND sap_id IN ({sap_ids_str})
            """

            # ---------------- REMOVE TIMESTAMP FILTER ----------------
            cleaned_filters = None
            if isinstance(raw_filters, list):
                cleaned_filters = []
                for f in raw_filters:
                    col = f.get("key") if isinstance(f, dict) else getattr(f, "key", None)
                    if col and col.lower() == "timestamp_ist":
                        continue
                    cleaned_filters.append(f)

            if cleaned_filters:
                base_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                    base_query,
                    cleaned_filters,
                    getattr(data, "drill_state", None)
                )

            # ---------------- CAPACITY ----------------
            cap_query = f"""
                SELECT sap_id, SUM(capacity_kw::numeric)*4 AS capacity_kw
                {base_query}
                GROUP BY sap_id
            """

            cap_res = await urdhva_base.BasePostgresModel.get_aggr_data(cap_query,limit=0,skip=0)
            cap_rows = cap_res.get("data", [])

            if not cap_rows:
                return {"status": "success", "estimated_energy": 0}

            # ---------------- LAST 7 DAYS WINDOW ----------------
            gen_query = f"""
                SELECT sap_id, AVG(window_h) AS avg_window_h
                FROM (
                    SELECT sap_id, source_id, DATE(timestamp_ist) AS day,
                           SUM(DISTINCT NULLIF(TRIM(solar_window_hrs), '')::numeric) AS window_h
                    FROM public.solar_generation_summary
                    WHERE sap_id IN ({sap_ids_str})
                      AND DATE(timestamp_ist) >= CURRENT_DATE - INTERVAL '7 days'
                      AND DATE(timestamp_ist) < CURRENT_DATE
                    GROUP BY sap_id, source_id, DATE(timestamp_ist)
                ) t
                GROUP BY sap_id
            """

            gen_res = await urdhva_base.BasePostgresModel.get_aggr_data(gen_query,limit=0)
            avg_window_map = {
                row["sap_id"]: min(float(row["avg_window_h"] or 0), 24)
                for row in gen_res.get("data", [])
            }

            # ---------------- CURRENT TIME ----------------
            now = (datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30)).time()

            solar_start = datetime.time(5, 30)
            solar_end = datetime.time(19, 30)

            if now < solar_start:
                elapsed_hours = 0
            elif now > solar_end:
                elapsed_hours = 14
            else:
                elapsed_hours = (
                                        datetime.datetime.combine(datetime.datetime.today(), now) -
                                        datetime.datetime.combine(datetime.datetime.today(), solar_start)
                                ).total_seconds() / 3600
            print("elapsed_hours: ",elapsed_hours)

            # ---------------- CALCULATION ----------------
            total_estimated_energy = 0.0
            location_map = {}
            zone_map = {}

            for row in cap_rows:
                sap_id = row["sap_id"]
                cap = float(row["capacity_kw"] or 0)
                print("cap : ",cap)

                avg_windows = avg_window_map.get(sap_id, 14)
                avg_window = max(avg_windows, 14)
                window_h = min(avg_window if avg_window else elapsed_hours, elapsed_hours)
                print("window_h: ",window_h)

                if cap > 0 and avg_window > 0:
                    print("avg_window; ",avg_window)
                    per_hour_energy = cap / avg_window
                    print("per_hour_energy: ",per_hour_energy)
                    estimated_energy = per_hour_energy * window_h
                    print("estimated_energy: ",estimated_energy)
                    total_estimated_energy += estimated_energy
                    print("total_estimated_energy: ",total_estimated_energy)
                else:
                    estimated_energy = 0

                meta = meta_map.get(sap_id, {})
                location = meta.get("location_name", "UNKNOWN")
                zone = meta.get("zone", "UNKNOWN")

                location_map[(location, sap_id)] = location_map.get((location, sap_id), 0) + estimated_energy
                zone_map[(zone, location, sap_id)] = zone_map.get((zone, location, sap_id), 0) + estimated_energy

            return {
                "status": "success",
                "estimated_energy": round(total_estimated_energy, 2),
                "elapsed_solar_hours": round(elapsed_hours, 2),

                "location_wise": [
                    {
                        "location_name": loc,
                        "sap_id": sap,
                        "estimated_energy": round(val, 2)
                    }
                    for (loc, sap), val in location_map.items()
                ],

                "zone_wise": [
                    {
                        "zone": zone,
                        "location_name": loc,
                        "sap_id": sap,
                        "estimated_energy": round(val, 2)
                    }
                    for (zone, loc, sap), val in zone_map.items()
                ]
            }

        except Exception as e:
            traceback.print_exc()
            return {
                "status": "error",
                "message": str(e)
            }

    @classmethod
    def get_days_from_filter(cls, filters):

        days = 0
        include_today = False
        is_yesterday_only = False

        today = datetime.date.today()

        if isinstance(filters, list):
            for f in filters:


                if isinstance(f, dict):
                    key = f.get("key")
                    cond = f.get("cond")
                    value = f.get("value")
                else:
                    key = getattr(f, "key", None)
                    cond = getattr(f, "cond", None)
                    value = getattr(f, "value", None)

                if key == "timestamp_ist" and cond == "date_filter":

                    # ---------------- TODAY ONLY ----------------
                    if value == "t":
                        include_today = True

                    # ---------------- YESTERDAY ONLY ----------------
                    elif value == "1d":
                        is_yesterday_only = True
                        days = 1

                    # ---------------- PREDEFINED RANGES ----------------
                    elif value == "1w":
                        days = 7
                        include_today = True

                    elif value == "15d":
                        days = 15
                        include_today = True

                    elif value == "1m":
                        days = 30
                        include_today = True

                    elif value == "3m":
                        days = 90
                        include_today = True

                    elif value == "6m":
                        days = 180
                        include_today = True

                    elif value == "1y":
                        days = 365
                        include_today = True

                    # ---------------- CUSTOM RANGE ----------------
                    elif isinstance(value, str) and "," in value:
                        try:
                            start_str, end_str = value.split(",")

                            start_date = datetime.datetime.strptime(
                                start_str.strip(), "%Y-%m-%d"
                            ).date()

                            end_date = datetime.datetime.strptime(
                                end_str.strip(), "%Y-%m-%d"
                            ).date()

                            days = (end_date - start_date).days + 1

                            if start_date <= today <= end_date:
                                include_today = True
                                days -= 1

                        except Exception as e:
                            print("Date parsing error:", e)
                            days = 0

        return max(days, 0), include_today, is_yesterday_only

    @classmethod
    async def get_estimated_generated(cls, data, sap_ids=None):
        try:
            raw_filters = getattr(data, "filters", None) or {}

            num_days, include_today, is_yesterday_only = cls.get_days_from_filter(raw_filters)

            if num_days == 0 and not is_yesterday_only:
                return {"status": "success", "estimated_energy": 0}

            #  MASTER SAP IDS
            if sap_ids:
                matched_sap_ids = sap_ids
            else:
                sap_filter = raw_filters.get("sap_id") if isinstance(raw_filters, dict) else None

                if sap_filter:
                    matched_sap_ids = sap_filter if isinstance(sap_filter, list) else [sap_filter]
                else:
                    matched_result = await cls.get_matched_sap_ids(data)
                    if matched_result.get("status") != "success":
                        return matched_result
                    matched_sap_ids = matched_result.get("matched_sap_ids", [])

            if not matched_sap_ids:
                return {"status": "success", "estimated_energy": 0}

            sap_ids_str = ",".join(f"'{sap}'" for sap in matched_sap_ids)

            # ---------------- FETCH METADATA ----------------
            meta_query = f"""
                SELECT sap_id, location_name, zone
                FROM public.solar_plant_capacity
                WHERE sap_id IN ({sap_ids_str})
            """

            meta_res = await urdhva_base.BasePostgresModel.get_aggr_data(meta_query, limit=0, skip=0)
            meta_rows = meta_res.get("data", [])
            meta_map = {row["sap_id"]: row for row in meta_rows}

            # ---------------- BASE QUERY ----------------
            base_query = f"""
                FROM public.solar_plant_capacity
                WHERE LOWER(TRIM("monitoring")) = 'yes'
                  AND LOWER(TRIM("doc")) <> 'pending'
                  AND sap_id IN ({sap_ids_str})
            """

            # ---------------- REMOVE TIMESTAMP FILTER ----------------
            cleaned_filters = None
            if isinstance(raw_filters, list):
                cleaned_filters = []
                for f in raw_filters:
                    col = f.get("key") if isinstance(f, dict) else getattr(f, "key", None)
                    if col and col.lower() == "timestamp_ist":
                        continue
                    cleaned_filters.append(f)

            if cleaned_filters:
                base_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                    base_query,
                    cleaned_filters,
                    getattr(data, "drill_state", None)
                )

            # ---------------- CAPACITY QUERY ----------------
            cap_query = f"""
                SELECT 
                    sap_id, 
                    SUM(capacity_kw::numeric) AS capacity_kw
                {base_query}
                GROUP BY sap_id
            """

            cap_res = await urdhva_base.BasePostgresModel.get_aggr_data(cap_query, limit=0, skip=0)
            cap_rows = cap_res.get("data", [])

            if not cap_rows:
                return {"status": "success", "estimated_energy": 0}

            # ---------------- CALCULATION ----------------
            total_estimated_energy = 0.0
            total_capacity = 0.0

            location_map = {}
            zone_map = {}

            for row in cap_rows:
                sap_id = row["sap_id"]
                cap = float(row["capacity_kw"] or 0)

                total_capacity += cap

                # -------- ENERGY LOGIC --------
                if is_yesterday_only:
                    energy = cap * 4 * 1
                else:
                    energy = cap * 4 * num_days

                total_estimated_energy += energy

                # -------- METADATA --------
                meta = meta_map.get(sap_id, {})
                location = meta.get("location_name", "UNKNOWN")
                zone = meta.get("zone", "UNKNOWN")

                # -------- LOCATION AGG --------
                loc_key = (location, sap_id)
                if loc_key not in location_map:
                    location_map[loc_key] = {
                        "estimated_energy": 0,
                        "total_capacity_kw": 0
                    }

                location_map[loc_key]["estimated_energy"] += energy
                location_map[loc_key]["total_capacity_kw"] += cap

                # -------- ZONE AGG --------
                zone_key = (zone, location, sap_id)
                if zone_key not in zone_map:
                    zone_map[zone_key] = {
                        "estimated_energy": 0,
                        "total_capacity_kw": 0
                    }

                zone_map[zone_key]["estimated_energy"] += energy
                zone_map[zone_key]["total_capacity_kw"] += cap

            return {
                "status": "success",
                "estimated_energy": round(total_estimated_energy, 2),
                "total_capacity_kw": round(total_capacity, 2),
                "days_counted": num_days,

                "location_wise": [
                    {
                        "location_name": loc,
                        "sap_id": sap,
                        "estimated_energy": round(val["estimated_energy"], 2),
                        "total_capacity_kw": round(val["total_capacity_kw"], 2),
                        "days_counted": num_days
                    }
                    for (loc, sap), val in location_map.items()
                ],

                "zone_wise": [
                    {
                        "zone": zone,
                        "location_name": loc,
                        "sap_id": sap,
                        "estimated_energy": round(val["estimated_energy"], 2),
                        "total_capacity_kw": round(val["total_capacity_kw"], 2),
                        "days_counted": num_days
                    }
                    for (zone, loc, sap), val in zone_map.items()
                ]
            }

        except Exception as e:
            traceback.print_exc()
            return {
                "status": "error",
                "message": "Failed to fetch estimated energy",
                "error": str(e)
            }

    # MAIN ENERGY FUNCTION
    @classmethod
    async def get_energy_generated(cls, data):
        try:
            raw_filters = getattr(data, "filters", None) or {}

            # ---------------- FLAGS ----------------
            num_days, include_today, is_yesterday_only = cls.get_days_from_filter(raw_filters)

            # safety rule
            if is_yesterday_only:
                include_today = False

            # ACTUAL ENERGY
            actual_res = await cls.get_actual_generated(data)
            if actual_res.get("status") != "success":
                return actual_res

            total_actual_energy = float(actual_res.get("actual_energy", 0))

            # =====================================================
            # PAST ESTIMATED ENERGY
            # =====================================================
            past_est = await cls.get_estimated_generated(data)
            if past_est.get("status") != "success":
                return past_est

            total_estimated_energy = float(past_est.get("estimated_energy", 0))

            # =====================================================
            # ADD TODAY IF REQUIRED
            # =====================================================
            if include_today:
                today_est = await cls.get_estimated_generated_today(data)

                if today_est.get("status") != "success":
                    return today_est

                total_estimated_energy += float(today_est.get("estimated_energy", 0))

            # =====================================================
            # EFFICIENCY
            # =====================================================
            efficiency = (
                (total_actual_energy / total_estimated_energy) * 100
                if total_estimated_energy > 0 else 0
            )

            # =====================================================
            # RESPONSE
            # =====================================================
            return {
                "status": "success",
                "estimated_energy": f"{total_estimated_energy:.2f}",
                "actual_energy": f"{total_actual_energy:.2f}",
                "efficiency_percentage": f"{efficiency:.2f}"
            }

        except Exception as e:
            traceback.print_exc()
            return {
                "status": "error",
                "message": "Failed to fetch energy generated",
                "error": str(e)
            }

    @classmethod
    async def get_efficiency(cls, data):
        try:
            print("data: ", data)

            raw_filters = getattr(data, "filters", None) or {}

            efficiency_filter = None
            selected_zone = None
            selected_plant = None

            for f in raw_filters:
                key = f.get("key") if isinstance(f, dict) else getattr(f, "key", None)
                value = f.get("value") if isinstance(f, dict) else getattr(f, "value", None)

                if key == "efficiency_category":
                    efficiency_filter = value

                elif key == "zone":
                    selected_zone = str(value).strip()

                elif key == "plant":
                    selected_plant = str(value).strip()

            # ==============================
            # REMOVE efficiency_category FROM DB FILTER
            # ==============================
            if raw_filters:
                raw_filters = [
                    f for f in raw_filters
                    if (f.get("key") if isinstance(f, dict) else getattr(f, "key", None)) != "efficiency_category"
                ]
            else:
                raw_filters = []

            data.filters = raw_filters

            print("filters after cleanup:", raw_filters)

            category = getattr(data, "category", None)

            # ---------------- FLAGS ----------------
            num_days, include_today, is_yesterday_only = cls.get_days_from_filter(raw_filters)

            if is_yesterday_only:
                include_today = False

            # =====================================================
            # STEP 1: ACTUAL DATA
            # =====================================================
            actual_res = await cls.get_actual_generated(data)
            if actual_res.get("status") != "success":
                return actual_res

            actual_list = actual_res.get("location_wise", [])
            zone_list = actual_res.get("zone_wise", [])

            actual_map = {}
            for row in actual_list:
                key = (str(row["location_name"]).strip(), str(row["sap_id"]).strip())
                actual_map[key] = actual_map.get(key, 0) + float(row.get("energy_generated", 0))

            zone_lookup = {
                (str(row["location_name"]).strip(), str(row["sap_id"]).strip()):
                    row.get("zone", "UNKNOWN")
                for row in zone_list
            }

            # =====================================================
            # STEP 2: ESTIMATED DATA
            # =====================================================
            est_res = await cls.get_estimated_generated(data)
            if est_res.get("status") != "success":
                return est_res

            estimated_map = {
                (str(row["location_name"]).strip(), str(row["sap_id"]).strip()):
                    float(row.get("estimated_energy", 0))
                for row in est_res.get("location_wise", [])
            }

            # =====================================================
            # STEP 3: ADD TODAY
            # =====================================================
            if include_today:
                today_res = await cls.get_estimated_generated_today(data)
                if today_res.get("status") != "success":
                    return today_res

                for row in today_res.get("location_wise", []):
                    key = (str(row["location_name"]).strip(), str(row["sap_id"]).strip())
                    estimated_map[key] = estimated_map.get(key, 0) + float(row.get("estimated_energy", 0))

            # =====================================================
            # STEP 4: PROCESS
            # =====================================================
            exceptional, normal, underperforming, critical = [], [], [], []

            plant_bucket = {}
            zone_bucket = {}

            all_keys = set(actual_map.keys()) & set(estimated_map.keys())

            for key in all_keys:
                location, sap_id = key
                zone = zone_lookup.get(key, "UNKNOWN")

                # FAST FILTERS
                if selected_zone and zone != selected_zone:
                    continue

                if selected_plant and location != selected_plant:
                    continue

                actual = actual_map[key]
                estimated = estimated_map[key]

                if estimated <= 0:
                    continue

                efficiency = (actual / estimated) * 100

                plant_detail = {
                    "LocationName": location,
                    "Plant_cd": sap_id,
                    "energy_generated": f"{actual:.2f}",
                    "efficiency": f"{efficiency:.2f}",
                    "estimated_energy": f"{estimated:.2f}"
                }

                # ================= CATEGORY =================
                if efficiency > 95:
                    bucket = "exceptional"
                elif efficiency >= 85:
                    bucket = "normal"
                elif efficiency >= 50:
                    bucket = "underperforming"
                else:
                    bucket = "critical"

                #  APPLY CLICK FILTER
                if efficiency_filter and bucket != efficiency_filter:
                    continue

                # ================= OVERALL =================
                if bucket == "exceptional":
                    exceptional.append(plant_detail)
                elif bucket == "normal":
                    normal.append(plant_detail)
                elif bucket == "underperforming":
                    underperforming.append(plant_detail)
                else:
                    critical.append(plant_detail)

                # ================= PLANT =================
                if category == "plant":
                    if location not in plant_bucket:
                        plant_bucket[location] = {
                            "plant": location,
                            "exceptional": {"count": 0}, "exceptional_data": [],
                            "normal": {"count": 0}, "normal_data": [],
                            "underperforming": {"count": 0}, "underperforming_data": [],
                            "critical": {"count": 0}, "critical_data": []
                        }

                    plant_bucket[location][bucket]["count"] += 1
                    plant_bucket[location][f"{bucket}_data"].append(plant_detail)

                # ================= ZONE =================
                if category == "zone":
                    if zone not in zone_bucket:
                        zone_bucket[zone] = {
                            "zone": zone,
                            "exceptional": {"count": 0}, "exceptional_data": [],
                            "normal": {"count": 0}, "normal_data": [],
                            "underperforming": {"count": 0}, "underperforming_data": [],
                            "critical": {"count": 0}, "critical_data": []
                        }

                    zone_bucket[zone][bucket]["count"] += 1
                    zone_bucket[zone][f"{bucket}_data"].append(plant_detail)

            # =====================================================
            # FINAL DRILL → TABLE (PLANT CLICK)
            # =====================================================
            if selected_plant:
                return {
                    "status": "success",
                    "data": underperforming + critical + normal + exceptional
                }

            # =====================================================
            # RESPONSE
            # =====================================================
            if category == "plant":
                return {"status": "success", "heatmap_data": list(plant_bucket.values())}

            if category == "zone":
                return {"status": "success", "heatmap_data": list(zone_bucket.values())}

            return {
                "status": "success",
                "exceptional": len(exceptional),
                "normal": len(normal),
                "underperforming": len(underperforming),
                "critical": len(critical),
                "exceptional_data": exceptional,
                "normal_data": normal,
                "underperforming_data": underperforming,
                "critical_data": critical
            }

        except Exception as e:
            traceback.print_exc()
            return {"status": "error", "error": str(e)}

    @classmethod
    async def get_active_inactive_total_plants(cls, data):
        try:
            filters = getattr(data, "filters", None)
            drill_state = getattr(data, "drill_state", None)
            bu_code = getattr(data, "bu", None)

            if not bu_code:
                return {"status": "error", "message": "BU code is required"}

            # ---------------- ACTIVE (FILTERED DB) ----------------
            base_query = """
                FROM public.solar_generation_summary
                WHERE sap_id IS NOT NULL
            """

            if filters:
                base_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                    base_query,
                    filters,
                    drill_state
                )

            filtered_query = f"""
                SELECT DISTINCT sap_id
                {base_query}
            """

            filtered_raw = await urdhva_base.BasePostgresModel.get_aggr_data(filtered_query,limit=0)
            filtered_data = filtered_raw.get("data", [])

            filtered_sap_ids = {
                str(row["sap_id"]).strip()
                for row in filtered_data if row.get("sap_id")
            }

            # ---------------- ALL-TIME DB ----------------
            all_db_query = """
                SELECT DISTINCT sap_id
                FROM public.solar_generation_summary
                WHERE sap_id IS NOT NULL
            """

            all_db_raw = await urdhva_base.BasePostgresModel.get_aggr_data(all_db_query, limit=0)
            all_db_data = all_db_raw.get("data", [])

            all_db_sap_ids = {
                str(row["sap_id"]).strip()
                for row in all_db_data if row.get("sap_id")
            }

            # ---------------- EXCEL (PLANT MASTER) ----------------
            excel_query = """
                SELECT sap_id, location_name, capacity_kw
                FROM public.solar_plant_capacity
                WHERE sap_id IS NOT NULL
                  AND LOWER(TRIM(monitoring)) = 'yes'
                  AND LOWER(TRIM(doc)) <> 'pending'
            """
            # ---------------- APPLY FILTERS ----------------
            if getattr(data, "filters", None):

                cleaned_filters = []

                for f in data.filters:
                    # get column safely (dict or object)
                    col = (
                        f.get("key")
                        if isinstance(f, dict)
                        else getattr(f, "key", None)
                    )

                    # skip TimestampUTC
                    if col and col.lower() == "timestamp_ist":
                        continue

                    cleaned_filters.append(f)

                if cleaned_filters:
                    excel_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                        excel_query,
                        cleaned_filters,
                        getattr(data, "drill_state", None)
                    )

            excel_raw = await urdhva_base.BasePostgresModel.get_aggr_data(excel_query, limit=0)
            excel_data = excel_raw.get("data", [])

            if not excel_data:
                return {
                    "status": "error",
                    "message": "No plant capacity data found"
                }

            # ---------------- STEP 1: AGGREGATE EXCEL DATA ----------------
            from collections import defaultdict

            plant_map = defaultdict(lambda: {
                "PLANT_CD": None,
                "LocationName": "",
                "Plant_Capacity": 0.0
            })

            for row in excel_data:
                sap_id = str(row.get("sap_id")).strip() if row.get("sap_id") else None
                if not sap_id:
                    continue

                plant_map[sap_id]["PLANT_CD"] = sap_id
                plant_map[sap_id]["LocationName"] = row.get("location_name") or ""

                plant_map[sap_id]["Plant_Capacity"] += float(row.get("capacity_kw") or 0)

            total_plants_list = list(plant_map.values())

            # ---------------- STEP 2: CLASSIFY PLANTS ----------------
            active_plants_list = []
            inactive_plants_list = []
            not_connected_plants_list = []

            for plant in total_plants_list:
                sap_id = plant["PLANT_CD"]

                if sap_id in filtered_sap_ids:
                    plant["status"] = "Active"
                    active_plants_list.append(plant)

                elif sap_id in all_db_sap_ids:
                    plant["status"] = "Inactive"
                    inactive_plants_list.append(plant)

                else:
                    plant["status"] = "Not connected"
                    not_connected_plants_list.append(plant)

            # ---------------- COUNTS ----------------
            total_plants = len(total_plants_list)
            active_plants = len(active_plants_list)
            inactive_plants = len(inactive_plants_list)
            not_connected_plants = len(not_connected_plants_list)

            # ---------------- RESPONSE ----------------
            return {
                "status": "success",
                "bu": bu_code,

                "total_plants": total_plants,
                "active_plants": active_plants,
                "inactive_plants": inactive_plants,
                "not_connected_plants": not_connected_plants,

                "total_plants_list": total_plants_list,
                "active_plants_list": active_plants_list,
                "inactive_plants_list": inactive_plants_list,
                "not_connected_plants_list": not_connected_plants_list
            }

        except Exception as e:
            traceback.print_exc()
            return {
                "status": "error",
                "message": str(e),
                "total_plants": 0,
                "active_plants": 0,
                "inactive_plants": 0,
                "not_connected_plants": 0,
                "total_plants_list": [],
                "active_plants_list": [],
                "inactive_plants_list": [],
                "not_connected_plants_list": []
            }

    @classmethod
    async def get_solar_summary(cls, data):
        try:
            raw_filters = getattr(data, "filters", None) or {}
            drill_state = getattr(data, "drill_state", None)

            # ---------------- FLAGS ----------------
            num_days, include_today, is_yesterday_only = cls.get_days_from_filter(raw_filters)

            if is_yesterday_only:
                include_today = False

            # =====================================================
            # STEP 1: MASTER DATA (ALL PLANTS WITH FULL META)
            # =====================================================
            master_query = """
                SELECT 
                    sap_id,
                    location_name,
                    zone,
                    bu,
                    SUM(capacity_kw::numeric) AS capacity_kw
                FROM public.solar_plant_capacity
                WHERE sap_id IS NOT NULL
                  AND LOWER(TRIM(monitoring)) = 'yes'
                  AND LOWER(TRIM(doc)) <> 'pending'
                GROUP BY sap_id, location_name, zone, bu
            """

            # ---------------- APPLY FILTERS ----------------
            if getattr(data, "filters", None):

                cleaned_filters = []

                for f in data.filters:
                    # get column safely (dict or object)
                    col = (
                        f.get("key")
                        if isinstance(f, dict)
                        else getattr(f, "key", None)
                    )

                    # skip TimestampUTC
                    if col and col.lower() == "timestamp_ist":
                        continue

                    cleaned_filters.append(f)

                if cleaned_filters:
                    master_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                        master_query,
                        cleaned_filters,
                        getattr(data, "drill_state", None)
                    )

            master_res = await urdhva_base.BasePostgresModel.get_aggr_data(master_query,limit=0,skip=0)
            master_data = master_res.get("data", [])

            if not master_data:
                return {"status": "error", "message": "No plant master data found"}

            # -------- MASTER MAP --------
            master_map = {}
            for row in master_data:
                sap_id = str(row.get("sap_id")).strip() if row.get("sap_id") else None
                if not sap_id:
                    continue

                master_map[sap_id] = {
                    "name": row.get("location_name", ""),
                    "zone": row.get("zone", ""),
                    "bu": row.get("bu", ""),
                    "capacity": float(row.get("capacity_kw") or 0)
                }

            all_master_sap_ids = list(master_map.keys())

            # =====================================================
            # STEP 2: STATUS LOGIC (MATCH ACTIVE/INACTIVE API)
            # =====================================================
            base_query = """
                FROM public.solar_generation_summary
                WHERE sap_id IS NOT NULL
            """

            if raw_filters:
                base_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                    base_query, raw_filters, drill_state
                )

            # -------- FILTERED (ONLINE) --------
            filtered_query = f"""SELECT DISTINCT sap_id {base_query}"""
            filtered_raw = await urdhva_base.BasePostgresModel.get_aggr_data(filtered_query,limit=0,skip=0)

            filtered_sap_ids = {
                str(row["sap_id"]).strip()
                for row in filtered_raw.get("data", []) if row.get("sap_id")
            }

            # -------- ALL DB (OFFLINE) --------
            all_db_query = """
                SELECT DISTINCT sap_id
                FROM public.solar_generation_summary
                WHERE sap_id IS NOT NULL
            """

            all_db_raw = await urdhva_base.BasePostgresModel.get_aggr_data(all_db_query, limit=0,skip=0)

            all_db_sap_ids = {
                str(row["sap_id"]).strip()
                for row in all_db_raw.get("data", []) if row.get("sap_id")
            }

            # =====================================================
            # STEP 3: ACTUAL ENERGY
            # =====================================================
            actual_res = await cls.get_actual_generated(data)
            if actual_res.get("status") != "success":
                return actual_res

            total_actual_energy = float(actual_res.get("actual_energy", 0))

            actual_map = {}
            for r in actual_res.get("location_wise", []):
                sap_id = str(r.get("sap_id")).strip() if r.get("sap_id") else None
                if sap_id:
                    actual_map[sap_id] = actual_map.get(sap_id, 0) + float(r.get("energy_generated") or 0)

            # =====================================================
            # STEP 4: ESTIMATED ENERGY (ALL PLANTS)
            # =====================================================
            est_res = await cls.get_estimated_generated(data, sap_ids=all_master_sap_ids)
            if est_res.get("status") != "success":
                return est_res

            total_estimated_energy = float(est_res.get("estimated_energy", 0))

            estimated_map = {}
            for r in est_res.get("zone_wise", []):
                sap_id = str(r.get("sap_id")).strip() if r.get("sap_id") else None
                if sap_id:
                    estimated_map[sap_id] = estimated_map.get(sap_id, 0) + float(r.get("estimated_energy") or 0)

            # ---------------- TODAY ESTIMATION ----------------
            if include_today:
                today_res = await cls.get_estimated_generated_today(
                    data, sap_ids=all_master_sap_ids
                )
                if today_res.get("status") != "success":
                    return today_res

                total_estimated_energy += float(today_res.get("estimated_energy", 0))

                for r in today_res.get("zone_wise", []):
                    sap_id = str(r.get("sap_id")).strip() if r.get("sap_id") else None
                    if sap_id:
                        estimated_map[sap_id] = estimated_map.get(sap_id, 0) + float(
                            r.get("estimated_energy") or 0
                        )

            # =====================================================
            # STEP 5: FINAL SUMMARY
            # =====================================================
            summary = []

            for sap_id, meta in master_map.items():

                actual = actual_map.get(sap_id, 0.0)
                estimated = estimated_map.get(sap_id, 0.0)

                efficiency = (actual / estimated) * 100 if estimated > 0 else 0

                # -------- STATUS --------
                if sap_id in filtered_sap_ids:
                    status = "Online"
                elif sap_id in all_db_sap_ids:
                    status = "Offline"
                else:
                    status = "Not connected"

                summary.append({
                    "bu": meta["bu"],
                    "zone": meta["zone"],
                    "sap_id": sap_id,
                    "name": meta["name"],
                    "Plant_Capacity": round(meta["capacity"], 2),
                    "estimated_energy": round(estimated, 2),
                    "actual_energy": round(actual, 2),
                    "efficiency": round(efficiency, 2),
                    "status": status
                })

            # =====================================================
            # FINAL RESPONSE
            # =====================================================
            overall_efficiency = (
                (total_actual_energy / total_estimated_energy) * 100
                if total_estimated_energy > 0 else 0
            )

            return {
                "status": "success",
                "total_actual_energy": round(total_actual_energy, 2),
                "total_estimated_energy": round(total_estimated_energy, 2),
                "efficiency_percentage": round(overall_efficiency, 2),
                "summary": summary
            }

        except Exception as e:
            traceback.print_exc()
            return {
                "status": "error",
                "message": str(e)
            }

    @classmethod
    async def get_efficiency_last_30_days(cls, data):
        try:
            raw_filters = getattr(data, "filters", None) or {}
            drill_state = getattr(data, "drill_state", None)

            # ---------------- MATCHED SAP IDS ----------------
            matched_result = await cls.get_matched_sap_ids(data)
            if matched_result.get("status") != "success":
                return matched_result

            matched_sap_ids = matched_result.get("matched_sap_ids", [])

            if not matched_sap_ids:
                return {"status": "success", "data": []}

            sap_ids_str = ",".join(f"'{sap}'" for sap in matched_sap_ids)

            # =====================================================
            # STEP 1: ACTUAL GENERATION (DAY-WISE)
            # =====================================================
            base_query = f"""
                FROM public.solar_generation_summary
                WHERE sap_id IN ({sap_ids_str})
            """

            if raw_filters:
                base_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                    base_query, raw_filters, drill_state
                )

            actual_query = f"""
                SELECT 
                    DATE(timestamp_ist) AS date,
                    SUM(solar_generation_kwh::numeric) AS generation
                {base_query}
                GROUP BY DATE(timestamp_ist)
                ORDER BY DATE(timestamp_ist)
            """

            actual_res = await urdhva_base.BasePostgresModel.get_aggr_data(actual_query,limit=0)
            actual_rows = actual_res.get("data", [])

            if not actual_rows:
                return {"status": "success", "data": []}

            # =====================================================
            # STEP 2: TOTAL CAPACITY (FOR ESTIMATION)
            # =====================================================
            cap_query = f"""
                SELECT 
                    SUM(capacity_kw::numeric) AS total_capacity
                FROM public.solar_plant_capacity
                WHERE sap_id IN ({sap_ids_str})
                  AND LOWER(TRIM(monitoring)) = 'yes'
                  AND LOWER(TRIM(doc)) <> 'pending'
            """
            # ---------------- APPLY FILTERS ----------------
            if getattr(data, "filters", None):

                cleaned_filters = []

                for f in data.filters:
                    # get column safely (dict or object)
                    col = (
                        f.get("key")
                        if isinstance(f, dict)
                        else getattr(f, "key", None)
                    )

                    # skip TimestampUTC
                    if col and col.lower() == "timestamp_ist":
                        continue

                    cleaned_filters.append(f)

                if cleaned_filters:
                    cap_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                        cap_query,
                        cleaned_filters,
                        getattr(data, "drill_state", None)
                    )

            cap_res = await urdhva_base.BasePostgresModel.get_aggr_data(cap_query,limit=0)
            total_capacity = float(
                cap_res.get("data", [{}])[0].get("total_capacity", 0)
            )

            if total_capacity == 0:
                return {"status": "success", "data": []}

            # =====================================================
            # STEP 3: CALCULATE TREND
            # =====================================================
            data_list = []

            for row in actual_rows:
                date = str(row["date"])
                generation = float(row["generation"] or 0)

                # estimation per day
                estimated = total_capacity * 4

                efficiency = (generation / estimated) * 100 if estimated > 0 else 0

                data_list.append({
                    "date": date,
                    "generation": round(generation, 2),
                    "efficiency": round(efficiency, 2)
                })

            # =====================================================
            # FINAL RESPONSE
            # =====================================================
            return {
                "status": "success",
                "data": data_list
            }

        except Exception as e:
            traceback.print_exc()
            return {
                "status": "error",
                "message": "Failed to fetch efficiency trend",
                "error": str(e)
            }

    @classmethod
    async def get_insights(cls, data):
        try:

            raw_filters = getattr(data, "filters", None) or {}

            # ================= FLAGS =================
            num_days, include_today, is_yesterday_only = cls.get_days_from_filter(raw_filters)

            if is_yesterday_only:
                include_today = False

            # =====================================================
            # STEP 1: GET MATCHED SAP IDS
            # =====================================================
            matched_result = await cls.get_matched_sap_ids(data)
            if matched_result.get("status") != "success":
                return matched_result

            sap_ids = matched_result.get("matched_sap_ids", [])
            if not sap_ids:
                return {"status": "success", "data": []}

            sap_ids_str = ",".join(f"'{sap}'" for sap in sap_ids)

            # =====================================================
            # STEP 2: ACTUAL ENERGY
            # =====================================================
            actual_res = await cls.get_actual_generated(data)
            if actual_res.get("status") != "success":
                return actual_res

            actual_map = {}
            for r in actual_res.get("location_wise", []):
                sap = str(r.get("sap_id")).strip()
                actual_map[sap] = actual_map.get(sap, 0) + float(r.get("energy_generated") or 0)

            # =====================================================
            # STEP 3: ESTIMATED ENERGY
            # =====================================================
            est_res = await cls.get_estimated_generated(data)
            if est_res.get("status") != "success":
                return est_res

            estimated_map = {}
            for r in est_res.get("zone_wise", []):
                sap = str(r.get("sap_id")).strip()
                estimated_map[sap] = estimated_map.get(sap, 0) + float(r.get("estimated_energy") or 0)

            # -------- TODAY ESTIMATION --------
            if include_today:
                today_res = await cls.get_estimated_generated_today(data)
                if today_res.get("status") != "success":
                    return today_res

                for r in today_res.get("zone_wise", []):
                    sap = str(r.get("sap_id")).strip()
                    estimated_map[sap] = estimated_map.get(sap, 0) + float(r.get("estimated_energy") or 0)

            # =====================================================
            # STEP 4: CAPACITY
            # =====================================================
            cap_query = f"""
                SELECT sap_id, location_name, SUM(capacity_kw::numeric) AS capacity_kw
                FROM public.solar_plant_capacity
                WHERE sap_id IN ({sap_ids_str})
                  AND LOWER(TRIM(monitoring)) = 'yes'
                  AND LOWER(TRIM(doc)) <> 'pending'
                GROUP BY sap_id, location_name
            """

            cap_res = await urdhva_base.BasePostgresModel.get_aggr_data(cap_query,limit=0)
            cap_rows = cap_res.get("data", [])

            # STEP 4.5: OUTAGE
            outage_query = f"""
                SELECT 
                    sap_id,
                    SUM(COALESCE(solar_outage_hrs::numeric, 0)) AS solar_outage_hrs
                FROM public.solar_outage_summary
                WHERE sap_id IN ({sap_ids_str})
                GROUP BY sap_id
            """

            if raw_filters:
                outage_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                    outage_query,
                    raw_filters,
                    getattr(data, "drill_state", None)
                )

            outage_res = await urdhva_base.BasePostgresModel.get_aggr_data(outage_query,limit=0)
            outage_rows = outage_res.get("data", [])

            outage_map = {
                str(r["sap_id"]).strip(): float(r.get("solar_outage_hrs") or 0)
                for r in outage_rows
            }

            # =====================================================
            # STEP 4.7: SOLAR WINDOW + GENERATION HOURS (FIXED)
            # =====================================================
            solar_window_query = f"""
                SELECT *
                FROM public.solar_generation_summary
                WHERE sap_id IN ({sap_ids_str})
            """

            if raw_filters:
                solar_window_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                    solar_window_query,
                    raw_filters,
                    getattr(data, "drill_state", None)
                )

            solar_window_res = await urdhva_base.BasePostgresModel.get_aggr_data(solar_window_query,limit=0)
            solar_window_rows = solar_window_res.get("data", [])

            solar_window_df = pl.DataFrame(solar_window_rows)

            solar_window_map = {}
            generation_hours_map = {}
            solar_window_map_mean = {}
            generation_hours_map_mean = {}


            if not solar_window_df.is_empty():

                grouped = solar_window_df.partition_by("sap_id")
                print("grouped: ",grouped)

                for df in grouped:
                    sap_id = str(df.select(pl.col("sap_id").first()).item()).strip()

                    # ---- SOLAR WINDOW HOURS ----
                    solar_window_hours = (
                            df.select([
                                pl.col("solar_start_time"),

                                pl.when(pl.col("solar_window_hrs").cast(pl.Utf8).str.strip_chars() == "")
                                .then(None)
                                .otherwise(pl.col("solar_window_hrs"))
                                .cast(pl.Float64)
                                .alias("solar_window_hrs")

                            ])
                            .drop_nulls(subset=["solar_start_time"])
                            .unique(subset=["solar_start_time"])
                            .select(pl.col("solar_window_hrs").sum())
                            .item() or 0
                    )

                    # ---- GENERATION HOURS ----
                    generation_hours = (
                            df.select(
                                pl.when(pl.col("solar_generation_hrs").cast(pl.Utf8).str.strip_chars() == "")
                                .then(None)
                                .otherwise(pl.col("solar_generation_hrs"))
                                .cast(pl.Float64)
                                .sum()
                            ).item() or 0
                    )

                    solar_window_hours_mean = (
                            df.select([
                                pl.col("solar_start_time"),

                                pl.when(pl.col("solar_window_hrs").cast(pl.Utf8).str.strip_chars() == "")
                                .then(None)
                                .otherwise(pl.col("solar_window_hrs"))
                                .cast(pl.Float64)
                                .alias("solar_window_hrs")

                            ])
                            .drop_nulls(subset=["solar_start_time"])
                            .unique(subset=["solar_start_time"])
                            .select(pl.col("solar_window_hrs").mean())
                            .item() or 0
                    )



                    generation_hours_mean = (
                            df.select(
                                pl.when(pl.col("solar_generation_hrs_day").cast(pl.Utf8).str.strip_chars() == "")
                                .then(None)
                                .otherwise(pl.col("solar_generation_hrs_day"))
                                .cast(pl.Float64)
                                .mean()
                            ).item() or 0
                    )


                    solar_window_map[sap_id] = float(solar_window_hours)
                    generation_hours_map[sap_id] = float(generation_hours)
                    solar_window_map_mean[sap_id] = float(solar_window_hours_mean)
                    generation_hours_map_mean[sap_id] = float(generation_hours_mean)



            # =====================================================
            # STEP 5: FINAL CALCULATIONS
            # =====================================================
            insights = []

            for row in cap_rows:
                sap_id = str(row["sap_id"]).strip()
                location = row.get("location_name", "")
                capacity = float(row.get("capacity_kw") or 0)

                actual_energy = actual_map.get(sap_id, 0)
                estimated_energy = estimated_map.get(sap_id, 0)

                solar_window_hours = solar_window_map.get(sap_id, 0)
                energy_generation_hours = generation_hours_map.get(sap_id, 0)
                solar_window_hours_mean = solar_window_map_mean.get(sap_id, 0)
                energy_generation_hours_mean = generation_hours_map_mean.get(sap_id, 0)


                power_outage_hours = outage_map.get(sap_id, 0)

                export_available_hour = max(0, solar_window_hours - power_outage_hours)

                if solar_window_hours > 0:
                    grid_availability_percentage = (
                            (export_available_hour / solar_window_hours) * 100
                    )

                    loss_of_power_outage = estimated_energy * (
                            power_outage_hours / solar_window_hours
                    )

                    adjusted_expected = estimated_energy * (
                            export_available_hour / solar_window_hours
                    )
                else:
                    grid_availability_percentage = 0
                    loss_of_power_outage = 0
                    adjusted_expected = 0

                loss_of_power_outage_percentage = (
                    (loss_of_power_outage / estimated_energy) * 100
                    if estimated_energy else 0
                )

                dust_loss = max(0, adjusted_expected - actual_energy)

                dust_loss_percentage = (
                    (dust_loss / adjusted_expected) * 100
                    if adjusted_expected else 0
                )

                efficiency = (
                    (actual_energy / adjusted_expected) * 100
                    if adjusted_expected else 0
                )

                insights.append({
                    "sap_id": sap_id,
                    "LocationName": location,
                    "actual_energy": round(actual_energy, 2),
                    "estimated_energy": round(estimated_energy, 2),
                    "energy_generation_hours": round(energy_generation_hours_mean, 2),
                    "solar_window_hours": round(solar_window_hours_mean, 2),
                    "power_outage": round(power_outage_hours, 2),
                    "adjusted_expected": round(adjusted_expected, 2),
                    "loss_of_power_outage": round(loss_of_power_outage, 2),
                    "loss_of_power_outage_percentage": round(loss_of_power_outage_percentage, 2),
                    "efficiency_estimated_actual_percentage": round(efficiency, 2),
                    "loss_dust_soil_percentage": round(dust_loss_percentage, 2),
                    "total_loss": round(dust_loss_percentage + loss_of_power_outage_percentage, 2),
                    "grid_availability_percentage": round(grid_availability_percentage, 2)
                })

            return {
                "status": "success",
                "data": insights
            }

        except Exception as e:
            traceback.print_exc()
            return {
                "status": "error",
                "message": str(e)
            }

    @classmethod
    async def get_overall_insights(cls, data):
        try:
            raw_filters = getattr(data, "filters", None) or {}

            num_days, include_today, is_yesterday_only = cls.get_days_from_filter(raw_filters)

            if is_yesterday_only:
                include_today = False

            # ================= SAP IDS =================
            matched_result = await cls.get_matched_sap_ids(data)
            if matched_result.get("status") != "success":
                return matched_result

            sap_ids = matched_result.get("matched_sap_ids", [])
            if not sap_ids:
                return {"status": "success", "data": {}}

            sap_ids_str = ",".join(f"'{sap}'" for sap in sap_ids)

            # ================= ACTUAL =================
            actual_res = await cls.get_actual_generated(data)
            if actual_res.get("status") != "success":
                return actual_res

            total_actual_energy = sum(
                float(r.get("energy_generated") or 0)
                for r in actual_res.get("location_wise", [])
            )

            # ================= ESTIMATED =================
            est_res = await cls.get_estimated_generated(data)
            if est_res.get("status") != "success":
                return est_res

            total_estimated_energy = sum(
                float(r.get("estimated_energy") or 0)
                for r in est_res.get("zone_wise", [])
            )

            if include_today:
                today_res = await cls.get_estimated_generated_today(data)
                if today_res.get("status") != "success":
                    return today_res

                total_estimated_energy += sum(
                    float(r.get("estimated_energy") or 0)
                    for r in today_res.get("zone_wise", [])
                )

            # ================= OUTAGE =================
            outage_query = f"""
                SELECT SUM(COALESCE(solar_outage_hrs::numeric, 0)) AS total_outage
                FROM public.solar_outage_summary
                WHERE sap_id IN ({sap_ids_str})
            """

            if raw_filters:
                outage_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                    outage_query, raw_filters, getattr(data, "drill_state", None)
                )

            outage_res = await urdhva_base.BasePostgresModel.get_aggr_data(outage_query, limit=0)
            total_outage_hours = float(outage_res["data"][0].get("total_outage") or 0)

            # ================= SOLAR WINDOW =================
            solar_window_query = """
                                    WITH avg_data AS (
                                        SELECT 
                                            AVG(COALESCE(NULLIF(solar_window_hrs, '')::numeric, 0)) AS avg_window_hrs
                                        FROM public.solar_generation_summary
                                        WHERE timestamp_ist::DATE >= CURRENT_DATE - INTERVAL '7 DAY'
                                        GROUP BY timestamp_ist::DATE, source_id
                                    )
                                    SELECT 
                                        SUM(avg_window_hrs) AS avg_window_hrs
                                    FROM avg_data;
                             """
            if raw_filters:
                solar_window_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                    solar_window_query, raw_filters, getattr(data, "drill_state", None)
                )

            solar_window_res = await urdhva_base.BasePostgresModel.get_aggr_data(solar_window_query, limit=0)
            total_solar_window_hours = float(solar_window_res["data"][0].get("avg_window_hrs") or 0)


            solar_query = f"""
                SELECT *
                FROM public.solar_generation_summary
                WHERE sap_id IN ({sap_ids_str})
            """

            if raw_filters:
                solar_query = await widget_actions.WidgetActions.apply_filter_drilldown(
                    solar_query, raw_filters, getattr(data, "drill_state", None)
                )

            solar_res = await urdhva_base.BasePostgresModel.get_aggr_data(solar_query, limit=0)
            df = pl.DataFrame(solar_res.get("data", []))

            if df.is_empty():
                total_generation_hours = 0
            else:
                total_generation_hours = (
                        df.select(
                            pl.when(pl.col("solar_generation_hrs").cast(pl.Utf8).str.strip_chars() == "")
                            .then(None)
                            .otherwise(pl.col("solar_generation_hrs"))
                            .cast(pl.Float64)
                            .sum()
                        ).item() or 0
                )


            # ================= FINAL CALCULATIONS =================

            export_available = max(0, total_solar_window_hours - total_outage_hours)

            if total_solar_window_hours > 0:
                grid_availability_percentage = (export_available / total_solar_window_hours) * 100
                loss_of_power_outage = total_estimated_energy * (total_outage_hours / total_solar_window_hours)
                adjusted_expected = total_estimated_energy * (export_available / total_solar_window_hours)
            else:
                grid_availability_percentage = 0
                loss_of_power_outage = 0
                adjusted_expected = 0

            loss_of_power_outage_percentage = (
                (loss_of_power_outage / total_estimated_energy) * 100
                if total_estimated_energy else 0
            )

            dust_loss = max(0, adjusted_expected - total_actual_energy)

            dust_loss_percentage = (
                (dust_loss / adjusted_expected) * 100
                if adjusted_expected else 0
            )

            efficiency = (
                (total_actual_energy / adjusted_expected) * 100
                if adjusted_expected else 0
            )

            return {
                "status": "success",
                "data": {
                    "actual_energy": round(total_actual_energy, 2),
                    "estimated_energy": round(total_estimated_energy, 2),

                    "energy_generation_hours": round(total_generation_hours, 2),
                    "solar_window_hours": round(total_solar_window_hours, 2),
                    "total_outage_hours": round(total_outage_hours, 2),

                    "adjusted_expected": round(adjusted_expected, 2),
                    "loss_of_power_outage": round(loss_of_power_outage, 2),
                    "loss_of_power_outage_percentage": round(loss_of_power_outage_percentage, 2),

                    "loss_dust_soil_percentage": round(dust_loss_percentage, 2),
                    "efficiency_estimated_actual_percentage": round(efficiency, 2),

                    "grid_availability_percentage": round(grid_availability_percentage, 2),
                    "total_loss": round(dust_loss_percentage + loss_of_power_outage_percentage, 2)
                }
            }

        except Exception as e:
            traceback.print_exc()
            return {
                "status": "error",
                "message": str(e)
            }