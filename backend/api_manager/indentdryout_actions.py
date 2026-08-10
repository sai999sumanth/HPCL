import urdhva_base
import pandas as pd
import hpcl_ceg_model
from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import re
import pytz
import json
import math
import fastapi
import datetime
import api_helpers
import polars as pl
import requests
import traceback
import urdhva_base.redispool
import dateutil.parser as parser
import utilities.helpers as helpers
import orchestrator.alerting.alert_factory as alert_factory
import orchestrator.alerting.alert_helper as alert_helper
import utilities.connection_mapping as connection_mapping
from charts_actions import charts_connection_vault_routing
from orchestrator.alerting.alert_manager import create_alert
import orchestrator.analytics.dry_out_analysis as dry_out_analysis
import orchestrator.direct_sales.indentwise_direct_sales as indentwise_direct_sales
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams
from orchestrator.actions.indent_dry_out import IndentDryOut as indent_dry_out
import orchestrator.alerting.listener.sync_ro_daily_sales as sync_ro_daily_sales
import utilities.minio_connector as minio_connector

router = fastapi.APIRouter(prefix='/indentdryout')

logger = urdhva_base.logger.Logger.getInstance("indentdryout")

# Action sync_data_from_cris_to_ceg
@router.post('/sync_data_from_cris_to_ceg', tags=['IndentDryOut'])
async def indentdryout_sync_data_from_cris_to_ceg(data: Indentdryout_Sync_Data_From_Cris_To_CegParams):
    # Charts_Connection_Vault_RoutingParams.connection_id = data.source_connection
    # Charts_Connection_Vault_RoutingParams.action = 'get_data'
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=data.source_connection,
        action='get_data'
    )
    function = await charts_connection_vault_routing(charts_ins)
    records = await function(schema_name=data.source_schema, table_name=data.source_table)

    # Charts_Connection_Vault_RoutingParams.connection_id = data.destination_connection
    # Charts_Connection_Vault_RoutingParams.action = 'upsert_data'
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    charts_ins_1 = Charts_Connection_Vault_RoutingParams(
        connection_id=data.destination_connection,
        action='upsert_data'
    )
    function = await charts_connection_vault_routing(charts_ins_1)
    return await function(
        schema_name=data.destination_schema,
        table_name=data.destination_table,
        records=records,
        conflict_columns=data.conflict_columns
    )


# Action create_dry_out_alert
@router.post('/create_dry_out_alert', tags=['IndentDryOut'])
async def indentdryout_create_dry_out_alert(data: Indentdryout_Create_Dry_Out_AlertParams):
    def assign_values_to_dataframe(df, values):
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

    redis_queue = urdhva_base.redispool.RedisQueue('dry_out_camunda_queue')
    # Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=connection_mapping.connection_mapping.get("hpcl_ceg", "1"),
        action='execute_query'
    )
    function = await charts_connection_vault_routing(charts_ins)
    schema = connection_mapping.schema_mapping.get("cris", "public")
    table = connection_mapping.table_mapping.get("dry_out", "")
    query = f'''SELECT * FROM "{schema}"."{table}" WHERE "volume" > 0 AND "indent_status" NOT IN ('Raised', 'Completed') AND "status" IN ('0', '1', '2');'''
    query = f'''select site_id, fcc_code, item_name,count(distinct tank_no) tank_cnt,
            rosapcode, STRING_AGG(CAST(tank_no AS TEXT), ',') tank_no, product_no, indent_status, 
            case when sum(pumpable_Stock) <=0 then 1
            when sum(pumpable_Stock) <(sum(sch.avgsales_7days)/7) then 2
            when sum(pumpable_Stock) between (sum(sch.avgsales_7days)/7) and (sum(sch.avgsales_7days)/7)*3 then 3
            when sum(pumpable_Stock) between (sum(sch.avgsales_7days)/7)*3 and (sum(sch.avgsales_7days)/7)*6 then 4
            else 5 end status
            from "{schema}".{table} sch
            where 1=1 and sch.volume>0
            group by site_id, fcc_code, item_name, rosapcode, product_no, indent_status
            order by site_id, fcc_code, item_name, rosapcode, product_no'''
    # records = await function(schema_name=schema, table_name=table, query=query)
    records = await function(query=query)
    records = pl.DataFrame(records)
    records = records.filter(~pl.col("indent_status").is_in(['Raised', 'Completed']))
    records = records.unique(subset=['site_id', 'fcc_code', 'item_name', 'product_no'], keep='first')
    records = records.filter(pl.col('status') == 1)
    records = assign_values_to_dataframe(records,
                                             list(connection_mapping.camunda_listener_mapping.values()))
    records = records.head(10).to_dicts()

    alert_data = {
        'bu': 'RO',
        'alert_type': 'RO',
        'sop_id': 'SOP293',
        'interlock_name': 'Dry Out Triggering Flow',
        'sap_id': '',  # location_id
        'product_code': '',
        'indent_no': '',
        'dealer_id': '',
        'severity': "",
        'workflow_datetime': '',
        'terminal_plant_id': ''
    }

    _mapping = await indent_dry_out().prod_code_mapping()

    for _dry in records:
        _dry['indent_status'] = 'Raised'
        status = _dry['status']
        # alert_data['product_code'] = _dry['product_no']
        alert_data['product_code'] = _mapping.get(_dry['item_name'], _dry['product_no'])
        alert_data['sap_id'] = _dry['rosapcode']
        alert_data['device_id'] = str(_dry['tank_no'])
        alert_data['device_name'] = "Tank"
        # alert_data['severity'] = 'Critical' if status == 0 else 'High' if status == 1 else 'Medium' if status == 2 else 'Low'
        alert_data['severity'] = 'Critical' if status == 1 else 'High' if status == 2 else 'Medium' if status == 3 else 'Low'
        alert_data['indent_no'] = ''
        alert_data['dealer_id'] = _dry['rosapcode']
        alert_data['workflow_datetime'] = datetime.datetime.now(datetime.UTC).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + "Z"
        alert_data['terminal_plant_id'] = ''
        alert_data['camunda_host'] = connection_mapping.camunda_listener_mapping.get(_dry['camunda_listener'])['host']
        alert_data['camunda_port'] = connection_mapping.camunda_listener_mapping.get(_dry['camunda_listener'])['port']
        alert_data['dry_out_in_days'] = _dry['status']
        await redis_queue.put(json.dumps(alert_data))
        # await create_alert(alert_data)

        # Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        charts_ins_2 = Charts_Connection_Vault_RoutingParams(
            connection_id=connection_mapping.connection_mapping.get("hpcl_ceg", "1"),
            action='execute_query'
        )
        function = await charts_connection_vault_routing(charts_ins_2)
        query = f"""UPDATE "HPCL_HOS".sch_inventory_forecast_dashboard SET "indent_status" = 'Raised' """ \
                f"""WHERE "site_id" = '{_dry['site_id']}' """ \
                f"""AND "fcc_code" = '{_dry['fcc_code']}' """ \
                f"""AND "product_no" = '{_dry['product_no']}' """
        await function(
            query=query
        )
        # await function(
        #     schema_name="HPCL_HOS",
        #     table_name=connection_mapping.table_mapping.get("dry_out", ""),
        #     records=_dry,
        #     conflict_columns=["site_id", "fcc_code", "product_no", "tank_no"]
        # )

    return {"status": True, "message": "Alerts created successfully", "data": []}


# Action get_dried_out_plants
@router.post('/get_dried_out_plants', tags=['IndentDryOut'])
async def indentdryout_get_dried_out_plants(data: Indentdryout_Get_Dried_Out_PlantsParams):
    top_x_axis = [
        "Indent Not Raised", "Pending Indents", "Indent On Hold", "Truck Allocated", "Sent to SAP",
        "Sales Order Placed", "R2 Swiped", "Invoice Created", "R3 Swiped", "VTS", "Indent Delivered"
    ]
    bottom_x_axis = [
        "Dealer", "SO\nRM", "SO\nCO", "SO", "SO\nRM", "SO\nRM", "PO\nRM", "PO\nRM", "PO\nRM", "PO\nRM", "SO\nRM"
    ]
    where_clause = ["interlock_name = 'Indent Dry Out'"]
    where_clause = ["interlock_name = 'Dry Out Each Indent Wise MainFlow'"]
    for record in data.filters:
        # If filter was on Sales Area Getting all ro id's under that sales area
        # if record.key in ['sales_area', 'category']:
        #     if record.value:
        #         if record.key == "sales_area":
        #             if len(record.value) == 1:
        #                 query = f"select ro_id from location_master where sales_area='{record.value[0]}' and bu='RO'"
        #             else:
        #                 query = f"select ro_id from location_master where sales_area in {tuple(record.value)} and bu='RO'"
        #         else:
        #             values = []
        #             for rec in record.value:
        #                 if "(" in rec:
        #                     values.append(rec.split("(")[-1].split(")")[0].strip())
        #                 else:
        #                     values.append(rec)
        #             if len(values) == 1:
        #                 query = f"select ro_id from location_master where terminal_plant_id='{values[0]}' and bu='RO'"
        #             else:
        #                 query = f"select ro_id from location_master where terminal_plant_id in {tuple(values)} and bu='RO'"
        #         function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        #         resp = await function(
        #             query=query
        #         )
        #         ro_ids = [rec['ro_id'] for rec in resp]
        #         if len(ro_ids) == 1:
        #             where_clause.append(f"sap_id='{ro_ids[0]}'")
        #         elif len(ro_ids) > 1:
        #             where_clause.append(f"sap_id in {tuple(ro_ids)}")
        if record.key == "progress_rate":
            where_clause.append(f"progress_rate={int(record.value[0])-1}")
        else:
            if record.value:
                if record.key == "plant":
                    record.key = "terminal_plant_id"
                if len(record.value) == 1:
                    where_clause.append(f"{record.key}='{record.value[0]}'")
                else:
                    where_clause.append(f"{record.key} in {tuple(record.value)}")
    where_clause.append(await hpcl_ceg_model.Alerts.get_clause_conditions(extra_key_mapping=
                                                                          {"sap_id": "terminal_plant_id"}))
    conditions = ' AND '.join(where_clause)
    query = "select location_name as name, sap_id, progress_rate as present_stage, id as alert_id," \
            "case when severity = 'Critical' then '1' " \
            "when severity = 'High' then '2' " \
            "when severity = 'Medium' then '3' " \
            "when severity = 'Low' then '4' " \
            "else severity " \
            "end as dry_out_days " \
            f"from alerts where {conditions}"
    resp = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=10000)

    stats = {i+1: 0 for i, _ in enumerate(top_x_axis)}
    for rec in resp['data']:
        if rec['present_stage'] == 0:
            rec['present_stage'] = 1
        if rec['present_stage'] not in stats:
            stats[rec['present_stage']] = 0
        stats[rec['present_stage']] += 1
    stats = [{"section": top_x_axis[key-1], "value": value, "serial": key}
             for key, value in stats.items() if key <= len(top_x_axis)]
    stats = sorted(stats, key=lambda x: x['serial'])
    return {"status": True, "message": "Success", "data": resp, "top_x_axis": top_x_axis,
            "bottom_x_axis": bottom_x_axis, "stats": stats}


