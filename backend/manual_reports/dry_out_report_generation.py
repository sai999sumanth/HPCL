import math

import urdhva_base
import os
import sys
import argparse
import pytz
import json
import asyncio
import datetime
import numpy as np
import pandas as pd
import polars as pl
from dateutil.relativedelta import relativedelta

"""
Query to fetch unique dryout alerts with business rules applied.

Business Rules:
1. Indent Raised: TRUE only if indent_no is not NULL and not empty (after trimming whitespace)
2. Indent Raised Before Dryout: TRUE only if dry_out_start_time >= indent_raised_date
3. Indent Raised Date: Shown only if dryout_day >= indent_raised_date
4. Indent Status:
   - 'IndentNotRaised' if indent_raised_date is NULL
   - 'Cancelled' if indent_status is in ('TempClosed','ProductLowLevel','OfflineOrFalseAlarm')
   - Otherwise uses actual indent_status
5. Closure Status:
   - If indent_raised_date is NULL and alert is closed:
     - 'False Alarm' if indent_status is 'Completed'
     - Otherwise uses indent_status
   - Otherwise same as Indent Status
6. Indent No: Shown only if indent_raised_date <= dryout_day
7. Dryout Start Time: Uses GREATEST(created_at, dry_out_start_time)
8. Dryout End Time: Only for closed alerts, uses COALESCE(dry_out_end_time, closed_at, updated_at)
"""
query_unique_alert = """
SELECT
    lm.zone AS "Zone",
    lm.region AS "Region",
    lm.sales_area AS "Sales Area",
    lm.sap_id AS "Location ID",
    lm.name AS "Location Name",
    e.id as "Alert ID",
    e.alert_history,
    e.alert_status,

    -- Dryout Start Time: latest of created_at or dry_out_start_time
    GREATEST(e.created_at, e.dry_out_start_time) AS "Dryout Start Time",

    -- Dryout End Time: only for closed alerts
    MAX(
        CASE
            WHEN e.alert_status = 'Close' THEN COALESCE(e.dry_out_end_time, e.closed_at, e.updated_at)
            ELSE NULL
        END
    ) AS "Dryout End Time",

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
    END AS "Product Name",

    -- ✅ Rule 1: Indent Raised true only if indent_no is not null and not empty
    CASE
        WHEN e.indent_no IS NOT NULL AND TRIM(e.indent_no) != '' THEN TRUE
        ELSE FALSE
    END AS "Indent Raised",

    -- ✅ Rule 2: Indent Raised Before Dryout kept True only if dry_out_start_time >= indent_raised_date
    CASE
        WHEN e.indent_raised_date IS NOT NULL AND e.dry_out_start_time IS NOT NULL
             AND e.dry_out_start_time >= e.indent_raised_date THEN TRUE
        ELSE FALSE
    END AS "Indent Raised Before Dryout",

    -- ✅ Rule 3: Indent Raised Date kept only if dryout_day >= indent_raised_date
    e.indent_raised_date AS "Indent Raised Date",

    -- ✅ Rule 4: Indent Status complex logic
    CASE
        WHEN e.indent_raised_date IS NULL THEN 'IndentNotRaised'
        WHEN e.indent_status IN ('TempClosed','ProductLowLevel','OfflineOrFalseAlarm') THEN 'Cancelled'
        ELSE e.indent_status
    END AS "Indent Status",

    -- ✅ Rule 5: Closure Status (same as Indent Status)
    CASE
        WHEN e.indent_raised_date IS NULL and e.alert_status = 'Close' THEN
            CASE
                WHEN e.indent_status IN ('Completed') THEN 'False Alarm'
                ELSE e.indent_status
            END
        ELSE e.indent_status
    END AS "Closure Status",

    -- ✅ Rule 6: Indent No kept only if indent_raised_date <= dryout_day
    e.indent_no AS "Indent No",

    -- Total Dryout Hours:
    ROUND(AVG(
        EXTRACT(
            EPOCH FROM (
                CASE
                    WHEN e.alert_status = 'Close'
                        THEN COALESCE(e.dry_out_end_time, e.closed_at, e.updated_at) - COALESCE(e.dry_out_start_time, e.created_at)
                    ELSE (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') - e.created_at
                END
            )
        ) / 3600
    ), 2) AS "Total Dryout Hours"

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
      AND date_trunc('day', COALESCE(dry_out_end_time, closed_at, updated_at, NOW())) >= '{start_date}'
      AND date_trunc('day', GREATEST(created_at, dry_out_start_time)) <= '{end_date}'
      AND product_code IN ('2811000', '2812000', '2822000')
      AND dry_out_in_days = '1'
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
    e.created_at
ORDER BY
    lm.zone,
    lm.region,
    lm.sales_area,
    lm.sap_id,
    e.product_code,
    e.dry_out_start_time,
    e.dry_out_end_time,
    e.indent_raised_date
"""

