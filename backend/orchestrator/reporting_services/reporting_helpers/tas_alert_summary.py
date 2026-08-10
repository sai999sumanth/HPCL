import os
import sys
import jinja2
import asyncio
import aiohttp
from datetime import datetime, timedelta, timezone
from collections import defaultdict
import urdhva_base
import hpcl_ceg_model
import utilities.helpers as helpers
import orchestrator.notification_manager.notification_factory as notification_factory

IST = timezone(timedelta(hours=5, minutes=30))

# ── ThingsBoard Config ────────────────────────────────────────────────────────
THINGSBOARD_URL      = urdhva_base.settings.things_board_url
THINGSBOARD_USERNAME = urdhva_base.settings.things_board_username
THINGSBOARD_PASSWORD = urdhva_base.settings.things_board_password

TELEMETRY_KEY        = "Primary Gauge HIGH"
GAP_THRESHOLD_MIN    = 35
PAGE_SIZE            = 1000

EXCLUDED_LOCATIONS = {"mathura"}
TANK_DEVICE_EXCEPTIONS: dict[str, str] = {
    "secunderabad": "51-TT-",
}

# ── Database Helpers ──────────────────────────────────────────────────────────
async def fetch_tas_onboarded_alert_counts():
    query = """
        SELECT 
            lm.name AS location_name,
            lm.sap_id,
            COALESCE(SUM(CASE WHEN a.alert_status = 'Open' AND LOWER(a.severity) = 'critical' THEN 1 ELSE 0 END), 0) AS open_critical,
            COALESCE(SUM(CASE WHEN a.alert_status = 'Close' AND LOWER(a.severity) = 'critical' THEN 1 ELSE 0 END), 0) AS close_critical,
            COALESCE(SUM(CASE WHEN a.alert_status = 'Open' AND LOWER(a.severity) = 'high' THEN 1 ELSE 0 END), 0) AS open_high,
            COALESCE(SUM(CASE WHEN a.alert_status = 'Close' AND LOWER(a.severity) = 'high' THEN 1 ELSE 0 END), 0) AS close_high,
            COALESCE(SUM(CASE WHEN a.alert_status = 'Open' AND LOWER(a.severity) = 'medium' THEN 1 ELSE 0 END), 0) AS open_medium,
            COALESCE(SUM(CASE WHEN a.alert_status = 'Close' AND LOWER(a.severity) = 'medium' THEN 1 ELSE 0 END), 0) AS close_medium,
            COALESCE(SUM(CASE WHEN a.alert_status = 'Open' AND LOWER(a.severity) = 'low' THEN 1 ELSE 0 END), 0) AS open_low,
            COALESCE(SUM(CASE WHEN a.alert_status = 'Close' AND LOWER(a.severity) = 'low' THEN 1 ELSE 0 END), 0) AS close_low,
            COALESCE(SUM(CASE WHEN a.alert_status IN ('Open', 'Close') THEN 1 ELSE 0 END), 0) AS grand_total
        FROM location_master lm
        LEFT JOIN alerts a ON lm.sap_id = a.sap_id 
            AND a.bu = 'TAS' 
            AND a.alert_section = 'TAS'
            AND a.created_at::DATE = CURRENT_DATE
        WHERE lm.location_onboard = true
        GROUP BY lm.sap_id, lm.name
        ORDER BY lm.name
    """
    resp = await hpcl_ceg_model.Alerts.get_aggr_data(query)
    return resp.get("data", [])

async def get_email_users_by_type(email_type: str, audience: str):
    all_users = await hpcl_ceg_model.DailyEmailNotificationUsers.get_all(resp_type='plain')
    to_recipients, cc_recipients, bcc_recipients = [], [], []
    for user in all_users.get("data", []):
        if user.get("audience") == audience and (user.get("email_type") or "").lower() == email_type.lower():
            to_recipients.extend(user.get("to_recipients", []))
            cc_recipients.extend(user.get("cc_recipients", []))
            bcc_recipients.extend(user.get("bcc_recipients", []))
    return {"to": list(set(to_recipients)), "cc": list(set(cc_recipients)), "bcc": list(set(bcc_recipients))}