# Action get_dry_out_stats
@router.post('/get_dry_out_stats', tags=['IndentDryOut'])
async def indentdryout_get_dry_out_stats(data: Indentdryout_Get_Dry_Out_StatsParams):
    ...


# Action get_alert_history
@router.post('/get_alert_history', tags=['IndentDryOut'])
async def indentdryout_get_alert_history(data: Indentdryout_Get_Alert_HistoryParams):
    resp = await Alerts.get(data.alert_id)
    if not isinstance(resp, dict):
        resp = resp.__dict__
    alert_history = {
        "details": {},
        "data": [],
        "changed_data": []
    }

    def prepare_history_data(history_data):
        if history_data["action_msg"] == "Indent Raised":
            history_msg = (f"Action:- {history['action_msg']}, Indent Raised at"
                                         f" {convert_time_read_format(str(history['ims_datetime']), is_ist=True)}, "
                                         f"Product Required Date {convert_time_read_format(str(history['prod_reqd_dt']), is_ist=True)}")
        elif history_data["action_msg"] == "Indent Is On Hold":
            history_msg = (f"Action:- {history['action_msg']}")
        elif history_data["action_msg"] == "Indent On Hold Released":
            history_msg = (f"Action:- {history['action_msg']}, On Hold Released at"
                           f" {convert_time_read_format(str(history['ims_datetime']), is_ist=True)}")
        else:
            history_msg = (f"Action:- {history['action_msg']}, {history['action_type']}: "
                           f"Processed at {convert_time_read_format(str(history['ims_datetime']) if 'ims_datetime' in history.keys() else "-", is_ist=True)}")
        return history_msg

    def convert_time_read_format(date_time, is_ist=False):
        try:
            utc_timestamp = parser.parse(date_time).replace(tzinfo=None)
            # Define UTC and IST timezones
            utc = pytz.utc
            ist = pytz.timezone('Asia/Kolkata')
            # Localize the UTC timestamp and convert it to IST
            utc_time = utc.localize(utc_timestamp)
            ist_time = utc_time.astimezone(ist)
            # Format the IST timestamp in the desired format
            formatted_ist_time = ist_time.strftime('%d-%m-%Y %H:%M:%S')
            if is_ist:
                formatted_ist_time = utc_timestamp.strftime('%d-%m-%Y %H:%M:%S')
            return formatted_ist_time
        except:
            return "-"
    prod_code_mapping = connection_mapping.item_name_mapping
    if resp:
        # resp = resp[0]
        alert_history["details"] = {"name": resp['location_name'], "sap_id": resp['sap_id'], "zone": resp["zone"],
                                    "state": resp["state"], "indent_status": resp["indent_status"],
                                    "plant_id": resp["terminal_plant_id"], "plant_name": resp['terminal_plant_name'],
                                    "indent_no": resp["indent_no"], "product": prod_code_mapping.get(str(resp['product_code']), str(resp['product_code']))}
        if not resp['terminal_plant_name']:
            status, location_data = await alert_helper.get_location_details("TAS", resp['terminal_plant_id'])
            if status:
                resp['terminal_plant_name'] = location_data['name']
        servicing_plant_id = resp['servicing_plant_id'] if resp['servicing_plant_id'] else resp['terminal_plant_id']
        alert_history["changed_data"].append(f"Dry-out Location Identified at "
                                     f"{convert_time_read_format(str(resp['created_at']))}, "
                                     f"Servicing Plant Location {servicing_plant_id}")

        action_msgs = [entry["action_msg"] for entry in resp.get('alert_history', [])]
        for history in resp.get("alert_history", []):
            # if history['action_msg'] == "Valid Indent":
            #     if "Indent Is On Hold" in action_msgs and "Valid Indent" in action_msgs:
            #         history['action_msg'] = "Indent On Hold Released"
            if history['action_msg'] == "Invalid Is On Hold":
                history['action_msg'] = "Indent Is On Hold"
            if history['action_msg'] == "R2 Not Swiped But Invoice Created":
                history['action_msg'] = "R2 Swiped"
            if history['action_msg'] == "R2 Not Swiped But R3 Swiped":
                history['action_msg'] = "R2 Swiped"
            if history['action_msg'] == "R2, R3 Not Swiped But Indent Delivered":
                history['action_msg'] = "R2 Swiped"
            if history['action_msg'] == "R3 Not Swiped But Indent Delivered":
                history['action_msg'] = "R3 Swiped"
            resp = prepare_history_data(history)
            alert_history["changed_data"].append(resp)
            # alert_history["data"].append(f"Action:- {history['action_msg']}, {history['action_type']} at"
            #                              f" {convert_time_read_format(str(history['allocated_time']))}, "
            #                              f"Processed at {convert_time_read_format(str(history['processed_time']))}")
        # alert_history["data"] = alert_history["data"][::-1]
        alert_history["data"] = alert_history["changed_data"][::-1]
    return alert_history

    # def convert_time_read_format(date_time):
    #     try:
    #         utc_timestamp = parser.parse(date_time).replace(tzinfo=None)
    #         # Define UTC and IST timezones
    #         utc = pytz.utc
    #         ist = pytz.timezone('Asia/Kolkata')
    #         # Localize the UTC timestamp and convert it to IST
    #         utc_time = utc.localize(utc_timestamp)
    #         ist_time = utc_time.astimezone(ist)
    #         # Format the IST timestamp in the desired format
    #         formatted_ist_time = ist_time.strftime('%Y-%m-%dT%H:%M:%S.%f')
    #         return formatted_ist_time
    #     except:
    #         return "-"
    #
    # if resp:
    #     alert_history["details"] = {"interlock_name": resp['interlock_name'], "sap_id": resp['sap_id'], "zone": resp["zone"],
    #                                 "state": resp["state"], "indent_status": resp["indent_status"], "device_name": resp["device_id"] + " Tank",
    #                                 "city": resp['city'], "region": resp["region"], "location_name": resp["location_name"],
    #                                 "severity": resp['severity'], "alert_status": resp["alert_status"], "alert_section": resp["bu"],
    #                                 "indent_raised_date": convert_time_read_format(str(resp['indent_raised_date']))}
    #     alert_history["data"].append({"action_msg": "Dry-out Location Identified",
    #                                   "allocated_time": convert_time_read_format(str(resp['created_at'])),
    #                                   "processed_time": convert_time_read_format(str(resp['created_at']))})
    #     for history in resp.get("alert_history", []):
    #         alert_history["data"].append({"action_msg": history['action_msg'],
    #                                       "allocated_time": convert_time_read_format(str(history['allocated_time'])),
    #                                       "processed_time": convert_time_read_format(str(history['processed_time']))})
    #     # alert_history["data"].append(f"Dry-out Location Identified at "
    #     #                              f"{convert_time_read_format(str(resp['created_at']))}")
    #     # for history in resp.get("alert_history", []):
    #     #     alert_history["data"].append(f"Action:- {history['action_msg']}, {history['action_type']} at"
    #     #                                  f" {convert_time_read_format(str(history['allocated_time']))}, "
    #     #                                  f"Processed at {convert_time_read_format(str(history['processed_time']))}")
    # return alert_history


