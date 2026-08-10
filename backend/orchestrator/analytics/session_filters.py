"""
Session territory filters merged into table-analytics / aggregate ``filters`` dicts.

Uses :data:`orchestrator.field_force.utils.TERRITORY_COLUMN_BY_VENDOR` and
:mod:`orchestrator.field_force.vendor_territory_mapping` for role-based perspective;
logic lives here so analytics does not depend on field_force helper placement beyond the shared column map.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import orchestrator.field_force.vendor_territory_mapping as vendor_territory_mapping
from orchestrator.field_force.utils import TERRITORY_COLUMN_BY_VENDOR


def _qualify_gateway_column(col: str, column_name_prefix: Optional[str]) -> str:
    """
    Prefix a simple column name for joined queries (e.g. ``loc`` + ``region`` → ``loc.region``).
    Leaves expressions such as ``SUBSTR(...)`` or already-qualified names unchanged.
    """
    p = column_name_prefix.strip().rstrip(".").strip() if column_name_prefix else ""
    if not p:
        return col
    c = col.strip()
    if "(" in c or "." in c:
        return c
    return f"{p}.{c}"


def session_territory_filters_for_gateway(
    vendor: str,
    model: Optional[str] = None,
    column_name_prefix: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Territory → column mapping (same as field_force ``generate_session_filters``), as a dict
    suitable for :func:`orchestrator.analytics.aggregate_query_gateway.query_aggregate_gateway`
    ``filters`` (equality / ``IN`` list per column).

    Uses :func:`vendor_territory_mapping.get_role_based_filters`.
    """
    out: Dict[str, Any] = {}
    filters = vendor_territory_mapping.get_role_based_filters(vendor)
    model_key = (model or vendor).upper()
    column_map = TERRITORY_COLUMN_BY_VENDOR.get(model_key)
    if not column_map:
        return out
    for territory, value in filters.items():
        col = column_map.get(territory)
        if not col:
            continue
        if value is None or (isinstance(value, list) and len(value) == 0):
            continue
        key = _qualify_gateway_column(col, column_name_prefix)
        out[key] = value
    return out


def _normalize_filter_values_to_list(val: Any) -> List[Any]:
    if val is None:
        return []
    if isinstance(val, (list, tuple, set)):
        return list(val)
    return [val]


def _intersect_gateway_filter_values(user_val: Any, session_val: Any) -> Any:
    """Intersection of allowed values; empty list means no row matches (caller may emit ``FALSE``)."""
    u_list = _normalize_filter_values_to_list(user_val)
    s_list = _normalize_filter_values_to_list(session_val)
    if not s_list:
        return user_val
    if not u_list:
        return session_val
    s_set = {str(x) for x in s_list}
    inter = [x for x in u_list if str(x) in s_set]
    if not inter:
        return []
    if len(inter) == 1:
        return inter[0]
    return inter


def merge_user_filters_with_session(
    user_filters: Optional[Dict[str, Any]],
    session_filters: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Combine request ``filters`` with session-derived filters: keys present in both use
    value intersection; keys only in session or only in user are kept as-is.
    """
    user_filters = dict(user_filters or {})
    session_filters = dict(session_filters or {})
    if not session_filters:
        return user_filters
    out: Dict[str, Any] = {}
    all_keys = set(user_filters.keys()) | set(session_filters.keys())
    for k in all_keys:
        u = user_filters.get(k)
        s = session_filters.get(k)
        if s is None:
            out[k] = u
        elif u is None:
            out[k] = s
        else:
            out[k] = _intersect_gateway_filter_values(u, s)
    return out
