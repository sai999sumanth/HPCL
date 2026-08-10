import urdhva_base
import datetime, zoneinfo
import hpcl_ceg_model
import os
import pandas as pd
import numpy as np
import urdhva_base.utilities
import matplotlib.pyplot as plt
import polars as pl
import xlsxwriter
import socket
import psycopg2
from concurrent.futures import ThreadPoolExecutor, as_completed
import utilities.helpers as helpers
import utilities.connection_mapping as connection_mapping
from charts_actions import charts_connection_vault_routing
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams
import orchestrator.reporting_services.lpg_reporting as lpg_reporting
import orchestrator.dbconnector.credential_loader as credential_loader


creds = credential_loader.get_credentials('APP_DB')

lpg_day_wise_trend_exl_path = ""
monthly_score_path = ""
plant_wise_score_path=""
lpg_va_path = ""
lpg_pq_path = ""

DB_CONFIG = {
    "host": creds["host"],
    "port": creds["port"],
    "database": creds["database"],
    "user": creds["user"],
    "password": creds["password"]
}


async def get_lpg_rejection():

    date = urdhva_base.utilities.get_present_time()

    # Yesterday
    date_yes = helpers.get_time_stamp_by_delta(
        date,
        days=1,
        with_month_start_day=False,
        date_time_format=None
    )

    # Current Month Start
    month_start = helpers.get_time_stamp_by_delta(
        date_yes,
        days=0,
        with_month_start_day=True,
        date_time_format="%Y-%m-%d"
    )

    current_month_filter = f"""
        (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE >= '{month_start}'
        AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE <= '{date_yes.strftime('%Y-%m-%d')}'
    """

    financial_year_filter = f"""
       (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE <= '{date_yes.strftime('%Y-%m-%d')}'
    """

    Charts_Connection_Vault_RoutingParams.connection_id = (
        connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    )

    Charts_Connection_Vault_RoutingParams.action = 'execute_query'

    function = await charts_connection_vault_routing(
        Charts_Connection_Vault_RoutingParams
    )

    query = f"""
        SELECT

            -- Current Month LPG PQ Alerts
            COUNT(
                CASE
                    WHEN {current_month_filter}
                    THEN interlock_name
                END
            ) AS pq_total_lpg,

            -- Financial Year LPG PQ Alerts
            COUNT(
                CASE
                    WHEN {financial_year_filter}
                    THEN interlock_name
                END
            ) AS total_pq_alerts_fy
        FROM alerts

        WHERE interlock_name IN (
            'O-Ring Leak Rejection',
            'Valve Leak Rejection',
            'Check Scale Rejection'
        ) AND alert_status != 'Close'
    """

    print("query----->\n", query)

    rejections = await function(query=query)

    if rejections:
        result = rejections[-1]

        return {
            "pq_critical_lpg": result["pq_total_lpg"],
            "pq_high_lpg": 0,
            "pq_total_lpg": result["pq_total_lpg"],
            "pq_total_fy_lpg": result["total_pq_alerts_fy"]
        }

    return {
        "pq_critical_lpg": 0,
        "pq_high_lpg": 0,
        "pq_total_lpg": 0,
        "pq_total_fy_lpg": 0
    }


async def lpg_top_bottom_score_plants():
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    sap_ids = [
        "2662", "2693", "2241", "2935", "2371", "2121", "2520", "2401", "2324", "2811",
        "2435", "2891", "2663", "2314", "2844", "2402", "2455", "2203", "2892", "2504",
        "2248", "2171", "2262", "2655", "2215", "2623", "2204", "2472", "2959", "2921",
        "2330", "2126", "2947", "2539", "2777", "2507", "2829", "2779", "2373", "2657",
        "2949", "2173", "2707", "2568", "2659", "2792", "2660", "2692", "2471", "2731",
        "2630", "2408", "2316", "2117", "2732"
    ]
    sap_ids_str = ", ".join([f"'{sid}'" for sid in sap_ids])
    top_query = f"""WITH plant_avg_scores AS (
                        SELECT
                            sap_id,
                            name AS "Plant Name",
                            zone AS "Zone",
                            region AS "Region",
                            AVG(score) AS avg_score
                        FROM public.performance_score_history
                        WHERE
                            bu = 'LPG'
                            AND zone != ''
                            AND region != ''
                            AND timestamp::DATE >= CASE
                                WHEN date_trunc('day', CURRENT_DATE) = date_trunc('month', CURRENT_DATE)
                                    THEN date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                                ELSE date_trunc('month', CURRENT_DATE)
                            END
                            AND timestamp::DATE < CURRENT_DATE
                            AND sap_id IN ({sap_ids_str})
                            AND name NOT ILIKE '%RO%'
                        GROUP BY sap_id, name, zone, region
                    ),
                    previous_day_scores AS (
                        SELECT
                            sap_id,
                            ROUND(AVG(score)::numeric, 2) AS prev_day_score
                        FROM public.performance_score_history
                        WHERE
                            bu = 'LPG'
                            AND timestamp::DATE = CURRENT_DATE - INTERVAL '1 day'
                        GROUP BY sap_id
                    )
                    SELECT
                        ROW_NUMBER() OVER (ORDER BY p.avg_score DESC) AS "Sl No",
                        p."Plant Name",
                        p."Zone",
                        p."Region",
                        ROUND(p.avg_score::numeric, 2) AS "Average Score from Month start",
                        COALESCE(pd.prev_day_score, 0) AS "Previous days score"
                    FROM plant_avg_scores p
                    LEFT JOIN previous_day_scores pd
                        ON p.sap_id = pd.sap_id
                    ORDER BY p.avg_score DESC
                    LIMIT 3"""
    
    bottom_query = f"""WITH plant_avg_scores AS (
                        SELECT
                            sap_id,
                            name AS "Plant Name",
                            zone AS "Zone",
                            region AS "Region",
                            AVG(score) AS avg_score
                        FROM public.performance_score_history
                        WHERE
                            bu = 'LPG'
                            AND zone != ''
                            AND region != ''
                            AND timestamp::DATE >= CASE
                                WHEN date_trunc('day', CURRENT_DATE) = date_trunc('month', CURRENT_DATE)
                                    THEN date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                                ELSE date_trunc('month', CURRENT_DATE)
                            END
                            AND timestamp::DATE < CURRENT_DATE
                            AND sap_id IN ({sap_ids_str})
                            AND name NOT ILIKE '%RO%'
                        GROUP BY sap_id, name, zone, region
                    ),
                    previous_day_scores AS (
                        SELECT
                            sap_id,
                            ROUND(AVG(score)::numeric, 2) AS prev_day_score
                        FROM public.performance_score_history
                        WHERE
                            bu = 'LPG'
                            AND timestamp::DATE = CURRENT_DATE - INTERVAL '1 day'
                        GROUP BY sap_id
                    )
                    SELECT
                        ROW_NUMBER() OVER (ORDER BY p.avg_score ASC) AS "Sl No",
                        p."Plant Name",
                        p."Zone",
                        p."Region",
                        ROUND(p.avg_score::numeric, 2) AS "Average Score from Month start",
                        COALESCE(pd.prev_day_score, 0) AS "Previous days score"
                    FROM plant_avg_scores p
                    LEFT JOIN previous_day_scores pd
                        ON p.sap_id = pd.sap_id
                    ORDER BY p.avg_score ASC
                    LIMIT 3"""
    lpg_avg_score_query = f"""SELECT
                            ROUND(AVG(score)::numeric, 2) AS lpg_average_score
                        FROM public.performance_score_history
                        WHERE sap_id IN ({sap_ids_str})
                        AND timestamp::DATE = CURRENT_DATE - INTERVAL '1 day'"""
    lpg_avg_score_resp = await function(query=lpg_avg_score_query)
    top_resp = await function(query=top_query)
    bottom_resp = await function(query=bottom_query)
    lpg_avg_score_resp = pd.DataFrame(lpg_avg_score_resp)
    if not lpg_avg_score_resp.empty:
        lpg_avg_score_value = lpg_avg_score_resp['lpg_average_score'].iloc[0]
    else:
        lpg_avg_score_value = None  # or 0 or 'N/A'
    top_resp = pd.DataFrame(top_resp)
    bottom_resp = pd.DataFrame(bottom_resp)
    return {"lpg_top_data": top_resp, "lpg_bottom_data": bottom_resp, "lpg_avg_score_resp": lpg_avg_score_value}


