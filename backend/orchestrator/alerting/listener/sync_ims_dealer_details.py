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

logger = urdhva_base.logger.Logger.getInstance("ims_dealer_details_sync")

async def sync_ims_dealer_details():
    try:
        ro_query = f"""SELECT * FROM "IMS_SAP"."DEALER_DETAILS" """
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get(
            "ims", "1")  # 1  ro_master
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        ro_data = await function(query=ro_query)
        ro_data_schema = {
                    "DEALER_CODE": pl.String,
                    "DEALER_NAME": pl.String,
                    "FLAG": pl.String,
                    "RTKM": pl.Float64,
                    "WHITE_OIL": pl.String,
                    "BLACK_OIL": pl.String,
                    "LOCN_CODE": pl.String,
                    "VALID": pl.String,
                    "DEALER_STATE_CODE": pl.String,
                    "SBU": pl.String,
                    "CUSTOMER_TYPE": pl.String,
                    "SEARCH_TYPE": pl.String,
                    "ITEM_RESTRICTION": pl.String,
                    "PARENT_CODE": pl.String,
                    "MCU": pl.String,
                    "AUTO_INDENT": pl.String,
                    "FDZ": pl.String,
                    "DEALER_VOLUME": pl.Int64,
                    "ZONE": pl.Int64,
                    "SAREA_CODE": pl.String,
                    "SAREA_DESC": pl.String,
                    "TOWN_CODE": pl.String,
                    "CATEGORY1": pl.String,
                    "CATEGORY2": pl.String,
                    "CATEGORY3": pl.String,
                    "CATEGORY4": pl.String,
                    "CATEGORY5": pl.String,
                    "FUT_DATE": pl.Datetime,
                    "MS_TYPE": pl.String,
                    "HSD_TYPE": pl.String,
                    "PAYMENT_MODE": pl.String,
                    "ROCODE": pl.String,
                    "MSP_TYPE": pl.String,
                    "HSDT_TYPE": pl.String,
                    "TRIP_TIME": pl.Float64,
                    "TRKCAP_LIMIT": pl.Float64,
                    "RESTRICT_START_TIME": pl.String,
                    "RESTRICT_END_TIME": pl.String,
                    "PARTLOAD_ZONE": pl.String,
                    "PARTLOAD_EXPIRYDATE": pl.Datetime,
                    "TRKCAP_LIMIT_EXPIRY": pl.Datetime,
                    "MIN_INDT_QTY": pl.Float64,
                    "DIFFICULT_LOAD": pl.String,
                    "CONSORTIUM_CODE": pl.String,
                    "AMOUNT_DUE": pl.Float64,
                    "OPEN_AMOUNT": pl.Float64,
                    "TOTAL_EXPOSURE": pl.Float64,
                    "CREDIT_LIMIT": pl.Float64,
                    "LAST_UPDT_DATE": pl.Datetime,
                    "LAST_UPDT_TIME": pl.Int64,
                    "BULK_UPDT_FLAG": pl.String,
                    "DEALER_NO_NUMERIC": pl.Int64,
                    "HILLY_LOAD": pl.String,
                    "TAKES_BD": pl.String,
                    "TAKING_BD": pl.String,
                    "CREDIT_PROCESSED": pl.String,
                    "CREDIT_CHK_DEALER_CODE": pl.String,
                    "AUTO_INDENTING_ENABLED": pl.String,
                    "DISTRIBUTION_CHANNEL": pl.String,
                    "DIVISION": pl.String,
                    "TELEPHONE_NUMBER": pl.String,
                    "MOBILE_NUMBER": pl.String,
                    "CUSTOMER_ACCOUNT_GROUP": pl.String,
                    "CUSTOMER_INDICATOR": pl.String,
                    'POWER95_TYPE': pl.String,
                    'POWER99_TYPE': pl.String,
                    'POWER100_TYPE': pl.String,
                    'E20_TYPE': pl.String,
                    'CAN_TAKE_POWER95': pl.String,
                    'CAN_TAKE_POWER99': pl.String,
                    'CAN_TAKE_POWER100': pl.String,
                    'CAN_TAKE_E20': pl.String,
                    'CL_FLAG': pl.String,
                    'CL_FLAG_DESC': pl.String
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
            table_name="DEALER_DETAILS",
            records=ro_data,
            conflict_columns=["DEALER_CODE"]
        )
        return {"status": True, "message": "Data Synced Successfully", "data": []}
    except Exception as e:
        print(traceback.format_exc())
        logger.error(f"Error in sync_ims_dealer_details: {e}")
        return {"status": False, "message": "Data Sync Failed", "data": e}

if __name__ == "__main__":
    asyncio.run(sync_ims_dealer_details())