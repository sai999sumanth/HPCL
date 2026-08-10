import urdhva_base
import pytz
import asyncio
import datetime
import traceback
import polars as pl
import charts_actions
import dashboard_studio_model
import utilities.connection_mapping as connection_mapping

logger = urdhva_base.logger.Logger.getInstance("ims_truck_details_sync")

async def sync_ims_truck_details():
    try:
        ro_query = f"""SELECT "LOCN_CODE", "TRUCK_REGNNO", "RECORD_STATUS", "BASE_LOCN" FROM "IMS_SAP"."TRUCK_DETAILS" """
        charts_ins = dashboard_studio_model.Charts_Connection_Vault_RoutingParams(
            connection_id=connection_mapping.connection_mapping.get("ims", "1"),
            action='execute_query'
        )
        function = await charts_actions.charts_connection_vault_routing(charts_ins)
        ro_data = await function(query=ro_query)
        ro_data_schema = {
            "LOCN_CODE": pl.String,
            "TRUCK_REGNNO": pl.String,
            "RECORD_STATUS": pl.String,
            "BASE_LOCN": pl.String
        }
        ro_data = pl.DataFrame(ro_data, schema=ro_data_schema)
        ro_data = ro_data.with_columns(
            group_size=pl.count().over("TRUCK_REGNNO"),
            consistent_base=pl.col("BASE_LOCN").drop_nulls().first().over("TRUCK_REGNNO"),
            locn_code_from_a=pl.when(pl.col("RECORD_STATUS") == "A")
            .then(pl.col("LOCN_CODE"))
            .otherwise(None)
            .max()
            .over("TRUCK_REGNNO"),
            non_null_base_count=pl.col("BASE_LOCN").is_not_null().sum().over("TRUCK_REGNNO")
        ).with_columns(
            BASE_LOCN=pl.when(
                (pl.col("BASE_LOCN").is_null()) &
                (pl.col("consistent_base").is_not_null()) &
                (pl.col("group_size") > 1)
            )
            .then(pl.col("consistent_base"))
            .when(
                (pl.col("group_size") > 1) &
                (pl.col("non_null_base_count") == 0)
            )
            .then(pl.col("locn_code_from_a"))
            .when(
                (pl.col("group_size") == 1) &
                (pl.col("BASE_LOCN").is_null())
            )
            .then(pl.col("LOCN_CODE"))
            .otherwise(pl.col("BASE_LOCN"))
        ).drop(["group_size", "consistent_base", "locn_code_from_a", "non_null_base_count"])

        charts_ins = dashboard_studio_model.Charts_Connection_Vault_RoutingParams(
            connection_id=connection_mapping.connection_mapping.get("hpcl_ceg", "1"),
            action='upsert_data'
        )
        function = await charts_actions.charts_connection_vault_routing(charts_ins)
        resp = await function(
            schema_name="IMS_SAP",
            table_name="VTS_TRUCK_DETAILS",
            records=ro_data,
            conflict_columns=["LOCN_CODE", "TRUCK_REGNNO"]
        )
        return {"status": True, "message": "Data Synced Successfully", "data": []}
    except Exception as e:
        print(traceback.format_exc())
        logger.error(f"Error in sync_ims_dealer_details: {e}")
        return {"status": False, "message": "Data Sync Failed", "data": e}

if __name__ == "__main__":
    asyncio.run(sync_ims_truck_details())