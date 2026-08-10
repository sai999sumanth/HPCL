"""
Location master metadata for field-force filters (id/value pairs from ``location_master``).
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, Iterable, List, Mapping, Optional, Set, Tuple

import urdhva_base


def _row_get(row: Mapping[str, Any], *keys: str) -> Any:
    """Fetch first present key; match case-insensitively (SQLAlchemy/DB column casing varies)."""
    if not row:
        return None
    for k in keys:
        if k in row:
            return row[k]
    lowered = {str(kk).lower(): vv for kk, vv in row.items()}
    for k in keys:
        lk = k.lower()
        if lk in lowered:
            return lowered[lk]
    return None


def _sql_literal(val: str) -> str:
    return "'" + str(val).replace("'", "''") + "'"


def _norm_str(val: Any) -> str:
    if val is None:
        return ""
    s = str(val).strip()
    return s


def _id_value_pair(id_raw: Any, value_raw: Any) -> Optional[Dict[str, str]]:
    """
    ``id`` comes from the code column (e.g. sap_id, region_code); ``value`` is the display field.
    If id is empty, both id and value are set to the non-empty side (same string).
    """
    id_s = _norm_str(id_raw)
    val_s = _norm_str(value_raw)
    if not id_s and not val_s:
        return None
    if not id_s:
        id_s = val_s
    if not val_s:
        val_s = id_s
    return {"id": id_s, "value": val_s}


def _dedupe_pairs(items: Iterable[Optional[Dict[str, str]]]) -> List[Dict[str, str]]:
    seen: Set[Tuple[str, str]] = set()
    out: List[Dict[str, str]] = []
    for it in items:
        if not it:
            continue
        key = (it["id"], it["value"])
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return out


def _sap_metadata_key(bu: str) -> str:
    b = _norm_str(bu)
    if b.upper() in ("LPG_CUSTOMERS", "RO"):
        return "Dealers"
    if b in ("LPG", "TAS"):
        return "Plant"
    return "Plant"


def _filter_clause(metadata_filters: Optional[Mapping[str, Any]]) -> str:
    if not metadata_filters:
        return ""
    parts: List[str] = []
    for col, raw in metadata_filters.items():
        if not col or not all(c.isalnum() or c == "_" for c in str(col)):
            continue
        col_name = str(col)
        if isinstance(raw, (list, tuple, set)):
            vals = [_sql_literal(_norm_str(x)) for x in raw if _norm_str(x)]
            if not vals:
                continue
            parts.append(f"{col_name} IN ({', '.join(vals)})")
        else:
            parts.append(f"{col_name} = {_sql_literal(_norm_str(raw))}")
    if not parts:
        return ""
    return " AND " + " AND ".join(parts)


def _normalize_required(required_fields: Optional[Iterable[str]]) -> Set[str]:
    if not required_fields:
        return set()
    out: Set[str] = set()
    for f in required_fields:
        if not f:
            continue
        out.add(str(f).strip())
    return out


async def get_location_metadata(
    bu: List[str],
    metadata_filters: Optional[Mapping[str, Any]],
    required_fields: Optional[Iterable[str]],
) -> List[Dict[str, Any]]:
    """
    Load distinct id/value options from ``location_master`` per business unit.

    - ``sap_id`` (and ``location_name``): id = ``sap_id``, value = ``name``. Output key is
      ``Plant`` for LPG/TAS and ``Dealers`` for RO/LPG_Customers.
    - ``region`` / ``region_code``: id = ``region_code``, value = ``region`` (if id empty, id and
      value match).
    - ``sales_area`` / ``sales_area_code``: id = ``sales_area_code``, value = ``sales_area``.
    - ``zone``: id and value both use the ``zone`` column.
    - ``terminal_plant_id``, ``terminal_id``, ``terminal_plant_name``: id = ``terminal_plant_id``,
      value = ``terminal_plant_name``; response key is always ``locations``.

    :param bu: Business units to iterate (one result object per BU).
    :param metadata_filters: Extra ``WHERE`` predicates (column -> scalar or list for ``IN``).
    :param required_fields: Which option lists to include under ``metadata``.
    :return: ``[{"bu": "...", "metadata": {...}}, ...]``
    """
    fields = _normalize_required(required_fields)
    extra_where = _filter_clause(metadata_filters)

    if not bu:
        return []

    results: List[Dict[str, Any]] = []
    bu_list = []
    seen_bu: Set[str] = set()
    for b in bu:
        bs = _norm_str(b)
        if not bs or bs in seen_bu:
            continue
        seen_bu.add(bs)
        bu_list.append(bs)

    need_sap = bool(fields & {"sap_id", "location_name"})
    need_region = bool(fields & {"region", "region_code"})
    need_sales = bool(fields & {"sales_area", "sales_area_code"})
    need_zone = bool(fields & {"zone"})
    need_terminal = bool(
        fields & {"terminal_plant_id", "terminal_id", "terminal_plant_name"}
    )

    for b in bu_list:
        base_where = f"bu = {_sql_literal(b)}" + extra_where
        meta: Dict[str, List[Dict[str, str]]] = {}

        async def fetch_distinct(select_cols: str) -> List[Dict[str, Any]]:
            q = f"SELECT DISTINCT {select_cols} FROM location_master WHERE {base_where}"
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query=q, limit=0)
            return resp.get("data") or []

        queries: List[Any] = []
        if need_sap:
            queries.append(("sap", fetch_distinct("sap_id, name")))
        if need_region:
            queries.append(("region", fetch_distinct("region, region_code")))
        if need_sales:
            queries.append(("sales", fetch_distinct("sales_area, sales_area_code")))
        if need_zone:
            # Qualified + alias: ``zone`` is awkward as a bare identifier; alias fixes result keys.
            queries.append(
                (
                    "zone",
                    fetch_distinct('location_master.zone AS "zone_value"'),
                )
            )
        if need_terminal:
            queries.append(
                ("terminal", fetch_distinct("terminal_plant_id, terminal_plant_name"))
            )

        if queries:
            fetched = await asyncio.gather(*[q[1] for q in queries])
            by_key = {queries[i][0]: fetched[i] for i in range(len(queries))}
        else:
            by_key = {}

        if need_sap:
            sap_key = _sap_metadata_key(b)
            rows = by_key.get("sap", [])
            pairs = _dedupe_pairs(
                _id_value_pair(_row_get(r, "sap_id"), _row_get(r, "name")) for r in rows
            )
            if pairs:
                meta[sap_key] = pairs

        if need_region:
            rows = by_key.get("region", [])
            region_pairs = _dedupe_pairs(
                _id_value_pair(_row_get(r, "region_code"), _row_get(r, "region"))
                for r in rows
            )
            if "region" in fields:
                meta["region"] = list(region_pairs)
            if "region_code" in fields:
                meta["region_code"] = list(region_pairs)

        if need_sales:
            rows = by_key.get("sales", [])
            sa_pairs = _dedupe_pairs(
                _id_value_pair(
                    _row_get(r, "sales_area_code"), _row_get(r, "sales_area")
                )
                for r in rows
            )
            if "sales_area" in fields:
                meta["sales_area"] = list(sa_pairs)
            if "sales_area_code" in fields:
                meta["sales_area_code"] = list(sa_pairs)

        if need_zone:
            rows = by_key.get("zone", [])
            zone_pairs = _dedupe_pairs(
                _id_value_pair(
                    _row_get(r, "zone_value", "zone"),
                    _row_get(r, "zone_value", "zone"),
                )
                for r in rows
            )
            if zone_pairs:
                meta["zone"] = zone_pairs

        if need_terminal:
            rows = by_key.get("terminal", [])
            loc_pairs = _dedupe_pairs(
                _id_value_pair(
                    _row_get(r, "terminal_plant_id"),
                    _row_get(r, "terminal_plant_name"),
                )
                for r in rows
            )
            if loc_pairs:
                meta["locations"] = loc_pairs

        results.append({"bu": b, "metadata": meta})

    return results
