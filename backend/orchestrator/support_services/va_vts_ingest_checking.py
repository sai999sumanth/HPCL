import urdhva_base
import asyncio
import pytz
import datetime
import requests
import traceback
from concurrent.futures import ThreadPoolExecutor
import orchestrator.notification_manager.notification_factory as notification_factory


urls = [
    "http://localhost:9010/api/ping",
    "http://localhost:9011/api/ping",
    "http://localhost:9012/api/ping",
    "http://localhost:9013/api/ping",
    "http://localhost:9014/api/ping",
]

# failure tracking dict
failure_counts = {url: 0 for url in urls}
alert_sent = {url: False for url in urls}   # prevent spamming


# ---------- email ----------
async def send_notification(subject: str, body: str) -> None:
    try:
        ins = await notification_factory.get_notification_module("email")
        recipients = [["sreedhar.maddipati@algofusiontech.com","venu@algofusiontech.com",
                       "yesu.p@algofusiontech.com"]]
        IST = pytz.timezone("Asia/Kolkata")
        today_ist = datetime.datetime.now(IST).strftime("%d-%m-%Y")

        for recipient in recipients:
            await ins.publish_message(
                subject=subject,
                recipients=recipient,
                html_content=True,
                body=body,
                force_send=True,
                attachments=[],
            )
        print("Email notification sent successfully.")
    except Exception as e:
        print("Exception occurred while sending email notification")
        print(e)
        print("Traceback %s" % traceback.format_exc())


# ---------- health check (blocking) ----------
def check_url(url: str) -> bool:
    try:
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        try:
            payload = resp.json()
        except ValueError:
            print(f"{url} returned non-JSON response")
            return False

        ok = False
        if payload == "pong":
            ok = True
        elif isinstance(payload, dict) and any(str(v).lower() == "pong" for v in payload.values()):
            ok = True

        if ok:
            return True
        else:
            return False
    except Exception as e:
        print(f"{url} check failed: {e}")
        return False


# ---------- orchestrator ----------
async def run_health_checks(executor: ThreadPoolExecutor) -> None:
    tasks = [asyncio.to_thread(check_url, url) for url in urls]
    results = await asyncio.gather(*tasks, return_exceptions=False)

    for url, ok in zip(urls, results):
        global failure_counts, alert_sent

        if ok:
            failure_counts[url] = 0      # reset counter on success
            alert_sent[url] = False      # reset alert flag
        else:
            failure_counts[url] += 1
            if failure_counts[url] == 5 and not alert_sent[url]:
                # send mail only once at 5 consecutive fails
                subject = "VA,VTS data ingestion Failed"
                body = f"The URL {url} has failed 5 times consecutively."
                await send_notification(subject, body)
                alert_sent[url] = True


async def main(poll_interval_sec: int = 10) -> None:
    with ThreadPoolExecutor(max_workers=len(urls)) as executor:
        try:
            while True:
                await run_health_checks(executor)
                await asyncio.sleep(poll_interval_sec)
        except asyncio.CancelledError:
            pass


if __name__ == "__main__":
    try:
        asyncio.run(main(poll_interval_sec=10))
    except KeyboardInterrupt:
        print("Shutting down health monitor...")
