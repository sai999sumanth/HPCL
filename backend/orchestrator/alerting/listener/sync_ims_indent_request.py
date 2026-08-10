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

logger = urdhva_base.logger.Logger.getInstance("ims_indent_request_sync")

async def sync_ims_indent_request():
    try:
        ro_query = f"""SELECT * FROM "IMS_SAP"."INDENT_REQUEST" """
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get(
            "ims", "1")  # 1  ro_master
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        ro_data = await function(query=ro_query)
        ro_data_schema = {
                "LOCN_CODE": pl.String, "INDENT_NO": pl.Int64, "INDENT_DATE": pl.Datetime,
                "PROD_REQD_DT": pl.Datetime, "CARRY_INDENT": pl.Int64, "DEALER_CODE": pl.String,
                "USER_ID": pl.String, "PROD_TYPE": pl.String, "SOURCE": pl.String,
                "MOT": pl.String, "CANCEL_INDENT": pl.String, "USER_CANCEL": pl.String,
                "CANCEL_TIME": pl.String, "BATCH_NO": pl.Int64, "BATCH_STATUS": pl.String,
                "INDENT_STATUS": pl.String, "TRANSFER_STATUS": pl.String, "BATCH_FLAG": pl.String,
                "FILLING_NO": pl.Int64, "DELIVERY_DATE": pl.Datetime, "FILLING_SLIP": pl.String,
                "TRUCK_REGNO": pl.String, "CANCEL_REMARKS": pl.String, "CARRY_FORWARD_DATE": pl.Datetime,
                "CARRY_LOCN": pl.String, "ORG_INDENT": pl.Int64, "TRUCK_EXITTIME": pl.Datetime,
                "SMS_TRUCKEXIT": pl.String, "MANUAL_REMARKS": pl.String, "ROUTED_DATE": pl.Datetime,
                "SENDER_MOBILE": pl.String, "VALID_INDENT": pl.String, "SEND_TO_JDE_TIME": pl.Datetime,
                "OMC_BATCH_REF_NO": pl.String, "INDENT_AMOUNT": pl.Float64, "CREDIT_AMOUNT": pl.Float64,
                "BALANCE_AMOUNT": pl.Float64, "CREDIT_PROCESS_DATE": pl.Datetime, "EMAIL_SENT_TO_RM": pl.String,
                "EMAIL_SENT_TO_RM_DATE": pl.Datetime, "INDENT_EXECUTABLE_TIME": pl.Datetime, "INDENT_HOLD_RELEASE_TIME": pl.Datetime,
                "SEND_TO_JDE_USER": pl.String, "THROUGH_TRANSPORTER": pl.String, "GREEN_CHANNEL_INDENT": pl.String,
                "CRM_REF_NO": pl.String, "DAY_END_MESS_SENT": pl.String, "PROD_GROUP_TYPE": pl.String,
                "SHARED_WITH_MGKM": pl.String, "MANUAL_ALLOT_REMARKS": pl.String, "PENDING_REASON": pl.String,
                "PENDING_UPDT_TIME": pl.Datetime
            }
        ro_data = pd.DataFrame(ro_data)
        schema_cols = set(ro_data_schema.keys())
        present_cols = set(ro_data.columns)
        # Find extra/unwanted columns
        extra_cols = present_cols - schema_cols
        # Drop them
        ro_data.drop(columns=list(extra_cols), inplace=True)
        ro_data = pl.DataFrame(ro_data, schema=ro_data_schema, strict=False)
        ist = pytz.timezone('Asia/Kolkata')
        sync_date = datetime.datetime.now(ist).strftime("%y%m%d-%H") + "00"
        ro_data = ro_data.with_columns(pl.lit(sync_date).alias("run_id"))

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get(
            "hpcl_ceg", "1")
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'upsert_data'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        resp = await function(
            schema_name="IMS_SAP",
            table_name="INDENT_REQUEST",
            records=ro_data,
            conflict_columns=["LOCN_CODE", "INDENT_NO"]
        )

        # History data
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get(
            "hpcl_ceg", "1")
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'upsert_data'
        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        # resp = await function(
        #     schema_name="IMS_SAP",
        #     table_name="INDENT_REQUEST_HISTORY",
        #     records=ro_data,
        #     conflict_columns=["LOCN_CODE", "INDENT_NO", "run_id"]
        # )
        return {"status": True, "message": "Data Synced Successfully", "data": []}
    except Exception as e:
        print(traceback.format_exc())
        logger.error(f"Error in sync_ims_indent_request: {e}")
        return {"status": False, "message": "Data Sync Failed", "data": e}

if __name__ == "__main__":
    asyncio.run(sync_ims_indent_request())