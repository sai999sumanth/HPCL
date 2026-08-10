import urdhva_base
import asyncio
import datetime
import pandas as pd
from jinja2 import Template
from orchestrator.notification_manager.notify_email import *
import orchestrator.alerting.listener.sync_ro_ims_report as sync_ro_ims_report


def read_template(filename, data):
    with open(filename, 'r') as f:
        html_string = f.read()
    j2_template = Template(html_string)
    body=j2_template.render(data)
    return body


async def generate_dryout_report():
    report_time = urdhva_base.utilities.get_present_time()
    report_time = report_time.strftime("%Y-%B-%d_%H_%M_%S")
    data = await sync_ro_ims_report._get_dry_out_ims_report("1")
    df = pd.DataFrame(data)
    df.to_excel(f"/tmp/dry_out_report_{report_time}.xlsx", index=False)
    data_1 = await sync_ro_ims_report._get_dry_out_ims_report("2")
    df_1 = pd.DataFrame(data_1)
    df_1.to_excel(f"/tmp/intra_day_dry_out_report_{report_time}.xlsx", index=False)
    to_email = ['gauravyadav1@hpcl.in', 'rameshyadav.p@hpcl.in', 'venu@algofusiontech.com', 'pampanaboyina.rekha@hpcl.in', 'yesu.p@algofusiontech.com']
    attachments = [f"/tmp/dry_out_report_{report_time}.xlsx", f"/tmp/intra_day_dry_out_report_{report_time}.xlsx"]
    notify_email = NotifyEMail()
    data = {"report_time": report_time, "portal_link": "https://novex.hpcl.co.in"}
    resp = await notify_email.publish_message(
        **{
            'recipients': to_email,
            'subject': f"Dry Out Report as on {report_time}",
            'body': read_template("/opt/ceg/algo/orchestrator/notification_templates/dryout_report.html",
                                  data=data),
            'attachments': attachments,
            'html_content': True,
            'force_send': True
        }
    )
    print("Email Resp: ", resp)


if __name__ == "__main__":
    print(f"Executing dry-out alert creation at {datetime.datetime.now(datetime.timezone.utc)}")
    asyncio.run(generate_dryout_report())