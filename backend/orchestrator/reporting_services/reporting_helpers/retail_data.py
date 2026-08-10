import urdhva_base
import os
import json
import psycopg2
import datetime
import xlsxwriter
import polars as pl
import pandas as pd
import numpy as np
import hpcl_ceg_model
from weasyprint import HTML
import charts_actions
import dashboard_studio_model
import indentdryout_actions
import urdhva_base.utilities
import matplotlib.pyplot as plt
import utilities.helpers as helpers
import utilities.connection_mapping as connection_mapping
from charts_actions import charts_connection_vault_routing
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams
import orchestrator.dbconnector.credential_loader as credential_loader
import orchestrator.reporting_services.reporting_helpers.sales_data as sales_data


creds = credential_loader.get_credentials('APP_DB')

chart_path = ""
zone_wise_pdf_path = ""
last_30_days_chart_path = ""

DB_CONFIG = {
    "host": creds["host"],
    "port": creds["port"],
    "database": creds["database"],
    "user": creds["user"],
    "password": creds["password"]
}


async def dry_out_trends_chart(last_30_days_trends_df, output_path='/tmp/dry_out_trends.png'):
    global last_30_days_chart_path
    last_30_days_chart_path = output_path

    # If Polars DF → convert to Pandas
    if not isinstance(last_30_days_trends_df, pd.DataFrame):
        last_30_days_trends_df = last_30_days_trends_df.to_pandas()
    
    # Fix types
    last_30_days_trends_df['dry_out_count'] = pd.to_numeric(
        last_30_days_trends_df['dry_out_count'], errors='coerce'
    )
    
    last_30_days_trends_df['dry_out_date'] = pd.to_datetime(
        last_30_days_trends_df['dry_out_date'], errors='coerce'
    )
    last_30_days_trends_df = last_30_days_trends_df.sort_values('dry_out_date').reset_index(drop=True)

    # Format date label: Nov-21
    last_30_days_trends_df['x_label'] = last_30_days_trends_df['dry_out_date'].dt.strftime('%b-%d')

    plt.figure(figsize=(17, 9))

    bars = plt.bar(
        last_30_days_trends_df['x_label'],
        last_30_days_trends_df['dry_out_count'],
        width=0.45,
        color="#A9A9A9"
    )

    # Add labels above bars
    for bar in bars:
        height = bar.get_height()
        plt.text(
            bar.get_x() + bar.get_width() / 2,
            height + 30,
            f'{int(height)}',
            ha='center',
            va='bottom',
            rotation=90,        
            fontsize=14,
            fontweight='bold'
        )
    
    # Y-axis ticks → 0, 200, 400, ...
    max_val = last_30_days_trends_df['dry_out_count'].max()
    upper_limit = int(np.ceil(max_val / 200.0) * 200)
    plt.yticks(np.arange(0, upper_limit + 1, 200), fontsize=14)

    # Add top space so text doesn’t touch border
    plt.ylim(0, upper_limit + 300)

    # Add vertical grid lines (like image)
    plt.grid(axis='y', linestyle='--', linewidth=0.6, alpha=0.5)

    plt.xlabel("Day Wise Count", fontsize=16, labelpad=20)
    plt.xticks(rotation=45, ha='right', fontsize=14)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()

    return output_path


async def generate_chart(zone_fuel_df, out_path='/tmp/monthly_loss_chart.png'):
    global chart_path
    chart_path = out_path
    df = zone_fuel_df.copy()
    df['Month'] = df['Month'].astype(str)
    df['MS in KL'] = pd.to_numeric(df['MS in KL'], errors='coerce').fillna(0)
    df['HSD in KL'] = pd.to_numeric(df['HSD in KL'], errors='coerce').fillna(0)

    df['MS in KL'] = df['MS in KL'] / 1000.0
    df['HSD in KL'] = df['HSD in KL'] / 1000.0

    try:
        order_key = pd.to_datetime(df['Month'], format="%b'%y")
        df = df.assign(_order=order_key).sort_values('_order')
    except Exception:
        df = df.reset_index(drop=True)

    months = df['Month'].tolist()
    ms_vals = df['MS in KL'].to_numpy()
    hsd_vals = df['HSD in KL'].to_numpy()

    x = np.arange(len(months))
    width = 0.32   # Reduced for gap
    bar_gap = 0.10 # Small gap between bars

    plt.style.use('default')
    fig, ax = plt.subplots(figsize=(10, 5.2))
    ms_color = '#ff0000'
    hsd_color = '#00008B'

    # Add bars
    ms_bars = ax.bar(x - width/2 - bar_gap/2, ms_vals, width, label='MS', color=ms_color)
    hsd_bars = ax.bar(x + width/2 + bar_gap/2, hsd_vals, width, label='HSD', color=hsd_color)

    # Add value labels on top of bars for MS
    for bar in ms_bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2, height + 0.01, f'{int(height)}', 
                ha='center', va='bottom', fontsize=8)

    # Add value labels on top of bars for HSD
    for bar in hsd_bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2, height + 0.01, f'{int(height)}', 
                ha='center', va='bottom', fontsize=8)

    ax.set_title('Monthly Loss of Sales Due to Partial Dryouts (KL)', fontsize=14, pad=10)
    ax.set_xticks(x)
    ax.set_xticklabels(months, fontsize=10)
    ax.yaxis.grid(True, linestyle='-', linewidth=0.6, alpha=0.35)
    ax.set_axisbelow(True)
    ax.margins(x=0.02)
    ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.12), ncol=2, frameon=False)

    fig.tight_layout()
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    fig.savefig(out_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    return out_path


async def generate_nozzel_sales_chart(nozzel_sales_df, out_path="/tmp/grouped_nozzel_sales_chart.png"):
    global chart_path
    chart_path = out_path

    df = nozzel_sales_df.copy()

    df["transaction_date"] = pd.to_datetime(df["transaction_date"]).dt.tz_localize(None)
    df = df.sort_values("transaction_date")


    days = df["transaction_date"].dt.strftime("%b-%d").tolist()
    ms_vals = df["MS_TMT"].tolist()
    hsd_vals = df["HSD_TMT"].tolist()


    x = np.arange(len(days))       
    width = 0.35                    

    fig, ax = plt.subplots(figsize=(12, 5))
    ms_color = '#ff0000'
    hsd_color = '#00008B'

    ms_bars = ax.bar(x - width/2,ms_vals,width,label="MS",color=ms_color)

    hsd_bars = ax.bar(x + width/2,hsd_vals,width,label="HSD",color=hsd_color)

    for bars in (ms_bars, hsd_bars):
        for bar in bars:
            height = bar.get_height()
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                height + 0.5,
                f"{int(height)}",
                ha="center",
                va="bottom",
                fontsize=8
            )


    ax.set_title("Daily Product Wise Nozzle Sales (in TMT)", fontsize=14)
    ax.set_xticks(x)
    ax.set_xticklabels(days, rotation=45, ha="right")
    ax.yaxis.grid(True, alpha=0.35)
    ax.set_axisbelow(True)

    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.15),ncol=2,frameon=False)

    fig.tight_layout()
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    # print(f"Grouped bar chart saved at: {os.path.abspath(out_path)}")
    return out_path


