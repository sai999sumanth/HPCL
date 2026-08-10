"""
IMS — LPG supply-chain indent KPIs (field force orchestrator).

Placeholder implementations: wire to ``ims_lpg_query.lpg_indent_queries`` once IMS_SAP table/column
names are confirmed from the SOP / data dictionary (see ``ims_lpg_query.py`` comments).

``table_data`` is passed from ``get_indent_details`` into each KPI handler so callers can later
choose aggregate counts vs row-level queries; behavior is not branched here yet.

For ``table_data=True``, Oracle pagination uses ``OFFSET … ROWS FETCH NEXT … ROWS ONLY`` (12c+).
``page`` is **0-based** (default ``0``). Success responses use ``{"data": [...], "total": ..., "count": ...}``.
Request fields: ``page``, ``page_size``, ``include_total`` on ``Indentmanagement_Get_Indent_DetailsParams``.
"""
from __future__ import annotations

import re

import charts_actions
import field_force_model
from typing import Any, Callable, Dict, List, Optional
import utilities.connection_mapping as connection_mapping
import orchestrator.field_force.utils as field_force_utils


def _widget_filters_to_dicts(
    widget_filters: Optional[List[field_force_model.WidgetFiltersCreate]],
) -> List[Dict[str, Any]]:
    if not widget_filters:
        return []
    out: List[Dict[str, Any]] = []
    for w in widget_filters:
        out.append(w.model_dump() if hasattr(w, "model_dump") else w.dict())
    return out


def generate_session_filters(
    query_filters: Optional[List[str]] = None, model: str = "IMS"
) -> List[str]:
    """Territory filters for LPG IMS widgets (delegates to shared IMS vendor mapping)."""
    return field_force_utils.generate_session_filters(
        vendor="IMS_LPG", model=model, query_filters=query_filters
    )


async def _filters(
    widget_filters: Optional[List[field_force_model.WidgetFiltersCreate]],
) -> List[str]:
    """Merged widget + session filters as SQL fragments (session is merged in ``get_input_filters``)."""
    effective = await field_force_utils.get_input_filters(
        _widget_filters_to_dicts(widget_filters),
        vendor="IMS_LPG",
        merge_session=True,
        model="IMS_LPG",
        bu="LPG_CUSTOMERS"
    )
    return field_force_utils.widget_filters_to_condition_strings(effective)


def _lpg_indent_join_qualify(sql_fragment: str) -> str:
    """
    Prefix LPG IMS filter fragments with the correct join alias:
    ``a`` = ``INDENT_REQUEST`` (``LOCN_CODE``), ``b`` = ``INDENT_PRODUCTS``
    (``SAREA_CODE``, ``ZONE``). Unknown columns default to ``a``.
    """
    s = (sql_fragment or "").strip()
    if not s:
        return s
    if re.match(r"^[ab]\.", s, re.IGNORECASE):
        return s
    sup = s.upper()
    col_alias = (
        ("LOCN_CODE", "a"),
        ("SAREA_CODE", "dd"),
        ("ZONE", "dd"),
    )
    for col, alias in col_alias:
        n = len(col)
        if len(sup) >= n and sup[:n] == col:
            if len(sup) == n or sup[n] in ("=", " ", "\t"):
                return f"{alias}.{s}"
    return f"a.{s}"


def _lpg_indent_join_conditions(filter_sql_fragments: List[str]) -> List[str]:
    return [_lpg_indent_join_qualify(c) for c in (filter_sql_fragments or [])]


# INDENT_REQUEST = a, INDENT_PRODUCTS = b (filter columns SAREA_CODE, ZONE live on b).
_LPG_JOIN_INDENT_PRODUCTS_B = """
                INNER JOIN "LPGIMS_SAP"."DEALER_DETAILS" dd 
                ON a."DEALER_CODE" = dd."DEALER_CODE" 
                JOIN "LPGIMS_SAP"."INDENT_PRODUCTS" b
                ON a."LOCN_CODE" = b."LOCN_CODE"
                AND a."INDENT_NO" = b."INDENT_NO" 
                """


async def execute_ims_query(query):
    connection_id = connection_mapping.connection_mapping.get("ims", "3")
    charts_ins = charts_actions.Charts_Connection_Vault_RoutingParams(
        connection_id=connection_id,
        action='execute_query'
    )
    function = await charts_actions.charts_connection_vault_routing(charts_ins)
    resp = await function(query=query)
    return resp


_ORDER_BY_TAIL = re.compile(r"\s+ORDER\s+BY\s+.+$", re.IGNORECASE | re.DOTALL)


def _strip_trailing_order_by(sql: str) -> str:
    """Remove trailing ORDER BY … for use inside COUNT subqueries (Oracle inline views)."""
    s = sql.rstrip().rstrip(";").strip()
    return _ORDER_BY_TAIL.sub("", s).strip()


def _clamp_pagination(page: int, page_size: int) -> tuple[int, int]:
    p = max(0, int(page) if page is not None else 0)
    ps = max(1, min(int(page_size) if page_size else 20, 500))
    return p, ps


def _first_scalar_count_row(resp: Any) -> Any:
    """Extract one numeric count from charts execute_query response (driver-dependent keys)."""
    if resp is None:
        return None
    if isinstance(resp, dict) and "data" in resp:
        resp = resp["data"]
    if not resp:
        return None
    row = resp[0] if isinstance(resp, list) else resp
    if isinstance(row, dict):
        for k in ("CNT", "cnt", "COUNT", "count"):
            if k in row and row[k] is not None:
                return row[k]
    return None


