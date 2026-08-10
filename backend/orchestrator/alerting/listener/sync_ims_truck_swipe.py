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

logger = urdhva_base.logger.Logger.getInstance("ims_truck_swipe_sync")

async def sync_ims_indent_truck_swipe():
    try:
        ro_query = f"""SELECT * FROM "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" """
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get(
            "ims", "1")  # 1  ro_master
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        ro_data = await function(query=ro_query)
        ro_data_schema = {
            "CARD_NO": pl.String,
            "CARD_DATE": pl.Datetime,
            "CARD_TIME": pl.String,
            "CARD_STATUS": pl.String,
            "READER_ID": pl.String,
            "LOCN_CODE": pl.String,
            "TRUCK_REGNO": pl.String,
            "SWIPE_SEQ": pl.Int64,
            "LOADED_ON": pl.Datetime
        }
        ro_data = pd.DataFrame(ro_data)
        schema_cols = set(ro_data_schema.keys())
        present_cols = set(ro_data.columns)
        # Find extra/unwanted columns
        extra_cols = present_cols - schema_cols
        # Drop them
        ro_data.drop(columns=list(extra_cols), inplace=True)
        ro_data = pl.DataFrame(ro_data, schema=ro_data_schema)
        ist = pytz.timezone('Asia/Kolkata')
        sync_date = datetime.datetime.now(ist).strftime("%y%m%d-%H") + "00"
        ro_data = ro_data.with_columns(pl.lit(sync_date).alias("run_id"))

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get(
            "hpcl_ceg", "1")
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'upsert_data'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        resp = await function(
            schema_name="IMS_SAP",
            table_name="TRUCK_SWIPE_ENTRY_SAP",
            records=ro_data,
            conflict_columns=["LOCN_CODE", "READER_ID", "SWIPE_SEQ"]
        )

        # history data
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get(
            "hpcl_ceg", "1")
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'upsert_data'
        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        # resp = await function(
        #     schema_name="IMS_SAP",
        #     table_name="TRUCK_SWIPE_ENTRY_SAP_HISTORY",
        #     records=ro_data,
        #     conflict_columns=["LOCN_CODE", "READER_ID", "SWIPE_SEQ", "run_id"]
        # )
        return {"status": True, "message": "Data Synced Successfully", "data": []}
    except Exception as e:
        print(traceback.format_exc())
        logger.error(f"Error in data sync: {e}, Traceback: {traceback.format_exc()}")
        return {"status": False, "message": "Data Sync Failed", "data": e}

if __name__ == "__main__":
    asyncio.run(sync_ims_indent_truck_swipe())