# ── ThingsBoard Helpers ───────────────────────────────────────────────────────
async def get_jwt(session: aiohttp.ClientSession) -> str:
    url = f"{THINGSBOARD_URL}/api/auth/login"
    payload = {"username": THINGSBOARD_USERNAME, "password": THINGSBOARD_PASSWORD}
    async with session.post(url, json=payload) as resp:
        if resp.status != 200: raise RuntimeError(f"ThingsBoard auth failed: {resp.status}")
        data = await resp.json()
        return data["token"]

def auth_headers(jwt: str) -> dict:
    return {"Content-Type": "application/json", "X-Authorization": f"Bearer {jwt}"}

async def get_all_devices(session: aiohttp.ClientSession, jwt: str) -> list[dict]:
    devices, page = [], 0
    while True:
        url = f"{THINGSBOARD_URL}/api/tenant/devices?pageSize={PAGE_SIZE}&page={page}"
        async with session.get(url, headers=auth_headers(jwt)) as resp:
            if resp.status != 200: raise RuntimeError(f"Failed to fetch devices: {resp.status}")
            body = await resp.json()
            devices.extend(body.get("data", []))
            if body.get("hasNext", False): page += 1
            else: break
    return devices

def normalize_location(location: str) -> str:
    import re
    return re.sub(r'_[A-Za-z0-9]+$', '', location.strip())

def group_tk_devices_by_location(devices: list[dict]) -> dict[str, dict]:
    location_map: dict[str, dict] = {}
    for dev in devices:
        name = dev.get("name", "")
        if "@" not in name: continue
        local_name, raw_location = name.split("@", 1)
        location = normalize_location(raw_location)
        if location.lower() in EXCLUDED_LOCATIONS: continue
        is_tk = local_name.strip().upper().startswith("TK")
        exception_prefix = TANK_DEVICE_EXCEPTIONS.get(location.lower())
        is_exception = bool(exception_prefix and local_name.strip().upper().startswith(exception_prefix.upper()))
        if (is_tk or is_exception) and location not in location_map:
            location_map[location] = dev
    return location_map

async def fetch_telemetry(session, jwt, device_id, key, start_ms, end_ms):
    records, window_end = [], end_ms
    while window_end > start_ms:
        url = f"{THINGSBOARD_URL}/api/plugins/telemetry/DEVICE/{device_id}/values/timeseries?keys={key}&startTs={start_ms}&endTs={window_end}&limit={PAGE_SIZE}&orderBy=DESC"
        async with session.get(url, headers=auth_headers(jwt)) as resp:
            if resp.status != 200: break
            body = await resp.json()
        points = body.get(key, [])
        if not points: break
        records.extend(points)
        oldest_ts = points[-1]["ts"]
        if oldest_ts <= start_ms or len(points) < PAGE_SIZE: break
        window_end = oldest_ts - 1
    seen = set()
    unique = [p for p in records if not (p["ts"] in seen or seen.add(p["ts"]))]
    unique.sort(key=lambda x: x["ts"], reverse=True)
    return unique

def find_gaps(records, gap_threshold_min, start_ms):
    gaps, threshold_ms = [], gap_threshold_min * 60 * 1000

    # Leading gap: window start → first (oldest) record
    if start_ms is not None and records:
        leading_gap_ms = records[-1]["ts"] - start_ms
        if leading_gap_ms > threshold_ms:
            gaps.append({"duration_min": round(leading_gap_ms / 60000, 1)})

    for i in range(len(records) - 1):
        diff_ms = records[i]["ts"] - records[i + 1]["ts"]
        if diff_ms > threshold_ms:
            gaps.append({
                "duration_min": round(diff_ms / 60000, 1),
            })
    return gaps

def get_severity_info(duration_min: float) -> tuple[str, str]:
    hours = duration_min / 60
    if duration_min <= 0: return "None", "none"
    elif hours < 2: return "Low", "low"
    elif hours < 10: return "Medium", "medium"
    elif hours < 20: return "High", "high"
    else: return "Critical", "critical"