# Action get_distinct_plant
@router.post('/get_distinct_plant', tags=['IndentDryOut'])
async def indentdryout_get_distinct_plant(data: Indentdryout_Get_Distinct_PlantParams):
    region = " ".join(data.region.split()[:-2])
    ext_cond = await hpcl_ceg_model.LocationMaster.get_clause_conditions()
    query = (f"select DISTINCT terminal_plant_id FROM location_master where bu='RO' and "
             f"LOWER(sales_area) like '%{region.lower()}%' and terminal_plant_id!=''")

    resp = await hpcl_ceg_model.LocationMaster.get_aggr_data(query, limit=10000)
    plant_id = [rec['terminal_plant_id'] for rec in resp if rec['terminal_plant_id']]
    cond = ""
    if len(plant_id) == 1:
        cond = f"sap_id = {plant_id[0]}"
    else:
        cond = f"sap_id IN {tuple(plant_id)}"
    query = f"select name,sap_id from location_master where {cond}"
    resp = await hpcl_ceg_model.LocationMaster.get_aggr_data(query, limit=10000)

    map_data = {rec['sap_id']: rec['name'] for rec in resp['data']}
    for key in plant_id:
        if key not in map_data:
            map_data[key] = key
    return [f"{key}({value})" for key, value in map_data.items()]

    # Correct return statement
    return [f"{rec['terminal_plant_id']}({rec['terminal_plant_name']})" for rec in resp if rec['terminal_plant_id']]


# Action get_distinct_location_details
@router.post('/get_distinct_location_details', tags=['IndentDryOut'])
async def indentdryout_get_distinct_location_details(data: Indentdryout_Get_Distinct_Location_DetailsParams):
    return {"status": True, "message": "Success",
            "data": await dry_out_analysis.get_locations(data.bu, data.zone, data.region, data.sales_area, data.plant,
                                                         data.cat_a_dealers, data.dry_out_dealers, data.location_onboard)}


# Action sync_ro_daily_sales
@router.post('/sync_ro_daily_sales', tags=['IndentDryOut'])
async def indentdryout_sync_ro_daily_sales(data: Indentdryout_Sync_Ro_Daily_SalesParams):
    return await sync_ro_daily_sales.indent_dryout_sync_ro_daily_sales(data.from_date, data.to_date)


# Action get_indent_analysis
@router.post('/get_indent_analysis', tags=['IndentDryOut'])
async def indentdryout_get_indent_analysis(data: Indentdryout_Get_Indent_AnalysisParams):
    conditions = {rec.key: rec.value for rec in data.filters}
    if conditions["model"] == "all":
        if conditions.get("category") == "cat_a":
            ...
        return {"indents_not_placed": 300, "indents_on_hold": 50, "indents_in_progress": 34,
                "pending_indents": 23, "total": 407}
    elif conditions["model"] == "pending_indents":
        if conditions.get("category") == "cat_a":
            ...
        return {"dealer_tt": 10, "tt_available": 0, "dealer_tt_return": 4, "tt_return": 11,
                "pending_indents": 23, "date": str(datetime.datetime.utcnow())}
    elif conditions["model"] == "indents_not_placed":
        if conditions.get("category") == "cat_a":
            ...
        return {"indents_not_placed": 1000, "date": str(datetime.datetime.utcnow()),
                "dry_out_2days": 50, "dry_out_7days": 34, "dry_out_15days": 12, "dry_out_30days": 0}
    else:
        return {}


# Action get_dry_out_count
@router.post('/get_dry_out_count', tags=['IndentDryOut'])
async def indentdryout_get_dry_out_count(data: Indentdryout_Get_Dry_Out_CountParams):
    basic_condtion = ["progress_rate != '11'", "mark_as_false = true"]
    where_clause = []
    dry_out_in_days = '1'
    if not data.filters:
        data.filters = []
    for record in data.filters:
        if record.key == "progress_rate":
            if record.value:
                if len(record.value) == 1:
                    where_clause.append(f"progress_rate={int(record.value[0])}")
                else:
                    where_clause.append(f"progress_rate in {tuple(record.value)}")
        else:
            if record.value:
                if record.key == 'dry_out_in_days':
                    dry_out_in_days = str(record.value[0])
                if record.key == "plant":
                    record.key = "terminal_plant_id"
                if len(record.value) == 1:
                    where_clause.append(f"{record.key} {record.cond} '{record.value[0]}'")
                else:
                    where_clause.append(f"{record.key} in {tuple(record.value)}")
    print("dry_out_in_days: ", dry_out_in_days)
    condition_1 = ' AND '.join(basic_condtion + ["dry_out_in_days = '1'"] + where_clause) if dry_out_in_days == '1' else ' AND '.join(basic_condtion + ["dry_out_in_days = '1'"])
    condition_2 = ' AND '.join(basic_condtion + ["dry_out_in_days = '2'"] + where_clause) if dry_out_in_days == '2' else ' AND '.join(basic_condtion + ["dry_out_in_days = '2'"])
    condition_3 = ' AND '.join(basic_condtion + ["dry_out_in_days = '3'"] + where_clause) if dry_out_in_days == '3' else ' AND '.join(basic_condtion + ["dry_out_in_days = '3'"])

    condition = "interlock_name = 'Dry Out Each Indent Wise MainFlow' AND indent_status NOT IN ('Cancelled', 'Completed', 'TempClosed', 'ProductLowLevel', 'OfflineOrFalseAlarm', 'NotAvailable')"
    ext_cond = await hpcl_ceg_model.Alerts.get_clause_conditions(extra_key_mapping={"sap_id": "terminal_plant_id"}, default_mapping={"bu": "RO"})
    if ext_cond:
        condition += " AND " + " AND ".join(ext_cond)
    dry_out, intraday_dry_out, potential_dry_out = 0, 0, 0
    # For DryOut
    stats_query = f"""SELECT COUNT(DISTINCT(sap_id)) as total_unique_count, dry_out_in_days FROM alerts  
    WHERE {condition} AND {condition_1} AND dry_out_in_days='1' GROUP BY dry_out_in_days
    """
    dry_out_data = await hpcl_ceg_model.Alerts.get_aggr_data(stats_query)
    if dry_out_data['data']:
        dry_out = dry_out_data['data'][0]["total_unique_count"]

    # For Intra DryOut
    stats_query = f"""SELECT COUNT(DISTINCT(sap_id)) as total_unique_count, dry_out_in_days FROM alerts
        WHERE {condition} AND {condition_2} AND dry_out_in_days='2' GROUP BY dry_out_in_days
        """
    dry_out_data = await hpcl_ceg_model.Alerts.get_aggr_data(stats_query)
    if dry_out_data['data']:
        intraday_dry_out = dry_out_data['data'][0]["total_unique_count"]

    # For Potential DryOut
    # stats_query = f"""SELECT COUNT(DISTINCT(sap_id)) as total_unique_count, dry_out_in_days FROM alerts
    #     WHERE {condition} AND {condition_3} AND dry_out_in_days='3' GROUP BY dry_out_in_days
    #     """
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    # dry_out_data = await function(
    #     query=stats_query
    # )
    # if dry_out_data:
    #     potential_dry_out = dry_out_data[0]["total_unique_count"]

    # _data = {"dry_out": dry_out, "intraday_dry_out": intraday_dry_out, "potential_dry_out": potential_dry_out}
    _data = {"dry_out": dry_out, "intraday_dry_out": intraday_dry_out}
    return {"status": True, "message": "Success", "data": _data}


# Action get_filtered_location_data
@router.post('/get_filtered_location_data', tags=['IndentDryOut'])
async def indentdryout_get_filtered_location_data(data: Indentdryout_Get_Filtered_Location_DataParams):
    ext_filters = await hpcl_ceg_model.Alerts.get_clause_conditions()
    if ext_filters:
        data.filters.extend([hpcl_ceg_model.IndentDryOutDataFiltersCreate(**ext_filter) for ext_filter in ext_filters])
    return await dry_out_analysis.get_filtered_location_data(data.bu, data.request_parameter, data.filters)


# Action get_indent_data
@router.post('/get_indent_data', tags=['IndentDryOut'])
async def indentdryout_get_indent_data(data: Indentdryout_Get_Indent_DataParams):
    record = data.filters
    indent_mapping = {
        "indent_not_placed": ["Pending"],
        "indent_on_hold": ["IndentOnHold"],
        "indent_in_progress": [
            "IndentRaised", "TruckAllocated", "InvoiceCreated",
            "ValidIndent", "SentToSAP", "SalesOrderPlaced",
            "R2Swipe", "R3Swipe"
        ]
    }
    # Prepare a dictionary to store results
    result = {}
    total_count = 0
    # Loop through each indent group to calculate the count
    for indent_key, indent_values in indent_mapping.items():
    # Construct conditions
        conditions = ["interlock_name = 'Dry Out Each Indent Wise MainFlow'"]
        for rec in record:
            if rec.key == "indent_status":
                # Map the input value to the corresponding list in indent_mapping
                mapped_values = indent_values  # Use the values for the current indent group
                # Create the condition for indent_status
                condition = f"""indent_status IN ({', '.join([f"'{val}'" for val in mapped_values])})"""
            else:
                # Default condition for other keys
                condition = f"{rec.key} = '{rec.value}'"
            conditions.append(condition)
        conditions.extend(await hpcl_ceg_model.Alerts.get_clause_conditions(extra_key_mapping=
                                                                            {"sap_id": "terminal_plant_id"}))
        # Combine all conditions using AND
        where_clause = ' AND '.join(conditions)
        # Build the SQL query
        query = f'''SELECT COUNT(indent_status) as count FROM alerts WHERE {where_clause}'''
        print(f"Generated Query for {indent_key}:", query)
        # Execute the query
        # Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        charts_ins = Charts_Connection_Vault_RoutingParams(
            connection_id=connection_mapping.connection_mapping.get("hpcl_ceg", "1"),
            action='execute_query'
        )
        function = await charts_connection_vault_routing(charts_ins)
        resp = await function(query=query)

        print(f"Response for {indent_key} --> ", resp)

        # Extract the count from the response and store it in the result dictionary
        if resp and isinstance(resp, list) and "count" in resp[0]:
            count = resp[0]["count"]
            result[indent_key] = count
            total_count += count 
        else:
            result[indent_key] = 0  # Default to 0 if no result is found
    dry_out_counts = await indentdryout_get_dry_out_count(data)
    dry_out_count = dry_out_counts.get("dry_out", 0)
    # Add the dry_out count to the result dictionary
    result["dry_out"] = dry_out_count
    total_count += dry_out_count
    result["total_count"] = total_count
    # Return the final result
    return result


