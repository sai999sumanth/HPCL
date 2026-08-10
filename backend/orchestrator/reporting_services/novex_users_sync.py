import urdhva_base
import re
import ast
import json
import time
import jinja2
import asyncio
import argparse
import tempfile
import psycopg2
import traceback
import pandas as pd
import hpcl_ceg_model
import datetime as dt
import mysql.connector
from pathlib import Path
import urdhva_base.utilities
from typing import Any, Dict, List, Optional, Tuple

import orchestrator.dbconnector.credential_loader as credential_loader
import orchestrator.reporting_services.reporting_config as reporting_config
import orchestrator.notification_manager.notification_factory as notification_factory

_REPORTING_DIR = Path(__file__).resolve().parent
_TEMPLATES_DIR = _REPORTING_DIR / "templates"

# Syncable business units (lowercase keys used in reporting_config and CLI).
VALID_BUS = ("lpg", "tas", "ro", "ds")
EMAIL_RECIPIENTS = {
    "to_receipts": ["venu@algofusiontech.com"],
    "cc_receipts": ["moufikali@algofusiontech.com", "sreedhar.maddipati@algofusiontech.com",
                    "yesu.p@algofusiontech.com", "poojitha.gumma@algofusiontech.com",
                    "pawann.k@algofusiontech.com", "mohith.p@algofusiontech.com",
                    "manohar.v@algofusiontech.com", "gayathri.m@algofusiontech.com",
                    "vamsi.c@algofusiontech.com"],
    "bcc_receipts": [],
}

def _app_pg_conn():
    creds = credential_loader.get_credentials("APP_DB")
    return psycopg2.connect(
        host=creds["host"],
        database=creds["database"],
        user=creds["user"],
        password=creds["password"],
        port=creds["port"],
    )


def count_app_db_users_for_bu(bu_upper: str, *, manual: bool) -> int:
    """Count users in APP_DB for a business unit (``bu`` array contains ``bu_upper``)."""
    conn = _app_pg_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT COUNT(*) FROM users
            WHERE %s = ANY(bu) AND manual_user IS %s
            """,
            (bu_upper, manual),
        )
        (n,) = cur.fetchone()
        cur.close()
        return int(n or 0)
    finally:
        conn.close()


def _empty_bu_report(bu: str, **kwargs) -> Dict[str, Any]:
    base = {
        "bu": bu.upper(),
        "status": "pending",
        "old_auto_user_count": 0,
        "new_auto_user_count": 0,
        "manual_user_count": 0,
        "records_prepared": 0,
        "excluded_manual_overlap": 0,
        "dedupe_removed": 0,
        "records_upserted": 0,
        "records_upserted_dealers": 0,
        "error": "",
    }
    base.update(kwargs)
    base["total_records_synced"] = int(base.get("records_upserted") or 0) + int(
        base.get("records_upserted_dealers") or 0
    )
    return base


def render_novex_users_sync_report_html(
    report_rows: List[Dict[str, Any]],
    *,
    sync_start_ist: str,
    sync_end_ist: str,
    environment: str,
) -> str:
    """Render HTML email-style report using Jinja2 (timestamps are IST strings)."""
    path = _TEMPLATES_DIR / "novex_users_sync_report.html"
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


def _parse_bus_list(bus_args):
    """Normalize and validate BU codes from CLI."""
    if not bus_args:
        return list(VALID_BUS)
    seen = []
    for raw in bus_args:
        b = raw.strip().lower()
        if b not in VALID_BUS:
            valid = ", ".join(VALID_BUS)
            raise SystemExit(f"Invalid BU {raw!r}. Choose one or more of: {valid}")
        if b not in seen:
            seen.append(b)
    return seen


async def get_db_connection():
    """
    Establish a MySQL (TIBCO) database connection using credential_loader.

    Returns:
        mysql.connector connection
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


async def fetch_data(cursor, query):
    """
    Run a SQL query and return rows as a pandas DataFrame.

    Args:
        cursor: MySQL cursor
        query (str): SQL to execute

    Returns:
        pandas.DataFrame
    """
    cursor.execute(query)
    data = cursor.fetchall()
    print('Total Records :', len(data))
    columns = [column[0] for column in cursor.description]
    data = pd.DataFrame.from_records(data, columns=columns)
    return data    


