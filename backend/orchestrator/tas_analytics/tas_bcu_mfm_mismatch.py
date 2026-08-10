import asyncio
import json
import urdhva_base
import polars as pl
from orchestrator.alerting import alert_factory
import hpcl_ceg_model 




# ===============================================
# Remove forbidden fields that crash Pydantic
# ===============================================
def sanitize_alert_data(alert_data):
    for key in ["region", "district", "terminal_plant_id", "terminal_plant_name", 
                "sales_area", "category"]:
        if not alert_data.get(key):
            alert_data[key] = None
    return alert_data

# ===============================================
# Fetch today's raw mismatches
# ===============================================
async def fetch_raw_bcu_mfm_alerts():
    query = (
        "interlock_name = 'BCU vs MFM totalizer mismatch alarm' "
        "AND (created_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date"
        )

    print("RAW QUERY =>", query)
    fields = json.dumps(["sap_id","interlock_name","created_at","device_name","bu"])

    params = urdhva_base.queryparams.QueryParams(q=query, limit=0, fields=fields)
    resp = await hpcl_ceg_model.Alerts.get_all(params, resp_type="plain")

    data = resp.get("data", [])


    return data


# ===============================================
# Fetch existing daily alerts (duplicate protection)
# ===============================================
async def fetch_existing_daily_alerts():
    query = (
        "interlock_name = 'Based_BCU vs MFM totalizer mismatch alarm' "
        "AND (created_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date"
        )

    params = urdhva_base.queryparams.QueryParams(q=query, limit=0)
    resp = await hpcl_ceg_model.Alerts.get_all(params, resp_type="plain")

    return resp.get("data", [])

# ===============================================
# Append SKIP entry to existing alert history
# ===============================================
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
# ===============================================
# MAIN PROCESS
# ===============================================
async def process_bcu_vs_mfm_alerts():

    print("\n=== Running BCU vs MFM Daily Alert Job ===\n")

    records = await fetch_raw_bcu_mfm_alerts()
    if not records:
        print("No raw mismatch alerts found for today")
        return

    df = pl.DataFrame(records)

    # Location > 20 (kept 5 for testing)
    location_df = (
        df.group_by("sap_id")
          .agg(pl.count().alias("cnt"))
          .filter(pl.col("cnt") > 20)
    )

    # Device > 5
    device_df = (
        df.group_by(["sap_id", "device_name"])
          .agg(pl.count().alias("cnt"))
          .filter(pl.col("cnt") > 5)
    )



    existing_alerts = await fetch_existing_daily_alerts()

    existing_map = {
        a["sap_id"]: a
        for a in existing_alerts
    }

    already_created = set(existing_map.keys())
    processed_today = set()

    # =========================================
    # LOCATION ALERTS
    # =========================================
    for row in location_df.to_dicts():
        sap_id = row["sap_id"]

        if sap_id in already_created:
            print("SKIPPED (already exists today):", sap_id)

            await append_skip_history(
                existing_map[sap_id],
                "Skipped: BCU vs MFM mismatch crossed threshold again today (location)"
            )

            processed_today.add(sap_id)
            continue

        processed_today.add(sap_id)

        bu = (
            df.filter(pl.col("sap_id") == sap_id)
              .select("bu")
              .to_series()[0]
        )

        alert_data = {
            "bu": bu,
            "sap_id": sap_id,
            "interlock_name": "Based_BCU vs MFM totalizer mismatch alarm",
            "severity": "Medium",
            "alert_category": "TAS",
            "alert_section": "TAS",
            "message": "BCU vs MFM mismatch occurred more than 20 times today",
            "alert_message": "BCU vs MFM mismatch occurred more than 20 times today",
            "device_name": "",
            "alert_history": [
                {"action_type": "Created", "action_msg": "BCU vs MFM mismatch > 20 times"}
            ]
        }

        print("CREATING LOCATION ALERT PAYLOAD", alert_data)
        await alert_factory.AlertFactory.create_alert(sanitize_alert_data(alert_data))


    # =========================================
    # DEVICE ALERTS
    # =========================================
    for row in device_df.to_dicts():
        sap_id = row["sap_id"]
        device_name = row["device_name"]

        if sap_id in processed_today:
            continue

        if sap_id in already_created:
            print("SKIPPED (already exists today):", sap_id)

            await append_skip_history(
                existing_map[sap_id],
                f"Skipped: Device {device_name} again crossed BCU vs MFM threshold today"
            )

            processed_today.add(sap_id)
            continue

        processed_today.add(sap_id)

        base = (
            df.filter(
                (pl.col("sap_id") == sap_id) &
                (pl.col("device_name") == device_name)
            ).row(0, named=True)
        )

        alert_data = {
            "bu": base.get("bu"),
            "sap_id": sap_id,
            "interlock_name": "Based_BCU vs MFM totalizer mismatch alarm",
            "severity": "Medium",
            "alert_category": "TAS",
            "alert_section": "TAS",
            "message": "BCU vs MFM mismatch occurred more than 5 times for same device today",
            "alert_message": "BCU vs MFM mismatch occurred more than 5 times for same device today",
            "device_name": device_name,
            "alert_history": [
                {"action_type": "Created", "action_msg": "BCU vs MFM mismatch > 5 times for same device"}
            ]
        }

        print("CREATING DEVICE ALERT PAYLOAD", alert_data)
        await alert_factory.AlertFactory.create_alert(sanitize_alert_data(alert_data))


# ===============================================
if __name__ == "__main__":
    asyncio.run(process_bcu_vs_mfm_alerts())
