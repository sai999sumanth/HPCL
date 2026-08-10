import sys
sys.path.append("/opt/ceg/algo")

import asyncio
import urdhva_base
import polars as pl
from orchestrator.alerting import alert_factory
import hpcl_ceg_model
import json


def sanitize_alert_data(alert_data):
    for key in ["region", "district", "terminal_plant_id", "terminal_plant_name", 
                "sales_area", "category"]:
        if not alert_data.get(key):
            alert_data[key] = None
    return alert_data


# ============================================
# Fetch TODAY Sick TT
# ============================================
async def fetch_sick_tt():

    query = (
        "(created_date AT TIME ZONE 'Asia/Kolkata')::date = "
        "(NOW() AT TIME ZONE 'Asia/Kolkata')::date"
    )

    fields = json.dumps([
        "sap_id",
        "truck_number",
        "load_number",
        "created_date",
        "location_name",
        "zone"
    ])

    params = urdhva_base.queryparams.QueryParams(q=query, limit=0, fields=fields)

    resp = await hpcl_ceg_model.HostSickTts.get_all(
        params,
        resp_type="plain"
    )

    return resp.get("data", [])


# ============================================
# Fetch existing alerts for today
# ============================================
async def fetch_existing_alerts():

    query = (
        "interlock_name = 'sicktt_alert_tt_count' "
        "AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = "
        "(NOW() AT TIME ZONE 'Asia/Kolkata')::date"
    )

    params = urdhva_base.queryparams.QueryParams(q=query, limit=0)

    resp = await hpcl_ceg_model.Alerts.get_all(params, resp_type="plain")

    return resp.get("data", [])


async def append_skip_history(existing_alert):

    history = existing_alert.get("alert_history") or []

    history.append({
        "action_type": "Message",
        "action_msg": "Skipped: Sick TT already alerted for this location today"
    })

    await hpcl_ceg_model.Alerts(
        id=existing_alert["id"],
        alert_history=history
    ).modify()


# ============================================
# MAIN JOB
# ============================================
async def process_sick_tt_alert():

    print("=== SICK TT ALERT JOB STARTED ===")

    records = await fetch_sick_tt()

    if not records:
        print("No Sick TT data today")
        return

    df = pl.DataFrame(records)

    df = df.drop_nulls(["sap_id", "truck_number", "load_number"])

    df = df.with_columns(
        pl.col("sap_id")
        .str.replace_all("\x00", "")
        .str.strip_chars()
    )

    # DISTINCT truck + load count per location
    distinct_df = (
        df.select(["sap_id", "truck_number", "load_number"])
        .unique()
        .group_by("sap_id")
        .agg(pl.count().alias("cnt"))
    )

    print("THRESHOLD MATCHED LOCATIONS")
    print(distinct_df)

    if distinct_df.is_empty():
        print("No location has exactly one Sick TT today")
        return

    existing_alerts = await fetch_existing_alerts()
    existing_map = {a["sap_id"]: a for a in existing_alerts}

    for row in distinct_df.to_dicts():

        sap_id = row["sap_id"]

        if sap_id in existing_map:
            print("SKIPPED alert already exists:", sap_id)
            await append_skip_history(existing_map[sap_id])
            continue

        base = df.filter(pl.col("sap_id") == sap_id).row(0, named=True)

        alert_data = {
            "bu": "TAS",
            "sap_id": sap_id,
            "location_name": base.get("location_name"),
            "zone": base.get("zone"),
            "interlock_name": "sicktt_alert_tt_count",
            "severity": "Medium",
            "alert_category": "TAS",
            "alert_section": "TAS",
            "message": "Exactly one Sick TT reported in this location today",
            "alert_message": "Exactly one Sick TT reported in this location today",
            "device_name": "",
            "alert_history": [
                {
                    "action_type": "Created",
                    "action_msg": "Single Sick TT detected for this location"
                }
            ]
        }

        print("CREATING ALERT:", alert_data)

        await alert_factory.AlertFactory.create_alert(
            sanitize_alert_data(alert_data)
        )


if __name__ == "__main__":
    asyncio.run(process_sick_tt_alert())