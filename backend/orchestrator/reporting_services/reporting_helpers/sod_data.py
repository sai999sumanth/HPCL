import urdhva_base
from decimal import Decimal
import decimal
import traceback
import hpcl_ceg_model
import datetime
import pandas as pd
from datetime import date, timedelta
import polars as pl
import pytz
import numpy as np
import matplotlib.pyplot as plt
import dateutil.parser as dateutil_parser
import urdhva_base.utilities
import utilities.helpers as helpers
import utilities.connection_mapping as connection_mapping
from charts_actions import charts_connection_vault_routing
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams


tas_va_path = ""
tas_emlock_path = ""
tas_tas_path = ""
tas_day_wise_trend_exl_path = ""

async def get_tas_alerts():
    # today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    ist = pytz.timezone('Asia/Kolkata')
    today_ist = datetime.datetime.now(ist).strftime("%Y-%m-%d")
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    query = f""" SELECT count(interlock_name) as total_count, severity FROM alerts where bu='TAS' 
                and (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE >='{today_ist}' and alert_status='Open' GROUP BY severity; """
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


async def get_vts_sod_blocked_counts():
    # Making sure alerts considering only after May 31st in prod
    date = urdhva_base.utilities.get_present_time()
    date_yes = helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                               date_time_format=None)
    month_start = helpers.get_time_stamp_by_delta(date_yes, days=0, with_month_start_day=True,
                                               date_time_format="%Y-%m-%d")
    date_filter = f"""(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE >= '{month_start}' and
                    (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE <= '{date_yes.strftime('%Y-%m-%d')}'
                """
    sod_query = f"""SELECT
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
                            AND bu='TAS'
                            AND interlock_name NOT IN ('Itdg Admin Blocked','No VTS No Load')
                            AND {date_filter}
                        ) AS "TTs_Blocked_by_Novex",

                        COUNT(*) FILTER (
                            WHERE alert_section='VTS'
                            AND bu='TAS'
                            AND interlock_name NOT IN ('Itdg Admin Blocked','No VTS No Load')
                            AND {date_filter}
                            AND mark_as_false='true'
                            AND vehicle_unblocked_date IS NOT NULL
                        ) AS "TTs_Manually_Unblocked",

                        COUNT(*) FILTER (
                            WHERE alert_section='VTS'
                            AND bu='TAS'
                            AND interlock_name NOT IN ('Itdg Admin Blocked','No VTS No Load')
                            AND {date_filter}
                            AND mark_as_false='false'
                            AND vehicle_unblocked_date IS NOT NULL
                        ) AS "TTs_Unblocked_as_per_ITDG",

                        COUNT(*) FILTER (
                            WHERE alert_section='VTS'
                            AND bu='TAS'
                            AND interlock_name NOT IN ('Itdg Admin Blocked','No VTS No Load')
                            AND {date_filter}
                            AND vehicle_unblocked_date IS NULL
                        ) AS "TTs_currently_under_Block"

                    FROM alerts
                    WHERE alert_section='VTS'
                    AND bu='TAS'
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
    
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    sod_blocked_data_resp = await function(query=sod_query)
    sod_blocked_data_resp = pd.DataFrame(sod_blocked_data_resp)
    
    # sod_blocked_data_resp = sod_blocked_data_resp.head(-1)
    # Extract values from the first (and only) row safely

    if not sod_blocked_data_resp.empty:
        sod_blocked_data = {
            "TTs_Blocked_by_Novex_SOD": int(sod_blocked_data_resp["TTs_Blocked_by_Novex"].sum()),
            "TTs_Manually_Unblocked_SOD": int(sod_blocked_data_resp["TTs_Manually_Unblocked"].sum()),
            "TTs_currently_under_Block_SOD": int(sod_blocked_data_resp["TTs_currently_under_Block"].sum()),
            "TTs_Auto_Unblocked_SOD": int(sod_blocked_data_resp["TTs_Unblocked_as_per_ITDG"].sum())
        }
    else:
        # Default if no data returned
        sod_blocked_data = {
            "TTs_Blocked_by_Novex_SOD": 0,
            "TTs_Manually_Unblocked_SOD": 0,
            "TTs_currently_under_Block_SOD": 0,
            "TTs_Auto_Unblocked_SOD": 0
        }
    sod_blocked_data_resp.rename(columns={
        "TTs_Blocked_by_Novex": "TTs Blocked by Novex",
        "TTs_Manually_Unblocked": "TTs Manually Unblocked",
        "TTs_Unblocked_as_per_ITDG": "TTs unblocked as per ITDG",
        "TTs_currently_under_Block": "TTs currently under Block"
    }, inplace=True)

    print('*'*200)
    print(sod_blocked_data_resp)
    print('*'*200)

    
    sod_day_wise_trend = await get_sod_day_wise_trends(by_day=True, by_plant=True)
    sod_day_wise_trend_df = pd.DataFrame(sod_day_wise_trend)
    # Ensure correct types
    sod_day_wise_trend_df["timestamp"] = pd.to_datetime(
        sod_day_wise_trend_df["timestamp"]
    )
    # Pivot: Date vs Plant (SAP ID)
    excel_df = sod_day_wise_trend_df.pivot_table(
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

    # Write to Excel
    global sod_day_wise_trend_exl_path
    output_file = "/tmp/SOD Plant Scores Day Wise Trend.xlsx"
    sod_day_wise_trend_exl_path = output_file
    excel_df.to_excel(
        output_file,
        sheet_name="Day Wise Trend"
    )

    start_date = "2025-12-01"
    end_date = (datetime.date.today() - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    time_range = f"{start_date},{end_date}"

    monthly_average_plant_score = await get_sod_day_wise_trends(by_day=False, by_month=True, time_range=time_range)
    monthly_average_plant_score_df = pd.DataFrame(monthly_average_plant_score)
    sod_monthly_score_path = generate_monthly_sod_score_chart(monthly_average_plant_score_df)


    plant_wise_score = await get_sod_day_wise_trends(by_day=False, by_plant=True)
    plant_wise_score_df = pd.DataFrame(plant_wise_score)
    sod_plant_wise_score_df_path = generate_plant_wise_score_chart(plant_wise_score_df)

    return {
        "sod_blocked_data_resp": sod_blocked_data, 
        "sod_blocked_data_resp_violation": sod_blocked_data_resp,
        "sod_monthly_score_path": sod_monthly_score_path, 
        "sod_plant_wise_score_df_path": sod_plant_wise_score_df_path
    }


def convert_decimal(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimal(v) for v in obj]
    return obj


def generate_monthly_sod_score_chart(df, output_path="/tmp/sod_monthly_score.png"):
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
    output_path="/tmp/sod_plant_wise_average_score.png"
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




async def get_sod_day_wise_trends(by_plant=False, by_day=True, by_month=False, time_range=None):
    """
    Generates SOD Day wise Trends based on user selection
    :param by_plant:
    :param by_day:
    :param time_range:
    :return:
    """
    start_time = ""
    end_time = ""
    if time_range is None:
        end_time = helpers.get_time_stamp_by_delta(days=1, with_month_start_day=False)
        start_time = helpers.get_time_stamp_by_delta(dateutil_parser.parse(end_time), with_month_start_day=True)
    else:
        start_time = time_range.split(",")[0]
        end_time = time_range.split(",")[1]
    required_keys = []
    group_by_keys = []
    if by_plant:
        required_keys.append('name')
        group_by_keys.append('name')
    if by_month:
        required_keys.append("DATE_TRUNC('month', timestamp)::DATE As month")
        group_by_keys.append('month')
    elif by_day:
        required_keys.append('timestamp::DATE')
        group_by_keys.append('timestamp::DATE')
    group_by = "" if not required_keys else f""" Group by {','.join(group_by_keys)}"""
    required_keys.append('ROUND(AVG(score), 2) as score')
    order_by = ""
    if by_month:
        order_by = "order by month desc"
    elif by_day:
        order_by = "order by timestamp desc"
    elif by_plant:
        order_by = "order by ROUND(AVG(score), 2) desc"
    query = f"""SELECT {','.join(required_keys)} from performance_score_history where timestamp >= '{start_time}'
            AND bu='TAS' AND timestamp <= '{end_time}' {group_by} {order_by}"""
    print(query)
    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
    resp = resp['data']
    for rec in resp:
        for key in rec:
            if isinstance(rec[key], datetime.datetime) or isinstance(rec[key], datetime.date):
                rec[key] = rec[key].strftime("%Y-%m-%d")
            elif isinstance(rec[key], decimal.Decimal):
                rec[key] = float(rec[key])
    return resp



async def sod_percentage():
    try:
        # Making sure alerts considering only after May 31st in prod
        date = urdhva_base.utilities.get_present_time()
        date_yes = helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False, date_time_format=None)
        month_start = helpers.get_time_stamp_by_delta(date_yes, days=0, with_month_start_day=True, date_time_format="%Y-%m-%d")
        date_filter = f"timestamp::DATE >= '{month_start}' AND timestamp::DATE <= '{date_yes.strftime('%Y-%m-%d')}'"""
        query = f"""bu='TAS' AND {date_filter}"""

        print("*" * 200)
        print(query)
        print("*" * 200)

        data = await hpcl_ceg_model.PerformanceScoreHistory.get_all(
            urdhva_base.queryparams.QueryParams(q=query, limit=0),
            resp_type="plain"
        )

        if not data or not data.get("data"):
            print("No data found")
            return None

        # Clean Decimal values
        clean_data = convert_decimal(data["data"])

        # Create initial DataFrame
        performance_data = pl.DataFrame(clean_data, strict=False)

        updated_rows = []

        for row in performance_data.iter_rows(named=True):
            categories = row.get("category", [])

            # Copy original row
            new_row = dict(row)

            for category in categories:
                name = category.get("name")
                score = category.get("score", 0)
                weightage = category.get("weightage", 0)

                if weightage > 0:
                    percentage = (score / weightage) * 100
                    #percentage = round((score / weightage) * 100, 2)
                else:
                    percentage = 0

                # Add category percentage as new column
                new_row[name] = percentage

            updated_rows.append(new_row)

        # Final DataFrame with calculated columns
        final_df = pl.DataFrame(updated_rows, strict=False)

        print("*" * 200)
        print("FINAL DATAFRAME")
        print("*" * 200)
        print(final_df)

        sap_id_list = [
            "1919", "1128", "1216", "1334", "1155",
            "1221", "1259", "1412", "1146", "1509",
            "1424", "1892", "1588", "1856", "1845"
        ]

        tas_score_location_wise = (
            final_df
            # filter only required SAP IDs
            .filter(pl.col("sap_id").is_in(sap_id_list))

            .group_by(["sap_id", "name"])
            .agg(
                pl.mean("TAS").alias("avg_tas_score")
            )
            .with_columns(
                pl.col("avg_tas_score").round(2)
            )
            # highest score first
            .sort("avg_tas_score", descending=True)
            # top 15
            .head(15)
            # create numeric rank first
            .with_row_count("rank_num", offset=1)
            # convert to "Rank 1", "Rank 2", ...
            .with_columns(
                pl.concat_str([
                    pl.lit("Rank "),
                    pl.col("rank_num").cast(pl.Utf8)
                ]).alias("Rank")
            )
            # final column order
            .select(["Rank", "sap_id", "name", "avg_tas_score"])
        )

        tas_score_location_wise = (
            tas_score_location_wise
            .drop("sap_id")
            .rename({
                "name": "Location",
                "avg_tas_score": "TAS Score"
            })
        )

        print('*'*200)
        print('tas_score_location_wise',tas_score_location_wise)
        print('*'*200)

        avg_scores_df = (
            final_df
            .group_by(["sap_id", "name"])
            .agg([
                pl.mean("VA").alias("avg_va_score"),
                pl.mean("VTS").alias("avg_vts_score"),
                pl.mean("TAS").alias("avg_tas_score"),
                pl.mean("EMLOCK").alias("avg_emlock_score"),
                pl.mean("Dryouts and Carry forward").alias("avg_dryouts_score"),
                pl.mean("score").alias("avg_overall_score"),
            ]).with_columns(pl.col(pl.Float64).round(2))
        )
        print("avg_scores_df---->", avg_scores_df)
        previous_date = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).date()

        prev_day_score_df = (
            final_df
            .with_columns(
                pl.col("timestamp").dt.date().alias("ts_date")
            )
            .filter(pl.col("ts_date") == pl.lit(previous_date))
            .group_by(["sap_id", "zone"])
            .agg(
                pl.mean("score").round(2).alias("previous_day_score")
            )
        )

        avg_scores_df = (
            avg_scores_df
            .join(prev_day_score_df, on="sap_id", how="left")
            .with_columns(
                pl.col("previous_day_score").fill_null(0)
            )
        )

        avg_scores_df = avg_scores_df.rename({
            "name": "Plant Name", "zone": "Zone", "avg_va_score": "VA%", "avg_vts_score": "VTS%", "avg_tas_score": "TAS%",
            "avg_emlock_score": "EMLOCKS%", "avg_dryouts_score": "DRYOUTS & CARRY FORWARD%",
            "avg_overall_score": "Average Performance Index from Month start", "previous_day_score": "Previous days Performance Index"
        }).drop(["sap_id", "avg_dryouts_score"], strict=False).with_columns(pl.arange(1, pl.len()+ 1).alias("SI No"))

        avg_scores_df = avg_scores_df.select([
            "SI No", "Plant Name", "Zone", "VA%", "VTS%", "TAS%", "EMLOCKS%", "DRYOUTS & CARRY FORWARD%",
            "Average Performance Index from Month start", "Previous days Performance Index"
        ])
        
        avg_scores_df = avg_scores_df.drop("DRYOUTS & CARRY FORWARD%")

        top_3_df = (
            avg_scores_df
            .sort("Average Performance Index from Month start", descending=True)
            .head(3).with_columns(pl.arange(1, pl.len() + 1).alias("SI No"))
        )

        bottom_3_df = (
            avg_scores_df
            .sort("Average Performance Index from Month start")
            .head(3).with_columns(pl.arange(1, pl.len() + 1).alias("SI No"))
        )

        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)

        tas_avg_score_query = f"""SELECT
                                    ROUND(AVG(score)::numeric, 2) AS tas_average_score
                                    FROM public.performance_score_history
                                    WHERE bu = 'TAS'
                                    AND timestamp::DATE = CURRENT_DATE - INTERVAL '1 day'"""
        tas_avg_score_resp = await function(query=tas_avg_score_query)
        tas_avg_score_resp = pd.DataFrame(tas_avg_score_resp)
        if not tas_avg_score_resp.empty:
            tas_avg_score_value = tas_avg_score_resp['tas_average_score'].iloc[0]
        else:
            tas_avg_score_value = None  # or 0 or 'N/A'

        print('*'*200)
        print(prev_day_score_df.sort("sap_id"))
        print('top_3_df',top_3_df)
        print('bottom_3_df',bottom_3_df)
        print('*'*200)

        sod_day_wise_trend = await get_sod_day_wise_trends(by_day=True, by_plant=True)
        sod_day_wise_trend_df = pd.DataFrame(sod_day_wise_trend)
        # Ensure correct types
        sod_day_wise_trend_df["timestamp"] = pd.to_datetime(
            sod_day_wise_trend_df["timestamp"]
        )
        # Pivot: Date vs Plant (SAP ID)
        excel_df = sod_day_wise_trend_df.pivot_table(
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
        global tas_day_wise_trend_exl_path
        output_file = "/tmp/SOD Plant Scores Day Wise Trend.xlsx"
        tas_day_wise_trend_exl_path = output_file
        excel_df.to_excel(
            output_file,
            sheet_name="Day Wise Trend"
        )
        return {"sod_top_data": top_3_df, "sod_bottom_data": bottom_3_df,
                "tas_avg_score_resp": tas_avg_score_value,
                "tas_day_wise_trend_exl_path": tas_day_wise_trend_exl_path,
                "tas_score_location_wise": tas_score_location_wise} 

    except Exception as exc:
        print("\nERROR OCCURRED:")
        traceback.print_exception(
            type(exc), exc, exc.__traceback,
            limit=None, chain=True
        )
        return None

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
        AND bu = 'TAS'
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
        AND bu = 'TAS'
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

    global tas_va_path
    tas_va_path = "/tmp/SOD Plant Wise VA Alerts.xlsx"

    with pd.ExcelWriter(tas_va_path, engine="xlsxwriter") as writer:
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

    return {"tas_va_path":tas_va_path}

async def get_emlock_path():
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
            location_name AS "Plant Wise EMLock Alerts",
            COUNT(*) FILTER (WHERE severity = 'Critical') AS "Critical(Open)",
            COUNT(*) FILTER (WHERE severity = 'High') AS "High(Open)",
            COUNT(*) FILTER (WHERE severity = 'Medium') AS "Medium(Open)",
            COUNT(*) FILTER (WHERE severity = 'Low') AS "Low(Open)",
            1 AS sort_order
        FROM alerts
        WHERE alert_status = 'Open'
        AND alert_section = 'EMLock'
        AND {date_filter}
        AND bu = 'TAS'
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
        AND alert_section = 'EMLock'
        AND bu = 'TAS'
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

    global tas_emlock_path
    tas_emlock_path = "/tmp/SOD Plant Wise EMLock Alerts.xlsx"

    with pd.ExcelWriter(tas_emlock_path, engine="xlsxwriter") as writer:
        df.to_excel(
            writer,
            sheet_name="Plant Wise EMLock Alerts",
            index=False,
            startrow=1,
            header=False   #important
        )

        workbook = writer.book
        worksheet = writer.sheets["Plant Wise EMLock Alerts"]

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

    return {"tas_emlock_path":tas_emlock_path}

async def get_tas_path():
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
            location_name AS "Plant Wise SOD Alerts",
            COUNT(*) FILTER (WHERE severity = 'Critical') AS "Critical(Open)",
            COUNT(*) FILTER (WHERE severity = 'High') AS "High(Open)",
            COUNT(*) FILTER (WHERE severity = 'Medium') AS "Medium(Open)",
            COUNT(*) FILTER (WHERE severity = 'Low') AS "Low(Open)",
            1 AS sort_order
        FROM alerts
        WHERE alert_status = 'Open'
        AND alert_section = 'TAS'
        AND {date_filter}
        AND bu = 'TAS'
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
        AND alert_section = 'TAS'
        AND bu = 'TAS'
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

    global tas_tas_path
    tas_tas_path = "/tmp/Plant Wise TAS Alerts.xlsx"

    with pd.ExcelWriter(tas_tas_path, engine="xlsxwriter") as writer:
        df.to_excel(
            writer,
            sheet_name="Plant Wise TAS Alerts",
            index=False,
            startrow=1,
            header=False   #important
        )

        workbook = writer.book
        worksheet = writer.sheets["Plant Wise TAS Alerts"]

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

    return {"tas_tas_path":tas_tas_path}

async def get_fault_and_maintenance():
    date = urdhva_base.utilities.get_present_time()

    date_yes = helpers.get_time_stamp_by_delta(
        date, days=1, with_month_start_day=False, date_time_format=None
    )

    month_start = helpers.get_time_stamp_by_delta(
        date_yes, days=0, with_month_start_day=True, date_time_format=None
    )

    date_filter = (
        f"(a.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE >= '{month_start.strftime('%Y-%m-%d')}' "
        f"AND (a.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE <= '{date_yes.strftime('%Y-%m-%d')}'"
    )

    query = f"""
                SELECT *
                    FROM (
                        SELECT
                            lm.name AS "Location Name",

                            COUNT(
                                CASE
                                    WHEN a.interlock_name IN (
                                        'Rim Seal system_Fault activated',
                                        'HCD_Fault activated',
                                        'AirCompressor_Fault activated',
                                        'ROSOV_FailtoClose',
                                        'Fire engine_ FailtoStart',
                                        'Fireengine_LLOP',
                                        'FireEngine_HWOT',
                                        'FireEngine_Tripped',
                                        'Jockeypump_ FailtoStart'
                                    )
                                    THEN a.id
                                END
                            ) AS "Fault",

                            COUNT(
                                CASE
                                    WHEN a.interlock_name IN (
                                        'ESD Push button_Under Maintenance',
                                        'Rim Seal system_Under Maintenance',
                                        'Tank_Under Maintenance',
                                        'ROSOV_Under Maintenance',
                                        'MOV_Under Maintenance',
                                        'VFT_Under Maintenance',
                                        'Secondary Radar_Under Maintenance',
                                        'Fire engine_Under Maintenance',
                                        'JockeyPump_Under Maintenance',
                                        'HydrantPT_Under Maintenance',
                                        'HCD_Under Maintenance'
                                    )
                                    THEN a.id
                                END
                            ) AS "Maintenance"

                        FROM location_master lm
                        LEFT JOIN alerts a
                            ON a.sap_id = lm.sap_id
                            AND a.alert_status <> 'Close'
                            AND {date_filter}
                        WHERE lm.location_onboard = TRUE
                        GROUP BY lm.name
                    ) t
                    ORDER BY ("Fault" + "Maintenance") DESC
                    LIMIT 15;
                """
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    tas_fault_maintenance_resp = await function(query=query)

    tas_fault_maintenance_resp = pd.DataFrame(tas_fault_maintenance_resp)

    df = tas_fault_maintenance_resp.copy()

    df.insert(0, "S.no", range(1, len(df) + 1))
    total_fault = df["Fault"].sum()
    total_maintenance = df["Maintenance"].sum()
    total_row = pd.DataFrame([{
        "S.no": "Total",
        "Location Name": "",
        "Fault": total_fault,
        "Maintenance": total_maintenance
    }])
    df = pd.concat([df, total_row], ignore_index=True)
    print('*'*200)
    print('tas_fault_maintenance_resp',df)
    print('*'*200)
    return {
        "tas_fault_maintenance_resp": df.to_dict(orient="records"),
        "tas_fault_maintenance_columns": df.columns.tolist()
    }

async def get_valid_local_loaded_tts():
    query = f'''
                WITH date_range AS (
                    SELECT
                        CASE
                            WHEN EXTRACT(DAY FROM CURRENT_DATE) = 1
                            THEN DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                            ELSE DATE_TRUNC('month', CURRENT_DATE)
                        END AS start_date,
                        CASE
                            WHEN EXTRACT(DAY FROM CURRENT_DATE) = 1
                            THEN DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 second'
                            ELSE CURRENT_DATE - INTERVAL '1 second'
                        END AS end_date
                ),
                valid_trucks AS (
                    SELECT
                        h.sap_id,
                        DATE_TRUNC('hour', h.created_at) AS hour_bucket,
                        REGEXP_REPLACE(UPPER(h.truck_number), '[^A-Z0-9]', '', 'g') AS truck
                    FROM host_local_loaded_tts h
                    CROSS JOIN date_range d
                    WHERE h.created_at BETWEEN d.start_date AND d.end_date
                    AND REGEXP_REPLACE(UPPER(h.truck_number), '[^A-Z0-9]', '', 'g')
                        ~ '^[A-Z]{{2}}[0-9]{{2}}[A-Z]{{2}}[0-9]{{4}}$'
                ),
                hourly_distinct AS (
                    SELECT DISTINCT
                        sap_id,
                        hour_bucket,
                        truck
                    FROM valid_trucks
                )
                SELECT
                    hd.sap_id,
                    lm.name,
                    COUNT(*) AS overall_valid_truck_count
                FROM hourly_distinct hd
                LEFT JOIN location_master lm
                    ON hd.sap_id = lm.sap_id
                GROUP BY
                    hd.sap_id,
                    lm.name
                ORDER BY
                    hd.sap_id;
                '''
    result = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)

    print('*'*200)
    print("Result:", result['data'])
    print('*'*200)

    df = pl.DataFrame(result['data'])
    return df

