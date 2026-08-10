import urdhva_base
import asyncio
import traceback
import pandas as pd
import polars as pl
import datetime
import pytz
import charts_actions
import dashboard_studio_model
import utilities.connection_mapping as connection_mapping

logger = urdhva_base.logger.Logger.getInstance("dry_out_report_sync")


async def get_custom_timestamp():
    now = datetime.datetime.now(datetime.timezone.utc)
    # If minutes are less than 10, take the previous hour
    if now.minute < 10:
        adjusted_time = now - datetime.timedelta(hours=1)
    else:
        adjusted_time = now
    # Format as YYMMDD-HH00
    timestamp = adjusted_time.strftime("%y%m%d-%H00")

    return timestamp

async def _get_dry_out_ims_report(dry_out_in_days=['1', '2']):
    dry_out_in_days = "', '".join(x for x in dry_out_in_days)
    date_time = await get_custom_timestamp()
    query = f"""WITH FilteredAlerts AS (
                    SELECT sap_id, indent_no, product_code, zone, region, sales_area, location_name, terminal_plant_id, 
                    indent_status, dry_out_in_days, id as alert_id
                    FROM alerts
                    WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow'
                    AND indent_status NOT IN ('Cancelled', 'Completed', 'TempClosed', 'ProductLowLevel', 'OfflineOrFalseAlarm', 'NotAvailable')
                    AND mark_as_false = true
                    AND dry_out_in_days IN ('{dry_out_in_days}')
                ),
                FilteredIndentRequest AS (
                    SELECT 
                        ir."LOCN_CODE", ir."INDENT_NO", ir."INDENT_DATE", ir."PROD_REQD_DT",
                        ir."DEALER_CODE", ir."BATCH_FLAG", ir."TRUCK_REGNO", ir."VALID_INDENT",
                        ir."SEND_TO_JDE_TIME", ir."DELIVERY_DATE", ir."INDENT_HOLD_RELEASE_TIME",
                        ir."INDENT_EXECUTABLE_TIME"
                    FROM "IMS_SAP"."INDENT_REQUEST" ir
                    WHERE EXISTS (
                        SELECT 1 FROM FilteredAlerts a
                        WHERE COALESCE(substr(ir."DEALER_CODE", 3, 8)::TEXT, '') = COALESCE(a.sap_id::TEXT, '')
                        AND COALESCE(ir."INDENT_NO"::TEXT, '') = COALESCE(a.indent_no::TEXT, '')
                    )
                ),
                CombinedData AS (
                    SELECT 
                        ir."LOCN_CODE", ir."INDENT_NO", ir."INDENT_DATE", ir."PROD_REQD_DT",
                        ir."DEALER_CODE", ir."BATCH_FLAG", ir."TRUCK_REGNO", ir."VALID_INDENT",
                        ir."SEND_TO_JDE_TIME", ir."DELIVERY_DATE", ir."INDENT_HOLD_RELEASE_TIME",
                        ir."INDENT_EXECUTABLE_TIME",
                        ip."PROD" AS "PRODUCT_CODE", ip."QTY", ip."PROD_ALLOT_TIME",
                        ip."SALES_ORDERNO", ip."INVOICE_NO", ip."JDE_TRUCK_NO",
                        tse."LOADED_ON",
                        ROW_NUMBER() OVER (
                            PARTITION BY ir."LOCN_CODE", ir."INDENT_NO", ir."DEALER_CODE", ip."PROD"
                            ORDER BY tse."LOADED_ON" ASC NULLS LAST
                        ) AS rn
                    FROM FilteredIndentRequest ir
                    LEFT JOIN 
                        (SELECT * FROM "IMS_SAP"."INDENT_PRODUCTS" WHERE substr(run_id, 1, 6) = '{date_time[:6]}') AS ip
                    ON 
                        COALESCE(ir."LOCN_CODE"::TEXT, '') = COALESCE(ip."LOCN_CODE"::TEXT, '')
                        AND COALESCE(ir."DEALER_CODE"::TEXT, '') = COALESCE(ip."DEALER_CODE"::TEXT, '')
                        AND COALESCE(ir."INDENT_NO"::TEXT, '') = COALESCE(ip."INDENT_NO"::TEXT, '')
                    LEFT JOIN 
                        (SELECT * FROM "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" WHERE substr(run_id, 1, 6) = '{date_time[:6]}') AS tse 
                    ON 
                        COALESCE(ir."LOCN_CODE"::TEXT, '') = COALESCE(tse."LOCN_CODE"::TEXT, '')
                        AND COALESCE(ir."TRUCK_REGNO"::TEXT, '') = COALESCE(tse."TRUCK_REGNO"::TEXT, '')
                        AND tse."CARD_STATUS" = 'O'
                        AND tse."LOADED_ON" >= ir."PROD_REQD_DT"
                        AND tse."LOADED_ON" BETWEEN ir."PROD_REQD_DT" AND (ir."PROD_REQD_DT" + INTERVAL '1 day')
                ),
                SalesData AS (
                    SELECT 
                        rosapcode, 
                        CASE
                            WHEN item_name = 'HSD' THEN '2812000'
                            WHEN item_name = 'MS' THEN '2811000'
                            WHEN item_name = 'TURBO' THEN '3912000'
                            WHEN item_name = 'E20' THEN '2822000'
                            WHEN item_name = 'POWER 95' THEN '3672000'
                            WHEN item_name = 'POWER 99' THEN '2816000'
                            WHEN item_name = 'POWER 100' THEN '3373000'
                            ELSE NULL
                        END AS item_name_code,
                        SUM(avgsales_7days) AS avgsales_7days
                    FROM sch_inventory_forecast_dashboard_latest
                    WHERE substr(run_id, 1, 6) = '{date_time[:6]}'
                    GROUP BY 
                        rosapcode,
                        CASE
                            WHEN item_name = 'HSD' THEN '2812000'
                            WHEN item_name = 'MS' THEN '2811000'
                            WHEN item_name = 'TURBO' THEN '3912000'
                            WHEN item_name = 'E20' THEN '2822000'
                            WHEN item_name = 'POWER 95' THEN '3672000'
                            WHEN item_name = 'POWER 99' THEN '2816000'
                            WHEN item_name = 'POWER 100' THEN '3373000'
                            ELSE NULL
                        END
                )
                SELECT 
                    a.alert_id as "Alert_ID",
                    a.zone as "ZONE",
                    a.region as "REGION",
                    a.sales_area as "SALES_AREA",
                    a.sap_id as "SAP_ID",
                    a.location_name as "LOCATION_NAME",
                    a.terminal_plant_id as "TERMINAL_PLANT_ID",
                    a.indent_no as "INDENT_NO",
                    a.product_code as "PRODUCT_CODE",
                    a.indent_status as "INDENT_STATUS",
                    a.dry_out_in_days as "DRY_OUT_IN_DAYS",
                    cd."LOCN_CODE" AS "ASSIGNED_TO_LOCN",
                    cd."PROD_REQD_DT",
                    cd."TRUCK_REGNO",
                    cd."VALID_INDENT",
                    cd."SEND_TO_JDE_TIME",
                    cd."DELIVERY_DATE",
                    cd."INDENT_HOLD_RELEASE_TIME",
                    cd."INDENT_EXECUTABLE_TIME",
                    cd."QTY",
                    cd."PROD_ALLOT_TIME",
                    cd."SALES_ORDERNO",
                    cd."INVOICE_NO",
                    cd."LOADED_ON",
                    sd.avgsales_7days as "AVGSALES_7DAYS"
                FROM 
                    FilteredAlerts a
                LEFT JOIN 
                    CombinedData cd
                ON 
                    COALESCE(substr(cd."DEALER_CODE", 3, 8)::TEXT, '') = COALESCE(a.sap_id::TEXT, '')
                    AND COALESCE(cd."INDENT_NO"::TEXT, '') = COALESCE(a.indent_no::TEXT, '')
                    AND COALESCE(cd."PRODUCT_CODE"::TEXT, '') = COALESCE(a.product_code::TEXT, '')
                LEFT JOIN 
                    SalesData sd
                ON 
                    COALESCE(a.sap_id::TEXT, '') = COALESCE(sd.rosapcode::TEXT, '')
                    AND COALESCE(a.product_code::TEXT, '') = COALESCE(sd.item_name_code::TEXT, '')
                WHERE 
                    cd.rn = 1 or cd.rn is null
                ORDER BY 
                    a.indent_no desc;"""
    

    stats_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    stats_resp = stats_resp.get("data", [])
    stats_resp = pd.DataFrame(stats_resp)

    if stats_resp.empty:
        return []

    stats_resp['DRY_OUT_IN_DAYS'] = stats_resp['DRY_OUT_IN_DAYS'].fillna("").astype(str)
    stats_resp.replace({"DRY_OUT_IN_DAYS": {"1": "DRY_OUT", "2": "INTRA_DAY_DRY_OUT"}}, inplace=True)
    stats_resp.replace({"VALID_INDENT": {"H": "ON_HOLD_RELEASED", "Y": "VALID_INDENT", "N": "ON_HOLD"}}, inplace=True)

    for column in ["SEND_TO_JDE_TIME", "DELIVERY_DATE", "INDENT_HOLD_RELEASE_TIME",
                   "INDENT_EXECUTABLE_TIME", "PROD_ALLOT_TIME", "LOADED_ON"]:
        if pd.api.types.is_datetime64_any_dtype(stats_resp[column]):
            stats_resp[column] = stats_resp[column].dt.strftime("%Y-%m-%d %H:%M:%S")

    if pd.api.types.is_datetime64_any_dtype(stats_resp['PROD_REQD_DT']):
        stats_resp['PROD_REQD_DT'] = stats_resp['PROD_REQD_DT'].dt.strftime("%Y-%m-%d")

    stats_resp['AVGSALES_7DAYS'] = stats_resp['AVGSALES_7DAYS'].fillna(0.00)
    stats_resp["QTY"] = stats_resp["QTY"].fillna(0.00)
    stats_resp = stats_resp.fillna("")
    stats_resp = stats_resp.rename(columns={"SEND_TO_JDE_TIME": "SENT_TO_SAP_TIME", "QTY": "QTY (KL)", "DRY_OUT_IN_DAYS": "DRY_OUT_TYPES"})
    print("Total height:", len(stats_resp))

    return stats_resp


