import urdhva_base
import sys
import ast
import time
import asyncio
import psycopg2
import argparse
import pandas as pd
import jinja2
import mysql.connector
import multiprocessing
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor
from functools import partial
sys.path.append("/opt/ceg/algo")
import api_manager.hpcl_ceg_model as hpcl_ceg_model
import orchestrator.dbconnector.credential_loader as credential_loader
import orchestrator.reporting_services.reporting_config as reporting_config
import orchestrator.notification_manager.notification_factory as notification_factory



_REPORTING_DIR = Path(__file__).resolve().parent
_TEMPLATES_DIR = _REPORTING_DIR / "templates"

# Syncable business units (lowercase keys used in reporting_config and CLI).
EMAIL_RECIPIENTS = {
    "to_receipts": ["venu@algofusiontech.com"],
    "cc_receipts": ["moufikali@algofusiontech.com", "sreedhar.maddipati@algofusiontech.com",
                    "yesu.p@algofusiontech.com", "poojitha.gumma@algofusiontech.com",
                    "pawann.k@algofusiontech.com", "mohith.p@algofusiontech.com",
                    "manohar.v@algofusiontech.com", "gayathri.m@algofusiontech.com",
                    "vamsi.c@algofusiontech.com"],
    "bcc_receipts": [],
}


async def get_db_connection():
    """
    Establish a database connection
    Args:
        connection_string (str): Database connection string
    Returns:
        pyodbc connection
    """
    creds = credential_loader.get_credentials('TIBCO')
    connection = mysql.connector.connect(
                host=creds['host'],
                user=creds['user'],
                passwd=creds['password'],
                port=creds['port'],
                database=creds['database']
            )
    return connection

def _app_pg_conn():
    creds = credential_loader.get_credentials("APP_DB")
    return psycopg2.connect(
        host=creds["host"],
        database=creds["database"],
        user=creds["user"],
        password=creds["password"],
        port=creds["port"],
    )

def _empty_bu_report(bu: str, **kwargs) -> Dict[str, Any]:
    base = {
        "bu": bu.upper(),
        "status": "pending",
        "old_synced_count": 0,
        "new_synced_count": 0
    }
    base.update(kwargs)
    base["total_records_synced"] = int(base.get("records_upserted") or 0) + int(
        base.get("records_upserted_dealers") or 0
    )
    return base

def count_app_db_locations_for_bu(bu_upper: str) -> int:
    """Count locations in APP_DB for a business unit (``bu`` array contains ``bu_upper``)."""
    conn = _app_pg_conn()
    try:
        cur = conn.cursor()
        query = """
            SELECT COUNT(*) 
            FROM location_master
            WHERE bu = %s
        """
        print("Final Query:", query.replace("%s", f"'{bu_upper}'"))

        cur.execute(query, (bu_upper,))

        (n,) = cur.fetchone()
        print(f"BU: {bu_upper} → Count: {n}")
        cur.close()
        return int(n or 0)
    finally:
        conn.close()


def render_novex_locations_sync_report_html(
    report_rows: List[Dict[str, Any]],
    *,
    sync_start_ist: str,
    sync_end_ist: str,
    environment: str,
) -> str:
    """Render HTML email-style report using Jinja2 (timestamps are IST strings)."""
    path = _TEMPLATES_DIR / "novex_location_master_sync.html"
    if not path.is_file():
        raise FileNotFoundError(f"Report template missing: {path}")
    with open(path, "r", encoding="utf-8") as f:
        template = jinja2.Template(f.read())
    return template.render(
        report_rows=report_rows,
        sync_start_ist=sync_start_ist,
        sync_end_ist=sync_end_ist,
        environment=environment
    )


async def fetch_data(cursor, query, getData=False, params=None):
    """
    Fetch data from database using a SQL query
    Args:
        cursor (pyodbc cursor): Database cursor
        query (str): SQL query to execute
    Returns:
        pandas DataFrame
    """        
    print("-" * 50)
    print("query -->", query)
    print("-" * 50)
    print("Running Query ...")
    cursor.execute(query)
    data = cursor.fetchall()
    print('Total Records :', len(data))
    columns = [column[0] for column in cursor.description]
    data = pd.DataFrame.from_records(data, columns=columns)
    return data


async def clear_existing_location_master(bu, data):
    creds = credential_loader.get_credentials('APP_DB')
    pg_conn = psycopg2.connect(
                host=creds["host"],
                database=creds["database"],
                user=creds["user"],
                password=creds["password"],
                port=creds["port"]
            )    
    cursor = pg_conn.cursor()

    required_data = await fetch_data(cursor, "select sap_id from location_master where location_onboard IS TRUE")
    data["location_onboard"] = False
    data.loc[data["sap_id"].isin(required_data["sap_id"]), "location_onboard"] = True

    query = f""" DELETE FROM location_master WHERE bu='{bu.upper()}' AND location_onboard IS FALSE AND name NOT ILIKE '%import%'; """
    cursor.execute(query)
    pg_conn.commit()
    cursor.close()
    pg_conn.close()
    

async def insert_location_data(data):
    for item in data:
        for key in ['sales_area_1']:
            if key in item.keys():
                if item[key] == None or item[key] == "":
                    item[key] = []
                elif isinstance(item[key], str):
                    item[key] = ast.literal_eval(item[key])
    await hpcl_ceg_model.LocationMaster.bulk_update(data, upsert=True)