# Action get_dried_out_ro
@router.post('/get_dried_out_ro', tags=['IndentDryOut'])
async def indentdryout_get_dried_out_ro(data: Indentdryout_Get_Dried_Out_RoParams):
    for rec in data.filters:
        for index, val in enumerate(rec.value):
            if not val:
                continue
            if not re.fullmatch('^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$', val):
                raise fastapi.HTTPException(
                    status_code=422,
                    detail=f"values[{index}] not matching criteria"
                )
    top_x_axis = connection_mapping.dry_out_top_x_axis
    where_clause = ["interlock_name = 'Dry Out Each Indent Wise MainFlow'", "mark_as_false = true"]
    where_clause.extend(await hpcl_ceg_model.Alerts.get_clause_conditions(
        extra_key_mapping={"sap_id": "terminal_plant_id"}, default_mapping={"bu": "RO"}))
    dry_out_in_days_query = '1'
    tt_count_filter = {}
    for record in data.filters:
        if record.key == "progress_rate":
            if record.value:
                where_clause.append(f"progress_rate={int(record.value[0])}")
        else:
            if record.value:
                if record.key == 'dry_out_in_days':
                    dry_out_in_days_query = record.value[0]
                if record.key == "plant":
                    record.key = "terminal_plant_id"
                    tt_count_filter.update({record.key: record.value})
                if record.key == "zone":
                    tt_count_filter.update({record.key: record.value})
                if len(record.value) == 1:
                    where_clause.append(f"{record.key}='{record.value[0]}'")
                else:
                    where_clause.append(f"{record.key} in {tuple(record.value)}")
    conditions = ' AND '.join(where_clause)

    stats_query = "select distinct sap_id, min(progress_rate) as present_stage " \
                  f"from alerts where {conditions} and indent_status not in ('Cancelled', 'Completed', 'TempClosed', 'ProductLowLevel', 'OfflineOrFalseAlarm', 'NotAvailable') " \
                  f"group by sap_id"
    stats_resp = await hpcl_ceg_model.Alerts.get_aggr_data(stats_query, limit=10000)
    where_clause_conditions = ["interlock_name = 'Dry Out Each Indent Wise MainFlow'"]
    where_clause_conditions.extend(await hpcl_ceg_model.Alerts.get_clause_conditions(
        extra_key_mapping={"sap_id": "terminal_plant_id"}))
    _date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    delivered_query = f"""SELECT SUM(distinct_count) AS total_count
                        FROM (
                            SELECT COUNT(DISTINCT sap_id) AS distinct_count
                            FROM alerts
                            WHERE {' AND '.join(where_clause_conditions)}
                            AND indent_status = 'Completed' AND dry_out_in_days = '{dry_out_in_days_query}' 
                            AND DATE(updated_at) = '{_date}'  -- Use TRUNC to ignore the time part
                            GROUP BY sap_id
                        ) AS subquery"""
    delivered_count = await hpcl_ceg_model.Alerts.get_aggr_data(delivered_query, limit=10000)
    if delivered_count:
        delivered_count = delivered_count['data'][0].get("total_count", 0) if delivered_count['data'][0].get("total_count") else 0
    else:
        delivered_count = 0

    dealer_tt = pl.read_csv("/opt/ceg/algo/utilities/DealerOwnedTrucks.csv", infer_schema_length=0)['DEALERID'].to_list()

    stats = {i + 1: 0 for i, _ in enumerate(top_x_axis)}
    dealer_tt_count = {x: 0 for x in connection_mapping.truck_details}
    for rec in stats_resp['data']:
        if rec['present_stage'] == 0:
            rec['present_stage'] = 1
        if rec['present_stage'] not in stats:
            stats[rec['present_stage']] = 0
        stats[rec['present_stage']] += 1
        if str(rec['sap_id']) in dealer_tt:
            dealer_tt_count['Dealer TT'] += 1
    dry_out_aging = {}
    if data.bu_type == 'ro':
        dry_out_aging = await dry_out_analysis.get_dryout_aging(conditions)
    less_than_2_days = dry_out_aging.get("less_than_2_days", 0)
    from_3_to_7_days = dry_out_aging.get("from_3_to_7_days", 0)
    from_8_to_15_days = dry_out_aging.get("from_8_to_15_days", 0)
    more_than_15_days = dry_out_aging.get("more_than_15_days", 0)
    indent_not_raised_count = less_than_2_days + from_3_to_7_days + from_8_to_15_days + more_than_15_days

    count_50_klm = 0
    if data.bu_type == 'ro':
        count_50_klm = await dry_out_analysis.get_ro_count_less_50(conditions)

    tar_analysis = {}
    if data.bu_type == 'ro':
        tar_analysis = await dry_out_analysis.get_tar_analysis(conditions)

    dealer_truck_count = {}
    if data.bu_type == 'sod':
        dealer_truck_count = await dry_out_analysis.get_tt_counts(tt_count_filter)

    closed_outlet = 0
    if data.bu_type == 'ro':
        closed_outlet = await dry_out_analysis.get_closed_outlet(conditions=conditions, dry_out_in_days=dry_out_in_days_query)

    nozzle_sales = 0
    if data.bu_type == 'ro':
        nozzle_sales = await dry_out_analysis.get_nozzle_sales(conditions=conditions, dry_out_in_days=dry_out_in_days_query)

    stats = [{"section": top_x_axis[key - 1]['name'], "value": value, "serial": key, "condition": "=",
              "group": top_x_axis[key - 1]['group']}
             for key, value in stats.items() if key <= len(top_x_axis)]
    stats.extend([{
            "section": "Indent Raised",
            "value": sum(item['value'] for item in stats if 2 <= item['serial'] <= 10),
            "serial": 13, "condition": "=", "group": "not_raised"
        }, {
            "section": "Valid \\ WIP Indents",
            "value": sum(item['value'] for item in stats if 4 <= item['serial'] <= 10),
            "serial": 14, "condition": "=", "group": "pending"
        }, {
            "section": "EMUnLock",
            "value": 0, "serial": 18, "condition": "=", "group": "wip"
        }, {
            "section": "Indent Not Raised", "value": indent_not_raised_count, "serial": 19,
            "condition": "=", "group": "indent"
        }, {
            "section": "Nozzle Sales Not Started", "value": nozzle_sales, "serial": 20,
            "condition": "=", "group": "indent"
        }, {
            "section": "Closed Outlets", "value": closed_outlet, "serial": 21,
            "condition": "=", "group": "indent"
        }, {
            "section": "Low Volume(<50KLPM)", "value": count_50_klm, "serial": 22,
            "condition": "=", "group": "indent"
        }, {
            "section": "Volume(>50KLPM)", "value": indent_not_raised_count - count_50_klm, "serial": 23,
            "condition": "=", "group": "indent"
        }, {
            "section": "Indent Not Raised", "value": indent_not_raised_count, "serial": 24,
            "condition": "=", "group": "dryout_analysis"
        },{
            "section": "<2 Days", "value": less_than_2_days, "serial": 25,
            "condition": "=", "group": "dryout_analysis"
        }, {
            "section": "3 to 7 Days", "value": from_3_to_7_days, "serial": 26,
            "condition": "=", "group": "dryout_analysis"
        }, {
            "section": "8 to 15 Days", "value": from_8_to_15_days, "serial": 27,
            "condition": "=", "group": "dryout_analysis"
        }, {
            "section": "> 15 Days", "value": more_than_15_days, "serial": 28,
            "condition": "=", "group": "dryout_analysis"
        },{
            "section": "Indent Not Raised", "value": indent_not_raised_count, "serial": 29,
            "condition": "=", "group": "tar_analysis"
        }, {
            "section": "0 to 25 Rs Lakhs", "value": tar_analysis.get("less_1_cr", 0), "serial": 30,
            "condition": "=", "group": "tar_analysis"
        }, {
            "section": "25 to 50 Rs Lakhs", "value": tar_analysis.get("less_2_cr", 0), "serial": 31,
            "condition": "=", "group": "tar_analysis"
        }, {
            "section": "50 to 75 Rs Lakhs", "value": tar_analysis.get("less_5_cr", 0), "serial": 32,
            "condition": "=", "group": "tar_analysis"
        }, {
            "section": "> 75 Rs Lakhs", "value": tar_analysis.get("greater_5_cr", 0), "serial": 33,
            "condition": "=", "group": "tar_analysis"
        },{
            "section": "Dealer TT", "value": dealer_truck_count.get("dealer_tt", 0), "serial": 34,
            "condition": "=", "group": "tt_available"
        }, {
            "section": "Transport TT", "value": dealer_truck_count.get("transport_tt", 0), "serial": 35,
            "condition": "=", "group": "tt_available"
        }, {
            "section": "Dealer TT Return", "value": 0, "serial": 36,
            "condition": "=", "group": "tt_available"
        }, {
            "section": "Transport TT Return", "value": 0, "serial": 37,
            "condition": "=", "group": "tt_available"
        }])
    # stats.extend([{"section": x, "value": dealer_tt_count.get(x, 0), "serial": 0, "condition": "=", "group": "truck_details"}
    #               for x in connection_mapping.truck_details])
    stats.extend([{"section": x, "value": 0, "serial": 0, "condition": "=", "group": "dryout_aging"}
                  for x in connection_mapping.dryout_aging])
    # stats.append({"section": "Indent Delivered", "value": delivered_count, "serial": 11, "condition": "=", "group": "delivered"})
    carry_fwd_indent = {"section": "Carry Fwd Indent", "value": 0, "serial": 12, "condition": "=", "group": "carry_fwd_indent"}
    ist = pytz.timezone('Asia/Kolkata')
    carry_fwd_indent_date = datetime.datetime.now(ist).strftime("%H")
    if int(carry_fwd_indent_date) > 0 and data.bu_type == 'sod':
        # list_of_carry_fwd_indents = await dry_out_analysis.get_carry_fwd_indent(get_only_dry_out_ro=False)
        carry_fwd_data = await dry_out_analysis.sync_carry_fwd_indent(insert_to_db=False)
        carry_fwd_data = pd.DataFrame(carry_fwd_data)
        pending_carry_fwd_data = await dry_out_analysis.get_previous_day_carry_fwd_indent()
        other_cwf_count = (len(carry_fwd_data) - len(carry_fwd_data[carry_fwd_data['dry_out_in_days'].fillna("") != '']) if len(carry_fwd_data) else 0
                           - len(carry_fwd_data[carry_fwd_data['category'].fillna("") != ''])) if len(carry_fwd_data) else 0
        pending_cwf_other_count = (pending_carry_fwd_data.get("cf_indents", 0) - pending_carry_fwd_data.get("dryout_count", 0)
                                   - pending_carry_fwd_data.get("category_a_count", 0))
        stats.extend([{
            "section": "Overall CarryFwd Indent",
            "value": len(carry_fwd_data),
            "serial": 15, "condition": "=", "group": "carry_fwd_indent"
        }, {
            "section": "DryOut CarryFwd Indent",
            "value": len(carry_fwd_data[carry_fwd_data['dry_out_in_days'].fillna("") != ''])
            if len(carry_fwd_data) else 0,
            "serial": 16, "condition": "=", "group": "carry_fwd_indent"
        }, {
            "section": "CATA Carry Fwd Indent",
            "value": len(carry_fwd_data[carry_fwd_data['category'].fillna("") != '']) if len(carry_fwd_data) else 0,
            "serial": 17, "condition": "=", "group": "carry_fwd_indent"
        },{
            "section": "Others CarryFwd Indent",
            "value": other_cwf_count,
            "serial": 18, "condition": "=", "group": "carry_fwd_indent"
        },{
            "section": "Pending Overall CarryFwd Indent",
            "value": pending_carry_fwd_data.get("cf_indents", 0),
            "serial": 15, "condition": "=", "group": "pending_carry_fwd_indent"
        }, {
            "section": "Pending DryOut CarryFwd Indent",
            "value": pending_carry_fwd_data.get("dryout_count", 0),
            "serial": 16, "condition": "=", "group": "pending_carry_fwd_indent"
        }, {
            "section": "Pending CATA CarryFwd Indent",
            "value": pending_carry_fwd_data.get("category_a_count", 0),
            "serial": 17, "condition": "=", "group": "pending_carry_fwd_indent"
        },{
            "section": "Pending Others CarryFwd Indent",
            "value": pending_cwf_other_count,
            "serial": 18, "condition": "=", "group": "pending_carry_fwd_indent"
        }])
    else:
        stats.extend([{
            "section": "Carry Fwd Indent",
            "value": 0,
            "serial": 15, "condition": "=", "group": "carry_fwd_indent"
        },{
            "section": "DryOut Carry Fwd Indent",
            "value": 0,
            "serial": 16, "condition": "=", "group": "carry_fwd_indent"
        },{
            "section": "CATA Carry Fwd Indent",
            "value": 0,
            "serial": 17, "condition": "=", "group": "carry_fwd_indent"
        },{
            "section": "Pending CarryFwd Indent",
            "value": 0,
            "serial": 15, "condition": "=", "group": "pending_carry_fwd_indent"
        }, {
            "section": "Pending DryOut CarryFwd Indent",
            "value": 0,
            "serial": 16, "condition": "=", "group": "pending_carry_fwd_indent"
        }, {
            "section": "Pending CATA CarryFwd Indent",
            "value": 0,
            "serial": 17, "condition": "=", "group": "pending_carry_fwd_indent"
        }])
    # ro_not_in_ims_count = await dry_out_analysis.ro_not_in_ims()
    # atg_ack = await dry_out_analysis.get_atg_ack(sap_id="", product_code="")
    atg_ack = 0
    if data.bu_type == 'sod':
        atg_ack = await dry_out_analysis.get_atg_ack_count(dry_out_in_days=str(dry_out_in_days_query))
    # stats.append({"section": "RO Not In IMS", "value": len(ro_not_in_ims_count), "serial": 18, "condition": "=", "group": "ro_not_in_ims"})
    stats = sorted(stats, key=lambda x: x['serial'])
    updated_stats = []
    for each_stats in stats:
        if each_stats['section'] == 'Delivery Confirmation':
            each_stats['value'] = delivered_count
        if each_stats['section'] == 'ATG Ack':
            each_stats['value'] = atg_ack
        updated_stats.append(each_stats)
    return {
        "status": True, "message": "Success", "stats": updated_stats,
        "valid_indents": {
            "section": "Valid Indents", "value": sum([rec['value'] for rec in stats[3:-1]]),
            "serial": stats[3]['serial'], "condition": ">", "group": "valid_indents"
        }
    }


