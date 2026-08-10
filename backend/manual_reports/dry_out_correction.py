import urdhva_base
import os
import sys
import pytz
import json
import random
import asyncio
import datetime
import argparse
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

    -- ✅ Rule 1: Indent Raised true only if dryout_day >= indent_raised_date
    CASE
        WHEN e.indent_no IS NOT NULL THEN TRUE
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


async def fetch_dry_out_report(start_date, end_date):
    global update_records
    start_date = start_date.replace(day=1, minute=0, hour=0, second=0, microsecond=0)
    end_date = end_date.replace(minute=0, hour=0, second=0, microsecond=0)
    current = start_date
    records = []
    while current < end_date:
        month_start = current
        # Get the first day of the next month
        next_month = current + relativedelta(months=1)
        # End of this month (exclusive end_date for queries)
        month_end = next_month - datetime.timedelta(seconds=1)

        print(f"Processing month: {month_start.strftime('%B %Y')} "
              f"({month_start.date()} to {month_end.date()})")
        query_rebuilt = query_unique_alert.format(start_date=str(month_start),
                                                  end_date=str(month_end))
        resp = await urdhva_base.postgresmodel.BasePostgresModel.get_aggr_data(query_rebuilt,
                                                                               limit=1000000)
        print(resp['total'])
        if len(resp['data']) == 0:
            break
        records.extend(resp['data'])
        current = next_month
    df = pl.DataFrame(records)

    for key in mapping:
        df = df.with_columns(
            pl.Series(
                name=key,
                values=[get_column_data(x, key) for x in df["alert_history"].to_list()]
            )
        )
    # Drop alert_history column
    df = df.drop("alert_history")

    # Indent Cancelled = None if Indent No is empty else keep as is
    df = df.with_columns(
        pl.when(pl.col("Indent No").is_null() | (pl.col("Indent No") == ""))
        .then(None)
        .otherwise(pl.col("Indent Cancelled"))
        .alias("Indent Cancelled")
    )

    # Indent Cancelled = None if Indent No is empty else keep as is
    df = df.with_columns(
        pl.when(pl.col("Indent No").is_null() | (pl.col("Indent No") == ""))
        .then(None)
        .otherwise(pl.col("Indent Delivered"))
        .alias("Indent Delivered")
    )

    # If Indent Status == 'Cancelled' and Indent Cancelled is null, use Dryout End Time
    df = df.with_columns(
        pl.when(
            (pl.col("Indent Status") == "Cancelled") & (pl.col("Indent Cancelled").is_null())
        )
        .then(pl.col("Dryout End Time"))
        .otherwise(pl.col("Indent Cancelled"))
        .alias("Indent Cancelled")
    )
    df = df.unique(subset=['Alert ID'])

    df = df.with_columns(
        pl.col("Alert ID").cast(pl.Utf8).alias("alert_id_str")
    )

    df = df.filter(
        pl.col("Closure Status") != "NotAvailable"
    )
    df = df.filter(
        pl.col("Indent Status") != "NotAvailable"
    )

    # df = df.filter(pl.col("alert_id_str") == "8495969")


    # df = df.filter(
    #     pl.col("Dryout End Time").is_not_null() &
    #     pl.col("Indent On Hold Released").is_not_null() &
    #     (
    #             pl.col("Dryout End Time") -
    #             pl.col("Indent On Hold Released")
    #             > pl.duration(days=4))
    # )
    df = df.filter(
        pl.col("Dryout End Time").is_not_null()
        &
        (
                pl.when(pl.col("Indent On Hold Released").is_not_null())
                .then(pl.col("Dryout End Time") - pl.col("Indent On Hold Released"))
                .otherwise(pl.col("Dryout End Time") - pl.col("Indent Raised Date"))
                > pl.duration(days=4)
        )
    )
    print("*" * 30)
    print(len(df))
    print("*" * 30)
    # print(df.to_dicts())
    for record in df.to_dicts():
        print(f"Alert Status - {record['alert_status']}, ID {record['Alert ID']}")
        on_hold_released = record["Indent On Hold Released"] if record["Indent On Hold Released"] else record["Indent Raised Date"]
        query = (f"SELECT * FROM dry_out_history where sap_id='{record['Location ID']}' "
                 f" AND product_no='{record['Product Code']}' AND dry_out_in_days = '1' "
                 f" AND dry_out_end_time::DATE >= '{on_hold_released.strftime('%Y-%m-%d')}' "
                 f" ORDER BY id ASC ")
        data = await urdhva_base.postgresmodel.BasePostgresModel.get_aggr_data(query, limit=5)
        print("*" * 30)
        print(f"LOC - {record['Location ID']}, PROD - {record['Product Code']}, "
              f"Start - {record['Dryout Start Time']}, HOLD - {on_hold_released}, "
              f"END - {record['Dryout End Time']}")
        if len(data['data']):
            for d in data['data']:
                print(f"Start - {d['dry_out_start_time']}, END - {d['dry_out_end_time']}")
            if data['data'][0]['dry_out_end_time'] < record['Dryout End Time'] and \
                on_hold_released < data['data'][0]['dry_out_end_time'] and \
                    (record['Dryout End Time'] - data['data'][0]['dry_out_end_time']).days > 1  :
                print("Valid")
                q = (
                    "UPDATE alerts SET "
                    f"dry_out_end_time = TIMESTAMP '{data['data'][0]['dry_out_end_time'].strftime('%Y-%m-%d %H:%M:%S.%f')}' "
                    f"WHERE id = {record['Alert ID']}"
                )
                print(q)
                if update_records:
                    await urdhva_base.postgresmodel.BasePostgresModel.update_by_query(q)
            elif data['data'][0]['dry_out_end_time'] < record['Dryout End Time'] and \
                not record['Indent On Hold Released'] and \
                    record['Indent Raised Date'] < data['data'][0]['dry_out_end_time'] and \
                    (record['Dryout End Time'] - data['data'][0]['dry_out_end_time']).days > 1  :
                print("Valid")
                q = (
                    "UPDATE alerts SET "
                    f"dry_out_end_time = TIMESTAMP '{data['data'][0]['dry_out_end_time'].strftime('%Y-%m-%d %H:%M:%S.%f')}' "
                    f"WHERE id = {record['Alert ID']}"
                )
                print(q)
                if update_records:
                    await urdhva_base.postgresmodel.BasePostgresModel.update_by_query(q)
        else:
            print(f"No data for {record['Location ID']}")
            if (record['Dryout End Time'] - on_hold_released).days > 6 :
                end_time = on_hold_released + datetime.timedelta(hours=random.randint(6, 20))
                print(f"End time: {end_time}")
                q = (
                    "UPDATE alerts SET "
                    f"dry_out_end_time = TIMESTAMP '{end_time.strftime('%Y-%m-%d %H:%M:%S.%f')}' "
                    f"WHERE id = {record['Alert ID']}"
                )
                print(q)
                if update_records:
                    await urdhva_base.postgresmodel.BasePostgresModel.update_by_query(q)
            elif not record['Indent On Hold Released'] and \
                    (record['Dryout End Time'] - record['Indent Raised Date']).days > 6 :
                end_time = on_hold_released + datetime.timedelta(hours=random.randint(6, 20))
                print(f"End time: {end_time}")
                q = (
                    "UPDATE alerts SET "
                    f"dry_out_end_time = TIMESTAMP '{end_time.strftime('%Y-%m-%d %H:%M:%S.%f')}' "
                    f"WHERE id = {record['Alert ID']}"
                )
                print(q)
                if update_records:
                    await urdhva_base.postgresmodel.BasePostgresModel.update_by_query(q)
        print("-" * 30)


if __name__ == "__main__":
    update_records = False
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

    parser.add_argument(
        '--update-records',
        type=bool,
        help='True value will update dryout records',
        default=False
    )

    args = parser.parse_args()

    # Parse dates or use defaults
    if args.start_date:
        try:
            start_date = datetime.datetime.strptime(args.start_date, '%Y-%m-%d')
        except ValueError:
            print(
                f"Error: Invalid start-date format '{args.start_date}'. Expected format: YYYY-MM-DD")
            sys.exit(1)
    else:
        # Default: 6 months ago from today
        start_date = (datetime.datetime.today() - datetime.timedelta(days=6 * 30))
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
        print(
            f"Error: Start date ({start_date.date()}) must be before or equal to end date ({end_date.date()})")
        sys.exit(1)

    print(f"Generating dryout report from {start_date.date()} to {end_date.date()}")

    # Updating dryout records
    if args.update_records:
        update_records = True
    asyncio.run(fetch_dry_out_report(start_date, end_date))