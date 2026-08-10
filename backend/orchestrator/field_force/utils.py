"""
Shared utilities for Field Force orchestrator (IMS, CRIS, Novex, etc.).
"""
from typing import Any, Dict, List, Optional, Union

import orchestrator.field_force.vendor_territory_mapping as vendor_territory_mapping

# -------- Territory → column name per vendor/model (for WHERE conditions and WidgetFilters) --------
TERRITORY_COLUMN_BY_VENDOR: Dict[str, Dict[str, str]] = {
    "IMS": {
        "location": "LOCN_CODE",
        # "sales_area": "sales_area",
        # "region": "region",
        # "zone": "zone",
        "plant": "LOCN_CODE",
        "dealer": "SUBSTR(DEALER_CODE,3,10)",
    },
    "IMS_LPG": {
        "location": "LOCN_CODE",
        "plant": "LOCN_CODE",
        "sales_area": "SAREA_CODE",
        "zone": "ZONE",
    },
    "CRIS": {
        "location": "rosapcode",
        "sales_area": "SALES_AREA",
        "region": "Region",
        "zone": "zone",
    },
    "NOVEX": {
        "location": "sap_id",
        "sales_area": "sales_area",
        "region": "region",
        "zone": "zone",
        "bu": "bu"
    },
    "TIBCO_SALES": {
        "sales_area": "SalesArea_Name",
        "region": "Region_Name",
        "zone": "Zone_Name",
        "bu": "SBU_Name"
    }
}


def format_in_condition(column: str, value: Any) -> str:
    """
    Build a single SQL-friendly condition: column = 'val' or column in ('a','b').

    Values are stringified and wrapped in quotes for IN clauses. Used by
    generate_session_filters in ims and cris. Caller should use parameterized
    queries in production when values may be user-controlled.

    :param column: SQL column (or field) name.
    :param value: Single value (str, int, etc.) or list of values for IN clause.
    :return: Condition string, e.g. "sales_area='MUMBAI DS SA'" or "sap_id in ('1','2')".
             Empty string if value is None or empty list.
    """
    if value is None or (isinstance(value, list) and len(value) == 0):
        return ""
    if isinstance(value, list):
        quoted = tuple(f'{str(v)}' for v in value)
        return f"{column} in {quoted}"
    return f"{column}='{str(value)}'"


def generate_session_filters(
    vendor: str,
    model: Optional[str] = None,
    query_filters: Optional[List[str]] = None,
) -> List[str]:
    """
    Build WHERE-style conditions from the current user's session (role-based territory).

    Uses vendor_territory_mapping.get_role_based_filters(vendor) and maps each territory
    type to the correct column name for the given model, then formats as SQL conditions.

    :param vendor: Target system for territory mapping, e.g. "IMS", "CRIS".
    :param model: Optional; defaults to vendor. Used to look up column map (e.g. "CRIS" vs "NOVEX").
    :param query_filters: Optional; not merged here; caller can combine with returned list.
    :return: List of condition strings (e.g. "sales_area='MUMBAI DS SA'"). Empty if no session.
    """
    conditions = []
    filters = vendor_territory_mapping.get_role_based_filters(vendor)
    model_key = (model or vendor).upper()
    column_map = TERRITORY_COLUMN_BY_VENDOR.get(model_key)
    if not column_map:
        return conditions
    for territory, value in filters.items():
        col = column_map.get(territory)
        if not col:
            continue
        cond = format_in_condition(col, value)
        if cond:
            conditions.append(cond)
    return conditions


def _value_is_empty(v: Any) -> bool:
    if v is None:
        return True
    if isinstance(v, str) and v.strip() == "":
        return True
    return False


def _coalesce_widget_value_and_values(item: Dict[str, Any]) -> None:
    """
    If ``value`` is empty but ``values`` is a non-empty list, normalize to a single ``value``
    or ``cond`` ``in`` + ``values``, in place.
    """
    v = item.get("value")
    vs = item.get("values")
    if not _value_is_empty(v):
        return
    if not isinstance(vs, list) or len(vs) == 0:
        return
    strs = [str(x) for x in vs if x is not None and str(x).strip() != ""]
    if not strs:
        return
    if len(strs) == 1:
        item["value"] = strs[0]
        item["cond"] = "="
        item.pop("values", None)
    else:
        item["values"] = strs
        item["cond"] = "in"
        item.pop("value", None)


