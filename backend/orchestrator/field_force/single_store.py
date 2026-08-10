"""
Retail Sales (Single Store, including Lubes) - Field Force orchestrator.
Functional schema for RetailSales APIs. No implementation.
"""
import field_force_model
from typing import List, Optional
# comparison_type: yesterday | mtd | ytd | historical


async def get_sales_by_product(
    data: field_force_model.WidgetFiltersCreate,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
):
    """
    Sales of all products in sales area, bifurcated by product.
    Optional drill-down to dealer-wise sales by product.

    Input:
        data: field_force_model.WidgetFiltersCreate.
        drill_filter: optional {"drill_to": "dealers"}.
    Output:
        {"summary": [{"product_code", "product_name", "volume", "amount", "sales_area_id", ...}],
         "drill_down": [{"dealer_id", "dealer_name", "product_code", "volume", "amount", ...}] or None,
         "total": int?, "drill_to": str?}
    """
    pass


async def get_lubes_arb_comparison(
    data: field_force_model.WidgetFiltersCreate,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
):
    """
    Sales comparison for lubes and ARB sales. Drill-down to dealer and product.

    Input:
        data: field_force_model.WidgetFiltersCreate.
        drill_filter: optional {"drill_to": "dealers"} (dealer and product in rows).
    Output:
        {"summary": [{"category": "lubes"|"arb", "product_code", "volume", "amount", "pct_share", ...}],
         "drill_down": [{"dealer_id", "dealer_name", "product_code", "category", "volume", ...}] or None,
         "total": int?, "drill_to": str?}
    """
    pass


async def get_lube_sales_comparison(
    data: field_force_model.WidgetFiltersCreate,
):
    """
    Lube sales comparison.

    Input:
        data: field_force_model.WidgetFiltersCreate.
    Output:
        {"summary": [{"lube_product_code", "lube_product_name", "volume", "amount", "period", "comparison_period", "pct_change", ...}],
         "drill_down": None, "total": int?}
    """
    pass


async def get_sales_comparison(
    data: field_force_model.WidgetFiltersCreate,
    comparison_type: str,
):
    """
    Sales comparison for selected period.
    comparison_type: yesterday | mtd | ytd | historical

    Input:
        data: field_force_model.WidgetFiltersCreate.
        comparison_type: "yesterday" | "mtd" | "ytd" | "historical".
    Output:
        {"current": [{"product_code", "volume", "amount", "period", ...}],
         "previous": [{"product_code", "volume", "amount", "period", ...}],
         "comparison": [{"product_code", "current_volume", "previous_volume", "pct_change", ...}],
         "period_current": str, "period_previous": str}
    """
    pass


async def get_volume_tracking(
    data: field_force_model.WidgetFiltersCreate,
):
    """
    Volume tracking.

    Input:
        data: field_force_model.WidgetFiltersCreate.
    Output:
        {"summary": [{"product_code", "period", "volume", "cumulative_volume", "target"?, "achievement_pct"?, ...}],
         "drill_down": None, "total": int?}
    """
    pass
