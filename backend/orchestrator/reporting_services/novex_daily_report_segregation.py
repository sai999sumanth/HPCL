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
from charts_actions import charts_connection_vault_routing
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
        to_recipients=["gkpatel@hpcl.in","georget@hpcl.in"],
        subject="Novex Daily Report",
        cc_recipients=["gargam@hpcl.in","vikas.kaushal@hpcl.in","amitra@hpcl.in","arvindsingh@hpcl.in","garimasingh@hpcl.in",
                        "anujjain@hpcl.in","Mayank.Mittal@hpcl.in","sumanraj@hpcl.in","anuragn@hpcl.in"],
        bcc_recipients=["cvmallinath@hpcl.in","ritwik.rath@hpcl.in","is.head@hpcl.in","amarnathsahu@hpcl.in","adityapandey@hpcl.in",
                        "arpitaKanak.Bara@hpcl.in" , "shrikantsaini@hpcl.in", "vgupta@hpcl.in", "avinashgaurav@hpcl.in",
                        "sreedhar.maddipati@algofusiontech.com", "moufikali@algofusiontech.com","venu@algofusiontech.com", "aditya@algofusiontech.com",
                        "yesu.p@algofusiontech.com", "manohar.v@algofusiontech.com", "gayathri.m@algofusiontech.com", "vamsi.c@algofusiontech.com",
                        "poojitha.gumma@algofusiontech.com", "mohith.p@algofusiontech.com","mrudula.m@algofusiontech.com", "pawann.k@algofusiontech.com"],
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
        to_recipients=["abalaji@hpcl.in"],
        subject="Novex Daily Report: Retail",
        cc_recipients=["anujjain@hpcl.in","dbasak@hpcl.in","harishrk@hpcl.in","sandesh.mane@hpcl.in","georget@hpcl.in", "raksha.patidar@hpcl.in", "gkpatel@hpcl.in", "magarwal@hpcl.in","rohitverma@hpcl.in"],
        bcc_recipients=["shubhra.Narayan@hpcl.in","arpitaKanak.Bara@hpcl.in" , "shrikantsaini@hpcl.in", "vgupta@hpcl.in" ,"avinashgaurav@hpcl.in",
                        "sreedhar.maddipati@algofusiontech.com","venu@algofusiontech.com","moufikali@algofusiontech.com","aditya@algofusiontech.com",
                        "yesu.p@algofusiontech.com","vamsi.c@algofusiontech.com","manohar.v@algofusiontech.com","gayathri.m@algofusiontech.com",
                        "poojitha.gumma@algofusiontech.com","mrudula.m@algofusiontech.com","mohith.p@algofusiontech.com","pawann.k@algofusiontech.com"],
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
        to_recipients=["adsul@hpcl.in","gbala@hpcl.in"],
        subject="Novex Daily Report: LPG",
        cc_recipients=["kapild@hpcl.in","sanjayk@hpcl.in","gargam@hpcl.in","pranawsinha@hpcl.in","rajkumar@hpcl.in","sarangi@hpcl.in","mvrmurthy@hpcl.in",
                       "NZ.LPG.HEAD@hpcl.in","EZ.LPG.HEAD@hpcl.in","SZ.LPG.HEAD@hpcl.in","NWZ.LPG.HEAD@hpcl.in","SCZ.LPG.HEAD@hpcl.in","NCZ.LPG.HEAD@hpcl.in",
                       "WZ.LPG.HEAD@hpcl.in","Randhir.Kumar2@hpcl.in","Rishikesh.patil@hpcl.in","aijaj@hpcl.in","amargupta@hpcl.in","bkumar@hpcl.in",
                       "krishnumbhavsar@hpcl.in","cmurli@hpcl.in","richaschouksey@hpcl.in","udayk@hpcl.in","Abhay.Kumar@hpcl.in","Vikram.Kumar@hpcl.in",
                       "mkchauhan@hpcl.in","nsuresh@hpcl.in","ppawar@hpcl.in","satyabratakakoti@hpcl.in","kjeevan@hpcl.in"],
        bcc_recipients=["cvmallinath@hpcl.in","ritwik.rath@hpcl.in","is.head@hpcl.in","gkpatel@hpcl.in",
                        "arpitaKanak.Bara@hpcl.in","shrikantsaini@hpcl.in","vgupta@hpcl.in","avinashgaurav@hpcl.in",
                        "sreedhar.maddipati@algofusiontech.com","venu@algofusiontech.com","moufikali@algofusiontech.com","aditya@algofusiontech.com",
                        "yesu.p@algofusiontech.com","vamsi.c@algofusiontech.com","manohar.v@algofusiontech.com","gayathri.m@algofusiontech.com",
                        "poojitha.gumma@algofusiontech.com","mrudula.m@algofusiontech.com","mohith.p@algofusiontech.com","pawann.k@algofusiontech.com"],
        notification_data=status_data,
        inline_images={
            "monthly_score_path": f"{status_data.get('lpg_monthyl_score_path')}",
            "plant_wise_score_path": f"{status_data.get('plant_wise_score_df_path')}"
        },
        attachments= [status_data.get('lpg_day_wise_trend_exl_path'), status_data.get('lpg_va_path'),status_data.get('lpg_pq_path')]
    )
    await send_notification(
        template_name="seg4.html",
        to_recipients=["CZ.OND.IC@hpcl.in","ECZ.OND.IC@hpcl.in","EZ.OND.IC@hpcl.in","NCZ.OND.IC@hpcl.in",
                       "NFZ.OND.IC@hpcl.in","NWF.OND.IC@hpcl.in","NWZ.OND.IC@hpcl.in","NZ.OND.IC@hpcl.in","SCRZ.OND.IC@hpcl.in",
                       "SWZ.OND.IC@hpcl.in","SZ.OND.IC@hpcl.in","WZ.OND.IC@hpcl.in","raokvj@hpcl.in"],
        subject="Novex Daily Report: SOD",
        cc_recipients=["subodh@hpcl.in","SOD.OPNS.HQO@hpcl.in","jays@hpcl.in","rvaid@hpcl.in","gauravyadav1@hpcl.in","rameshyadav.p@hpcl.in","crvkumar@hpcl.in",
                       "Tarunghisulal.chauhan@hpcl.in", "akashdtewari@hpcl.in","bhsgk@hpcl.in", "msbhorkade@hpcl.in","dabhane@hpcl.in"],
        bcc_recipients=["cvmallinath@hpcl.in","ritwik.rath@hpcl.in","is.head@hpcl.in",
                        "gkpatel@hpcl.in","shrikantsaini@hpcl.in","arpitaKanak.Bara@hpcl.in", "vgupta@hpcl.in","avinashgaurav@hpcl.in",
                        "sreedhar.maddipati@algofusiontech.com","venu@algofusiontech.com","moufikali@algofusiontech.com","aditya@algofusiontech.com",
                        "yesu.p@algofusiontech.com","vamsi.c@algofusiontech.com","manohar.v@algofusiontech.com","gayathri.m@algofusiontech.com",
                        "poojitha.gumma@algofusiontech.com","mrudula.m@algofusiontech.com","mohith.p@algofusiontech.com","pawann.k@algofusiontech.com"],
        notification_data=status_data,
        inline_images={
            "monthly_score_path_sod": f"{status_data.get('sod_monthly_score_path')}",
            "plant_wise_score_path_sod": f"{status_data.get('sod_plant_wise_score_df_path')}"
        },
        attachments = [status_data.get('zone_wise_pdf_path'),status_data.get('tas_day_wise_trend_exl_path'),
                       status_data.get('tas_va_path'),status_data.get('tas_emlock_path'),status_data.get('tas_tas_path')]
    )
    await send_notification(
        template_name="seg5.html",
        to_recipients=["sreedhar.maddipati@algofusiontech.com"],
        subject="Novex Daily Report",
        cc_recipients=["venu@algofusiontech.com", "moufikali@algofusiontech.com", "aditya@algofusiontech.com"],
        bcc_recipients=["yesu.p@algofusiontech.com","manohar.v@algofusiontech.com","gayathri.m@algofusiontech.com","poojitha.gumma@algofusiontech.com","vamsi.c@algofusiontech.com"],
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
                       status_data.get('tas_va_path'),status_data.get('tas_emlock_path'),status_data.get('tas_tas_path')
                    ]
    )
    await send_notification(
        template_name="ro_va_cleanliness.html",
        to_recipients=["cvmallinath@hpcl.in","ritwik.rath@hpcl.in","is.head@hpcl.in","MdTausif.Anwar@hpcl.in","vimalkumar@hpcl.in"],
        subject=f"Clean Toilet Picture upload | MIS | Date : {status_data.get('yesterday_date')}",
        cc_recipients=["shrikantsaini@hpcl.in","arpitaKanak.Bara@hpcl.in", "vgupta@hpcl.in", "avinashgaurav@hpcl.in"],
        bcc_recipients=["sreedhar.maddipati@algofusiontech.com","venu@algofusiontech.com","moufikali@algofusiontech.com","aditya@algofusiontech.com","yesu.p@algofusiontech.com",
                        "vamsi.c@algofusiontech.com","manohar.v@algofusiontech.com","gayathri.m@algofusiontech.com","poojitha.gumma@algofusiontech.com","mrudula.m@algofusiontech.com",
                        "mohith.p@algofusiontech.com","pawann.k@algofusiontech.com"],
        notification_data=status_data
    )

    await send_notification(
        template_name="nozzle_sales_trend.html",
        to_recipients=["sandesh.mane@hpcl.in"],
        subject="Nozzle sales of MS Sales and Power daily sales Trend monitoring",
        cc_recipients=["gkpatel@hpcl.in"],
        bcc_recipients=["adityapandey@hpcl.in", "arpitaKanak.Bara@hpcl.in" , "shrikantsaini@hpcl.in", "vgupta@hpcl.in", "avinashgaurav@hpcl.in", "sreedhar.maddipati@algofusiontech.com",
                        "venu@algofusiontech.com", "moufikali@algofusiontech.com", "aditya@algofusiontech.com",
                        "yesu.p@algofusiontech.com", "vamsi.c@algofusiontech.com", "manohar.v@algofusiontech.com", "gayathri.m@algofusiontech.com",
                        "poojitha.gumma@algofusiontech.com","mrudula.m@algofusiontech.com", "mohith.p@algofusiontech.com","pawann.k@algofusiontech.com"],
        notification_data=status_data,
        inline_images={
            "nozzle_trend_chart": f"{status_data.get('nozzle_trend_chart')}"
        }
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