def _aggregate_count_from_resp(resp: Any) -> int:
    """Scalar aggregate count from execute_query (list of rows or ``{data: [...]}``)."""
    if resp is None:
        return 0
    if isinstance(resp, dict) and "data" in resp:
        v = _first_scalar_count_row(resp["data"])
        if v is not None:
            try:
                return int(v)
            except (TypeError, ValueError):
                return 0
    if isinstance(resp, list) and resp:
        row = resp[0]
        if isinstance(row, dict):
            for k in ("COUNT", "count", "CNT", "cnt"):
                if k in row and row[k] is not None:
                    try:
                        return int(row[k])
                    except (TypeError, ValueError):
                        return 0
    return 0


async def _oracle_table_paginated_response(
    base_query: str,
    *,
    page: int,
    page_size: int,
    include_total: bool,
) -> Dict[str, Any]:
    """
    Run ``base_query`` (SELECT … ORDER BY …) with OFFSET/FETCH, optionally COUNT(*) for totals.

    Returns ``{"data": rows, "total": total_rows|None, "count": len(rows)}``.
    """
    page, page_size = _clamp_pagination(page, page_size)
    offset = page * page_size
    base = base_query.rstrip().rstrip(";").strip()
    paginated_sql = f"""{base}
OFFSET {offset} ROWS FETCH NEXT {page_size} ROWS ONLY"""
    resp = await execute_ims_query(paginated_sql)
    if isinstance(resp, dict) and "data" in resp:
        rows = resp["data"] or []
    elif isinstance(resp, list):
        rows = resp
    else:
        rows = []

    total_rows: Optional[int] = None
    if include_total:
        inner = _strip_trailing_order_by(base)
        cnt_sql = f'SELECT COUNT(*) AS "CNT" FROM ({inner}) cnt_sub'
        cnt_resp = await execute_ims_query(cnt_sql)
        raw = cnt_resp.get("data") if isinstance(cnt_resp, dict) else cnt_resp
        tr = _first_scalar_count_row(raw)
        total_rows = int(tr) if tr is not None else None
    else:
        total_rows = None

    return {
        "data": rows,
        "total": total_rows,
        "count": len(rows),
    }


# --- Individual KPIs (Supply Chain — LPG funnel) ---
async def get_total_indents_raised(
        widget_filters: Optional[List[field_force_model.WidgetFiltersCreate]] = None,
        level_filter: Optional[field_force_model.LevelFilterCreate] = None,
        drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
        *,
        table_data: bool = False,
        page: int = 0,
        page_size: int = 20,
        include_total: bool = True,
):
    """Total indents raised (all states) in period — SOP: Total Indents Raised."""
    filter_sql_fragments = await _filters(widget_filters)
    conditions = _lpg_indent_join_conditions(filter_sql_fragments)
    conditions = " AND " + " AND ".join(conditions) if conditions else " "
    if table_data:
        base_query = f"""SELECT DISTINCT
                a."INDENT_NO" AS "INDENT_NO",
                b."PROD" AS "PROD",
                a."LOCN_CODE" AS "LOCN_CODE",
                a."DEALER_CODE" AS "DEALER_CODE",
                a."INDENT_DATE" AS "INDENT_DATE",
                a."PROD_REQD_DT" AS "PROD_REQD_DT"
            FROM "LPGIMS_SAP"."INDENT_REQUEST" a
            {_LPG_JOIN_INDENT_PRODUCTS_B}
            WHERE 
            TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
            {conditions}
            ORDER BY 
                a."INDENT_NO" DESC"""
        return await _oracle_table_paginated_response(
            base_query,
            page=page,
            page_size=page_size,
            include_total=include_total,
        )
    query = f"""SELECT count(DISTINCT(a."INDENT_NO")) as count FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                {_LPG_JOIN_INDENT_PRODUCTS_B}
                WHERE 
                TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                {conditions}"""
    resp = await execute_ims_query(query)
    n = _aggregate_count_from_resp(resp)
    return {"data": [], "total": n, "count": 0}


async def get_cancelled_indents(
    widget_filters: Optional[List[field_force_model.WidgetFiltersCreate]] = None,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
    *,
    table_data: bool = False,
    page: int = 0,
    page_size: int = 20,
    include_total: bool = True,
):
    """Indents cancelled in the selected window (SOP: Cancelled Indents)."""
    _ = (level_filter, drill_filter, table_data)
    filter_sql_fragments = await _filters(widget_filters)
    conditions = _lpg_indent_join_conditions(filter_sql_fragments)
    conditions = " AND " + " AND ".join(conditions) if conditions else " "
    if table_data:
        base_query = f"""SELECT DISTINCT
                    a."INDENT_NO" AS "INDENT_NO",
                    b."PROD" AS "PROD",
                    a."LOCN_CODE" AS "LOCN_CODE",
                    a."DEALER_CODE" AS "DEALER_CODE",
                    a."CANCEL_TIME" AS "CANCEL_TIME",
                    a."INDENT_DATE" AS "INDENT_DATE",
                    a."PROD_REQD_DT" AS "PROD_REQD_DT"
                FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                J{_LPG_JOIN_INDENT_PRODUCTS_B}
                WHERE 
                TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                AND a."CANCEL_INDENT" IS NOT NULL 
                {conditions}
                ORDER BY 
                    a."INDENT_NO" DESC"""
        return await _oracle_table_paginated_response(
            base_query,
            page=page,
            page_size=page_size,
            include_total=include_total,
        )
    query = f"""SELECT count(DISTINCT(a."INDENT_NO")) AS count FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                    {_LPG_JOIN_INDENT_PRODUCTS_B}
                    WHERE 
                    TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                    AND a."CANCEL_INDENT" IS NOT NULL 
                    {conditions}"""
    resp = await execute_ims_query(query)
    n = _aggregate_count_from_resp(resp)
    return {"data": [], "total": n, "count": 0}


