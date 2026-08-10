"""
TAS Analytics Query Configurations - WITH unique_id matching
Contains all query templates and interlock definitions for equipment analysis
"""

# ============================================================================
# ESD EQUIPMENT QUERIES AND CONFIGURATIONS
# ============================================================================

ESD_QUERIES = {
    "pushbutton_activated": """
        alert_section = 'TAS'
        AND equipment_name = 'ESD'
        AND bu = 'TAS'
        AND interlock_name = 'ESD Pushbutton Activated'
    """,
    "all_interlocks_template": """
        alert_section = 'TAS'
        AND equipment_name = 'ESD'
        AND bu = 'TAS'
        AND sap_id IN ('{sap_ids}')
        AND interlock_name != 'ESD Pushbutton Activated'
    """
}

ESD_FIELDS = {
    "main_alert": ["unique_id", "location_name", "sap_id", "interlock_name", "created_at"],
    "pushbutton_activated": ["unique_id", "location_name", "sap_id", "created_at", "device_name"],
    "interlocks": ["id", "unique_id", "sap_id", "location_name", "created_at", "interlock_name"]
}

ESD_CATEGORIES = {
    "Barrier Gate opened": r"(?i)Barrier Gate opened",
    "Power ESD Activation": r"(?i)Power ESD Activation",
    "Gantry Permissive Power Off": r"(?i)Gantry Permissive Power Off",
    "All Tanks in Dormant Mode": r"(?i)All Tanks in Dormant Mode",
    "All DBBVs Closed": r"(?i)All DBBVs Closed",
    "TLF Product Pumps Stopped": r"(?i)TLF Product Pumps Stopped",
    "ESD Command To Process PLC": r"(?i)ESD Command To Process PLC",
    "Hooter cum strobe for ESD": r"(?i)Hooter cum strobe for ESD",
    "Siren Activated": r"(?i)Siren Activated",
    "All ROSOVs Closed": r"(?i)All ROSOVs Closed"
}

ESD_DEVICE_ANALYSIS_CONFIG = {
    "time_window_minutes": 3,  # Time window to check alerts after ESD activation
    "enabled": True
}

# ============================================================================
# VFT EQUIPMENT QUERIES AND CONFIGURATIONS
# ============================================================================

VFT_QUERIES = {
    "hhh_alarm": """
        bu = 'TAS'
        AND interlock_name = 'HHH alarm from VFT'
    """,
    "other_interlocks": """
        bu = 'TAS'
        AND interlock_name != 'HHH alarm from VFT'
        AND (interlock_name LIKE '%ROSOV_Close Status%' OR interlock_name LIKE '%MOV_Close Status%')
    """,
    "all_interlocks_template": """
        bu = 'TAS'
        AND sap_id IN ('{sap_ids}')
        AND interlock_name != 'HHH alarm from VFT'
        AND (interlock_name LIKE '%ROSOV_Close Status%' OR interlock_name LIKE '%MOV_Close Status%')
    """
}

VFT_FIELDS = {
    "hhh_alarm": ["unique_id", "location_name", "sap_id", "created_at", "device_name"],
    "other_interlocks": ["id", "unique_id", "location_name", "sap_id", "interlock_name", "created_at"],
    "interlocks": ["id", "unique_id", "sap_id", "location_name", "created_at", "interlock_name"]
}

VFT_CATEGORIES = {
    "ROSOV Close Status": r"(?i)ROSOV_Close Status",
    "MOV Close Status": r"(?i)MOV_Close Status"
}

# ============================================================================
# RADAR EQUIPMENT QUERIES AND CONFIGURATIONS
# ============================================================================

RADAR_QUERIES = {
    "radar_activated": """
        equipment_name = 'RADAR'
        AND bu = 'TAS'
        AND interlock_name = 'HHH alarm from Secondary Radar guage'
    """,
    "other_interlocks": """
        bu = 'TAS'
        AND interlock_name != 'HHH alarm from Secondary Radar guage'
        AND (interlock_name LIKE '%ROSOV_Close Status%' OR interlock_name LIKE '%MOV_Close Status%')
    """,
    "all_interlocks_template": """
        bu = 'TAS'
        AND sap_id IN ('{sap_ids}')
        AND interlock_name != 'HHH alarm from Secondary Radar guage'
        AND (interlock_name LIKE '%ROSOV_Close Status%' OR interlock_name LIKE '%MOV_Close Status%')
    """
}