def generate_monthly_lpg_score_chart(df, output_path="/tmp/lpg_monthly_score.png"):
    """
    df columns required:
        - month (YYYY-MM-DD)
        - score (float)

    Output:
        Saves PNG bar chart to /tmp
    """
    global monthly_score_path
    monthly_score_path = output_path
    # Ensure datetime & correct order
    df = df.copy()
    df["month"] = pd.to_datetime(df["month"])
    df = df.sort_values("month")

    # Format month labels like Jun'25
    month_labels = df["month"].dt.strftime("%b'%y")
    scores = df["score"].tolist()

    # Create figure (matches provided image)
    plt.figure(figsize=(10, 5.2))

    bars = plt.bar(
        month_labels,
        df["score"],
        width=0.45,
        color="#0B4F6C"  # exact dark blue shade
    )

    # Title
    plt.title("Monthly Average of Plant Scores", fontsize=12)

    # Y-axis & grid
    plt.ylim(0, 110)
    plt.grid(axis="y", linestyle="--", linewidth=0.5, alpha=0.7)

    # Clean borders
    ax = plt.gca()
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    # No axis labels (same as image)
    plt.xlabel("")
    plt.ylabel("")

    # Add score values on top of bars
    for bar, score in zip(bars, scores):
        plt.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 2,
            f"{score:.2f}",
            ha="center",
            va="bottom",
            fontsize=10,
            fontweight="bold"
        )

    # Tight layout
    plt.tight_layout()

    # Save PNG
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()

    return output_path


def generate_plant_wise_score_chart(
    df,
    output_path="/tmp/lpg_plant_wise_average_score.png"
):
    """
    df columns required:
        - name
        - score
    """
    global plant_wise_score_path
    plant_wise_score_path = output_path

    # Copy & sort descending
    df = df.copy()
    df = df.sort_values("score", ascending=False).reset_index(drop=True)

    x_labels = df["name"].astype(str).tolist()
    scores = pd.to_numeric(df["score"], errors="coerce").fillna(0)

    # ===== Figure (same feel as dry-out chart) =====
    plt.figure(figsize=(17, 9))

    bars = plt.bar(
        x_labels,
        scores,
        width=0.45,              # same bar thickness
        color="#0B4F6C"
    )

    # ===== Title =====
    plt.title("Plant wise Average Score", fontsize=18, pad=20)

    # ===== Y-axis =====
    max_val = scores.max()
    upper_limit = int(np.ceil(max_val / 10.0) * 10)

    plt.ylim(0, upper_limit + 15)
    plt.yticks(
        np.arange(0, upper_limit + 1, 10),
        fontsize=14
    )

    # ===== Grid (same as dry-out chart) =====
    plt.grid(
        axis="y",
        linestyle="--",
        linewidth=0.6,
        alpha=0.5
    )

    # ===== X-axis formatting (KEY FIX) =====
    plt.xticks(
        rotation=90,
        ha="right",
        fontsize=14
    )

    plt.xlabel("Plant Name", fontsize=16, labelpad=20)
    plt.ylabel("", fontsize=14)

    # ===== FULL BOX BORDER (KEY FIX) =====
    ax = plt.gca()
    for spine in ax.spines.values():
        spine.set_visible(True)
        spine.set_linewidth(1.2)

    # ===== Value labels on top of bars =====
    for bar in bars:
        height = bar.get_height()
        plt.text(
            bar.get_x() + bar.get_width() / 2,
            height + 1,
            f"{height:.1f}",
            ha="center",
            va="bottom",
            rotation=90,
            fontsize=14,
            fontweight="bold"
        )

    # ===== Layout & Save =====
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close()

    return output_path


