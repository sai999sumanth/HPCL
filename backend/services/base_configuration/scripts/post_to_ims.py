import urdhva_base
import datetime
import requests
import asyncio
import pandas as pd
import hpcl_ceg_model
from jinja2 import Template
import orchestrator.notification_manager.notification_factory as notification_factory
from orchestrator.actions import send_notification


async def post_to_ims():
    try:
        url = "https://vtsblocking.hpcl.co.in/VTSBlocking/webresources/vtsBlocking/blockTT"
        headers = {
            "Content-Type": "application/json",
        }
        df = pd.read_csv("/tmp/vts_open_alerts_sep24.csv")
        df.rename(columns={'id': "transactNo", 'vehicle_number': "truckRegNo", 'vehicle_blocked_start_date': "blockingFrom",
            'vehicle_blocked_end_date': "blockingTo"}, inplace=True)
        del df["created_at"]
        df["blockingFrom"] = pd.to_datetime(df["blockingFrom"]).dt.strftime("%Y%m%d")
        df["blockingTo"] = pd.to_datetime(df["blockingTo"]).dt.strftime("%Y%m%d")
        for col in df.columns:
            df[col] = df[col].astype(str)
        df["transactNo"] = df["transactNo"] + "1"
        df["blockingFlag"] = "Y"
        df = df[["transactNo", "truckRegNo", "blockingFlag", "blockingFrom", "blockingTo"]]
        payload = df.to_dict(orient="records")


        resp = requests.post(url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()  # raises HTTPError for bad responses (4xx/5xx)
        # If response is JSON:
        data = resp.json()
        print("Status:", resp.status_code)
        print("Response JSON:", data)

    except requests.exceptions.HTTPError as e:
        print("HTTP error:", e, "Body:", getattr(e.response, "text", None))
    except requests.exceptions.RequestException as e:
        print("Request failed:", e)


async def send_mail(alert_data):
    for alert in alert_data.to_dict(orient="records"):
        to_receipent, cc_recipient, from_url, transporter_name = await get_vts_recipients(alert)
        if not to_receipent:
            continue
        print("*"*10)
        print("to_receipent :", to_receipent)
        print("cc_recipient :", cc_recipient)
        print("*"*10)

        template_data = {
            "transporter_name": transporter_name,
            "plant_location": alert.get("location_name", ""),
            "asset_id": alert["device_name"],
            "interlock_name": alert["interlock_name"].strip(alert["interlock_name"].split(" ")[-1]).strip(),
            "days": (
                datetime.datetime.strptime(alert["vehicle_blocked_end_date"].split(" ")[0], "%Y-%m-%d") - 
                datetime.datetime.strptime(alert["vehicle_blocked_start_date"].split(" ")[0], "%Y-%m-%d")).days,
            "block_start_date": datetime.datetime.strptime(alert["vehicle_blocked_start_date"].split(" ")[0], "%Y-%m-%d").strftime("%d.%m.%Y"),
            "block_end_date": datetime.datetime.strptime(alert["vehicle_blocked_end_date"].split(" ")[0], "%Y-%m-%d").strftime("%d.%m.%Y"),
            "vts_assigned_role": alert.get("last_escalated_to", "Location In-Charge SOD")
        }

        subject_template = f"VTS Alert: Blocking of truck {alert.get('vehicle_number', '')} at {alert.get("location_name", "")};"
        print("*"*20)
        print("subject_template :", subject_template)
        print("*"*20)
        print("template_data :", template_data)
        print("*"*20)

        body = await send_notification.SendNotification().read_template("/opt/ceg/algo/orchestrator/notification_templates/vts_truck_blocking.html")

        body = Template(body).render(**template_data)

        to_receipent = ["shrihari.b@algofusiontech.com"]
        cc_recipient = ["yesu.p@algofusiontech.com"]
        
        notification_module = await notification_factory.get_notification_module(module_type="email")
        res = await notification_module.publish_message(from_url=from_url, recipients=to_receipent, 
                                                        cc_recipients=cc_recipient, subject=subject_template, 
                                                        body=body, force_send=True, html_content=True)
        print("res :", res)
        exit()

async def get_vts_recipients(alert_data):
    transporter_details = {}
    query = (f"transporter_code='{alert_data['transporter_code']}'")
    transporter_details_data = await hpcl_ceg_model.EmailMaster.get_all(urdhva_base.queryparams.QueryParams(q=query),
                                                                                resp_type='plain')
    print("transporter_details_data :", transporter_details_data)
    if not transporter_details_data["data"]:
        return [], [], "VTS<VTSGovernance@hpcl.co.in>", ""
    transporter_mail = []
    if len(transporter_details_data.get("data",[])):
        transporter_details_data = transporter_details_data['data'][0]
        transporter_details["transporter_name"] = transporter_details_data['transporter_name']
        if transporter_details_data.get('transporter_email1',""):
            transporter_mail.append(transporter_details_data['transporter_email1'])
        if transporter_details_data.get('transporter_email2',""):
            transporter_mail.append(transporter_details_data['transporter_email2'])
        transporter_details['transporter_email'] = ",".join(str(x) for x in transporter_mail)

    cc_query = (f"sap_id='{alert_data['sap_id']}'")
    cc_query_data = await hpcl_ceg_model.EmailMaster.get_all(urdhva_base.queryparams.QueryParams(q=cc_query),
                                                                                resp_type='plain')
    cc_recipients = []
    if len(cc_query_data.get("data",[])):
        cc_recipients_data = cc_query_data['data'][0]
        keys = ["location_officer","zonal_transport_officer","zonal_head","hqo1","hqo2","hqo3","hqo4"]
        for key in keys:
            if alert_data['violation_type'] in ['speed_violation_count']:
                cc_recipients.append(cc_recipients_data.get("key",""))
            else:
                # For other violation types, exclude hqo4
                if key != "hqo4":
                    cc_recipients.append(cc_recipients_data.get(key, ""))
    usernames = set(cc_recipients)
    mail_recipients = transporter_mail
    cc_recipients = cc_recipients
    from_url = "VTS<VTSGovernance@hpcl.co.in>"
    return mail_recipients, cc_recipients, from_url, transporter_details_data["transporter_name"]


if __name__ == "__main__":
    df = pd.read_csv("/tmp/vts_open_alerts_sep24.csv")
    # asyncio.run(send_mail(df))