async def supply_terminal_wise_counts(by_ro=False):
    query = f"""SELECT DISTINCT
                    CASE 
                        WHEN a.zone = 'CEN' THEN 'CZ'
                        WHEN a.zone = 'NWF' THEN 'NWFZ'
                        ELSE a.zone
                    END AS zone,
                    a.terminal_plant_id AS plant_id,
                    COALESCE(NULLIF(lm.name, ''), a.terminal_plant_name) AS supply_location,
                    COALESCE(NULLIF(lm_ro.region, ''), a.region) AS region,
                    COALESCE(NULLIF(lm_ro.sales_area, ''), a.sales_area) AS sales_area,
                    COALESCE(NULLIF(lm_ro.zone, ''), a.zone) AS zones,
                    a.sap_id
                FROM alerts a
                LEFT JOIN location_master lm
                    ON a.terminal_plant_id = lm.sap_id
                LEFT JOIN location_master lm_ro
                    ON a.sap_id = lm_ro.sap_id
                WHERE
                    COALESCE(a.zone, '') <> ''        -- exclude empty or null zones
                    AND a.mark_as_false = 'true'
                    AND a.alert_status != 'Close'
                    AND a.dry_out_in_days = '1'
                    AND a.terminal_plant_name NOT ILIKE '%retail%'
                    AND a.product_code IN ('2811000', '2812000');"""
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 1
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    resp = await function(query=query)
    data_resp = pd.DataFrame(resp)
    data_resp = data_resp.drop(["sales_area", "zones"], axis=1)
    sap_ids = list(set(data_resp["sap_id"].tolist()))
    sap_ids = [str(sid).zfill(10) for sid in sap_ids]
    batch_size = 100
    all_batches = []
    carry_forward_bacthes = []
    for i in range(0, len(sap_ids), batch_size):
        batch = sap_ids[i:i + batch_size]
        print(f"Processing batch {i//batch_size + 1}: {len(batch)} items")
        batch_str = ",".join([f"'{str(s)}'" for s in batch])
        ims_query = f"""SELECT 
                            SUBSTR(a."DEALER_CODE", 1, 10) AS "SAP_ID",
                            COUNT(*) AS "VALID_COUNT"
                        FROM "IMS_SAP"."INDENT_REQUEST" a
                        WHERE a."BALANCE_AMOUNT" <= 0
                        AND a."TRUCK_REGNO" IS NULL
                        AND (a."CANCEL_INDENT" IS NULL OR a."CANCEL_INDENT" <> 'Y')
                        AND SUBSTR(a."DEALER_CODE", 1, 10) IN ({batch_str})
                        AND a."PROD_REQD_DT" <= TRUNC(SYSDATE)
                        GROUP BY SUBSTR(a."DEALER_CODE", 1, 10)
                        ORDER BY "SAP_ID" ASC
                        """
        carry_forward_query = f"""SELECT b."ZONECD",a."LOCN_CODE",SUBSTR(a."DEALER_CODE", 1, 10) AS "SAP_ID",
                                  count(a."INDENT_NO") AS "INDCNT" 
                                  FROM "IMS_SAP"."INDENT_REQUEST" a,"IMS_SAP"."LOCN_MASTER" b WHERE a."LOCN_CODE" = b."LOCN_CODE" AND
                                  TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') < TO_CHAR(SYSDATE,'yyyymmdd') AND
                                  TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') > TO_CHAR(SYSDATE-3,'yyyymmdd')
                                  AND SUBSTR(a."DEALER_CODE", 1, 10) IN ({batch_str})
                                  --and TO_CHAR(sysdate-7,'dd/mm/yyyy')
                                  AND a."TRUCK_REGNO" IS NULL AND (a."CANCEL_INDENT" IS NULL OR a."CANCEL_INDENT" <> 'Y')
                                  GROUP BY b."ZONECD", a."LOCN_CODE",SUBSTR(a."DEALER_CODE", 1, 10)
                                  ORDER BY b."ZONECD",a."LOCN_CODE"
                                  """
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        resp = await function(query=ims_query)
        batch_df = pd.DataFrame(resp)
        all_batches.append(batch_df)
        carry_resp = await function(query=carry_forward_query)
        carry_df = pd.DataFrame(carry_resp)
        carry_forward_bacthes.append(carry_df)

    # Combine all batches into one DataFrame
    # final_df = pd.concat(all_batches, ignore_index=True)
    # carry_forward_final_df = pd.concat(carry_forward_bacthes, ignore_index=True)
    # carry_forward_final_df.drop_duplicates(subset=["SAP_ID"], inplace=True)
    # carry_forward_final_df["SAP_ID"] = carry_forward_final_df["SAP_ID"].astype(str).str.lstrip("0")
    # # Optionally remove duplicates if needed
    # final_df.drop_duplicates(subset=["SAP_ID"], inplace=True)
    # final_df["SAP_ID"] = final_df["SAP_ID"].astype(str).str.lstrip("0")
    # Handle empty IMS batches safely

    valid_ims_dfs = [
        df for df in all_batches
        if not df.empty and "SAP_ID" in df.columns
    ]

    if valid_ims_dfs:
        final_df = pd.concat(valid_ims_dfs, ignore_index=True)
        final_df.drop_duplicates(subset=["SAP_ID"], inplace=True)
        final_df["SAP_ID"] = final_df["SAP_ID"].astype(str).str.lstrip("0")
    else:
        final_df = pd.DataFrame(columns=["SAP_ID", "VALID_COUNT"])
    
    valid_carry_dfs = [
        df for df in carry_forward_bacthes
        if not df.empty and "SAP_ID" in df.columns
    ]

    if valid_carry_dfs:
        carry_forward_final_df = pd.concat(valid_carry_dfs, ignore_index=True)
        carry_forward_final_df.drop_duplicates(subset=["SAP_ID"], inplace=True)
        carry_forward_final_df["SAP_ID"] = carry_forward_final_df["SAP_ID"].astype(str).str.lstrip("0")
    else:
        carry_forward_final_df = pd.DataFrame(columns=["SAP_ID", "INDCNT"])

    # print(final_df)
    # print("Combined DataFrame created successfully with", len(final_df), "records.")
    merged_df = data_resp.merge(
        final_df,
        how="left",
        left_on="sap_id",
        right_on="SAP_ID"
    )
    merged_df["VALID_COUNT"] = merged_df["VALID_COUNT"].fillna(0).astype(int)
    # Drop the extra SAP_ID column (from IMS data)
    merged_df.drop(columns=["SAP_ID"], inplace=True)
    # Step 6: Final output
    # print(merged_df.head())
    # print(f"\n Combined DataFrame created successfully with {len(merged_df)} records.")
    # print(" VALID_COUNT column added successfully based on SAP_ID.")
    carry_merge_df = merged_df.merge(
        carry_forward_final_df,
        how="left",
        left_on="sap_id",
        right_on="SAP_ID"
    )
    carry_merge_df["INDCNT"] = carry_merge_df["INDCNT"].fillna(0).astype(int)
    carry_merge_df.drop(columns=["SAP_ID"], inplace=True)

    required_columns = ["zone", "supply_location", "region"]
    if by_ro:
        required_columns.append("sap_id")

    summary_df = (
        carry_merge_df.groupby(required_columns, dropna=False)
        .agg(
            **{
                "Count of Dryout ROs": ("sap_id", "nunique"),
                "Valid Indent Count (Supply Location+Region)": ("VALID_COUNT", "sum"),
                "Average Pending Indent counts from Last 3 Days (Supply Location+Region)": ("INDCNT", "sum")
            }
        )
        .reset_index()
    )
    # Step 8: Rename columns
    summary_df.rename(
        columns={
            "zone": "Zone",
            "supply_location": "Supply Location (Terminal)",
            "region": "Region",
        },
        inplace=True,
    )
    # Sort by Count of Dryout ROs in descending order
    summary_df = summary_df.sort_values(
        by="Count of Dryout ROs", ascending=False, ignore_index=True
    )
    summary_df.insert(0, "Sl No", range(1, len(summary_df) + 1))
    # Step 8: Display results
    print(summary_df.head())
    #print(f"Summary DataFrame created successfully with {len(summary_df)} rows.")
    return summary_df


async def generate_sales_queries(product_name):
    """Generates the set of SQL queries needed for the sales report metrics."""
    today = datetime.datetime.now() 
    yesterday = today - datetime.timedelta(days=1)
    # Day
    day_current_start = day_current_end = yesterday.strftime('%Y%m%d')

    day_historical_start = day_historical_end = (yesterday - datetime.timedelta(days=365)).strftime('%Y%m%d')

    # Month
    month_start = yesterday.replace(day=1)
    month_current_start = month_start.strftime('%Y%m%d')
    month_current_end = yesterday.strftime('%Y%m%d')

    month_historical_start = (month_start - datetime.timedelta(days=365)).strftime('%Y%m%d')
    month_historical_end = (yesterday - datetime.timedelta(days=365)).strftime('%Y%m%d')
    
    # Year (Financial Year = April 1)
    fy_start_year = yesterday.year if yesterday.month >= 4 else yesterday.year - 1
    year_current_start = datetime.datetime(fy_start_year, 4, 1).strftime('%Y%m%d')
    year_current_end = yesterday.strftime('%Y%m%d')
    month_start_date = month_start.strftime("%Y-%m-%d")

    year_historical_start = datetime.datetime(fy_start_year - 1, 4, 1).strftime('%Y%m%d')
    year_historical_end = (yesterday - datetime.timedelta(days=365)).strftime('%Y%m%d')

    last_year_same_month_start = datetime.datetime(yesterday.year - 1, yesterday.month, 1)
    if yesterday.month == 12:
        last_year_same_month_end = datetime.datetime(yesterday.year, 1, 1) - datetime.timedelta(days=1)
    else:
        next_month = datetime.datetime(yesterday.year - 1, yesterday.month + 1, 1)
        last_year_same_month_end = next_month - datetime.timedelta(days=1)

    month_total_historical_start = last_year_same_month_start.strftime('%Y%m%d')
    month_total_historical_end = last_year_same_month_end.strftime('%Y%m%d')
    
    base_condition = """
        "SBU_Name" != '0' 
        AND "SBU_Name" IN ('Retail') 
        AND "ProductName" = '{product}'
    """

    query_template = """
        SELECT ROUND(SUM("MOM_DAY_LEVEL_DATA"."NETWEIGHT_TMT")::numeric,2)
        FROM "MOM_DAY_LEVEL_DATA"
        WHERE {condition} 
        AND "DAY_ID" BETWEEN '{start}' AND '{end}';
    """

    queries = {
        "day_current": query_template.format(condition=base_condition.format(product=product_name), start=day_current_start, end=day_current_end),
        "day_historical": query_template.format(condition=base_condition.format(product=product_name), start=day_historical_start, end=day_historical_end),
        "month_current": query_template.format(condition=base_condition.format(product=product_name), start=month_current_start, end=month_current_end),
        "month_historical": query_template.format(condition=base_condition.format(product=product_name), start=month_historical_start, end=month_historical_end),
        "year_current": query_template.format(condition=base_condition.format(product=product_name), start=year_current_start, end=year_current_end),
        "month_total_historical": query_template.format(
        condition=base_condition.format(product=product_name),
        start=month_total_historical_start,
        end=month_total_historical_end
        ),
        "year_historical": query_template.format(condition=base_condition.format(product=product_name), start=year_historical_start, end=year_historical_end)
    }
    print("queries",queries)
    return queries


async def fetch_value(conn, query):
    """Executes a single query and returns the float result, or 0.0 if None."""
    try:
        with conn.cursor() as cur:
            cur.execute(query)
            result = cur.fetchone()
            return float(result[0]) if result and result[0] is not None else 0.0
    except Exception as e:
        # print(f"Error fetching data: {e}") # Suppress verbose printing on failure
        return 0.0


async def calculate_growth(current, historical):
    """Calculates percentage growth, returns 0.0 if historical is zero."""
    if historical == 0 or historical is None:
        return 0.0
    # Returns percentage growth rounded to two decimal places
    return round(((current - historical) / historical) * 100, 2)


