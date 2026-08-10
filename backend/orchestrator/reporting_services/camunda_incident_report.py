import urdhva_base
import os
import asyncio
import csv
import json
import time 
import requests
import tempfile
import jinja2
import polars as pl
import hpcl_ceg_model
from datetime import datetime
from zoneinfo import ZoneInfo
from openpyxl import Workbook
import orchestrator.notification_manager.notification_factory


CAMUNDA_INSTANCES = urdhva_base.settings.camunda_configuration
CAMUNDA_DRYOUT_INSTANCES = urdhva_base.settings.camunda_url_config

header = ["id", "processDefinitionId", "processInstanceId", "executionId", "incidentTimestamp", "incidentType", 
              "activityId", "failedActivityId", "causeIncidentId", "rootCauseIncidentId", "configuration", "incidentMessage",
              "tenantId", "jobDefinitionId", "annotation", "server_type", "host", "port"]


def fetching_incidnets_from_server():
    server_instances = []

    # Handling CAMUNDA_INSTANCES (TAS,RO,LPG)
    for group, configs in CAMUNDA_INSTANCES.items():
        for con in configs:
            name= con.get("alert_section")    
            url = con.get("url")
            replace_http = url.replace("http://", "")
            split_url = replace_http.split(":")
            server_instances.append({
                "server_type": group+"-"+name,
                "host": split_url[0],
                "port": int(split_url[1])
            })

    # Handling CAMUNDA_DRYOUT_INSTANCES
    for name, config in CAMUNDA_DRYOUT_INSTANCES.items():
        server_instances.append({
            "server_type": "DRYOUT",
            "host": config["host"],
            "port": config["port"]
        })
    return server_instances


def fetch_incidents():
    """fetching all Camunda incidents from all configured camunda instances"""
    all_incidents = []
    camunda_instances = fetching_incidnets_from_server()
    for instance in camunda_instances:
        url= f"http://{instance['host']}:{instance['port']}/engine-rest/incident"
        try:
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            incidents = response.json()
            for inc in incidents:
                inc["server_type"] = instance["server_type"]
                inc["host"] = instance["host"]
                inc["port"] = instance["port"]
                all_incidents.append(inc)
                
        except Exception as e:
            print(f"Error in getting incidents information from {instance['host']}:{instance['port']} → {e}")

    return all_incidents


def generate_excel(all_incidents):
    temp = tempfile.NamedTemporaryFile(prefix="incident_result_", suffix=".xlsx", delete=False)
    EXCEL_PATH = temp.name
    temp.close()
    wb = Workbook()
    ws = wb.active
    ws.title = "Camunda Incident"
    ws.append(header)

    for row in all_incidents:
        ws.append([row.get(h) for h in header])

    wb.save(EXCEL_PATH)
    return EXCEL_PATH


def generate_csv(all_incidents):
   temp = tempfile.NamedTemporaryFile(prefix="incident_result_", suffix=".csv", delete=False)
   CSV_PATH = temp.name
   temp.close()
   df = pl.DataFrame(all_incidents)
   df.write_csv(CSV_PATH)
   return CSV_PATH


def incident_summary(incidents):
    """
    Creates count of incidents grouped by server_type, host, and port
    """
    counter = {}
    summary= []
    for server in fetching_incidnets_from_server():
        counter[(server["server_type"], server["host"], server["port"])] = 0
        
    for inc in incidents:
        inc["server_type"] = inc["server_type"]
        inc["host"] = inc["host"]
        inc["port"] = inc["port"]
        counter[(inc["server_type"], inc["host"], inc["port"])] += 1

    for (server_type, host, port), count in counter.items():
        summary.append({
            "server_type": server_type,
            "host": host,
            "port": port,
            "count": count
        })
    
    return summary


async def send_email(template_name, to_recipients, subject, cc_recipients, final_data, attachments=None):

    ins = await orchestrator.notification_manager.notification_factory.get_notification_module("email")

    # Load HTML template
    template_path = os.path.join(
        os.path.dirname(hpcl_ceg_model.__file__),
        '..', 'orchestrator', 'reporting_services',
        'templates', template_name
        )

    with open(template_path, "r") as f:
        template = jinja2.Template(f.read())

    html_body = template.render(**final_data)

    # Send email
    await ins.publish_message(
        subject=subject,
        recipients=to_recipients,
        cc_recipients=cc_recipients,
        html_content=True,
        body=html_body,
        force_send=True,
        inline_images={},
        attachments=attachments or []
    )


async def main():
    print("Triggered at:", datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%d-%m-%Y %I:%M %p"))
    result = fetch_incidents()
    if not result:
        print(f"No incident triggered")
        return 
    
    excel_path = generate_excel(result)
    csv_path = generate_csv(result)

    summary = incident_summary(result)
    summary = sorted(summary, key=lambda summary: summary['count'], reverse=True)
    email_data = {
        "generated_time": datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%d-%m-%Y %I:%M %p"),
        "summary": summary
    }

    await send_email(
        template_name="camunda_incident.html",
        to_recipients=["sreedhar.maddipati@algofusiontech.com","bala@algofusiontech.com"],
        subject="Camunda Incident Alert (Critical)",
        cc_recipients=["venu@algofusiontech.com", "moufikali@algofusiontech.com", "aditya@algofusiontech.com", 
                       "yesu.p@algofusiontech.com", "manohar.v@algofusiontech.com", "gayathri.m@algofusiontech.com",
                        "jayaprakash.v@algofusiontech.com", "mohith.p@algofusiontech.com", 
                        "poojitha.gumma@algofusiontech.com", "pawann.k@algofusiontech.com"],
        final_data=email_data, 
        attachments=[csv_path, excel_path]
    )
    if csv_path and os.path.exists(csv_path):
       try:
            os.remove(csv_path)
            print(f"Temporary CSV file '{csv_path}' deleted successfully.")
       except Exception as e:
            print(f"Error deleting temporary CSV file '{csv_path}': {e}")
    if excel_path and os.path.exists(excel_path):
        try:
            os.remove(excel_path)
            print(f"Temporary Excel file '{excel_path}' deleted successfully.")
        except Exception as e:
            print(f"Error deleting temporary Excel file '{excel_path}': {e}")

    
if __name__ == "__main__":
    asyncio.run(main())
