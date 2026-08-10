"""
Novex - Field Force orchestrator (Dry-Out under Novex).
Functional schema for DryOutManagement APIs. No implementation.
"""
import urdhva_base
import field_force_model
from typing import List, Optional
import hpcl_ceg_model
import polars as pl
from datetime import datetime, timedelta
import traceback
import charts_actions
import dashboard_studio_model
import orchestrator.field_force.territory_mapping.zone_mapping as zone_mapping
import orchestrator.field_force.territory_mapping.product_mapping as product_mapping

# dry_out_type in data (WidgetFiltersCreate): 0 = dry-out, 1 = Intra dry-out

async def get_dry_out_locations(
    data: field_force_model.WidgetFiltersCreate,
    by_product: bool = False,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
):
    """
    Total dry-out locations; optionally by product. Drill-down to locations.

    Input:
        data: field_force_model.WidgetFiltersCreate (include dry_out_type: 0 or 1 as filter if needed).
        by_product: if True, break summary by product.
        drill_filter: optional {"drill_to": "locations"}.
    Output:
        {"summary": [{"location_id"?, "product_code"?, "dry_out_count", "dry_out_type", ...}],
         "drill_down": [{"location_id", "location_name", "product_code", "dry_out_date", ...}] or None,
         "total": int?, "drill_to": str?, "by_product": bool}
    """
    pass


async def get_dry_out_indent_analysis(
    data: field_force_model.WidgetFiltersCreate,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
):
    """
    Dry-out indent analysis: with indent / without indent by product;
    Pending vs Executed. Drill-down to locations.

    Input:
        data: field_force_model.WidgetFiltersCreate.
        drill_filter: optional {"drill_to": "locations"}.
    Output:
        {"summary": [{"product_code", "with_indent_count", "without_indent_count",
                     "pending_count", "executed_count", "volume", ...}],
         "drill_down": [{"location_id", "location_name", "product_code", "has_indent", "status", ...}] or None,
         "total": int?, "drill_to": str?}
    """
    pass


async def get_dry_out_indents(
    data: field_force_model.WidgetFiltersCreate,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
):
    """
    Backward-compatible: same as get_dry_out_indent_analysis.
    Dry-out indents analysis with optional drill-down.

    Input:
        data: field_force_model.WidgetFiltersCreate.
        drill_filter: optional DrillFilter.
    Output:
        Same as get_dry_out_indent_analysis.
    """
    pass

