import urdhva_base
import numpy as np
import pandas as pd
import pyodbc
import h3.api.basic_str as h3
from datetime import datetime, timedelta
from shapely.geometry import Point, Polygon
from shapely.vectorized import contains
from sqlalchemy import create_engine, text, Integer, Double, Boolean, DateTime, VARCHAR, Float
import orchestrator.dbconnector.credential_loader as credential_loader
from sklearn.neighbors import BallTree
import json


import warnings
warnings.filterwarnings('ignore')
# NORMALIZATION HELPER

def normalization_min_max(series):
    max_v = series.max()
    # avoid division by zero
    if max_v == 0:
        return series * 0  # all zeros remain zeros
    return (series / max_v)*100

def normalize_code(code):

    """Normalize transporter code by stripping leading zeros to match master data format."""

    if pd.isna(code):

        return code
    return str(code).lstrip('0') or '0'

# Load credentials from an external source
def get_db_connection():
    """
    Establish a database connection
    Args:
        connection_string (str): Database connection string
    Returns:
        pyodbc connection
    """
    creds = credential_loader.get_credentials('VTS_TRACK_DB')
    connection = pyodbc.connect(
            'DRIVER={ODBC Driver 18 for SQL Server};'
            f'Server={creds['host']},{creds['port']};'
            f'Database={creds['database']};'
            f'UID={creds['user']};'
            f'PWD={creds['password']};'
            'TrustServerCertificate=yes;MARS_Connection=yes;',
        )
    return connection

vts_engine = get_db_connection()
print("VTS_TRACK database connection for reading established successfully!")


# Engine for writing data to APP_DB database
creds_app = credential_loader.get_credentials('APP_DB')
app_db_engine = create_engine(
    f"postgresql://{creds_app['user']}:{creds_app['password']}@"
    f"{creds_app['host']}:{creds_app['port']}/{creds_app['database']}"
)

print("APP_DB database connection for writing established successfully!")


# ===============================
# LOAD EVENTS DATA
# ===============================


RENAMES_alerts = {
    
    "EVENT_DATE": "EVENT_DATETIME",
    "START_LATITUDE": "LAT",
    "START_LONGITUDE": "LON",
    "STOPPAGE_LATITUDE":"LAT",
    "STOPPAGE_LONGITUDE": "LON"
}


def load_alerts_data():
    """Load alert data from PostgreSQL database tables"""
    
    # Load Route Deviation
    rd = pd.read_sql_query("SELECT * FROM route_deviation where LOCATION_TYPE = 'TAS' ", vts_engine)
    print(f"Loaded {len(rd)} route_deviation records")
   # print(rd.columns)
    
    # Load Stoppage Violation
    stp = pd.read_sql_query("SELECT * FROM stoppage_violation where LOCATION_TYPE = 'TAS' ", vts_engine)
    print(f"Loaded {len(stp)} stoppage_violation records")
   # print(stp.columns)

    # Load Device Removed
    dr = pd.read_sql_query("SELECT * FROM device_removed where LOCATION_TYPE = 'TAS' ", vts_engine)
    print(f"Loaded {len(dr)} device_removed records")
    #print(dr.columns)

    # Load Power Disconnect
    pdw = pd.read_sql_query("SELECT * FROM power_disconnect where LOCATION_TYPE = 'TAS' ", vts_engine)
    print(f"Loaded {len(pdw)} power_disconnect records")
    #print(pdw.columns)
    

    # Apply renames + timestamp conversion
    for df in [rd, stp, dr, pdw]:
        df.rename(columns=RENAMES_alerts, inplace=True)
        if "EVENT_DATETIME" in df.columns:
            df["EVENT_DATETIME"] = pd.to_datetime(df["EVENT_DATETIME"])

    # Add alert types
    rd["ALERT_TYPE"] = "ROUTE_DEVIATION"
    stp["ALERT_TYPE"] = "STOPPAGE_VIOLATION"
    dr["ALERT_TYPE"] = "DEVICE_REMOVED"
    pdw["ALERT_TYPE"] = "POWER_DISCONNECT"

    

    # Combine
    alerts = pd.concat([rd, stp, dr, pdw], ignore_index=True)
    alerts.sort_values("EVENT_DATETIME", inplace=True)


    if "LOCATION_TYPE" in alerts.columns and "TRIP_STATUS" in alerts.columns:
        alerts = alerts[(alerts["LOCATION_TYPE"] == "TAS") & (alerts["TRIP_STATUS"].isin(["LOADED", "UN LOADED"]))]

    return alerts


alerts = load_alerts_data()
print(f"Total loaded alerts: {len(alerts)}")
print(alerts.columns)


# ============================
# LOAD Completed_Trips File
# ============================


trip_data = pd.read_sql_query('SELECT * FROM completed_trip', vts_engine)
print(f"Loaded {len(trip_data)} completed trip records")



trip_data["SCHEDULED_TRIP_END_DATETIME"] = pd.to_datetime(trip_data["SCHEDULED_TRIP_END_DATETIME"], errors="coerce")
trip_data["SCHEDULED_TRIP_START_DATETIME"] = pd.to_datetime(trip_data["SCHEDULED_TRIP_START_DATETIME"], errors="coerce")

trip_df = trip_data.drop_duplicates(subset=['CHALLAN_NO'], keep='first')# Remove duplicates based on specific column(s)

completed_Trips_df=trip_df[['ROW_NUMB', 'TOTALCOUNT', 'VEHICLE_RTO_NO', 'CHALLAN_NO', 'TRIP_NAME', 'DRIVER_NAME', 'DEPOT_NAME', 'CONSUMER_ERP_NAME', 'VENDOR_NAME', 'ROUTE_ID', 'SEC_ROUTE_ID',
       'SCHEDULED_TRIP_START_DATETIME', 'SCHEDULED_TRIP_END_DATETIME', 'SCHEDULE_RTT', 'SCHEDULE_RTTD', 'TRIP_ID', 'DEPOT_OUT_TIME', 'CONSUMER_IN', 'LOADED_DURATION', 'LOADED_DISTANCE',
       'CONSUMER_OUT', 'UNLOADING_DURATION', 'RET_DEPOT_IN', 'RET_DEPOT_ODO', 'UN_LOADED_DURATION', 'TOTAL_DISTANCE', 'TOTAL_DURATION', 'TRIP_STATUS', 'TRIP_CLOSED_BY_CLIENT_ID',
       'TRIP_PERFORMANCE_STATUS', "DEPOT_ERP_CODE", 'CONSUMER_ERP_CODE', 'ERP_TRANSPORTER_CODE', 'VEHICLE_ID', 'TRIP_STATUS_RIL', 'VEHICLE_LATITUDE', 'VEHICLE_LONGITUDE', 'TRIP_DISTANCE',
       'VEHICLE_LOCATION', 'VEHICLE_SPEED', 'VEHICLE_GPS_DATETIME', 'TP_STATUS', 'TRIP_PERFORMANCE_MINUTES', 'LOADNO', 'ROUTE_NO', 'ZONE_NAME', 'AREA_NAME', 'TERITORY_NAME']]

completed_Trips_df.rename(columns={'CHALLAN_NO': 'INVOICE_NO', "ERP_TRANSPORTER_CODE":"TRANSPORTER_CODE","VEHICLE_RTO_NO":"TT_NUMBER", "ZONE_NAME":"ZONE", "DEPOT_ERP_CODE":"LOCATION"}, inplace=True)


completed_Trips_df['TRANSPORTER_CODE'] = completed_Trips_df['TRANSPORTER_CODE'].apply(normalize_code)

# ===============================
# LOAD MASTER MAPPING
# ===============================

VEHICLE_MASTER_RENAME_MAP = {
    "truck_no": "TT No",
    "no_of_compartments": "Tank Compartment",
    "capacity_of_the_truck": "VOL Capacity",
    "transporter_name": "Transporter Name",
    "transporter_code": "Transporter Code",
    "location_name": "Location Name",
    "sap_id": "Location Code",   # extra in DB → kept as uppercase
    
}

master_df = pd.read_sql_query("SELECT * FROM public.truck_m", app_db_engine)
print(f"Loaded {len(master_df)} vehicle master records")
master_df.rename(columns=VEHICLE_MASTER_RENAME_MAP, inplace=True)
master_df.rename(columns={"Transporter Code":"TRANSPORTER_CODE","Transporter Name":"TRANSPORTER_NAME", 
                          "TT No":"TT_NUMBER", "Location Code":"LOCATION_CODE", "Location Name":"LOCATION_NAME"}, inplace=True)

master_df['TRANSPORTER_CODE'] = master_df['TRANSPORTER_CODE'].apply(normalize_code)

# Keep only the columns we need for mapping
required_cols = ["TT_NUMBER", "TRANSPORTER_CODE", "TRANSPORTER_NAME", "LOCATION_NAME", "LOCATION_CODE"]
available_cols = [col for col in required_cols if col in master_df.columns]
master_df = master_df[available_cols].copy()


