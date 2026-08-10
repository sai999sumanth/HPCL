"""
Zone Code Mapping
Maps sap_id and zone to their corresponding zone_code
If mapping not found, falls back to zone-only mapping
"""

# Fallback zone-only mapping
ZONE_FALLBACK_MAPPING = {
    "NWZ": "11370",
    "EZ": "11600",
    "SZ": "11750",
    "WZ": "11350",
    "SCZ": "11770",
    "NCZ": "11120",
    "NZ": "11100",
    "SWZ": "11770",
    "CEN": "11350",
    "ECZ": "11600",
    "NFZ": "11100",
    "NWF": "11370"
}

ZONE_CODE_MAPPING = [
    {"sap_id": "2121", "zone": "NWZ", "zone_code": "2120"},
    {"sap_id": "2664", "zone": "EZ", "zone_code": "2600"},
    {"sap_id": "2465", "zone": "NWZ", "zone_code": "2120"},
    {"sap_id": "2449", "zone": "NWZ", "zone_code": "2370"},
    {"sap_id": "2982", "zone": "EZ", "zone_code": "2120"},
    {"sap_id": "2986", "zone": "NZ", "zone_code": "2120"},
    {"sap_id": "2203", "zone": "NZ", "zone_code": "2120"},
    {"sap_id": "2522", "zone": "NWZ", "zone_code": "2360"},
    {"sap_id": "2811", "zone": "SCZ", "zone_code": "2620"},
    {"sap_id": "2215", "zone": "NWZ", "zone_code": "2120"},
    {"sap_id": "2543", "zone": "WZ", "zone_code": "2350"},
    {"sap_id": "2692", "zone": "EZ", "zone_code": "2370"},
    {"sap_id": "2434", "zone": "NWZ", "zone_code": "2750"},
    {"sap_id": "2241", "zone": "EZ", "zone_code": "2370"},
    {"sap_id": "2611", "zone": "NWZ", "zone_code": "2120"},
    {"sap_id": "2313", "zone": "WZ", "zone_code": "2360"},
    {"sap_id": "2407", "zone": "EZ", "zone_code": "2600"},
    {"sap_id": "2701", "zone": "EZ", "zone_code": "2120"},
    {"sap_id": "2892", "zone": "SCZ", "zone_code": "2750"},
    {"sap_id": "2503", "zone": "NWZ", "zone_code": "2370"},
    {"sap_id": "2623", "zone": "EZ", "zone_code": "2600"},
    {"sap_id": "2525", "zone": "NWZ", "zone_code": "2350"},
    {"sap_id": "2732", "zone": "SCZ", "zone_code": "2120"},
    {"sap_id": "2779", "zone": "SZ", "zone_code": "2730"},
    {"sap_id": "2539", "zone": "EZ", "zone_code": "2620"},
    {"sap_id": "2741", "zone": "NWZ", "zone_code": "2360"},
    {"sap_id": "2660", "zone": "NCZ", "zone_code": "2600"},
    {"sap_id": "2507", "zone": "EZ", "zone_code": "2370"},
    {"sap_id": "2126", "zone": "NZ", "zone_code": "2120"},
    {"sap_id": "2504", "zone": "NWZ", "zone_code": "2360"},
    {"sap_id": "2540", "zone": "WZ", "zone_code": "2350"},
    {"sap_id": "2347", "zone": "NWZ", "zone_code": "2370"},
    {"sap_id": "2435", "zone": "NWZ", "zone_code": "2120"},
    {"sap_id": "1777", "zone": "SWZ", "zone_code": "11770"},
    {"sap_id": "2244", "zone": "EZ", "zone_code": "2370"},
    {"sap_id": "1871", "zone": "SZ", "zone_code": "11750"},
    {"sap_id": "1554", "zone": "WZ", "zone_code": "1350"},
    {"sap_id": "1584", "zone": "WZ", "zone_code": "11350"},
    {"sap_id": "1882", "zone": "EZ", "zone_code": "11750"},
    {"sap_id": "1979", "zone": "SCZ", "zone_code": "11770"},
    {"sap_id": "1845", "zone": "NWZ", "zone_code": "11770"},
    {"sap_id": "1256", "zone": "NFZ", "zone_code": "11100"},
    {"sap_id": "1953", "zone": "SZ", "zone_code": "11770"},
    {"sap_id": "1847", "zone": "NCZ", "zone_code": "11120"},
    {"sap_id": "1672", "zone": "EZ", "zone_code": "11600"},
    {"sap_id": "1233", "zone": "NWF", "zone_code": "11370"},
    {"sap_id": "1856", "zone": "SZ", "zone_code": "11750"},
    {"sap_id": "1973", "zone": "EZ", "zone_code": "1600"},
    {"sap_id": "1797", "zone": "SWZ", "zone_code": "11770"},
    {"sap_id": "1278", "zone": "NCZ", "zone_code": "11120"},
    {"sap_id": "1775", "zone": "SWZ", "zone_code": "11770"},
    {"sap_id": "1157", "zone": "NCZ", "zone_code": "11120"},
    {"sap_id": "1742", "zone": "ECZ", "zone_code": "11600"},
    {"sap_id": "1898", "zone": "SWZ", "zone_code": "11750"},
    {"sap_id": "1236", "zone": "EZ (EOL)", "zone_code": "11100"},
    {"sap_id": "1723", "zone": "ECZ", "zone_code": "11120"},
    {"sap_id": "1410", "zone": "NCZ", "zone_code": "11370"},
    {"sap_id": "1649", "zone": "EZ", "zone_code": "1600"},
    {"sap_id": "1397", "zone": "NWZ", "zone_code": "11350"},
    {"sap_id": "1879", "zone": "SZ", "zone_code": "11750"},
    {"sap_id": "1940", "zone": "EZ", "zone_code": "11770"},
    {"sap_id": "1630", "zone": "ECZ", "zone_code": "11600"},
    {"sap_id": "1164", "zone": "EZ", "zone_code": "11120"},
    {"sap_id": "1153", "zone": "NZ", "zone_code": "11100"},
    {"sap_id": "1583", "zone": "NWZ", "zone_code": "11370"},
    {"sap_id": "1677", "zone": "NWF", "zone_code": "11600"},
    {"sap_id": "1457", "zone": "CEN", "zone_code": "11350"},
    {"sap_id": "1693", "zone": "EZ", "zone_code": "1600"},
    {"sap_id": "1712", "zone": "ECZ", "zone_code": "11120"},
    {"sap_id": "1992", "zone": "SWZ", "zone_code": "11770"},
    {"sap_id": "1435", "zone": "CEN", "zone_code": "11350"},
    {"sap_id": "1541", "zone": "NWZ", "zone_code": "11370"},
    {"sap_id": "1946", "zone": "EZ", "zone_code": "11770"},
    {"sap_id": "3718", "zone": "SCZ", "zone_code": "11770"},
    {"sap_id": "1254", "zone": "NFZ", "zone_code": "11100"},
    {"sap_id": "1308", "zone": "SZ", "zone_code": "1100"},
    {"sap_id": "1305", "zone": "NCZ", "zone_code": "11120"},
    {"sap_id": "1319", "zone": "NCZ", "zone_code": "11100"},
    {"sap_id": "1180", "zone": "NFZ", "zone_code": "1200"},
    {"sap_id": "1498", "zone": "WZ", "zone_code": "11350"},
    {"sap_id": "1689", "zone": "EZ", "zone_code": "11600"},
    {"sap_id": "1538", "zone": "NZ", "zone_code": "11370"},
    {"sap_id": "1368", "zone": "WZ", "zone_code": "11350"},
    {"sap_id": "1164", "zone": "NFZ", "zone_code": "11750"},
    {"sap_id": "1915", "zone": "SCZ", "zone_code": "11770"},
    {"sap_id": "1999", "zone": "SZ", "zone_code": "11120"},
    {"sap_id": "1385", "zone": "NWZ", "zone_code": "11370"},
    {"sap_id": "1293", "zone": "CEN", "zone_code": "11120"},
    {"sap_id": "1652", "zone": "EZ", "zone_code": "11600"},
    {"sap_id": "1436", "zone": "CEN", "zone_code": "11350"},
    {"sap_id": "1644", "zone": "EZ", "zone_code": "11600"},
    {"sap_id": "1860", "zone": "SZ", "zone_code": "11600"},
    {"sap_id": "1234", "zone": "NCZ", "zone_code": "11120"},
    {"sap_id": "1656", "zone": "EZ", "zone_code": "11600"},
    {"sap_id": "1892", "zone": "WZ", "zone_code": "11600"},
    {"sap_id": "1183", "zone": "NFZ", "zone_code": "11100"},
    {"sap_id": "1187", "zone": "NFZ", "zone_code": "1200"},
    {"sap_id": "1629", "zone": "ECZ", "zone_code": "1670"},
    {"sap_id": "1313", "zone": "NCZ", "zone_code": "11120"},
    {"sap_id": "1831", "zone": "SWZ", "zone_code": "11750"},
    {"sap_id": "1281", "zone": "NWF", "zone_code": "11370"},
    {"sap_id": "1396", "zone": "NWZ", "zone_code": "11350"},
    {"sap_id": "1585", "zone": "WZ", "zone_code": "11350"},
    {"sap_id": "1552", "zone": "WZ", "zone_code": "1350"},
    {"sap_id": "1528", "zone": "CEN", "zone_code": "1450"},
    {"sap_id": "1800", "zone": "SWZ", "zone_code": "11770"},
    {"sap_id": "1895", "zone": "SWZ", "zone_code": "11770"},
    {"sap_id": "1485", "zone": "WZ", "zone_code": "11350"},
    {"sap_id": "1462", "zone": "CEN", "zone_code": "11350"},
    {"sap_id": "1937", "zone": "SZ", "zone_code": "11770"},
    {"sap_id": "1625", "zone": "EZ", "zone_code": "1600"},
    {"sap_id": "1442", "zone": "CEN", "zone_code": "11350"},
    {"sap_id": "1508", "zone": "SWZ", "zone_code": "11370"},
    {"sap_id": "1128", "zone": "NCZ", "zone_code": "11120"},
    {"sap_id": "1588", "zone": "NWZ", "zone_code": "11370"},
    {"sap_id": "1146", "zone": "NCZ", "zone_code": "11120"},
    {"sap_id": "1412", "zone": "EZ (EOL 1044)", "zone_code": "11370"},
    {"sap_id": "1155", "zone": "NZ", "zone_code": "11120"},
    {"sap_id": "1221", "zone": "EZ", "zone_code": "11100"},
    {"sap_id": "1216", "zone": "NZ", "zone_code": "11100"},
    {"sap_id": "1424", "zone": "CEN", "zone_code": "11350"},
    {"sap_id": "1163", "zone": "EZ", "zone_code": "11120"},
    {"sap_id": "1919", "zone": "SCZ", "zone_code": "11770"},
    {"sap_id": "1636", "zone": "SZ", "zone_code": "11120"},
]





def get_zone_code(sap_id: str, zone: str) -> str:
    """
    Get zone code from mapping based on sap_id and zone.
    If exact mapping not found, falls back to zone-only mapping.
    
    Args:
        sap_id: SAP ID to look up
        zone: Zone to match
    
    Returns:
        Zone code string from exact mapping or zone fallback mapping,
        empty string if zone not found in fallback mapping
    """
    # Try exact sap_id + zone mapping first
    for mapping in ZONE_CODE_MAPPING:
        if mapping["sap_id"] == str(sap_id) and mapping["zone"] == zone:
            return mapping["zone_code"]
    
    # Fallback to zone-only mapping
    if zone in ZONE_FALLBACK_MAPPING:
        return ZONE_FALLBACK_MAPPING[zone]
    
    # If no mapping found anywhere, return empty string
    return ""