async def get_valid_indents(
    widget_filters: Optional[List[field_force_model.WidgetFiltersCreate]] = None,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
    *,
    table_data: bool = False,
    page: int = 0,
    page_size: int = 20,
    include_total: bool = True,
):
    """Valid Indents  in the selected window (SOP: Valid Indents)."""
    _ = (level_filter, drill_filter, table_data)
    filter_sql_fragments = await _filters(widget_filters)
    conditions = _lpg_indent_join_conditions(filter_sql_fragments)
    conditions = " AND " + " AND ".join(conditions) if conditions else " "
    if table_data:
        base_query = f"""SELECT DISTINCT
                    a."INDENT_NO" AS "INDENT_NO",
                    a."LOCN_CODE" AS "LOCN_CODE",
                    b."PROD" AS "PROD",
                    a."DEALER_CODE" AS "DEALER_CODE",
                    a."INDENT_DATE" AS "INDENT_DATE",
                    a."PROD_REQD_DT" AS "PROD_REQD_DT"
                FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                {_LPG_JOIN_INDENT_PRODUCTS_B}
                WHERE 
                TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                AND a."CANCEL_INDENT" IS NULL 
                AND a."VALID_INDENT_FLAG" IN ('Y', 'H') 
                {conditions}
                ORDER BY 
                    a."INDENT_NO" DESC"""
        return await _oracle_table_paginated_response(
            base_query,
            page=page,
            page_size=page_size,
            include_total=include_total,
        )
    query = f"""SELECT count(DISTINCT(a."INDENT_NO")) AS count FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                    {_LPG_JOIN_INDENT_PRODUCTS_B}
                    WHERE 
                    TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                    AND a."CANCEL_INDENT" IS NULL 
                    AND a."VALID_INDENT_FLAG" IN ('Y', 'H') 
                    {conditions}"""
    resp = await execute_ims_query(query)
    n = _aggregate_count_from_resp(resp)
    return {"data": [], "total": n, "count": 0}


async def get_pending_indents(
    widget_filters: Optional[List[field_force_model.WidgetFiltersCreate]] = None,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
    *,
    table_data: bool = False,
    page: int = 0,
    page_size: int = 20,
    include_total: bool = True,
):
    """
    Indents awaiting approval / allocation (not yet released), per SOP “Pending Indents”.

    Output shape (target):
        {"summary": [{"pending_count": int, ...}], "drill_down": [...] | None, "total": int?}
    """
    filter_sql_fragments = await _filters(widget_filters)
    conditions = _lpg_indent_join_conditions(filter_sql_fragments)
    conditions = " AND " + " AND ".join(conditions) if conditions else " "
    if table_data:
        base_query = f"""SELECT DISTINCT
                        a."INDENT_NO" AS "INDENT_NO",        
                        a."LOCN_CODE" AS "LOCN_CODE",
                        b."PROD" AS "PROD",
                        a."DEALER_CODE" AS "DEALER_CODE",
                        a."INDENT_DATE" AS "INDENT_DATE",
                        a."PROD_REQD_DT" AS "PROD_REQD_DT"
                    FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                    {_LPG_JOIN_INDENT_PRODUCTS_B}
                    WHERE 
                    TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                    AND a."TRUCK_REGNO" IS NULL 
                    AND a."VALID_INDENT_FLAG" <> 'N' 
                    AND (a."CANCEL_INDENT" IS NULL OR a."CANCEL_INDENT" <> 'Y')
                    {conditions}
                    ORDER BY 
                        a."INDENT_NO" DESC"""
        return await _oracle_table_paginated_response(
            base_query,
            page=page,
            page_size=page_size,
            include_total=include_total,
        )
    query = f"""SELECT count(DISTINCT(a."INDENT_NO")) AS count FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                        {_LPG_JOIN_INDENT_PRODUCTS_B}
                        WHERE 
                        TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                        AND a."TRUCK_REGNO" IS NULL 
                        AND a."VALID_INDENT_FLAG" <> 'N' 
                        AND (a."CANCEL_INDENT" IS NULL OR a."CANCEL_INDENT" <> 'Y')
                        {conditions}"""
    resp = await execute_ims_query(query)
    n = _aggregate_count_from_resp(resp)
    return {"data": [], "total": n, "count": 0}


async def get_indents_on_hold(
    widget_filters: Optional[List[field_force_model.WidgetFiltersCreate]] = None,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
    *,
    table_data: bool = False,
    page: int = 0,
    page_size: int = 20,
    include_total: bool = True,
):
    """Indents explicitly on hold (credit / compliance / manual hold) — SOP: Indents on Hold."""
    filter_sql_fragments = await _filters(widget_filters)
    conditions = _lpg_indent_join_conditions(filter_sql_fragments)
    conditions = " AND " + " AND ".join(conditions) if conditions else " "
    if table_data:
        base_query = f"""SELECT DISTINCT
                        a."INDENT_NO" AS "INDENT_NO",
                        a."LOCN_CODE" AS "LOCN_CODE",
                        b."PROD" AS "PROD",
                        a."DEALER_CODE" AS "DEALER_CODE",
                        a."INDENT_DATE" AS "INDENT_DATE",
                        a."PROD_REQD_DT" AS "PROD_REQD_DT"
                    FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                    {_LPG_JOIN_INDENT_PRODUCTS_B}
                    WHERE 
                    TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                    AND a."VALID_INDENT_FLAG" = 'N' 
                    AND (a."CANCEL_INDENT" IS NULL OR a."CANCEL_INDENT" <> 'Y')
                    {conditions}
                    ORDER BY 
                        a."INDENT_NO" DESC"""
        return await _oracle_table_paginated_response(
            base_query,
            page=page,
            page_size=page_size,
            include_total=include_total,
        )
    query = f"""SELECT count(DISTINCT(a."INDENT_NO")) AS count FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                    {_LPG_JOIN_INDENT_PRODUCTS_B}
                    WHERE 
                    TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                    AND a."VALID_INDENT_FLAG" = 'N' 
                    AND (a."CANCEL_INDENT" IS NULL OR a."CANCEL_INDENT" <> 'Y')
                        {conditions}"""
    resp = await execute_ims_query(query)
    n = _aggregate_count_from_resp(resp)
    return {"data": [], "total": n, "count": 0}