# ===============================
# LOAD GEOFENCE DATA
# ===============================
GEOFENCE_RENAME_MAP = {
    "geofence_name": "GEOFENCE_NAME",
    "latitude": "LATITUDE",
    "longitude": "LONGITUDE",
    "radius": "RADIUS",
    "latlon": "latlon",              # already same in both
    "geofence_type": "GEOFENCE_TYPE",
}

geofence_data = pd.read_sql_query('SELECT * FROM geofence_master', app_db_engine)
geofence_data.rename(columns=GEOFENCE_RENAME_MAP, inplace=True)
print(f"Loaded {len(geofence_data)} geofence records")
geofence_data.rename(columns={c: c.lower() for c in geofence_data.columns}, inplace=True)
geofence_data.rename(columns={'geofence_type': 'GEOFENCE_TYPE', 'latitude': 'LATITUDE', 
                               'longitude': 'LONGITUDE', 'radius': 'RADIUS'}, inplace=True)


# =====================================================
# DATE RANGE Checking
# =====================================================

min_dt_alerts = alerts["EVENT_DATETIME"].min()
max_dt_alerts = alerts["EVENT_DATETIME"].max()


min_dt_ct = completed_Trips_df["SCHEDULED_TRIP_START_DATETIME"].min()
max_dt_ct = completed_Trips_df["SCHEDULED_TRIP_END_DATETIME"].max()


print(f"alerts date range:{min_dt_alerts} to {max_dt_alerts}")
print(f"completed trips date range: {min_dt_ct} to {max_dt_ct}")

# Split alerts data
realtime_data = alerts
realtime_data.rename(columns={'TRANSPORTER_ID': 'TRANSPORTER_CODE'}, inplace=True)

realtime_data['TRANSPORTER_CODE'] = realtime_data['TRANSPORTER_CODE'].apply(normalize_code)

train_data = alerts
train_data.rename(columns={'TRANSPORTER_ID': 'TRANSPORTER_CODE'}, inplace=True)

train_data['TRANSPORTER_CODE'] = train_data['TRANSPORTER_CODE'].apply(normalize_code)

# Split trip data
trip_train_df = completed_Trips_df
trip_Realtime_df = completed_Trips_df




# ======================================
# COMBO DETECTION & COMBO RISK MAPPING
# ======================================

COMBO_RULES = {
    "route_deviation_then_device_removed_then_power_disconnect": {
        "sequence": ("ROUTE_DEVIATION", "DEVICE_REMOVED", "POWER_DISCONNECT"),
        "within_minutes": 30,
        "combo_delta": 50,
    },
    "route_dev_plus_stoppage": {
        "sequence": ("ROUTE_DEVIATION", "STOPPAGE_VIOLATION"),
        "within_minutes": 30,
        "combo_delta": 40,
    },
    "multiple_route_devs": {
        "sequence": ("ROUTE_DEVIATION",),
        "count_required": 3,
        "within_minutes": 30,
        "combo_delta": 25,
    },
}

# ===============================
# COMBO DETECTION
# ===============================
def detect_combo_rules(df):
    combos = []
    df_sorted = df.sort_values("EVENT_DATETIME")
    for inv, group in df_sorted.groupby("INVOICE_NO"):
        group = group.sort_values("EVENT_DATETIME").to_dict("records")
        triggered = None
        for i, current in enumerate(group):
            for rule_name, rule in COMBO_RULES.items():
                seq = rule["sequence"]
                within = rule["within_minutes"]
                if len(seq) > 1:
                    for past in group[:i]:
                        if (
                            past["ALERT_TYPE"] == seq[0]
                            and current["ALERT_TYPE"] == seq[1]
                            and abs((current["EVENT_DATETIME"] - past["EVENT_DATETIME"]).total_seconds() / 60)
                            <= within
                        ):
                            triggered = rule_name
                else:
                    if current["ALERT_TYPE"] == seq[0]:
                        past_events = [
                            p for p in group[:i]
                            if (current["EVENT_DATETIME"] - p["EVENT_DATETIME"]).total_seconds() / 60 <= within
                            and p["ALERT_TYPE"] == seq[0]
                        ]
                        if len(past_events) >= rule.get("count_required", 2):
                            triggered = rule_name
            if triggered:
                combos.append({
                    "INVOICE_NO": inv,
                    "Last_Combo_Rule": triggered,
                    "Triggered_At": current["EVENT_DATETIME"],
                })
    return pd.DataFrame(combos)

combo_df = detect_combo_rules(realtime_data)
print(f"Detected {len(combo_df)} combo triggers")

# ==================================================
# Normalization (soft_robust_normalize)
# ==================================================
def soft_robust_normalize(series, eps=5, clip_range=(-3, 3)):
    """
    Soft Robust Normalization for a pandas Series.
    - Uses Median & IQR
    - Adds epsilon to avoid exploding values
    - Applies smooth clipping
    """
    median = series.median()
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1

    # Soft robust scaling
    normalized = (series - median) / (iqr + eps)

    # Optional clipping to avoid extreme values
    if clip_range:
        normalized = normalized.clip(clip_range[0], clip_range[1])

    return normalized



# ==================================================
# TRANSPORTER RISK CALCULATION
# ==================================================

# STEP 1: TRIP COUNTS PER TRANSPORTER
trip_counts = (
    trip_train_df.groupby("TRANSPORTER_CODE", as_index=False)
    .agg(total_trips=("INVOICE_NO", "count"))
)

trip_counts['TRANSPORTER_CODE'] = trip_counts['TRANSPORTER_CODE'].apply(normalize_code)

# STEP 2: ALERT COUNTS PER TRANSPORTER
alert_summary = (
    train_data.groupby(["TRANSPORTER_CODE", "ALERT_TYPE"])
    .agg(total_alerts=("ALERT_TYPE", "count"))
    .reset_index()
)

# Pivot ALERT_TYPE horizontally
alert_summary_pivot = (
    alert_summary.pivot_table(
        index="TRANSPORTER_CODE",
        columns="ALERT_TYPE",
        values="total_alerts",
        fill_value=0
    )
    .reset_index()
)
alert_summary_pivot.columns.name = None

# STEP 3: MERGE TRIP & ALERT DATA
final_alert_summary = trip_counts.merge(alert_summary_pivot, on="TRANSPORTER_CODE", how="right")
final_alert_summary.fillna(0, inplace=True)

# STEP 4: CONFIGURATION
ALERT_WEIGHTS = {
    "DEVICE_REMOVED": 0.4,
    "POWER_DISCONNECT": 0.3,
    "ROUTE_DEVIATION": 0.2,
    "STOPPAGE_VIOLATION": 0.1,
}

# STEP 5: ENTITY RISK CALCULATION
final_alert_summary["entity_risk"] = 0.0

for alert_type, weight in ALERT_WEIGHTS.items():
    if alert_type in final_alert_summary.columns:
        final_alert_summary[f"{alert_type}_per_trip"] = np.where(
            final_alert_summary["total_trips"] > 0,
            (final_alert_summary[alert_type] / final_alert_summary["total_trips"]).round(3),
            0
        )
        final_alert_summary["entity_risk"] += (
            final_alert_summary[f"{alert_type}_per_trip"] * weight
        )

final_alert_summary["entity_risk"] = final_alert_summary["entity_risk"].round(3)


# STEP 6: FINAL OUTPUT
entity_risk_summary = final_alert_summary[["TRANSPORTER_CODE", "total_trips", 'DEVICE_REMOVED', 'POWER_DISCONNECT', 
                                           'ROUTE_DEVIATION', 'STOPPAGE_VIOLATION', "entity_risk"]].copy()

# Create transporter name mapping
transporter_name_map = (
    master_df.drop_duplicates(subset=["TRANSPORTER_CODE"])
    .set_index("TRANSPORTER_CODE")["TRANSPORTER_NAME"]
    .to_dict()
)

# Soft Robust Normalize
entity_risk_summary["soft_norm"] = soft_robust_normalize(entity_risk_summary["entity_risk"])
entity_risk_summary['TRANSPORTER_CODE'] = entity_risk_summary['TRANSPORTER_CODE'].apply(normalize_code)

# Convert soft robust range (-3 to 3) → to 0–100
entity_risk_summary["RISK_SCORE"] = (
    (entity_risk_summary["soft_norm"] + 3) / 6   # bring to 0–1
) * 100

entity_risk_summary["TRANSPORTER_NAME"] = entity_risk_summary["TRANSPORTER_CODE"].map(transporter_name_map)
Transporter_risk_summary = entity_risk_summary[['TRANSPORTER_CODE', 'TRANSPORTER_NAME', "total_trips", 'DEVICE_REMOVED', 'POWER_DISCONNECT', 'ROUTE_DEVIATION', 'STOPPAGE_VIOLATION', 'RISK_SCORE']].copy()


# ===============================
# TT RISK CALCULATION
# ===============================

