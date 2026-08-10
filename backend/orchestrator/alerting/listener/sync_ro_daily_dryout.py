import urdhva_base
import pytz
import os
import jinja2
import asyncio
import traceback
import datetime
import polars as pl
import pandas as pd
import hpcl_ceg_model
import charts_actions
import dashboard_studio_model
import utilities.connection_mapping as connection_mapping
import orchestrator.notification_manager.notification_factory


logger = urdhva_base.logger.Logger.getInstance("dry_out_sync")

async def indent_sync_ro_daily_dryout():
    try:
        ro_query = f"""SELECT * FROM "HPCL_HOS".sch_inventory_forecast_dashboard """
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get(
            "cris", "1")  # 1  ro_master
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        ro_data = await function(query=ro_query)
        ro_data_schema = {
            "site_id": pl.String, "fcc_code": pl.String, "tank_no": pl.Int64,
            "product_no": pl.Int64, "item_name": pl.String, "capacity": pl.Int64,
            "volume": pl.Float64, "ullage": pl.Float64, "avgsales_7days": pl.String,
            "stock_date": pl.Datetime, "status": pl.Int64, "daysstatus": pl.Int64,
            "sap_color": pl.String, "lastrocdate": pl.Datetime, "executed_on": pl.Datetime,
            "executed_by": pl.String, "pumpable_stock": pl.Float64, "rosapcode": pl.String,
            "product_grp": pl.String, "product_sap_color": pl.String
        }
        ro_data = pd.DataFrame(ro_data)
        schema_cols = set(ro_data_schema.keys())
        present_cols = set(ro_data.columns)
        # Find extra/unwanted columns
        extra_cols = present_cols - schema_cols
        # Drop them
        ro_data.drop(columns=list(extra_cols), inplace=True)
        _list_column = ['site_type', 'is_abhyuday', 'receipt_grp', 'dead_stock']
        for col in _list_column:
            if col in ro_data.columns:
                del ro_data[col]
        ro_data = pl.DataFrame(ro_data, schema=ro_data_schema)
        ist = pytz.timezone('Asia/Kolkata')
        sync_date = datetime.datetime.now(ist).strftime("%y%m%d-%H") + "00"
        ro_data = ro_data.with_columns(pl.lit(sync_date).alias("run_id"))

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get(
            "hpcl_ceg", "1")
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'upsert_data'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        resp = await function(
            schema_name="HPCL_HOS",
            table_name="sch_inventory_forecast_dashboard",
            records=ro_data.to_dicts(),
            conflict_columns=["site_id", "fcc_code", "product_no", "tank_no", "run_id"]
        )

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams
        )

        # drop the table before upsert
        await function(query="""DROP TABLE IF EXISTS public.sch_inventory_forecast_dashboard_latest""")
        print("drop query")

        # create table before upsert
        create_query = """CREATE TABLE public.sch_inventory_forecast_dashboard_latest (LIKE "HPCL_HOS".sch_inventory_forecast_dashboard INCLUDING ALL);"""
        print("query for creating the table ---->\n", create_query)

        await function(query=create_query)
        print("create query")
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'upsert_data'

        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams
        )

        await function(
            schema_name="public",
            table_name="sch_inventory_forecast_dashboard_latest",
            records=ro_data.to_dicts(),
            conflict_columns=["site_id", "fcc_code", "product_no", "tank_no", "run_id"]
        )

        return {"status": True, "message": "Data Synced Successfully", "data": []}
    
    except Exception as e:
        tb = traceback.format_exc()
        logger.error("Data Sync Failed.")
        date = urdhva_base.utilities.get_present_time()
        formatted = date.strftime("%d %b %Y, %I:%M %p")
        final_data = {
            "generated_time": formatted,
            "error_message": repr(e),
            "traceback": tb
        }
        print("final data ----<>\n", final_data)
        await send_email(
        template_name="dryout_sync_failure.html",
            to_recipients=["sreedhar.maddipati@algofusiontech.com","bala@algofusiontech.com"],
            cc_recipients=["venu@algofusiontech.com", "moufikali@algofusiontech.com", "aditya@algofusiontech.com", "yesu.p@algofusiontech.com", "vamsi.c@algofusiontech.com"],
            bcc_recipients=["manohar.v@algofusiontech.com", "gayathri.m@algofusiontech.com", "mohith.p@algofusiontech.com", 
                        "poojitha.gumma@algofusiontech.com", "pawann.k@algofusiontech.com"],
            subject="Daily Sync Failed - Dryout Raw Data",
            final_data=final_data
        )
        return {"status": False, "message": "Data Sync Failed", "data": repr(e)}


async def send_email(template_name, to_recipients, subject, cc_recipients, bcc_recipients,  final_data=None, attachments=None):
    ins = await orchestrator.notification_manager.notification_factory.get_notification_module("email")

    # Load HTML template
    template_path = os.path.join(
        os.path.dirname(hpcl_ceg_model.__file__),
        '..', 'orchestrator', 'reporting_services',
        'templates', template_name
        )

    with open(template_path, "r") as f:
        template = jinja2.Template(f.read())

    html_body = template.render(**final_data)

    # Send email
    await ins.publish_message(
        subject=subject,
        recipients=to_recipients if to_recipients else [],
        cc_recipients=cc_recipients if cc_recipients else [],
        bcc_recipients= bcc_recipients if bcc_recipients else [],
        html_content=True,
        body=html_body,
        force_send=True,
        inline_images={},
        attachments=attachments or []
    )



if __name__ == "__main__":
    asyncio.run(indent_sync_ro_daily_dryout())
