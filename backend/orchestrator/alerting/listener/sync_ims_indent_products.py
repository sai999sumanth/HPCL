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

logger = urdhva_base.logger.Logger.getInstance("ims_indent_products_sync")

async def sync_ims_indent_products():
    try:
        ro_query = f"""SELECT * FROM "IMS_SAP"."INDENT_PRODUCTS" """
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get(
            "ims", "1")  # 1  ro_master
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        ro_data = await function(query=ro_query)
        ro_data_schema = {
                "LOCN_CODE": pl.String,
                "INDENT_NO": pl.Int64,
                "INDENT_DATE": pl.Datetime,
                "LINE_NO": pl.Int64,
                "PROD": pl.String,
                "QTY": pl.Float64,
                "DEALER_CODE": pl.String,
                "TRANS_ID": pl.String,
                "PROD_ALLOTQTY": pl.Float64,
                "PROD_ALLOT_STATUS": pl.String,
                "PROD_ALLOT_USER": pl.String,
                "PROD_ALLOT_TIME": pl.Datetime,
                "EDI_NO": pl.Int64,
                "SALES_ORD_COM": pl.String,
                "SALES_ORD_TYPE": pl.String,
                "SALES_ORDERNO": pl.String,
                "SALES_ORDER_STATUS": pl.String,
                "TRUCK_LOAD": pl.String,
                "LINE_REMARKS": pl.String,
                "EDI_COM": pl.String,
                "EDI_DOC_TYPE": pl.String,
                "EDI_LINE_ID": pl.Int64,
                "SALES_ORD_LINEID": pl.Int64,
                "INDENT_STATUS": pl.String,
                "INVOICE_NO": pl.String,
                "INVOICE_COM": pl.String,
                "INVOICE_DOC_TYPE": pl.String,
                "INVOICE_USER": pl.String,
                "INVOICE_TIME": pl.Int64,
                "DO_COM": pl.String,
                "DO_TYPE": pl.String,
                "DO_NO": pl.String,
                "DO_LINE_ID": pl.String,
                "ROUTE_CODE": pl.String,
                "DUTY_STATUS": pl.String,
                "UOM": pl.String,
                "EBP_PROD": pl.String,
                "HOLD_CODE": pl.String,
                "SENDER_MOBILE": pl.String,
                "JDE_TRUCK_NO": pl.String,
                "JDE_TRUCK_RTKM": pl.Float64,
                "JDE_TRUCK_LOADNO": pl.String,
                "UNIT_PRICE": pl.Float64,
                "UNIT_PRICE_UOM": pl.String,
                "SHIP_TO": pl.String,
                "INVOICE_DATE": pl.Datetime,
                "SALES_ORDER_MESSAGE": pl.String,
                "SOLD_TO": pl.String,
                "JDE_CARRIER_CODE": pl.String
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
            table_name="INDENT_PRODUCTS",
            records=ro_data,
            conflict_columns=["LOCN_CODE", "INDENT_NO", "PROD"]
        )

        # history data
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get(
            "hpcl_ceg", "1")
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'upsert_data'
        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        # resp = await function(
        #     schema_name="IMS_SAP",
        #     table_name="INDENT_PRODUCTS_HISTORY",
        #     records=ro_data,
        #     conflict_columns=["LOCN_CODE", "INDENT_NO", "PROD", "run_id"]
        # )
        return {"status": True, "message": "Data Synced Successfully", "data": []}
    except Exception as e:
        print(traceback.format_exc())
        logger.error(f"Error in sync_ims_indent_products: {str(e)}")
        return {"status": False, "message": "Data Sync Failed", "data": e}

if __name__ == "__main__":
    asyncio.run(sync_ims_indent_products())