# STEP 1: CALCULATE TOTAL TRIPS PER TT_NUMBER
trip_counts_tt = (
    trip_train_df.groupby("TT_NUMBER")["INVOICE_NO"]
    .nunique()
    .reset_index()
    .rename(columns={"INVOICE_NO": "total_trips"})
)

# STEP 2: CALCULATE ALERTS PER TT_NUMBER AND ALERT_TYPE
alert_summary_tt = (
    train_data.groupby(["TT_NUMBER", "ALERT_TYPE"])
    .agg(total_alerts=("ALERT_TYPE", "count"))
    .reset_index()
)

# STEP 3: PIVOT ALERT_TYPE HORIZONTALLY (one column per alert type)
alert_summary_pivot_tt = (
    alert_summary_tt.pivot_table(
        index="TT_NUMBER",
        columns="ALERT_TYPE",
        values="total_alerts",
        fill_value=0
    )
    .reset_index()
)
alert_summary_pivot_tt.columns.name = None

# STEP 4: MERGE TRIP COUNTS WITH ALERTS
final_alert_summary_tt = trip_counts_tt.merge(
    alert_summary_pivot_tt, 
    on="TT_NUMBER", 
    how="inner"  # Use outer join to keep TTs with only trips OR only alerts
)

# Fill NaN values
final_alert_summary_tt["total_trips"] = final_alert_summary_tt["total_trips"].fillna(0)
for alert_type in ALERT_WEIGHTS.keys():
    if alert_type in final_alert_summary_tt.columns:
        final_alert_summary_tt[alert_type] = final_alert_summary_tt[alert_type].fillna(0)

# STEP 5: CALCULATE ALERTS PER TRIP FOR EACH ALERT TYPE
for alert_type in ALERT_WEIGHTS.keys():
    if alert_type in final_alert_summary_tt.columns:
        final_alert_summary_tt[f"{alert_type}_per_trip"] = np.where(
            final_alert_summary_tt["total_trips"] > 0,
            (final_alert_summary_tt[alert_type] / final_alert_summary_tt["total_trips"]).round(3),
            0
        )
    else:
        final_alert_summary_tt[f"{alert_type}_per_trip"] = 0

# STEP 6: CALCULATE WEIGHTED ENTITY RISK
final_alert_summary_tt["entity_risk"] = 0.0

for alert_type, weight in ALERT_WEIGHTS.items():
    if f"{alert_type}_per_trip" in final_alert_summary_tt.columns:
        final_alert_summary_tt["entity_risk"] += (
            final_alert_summary_tt[f"{alert_type}_per_trip"] * weight
        )

final_alert_summary_tt["entity_risk"] = final_alert_summary_tt["entity_risk"].round(3)


# STEP 7: NORMALIZE TO 0-100 RISK SCORE (PERCENTILE-BASED)

# Soft Robust Normalize
final_alert_summary_tt["soft_norm"] = soft_robust_normalize(final_alert_summary_tt["entity_risk"])

# Convert soft robust range (-3 to 3) → to 0–100
final_alert_summary_tt["RISK_SCORE"] = (
    (final_alert_summary_tt["soft_norm"] + 3) / 6   # bring to 0–1
) * 100

# STEP 8: ADD TRANSPORTER INFORMATION
transporter_code_map = (
    master_df.drop_duplicates(subset=["TT_NUMBER"])
    .set_index("TT_NUMBER")["TRANSPORTER_CODE"]
    .to_dict()
)

transporter_name_map = (
    master_df.drop_duplicates(subset=["TT_NUMBER"])
    .set_index("TT_NUMBER")["TRANSPORTER_NAME"]
    .to_dict()
)

final_alert_summary_tt["TRANSPORTER_CODE"] = final_alert_summary_tt["TT_NUMBER"].map(transporter_code_map)
final_alert_summary_tt["TRANSPORTER_NAME"] = final_alert_summary_tt["TT_NUMBER"].map(transporter_name_map)
print(final_alert_summary_tt.columns)
# STEP 9: CREATE FINAL OUTPUT DATAFRAMES
print(final_alert_summary_tt.columns)


final_alert_summary_tt['TRANSPORTER_CODE'] = final_alert_summary_tt['TRANSPORTER_CODE'].apply(normalize_code)


# Summary output (for display and API)
TT_risk_summary = final_alert_summary_tt[[
    "TT_NUMBER", 
    "TRANSPORTER_CODE", 
    "TRANSPORTER_NAME", 
    "total_trips",
    "RISK_SCORE",
    'DEVICE_REMOVED',
    'POWER_DISCONNECT',
    'ROUTE_DEVIATION',
    'STOPPAGE_VIOLATION'
]].copy()

print("TT_risk_summary columns1:", TT_risk_summary.columns)

# Detailed output (for analysis - includes raw entity_risk)
TT_entity_risk_summary = final_alert_summary_tt[[
    "TT_NUMBER", 
    "TRANSPORTER_CODE", 
    "TRANSPORTER_NAME",
    "total_trips",
    "entity_risk",
    "RISK_SCORE"
]].copy()

#TT_risk_summary = TT_entity_risk_summary[["TT_NUMBER",'TRANSPORTER_CODE', 'TRANSPORTER_NAME', "total_trips", 'RISK_SCORE', 'DEVICE_REMOVED', 'POWER_DISCONNECT', 'ROUTE_DEVIATION', 'STOPPAGE_VIOLATION']].copy()

# Sort by risk score (highest risk first)
TT_risk_summary = TT_risk_summary.sort_values("RISK_SCORE", ascending=False).reset_index(drop=True)
TT_entity_risk_summary = TT_entity_risk_summary.sort_values("RISK_SCORE", ascending=False).reset_index(drop=True)

# STEP 10: PRINT SUMMARY STATISTICS
print(f"Total TTs analyzed: {len(TT_risk_summary)}")
print("TT_risk_summary columns2:", TT_risk_summary.columns)
#==================================
# Location Risk Score
#==================================

# ===========================
# STEP 3: CALCULATE TRIP COUNTS
# ===========================
trip_date_df=trip_train_df["SCHEDULED_TRIP_START_DATETIME"].dt.date

trip_counts = (
    trip_train_df.groupby(["SCHEDULED_TRIP_START_DATETIME", "LOCATION"])["INVOICE_NO"]
    .nunique()
    .reset_index()
    .rename(columns={"INVOICE_NO": "total_trips"})
)

# Merge trip counts back
merged = pd.merge(trip_train_df, trip_counts, on=["SCHEDULED_TRIP_START_DATETIME", "LOCATION"], how="left")
merged = merged.sort_values(["SCHEDULED_TRIP_START_DATETIME", "LOCATION"]).reset_index(drop=True)

# ===========================
# STEP 4: ALERT SUMMARY PER INVOICE
# ===========================
alert_summary_tt = (
    train_data.groupby(["INVOICE_NO", "ALERT_TYPE"])
    .agg(total_alerts=("ALERT_TYPE", "count"))
    .reset_index()
)

# Pivot ALERT_TYPE as columns
alert_pivot = alert_summary_tt.pivot_table(
    index="INVOICE_NO",
    columns="ALERT_TYPE",
    values="total_alerts",
    fill_value=0
).reset_index()

# Merge alerts into trip summary
final_merged = pd.merge(merged, alert_pivot, on="INVOICE_NO", how="left")

# Separate numeric columns and fill them with 0, leaving datetime columns untouched
numeric_cols_to_fill = final_merged.select_dtypes(include=np.number).columns
final_merged[numeric_cols_to_fill] = final_merged[numeric_cols_to_fill].fillna(0)
# ===========================
# STEP 5: AGGREGATE BY INVOICE_DATE + LOCATION
# ===========================
numeric_cols = final_merged.select_dtypes(include=np.number).columns.tolist()


final_alert_summary_loc = (
    final_merged[numeric_cols + ["SCHEDULED_TRIP_START_DATETIME", "LOCATION"]]
    .groupby(["SCHEDULED_TRIP_START_DATETIME", "LOCATION"], as_index=False)
    .sum(numeric_only=True)
)

# ===========================
# STEP 6: CALCULATE ALERTS PER TRIP
# ===========================
for alert_type in ALERT_WEIGHTS.keys():
    if alert_type in final_alert_summary_loc.columns:
        final_alert_summary_loc[f"{alert_type}_per_trip"] = np.where(
            final_alert_summary_loc["total_trips"] > 0,
            (final_alert_summary_loc[alert_type] / final_alert_summary_loc["total_trips"]).round(3),
            0
        )
    else:
        final_alert_summary_loc[f"{alert_type}_per_trip"] = 0

# ===========================
# STEP 7: CALCULATE WEIGHTED ENTITY RISK
# ===========================
final_alert_summary_loc["entity_risk"] = 0.0
for alert_type, weight in ALERT_WEIGHTS.items():
    if f"{alert_type}_per_trip" in final_alert_summary_loc.columns:
        final_alert_summary_loc["entity_risk"] += (
            final_alert_summary_loc[f"{alert_type}_per_trip"] * weight
        )