async def get_parameters_summary():
    date = urdhva_base.utilities.get_present_time()

    date_yes = helpers.get_time_stamp_by_delta(
        date, days=1, with_month_start_day=False, date_time_format=None
    )

    month_start = helpers.get_time_stamp_by_delta(
        date_yes, days=0, with_month_start_day=True, date_time_format=None
    )

    date_filter = (
        f"created_at::DATE >= '{month_start.strftime('%Y-%m-%d')}' "
        f"AND created_at::DATE <= '{date_yes.strftime('%Y-%m-%d')}'"
    )

    sap_ids_tas = [
        "1919", "1128", "1216", "1334", "1155",
        "1221", "1259", "1412", "1146", "1509",
        "1424", "1892", "1588", "1856", "1845"
    ]
    sap_ids_str = ", ".join([f"'{sid}'" for sid in sap_ids_tas])

    query = f"""SELECT
                    'SOD' AS "SBU",

                    (SELECT COUNT(DISTINCT (load_number, truck_number))
                    FROM host_sick_tts WHERE {date_filter}
                    ) AS "Sick TT",

                    COUNT(CASE
                        WHEN interlock_name = 'BCU Local Loading'
                        THEN 1
                    END) AS "Local Loaded TT",

                    COUNT(CASE
                        WHEN interlock_name = 'K Factor Change_BCU'
                        THEN 1
                    END) AS "K Factor Changes",

                    COUNT(CASE
                        WHEN interlock_name = 'MFM K Factor Change'
                        THEN 1
                    END) AS "MFM Factor Changes"

                FROM alerts
                WHERE 
                interlock_name IN (
                'BCU Local Loading',
                'K Factor Change_BCU',
                'MFM K Factor Change'
                ) AND {date_filter}
                AND sap_id IN ({sap_ids_str})
                """
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    tas_parameters_summary = await function(query=query)

    tas_parameters_summary = pd.DataFrame(tas_parameters_summary)

    valid_trucks_df = await get_valid_local_loaded_tts()

    if valid_trucks_df.is_empty():
        total_truck = 0
    else:
        total_truck = valid_trucks_df.select(
            pl.col("overall_valid_truck_count").sum()
        ).item()

    # Get Local Loaded TT value
    local_loaded_value = tas_parameters_summary.loc[0, "Local Loaded TT"]

    # Update it with valid truck count
    tas_parameters_summary.loc[0, "Local Loaded TT"] = (
        f"{local_loaded_value} (TT: {total_truck})"
    )

    print('*'*200)
    print("Total Valid Trucks:", total_truck)
    print('*'*200)

    date_filter = (
        f"a.created_at::DATE >= '{month_start.strftime('%Y-%m-%d')}' "
        f"AND a.created_at::DATE <= '{date_yes.strftime('%Y-%m-%d')}'"
    )

    hst_date_filter = (
        f"created_at::DATE >= '{month_start.strftime('%Y-%m-%d')}' "
        f"AND created_at::DATE <= '{date_yes.strftime('%Y-%m-%d')}'"
    )

    if valid_trucks_df.is_empty():
        valid_trucks_pd = pd.DataFrame(
            columns=["Location Name", "overall_valid_truck_count"]
        )
    else:
        valid_trucks_pd = valid_trucks_df.to_pandas()

    valid_trucks_pd = valid_trucks_pd.rename(columns={
        "name": "Location Name"
    })

    tas_parameters_query = f"""SELECT
                                    lm.name AS "Location Name",

                                    CASE 
                                        WHEN hst.sick_tt IS NULL THEN 0 
                                        ELSE hst.sick_tt 
                                    END AS "Sick TT",

                                    COUNT(CASE
                                        WHEN a.interlock_name = 'BCU Local Loading'
                                        THEN 1
                                    END) AS "Local Loaded TT",

                                    COUNT(CASE
                                        WHEN a.interlock_name = 'K Factor Change_BCU'
                                        THEN 1
                                    END) AS "K Factor Changes",

                                    COUNT(CASE
                                        WHEN a.interlock_name = 'MFM K Factor Change'
                                        THEN 1
                                    END) AS "MFM Factor Changes"

                                FROM location_master lm
                                LEFT JOIN alerts a
                                    ON a.sap_id = lm.sap_id
                                    AND a.interlock_name IN (
                                        'BCU Local Loading',
                                        'K Factor Change_BCU',
                                        'MFM K Factor Change'
                                    )
                                    AND {date_filter}
                                
                                LEFT JOIN (
                                    SELECT
                                        sap_id,
                                        COUNT(DISTINCT (load_number, truck_number)) AS sick_tt
                                    FROM host_sick_tts
                                    WHERE {hst_date_filter}
                                    GROUP BY sap_id
                                ) hst
                                ON hst.sap_id = lm.sap_id

                                WHERE lm.location_onboard = TRUE

                                GROUP BY lm.name, hst.sick_tt

                                ORDER BY
                                    (
                                        CASE WHEN hst.sick_tt IS NULL THEN 0 ELSE hst.sick_tt END +
                                        COUNT(CASE WHEN a.interlock_name = 'BCU Local Loading' THEN 1 END) +
                                        COUNT(CASE WHEN a.interlock_name = 'K Factor Change_BCU' THEN 1 END) +
                                        COUNT(CASE WHEN a.interlock_name = 'MFM K Factor Change' THEN 1 END)
                                    ) DESC

                                LIMIT 15"""
    
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    tas_parameters_query_resp = await function(query=tas_parameters_query)

    tas_parameters_query_resp = pd.DataFrame(tas_parameters_query_resp)

    df = tas_parameters_query_resp.copy()

    df = df.merge(
        valid_trucks_pd,
        on="Location Name",
        how="left"
    )

    df["overall_valid_truck_count"] = (
        df["overall_valid_truck_count"]
        .fillna(0)
        .astype(int)
    )

    df.rename(
        columns={"overall_valid_truck_count": "Valid Trucks"},
        inplace=True
    )

    print('*'*200)
    print('Merged DataFrame before formatting:',df)
    print('*'*200)

     # Update Local Loaded TT with valid truck count

    total_valid_trucks = df["Valid Trucks"].sum()

    df.insert(0, "S.NO", range(1, len(df) + 1))
    total_sick_tt = df["Sick TT"].sum()
    total_loaded_tt = df["Local Loaded TT"].sum()
    total_kfactor_tt = df["K Factor Changes"].sum()
    total_mfm_factor_tt = df["MFM Factor Changes"].sum()

    df["Local Loaded TT"] = df.apply(
        lambda row: f"{row['Local Loaded TT']} (TT: {row['Valid Trucks']})",
        axis=1
    )

    total_row = pd.DataFrame([{
        "S.NO": "Total",
        "Location Name": "",
        "Sick TT": total_sick_tt,
        "Local Loaded TT": f"{total_loaded_tt} (TT: {total_valid_trucks})",
        "Valid Trucks": total_valid_trucks,
        "K Factor Changes": total_kfactor_tt,
        "MFM Factor Changes": total_mfm_factor_tt
    }])
    df = pd.concat([df, total_row], ignore_index=True)
    for key in ["Valid Trucks","sap_id"]:
        if key in df.columns:
            df.drop(key, axis=1, inplace=True)
    # df.drop(columns=["Valid Trucks","sap_id"], inplace=True)
    print('*'*200)
    print('tas_parameters_summary',tas_parameters_summary)
    print('tas_parameters_query_resp',df)
    print('*'*200)
    return {
        "tas_parameters_query_resp": df.to_dict(orient="records"),
        "tas_parameters_query_resp_columns": df.columns.tolist(),
        "tas_parameters_summary": tas_parameters_summary
    }