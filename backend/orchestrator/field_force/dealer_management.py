"""
Dealer Management (Ledger and Tar Analysis) - Field Force orchestrator.
Functional schema for DealerManagement APIs. No implementation.
"""
from typing import List, Optional
import field_force_model


async def get_last_transactions(
    data: field_force_model.WidgetFiltersCreate,
    transaction_count: int = 20,
    dealer_specific: bool = False,
):
    """
    Last N transactions in sales area. If dealer_specific, last N by dealer.

    Input:
        data: field_force_model.WidgetFilters (e.g. sales_area, dealer_id when dealer_specific).
        transaction_count: max transactions to return (default 20).
        dealer_specific: if True, apply dealer-level filter and return per-dealer last N.
    Output:
        {"data": [{"transaction_id", "dealer_id", "dealer_name", "date", "type", "amount", "balance", "reference", "description", ...}],
         "total": int?, "filters_applied": dict?}
    """
    pass


async def get_retail_ledger_transactions(
    data: field_force_model.WidgetFiltersCreate,
    transaction_count: int = 20,
):
    """
    Alias: last N ledger transactions (default 20). Dealer-level filters via data.

    Input:
        data: field_force_model.WidgetFilters.
        transaction_count: max transactions (default 20).
    Output:
        {"data": [TransactionRow, ...], "total": int?, "filters_applied": dict?}
    """
    pass


async def get_total_outstanding_dues(
    data: field_force_model.WidgetFiltersCreate,
):
    """
    Total outstanding dues / total outstanding as of today.

    Input:
        data: field_force_model.WidgetFilters.
    Output:
        {"summary": [{"total_outstanding": float, "dealer_count", "as_of_date", "level_id"?, ...}],
         "drill_down": None, "total": int?}
    """
    pass


async def get_top_outstanding_dealers(
    data: field_force_model.WidgetFiltersCreate,
    top_count: Optional[int] = None,
):
    """
    Top dealers having outstanding. top_count omitted => use default limit.

    Input:
        data: field_force_model.WidgetFilters.
        top_count: max dealers; None or 0 => all (or default limit).
    Output:
        {"summary": [{"dealer_id", "dealer_name", "outstanding_amount", "days_outstanding", "rank", ...}],
         "drill_down": None, "total": int?, "top_count": int?}
    """
    pass


async def get_outstanding_by_days_group(
    data: field_force_model.WidgetFiltersCreate,
):
    """
    Outstanding grouped by days: 0–1 day, 2–4 days, 5 days, 5–10, 10–15, >15 days.

    Input:
        data: field_force_model.WidgetFilters.
    Output:
        {"data": [{"bucket_label": str, "dealer_count": int, "total_amount": float, "dealers": [{"dealer_id", "dealer_name", "amount", "days"}, ...]?}, ...],
         "total": int?, "filters_applied": dict?}
    """
    pass


async def get_dealer_outstanding_table(
    data: field_force_model.WidgetFiltersCreate,
):
    """
    Dealer-wise table for pending outstanding and days outstanding.

    Input:
        data: field_force_model.WidgetFilters.
    Output:
        {"data": [{"dealer_id", "dealer_name", "pending_outstanding": float, "days_outstanding": int, "oldest_transaction_date", ...}],
         "total": int?, "filters_applied": dict?}
    """
    pass


async def get_outstanding_details(
    data: field_force_model.WidgetFiltersCreate,
):
    """
    Overdue dealers count and amount (legacy).

    Input:
        data: field_force_model.WidgetFilters.
    Output:
        {"summary": [{"overdue_dealer_count": int, "overdue_amount": float, "level_id"?, ...}],
         "drill_down": None, "total": int?}
    """
    pass


async def get_outstanding_dealers(
    data: field_force_model.WidgetFiltersCreate,
    top_count: Optional[int] = None,
):
    """
    List of outstanding dealers. top_count=0 or omitted => return all.

    Input:
        data: field_force_model.WidgetFilters.
        top_count: max dealers; None or 0 => all.
    Output:
        {"data": [{"dealer_id", "dealer_name", "outstanding_amount", "days_outstanding", ...}],
         "total": int?, "filters_applied": dict?}
    """
    pass
