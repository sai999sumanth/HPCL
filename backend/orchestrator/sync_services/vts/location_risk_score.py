import urdhva_base
import pyodbc
import numpy as np
import pandas as pd
import h3.api.basic_str as h3
from datetime import datetime, timedelta
from shapely.geometry import Point, Polygon
from shapely.vectorized import contains
from sqlalchemy import create_engine, text, Integer, Double, Boolean, DateTime, VARCHAR, Float
import json
from sklearn.neighbors import BallTree
import orchestrator.dbconnector.credential_loader as credential_loader

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




RENAMES_alerts = {

    "EVENT_DATE": "EVENT_DATETIME",
    "TRANSPORTER_ID":"TRANSPORTER_CODE",
    "START_LATITUDE": "LAT",
    "START_LONGITUDE": "LON",
    "STOPPAGE_LATITUDE":"LAT",
    "STOPPAGE_LONGITUDE": "LON",
    "ALERT_LATITUDE": "LAT",
    "ALERT_LONGITUDE":"LON"
}


def load_alerts_data():

    # Load all alert CSVs
    RD = pd.read_sql_query('SELECT * FROM route_deviation', vts_engine)
    print(f"Loaded {len(RD)} route deviation records")
    ST = pd.read_sql_query('SELECT * FROM stoppage_violation', vts_engine)
    print(f"Loaded {len(ST)} stoppage violation records")
    DR = pd.read_sql_query('SELECT * FROM device_removed', vts_engine)
    print(f"Loaded {len(DR)} device removed records")
    PD = pd.read_sql_query('SELECT * FROM power_disconnect', vts_engine)
    print(f"Loaded {len(PD)} power disconnect records")
    CO = pd.read_sql_query('SELECT * FROM CABINET_OPEN', vts_engine)
    print(f"Loaded {len(CO)} cabinet open records")
    CD = pd.read_sql_query('SELECT * FROM continuous_driving', vts_engine)
    print(f"Loaded {len(CD)} continuous driving records")
    HA = pd.read_sql_query('SELECT * FROM harsh_acceleration', vts_engine)
    print(f"Loaded {len(HA)} harsh acceleration records")
    HT = pd.read_sql_query('SELECT * FROM harsh_turn', vts_engine)
    print(f"Loaded {len(HT)} harsh turn records")
    HB = pd.read_sql_query('SELECT * FROM harsh_braking', vts_engine)
    print(f"Loaded {len(HB)} harsh breaking records")
    ND = pd.read_sql_query('SELECT * FROM night_driving', vts_engine)
    print(f"Loaded {len(ND)} night driving records")
    SV = pd.read_sql_query('SELECT * FROM speed_violation', vts_engine)
    print(f"Loaded {len(SV)} speed violation records")

    # Store all in a dictionary
    df_dict = {
        "RD": RD, "ST": ST, "DR": DR, "PD": PD,
        "CO": CO, "CD": CD, "HA": HA, "HT": HT,
        "HB": HB, "ND": ND, "SV": SV
    }

    # Rename columns + convert EVENT_DATETIME
    for key, df in df_dict.items():
        df.rename(columns=RENAMES_alerts, inplace=True)

        if "EVENT_DATETIME" in df.columns:
            df["EVENT_DATETIME"] = pd.to_datetime(df["EVENT_DATETIME"], errors="coerce", format="mixed")


        df["ALERT_TYPE"] = key

    # Combine all alerts
    alerts = pd.concat(df_dict.values(), ignore_index=True)

    # Sort
    if "EVENT_DATETIME" in alerts.columns:
        alerts.sort_values("EVENT_DATETIME", inplace=True)

    # Filter
    if "LOCATION_TYPE" in alerts.columns and "TRIP_STATUS" in alerts.columns:
        alerts = alerts[
            (alerts["LOCATION_TYPE"].isin(["TAS","LPG"])) &
            (alerts["TRIP_STATUS"].isin(["LOADED", "UN LOADED"]))
        ]

    # ---------------------------------------------------------------------------------------
    # 🔥 Add summary function + run summary for each individual dataframe (RD, ST, etc.)
    # ---------------------------------------------------------------------------------------

    def generate_invoice_summary(df, name):
        if "EVENT_DATE" in df.columns:
            df["EVENT_DATE"] = pd.to_datetime(df["EVENT_DATE"], errors="coerce", format="mixed")

        elif "EVENT_DATETIME" in df.columns:
            df["EVENT_DATE"] = pd.to_datetime(df["EVENT_DATETIME"], errors="coerce", format="mixed")


        return {
            "Dataset": name,
            "Date_From": df["EVENT_DATE"].min(),
            "Date_To": df["EVENT_DATE"].max(),
            "Total_Unique_Invoice": df["INVOICE_NO"].nunique() if "INVOICE_NO" in df.columns else 0,
            "Loaded_Unique_Invoice": df.loc[df["TRIP_STATUS"].str.lower() == "loaded", "INVOICE_NO"].nunique() if "TRIP_STATUS" in df.columns else 0,
            "Unloaded_Unique_Invoice": df.loc[df["TRIP_STATUS"].str.lower() == "un loaded", "INVOICE_NO"].nunique() if "TRIP_STATUS" in df.columns else 0
        }

    summary_list = []
    for name, df in df_dict.items():
        summary_list.append(generate_invoice_summary(df, name))

    summary_table = pd.DataFrame(summary_list)
    print("\n==================== ALERT SUMMARY TABLE ====================")
    print(summary_table)
    print("=============================================================\n")

    # ---------------------------------------------------------------------------------------

    return alerts