async def get_retail_outlet_stockouts(data):
    try:
        where_clause = ["interlock_name = 'Dry Out Each Indent Wise MainFlow'", "dry_out_in_days = '1'", "mark_as_false = 'true'"]
        where_clause.extend(await hpcl_ceg_model.Alerts.get_clause_conditions(
            extra_key_mapping={"sap_id": "terminal_plant_id"}, default_mapping={"bu": "RO"}))
        start_date = None
        end_date = None
        all_conditions = []
        final_where_clause = ""
        if data.cross_filters:
            for filter in data.cross_filters:
                # Handle DATE filter
                if "DATE" in filter.key:
                    if filter.value:
                        dates = filter.value.split(",")
                    elif filter.values:
                        dates = filter.values if isinstance(filter.values, list) else [filter.values]
                    else:
                        continue
                    start_date = dates[0]
                    end_date = datetime.strptime(dates[-1], "%Y-%m-%d").strftime("%Y-%m-%d")
                    continue  # skip to next filter after handling date
                # Handle NON-DATE filters (same logic as filters)
                if filter.values and isinstance(filter.values, list) and len(filter.values) > 0:
                    vals = filter.values
                elif filter.value:
                    vals = filter.value.split(",")
                else:
                    continue
                if len(vals) == 1:
                    condition = f"{filter.key} = '{vals[0]}'"
                else:
                    condition = f"{filter.key} IN {tuple(vals)}"
                all_conditions.append(condition)

        if data.filters:
            conditions = []
            for rec in data.filters:
                # Step 1: Decide source
                if rec.values and isinstance(rec.values, list) and len(rec.values) > 0:
                    vals = rec.values
                elif rec.value:
                    vals = rec.value.split(",")
                else:
                    continue  # skip empty filter
                # Step 2: Build condition
                if len(vals) == 1:
                    condition = f"{rec.key} = '{vals[0]}'"
                else:
                    condition = f"{rec.key} IN {tuple(vals)}"
                conditions.append(condition)
            # Step 3: Merge conditions
            if conditions:
                all_conditions.extend(conditions)
        if where_clause:
            all_conditions.extend(where_clause)
        if all_conditions:
            final_where_clause = " AND " + " AND ".join(all_conditions)
        query_unique_alert = f"""
                                SELECT
                                    lm.zone AS "Zone",
                                    lm.region AS "Region",
                                    lm.sales_area AS "Sales Area",
                                    lm.sap_id AS "Location ID",
                                    lm.name AS "Location Name",
                                    e.id as "Alert ID",
                                    e.alert_history,
                                    e.indent_no as "Indent No",
                                    e.closed_at as "Closed At",
                                    e.updated_at as "Updated At",

                                    -- Dryout Start Time: latest of created_at or dry_out_start_time
                                    e.dry_out_start_time AS "Dryout Start Time",

                                    -- Dryout End Time: only for closed alerts
                                    e.dry_out_end_time as "Dryout End Time",

                                    e.product_code AS "Product Code",

                                    CASE e.product_code
                                        WHEN '2811000' THEN 'MS'
                                        WHEN '2812000' THEN 'HSD'
                                        WHEN '3912000' THEN 'TURBO'
                                        WHEN '2822000' THEN 'E20'
                                        WHEN '3672000' THEN 'POWER 95'
                                        WHEN '2816000' THEN 'POWER 99'
                                        WHEN '3373000' THEN 'POWER 100'
                                        ELSE e.product_code
                                    END AS "Product Name"

                                FROM (
                                    SELECT
                                        sap_id,
                                        id,
                                        product_code,
                                        indent_status,
                                        indent_no,
                                        alert_history,
                                        indent_raised_date,
                                        created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS created_at,
                                        closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS closed_at,
                                        updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS updated_at,
                                        dry_out_start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS dry_out_start_time,
                                        dry_out_end_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS dry_out_end_time,
                                        alert_status
                                    FROM alerts
                                    WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow'
                                    AND bu = 'RO'
                                    AND product_code IN ('2811000', '2812000', '3912000','2822000','3672000','2816000','3373000')
                                    AND dry_out_in_days = '1'
                                    -- Interval starts before or at timestamp
                                    AND dry_out_start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'
                                            <= '{end_date}'

                                    -- Interval ends after timestamp OR has no end
                                    AND (
                                        COALESCE(dry_out_end_time, closed_at, updated_at) IS NULL
                                        OR COALESCE(dry_out_end_time, closed_at, updated_at) >= '{start_date}'
                                    ) 
                                    {final_where_clause}
                                ) AS e

                                JOIN location_master lm
                                    ON e.sap_id = lm.sap_id

                                GROUP BY
                                    lm.zone,
                                    lm.region,
                                    lm.sales_area,
                                    lm.sap_id,
                                    lm.name,
                                    e.id,
                                    e.alert_history,
                                    e.alert_status,
                                    e.indent_raised_date,
                                    e.dry_out_start_time,
                                    e.dry_out_end_time,
                                    e.indent_status,
                                    e.indent_no,
                                    e.product_code,
                                    e.created_at,
                                    e.updated_at,
                                    e.closed_at
                                ORDER BY
                                    lm.zone,
                                    lm.region,
                                    lm.sales_area,
                                    lm.sap_id,
                                    e.product_code,
                                    e.dry_out_start_time,
                                    e.dry_out_end_time,
                                    e.indent_raised_date
                                """
        query_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=query_unique_alert, limit=0)
        query_resp = query_resp.get("data", [])
        alerts_df = pl.DataFrame(query_resp)
        location_master_query = f"SELECT sap_id, zone FROM location_master where bu = 'RO'" 
        location_master_resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=location_master_query, limit=0) 
        location_master_resp = location_master_resp.get("data", [])
        loc_df = pl.DataFrame(location_master_resp)

        if loc_df.is_empty():
            return {"status": True, "message": "No location master data"}
        
        if alerts_df.is_empty():
            return {"status": True, "message": "No Data"}
        
        # DISTINCT base population
        loc_df = loc_df.select(["sap_id", "zone"]).unique()

        if data.action == "retail_outlet_stockout_distribution":
            # Convert dates
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")

            # Rename columns for consistency
            alerts_df = alerts_df.rename({
                "Location ID": "sap_id",
                "Zone": "zone"
            })

            # Ensure datetime
            alerts_df = alerts_df.with_columns([
                pl.col("Dryout Start Time").cast(pl.Datetime),
                pl.col("Dryout End Time").cast(pl.Datetime)
            ])

            # -------------------------------
            # STEP 1: FULL DRYOUT sap_ids
            # -------------------------------
            full_df = alerts_df.filter(
                (pl.col("Dryout Start Time") <= start_dt) &
                (
                    (pl.col("Dryout End Time") >= end_dt) |
                    (pl.col("Dryout End Time").is_null())
                )
            ).select(["sap_id", "zone"]).unique()

            full_df = full_df.with_columns(pl.lit("full").alias("dryout_type"))

            # -------------------------------
            # STEP 2: ALL DRYOUT sap_ids
            # -------------------------------
            all_dryout_df = alerts_df.select(["sap_id", "zone"]).unique()

            # -------------------------------
            # STEP 3: PARTIAL = ALL - FULL
            # -------------------------------
            partial_df = all_dryout_df.join(
                full_df.select(["sap_id"]),
                on="sap_id",
                how="anti"
            ).with_columns(pl.lit("partial").alias("dryout_type"))

            # -------------------------------
            # STEP 4: COMBINE FULL + PARTIAL
            # -------------------------------
            dryout_df = pl.concat([full_df, partial_df])

            # -------------------------------
            # STEP 5: ADD WITHOUT DRYOUT
            # -------------------------------
            loc_df = loc_df.rename({"sap_id": "sap_id", "zone": "zone"})\
            
            final_df = loc_df.join(
                dryout_df,
                on=["sap_id", "zone"],
                how="left"
            )

            final_df = final_df.with_columns([
                pl.when(pl.col("dryout_type").is_null())
                .then(pl.lit("without"))
                .otherwise(pl.col("dryout_type"))
                .alias("dryout_type")
            ])

            # -------------------------------
            # STEP 6: ZONE SUMMARY
            # -------------------------------
            zone_summary = (
                final_df.group_by(["zone", "dryout_type"])
                .agg(pl.col("sap_id").n_unique().alias("count"))
                .pivot(
                    values="count",
                    index="zone",
                    columns="dryout_type"
                )
            )

            # Ensure all required columns exist SAFELY
            zone_summary = zone_summary.with_columns([
                pl.col("full").fill_null(0) if "full" in zone_summary.columns else pl.lit(0).alias("full"),
                pl.col("partial").fill_null(0) if "partial" in zone_summary.columns else pl.lit(0).alias("partial"),
                pl.col("without").fill_null(0) if "without" in zone_summary.columns else pl.lit(0).alias("without"),
            ])

            # -------------------------------
            # STEP 7: TOTAL + %
            # -------------------------------
            zone_summary = zone_summary.with_columns([
                (pl.col("full") + pl.col("partial") + pl.col("without")).alias("total")
            ])

            zone_summary = zone_summary.with_columns([
                (pl.col("without") / pl.col("total") * 100).round(1).alias("without_pct"),
                (pl.col("partial") / pl.col("total") * 100).round(1).alias("partial_pct"),
                (pl.col("full") / pl.col("total") * 100).round(1).alias("full_pct")
            ])

            # -------------------------------
            # STEP 8: ZONE OUTPUT
            # -------------------------------
            zones_output = []

            for row in zone_summary.to_dicts():
                zones_output.append({
                    "zone_code": row["zone"],
                    "without_dryouts_pct": row["without_pct"],
                    "partial_dryouts_pct": row["partial_pct"],
                    "full_dryouts_pct": row["full_pct"],
                    "without_dryouts_count": int(row.get("without", 0)),
                    "partial_dryouts_count": int(row.get("partial", 0)),
                    "full_dryouts_count": int(row.get("full", 0)),
                })
            
            # -------------------------------
            # STEP 9: OVERALL SUMMARY
            # -------------------------------
            total_without = final_df.filter(pl.col("dryout_type") == "without")["sap_id"].n_unique()
            total_partial = final_df.filter(pl.col("dryout_type") == "partial")["sap_id"].n_unique()
            total_full = final_df.filter(pl.col("dryout_type") == "full")["sap_id"].n_unique()

            grand_total = total_without + total_partial + total_full

            summary = {
                "without_dryouts": {
                    "count": total_without,
                    "pct": round((total_without / grand_total) * 100)
                },
                "partial_dryouts": {
                    "count": total_partial,
                    "pct": round((total_partial / grand_total) * 100)
                },
                "full_dryouts": {
                    "count": total_full,
                    "pct": round((total_full / grand_total) * 100)
                }
            }

            # -------------------------------
            # STEP 10: TOTAL ROW
            # -------------------------------
            zones_output.append({
                "zone_code": "TOTAL",
                "without_dryouts_pct": summary["without_dryouts"]["pct"],
                "partial_dryouts_pct": summary["partial_dryouts"]["pct"],
                "full_dryouts_pct": summary["full_dryouts"]["pct"],
                "without_dryouts_count": total_without,
                "partial_dryouts_count": total_partial,
                "full_dryouts_count": total_full
            })

            # -------------------------------
            # FINAL RESPONSE
            # -------------------------------
            return {
                "status": True,
                "message": "success",
                "summary": summary,
                "zones": zones_output
            }
        
        if data.action == "retail_outlet_stockouts":
            # -------------------------------
            # STEP 1: PREPARE DATA
            # -------------------------------
            alerts_df = alerts_df.rename({
                "Location ID": "sap_id",
                "Zone": "zone"
            })

            # All dryout sap_ids (distinct)
            dryout_df = alerts_df.select(["sap_id", "zone"]).unique()
            dryout_df = dryout_df.with_columns(pl.lit("with").alias("dryout_type"))

            # -------------------------------
            # STEP 2: ADD WITHOUT DRYOUT
            # -------------------------------
            final_df = loc_df.join(
                dryout_df,
                on=["sap_id", "zone"],
                how="left"
            )

            final_df = final_df.with_columns(
                pl.when(pl.col("dryout_type").is_null())
                .then(pl.lit("without"))
                .otherwise(pl.col("dryout_type"))
                .alias("dryout_type")
            )

            # -------------------------------
            # STEP 3: ZONE SUMMARY
            # -------------------------------
            zone_summary = (
                final_df.group_by(["zone", "dryout_type"])
                .agg(pl.col("sap_id").n_unique().alias("count"))
                .pivot(
                    values="count",
                    index="zone",
                    columns="dryout_type"
                )
            )

            # Ensure columns exist
            for col in ["with", "without"]:
                if col not in zone_summary.columns:
                    zone_summary = zone_summary.with_columns(pl.lit(0).alias(col))

            # Fill nulls
            zone_summary = zone_summary.with_columns([
                pl.col("with").fill_null(0),
                pl.col("without").fill_null(0),
            ])

            # -------------------------------
            # STEP 4: TOTAL + %
            # -------------------------------
            zone_summary = zone_summary.with_columns([
                (pl.col("with") + pl.col("without")).alias("total")
            ])

            zone_summary = zone_summary.with_columns([
                (pl.col("without") / pl.col("total") * 100).round(1).alias("without_pct"),
                (pl.col("with") / pl.col("total") * 100).round(1).alias("with_pct")
            ])

            # -------------------------------
            # STEP 5: ZONE OUTPUT
            # -------------------------------
            zones_output = []

            for row in zone_summary.to_dicts():
                zones_output.append({
                    "zone_code": row["zone"],
                    "without_dryouts_pct": row["without_pct"],
                    "with_dryouts_pct": row["with_pct"],
                    "without_dryouts_count": int(row.get("without", 0)),
                    "with_dryouts_count": int(row.get("with", 0)),
                })
            
            # -------------------------------
            # STEP 6: OVERALL SUMMARY
            # -------------------------------
            total_without = final_df.filter(pl.col("dryout_type") == "without")["sap_id"].n_unique()
            total_with = final_df.filter(pl.col("dryout_type") == "with")["sap_id"].n_unique()

            grand_total = total_without + total_with

            summary = {
                "without_dryouts": {
                    "count": total_without,
                    "pct": round((total_without / grand_total) * 100)
                },
                "with_dryouts": {
                    "count": total_with,
                    "pct": round((total_with / grand_total) * 100)
                }
            }
            # -------------------------------
            # STEP 7: TOTAL ROW
            # -------------------------------
            zones_output.append({
                "zone_code": "TOTAL",
                "without_dryouts_pct": summary["without_dryouts"]["pct"],
                "with_dryouts_pct": summary["with_dryouts"]["pct"],
                "without_dryouts_count": total_without,
                "with_dryouts_count": total_with
            })

            # -------------------------------
            # FINAL RESPONSE
            # -------------------------------
            return {
                "status": True,
                "message": "success",
                "summary": summary,
                "zones": zones_output
            }        
    except Exception as e:
            print(traceback.format_exc())
            print(f"Error executing query: {e}")
            return {"status": False, "message": f"Error: {e}"}