async def get_trucks_allocated(
    widget_filters: Optional[List[field_force_model.WidgetFiltersCreate]] = None,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
    *,
    table_data: bool = False,
    page: int = 0,
    page_size: int = 20,
    include_total: bool = True,
):
    """Count of indents with truck allocation (or trucks allocated) — SOP: Trucks Allocated."""
    filter_sql_fragments = await _filters(widget_filters)
    conditions = _lpg_indent_join_conditions(filter_sql_fragments)
    conditions = " AND " + " AND ".join(conditions) if conditions else " "
    if table_data:
        base_query = f"""SELECT DISTINCT
                        a."INDENT_NO" AS "INDENT_NO",
                        a."LOCN_CODE" AS "LOCN_CODE",
                        b."PROD" AS "PROD",
                        a."DEALER_CODE" AS "DEALER_CODE",
                        a."TRUCK_REGNO" AS "TRUCK_REGNO",
                        b."PROD_ALLOT_TIME" AS "PROD_ALLOT_TIME",
                        a."INDENT_DATE" AS "INDENT_DATE",
                        a."PROD_REQD_DT" AS "PROD_REQD_DT"
                    FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                    {_LPG_JOIN_INDENT_PRODUCTS_B}
                    WHERE 
                    TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                    AND a."CANCEL_INDENT" IS NULL 
                    AND a."TRUCK_REGNO" IS NOT NULL
                    {conditions}
                    ORDER BY 
                        a."INDENT_NO" DESC"""
        return await _oracle_table_paginated_response(
            base_query,
            page=page,
            page_size=page_size,
            include_total=include_total,
        )
    query = f"""SELECT count(DISTINCT(a."INDENT_NO")) AS count FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                    {_LPG_JOIN_INDENT_PRODUCTS_B}
                    WHERE 
                    TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                    AND a."CANCEL_INDENT" IS NULL 
                    AND a."TRUCK_REGNO" IS NOT NULL
                        {conditions}"""
    resp = await execute_ims_query(query)
    n = _aggregate_count_from_resp(resp)
    return {"data": [], "total": n, "count": 0}


async def get_sent_to_sap(
    widget_filters: Optional[List[field_force_model.WidgetFiltersCreate]] = None,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
    *,
    table_data: bool = False,
    page: int = 0,
    page_size: int = 20,
    include_total: bool = True,
):
    """Indents pushed to SAP interface — SOP: Sent To SAP."""
    filter_sql_fragments = await _filters(widget_filters)
    conditions = _lpg_indent_join_conditions(filter_sql_fragments)
    conditions = " AND " + " AND ".join(conditions) if conditions else " "
    if table_data:
        base_query = f"""SELECT DISTINCT
                            a."INDENT_NO" AS "INDENT_NO",
                            a."LOCN_CODE" AS "LOCN_CODE",
                            b."PROD" AS "PROD",
                            a."DEALER_CODE" AS "DEALER_CODE",
                            a."SEND_TO_JDE_DATE" AS "SEND_TO_JDE_DATE",
                            a."INDENT_DATE" AS "INDENT_DATE",
                            a."PROD_REQD_DT" AS "PROD_REQD_DT"
                        FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                        {_LPG_JOIN_INDENT_PRODUCTS_B}
                        WHERE 
                        TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                        AND a."CANCEL_INDENT" IS NULL 
                        AND "VALID_INDENT_FLAG" IN ('Y', 'H') 
                        AND (a."BATCH_FLAG" = 'Y' or transfer_status is not null)
                        {conditions}
                        ORDER BY 
                            a."SEND_TO_JDE_DATE" DESC"""
        return await _oracle_table_paginated_response(
            base_query,
            page=page,
            page_size=page_size,
            include_total=include_total,
        )
    query = f"""SELECT count(DISTINCT(a."INDENT_NO")) AS count FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                        {_LPG_JOIN_INDENT_PRODUCTS_B}
                        WHERE 
                        TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                        AND a."CANCEL_INDENT" IS NULL 
                        AND "VALID_INDENT_FLAG" IN ('Y', 'H') 
                        AND (a."BATCH_FLAG" = 'Y' or transfer_status is not null)
                            {conditions}"""
    resp = await execute_ims_query(query)
    n = _aggregate_count_from_resp(resp)
    return {"data": [], "total": n, "count": 0}