alerts=load_alerts_data()
print(f"Loaded {len(alerts)} vehicle master records")

# ========================================================
# LOAD Completed_Trips File
# ========================================================

trip_data=pd.read_sql_query('SELECT * FROM completed_trip', vts_engine)
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


# =================================================
# LOAD MASTER MAPPING
# =================================================

VEHICLE_MASTER_RENAME_MAP = {
    "tt_number": "TT No",
    "tank_compartment": "Tank Compartment",
    "vol_capacity": "VOL Capacity",
    "transporter_name": "Transporter Name",
    "transporter_code": "Transporter Code",
    "location_name": "Location Name",
    "sap_id": "Location Code",   # extra in DB → kept as uppercase

}

#master_df = pd.read_sql_query('SELECT * FROM public.vehicle_master', engine)
master_df=pd.read_sql_query("SELECT * FROM public.vts_truck_master ", app_db_engine)
print(f"Loaded {len(master_df)} vehicle master records")
master_df.rename(columns=VEHICLE_MASTER_RENAME_MAP, inplace=True)
master_df.rename(columns={"Transporter Code":"TRANSPORTER_CODE","Transporter Name":"TRANSPORTER_NAME",
                          "TT No":"TT_NUMBER", "Location Code":"LOCATION_CODE", "Location Name":"LOCATION_NAME"}, inplace=True)

# Keep only the columns we need for mapping
required_cols = ["TT_NUMBER", "TRANSPORTER_CODE", "TRANSPORTER_NAME", "LOCATION_NAME", "LOCATION_CODE"]
available_cols = [col for col in required_cols if col in master_df.columns]
master_df = master_df[available_cols].copy()


# =================================================
# LOAD GEOFENCE DATA
# =================================================
GEOFENCE_RENAME_MAP = {
    "geofence_name": "GEOFENCE_NAME",
    "latitude": "LATITUDE",
    "longitude": "LONGITUDE",
    "radius": "RADIUS",
    "latlon": "latlon",              # already same in both
    "geofence_type": "GEOFENCE_TYPE",
}

