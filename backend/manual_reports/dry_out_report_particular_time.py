import math

import urdhva_base
import os
import sys
import pytz
import json
import asyncio
import datetime
import numpy as np
import pandas as pd
import polars as pl
from dateutil.relativedelta import relativedelta

query_unique_alert = """
SELECT
    lm.zone AS "Zone",
    lm.region AS "Region",
    lm.sales_area AS "Sales Area",
    lm.sap_id AS "Location ID",
    lm.name AS "Location Name",
    e.id as "Alert ID",
    e.alert_history,
    e.indent_no as "Indent No",
    e.closed_at as "Closed At",
    e.updated_at as "Updated At",

    -- Dryout Start Time: latest of created_at or dry_out_start_time
    e.dry_out_start_time AS "Dryout Start Time",

    -- Dryout End Time: only for closed alerts
    e.dry_out_end_time as "Dryout End Time",

    e.product_code AS "Product Code",

    CASE e.product_code
        WHEN '2811000' THEN 'MS'
        WHEN '2812000' THEN 'HSD'
        WHEN '3912000' THEN 'TURBO'
        WHEN '2822000' THEN 'E20'
        WHEN '3672000' THEN 'POWER 95'
        WHEN '2816000' THEN 'POWER 99'
        WHEN '3373000' THEN 'POWER 100'
        ELSE e.product_code
    END AS "Product Name"

FROM (
    SELECT
        sap_id,
        id,
        product_code,
        indent_status,
        indent_no,
        alert_history,
        indent_raised_date,
        created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS created_at,
        closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS closed_at,
        updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS updated_at,
        dry_out_start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS dry_out_start_time,
        dry_out_end_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS dry_out_end_time,
        alert_status
    FROM alerts
    WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow'
      AND bu = 'RO'
      AND product_code IN ('2811000', '2812000', '2822000')
      AND dry_out_in_days = '1'
      -- Interval starts before or at timestamp
      AND dry_out_start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'
            <= '{end_date}'

      -- Interval ends after timestamp OR has no end
      AND (
           COALESCE(dry_out_end_time, closed_at, updated_at) IS NULL
           OR COALESCE(dry_out_end_time, closed_at, updated_at) >= '{start_date}'
      )
) AS e

JOIN location_master lm
    ON e.sap_id = lm.sap_id

GROUP BY
    lm.zone,
    lm.region,
    lm.sales_area,
    lm.sap_id,
    lm.name,
    e.id,
    e.alert_history,
    e.alert_status,
    e.indent_raised_date,
    e.dry_out_start_time,
    e.dry_out_end_time,
    e.indent_status,
    e.indent_no,
    e.product_code,
    e.created_at,
    e.updated_at,
    e.closed_at
ORDER BY
    lm.zone,
    lm.region,
    lm.sales_area,
    lm.sap_id,
    e.product_code,
    e.dry_out_start_time,
    e.dry_out_end_time,
    e.indent_raised_date,
"""

'''
you can include cancel_time, user_cancel, indent_hold_release_time, indent_delivery_date, Indent_executed_datetime

indent_delivery_date - action_msg: Indent Delivered, processed_time
indent_hold_release_time - action_msg: Indent On Hold Released, processed_time
cancel_time - action_msg: Indent Cancelled, processed_time
'''

mapping = {"Indent Delivered": {"action_msg": "Indent Delivered", "time": "processed_time"},
           "Indent On Hold Released": {"action_msg": "Indent On Hold Released",
                                       "time": "ims_datetime"},
           "Indent Cancelled": {"action_msg": "Indent Cancelled", "time": "processed_time"}}


def get_column_data(record, key):
    if key not in mapping:
        return None

    mpa_data = mapping[key]

    # Parse string to JSON if needed
    if isinstance(record, str):
        try:
            record = json.loads(record)
        except json.JSONDecodeError:
            return None
    if not isinstance(record, list):
        return None
    for rec in record:
        if rec.get("action_msg") == mpa_data.get("action_msg"):
            ts = rec.get(mpa_data.get("time"))
            if not ts:
                return None
            try:
                if mpa_data['time'] == 'ims_datetime':
                    return datetime.datetime.fromisoformat(ts).replace(tzinfo=None)
                # Parse timestamp safely
                utc_time = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
                if utc_time.tzinfo is None:
                    # Assume UTC if timezone missing
                    utc_time = utc_time.replace(tzinfo=pytz.UTC)

                # Convert UTC → IST
                ist_time = utc_time.astimezone(pytz.timezone("Asia/Kolkata"))
                # Return timezone-naive datetime (Excel safe)
                return ist_time.replace(tzinfo=None)
            except Exception as e:
                print(f"Time parse error for {ts}: {e}")
                return None

    return None