async def get_sales_order_placed(
    widget_filters: Optional[List[field_force_model.WidgetFiltersCreate]] = None,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
    *,
    table_data: bool = False,
    page: int = 0,
    page_size: int = 20,
    include_total: bool = True,
):
    """Indents with SAP sales order created — SOP: Sales Order Placed."""
    filter_sql_fragments = await _filters(widget_filters)
    conditions = _lpg_indent_join_conditions(filter_sql_fragments)
    conditions = " AND " + " AND ".join(conditions) if conditions else " "
    if table_data:
        base_query = f"""SELECT DISTINCT
                            a."INDENT_NO" AS "INDENT_NO",
                            a."LOCN_CODE" AS "LOCN_CODE",
                            b."PROD" AS "PROD",
                            a."DEALER_CODE" AS "DEALER_CODE",
                            a."SEND_TO_JDE_DATE" AS "SEND_TO_JDE_DATE",
                            a."INDENT_DATE" AS "INDENT_DATE",
                            a."PROD_REQD_DT" AS "PROD_REQD_DT"
                        FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                        {_LPG_JOIN_INDENT_PRODUCTS_B}
                        WHERE 
                        TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                        AND a."CANCEL_INDENT" IS NULL 
                        AND a."TRUCK_REGNO" IS NOT NULL 
                        AND "VALID_INDENT_FLAG" IN ('Y', 'H') 
                        AND (a."BATCH_FLAG" = 'Y' or transfer_status is not null)
                        AND b."SALES_ORDERNO" IS NOT NULL
                        {conditions}
                        ORDER BY 
                            a."SEND_TO_JDE_DATE" DESC"""
        return await _oracle_table_paginated_response(
            base_query,
            page=page,
            page_size=page_size,
            include_total=include_total,
        )
    query = f"""SELECT count(DISTINCT(a."INDENT_NO")) AS count FROM "LPGIMS_SAP"."INDENT_REQUEST" a 
                        {_LPG_JOIN_INDENT_PRODUCTS_B}
                        WHERE 
                        TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                        AND a."CANCEL_INDENT" IS NULL 
                        AND a."TRUCK_REGNO" IS NOT NULL 
                        AND "VALID_INDENT_FLAG" IN ('Y', 'H') 
                        AND (a."BATCH_FLAG" = 'Y' or transfer_status is not null)
                        AND b."SALES_ORDERNO" IS NOT NULL
                            {conditions}"""
    resp = await execute_ims_query(query)
    n = _aggregate_count_from_resp(resp)
    return {"data": [], "total": n, "count": 0}


async def get_invoice_created(
    widget_filters: Optional[List[field_force_model.WidgetFiltersCreate]] = None,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
    *,
    table_data: bool = False,
    page: int = 0,
    page_size: int = 20,
    include_total: bool = True,
):
    """Indents with billing / invoice document — SOP: Invoice Created."""
    filter_sql_fragments = await _filters(widget_filters)
    conditions = _lpg_indent_join_conditions(filter_sql_fragments)
    conditions = " AND " + " AND ".join(conditions) if conditions else " "
    if table_data:
        base_query = f"""SELECT DISTINCT
                            a."INDENT_NO" AS "INDENT_NO",
                            a."LOCN_CODE" AS "LOCN_CODE",
                            b."PROD" AS "PROD",
                            a."DEALER_CODE" AS "DEALER_CODE",
                            a."INDENT_DATE" AS "INDENT_DATE",
                            a."TRUCK_REGNO" AS "TRUCK_REGNO",
                            a."PROD_REQD_DT" AS "PROD_REQD_DT"
                        FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                        {_LPG_JOIN_INDENT_PRODUCTS_B}
                        WHERE 
                        TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                        AND a."CANCEL_INDENT" IS NULL 
                        AND a."TRUCK_REGNO" IS NOT NULL 
                        AND "VALID_INDENT_FLAG" IN ('Y', 'H') 
                        AND (a."BATCH_FLAG" = 'Y' or transfer_status is not null)
                        AND b."SALES_ORDERNO" IS NOT NULL
                        {conditions}
                        ORDER BY 
                            a."INDENT_NO" DESC"""
        return await _oracle_table_paginated_response(
            base_query,
            page=page,
            page_size=page_size,
            include_total=include_total,
        )
    query = f"""SELECT count(DISTINCT(a."INDENT_NO")) AS count FROM "LPGIMS_SAP"."INDENT_REQUEST" a 
                        {_LPG_JOIN_INDENT_PRODUCTS_B}
                        WHERE 
                        TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                        AND a."CANCEL_INDENT" IS NULL 
                        AND a."TRUCK_REGNO" IS NOT NULL 
                        AND "VALID_INDENT_FLAG" IN ('Y', 'H') 
                        AND (a."BATCH_FLAG" = 'Y' or transfer_status is not null)
                        AND b."SALES_ORDERNO" IS NOT NULL
                            {conditions}"""
    resp = await execute_ims_query(query)
    n = _aggregate_count_from_resp(resp)
    return {"data": [], "total": n, "count": 0}


