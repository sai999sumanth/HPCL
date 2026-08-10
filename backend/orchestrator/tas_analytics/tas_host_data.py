import urdhva_base
import polars as pl
import hpcl_ceg_model
import json
from datetime import timedelta
import asyncio
from types import SimpleNamespace


async def fetch_host_tables_as_dfs(data):

    # ---------------------------
    # Build base conditions
    # ---------------------------
    conditions = []
    bay_filter_values = []  # NEW: capture bay filter separately

    if data.filters:
        for f in data.filters:

            if not f.value:
                continue

            # -----------------------
            # NEW: Handle bay filter
            # -----------------------
            if f.key == "bay":
                if isinstance(f.value, str):
                    bay_filter_values = [v.strip() for v in f.value.split(",") if v.strip()]
                else:
                    bay_filter_values = [v for v in f.value if v]
                continue  # Don't add to SQL conditions

            # -----------------------
            # Handle date range
            # -----------------------
            if f.key == "start_date":

                start_date = f.value if isinstance(f.value, str) else f.value[0]

                end_date_obj = next(
                    (x.value for x in data.filters if x.key == "end_date" and x.value),
                    None
                )

                end_date = (
                    end_date_obj if isinstance(end_date_obj, str)
                    else end_date_obj[0] if end_date_obj else None
                )

                if start_date and end_date:
                    conditions.append(
                        f"created_at::date BETWEEN '{start_date}' AND '{end_date}'"
                    )

                continue

            if f.key == "end_date":
                continue

            # -----------------------
            # Other filters
            # -----------------------
            if isinstance(f.value, str):

                #  If comma separated string → split it
                if "," in f.value:
                    clean_values = [v.strip() for v in f.value.split(",") if v.strip()]
                else:
                    clean_values = [f.value]

            else:
                clean_values = [v for v in f.value if v]

            if not clean_values:
                continue

            if f.cond == "=":
                if len(clean_values) == 1:
                    conditions.append(f"{f.key} = '{clean_values[0]}'")
                else:
                    values = ", ".join(f"'{v}'" for v in clean_values)
                    conditions.append(f"{f.key} IN ({values})")

            elif f.cond == "!=":
                if len(clean_values) == 1:
                    conditions.append(f"{f.key} != '{clean_values[0]}'")
                else:
                    values = ", ".join(f"'{v}'" for v in clean_values)
                    conditions.append(f"{f.key} NOT IN ({values})")

    query_str = " AND ".join(conditions) if conditions else "1=1"
    params = urdhva_base.queryparams.QueryParams(q=query_str, limit=0)

    alerts_query = (
        "alert_section = 'TAS' "
        "AND interlock_name NOT ILIKE '%BCU Permissive Off%'"
    )
    if conditions:
        alerts_query += " AND " + " AND ".join(conditions)

    alerts_params = urdhva_base.queryparams.QueryParams(
        q=alerts_query,
        fields=json.dumps([
            "sap_id", "location_name", "device_name",
            "device_type", "created_at",
            "equipment_name", "interlock_name",
            "vehicle_number", "closed_at"
        ])
    )
    alerts_params.limit = 0

    day_end_params = urdhva_base.queryparams.QueryParams(
        q=query_str,
        fields=json.dumps([
            "created_at", "bcu_number", "bay_number", "invoiced_qty", "location_name",
            "bcu_net_totalizer", "mfm_net_totalizer", "bcu_start_totalizer",
            "bcu_end_totalizer", "invoiced_bcu_net_qty_diff", "bcu_mfm_net_totalizer_diff"
        ])
    )
    day_end_params.limit = 0

    unauthorised_flow_params = urdhva_base.queryparams.QueryParams(
        q=query_str,
        fields=json.dumps([
            "bay_number", "bcu_number", "net_totalizer", "created_at",
            "location_name", "zone", "start_totalizer", "end_totalizer"
        ])
    )
    unauthorised_flow_params.limit = 0

    local_loaded_params = urdhva_base.queryparams.QueryParams(
        q=query_str,
        fields=json.dumps([
            "bay_number", "bcu_number", "recipe_name",
            "truck_number", "loaded_qty", "location_name", "created_at"
        ])
    )
    local_loaded_params.limit = 0

    # ---------------------------
    # Fetch Data
    # ---------------------------
    # bay_resp = await hpcl_ceg_model.HostBayReAssignment.get_all(params, resp_type="plain")
    # local_loaded_resp = await hpcl_ceg_model.HostLocalLoadedTts.get_all(params, resp_type="plain")
    # over_loaded_resp = await hpcl_ceg_model.HostOverLoadedTts.get_all(params, resp_type="plain")
    # day_end_resp = await hpcl_ceg_model.HostDayEndDetails.get_all(day_end_params, resp_type="plain")
    # alerts_resp = await hpcl_ceg_model.Alerts.get_all(alerts_params, resp_type="plain")
    # unauthorised_flow_resp = await hpcl_ceg_model.HostUnauthorisedFlow.get_all(unauthorised_flow_params, resp_type="plain")

    (
        bay_resp,
        local_loaded_resp,
        over_loaded_resp,
        day_end_resp,
        alerts_resp,
        unauthorised_flow_resp,
    ) = await asyncio.gather(
        hpcl_ceg_model.HostBayReAssignment.get_all(params, resp_type="plain"),
        hpcl_ceg_model.HostLocalLoadedTts.get_all(local_loaded_params, resp_type="plain"),
        hpcl_ceg_model.HostOverLoadedTts.get_all(params, resp_type="plain"),
        hpcl_ceg_model.HostDayEndDetails.get_all(day_end_params, resp_type="plain"),
        hpcl_ceg_model.Alerts.get_all(alerts_params, resp_type="plain"),
        hpcl_ceg_model.HostUnauthorisedFlow.get_all(unauthorised_flow_params, resp_type="plain"),
    )

    # ---------------------------
    # Build DataFrames
    # ---------------------------
    bay_df = pl.DataFrame(bay_resp.get("data", []))
    local_loaded_df = pl.DataFrame(local_loaded_resp.get("data", []))
    over_loaded_df = pl.DataFrame(over_loaded_resp.get("data", []))
    day_end_df = pl.DataFrame(day_end_resp.get("data", []))
    alerts_df = pl.DataFrame(alerts_resp.get("data", []))

    unauthorised_flow_data = unauthorised_flow_resp.get("data", [])
    if unauthorised_flow_data:
        for row in unauthorised_flow_data:
            for field in ["net_totalizer", "start_totalizer", "end_totalizer"]:
                if field in row and row[field] is not None:
                    row[field] = round(float(row[field]), 2)
    unauthorised_flow_df = pl.DataFrame(unauthorised_flow_data)

    # Filter out rows where net_totalizer is 0 or null
    if len(unauthorised_flow_df) > 0 and "net_totalizer" in unauthorised_flow_df.columns:
        unauthorised_flow_df = unauthorised_flow_df.filter(
            pl.col("net_totalizer").is_not_null() & (pl.col("net_totalizer") > 0)
        )

    # Filter unauthorised_flow_df by bay if bay filter provided
    if bay_filter_values and len(unauthorised_flow_df) > 0 and "bay_number" in unauthorised_flow_df.columns:
        padded_bays = [b.zfill(2) for b in bay_filter_values]
        unauthorised_flow_df = unauthorised_flow_df.filter(
            pl.col("bay_number").cast(pl.Utf8).str.zfill(2).is_in(padded_bays)
        )

    # ---------------------------
    # BCU / Active Bay Counts
    # ---------------------------
    total_bcu_count = 0
    total_active_bays_count = 0

    if len(day_end_df) > 0 and "bcu_start_totalizer" in day_end_df.columns and "bcu_end_totalizer" in day_end_df.columns:
        day_end_df = day_end_df.with_columns([
            pl.col("bcu_start_totalizer").cast(pl.Float64),
            pl.col("bcu_end_totalizer").cast(pl.Float64),
        ])
        grouped_df = (
            day_end_df.group_by(["bay_number", "bcu_number"]).agg([
                pl.col("bcu_start_totalizer").sum().alias("sum_start"),
                pl.col("bcu_end_totalizer").sum().alias("sum_end"),
            ])
            .with_columns((pl.col("sum_end") - pl.col("sum_start")).abs().alias("total_difference"))
        )
        total_bcu_count = grouped_df.height
        total_active_bays_count = grouped_df.filter(pl.col("total_difference") > 100).height

    # ---------------------------
    # Enrich DataFrames
    # ---------------------------
    if len(bay_df) > 0:
        bay_df = bay_df.with_columns(pl.lit('HostBayReAssignment').alias("table_name"))
        bay_df = bay_df.filter(pl.col("reassigned_bay").is_not_null() & (pl.col("reassigned_bay") != ""))

    if len(local_loaded_df) > 0:
        local_loaded_df = local_loaded_df.with_columns(pl.lit('HostLocalLoaded').alias("table_name"))
        if "truck_number" in local_loaded_df.columns:
            local_loaded_df = local_loaded_df.with_columns(
                pl.col("truck_number").str.strip_chars().str.replace_all(r"\s+", "").alias("truck_number")
            )

    if len(over_loaded_df) > 0:
        over_loaded_df = over_loaded_df.with_columns(pl.lit('HostOverLoaded').alias("table_name"))

    # Process alerts_df if it has data
    if len(alerts_df) > 0:
        alerts_df = alerts_df.unique(subset=["vehicle_number", "created_at"])
        if "device_name" in alerts_df.columns:
            alerts_df = alerts_df.with_columns(pl.col("device_name").str.extract(r"BC-(\d{2,3})[A-Za-z]?", 1).alias("bay_number"))
        if bay_filter_values and "bay_number" in alerts_df.columns:
            padded_bays = [b.zfill(2) for b in bay_filter_values]
            alerts_df = alerts_df.filter(pl.col("bay_number").is_in(padded_bays))

    # Process day_end_df
    if len(day_end_df) > 0 and "bay_number" in day_end_df.columns:
        day_end_df = day_end_df.with_columns(pl.col("bay_number").str.zfill(2).alias("bay_number_extracted"))
    if bay_filter_values and len(day_end_df) > 0 and "bay_number_extracted" in day_end_df.columns:
        padded_bays = [b.zfill(2) for b in bay_filter_values]
        day_end_df = day_end_df.filter(pl.col("bay_number_extracted").is_in(padded_bays))

    # Rename columns before concat
    if len(local_loaded_df) > 0 and "bay_number" in local_loaded_df.columns:
        local_loaded_df = local_loaded_df.rename({'bay_number': 'assigned_bay', 'recipe_name': 'product_name'})
    if len(over_loaded_df) > 0 and "bay_number" in over_loaded_df.columns:
        over_loaded_df = over_loaded_df.rename({'bay_number': 'assigned_bay'})

    # ---------------------------
    # Combine DataFrames
    # ---------------------------
    combined_df = pl.concat([bay_df, local_loaded_df, over_loaded_df], how="diagonal_relaxed")

    if len(combined_df) > 0:

        # Truck number validation
        if "truck_number" in combined_df.columns:
            combined_df = combined_df.with_columns(
                pl.col("truck_number").str.strip_chars().str.replace_all(r"\s+", "").alias("truck_number")  # ← strip before validate
            )
            combined_df = combined_df.filter(
                (pl.col("truck_number").str.len_chars() >= 9) &
                pl.col("truck_number").str.contains(r"[A-Z]") &
                pl.col("truck_number").str.contains(r"[0-9]") &
                pl.col("truck_number").str.contains(r"^[A-Z0-9]+$")
            )

        # Bay filter on combined_df
        if bay_filter_values and "assigned_bay" in combined_df.columns:
            padded_bays = [b.zfill(2) for b in bay_filter_values]
            combined_df = combined_df.filter(
                pl.col("assigned_bay").cast(pl.Utf8).str.zfill(2).is_in(padded_bays)
            )

        if "loaded_qty" in combined_df.columns:
            combined_df = combined_df.with_columns(
                pl.col("loaded_qty").sum().over(["truck_number", "created_at"]).alias("cumulative_loaded_qty")
            )

        combined_df = combined_df.unique(subset=["truck_number", "created_at", "table_name", "assigned_bay"])

        if len(alerts_df) > 0 and "bay_number" in alerts_df.columns:
            bcu_alerts = (
                alerts_df
                .filter(pl.col("equipment_name") == "BCU")
                .with_columns(pl.col("created_at").cast(pl.Date).alias("_date"))
                .unique(subset=["created_at", "bay_number", "interlock_name"])
                .group_by(["_date", "bay_number"])
                .agg(pl.len().alias("Alerts_Count"))
                .rename({"bay_number": "_bay"})
            )
            combined_df = (
                combined_df
                .with_columns([
                    pl.col("created_at").cast(pl.Date).alias("_date"),
                    pl.col("assigned_bay").cast(pl.Utf8).str.zfill(2).alias("_bay")
                ])
                .join(bcu_alerts, on=["_date", "_bay"], how="left")
                .with_columns(pl.col("Alerts_Count").fill_null(0).cast(pl.Int64))
                .drop(["_date", "_bay"])
            )
        else:
            combined_df = combined_df.with_columns(pl.lit(0).cast(pl.Int64).alias("Alerts_Count"))

        if len(alerts_df) > 0:
            gantry_by_date = (
                alerts_df
                .filter(
                    pl.col("interlock_name").str.contains("Gantry Permissive Off") &
                    ~pl.col("interlock_name").str.contains("Fail")
                )
                .with_columns(pl.col("created_at").cast(pl.Date).alias("_date"))
                .unique(subset=["created_at", "interlock_name"])
                .group_by("_date")
                .agg(pl.len().alias("Gantry_Permissive_off_Count"))
            )
            combined_df = (
                combined_df
                .with_columns(pl.col("created_at").cast(pl.Date).alias("_date"))
                .join(gantry_by_date, on="_date", how="left")
                .with_columns(pl.col("Gantry_Permissive_off_Count").fill_null(0).cast(pl.Int64))
                .drop("_date")
            )
        else:
            combined_df = combined_df.with_columns(pl.lit(0).cast(pl.Int64).alias("Gantry_Permissive_off_Count"))

        if len(day_end_df) > 0 and "bay_number_extracted" in day_end_df.columns:
            mfm_by_bay_date = (
                day_end_df
                .with_columns(pl.col("created_at").cast(pl.Date).alias("_date"))
                .group_by(["_date", "bay_number_extracted"])
                .agg((pl.col("mfm_net_totalizer").cast(pl.Float64).sum() - pl.col("bcu_net_totalizer").cast(pl.Float64).sum()).alias("MFM_VS_BCU")).rename({"bay_number_extracted": "_bay"}))
            combined_df = (
                combined_df
                .with_columns([
                    pl.col("created_at").cast(pl.Date).alias("_date"),
                    pl.col("assigned_bay").cast(pl.Utf8).str.zfill(2).alias("_bay")
                ])
                .join(mfm_by_bay_date, on=["_date", "_bay"], how="left")
                .with_columns(pl.col("MFM_VS_BCU").fill_null(0.0).cast(pl.Float64))
                .drop(["_date", "_bay"])
            )
        else:
            combined_df = combined_df.with_columns(pl.lit(0.0).cast(pl.Float64).alias("MFM_VS_BCU"))

        # BCU_VS_INVOICE already computed in day_end_df as invoiced_bcu_net_qty_diff
        combined_df = combined_df.with_columns(pl.lit(0.0).cast(pl.Float64).alias("BCU_VS_INVOICE"))
        combined_df = combined_df.with_columns(pl.lit('NO').alias('Cross checked ManuallyAP system'))

        if "table_name" in combined_df.columns and "loaded_qty" in combined_df.columns and "required_qty" in combined_df.columns:
            combined_df = combined_df.with_columns(pl.when(pl.col('table_name') == 'HostOverLoaded').then(pl.col('loaded_qty') - pl.col('required_qty'))
                .otherwise(None).alias('overloaded_qty'))

        combined_df = combined_df.with_columns(pl.col("created_at").cast(pl.Date).alias("created_date"))
        combined_df = combined_df.filter(pl.col("assigned_bay").is_not_null() & (pl.col("assigned_bay") != ""))
        combined_df = combined_df.sort(["table_name", "created_date", "truck_number", "load_number", "assigned_bay", "created_at"])
        combined_df = combined_df.unique(subset=["table_name", "created_date", "truck_number", "load_number", "assigned_bay"],keep="first").drop("created_date")

        required_columns = ['truck_number', 'created_at', 'zone', 'sap_id', 'location_name', 'load_number','product_name', 'required_qty', 
                            'loaded_qty', 'overloaded_qty','cumulative_loaded_qty', 'assigned_bay', 'reassigned_bay', 'table_name']
        for col in required_columns:
            if col not in combined_df.columns:
                combined_df = combined_df.with_columns(pl.lit(None).alias(col))

        combined_df = combined_df[['truck_number', 'created_at', 'zone', 'sap_id', 'location_name', 'load_number','product_name', 'required_qty', 'loaded_qty', 'overloaded_qty', 'cumulative_loaded_qty',
            'assigned_bay', 'reassigned_bay', 'Alerts_Count', 'Gantry_Permissive_off_Count','MFM_VS_BCU', 'BCU_VS_INVOICE', 'Cross checked ManuallyAP system', 'table_name']]
        

    return combined_df, alerts_df, day_end_df, total_bcu_count, total_active_bays_count, unauthorised_flow_df