RADAR_FIELDS = {
    "radar_activated": ["unique_id", "location_name", "sap_id", "created_at", "device_name"],
    "other_interlocks": ["id", "unique_id", "location_name", "sap_id", "interlock_name", "created_at"],
    "interlocks": ["id", "unique_id", "sap_id", "location_name", "created_at", "interlock_name"]
}

RADAR_CATEGORIES = {
    "ROSOV Close Status": r"(?i)ROSOV_Close Status",
    "MOV Close Status": r"(?i)MOV_Close Status"
}

# ============================================================================
# BCU EQUIPMENT QUERIES AND CONFIGURATIONS
# ============================================================================

BCU_QUERIES = {
    "bcu_alarm": """
        bu = 'TAS'
        AND alert_category = 'Gantry'
        AND interlock_name NOT LIKE '%BCU Permissive Off%'
    """,
    "all_interlocks_template": """
        bu = 'TAS'
        AND sap_id IN ('{sap_ids}')
        AND interlock_name IN ('{interlocks}')
    """,
    "permissive_off_template": """
        bu = 'TAS'
        AND sap_id IN ('{sap_ids}')
        AND interlock_name LIKE '%BCU Permissive Off%'
    """
}

BCU_FIELDS = {
    "bcu_alarm": ["unique_id", "location_name", "sap_id", "created_at", "device_name"],
    "interlocks": ["id", "unique_id", "sap_id", "created_at", "interlock_name"],
    "permissive_off": ["id", "unique_id", "sap_id", "created_at", "interlock_name"]
}

BCU_INTERLOCKS = [
    "Earthing Failure Alarm",
    "Blend Underdose Alarm_BCU",
    "No Flow alarm_BCU",
    "Additive Overdose Alarm_BCU",
    "Meter overrun Alarm_BCU",
    "Additive Underdose Alarm_BCU",
    "Unauthorized Flow Alarm_BCU",
    "High Flow Alarm_BCU",
    "Blend overdose Alarm_BCU",
    "Low Flow alarm_BCU",
    "No Flow alarm Blend_BCU",
    "Unauthorized Flow Alarm Blend_BCU",
    "High Flow Alarm Blend_BCU",
    "Low Flow alarm Blend_BCU",
    "Meter overrun Alarm Blend_BCU",
    "K Factor Change_BCU",
    "Day End totaliser Mismatch",
    "Day End totaliser Mismatch Blend"
]

BCU_ALARM_DETAILS_LIMIT = 100

# ============================================================================
# FIRE EFFECT EQUIPMENT QUERIES AND CONFIGURATIONS
# ============================================================================

FIRE_EFFECT_QUERIES = {
    "fire_effect_alarm": """
        bu = 'TAS'
        AND device_type = 'Fire Effect'
    """,
    "all_interlocks_template": """
        bu = 'TAS'
        AND device_type = 'Fire Effect'
        AND sap_id IN ('{sap_ids}')
        AND (
            interlock_name LIKE '%Hooter Activated at control room%'
            OR interlock_name LIKE '%All TLF Product Pumps Stopped%'
            OR interlock_name LIKE '%Gantry Permissive Off%'
        )
    """
}

FIRE_EFFECT_FIELDS = {
    "fire_effect_alarm": ["unique_id", "location_name", "sap_id", "created_at", "device_name"],
    "interlocks": ["id", "unique_id", "sap_id", "location_name", "created_at", "interlock_name"]
}

FIRE_EFFECT_INTERLOCKS = [
    "Hooter Activated at control room",
    "All TLF Product Pumps Stopped",
    "Gantry Permissive Off"
]

# ============================================================================
# EQUIPMENT TYPE MAPPING
# ============================================================================

