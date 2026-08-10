import urdhva_base
import asyncio
import numpy as np
import pandas as pd
import hpcl_ceg_model


async def sync_dry_out_ro_loss():
    where_clauses = [
        f"a.interlock_name = 'Dry Out Each Indent Wise MainFlow'",
        "a.dry_out_in_days = '1'",
        "a.indent_status not in ('Cancelled', 'TempClosed', 'ProductLowLevel', 'OfflineOrFalseAlarm', 'NotAvailable')"
    ]
    where_clause = " AND ".join(where_clauses)
    query = f"""WITH product_mapping AS (
                  SELECT * FROM (VALUES
                    ('2811000', '1322000'),  -- MS
                    ('2812000', '1683000'),  -- HSD
                    ('3912000', '1683100'),  -- TURBO
                    ('2816000', '2682000'),  -- POWER 99
                    ('3672000', '3672000'),  -- POWER 95
                    ('3373000', '3373000')   -- POWER 100
                  ) AS pm(alert_product_code, sales_product_no)
                ),
                avg_sales AS (
                  SELECT 
                    ro_sap_code,
                    product_no,
                    tank_no,
                    AVG(total_sales) AS avg_daily_sales,
                    AVG(txn_amount) AS avg_daily_sales_amount
                  FROM "HPCL_HOS".ro_daily_sales
                  WHERE transaction_date >= CURRENT_DATE - INTERVAL '3 months'
                  GROUP BY ro_sap_code, product_no, tank_no
                ),
                alert_periods AS (
                  SELECT 
                    a.sap_id,
                    a.location_name,
                    a.zone,
                    a.region,
                    a.sales_area,
                    pm.sales_product_no,
                    TRIM(tank_id) AS tank_no,
                    a.created_at AS start_ts,
                    CASE 
                      WHEN a.alert_status = 'Close' THEN a.updated_at
                      ELSE NOW()
                    END AS end_ts
                  FROM alerts a
                  JOIN product_mapping pm ON a.product_code = pm.alert_product_code
                  JOIN LATERAL unnest(string_to_array(a.device_id, ',')) AS tank_id ON TRUE
                  WHERE {where_clause}
                )
                SELECT 
                  TO_CHAR(ap.start_ts, 'YYYY-Mon') AS loss_month,
                  ap.location_name,
                  ap.zone,
                  ap.region,
                  ap.sales_area,
                  ap.sap_id,
                  ap.sales_product_no AS product_no,
                  ap.tank_no,
                  ap.start_ts AS start_date,
                  ap.end_ts AS end_date,
                  a.avg_daily_sales,
                  a.avg_daily_sales_amount
                FROM alert_periods ap
                JOIN avg_sales a 
                  ON ap.sap_id::bigint = a.ro_sap_code::bigint
                 AND ap.sales_product_no::bigint = a.product_no::bigint
                 AND ap.tank_no::bigint = a.tank_no::bigint
                ORDER BY ap.start_ts DESC"""
    data = await hpcl_ceg_model.Alerts.get_aggr_data(query=query, limit=0)
    data = pd.DataFrame(data.get("data", []))
    products_map = {'2811000': 'MS', '1322000': 'MS', '2812000': 'HSD', '1683000': 'HSD', '3912000': 'TURBO',
                    '1683100': 'TURBO', '2816000': 'POWER 99', '2682000': 'POWER 99', '3672000': 'POWER 95',
                    '3672000': 'POWER 95', '3373000': 'POWER 100', '3373000': 'POWER 100'}
    data['zone'] = data['zone'].fillna("")
    data['region'] = data['region'].fillna("")
    data['sales_area'] = data['sales_area'].fillna("")
    data['location_name'] = data['location_name'].fillna("")
    data.loc[data['region'] == '0', 'region'] = ''
    data.loc[data['sales_area'] == '0', 'sales_area'] = ''
    data.loc[data['location_name'] == '0', 'location_name'] = ''
    data = data.fillna(0)
    data['product_name'] = data['product_no'].astype(str).map(products_map)
    data['start_date'] = pd.to_datetime(data['start_date']).dt.tz_localize(None)
    data['end_date'] = pd.to_datetime(data['end_date']).dt.tz_localize(None)
    data['dryout_days'] = (data['end_date'] - data['start_date']).dt.total_seconds() / (60 * 60 * 24)
    data["estimated_loss"] = data["dryout_days"] * data["avg_daily_sales"]
    data["estimated_loss_amount"] = data["dryout_days"] * data["avg_daily_sales_amount"]
    data["estimated_loss"] = data["estimated_loss"].round(2)
    data["estimated_loss_amount"] = data["estimated_loss_amount"].round(2)
    data["avg_daily_sales"] = data["avg_daily_sales"].round(2).astype(str)
    data["avg_daily_sales_amount"] = data["avg_daily_sales_amount"].round(2).astype(str)
    data = data.groupby(['loss_month', 'sap_id', 'product_name', 'zone', 'tank_no', 'avg_daily_sales', 'avg_daily_sales_amount', 'region', 'sales_area', 'location_name'])[
        ['estimated_loss', 'estimated_loss_amount', 'dryout_days']].sum().reset_index()
    data["avg_daily_sales"] = data["avg_daily_sales"].astype(np.float64)
    data["avg_daily_sales_amount"] = data["avg_daily_sales_amount"].astype(np.float64)
    data = data.groupby(['loss_month', 'sap_id', 'product_name', 'zone', 'tank_no', 'region', 'sales_area', 'location_name'])[
        ['estimated_loss', 'estimated_loss_amount', 'dryout_days', 'avg_daily_sales', 'avg_daily_sales_amount']].sum().reset_index()
    data["estimated_loss"] = data["estimated_loss"].round(2)
    data["avg_daily_sales"] = data["avg_daily_sales"].round(2)
    data["estimated_loss_amount"] = data["estimated_loss_amount"].round(2)
    data["avg_daily_sales_amount"] = data["avg_daily_sales_amount"].round(2)
    data['dryout_days'] = pd.to_timedelta(data['dryout_days'], unit='D')

    data['dryout_days'] = data['dryout_days'].apply(
        lambda td: f"{td.days} days {td.components.hours} hours"
    )
    data = data.drop_duplicates(subset=["loss_month", "sap_id", "zone", "product_name", "tank_no", "location_name"])
    print(data)
    print(data.columns)
    print(data.dtypes)
    data.to_csv("/tmp/dry_out_loss.csv", index=False)
    for split_df in np.array_split(data, 500):
        await hpcl_ceg_model.DryOutRoLoss.bulk_update(split_df.to_dict(orient='records'), upsert=True)

if __name__ == "__main__":
    asyncio.run(sync_dry_out_ro_loss())