# Action get_dried_out_ro_data
@router.post('/get_dried_out_ro_data', tags=['IndentDryOut'])
async def indentdryout_get_dried_out_ro_data(data: Indentdryout_Get_Dried_Out_Ro_DataParams):
    top_x_axis_updated = connection_mapping.dry_out_top_x_axis
    top_x_axis = [x for x in top_x_axis_updated if x.get("name") not in ['ATG Ack', 'EMLock', 'EMUnLock', 'Trip Completed', 'VTS Return']]
    bottom_x_axis = connection_mapping.dry_out_bottom_x_axis

    where_clause = ["interlock_name = 'Dry Out Each Indent Wise MainFlow'"]
    where_clause.extend(await hpcl_ceg_model.Alerts.get_clause_conditions(
        extra_key_mapping={"sap_id": "terminal_plant_id"}, default_mapping={"bu": "RO"}))
    # Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=connection_mapping.connection_mapping.get("hpcl_ceg", "1"),
        action='execute_query'
    )
    ist = pytz.timezone('Asia/Kolkata')
    _date = datetime.datetime.now(ist).strftime("%Y-%m-%d")
    is_delivered = False
    for record in data.filters:
        if record.value:
            if record.key == "progress_rate":
                if "11" in record.value:
                    is_delivered = True
            if record.key == "plant":
                record.key = "terminal_plant_id"
            if len(record.value) == 1:
                where_clause.append(f"{record.key}='{record.value[0]}'")
            else:
                where_clause.append(f"{record.key} in {tuple(record.value)}")
    conditions = ' AND '.join(where_clause)
    query = "select distinct on (sap_id, indent_no, product_code) location_name as name, sap_id, progress_rate as present_stage, id as alert_id," \
            "indent_no as indent_no, product_code as product_code, dry_out_in_days " \
            f"from alerts where indent_status not in ('Cancelled', 'Completed', 'TempClosed', 'ProductLowLevel', 'OfflineOrFalseAlarm', 'NotAvailable') and {conditions}"
    if is_delivered:
        query = "select distinct on (sap_id, indent_no, product_code) location_name as name, sap_id, progress_rate as present_stage, id as alert_id," \
                "indent_no as indent_no, product_code as product_code, dry_out_in_days " \
                f"from alerts where indent_status not in ('Cancelled', 'TempClosed', 'ProductLowLevel', 'OfflineOrFalseAlarm', 'NotAvailable') and {conditions} and DATE(updated_at) = '{_date}' and jsonb_array_length(alert_history::jsonb) > 2"
    function = await charts_connection_vault_routing(charts_ins)
    resp = await function(
        query=query
    )

    grouped_data = {}
    for entry in resp:
        entry['name'] = str(entry["sap_id"]) + ' - ' + (entry['name'] or '')
        sap_id = entry["sap_id"]
        if sap_id not in grouped_data:
            grouped_data[sap_id] = []
        grouped_data[sap_id].append(entry)
    formatted_data = [{key: value} for key, value in grouped_data.items()]

    return {"status": True, "message": "Success", "data": formatted_data,
            "top_x_axis": [rec['name'] for rec in top_x_axis],
            "bottom_x_axis": bottom_x_axis}