final_alert_summary_loc["entity_risk"] = final_alert_summary_loc["entity_risk"].round(3)

# ===========================
# STEP 8: NORMALIZE TO 0–100 RISK SCORE
# ===========================
# .Soft Robust Normalize
final_alert_summary_loc["soft_norm"] = soft_robust_normalize(final_alert_summary_loc["entity_risk"])

# Convert soft robust range (-3 to 3) → to 0–100
final_alert_summary_loc["RISK_SCORE"] = (
    (final_alert_summary_loc["soft_norm"] + 3) / 6   # bring to 0–1
) * 100


final_alert_summary_loc["RISK_SCORE"] = final_alert_summary_loc["RISK_SCORE"].round(2)

# ===========================
# STEP 9: ADD LOCATION NAME
# ===========================
Location_name_map = (
    master_df.drop_duplicates(subset=["LOCATION_CODE"])
    .set_index("LOCATION_CODE")["LOCATION_NAME"]
    .to_dict()
)

final_alert_summary_loc["LOCATION_NAME"] = final_alert_summary_loc["LOCATION"].map(Location_name_map)

# ===========================
# STEP 10: CREATE FINAL OUTPUT
# ===========================
Location_risk_summary = final_alert_summary_loc[[
    "SCHEDULED_TRIP_START_DATETIME",
    "LOCATION",
    "LOCATION_NAME",
    "total_trips",
    "RISK_SCORE"
]].copy()

# Format date
Location_risk_summary["SCHEDULED_TRIP_START_DATETIME"] = pd.to_datetime(
    Location_risk_summary["SCHEDULED_TRIP_START_DATETIME"]
).dt.strftime("%m/%d/%Y")

# Sort by date and risk score
Location_risk_summary = Location_risk_summary.sort_values(
    ["SCHEDULED_TRIP_START_DATETIME", "RISK_SCORE"], ascending=[False, False]
).reset_index(drop=True)

# ===========================
# STEP 11: SAVE TO CSV
# ===========================

#Location_risk_summary.to_csv("location_risk_summary.csv", index=False)
print(f".Saved location_risk_summary")

# ==================================================
# CREATING CLUSTERS
# ==================================================

# CONFIGURATION / THRESHOLDS
CLUSTER_RADIUS_M = 300
H3_RESOLUTION = 8
LOOKBACK_DAYS = 60
MERGE_DISTANCE_M = 200
RETIRE_DAYS = 20
INFLUENCE_RADIUS = 500

# Alert-specific thresholds
ALERT_THRESHOLDS = {
    "STOPPAGE_VIOLATION": {"min_events": 75, "min_unique_vehicles": 5, "min_unique_days": 5},
    "ROUTE_DEVIATION": {"min_events": 100, "min_unique_vehicles": 5, "min_unique_days": 5},
    "POWER_DISCONNECT": {"min_events": 10, "min_unique_vehicles": 5, "min_unique_days": 5},
    "DEVICE_REMOVED": {"min_events": 10, "min_unique_vehicles": 6, "min_unique_days": 5}
}

WEIGHTS = {"frequency": 0.5, "recency": 0.3, "diversity": 0.2}
OVERLAP_THRESHOLD = 0.5

# SCORING FUNCTIONS
def freq_score(n):
    if n <= 120: return 10
    elif n <= 150: return 30
    elif n <= 200: return 60
    elif n <= 300: return 80
    else: return 100

def recency_score(days_ago):
    if days_ago <= 3: return 100
    elif days_ago <= 7: return 80
    elif days_ago <= 14: return 60
    elif days_ago <= 30: return 30
    else: return 10

def diversity_score(n):
    if n <= 12: return 20
    elif n <= 30: return 50
    elif n <= 50: return 80
    else: return 100

def classify_risk(score):
    if score <= 40: return "Low"
    elif score <= 70: return "Medium"
    elif score <= 95: return "High"
    else: return "Critical"

# H3 ASSIGNMENT
def assign_h3(df, resolution=H3_RESOLUTION):
    if df.empty:
        return df.copy()
    df = df.dropna(subset=["LAT", "LON"]).copy()
    df["h3_index"] = df.apply(lambda r: h3.latlng_to_cell(float(r["LAT"]), float(r["LON"]), resolution), axis=1)
    return df

# BUILD CANDIDATE CLUSTERS
def build_candidate_clusters(train_df, lookback_days=LOOKBACK_DAYS, resolution=H3_RESOLUTION):
    if train_df.empty:
        return {}, None
    latest_time = train_df["EVENT_DATETIME"].max()
    cutoff = latest_time - timedelta(days=lookback_days)
    df = train_df[train_df["EVENT_DATETIME"] >= cutoff].copy()
    df = assign_h3(df, resolution)

    clusters = {}
    seq = 0

    grouped = df.groupby(["ALERT_TYPE", "h3_index"])
    for (atype, cell), g in grouped:
        thresholds = ALERT_THRESHOLDS[atype]

        if len(g) < thresholds["min_events"]:
            continue
        if g["TT_NUMBER"].nunique() < thresholds["min_unique_vehicles"]:
            continue
        if g["EVENT_DATETIME"].dt.date.nunique() < thresholds["min_unique_days"]:
            continue

        seq += 1
        cid = f"{atype[:2]}-{seq}"

         # Most frequent plant in this cluster
        most_common_plant = g['LOCATION'].mode()[0] if not g['LOCATION'].empty else None


        clusters[cid] = {
            "cluster_id": cid,
            "alert_type": atype,
            "h3_index": cell,
            "centroid_lat": g["LAT"].mean(),
            "centroid_lon": g["LON"].mean(),
            "first_seen": g["EVENT_DATETIME"].min(),
            "last_seen": g["EVENT_DATETIME"].max(),
            "events_30d": len(g[g["EVENT_DATETIME"] >= (latest_time - timedelta(days=30))]),
            "events_10d": len(g[g["EVENT_DATETIME"] >= (latest_time - timedelta(days=10))]),
            "events_5d": len(g[g["EVENT_DATETIME"] >= (latest_time - timedelta(days=5))]),
            "unique_trucks_30d": g["TT_NUMBER"].nunique(),
            "unique_days_30d": g["EVENT_DATETIME"].dt.date.nunique(),
            "plant": most_common_plant
        }
    return clusters, latest_time

# MERGE CLUSTERS
def haversine_vectorized(lon1, lat1, lon2, lat2):
    R = 6371000
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlambda = np.radians(lon2 - lon1)
    a = np.sin(dphi/2)**2 + np.cos(phi1)*np.cos(phi2)*np.sin(dlambda/2)**2
    return 2*R*np.arctan2(np.sqrt(a), np.sqrt(1-a))

def merge_clusters(clusters, merge_distance_m=MERGE_DISTANCE_M):
    ids = list(clusters.keys())
    merged, used = {}, set()
    for i, cid in enumerate(ids):
        if cid in used: continue
        base = clusters[cid].copy()
        to_merge = [cid]
        for j in range(i + 1, len(ids)):
            cid2 = ids[j]
            if cid2 in used: continue
            c2 = clusters[cid2]
            if c2["alert_type"] != base["alert_type"]: continue
            if not (base["first_seen"] <= c2["last_seen"] and c2["first_seen"] <= base["last_seen"]): continue
            dist = haversine_vectorized(base["centroid_lon"], base["centroid_lat"], c2["centroid_lon"], c2["centroid_lat"])
            if dist <= merge_distance_m:
                to_merge.append(cid2)
                used.add(cid2)
        parent = max(to_merge, key=lambda x: clusters[x]["events_30d"])
        agg = clusters[parent].copy()
        if len(to_merge) > 1:
            agg["centroid_lat"] = np.mean([clusters[t]["centroid_lat"] for t in to_merge])
            agg["centroid_lon"] = np.mean([clusters[t]["centroid_lon"] for t in to_merge])
            agg["first_seen"] = min(clusters[t]["first_seen"] for t in to_merge)
            agg["last_seen"] = max(clusters[t]["last_seen"] for t in to_merge)
            agg["events_30d"] = sum(clusters[t]["events_30d"] for t in to_merge)
            agg["events_10d"] = sum(clusters[t]["events_10d"] for t in to_merge)
            agg["events_5d"] = sum(clusters[t]["events_5d"] for t in to_merge)
            agg["unique_trucks_30d"] = max(clusters[t]["unique_trucks_30d"] for t in to_merge)
            agg["unique_days_30d"] = max(clusters[t]["unique_days_30d"] for t in to_merge)

            plants = [clusters[t]["plant"] for t in to_merge if clusters[t]["plant"] is not None]
            agg["plant"] = max(set(plants), key=plants.count) if plants else None

        merged[parent] = agg
    return merged