#geofence_data = pd.read_sql_query('SELECT * FROM public.geofence_master', engine)
geofence_data=pd.read_sql_query('SELECT * FROM geofence_master', app_db_engine)
print(f"Loaded {len(geofence_data)} geofence records")
geofence_data.rename(columns=GEOFENCE_RENAME_MAP, inplace=True)
print(f"Loaded {len(geofence_data)} geofence records")
geofence_data.rename(columns={c: c.lower() for c in geofence_data.columns}, inplace=True)
geofence_data.rename(columns={'geofence_type': 'GEOFENCE_TYPE', 'latitude': 'LATITUDE',
                               'longitude': 'LONGITUDE', 'radius': 'RADIUS'}, inplace=True)



# =================================================
# LOAD SHORTAGE DATA
# =================================================
shortage_df = pd.read_sql_query('SELECT * FROM sales_trips_till_date', app_db_engine)
print(f"Loaded {len(shortage_df)} shortage records")
shortage_df = shortage_df.rename(columns={"sap_id": "LOCATION", "inv_ref": "INVOICE_NO", 'vehicle_id':"TT_NUMBER",
                                          "qty_shortage":"QTY_SHORTAGE(L)"})

shortage_df["invoice_date"] = pd.to_datetime(shortage_df["invoice_date"], format="%Y%m%d")


summary = {
    "Dataset": "Single_Dataset",
    "Date_From (invoice_date)": shortage_df["invoice_date"].min(),
    "Date_To (invoice_date)": shortage_df["invoice_date"].max(),
    "Total_Unique_Invoice": shortage_df["INVOICE_NO"].nunique() if "INVOICE_NO" in shortage_df.columns else 0,

}

# --- Convert to DataFrame ---
summary_table = pd.DataFrame([summary])

# --- Print ---
print("\n==================== SHORTAGE DATA SUMMARY TABLE ====================")
print(summary_table)
print("=======================================================\n")



# =====================================================
# DATE RANGE of DATA
# =====================================================
alerts["SCHEDULED_DATETIME"] = pd.to_datetime(alerts["SCHEDULED_DATETIME"], errors='coerce')
completed_Trips_df["SCHEDULED_TRIP_START_DATETIME"] = pd.to_datetime(
    completed_Trips_df["SCHEDULED_TRIP_START_DATETIME"], errors='coerce'
)

min_dt_alerts = alerts["EVENT_DATETIME"].min()
max_dt_alerts = alerts["EVENT_DATETIME"].max()


min_dt_ct = completed_Trips_df["SCHEDULED_TRIP_START_DATETIME"].min()
max_dt_ct = completed_Trips_df["SCHEDULED_TRIP_START_DATETIME"].max()


print(f"alerts date range:{min_dt_alerts} to {max_dt_alerts}")
print(f"completed trips date range: {min_dt_ct} to {max_dt_ct}")




# =========================================================
# VSS SCORE
# =========================================================
# ---------------------------------------------------------
# Filter 1 day data
# ---------------------------------------------------------
alerts["SCHEDULED_DATETIME"] = pd.to_datetime(alerts["SCHEDULED_DATETIME"], errors='coerce')
completed_Trips_df["SCHEDULED_TRIP_START_DATETIME"] = pd.to_datetime(completed_Trips_df["SCHEDULED_TRIP_START_DATETIME"], errors='coerce')
shortage_df["invoice_date"] = pd.to_datetime(shortage_df["invoice_date"], format="%Y%m%d")


trips_max_time = completed_Trips_df["SCHEDULED_TRIP_START_DATETIME"].max()
trips_cutoff = trips_max_time - pd.Timedelta(hours=24)

max_date_shortage = shortage_df["invoice_date"].max()
threshold = max_date_shortage - timedelta(hours=24)


#trips_cutoff = pd.to_datetime("2025-11-02 13:47:36")
#trips_max_time = pd.to_datetime("2025-11-03 13:47:36")


completed_Trips_1day = completed_Trips_df[
    (completed_Trips_df["SCHEDULED_TRIP_START_DATETIME"] >= trips_cutoff) &
    (completed_Trips_df["SCHEDULED_TRIP_START_DATETIME"] <= trips_max_time)
]