async def get_r2_swiped(
    widget_filters: Optional[List[field_force_model.WidgetFiltersCreate]] = None,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
    *,
    table_data: bool = False,
    page: int = 0,
    page_size: int = 20,
    include_total: bool = True,
):
    """Trucks where R2 Swiped."""
    filter_sql_fragments = await _filters(widget_filters)
    conditions = _lpg_indent_join_conditions(filter_sql_fragments)
    conditions = " AND " + " AND ".join(conditions) if conditions else " "
    if table_data:
        base_query = f"""SELECT DISTINCT
                            a."INDENT_NO" AS "INDENT_NO",
                            a."LOCN_CODE" AS "LOCN_CODE",
                            a."TRUCK_REGNO" AS "TRUCK_REGNO", 
                            c."CARD_STATUS" AS "CARD_STATUS", 
                            c."LOADED_ON" AS "LOADED_ON", 
                            a."DEALER_CODE" AS "DEALER_CODE",
                            a."TRUCK_REGNO" AS "TRUCK_REGNO",
                            a."INDENT_DATE" AS "INDENT_DATE",
                            a."PROD_REQD_DT" AS "PROD_REQD_DT"
                        FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                        {_LPG_JOIN_INDENT_PRODUCTS_B}
                        JOIN "LPGIMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" c 
                            ON a."LOCN_CODE" = c."LOCN_CODE" 
                            AND a."TRUCK_REGNO" = c."TRUCK_REGNO"
                        WHERE 
                        TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                        AND a."CANCEL_INDENT" IS NULL 
                        AND a."TRUCK_REGNO" IS NOT NULL 
                        AND "VALID_INDENT_FLAG" IN ('Y', 'H') 
                        AND (a."BATCH_FLAG" = 'Y' or transfer_status is not null)
                        AND c."CARD_STATUS" = 'I'
                        AND TO_CHAR(c."LOADED_ON",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                        {conditions}
                        ORDER BY 
                            c."LOADED_ON" DESC        """
        return await _oracle_table_paginated_response(
            base_query,
            page=page,
            page_size=page_size,
            include_total=include_total,
        )
    query = f"""SELECT count(DISTINCT(a."INDENT_NO")) AS count FROM "LPGIMS_SAP"."INDENT_REQUEST" a 
                        {_LPG_JOIN_INDENT_PRODUCTS_B}
                        JOIN "LPGIMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" c 
                            ON a."LOCN_CODE" = c."LOCN_CODE" 
                            AND a."TRUCK_REGNO" = c."TRUCK_REGNO"
                        WHERE 
                        TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                        AND a."CANCEL_INDENT" IS NULL 
                        AND a."TRUCK_REGNO" IS NOT NULL 
                        AND "VALID_INDENT_FLAG" IN ('Y', 'H') 
                        AND (a."BATCH_FLAG" = 'Y' or transfer_status is not null)
                        AND c."CARD_STATUS" = 'I'
                        AND TO_CHAR(c."LOADED_ON",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                            {conditions}"""
    resp = await execute_ims_query(query)
    n = _aggregate_count_from_resp(resp)
    return {"data": [], "total": n, "count": 0}


async def get_r3_swiped(
    widget_filters: Optional[List[field_force_model.WidgetFiltersCreate]] = None,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
    *,
    table_data: bool = False,
    page: int = 0,
    page_size: int = 20,
    include_total: bool = True,
):
    """Indents completed / delivered — SOP: Delivered."""
    filter_sql_fragments = await _filters(widget_filters)
    conditions = _lpg_indent_join_conditions(filter_sql_fragments)
    conditions = " AND " + " AND ".join(conditions) if conditions else " "
    if table_data:
        base_query = f"""SELECT DISTINCT
                            a."INDENT_NO" AS "INDENT_NO",
                            a."LOCN_CODE" AS "LOCN_CODE",
                            a."TRUCK_REGNO" AS "TRUCK_REGNO", 
                            c."CARD_STATUS" AS "CARD_STATUS", 
                            c."LOADED_ON" AS "LOADED_ON", 
                            a."DEALER_CODE" AS "DEALER_CODE",
                            a."TRUCK_REGNO" AS "TRUCK_REGNO",
                            a."INDENT_DATE" AS "INDENT_DATE",
                            a."PROD_REQD_DT" AS "PROD_REQD_DT"
                        FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                        {_LPG_JOIN_INDENT_PRODUCTS_B}
                        JOIN "LPGIMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" c 
                            ON a."LOCN_CODE" = c."LOCN_CODE" 
                            AND a."TRUCK_REGNO" = c."TRUCK_REGNO"
                        WHERE 
                        TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                        AND a."CANCEL_INDENT" IS NULL 
                        AND a."TRUCK_REGNO" IS NOT NULL 
                        AND "VALID_INDENT_FLAG" IN ('Y', 'H') 
                        AND (a."BATCH_FLAG" = 'Y' or transfer_status is not null)
                        AND c."CARD_STATUS" = 'O'
                        AND TO_CHAR(c."LOADED_ON",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                        {conditions}
                        ORDER BY 
                            c."LOADED_ON" DESC        """
        return await _oracle_table_paginated_response(
            base_query,
            page=page,
            page_size=page_size,
            include_total=include_total,
        )
    query = f"""SELECT count(DISTINCT(a."INDENT_NO")) AS count FROM "LPGIMS_SAP"."INDENT_REQUEST" a 
                        {_LPG_JOIN_INDENT_PRODUCTS_B}
                        JOIN "LPGIMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" c 
                            ON a."LOCN_CODE" = c."LOCN_CODE" 
                            AND a."TRUCK_REGNO" = c."TRUCK_REGNO"
                        WHERE 
                        TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                        AND a."CANCEL_INDENT" IS NULL 
                        AND a."TRUCK_REGNO" IS NOT NULL 
                        AND "VALID_INDENT_FLAG" IN ('Y', 'H') 
                        AND (a."BATCH_FLAG" = 'Y' or transfer_status is not null)
                        AND c."CARD_STATUS" = 'O'
                        AND TO_CHAR(c."LOADED_ON",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                            {conditions}"""
    resp = await execute_ims_query(query)
    n = _aggregate_count_from_resp(resp)
    return {"data": [], "total": n, "count": 0}