async def generate_report(product_name):
    """Fetches all data and calculates growth metrics for a single product."""
    queries = await generate_sales_queries(product_name)
    report = {}

    try:
        with psycopg2.connect(**DB_CONFIG) as conn:
            for key, query in queries.items():
                report[key] = await fetch_value(conn, query)

    except Exception as e:
        print(f"Database connection error: {e}")
        # Initialize report dictionary with zero/empty values on DB failure
        keys = ["day_current", "month_current", "projected_sales", "year_current"]
        for key in keys:
            report[key] = 0.0
    
    # Calculate growths
    report["day_growth"] = await calculate_growth(report.get("day_current", 0), report.get("day_historical", 0))
    report["month_growth"] = await calculate_growth(report.get("month_current", 0), report.get("month_historical", 0))
    report["year_growth"] = await calculate_growth(report.get("year_current", 0), report.get("year_historical", 0))
    month_growth = report["month_growth"]
    month_total_historical = report["month_total_historical"]
    projected_sales = month_total_historical + (month_total_historical * month_growth) / 100
    report["projected_sales"] = round(projected_sales, 2)
    report["month_target_growth"] = await calculate_growth(report.get("projected_sales", 0), report.get("month_total_historical", 0))

    # Structure the data for the final DataFrame row
    excel_report_data = {
        # FINAL FIX: Set SBU column to empty string in the data rows 
        "Product Group": product_name, # 'MS' or 'HSD'
        
        "Day's Sales (Current)": report["day_current"],
        "% Growth (Day)": report["day_growth"],
        
        "Month's Cumulative Sales Till Date (Current)": report["month_current"],
        "% Growth (Month MTD)": report["month_growth"],
        
        "Projected Sales for The Month": report["projected_sales"],
        "% Growth (Full Month)": report["month_target_growth"],
        
        "Year Cumulative Sales Till Date (Current)": report["year_current"],
        "% Growth (Year YTD)": report["year_growth"],
    }
    return excel_report_data


async def fetch_retail_sales():
    all_data = []
    for product in ["MS", "HSD"]:
        result = await generate_report(product)
        all_data.append(result)
    return all_data


# async def get_dry_out_count():
#     query = """
#                     WITH dates AS (
#                     SELECT CURRENT_DATE::date AS report_date
#                     ),
#                     distinct_alerts AS (
#                     SELECT DISTINCT ON (a.sap_id)
#                         a.id,
#                         a.sap_id,
#                         COALESCE(a.zone, lm.zone) AS raw_zone,
#                         a.created_at::date AS created_date
#                     FROM alerts a
#                     LEFT JOIN location_master lm ON a.sap_id = lm.sap_id
#                     WHERE a.interlock_name = 'Dry Out Each Indent Wise MainFlow'
#                         AND a.mark_as_false = true
#                         AND a.product_code IN ('2811000','2812000','2822000')
#                         AND a.dry_out_in_days = '1'
#                         AND a.indent_status NOT IN ('Cancelled', 'Completed', 'TempClosed', 'ProductLowLevel', 'OfflineOrFalseAlarm', 'NotAvailable')
#                     ORDER BY a.sap_id, a.progress_rate ASC, a.id
#                     ),
#                     normalized AS (
#                     SELECT
#                         id,
#                         sap_id,
#                         created_date,
#                         CASE
#                         WHEN raw_zone IN ('CEN','CZ') THEN 'CZ'
#                         WHEN raw_zone = 'ECZ' THEN 'ECZ'
#                         WHEN raw_zone = 'EZ' THEN 'EZ'
#                         WHEN raw_zone IN ('NCR','NCZ') THEN 'NCZ'
#                         WHEN raw_zone = 'NFZ' THEN 'NFZ'
#                         WHEN raw_zone = 'NWF' THEN 'NWFZ'
#                         WHEN raw_zone IN ('NWR','NWZ') THEN 'NWZ'
#                         WHEN raw_zone = 'NZ' THEN 'NZ'
#                         WHEN raw_zone IN ('SCR','SCZ') THEN 'SCZ'
#                         WHEN raw_zone = 'SWZ' THEN 'SWZ'
#                         WHEN raw_zone = 'SZ' THEN 'SZ'
#                         WHEN raw_zone = 'WZ' THEN 'WZ'
#                         ELSE 'OTHERS'
#                         END AS zone
#                     FROM distinct_alerts
#                     )
#                     SELECT
#                     d.report_date AS "report_date",
#                     COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'CZ')  AS "CZ",
#                     COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'ECZ') AS "ECZ",
#                     COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'EZ')  AS "EZ",
#                     COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'NCZ') AS "NCZ",
#                     COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'NFZ') AS "NFZ",
#                     COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'NWFZ') AS "NWFZ",
#                     COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'NWZ') AS "NWZ",
#                     COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'NZ')  AS "NZ",
#                     COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'SCZ') AS "SCZ",
#                     COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'SWZ') AS "SWZ",
#                     COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'SZ')  AS "SZ",
#                     COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'WZ')  AS "WZ",
#                     COUNT(DISTINCT n.sap_id) AS "Grand Total",
#                     ARRAY_AGG(n.id) AS all_ids
#                     FROM dates d
#                     LEFT JOIN normalized n ON n.created_date <= d.report_date
#                     GROUP BY d.report_date
#                     ORDER BY d.report_date
#                 """
#     dry_out_report_count = await hpcl_ceg_model.Alerts.get_aggr_data(query)
#     return dry_out_report_count


async def get_dry_out_count():
    query = """
                    WITH dates AS (
                    SELECT CURRENT_DATE::date AS report_date
                    ),
                    distinct_alerts AS (
                    SELECT DISTINCT ON (a.sap_id)
                        a.id,
                        a.sap_id,
                        COALESCE(a.zone, lm.zone) AS raw_zone,
                        a.created_at::date AS created_date
                    FROM alerts a
                    LEFT JOIN location_master lm ON a.sap_id = lm.sap_id
                    WHERE a.interlock_name = 'Dry Out Each Indent Wise MainFlow'
                        AND a.mark_as_false = true
                        AND a.product_code IN ('2811000','2812000','2822000')
                        AND a.dry_out_in_days = '1'
                        AND a.indent_status NOT IN ('Cancelled', 'Completed', 'TempClosed', 'ProductLowLevel', 'OfflineOrFalseAlarm', 'NotAvailable')
                    ORDER BY a.sap_id, a.progress_rate ASC, a.id
                    ),
                    normalized AS (
                    SELECT
                        id,
                        sap_id,
                        created_date,
                        CASE
                        WHEN raw_zone = 'NCZ' THEN 'NCZ'
                        WHEN raw_zone = 'SCZ' THEN 'SCZ'
                        WHEN raw_zone = 'WZ' THEN 'WZ'
                        WHEN raw_zone = 'Bhubaneswar Zone' THEN 'Bhubaneswar Zone'
                        WHEN raw_zone = 'Noida Zone' THEN 'Noida Zone'
                        WHEN raw_zone = 'EZ' THEN 'EZ'
                        WHEN raw_zone = 'Cochin Zone' THEN 'Cochin Zone'
                        WHEN raw_zone = 'Patna Zone' THEN 'Patna Zone'
                        WHEN raw_zone = 'NWZ' THEN 'NWZ'
                        WHEN raw_zone = 'Guwahati Zone' THEN 'Guwahati Zone'
                        WHEN raw_zone = 'Jaipur Zone' THEN 'Jaipur Zone'
                        WHEN raw_zone = 'Chandigarh Zone' THEN 'Chandigarh Zone'
                        WHEN raw_zone = 'SZ' THEN 'SZ'
                        WHEN raw_zone = 'Bengaluru Zone' THEN 'Bengaluru Zone'
                        WHEN raw_zone = 'Bhopal Zone' THEN 'Bhopal Zone'
                        WHEN raw_zone = 'NZ' THEN 'NZ'
                        ELSE 'OTHERS'
                        END AS zone
                    FROM distinct_alerts
                    )
                    SELECT
                    d.report_date AS "report_date",
                    COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'NCZ')  AS "NCZ",
                    COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'SCZ') AS "SCZ",
                    COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'WZ')  AS "WZ",
                    COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'Bhubaneswar Zone') AS "Bhubaneswar Zone",
                    COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'Noida Zone') AS "Noida Zone",
                    COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'EZ') AS "EZ",
                    COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'Cochin Zone') AS "Cochin Zone",
                    COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'Patna Zone')  AS "Patna Zone",
                    COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'NWZ') AS "NWZ",
                    COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'Guwahati Zone') AS "Guwahati Zone",
                    COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'Jaipur Zone')  AS "Jaipur Zone",
                    COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'Chandigarh Zone')  AS "Chandigarh Zone",
                    COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'SZ')  AS "SZ",
                    COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'Bengaluru Zone')  AS "Bengaluru Zone",
                    COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'Bhopal Zone')  AS "Bhopal Zone",
                    COUNT(DISTINCT n.sap_id) FILTER (WHERE n.zone = 'NZ')  AS "NZ",
                    COUNT(DISTINCT n.sap_id) AS "Grand Total",
                    ARRAY_AGG(n.id) AS all_ids
                    FROM dates d
                    LEFT JOIN normalized n ON n.created_date <= d.report_date
                    GROUP BY d.report_date
                    ORDER BY d.report_date
                """
    dry_out_report_count = await hpcl_ceg_model.Alerts.get_aggr_data(query)
    return dry_out_report_count