alerts_1day = alerts[
    (alerts["EVENT_DATETIME"] >= trips_cutoff) &
    (alerts["EVENT_DATETIME"] <= trips_max_time)
]



# Apply end-of-day time so date works with 24-hour cutoff
shortage_df["invoice_date"] = shortage_df["invoice_date"] + pd.Timedelta(hours=23, minutes=59)

shortage_1day = shortage_df[
    (shortage_df["invoice_date"] >= trips_cutoff) &
    (shortage_df["invoice_date"] <= trips_max_time)
]


# =========================================================
# Extract Trip Summary
# =========================================================
def extract_trip_summary_from_df(completed_Trips_df):

    if completed_Trips_df.empty:
        raise ValueError(". Completed trips dataframe is empty!")

    trips_summary = (
        completed_Trips_df
        .groupby("LOCATION")["INVOICE_NO"]
        .nunique()
        .reset_index()
        .rename(columns={"INVOICE_NO": "TOTAL_TRIPS"})
    )

    return trips_summary


trips_summary_1day = extract_trip_summary_from_df(completed_Trips_1day)
trips_summary = extract_trip_summary_from_df(completed_Trips_df)
# =========================================================
# 2️⃣ Extract Alert Summary (Pivot)
# =========================================================
def extract_alert_summary(merged_alerts_df):


    if merged_alerts_df.empty:
        raise ValueError(". Alerts dataframe is empty!")

    # Filter TAS only
    df = merged_alerts_df[merged_alerts_df["LOCATION_TYPE"].isin(["TAS", "LPG"])]

    # Create pivot table
    pivot_df = (
        df.pivot_table(
            index="LOCATION",
            columns="ALERT_TYPE",
            values="INVOICE_NO",       # we count occurrences
            aggfunc="count",
            fill_value=0
        )
        .reset_index()
    )

    # Remove pivot column name
    pivot_df.columns.name = None
    print(pivot_df.columns)

    return pivot_df


alert_summary_1day = extract_alert_summary(alerts_1day)
alert_summary = extract_alert_summary(alerts)
# =========================================================
# 3️⃣ Calculate Alert Ratios
# =========================================================
def calculate_alert_ratio(trips_summary, alert_summary):

    if trips_summary.empty:
        raise ValueError(". trips_summary_df is empty!")

    if alert_summary.empty:
        raise ValueError(". alert_pivot_df is empty!")

    # Supported alert columns
    alert_cols = ["RD", "ST", "DR", "PD", "CO", "CD", "HA", "HT", "HB", "ND", "SV"]

    # Merge alerts with trips
    merged = alert_summary.merge(trips_summary, on="LOCATION", how="right")

    # Missing alert types → make zero
    for col in alert_cols:
        if col not in merged.columns:
            merged[col] = 0

    # Compute ratio = count / total trips
    for col in alert_cols:
        merged[col + "_RATIO"] = merged.apply(
            lambda x: (
                x[col] / x["TOTAL_TRIPS"]
                if pd.notna(x["TOTAL_TRIPS"]) and x["TOTAL_TRIPS"] > 0
                else 0
            ),
            axis=1
        )

    merged["TOTAL_ALERTS"] = merged[alert_cols].sum(axis=1)

    return merged


