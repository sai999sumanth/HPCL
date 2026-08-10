import urdhva_base
import json
import math
import pytz
import requests
import datetime
import calendar
import polars as pl
import charts_actions
import hpcl_ceg_model
import dashboard_studio_model
import utilities.va_alert_mapping as va_alert_mapping
import utilities.lpg_role_configuration as lpg_role_configuration
import orchestrator.dbconnector.credential_loader as credential_loader
import time
import asyncio
import logging

logger = logging.getLogger(__name__)


async def get_va_headers(db_name):
    creds = credential_loader.get_va_creds(db_name=db_name)
    creds['Origin'] = f"https://{creds['host']}"
    creds['Referer'] = f"https://{creds['host']}/home/dashboard/{creds['cust_id']}"
    return creds


async def close_va_alerts(params: dict):
    """

    Args:
        params: Dict
        {
            "AlarmId": "AlarmId",
            "Status": "CLOSED",
            "AcknowledgedBy": "UserId",
            "ActionCode": "INVALID", Options: ["Invalid", "Valid", "False"]
            "ActionReason":"Lack of awareness", Options: ["Person issue", "Equipment issue", "Lack of awareness", "Not following SOP", "Other"]
            "ActionCategory":"Safety", Options: ["Safety", "Security", "Operation", "Others"]
            "ActionDescription": "ActionDescription",
            "DocLink": "",
        }

    Returns:

    """
    creds = await get_va_headers("VA_ALERT")
    creds['url'] = f"https://{creds['host']}/api/v1/Violation/capa"
    ack_datetime = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d%H%M%S")
    headers = {
        "Content-Type": "application/json",
        "CustId": creds['cust_id'],
        "MessageId": f"ACKNOWLEDGE_ALARM{ack_datetime}",
        "Origin": creds['Origin'],
        "Referer": creds['Referer'],
        "UserId": creds['user'],
        "ApplicationId": creds['application_id'],
        "Cookie": creds['cookie'],
        "SessionToken": creds['session_token']
    }
    response = requests.post(
        url=creds['url'], json=params, headers=headers
    )
    if response.status_code // 100 == 2:
        return {"status": True, "message": "Data posted successfully", "data": response.json()}
    return {"status": False, "message": "Data posting unsuccessfully", "data": response.json()}


async def get_ro_terminal_scores(params: dict):

    max_retries = 5
    retry_delay = 15  # seconds

    for attempt in range(0, max_retries):
        try:
            logger.info(f"Attempt {attempt+1} to fetch VA score")

            creds = await get_va_headers("VA_ALERT_SCORE")
            creds['url'] = f"https://{creds['host']}/api/Platform/v1/HPCLVendor/Scores"

            ack_datetime = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d%H%M%S")

            headers = {
                "Content-Type": "application/json",
                "CustId": creds['cust_id'],
                "MessageId": f"ACKNOWLEDGE_ALARM{ack_datetime}",
                "Origin": creds['Origin'],
                "Referer": creds['Referer'],
                "UserId": creds['user'],
                "ApplicationId": creds['application_id'],
                "Cookie": creds['cookie'],
                "SessionToken": creds['session_token']
            }

            response = requests.get(
                url=creds['url'], params=params, headers=headers
            )

            #  If HTTP success
            if response.status_code // 100 == 2:

                data = response.json()

                if 'RespBody' in data and 'Payload' in data['RespBody']:
                    data = json.loads(data['RespBody']['Payload'])
                else:
                    data = []

                logger.info(f"Success on attempt {attempt}")
                return {
                    "status": True,
                    "message": "Data fetched successfully",
                    "data": data
                }

            else:
                logger.error(
                    f"Attempt {attempt} failed with status code {response.status_code}, resp {response.text}"
                )

        except Exception as e:
            logger.error(f"Exception on attempt {attempt}: {str(e)}")

        # Sleep before retry (if not last attempt)
        if attempt < max_retries:
            logger.info(f"Waiting {retry_delay} seconds before retry...")
            await asyncio.sleep(retry_delay)


    #  If all retries failed
    logger.error("All retry attempts failed.")
    return {
        "status": False,
        "message": "Data fetching unsuccessfully after retries",
        "data": None
    }

async def assign_values_to_dataframe(df, values):
        """
        Assigning camunda urls equally for each flow
        :param df:
        :param values:
        :return:
        """
        n = len(df)
        if n == 0:
            df = df.with_columns(pl.Series("camunda_listener", []))
            return df
        if n <= 10:
            assigned_values = values[:n]
        else:
            repeats = math.ceil(n / len(values))
            assigned_values = (values * repeats)[:n]
        df = df.with_columns(pl.Series("camunda_listener", assigned_values))
        return df

