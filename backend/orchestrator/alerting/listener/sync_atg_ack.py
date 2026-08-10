import urdhva_base
import datetime
import pytz
import pandas as pd
import polars as pl
import charts_actions
import dashboard_studio_model
import utilities.connection_mapping as connection_mapping


async def cris_product_mapping():
    product_mapping = {
        "3672000": "POWER 95",
        "2821000": "MS",
        "3925000": "POWER 95",
        "2812000": "HSD",
        "3373000": "POWER 100",
        "1683000": "HSD",
        "4211000": "MS",
        "1322100": "POWER 95",
        # "2822000": "E20",
        "2822000": "MS",
        "1683100": "TURBO",
        "1322000": "MS",
        "2823000": "MS",
        "2682000": "POWER 99",
        "2811000": "MS",
        "3912000": "TURBO",
        "2816000": "POWER 99"
    }
    return product_mapping

async def sync_atg_ack():
    """
    This function extracts today’s delivery records from CRIS, maps CRIS product codes
    to product names, adds a UTC sync timestamp, and loads the transformed dataset into
    `HPCL_HOS.atg_ack_confirmation` in the Novex database.

    Source tables: (CRIS DB)
        - HPCL_HOS.tr_delivery_data (trd)
        - HPCL_HOS.ms_site (ms)

    Target table: (NOVEX DB)
        - HPCL_HOS.atg_ack_confirmation

    Process:
        1. Extract records for the current UTC date with valid volume and enabled status
        2. Transform product numbers to item names using a predefined mapping
        3. Add `sync_time` as a timezone-naive UTC timestamp
        4. Recreate the target table and load the transformed data

    Notes:
        - The target table is dropped and recreated on each run
        - Historical data is not retained
        - Uses asynchronous database operations
    """

    try:

        to_day = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")

        # ======================================
        # Fetch Data From CRIS
        # ======================================

        query = f"""
            SELECT
                trd.site_id,
                ms.erp_code AS sap_ro_code,
                trd.tank_no,
                trd.product_no,
                trd.product_no AS item_name,
                trd.recptentrydate
            FROM "HPCL_HOS".tr_delivery_data trd
            JOIN "HPCL_HOS".ms_site ms
                ON trd.site_id = ms.site_id
            WHERE trd.enable = true
              AND trd.net_volume > 0
              AND trd.recptentrydate::date = '{to_day}'
              AND ms.erp_code IS NOT NULL
        """

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = (
            connection_mapping.connection_mapping.get("cris", "1")
        )
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = "execute_query"
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)

        atg_resp = await function(query=query)

        # ======================================
        # Convert To DataFrame
        # ======================================
        atg_resp = pd.DataFrame(atg_resp)
        print("atg_resp ----->\n", atg_resp)
        if atg_resp.empty:

            return {
                "status": True,
                "message": "No Records Found",
                "data": []
            }

        # ======================================
        # Product Mapping
        # ======================================
        atg_resp["item_name"] = (atg_resp["item_name"].astype(str))

        atg_resp.replace(
            {
                "item_name":
                await cris_product_mapping()
            },
            inplace=True
        )
        
        sync_time = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

        atg_resp["sync_time"] = sync_time

        # ======================================
        # Schema
        # ======================================
        atg_schema = {
            "site_id": pl.String,
            "sap_ro_code": pl.String,
            "tank_no": pl.Int64,
            "product_no": pl.Int64,
            "item_name": pl.String,
            "recptentrydate": pl.Datetime,
            "sync_time": pl.Datetime
        }

        atg_resp = pl.DataFrame(atg_resp, schema=atg_schema)

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams
        )

        # drop the table before upsert
        drop_query="""DROP TABLE IF EXISTS "HPCL_HOS".atg_ack_confirmation"""

        create_query = """
            CREATE TABLE "HPCL_HOS".atg_ack_confirmation (
                site_id TEXT,
                sap_ro_code TEXT,
                tank_no BIGINT,
                product_no BIGINT,
                item_name TEXT,
                recptentrydate TIMESTAMP,
                sync_time TIMESTAMP,
                CONSTRAINT uk_atg_ack UNIQUE (site_id, sap_ro_code, item_name)
            );
            """
        
        # Delete table
        await function(query=drop_query)
        # Create table
        await function(query=create_query)

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = "upsert_data"
        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        
        await function(
            schema_name="HPCL_HOS",
            table_name="atg_ack_confirmation",
            records=atg_resp.to_dicts(),
            conflict_columns=[
                "site_id",
                "sap_ro_code",
                "item_name"
            ]
        )
        return {
            "status": True,
            "message": "ATG ACK Sync Completed Successfully",
            "data": []
        }

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return {
            "status": False,
            "message": str(e),
            "data": []
        }
    

if __name__ == "__main__":
    import asyncio
    asyncio.run(sync_atg_ack())