async def get_va_path():
    date = urdhva_base.utilities.get_present_time()

    date_yes = helpers.get_time_stamp_by_delta(
        date, days=1, with_month_start_day=False, date_time_format=None
    )

    month_start = helpers.get_time_stamp_by_delta(
        date_yes, days=0, with_month_start_day=True, date_time_format=None
    )

    date_filter = (
        f"(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE >= '{month_start.strftime('%Y-%m-%d')}' "
        f"AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE <= '{date_yes.strftime('%Y-%m-%d')}'"
    )

    query = f"""
        SELECT
            location_name AS "Plant Wise VA Alerts",
            COUNT(*) FILTER (WHERE severity = 'Critical') AS "Critical(Open)",
            COUNT(*) FILTER (WHERE severity = 'High') AS "High(Open)",
            COUNT(*) FILTER (WHERE severity = 'Medium') AS "Medium(Open)",
            COUNT(*) FILTER (WHERE severity = 'Low') AS "Low(Open)",
            1 AS sort_order
        FROM alerts
        WHERE alert_status = 'Open'
        AND alert_section = 'VA'
        AND {date_filter}
        AND bu = 'LPG'
        AND location_name != ''
        GROUP BY location_name

        UNION ALL

        SELECT
            'Total',
            COUNT(*) FILTER (WHERE severity = 'Critical'),
            COUNT(*) FILTER (WHERE severity = 'High'),
            COUNT(*) FILTER (WHERE severity = 'Medium'),
            COUNT(*) FILTER (WHERE severity = 'Low'),
            2 AS sort_order
        FROM alerts
        WHERE alert_status = 'Open'
        AND alert_section = 'VA'
        AND bu = 'LPG'
        AND location_name != ''
        AND {date_filter}

        ORDER BY sort_order
    """

    Charts_Connection_Vault_RoutingParams.connection_id = (
        connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    )
    Charts_Connection_Vault_RoutingParams.action = "execute_query"

    function = await charts_connection_vault_routing(
        Charts_Connection_Vault_RoutingParams
    )
    resp = await function(query=query)

    df = pd.DataFrame(resp)

    # Remove helper column
    df = df.drop(columns=["sort_order"])

    global lpg_va_path
    lpg_va_path = "/tmp/Plant Wise VA Alerts.xlsx"

    with pd.ExcelWriter(lpg_va_path, engine="xlsxwriter") as writer:
        df.to_excel(
            writer,
            sheet_name="Plant Wise VA Alerts",
            index=False,
            startrow=1,
            header=False   #important
        )

        workbook = writer.book
        worksheet = writer.sheets["Plant Wise VA Alerts"]

        header_format = workbook.add_format({
            "bold": True,
            "align": "center",
            "valign": "middle",
            "border": 1
        })

        # Write header ONCE
        for col_num, col_name in enumerate(df.columns):
            worksheet.write(0, col_num, col_name, header_format)
            worksheet.set_column(col_num, col_num, 30)

    return lpg_va_path


async def get_pq_path():
    # Making sure alerts considering only after May 31st in prod
    date = urdhva_base.utilities.get_present_time()
    date_yes = helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                               date_time_format=None)
    month_start = helpers.get_time_stamp_by_delta(date_yes, days=0, with_month_start_day=True,
                                               date_time_format="%Y-%m-%d")
    date_filter = (
        f"(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE >= '{month_start}' "
        f"AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE <= '{date_yes.strftime('%Y-%m-%d')}'"
    )
    query = f"""
        SELECT
            location_name AS "Plant Wise PQ Alerts",
            COUNT(*) FILTER (WHERE severity = 'Critical') AS "Critical(Open)",
            COUNT(*) FILTER (WHERE severity = 'High') AS "High(Open)",
            COUNT(*) FILTER (WHERE severity = 'Medium') AS "Medium(Open)",
            COUNT(*) FILTER (WHERE severity = 'Low') AS "Low(Open)",
            1 AS sort_order
        FROM alerts
        WHERE alert_section = 'LPG'
        AND {date_filter}
        AND interlock_name IN (
            'O-Ring Leak Rejection',
            'Valve Leak Rejection',
            'Check Scale Rejection'
        ) AND alert_status != 'Close'
        GROUP BY location_name

        UNION ALL

        SELECT
            'Total',
            COUNT(*) FILTER (WHERE severity = 'Critical'),
            COUNT(*) FILTER (WHERE severity = 'High'),
            COUNT(*) FILTER (WHERE severity = 'Medium'),
            COUNT(*) FILTER (WHERE severity = 'Low'),
            2 AS sort_order
        FROM alerts
        WHERE alert_section = 'LPG'
        AND {date_filter}
        AND interlock_name IN (
            'O-Ring Leak Rejection',
            'Valve Leak Rejection',
            'Check Scale Rejection'
        ) AND alert_status != 'Close'
        ORDER BY sort_order
    """

    print("query----->\n", query)

    Charts_Connection_Vault_RoutingParams.connection_id = (
        connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    )
    Charts_Connection_Vault_RoutingParams.action = "execute_query"

    function = await charts_connection_vault_routing(
        Charts_Connection_Vault_RoutingParams
    )
    resp = await function(query=query)

    df = pd.DataFrame(resp)

    # Drop helper column
    df = df.drop(columns=["sort_order"])

    global lpg_pq_path
    lpg_pq_path = "/tmp/Plant Wise PQ Alerts.xlsx"

    with pd.ExcelWriter(lpg_pq_path, engine="xlsxwriter") as writer:
        df.to_excel(
            writer,
            sheet_name="Plant Wise PQ Alerts",
            index=False,
            startrow=1,
            header=False   # IMPORTANT
        )

        workbook = writer.book
        worksheet = writer.sheets["Plant Wise PQ Alerts"]

        header_format = workbook.add_format({
            "bold": True,
            "align": "center",
            "valign": "middle",
            "border": 1
        })

        # Write header ONCE
        for col_num, col_name in enumerate(df.columns):
            worksheet.write(0, col_num, col_name, header_format)
            worksheet.set_column(col_num, col_num, 30)

    return lpg_pq_path