async def fetch_dry_out_report(timeperiod):
    if not os.path.exists('/home/novex/dry_out_report'):
        os.makedirs('/home/novex/dry_out_report')
    start_date = timeperiod
    end_date = start_date
    records = []
    # Get the first day of the next month
    query_rebuilt = query_unique_alert.format(start_date=str(start_date),
                                              end_date=str(end_date))
    print(f"QUERY {query_rebuilt}")
    resp = await urdhva_base.postgresmodel.BasePostgresModel.get_aggr_data(query_rebuilt,
                                                                           limit=1000000)
    print(resp['total'])
    if len(resp['data']) > 0:
        records.extend(resp['data'])
    # df = pd.DataFrame(resp['data'])
    # df.to_excel(f'/home/novex/dry_out_report/dry_out_report_{month_start.month}-{month_start.day}_{month_end.month}-{month_end.day}.xlsx', index=False)
    index = 1
    step = 1000000
    for rec_start in range(0, len(records), step):
        df = pl.DataFrame(records[rec_start:rec_start + step])
        # Generate computed columns from alert_history using mapping
        for key in mapping:
            df = df.with_columns(
                pl.Series(
                    name=key,
                    values=[get_column_data(x, key) for x in df["alert_history"].to_list()]
                )
            )

        # Drop alert_history column
        df = df.drop("alert_history")

        # # Indent Cancelled = None if Indent No is empty else keep as is
        # df = df.with_columns(
        #     pl.when(pl.col("Indent No").is_null() | (pl.col("Indent No") == ""))
        #     .then(None)
        #     .otherwise(pl.col("Indent Cancelled"))
        #     .alias("Indent Cancelled")
        # )
        #
        # # Indent Cancelled = None if Indent No is empty else keep as is
        # df = df.with_columns(
        #     pl.when(pl.col("Indent No").is_null() | (pl.col("Indent No") == ""))
        #     .then(None)
        #     .otherwise(pl.col("Indent Delivered"))
        #     .alias("Indent Delivered")
        # )
        #
        # # If Indent Status == 'Cancelled' and Indent Cancelled is null, use Dryout End Time
        # df = df.with_columns(
        #     pl.when(
        #         (pl.col("Indent Status") == "Cancelled") & (pl.col("Indent Cancelled").is_null())
        #     )
        #     .then(pl.col("Dryout End Time"))
        #     .otherwise(pl.col("Indent Cancelled"))
        #     .alias("Indent Cancelled")
        # )
        #
        # df = df.with_columns(
        #     pl.when(((pl.col("Indent No").is_null()) | (pl.col("Indent No") == "")))
        #     .then(pl.lit(None))
        #     .otherwise(pl.col("Indent Raised Date"))
        #     .alias("Indent Raised Date")
        # )
        #
        # df = df.with_columns(
        #     pl.when(((pl.col("Indent No").is_null()) | (pl.col("Indent No") == "")))
        #     .then(pl.lit(None))
        #     .otherwise(pl.col("Indent On Hold Released"))
        #     .alias("Indent On Hold Released")
        # )
        #
        # df = df.with_columns(
        #     pl.when(
        #         (pl.col("Indent Raised") == True) & ((pl.col("Indent No").is_null()) | (pl.col("Indent No") == ""))
        #     )
        #     .then(pl.lit(None))
        #     .otherwise(pl.col("Indent Raised"))
        #     .alias("Indent Raised")
        # )
        #
        # # Incase if Indent Status was delivered and Indent No was empty,
        # # Marking Indent Status as IndentNotRaised and Closure Status as FalseAlarm
        # df = df.with_columns([
        #     pl.when(
        #         (pl.col("Indent Status") == "Completed") &
        #         ((pl.col("Indent No").is_null()) | (pl.col("Indent No") == ""))
        #     )
        #     .then(pl.lit("NotAvailable"))  # ✅ Use pl.lit() for static strings
        #     .otherwise(pl.col("Indent Status"))
        #     .alias("Indent Status"),
        #
        #     pl.when(
        #         (pl.col("Indent Status") == "Completed") &
        #         ((pl.col("Indent No").is_null()) | (pl.col("Indent No") == ""))
        #     )
        #     .then(pl.lit("False Alarm"))  # ✅ Use pl.lit() for static strings
        #     .otherwise(pl.col("Closure Status"))
        #     .alias("Closure Status")
        # ])

        # active = df.filter(pl.col("Indent Status") != "Cancelled")
        #
        # # 1️⃣ Split the data
        # cancelled = (
        #     df.filter(pl.col("Indent Status") == "Cancelled")
        #     .select([
        #         pl.col("Location ID"),
        #         pl.col("Product Code"),
        #         pl.col("Dryout End Time").alias("cancel_end"),
        #         pl.col("Dryout Start Time").alias("cancel_sync")
        #     ])
        # )
        #
        # # 2️⃣ Join cancelled → active by matching keys
        # joined = (
        #     active.join(
        #         cancelled,
        #         on=["Location ID", "Product Code"],
        #         how="left"
        #     )
        #     # 3️⃣ Filter rows where dryout start within 2 hours after cancelled end
        #     .with_columns([
        #         (pl.col("cancel_end") + pl.duration(hours=2)).alias("cancel_end_plus_2h")
        #     ])
        #     .filter(pl.col("Dryout Start Time") <= pl.col("cancel_end_plus_2h"))
        # )
        #
        # # 4️⃣ Update Dryout Start Time from matching cancelled record
        # updated = joined.with_columns([
        #     pl.when(pl.col("cancel_sync").is_not_null())
        #     .then(pl.col("cancel_sync"))
        #     .otherwise(pl.col("Dryout Start Time"))
        #     .alias("Dryout Start Time")
        # ])
        #
        # # 5️⃣ Keep columns consistent with original
        # updated = updated.select(df.columns)
        #
        # # 6️⃣ Combine back with untouched cancelled rows
        # df_final = pl.concat([
        #     df.filter(pl.col("Indent Status") == "Cancelled"),
        #     updated
        # ])

        df_final = df.unique(subset=['Alert ID'])

        # df_final = df_final.with_columns(
        #     pl.when(pl.col("Indent Status") == "Cancelled")
        #     .then(None)
        #     .otherwise(pl.col("Dryout End Time"))
        #     .alias("Dryout End Time")
        # )

        # Save to Excel
        output_path = f"/home/novex/dry_out_report/dry_out_report_{index}.xlsx"
        df_final.write_excel(output_path)
        index += 1


if __name__ == "__main__":
    if len(sys.argv) == 1:
        print("Usage: python manual_report_participular_time.py <dry_out_report_path>")
        sys.exit(1)
    asyncio.run(fetch_dry_out_report(sys.argv[1]))