EQUIPMENT_TYPE_MAPPING = {
    'ESD': 'ESD',   
    'VFT': 'VFT',
    'RADAR': 'RADAR',
    'BCU': 'BCU',
    'FIRE EFFECT': 'Fire Effect'
}

DEFAULT_EQUIPMENT_TYPES = ['ESD', 'VFT', 'RADAR', 'BCU', 'FIRE EFFECT']

# ============================================================================
# COMMON PATTERNS
# ============================================================================

FAIL_PATTERNS = ['Fail', '_Fail', 'fail']

# ============================================================================
# HOST LOCAL LOADED TTS QUERIES AND CONFIGURATIONS
# ============================================================================

HOST_LOCAL_LOADED_TTS_QUERIES = {
    "location_wise_total": """
        sap_id IS NOT NULL 
        AND sap_id != ''
        AND location_name IS NOT NULL 
        AND location_name != ''
    """
}

HOST_LOCAL_LOADED_TTS_FIELDS = [
    "id",
    "loaded_qty",
    "sap_id",
    "location_name",
    "truck_number",
    "recipe_name",
    "created_at",
    "bay_number",     
    "bcu_number"   
]

# Truck type categorization patterns
TRUCK_TYPE_PATTERNS = {
    "prover": {
        "starts_with": "P",
        "contains_digit": False,
        "description": "Starts with 'P' and contains only letters (e.g., PROVER, PROVERUGTA, PT, P)"
    },
    "dg": {
        "contains": "DG",
        "description": "Contains 'DG' anywhere in truck number"
    },
    "tank_truck": {
        "pattern": r"[A-Z]+\d+[A-Z]*\d*",
        "description": "Mix of letters and numbers - vehicle registration format (e.g., AP26BH4005, RJ32GE0644, HR61D3331)"
    }
}

# Pattern analysis thresholds
PATTERN_ANALYSIS_CONFIG = {
    "local_loading_repeated": {
        "min_trucks_per_hour": 2,
        "description": "2+ trucks within one hour window"
    },
    "particular_time_of_day": {
        "min_days_for_pattern": 2,
        "min_occurrence_ratio": 0.5,
        "description": "Same hour across multiple days (at least 50% of days or 2+ times)"
    },
    "particular_product": {
        "unique_count": 1,
        "description": "Only one unique product type loaded"
    }
}

# Bay re-assignment configuration
BAY_REASSIGNMENT_CONFIG = {
    "fields": ["truck_number", "assigned_bay", "reassigned_bay", "reassign_loaded_qty", "created_at"],
    "match_on": ["truck_number", "created_at"],  # Both must match
    "description": "Match truck_number AND created_at (date) between host_local_loaded_tts and host_bay_re_assignment"
}


