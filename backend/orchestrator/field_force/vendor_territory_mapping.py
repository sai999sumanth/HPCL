"""
Vendor territory mapping for Field Force.

Maps normalized (e.g. lowercase) territory names to vendor-specific identifiers
used by IMS, CRIS, and other systems. Used to translate user context (sales area,
region, zone) into the correct filter values per data source.
"""
from __future__ import annotations

import urdhva_base
from typing import Optional
import orchestrator.field_force.territory_mapping.zone_mapping as zone_mapping
import orchestrator.field_force.territory_mapping.region_mapping as region_mapping
import orchestrator.field_force.territory_mapping.sales_area_mapping as sales_area_mapping

# ---------------------------------------------------------------------------
# Sales area: key = normalized name (lowercase), value = per-vendor display name
# IMS = Indent Management System; CRIS = tank/nozzle; empty string = no mapping
# ---------------------------------------------------------------------------


# Territory-type key for lookups; only "sales_area" has explicit mapping so far
vendor_mapping = {"sales_area": sales_area_mapping.sales_area_mapping,
                  "region": region_mapping.region_mapping, "zone": zone_mapping.zone_mapping}

# Priority order for resolving user perspective from session (first match wins)
_USER_TERRITORY_KEYS = (
    ("location", "sap_id"),
    ("sales_area", "sales_area"),
    ("region", "region"),
    ("zone", "zone"),
)


def _get_sales_area_vendor_value(sales_area_key: str, vendor: str):
    """
    Resolve a single sales area key to the given vendor's value.

    :param sales_area_key: Sales area lookup key (matched case-insensitively against mapping keys).
    :param vendor: Target system key, e.g. "IMS", "CRIS", "IMS_LPG".
    :return: Vendor-specific value string, or None if key or vendor not in mapping.
    """
    norm = str(sales_area_key).lower().strip()
    area = vendor_mapping["sales_area"].get(norm)
    if not area:
        return None
    return area.get(vendor) if area else None


def get_sales_area_vendor_value(territory_value, vendor):
    """
    Map one or more sales area keys to the given vendor's display values.

    Delegates to _get_sales_area_vendor_value per key. For a list of keys, returns
    a list of mapped values (skipping any key with no mapping). For a single key,
    returns the mapped string or the original key if not found.

    :param territory_value: Single sales area key (str) or list of keys.
    :param vendor: Target system key, e.g. "IMS", "CRIS".
    :return: Mapped value(s), or territory_value when single key has no mapping.
    """
    if isinstance(territory_value, list):
        mapping = []
        for rec in territory_value:
            val = _get_sales_area_vendor_value(rec, vendor)
            mapping.append(val if val is not None else rec)
        return mapping

    val = _get_sales_area_vendor_value(territory_value, vendor)
    return val if val is not None else territory_value


def _resolve_zone_code(raw: str) -> Optional[str]:
    """Map zone short code or full zone name to canonical code (NZ, EZ, …)."""
    s = str(raw).strip()
    if not s:
        return None
    sup = s.upper()
    zm = zone_mapping.zone_mapping
    if sup in zm:
        return sup
    for full_name, code in zone_mapping.zone_map.items():
        if full_name.upper() == sup:
            return code
    return None


def _get_zone_vendor_value_single(raw: str, vendor: str) -> str:
    code = _resolve_zone_code(raw)
    if not code:
        return raw
    entry = zone_mapping.zone_mapping.get(code)
    if not entry:
        return raw
    val = entry.get(vendor)
    if val is None or str(val).strip() == "":
        return raw
    return val


def get_zone_vendor_value(territory_value, vendor: str):
    """Map zone code or full name to the value used by ``vendor`` (empty mapping → original)."""
    if isinstance(territory_value, list):
        return [_get_zone_vendor_value_single(str(x), vendor) for x in territory_value]
    return _get_zone_vendor_value_single(str(territory_value), vendor)


def _find_region_mapping_entry(raw: str):
    s = str(raw).strip()
    if not s:
        return None
    su = s.upper()
    for k, v in region_mapping.region_mapping.items():
        if k.upper() == su:
            return v
    return None


def _get_region_vendor_value_single(raw: str, vendor: str) -> str:
    entry = _find_region_mapping_entry(raw)
    if not entry:
        return raw
    val = entry.get(vendor)
    if val is None or str(val).strip() == "":
        return raw
    return val


def get_region_vendor_value(territory_value, vendor: str):
    """Map region to the value used by ``vendor`` (empty mapping → original)."""
    if isinstance(territory_value, list):
        return [_get_region_vendor_value_single(str(x), vendor) for x in territory_value]
    return _get_region_vendor_value_single(str(territory_value), vendor)


def get_vendor_territory(territory_type, territory_value, vendor):
    """
    Map territory to the value used by a specific vendor (IMS, CRIS, IMS_LPG, …).

    Uses ``sales_area_mapping``, ``region_mapping``, and ``zone_mapping`` where defined.
    If a mapping entry is missing or the vendor value is empty, the original value is kept.

    :param territory_type: One of "sales_area", "region", "zone".
    :param territory_value: Single key/name (str) or list of strings.
    :param vendor: Target system key, e.g. "IMS", "CRIS", "IMS_LPG".
    :return: Mapped value(s), or originals when no mapping applies.
    """
    if territory_type == "sales_area":
        return get_sales_area_vendor_value(territory_value, vendor)
    if territory_type == "zone":
        return get_zone_vendor_value(territory_value, vendor)
    if territory_type == "region":
        return get_region_vendor_value(territory_value, vendor)
    return territory_value


def get_user_perspectives():
    """
    Derive user's territory perspective from logged-in session (urdhva_base context).

    Reads rpt (report/session context) and returns the highest-priority territory
    available: location (sap_id) > sales_area > region > zone.

    :return: List of one dict [{"territory": "<type>", "values": <id or list>}], or [].
    """
    if not urdhva_base.ctx.exists():
        return []
    rpt = urdhva_base.context.context.get("rpt", {})
    territory_mapping = []
    territory, key = 'bu', 'bu'
    if key in rpt and rpt[key]:
        territory_mapping.append({"territory": territory, "values": rpt[key]}) 
    for territory, key in _USER_TERRITORY_KEYS:
        value = rpt.get(key)
        if value:
            # TODO: Compare with role (novex_role) for secondary validation
            territory_mapping.append({"territory": territory, "values": value})
            return territory_mapping
    # TODO: Check role for secondary validation
    return territory_mapping


def get_role_based_filters(vendor):
    """
    Build filter dict keyed by territory type with values translated for the given vendor.

    Uses get_user_perspectives() and get_vendor_territory() so that filters match
    the user's context in the format expected by IMS, CRIS, etc.

    :param vendor: Target system, e.g. "IMS", "CRIS".
    :return: Dict of territory_type -> mapped value(s); empty if no perspectives.
    """
    perspectives = get_user_perspectives()
    if not perspectives:
        return {}
    return {
        p["territory"]: get_vendor_territory(p["territory"], p["values"], vendor)
        for p in perspectives
    }