# ----------------------------
# MAIN SYNC FUNCTION
# ----------------------------
async def sync_dry_out_indent_report():

    try:
        # ----------------------------
        # STEP 1: FETCH DATA
        # ----------------------------
        df = await _get_dry_out_ims_report(dry_out_in_days=['1', '2'])

        # ----------------------------
        # STEP 2: FIX COLUMN NAMES
        # ----------------------------
        df = df.rename(columns={
            "QTY (KL)": "QTY_KL",
        })
        df.columns = [col.lower() for col in df.columns]

        # ----------------------------
        # STEP 3: ADD RUN_ID
        # ----------------------------
        ist = pytz.timezone('Asia/Kolkata')
        run_id = datetime.datetime.now(ist).strftime("%y%m%d-%H%M")

        df["run_id"] = run_id
        # ----------------------------
        # STEP 4: DB CONNECTION
        # ----------------------------
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = (
            connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        )

        # ----------------------------
        # STEP 5: DROP TABLE
        # ----------------------------
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'

        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams
        )

        drop_query = """
        DROP TABLE IF EXISTS public.dry_out_indent_report;
        """
        await function(query=drop_query)
        # ----------------------------
        # STEP 6: CREATE TABLE (VARCHAR)
        # ----------------------------
        create_query = """
        CREATE TABLE public.dry_out_indent_report (
            zone VARCHAR,
            region VARCHAR,
            sales_area VARCHAR,
            sap_id VARCHAR,
            location_name VARCHAR,
            terminal_plant_id VARCHAR,
            indent_no VARCHAR,
            product_code VARCHAR,
            indent_status VARCHAR,
            dry_out_types VARCHAR,

            assigned_to_locn VARCHAR,
            prod_reqd_dt VARCHAR,
            truck_regno VARCHAR,
            valid_indent VARCHAR,
            sent_to_sap_time VARCHAR,
            delivery_date VARCHAR,
            indent_hold_release_time VARCHAR,
            indent_executable_time VARCHAR,

            qty_kl NUMERIC,
            prod_allot_time VARCHAR,
            sales_orderno VARCHAR,
            invoice_no VARCHAR,
            loaded_on VARCHAR,

            avgsales_7days NUMERIC,
            run_id VARCHAR,
            alert_id NUMERIC,

            CONSTRAINT unique_alert_id UNIQUE (alert_id)
        );
        """
        await function(query=create_query)
        # ----------------------------
        # STEP 7: INSERT DATA
        # ----------------------------
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'upsert_data'

        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams
        )

        # records = df.to_dicts()
        records = df.to_dict(orient="records")
        total_records = len(records)

        print(f"Total Records: {total_records}")

        BATCH_SIZE = 10000  

        for i in range(0, total_records, BATCH_SIZE):
            batch = records[i:i + BATCH_SIZE]

            print(f"Inserting batch {i} to {i + len(batch)}")

            await function(
                schema_name="public",
                table_name="dry_out_indent_report",
                records=batch, 
                conflict_columns = ["alert_id"]
            )

        print("All batches inserted successfully")

        return {
            "status": True,
            "message": "Dry Out Report Synced Successfully",
            "rows": total_records
        }


    except Exception as e:
        tb = traceback.format_exc()
        logger.error("Dry Out Sync Failed")

        return {
            "status": False,
            "message": "Sync Failed",
            "error": repr(e),
            "traceback": tb
        }


# ----------------------------
# RUN
# ----------------------------
if __name__ == "__main__":
    asyncio.run(sync_dry_out_indent_report())