alert_ratio_1day = calculate_alert_ratio(trips_summary_1day, alert_summary_1day)
alert_ratio = calculate_alert_ratio(trips_summary, alert_summary)
# =========================================================
# Compute Category Scores + VSS
# =========================================================
def compute_vss_score(alert_ratio):

    # ---------------------------------------------------------
    # Category Mapping (inside function)
    # ---------------------------------------------------------
    category_mapping = [
        {"Category": "Route",            "Files": ["RD", "ST"],
         "Weight": 0.35}, #0.25

        {"Category": "Device Integrity", "Files": ["PD", "DR"],
         "Weight": 0.45}, #0.30

        {"Category": "Safety",           "Files": ["SV", "HA", "HB", "HT", "CD", "PANIC"],
         "Weight": 0.20}, #0.10

        {"Category": "Governance",       "Files": ["Manual_Unblock", "Trip_Not_Closed"],
         "Weight": 0.00}, #0.15

        {"Category": "EM Lock Events",   "Files": ["EMLock"],
         "Weight": 0.00} #0.20
    ]

    # ---------------------------------------------------------
    # Start Processing
    # ---------------------------------------------------------
    df = alert_ratio.copy()

    for cat in category_mapping:
        category = cat["Category"]
        files = cat["Files"]

        print(f"\n📌 Processing Category: {category}")

        ratio_cols = [f"{a}_RATIO" for a in files]
        available = [c for c in ratio_cols if c in df.columns]

        # Identify missing alert types
        for col in ratio_cols:
            if col not in df.columns:
                print(f"Missing alert ratio → {col.replace('_RATIO','')}")

        # If no ratios exist
        if not available:
            print(f"   . No alert_ratios found for {category}")
            df[category] = 0
            continue

        # Compute average ratio for the category
        df[category] = df[available].mean(axis=1)

        print(f"   ✔️ Computed category score → {category}")

    # ---------------------------------------------------------
    # Compute VSS
    # ---------------------------------------------------------
    print("\n Computing VSS...")

    df["VSS"] = 0
    for cat in category_mapping:
        category = cat["Category"]
        weight = cat["Weight"]
        df["VSS"] += df[category] * weight



    #df["VSS_score"] = (
    #    100 / (1 + np.exp(-10 * (df["VSS"] - 0.10)))
    #)
    df["VSS_score"] = df["VSS"].rank(pct=True) * 100
    df["VSS_score"] = df["VSS_score"].round(2)



    print(". VSS calculation completed.")

    return df

VSS_score_1day = compute_vss_score(alert_ratio_1day)
VSS_score = compute_vss_score(alert_ratio)

# ==================================================
#   Alerts_Sensitivity CALCULATION
# ==================================================

INFLUENCE_RADIUS = 500

def compute_total_location_sensitivity_fast(
    event_data,
    cluster_weights_per_alert,
    alert_type_weights,
    radius_m,
):
    R = 6371000.0  # Earth radius (m)
    total_scores = np.zeros(len(event_data), dtype=np.float32)

    # Convert realtime coordinates to radians once
    realtime_coords = np.radians(event_data[["LAT", "LON"]].values.astype(np.float32))

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

    event_data["alert_sensitivity_value"] = total_scores


    event_data["alert_sensitivity"] = event_data["alert_sensitivity_value"].rank(pct=True) * 100
    event_data["alert_sensitivity"] = event_data["alert_sensitivity"]


    alerts_Sensitivity = event_data.groupby('LOCATION')['alert_sensitivity'].mean()
    alerts_Sensitivity = alerts_Sensitivity.reset_index()
    alerts_Sensitivity.columns = ["LOCATION", "alert_sensitivity"]
    alerts_Sensitivity["alert_sensitivity"] = alerts_Sensitivity["alert_sensitivity"].round(2)



    return alerts_Sensitivity


# Define alert type weights
alert_type_weights = {
    "DR": 0.4,
    "RD": 0.3,
    "PD": 0.2,
    "ST": 0.1
}


alert_data_1day=alerts_1day[alerts_1day["ALERT_TYPE"].isin(["RD", "ST", "PD", "DR"])]
alert_data=alerts[alerts["ALERT_TYPE"].isin(["RD", "ST", "PD", "DR"])]

with open("cluster_weights.json", "r") as f:
    cluster_weights_per_alert = json.load(f)

# Compute location sensitivity
alert_data_sen_1day = compute_total_location_sensitivity_fast(
    alert_data_1day,
    cluster_weights_per_alert,
    alert_type_weights,
    radius_m=INFLUENCE_RADIUS
)

# Compute location sensitivity
alert_data_sen = compute_total_location_sensitivity_fast(
    alert_data,
    cluster_weights_per_alert,
    alert_type_weights,
    radius_m=INFLUENCE_RADIUS
)