async def fetch_dryout_data(WRITE_TO_DB=False):
    global zone_wise_pdf_path
    # global WRITE_TO_DB

    dry_out_report_count = await get_dry_out_count()

    if dry_out_report_count.get("data", []):
        report_data = dry_out_report_count["data"][0]
        report_date = str(report_data["report_date"])
        # Step 1: check if record exists
        check_query = f"""
            SELECT id
            FROM dry_out_daily_report
            WHERE dry_out_date = '{report_date}'
        """
        existing = await hpcl_ceg_model.DryOutDailyReport.get_aggr_data(check_query)
        all_ids_list = [str(i) for i in report_data["all_ids"]] if report_data["all_ids"] else []
        dry_out_zone = []
        for key, value in report_data.items():
            if key not in ["report_date", "Grand Total", "all_ids"]:
                dry_out_zone.append({
                    "zone": key,
                    "count": str(value or 0)
                })
        if not existing.get("data", []):
            data = {
                "dry_out_date": report_date,
                "dry_out_count": str(report_data["Grand Total"]),
                "dry_out_zone": dry_out_zone,
                "dry_out_alert_ids": all_ids_list,
            }
            await hpcl_ceg_model.DryOutDailyReportCreate(**data).create()
        else:
            if WRITE_TO_DB:
                alert_id = existing['data'][0]['id']
                await hpcl_ceg_model.DryOutDailyReport(**{"id": alert_id, 
                                                          "dry_out_count": str(report_data["Grand Total"]),
                                                          "dry_out_zone": dry_out_zone,
                                                          "dry_out_alert_ids": all_ids_list}).modify()
                print("Data Inserted Successfully")
            else:
                print("Cannot update already existing Data")
            

    payload_dict = {"filters": [{"key": "interlock_name", "cond": "=", "value": ["Dry Out Each Indent Wise MainFlow"]},
                                {"key": "zone", "cond": "=", "value": []}, {"key": "plant", "cond": "=", "value": []},
                                {"key": "dealer_id", "cond": "=", "value": []},
                                {"key": "product_code", "cond": "=", "value": ["2811000", "2812000", "2822000"]},
                                {"key": "region", "cond": "=", "value": []},
                                {"key": "sales_area", "cond": "=", "value": []},
                                {"key": "progress_rate", "cond": "=", "value": []},
                                {"key": "dry_out_in_days", "cond": "=", "value": ["1"]},
                                {"key": "category", "cond": "=", "value": []}],
                    "bu_type": "ro"}
    payload_obj = indentdryout_actions.Indentdryout_Get_Dried_Out_RoParams(**payload_dict)
    response = await indentdryout_actions.indentdryout_get_dried_out_ro(payload_obj)
    cat_a = carry_fwd_dry_out = carry_fwd_indent = indent_not_raised = indent_raised = 0
    dry_out_details = {stat['section']: int(stat['value']) for stat in response['stats']}
    for stat in response['stats']:
        if stat['section'] == "CATA Carry Fwd Indent":
            cat_a = stat['value']
        elif stat['section'] == "DryOut Carry Fwd Indent":
            carry_fwd_dry_out = stat['value']
        elif stat['section'] == "Carry Fwd Indent":
            carry_fwd_indent = stat['value']
        elif stat['section'] == 'Indent Not Raised':
            indent_not_raised = stat['value']
        elif stat['section'] == 'Indent Raised':
            indent_raised = stat['value']

    query = f""" 
        SELECT dry_out_date, dry_out_zone, dry_out_count
        FROM dry_out_daily_report
        WHERE dry_out_date::DATE >= date_trunc('month', CURRENT_DATE)
        AND dry_out_date::DATE < (date_trunc('month', CURRENT_DATE) + interval '1 month')
    """
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    resp_target = await function(query=query)

    data = pd.DataFrame(resp_target)

    zones = ["Bengaluru Zone", "Bhopal Zone", "Bhubaneswar Zone", "Chandigarh Zone" ,"Cochin Zone", "EZ", 
             "Guwahati Zone", "Jaipur Zone", "NCZ", "Noida Zone", "NWZ", "NZ", "Patna Zone", "SCZ","SZ", "WZ"]

    # Parse dry_out_zone JSON
    data['dry_out_zone'] = data['dry_out_zone'].apply(lambda x: json.loads(x) if isinstance(x, str) else x)

    # Prepare records for flattening
    records = []
    for _, row in data.iterrows():
        date = row['dry_out_date']
        for z in row['dry_out_zone']:
            records.append({
                'Date': date,
                'Zone': z['zone'],
                'Count': int(z['count'])
            })

    flat_df = pd.DataFrame(records)

    # Pivot to zone-wise columns
    pivot = flat_df.pivot_table(index='Date', columns='Zone', values='Count', fill_value=0)
    for zone in zones:
        if zone not in pivot.columns:
            pivot[zone] = 0
    pivot = pivot[zones]

    # Convert dry_out_date to datetime for merging
    data['dry_out_date'] = pd.to_datetime(data['dry_out_date'])

    # Map original dry_out_count per date (converted to int)
    dry_out_count_map = data.groupby('dry_out_date')['dry_out_count'].first().astype(int)

    # Prepare pivot for merge
    pivot = pivot.reset_index()
    pivot['Date'] = pd.to_datetime(pivot['Date'])

    # Merge dry_out_count into pivot by date, replacing 'Grand Total'
    pivot = pivot.merge(dry_out_count_map.rename('dry_out_count'), left_on='Date', right_index=True, how='left')

    # Rename pivot date column to match desired column name
    pivot.rename(columns={'Date': 'Day wise No. of Dryout ROs'}, inplace=True)

    # Set 'Grand Total' to dry_out_count from original query
    pivot['Grand Total'] = pivot['dry_out_count'].fillna(0).astype(int)

    # Drop helper column
    pivot.drop(columns=['dry_out_count'], inplace=True)

    # Convert zone counts to int
    pivot[zones] = pivot[zones].astype(int)


    # Summary row values (example values, modify if needed) Day wise No. of Dryout ROs
    default_ro_values_base = {
        'Bengaluru Zone': 1725,
        'Bhopal Zone' : 1710,
        'Bhubaneswar Zone' : 1426,
        'Chandigarh Zone' : 1557,
        'Cochin Zone': 883,
        'EZ': 735,
        'Guwahati Zone': 481,
        'Jaipur Zone': 1916,
        'NCZ': 1599,
        'Noida Zone' : 1718,
        'NWZ': 1400,
        'NZ': 1199,
        'Patna Zone': 1320,
        'SCZ': 2860,
        'SZ': 1941,
        'WZ': 2690
    }

    default_ro_values = {
        'Day wise No. of Dryout ROs': 'Zone wise Total ROs',
        'Grand Total': sum(val for key, val in default_ro_values_base.items() if key in zones)
    }
    for col in zones:
        default_ro_values[col] = default_ro_values_base.get(col, 0)

    # Prepend summary row
    pivot = pd.concat([pd.DataFrame([default_ro_values]), pivot], ignore_index=True)

    pivot.loc[1:, 'Day wise No. of Dryout ROs'] = pd.to_datetime(pivot.loc[1:, 'Day wise No. of Dryout ROs']).dt.strftime('%Y-%m-%d')

    # Reorder columns to put Grand Total as last column
    cols = list(pivot.columns)
    cols.remove('Grand Total')
    cols.append('Grand Total')
    pivot = pivot[cols]

    # Print final pivot table without index
    print("\n===== Zone-wise Dryout ROs =====")
    print(pivot.to_string(index=False))
    pivot_final = pivot
    zone_totals = pivot_final.iloc[0].to_dict()
    zone_daily = pivot_final.iloc[1:].to_dict(orient="records")
   

    # Prepare and print summary (date-wise dryout count)
    summary_df = pivot.copy()
    summary_df["Day wise No. of Dryout ROs"] = pd.to_datetime(summary_df["Day wise No. of Dryout ROs"], errors="coerce").dt.strftime("%b %-d").fillna(summary_df["Day wise No. of Dryout ROs"])
    summary_df = summary_df.rename(columns={"Day wise No. of Dryout ROs": "Date", "Grand Total": "Dry out Count"})[["Date", "Dry out Count"]]
    summary_df = summary_df[summary_df["Date"] != "Zone wise Total ROs"]
    summary_df["Dry out Count"] = summary_df["Dry out Count"].astype(int)
    summary_df = summary_df[~summary_df["Date"].str.contains("Day wise", na=False)]
    #summary_df = summary_df.iloc[:-1]

    print("\n===== Summary (Date vs Dry out Count) =====")
    print(summary_df.to_string(index=False))

    date = urdhva_base.utilities.get_present_time()
    date_yes = helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                               date_time_format=None)
    month_start = helpers.get_time_stamp_by_delta(date_yes, days=0, with_month_start_day=True,
                                               date_time_format="%Y-%m-%d")
    loss_query = f"""SELECT
                            TO_CHAR(stock_date, 'Mon''YY') AS "Month",
                            SUM(CASE WHEN product_name = 'MS' THEN loss_of_sale ELSE 0 END) AS "MS in KL",
                            SUM(CASE WHEN product_name = 'HSD' THEN loss_of_sale ELSE 0 END) AS "HSD in KL",
                            SUM(CASE WHEN product_name IN ('HSD', 'MS') THEN loss_of_sale ELSE 0 END) AS "TMF in KL"
                        FROM
                            daily_product_dry_out
                        WHERE
                            stock_date >= CURRENT_DATE - INTERVAL '1 year'
                            AND stock_date < CURRENT_DATE
                            AND product_no IN (1322000, 1683000)
                        GROUP BY
                            TO_CHAR(stock_date, 'Mon''YY'),
                            DATE_TRUNC('month', stock_date)
                        ORDER BY
                            DATE_TRUNC('month', stock_date);
                    """
    last_30_days_dry_out_trends_query = f"""SELECT dry_out_date, dry_out_count
                                            FROM dry_out_daily_report Where created_at::DATE > CURRENT_DATE - INTERVAL '30 days'
                                            ORDER BY dry_out_date ASC
                                        """
    nozzle_sales_query = f"""SELECT
                                "transaction_date",

                                ROUND(
                                    (
                                        (
                                            SUM("sales_volume") FILTER (WHERE product_grp in ('MS','POWER 99','POWER 95','POWER 100'))
                                            / 1411.0
                                        ) / 1000.0
                                    ) / 0.89
                                )::BIGINT AS "MS_TMT",

                                ROUND(
                                    (
                                        (
                                            SUM("sales_volume") FILTER (WHERE product_grp in ('HSD','TURBO'))
                                            / 1210.0
                                        ) / 1000.0
                                    ) / 0.89
                                )::BIGINT AS "HSD_TMT"

                            FROM "public".nozzle_sales
                            WHERE "transaction_date" >= CURRENT_DATE - INTERVAL '31 days'
                            GROUP BY "transaction_date"
                            ORDER BY "transaction_date";
                        """
    nozzel_previous_day_query = f"""select count(distinct(site_id)) from nozzle_sales where transaction_date::DATE=CURRENT_DATE - INTERVAL '1 day' 
                                    and zone is not null"""
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("cris", "2")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    # zone_data = await function(query=loss_query)
    zone_data = await helpers.retry_async(function, retries=3, delay=10, query=loss_query)
    zone_fuel_df = pd.DataFrame(zone_data)


    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    last_30_days_trends = await function(query=last_30_days_dry_out_trends_query)
    last_30_days_trends_df = pd.DataFrame(last_30_days_trends)

    nozzel_sales= await function(query= nozzle_sales_query)
    nozzel_sales_df = pd.DataFrame(nozzel_sales)
    print("nozzel_sales_df = pd.DataFrame(nozzel_sales) ---->\n", nozzel_sales_df)
    nozzel_previous_day = await function(query= nozzel_previous_day_query)
    print("nozzel_previous_day ---->\n", nozzel_previous_day)

    nozzle_sales_percentage = round(
        (nozzel_previous_day[0]['count'] / 25160) * 100,
        1
    )
    print("nozzle_sales_percentage ---->\n", nozzle_sales_percentage)
    
    zone_wise_chart = await dry_out_trends_chart(last_30_days_trends_df)
    chart_path = await generate_chart(zone_fuel_df)
    nozzel_sales_chart = await generate_nozzel_sales_chart(nozzel_sales_df)

    supply_terminal_query_ro_count_df = await supply_terminal_wise_counts()

    bottom_3_per_zone_sorted = (
        supply_terminal_query_ro_count_df
        .groupby("Zone", group_keys=True)
        .apply(lambda x: x.nlargest(3, "Count of Dryout ROs")
                        .sort_values("Count of Dryout ROs", ascending=False))
        .reset_index(drop=True)
    )

    # Step 3: Reassign Sl No sequentially
    bottom_3_per_zone_sorted["Sl No"] = range(1, len(bottom_3_per_zone_sorted) + 1)

    # Step 4: Reorder columns for readability
    bottom_3_per_zone_sorted = bottom_3_per_zone_sorted[
        ["Sl No", "Zone", "Supply Location (Terminal)", "Region", "Count of Dryout ROs", "Valid Indent Count (Supply Location+Region)", "Average Pending Indent counts from Last 3 Days (Supply Location+Region)"]
    ]
    print(bottom_3_per_zone_sorted)

    # Convert DataFrame to styled HTML
    supply_terminal_query_ro_count_df = supply_terminal_query_ro_count_df.sort_values(
        by=["Zone", "Count of Dryout ROs"],
        ascending=[True, False]
    )
    supply_terminal_query_ro_count_df["Sl No"] = range(1, len(supply_terminal_query_ro_count_df) + 1)

    total_dryout_ros = supply_terminal_query_ro_count_df["Count of Dryout ROs"].sum()
    total_valid_indent = supply_terminal_query_ro_count_df["Valid Indent Count (Supply Location+Region)"].sum()
    avg_pending_indents = supply_terminal_query_ro_count_df["Average Pending Indent counts from Last 3 Days (Supply Location+Region)"].sum()

    # Create total row
    total_row = {
        "Sl No": "",
        "Zone": "",
        "Supply Location (Terminal)": "",
        "Region": "TOTAL",
        "Count of Dryout ROs": total_dryout_ros,
        "Valid Indent Count (Supply Location+Region)": total_valid_indent,
        "Average Pending Indent counts from Last 3 Days (Supply Location+Region)": avg_pending_indents
    }

    # Append to dataframe
    supply_terminal_query_ro_count_df = pd.concat(
        [supply_terminal_query_ro_count_df, pd.DataFrame([total_row])],
        ignore_index=True
    )
    today = datetime.datetime.now() 
    current_date = today.strftime("%d %B %Y")

    html_table = supply_terminal_query_ro_count_df.to_html(
        index=False,
        classes="styled-table",
        border=0,
        justify="center"
    )

    retail_html_content = f"""  <html>
                                <head>
                                <style>
                                @page {{
                                    margin: 10px;  /* Reduce PDF margins */
                                }}
                                body {{
                                    font-family: Arial, sans-serif;
                                    margin: 5px;  /* Reduce white space around content */
                                    padding: 0;
                                }}
                                .header {{
                                    position: relative;
                                    text-align: center;
                                    margin-bottom: 15px;
                                }}

                                .title {{
                                    font-size: 18px;
                                    font-weight: bold;
                                    color: #003366;
                                }}

                                .date {{
                                    position: absolute;
                                    right: 0;
                                    top: 0;
                                    font-size: 14px;
                                    color: #333;
                                }}
                                h2 {{
                                    text-align: center;
                                    color: #003366;
                                    margin-bottom: 20px;
                                    margin-top: 5px;
                                    font-size: 18px;
                                }}
                                table.styled-table {{
                                    border-collapse: collapse;
                                    width: 100%;
                                    margin: 5px auto;  /* Small margin around table */
                                    table-layout: fixed; 
                                }}
                                table.styled-table th {{
                                    background-color: #003366;
                                    color: white;
                                    text-align: center;
                                    padding: 8px;
                                    border: 1px solid #ddd;

                                    white-space: normal;     
                                    word-wrap: break-word;
                                    word-break: break-word;
                                    font-size: 12px;  
                                }}
                                table.styled-table td {{
                                    text-align: center;
                                    padding: 6px;
                                    border: 1px solid #ddd;
                                }}
                                table.styled-table tr:nth-child(even) {{
                                    background-color: #f2f2f2;
                                }}
                                table.styled-table tr:last-child {{
                                    font-weight: bold;
                                    background-color: #FFF2CC;  
                                    color: #000;
                                }}
                                </style>
                                </head>
                                <body>
                                <div class="header">
                                    <div class="title">Location Wise RO Dryout Count</div>
                                    <div class="date">{current_date}</div>
                                </div>
                                {html_table}
                                </body>
                                </html>
                                """

    pdf_path = "/tmp/Location Wise RO Dryout Count.pdf"

    zone_wise_pdf_path = pdf_path

    HTML(string=retail_html_content).write_pdf(pdf_path)

    retail_sales = await fetch_retail_sales()

    dry_out_cf = {
        'cat_a': cat_a,
        'dry_out': carry_fwd_dry_out,
        'others': carry_fwd_indent - carry_fwd_dry_out - cat_a,
        'total': carry_fwd_indent
    }
    dry_out = {
        "dry_out": indent_not_raised + indent_raised,
        'indent_not_raised': indent_not_raised,
        "indent_raised": indent_raised
    }

    print("dry_out_cf :", dry_out_cf)
    print("dry_out :", dry_out)
    return {"dry_out_cf": dry_out_cf, "dry_out": dry_out, 'dry_out_details': dry_out_details, 
            'dry_out_trends': summary_df.to_dict(orient='records'),
             "zone_totals": zone_totals, "zone_daily": zone_daily, "zone_columns": list(pivot_final.columns), 'zone_fuel_df':zone_fuel_df, 'supply_terminal_query_ro_count_df': bottom_3_per_zone_sorted, "retail_sales": retail_sales,
            'zone_wise_chart': zone_wise_chart, 'chart_path': chart_path, 'zone_wise_pdf_path': zone_wise_pdf_path, 'nozzel_sales_chart': nozzel_sales_chart,
            'nozzel_previous_day': nozzel_previous_day, 'nozzle_sales_percentage': nozzle_sales_percentage}