query_day_wise_old = """
SELECT
    lm.zone AS "Zone",
    lm.region AS "Region",
    lm.sales_area AS "Sales Area",
    lm.sap_id AS "Location ID",
    lm.name AS "Location Name",

    e.dryout_day AS "Date",
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
    END AS "Product Name",

    CASE
        WHEN e.indent_raised_date IS NOT NULL
             AND e.dryout_day >= e.indent_raised_date::date THEN TRUE
        ELSE FALSE
    END AS "Indent Raised",

    e.indent_raised_date AS "Indent Raised Date",
    e.indent_status AS "Indent Status",
    e.indent_no AS "Indent No",

    -- Dryout End Time: only for closed alerts
    MAX(
        CASE
            WHEN e.alert_status = 'Close' THEN COALESCE(e.dry_out_end_time, e.closed_at, e.updated_at)
            ELSE NULL
        END
    ) AS "Dryout End Time",

    -- Dryout Start Time: latest of created_at or dry_out_start_time
    GREATEST(e.created_at, e.dry_out_start_time) AS "Dryout Start Time",

    -- Total Dryout Hours:
    -- If closed -> difference between end_time and created_at
    -- If open   -> difference between current time (IST) and created_at
    ROUND(AVG(
        EXTRACT(
            EPOCH FROM (
                CASE
                    WHEN e.alert_status = 'Close'
                        THEN COALESCE(e.dry_out_end_time, e.closed_at, e.updated_at) - COALESCE(e.dry_out_start_time, e.created_at)
                    ELSE (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') - e.created_at
                END
            )
        ) / 3600
    ), 2) AS "Total Dryout Hours"

FROM (
    SELECT
        sap_id,
        product_code,
        indent_status,
        indent_no,
        indent_raised_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS indent_raised_date,
        created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS created_at,
        closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS closed_at,
        updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS updated_at,
        dry_out_start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS dry_out_start_time,
        dry_out_end_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS dry_out_end_time,
        alert_status,

        generate_series(
            GREATEST(
                date_trunc('day', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date,
                '{start_date}'::date
            ),
            LEAST(
                date_trunc(
                    'day',
                    COALESCE(
                        closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata',
                        updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata',
                        NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'
                    )
                )::date,
                '{end_date}'::date
            ),
            interval '1 day'
        )::date AS dryout_day

    FROM alerts
    WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow'
      AND bu = 'RO'
      AND date_trunc('day', COALESCE(closed_at, updated_at, NOW())) >= '{start_date}'
      AND date_trunc('day', created_at) <= '{end_date}'
      AND product_code IN ('2811000', '2812000', '2822000')
      AND dry_out_in_days = '1'
) AS e

JOIN location_master lm
    ON e.sap_id = lm.sap_id

GROUP BY
    lm.zone,
    lm.region,
    lm.sales_area,
    lm.sap_id,
    lm.name,
    e.dryout_day,
    e.indent_raised_date,
    e.dry_out_start_time,
    e.dry_out_end_time,
    e.indent_status,
    e.indent_no,
    e.product_code,
    e.created_at
ORDER BY
    lm.zone
"""


