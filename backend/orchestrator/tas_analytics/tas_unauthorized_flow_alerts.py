import asyncio
import json
import urdhva_base
import polars as pl
from datetime import datetime, timedelta
import orchestrator.alerting.alert_factory as alert_factory
import hpcl_ceg_model 


# ==========================================================
# CONFIG
# ==========================================================
RAW_INTERLOCK_NAME = "Unauthorized Flow Alarm_BCU"
WEEKLY_INTERLOCK_NAME = "Morethan 2 Unauthorized_flow a week"
WEEK_DAYS = 7   


# ==========================================================
# SANITIZE ALERT PAYLOAD (MANDATORY NULL FIELDS)
# ==========================================================
def sanitize_alert_data(alert_data):
    # These fields MUST exist but be NULL
    alert_data["region"] = None
    alert_data["district"] = None
    alert_data["terminal_plant_id"] = None
    alert_data["terminal_plant_name"] = None
    alert_data["sales_area"] = None
    alert_data["category"] = None
    return alert_data



# ==========================================================
# DATE HELPERS (UTC)
# ==========================================================
def utc_today():
    return datetime.utcnow().date()


def last_n_days_date():
    return utc_today() - timedelta(days=WEEK_DAYS - 1)


# ==========================================================
# FETCH RAW UNAUTHORIZED FLOW ALERTS (LAST N DAYS)
# ==========================================================
async def fetch_raw_unauthorized_flow(location_name=None):

    query = (
        f"interlock_name = '{RAW_INTERLOCK_NAME}' "
        f"AND (created_at AT TIME ZONE 'UTC')::date BETWEEN "
        f"'{last_n_days_date()}' AND '{utc_today()}'"
    )

    if location_name:
        query += f" AND location_name = '{location_name}'"

    print("\n RAW DATA QUERY >>>")
    print(query)

    fields = json.dumps([
        "sap_id",
        "location_name",
        "zone",
        "device_name",
        "created_at",
        "bu"
    ])

    params = urdhva_base.queryparams.QueryParams(
        q=query,
        limit=0,
        fields=fields
    )

    resp = await hpcl_ceg_model.Alerts.get_all(params, resp_type="plain")
    data = resp.get("data", [])

    print(f" Raw unauthorized flow records fetched: {len(data)}")
    return data


# ==========================================================
# FETCH EXISTING WEEKLY ALERTS
# ==========================================================
async def fetch_existing_weekly_alerts():

    query = (
        f"interlock_name = '{WEEKLY_INTERLOCK_NAME}' "
        f"AND (created_at AT TIME ZONE 'UTC')::date >= '{last_n_days_date()}'"
    )

    print("\n EXISTING WEEKLY ALERT QUERY >>>")
    print(query)

    params = urdhva_base.queryparams.QueryParams(q=query, limit=0)
    resp = await hpcl_ceg_model.Alerts.get_all(params, resp_type="plain")

    existing = resp.get("data", [])
    print(f"Existing weekly alerts found: {len(existing)}")

    return existing


# ==========================================================
# APPEND SKIP HISTORY (REFERENCE LOGIC)
# ==========================================================
async def append_skip_history(existing_alert, reason):

    history = existing_alert.get("alert_history") or []

    history.append({
        "action_type": "Message",
        "action_msg": reason
    })

    await Alerts(
        id=existing_alert["id"],
        alert_history=history
    ).modify()


# ==========================================================
# MAIN WEEKLY ALERT PROCESS
# ==========================================================
async def process_weekly_unauthorized_flow_alerts(location_name=None):

    print("\n==============================================")
    print("WEEKLY UNAUTHORIZED FLOW ALERT JOB STARTED")
    print("==============================================")

    raw_records = await fetch_raw_unauthorized_flow(location_name)

    if not raw_records:
        print("No Unauthorized Flow alarms in window")
        return

    df = pl.DataFrame(raw_records)
    print("\n RAW DATAFRAME SHAPE:", df.shape)

    # ======================================================
    # DEVICE LEVEL WEEKLY COUNT
    # ======================================================
    weekly_device_df = (
        df.group_by(["sap_id", "device_name", "location_name", "zone", "bu"])
          .agg(pl.count().alias("cnt"))
          .filter(pl.col("cnt") > 2)   # 🔒 PRODUCTION RULE
          
    )

    print("\n DEVICES CROSSING WEEKLY THRESHOLD:")
    print(weekly_device_df)

    if weekly_device_df.is_empty():
        print(" No devices crossed weekly threshold")
        return

    # ======================================================
    # EXISTING ALERT MAP (KEY = sap_id + device_name)
    # ======================================================
    existing_alerts = await fetch_existing_weekly_alerts()

    existing_map = {
        (a.get("sap_id"), a.get("device_name")): a
        for a in existing_alerts
    }

    # ======================================================
    # CREATE / SKIP LOGIC (REFERENCE MATCH)
    # ======================================================
    for row in weekly_device_df.to_dicts():

        key = (row["sap_id"], row["device_name"])

        # ---------- SKIP + HISTORY UPDATE ----------
        if key in existing_map:
            print("⏭️ SKIPPED (already exists this week):", key)

            await append_skip_history(
                existing_map[key],
                "Skipped: Unauthorized Flow crossed threshold again in same week"
            )
            continue

        # ---------- CREATE NEW ALERT ----------
        alert_data = {
            "bu": row["bu"],
            "sap_id": row["sap_id"],
            "location_name": row["location_name"],
            "zone": row["zone"],
            "device_name": row["device_name"],
            "interlock_name": WEEKLY_INTERLOCK_NAME,
            "severity": "Medium",
            "alert_category": "TAS",
            "alert_section": "TAS",
            "message": "Unauthorized Flow alarm occurred more than 2 times in last one week",
            "alert_message": "Unauthorized Flow alarm occurred more than 2 times in last one week",
            "alert_history": [
                {
                    "action_type": "Created",
                    "action_msg": "Unauthorized Flow > 2 times in one week"
                }
            ]
        }

        print("\n CREATING WEEKLY UNAUTHORIZED FLOW ALERT >>>")
        print(alert_data)

        await alert_factory.AlertFactory.create_alert(
            sanitize_alert_data(alert_data)
        )

    print("\n==============================================")
    print("WEEKLY UNAUTHORIZED FLOW ALERT JOB COMPLETED")
    print("==============================================")


# ==========================================================
# ENTRY POINT
# ==========================================================
if __name__ == "__main__":
    asyncio.run(
        process_weekly_unauthorized_flow_alerts()
    )