async def get_ro_alerts():
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    query = f""" SELECT count(interlock_name) as total_count, severity FROM alerts where bu='RO' and 
    interlock_name != 'Dry Out Each Indent Wise MainFlow' and alert_section='RO' and 
    created_at>='{today}' and alert_status='Open' GROUP BY severity; """
    alerts = await function(query=query)
    data = {}
    if alerts:
        for alert in alerts:
            if alert["severity"] == "Critical":
                data = {"automation_critical_ro": alert["total_count"]}
            if alert["severity"] == "High":
                data = {"automation_high_ro": alert["total_count"]}
    for key in ["automation_critical_ro", "automation_high_ro"]:
        if key not in data.keys():
            data.update({key: 0})
    return data


async def get_bi_hourly_intra_dryout():
    """ Reading Intra Day Dryout details from CRIS DB"""
    intra_dryout_query = """
        WITH base_data AS (
        SELECT
            site_id,
            rosapcode,
            product_grp,
            SUM(GREATEST(pumpable_stock,0)) AS pumpable_stock,
            SUM(avgsales_7days)/7/24 AS hourly_sales,
            CASE
                WHEN SUM(GREATEST(pumpable_stock,0)) <= 0 THEN 0
                WHEN SUM(GREATEST(pumpable_stock,0)) < (SUM(avgsales_7days)/7/24)*6 THEN 1
                WHEN SUM(GREATEST(pumpable_stock,0)) < (SUM(avgsales_7days)/7/24)*12 THEN 2
                WHEN SUM(GREATEST(pumpable_stock,0)) < (SUM(avgsales_7days)/7/24)*24 THEN 3
                WHEN SUM(GREATEST(pumpable_stock,0)) < (SUM(avgsales_7days)/7/24)*72 THEN 4
                ELSE 5
            END AS status
        FROM "HPCL_HOS".sch_inventory_forecast_dashboard sch
        WHERE sch.volume > 0
        AND product_grp IN ('MS','HSD','E20')
        GROUP BY site_id, rosapcode, product_grp
    ),

    site_status AS (
        SELECT
            rosapcode,
            MIN(status) AS status
        FROM base_data
        GROUP BY rosapcode
    )
    SELECT
        CASE
            WHEN status = 0 THEN 'no_stock'
            WHEN status = 1 THEN 'hr_0_6'
            WHEN status = 2 THEN 'hr_6_12'
            WHEN status = 3 THEN 'hr_12_24'
            WHEN status = 4 THEN 'hr_24_72'
            ELSE 'Others'
        END AS stock_status,
        COUNT(*) AS site_count
    FROM site_status
    GROUP BY status
    ORDER BY status;
    """
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("cris", "2")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    # resp = await function(query=intra_dryout_query)
    resp = await helpers.retry_async(function, retries=3, delay=10, query=intra_dryout_query)
    resp = {rec['stock_status']: rec['site_count'] for rec in resp}
    resp['partial_dryout'] = sum([resp[key] for key in ['hr_0_6', 'hr_6_12', 'hr_12_24']])
    resp['online'] = resp['offline'] = 0
    location_status = await get_ro_location_status()

    if location_status:
        resp['online'] = location_status[0]['count']

    # for rec in location_status:
    #     if rec['ro_status'] == 'Online':
    #         resp['online'] = rec['count']
    #     elif rec['ro_status'] == 'Offline':
    #         resp['offline'] = rec['count']
    return resp


