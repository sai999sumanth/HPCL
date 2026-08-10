import urdhva_base
import pytz
import asyncio
import traceback
import datetime
import polars as pl
import pandas as pd
import charts_actions
import dashboard_studio_model
import utilities.connection_mapping as connection_mapping

logger = urdhva_base.logger.Logger.getInstance("auto_dc_requests_sync")

async def sync_auto_dc_requests():
    try:
        # Step 1: Read from IMS_SAP.AUTO_DC_REQUESTS
        ist = pytz.timezone('Asia/Kolkata')
        _date = (datetime.datetime.now(ist) - datetime.timedelta(days=15)).strftime("%Y%m%d")
        auto_dc_query = f"""SELECT * FROM "IMS_SAP"."AUTO_DC_REQUESTS" WHERE "SHIPMENT_DATE" >= '{_date}' """
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get(
            "ims", "1")
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        auto_dc_data = await function(query=auto_dc_query)

        # Step 2: Define schema for AUTO_DC_REQUESTS
        auto_dc_schema = {
            "SOURCE": pl.String,
            "ORIGIN_LOCN": pl.String,
            "LOAD_NO": pl.String,
            "DELIVERY_NO": pl.String,
            "SHIP_TO_CUST": pl.String,
            "SOLD_TO_CUST": pl.String,
            "SHIPMENT_DATE": pl.String,
            "DELIVERY_DATE": pl.String,
            "DELIVERY_TIME": pl.String,
            "MATERIAL_CODE": pl.String,
            "SHIPMENT_QTY": pl.Float64,
            "SHIPMENT_QTY_UOM": pl.String,
            "INVOICE_NO": pl.String,
            "LINE_ITEM": pl.String,
            "INVOICE_DATE": pl.String,
            "AUTODC_FLAG": pl.String,
            "AUTODC_STATUS": pl.String,
            "QTY_RECEIVED": pl.Float64,
            "QTY_RECEIVED_UOM": pl.String,
            "QTY_SHORTAGE_BOOKED": pl.Float64,
            "QTY_SHORTAGE_BOOKED_UOM": pl.String,
            "QTY_SHORTAGE_FLAG": pl.String,
            "AUTODC_USER_ID": pl.String,
            "AUTODC_REFERENCE1": pl.String,
            "INITIATED_BY": pl.String,
            "AUTODC_RECEIPT_DATE": pl.String,
            "AUTODC_RECEIPT_TIME": pl.String,
            "AUTODC_UPDATE_DATE": pl.String,
            "AUTODC_UPDATE_TIME": pl.String,
            "AUTODC_REASON_CODE": pl.String,
            "PROCESSED_FLAG": pl.String,
            "PROCESSED_DATE": pl.String,
            "PROCESSED_TIME": pl.String
        }

        auto_dc_data = pd.DataFrame(auto_dc_data)
        schema_cols = set(auto_dc_schema.keys())
        present_cols = set(auto_dc_data.columns)
        # Find extra/unwanted columns
        extra_cols = present_cols - schema_cols
        # Drop them
        auto_dc_data.drop(columns=list(extra_cols), inplace=True)
        auto_dc_data = pl.DataFrame(auto_dc_data, schema=auto_dc_schema)
        ist = pytz.timezone('Asia/Kolkata')
        sync_date = datetime.datetime.now(ist).strftime("%y%m%d-%H") + "00"
        auto_dc_data = auto_dc_data.with_columns(pl.lit(sync_date).alias("run_id"))

        # Step 3: Upsert to destination (assumed same table, can be changed)
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get(
            "hpcl_ceg", "1")
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'upsert_data'
        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        resp = await function(
            schema_name="IMS_SAP",
            table_name="AUTO_DC_REQUESTS",
            records=auto_dc_data,
            conflict_columns=["ORIGIN_LOCN", "LOAD_NO", "MATERIAL_CODE", "SHIP_TO_CUST"]
        )
        return {"status": True, "message": "Data Synced Successfully", "data": []}
    except Exception as e:
        print(traceback.format_exc())
        logger.error(f"Error in syncing data: {e}, Traceback: {traceback.format_exc()}")
        return {"status": False, "message": "Data Sync Failed", "data": str(e)}


if __name__ == "__main__":
    asyncio.run(sync_auto_dc_requests())