import urdhva_base
import re
import os
import asyncio
from datetime import datetime, time, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import orchestrator.notification_manager.notification_factory

LOG_DIR = "/var/log/ceg_logs"
SLOTS = [
    (time(8, 0), "8AM"),
    (time(12, 0), "12PM"),
    (time(17, 0), "5PM")
]

DATETIME_PATTERN = re.compile(r'^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})')
ERROR_PATTERN = re.compile(r'(ERROR|logger\.error)', re.IGNORECASE)

async def log_summary():
    print("Reading logs from local server...")

    now_ist = datetime.now(ZoneInfo("Asia/Kolkata"))
    today = now_ist.date()

    # Determine slot start time
    for i in range(len(SLOTS)):
        if now_ist.time() < SLOTS[i][0]:
            current_slot_start = datetime.combine(today, SLOTS[i-1][0], tzinfo=ZoneInfo("Asia/Kolkata")) if i > 0 else datetime.combine(today, SLOTS[0][0], tzinfo=ZoneInfo("Asia/Kolkata"))
            break
    else:
        current_slot_start = datetime.combine(today, SLOTS[-1][0], tzinfo=ZoneInfo("Asia/Kolkata"))

    slot_start_utc = current_slot_start.astimezone(timezone.utc)
    log_blocks = []

    for log_file in Path(LOG_DIR).glob("*.log"):
        errors = []
        try:
            with open(log_file, "r", encoding="utf-8", errors="ignore") as file:
                for line in file:
                    match = DATETIME_PATTERN.match(line)
                    if match:
                        try:
                            log_time = datetime.strptime(match.group(1), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                            if log_time >= slot_start_utc and ERROR_PATTERN.search(line):
                                errors.append(line.strip())
                        except Exception:
                            continue

            status = "FAIL" if errors else "PASS"
            block = f"Log File   : {log_file.name}\nStatus     : {status}"
            block += "\n" + "\n".join(errors) if errors else "\n(No errors found)"
            log_blocks.append(block)
        except Exception as e:
            print(f"Failed reading {log_file.name}: {e}")
            log_blocks.append(f"Log File   : {log_file.name}\nStatus     : FAIL\nError      : Could not read log file: {e}")

    # Write to TXT
    txt_path = "/tmp/log_summary_local.txt"
    with open(txt_path, "w") as f:
        f.write("\n\n".join(log_blocks))

    # Email body
    formatted_time = now_ist.strftime('%d-%m-%Y %I:%M %p IST')
    html_body = f"""
    <html>
        <body>
        <p>Hello,</p>
        <p>Please find the <b>local log error summary</b> from <b>{current_slot_start.strftime('%I:%M %p')} IST</b> till now.</p>
        <br>
        Regards,<br>
        Log Monitoring System
        </body>
    </html>
    """

    # Retry 3 times
    for attempt in range(1, 4):
        try:
            print(f"Attempt {attempt} to send email...")
            ins = await orchestrator.notification_manager.notification_factory.get_notification_module("email")
            print("Email module path:", orchestrator.notification_manager.notification_factory.__file__)
            await ins.publish_message(
                subject=f"SERVER 211 - Log Error Summary - {formatted_time}",
                recipients=[
                    "yesu.p@algofusiontech.com",
                    "sreedhar.maddipati@algofusiontech.com",
                    "venu@algofusiontech.com",
                    "moufikali@algofusiontech.com",
                    "bala@algofusiontech.com",
                    "manohar.v@algofusiontech.com"
                ],
                html_content=True,
                body=html_body,
                attachments=[txt_path],
                force_send=True
            )
            print("Email sent successfully.")
            break
        except Exception as e:
            print(f"Attempt {attempt} failed: {e}")
            if attempt == 3:
                print("All retries failed. Giving up.")

if __name__ == "__main__":
    asyncio.run(log_summary())