async def clear_existing_user(bu):
    creds = credential_loader.get_credentials('APP_DB')
    pg_conn = psycopg2.connect(
                host=creds["host"],
                database=creds["database"],
                user=creds["user"],
                password=creds["password"],
                port=creds["port"]
            )
    query = f""" DELETE FROM users WHERE '{bu.upper()}' = ANY(bu) and manual_user IS FALSE; """
    cursor = pg_conn.cursor()
    cursor.execute(query)
    pg_conn.commit()
    cursor.close()
    pg_conn.close()


def _normalize_emp_key(val) -> str:
    """Match ``process_data`` normalization for employee_id / username."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ""
    x = str(val).replace(".00", "").replace(".0", "").lstrip("0")
    return x


async def fetch_manual_user_keys_for_bu(bu: str) -> set:
    """
    Employee / username keys for users marked manual for this BU (must not be overwritten by sync).
    Includes raw and normalized forms for reliable matching.
    """
    creds = credential_loader.get_credentials("APP_DB")
    pg_conn = psycopg2.connect(
        host=creds["host"],
        database=creds["database"],
        user=creds["user"],
        password=creds["password"],
        port=creds["port"],
    )
    keys: set = set()
    try:
        cur = pg_conn.cursor()
        cur.execute(
            """
            SELECT employee_id, username FROM users
            WHERE manual_user IS TRUE AND %s = ANY(bu)
            """,
            (bu.upper(),),
        )
        for employee_id, username in cur.fetchall():
            for val in (employee_id, username):
                if val is None:
                    continue
                s = str(val).strip()
                if not s:
                    continue
                keys.add(s)
                keys.add(_normalize_emp_key(s))
        cur.close()
    finally:
        pg_conn.close()
    return keys


def exclude_manual_users_from_dataframe(
    data: pd.DataFrame, manual_keys: set
) -> Tuple[pd.DataFrame, int]:
    if data.empty or not manual_keys:
        return data, 0
    emp = data["employee_id"].map(_normalize_emp_key)
    usr = data["username"].map(_normalize_emp_key)
    raw_emp = data["employee_id"].astype(str)
    raw_usr = data["username"].astype(str)
    mask = ~(emp.isin(manual_keys) | usr.isin(manual_keys) | raw_emp.isin(manual_keys) | raw_usr.isin(manual_keys))
    dropped = int((~mask).sum())
    if dropped:
        print(f"Excluded {dropped} sync row(s) that match manual_user in APP_DB for this BU")
    return data.loc[mask].copy(), dropped


def _dedupe_user_records_for_bulk(records: list) -> Tuple[list, int]:
    """
    Postgres rejects ``ON CONFLICT DO UPDATE`` if the same batch proposes two rows
    with identical ``upsert_keys`` (``username``, ``employee_id``). Keep last row per key.
    """
    if not records:
        return records, 0
    by_key = {}
    for rec in records:
        u = str(rec.get("username") or "")
        e = str(rec.get("employee_id") or "")
        by_key[(u, e)] = rec
    out = list(by_key.values())
    dropped = len(records) - len(out)
    if dropped:
        print(
            f"Deduplicated {dropped} duplicate username/employee_id row(s) "
            f"before bulk upsert ({len(records)} -> {len(out)})"
        )
    return out, dropped


async def insert_users(data: list) -> Tuple[int, int]:
    """
    Normalize list-of-dict rows and upsert in one bulk operation.
    Returns ``(upserted_row_count, dedupe_removed_count)``.
    """
    if not data:
        print("No users to upsert")
        return 0, 0

    BATCH_SIZE = 800
    total_upserted = 0
    total_dedupe = 0
    for i in range(0, len(data), BATCH_SIZE):
        batch = data[i:i + BATCH_SIZE]

        for item in batch:
            for key in ["bu", "sap_id", "region", "state", "zone", "sales_area", "system_role", "novex_role"]:
                if item.get(key) is None or item[key] == "":
                    item[key] = []
                if isinstance(item[key], str):
                    item[key] = ast.literal_eval(item[key])
            if not item.get("escalation_level"):
                item["escalation_level"] = None
            if item.get("password") in (None, ""):
                item["password"] = None

        batch, dedupe_dropped = _dedupe_user_records_for_bulk(batch)
        total_dedupe += dedupe_dropped

        if not batch:
            print("Batch empty after dedupe, skipping")
            continue

        try:
            print(f"Upserting batch size: {len(batch)}")
            await hpcl_ceg_model.Users.bulk_update(
                batch,
                upsert=True,
                upsert_skip_keys=["password"],
            )
            total_upserted += len(batch)

        except Exception as e:
            print(f"Batch failed at index {i}: {e}")
            traceback.print_exc()
            raise

    return total_upserted, total_dedupe


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


async def process_data(data, bu):
    novex_model_col = ["username", "email", "first_name", "last_name", "password", "employee_id",
                       "employee_number", "bu", "sap_id", "system_role", "novex_role", "region",
                       "state", "zone", "sales_area", "is_ad_user", "status", "manual_user", "contact_number", "mfa"]
    data.rename(columns={"EMPLOYEE_NUMBER": "username", "EMPLOYEE_NAME": "first_name",
                                "EMP_EMAIL": "email", "PLANT_CODE": "sap_id", "PLANT_DESC": "region",
                                "Zone": "zone", "ROLE_NAME": "system_role"}, inplace=True)
    if "SALES_GRP" in data.columns and bu.upper()=='LPG':
        sales_master = pd.read_csv(_REPORTING_DIR / "lpg_sa_master.csv")
        data['SALES_GRP'] = data['SALES_GRP'].astype(str)
        sales_master['SACode'] = sales_master['SACode'].astype(str)
        data = pd.merge(data, sales_master, left_on='SALES_GRP', right_on='SACode', how='left')
        data.rename(columns={"SAName": "sales_area"}, inplace=True)
    elif "SALES_GROUP_DESC" in data.columns and bu != 'LPG':
        data["sales_area"] = data["SALES_GROUP_DESC"]
    print("Before dropping empty username :", len(data))
    data = data[data["username"].fillna("") != ""]
    print("After dropping empty username :", len(data))
    for col in ["status", "is_ad_user", "mfa"]:
        data[col] = True
    data["employee_id"] = data["username"]
    data["manual_user"] = False
    for col in ["username", "sap_id", "employee_id"]:
        if col in data.columns:
            data[col] = data[col].astype(str).apply(lambda x: x.replace('.00', '').replace('.0', '').lstrip('0'))
    data['zone'] = data['zone'].map(reporting_config.zone_map)
    data['last_name'] = data['first_name'].fillna("").apply(lambda x: x.split(" ")[-1] if " " in x else "")
    data['first_name'] = data['first_name'].fillna("").apply(lambda x: x.rstrip(x.split(" ")[-1]) if " " in x else x)
    for col in ["zone", "region", "state", "sap_id", "bu", "sales_area"]:
        if col in data.columns:
            data[col] = data[col].fillna("").astype(str)
            data[col] = '["' + data[col] + '"]'
    data["email"] = data["email"].fillna("").astype(str)

    for _role in ["Zonal", "Zone"]:
        mask = data["novex_role"].astype(str).str.contains(_role, case=False, na=False)
        data.loc[mask, ["sap_id", "region", "sales_area"]] = '[]'

    for _role in ["Regional", "Region"]:
        mask = data["novex_role"].astype(str).str.contains(_role, case=False, na=False)
        data.loc[mask, ["sap_id", "zone", "sales_area"]] = '[]'
    for _role in ["Sales"]:
        mask = data["novex_role"].astype(str).str.contains(_role, case=False, na=False)
        data.loc[mask, ["sap_id", "region", "zone"]] = '[]'
    for _role in ["HQO"]:
        mask = data["novex_role"].astype(str).str.contains(_role, case=False, na=False)
        data.loc[mask, ["sap_id", "zone", "region", "sales_area"]] = '[]'

    for col in ["region", "sales_area"]:
        data.loc[(data['sap_id'] != '[]'), col] = '[]'

    def update_ticketing_role(role):
        """
        ``combine_roles`` stores ``novex_role`` as ``str(list(...))``, so values are
        strings here — normalize to a list before appending ticketing roles.
        """
        if role is None or (isinstance(role, float) and pd.isna(role)):
            roles: List[str] = []
        elif isinstance(role, list):
            roles = [str(x) for x in role]
        else:
            s = str(role).strip()
            if s.startswith("[") and s.endswith("]"):
                try:
                    parsed = ast.literal_eval(s)
                    roles = [str(x) for x in parsed] if isinstance(parsed, list) else [str(parsed)]
                except (ValueError, SyntaxError):
                    roles = [s] if s else []
            else:
                roles = [s] if s else []

        # Substring / regex checks mirror the pre-fix behavior when ``novex_role`` was
        # ``str(list(...))`` from ``combine_roles`` (one string cell, not a real list).
        role_text = " ".join(roles)
        if "Zonal Head SOD" in role_text:
            if "Zonal Head SOD Ticketing" not in role_text:
                roles.append("Zonal Head SOD Ticketing")
        elif re.search(r"\bzone\b|\bzonal\b", role_text, re.IGNORECASE):
            if "Zonal SOD Ticketing" not in role_text:
                roles.append("Zonal SOD Ticketing")
        return roles

    if bu.upper() == 'TAS':
        data["novex_role"] = data["novex_role"].apply(update_ticketing_role)

    for col in novex_model_col:
        if not col in data.columns:
            data[col] = ""
    data["contact_number"] = data["contact_number"].astype(str)
    data = data[novex_model_col]

    return data


async def get_additional_data(bu, cursor):
    queries = getattr(reporting_config, f"additional_{bu}_query", None)
    additional_data = pd.DataFrame()
    if queries:
        for query in queries:
            additional_data = pd.concat([additional_data, await fetch_data(cursor, query)])
        
        additional_data.loc[
            (additional_data["ROLE_NAME"].fillna("") == "IL_DGM_LPGOPNNFP") &
            (additional_data["ZLOC_TYPE"].fillna("").str.contains("91|99")),
            "novex_role"
        ] = "HQO Operations LPG"
        additional_data.loc[
            (additional_data["ROLE_NAME"].fillna("") == "IL_DGM_LPGOPNNFP") &
            (additional_data["ZLOC_TYPE"].fillna("").str.contains("90|68")),
            "novex_role"
        ] = "Zonal Operations LPG"
        
        # For IL_MANAGER_LPG
        additional_data.loc[
            (additional_data["ROLE_NAME"].fillna("") == "IL_MANAGER_LPG") &
            (additional_data["ZLOC_TYPE"].fillna("").str.contains("90|68")),
            "novex_role"
        ] = "Zonal Manager LPG"
        additional_data.loc[
            (additional_data["ROLE_NAME"].fillna("") == "IL_MANAGER_LPG") &
            (additional_data["ZLOC_TYPE"].fillna("").str.contains("91|99")),
            "novex_role"
        ] = "HQO Manager LPG"

        additional_data.loc[
            (additional_data["ROLE_NAME"].fillna("") == "IL_CHMNGR_LPGHSEZONE"),
            "novex_role"
        ] = "Zonal HSE LPG"
        additional_data.loc[
            (additional_data["ROLE_NAME"].fillna("") == "IL_LPGCONT_OFFCER"),
            "novex_role"
        ] = "Location In-Charge LPG"
        
        additional_data = additional_data[additional_data["ZLOC_TYPE"].fillna("") != ""]
    return additional_data


def split_name(name):
    if not isinstance(name, str) or not name.strip():
        return "", ""
    parts = name.split()
    if len(parts) == 1:
        return name, ""
    else:
        return " ".join(parts[:-1]), parts[-1]


async def insert_ro_dealer(cursor) -> int:
    """Upsert RO dealer rows from location config. Returns total rows upserted (0 if none)."""
    total_upserted = 0
    for config in reporting_config.location_configs:
        if config["bu"].lower() == "ro":
            query = config["query"]
            data = await fetch_data(cursor, query)
            data["PLANT"] = data["PLANT"].astype(str).apply(lambda x: x.lstrip("00"))
            data["username"] = data["PLANT"]
            data["employee_id"] = data["PLANT"]
            data["employee_number"] = data["PLANT"]
            data["contact_number"] = data["dealer_phone"]
            data["password"] = ""
            data.rename(columns=reporting_config._rename, inplace=True)
            data['first_name'], data['last_name'] = zip(*data['name'].apply(split_name))
            data["novex_role"] = "RO Dealer"
            data["system_role"] = "RO Dealer"
            data["manual_user"] = False
            data["bu"] = 'RO'
            data['zone'] = data['zone'].map(reporting_config.zone_map)
            for col in ["zone", "region", "state", "sap_id", "bu", "sales_area", "novex_role", "system_role"]:
                if col in data.columns:
                    data[col] = data[col].fillna("").astype(str)
                    data[col] = '["' + data[col] + '"]'            
            for col in ["status", "is_ad_user", "mfa"]:
                data[col] = True
            for col in data.columns:
                data[col] = data[col].fillna("")
            data = data[reporting_config.novex_model_col]
            manual_keys = await fetch_manual_user_keys_for_bu("ro")
            data, _excl = exclude_manual_users_from_dataframe(data, manual_keys)
            print(f"Upserting {len(data)} users for RO Dealer")
            n, _d = await insert_users(data.to_dict(orient="records"))
            total_upserted += n
    return total_upserted


async def sync_users(bus_list=None) -> Dict[str, Any]:
    """
    Sync Novex users from TIBCO/MySQL into the app DB.

    Args:
        bus_list: Lowercase BU codes to run, e.g. ``["lpg", "ro"]``.
            If None or empty, all BUs in ``VALID_BUS`` are synced.

    Returns:
        Dict with ``report_rows`` (per-BU dicts), ``sync_start_ist``, ``sync_end_ist`` (IST strings).
    """
    if not bus_list:
        bus_list = list(VALID_BUS)

    sync_start_ist = urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d %H:%M:%S")
    report_rows: List[Dict[str, Any]] = []
    ro_success_idx: Optional[int] = None

    connection = await get_db_connection()
    cursor = connection.cursor()
    role_master_path = _REPORTING_DIR / "novex_role_master.csv"
    try:
        role_master_all = pd.read_csv(role_master_path)
        for bu in bus_list:
            bu_upper = bu.upper()
            query = getattr(reporting_config, f"{bu}_query", None)
            if not query:
                print(f"Warning: no query configured for BU {bu!r}; skipping.")
                oa = count_app_db_users_for_bu(bu_upper, manual=False)
                mc = count_app_db_users_for_bu(bu_upper, manual=True)
                report_rows.append(
                    _empty_bu_report(
                        bu,
                        status="skipped",
                        old_auto_user_count=oa,
                        new_auto_user_count=oa,
                        manual_user_count=mc,
                        error="No query configured for this BU.",
                    )
                )
                continue

            old_auto = count_app_db_users_for_bu(bu_upper, manual=False)
            manual_cnt = count_app_db_users_for_bu(bu_upper, manual=True)

            try:
                role_master = role_master_all[role_master_all["bu"] == str(bu).upper()]
                role_master = role_master.drop_duplicates("tibco_role")
                roles = role_master["tibco_role"].unique().tolist()
                if roles:
                    roles_condition = "ZR.ROLE_NAME IN ({})".format(
                        ", ".join([f"'{role}'" for role in roles])
                    )
                    query = f"{query} AND {roles_condition}"
                data = await fetch_data(cursor, query)

                if bu == "ds":
                    data.loc[
                        data["PLANT_DESC"].str.contains("DSRO", na=False),
                        "PLANT_DESC",
                    ] = data["PLANT_DESC"].str.replace("DSRO", "I&C RO", regex=False)

                print("Length of Data Before Merge:", len(data))
                data = pd.merge(
                    data,
                    role_master[["novex_role", "tibco_role"]],
                    left_on="ROLE_NAME",
                    right_on="tibco_role",
                    how="left",
                )
                print("Length of Data After Merge:", len(data))
                additional_data = await get_additional_data(bu, cursor)
                if not additional_data.empty:
                    data = pd.concat([data, additional_data])
                data = await combine_roles(
                    data, _id="EMPLOYEE_NUMBER", role_name=["ROLE_NAME", "novex_role"]
                )
                data["bu"] = bu_upper
                data = await process_data(data, bu)
                manual_keys = await fetch_manual_user_keys_for_bu(bu)
                data, excluded_ov = exclude_manual_users_from_dataframe(data, manual_keys)
                prepared = len(data)

                await clear_existing_user(bu)
                print(f"Upserting {prepared} users for BU - {bu_upper} ")
                upserted, dedupe_rm = await insert_users(data.to_dict(orient="records"))

                new_auto = count_app_db_users_for_bu(bu_upper, manual=False)

                row = _empty_bu_report(
                    bu,
                    status="success",
                    old_auto_user_count=old_auto,
                    new_auto_user_count=new_auto,
                    manual_user_count=manual_cnt,
                    records_prepared=prepared,
                    excluded_manual_overlap=excluded_ov,
                    dedupe_removed=dedupe_rm,
                    records_upserted=upserted,
                    records_upserted_dealers=0,
                )
                report_rows.append(row)
                if bu == "ro":
                    ro_success_idx = len(report_rows) - 1

            except Exception as e:
                tb = traceback.format_exc()
                print(tb)
                err_short = f"{type(e).__name__}: {e}"
                try:
                    new_auto = count_app_db_users_for_bu(bu_upper, manual=False)
                except Exception:
                    new_auto = 0
                report_rows.append(
                    _empty_bu_report(
                        bu,
                        status="failed",
                        old_auto_user_count=old_auto,
                        new_auto_user_count=new_auto,
                        manual_user_count=manual_cnt,
                        error=f"{err_short}\n\n{tb}",
                    )
                )

        if "ro" in bus_list:
            n_dealer = 0
            dealer_err: Optional[Exception] = None
            dealer_tb = ""
            try:
                n_dealer = await insert_ro_dealer(cursor)
            except Exception as e:
                dealer_err = e
                dealer_tb = traceback.format_exc()
                print(dealer_tb)

            def _apply_ro_dealers_to_row(idx: int) -> None:
                if dealer_err is not None:
                    report_rows[idx]["status"] = "failed"
                    prev = report_rows[idx].get("error") or ""
                    report_rows[idx]["error"] = (
                        prev
                        + f"\nRO Dealer phase failed — {type(dealer_err).__name__}: {dealer_err}\n\n"
                        + dealer_tb
                    )
                    return
                report_rows[idx]["records_upserted_dealers"] = n_dealer
                report_rows[idx]["total_records_synced"] = int(
                    report_rows[idx].get("records_upserted") or 0
                ) + int(n_dealer)
                report_rows[idx]["new_auto_user_count"] = count_app_db_users_for_bu(
                    "RO", manual=False
                )

            if ro_success_idx is not None and report_rows[ro_success_idx].get("status") == "success":
                _apply_ro_dealers_to_row(ro_success_idx)
            else:
                ro_any = next(
                    (i for i, r in enumerate(report_rows) if r.get("bu") == "RO"),
                    None,
                )
                if ro_any is not None:
                    _apply_ro_dealers_to_row(ro_any)
    finally:
        cursor.close()
        connection.close()

    sync_end_ist = urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d %H:%M:%S")
    return {
        "report_rows": report_rows,
        "sync_start_ist": sync_start_ist,
        "sync_end_ist": sync_end_ist,
    }


async def start_user_sync(bus_list, send_email=True):
    print(f"Syncing business units: {', '.join(b.upper() for b in bus_list)}")
    result = await sync_users(bus_list=bus_list)
    report = result["report_rows"]
    print(json.dumps(report, indent=2, default=str))
    if send_email:
        environment = urdhva_base.settings.environment.upper() or "PROD"
        html = render_novex_users_sync_report_html(
            report,
            sync_start_ist=result["sync_start_ist"],
            sync_end_ist=result["sync_end_ist"],
            environment=environment
        )

        ins = await notification_factory.get_notification_module("email")
        await ins.publish_message(
            subject="Novex User Sync Report(From Tibco)",
            recipients=EMAIL_RECIPIENTS['to_receipts'],
            cc_recipients=EMAIL_RECIPIENTS['cc_receipts'] or [],
            bcc_recipients=EMAIL_RECIPIENTS['bcc_receipts'] or [],
            html_content=True,
            body=html,
            force_send=True,
            inline_images={},
            attachments=[]
        )


def main():
    parser = argparse.ArgumentParser(
        description="Sync Novex users from TIBCO/MySQL by business unit (LPG, TAS, RO, DS)."
    )
    parser.add_argument(
        "--bu",
        nargs="*",
        default=None,
        metavar="BU",
        help=(
            "One or more business units: lpg, tas, ro, ds. "
            "If omitted, all units are synced. Example: --bu lpg ro"
        ),
    )
    parser.add_argument(
        "--send-email",
        action=argparse.BooleanOptionalAction,
        default=True,
        help=(
            "Send the HTML sync report by email after completion (default: on). "
            "Use --no-send-email to run sync without emailing."
        ),
    )
    start_time = time.time()
    args = parser.parse_args()
    bus_list = _parse_bus_list(args.bu)
    asyncio.run(
        start_user_sync(
            bus_list,
            send_email=args.send_email,
        )
    )
    end_time = time.time()
    print(f"Users Sync took {end_time - start_time} seconds.")


if __name__ == "__main__":
    print("*" * 80)
    print(f'Starting Novex User Sync at {urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d %H:%M:%S")}')
    main()
    print(f'Completed Novex User Sync at {urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d %H:%M:%S")}')
    print("*" * 80)