# Action get_distinct_ro_name
@router.post('/get_distinct_ro_name', tags=['IndentDryOut'])
async def indentdryout_get_distinct_ro_name(data: Indentdryout_Get_Distinct_Ro_NameParams):
    where_clause = ["interlock_name = 'Dry Out Each Indent Wise MainFlow'"]
    # Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=connection_mapping.connection_mapping.get("hpcl_ceg", "1"),
        action='execute_query'
    )
    for record in data.filters:
        if record.key == "progress_rate":
            where_clause.append(f"progress_rate={int(record.value[0])}")
        else:
            if record.value:
                if record.key == "plant":
                    record.key = "terminal_plant_id"
                if len(record.value) == 1:
                    where_clause.append(f"{record.key}='{record.value[0]}'")
                else:
                    where_clause.append(f"{record.key} in {tuple(record.value)}")
    conditions = ' AND '.join(where_clause)
    query = f'''select dealer_id, location_name, terminal_plant_id, terminal_plant_name
                from public.alerts where {conditions}
                group by dealer_id, location_name, terminal_plant_id, terminal_plant_name'''
    function = await charts_connection_vault_routing(charts_ins)
    resp = await function(
        query=query
    )

    resp = pd.DataFrame(resp)
    # resp = [{"name": row['location_name'], "id": row['dealer_id']} for _, row in resp.iterrows()]
    result = {
        "customer": [{"name": str(row['dealer_id']) + " - " + row['location_name'],
                      "id": row['dealer_id']} for _, row in resp.iterrows()
                     if row['dealer_id'] and row['location_name']],
        "plant": [{"name": row['terminal_plant_name'], "id": row['terminal_plant_id']} for _, row in resp.iterrows()]
    }
    return {"status": True, "message": "Success", "data": result}


# Action get_carry_fwd_indents
@router.post('/get_carry_fwd_indents', tags=['IndentDryOut'])
async def indentdryout_get_carry_fwd_indents(data: Indentdryout_Get_Carry_Fwd_IndentsParams):
    ...


# Action get_dryout_report
@router.post('/get_dryout_report', tags=['IndentDryOut'])
async def indentdryout_get_dryout_report(data: Indentdryout_Get_Dryout_ReportParams):
    dry_out_data = await dry_out_analysis._get_dry_out_ims_report(
        dry_out_in_days=data.dry_out_in_days,
        page=data.page,
        page_size=data.page_size,
        action=data.action

    )
    return dry_out_data


# Action generate_dryout_group_data
@router.post('/generate_dryout_group_data', tags=['IndentDryOut'])
async def indentdryout_generate_dryout_group_data(data: Indentdryout_Generate_Dryout_Group_DataParams):
    if data.action == 'carry_fwd_indent':
        carry_fwd_data = await dry_out_analysis.sync_carry_fwd_indent(insert_to_db=False)
        carry_fwd_data = pd.DataFrame(carry_fwd_data)
        carry_fwd_data.rename(columns={
            "sap_id": "DEALER_CODE", "terminal_plant_id": "LOCN_ID", "indent_no": "INDENT_NO",
            "prod_reqd_dt": "PROD_REQD_DT", "reported_date": "REPORTED_DATE",
            "dry_out_in_days": "DRY_OUT_IN_DAYS", "category": "CATEGORY", "indent_status": "INDENT_STATUS"
        }, inplace=True)
        carry_fwd_data = carry_fwd_data.drop(["dried_out"], axis=1, errors="ignore")
        print("carry_fwd_data: ", carry_fwd_data)
        return carry_fwd_data.to_dict(orient="records")

    if data.action == 'dryout_analysis':
        return await dry_out_analysis.get_dryout_aging_data()

    if data.action == 'pending_carry_fwd_indent':
        return await dry_out_analysis.get_previous_day_carry_fwd_indent(data="data")

    return {}

# Action get_indent_raised_direct_sales
@router.post('/get_indent_raised_direct_sales', tags=['IndentDryOut'])
async def indentdryout_get_indent_raised_direct_sales(data: Indentdryout_Get_Indent_Raised_Direct_SalesParams):
    return await indentwise_direct_sales.IndentDryOutDirectSales().get_indent_raised_direct_sales(data)


# Action get_indent_on_hold_direct_sales
@router.post('/get_indent_on_hold_direct_sales', tags=['IndentDryOut'])
async def indentdryout_get_indent_on_hold_direct_sales(data: Indentdryout_Get_Indent_On_Hold_Direct_SalesParams):
    return await indentwise_direct_sales.IndentDryOutDirectSales().get_indent_on_hold_direct_sales(data)


# Action get_pending_indents_direct_sales
@router.post('/get_pending_indents_direct_sales', tags=['IndentDryOut'])
async def indentdryout_get_pending_indents_direct_sales(data: Indentdryout_Get_Pending_Indents_Direct_SalesParams):
    return await indentwise_direct_sales.IndentDryOutDirectSales().get_pending_indents_direct_sales(data)


# Action get_valid_indent_direct_sales
@router.post('/get_valid_indent_direct_sales', tags=['IndentDryOut'])
async def indentdryout_get_valid_indent_direct_sales(data: Indentdryout_Get_Valid_Indent_Direct_SalesParams):
    return await indentwise_direct_sales.IndentDryOutDirectSales().get_valid_indent_direct_sales(data)


# Action get_truck_allocated_direct_sales
@router.post('/get_truck_allocated_direct_sales', tags=['IndentDryOut'])
async def indentdryout_get_truck_allocated_direct_sales(data: Indentdryout_Get_Truck_Allocated_Direct_SalesParams):
    return await indentwise_direct_sales.IndentDryOutDirectSales().get_truck_allocated_direct_sales(data)


# Action get_send_to_sap_direct_sales
@router.post('/get_send_to_sap_direct_sales', tags=['IndentDryOut'])
async def indentdryout_get_send_to_sap_direct_sales(data: Indentdryout_Get_Send_To_Sap_Direct_SalesParams):
    return await indentwise_direct_sales.IndentDryOutDirectSales().get_send_to_sap_direct_sales(data)


# Action get_sales_order_placed_direct_sales
@router.post('/get_sales_order_placed_direct_sales', tags=['IndentDryOut'])
async def indentdryout_get_sales_order_placed_direct_sales(data: Indentdryout_Get_Sales_Order_Placed_Direct_SalesParams):
    return await indentwise_direct_sales.IndentDryOutDirectSales().get_sales_order_placed_direct_sales(data)


# Action get_r2_swipe_direct_sales
@router.post('/get_r2_swipe_direct_sales', tags=['IndentDryOut'])
async def indentdryout_get_r2_swipe_direct_sales(data: Indentdryout_Get_R2_Swipe_Direct_SalesParams):
    return await indentwise_direct_sales.IndentDryOutDirectSales().get_r2_swipe_direct_sales(data)


# Action get_is_invoice_created_direct_sales
@router.post('/get_is_invoice_created_direct_sales', tags=['IndentDryOut'])
async def indentdryout_get_is_invoice_created_direct_sales(data: Indentdryout_Get_Is_Invoice_Created_Direct_SalesParams):
    return await indentwise_direct_sales.IndentDryOutDirectSales().get_is_invoice_created_direct_sales(data)


# Action get_r3_swiped_direct_sales
@router.post('/get_r3_swiped_direct_sales', tags=['IndentDryOut'])
async def indentdryout_get_r3_swiped_direct_sales(data: Indentdryout_Get_R3_Swiped_Direct_SalesParams):
    return await indentwise_direct_sales.IndentDryOutDirectSales().get_r3_swiped_direct_sales(data)