async def get_ro_location_status():
    """
    Fetching ro locations status count online/offline from CRIS database
    :return: list of dictionaries containing status
    Ex:- [{'count': 4383, 'ro_status': 'Offline'}, {'count': 20823, 'ro_status': 'Online'}]
    """

    # query = """SELECT COUNT(DISTINCT site_id),
    #             CASE 
    #                 WHEN enable THEN 'Online'
    #                 ELSE 'Offline' 
    #                 END AS ro_status 
    #             FROM "HPCL_HOS".ms_site WHERE  "tempclose" IN (NULL, 'false') group by enable"""

    query = f"""select 
                    count(distinct(rosapcode)) 
                    from 
                    "HPCL_HOS".sch_inventory_forecast_dashboard 
                    where volume>0 and product_grp IN ('MS','HSD','E20')
                """
    
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("cris", "2")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    # resp = await function(query=query)
    resp = await helpers.retry_async(function, retries=3, delay=10, query=query)
    return resp


async def get_ro_locations_sch():
    query = """select distinct rosapcode from "HPCL_HOS".sch_inventory_forecast_dashboard"""

    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("cris", "2")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    # resp = await function(query=query)
    resp = await helpers.retry_async(function, retries=3, delay=10, query=query)
    resp = pl.DataFrame(resp)
    print("resp----> \n", resp)
    return resp



# Default product groups and conversion factors for nozzle_sales TMT calculation
NOZZLE_SALES_MS_PRODUCTS_DEFAULT = ("MS", "E20", "POWER 99", "POWER 95", "POWER 100")
NOZZLE_SALES_HSD_PRODUCTS_DEFAULT = ("HSD", "TURBO")
NOZZLE_SALES_MS_DIVISOR = 1411.0
NOZZLE_SALES_HSD_DIVISOR = 1210.0
NOZZLE_SALES_VOLUME_FACTOR = 0.89

# Relative period shorthand: "1D" = last 1 day (yesterday), "7D" = last 7 days, etc.
NOZZLE_SALES_RELATIVE_DAYS_PATTERN = {"1d": 1, "2d": 2, "7d": 7, "15d": 15, "30d": 30}


def _nozzle_sales_parse_date_spec(date_spec, reference_date=None):
    """
    Parse flexible date_spec into (start_date_str, end_date_str) for SQL, both 'YYYY-MM-DD'.

    date_spec can be:
    - None or 1 or "1D": single day = yesterday (relative to reference_date).
    - int (2, 7, 15, ...) or str "2D", "7D", "15D", "30D": last N days ending yesterday (inclusive).
    - str "YYYY-MM-DD" or datetime.date: single exact date.
    - (start, end) or [start, end]: date range; start/end as str or date.

    reference_date: date to use as "today" for relative specs; default datetime.date.today().
    """
    today = reference_date if reference_date is not None else datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)

    def to_str(d):
        if d is None:
            return None
        if isinstance(d, datetime.date) and not isinstance(d, datetime.datetime):
            return d.strftime("%Y-%m-%d")
        if isinstance(d, datetime.datetime):
            return d.date().strftime("%Y-%m-%d")
        s = str(d).strip()
        if not s:
            return None
        return s

    if date_spec is None:
        start_date = end_date = yesterday
    elif isinstance(date_spec, int):
        if date_spec <= 1:
            start_date = end_date = yesterday
        else:
            end_date = yesterday
            start_date = today - datetime.timedelta(days=date_spec)
    elif isinstance(date_spec, str):
        date_spec = date_spec.strip().lower()
        if date_spec in NOZZLE_SALES_RELATIVE_DAYS_PATTERN:
            n = NOZZLE_SALES_RELATIVE_DAYS_PATTERN[date_spec]
            if n <= 1:
                start_date = end_date = yesterday
            else:
                end_date = yesterday
                start_date = today - datetime.timedelta(days=n)
        else:
            try:
                d = datetime.datetime.strptime(date_spec, "%Y-%m-%d").date()
                start_date = end_date = d
            except ValueError:
                start_date = end_date = yesterday
    elif isinstance(date_spec, (list, tuple)) and len(date_spec) >= 2:
        start_date = date_spec[0]
        end_date = date_spec[1]
        if isinstance(start_date, str):
            try:
                start_date = datetime.datetime.strptime(start_date.strip()[:10], "%Y-%m-%d").date()
            except ValueError:
                start_date = yesterday
        if isinstance(end_date, str):
            try:
                end_date = datetime.datetime.strptime(end_date.strip()[:10], "%Y-%m-%d").date()
            except ValueError:
                end_date = yesterday
        if start_date > end_date:
            start_date, end_date = end_date, start_date
        start_date = start_date.strftime("%Y-%m-%d") if hasattr(start_date, "strftime") else to_str(start_date)
        end_date = end_date.strftime("%Y-%m-%d") if hasattr(end_date, "strftime") else to_str(end_date)
        return start_date, end_date
    elif isinstance(date_spec, (datetime.date, datetime.datetime)):
        d = date_spec.date() if isinstance(date_spec, datetime.datetime) else date_spec
        s = d.strftime("%Y-%m-%d")
        return s, s
    else:
        start_date = end_date = yesterday

    start_date = start_date.strftime("%Y-%m-%d") if hasattr(start_date, "strftime") else to_str(start_date)
    end_date = end_date.strftime("%Y-%m-%d") if hasattr(end_date, "strftime") else to_str(end_date)
    return start_date, end_date


def _nozzle_sales_build_tmt_expr(products: tuple, divisor: float, alias: str) -> str:
    """Build SQL expression for TMT: (SUM(sales_volume) FILTER / divisor) / 1000 / factor."""
    in_list = ", ".join(f"'{p}'" for p in products)
    return (
        f"ROUND(( (SUM(ns.sales_volume) FILTER (WHERE ns.product_grp IN ({in_list})) "
        f"/ {divisor}) / 1000.0 ) / {NOZZLE_SALES_VOLUME_FACTOR}, 2) AS {alias}"
    )


def _nozzle_sales_build_filter_conditions(filters):
    """
    Build SQL WHERE conditions from filters list.

    Each filter: {'key': 'sap_id', 'cond': '=', 'value': None, 'values': ['a', 'b']}.
    - value: single value (used with cond '=' or '!=').
    - values: multiple values (used with cond 'in' or 'not in').
    - cond: '=', '!=', 'in', 'not in'.

    Returns list of SQL condition strings (e.g. ["ns.sap_id IN ('a','b')"]).
    Column names are mapped to nozzle_sales (ns) or location_master (lm) columns; values are quoted as literals.
    """
    if not filters:
        return []
    conditions = []
    # Map filter key to (table_alias, column_name) for SQL
    key_to_col = {
        "sap_id": ("ns", "sap_id"),
        "zone": ("lm", "zone"),
        "state": ("lm", "state"),
        "sales_area": ("lm", "sales_area"),
    }
    for f in filters:
        if not isinstance(f, dict):
            continue
        key = (f.get("key") or "").strip().lower()
        cond = (f.get("cond") or "=").strip().lower()
        value = f.get("value")
        values = f.get("values")
        if key not in key_to_col:
            continue
        tbl, col = key_to_col[key]
        qual = f"{tbl}.{col}"
        if values is not None and (isinstance(values, (list, tuple)) and len(values) > 0):
            vals = [str(v).strip() for v in values if v is not None]
            if not vals:
                continue
            lit = ", ".join(f"'{v}'" for v in vals)
            if cond == "not in":
                conditions.append(f"{qual} NOT IN ({lit})")
            else:
                conditions.append(f"{qual} IN ({lit})")
        elif value is not None:
            lit = f"'{str(value).strip()}'"
            if cond == "!=":
                conditions.append(f"{qual} != {lit}")
            else:
                conditions.append(f"{qual} = {lit}")
    return conditions