async def get_vts_lpg_blocked_counts():
    # Making sure alerts considering only after May 31st in prod
    date = urdhva_base.utilities.get_present_time()
    date_yes = helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                               date_time_format=None)
    month_start = helpers.get_time_stamp_by_delta(date_yes, days=0, with_month_start_day=True,
                                               date_time_format="%Y-%m-%d")
    date_filter = f"""(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE >= '{month_start}'
                        AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE <= '{date_yes.strftime('%Y-%m-%d')}'
                    """
    lpg_query = f"""SELECT
                        CASE violation_type
                            WHEN 'route_deviation_count'      THEN 'Route Deviation'
                            WHEN 'main_supply_removal_count'  THEN 'Power Disconnection'
                            WHEN 'device_tamper_count'        THEN 'Device Tampering'
                            WHEN 'stoppage_violations_count'  THEN 'Stoppage Violation'
                            WHEN 'night_driving_count'        THEN 'Night Driving Violation'
                            WHEN 'continuous_driving_count'   THEN 'Continuous Driving Violation'
                            WHEN 'speed_violation_count'      THEN 'Speed Violation'
                        END AS "Alert Nature",

                        COUNT(*) FILTER (
                            WHERE alert_section='VTS'
                            AND bu='LPG'
                            AND interlock_name NOT IN ('Itdg Admin Blocked','No VTS No Load')
                            AND {date_filter}
                        ) AS "TTs_Blocked_by_Novex",

                        COUNT(*) FILTER (
                            WHERE alert_section='VTS'
                            AND bu='LPG'
                            AND interlock_name NOT IN ('Itdg Admin Blocked','No VTS No Load')
                            AND {date_filter}
                            AND mark_as_false='true'
                            AND vehicle_unblocked_date IS NOT NULL
                        ) AS "TTs_Manually_Unblocked",

                        COUNT(*) FILTER (
                            WHERE alert_section='VTS'
                            AND bu='LPG'
                            AND interlock_name NOT IN ('Itdg Admin Blocked','No VTS No Load')
                            AND {date_filter}
                            AND mark_as_false='false'
                            AND vehicle_unblocked_date IS NOT NULL
                        ) AS "TTs_Unblocked_as_per_ITDG",

                        COUNT(*) FILTER (
                            WHERE alert_section='VTS'
                            AND bu='LPG'
                            AND interlock_name NOT IN ('Itdg Admin Blocked','No VTS No Load')
                            AND {date_filter}
                            AND vehicle_unblocked_date IS NULL
                        ) AS "TTs_currently_under_Block"

                    FROM alerts
                    WHERE alert_section='VTS'
                    AND bu='LPG'
                    AND tt_type= 'bulk'
                    AND interlock_name NOT IN ('Itdg Admin Blocked','No VTS No Load')
                    AND {date_filter}
                    GROUP BY violation_type

                    ORDER BY
                        CASE violation_type
                            WHEN 'route_deviation_count'      THEN 1
                            WHEN 'main_supply_removal_count'  THEN 2
                            WHEN 'device_tamper_count'        THEN 3
                            WHEN 'stoppage_violations_count'  THEN 4
                            WHEN 'night_driving_count'        THEN 5
                            WHEN 'continuous_driving_count'   THEN 6
                            WHEN 'speed_violation_count'      THEN 7
                        END;
                """
    lpg_blocked_packed = f""" 
                            SELECT COUNT(*) as TT_Alerts_generated_by_Novex
                            FROM alerts
                            WHERE alert_section='VTS'
                            AND bu='LPG'
                            AND interlock_name NOT IN ('Itdg Admin Blocked','No VTS No Load')
                            AND tt_type= 'packed'
                            AND {date_filter}
                            """
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    lpg_blocked_data_resp = await function(query=lpg_query)
    lpg_blocked_data_resp = pd.DataFrame(lpg_blocked_data_resp)
    
    lpg_blocked_packed_resp = await function(query=lpg_blocked_packed)
    lpg_blocked_packed_data_resp = pd.DataFrame(lpg_blocked_packed_resp)
    lpg_blocked_packed_data_resp = lpg_blocked_packed_data_resp.iloc[0].to_dict()
    # Extract values from the first (and only) row safely
    if not lpg_blocked_data_resp.empty:
        lpg_blocked_data = {
            "TTs_Blocked_by_Novex_LPG": int(lpg_blocked_data_resp["TTs_Blocked_by_Novex"].sum()),
            "TTs_Manually_Unblocked_LPG": int(lpg_blocked_data_resp["TTs_Manually_Unblocked"].sum()),
            "TTs_currently_under_Block_LPG": int(lpg_blocked_data_resp["TTs_currently_under_Block"].sum()),
            "TTs_Auto_Unblocked_LPG": int(lpg_blocked_data_resp["TTs_Unblocked_as_per_ITDG"].sum())
        }
    else:
        # Default if no data returned
        lpg_blocked_data = {
            "TTs_Blocked_by_Novex_LPG": 0,
            "TTs_Manually_Unblocked_LPG": 0,
            "TTs_currently_under_Block_LPG": 0,
            "TTs_Auto_Unblocked_LPG": 0
        }
    lpg_blocked_data_resp.rename(columns={
        "TTs_Blocked_by_Novex": "TTs Blocked by Novex",
        "TTs_Manually_Unblocked": "TTs Manually Unblocked",
        "TTs_Unblocked_as_per_ITDG": "TTs unblocked as per ITDG",
        "TTs_currently_under_Block": "TTs currently under Block"
    }, inplace=True)

    print('*'*200)
    print(lpg_blocked_data_resp)
    print('*'*200)

    
    lpg_day_wise_trend = await lpg_reporting.get_lpg_day_wise_trends(by_day=True, by_plant=True)
    lpg_day_wise_trend_df = pd.DataFrame(lpg_day_wise_trend)
    # Ensure correct types
    lpg_day_wise_trend_df["timestamp"] = pd.to_datetime(
        lpg_day_wise_trend_df["timestamp"]
    )
    # Pivot: Date vs Plant (SAP ID)
    excel_df = lpg_day_wise_trend_df.pivot_table(
        index="timestamp",
        columns="name",
        values="score",
        aggfunc="mean"   # safe if duplicates exist
    )

    # Sort by date
    excel_df = excel_df.sort_index()

    # FORMAT DATE AS "Dec 1", "Dec 2"
    excel_df.index = excel_df.index.strftime("%b %d")

    excel_df.index.name = "Day Wise Score"

    # Write to Exce
    global lpg_day_wise_trend_exl_path
    output_file = "/tmp/LPG Plant Day Wise Trend.xlsx"
    lpg_day_wise_trend_exl_path = output_file
    excel_df.to_excel(
        output_file,
        sheet_name="Day Wise Trend"
    )

    start_date = "2025-06-01"
    end_date = (datetime.date.today() - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    time_range = f"{start_date},{end_date}"

    monthly_average_plant_score = await lpg_reporting.get_lpg_day_wise_trends(by_day=False, by_month=True, time_range=time_range)
    monthly_average_plant_score_df = pd.DataFrame(monthly_average_plant_score)
    lpg_monthyl_score_path = generate_monthly_lpg_score_chart(monthly_average_plant_score_df)


    plant_wise_score = await lpg_reporting.get_lpg_day_wise_trends(by_day=False, by_plant=True)
    plant_wise_score_df = pd.DataFrame(plant_wise_score)
    plant_wise_score_df_path = generate_plant_wise_score_chart(plant_wise_score_df)

    zone_wise_cylinder_count = await lpg_reporting.get_zone_wise_cylinder_backlog()
    zone_wise_cylinder_count_df = pd.DataFrame(zone_wise_cylinder_count)

    await get_va_path()
    await get_pq_path()

    return {
        "lpg_blocked_data_resp":lpg_blocked_data, 
        "lpg_blocked_packed_resp": lpg_blocked_packed_data_resp,
        "lpg_blocked_data_resp_violation": lpg_blocked_data_resp,
        "zone_wise_cylinder_count_df": zone_wise_cylinder_count_df,
        "lpg_monthyl_score_path" : lpg_monthyl_score_path,
        "plant_wise_score_df_path" : plant_wise_score_df_path,
        "lpg_day_wise_trend_exl_path": lpg_day_wise_trend_exl_path,
        "lpg_va_path": lpg_va_path,
        "lpg_pq_path": lpg_pq_path
    }


def check_socket(host, port):
    try:
        sock = socket.socket()
        sock.settimeout(5)
        result = sock.connect_ex((host, int(port)))
        sock.close()
        return result == 0
    except Exception as e:
        return False


def get_tables(db_type):
    if db_type == "mysql":
        return "gd_pt_data", "production_data"
    return "event_log", "production_log"


def get_counts(conn, event_table, prod_table, plant_name=None, is_central=False):
    cur = conn.cursor()
    now = datetime.datetime.now(zoneinfo.ZoneInfo("Asia/Kolkata")).replace(tzinfo=None)
    start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = (now - datetime.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)

    if is_central:

        cur.execute("""
            SELECT COUNT(*) FROM event_log
            WHERE process_date >= %s AND process_date < %s
            AND LOWER("Plant Name") = LOWER(%s)
        """, (start_date, end_date, plant_name))
        event_count = cur.fetchone()

        cur.execute("""
                    SELECT MAX(process_date) FROM event_log
                    WHERE LOWER("Plant Name") = LOWER(%s)
                """, (plant_name,))
        event_max = cur.fetchone()

        cur.execute("""
            SELECT COUNT(*) FROM production_log
            WHERE process_date >= %s AND process_date < %s
            AND LOWER("Plant Name") = LOWER(%s)
        """, (start_date, end_date, plant_name))
        prod_count = cur.fetchone()

        cur.execute("""
                    SELECT MAX(process_date) FROM production_log
                    WHERE LOWER("Plant Name") = LOWER(%s)
                """, (plant_name,))
        prod_max = cur.fetchone()

        cur.execute("""
            SELECT COUNT(*) FROM (
                SELECT COUNT(*) OVER (PARTITION BY process_date, production_log_id) AS cnt
                FROM production_log
                WHERE process_date >= %s AND process_date < %s
                AND LOWER("Plant Name") = LOWER(%s)
            ) t WHERE cnt > 1
        """, (start_date, end_date, plant_name))
        prod_dup = cur.fetchone()

        cur.execute("""
            SELECT COUNT(*) FROM (
                SELECT COUNT(*) OVER (PARTITION BY process_date, event_log_id) AS cnt
                FROM event_log
                WHERE process_date >= %s AND process_date < %s
                AND LOWER("Plant Name") = LOWER(%s)
            ) t WHERE cnt > 1
        """, (start_date, end_date, plant_name))
        event_dup = cur.fetchone()

    else:
        cur.execute(f"""
            SELECT COUNT(*) FROM {event_table}
            WHERE process_date >= %s AND process_date < %s
        """, (start_date, end_date))
        event_count = cur.fetchone()

        cur.execute(f"""
            SELECT MAX(process_date) FROM {event_table} """)
        event_max = cur.fetchone()

        cur.execute(f"""
            SELECT COUNT(*) FROM {prod_table}
            WHERE process_date >= %s AND process_date < %s
        """, (start_date, end_date))
        prod_count = cur.fetchone()

        cur.execute(f"""
            SELECT MAX(process_date) FROM {prod_table}""")
        prod_max = cur.fetchone()

        cur.execute(f"""
            SELECT COUNT(*) FROM (
                SELECT COUNT(*) OVER (PARTITION BY process_date, production_log_id) AS cnt
                FROM {prod_table}
                WHERE process_date >= %s AND process_date < %s
            ) t WHERE cnt > 1
        """, (start_date, end_date))
        prod_dup = cur.fetchone()

        cur.execute(f"""
            SELECT COUNT(*) FROM (
                SELECT COUNT(*) OVER (PARTITION BY process_date, event_log_id) AS cnt
                FROM {event_table}
                WHERE process_date >= %s AND process_date < %s
            ) t WHERE cnt > 1
        """, (start_date, end_date))
        event_dup = cur.fetchone()

    cur.close()
    return event_count, event_dup, event_max, prod_count, prod_dup, prod_max


def get_missing_production_count(plant_conn, central_conn, prod_table, plant_name=None):
    plant_cur = plant_conn.cursor()
    central_cur = central_conn.cursor()

    now = datetime.datetime.now(zoneinfo.ZoneInfo("Asia/Kolkata")).replace(tzinfo=None)
    start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = (now - datetime.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)

    plant_cur.execute(f"""
        SELECT production_log_id, process_date
        FROM {prod_table}
        WHERE process_date >= %s AND process_date < %s
    """, (start_date, end_date))
    plant_rows = plant_cur.fetchall()
    if not plant_rows:
        return 0
    plant_ids = {(r[0], r[1]) for r in plant_rows}

    central_cur.execute("""
        SELECT production_log_id, process_date
        FROM production_log
        WHERE process_date >= %s AND process_date < %s
        AND LOWER("Plant Name") = LOWER(%s)
    """, (start_date, end_date, plant_name))
    central_rows = central_cur.fetchall()
    central_ids = {(r[0], r[1]) for r in central_rows}
    
    missing = plant_ids - central_ids
    plant_cur.close()
    central_cur.close()

    return len(missing)


def get_missing_event_count(plant_conn, central_conn, event_table, plant_name=None):
    plant_cur = plant_conn.cursor()
    central_cur = central_conn.cursor()

    now = datetime.datetime.now(zoneinfo.ZoneInfo("Asia/Kolkata")).replace(tzinfo=None)
    start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = (now - datetime.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)

    plant_cur.execute(f"""
            SELECT event_log_id, process_date
            FROM {event_table}
            WHERE process_date >= %s AND process_date < %s
        """, (start_date, end_date))
    plant_rows = plant_cur.fetchall()
    if not plant_rows:
        return 0
    plant_ids = {(r[0], r[1]) for r in plant_rows}

    central_cur.execute("""
            SELECT event_log_id, process_date
            FROM event_log
            WHERE process_date >= %s AND process_date < %s
            AND LOWER("Plant Name") = LOWER(%s)
        """, (start_date, end_date, plant_name))
    central_rows = central_cur.fetchall()
    central_ids = {(r[0], r[1]) for r in central_rows}
    
    missing = plant_ids - central_ids
    plant_cur.close()
    central_cur.close()

    return len(missing)


def process_plant(plant):
    plant_name = plant["PlantName"]
    host = plant["host_ip"]
    port = plant["port"]
    db_type = plant.get("db_type", "postgres")

    connection = check_socket(host, port)
    if not connection:
        return [plant_name, host, False, None, None, None, None, None, None, None, None, None, None, None, None, None, None, "Socket Failed"]

    try:
        event_table, prod_table = get_tables(db_type)
        # Plant DB
        plant_conn = psycopg2.connect(
            host=host,
            database=plant["db_database"],
            user=plant["db_user"],
            password=plant["db_password"],
            port=port
        )
        p_event, p_event_dup, p_event_max, p_prod, p_prod_dup, p_prod_max = get_counts(plant_conn, event_table, prod_table)
        # Central DB
        central_conn = psycopg2.connect(**DB_CONFIG)

        c_event, c_event_dup, c_event_max, c_prod, c_prod_dup, c_prod_max = get_counts(central_conn, None, None, plant_name, True)
       
        missing_prod = get_missing_production_count(
            plant_conn=plant_conn,
            central_conn=central_conn,
            prod_table=prod_table,
            plant_name=plant_name
        )

        missing_event = get_missing_event_count(
            plant_conn=plant_conn,
            central_conn=central_conn,
            event_table=event_table,
            plant_name=plant_name
        )

        plant_conn.close()
        central_conn.close()

        return [
            plant_name, host, True, p_event, p_event_dup, p_event_max, p_prod, p_prod_dup, p_prod_max,
            c_event, c_event_dup, c_event_max, c_prod, c_prod_dup, c_prod_max, missing_event, missing_prod, "Connected"
        ]

    except Exception as e:
        error_msg = str(e).lower()
        if "timeout" in error_msg:
            status = "Timeout"
        elif "password authentication failed" in error_msg:
            status = "Auth Failed"
        elif "could not connect" in error_msg or "connection refused" in error_msg:
            status = "Connection Failed"
        elif "ssl negotiation" in error_msg or "invalid response to ssl" in error_msg:
            status = "DB Mismatch"
        elif "server closed the connection unexpectedly" in error_msg:
            status = "Connection Closed"
        else:
            status = "Unknown Error"
        print(f"  Error processing {plant_name}: {e}")
        return [plant_name, host, False, None, None, None, None, None, None, None, None, None, None, None, None, None, None, status]


async def log_count_excel():
    query = """
        SELECT id, sap_id, plant_name, ip_address, port_no, username, password, db_name, db_type, zone, region
        FROM lpg_plants_master
        ORDER BY id ASC
    """
    result = await hpcl_ceg_model.LpgPlantsMaster.get_aggr_data(query=query, limit=0)
    rows = result.get("data", []) if result else []
    for row in rows:
        password = row.get("password")
        if password and str(password).startswith("enc#_"):
            password = urdhva_base.types.Secret(password).get_secret()

        row["erp_id"] = row.get("sap_id")
        row["PlantName"] = row.get("plant_name")
        row["host_ip"] = row.get("ip_address")
        row["port"] = row.get("port_no")
        row["db_user"] = row.get("username")
        row["db_password"] = password
        row["db_database"] = row.get("db_name")
        row["SiteRegion"] = row.get("region")
    plants = pl.from_dicts(rows) if rows else pl.DataFrame()

    results = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [
            executor.submit(process_plant, plant)
            for plant in plants.iter_rows(named=True)
        ]
        for future in as_completed(futures):
            result = future.result()
            results.append(result)

    output_path = "/tmp/lpg_logs_count.xlsx"
    workbook = xlsxwriter.Workbook(output_path)
    worksheet = workbook.add_worksheet("Count")

    # ===== Formats =====
    header_format = workbook.add_format({
        "bold": True,
        "align": "center",
        "valign": "middle",
        "border": 1
    })

    cell_format = workbook.add_format({
        "border": 1,
        "align": "center"
    })

    fail_format = workbook.add_format({
        "border": 1,
        "align": "center",
        "font_color": "#9d0101",
        "bold": True
    })

    dup_format = workbook.add_format({
        "border": 1,
        "align": "center",
        "bg_color": "#FFF3CD",
        "font_color": "#856404"
    })

    zero_log_format = workbook.add_format({
        "border": 1,
        "align": "center",
        "bg_color": "#F8D7DA",
        "font_color": "#721C24"
    })

    # ===== Headers (A1 style) =====
    worksheet.merge_range("A1:A2", "Location", header_format)
    worksheet.merge_range("B1:B2", "IP", header_format)
    worksheet.merge_range("C1:C2", "Connection", header_format)

    worksheet.merge_range("D1:I1", "Plant DB", header_format)
    worksheet.write("D2", "Event_log", header_format)
    worksheet.write("E2", "Event_duplicates", header_format)
    worksheet.write("F2", "Event_max_date", header_format)
    worksheet.write("G2", "Production_log", header_format)
    worksheet.write("H2", "Production_duplicates", header_format)
    worksheet.write("I2", "Production_max_date", header_format)

    worksheet.merge_range("J1:O1", "Central DB", header_format)
    worksheet.write("J2", "Event_log", header_format)
    worksheet.write("K2", "Event_duplicates", header_format)
    worksheet.write("L2", "Event_max_date", header_format)
    worksheet.write("M2", "Production_log", header_format)
    worksheet.write("N2", "Production_duplicates", header_format)
    worksheet.write("O2", "Production_max_date", header_format)

    worksheet.merge_range("P1:Q1", "Missed Records", header_format)
    worksheet.write("P2", "Event_log", header_format)
    worksheet.write("Q2", "Production_log", header_format)
    worksheet.merge_range("R1:R2", "Status", header_format)

    # ===== Write Data =====
    for row_idx, row in enumerate(results, start=2):

        log_cols = [3, 6, 9, 12]
        duplicate_cols = [4, 7, 10, 13]
        status = row[-1] if len(row) == 18 else None
        connection = row[2]
        missing_prod_col = 15
        missing_event_col = 16
        event_max_date = [5, 11]
        prod_max_date = [8, 14]
        now = datetime.datetime.now(zoneinfo.ZoneInfo("Asia/Kolkata")).replace(tzinfo=None)
        today = now.date()
        t = now - datetime.timedelta(hours=2)

        for col_idx, value in enumerate(row):
            if isinstance(value, tuple):
                value = value[0] if value else None

            raw_value = value

            if isinstance(value, datetime.datetime):
                value = value.strftime("%Y-%m-%d %H:%M:%S")

            fmt = cell_format

            if col_idx == 2:
                fmt = cell_format if connection else fail_format
            elif col_idx == 17:
                fmt = cell_format if status == "Connected" else fail_format
            elif col_idx in log_cols and value in (0, "0"):
                fmt = zero_log_format
            elif col_idx in duplicate_cols and isinstance(value, (int, float)) and value > 0:
                fmt = dup_format
            elif col_idx == missing_prod_col and isinstance(value, (int, float)) and value > 0:
                fmt = dup_format   
            elif col_idx == missing_event_col and isinstance(value, (int, float)) and value > 0:
                fmt = dup_format 
            elif col_idx in event_max_date or col_idx in prod_max_date:
                if isinstance(raw_value, datetime.datetime):
                    if raw_value.date() < today or raw_value < t:
                        fmt = fail_format

            worksheet.write(row_idx, col_idx, value, fmt)

    # ===== Column Width =====
    worksheet.set_column("A:A", 18)
    worksheet.set_column("B:B", 20)
    worksheet.set_column("C:C", 14)
    worksheet.set_column("D:O", 18)
    worksheet.set_column("P:Q", 20)
    worksheet.set_column("R:R", 22)

    workbook.close()

    return {
        "lpg_log_count": output_path
    }


async def lpg_production_report():
    current_date = datetime.datetime.now().strftime("%Y-%m-%d")
    yesterday_date = (datetime.datetime.now() - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    query = f"""SELECT * FROM public.lpg_plant_operations where process_date >= '{yesterday_date}' and process_date < '{current_date}' """

    plant_details_query = """SELECT DISTINCT sap_id, plant_name, zone FROM lpg_plants_master"""

    stoppages_query = """SELECT
                            a.erp_id,
                            c.plant_id,
                            c.carousal_id,
                            c.rated_productivity,
                            c.heads,
                            ROUND(
                                EXTRACT(EPOCH FROM (
                                    (c.stop_time::time - c.start_time::time)
                                    - COALESCE(SUM(b.stop_time::time - b.start_time::time), INTERVAL '0')
                                )) / 3600,
                                2
                            ) AS total_hours
                        FROM plants a
                        JOIN carousals c
                            ON c.plant_id = a.id
                        LEFT JOIN breaks b
                            ON b.plant_id = c.plant_id
                            AND b.carousal_id = c.carousal_id

                        GROUP BY
                            a.erp_id,
                            c.plant_id,
                            c.carousal_id,
                            c.start_time,
                            c.stop_time,
                            c.rated_productivity,
                            c.heads;
                    """

    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    resp = await function(query=query)

    plant_details = await function(query=plant_details_query)
    plant_details_df = pl.DataFrame(plant_details)

    stoppages = await function(query=stoppages_query)
    stoppages_df = pl.DataFrame(stoppages)

    from decimal import Decimal

    def clean_decimals(data):
        cleaned = []
        for row in data:
            new_row = {}
            for k, v in row.items():
                if isinstance(v, Decimal):
                    new_row[k] = round(float(v), 2)
                else:
                    new_row[k] = v
            cleaned.append(new_row)
        return cleaned

    clean_resp = clean_decimals(resp)

    drop_cols = [
        "created_at",
        "updated_at",
        "lst_cyl_production",
        "fst_cyl_production"
    ]
    for row in clean_resp:
        for col in drop_cols:
            row.pop(col, None)

    
    plant_details_df = plant_details_df.with_columns(pl.col("sap_id").cast(pl.Utf8))

    carousal_master_df = (
        stoppages_df
        .select(["erp_id", "carousal_id", "heads", "rated_productivity"])
        .with_columns([
            pl.col("erp_id").cast(pl.Utf8),
            pl.col("carousal_id").cast(pl.Int64),
        ])
    )

    base_df = (
        carousal_master_df
        .join(plant_details_df, left_on="erp_id", right_on="sap_id", how="left")
        .rename({
            "erp_id": "sap_id",
            "carousal_id": "carousel",
            "heads": "filling_head",
            "plant_name": "location_name",
        })
    )

    production_cols = [
        "sap_id", "carousel",
        "production_14_2kg", "production_19kg",
        "normal_total_production", "normal_net_hours", "normal_gap_hrs", "normal_productivity",
        "break_total_production", "break_net_hours", "break_productivity",
        "overtime_total_production", "overtime_net_hours", "overtime_productivity",
        "cs_rejection", "gd_rejection", "pt_rejection",
    ]

    if not clean_resp:
        ops_df = pl.DataFrame(
            {c: [] for c in production_cols},
            schema={c: (pl.Utf8 if c == "sap_id" else pl.Int64 if c == "carousel" else pl.Float64)
                    for c in production_cols},
        )
    else:
        ops_df = pl.DataFrame(clean_resp).with_columns([
            pl.col("sap_id").cast(pl.Utf8),
            pl.col("carousel").cast(pl.Int64),
        ]).select(production_cols)

    df = base_df.join(ops_df, on=["sap_id", "carousel"], how="left")

    # Flag rows with no operations record at all for this date, so we render
    # "NA" later instead of a misleading 0.
    df = df.with_columns(
        pl.col("normal_total_production").is_null().alias("no_ops_data")
    )

    rename_cols = {
        "location_name": "Plant Name", "sap_id": "SAP Code", "zone": "Zone", "carousel": "Carousel",
        "filling_head": "Heads", "production_14_2kg": "14.2kg Cylinders", "production_19kg": "19kg Cylinders",
        "normal_total_production": "Normal Total Production", "normal_net_hours": "Normal Net Hours",
        "normal_gap_hrs": "Stoppage Hours", "normal_productivity": "Normal Productivity",
        "break_total_production": "Break Total Production", "break_net_hours": "Break Net Hours",
        "break_productivity": "Break Productivity", "overtime_total_production": "Overtime Total Production",
        "overtime_net_hours": "Overtime Net Hours", "overtime_productivity": "Overtime Productivity",
        "cs_rejection": "Check Scale Rejection", "gd_rejection": "ELD", "pt_rejection": "ORT",
        "rated_productivity": "Comparision Normal Productivity"
    }

    df = (
        df.select(list(rename_cols.keys()) + ["no_ops_data"])
        .with_columns([
            pl.sum_horizontal([
                pl.col("production_14_2kg").fill_null(0),
                pl.col("production_19kg").fill_null(0)
            ]).alias("Total Cylinders")
        ])
        .rename(rename_cols)
    )

    fill_cols = [
        "Normal Productivity", "Break Productivity", "Overtime Productivity",
        "Normal Total Production", "Break Total Production", "Overtime Total Production",
    ]
    df = df.with_columns([
        pl.when(pl.col("no_ops_data"))
          .then(None)
          .otherwise(pl.col(c).fill_null(0))
          .alias(c)
        for c in fill_cols
    ])
    df = df.with_columns([
        pl.col("Normal Productivity").round(0),
        pl.col("Break Productivity").round(0),
        pl.col("Overtime Productivity").round(0),
        pl.col("Normal Total Production").round(0),
        pl.col("Break Total Production").round(0),
        pl.col("Overtime Total Production").round(0),
    ])
    # Total Cylinders should also read NA, not 0, when there's no ops record at all
    df = df.with_columns(
        pl.when(pl.col("no_ops_data")).then(None).otherwise(pl.col("Total Cylinders")).alias("Total Cylinders")
    )

    df = df.sort(["Plant Name", "SAP Code", "Zone", "Carousel"])
    final_order = [
        "Plant Name", "SAP Code", "Zone", "Carousel", "Heads",
        "14.2kg Cylinders", "19kg Cylinders", "Total Cylinders",
        "Normal Total Production", "Normal Net Hours", "Stoppage Hours", "Normal Productivity",
        "Break Total Production", "Break Net Hours", "Break Productivity",
        "Overtime Total Production", "Overtime Net Hours", "Overtime Productivity",
        "Check Scale Rejection", "ELD", "ORT", "Comparision Normal Productivity"
    ]
    df = df.select(final_order + ["no_ops_data"])

    print("df ------>\n", df.to_dicts())
    data = df.to_dicts()
    exclude_cols = {
        "Comparision Normal Productivity",
        "Normal Net Hours",
        "Total Stoppage Hours",
        "no_ops_data",
    }
    headers = [col for col in df.columns if col not in exclude_cols]

    output_path = "/tmp/lpg_production_report.xlsx"

    workbook = xlsxwriter.Workbook(output_path)
    worksheet = workbook.add_worksheet("Report")

    # ---------------- Formats ----------------
    cell_format = workbook.add_format({
        "align": "center",
        "valign": "vcenter",
        "border": 1,
        "text_wrap": True
    })

    header_format = workbook.add_format({
        "bold": True,
        "align": "center",
        "valign": "vcenter",
        "border": 1,
        "text_wrap": True
    })

    red_format = workbook.add_format({
        "bg_color": "#FFC7CE",  
        "font_color": "#9C0006",
        "align": "center",
        "valign": "vcenter",
        "border": 1
    })

    na_format = workbook.add_format({
        "bold": True,
        "align": "center",
        "valign": "vcenter",
        "border": 1,
        "italic": True,
        "font_color":  "#000000",
    })


    # ---------------- Headers ----------------
    worksheet.merge_range("A1:A2", "Plant Name", header_format)
    worksheet.merge_range("B1:B2", "SAP Code", header_format)
    worksheet.merge_range("C1:C2", "Zone", header_format)

    worksheet.merge_range("D1:D2", "Carousel", header_format)
    worksheet.merge_range("E1:E2", "Heads", header_format)

    worksheet.merge_range("F1:H1", "Bottling Summary", header_format)
    worksheet.write("F2", "14.2kg Cylinders", header_format)
    worksheet.write("G2", "19kg Cylinders", header_format)
    worksheet.write("H2", "Total", header_format)

    worksheet.merge_range("I1:K1", "Productivity - Normal Hours", header_format)
    worksheet.write("I2", "Production", header_format)
    worksheet.write("J2", "Stoppages (Hrs)", header_format)
    worksheet.write("K2", "Productivity (cyls/hr)", header_format)

    worksheet.merge_range("L1:N1", "Productivity - Break Hours", header_format)
    worksheet.write("L2", "Production", header_format)
    worksheet.write("M2", "Net Hours", header_format)
    worksheet.write("N2", "Productivity (cyls/hr)", header_format)

    worksheet.merge_range("O1:Q1", "Productivity - Overtime Hours", header_format)
    worksheet.write("O2", "Production", header_format)
    worksheet.write("P2", "Net Hours", header_format)
    worksheet.write("Q2", "Productivity (cyls/hr)", header_format)

    worksheet.merge_range("R1:T1", "QC Rejections (%)", header_format)
    worksheet.write("R2", "Check Scale", header_format)
    worksheet.write("S2", "ELD", header_format)
    worksheet.write("T2", "ORT", header_format)

    # ---------------- Write normal data first ----------------
    row_num = 2

    for row in data:
        for col_idx, col_name in enumerate(headers[3:], start=3):
            value = row[col_name]

            # Missing operations record for this plant/carousel on this date -> NA
            if value is None:
                worksheet.write(row_num, col_idx, "N/A", na_format)
                continue

            if col_name == "Normal Productivity":
                normal = row["Normal Productivity"]
                comp = row["Comparision Normal Productivity"]
                if comp is not None and normal is not None and comp > normal:
                    worksheet.write(row_num, col_idx, value, red_format)
                else:
                    worksheet.write(row_num, col_idx, value, cell_format)
            elif col_name == "Stoppage Hours":
                worksheet.write(row_num, col_idx, value, red_format)
            elif col_name == "Check Scale Rejection":
                if value > 8:
                    worksheet.write(row_num, col_idx, value, red_format)
                else:
                    worksheet.write(row_num, col_idx, value, cell_format)
            elif col_name == "ELD":
                if value > 6 or value < 1:
                    worksheet.write(row_num, col_idx, value, red_format)
                else:
                    worksheet.write(row_num, col_idx, value, cell_format)
            elif col_name == "ORT":
                if value < 6 or value < 1:
                    worksheet.write(row_num, col_idx, value, red_format)
                else:
                    worksheet.write(row_num, col_idx, value, cell_format)
            else:
                worksheet.write(row_num, col_idx, value, cell_format)

        row_num += 1

    # ---------------- Merge repeated values ----------------
    start_row = 2

    for i in range(len(data)):
        is_last = i == len(data) - 1

        current = (
            data[i]["Plant Name"],
            data[i]["SAP Code"],
            data[i]["Zone"]
        )

        next_value = None
        if not is_last:
            next_value = (
                data[i + 1]["Plant Name"],
                data[i + 1]["SAP Code"],
                data[i + 1]["Zone"]
            )

        if is_last or current != next_value:
            end_row = i + 2

            plant_name = data[i]["Plant Name"]
            sap_code = data[i]["SAP Code"]
            zone = data[i]["Zone"]

            if start_row < end_row:
                worksheet.merge_range(start_row, 0, end_row, 0, plant_name, cell_format)
                worksheet.merge_range(start_row, 1, end_row, 1, sap_code, cell_format)
                worksheet.merge_range(start_row, 2, end_row, 2, zone, cell_format)
            else:
                worksheet.write(start_row, 0, plant_name, cell_format)
                worksheet.write(start_row, 1, sap_code, cell_format)
                worksheet.write(start_row, 2, zone, cell_format)

            start_row = end_row + 1

    # ---------------- Column Widths ----------------
    worksheet.set_column(0, 0, 30)
    worksheet.set_column(1, 2, 15)
    worksheet.set_column(3, len(headers)-1, 15)

    worksheet.set_row(0, 30)
    worksheet.set_row(1, 30)
    workbook.close()

    print(f"Excel saved at: {output_path}")

    # html rowspan for merging cells with same Plant Name, SAP Code, Zone
    final_data = []
    i = 0
    while i < len(data):
        current = (
            data[i]["Plant Name"],
            data[i]["SAP Code"],
            data[i]["Zone"]
        )

        group = [data[i]]
        j = i + 1
        while j < len(data):
            nxt = (
                data[j]["Plant Name"],
                data[j]["SAP Code"],
                data[j]["Zone"]
            )
            if nxt == current:
                group.append(data[j])
                j += 1
            else:
                break

        rowspan = len(group)
        for idx, row in enumerate(group):
            new_row = row.copy()
            if idx == 0:
                new_row["rowspan"] = rowspan
                new_row["show_merge"] = True
            else:
                new_row["show_merge"] = False
            final_data.append(new_row)

        i = j
    data = final_data

    return {
        "data": data,
        "lpg_production_report": output_path
    }