import urdhva_base
import os
import paramiko
import re
import asyncio
from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

REMOTE_HOST = "10.90.38.217"
REMOTE_USER = "novex"
REMOTE_PASSWORD = "Hpcl@123"
REMOTE_LOG_DIR = "/var/log/ceg_logs"

SLOTS = [
    (time(8, 0), "8AM"),
    (time(12, 0), "12PM"),
    (time(17, 0), "5PM")
]

DATETIME_PATTERN = re.compile(r'^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})')
ERROR_PATTERN = re.compile(r'(ERROR|logger\.error)', re.IGNORECASE)

async def monitor_remote_logs():
    print("Monitoring all logs on 217 from 211...")

    now_ist = datetime.now(ZoneInfo("Asia/Kolkata"))
    today = now_ist.date()

    for i in range(len(SLOTS)):
        if now_ist.time() < SLOTS[i][0]:
            current_slot_start = datetime.combine(today, SLOTS[i-1][0], tzinfo=ZoneInfo("Asia/Kolkata")) if i > 0 else datetime.combine(today, SLOTS[0][0], tzinfo=ZoneInfo("Asia/Kolkata"))
            break
    else:
        current_slot_start = datetime.combine(today, SLOTS[-1][0], tzinfo=ZoneInfo("Asia/Kolkata"))

    slot_start_utc = current_slot_start.astimezone(timezone.utc)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(REMOTE_HOST, username=REMOTE_USER, password=REMOTE_PASSWORD)
    sftp = client.open_sftp()

    log_blocks = []

    try:
        for file_attr in sftp.listdir_attr(REMOTE_LOG_DIR):
            file_name = file_attr.filename
            if not file_name.endswith(".log"):
                continue

            remote_path = f"{REMOTE_LOG_DIR}/{file_name}"

            try:
                file_obj = sftp.file(remote_path, "r")
                content = file_obj.read()

                if isinstance(content, bytes):
                    lines = content.decode(errors="ignore").splitlines()
                else:
                    lines = content.splitlines()

                errors = []
                for line in lines:
                    match = DATETIME_PATTERN.match(line)
                    if match:
                        try:
                            log_time = datetime.strptime(match.group(1), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                            if log_time >= slot_start_utc and ERROR_PATTERN.search(line):
                                errors.append(line.strip())
                        except Exception:
                            continue

                status = "FAIL" if errors else "PASS"
                block = f"Log File   : {file_name}\nStatus     : {status}"
                block += "\n" + "\n".join(errors) if errors else "\n(No errors found)"
                log_blocks.append(block)

            except Exception as e:
                print(f"Error reading {file_name}: {e}")
                log_blocks.append(f"Log File   : {file_name}\nStatus     : FAIL\nError      : Could not read log file: {e}")

    finally:
        sftp.close()
        client.close()

    # Write to TXT
    txt_path = "/tmp/log_summary_217.txt"
    with open(txt_path, "w") as f:
        f.write("\n\n".join(log_blocks))

    # Email
    formatted_time = now_ist.strftime('%d-%m-%Y %I:%M %p IST')
    html_body = f"""
    <html>
        <body>
        <p>Hello,</p>
        <p>Attached is the <b>log error summary</b> from <b>{current_slot_start.strftime('%I:%M %p')} IST</b> till now.</p>
        <br>
        Regards,<br>
        Log Monitoring System
        </body>
    </html>
    """

    for attempt in range(1, 4):
        try:
            print(f"Attempt {attempt} to send email with TXT attachment...")
            import orchestrator.notification_manager.notification_factory
            ins = await orchestrator.notification_manager.notification_factory.get_notification_module("email")
            print("Email module imported from path:", orchestrator.notification_manager.notification_factory.__file__)
            await ins.publish_message(
                subject=f"SERVER 217 - Log Summary - {formatted_time}",
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
            print(f"Attempt {attempt} - Failed to send email: {e}")
            if attempt == 3:
                print("All retries failed. Giving up.")

if __name__ == "__main__":
    asyncio.run(monitor_remote_logs())