async def get_delivered(
    widget_filters: Optional[List[field_force_model.WidgetFiltersCreate]] = None,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
    *,
    table_data: bool = False,
    page: int = 0,
    page_size: int = 20,
    include_total: bool = True,
):
    """Indents completed / delivered — SOP: Delivered."""
    filter_sql_fragments = await _filters(widget_filters)
    conditions = _lpg_indent_join_conditions(filter_sql_fragments)
    conditions = " AND " + " AND ".join(conditions) if conditions else " "
    if table_data:
        base_query = f"""SELECT DISTINCT
                            a."INDENT_NO" AS "INDENT_NO",
                            a."LOCN_CODE" AS "LOCN_CODE",
                            b."PROD" AS "PROD",
                            a."DEALER_CODE" AS "DEALER_CODE",
                            a."DELIVERY_DATE" AS "DELIVERY_DATE",
                            a."INDENT_DATE" AS "INDENT_DATE",
                            a."PROD_REQD_DT" AS "PROD_REQD_DT"
                        FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                        {_LPG_JOIN_INDENT_PRODUCTS_B}
                        WHERE 
                        TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                        AND a."CANCEL_INDENT" IS NULL 
                        AND a."TRUCK_REGNO" IS NOT NULL 
                        AND "VALID_INDENT_FLAG" IN ('Y', 'H') 
                        AND (a."BATCH_FLAG" = 'Y' or transfer_status is not null)
                        AND a."DELIVERY_DATE" IS NOT NULL
                        {conditions}
                        ORDER BY 
                            a."INDENT_NO" DESC"""
        return await _oracle_table_paginated_response(
            base_query,
            page=page,
            page_size=page_size,
            include_total=include_total,
        )
    query = f"""SELECT count(DISTINCT(a."INDENT_NO")) AS count FROM "LPGIMS_SAP"."INDENT_REQUEST" a
                        {_LPG_JOIN_INDENT_PRODUCTS_B}
                        WHERE 
                        TO_CHAR(a."PROD_REQD_DT",'yyyymmdd') >= TO_CHAR(SYSDATE,'yyyymmdd')
                        AND a."CANCEL_INDENT" IS NULL 
                        AND a."TRUCK_REGNO" IS NOT NULL 
                        AND "VALID_INDENT_FLAG" IN ('Y', 'H') 
                        AND (a."BATCH_FLAG" = 'Y' or transfer_status is not null)
                        AND a."DELIVERY_DATE" IS NOT NULL
                            {conditions}"""
    resp = await execute_ims_query(query)
    n = _aggregate_count_from_resp(resp)
    return {"data": [], "total": n, "count": 0}


_LPG_INDENT_ACTION_ALIASES: Dict[str, str] = {
    "pending_indents": "get_pending_indents",
    "cancelled_indents": "get_cancelled_indents",
    "valid_indents": "get_valid_indents",
    "total_indents_raised": "get_total_indents_raised",
    "indents_on_hold": "get_indents_on_hold",
    "trucks_allocated": "get_trucks_allocated",
    "sent_to_sap": "get_sent_to_sap",
    "sales_order_placed": "get_sales_order_placed",
    "invoice_created": "get_invoice_created",
    "indents_delivered": "get_delivered",
    "r2_swiped": "get_r2_swiped",
    "r3_swiped": "get_r3_swiped",
    "indent_order_delivery_summary": "get_indent_order_delivery_summary",
}


def _resolve_lpg_indent_action(action: str) -> Optional[str]:
    raw = (action or "").strip()
    if not raw:
        return None
    key = raw.lower().replace("-", "_")
    if key in _LPG_INDENT_ACTION_ALIASES:
        return _LPG_INDENT_ACTION_ALIASES[key]
    if key.startswith("get_"):
        return key
    candidate = f"get_{key}"
    return candidate


def _lpg_indent_action_handlers() -> Dict[str, Callable[..., Any]]:
    return {
        "get_total_indents_raised": get_total_indents_raised,
        "get_pending_indents": get_pending_indents,
        "get_cancelled_indents": get_cancelled_indents,
        "get_valid_indents": get_valid_indents,
        "get_indents_on_hold": get_indents_on_hold,
        "get_trucks_allocated": get_trucks_allocated,
        "get_sent_to_sap": get_sent_to_sap,
        "get_sales_order_placed": get_sales_order_placed,
        "get_invoice_created": get_invoice_created,
        "get_delivered": get_delivered,
        "get_r2_swiped": get_r2_swiped,
        "get_r3_swiped": get_r3_swiped,
        "get_indent_order_delivery_summary": get_indent_order_delivery_summary,
    }


async def get_indent_details(
    data: field_force_model.Indentmanagement_Get_Indent_DetailsParams,
) -> Dict[str, Any]:
    """
    Route ``data.action`` to the matching LPG KPI handler. Merges ``filters`` and ``cross_filters``.

    ``action`` may be a handler name (e.g. ``get_pending_indents``) or an alias (e.g. ``pending_indents``).

    ``data.table_data`` is forwarded to the handler as ``table_data`` (counts vs rows — implement later).

    ``page`` (0-based, default 0), ``page_size``, and ``include_total`` apply when ``table_data`` is true.
    """
    merged: List[field_force_model.WidgetFiltersCreate] = []
    merged.extend(data.filters or [])
    if data.cross_filters:
        merged.extend(data.cross_filters)

    resolved = _resolve_lpg_indent_action(data.action)
    if not resolved:
        return {
            "status": False,
            "message": "Missing or empty action for LPG get_indent_details",
            "data": [],
            "total": None,
            "count": 0,
        }

    handlers = _lpg_indent_action_handlers()
    handler = handlers.get(resolved)
    if handler is None:
        return {
            "status": False,
            "message": f"Unknown LPG indent action: {data.action!r} (resolved: {resolved!r})",
            "data": [],
            "total": None,
            "count": 0,
        }

    return await handler(
        merged,
        table_data=bool(data.table_data),
        page=data.skip,
        page_size=data.limit,
        include_total=True,
    )