def widget_filters_to_condition_strings(
    widget_filters: List[Dict[str, Any]],
) -> List[str]:
    """
    Convert normalized widget filters to the same SQL-style fragments as
    :func:`generate_session_filters` (via :func:`format_in_condition`).

    Examples: ``SAREA_CODE='384'``, ``ZONE in ('a', 'b')``.

    Reuses :func:`_coalesce_widget_value_and_values`, so ``cond: '='`` with
    multiple ``values`` becomes an ``IN`` list before formatting.
    """
    out: List[str] = []
    for raw in widget_filters or []:
        item = dict(raw)
        _coalesce_widget_value_and_values(item)
        col = str(item.get("key") or "").strip()
        if not col:
            continue
        v = item.get("value")
        vs = item.get("values")
        if isinstance(vs, list) and len(vs) > 1:
            s = format_in_condition(col, [str(x) for x in vs])
        elif isinstance(vs, list) and len(vs) == 1:
            s = format_in_condition(col, str(vs[0]))
        elif not _value_is_empty(v):
            s = format_in_condition(col, v)
        else:
            continue
        if s:
            out.append(s)
    return out


def _apply_vendor_territory_to_widget_item(
    item: Dict[str, Any], territory_type: str, vendor: str
) -> None:
    """Map filter values through vendor_territory (e.g. sales_area codes) like session filters."""
    c = str(item.get("cond") or "").lower()
    if c == "in" and isinstance(item.get("values"), list):
        mapped = vendor_territory_mapping.get_vendor_territory(
            territory_type, item["values"], vendor
        )
        if isinstance(mapped, list):
            item["values"] = [str(x) for x in mapped]
        elif mapped is not None:
            item["values"] = [str(mapped)]
    elif not _value_is_empty(item.get("value")):
        mapped = vendor_territory_mapping.get_vendor_territory(
            territory_type, item.get("value"), vendor
        )
        if isinstance(mapped, list):
            if len(mapped) == 1:
                item["value"] = str(mapped[0])
            elif len(mapped) > 1:
                item["values"] = [str(x) for x in mapped]
                item["cond"] = "in"
                item.pop("value", None)
        elif mapped is not None:
            item["value"] = str(mapped)


