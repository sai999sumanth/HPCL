"""
IMS (Indent Management System) - Field Force orchestrator.
Functional schema for IndentManagement APIs. No implementation.
"""
import urdhva_base
import charts_actions
import field_force_model
import dashboard_studio_model
from typing import Any, List, Optional
import orchestrator.field_force.ims_query as ims_query
import orchestrator.field_force.utils as field_force_utils

# -------- Session-based filter generation (IMS) --------


def generate_session_filters(query_filters: Optional[List[str]] = None, model: str = "IMS") -> List[str]:
    """
    Build a list of WHERE-style conditions from the current user's session (role-based territory) for IMS.

    Delegates to utils.generate_session_filters with vendor "IMS". Uses vendor_territory_mapping
    to resolve the logged-in user's perspective into IMS-specific values and column names.

    :param query_filters: Optional; not merged here; caller can combine with returned list.
    :param model: Reserved for future use; defaults to "IMS".
    :return: List of condition strings (e.g. "sales_area='MUMBAI DS SA'").
    """
    return field_force_utils.generate_session_filters(vendor="IMS", model=model, query_filters=query_filters)


async def get_indents_by_product_volume(
    data: field_force_model.WidgetFiltersCreate,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
):
    """
    Total indents placed by product and volume.
    Supports dynamic level (sales_area / region / zone / plant / dealer) and drill-down to locations.

    Input:
        data: [{"key": str, "cond": str, "value": str?, "values": list[str]?}, ...]
        level_filter: {"level": "sales_area"|"region"|"zone"|"plant"|"dealer"} or None
        drill_filter: {"drill_to": "locations"} or None
    Output:
        {"summary": [{"product_code", "product_name", "volume", "indent_count", "level_id", ...}],
         "drill_down": [{"location_id", "location_name", "product_code", "volume", ...}] or None,
         "total": int?, "level": str?, "drill_to": str?}
    """
    effective_filters = await field_force_utils.get_input_filters(data or [], vendor="IMS", merge_session=True)
    session_conditions = field_force_utils.generate_session_filters(vendor="IMS")
    pass  # TODO: use effective_filters and session_conditions in implementation


async def get_pending_vs_executed_indents(
    data: field_force_model.WidgetFiltersCreate,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
):
    """
    Pending vs executed indents. Level and drill-down to locations supported.

    Input:
        data: WidgetFilters (key, cond, value/values).
        level_filter: optional LevelFilter.
        drill_filter: optional {"drill_to": "locations"}.
    Output:
        {"summary": [{"product_code", "pending_count", "executed_count", "pending_volume", "executed_volume", ...}],
         "drill_down": [{"location_id", "location_name", "status", "count", "volume", ...}] or None,
         "total": int?, "level": str?, "drill_to": str?}
    """
    effective_filters = await field_force_utils.get_input_filters(data or [], vendor="IMS", merge_session=True)
    session_conditions = field_force_utils.generate_session_filters(vendor="IMS")
    pass  # TODO: use effective_filters and session_conditions in implementation


async def get_cancelled_indents(
    data: field_force_model.WidgetFiltersCreate,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
):
    """
    Cancelled indents with optional drill-down to locations.

    Input:
        data: WidgetFilters.
        level_filter: optional LevelFilter.
        drill_filter: optional DrillFilter (drill_to="locations").
    Output:
        {"summary": [{"product_code", "cancelled_count", "volume", "level_id", ...}],
         "drill_down": [{"location_id", "location_name", "product_code", "volume", "cancelled_at", ...}] or None,
         "total": int?, "level": str?, "drill_to": str?}
    """
    effective_filters = await field_force_utils.get_input_filters(data or [], vendor="IMS", merge_session=True)
    session_conditions = field_force_utils.generate_session_filters(vendor="IMS")
    pass  # TODO: use effective_filters and session_conditions in implementation


async def get_dtp_dealers_count(
    data: field_force_model.WidgetFiltersCreate,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
):
    """
    Total DTP dealers count. Optional drill-down to dealer level.

    Input:
        data: WidgetFilters.
        drill_filter: optional {"drill_to": "dealers"}.
    Output:
        {"summary": [{"dtp_dealers_count": int, "level_id", ...}],
         "drill_down": [{"dealer_id", "dealer_name", "dealer_code", ...}] or None,
         "total": int?, "drill_to": str?}
    """
    effective_filters = await field_force_utils.get_input_filters(data or [], vendor="IMS", merge_session=True)
    session_conditions = field_force_utils.generate_session_filters(vendor="IMS")
    pass  # TODO: use effective_filters and session_conditions in implementation


async def get_top_dtp_customers(
    data: field_force_model.WidgetFiltersCreate,
    sales_cutoff_kl: Optional[float] = None,
    top_count: int = 10,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
):
    """
    Top DTP customers with optional sales cutoff (e.g. < 5 kl/month). Drill-down to dealer.

    Input:
        data: WidgetFilters.
        sales_cutoff_kl: optional volume cutoff in KL (e.g. 5.0 for < 5 kl/month).
        top_count: max number of dealers to return (default 10).
        drill_filter: optional {"drill_to": "dealers"}.
    Output:
        {"summary": [{"dealer_id", "dealer_name", "sales_volume_kl", "rank", ...}],
         "drill_down": [{"dealer_id", "dealer_name", "product_breakdown", ...}] or None,
         "total": int?, "drill_to": str?, "sales_cutoff_kl": float?}
    """
    effective_filters = await field_force_utils.get_input_filters(data or [], vendor="IMS", merge_session=True)
    session_conditions = field_force_utils.generate_session_filters(vendor="IMS")
    pass  # TODO: use effective_filters and session_conditions in implementation