# VALIDATE & SCORE CLUSTERS
def validate_and_score(merged_clusters, latest_time):
    master = {}
    for cid, c in merged_clusters.items():
        atype = c.get("alert_type", "")
        thresholds = ALERT_THRESHOLDS[atype]

        E = c.get("events_30d", 0)
        Uveh = c.get("unique_trucks_30d", 0)
        Uday = c.get("unique_days_30d", 0)
        recent_ok = c.get("events_5d", 0) >= 1

        if (E >= thresholds["min_events"]) and (Uveh >= thresholds["min_unique_vehicles"]) and (Uday >= thresholds["min_unique_days"]) and recent_ok:
            status = "VALID"
        elif c.get("events_10d", 0) >=10  and Uveh >= 2:
            status = "EMERGING"
        elif E >= 5:
            status = "PROVISIONAL"
        else:
            status = "NOISE"

        days_since_last = (latest_time - c["last_seen"]).days if c.get("last_seen") else None
        f_sub = freq_score(c.get("events_30d", 0))
        r_sub = recency_score(days_since_last if days_since_last is not None else 999)
        d_sub = diversity_score(Uveh)
        risk = f_sub * WEIGHTS["frequency"] + r_sub * WEIGHTS["recency"] + d_sub * WEIGHTS["diversity"]
        master[cid] = {
            **c,
            "status": status,
            "days_since_last": days_since_last,
            "freq_subscore": f_sub,
            "recency_subscore": r_sub,
            "diversity_subscore": d_sub,
            "risk_score": round(risk, 1),
            #"risk_band": classify_risk(risk)
        }
    return master

# VECTORIZE GEOFENCE FILTERING
def filter_clusters_geofence(CLUSTER_MASTER, geofence_data):
    geofences = geofence_data[geofence_data["GEOFENCE_TYPE"].str.lower().str.strip() == "authorised"]
    n_clusters = len(CLUSTER_MASTER)
    overlap_flags = np.zeros(n_clusters, dtype=bool)

    cluster_lats = CLUSTER_MASTER["centroid_lat"].values
    cluster_lons = CLUSTER_MASTER["centroid_lon"].values
    cluster_buffer_deg = CLUSTER_RADIUS_M / 111000

    for _, gf in geofences.iterrows():
        gf_point = Point(gf["LONGITUDE"], gf["LATITUDE"])
        gf_radius_deg = gf["RADIUS"] / 111000
        gf_buffer = gf_point.buffer(gf_radius_deg)
        for i in range(n_clusters):
            if overlap_flags[i]:
                continue
            cluster_point = Point(cluster_lons[i], cluster_lats[i])
            cluster_buffer = cluster_point.buffer(cluster_buffer_deg)
            fraction_overlap = cluster_buffer.intersection(gf_buffer).area / cluster_buffer.area
            if fraction_overlap >= OVERLAP_THRESHOLD:
                overlap_flags[i] = True

    filtered_master = CLUSTER_MASTER[~overlap_flags].copy()
    return filtered_master



# FULL PIPELINE
def run_cluster_scoring_from_train(train_data, geofence_data=None):
    clusters, latest_time = build_candidate_clusters(train_data)
    merged_clusters = merge_clusters(clusters)
    CLUSTER_MASTER = validate_and_score(merged_clusters, latest_time)
    CLUSTER_MASTER_DF = pd.DataFrame(CLUSTER_MASTER.values())
    
    if geofence_data is not None:
        FINAL_CLUSTER_MASTER = filter_clusters_geofence(CLUSTER_MASTER_DF, geofence_data)
    else:
        FINAL_CLUSTER_MASTER = CLUSTER_MASTER_DF.copy()

    
    return FINAL_CLUSTER_MASTER

    

# RUN PIPELINE
FINAL_CLUSTER_MASTER = run_cluster_scoring_from_train(train_data, geofence_data)

FINAL_CLUSTER_MASTER_df = FINAL_CLUSTER_MASTER[[
    'cluster_id', 'alert_type', 'risk_score','centroid_lat', 'centroid_lon', 'first_seen', 'last_seen', 
    'events_30d', 'events_10d', 'events_5d', 'unique_trucks_30d', 'status', 'days_since_last' ,'plant'
]].copy()


FINAL_CLUSTER_MASTER_VALID_EMRG = FINAL_CLUSTER_MASTER_df[FINAL_CLUSTER_MASTER_df["status"].isin(["VALID", "EMERGING"])].copy()

def soft_robust_normalize(series, eps=5, clip_range=(-3, 3)):
    
    median = series.median()
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1

    # Soft robust scaling
    normalized = (series - median) / (iqr + eps)

    # Optional clipping to avoid extreme values
    if clip_range:
        normalized = normalized.clip(clip_range[0], clip_range[1])

    # Rescale from [clip_range[0], clip_range[1]] to [0,1] and multiply by 100
    min_clip, max_clip = clip_range
    normalized_0_100 = ((normalized - min_clip) / (max_clip - min_clip)) * 100

    return normalized_0_100


FINAL_CLUSTER_MASTER_VALID_EMRG['risk_score_normalized'] = soft_robust_normalize(FINAL_CLUSTER_MASTER_VALID_EMRG['risk_score'])
FINAL_CLUSTER_MASTER_VALID_EMRG["risk_band"] = FINAL_CLUSTER_MASTER_VALID_EMRG["risk_score_normalized"].apply(classify_risk)
FINAL_CLUSTER_MASTER_VALID_EMRG.rename(columns={'alert_type':'cluster_type', 'risk_score_normalized':'Risk_Score' }, inplace=True)

Location_map = (
    master_df.drop_duplicates(subset=["LOCATION_CODE"])
    .set_index("LOCATION_CODE")["LOCATION_NAME"]
    .to_dict()
)

FINAL_CLUSTER_MASTER_VALID_EMRG["plant_name"] = FINAL_CLUSTER_MASTER_VALID_EMRG["plant"].map(Location_map)

FINAL_CLUSTER_MASTER_VALID_EMRG = FINAL_CLUSTER_MASTER_VALID_EMRG[[
    'cluster_id', 'cluster_type', 'plant', 'plant_name','Risk_Score', 'risk_band','centroid_lat', 'centroid_lon', 'first_seen', 'last_seen',
    'events_30d', 'events_10d', 'events_5d', 'unique_trucks_30d', 'status', 'days_since_last',
]].copy()

FINAL_CLUSTER_MASTER_DISPLAY_df=FINAL_CLUSTER_MASTER_VALID_EMRG.copy()

FINAL_CLUSTER_MASTER_VALID=FINAL_CLUSTER_MASTER_VALID_EMRG[FINAL_CLUSTER_MASTER_VALID_EMRG["status"] == "VALID"]

print("Cluster_Master saved successfully")


# BUILD CLUSTER WEIGHTS
def build_cluster_weights(CLUSTER_MASTER):
    cluster_weights_per_alert = {}
    for alert_type, group in CLUSTER_MASTER.groupby("cluster_type"):
        cluster_weights_per_alert[alert_type] = group[["centroid_lat", "centroid_lon", "Risk_Score"]].to_dict(orient="records")
    return cluster_weights_per_alert


cluster_weights_per_alert = build_cluster_weights(FINAL_CLUSTER_MASTER_VALID)
# Save to JSON
with open("cluster_weights.json", "w") as f:
    json.dump(cluster_weights_per_alert, f, indent=4)

print("cluster_weights_per_alert saved successfully")

FINAL_CLUSTER_MASTER_df = FINAL_CLUSTER_MASTER_DISPLAY_df



# ==================================================
# LOCATION SENSITIVITY CALCULATION
# ==================================================

INFLUENCE_RADIUS = 800

def compute_total_location_sensitivity_fast(
    realtime_data,
    cluster_weights_per_alert,
    alert_type_weights,
    radius_m,
):
    R = 6371000.0  # Earth radius (m)
    total_scores = np.zeros(len(realtime_data), dtype=np.float32)

    # Convert realtime coordinates to radians once
    realtime_coords = np.radians(realtime_data[["LAT", "LON"]].values.astype(np.float32))

    for alert_type, type_weight in alert_type_weights.items():
        clusters = cluster_weights_per_alert.get(alert_type, [])
        if not clusters:
            continue

        # Extract cluster info
        cluster_coords = np.radians(
            np.array([[c["centroid_lat"], c["centroid_lon"]] for c in clusters], dtype=np.float32)
        )
        cluster_risks = np.array([c["Risk_Score"] for c in clusters], dtype=np.float32)

        # Build BallTree for cluster centroids (Haversine metric)
        tree = BallTree(cluster_coords, metric="haversine")

        # Convert search radius to radians
        radius_radians = radius_m / R

        # Find clusters within influence radius for each realtime point
        indices_array = tree.query_radius(realtime_coords, r=radius_radians, return_distance=True)

        for i, (cluster_idx, dist_radians) in enumerate(zip(*indices_array)):
            if len(cluster_idx) == 0:
                continue

            # Convert to meters
            dist_m = dist_radians * R

            # Compute influence (linear decay)
            influence = np.clip(1 - dist_m / radius_m, 0, None)

            # Weighted sum for this point
            total_scores[i] += np.sum(cluster_risks[cluster_idx] * influence) * type_weight

    realtime_data["location_sensitivity"] = total_scores
    return realtime_data