async def nozzle_sales(
    segregation: str = "sales_area",
    ms_products: tuple = None,
    hsd_products: tuple = None,
    date_spec=None,
    filters=None,
    include_expected_sites: bool = True,
    reference_date=None,
):
    """
    Nozzle sales by segregation level (global, zone, sales_area, state, sap_id) with configurable MS/HSD products.

    Args:
        segregation: One of "global", "zone", "sales_area", "state", "sap_id". Default "sales_area".
        ms_products: Product groups for MS volume TMT. Default ("MS","POWER 99","POWER 95","POWER 100").
        hsd_products: Product groups for HSD volume TMT. Default ("HSD","TURBO").
        date_spec: Flexible date or range. Default None = yesterday (same as "1D").
            - None or 1 or "1D": single day = yesterday.
            - int (2, 7, 15, ...) or "2D", "7D", "15D", "30D": last N days ending yesterday (inclusive).
            - str "YYYY-MM-DD": single exact date.
            - (start, end) or [start, end]: date range; start/end as "YYYY-MM-DD" or date.
            - datetime.date: single exact date.
        filters: Optional list of filter dicts. Each: {'key': 'sap_id', 'cond': '=', 'value': None, 'values': ['a','b']}.
            - value: single value (use with cond '=' or '!=').
            - values: multiple values (use with cond 'in' or 'not in').
            - cond: '=', '!=', 'in', 'not in'.
            - key: 'sap_id', 'zone', 'state', 'sales_area'. When sap_id is selected, name is included in output for sap_id segregation.
        include_expected_sites: If True, attach expected site count per segment from location_master (RO). Default True.
        reference_date: Date used as "today" for relative specs (e.g. "1D", 7); default today.

    Returns:
        {"daily_zone_product_nozzle_sales": [{"transaction_date", "<segment_col>", "connected_sites", "MS_volume(TMT)", "HSD_volume(TMT)"[, "name"], ...]}.
        For segregation sap_id, each row includes "sap_id" and "name" (location name).
    """
    ms_products = ms_products if ms_products is not None else NOZZLE_SALES_MS_PRODUCTS_DEFAULT
    hsd_products = hsd_products if hsd_products is not None else NOZZLE_SALES_HSD_PRODUCTS_DEFAULT
    seg = segregation.strip().lower()
    if seg not in ("global", "zone", "sales_area", "state", "sap_id"):
        seg = "sales_area"

    filters = filters if filters is not None else []
    filter_conditions = _nozzle_sales_build_filter_conditions(filters)
    print("*"*40)
    print("filter_conditions ---->\n", filter_conditions)

    need_lm_for_filters = any("lm." in c for c in filter_conditions)
    extra_where = " AND ".join(filter_conditions) if filter_conditions else ""

    start_d, end_d = _nozzle_sales_parse_date_spec(date_spec, reference_date=reference_date)
    if start_d == end_d:
        date_filter = f"ns.transaction_date::DATE = '{start_d}'"
    else:
        date_filter = f"ns.transaction_date::DATE BETWEEN '{start_d}' AND '{end_d}'"
    where_parts = [date_filter]
    if extra_where:
        where_parts.append(extra_where)
    where_clause = " AND ".join(where_parts)
    print("*"*40)
    print("where clause ---->\n", where_clause)

    ms_expr = _nozzle_sales_build_tmt_expr(ms_products, NOZZLE_SALES_MS_DIVISOR, "ms_tmt")
    hsd_expr = _nozzle_sales_build_tmt_expr(hsd_products, NOZZLE_SALES_HSD_DIVISOR, "hsd_tmt")
    
    if seg == "global":
        join_lm = need_lm_for_filters
        from_join = "FROM public.nozzle_sales ns"
        if join_lm:
            from_join += " JOIN public.location_master lm ON ns.sap_id = lm.sap_id"
        nozzle_sales_query = f"""
            SELECT
                ns.transaction_date::DATE AS transaction_date,
                COUNT(DISTINCT ns.site_id) AS connected_sites,
                {ms_expr},
                {hsd_expr}
            {from_join}
            WHERE {where_clause}
            GROUP BY ns.transaction_date::DATE
            ORDER BY ns.transaction_date
        """
        group_cols = []
        dim_col = None
        print("*"*20)
        print("nozzle sales query global ---->\n", nozzle_sales_query)
    elif seg == "sap_id":
        dim_col = "sap_id"
        group_cols = ["sap_id", "name"]
        group_by_sap = "ns.sap_id, COALESCE(lm.name, lm.location_name)"
        nozzle_sales_query = f"""
            SELECT
                ns.transaction_date::DATE AS transaction_date,
                ns.sap_id AS sap_id,
                COALESCE(lm.name, lm.location_name) AS name,
                COUNT(DISTINCT ns.site_id) AS connected_sites,
                {ms_expr},
                {hsd_expr}
            FROM public.nozzle_sales ns
            JOIN public.location_master lm ON ns.sap_id = lm.sap_id
            WHERE {where_clause}
            GROUP BY ns.transaction_date::DATE, {group_by_sap}
            ORDER BY ns.transaction_date, ns.sap_id
        """
        group_by_lm = None
        print("*"*20)
        print("nozzle sale query sap id ---->\n", nozzle_sales_query)
    else:
        if seg == "state":
            dim_col = "state"
            group_by_lm = "lm.state"
            select_dim = "lm.state AS state"
        elif seg == "sales_area":
            dim_col = "sales_area"
            group_by_lm = "COALESCE(ns.sales_area, lm.sales_area)"
            select_dim = f"{group_by_lm} AS sales_area"
        else:
            dim_col = "zone"
            group_by_lm = "COALESCE(ns.zone, lm.zone)"
            select_dim = f"{group_by_lm} AS zone"

        group_cols = [dim_col]
        nozzle_sales_query = f"""
            SELECT
                ns.transaction_date::DATE AS transaction_date,
                {select_dim},
                COUNT(DISTINCT ns.site_id) AS connected_sites,
                {ms_expr},
                {hsd_expr}
            FROM public.nozzle_sales ns
            JOIN public.location_master lm ON ns.sap_id = lm.sap_id
            WHERE {where_clause}
            GROUP BY ns.transaction_date::DATE, {group_by_lm}
            ORDER BY ns.transaction_date::DATE, {group_by_lm}
        """
        print("*"*20)
        print("nozzle sales query else ---->\n",nozzle_sales_query)

    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = "execute_query"
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    rows = await function(query=nozzle_sales_query)
    nozzle_sales_df = pl.DataFrame(rows)
    print("&"*20)
    print("nozzle sales df --->\n",nozzle_sales_df)

    if dim_col and nozzle_sales_df.height > 0:
        nozzle_sales_df = nozzle_sales_df.filter(pl.col(dim_col).is_not_null())

    nozzle_sales_df = nozzle_sales_df.rename({
        "ms_tmt": "MS_volume(TMT)",
        "hsd_tmt": "HSD_volume(TMT)"
    })

    print("%"*20)
    print("nozzle sales df rename ---->\n ", nozzle_sales_df)

    if include_expected_sites and dim_col and dim_col != "sap_id":
        lm_query = f"""
            SELECT {dim_col}, COUNT(DISTINCT sap_id) AS expected_sites
            FROM location_master
            WHERE bu = 'RO' AND {dim_col} IS NOT NULL
            GROUP BY {dim_col}
        """
        try:
            lm_rows = await function(query=lm_query)
            expected_df = pl.DataFrame(lm_rows)
            if "expected_sites" in expected_df.columns:
                expected_df = expected_df.rename({"expected_sites": "connected_sites_right"})
            nozzle_sales_df = nozzle_sales_df.join(expected_df, on=dim_col, how="left")
            print("$"*20)
            print("nozzle_sales df if location mastet table--->\n", nozzle_sales_df)
        except Exception:
            nozzle_sales_df = nozzle_sales_df.with_columns(pl.lit(None).alias("connected_sites_right"))

    if dim_col and nozzle_sales_df.height > 0:
        sum_cols = ["connected_sites", "MS_volume(TMT)", "HSD_volume(TMT)"]
        total_select = [
            pl.lit(None).alias("transaction_date"),
            pl.lit("Total").alias(dim_col),
        ]
        if dim_col == "sap_id" and "name" in nozzle_sales_df.columns:
            total_select.append(pl.lit(None).alias("name"))
        total_select.extend([pl.sum(c).alias(c) for c in sum_cols if c in nozzle_sales_df.columns])
        if "connected_sites_right" in nozzle_sales_df.columns:
            total_select.append(pl.lit(None).alias("connected_sites_right"))
        total_row = nozzle_sales_df.select(total_select)
        nozzle_sales_df = pl.concat([nozzle_sales_df, total_row])
        print("8"*20)
        print("nozzle sales df finla concat---->\n", nozzle_sales_df)

    sort_cols = ["transaction_date"] + (group_cols if group_cols else [])
    print("*&"*10)
    print("sortcols --->\n", sort_cols)
    sort_cols = [c for c in sort_cols if c in nozzle_sales_df.columns]
    print("sort cols last --->\n ", sort_cols)
   # if sort_cols:
    #    nozzle_sales_df = nozzle_sales_df.sort(sort_cols)
    
    print("*"*40)
    print("nozzle sales df final---->\n", nozzle_sales_df)

    return {
        "daily_zone_product_nozzle_sales": nozzle_sales_df.to_dicts()
    }