async def get_dct_indents_by_product_volume(
    data: field_force_model.WidgetFiltersCreate,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
):
    """
    Total indents placed by DCT customers by product and volume. Drill-down to dealers.

    Input:
        data: WidgetFilters.
        level_filter: optional LevelFilter.
        drill_filter: optional {"drill_to": "dealers"}.
    Output:
        {"summary": [{"product_code", "product_name", "volume", "indent_count", "dct_dealer_count", ...}],
         "drill_down": [{"dealer_id", "dealer_name", "product_code", "volume", ...}] or None,
         "total": int?, "level": str?, "drill_to": str?}
    """
    effective_filters = await field_force_utils.get_input_filters(data or [], vendor="IMS", merge_session=True)
    session_conditions = field_force_utils.generate_session_filters(vendor="IMS")
    pass  # TODO: use effective_filters and session_conditions in implementation


async def get_trucks_failed_to_report(
    data: field_force_model.WidgetFiltersCreate,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
):
    """
    Trucks failed to report. Drill-down to dealers.

    Input:
        data: WidgetFilters.
        drill_filter: optional {"drill_to": "dealers"}.
    Output:
        {"summary": [{"trucks_failed_count": int, "level_id", "period", ...}],
         "drill_down": [{"dealer_id", "dealer_name", "truck_id", "expected_at", "status", ...}] or None,
         "total": int?, "drill_to": str?}
    """
    effective_filters = await field_force_utils.get_input_filters(data or [], vendor="IMS", merge_session=True)
    session_conditions = field_force_utils.generate_session_filters(vendor="IMS")
    pass  # TODO: use effective_filters and session_conditions in implementation


async def get_tpt_indents_vs_availability(
    data: field_force_model.WidgetFiltersCreate,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
):
    """
    Total TPT indents vs trucks availability. Drill-down to dealers.

    Input:
        data: WidgetFilters.
        drill_filter: optional {"drill_to": "dealers"}.
    Output:
        {"summary": [{"indent_count": int, "trucks_available": int, "shortage_surplus", "level_id", ...}],
         "drill_down": [{"dealer_id", "dealer_name", "indents", "trucks_available", ...}] or None,
         "total": int?, "drill_to": str?}
    """
    effective_filters = await field_force_utils.get_input_filters(data or [], vendor="IMS", merge_session=True)
    session_conditions = field_force_utils.generate_session_filters(vendor="IMS")
    pass  # TODO: use effective_filters and session_conditions in implementation


async def get_indents_details(
    data: field_force_model.WidgetFiltersCreate,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
):
    """
    Backward-compatible: same as get_indents_by_product_volume.
    Total indents by product/volume with level and drill-down.

    Input:
        data: WidgetFilters.
        level_filter: optional LevelFilter.
        drill_filter: optional DrillFilter.
    Output:
        Same as get_indents_by_product_volume.
    """
    effective_filters = await field_force_utils.get_input_filters(data or [], vendor="IMS", merge_session=True)
    session_conditions = field_force_utils.generate_session_filters(vendor="IMS")
    pass  # TODO: use effective_filters and session_conditions in implementation

async def r3_r1_monthwise(data):
    """
    r3 difference r1 monthwiswe data
    """
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 1
    dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
    try: 
            # location wise data
            location_wise_query = ims_query.ims_queries.get('location_wise_query', '')
            location_data = await function(query=location_wise_query) if location_wise_query else []

            # month wise data
            monthly_query = ims_query.ims_queries.get('monthly_query', '')
            month_wise_data =  await function(query=monthly_query) if monthly_query else []
        
            #zone wise data
            zone_wise_query = ims_query.ims_queries.get('zone_wise_query', [])
            zone_wise_data = await function(query=zone_wise_query) if zone_wise_query else []

            return {
                "status" : True,
                "message": "Success",
                "location_data": location_data if location_data else [],
                "monthly_data": month_wise_data if month_wise_data else [],
                "zone_data": zone_wise_data if zone_wise_data else [],
            }
    except Exception as e:
        return {
            "status": False,
            "message": f"Failed to retrieve data {e}",
            "data": []
        }

async def r3_r1_daywise(data):
    """
    average r3 difference r1 (based on date)
    """
    try:
        # sample  where cond
        """
        WHERE tses."CARD_DATE" BETWEEN DATE '2025-09-01' AND DATE '2025-09-03' AND tses."LOCN_CODE" = '1180'
        AND tses."CARD_STATUS" IN ('O', 'R')
        """
        # get cross filters
        cross_filters = data.cross_filters

        # build where condition
        conditions = []
        if cross_filters:
            for rec in cross_filters:
                if 'DATE' in rec.key.upper():
                    val = rec.value
                    start = val.split(",")[0]
                    end_date = val.split(",")[-1]
                    end = f"{end_date} 23:59:59"

                    conditions.append(f"""tses."CARD_DATE" BETWEEN DATE '{start}' AND DATE '{end}' """)
                
                if 'zone' in rec.key:
                    zone_val = rec.value
                    conditions.append(f""" lm.zone ='{zone_val}' """ )
                
                if 'sap_id' in rec.key:
                    sap_id = rec.value
                    conditions.append(f""" tses."LOCN_CODE" = '{sap_id}' """)
            conditions.append("""tses."CARD_STATUS" IN ('O', 'R')""")

        where_clause = " AND ".join(conditions)
        print("where clause -->", where_clause)
        query = ims_query.ims_queries.get('daywise_query', '').format(where_clause)
        print("query --->", query)
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 1
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        daily_data = await function(query=query)
        print("daily_data -->", daily_data)

        return {
                "status" : True,
                "message": "Success",
                "data": daily_data if daily_data else []

        }
    except Exception as e:
        return {
                 "status" : False,
                 "message": f"Failed {e}",
                 "data": []

            }