async def get_clause_conditions():
    clause_conditions = {}
    if urdhva_base.ctx.exists():
        rpt = urdhva_base.context.context.get('rpt', {})
        sap_id = rpt.get('sap_id')
        if sap_id:
            # Convert list to SQL tuple format
            sap_id_tuple = tuple(sap_id)
            query = f"""
                SELECT DISTINCT sap_id 
                FROM location_master 
                WHERE terminal_plant_id IN {sap_id_tuple}
                AND bu = 'RO'
            """
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
            if resp.get('data'):
                sap_ids = [row['sap_id'] for row in resp['data']]
                clause_conditions['rosapcode'] = sap_ids
        elif rpt.get('sales_area'):
            clause_conditions['salesarea_name'] = rpt.get('sales_area')
        elif rpt.get('region'):
            clause_conditions['regional_name'] = rpt.get('region')
        elif rpt.get('zone'):
            zones = rpt.get('zone')
            zone_list = []
            for zone in zones:
                if zone in zone_mapping.zone_mapping.keys():
                    zone_list.append(zone_mapping.zone_mapping[zone].get('CRIS'))
            clause_conditions['zonal_name'] = zone_list
    return [{'key': key, 'value': value} for key, value in clause_conditions.items()]

async def map_filter_key_value(key, values):
    """
    Map incoming filter keys to DB columns like get_clause_conditions
    """
    if key == "sap_id":
        sap_id_tuple = tuple(values)
        query = f"""
            SELECT DISTINCT sap_id 
            FROM location_master 
            WHERE terminal_plant_id IN {sap_id_tuple}
            AND bu = 'RO'
        """
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
        if resp.get('data'):
            return "rosapcode", [row['sap_id'] for row in resp['data']]
        return None, None

    elif key == "sales_area":
        return "salesarea_name", values

    elif key == "region":
        return "regional_name", values

    elif key == "zone":
        zone_list = []
        for zone in values:
            if zone in zone_mapping.zone_mapping:
                zone_list.append(zone_mapping.zone_mapping[zone].get('CRIS'))
        return "zonal_name", zone_list
    
    elif key == "product_code":
        product_list = []
        for prod in values:
            if prod in product_mapping.product_mapping:
                product_list.append(product_mapping.product_mapping[prod].get('CRIS'))
        return "product_no", product_list

    # default (no mapping)
    return key, values