async def get_indent_order_delivery_summary(
    widget_filters: Optional[List[field_force_model.WidgetFiltersCreate]] = None,
    level_filter: Optional[field_force_model.LevelFilterCreate] = None,
    drill_filter: Optional[field_force_model.DrillFilterCreate] = None,
    *,
    table_data: bool = False,
):
    all_conditions = []
    start_date = None
    end_date = None

    if widget_filters:
        for filter in widget_filters:
            if "DATE" in filter.key.upper():
                if filter.value:
                    dates = filter.value.split(",")
                elif filter.values:
                    dates = filter.values if isinstance(filter.values, list) else [filter.values]
                else:
                    continue
                start_date = dates[0]
                end_date = dates[-1]
                continue
            if filter.values:
                vals = filter.values if isinstance(filter.values, list) else [filter.values]
            elif filter.value:
                vals = filter.value.split(",")
            else:
                continue

            field_map = {
                "LOCN_CODE": 'r."LOCN_CODE"',
                "CYLINDER_TYPE": 'p."PROD"'
            }

            column = field_map.get(filter.key.upper(), f'r."{filter.key}"')
            if filter.key.upper() == "CYLINDER_TYPE":
                cylinder_map = {
                    "14.2 KG": ["0949036"],
                    "19 KG": ["0948064"],
                    "ALL": ["0949036", "0948064"]
                }
                vals = cylinder_map.get(vals[0], cylinder_map["ALL"])

            if len(vals) == 1:
                all_conditions.append(f"{column}='{vals[0]}'")
            else:
                all_conditions.append(f"{column} IN {tuple(vals)}")

    if start_date:
        all_conditions.append(f'r."PROD_REQD_DT">=DATE \'{start_date}\'')
    if end_date:
        all_conditions.append(f'r."PROD_REQD_DT"<DATE \'{end_date}\'')

    conditions = " AND " + " AND ".join(all_conditions) if all_conditions else ""
    query = f"""
        SELECT
            r."LOCN_CODE",
            TRUNC(r."PROD_REQD_DT") AS process_date,
            r."INDENT_NO",

            SUM(CASE WHEN p."PROD"='0949036' THEN NVL(p."QTY",0) ELSE 0 END) AS ordered_qty_14_2,
            SUM(CASE WHEN p."PROD"='0949036' THEN NVL(p."PROD_ALLOTQTY",0) ELSE 0 END) AS delivered_qty_14_2,

            SUM(CASE WHEN p."PROD"='0948064' THEN NVL(p."QTY",0) ELSE 0 END) AS ordered_qty_19,
            SUM(CASE WHEN p."PROD"='0948064' THEN NVL(p."PROD_ALLOTQTY",0) ELSE 0 END) AS delivered_qty_19,

            SUM(NVL(p."QTY",0)) AS total_ordered_qty,
            SUM(NVL(p."PROD_ALLOTQTY",0)) AS total_delivered_qty

        FROM "LPGIMS_SAP"."INDENT_REQUEST" r

        JOIN "LPGIMS_SAP"."INDENT_PRODUCTS" p
        ON r."LOCN_CODE"=p."LOCN_CODE"
        AND r."INDENT_NO"=p."INDENT_NO"

        WHERE
            r."VALID_INDENT_FLAG" IN ('Y','H')
            AND r."CANCEL_INDENT" IS NULL
            AND (r."INDENT_EXECUTABLE_TIME" IS NOT NULL OR r."DELIVERY_DATE" IS NOT NULL)
            {conditions}

        GROUP BY
            r."LOCN_CODE",
            TRUNC(r."PROD_REQD_DT"),
            r."INDENT_NO"

        ORDER BY
            process_date,
            r."LOCN_CODE",
            r."INDENT_NO"
        """

    resp = await execute_ims_query(query)
    rows = resp.get("data", []) if isinstance(resp, dict) else resp
    if table_data:

        return {
            "data": rows,
            "total": len(rows),
            "count": len(rows)
        }

    summary = {}
    for row in rows:
        key = (row["LOCN_CODE"], str(row["PROCESS_DATE"]))

        if key not in summary:
            summary[key] = {
                "LOCN_CODE": row["LOCN_CODE"],
                "PROCESS_DATE": row["PROCESS_DATE"],
                "ORDERED_INDENTS_14_2": 0,
                "ORDERED_QTY_14_2": 0,
                "DELIVERED_QTY_14_2": 0,
                "ORDERED_INDENTS_19": 0,
                "ORDERED_QTY_19": 0,
                "DELIVERED_QTY_19": 0,
                "TOTAL_ORDERED_INDENTS": 0,
                "TOTAL_ORDERED_QTY": 0,
                "TOTAL_DELIVERED_QTY": 0
            }
        item = summary[key]
        if row["ORDERED_QTY_14_2"] > 0:
            item["ORDERED_INDENTS_14_2"] += 1

        if row["ORDERED_QTY_19"] > 0:
            item["ORDERED_INDENTS_19"] += 1

        item["ORDERED_QTY_14_2"] += row["ORDERED_QTY_14_2"]
        item["DELIVERED_QTY_14_2"] += row["DELIVERED_QTY_14_2"]

        item["ORDERED_QTY_19"] += row["ORDERED_QTY_19"]
        item["DELIVERED_QTY_19"] += row["DELIVERED_QTY_19"]

        item["TOTAL_ORDERED_INDENTS"] += 1
        item["TOTAL_ORDERED_QTY"] += row["TOTAL_ORDERED_QTY"]
        item["TOTAL_DELIVERED_QTY"] += row["TOTAL_DELIVERED_QTY"]

    result = list(summary.values())

    return {
        "data": result,
        "total": len(result),
        "count": 0
    }