async def combine_roles(data, _id, role_name):
    """
    Combine the different roles of single users into list of roles and removes the duplicates
    Arg:
        data : Pandas DataFrame
        _id : Column Name of employee_id
        role_name:  Column Name of role name
    Return:
         data : Pandas Dataframe
    """
    print("length of data before combine :", len(data))
    aggregation_dict = {col: (lambda x: str(list(set(x)))) for col in role_name}
    grouped = data.groupby(_id).agg(aggregation_dict).reset_index()
    data = data.drop_duplicates(_id, keep="first")
    for col in role_name:
        del data[col]
    data = pd.merge(data, grouped, on=_id, how="left")
    print("length of data after combine :", len(data))
    return data


async def process_data(data):
    data.rename(columns=reporting_config._rename, inplace=True)
    if all(col in data.columns for col in ["ADDRESS1","ADDRESS2","ADDRESS3","ADDRESS4","ADDRESS5"]):
        data['address'] = data[["ADDRESS1", "ADDRESS2", "ADDRESS3", "ADDRESS4", "ADDRESS5"]].fillna('').agg(' '.join, axis=1)
    elif all(col in data.columns for col in ["land_mark","location","pincode"]):
        data["address"] = data["land_mark"].astype(str) + " " + data["location"].astype(str) + " " + data["pincode"].astype(str)
    
    data['health_status'] = "Normal"
    data['is_active'] = True
    if "sap_id" in data.columns:
        data = data.drop_duplicates('sap_id', keep='first')
    for col, _type in reporting_config.location_master_schema.items():
        if not col in data.columns:
            if _type.lower() == 'varchar':
                data[col] = ""
            elif _type.lower() == 'boolean':
                data[col] = False
            elif _type.lower() == 'timestamp':
                data[col] = None
            elif _type.lower() == 'integer':
                data[col] = 0
    for col, _type in reporting_config.location_master_schema.items():
        if _type.lower() == 'varchar':
            data[col] = data[col].fillna("")
    if "email" in data.columns:
        data["email"] = data["email"].fillna("").astype(str)
    data = data[list(reporting_config.location_master_schema.keys())]
    data['zone'] = data['zone'].map(reporting_config.zone_map)
    print("Before dropping blank Zone :", len(data))
    data = data[data["zone"].fillna("") != ""]
    print("After dropping blank Zone :", len(data))
    data = data.drop_duplicates(["sap_id"])
    print("After dropping duplicates :", len(data))
    return data


async def sync_location_master(bus_list=None,send_email=True):
    connection = await get_db_connection()
    report_rows: List[Dict[str, Any]] = []
    sync_start_ist = urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d %H:%M:%S")
    cursor = connection.cursor()
    for config in reporting_config.location_configs:
        config_bu = config.get("bu", "").lower()
        # Skip configs not passed in parser
        if bus_list and config_bu not in bus_list:
            continue
        if not config.get("query"):
            print(f"Skipping BU {config_bu.upper()} → No query found")

            old_location_count = count_app_db_locations_for_bu(config_bu.upper())
            new_record_count = count_app_db_locations_for_bu(config_bu.upper())
            report_rows.append(
                _empty_bu_report(
                    config_bu,
                    status="skipped",
                    old_synced_count=old_location_count,
                    new_synced_count=new_record_count
                )
            )
            continue

        old_location_count = count_app_db_locations_for_bu(config_bu.upper())
        data = await fetch_data(cursor, config.get("query"))
        for col in ["PLANT", "REPORTING_OFFICE"]:
            if col in data.columns:
                data[col] = data[col].fillna(0).astype(str).replace('',0).astype(int).astype(str)
        for col in ["RO_CODE", "SALES_OFFICE_DESC", "SALES_GROUP_DESC"]:
            if config.get("reporting_office_query", None) and col in data.columns:
                del data[col]
        if config.get("reporting_office_query", None):
            data_ro = await fetch_data(cursor, config.get("reporting_office_query"))
            data_ro = await combine_roles(data_ro, _id="RO_CODE", role_name=["SALES_GROUP_DESC"])
            data = pd.merge(data, data_ro[["RO_CODE", "SALES_OFFICE_DESC", "SALES_GROUP_DESC"]],
                            left_on="REPORTING_OFFICE", right_on="RO_CODE", how="left")
        data["bu"] = config.get("bu", "").upper()
        data = await process_data(data)
        await clear_existing_location_master(config.get("bu", ""), data)
        await insert_location_data(data.to_dict(orient="records"))
        new_record_count = count_app_db_locations_for_bu(config_bu.upper())
        print("new_record_count---->\n", new_record_count)
        report_rows.append(
            _empty_bu_report(
                config_bu,
                status="success",
                old_synced_count=old_location_count,
                new_synced_count= new_record_count
                )
            )
        
        sync_end_ist = urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d %H:%M:%S")

    
    if send_email:
        environment = urdhva_base.settings.environment.upper() or "PROD"
        print("report_rows---->", report_rows)
        html = render_novex_locations_sync_report_html(
            report_rows,
            sync_start_ist= sync_start_ist,
            sync_end_ist= sync_end_ist,
            environment=environment
        )

        ins = await notification_factory.get_notification_module("email")
        await ins.publish_message(
            subject="Novex Location Details Sync Report(From Tibco)",
            recipients=EMAIL_RECIPIENTS['to_receipts'],
            cc_recipients=EMAIL_RECIPIENTS['cc_receipts'] or [],
            bcc_recipients=EMAIL_RECIPIENTS['bcc_receipts'] or [],
            html_content=True,
            body=html,
            force_send=True,
            inline_images={},
            attachments=[]
        )


if __name__=="__main__":

    parser = argparse.ArgumentParser(
        description="Sync Location Master by Business Unit"
    )

    parser.add_argument(
        "--bu",
        nargs="*",
        default=None,
        help="Example: --bu lpg ro tas"
    )

    args = parser.parse_args()

    bus_list = [x.lower() for x in args.bu] if args.bu else None

    asyncio.run(sync_location_master(bus_list))