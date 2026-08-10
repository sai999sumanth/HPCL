import urdhva_base
import os
import sys
import jinja2
import asyncio
import pandas as pd
import hpcl_ceg_model
import urdhva_base.utilities
from types import SimpleNamespace
import utilities.helpers as helpers
import utilities.connection_mapping as connection_mapping
from charts_actions import charts_connection_vault_routing
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams
import orchestrator.notification_manager.notification_factory as notification_factory
from orchestrator.reporting_services.reporting_helpers import get_alert_data, lpg_data, retail_data, sales_data, sod_data, ro_va_cleanliness, nozzle_sales_trend


WRITE_TO_DB = False


def dict_to_object(d):
    """Convert dictionary to object (recursively for nested dictionaries)."""
    if isinstance(d, list):
        return [dict_to_object(i) for i in d]
    if isinstance(d, dict):
        return SimpleNamespace(**{k: dict_to_object(v) for k, v in d.items()})
    return d
    

async def fetch_data():
    global WRITE_TO_DB
    date = urdhva_base.utilities.get_present_time()
    date_yes = helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                       date_time_format=None)
    report_generated_time = date.strftime('%I:%M %p')
    if date.strftime('%Y-%m-%d').split('-')[-1] == '01' or date.strftime('%Y-%m-%d').split('-')[-1] == '1':
        print("datde inside if",date)
        status_yes_date = date
        tmp_date = urdhva_base.utilities.get_present_time()
        tmp_date_yes = helpers.get_time_stamp_by_delta(tmp_date, days=1, with_month_start_day=False,
                                               date_time_format=None)
        tmp_date_start = helpers.get_time_stamp_by_delta(tmp_date, days=1, with_month_start_day=True,
                                               date_time_format=None)

        status_data = {'today_date': date.strftime('%d-%B-%Y'), 'report_generated_time': report_generated_time,
                   'yesterday_date': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                               date_time_format='%d-%B-%Y'),
                   'today_week': date.strftime('%A'), 'yesterday_week':
                       helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                 date_time_format='%A'),
                   'today': date.strftime('%d-%B-%Y'),
                   'yesterday': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                          date_time_format='%d-%B-%Y'),
                   'present_month': f"01-{tmp_date_start.strftime('%b')} to {tmp_date_yes.strftime('%d')}-{tmp_date_yes.strftime('%b')}"}
                  # 'present_month': f"01-{date.strftime('%b')} to {date_yes.strftime('%d')}-{date_yes.strftime('%b')}"}
    else:
         status_data = {'today_date': date.strftime('%d-%B-%Y'), 'report_generated_time': report_generated_time,
                   'yesterday_date': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                               date_time_format='%d-%B-%Y'),
                   'today_week': date.strftime('%A'), 'yesterday_week':
                       helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                 date_time_format='%A'),
                   'today': date.strftime('%d-%B-%Y'),
                   'yesterday': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                          date_time_format='%d-%B-%Y'),
                  # 'present_month': f"01-{tmp_date_start.strftime('%b')} to {tmp_date_yes.strftime('%d')}-{tmp_date_yes.strftime('%b')}"}
                   'present_month': f"01-{date.strftime('%b')} to {date_yes.strftime('%d')}-{date_yes.strftime('%b')}"}

    status_data.update(await sales_data.fetch_sales_data())
    # print("status_data before :", status_data)
    status_data.update(await retail_data.fetch_dryout_data(WRITE_TO_DB))
    status_data.update(await lpg_data.get_lpg_rejection())
    status_data.update(await retail_data.get_ro_alerts())
    status_data.update(await sod_data.get_tas_alerts())
    #status_data.update(await get_vts_route_deviation())
    status_data.update(await lpg_data.lpg_top_bottom_score_plants())
    status_data.update(await lpg_data.get_vts_lpg_blocked_counts())
    status_data.update(await sod_data.get_vts_sod_blocked_counts())
    #status_data.update(await sod_data.get_vts_tas_blocked_counts())
    status_data.update(await sod_data.sod_percentage())
    status_data.update(await sod_data.get_va_path())
    status_data.update(await sod_data.get_emlock_path())
    status_data.update(await sod_data.get_tas_path())
    status_data.update(await sod_data.get_fault_and_maintenance())
    status_data.update(await sod_data.get_parameters_summary())
    #status_data.update(await retail_data.get_ro_ratings())
    status_data.update(ro_va_cleanliness.main())
    status_data.update(await retail_data.nozzle_sales(segregation = "zone"))
    status_data.update(await retail_data.sales_tmt_excel())
    status_data.update(await nozzle_sales_trend.fetch_data())
    status_data.update(await nozzle_sales_trend.nozzles_sales_top_performance())

    for alert_section in ["VA", "VTS", "EMLock", "TAS"]:
        status_data.update(await get_alert_data.get_alert_data(alert_section))
    # print("-" * 50)
    # print("status_data :", json.dumps(status_data))
    # print("-" * 50)
    # print("-------->status_data",status_data)
    return status_data


