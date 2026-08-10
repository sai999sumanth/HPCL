import urdhva_base
import asyncio
import polars as pl
import hpcl_ceg_model
import charts_actions
import dashboard_studio_model
import utilities.connection_mapping as connection_mapping
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams



async def sync_old_nozzles_data():
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("cris")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    query = f"""select * FROM "HPCL_HOS".fetch_yesterdaysales_sitewise_vw"""
    nozzles_resp = await function(query=query)
    df = pl.DataFrame(nozzles_resp)

    print('*'*200)
    print('Initial Data',df.height)
    print('*'*200)

    # -------------------------------------------------
    # 2. Normalize & parse Transaction_Date (SAFE)
    # -------------------------------------------------
    ro_data = df.with_columns([
        pl.when(
            # Case 1: YYYY-MM-DD (date only)
            pl.col("Transaction_Date")
              .cast(pl.Utf8, strict=False)
              .str.contains(r"^\d{4}-\d{2}-\d{2}$")
        )
        .then(
            pl.col("Transaction_Date")
              .cast(pl.Utf8, strict=False)
              .str.strptime(pl.Date, "%Y-%m-%d", strict=False)
              .cast(pl.Datetime)
        )
        .when(
            # Case 2: YYYY-MM-DD HH:MM:SS(.micro)
            pl.col("Transaction_Date")
              .cast(pl.Utf8, strict=False)
              .str.contains(r"^\d{4}-\d{2}-\d{2}\s")
        )
        .then(
            pl.col("Transaction_Date")
              .cast(pl.Utf8, strict=False)
              .str.strptime(pl.Datetime, "%Y-%m-%d %H:%M:%S%.f", strict=False)
        )
        .otherwise(
            # Case 3: DD-MM-YYYY HH:MM:SS
            pl.col("Transaction_Date")
              .cast(pl.Utf8, strict=False)
              .str.strptime(pl.Datetime, "%d-%m-%Y %H:%M:%S", strict=False)
        )
        .alias("Transaction_Date"),

        # -------- Sales Volume (safe for float/string)
        pl.col("Sales_Volume")
          .cast(pl.Utf8, strict=False)
          .str.strip_chars()
          .str.replace_all(",", "")
          .cast(pl.Float64, strict=False)
          .alias("Sales_Volume"),

        # -------- IDs
        pl.col("ROSAPCode").cast(pl.Utf8, strict=False),
        pl.col("ROCode").cast(pl.Utf8, strict=False),
    ])

    # -------------------------------------------------
    # 3. Rename & drop unwanted columns
    # -------------------------------------------------
    ro_data = ro_data.rename({"ROSAPCode": "sap_id"})

    drop_cols = ["Zone", "Region", "Salesarea", "ROName"]
    ro_data = ro_data.drop([c for c in drop_cols if c in ro_data.columns])

    # -------------------------------------------------
    # 4. Fetch location master
    # -------------------------------------------------
    location_query = """
        SELECT sap_id, zone, region, name, sales_area
        FROM location_master
        WHERE bu = 'RO'
    """
    location_resp = await hpcl_ceg_model.LocationMaster.get_aggr_data(
        location_query,
        limit=0
    )

    loc_df = pl.DataFrame(location_resp["data"]).with_columns(
        pl.col("sap_id").cast(pl.Utf8, strict=False)
    )

    # -------------------------------------------------
    # 5. Join
    # -------------------------------------------------
    final_df = ro_data.join(loc_df, on="sap_id", how="left")

    # -------------------------------------------------
    # 6. Final rename
    # -------------------------------------------------
    final_df = final_df.rename({
        "ROCode": "site_id",
        "Transaction_Date": "transaction_date",
        "Sales_Volume": "sales_volume",
        "name": "location_name"
    })

    # -------------------------------------------------
    # 7. Validate dates (NOW WORKING)
    # -------------------------------------------------
    bad_rows = final_df.filter(pl.col("transaction_date").is_null())
    print(f"Bad date rows: {bad_rows.height}")

    final_df = final_df.filter(pl.col("transaction_date").is_not_null())

    # -------------------------------------------------
    # 8. Debug
    # -------------------------------------------------
    print("*" * 160)
    print("Rows to insert:", final_df.height)
    print("Date sample:")
    print(final_df.select("transaction_date").head(5))
    print("*" * 160)

    # -------------------------------------------------
    # 9. Upsert
    # -------------------------------------------------
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = (
        connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    )
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = "upsert_data"

    function = await charts_actions.charts_connection_vault_routing(
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams
    )

    print('*'*200)
    print('nozzles_resp',final_df)
    print('*'*200)

    resp = await function(
        schema_name="public",
        table_name="nozzle_sales",
        records=final_df,
        conflict_columns=["transaction_date", "sap_id", "product_grp"]
    )

    return {
        "status": True,
        "inserted_rows": final_df.height,
        "response": resp,
    }

if __name__ == "__main__":
    asyncio.run(sync_old_nozzles_data())