# Action get_dried_out_ro_by_actions
@router.post('/get_dried_out_ro_by_actions', tags=['IndentDryOut'])
async def indentdryout_get_dried_out_ro_by_actions(data: Indentdryout_Get_Dried_Out_Ro_By_ActionsParams):
    conditions, dry_out_in_days_query, tt_count_filter = await api_helpers.get_where_clause_condition(data.filters)
    stats = []
    if data.actions == "initial_steps":
        return await api_helpers.get_initial_dryout_counts(data.bu_type, conditions, dry_out_in_days_query)
    if data.bu_type == 'ro' and data.actions == 'dryout_analysis':
        dry_out_aging = await dry_out_analysis.get_dryout_aging(conditions)
        less_than_2_days = dry_out_aging.get("less_than_2_days", 0)
        from_3_to_7_days = dry_out_aging.get("from_3_to_7_days", 0)
        from_8_to_15_days = dry_out_aging.get("from_8_to_15_days", 0)
        more_than_15_days = dry_out_aging.get("more_than_15_days", 0)
        indent_not_raised_count = less_than_2_days + from_3_to_7_days + from_8_to_15_days + more_than_15_days
        
        count_50_klm = None
        if urdhva_base.settings.server_ip in ['10.90.38.222']:
            count_50_klm = await dry_out_analysis.get_ro_count_less_50(conditions)
        
        if urdhva_base.settings.server_ip in ['10.90.38.211','10.90.38.212']:
            low_volumn_klpm = "Not Available"
            volumn_klpm = "Not Available"
        
        closed_outlet = await dry_out_analysis.get_closed_outlet(conditions=conditions,
                                                                 dry_out_in_days=dry_out_in_days_query)
        nozzle_sales = await dry_out_analysis.get_nozzle_sales(conditions=conditions,
                                                               dry_out_in_days=dry_out_in_days_query)
        
        if count_50_klm is not None:
            low_volumn_klpm = count_50_klm
            volumn_klpm = indent_not_raised_count - count_50_klm
            
        stats = [
            {
                "section": "Indent Not Raised", "value": indent_not_raised_count, "serial": 24,
                "condition": "=", "group": "dryout_analysis"
            }, {
                "section": "<2 Days", "value": less_than_2_days, "serial": 25,
                "condition": "=", "group": "dryout_analysis"
            }, {
                "section": "3 to 7 Days", "value": from_3_to_7_days, "serial": 26,
                "condition": "=", "group": "dryout_analysis"
            }, {
                "section": "8 to 15 Days", "value": from_8_to_15_days, "serial": 27,
                "condition": "=", "group": "dryout_analysis"
            }, {
                "section": "> 15 Days", "value": more_than_15_days, "serial": 28,
                "condition": "=", "group": "dryout_analysis"
            }, {
                "section": "Indent Not Raised", "value": indent_not_raised_count, "serial": 20,
                "condition": "=", "group": "indent"
            }, {
                "section": "Low Volume(<50KLPM)", "value": low_volumn_klpm, "serial": 21,
                "condition": "=", "group": "indent"
            }, {
                "section": "Volume(>50KLPM)", "value":  volumn_klpm, "serial": 22,
                "condition": "=", "group": "indent"
            }, {
                "section": "Closed Outlets", "value": closed_outlet, "serial": 23,
                "condition": "=", "group": "indent"
            }, {
                "section": "Nozzle Sales Not Started", "value": nozzle_sales, "serial": 24,
                "condition": "=", "group": "indent"
            }
        ]

    if data.bu_type == 'ro' and data.actions == 'tar_analysis':
        tar_analysis = await dry_out_analysis.get_tar_analysis(conditions)
        _0_to_25_rs_lakhs = tar_analysis.get("less_1_cr", 0)
        _25_to_50_rs_lakhs = tar_analysis.get("less_2_cr", 0)
        _50_to_75_rs_lakhs = tar_analysis.get("less_5_cr", 0)
        more_than_75_rs_lakhs = tar_analysis.get("greater_5_cr", 0)
        indent_not_raised_count = _0_to_25_rs_lakhs + _25_to_50_rs_lakhs + _50_to_75_rs_lakhs + more_than_75_rs_lakhs
        stats = [
            # {
            #     "section": "Indent Not Raised", "value": indent_not_raised_count, "serial": 29,
            #     "condition": "=", "group": "tar_analysis"
            # },
            {
                "section": "0 to 25 Rs Lakhs", "value": _0_to_25_rs_lakhs, "serial": 30,
                "condition": "=", "group": "tar_analysis"
            }, {
                "section": "25 to 50 Rs Lakhs", "value": _25_to_50_rs_lakhs, "serial": 31,
                "condition": "=", "group": "tar_analysis"
            }, {
                "section": "50 to 75 Rs Lakhs", "value": _50_to_75_rs_lakhs, "serial": 32,
                "condition": "=", "group": "tar_analysis"
            }, {
                "section": "> 75 Rs Lakhs", "value": more_than_75_rs_lakhs, "serial": 33,
                "condition": "=", "group": "tar_analysis"
            }
        ]

    if data.bu_type == 'sod' and data.actions == 'dealer_truck_count':
        dealer_truck_count = await dry_out_analysis.get_tt_counts(tt_count_filter)
        stats = [
            {
                "section": "Dealer TT", "value": dealer_truck_count.get("dealer_tt", 0), "serial": 34,
                "condition": "=", "group": "tt_available"
            }, {
                "section": "Transport TT", "value": dealer_truck_count.get("transport_tt", 0), "serial": 35,
                "condition": "=", "group": "tt_available"
            }, {
                'section': 'Dealer TT Return', 'value': 0, 'serial': 36, 'condition': '=',
                'group': 'tt_available'
            }, {'section': 'Transport TT Return', 'value': 0, 'serial': 37, 'condition': '=',
                'group': 'tt_available'
            }
        ]

    ist = pytz.timezone('Asia/Kolkata')
    carry_fwd_indent_date = datetime.datetime.now(ist).strftime("%H")
    if int(carry_fwd_indent_date) > 0 and data.bu_type == 'sod' and data.actions == 'carry_fwd_indent':
        carry_fwd_data = await dry_out_analysis.sync_carry_fwd_indent(insert_to_db=False)
        carry_fwd_data = pd.DataFrame(carry_fwd_data)

        other_cwf_count = (
            len(carry_fwd_data) - len(carry_fwd_data[carry_fwd_data['dry_out_in_days'].fillna("") != '']) if len(
                carry_fwd_data) else 0
                                     - len(carry_fwd_data[carry_fwd_data['category'].fillna("") != ''])) if len(
            carry_fwd_data) else 0

        stats = [
            {
                "section": "Overall CarryFwd Indent",
                "value": len(carry_fwd_data),
                "serial": 15, "condition": "=", "group": "carry_fwd_indent"
            }, {
                "section": "DryOut CarryFwd Indent",
                "value": len(carry_fwd_data[carry_fwd_data['dry_out_in_days'].fillna("") != ''])
                if len(carry_fwd_data) else 0,
                "serial": 16, "condition": "=", "group": "carry_fwd_indent"
            }, {
                "section": "CATA Carry Fwd Indent",
                "value": len(carry_fwd_data[carry_fwd_data['category'].fillna("") != '']) if len(carry_fwd_data) else 0,
                "serial": 17, "condition": "=", "group": "carry_fwd_indent"
            }, {
                "section": "Others CarryFwd Indent",
                "value": other_cwf_count,
                "serial": 18, "condition": "=", "group": "carry_fwd_indent"
            }
        ]

    if int(carry_fwd_indent_date) > 0 and data.bu_type == 'sod' and data.actions == 'pending_carry_fwd_indent':
        pending_carry_fwd_data = await dry_out_analysis.get_previous_day_carry_fwd_indent()
        pending_cwf_other_count = (
                    pending_carry_fwd_data.get("cf_indents", 0) - pending_carry_fwd_data.get("dryout_count", 0)
                    - pending_carry_fwd_data.get("category_a_count", 0))
        stats = [{
            "section": "Pending Overall CarryFwd Indent",
            "value": pending_carry_fwd_data.get("cf_indents", 0),
            "serial": 15, "condition": "=", "group": "pending_carry_fwd_indent"
        }, {
            "section": "Pending DryOut CarryFwd Indent",
            "value": pending_carry_fwd_data.get("dryout_count", 0),
            "serial": 16, "condition": "=", "group": "pending_carry_fwd_indent"
        }, {
            "section": "Pending CATA CarryFwd Indent",
            "value": pending_carry_fwd_data.get("category_a_count", 0),
            "serial": 17, "condition": "=", "group": "pending_carry_fwd_indent"
        }, {
            "section": "Pending Others CarryFwd Indent",
            "value": pending_cwf_other_count,
            "serial": 18, "condition": "=", "group": "pending_carry_fwd_indent"
        }]

    return stats


# Action get_cancelled_indent_direct_sales
@router.post('/get_cancelled_indent_direct_sales', tags=['IndentDryOut'])
async def indentdryout_get_cancelled_indent_direct_sales(data: Indentdryout_Get_Cancelled_Indent_Direct_SalesParams):
    return await indentwise_direct_sales.IndentDryOutDirectSales().get_cancelled_indent_direct_sales(data)


# Action get_vts_direct_sales
@router.post('/get_vts_direct_sales', tags=['IndentDryOut'])
async def indentdryout_get_vts_direct_sales(data: Indentdryout_Get_Vts_Direct_SalesParams):
    return await indentwise_direct_sales.IndentDryOutDirectSales().get_vts_direct_sales(data)


# Action get_delivery_confirmation_direct_sales
@router.post('/get_delivery_confirmation_direct_sales', tags=['IndentDryOut'])
async def indentdryout_get_delivery_confirmation_direct_sales(data: Indentdryout_Get_Delivery_Confirmation_Direct_SalesParams):
    return await indentwise_direct_sales.IndentDryOutDirectSales().get_delivery_confirmation_direct_sales(data)


# Action block_outlet
@router.post('/block_outlet', tags=['IndentDryOut'])
async def indentdryout_block_outlet(
    payload: Indentdryout_Block_OutletParams
):
    block_id = payload.block_id
    remarks_blocked = payload.remarks_blocked
    upload_file = None
    try:
        rpt = urdhva_base.context.context.get('rpt', {})
        if not rpt:
            return {"status": False, "message": "Session got expired, Please Re-Login"}

        try:
            block_id = int(block_id)
        except Exception:
            return {"status": False, "message": "Invalid block_id"}
        
        query = f"id = {block_id}"
        alert_data = await Alerts.get_all(
            urdhva_base.queryparams.QueryParams(q=query, limit=1),
            resp_type="plain"
        )

        if not alert_data.get("data"):
            return {"status": False, "message": "No active block found for the outlet"}

        alert_record = alert_data["data"][0]
     
        minio_path = ""
        file_path = ""

        if upload_file:
            UPLOAD_DIR = os.path.join(
                urdhva_base.settings.uploads,
                "ro_blocked"
            )
            os.makedirs(UPLOAD_DIR, exist_ok=True)

            file_name = upload_file.filename
            file_path = os.path.join(UPLOAD_DIR, file_name)

            with open(file_path, "wb") as f:
                f.write(await upload_file.read())

            status, minio_path = minio_connector.upload_to_minio(
                "alerts",         # bucket (same bucket)
                "ro_blocked",    # section/folder
                str(block_id),       # sub-folder
                file_path         # local filepath
            )

            if not status:
                return {
                    "status": False,
                    "message": "MinIO upload failed",
                    "error": minio_path
                }

        payload = {
            "messageName": "BlockNozzles",
            "processInstanceId": alert_record.get("workflow_instance_id")
        }

        camunda_url = f"{alert_record.get('workflow_url')}/engine-rest/message"

        response = requests.post(camunda_url, json=payload)

        if response.status_code != 204:
            logger.error(
                f"Camunda block failed | "
                f"alert_id={alert_record.get('id')} | "
                f"status={response.status_code} | "
                f"response={response.text}"
            )
            return {"status": False, "message": "Failed to block the ro via workflow"}
        
        event_time_utc = urdhva_base.utilities.get_present_time()
        ist_time = event_time_utc.astimezone(pytz.timezone("Asia/Kolkata"))
        alert_history = alert_record.get("alert_history", [])

        alert_history.append({
            "action_msg": (
                f"Block Initiated For Outlet {alert_record.get('sap_id')} "
                f"initiated by {rpt.get('username','')} "
                f"at {ist_time.strftime('%d-%m-%Y %I:%M:%S %p')} IST"
            ),
            "action_type": "Blocked",
            "action_by": rpt.get('username',''),
            "processed_time": event_time_utc.isoformat()
        })

        await Alerts(**{
            "id": alert_record.get("id"),
            "alert_history": alert_history,
            "remarks_unblocked": remarks_blocked,
            "file_uploaded_path": minio_path or ""
        }).modify()

        return {"status": True, "message": "Outlet has been successfully blocked"}

    except Exception:
        print(traceback.format_exc())
        return {"status": False, "message": "Failed to block the Outlet"}