print(". alert sensitivity computed successfully.")



#-----------------------------------------------------
#### Shortage
#-----------------------------------------------------
allowable_threshold = 50
def compute_shortage_score(shortage_df, trips_summary, allowable_threshold):

    # Apply allowable threshold
    shortage_df["allowable_variation"] = allowable_threshold
    
    shortage_df["QTY_SHORTAGE(L)"]=pd.to_numeric(shortage_df["QTY_SHORTAGE(L)"],errors='coerce').fillna(0)

    # Shortage flag
    shortage_df["SHORTAGE_FLAG"] = shortage_df["QTY_SHORTAGE(L)"] > shortage_df["allowable_variation"]

    # ---------------------------------------------------------
    # TT-wise aggregation per LOCATION
    # ---------------------------------------------------------
    shortage_agg_loc = (
        shortage_df.groupby("LOCATION")
        .agg(
            shortage_trips=("SHORTAGE_FLAG", "sum"),
            Avg_shortage_L=("QTY_SHORTAGE(L)", "mean")
        )
        .reset_index()
    )

    # Merge
    loc_shortage = trips_summary.merge(shortage_agg_loc, on="LOCATION", how="left")
    loc_shortage[["shortage_trips", "Avg_shortage_L"]] = loc_shortage[["shortage_trips", "Avg_shortage_L"]].fillna(0)

    # ---------------------------------------------------------
    # FREQUENCY SCORE
    # ---------------------------------------------------------
    loc_shortage["shortage_rate"] = loc_shortage["shortage_trips"] / loc_shortage["TOTAL_TRIPS"]

    # Smooth sigmoid (your original)
    loc_shortage["freq_score"] = 100 / (1 + np.exp(-10 * (loc_shortage["shortage_rate"] - 0.10)))


    # ---------------------------------------------------------
    # SEVERITY SCORE – Improved + Original
    # ---------------------------------------------------------

    # Original median/IQR method (kept)
    median = loc_shortage["Avg_shortage_L"].median()
    iqr = loc_shortage["Avg_shortage_L"].quantile(0.75) - loc_shortage["Avg_shortage_L"].quantile(0.25)
    iqr = max(iqr, 1)

    z = (loc_shortage["Avg_shortage_L"] - median) / iqr
    original_sev = 100 / (1 + np.exp(-z))

    # Improved stable severity (prevents extreme jumps)
    stable_sev = np.clip((loc_shortage["Avg_shortage_L"] / 150) * 100, 0, 100)

    # Combine both severity scores  (50%–50%)
    loc_shortage["sev_score"] = (original_sev * 0.5) + (stable_sev * 0.5)



    # ---------------------------------------------------------
    # FINAL SHORTAGE SCORE (Frequency + Severity)
    # ---------------------------------------------------------
    loc_shortage["Shortage_score"] = (
        0.4 * loc_shortage["freq_score"] +
        0.6 * loc_shortage["sev_score"]
    ).round(2)

      # No shortage → severity = 0
    loc_shortage.loc[loc_shortage["shortage_trips"] == 0, "Shortage_score"] = 0

    return loc_shortage


shortage_score_1day=compute_shortage_score(shortage_1day, trips_summary_1day, allowable_threshold)
shortage_score=compute_shortage_score(shortage_df, trips_summary, allowable_threshold)