async def sales_tmt_excel():
    """
    Generate Excel report comparing nozzle sales (TMT) with SAP sales (TMT) by state, including percentage and expected sites.
    
    This function:
    - Fetches daily nozzle sales data
    - Fetches month-to-date (MTD) nozzle and SAP sales data
    - Maps sales areas to states
    - Aggregates all data at state level
    - Calculates MTD percentage (Nozzle vs SAP)
    - Adds total row
    - Generates a formatted Excel file

    Output:
    - Excel file saved at: /tmp/primary_&_secondary_sales.xlsx

    Returns:
    - Dictionary with file path of the generated report
    
    """

    # daily sales data
    nozzle_sales_df = await nozzle_sales()
    nozzle_sales_df = pl.DataFrame(nozzle_sales_df["daily_zone_product_nozzle_sales"])
    nozzle_sales_df = nozzle_sales_df.filter(pl.col("sales_area") != "Total")

    location_master_query = f"""select distinct sales_area, state from location_master where bu ='RO' """
    location_master_details = await hpcl_ceg_model.LocationMaster.get_aggr_data(location_master_query, limit=0)
    location_master_df = pl.DataFrame(location_master_details['data'])

    merge_with_lm = nozzle_sales_df.join(location_master_df, on="sales_area", how="left")
    merge_with_lm = (merge_with_lm
        .group_by("state")
        .agg([
            pl.col("connected_sites").sum(),
            pl.col("MS_volume(TMT)").sum(),
            pl.col("HSD_volume(TMT)").sum(),
        ])
    )

    sales_details = pd.read_csv("/opt/ceg/algo/orchestrator/reporting_services/sarea_area_wise_connected_sites.csv")
    sales_details_df = pl.DataFrame(sales_details)

    merged_sales_location = sales_details_df.join(location_master_df, on="sales_area", how="left")
    merged_sales_location = (merged_sales_location
        .group_by("state")
        .agg([pl.col("outlets").sum().alias("total_sites")])
    )
   
    final_df = merge_with_lm.join(merged_sales_location,on ='state',how = "left")

    total_rows = final_df.select([
        pl.lit("Total").alias("state"),
        pl.sum("connected_sites"),
        pl.sum("MS_volume(TMT)"),
        pl.sum("HSD_volume(TMT)"),
        pl.sum("total_sites")
    ])
    final_data = pl.concat([final_df,total_rows])
    
    # monthly sales data
    start_of_month = datetime.date.today().replace(day=1)
    yesterday = datetime.date.today() - datetime.timedelta(days=1)

    nozzle_sales_monthly = await nozzle_sales(date_spec=(start_of_month, yesterday))

    nozzle_sales_monthly = pl.DataFrame(nozzle_sales_monthly["daily_zone_product_nozzle_sales"])
    nozzle_sales_monthly = nozzle_sales_monthly.filter(pl.col("sales_area") != "Total")

    nozzle_sales_monthly = (nozzle_sales_monthly
        .group_by("sales_area")
        .agg([
            pl.col("connected_sites").unique().max().alias("monthly_connected_sites"),
            pl.col("MS_volume(TMT)").sum().alias("monthly_MS_volume(TMT)"),
            pl.col("HSD_volume(TMT)").sum().alias("monthly_HSD_volume(TMT)"),
        ])
    )

    location_master_query = f"""select distinct sales_area, state from location_master where bu ='RO' """
    location_master_details = await hpcl_ceg_model.LocationMaster.get_aggr_data(location_master_query, limit=0)
    location_master_df = pl.DataFrame(location_master_details['data'])

    merge_with_lm_monthly = nozzle_sales_monthly.join(location_master_df, on="sales_area", how="left")
    

    sales_details = pd.read_csv("/opt/ceg/algo/orchestrator/reporting_services/sarea_area_wise_connected_sites.csv")
    sales_details_df = pl.DataFrame(sales_details)

    merged_sales_location = sales_details_df.join(location_master_df, on="sales_area", how="left")

    sap_sales_monthly = await sales_data.get_sales_tmt(date_filter= 'month')
    sap_sales_monthly = pl.DataFrame(sap_sales_monthly)
    sap_sales_monthly = sap_sales_monthly.filter(pl.col("sales_area") != "GRAND TOTAL")
    sap_sales_monthly = sap_sales_monthly.with_columns([
        pl.col("MS_SALES_TMT").fill_null(0),
        pl.col("HSD_SALES_TMT").fill_null(0)
    ])
    sap_sales_monthly = (
        sap_sales_monthly
        .group_by("sales_area")
        .agg([
            pl.col("MS_SALES_TMT").sum().alias("monthly_MS_SALES_TMT"),
            pl.col("HSD_SALES_TMT").sum().alias("monthly_HSD_SALES_TMT")
        ])
    )

    merged_data = sap_sales_monthly.join(location_master_df, on ="sales_area", how = "left")
    merge_with_lm_monthly = (merge_with_lm_monthly
        .group_by("state")
        .agg([
            pl.col("monthly_connected_sites").sum(),
            pl.col("monthly_MS_volume(TMT)").sum(),
            pl.col("monthly_HSD_volume(TMT)").sum(),
        ])
    )

    merged_sales_location = (merged_sales_location
        .group_by("state")
        .agg([pl.col("outlets").sum().alias("total_sites")])
    )

    merged_data = (merged_data
        .group_by("state")
        .agg([
            pl.col("monthly_MS_SALES_TMT").sum(),
            pl.col("monthly_HSD_SALES_TMT").sum()
        ])
    )

    final_data_monthly = merge_with_lm_monthly.join(merged_data,on ='state',how = "left")
    final_data_monthly = final_data_monthly.join(merged_sales_location, on="state", how="left")

    total_rows = final_data_monthly.select([
        pl.lit("Total").alias("state"),
        pl.sum("monthly_connected_sites"),
        pl.sum("monthly_MS_volume(TMT)"),
        pl.sum("monthly_HSD_volume(TMT)"),
        pl.sum("monthly_MS_SALES_TMT"),
        pl.sum("monthly_HSD_SALES_TMT"),
        pl.sum("total_sites")
    ])
    
    final_data_monthly = pl.concat([final_data_monthly,total_rows])

    final_data_monthly = final_data_monthly.with_columns([
        (100 * (pl.col("monthly_MS_volume(TMT)").cast(pl.Float64) / pl.col("monthly_MS_SALES_TMT").cast(pl.Float64)))
            .round(2).alias("monthly_MS_percentage"),

        (100 * (pl.col("monthly_HSD_volume(TMT)").cast(pl.Float64) / pl.col("monthly_HSD_SALES_TMT").cast(pl.Float64)))
            .round(2).alias("monthly_HSD_percentage")
    ])

    final_result = final_data.join(
        final_data_monthly,
        on="state",
        how="left"
    )

    excel_path = "/tmp/primary_&_secondary_sales.xlsx"
    workbook = xlsxwriter.Workbook(excel_path)
    worksheet = workbook.add_worksheet("Retail Sales")

    # -------------------- FORMATS --------------------
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


    # -------------------- HEADERS --------------------
    worksheet.merge_range("A1:A2", "State", header_format)
    worksheet.merge_range("B1:B2", "Total Sites", header_format)
    worksheet.merge_range("C1:C2", "Connected Sites", header_format)
    worksheet.merge_range("D1:E1", "Nozzle day sales (TMT)", header_format)
    worksheet.write("D2", "MS (all variants)", header_format)
    worksheet.write("E2", "HSD (all variants)", header_format)
    worksheet.merge_range("F1:G1", "Nozzle Cum. sales of the month (TMT)", header_format)
    worksheet.write("F2", "MS (all variants)", header_format)
    worksheet.write("G2", "HSD (all variants)", header_format)
    worksheet.merge_range("H1:I1", "SAP Cum. sales of the month (TMT)", header_format)
    worksheet.write("H2", "MS (all variants)", header_format)
    worksheet.write("I2", "HSD (all variants)", header_format)
    worksheet.merge_range("J1:K1", "% of Cum. Nozzle Sales", header_format)
    worksheet.write("J2", "MS (all variants)", header_format)
    worksheet.write("K2", "HSD (all variants)", header_format)


    # -------------------- DATA --------------------
    data_rows = final_result.to_dicts()

    row = 2
    for record in data_rows:
        worksheet.write(row, 0, record["state"], cell_format)
        worksheet.write(row, 1, record["total_sites"], cell_format)
        worksheet.write(row, 2, record["connected_sites"], cell_format)
        worksheet.write(row, 3, record["MS_volume(TMT)"], cell_format)
        worksheet.write(row, 4, record["HSD_volume(TMT)"], cell_format)
        worksheet.write(row, 5, record["monthly_MS_volume(TMT)"], cell_format)
        worksheet.write(row, 6, record["monthly_HSD_volume(TMT)"], cell_format)
        worksheet.write(row, 7, record["monthly_MS_SALES_TMT"], cell_format)
        worksheet.write(row, 8, record["monthly_HSD_SALES_TMT"], cell_format)
        worksheet.write(row, 9, record["monthly_MS_percentage"], cell_format)
        worksheet.write(row, 10, record["monthly_HSD_percentage"], cell_format)
        row += 1

    # -------------------- COLUMN WIDTH --------------------
    worksheet.set_column("A:A", 20)
    worksheet.set_column("B:B", 20)
    worksheet.set_column("C:C", 20)
    worksheet.set_column("D:E", 20)
    worksheet.set_column("F:G", 23)
    worksheet.set_column("H:I", 23)
    worksheet.set_column("J:K", 23)

    start_row = 2
    end_row = row - 1

    for col in ["J", "K"]:

        cell_range = f"{col}{start_row+1}:{col}{end_row+1}"

        # < 70 → Dark Red
        worksheet.conditional_format(cell_range, {
            "type": "cell",
            "criteria": "<",
            "value": 70,
            "format": workbook.add_format({"bg_color": "#c00000"})
        })

        # 70–80 → Orange
        worksheet.conditional_format(cell_range, {
            "type": "cell",
            "criteria": "between",
            "minimum": 70,
            "maximum": 80,
            "format": workbook.add_format({"bg_color": "#f1a470"})
        })

        # 80–90 → Light Orange
        worksheet.conditional_format(cell_range, {
            "type": "cell",
            "criteria": "between",
            "minimum": 80,
            "maximum": 90,
            "format": workbook.add_format({"bg_color": "#ef7d39"})
        })

        # > 90 → Dark Orange
        worksheet.conditional_format(cell_range, {
            "type": "cell",
            "criteria": ">",
            "value": 90,
            "format": workbook.add_format({"bg_color": "#d25704"})
        })
    
    legend_start_row = 2
    legend_col = "M"
    color_col = "N"
    legend_items = [
        ("< 70", "#c00000"),
        ("70–80", "#f1a470"),
        ("80–90", "#ef7d39"),
        ("> 90", "#d25704"),
    ]

    for i, (label, color) in enumerate(legend_items):
        worksheet.write(f"{legend_col}{legend_start_row + i}", label, cell_format)
        worksheet.write_blank(f"{color_col}{legend_start_row + i}", None, workbook.add_format({"bg_color": color}))
        
    workbook.close()

    print("Excel created at:", excel_path)
    return {"retail_sales_report": excel_path}
