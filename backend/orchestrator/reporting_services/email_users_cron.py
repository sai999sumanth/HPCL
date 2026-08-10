import urdhva_base
import hpcl_ceg_model
import asyncio
import subprocess
import sys
import os


async def main():

    # audience = sys.argv[1]
    if len(sys.argv) < 2:
        print("Usage: python email_users_cron.py <audience>")
        sys.exit(1)

    audience = sys.argv[1]
    write_to_db = "true" if len(sys.argv) > 2 and sys.argv[2].lower() == "true" else "false"

    existing_users = await hpcl_ceg_model.DailyEmailNotificationUsers.get_all(
        urdhva_base.queryparams.QueryParams(q=f"audience='{audience}'", limit=0),
        resp_type='plain')
    print("existing_users----->\n", existing_users)

    enabled_types = set()

    for user in existing_users["data"]:

        if user.get("enabled", True):
            enabled_types.add(user["email_type"].lower())

    print(f"Enabled email types: {enabled_types}")

    email_types_arg = f"[{','.join(enabled_types)}]"
    if not enabled_types:
        print("No enabled email types found")
        return

    script_path = os.path.abspath(
        os.path.join(
            os.path.dirname(hpcl_ceg_model.__file__),
            '..',
            'orchestrator',
            'reporting_services',
            'novex_daily_report_combined_test.py'
        )
    )

    cmd = [
        sys.executable,
        script_path,
        write_to_db,
        audience,
        email_types_arg
    ]

    print(f"Executing: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)


if __name__ == "__main__":
    asyncio.run(main())