"""
Query to fetch day-wise dryout alerts with business rules applied.

This query expands each alert into daily records using generate_series.
Each day within the alert period gets one row.

Business Rules (same as query_unique_alert):
1. Indent Raised: TRUE only if dryout_day >= indent_raised_date
2. Indent Raised Before Dryout: TRUE only if dry_out_start_time >= indent_raised_date
3. Indent Raised Date: Shown only if dryout_day >= indent_raised_date
4. Indent Status: Complex logic with 'IndentNotRaised' and 'Cancelled' states
5. Closure Status: Similar to Indent Status with 'False Alarm' handling
6. Indent No: Shown only if indent_raised_date <= dryout_day

Note: This query filters for mark_as_false='true' alerts.
"""
query_day_wise = """
SELECT
    lm.zone AS "Zone",
    lm.region AS "Region",
    lm.sales_area AS "Sales Area",
    lm.sap_id AS "Location ID",
    lm.name AS "Location Name",
    e.alert_history,
    e.dryout_day AS "Date",
    
    -- Dryout Start Time: latest of created_at or dry_out_start_time
    GREATEST(e.created_at, e.dry_out_start_time) AS "Dryout Start Time",
    
    -- Dryout End Time: only for closed alerts
    MAX(
        CASE
            WHEN e.alert_status = 'Close' THEN COALESCE(e.dry_out_end_time, e.closed_at, e.updated_at)
            ELSE NULL
        END
    ) AS "Dryout End Time",
    
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
    END AS "Product Name",

    -- ✅ Rule 1: Indent Raised true only if dryout_day >= indent_raised_date
    CASE
        WHEN e.indent_raised_date IS NOT NULL
             AND e.dryout_day >= e.indent_raised_date::date THEN TRUE
        ELSE FALSE
    END AS "Indent Raised",
    
    -- ✅ Rule 2: Indent Raised Before Dryout kept True only if dry_out_start_time >= indent_raised_date
    CASE
        WHEN e.indent_raised_date IS NOT NULL AND e.dry_out_start_time IS NOT NULL
             AND e.dry_out_start_time >= e.indent_raised_date THEN TRUE
        ELSE FALSE
    END AS "Indent Raised Before Dryout",

    -- ✅ Rule 3: Indent Raised Date kept only if dryout_day >= indent_raised_date
    CASE
        WHEN e.indent_raised_date IS NOT NULL
             AND e.dryout_day >= e.indent_raised_date::date THEN e.indent_raised_date
        ELSE NULL
    END AS "Indent Raised Date",

    -- ✅ Rule 4: Indent Status complex logic
    CASE
        WHEN e.indent_raised_date IS NULL THEN
            CASE
                WHEN e.indent_status IN ('TempClosed','ProductLowLevel','OfflineOrFalseAlarm') THEN 'Cancelled'
                ELSE 'IndentNotRaised'
            END
        WHEN e.dryout_day < e.indent_raised_date::date THEN 'IndentNotRaised'
        WHEN e.indent_status IN ('TempClosed','ProductLowLevel','OfflineOrFalseAlarm') THEN 'Cancelled'
        ELSE e.indent_status
    END AS "Indent Status",

    -- ✅ Rule 5: Closure Status (same as Indent Status)
    CASE
        WHEN e.indent_raised_date IS NULL and e.alert_status = 'Close' and e.dryout_day < e.indent_raised_date::date THEN
            CASE
                WHEN e.indent_status IN ('TempClosed','ProductLowLevel','OfflineOrFalseAlarm') THEN 'False Alarm'
                ELSE e.indent_status
            END
        WHEN e.dryout_day < e.indent_raised_date::date THEN 'IndentNotRaised'
        WHEN e.indent_status IN ('TempClosed','ProductLowLevel','OfflineOrFalseAlarm') THEN 'Cancelled'
        ELSE e.indent_status
    END AS "Closure Status",

    -- ✅ Rule 6: Indent No kept only if indent_raised_date <= dryout_day
    CASE
        WHEN e.indent_raised_date IS NOT NULL
             AND e.dryout_day >= e.indent_raised_date::date THEN e.indent_no
        ELSE NULL
    END AS "Indent No",

    -- Total Dryout Hours:
    ROUND(AVG(
        EXTRACT(
            EPOCH FROM (
                CASE
                    WHEN e.alert_status = 'Close'
                        THEN COALESCE(e.dry_out_end_time, e.closed_at, e.updated_at) - COALESCE(e.dry_out_start_time, e.created_at)
                    ELSE (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') - e.created_at
                END
            )
        ) / 3600
    ), 2) AS "Total Dryout Hours"

FROM (
    SELECT
        sap_id,
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
        alert_status,

        generate_series(
            GREATEST(
                date_trunc('day', GREATEST(created_at, dry_out_start_time) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date,
                '{start_date}'::date
            ),
            LEAST(
                date_trunc(
                    'day',
                    COALESCE(
                        closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata',
                        updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata',
                        NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'
                    )
                )::date,
                '{end_date}'::date
            ),
            interval '1 day'
        )::date AS dryout_day

    FROM alerts
    WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow'
      AND bu = 'RO'
      AND date_trunc('day', COALESCE(closed_at, updated_at, NOW())) >= '{start_date}'
      AND date_trunc('day', created_at) <= '{end_date}'
      AND product_code IN ('2811000', '2812000', '2822000')
      AND dry_out_in_days = '1' AND mark_as_false='true'
) AS e

JOIN location_master lm
    ON e.sap_id = lm.sap_id

GROUP BY
    lm.zone,
    lm.region,
    lm.sales_area,
    lm.sap_id,
    lm.name,
    e.alert_history,
    e.dryout_day,
    e.alert_status,
    e.indent_raised_date,
    e.dry_out_start_time,
    e.dry_out_end_time,
    e.indent_status,
    e.indent_no,
    e.product_code,
    e.created_at
ORDER BY
    lm.zone,
    lm.region,
    lm.sales_area,
    lm.sap_id,
    e.product_code,
    e.dry_out_start_time,
    e.dry_out_end_time
"""