def normalize_widget_filters_for_model(
    widget_filters: List[Dict[str, Any]],
    vendor: str,
    model: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Map semantic territory keys on widget filters to SQL column names (same as session path)
    and normalize ``value`` / ``values`` (e.g. empty ``value`` with ``values: ['384']``).

    Only rewrites ``key`` when it matches a territory key in ``TERRITORY_COLUMN_BY_VENDOR``
    for the given model (case-insensitive). Already-resolved column names are left unchanged.
    """
    model_key = (model or vendor).upper()
    column_map = TERRITORY_COLUMN_BY_VENDOR.get(model_key, {})
    out: List[Dict[str, Any]] = []
    for raw in widget_filters or []:
        item = dict(raw)
        _coalesce_widget_value_and_values(item)
        key = str(item.get("key") or "").strip()
        if not key:
            out.append(item)
            continue
        lk = key.lower()
        sql_col = column_map.get(lk)
        if sql_col:
            item["key"] = sql_col
            _coalesce_widget_value_and_values(item)
            _apply_vendor_territory_to_widget_item(item, lk, vendor)
        out.append(item)
    return out


def _session_bu_from_context() -> Optional[str]:
    """Resolve business unit from request context (``rpt``), if present."""
    try:
        import urdhva_base

        if urdhva_base.ctx.exists():
            rpt = urdhva_base.context.context.get("rpt", {})
            for key in ("bu", "BU", "business_unit"):
                v = rpt.get(key)
                if v is None or (isinstance(v, str) and not v.strip()):
                    continue
                return str(v).strip()
    except Exception:
        pass
    return None


def _as_str_list(value: Union[str, List[Any]]) -> List[str]:
    if isinstance(value, list):
        return [str(x).strip() for x in value if x is not None and str(x).strip() != ""]
    if value is None or (isinstance(value, str) and not value.strip()):
        return []
    return [str(value).strip()]


def _sql_literal(val: str) -> str:
    return "'" + str(val).replace("'", "''") + "'"


def _sales_area_from_row(row: Dict[str, Any]) -> Optional[str]:
    if not row:
        return None
    for k in ("sales_area", "SALES_AREA", "sales_area_code"):
        if k in row and row[k] is not None:
            s = str(row[k]).strip()
            return s if s else None
    lowered = {str(kk).lower(): vv for kk, vv in row.items()}
    v = lowered.get("sales_area") or lowered.get("sales_area_code")
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


async def _fetch_distinct_sales_areas_for_regions(bu: str, regions: List[str]) -> List[str]:
    """
    Distinct ``sales_area`` from ``location_master`` for the given BU and region names.

    Uses ``urdhva_base.postgresmodel.BasePostgresModel.get_aggr_data``. Returns an empty list on
    failure or when no rows match.
    """
    if not bu or not regions:
        return []
    try:
        import urdhva_base

        bu_lit = _sql_literal(bu.strip())
        region_lits = [_sql_literal(r) for r in regions if str(r).strip()]
        if not region_lits:
            return []
        sales_area_key = "sales_area_code" if bu_lit == "LPG_CUSTOMERS" else "sales_area"
        in_clause = ", ".join(region_lits)
        sql = f"""
            SELECT DISTINCT {sales_area_key}
            FROM location_master
            WHERE bu = {bu_lit}
              AND (region_code IN ({in_clause}) or region in ({in_clause}))
              AND {sales_area_key} IS NOT NULL
              AND TRIM(COALESCE(sales_area::text, '')) <> ''
        """
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=sql, limit=0)
        rows = resp.get("data") or []
        vals: List[str] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            sa = _sales_area_from_row(row)
            if sa:
                vals.append(sa)
        return list(dict.fromkeys(vals))
    except Exception:
        return []


def _widget_filter_key_is_region(key: str, column_map: Dict[str, str]) -> bool:
    """True if ``key`` is the region territory for this model (semantic or mapped SQL column)."""
    k = (key or "").strip()
    if not k:
        return False
    mapped = column_map.get("region")
    if mapped:
        return k.lower() == mapped.lower()
    return k.lower() == "region"


def _territory_value_for_widget_item(item: Dict[str, Any]) -> Any:
    """Single value or list to pass to :func:`get_vendor_territory` (after coalesce)."""
    _coalesce_widget_value_and_values(item)
    vs = item.get("values")
    v = item.get("value")
    if isinstance(vs, list) and len(vs) > 0:
        return vs if len(vs) > 1 else vs[0]
    if not _value_is_empty(v):
        return v
    return None


async def _expand_widget_regions_to_sales_area_filters(
    items: List[Dict[str, Any]],
    column_map: Dict[str, str],
    vendor: str,
    bu: Optional[str],
    *,
    expand_region_to_sales_area: bool = True,
) -> List[Dict[str, Any]]:
    """
    For each widget filter on ``region``, replace with distinct ``sales_area`` from
    ``location_master`` when BU and ``sales_area`` column exist (same rules as session path).
    If expansion yields no rows, the original region filter is kept.
    """
    if not expand_region_to_sales_area or not items:
        return items
    eff_bu = bu or _session_bu_from_context()
    sales_area_col = column_map.get("sales_area")
    if not eff_bu or not sales_area_col:
        return items

    out: List[Dict[str, Any]] = []
    for raw in items:
        item = dict(raw)
        if not _widget_filter_key_is_region(str(item.get("key") or "").strip(), column_map):
            out.append(item)
            continue
        tv = _territory_value_for_widget_item(item)
        if tv is None:
            out.append(item)
            continue

        if expand_region_to_sales_area:
            mapped = vendor_territory_mapping.get_vendor_territory("region", tv, vendor)
            regions = _as_str_list(mapped)
            if not regions:
                out.append(item)
                continue
            sas = await _fetch_distinct_sales_areas_for_regions(eff_bu, regions)
            if sas:
                out.append(
                    {"key": sales_area_col, "cond": "in", "values": sas}
                )
            else:
                out.append(item)
        else:
            out.append(item)
    return out


async def session_dict_to_widget_filters(
    session_dict: Dict[str, Any],
    column_map: Dict[str, str],
    *,
    vendor: str = "IMS",
    bu: Optional[str] = None,
    expand_region_to_sales_area: bool = True,
) -> List[Dict[str, Any]]:
    """
    Convert session filter dict (territory -> value/list) to WidgetFilters format.

    Applies the same vendor mapping as :func:`vendor_territory_mapping.get_vendor_territory`
    (``sales_area_mapping``, ``region_mapping``, ``zone_mapping``). If a mapping is missing
    or empty, the original session value is kept.

    When ``territory`` is ``region``, optional expansion: distinct ``sales_area`` from
    ``location_master`` where ``bu`` matches and ``region`` is in the mapped region list
    (requires ``bu`` from the ``bu`` argument or session ``rpt``). On success, a single
    ``sales_area`` / ``SAREA_CODE`` ``in`` filter is emitted instead of ``region``.

    Each entry becomes ``{"key": column_name, "cond": "=" | "in", "value": str}`` or
    ``{"key": column_name, "cond": "in", "values": list}``.

    :param session_dict: Dict from get_role_based_filters, e.g. ``{"sales_area": "X"}`` or ``{"region": ["A","B"]}``.
    :param column_map: Territory type -> column name, e.g. ``TERRITORY_COLUMN_BY_VENDOR["IMS_LPG"]``.
    :param vendor: Target vendor key for mapping (e.g. ``IMS_LPG``, ``CRIS``).
    :param bu: Business unit for region→sales_area SQL; defaults to session ``rpt`` when omitted.
    :param expand_region_to_sales_area: When False, region is passed through to the region column only.
    :return: List of filter items in WidgetFilters shape (key, cond, value or values).
    """
    eff_bu = bu or _session_bu_from_context()
    sales_area_col = column_map.get("sales_area")

    out: List[Dict[str, Any]] = []
    for territory, value in session_dict.items():
        mapped = vendor_territory_mapping.get_vendor_territory(territory, value, vendor)

        if (
            territory == "region"
            and expand_region_to_sales_area
            and eff_bu
            and sales_area_col
        ):
            regions = _as_str_list(mapped)
            if regions:
                sas = await _fetch_distinct_sales_areas_for_regions(eff_bu, regions)
                if sas:
                    out.append(
                        {
                            "key": sales_area_col,
                            "cond": "in",
                            "values": sas,
                        }
                    )
                    continue

        col = column_map.get(territory)
        if not col:
            continue

        if isinstance(mapped, list):
            if len(mapped) == 0:
                continue
            if len(mapped) == 1:
                out.append({"key": col, "cond": "=", "value": str(mapped[0])})
            else:
                out.append({"key": col, "cond": "in", "values": [str(v) for v in mapped]})
        else:
            out.append({"key": col, "cond": "=", "value": str(mapped)})
    return out


async def get_input_filters(
    widget_filters: List[Dict[str, Any]],
    vendor: str = "IMS",
    merge_session: bool = True,
    model: Optional[str] = None,
    bu: Optional[str] = None,
    expand_region_to_sales_area: bool = True,
) -> List[Dict[str, Any]]:
    """
    Configure effective input filters in WidgetFilters format, optionally merging session-based filters.

    Session filters (from get_role_based_filters) are converted to the same WidgetFilters structure
    (key, cond, value or values), including territory mapping and optional region→sales_area expansion.
    Request ``widget_filters`` are normalized the same way; when ``key`` is ``region`` (or the model's
    region SQL column), they are expanded to distinct ``sales_area`` from ``location_master`` like session.

    Session filters are applied first (role restriction), then the request's widget_filters.

    :param widget_filters: Filters from the API request (list of {key, cond, value?/values?}).
    :param vendor: Target system for territory mapping; "IMS", "CRIS", "IMS_LPG", etc.
    :param merge_session: If True, prepend session-derived filters; if False, return copy of widget_filters.
    :param model: Optional; for CRIS/NOVEX use model to pick column map; defaults to vendor.
    :param bu: Optional business unit for ``location_master`` when expanding ``region`` to sales areas.
    :param expand_region_to_sales_area: When False, keep region filters without DB expansion.
    :return: List of filter items in WidgetFilters format.
    """
    model_key = (model or vendor).upper()
    column_map = TERRITORY_COLUMN_BY_VENDOR.get(model_key, {})

    normalized = normalize_widget_filters_for_model(
        list(widget_filters) if widget_filters else [],
        vendor=vendor,
        model=model,
    )
    normalized = await _expand_widget_regions_to_sales_area_filters(
        normalized,
        column_map,
        vendor,
        bu,
        expand_region_to_sales_area=expand_region_to_sales_area,
    )
    if not merge_session:
        return normalized

    session_dict = vendor_territory_mapping.get_role_based_filters(vendor)
    if not session_dict:
        return normalized

    session_as_widgets = await session_dict_to_widget_filters(
        session_dict,
        column_map,
        vendor=vendor,
        bu=bu,
        expand_region_to_sales_area=expand_region_to_sales_area,
    )
    return session_as_widgets + normalized
