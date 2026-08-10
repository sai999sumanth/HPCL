import asyncio
import urdhva_base
import polars as pl
from orchestrator.alerting import alert_factory
import hpcl_ceg_model
from datetime import datetime, timedelta
import json


# ============================================
# CLEAN ALERT DATA
# ============================================
def sanitize_alert_data(alert_data):
    for key in ["region", "district", "terminal_plant_id", "terminal_plant_name", 
                "sales_area", "category"]:
        if not alert_data.get(key):
            alert_data[key] = None
    return alert_data


# ============================================
# GET CURRENT CYCLE
# ============================================
def get_cycle_dates():

    today = datetime.now()
    day = today.day

    if day <= 7:
        start_day, end_day = 1, 7
    elif day <= 14:
        start_day, end_day = 8, 14
    elif day <= 21:
        start_day, end_day = 15, 21
    else:
        start_day = 22
        next_month = (today.replace(day=28) + timedelta(days=4)).replace(day=1)
        end_day = (next_month - timedelta(days=1)).day

    return today.replace(day=start_day).date(), today.replace(day=end_day).date()


# ============================================
# FETCH OVERLOAD DATA (UPDATED)
# ============================================
async def fetch_overload_data(start_date, end_date):

    query = (
        f"(date_time AT TIME ZONE 'Asia/Kolkata')::date "
        f"BETWEEN '{start_date}' AND '{end_date}'"
    )

    #  ADDED location_name, zone
    fields = json.dumps([
        "sap_id",
        "truck_number",
        "load_number",
        "date_time",
        "location_name",
        "zone"
    ])

    params = urdhva_base.queryparams.QueryParams(
        q=query,
        limit=0,
        fields=fields
    )

    resp = await hpcl_ceg_model.HostOverLoadedTts.get_all(
        params,
        resp_type="plain"
    )

    return resp.get("data", [])


# ============================================
# FETCH EXISTING ALERTS
# ============================================
async def fetch_existing_alerts(start_date):

    query = (
        f"interlock_name = 'frequent_overload_alert' "
        f"AND alert_message LIKE '%{start_date}%'"
    )

    params = urdhva_base.queryparams.QueryParams(q=query, limit=0)

    resp = await hpcl_ceg_model.Alerts.get_all(params, resp_type="plain")

    return resp.get("data", [])


# ============================================
# UPDATE SKIPPED ALERT
# ============================================
async def append_skip_history(existing_alert):

    history = existing_alert.get("alert_history") or []
    

    history.append({
        "action_type": "Message",
        "action_msg": "Skipped: Alert already created it already crossed the threshold count 5"
    })

    await hpcl_ceg_model.Alerts(
        id=existing_alert["id"],
        alert_history=history
    ).modify()


# ============================================
# MAIN JOB
# ============================================
async def process_overload_alert():

    print("\n=== OVERLOAD ALERT JOB STARTED ===")

    # STEP 1: Cycle
    start_date, end_date = get_cycle_dates()
    print(f"Cycle: {start_date} → {end_date}")

    # STEP 2: Fetch data
    records = await fetch_overload_data(start_date, end_date)

    if not records:
        print(" No overload data found")
        return

    print(f"Fetched Records: {len(records)}")

    # STEP 3: DataFrame
    df = pl.DataFrame(records)

    df = df.drop_nulls(["sap_id", "truck_number", "load_number"])

    df = df.with_columns(
        pl.col("sap_id")
        .cast(pl.Utf8)
        .str.replace_all("\x00", "")
        .str.strip_chars()
    )

    # STEP 4: DISTINCT COUNT
    distinct_df = (
        df.select(["sap_id", "truck_number", "load_number"])
        .unique()
        .group_by("sap_id")
        .agg(pl.count().alias("cnt"))
        .filter(pl.col("cnt") > 5)
    )

    if distinct_df.is_empty():
        print("No overload threshold matched")
        return

    print(" THRESHOLD MATCHED:")
    print(distinct_df)

    existing_alerts = await fetch_existing_alerts(start_date)
    existing_map = {str(a["sap_id"]): a for a in existing_alerts}

    # STEP 5: Process alerts
    for row in distinct_df.to_dicts():

        sap_id = row["sap_id"]
        cnt = row["cnt"]

        # DUPLICATE CHECK
        if sap_id in existing_map:
            print(f" SKIPPED (already exists): {sap_id}")
            await append_skip_history(existing_map[sap_id])
            continue

        # GET location info from SAME DF
        base = df.filter(pl.col("sap_id") == sap_id).row(0, named=True)

        alert_msg = (
            f"{cnt} overloads detected for SAP_ID {sap_id} "
            f"between {start_date} and {end_date} (threshold: 5)"
        )

        alert_data = {
            "bu": "TAS",
            "sap_id": sap_id,
            "location_name": base.get("location_name"),  
            "zone": base.get("zone"),                    
            "interlock_name": "frequent_overload_alert",
            "severity": "High",
            "alert_category": "TAS",
            "alert_section": "TAS",
            "message": alert_msg,
            "alert_message": alert_msg,
            "device_name": "",
            "alert_history": [
                {
                    "action_type": "Created",
                    "action_msg": f"Overload count ({cnt}) exceeded"
                }
            ]
        }

        print(f"CREATING ALERT for SAP_ID: {sap_id}")

        await alert_factory.AlertFactory.create_alert(
            sanitize_alert_data(alert_data)
        )

    print("=== JOB COMPLETED ===\n")


# ============================================
# RUN
# ============================================
if __name__ == "__main__":
    asyncio.run(process_overload_alert())