# Define alert type weights
alert_type_weights = {
    "ROUTE_DEVIATION": 0.4,
    "STOPPAGE_VIOLATION": 0.3,
    "POWER_DISCONNECT": 0.2,
    "DEVICE_REMOVED": 0.1
}

# Compute location sensitivity
realtime_data = compute_total_location_sensitivity_fast(
    realtime_data,
    cluster_weights_per_alert,
    alert_type_weights,
    radius_m=INFLUENCE_RADIUS
)

Location_Sensitivity = realtime_data.groupby('INVOICE_NO')['location_sensitivity'].mean()

print(".Location sensitivity computed successfully.")


# ===============================
# COMBO RISK MAPPING
# ===============================

if not combo_df.empty:
    combo_df_agg = (
        combo_df.groupby("INVOICE_NO")["Last_Combo_Rule"]
        .apply(lambda x: x.dropna().iloc[-1] if len(x.dropna()) else None)
        .reset_index()
    )
    combo_df_agg["combo_risk"] = combo_df_agg["Last_Combo_Rule"].apply(
        lambda x: COMBO_RULES[x]["combo_delta"] / 100 if x in COMBO_RULES else 0
    )
    realtime_data = realtime_data.merge(
        combo_df_agg[["INVOICE_NO", "combo_risk"]], on="INVOICE_NO", how="left"
    )
    realtime_data["combo_risk"].fillna(0, inplace=True)
else:
    realtime_data["combo_risk"] = 0

combo_Risk_df = (
    realtime_data.groupby('INVOICE_NO', as_index=False)['combo_risk'].mean()
)


# COMBO TYPE COUNTS PER TRIP
if not combo_df.empty:
    combo_type_counts = (
        combo_df.groupby(['INVOICE_NO', 'Last_Combo_Rule'])
        .size()
        .unstack(fill_value=0)
        .reset_index()
    )

    # .Add total combo count
    combo_type_counts["Total_Combo_Count"] = combo_type_counts.drop(columns=["INVOICE_NO"]).sum(axis=1)

    # .Merge combo counts into realtime_data
    combo_Risk = combo_Risk_df.merge(combo_type_counts, on="INVOICE_NO", how="left")
    combo_Risk.fillna(0, inplace=True)

print("combo_Risk :", combo_Risk.columns)
print(".Combo Risk computed successfully.")



# ==============================================
# ATOMIC RISK CALCULATION AND MAPPING
# ==============================================

risk_map = {
    "ROUTE_DEVIATION": 0.2,
    "STOPPAGE_VIOLATION": 0.1,
    "DEVICE_REMOVED": 0.4,
    "POWER_DISCONNECT": 0.3,
}

realtime_data["atomic_risk"] = realtime_data["ALERT_TYPE"].map(risk_map)
Atomic_Risk = realtime_data.groupby('INVOICE_NO')['atomic_risk'].mean()

print(".Atomic Risk computed successfully.")


# ==============================================
# PREPARE COMPLETED TRIPS DATA
# ==============================================



Entity_Risk = TT_entity_risk_summary[["TT_NUMBER", "entity_risk"]].copy()

print(".Atomic Risk computed successfully.")
# ==============================================
# MERGE ALL RISK COMPONENTS
# ==============================================
completed_Trips = trip_Realtime_df[[
    'TRIP_NAME', 'TRIP_ID', 'SCHEDULED_TRIP_START_DATETIME', 'SCHEDULED_TRIP_END_DATETIME',
    'INVOICE_NO', 'TT_NUMBER', 'TRANSPORTER_CODE', 'ROUTE_NO', 'ZONE', 'LOCATION'
]].copy()

completed_Trips['TRANSPORTER_CODE'] = completed_Trips['TRANSPORTER_CODE'].apply(normalize_code)

# Merge completed_Trips and Atomic_Risk
merged_df_1_2 = pd.merge(completed_Trips, Atomic_Risk, on='INVOICE_NO', how='left')

# Merge with combo_Risk
merged_df_1_2_3 = pd.merge(merged_df_1_2, combo_Risk, on='INVOICE_NO', how='left')

# Merge with Location_Sensitivity
merged_df_1_2_3_4 = pd.merge(merged_df_1_2_3, Location_Sensitivity, on='INVOICE_NO', how='left')

# Merge with Entity_Risk
final_merged_df = pd.merge(merged_df_1_2_3_4, Entity_Risk, on='TT_NUMBER', how='left')

# Fill NaN values with 0
final_merged_df['atomic_risk'].fillna(0, inplace=True)
final_merged_df['combo_risk'].fillna(0, inplace=True)
final_merged_df['location_sensitivity'].fillna(0, inplace=True)
final_merged_df['entity_risk'].fillna(0, inplace=True)
final_merged_df['Total_Combo_Count'].fillna(0, inplace=True)


# ==========================================
# OVERALL RISK & CUMULATIVE RISK CALCULATION 
# ==========================================


# Normalize function
def normalize(series):
    if series.max() == series.min():
        return series * 0
    return (series - series.min()) / (series.max() - series.min())

# --- Normalize components ---
final_merged_df["atomic_risk_norm"] = normalization_min_max(final_merged_df["atomic_risk"])

final_merged_df["combo_risk_norm"] = normalization_min_max(final_merged_df["combo_risk"])

final_merged_df["location_sensitivity_norm"] = normalization_min_max(final_merged_df["location_sensitivity"])
final_merged_df["entity_risk_norm"] = soft_robust_normalize(final_merged_df["entity_risk"])


# --- Weights ---
w_atomic, w_combo, w_location, w_entity = 0.1, 0.4, 0.3, 0.2


# --- Weighted cumulative risk ---
final_merged_df["cumulative_risk"] = (
    w_atomic * final_merged_df["atomic_risk_norm"]
    + w_combo * final_merged_df["combo_risk_norm"]
    + w_location * final_merged_df["location_sensitivity_norm"]
    + w_entity * final_merged_df["entity_risk_norm"]
)


# --- Scale cumulative score to 0–100 ---
cum = final_merged_df["cumulative_risk"]
final_merged_df["Risk_Score"] = ((cum - cum.min()) / (cum.max() - cum.min())) * 100


Location_name_map = (
    master_df.drop_duplicates(subset=["LOCATION_CODE"])
    .set_index("LOCATION_CODE")["LOCATION_NAME"]
    .to_dict()
)

final_merged_df["LOCATION_NAME"] = final_merged_df["LOCATION"].map(Location_name_map)

# Fallback: Extract location name from TRIP_NAME if LOCATION_NAME is null
# TRIP_NAME format: "1528( RAIPUR IRD-II ) To 0041015826( THAKUR FUELS )"
def extract_location_from_trip_name(trip_name):
    if pd.isna(trip_name):
        return None
    import re
    match = re.search(r'\(\s*(.+?)\s*\)', str(trip_name))
    return match.group(1).strip() if match else None

final_merged_df["LOCATION_NAME"] = final_merged_df.apply(
    lambda row: extract_location_from_trip_name(row["TRIP_NAME"]) if pd.isna(row["LOCATION_NAME"]) else row["LOCATION_NAME"],
    axis=1
)

alert_count = (
    train_data.groupby(["INVOICE_NO", "ALERT_TYPE"])
    .agg(total_alerts=("ALERT_TYPE", "count"))
    .reset_index()
)

# Pivot ALERT_TYPE as columns
alert_count_pivot = alert_count.pivot_table(
    index="INVOICE_NO",
    columns="ALERT_TYPE",
    values="total_alerts",
    fill_value=0
).reset_index()

alert_count_pivot.columns.name = None

final_merged_df = pd.merge(final_merged_df, alert_count_pivot, on="INVOICE_NO", how="left")

final_merged = final_merged_df[[
    'TRIP_NAME', 'TRIP_ID', 'Risk_Score','DEVICE_REMOVED', 'POWER_DISCONNECT', 'ROUTE_DEVIATION',
       'STOPPAGE_VIOLATION','Total_Combo_Count','SCHEDULED_TRIP_START_DATETIME', 'SCHEDULED_TRIP_END_DATETIME', 
    'INVOICE_NO', 'TT_NUMBER', 'TRANSPORTER_CODE', 'ROUTE_NO', 'ZONE', 'LOCATION_NAME'
]].copy()

print(final_merged_df.columns)
# ----------------------------------------------------------------------
# 1. Save Cluster master 
# ----------------------------------------------------------------------


#FINAL_CLUSTER_MASTER_DISPLAY_df.to_csv("cluster_master.csv", index=False)
print(f".Cluster master data saved to cluster_master.csv")


# ----------------------------------------------------------------------
# 2. Save Combo Alerts 
# ----------------------------------------------------------------------

#combo_df.to_csv("combo_alerts.csv", index=False)
print(f".Combo alerts data saved to combo_alerts.csv")


