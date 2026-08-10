import urdhva_base
import os
import jinja2
import asyncio
import hpcl_ceg_model
import time
import utilities.helpers as helpers
import orchestrator.notification_manager.notification_factory as notification_factory


async def send_notification(
    template_name,
    to_recipients,
    cc_recipients=None,
    bcc_recipients=None,
    notification_data=None,
    inline_images=None
):
    """
    Send email with HTML template + optional inline images.
    """

    # Load Jinja2 template
    template_path = os.path.join(
        os.path.dirname(hpcl_ceg_model.__file__),
        "..", "orchestrator", "reporting_services", "templates", template_name
    )
    with open(template_path, "r") as f:
        template_data = jinja2.Template(f.read())

    # Render HTML
    final_data = template_data.render(**(notification_data or {}))

    # Save rendered HTML for debugging
    tmp_file = f"/tmp/{template_name}"
    with open(tmp_file, "w") as f:
        f.write(final_data)

    # Send email
    ins = await notification_factory.get_notification_module("email")
    await ins.publish_message(
        subject="HP Pay Daily Report",
        recipients=to_recipients,
        cc_recipients=cc_recipients or [],
        bcc_recipients=bcc_recipients or [],
        html_content=True,
        body=final_data,
        inline_images=inline_images or {},
        force_send=True
    )


async def publish_daily_novex_status_email():
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

    await send_notification(
        template_name="hp_pay.html",
        to_recipients=["anujjain@hpcl.in","kapild@hpcl.in"],
        cc_recipients=["gargam@hpcl.in","sanjayk@hpcl.in"],
        bcc_recipients=["cvmallinath@hpcl.in"],
        notification_data=status_data,
        inline_images={
            "hppay_logo": "/tmp/image.png"
        }
    )

    time.sleep(3)

    await send_notification(
        template_name="hp_pay.html",
        to_recipients=["rajkumar@hpcl.in","handakk@hpcl.in","shubhendugupta@hpcl.in"],
        cc_recipients=["gkpatel@hpcl.in"],
        bcc_recipients=["rujutadoiphode@hpcl.in","purushm@hpcl.in","ashish.jayaswal@hpcl.in","adityapandey@hpcl.in"],
        notification_data=status_data,
        inline_images={
            "hppay_logo": "/tmp/image.png"
        }
    )
if __name__ == "__main__":
    asyncio.run(publish_daily_novex_status_email())
