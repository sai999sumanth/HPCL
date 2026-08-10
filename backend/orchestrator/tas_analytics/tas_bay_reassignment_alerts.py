import asyncio
import urdhva_base
import polars as pl
from datetime import datetime, timedelta
# import orchestrator.alerting.alert_factory as alert_factory
from orchestrator.alerting import alert_factory
import hpcl_ceg_model
from hpcl_ceg_model import Alerts


# ==========================================================
# CONFIG
# ==========================================================
DAILY_BAY_INTERLOCK = "Two or More Specific Bays Reassignment"
WEEKLY_TT_INTERLOCK = "Two or More Specific TT Reassignment in One Week"
WEEK_DAYS = 7
BU_VALUE = "TAS"


# ==========================================================
# DATE HELPERS (UTC)
# ==========================================================
def utc_today():
    return datetime.utcnow().date()


def last_7_days_date():
    return utc_today() - timedelta(days=WEEK_DAYS - 1)


# ==========================================================
# FETCH HOST BAY REASSIGNMENT (LAST 7 DAYS ONLY)
# ==========================================================
async def fetch_reassignment_data():
    query = (
        f"reassigned_bay IS NOT NULL "
        f"AND date BETWEEN '{last_7_days_date()}' AND '{utc_today()}'"
    )

    print("\n[FETCH] Query:", query)

    params = urdhva_base.queryparams.QueryParams(q=query, limit=0)
    params.fields = [
        "sap_id",
        "truck_number",
        "reassigned_bay",
        "location_name",
        "zone",
        "date"
    ]

    resp = await hpcl_ceg_model.HostBayReAssignment.get_all(params, resp_type="plain")
    data = resp.get("data", [])

    print(f"[FETCH] Records fetched: {len(data)}")
    if data:
        print("[FETCH] Sample:", data[0])

    return data


# ==========================================================
# FETCH EXISTING ALERTS
# ==========================================================
async def fetch_existing_alerts(interlock_name, from_date):

    query = (
        f"interlock_name = '{interlock_name}' "
        f"AND (created_at AT TIME ZONE 'UTC')::date >= '{from_date}'"
    )

    print(f"\n[DEDUP] Fetching alerts for {interlock_name}")
    print("[DEDUP] Query:", query)

    params = urdhva_base.queryparams.QueryParams(q=query, limit=0)
    resp = await hpcl_ceg_model.Alerts.get_all(params, resp_type="plain")
    alerts = resp.get("data", [])

    print(f"[DEDUP] Existing alerts: {len(alerts)}")
    return alerts


# ==========================================================
# APPEND SKIP HISTORY
# ==========================================================
async def append_skip_history(alert, reason):

    if "id" not in alert:
        return

    history = alert.get("alert_history") or []
    history.append({
        "action_type": "Message",
        "action_msg": reason
    })

    await Alerts(
        id=alert["id"],
        alert_history=history
    ).modify()