# ----------------------------------------------------------------------
# 3. Save Transporter Risk Score 
# ----------------------------------------------------------------------
#Transporter_risk_summary.to_csv("transporter_risk_score.csv", index=False)
print(f".Transporter risk data saved to transporter_risk_score.csv")


# ----------------------------------------------------------------------
# 4. Save TT Risk Score 
# ----------------------------------------------------------------------

#TT_risk_summary.to_csv("tt_risk_score.csv", index=False)
print(f".TT risk data saved to tt_risk_score.csv")


# ----------------------------------------------------------------------
# 4. Save Location Risk Score 
# ----------------------------------------------------------------------

#Location_risk_summary.to_csv("Location_risk_score.csv", index=False)
print(f".location risk data saved to location_risk_score.csv")


# ----------------------------------------------------------------------
# 5. Save Completed Trips Risk Score 
# ----------------------------------------------------------------------
#final_merged.to_csv("completed_trips_risk_score.csv", index=False)
print(f".Completed trips risk score data saved to completed_trips_risk_score.csv")


print("\n" + "="*60)
print("FINAL RISK SCORES")
print("="*60)
print(final_merged.head(20))
print(f"\nTotal trips processed: {len(final_merged)}")
print(f"Average Risk Score: {final_merged['Risk_Score'].mean():.2f}")
print(f"High Risk Trips (>70): {len(final_merged[final_merged['Risk_Score'] > 70])}")


# =====================================================
# DATABASE INTEGRATION: SAVE OUTPUTS
# =====================================================

def pandas_to_pg_dtypes(df: pd.DataFrame) -> dict:
    """Return a dict {column: sqlalchemy type} that matches the pandas df."""
    pg_types = {}
    for col, dtype in df.dtypes.items():
        str_dtype = str(dtype)
        if str_dtype.startswith('int'):
            pg_types[col] = Integer
        elif str_dtype.startswith('float'):
            pg_types[col] = Double
        elif str_dtype == 'bool':
            pg_types[col] = Boolean
        elif str_dtype == 'datetime64[ns]':
            pg_types[col] = DateTime
        else:
            # strings, categories, etc.
            max_len = df[col].astype(str).str.len().max()
            length = max(50, int(max_len) + 10) if pd.notna(max_len) else 255
            pg_types[col] = VARCHAR(length)
    return pg_types


def upsert_df(engine, df: pd.DataFrame, table_name: str, pk_columns: list):
    """
    Delete rows that already exist (identified by pk_columns) and insert the new ones.
    """
    if df.empty:
        return

    # Build WHERE clause for the DELETE
    pk_placeholders = " AND ".join([f'"{c}" = :{c.replace(" ", "_")}' for c in pk_columns])
    delete_sql = f'DELETE FROM public."{table_name}" WHERE {pk_placeholders};'

    with engine.begin() as conn:
        # 1. Delete existing rows
        for _, row in df[pk_columns].iterrows():
            params = {c.replace(" ", "_"): row[c] for c in pk_columns}
            conn.execute(text(delete_sql), params)

        # 2. Insert fresh rows
        df.to_sql(
            name=table_name,
            con=conn,
            schema='public',
            if_exists='append',
            index=False,
            method='multi'
        )

# ----------------------------------------------------------------------
# 1. Save Cluster master to database
# ----------------------------------------------------------------------
CLUSTER_TABLE = "cluster_master"
cluster_df = FINAL_CLUSTER_MASTER_DISPLAY_df.copy()
cluster_df.columns = cluster_df.columns.str.lower()  # Convert to lowercase
cluster_pk = [col.lower() for col in ["cluster_id"]]  # Lowercase PK columns

cluster_dtypes = pandas_to_pg_dtypes(cluster_df)
cluster_df.to_sql(
    name=CLUSTER_TABLE,
    con=app_db_engine,
    schema='public',
    if_exists='replace',
    index=False,
    dtype=cluster_dtypes
)

upsert_df(app_db_engine, cluster_df, CLUSTER_TABLE, cluster_pk)
print(f"\n.Cluster master data saved to public.{CLUSTER_TABLE} ({len(cluster_df)} rows)")



# ----------------------------------------------------------------------
# 2. Save Combo Alerts to database
# ----------------------------------------------------------------------
COMBO_TABLE = "combo_alerts"
if not combo_df.empty:
    combo_df = combo_df.copy()
    combo_df.columns = combo_df.columns.str.lower()  # Convert to lowercase
    combo_dtypes = pandas_to_pg_dtypes(combo_df)
    combo_df.to_sql(
        name=COMBO_TABLE, con=app_db_engine, schema='public',
        if_exists='replace', index=False, dtype=combo_dtypes
    )
    print(f".Combo alerts data saved to public.{COMBO_TABLE} ({len(combo_df)} rows)")

else:
    print(f"  No combo alerts detected, skipping {COMBO_TABLE} table creation")


# ----------------------------------------------------------------------
# 3. Save Transporter Risk Score to database
# ----------------------------------------------------------------------
TRANSPORTER_TABLE = "transporter_risk_score"
Transporter_risk_summary = Transporter_risk_summary.copy()
Transporter_risk_summary.columns = Transporter_risk_summary.columns.str.lower()  # Convert to lowercase
transporter_dtypes = pandas_to_pg_dtypes(Transporter_risk_summary)
Transporter_risk_summary.to_sql(
    name=TRANSPORTER_TABLE, con=app_db_engine, schema='public',
    if_exists='replace', index=False, dtype=transporter_dtypes
)
print(f".Transporter risk data saved to public.{TRANSPORTER_TABLE} ({len(Transporter_risk_summary)} rows)")



# ----------------------------------------------------------------------
# 4. Save TT Risk Score to database
# ----------------------------------------------------------------------
TT_TABLE = "tt_risk_score"
TT_risk_summary = TT_risk_summary.copy()
TT_risk_summary.columns = TT_risk_summary.columns.str.lower()  # Convert to lowercase
tt_dtypes = pandas_to_pg_dtypes(TT_risk_summary)
TT_risk_summary.to_sql(
    name=TT_TABLE, con=app_db_engine, schema='public',
    if_exists='replace', index=False, dtype=tt_dtypes
)
print(f".TT risk data saved to public.{TT_TABLE} ({len(TT_risk_summary)} rows)")


# ----------------------------------------------------------------------
# 4. Save location Risk Score to database
# ----------------------------------------------------------------------
location_TABLE = "location_risk_score"
Location_risk_summary = Location_risk_summary.copy()
Location_risk_summary.columns = Location_risk_summary.columns.str.lower()  # Convert to lowercase
location_dtypes = pandas_to_pg_dtypes(Location_risk_summary)
Location_risk_summary.to_sql(
    name=location_TABLE, con=app_db_engine, schema='public',
    if_exists='replace', index=False, dtype=location_dtypes
)
print(f".Location risk data saved to public.{location_TABLE} ({len(Location_risk_summary)} rows)")


# ----------------------------------------------------------------------
# 5. Save Completed Trips Risk Score to database
# ----------------------------------------------------------------------
TABLE_NAME = "completed_trips_risk_score"
final_merged = final_merged.copy()
final_merged.columns = final_merged.columns.str.lower()  # Convert to lowercase
df_dtypes = pandas_to_pg_dtypes(final_merged)
final_merged.to_sql(
    name=TABLE_NAME, con=app_db_engine, schema='public',
    if_exists='replace', index=False, dtype=df_dtypes
)

print(f".Completed trips risk score data saved to public.{TABLE_NAME} ({len(final_merged)} rows)")




# ================================== TT_After_Dr ============================================

merge_df=alerts.copy()


print(merge_df.columns)
# Columns to keep in final result - adjust if needed
info_cols = [ 'LOAD_NO', 'ROUTE_NO','LOCATION', 'DESTINATION',
             'TRANSPORTER_CODE', 'TRANSPORTER_NAME']

# Get last DR datetime per  INVOICE_NO + TT_NUMBER
dr_df = merge_df[merge_df['ALERT_TYPE'] == "DEVICE_REMOVED"]
last_dr = dr_df.groupby(['TT_NUMBER', 'INVOICE_NO'])['EVENT_DATETIME'].max().reset_index()
last_dr.rename(columns={'EVENT_DATETIME': 'last_dr_time'}, inplace=True)

# Merge last DR datetime back to main DataFrame
merge_df = merge_df.merge(last_dr, on=['TT_NUMBER', 'INVOICE_NO'], how='left')

# Filter events after last DR (excluding DR itself)
after_dr_df = merge_df[(merge_df['EVENT_DATETIME'] > merge_df['last_dr_time']) & (merge_df['ALERT_TYPE'] != "DEVICE_REMOVED")]

# Total violations after DR per TT_NUMBER + INVOICE_NO
total_violations = after_dr_df.groupby(['TT_NUMBER', 'INVOICE_NO'])['ALERT_TYPE'].count().reset_index()
total_violations.rename(columns={'ALERT_TYPE': 'total_violations_after_dr'}, inplace=True)