# ── Main Integrated Function ──────────────────────────────────────────────────
async def publish_integrated_daily_report(email_type, audience):
    # 1. Date Calculation (Today only for 7 PM cron)
    now_ist = datetime.now(IST)
    start_dt = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    end_dt = now_ist # Current time for the 7 PM run
    
    start_ms = int(start_dt.timestamp() * 1000)
    end_ms = int(end_dt.timestamp() * 1000)

    # 2. Fetch DB Alerts
    print("[1/4] Fetching TAS Alert Summary from DB...")
    tas_counts = await fetch_tas_onboarded_alert_counts()
    
    # 3. Fetch Telemetry Gaps (LOC) for Today
    print("[2/4] Fetching Today's Telemetry Gaps from ThingsBoard...")
    loc_summary = []
    async with aiohttp.ClientSession() as session:
        jwt = await get_jwt(session)
        devices = await get_all_devices(session, jwt)
        location_map = group_tk_devices_by_location(devices)
        for loc_name, dev in sorted(location_map.items()):
            records = await fetch_telemetry(session, jwt, dev["id"]["id"], TELEMETRY_KEY, start_ms, end_ms)
            gaps = find_gaps(records, GAP_THRESHOLD_MIN, start_ms=start_ms)
            total_min = sum(g["duration_min"] for g in gaps)
            
            # Even if no records were found at all today, that's a total outage
            if not records:
                total_min = round((end_ms - start_ms) / 60000, 1)
                gaps = [{"duration_min": total_min}]

            sev_name, sev_class = get_severity_info(total_min)
            loc_summary.append({
                "name": loc_name,
                "count": len(gaps),
                "downtime": f"{int(total_min//60)}h {int(total_min%60)}m" if total_min > 0 else "0h 0m",
                "severity": sev_name,
                "severity_class": sev_class
            })

    # 4. Prepare and Send Email
    print("[3/4] Rendering Integrated HTML Template...")
    status_data = {
        'today_date': now_ist.strftime('%d-%B-%Y'),
        'today_week': now_ist.strftime('%A'),
        'report_generated_time': now_ist.strftime('%I:%M %p'),
        'tas_onboarded_counts': tas_counts,
        'totals': {
            "open_critical": sum(int(r.get("open_critical", 0)) for r in tas_counts),
            "close_critical": sum(int(r.get("close_critical", 0)) for r in tas_counts),
            "open_high": sum(int(r.get("open_high", 0)) for r in tas_counts),
            "close_high": sum(int(r.get("close_high", 0)) for r in tas_counts),
            "open_medium": sum(int(r.get("open_medium", 0)) for r in tas_counts),
            "close_medium": sum(int(r.get("close_medium", 0)) for r in tas_counts),
            "open_low": sum(int(r.get("open_low", 0)) for r in tas_counts),
            "close_low": sum(int(r.get("close_low", 0)) for r in tas_counts),
            "grand_total": sum(int(r.get("grand_total", 0)) for r in tas_counts),
        },
        'loc_summary': loc_summary,
        'gap_threshold': GAP_THRESHOLD_MIN
    }

    # Find templates directory dynamically relative to this file
    template_name = "seg6.html"
    template_path = os.path.join(
        os.path.dirname(__file__),
        '..', 'templates', template_name
    )
    # Fallback to absolute project path if relative path doesn't exist
    if not os.path.exists(template_path):
        template_path = os.path.join(
            os.path.dirname(hpcl_ceg_model.__file__),
            '..', 'orchestrator', 'reporting_services',
            'templates', template_name
        )

    with open(template_path, 'r') as f:
        template = jinja2.Template(f.read())
    html_content = template.render(**status_data)

    print("[4/4] Sending Integrated Daily Email...")
    recipients = await get_email_users_by_type(email_type=email_type, audience=audience)
    ins = await notification_factory.get_notification_module("email")
    await ins.publish_message(
        subject="Novex Daily Report: TAS Alerts & Loss of Communication Summary",
        recipients=recipients["to"],
        cc_recipients=recipients["cc"],
        bcc_recipients=recipients["bcc"],
        html_content=True,
        body=html_content,
        force_send=True
    )
    print("Integrated Daily Report sent successfully.")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python integrated_daily_report.py <email_type> <audience>")
        sys.exit(1)
    asyncio.run(publish_integrated_daily_report(sys.argv[1], sys.argv[2]))