# Action unblock_outlet
@router.post('/unblock_outlet', tags=['IndentDryOut'])
async def indentdryout_unblock_outlet(payload: Indentdryout_Unblock_OutletParams):
    unblock_id = payload.unblock_id
    remarks_unblocked = payload.remarks_unblocked
    upload_file = None
    try:
        rpt = urdhva_base.context.context.get('rpt', {})
        if not rpt:
            return {"status": False, "message": "Session got expired, Please Re-Login"}

        try:
            unblock_id = int(unblock_id)
        except Exception:
            logger.error(f"Invalid unblock_id value: {unblock_id}")
            return {"status": False, "message": "Invalid unblock_id"}

        query = f"id = {unblock_id}"
        alert_data = await Alerts.get_all(
            urdhva_base.queryparams.QueryParams(q=query, limit=1),
            resp_type="plain"
        )

        if not alert_data.get("data"):
            return {"status": False, "message": "No active block found for the outlet"}

        alert_record = alert_data["data"][0]
     
        minio_path = ""
        file_path = ""

        if upload_file:
            UPLOAD_DIR = os.path.join(
                urdhva_base.settings.uploads,
                "ro_unblocked"
            )
            os.makedirs(UPLOAD_DIR, exist_ok=True)

            file_name = upload_file.filename
            file_path = os.path.join(UPLOAD_DIR, file_name)

            with open(file_path, "wb") as f:
                f.write(await upload_file.read())

            status, minio_path = minio_connector.upload_to_minio(
                "alerts",         # bucket (same bucket)
                "ro_unblocked",    # section/folder
                str(unblock_id),       # sub-folder
                file_path         # local filepath
            )

            if not status:
                logger.error(f"MinIO upload failed: {minio_path}")
                return {
                    "status": False,
                    "message": "MinIO upload failed",
                    "error": minio_path
                }

        payload = {
            "messageName": "UnblockNozzles",
            "processInstanceId": alert_record.get("workflow_instance_id")
        }

        camunda_url = f"{alert_record.get('workflow_url')}/engine-rest/message"

        response = requests.post(camunda_url, json=payload)

        if response.status_code != 204:
            logger.error(
                f"Camunda unblock failed | "
                f"alert_id={alert_record.get('id')} | "
                f"status={response.status_code} | "
                f"response={response.text}"
            )
            return {"status": False, "message": "Failed to unblock the outlet"}

        event_time_utc = urdhva_base.utilities.get_present_time()
        ist_time = event_time_utc.astimezone(pytz.timezone("Asia/Kolkata"))
        alert_history = alert_record.get("alert_history", [])

        alert_history.append({
            "action_msg": (
                f"Unblock for Outlet {alert_record.get('sap_id')} "
                f"initiated by {rpt.get('username','')} "
                f"at {ist_time.strftime('%d-%m-%Y %I:%M:%S %p')} IST"
            ),
            "action_type": "UnBlocked",
            "action_by": rpt.get('username',''),
            "processed_time": event_time_utc.isoformat()
        })

        await Alerts(**{
            "id": alert_record.get("id"),
            "alert_history": alert_history,
            "remarks_unblocked": remarks_unblocked,
            "file_uploaded_path": minio_path or ""
        }).modify()

        return {"status": True, "message": "Outlet has been successfully unblocked"}

    except Exception:
        print(traceback.format_exc())
        logger.exception("Unhandled error during outlet unblock")
        return {"status": False, "message": "Failed to unblock the outlet"}


# Action block_ro
@router.post('/block_ro', tags=['IndentDryOut'])
async def indentdryout_block_ro(data: Indentdryout_Block_RoParams):
    print('*'*200)
    print(data.ro_code)
    print(data.remarks_blocked)
    print('*'*200)
    query = f"""select * from location_master where sap_id='{data.ro_code}'"""
    location_data = await hpcl_ceg_model.Alerts.get_aggr_data(query)
    if not location_data['data']:
        return {"status": False, "message": "RO Not Available in Location Master"}
    
    try:
        location_data_ = location_data['data'][0]
        allocated_time = datetime.datetime.now(datetime.timezone.utc)
        processed_time = datetime.datetime.now(datetime.timezone.utc)
        alert_history = [{
            "action_msg" : (
                f"Violation Type: Restroom Cleaning Evidence Missing \n"
                f"for Outlet: {location_data_.get('name','')}"
            ),
            "action_type": "Created",
            "alert_status": "Open",
            "allocated_time": allocated_time.isoformat(),
            "processed_time": processed_time.isoformat()
        }]
        alert_data = {
            "bu": "RO",
            "severity": "High",
            "sop_id": "SOP023",
            "alert_history": alert_history,
            "alert_section": "RO",
            "violation_type": "Restroom Cleaning Evidence Missing",
            "interlock_name": "Restroom Cleaning Evidence Missing",
            "sap_id": location_data_.get('sap_id',''),
            "location_name": location_data_.get('name',''),
            "zone": location_data_.get('zone',''),
            "region": location_data_.get('region',''),
            "sales_area": location_data_.get('sales_area',''),
            "block_status": None
        }
        # need to trigger camunda workflow 
        camunda_url = await helpers.get_camunda_url("RO",location_data_.get('sap_id'),alert_section='RO')
        print('*'*200)
        print('alert_data',alert_data)
        print('*'*200)
        await alert_factory.AlertFactory().create_alert(alert_data, camunda_url)
        query = ("select sap_id, id from alerts where sap_id='{alert_data.sap_id}' "
                 "AND interlock_name='Restroom Cleaning Evidence Missing' "
                 "AND alert_status='Open' order by created_at desc limit 1")
        resp = await Alerts.get_aggr_data(query)
        if resp['data']:
            payload = Indentdryout_Block_OutletParams(block_id=resp['data'][0]['id'], remarks_blocked=data.remarks_blocked)
            await indentdryout_block_outlet(payload)
        return {"status": True, "message": "RO has been successfully blocked"}
    except Exception as e:
        print(traceback.format_exc())
        return {"status": False, "message": "Failed To Block The RO"}


# Action bulk_outlet_block
@router.post('/bulk_outlet_block', tags=['IndentDryOut'])
async def indentdryout_bulk_outlet_block(data: Indentdryout_Bulk_Outlet_BlockParams):
    try:
        rpt = urdhva_base.context.context.get('rpt', {})
        if not rpt:
            return {"status": False, "message": "Session got expired, Please Re-Login"}
        alert_data = {}
        alert_data["task_type"] = "block outlets"
        alert_data["alert_ids"] = data.alert_id
        alert_data['reason'] = data.reason
        alert_data['username'] = rpt.get('username')

        redis_queue = urdhva_base.redispool.RedisQueue('ro_blocking_queue')
        await redis_queue.put(json.dumps(alert_data))
        return {"status": True, "message": "Outlet has been successfully blocked"}
    except Exception:
        print(traceback.format_exc())
        return {"status": False, "message": "Failed to block the Outlet"}


# Action bulk_outlet_unblock
@router.post('/bulk_outlet_unblock', tags=['IndentDryOut'])
async def indentdryout_bulk_outlet_unblock(data: Indentdryout_Bulk_Outlet_UnblockParams):
    try:
        rpt = urdhva_base.context.context.get('rpt', {})
        if not rpt:
            return {"status": False, "message": "Session got expired, Please Re-Login"}
        alert_data = {}
        alert_data["task_type"] = "unblock outlets"
        alert_data["alert_ids"] = data.alert_id
        alert_data['reason'] = data.reason
        alert_data['username'] = rpt.get('username')

        redis_queue = urdhva_base.redispool.RedisQueue('ro_blocking_queue')
        await redis_queue.put(json.dumps(alert_data))
        return {"status": True, "message": "Outlet has been successfully unblocked"}
    except Exception:
        print(traceback.format_exc())
        return {"status": False, "message": "Failed to unblock the Outlet"}