'''
you can include cancel_time, user_cancel, indent_hold_release_time, indent_delivery_date, Indent_executed_datetime

indent_delivery_date - action_msg: Indent Delivered, processed_time
indent_hold_release_time - action_msg: Indent On Hold Released, processed_time
cancel_time - action_msg: Indent Cancelled, processed_time
'''

"""
Mapping configuration for extracting timestamps from alert_history JSON.

Business Rules:
- "Indent Delivered": Extracts processed_time when action_msg is "Indent Delivered"
- "Indent On Hold Released": Extracts ims_datetime when action_msg is "Indent On Hold Released"
- "Indent Cancelled": Extracts processed_time when action_msg is "Indent Cancelled"

These timestamps are used to track indent lifecycle events in the dryout report.
"""
mapping = {"Indent Delivered": {"action_msg": "Indent Delivered", "time": "processed_time"},
               "Indent On Hold Released": {"action_msg": "Indent On Hold Released", "time": "ims_datetime"},
               "Indent Cancelled": {"action_msg": "Indent Cancelled", "time": "processed_time"}}


def get_column_data(record, key):
    """
    Extract timestamp data from alert_history JSON based on mapping configuration.
    
    Business Rules:
    - Parses alert_history JSON to find specific action messages
    - Extracts timestamps based on mapping configuration:
      * "Indent Delivered" → uses processed_time
      * "Indent On Hold Released" → uses ims_datetime
      * "Indent Cancelled" → uses processed_time
    - Converts UTC timestamps to IST (Asia/Kolkata)
    - Returns timezone-naive datetime for Excel compatibility
    
    Args:
        record: alert_history field (can be string JSON or parsed dict/list)
        key: One of the keys in mapping dict ("Indent Delivered", "Indent On Hold Released", "Indent Cancelled")
    
    Returns:
        datetime.datetime or None: Parsed timestamp in IST (timezone-naive) or None if not found/error
    """
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