equipment_mapping_helpdesk = {
  "BCU": {"internal_type": ["Loading Point"], "search_level": "device"},
  "MFM": {"internal_type": ["Loading Point"], "search_level": "device"},
  "Header PT": {"internal_type":["Fire Effect","Fire Pump"], "search_level": "device"},
  "Barrier Gate": {"internal_type": ["Barrier Gate"], "search_level": "device"},
  "PT": {"internal_type": ["Fire Effect", "Fire Pump"], "search_level": "device"},
  "HCD communication": {"internal_type": ["HCD"], "search_level":"device"},
  "Field Hooters": {"internal_type": ["Hooter"], "search_level":"device"},
  "Hooters": {"internal_type": ["Hooter"], "search_level":"device"},
  "ESDs": {"internal_type": ["ESD"], "search_level":"device"},
  "Safety PLC": {"internal_type": ["PLC"], "search_level":"device", "name_filter": "Safety PLC"},
  "Process PLC": {"internal_type": ["PLC"], "search_level":"device", "name_filter": "Process PLC"},
  "Header MOVs": {"internal_type": ["Tank"],"search_level": "sensor", "filter_keywords": ["MOV"]},
  "Primary Radar": {"internal_type": ["Tank"],"search_level": "sensor","filter_keywords": ["Primary Radar"]},
  "Secondary Radars": {"internal_type": ["Tank"], "search_level": "sensor", "filter_keywords": ["RADAR"]},
  "VFTs": {"internal_type": ["Tank"], "search_level": "sensor", "filter_keywords": ["VFT"]},
  "ROSOV/MOV Communication": {"internal_type": ["Tank"], "search_level": "sensor", "filter_keywords": ["ROSOV", "MOV"]}
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def build_date_filter(start_date, end_date):
    """Build date filter for queries"""
    if (start_date and end_date and 
        start_date.strip() and end_date.strip() and
        start_date.lower() != "string" and end_date.lower() != "string"):
        return f" AND created_at::date BETWEEN '{start_date}' AND '{end_date}'"
    return ""

def build_location_filter(location_name):
    """Build location filter for queries"""
    if location_name and location_name.strip():
        return f" AND location_name = '{location_name}'"
    return ""

def build_complete_query(base_query, start_date=None, end_date=None, location_name=None):
    """Build complete query with filters"""
    query = base_query
    
    if location_name:
        query += build_location_filter(location_name)
    
    if start_date and end_date:
        query += build_date_filter(start_date, end_date)
    
    return query

def format_sap_ids_for_query(sap_ids):
    """Format SAP IDs for IN clause"""
    return "','".join(sap_ids)

def format_interlocks_for_query(interlocks):
    """Format interlocks for IN clause"""
    return "','".join(interlocks)



SEVERITY_WEIGHTS = {

    "Plant ESD activated": {"severity": 1, "operation_load": 0.6},
    "SafetyPLC_Communication fail": {"severity": 1, "operation_load": 0.6},
    "ESD Command To Process PLC": {"severity": 1, "operation_load": 0.6},
    "Tank level change during dormant mode": {"severity": 1, "operation_load": 0.1},
    "HCD_20% LEL activated": {"severity": 1, "operation_load": 0.1},
    "HCD_40% LEL activated": {"severity": 1, "operation_load": 0.1},
    "Rim Seal system_Fault activated": {"severity": 1, "operation_load": 0.6},
    "Two Fire Engine Running status": {"severity": 0.9, "operation_load": 0.6},
    "Main Fire Engines not in REMOTE": {"severity": 0.8, "operation_load": 0.6},
    "ROSOV_FailtoClose": {"severity": 0.7, "operation_load": 0.9},
    "MOV_Close Status_Fail": {"severity": 0.7, "operation_load": 0.9},
    "HCD_Fault activated": {"severity": 0.6, "operation_load": 0.1},
    "Rim Seal system_Fault activated": {"severity": 0.6, "operation_load": 0.6},       
    "HHH alarm from VFT": {"severity": 0.6, "operation_load": 0.3},       
    "HHH alarm from Secondary Radar guage": {"severity": 0.5, "operation_load": 0.3},
    "Dykevalve_Activated Hooter_Fail": {"severity": 0.5, "operation_load": 0.1},
    "Gantry Permissive_Override": {"severity": 0.5, "operation_load": 1},
    "BCU Permissive Off": {"severity": 0.4, "operation_load": 0.1},   
    "Unauthorized Flow Alarm_BCU": {"severity": 0.4, "operation_load": 0.1},
    "Unauthorized Flow Alarm Blend_BCU": {"severity": 0.4, "operation_load": 0.1},   
    "TT Overloaded": {"severity": 0.4, "operation_load": 0.1},
    "Secondary Radar_Under Maintenance": {"severity": 0.4, "operation_load": 0.1},
    "HydrantPT_Under Maintenance": {"severity": 0.4, "operation_load": 0.1},
    "JockeyPump_Under Maintenance": {"severity": 0.4, "operation_load": 0.1},
    "Tank_Under Maintenance": {"severity": 0.4, "operation_load": 0.1},
    "VFT_Under Maintenance": {"severity": 0.4, "operation_load": 0.1},
    "High Flow Alarm Blend_BCU": {"severity": 0.2, "operation_load": 0.1},
    "High Flow Alarm_BCU": {"severity": 0.2, "operation_load": 0.1},
    "Low Flow alarm Blend_BCU": {"severity": 0.2, "operation_load": 0.1},
    "Low Flow alarm_BCU": {"severity": 0.2, "operation_load": 0.1}
}