def calculate_location_risk_score(VSS_score, alerts_Sensitivity_df, shortage_score, master_df, app_db_engine):


    print("🔹 Merging all component scores...")

    VSS_score["LOCATION"] = VSS_score["LOCATION"].astype(str).str.strip()
    alerts_Sensitivity_df["LOCATION"] = alerts_Sensitivity_df["LOCATION"].astype(str).str.strip()
    shortage_score["LOCATION"] = shortage_score["LOCATION"].astype(str).str.strip()
    master_df["LOCATION_CODE"] = master_df["LOCATION_CODE"].astype(str).str.strip()


    #VSS_score = VSS_score.rename(columns={"TOTAL_TRIPS": "TOTAL_TRIPS_1day"})
    #shortage_score = shortage_score.rename(columns={"TOTAL_TRIPS": "TOTAL_TRIPS_Overall"})



    # -------------------------------------------------------
    # 1️⃣ Merge VSS + Shortage scores
    # -------------------------------------------------------
    merged_df = VSS_score.merge(alerts_Sensitivity_df, on="LOCATION", how="left")
    merged_df = merged_df.merge(shortage_score, on="LOCATION", how="left")

    merged_df = merged_df.drop(columns=["TOTAL_TRIPS_y"]).rename(columns={"TOTAL_TRIPS_x": "TOTAL_TRIPS"})

    # -------------------------------------------------------
    # 2️⃣ Final LRS Score (weights unchanged)
    # -------------------------------------------------------
    print("🔹 Calculating final Location Risk Score (LRS)...")
    merged_df["LRS"] = (
        0.5 * merged_df["VSS_score"] +
        0.3 * merged_df["alert_sensitivity"]+
        0.2 * merged_df["Shortage_score"]
    )

    merged_df["LRS_INVERTED"] = 100 - merged_df["LRS"]
    merged_df["LRS_INVERTED"] = merged_df["LRS_INVERTED"].round(2)

    # -------------------------------------------------------
    # 3️⃣ Prepare Clean Final Output Table and Add LOCATION_NAME
    # -------------------------------------------------------
    # First try to get location name from vts_truck_master
    location_map = dict(zip(master_df["LOCATION_CODE"], master_df["LOCATION_NAME"]))
    merged_df["LOCATION_NAME"] = merged_df["LOCATION"].map(location_map)
    
    # For missing location names, fetch from location_master table
    missing_locations = merged_df[merged_df["LOCATION_NAME"].isna()]["LOCATION"].unique().tolist()
    if missing_locations:
        print(f"Fetching {len(missing_locations)} missing location names from location_master...")
        location_master_df = pd.read_sql_query("SELECT sap_id, name FROM location_master", app_db_engine)
        location_master_df["sap_id"] = location_master_df["sap_id"].astype(str).str.strip()
        location_master_map = dict(zip(location_master_df["sap_id"], location_master_df["name"]))
        
        # Fill missing location names from location_master
        merged_df["LOCATION_NAME"] = merged_df.apply(
            lambda row: row["LOCATION_NAME"] if pd.notna(row["LOCATION_NAME"]) else location_master_map.get(row["LOCATION"]),
            axis=1
        )


    Final_LRS = merged_df[
        ["LOCATION", "LOCATION_NAME", "TOTAL_TRIPS", 'TOTAL_ALERTS', 'shortage_trips', "VSS_score", "alert_sensitivity", "Shortage_score", "LRS", "LRS_INVERTED"
        ]
    ]

    return Final_LRS
Final_LRS_1day=calculate_location_risk_score(VSS_score_1day, alert_data_sen_1day, shortage_score_1day, master_df, app_db_engine)
Final_LRS=calculate_location_risk_score(VSS_score, alert_data_sen, shortage_score, master_df, app_db_engine)



# Final_LRS.to_csv("/content/drive/MyDrive/Location_Risk_Score/Output_Files/Location_Risk_Score.csv", index=False)

print(". Location Risk Score computed successfully.")

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

L_R_TABLE = "location_risk_score_master"
l_r_df = Final_LRS.copy()
l_r_df.columns = l_r_df.columns.str.lower()  # Convert to lowercase
l_r_pk = [col.lower() for col in ["location"]]  # Lowercase PK columns

l_r_dtypes = pandas_to_pg_dtypes(l_r_df)
l_r_df.to_sql(
    name=L_R_TABLE,
    con=app_db_engine,
    schema='public',
    if_exists='replace',
    index=False,
    dtype=l_r_dtypes
)


print(f"\n. Location Risk Score saved to public.{L_R_TABLE} ({len(l_r_df)} rows)")

