import urdhva_base
import datetime
import hpcl_ceg_model
import utilities.connection_mapping as connection_mapping
import orchestrator.analytics.dry_out_analysis as dry_out_analysis


async def get_where_clause_condition(filters):
    where_clause = ["interlock_name = 'Dry Out Each Indent Wise MainFlow'", "mark_as_false = true"]
    where_clause.extend(await hpcl_ceg_model.Alerts.get_clause_conditions(
        extra_key_mapping={"sap_id": "terminal_plant_id"}, default_mapping={"bu": "RO"}))
    dry_out_in_days_query = '1'
    tt_count_filter = {}
    for record in filters:
        if record.key == "progress_rate":
            if record.value:
                where_clause.append(f"progress_rate={int(record.value[0])}")
        else:
            if record.value:
                if record.key == 'dry_out_in_days':
                    dry_out_in_days_query = record.value[0]
                if record.key == "plant":
                    record.key = "terminal_plant_id"
                    tt_count_filter.update({record.key: record.value})
                if record.key == "zone":
                    tt_count_filter.update({record.key: record.value})
                if len(record.value) == 1:
                    where_clause.append(f"{record.key}='{record.value[0]}'")
                else:
                    where_clause.append(f"{record.key} in {tuple(record.value)}")
    conditions = ' AND '.join(where_clause)
    return conditions, dry_out_in_days_query, tt_count_filter