# ==========================================================
# MAIN ALERT JOB
# ==========================================================
async def host_bay_reassignment_alert_job():

    print("\n================ ALERT JOB STARTED ================")

    records = await fetch_reassignment_data()
    if not records:
        print("[EXIT] No reassignment data")
        return

    df = pl.from_dicts(records, strict=False)
    print("[DF] Shape:", df.shape)

    # ======================================================
    # CONDITION 1 – DAILY BAY ALERT
    # One alert per (location, bay) per day
    # ======================================================
    print("\n[COND-1] DAILY BAY CHECK")

    daily_df = (
        df.group_by(
            ["location_name", "reassigned_bay", "date", "sap_id", "zone"]
        )
        .agg(pl.count().alias("cnt"))
        .filter(pl.col("cnt") > 2)
    )

    print("[COND-1] Rows > threshold:", daily_df.height)

    existing_daily_alerts = await fetch_existing_alerts(
        DAILY_BAY_INTERLOCK,
        last_7_days_date()
    )

    # DB-level dedup
    daily_alert_map = {
        (
            a.get("location_name"),
            a.get("device_name"),
            a.get("sap_id"),
            a.get("created_at").date()
        ): a
        for a in existing_daily_alerts
    }

    processed_today = set()

    for row in daily_df.to_dicts():

        key = (
            row["location_name"],
            row["reassigned_bay"],
            row["sap_id"],
            utc_today()
        )

        print("[COND-1] Processing:", key)

        # DB dedup
        if key in daily_alert_map:
            print("[COND-1] SKIP (already exists in DB)")
            await append_skip_history(
                daily_alert_map[key],
                "Skipped: Bay reassigned more than twice again"
            )
            continue

        # Runtime dedup ( CRITICAL )
        if key in processed_today:
            print("[COND-1] SKIP (already created in this run)")
            continue

        alert_data = {
            "bu": BU_VALUE,
            "sap_id": row["sap_id"],
            "location_name": row["location_name"],
            "zone": row["zone"],
            "device_name": row["reassigned_bay"],
            "interlock_name": DAILY_BAY_INTERLOCK,
            "severity": "Medium",
            "alert_category": "TAS",
            "alert_section": "TAS",
            "message": "Specific bay reassigned more than two times in last 7 days",
            "alert_message": "Specific bay reassigned more than two times in last 7 days",
            "alert_history": [{
                "action_type": "Created",
                "action_msg": "Bay reassigned more than twice in last 7 days"
            }]
        }

        try:
            print("👉 Creating DAILY alert for:", key)

            await alert_factory.AlertFactory.create_alert(alert_data)

            processed_today.add(key)

            print("[COND-1]  ALERT CREATED")

        except Exception as e:
            print(" DAILY alert error:", e)

    # ======================================================
    # CONDITION 2 – WEEKLY TT ALERT
    # One alert per (vehicle, bay) per 7 days
    # ======================================================
    print("\n[COND-2] WEEKLY TT CHECK")

    weekly_df = (
        df.group_by(
            ["truck_number", "reassigned_bay", "sap_id", "zone"]
        )
        .agg(pl.count().alias("cnt"))
        .filter(pl.col("cnt") > 2)
    )

    print("[COND-2] Rows > threshold:", weekly_df.height)

    existing_weekly_alerts = await fetch_existing_alerts(
        WEEKLY_TT_INTERLOCK,
        last_7_days_date()
    )

    weekly_alert_map = {
        (a.get("vehicle_number"), a.get("device_name")): a
        for a in existing_weekly_alerts
    }

    processed_weekly = set()

    for row in weekly_df.to_dicts():

        key = (row["truck_number"], row["reassigned_bay"])
        print("[COND-2] Processing:", key)

        if key in weekly_alert_map:
            print("[COND-2] SKIP (exists in DB)")
            await append_skip_history(
                weekly_alert_map[key],
                "Skipped: TT reassigned more than twice again"
            )
            continue

        if key in processed_weekly:
            print("[COND-2] SKIP (already created in this run)")
            continue

        alert_data = {
            "bu": BU_VALUE,
            "sap_id": row["sap_id"],
            "zone": row["zone"],
            "device_name": row["reassigned_bay"],
            "vehicle_number": row["truck_number"],  # IMPORTANT
            "interlock_name": WEEKLY_TT_INTERLOCK,
            "severity": "Medium",
            "alert_category": "TAS",
            "alert_section": "TAS",
            "message": "Specific TT reassigned more than two times in last 7 days",
            "alert_message": "Specific TT reassigned more than two times in last 7 days",
            "alert_history": [{
                "action_type": "Created",
                "action_msg": "TT reassigned more than twice in last 7 days"
            }]
        }

        try:
            print(" Creating WEEKLY alert for:", key)

            await alert_factory.AlertFactory.create_alert(alert_data)

            processed_weekly.add(key)

            print("[COND-2]  ALERT CREATED")

        except Exception as e:
            print(" WEEKLY alert error:", e)
            continue

    print("\n================ ALERT JOB COMPLETED ================")


# ==========================================================
# ENTRY POINT
# ==========================================================
if __name__ == "__main__":
    asyncio.run(host_bay_reassignment_alert_job())