async def publish_daily_novex_status_email():
    status_data = await fetch_data()
    await send_notification(
        template_name="seg1.html",
        to_recipients=["arpitaKanak.Bara@hpcl.in","vgupta@hpcl.in","avinashgaurav@hpcl.in",
                       "prasantk@hpcl.in","georget@hpcl.in","gkpatel@hpcl.in","sumanraj@hpcl.in","rohitverma@hpcl.in","sandesh.mane@hpcl.in","raksha.patidar@hpcl.in"],
        subject="Novex Daily Report",
        cc_recipients= ["venu@algofusiontech.com", "moufikali@algofusiontech.com", "aditya@algofusiontech.com", "yesu.p@algofusiontech.com", "manohar.v@algofusiontech.com"],
        bcc_recipients=["gayathri.m@algofusiontech.com", "poojitha.gumma@algofusiontech.com", "vamsi.c@algofusiontech.com", 
                        "pawann.k@algofusiontech.com", "mohith.p@algofusiontech.com"],
        notification_data=status_data,
        inline_images={
            "dry_out_lost": f"{status_data.get('chart_path')}",
            "last_30_days_dry_out_trends": f"{status_data.get('zone_wise_chart')}",
            "nozzel_sales_chart": f"{status_data.get('nozzel_sales_chart')}"
        },
        attachments = [status_data.get('zone_wise_pdf_path')]
    )
    await send_notification(
        template_name="seg2.html",
        to_recipients= ["arpitaKanak.Bara@hpcl.in", "vgupta@hpcl.in", "avinashgaurav@hpcl.in",
                        "prasantk@hpcl.in", "georget@hpcl.in", "gkpatel@hpcl.in", "sumanraj@hpcl.in", "rohitverma@hpcl.in", "sandesh.mane@hpcl.in", "raksha.patidar@hpcl.in"],
        subject="Novex Daily Report: Retail",
        cc_recipients=["venu@algofusiontech.com", "moufikali@algofusiontech.com", "aditya@algofusiontech.com", "yesu.p@algofusiontech.com", "manohar.v@algofusiontech.com"],
        bcc_recipients=["gayathri.m@algofusiontech.com", "poojitha.gumma@algofusiontech.com", "vamsi.c@algofusiontech.com", 
                        "pawann.k@algofusiontech.com", "mohith.p@algofusiontech.com"],
        notification_data=status_data,
        inline_images={
            "dry_out_lost": f"{status_data.get('chart_path')}",
            "last_30_days_dry_out_trends": f"{status_data.get('zone_wise_chart')}",
            "nozzel_sales_chart": f"{status_data.get('nozzel_sales_chart')}"
        },
        attachments = [status_data.get('zone_wise_pdf_path')]
    )
    await send_notification(
        template_name="seg3.html",
        to_recipients=["arpitaKanak.Bara@hpcl.in", "vgupta@hpcl.in", "avinashgaurav@hpcl.in"],
        subject="Novex Daily Report: LPG",
        cc_recipients=["venu@algofusiontech.com", "moufikali@algofusiontech.com", "aditya@algofusiontech.com", "yesu.p@algofusiontech.com", "manohar.v@algofusiontech.com"],
        bcc_recipients=["gayathri.m@algofusiontech.com", "poojitha.gumma@algofusiontech.com", "vamsi.c@algofusiontech.com", 
                        "pawann.k@algofusiontech.com", "mohith.p@algofusiontech.com"],
        notification_data=status_data,
        inline_images={
            "monthly_score_path": f"{status_data.get('lpg_monthyl_score_path')}",
            "plant_wise_score_path": f"{status_data.get('plant_wise_score_df_path')}"
        },
        attachments= [status_data.get('lpg_day_wise_trend_exl_path'), status_data.get('lpg_va_path'),status_data.get('lpg_pq_path')]
    )
    await send_notification(
        template_name="seg4.html",
        to_recipients=["shrikantsaini@hpcl.in","arpitaKanak.Bara@hpcl.in", "vgupta@hpcl.in", "avinashgaurav@hpcl.in"],
        subject="Novex Daily Report: SOD",
        cc_recipients=["venu@algofusiontech.com", "moufikali@algofusiontech.com", "aditya@algofusiontech.com", "yesu.p@algofusiontech.com", "manohar.v@algofusiontech.com"],
        bcc_recipients=["gayathri.m@algofusiontech.com", "poojitha.gumma@algofusiontech.com", "vamsi.c@algofusiontech.com", 
                        "pawann.k@algofusiontech.com", "mohith.p@algofusiontech.com"],
        notification_data=status_data,
        inline_images={
            "monthly_score_path_sod": f"{status_data.get('sod_monthly_score_path')}",
            "plant_wise_score_path_sod": f"{status_data.get('sod_plant_wise_score_df_path')}"
        },
        attachments = [status_data.get('zone_wise_pdf_path'),status_data.get('tas_day_wise_trend_exl_path'),
                       status_data.get('tas_va_path'),status_data.get('tas_emlock_path'),status_data.get('tas_tas_path')]
    )

    await send_notification(
        template_name="ro_va_cleanliness.html",
        to_recipients=["arpitaKanak.Bara@hpcl.in", "vgupta@hpcl.in", "avinashgaurav@hpcl.in"],
        subject=f"Clean Toilet Picture upload | MIS | Date : {status_data.get('yesterday_date')}",
        cc_recipients=["venu@algofusiontech.com", "moufikali@algofusiontech.com", "aditya@algofusiontech.com", "yesu.p@algofusiontech.com", "manohar.v@algofusiontech.com"],
        bcc_recipients=["gayathri.m@algofusiontech.com", "poojitha.gumma@algofusiontech.com", "vamsi.c@algofusiontech.com", 
                        "pawann.k@algofusiontech.com", "mohith.p@algofusiontech.com"],
        notification_data=status_data
    )

    await send_notification(
        template_name="nozzle_sales_trend.html",
        to_recipients=["arpitaKanak.Bara@hpcl.in" , "shrikantsaini@hpcl.in", "vgupta@hpcl.in", "avinashgaurav@hpcl.in"],
        subject="Nozzle sales of MS Sales and Power daily sales Trend monitoring",
        cc_recipients=["venu@algofusiontech.com", "moufikali@algofusiontech.com", "aditya@algofusiontech.com", "yesu.p@algofusiontech.com", "manohar.v@algofusiontech.com"],
        bcc_recipients=["gayathri.m@algofusiontech.com", "poojitha.gumma@algofusiontech.com", "vamsi.c@algofusiontech.com", 
                        "pawann.k@algofusiontech.com", "mohith.p@algofusiontech.com"],
        notification_data=status_data,
        inline_images={
            "nozzle_trend_chart": f"{status_data.get('nozzle_trend_chart')}"
        }
    )

    await send_notification(
        template_name="seg5.html",
        to_recipients=["sreedhar.maddipati@algofusiontech.com"],
        subject="Novex Daily Report",
        cc_recipients=["venu@algofusiontech.com", "moufikali@algofusiontech.com", "aditya@algofusiontech.com", "yesu.p@algofusiontech.com", "manohar.v@algofusiontech.com"],
        bcc_recipients=["gayathri.m@algofusiontech.com", "poojitha.gumma@algofusiontech.com", "vamsi.c@algofusiontech.com", 
                        "pawann.k@algofusiontech.com", "mohith.p@algofusiontech.com"],
        notification_data=status_data,
        inline_images={
            "dry_out_lost": f"{status_data.get('chart_path')}",
            "last_30_days_dry_out_trends": f"{status_data.get('zone_wise_chart')}",
            "monthly_score_path": f"{status_data.get('lpg_monthyl_score_path')}",
            "plant_wise_score_path": f"{status_data.get('plant_wise_score_df_path')}",
            "nozzel_sales_chart": f"{status_data.get('nozzel_sales_chart')}",
            "monthly_score_path_sod": f"{status_data.get('sod_monthly_score_path')}",
            "plant_wise_score_path_sod": f"{status_data.get('sod_plant_wise_score_df_path')}"
        },
        attachments = [status_data.get('zone_wise_pdf_path'),status_data.get('lpg_day_wise_trend_exl_path'), 
                       status_data.get('lpg_va_path'),status_data.get('lpg_pq_path'),status_data.get('tas_day_wise_trend_exl_path'),
                       status_data.get('tas_va_path'),status_data.get('tas_emlock_path'),status_data.get('tas_tas_path')]
    )


async def send_notification(template_name, to_recipients, subject, cc_recipients=None, bcc_recipients=None, notification_data=None, inline_images=None, attachments=None):
    template_path = os.path.join(
        os.path.dirname(hpcl_ceg_model.__file__),
        '..', 'orchestrator', 'reporting_services',
        'templates', template_name
        )
    with open(template_path, 'r') as f:
        template_data = jinja2.Template(f.read())
    final_data = template_data.render(**notification_data)

    tmp_file = f"/tmp/{template_name}"
    with open(tmp_file, 'w') as f:
        f.write(final_data)
    # Send email
    ins = await notification_factory.get_notification_module("email")
    await ins.publish_message(
        subject=subject,
        recipients=to_recipients,
        cc_recipients=cc_recipients or [],
        bcc_recipients=bcc_recipients or [],
        html_content=True,
        body=final_data,
        force_send=True,
        inline_images=inline_images or {},
        attachments=attachments or []
    )


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1].lower() == "true":
        WRITE_TO_DB = True
    asyncio.run(publish_daily_novex_status_email())