async def get_initial_dryout_counts(bu, conditions, dry_out_in_days_query, by_location=True,
                                    by_zone=False, by_sales_area=False):
    """
    Computes dry-out alerts counts aggregated by stages based on provided conditions.
    
    This function retrieves alerts matching the specified conditions and groups them
    into defined stages (e.g., 'Indent Raised', 'Valid \\ WIP Indents').
    It optionally calculates aggregations grouped by zone and sales area.

    :param bu: Business Unit (e.g., 'sod'). Used for specific handling like fetching ATG Ack counts.
    :param conditions: SQL WHERE clause string for filtering alerts.
    :param dry_out_in_days_query: The dry_out_in_days condition value (used for fetching delivered_count/atg_ack).
    :param by_location: Boolean flag (default True). If True, includes the 'overall' counts in the response when grouping is requested.
    :param by_zone: Boolean flag (default False). If True, computes and returns stages counts grouped by zone.
    :param by_sales_area: Boolean flag (default False). If True, computes and returns stages counts grouped by sales area.
    :return: 
        - If both `by_zone` and `by_sales_area` are False, returns a list of dictionaries with overall stats (backward compatible).
        - If `by_zone` or `by_sales_area` is True, returns a dictionary containing:
            - "overall": List of overall stats (if `by_location` is True).
            - "zone_data": Dictionary mapping zone names to their respective stats (if `by_zone` is True).
            - "sales_area_data": Dictionary mapping sales areas to their respective stats (if `by_sales_area` is True).
    """
    req_columns = ["distinct sap_id", "min(progress_rate) as present_stage"]
    group_by = ["sap_id"]
    if by_zone:
        req_columns.append("zone")
        group_by.append("zone")
    if by_sales_area:
        req_columns.append("sales_area")
        group_by.append("sales_area")
    stats_query = f"select {', '.join(req_columns)} " \
                  f"from alerts where {conditions} and indent_status not in ('Cancelled', 'Completed', 'TempClosed', 'ProductLowLevel', 'OfflineOrFalseAlarm', 'NotAvailable') " \
                  f"group by {','.join(group_by)}"
    stats_resp = await hpcl_ceg_model.Alerts.get_aggr_data(stats_query, limit=10000)
    where_clause_conditions = ["interlock_name = 'Dry Out Each Indent Wise MainFlow'"]
    where_clause_conditions.extend(await hpcl_ceg_model.Alerts.get_clause_conditions(
        extra_key_mapping={"sap_id": "terminal_plant_id"}))
    _date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    delivered_count = 0
    atg_ack = 0
    if bu == "sod":
        atg_ack = await dry_out_analysis.get_atg_ack_count(dry_out_in_days=str(dry_out_in_days_query))
        delivered_query = f"""SELECT SUM(distinct_count) AS total_count
                                FROM (
                                    SELECT COUNT(DISTINCT sap_id) AS distinct_count
                                    FROM alerts
                                    WHERE {' AND '.join(where_clause_conditions)}
                                    AND indent_status = 'Completed' AND dry_out_in_days = '{dry_out_in_days_query}' 
                                    AND DATE(updated_at) = '{_date}'  -- Use TRUNC to ignore the time part
                                    GROUP BY sap_id
                                ) AS subquery"""
        delivered_count = await hpcl_ceg_model.Alerts.get_aggr_data(delivered_query, limit=10000)
        if delivered_count:
            delivered_count = delivered_count['data'][0].get("total_count", 0) if delivered_count['data'][0].get(
                "total_count") else 0

    top_x_axis = connection_mapping.dry_out_top_x_axis
    # Initialize base stats mapping
    stats = {i + 1: 0 for i, _ in enumerate(top_x_axis)}
    zone_data = {}
    sales_area_data = {}
    
    # Iterate through query results to compute stages counts
    for rec in stats_resp['data']:
        zone = rec.get('zone')
        sales_area = rec.get('sales_area')
        present_stage = rec.get('present_stage', 1)
        
        if present_stage == 0:
            present_stage = 1
            
        if present_stage not in stats:
            stats[present_stage] = 0
            
        # Initialize zone data if by_zone flag is enabled
        if by_zone and zone and zone not in zone_data:
            zone_data[zone] = {key: 0 for key in stats.keys()}
            
        # Initialize sales area data if by_sales_area flag is enabled
        if by_sales_area and sales_area and sales_area not in sales_area_data:
            sales_area_data[sales_area] = {key: 0 for key in stats.keys()}
            
        # Update overall stats
        stats[present_stage] += 1
        
        # Update zone stats
        if by_zone and zone:
            if present_stage not in zone_data[zone]:
                zone_data[zone][present_stage] = 0
            zone_data[zone][present_stage] += 1
            
        # Update sales area stats
        if by_sales_area and sales_area:
            if present_stage not in sales_area_data[sales_area]:
                sales_area_data[sales_area][present_stage] = 0
            sales_area_data[sales_area][present_stage] += 1

    # Helper function to format the stats dictionary into the expected list of dictionaries format
    def format_stats(data_dict, delivered_val=0, atg_val=0):
        formatted = [
            {
                "section": top_x_axis[key - 1]['name'], 
                "value": value, 
                "serial": key, 
                "condition": "=",
                "group": top_x_axis[key - 1]['group']
            }
            for key, value in data_dict.items() if key <= len(top_x_axis)
        ]
        
        # Calculate aggregations: Indent Raised and Valid \ WIP Indents
        formatted.extend([{
            "section": "Indent Raised",
            "value": sum(item['value'] for item in formatted if 2 <= item['serial'] <= 10),
            "serial": 13, "condition": "=", "group": "not_raised"
        }, {
            "section": "Valid \\ WIP Indents",
            "value": sum(item['value'] for item in formatted if 4 <= item['serial'] <= 10),
            "serial": 14, "condition": "=", "group": "pending"
        }])
        
        # Update counts for specific stages if provided
        for each_stats in formatted:
            if each_stats['section'] == 'Delivery Confirmation' and delivered_val > 0:
                each_stats['value'] = delivered_val
            if each_stats['section'] == 'ATG Ack' and atg_val > 0:
                each_stats['value'] = atg_val
                
        return formatted

    updated_stats = format_stats(stats, delivered_count, atg_ack)
    
    # If grouping requested, return a dictionary with the overall and grouped stats
    if by_zone or by_sales_area:
        result = {"overall": updated_stats} if by_location else {}
        if by_zone:
            result["zone_data"] = {
                z: format_stats(z_stats) for z, z_stats in zone_data.items()
            }
        if by_sales_area:
            result["sales_area_data"] = {
                sa: format_stats(sa_stats) for sa, sa_stats in sales_area_data.items()
            }
        return result

    # Default return behavior to remain compatible with existing callers
    return updated_stats