async def get_period_datetime(period: str, today=None):
    if period == "weekly":
        if not today:
            today = datetime.datetime.now(datetime.timezone.utc)
        start_of_week = today - datetime.timedelta(days=today.weekday())
        end_of_week = start_of_week + datetime.timedelta(days=6)
        start_datetime = datetime.datetime.combine(start_of_week, datetime.datetime.min.time())
        end_datetime = datetime.datetime.combine(end_of_week, datetime.datetime.max.time())
        return start_datetime, end_datetime
    if period == 'monthly':
        if not today:
            today = datetime.datetime.now(datetime.timezone.utc)
        start_of_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_day = calendar.monthrange(today.year, today.month)[1]
        end_of_month = today.replace(day=last_day, hour=23, minute=59, second=59, microsecond=999999)
        return start_of_month, end_of_month
    if period == 'fortnight':
        ist = pytz.timezone('Asia/Kolkata')
        if not today:
            today = datetime.datetime.now(ist)
        year, month = today.year, today.month
        first_half_start = datetime.datetime(year, month, 1, 0, 0, 0)
        first_half_end = datetime.datetime(year, month, 15, 23, 59, 59)
        last_day = (datetime.datetime(year, month, 28) + datetime.timedelta(days=4)).replace(day=1) - datetime.timedelta(days=1)
        second_half_start = datetime.datetime(year, month, 16, 0, 0, 0)
        second_half_end = datetime.datetime(year, month, last_day.day, 23, 59, 59)
        return (first_half_start, first_half_end) if today.day <= 15 else (second_half_start, second_half_end)
    if period == 'oneweek':
        if not today:
            today = datetime.datetime.now(datetime.timezone.utc)
        end_date = today.replace(hour=0, minute=0, second=0, microsecond=0)
        start_date = today - datetime.timedelta(days=7)
        return start_date, end_date


async def get_va_alerts_count(bu: str, violation_type: str, sap_id: str):
    va_mapping = va_alert_mapping.VA_Alert_Mapping
    if bu in va_mapping.keys() and violation_type in va_mapping[bu].keys():
        va_mapping = va_mapping[bu][violation_type]
        start_date, end_date = await get_period_datetime(va_mapping['period'])
        query = (f"""select count(*) as "count" from alerts """
                 f"where bu = '{bu}' and "
                 f"alert_section = 'VA' and "
                 f"violation_type = '{violation_type}' and "
                 f"sap_id = '{sap_id}' and "
                 f"created_at BETWEEN TO_DATE('{start_date}', 'YYYY-MM-DD') AND TO_DATE('{end_date}', 'YYYY-MM-DD')")
        # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 1
        # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        # function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        # resp = await function(query=query)
        resp = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
        resp = resp.get("data", [])
        if resp:
            resp = resp[0]
            return resp.get("count", 0)
    return 0

async def get_lpg_alerts_count(bu: str, violation_type: str, sap_id: str):
    lpg_mapping = lpg_role_configuration.lpg_role_mapping
    if bu in lpg_mapping.keys() and violation_type in lpg_mapping[bu].keys():
        lpg_mapping = lpg_mapping[bu][violation_type]
        count=1
        date=f"CURRENT_DATE - INTERVAL '{count} day'"
        while True:
            query = (f"""select * from alerts """
                    f"where bu = '{bu}' and "
                    f"alert_section = 'LPG' and "
                    f"violation_type = '{violation_type}' and "
                    f"sap_id = '{sap_id}' and "
                    f"created_at::DATE={date}")
            # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 1
            # dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            # function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
            # resp = await function(query=query)
            resp = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
            resp = resp.get("data", [])
            if not resp:
                return count-1
            if count>3:
                return count-1
            count+=1
            date=f"CURRENT_DATE - INTERVAL '{count} days'"
    return 0

async def get_va_levels(bu: str, violation_type: str, sap_id: str):
    va_mapping = va_alert_mapping.VA_Alert_Mapping
    if bu in va_mapping.keys() and violation_type in va_mapping[bu].keys():
        va_mapping = va_mapping[bu][violation_type]
        va_alert_count = await get_va_alerts_count(bu=bu, violation_type=violation_type, sap_id=sap_id)
        previous_count = 0
        for key, value in va_mapping['escalations'].items():
            if value['condition'] == "<":
                if int(va_alert_count) <= int(value['value']):
                    return "level - 1"
            if value['condition'] == "<>":
                if int(previous_count) < va_alert_count <= int(value['value']):
                    return "level - 2"
            if value['condition'] == ">":
                if va_alert_count > int(value['value']):
                    return "level - 3"
            previous_count = value['value']
    return ""

async def get_lpg_levels(bu: str, violation_type: str, sap_id: str):
    lpg_mapping = lpg_role_configuration.lpg_role_mapping
    if bu in lpg_mapping.keys() and violation_type in lpg_mapping[bu].keys():
        lpg_mapping = lpg_mapping[bu][violation_type]
        lpg_alert_count = await get_lpg_alerts_count(bu=bu, violation_type=violation_type, sap_id=sap_id)
        previous_count = 0
        for key, value in lpg_mapping['escalations'].items():
            if value['condition'] == "<":
                if int(lpg_alert_count) <= int(value['value']):
                    return key
            if value['condition'] == "<>":
                if int(previous_count) < lpg_alert_count <= int(value['value']):
                    return key
            if value['condition'] == ">":
                if lpg_alert_count > int(value['value']):
                    return key
            previous_count = value['value']
    return ""

async def is_alert_exists(alert_id: str):
    query = f"select id from alerts where external_id = '{alert_id}' and alert_section = 'VA'"
    print("query: ", query)
    va_alert_data = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
    print("va_alert_data: ", va_alert_data)
    if va_alert_data.get("data", []):
        return True
    return False