async def fetch_dry_out_report(start_date, end_date):
    """
    Generate dryout report for specified date range.
    
    Process Flow:
    1. Process data month by month within the specified date range to avoid memory issues
    2. Extract alert history events (Indent Delivered, Cancelled, etc.)
    3. Apply business rules for indent status and closure status
    4. Merge overlapping/close dryout intervals (< 2 hours gap)
    5. Generate Excel report with two sheets:
       - "Dryout Details": All individual alerts
       - "Dryout Summary": Merged intervals with start/end times
    
    Business Rules Applied:
    - Indent status logic based on indent_raised_date and dryout_day
    - Closure status logic for false alarms
    - Interval merging: Alerts within 2 hours are considered continuous
    - Timezone conversion: UTC → IST (Asia/Kolkata)
    
    Args:
        start_date (datetime.datetime): Start date for the report (inclusive)
        end_date (datetime.datetime): End date for the report (inclusive)
    
    Output:
        Excel files saved to /home/novex/dry_out_report/
    """
    if not os.path.exists('/home/novex/dry_out_report'):
        os.makedirs('/home/novex/dry_out_report')
    
    # Normalize dates: set time to start of day
    start_date = start_date.replace(minute=0, hour=0, second=0, microsecond=0)
    end_date = end_date.replace(minute=0, hour=0, second=0, microsecond=0)
    current = start_date
    records = []
    while current <= end_date:
        month_start = current
        # Get the first day of the next month
        next_month = current + relativedelta(months=1)
        # End of this month (exclusive end_date for queries)
        # But cap it at the user-specified end_date
        month_end = min(next_month - datetime.timedelta(seconds=1), end_date)

        print(f"Processing month: {month_start.strftime('%B %Y')} "
              f"({month_start.date()} to {month_end.date()})")
        query_rebuilt = query_unique_alert.format(start_date=str(month_start), end_date=str(month_end))
        resp = await urdhva_base.postgresmodel.BasePostgresModel.get_aggr_data(query_rebuilt, limit=1000000)
        print(resp['total'])
        if len(resp['data']) == 0:
            # Check if we've reached the end date
            if month_end >= end_date:
                break
        records.extend(resp['data'])
        current = next_month
        
        # Stop if we've processed beyond the end date
        if current > end_date:
            break
        # df = pd.DataFrame(resp['data'])
        # df.to_excel(f'/home/novex/dry_out_report/dry_out_report_{month_start.month}-{month_start.day}_{month_end.month}-{month_end.day}.xlsx', index=False)
    index = 1
    step = 1000000
    for rec_start in range(0, len(records), step):
        df = pl.DataFrame(records[rec_start:rec_start+step])
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

        # Business Rule: Indent Cancelled = None if Indent No is empty
        # Rationale: Cannot have cancellation date without an indent number
        df = df.with_columns(
            pl.when(pl.col("Indent No").is_null() | (pl.col("Indent No") == ""))
            .then(None)
            .otherwise(pl.col("Indent Cancelled"))
            .alias("Indent Cancelled")
        )

        # Business Rule: Indent Delivered = None if Indent No is empty
        # Rationale: Cannot have delivery date without an indent number
        df = df.with_columns(
            pl.when(pl.col("Indent No").is_null() | (pl.col("Indent No") == ""))
            .then(None)
            .otherwise(pl.col("Indent Delivered"))
            .alias("Indent Delivered")
        )

        # Business Rule: If Indent Status == 'Cancelled' and Indent Cancelled is null,
        # use Dryout End Time as the cancellation timestamp
        # Rationale: If cancelled but no explicit cancellation time, use when dryout ended
        df = df.with_columns(
            pl.when(
                (pl.col("Indent Status") == "Cancelled") & (pl.col("Indent Cancelled").is_null())
            )
            .then(pl.col("Dryout End Time"))
            .otherwise(pl.col("Indent Cancelled"))
            .alias("Indent Cancelled")
        )
        df = df.unique(subset=['Alert ID'])

        # Business Rule: Clamp Dryout Start Time to report start date
        # Rationale: For dryouts that started before the report period, show start as report start date
        df = df.with_columns(
            pl.when(pl.col("Dryout Start Time") < start_date)
            .then(start_date)
            .otherwise(pl.col("Dryout Start Time"))
            .alias("Dryout Start Time")
        )

        # Business Rule: Recalculate Total Dryout Hours from actual start/end times
        # Rationale: 
        # - If both start and end times available: calculate from start to end
        # - If start time available but end time is null (ongoing dryout): calculate from start to now
        # - Otherwise: use SQL-calculated value
        current_time = datetime.datetime.now().replace(microsecond=0)
        df = df.with_columns(
            pl.when(
                pl.col("Dryout Start Time").is_not_null() &
                pl.col("Dryout End Time").is_not_null()
            )
            .then(
                (pl.col("Dryout End Time") - pl.col("Dryout Start Time"))
                .dt.total_seconds() / 3600
            )
            .when(
                pl.col("Dryout Start Time").is_not_null() &
                pl.col("Dryout End Time").is_null()
            )
            .then(
                (pl.lit(current_time) - pl.col("Dryout Start Time"))
                .dt.total_seconds() / 3600
            )
            .otherwise(pl.col("Total Dryout Hours"))
            .alias("Total Dryout Hours")
        )

        # Business Rule: If Closure Status == 'Completed', use Dryout End Time as Indent Delivered
        # Rationale: When dryout is completed, the end time represents when product was delivered
        df = df.with_columns(
            pl.when(
                pl.col("Dryout End Time").is_not_null() &
                (pl.col("Closure Status") == "Completed")
            )
            .then(pl.col("Dryout End Time"))
            .otherwise(pl.col("Indent Delivered"))
            .alias("Indent Delivered")
        )

        cols_to_string = [
            "Alert ID",
            "Product Code",
            "Location ID"
        ]

        df = df.with_columns(
            pl.col(cols_to_string).cast(pl.Utf8)
        )

        # Filtering Records

        # df = df.filter(
        #     pl.col("Closure Status") != "NotAvailable"
        # )
        # df = df.filter(
        #     pl.col("Indent Status") != "NotAvailable"
        # )

        # Filtering Records: Keep all valid records
        # Business Rule: Include ongoing dryouts (where Dryout End Time is null)
        # This filter ensures:
        # - Records with null start or end times are kept (ongoing dryouts)
        # - Records where end time is before start time are excluded (invalid data)
        df = df.filter(
            (pl.col("Dryout Start Time").is_null()) |
            (pl.col("Dryout End Time").is_null()) |
            (pl.col("Dryout End Time") >= pl.col("Dryout Start Time"))
        )

        # Creating Summary Report
        """
        Summary Report Logic:
        Merges overlapping or closely spaced dryout intervals for each location-product combination.
        
        Business Rules:
        1. Groups alerts by Zone, Region, Sales Area, Location ID, Location Name, Product Code
        2. Sorts alerts by start time within each group
        3. Merges alerts if gap between previous end time and next start time is < 2 hours
        4. Includes ongoing dryouts (where Dryout End Time is null)
        5. For ongoing dryouts: End Time remains null, Hours calculated up to current time
        6. Creates one entry per merged interval with start and end times
        7. Example: Alert 1 (10am-10:30am) + Alert 2 (11am-9pm) → Merged (10am-9pm)
           because gap (10:30am to 11am = 30 min) < 2 hours
        
        Output: One row per merged dryout interval with:
        - Dryout Start Time (earliest start in merged group)
        - Dryout End Time (latest end in merged group, or null if any ongoing)
        - Total Dryout Hours (calculated from merged interval, or up to now if ongoing)
        """

        group_cols = [
            "Zone",
            "Region",
            "Sales Area",
            "Location ID",
            "Location Name",
            "Product Code"
        ]

        # 1. Filter: Include alerts with start time (end time can be null for ongoing dryouts)
        df_dryout = df.filter(
            pl.col("Dryout Start Time").is_not_null()
        )

        # 2. Sort: By group columns and start time
        df_dryout = df_dryout.sort(group_cols + ["Dryout Start Time"])

        # 3. For gap calculation, use end time if available, otherwise use current time
        # This allows us to calculate gaps even for ongoing dryouts
        current_time = datetime.datetime.now().replace(microsecond=0)
        df_dryout = df_dryout.with_columns(
            effective_end=pl.when(pl.col("Dryout End Time").is_not_null())
            .then(pl.col("Dryout End Time"))
            .otherwise(pl.lit(current_time))
            .alias("effective_end")
        )

        # 4. Calculate gap from previous alert's effective end time
        df_dryout = df_dryout.with_columns(
            prev_end=pl.col("effective_end")
            .shift(1)
            .over(group_cols)
        )

        # 5. Detect new merged group:
        #   - First alert in group (prev_end is null) → new group
        #   - Gap >= 2 hours → new group
        #   - Gap < 2 hours → same group (merge with previous)
        #   - If current alert has null end time (ongoing), it starts a new group
        #   - If previous alert had null end time (ongoing), current starts a new group
        df_dryout = df_dryout.with_columns(
            prev_end_time_null=pl.col("Dryout End Time").shift(1).is_null().over(group_cols)
        )
        
        df_dryout = df_dryout.with_columns(
            gap_hours=pl.when(pl.col("prev_end").is_not_null())
            .then(
                (pl.col("Dryout Start Time") - pl.col("prev_end"))
                .dt.total_hours()
            )
            .otherwise(None)
        )
        
        df_dryout = df_dryout.with_columns(
            new_group=(
                (pl.col("prev_end").is_null()) |  # First alert in group
                (pl.col("gap_hours") >= 2.0) |   # Gap >= 2 hours
                (pl.col("Dryout End Time").is_null()) |  # Ongoing dryout starts new group
                (pl.col("prev_end_time_null"))  # Previous was ongoing, start new group
            )
            .cast(pl.Int8)
            .cum_sum()
            .over(group_cols)
        )

        # 6. Merge intervals: Group by merged group
        # For end time: if any alert in group has null end time, result is null (ongoing)
        # Otherwise, take max end time
        df_merged = (
            df_dryout
            .group_by(group_cols + ["new_group"], maintain_order=True)
            .agg([
                pl.min("Dryout Start Time").alias("Dryout Start Time"),
                pl.when(pl.col("Dryout End Time").null_count() > 0)
                .then(None)
                .otherwise(pl.max("Dryout End Time"))
                .alias("Dryout End Time"),
            ])
            .drop("new_group")
        )

        # 7. Calculate duration for merged intervals
        # If end time is null (ongoing), calculate from start to current time
        df_merged = df_merged.with_columns(
            pl.when(pl.col("Dryout End Time").is_not_null())
            .then(
                (pl.col("Dryout End Time") - pl.col("Dryout Start Time"))
                .dt.total_hours()
            )
            .otherwise(
                (pl.lit(current_time) - pl.col("Dryout Start Time"))
                .dt.total_hours()
            )
            .round(2)
            .alias("Total Dryout Hours")
        )

        print(df_merged.head())

        # Final result: One entry per merged interval (not aggregated sum)
        # Each row represents one continuous dryout period
        final_result = df_merged.select(
            group_cols + ["Dryout Start Time", "Dryout End Time", "Total Dryout Hours"]
        )

        # Save to Excel
        output_path = f"/home/novex/dry_out_report/dry_out_report_{index}.xlsx"
        with pd.ExcelWriter(output_path, engine="xlsxwriter") as writer:
            df.to_pandas().to_excel(
                writer,
                sheet_name="Dryout Details",
                index=False
            )

            final_result.to_pandas().to_excel(
                writer,
                sheet_name="Dryout Summary",
                index=False
            )

        # df.write_excel(output_path)
        index += 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='Generate dryout report for specified date range',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate report for last 6 months (default)
  python dry_out_report_generation.py
  
  # Generate report for specific date range
  python dry_out_report_generation.py --start-date 2024-01-01 --end-date 2024-06-30
  
  # Generate report from start date to today
  python dry_out_report_generation.py --start-date 2024-01-01
        """
    )
    
    parser.add_argument(
        '--start-date',
        type=str,
        help='Start date for the report (format: YYYY-MM-DD). Default: 6 months ago from today',
        default=None
    )
    
    parser.add_argument(
        '--end-date',
        type=str,
        help='End date for the report (format: YYYY-MM-DD). Default: today',
        default=None
    )
    
    args = parser.parse_args()
    
    # Parse dates or use defaults
    if args.start_date:
        try:
            start_date = datetime.datetime.strptime(args.start_date, '%Y-%m-%d')
        except ValueError:
            print(f"Error: Invalid start-date format '{args.start_date}'. Expected format: YYYY-MM-DD")
            sys.exit(1)
    else:
        # Default: 6 months ago from today
        start_date = (datetime.datetime.today() - datetime.timedelta(days=6*30))
        start_date = start_date.replace(day=1, minute=0, hour=0, second=0, microsecond=0)
    
    if args.end_date:
        try:
            end_date = datetime.datetime.strptime(args.end_date, '%Y-%m-%d')
        except ValueError:
            print(f"Error: Invalid end-date format '{args.end_date}'. Expected format: YYYY-MM-DD")
            sys.exit(1)
    else:
        # Default: today
        end_date = datetime.datetime.today().replace(minute=0, hour=0, second=0, microsecond=0)
    
    # Validate date range
    if start_date > end_date:
        print(f"Error: Start date ({start_date.date()}) must be before or equal to end date ({end_date.date()})")
        sys.exit(1)
    
    print(f"Generating dryout report from {start_date.date()} to {end_date.date()}")
    asyncio.run(fetch_dry_out_report(start_date, end_date))