# Specific alert counts per TT_NUMBER + INVOICE_NO
specific_counts = after_dr_df.groupby(['TT_NUMBER', 'INVOICE_NO', 'ALERT_TYPE']).size().unstack(fill_value=0).reset_index()

# Get info columns (take first row per TT_NUMBER + INVOICE_NO)
info_df = merge_df.groupby(['INVOICE_NO','TT_NUMBER'])[info_cols].first().reset_index()

# Step 1: Merge everything, but do NOT fillna(0) yet
final_summary = info_df.merge(last_dr, on=['TT_NUMBER', 'INVOICE_NO'], how='left') \
                       .merge(total_violations, on=['TT_NUMBER', 'INVOICE_NO'], how='left') \
                       .merge(specific_counts, on=['TT_NUMBER', 'INVOICE_NO'], how='left')

# Step 2: Fill only numeric/count columns
count_cols = ['total_violations_after_dr'] + [c for c in specific_counts.columns if c not in ['TT_NUMBER','INVOICE_NO']]
count_cols = [c for c in count_cols if c in final_summary.columns]  # safe filter
final_summary[count_cols] = final_summary[count_cols].fillna(0).astype(int)

# Step 3 (optional): Create display column for last_dr_time
final_summary['last_dr_time'] = final_summary['last_dr_time'].dt.strftime('%Y-%m-%d %H:%M:%S')
final_summary['last_dr_time'] = final_summary['last_dr_time'].fillna("DR event not found")

#VTS_TRIPS

VTS_TRIPS_PATH = pd.read_sql_query( # type: ignore
    'SELECT * FROM vts_alert_history', app_db_engine
) # type: ignore
print(f"Loaded {len(VTS_TRIPS_PATH)} VTS trip records")




# Subset required columns and make a copy to avoid SettingWithCopyWarning
VTS_Trips = VTS_TRIPS_PATH[['vendor_id', 'location_id', 'location_type', 'tl_number',
                            'vts_start_datetime', 'vts_end_datetime',
                            'stoppage_violations_count', 'route_deviation_count',
                            'speed_violation_count', 'main_supply_removal_count',
                            'night_driving_count', 'no_halt_zone_count',
                            'device_offline_count', 'device_tamper_count',
                            'continuous_driving_count', 'invoice_number', 'tt_type']].copy()

# # Convert datetime safely
VTS_Trips.loc[:, 'vts_start_datetime'] = pd.to_datetime(VTS_Trips['vts_start_datetime'], errors='coerce')
VTS_Trips.loc[:, 'vts_end_datetime'] = pd.to_datetime(VTS_Trips['vts_end_datetime'], errors='coerce')

# Rename columns
VTS_Trips = VTS_Trips.rename(columns={
    "tl_number":"TT_NUMBER",
    "invoice_number": "INVOICE_NO"
})

VTS_df=VTS_Trips[['TT_NUMBER', 'INVOICE_NO','vts_start_datetime', 'vts_end_datetime']].copy()

VTS_df['vts_start_datetime'] = pd.to_datetime(VTS_df['vts_start_datetime'], errors='coerce')
VTS_df['vts_end_datetime'] = pd.to_datetime(VTS_df['vts_end_datetime'], errors='coerce')
final_summary['last_dr_time'] = pd.to_datetime(final_summary['last_dr_time'], errors='coerce')

# -------------------------------
# Total trips, first and last trip (memory-efficient)
# -------------------------------
trip_summary = VTS_df.groupby('TT_NUMBER').agg(
    total_trips=('INVOICE_NO', 'count'),
    first_trip_time=('vts_start_datetime', 'min'),
    last_trip_time=('vts_end_datetime', 'max')
).reset_index()

# -------------------------------
# Map last_dr_time to df (memory-efficient)
# -------------------------------
last_dr_map = final_summary.set_index('TT_NUMBER')['last_dr_time'].to_dict()
VTS_df['last_dr_time'] = VTS_df['TT_NUMBER'].map(last_dr_map)

# -------------------------------
# Flag trips after last DR
# -------------------------------
VTS_df['after_last_dr'] = VTS_df['vts_start_datetime'] > VTS_df['last_dr_time']

# -------------------------------
# Count trips after last DR per TT_NUMBER
# -------------------------------
trips_after_dr = VTS_df.groupby('TT_NUMBER')['after_last_dr'].sum().reset_index(name='total_trips_after_last_dr')

# -------------------------------
# Merge all computed columns to final_summary
# -------------------------------
# Drop old column if exists to avoid MergeError
if 'total_trips_after_last_dr' in final_summary.columns:
    final_summary = final_summary.drop(columns=['total_trips_after_last_dr'])

# Merge total trips first
final_summary = final_summary.merge(trip_summary, on='TT_NUMBER', how='left')

# Merge trips after last DR
final_summary = final_summary.merge(trips_after_dr, on='TT_NUMBER', how='left')

# Replace missing last_dr_time or trips_after_last_dr equal to total_trips
final_summary['total_trips_after_last_dr'] = final_summary.apply(
    lambda x: "DR event not found"
              if pd.isna(x['last_dr_time']) 
                 or pd.isna(x['total_trips_after_last_dr'])
                 or x['total_trips'] == x['total_trips_after_last_dr']
              else int(x['total_trips_after_last_dr']),
    axis=1
)


# Optionally, replace missing last_dr_time
final_summary['last_dr_time'] = final_summary['last_dr_time'].fillna("DR event not found")

# Fill any remaining NaNs with 0 if needed
final_summary = final_summary.fillna(0)
Location_m =( master_df.drop_duplicates(subset=["LOCATION_CODE"]).set_index("LOCATION_CODE")["LOCATION_NAME"].to_dict())
final_summary["LOCATION_NAME"]=final_summary["LOCATION"].map(Location_m)
final_TT_After_DR=final_summary[['INVOICE_NO', 'TT_NUMBER', 'LOAD_NO', 'ROUTE_NO', 'LOCATION','LOCATION_NAME', 'DESTINATION', 'TRANSPORTER_CODE', 'TRANSPORTER_NAME', 'last_dr_time',
                                'total_trips_after_last_dr','total_violations_after_dr',"POWER_DISCONNECT", "ROUTE_DEVIATION", "STOPPAGE_VIOLATION"]]

#final_TT_After_DR.to_csv("TT_After_DR.csv")
print("\n=== TT_After_DR csv Saved ===")

# =====================================================
# DATABASE INTEGRATION: SAVE OUTPUTS
# =====================================================

def pandas_to_pg_dtypes(df: pd.DataFrame) -> dict:
    """Return a dict {column: sqlalchemy type} that matches the pandas df."""
    pg_types = {}
    for col, dtype in df.dtypes.items():
        str_dtype = str(dtype)
        if str_dtype.startswith('int'):
            pg_types[col] = Integer
        elif str_dtype.startswith('float'):
            pg_types[col] = Double
        elif str_dtype == 'bool':
            pg_types[col] = Boolean
        elif str_dtype == 'datetime64[ns]':
            pg_types[col] = DateTime
        else:
            # strings, categories, etc.
            max_len = df[col].astype(str).str.len().max()
            length = max(50, int(max_len) + 10) if pd.notna(max_len) else 255
            pg_types[col] = VARCHAR(length)
    return pg_types


def upsert_df(engine, df: pd.DataFrame, table_name: str, pk_columns: list):
    """
    Delete rows that already exist (identified by pk_columns) and insert the new ones.
    """
    if df.empty:
        return

    # Build WHERE clause for the DELETE
    pk_placeholders = " AND ".join([f'"{c}" = :{c.replace(" ", "_")}' for c in pk_columns])
    delete_sql = f'DELETE FROM public."{table_name}" WHERE {pk_placeholders};'

    with engine.begin() as conn:
        # 1. Delete existing rows
        for _, row in df[pk_columns].iterrows():
            params = {c.replace(" ", "_"): row[c] for c in pk_columns}
            conn.execute(text(delete_sql), params)

        # 2. Insert fresh rows
        df.to_sql(
            name=table_name,
            con=conn,
            schema='public',
            if_exists='append',
            index=False,
            method='multi'
        )

TABLE_NAME = "tt_after_dr"
final_TT_After_DR = final_TT_After_DR.copy()
final_TT_After_DR.columns = final_TT_After_DR.columns.str.lower() 
df_dtypes = pandas_to_pg_dtypes(final_TT_After_DR)

pk_columns = ['invoice_no', 'tt_number']

final_TT_After_DR.to_sql(
    name=TABLE_NAME,
    con=app_db_engine,
    schema='public',
    if_exists='replace',
    index=False,
    dtype=df_dtypes
)

# Upsert to handle updates
upsert_df(app_db_engine, final_TT_After_DR, TABLE_NAME, pk_columns)
print(f"TT After DR data saved to public.{TABLE_NAME} ({len(final_TT_After_DR)} rows)")

app_db_engine.dispose()
print("DATABASE CONNECTION CLOSED")