async def process_drill_data(loss_df, group_col, rename_col, response_key):
    # Ensure datetime + month
    loss_df = loss_df.with_columns(
        pl.col("stock_date").cast(pl.Datetime),
        pl.col("stock_date").dt.truncate("1mo").alias("month_date")
    )
    # Group and aggregate
    result_df = (
        loss_df
        .group_by(["month_date", group_col, "product_group"])
        .agg(
            pl.col("loss_of_sale").sum().alias("loss_of_sale")
        )
        .sort(["month_date", group_col, "product_group"])
        .rename({group_col: rename_col})
        .with_columns(
            pl.col("month_date").cast(pl.Date).cast(pl.Utf8)
        )
    )

    final_dict = {}

    for row in result_df.to_dicts():
        date = row["month_date"]
        grp = row[rename_col]          
        product = row["product_group"]
        value = row["loss_of_sale"]

        if product == "OTHER":
            continue

        key = (date, grp)

        if key not in final_dict:
            final_dict[key] = {}

        final_dict[key][product] = value

    final_response = [
        {
            "month_date": date,
            rename_col: grp,
            "loss_of_sale": products
        }
        for (date, grp), products in final_dict.items()
    ]

    return {
        "status": True,
        "message": "Success",
        response_key: final_response
    }



async def get_loss_of_sales_volume(data):
    try:
        where_clause = ["product_no in ('1322000','1683000','1683100','1322000','3672000','2682000','3373000')"]
        clause_conditions = await get_clause_conditions()

        start_date = None
        end_date = None
        all_conditions = []

        # -------------------------------
        # STEP: ADD clause_conditions (from rpt)
        # -------------------------------
        if clause_conditions:
            for cond in clause_conditions:
                key = cond.get("key")
                values = cond.get("value")

                if not values:
                    continue

                if isinstance(values, str):
                    values = values.split(",")

                if len(values) == 1:
                    condition = f"{key} = '{values[0]}'"
                else:
                    condition = f"{key} IN {tuple(values)}"

                all_conditions.append(condition)
        
        # -------------------------------
        # STEP: ADD default where_clause
        # -------------------------------
        if where_clause:
            all_conditions.extend(where_clause)

        if data.cross_filters:
            for filter in data.cross_filters:
                # DATE handling
                if "DATE" in filter.key:
                    if filter.value:
                        dates = filter.value.split(",")
                    elif filter.values:
                        dates = filter.values if isinstance(filter.values, list) else [filter.values]
                    else:
                        continue
                    start_date = dates[0]
                    end_date = datetime.strptime(dates[-1], "%Y-%m-%d").strftime("%Y-%m-%d")
                    continue
                # Extract values
                if filter.values and isinstance(filter.values, list) and len(filter.values) > 0:
                    vals = filter.values
                elif filter.value:
                    vals = filter.value.split(",")
                else:
                    continue

                # APPLY MAPPING
                mapped_key, mapped_vals = await map_filter_key_value(filter.key, vals)
                if not mapped_key or not mapped_vals:
                    continue

                # Build condition
                if len(mapped_vals) == 1:
                    condition = f"{mapped_key} = '{mapped_vals[0]}'"
                else:
                    condition = f"{mapped_key} IN {tuple(mapped_vals)}"

                all_conditions.append(condition)

        if data.filters:
            for rec in data.filters:
                # Extract values
                if rec.values and isinstance(rec.values, list) and len(rec.values) > 0:
                    vals = rec.values
                elif rec.value:
                    vals = rec.value.split(",")
                else:
                    continue
                # APPLY MAPPING
                mapped_key, mapped_vals = await map_filter_key_value(rec.key, vals)
                if not mapped_key or not mapped_vals:
                    continue
                # Build condition
                if len(mapped_vals) == 1:
                    condition = f"{mapped_key} = '{mapped_vals[0]}'"
                else:
                    condition = f"{mapped_key} IN {tuple(mapped_vals)}"

                all_conditions.append(condition)
        
        # -------------------------------
        # STEP: BUILD FINAL WHERE CLAUSE
        # -------------------------------
        final_where_clause = ""

        if all_conditions:
            final_where_clause = " AND " + " AND ".join(all_conditions)

        # -------------------------------
        # DEFAULT DATE (LAST 6 MONTHS)
        # -------------------------------
        if not start_date or not end_date:
            today = datetime.now().date()
            
            # End date = today
            end_date = today.strftime("%Y-%m-%d")
            
            # Start date = 6 months ago (approx 180 days)
            start_date = (today - timedelta(days=180)).replace(day=1).strftime("%Y-%m-%d")
        
        query = f"""
                    select rosapcode, product_no, zonal_name,regional_name,salesarea_name,stock_date,loss_of_sale,site_name from "HPCL_HOS".daily_product_dry_out where
                    stock_date::date between '{start_date}' and '{end_date}'
                    {final_where_clause}
                """
        
        print("Final Query:", query)

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 2
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        loss_resp = await function(query=query)
        loss_df = pl.DataFrame(loss_resp)

        if loss_df.is_empty():
            return {
                "status": True,
                "message": "success",
                "data": []
            }
        
        zone_map = zone_mapping.zone_map

        loss_df = loss_df.with_columns(
            pl.col("zonal_name")
            .map_elements(lambda x: zone_map.get(x, x))
            .alias("zonal_name")
        )
        ms_codes = [
            product_mapping.product_mapping["2811000"]["CRIS"],  # MS
            product_mapping.product_mapping["2822000"]["CRIS"],  # E20
            product_mapping.product_mapping["3672000"]["CRIS"],  # POWER 95
            product_mapping.product_mapping["2816000"]["CRIS"],  # POWER 99
            product_mapping.product_mapping["3373000"]["CRIS"],  # POWER 100
        ]
        hsd_codes = [
            product_mapping.product_mapping["2812000"]["CRIS"],  # HSD
            product_mapping.product_mapping["3912000"]["CRIS"],  # TURBO
        ]

        loss_df = loss_df.with_columns(
            pl.col("product_no").cast(pl.Utf8)  
        )
        loss_df = loss_df.with_columns(
            pl.when(pl.col("product_no").is_in(ms_codes))
            .then(pl.lit("MS"))
            .when(pl.col("product_no").is_in(hsd_codes))
            .then(pl.lit("HSD"))
            .otherwise(pl.lit("OTHER"))
            .alias("product_group")
        )

        def build_response(df, date_col):
           final_result = {}

           for row in df.to_dicts():
               date = str(row[date_col])
               group = row["product_group"]
               value = row["loss_of_sale"]

               if group == "OTHER":
                   continue  # ignore unwanted products

               if date not in final_result:
                   final_result[date] = {}

               final_result[date][group] = value

           return [
               {
                   "process_date": date,
                   "loss_of_sale": groups
               }
               for date, groups in sorted(final_result.items())
            ]
        

        if data.action == "daily_loss_of_sale":
            # Convert stock_date to date only (remove time if exists)
            loss_df = loss_df.with_columns(
                pl.col("stock_date").cast(pl.Date)
            )
            # Group by date and sum loss_of_sale
            result_df = (
                loss_df
                .group_by("stock_date", "product_group")
                .agg(
                    (pl.col("loss_of_sale").sum()/1000).alias("loss_of_sale")
                )
                .sort(["stock_date", "product_group"])
            )
            # Format date as string (YYYY-MM-DD)
            result_df = result_df.with_columns(
                pl.col("stock_date").cast(pl.Utf8).alias("process_date")
            ).drop("stock_date")

            response = build_response(result_df, "process_date")

            # Convert to required response format
            return {
                "status": True,
                "message": "success",
                "data": response
            }
        
        if data.action == "monthly_loss_of_sale":
            if not data.drill_state:
                # Convert stock_date to datetime if not already
                loss_df = loss_df.with_columns(
                    pl.col("stock_date").cast(pl.Datetime)
                )
                # Truncate to month (gives first day of month)
                loss_df = loss_df.with_columns(
                    pl.col("stock_date").dt.truncate("1mo").alias("month_date")
                )
                # Group by month and sum
                result_df = (
                    loss_df
                    .group_by("month_date", "product_group")
                    .agg(
                        (pl.col("loss_of_sale").sum()/1000).alias("loss_of_sale")
                    )
                    .sort("month_date","product_group")
                )
                # Format date as string
                result_df = result_df.with_columns(
                    pl.col("month_date").cast(pl.Date).cast(pl.Utf8)
                )

                response = build_response(result_df, "month_date")
                return {
                    "status": True,
                    "message": "Success",
                    "overall_data": response
                }
            
            drill_map = {
                "zone": ("zonal_name", "zone", "zone_data"),
                "region": ("regional_name", "region", "region_data"),
                "sales_area": ("salesarea_name", "sales_area", "sales_area_data"),
                "location": ("site_name", "location_name", "location_data")
            }

            if data.drill_state in drill_map:
                group_col, rename_col, response_key = drill_map[data.drill_state]
                return await process_drill_data(loss_df, group_col, rename_col, response_key)
            
    except Exception as e:
            print(traceback.format_exc())
            print(f"Error executing query: {e}")
            return {"status": False, "message": f"Error: {e}"}
