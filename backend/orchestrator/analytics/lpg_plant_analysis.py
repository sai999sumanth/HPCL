import urdhva_base
import os
import traceback
import pandas as pd
import polars as pl
import hpcl_ceg_model
import mysql.connector
import urdhva_base.utilities
import utilities.helpers as helpers
from datetime import datetime,timedelta, timezone
from collections import defaultdict
from dateutil.relativedelta import relativedelta
from orchestrator.dbconnector.widget_actions import widget_actions
import utilities.connection_mapping as connection_mapping
import charts_actions
import dashboard_studio_model
# from charts_actions import charts_connection_vault_routing
# from dashboard_studio_model import Charts_Connection_Vault_RoutingParams
import orchestrator.dbconnector.credential_loader as credential_loader

# Material Codes for Domestic and Non-Domestic Sales
material_code_domestic = ['0949036', '0949109']
material_code_non_domestic = ['0948064', '0948450', '0948042', '0948149']
material_code_bulk = ['0949000']


def load_lpg_tank_capacity():
    """Loading tank operating capacity and daily average sales data from master sheet provided by HPCL"""
    file_path = f"{os.path.dirname(helpers.__file__)}/../orchestrator/masterdata/lpg_tank_capacity.xlsx"
    capacity_data = pd.read_excel(file_path)
    capacity_data['LPGPlantCode'] = capacity_data['LPGPlantCode'].astype(str)
    # capacity_data = capacity_data[capacity_data['IsSelected'] == 'Y']
    return capacity_data


def load_opening_stock_from_csv(plants):
    """Loading opening stock from csv file"""
    file_path = f"{os.path.dirname(helpers.__file__)}/../orchestrator/masterdata/lpgintransit.csv"
    df = pd.read_csv(file_path)
    df['plant'] = df['plant'].astype(str)
    if plants:
        df = df[df['plant'].isin([f"{plant}" for plant in plants])]
    df = df[['valuation_type', 'QTY']]
    dom, non_dom = df[df['valuation_type'] == 'HPC_DOM'].sum()['QTY'], df[df['valuation_type'] == 'HPC_NDM'].sum()['QTY']
    return round(float(dom)), round(float(non_dom))


async def fetch_from_tibco(query):
    # For fetching data from Tibco, Using MYSQL interface
    creds = credential_loader.get_credentials('TIBCO')
    connection = mysql.connector.connect(
        host=creds['host'],
        user=creds['user'],
        passwd=creds['password'],
        port=creds['port']
    )
    cursor = connection.cursor()
    cursor.execute(query)
    data = cursor.fetchall()
    # Convert to list of dictionaries
    columns = [col[0] for col in cursor.description]  # Extract column names
    result = [dict(zip(columns, row)) for row in data]
    cursor.close()
    connection.close()
    return result


async def lpg_plant_analysis(filters, cross_filters, drill_state="", time_grain="", resp_format=""):
    """
    LPG Plant level analysis
    :param filters:
    :param cross_filters:
    :param drill_state:
    :param time_grain:
    :param resp_format:
    :return:
    """
    lpg_data = {"stock": 0, "current_inventory": 0,
                "hpcl_sales": {"dom": 0, "non_dom": 0, "bulk": 0}, "omc_sales": {"dom": 0, "non_dom": 0, "bulk": 0},
                "stock_transfers": {"dom": 0, "non_dom": 0, "bulk": 0},
                "opening_stock": {"dom": 0, "non_dom": 0},
                "tankage": {"total": 0, "not_in_ops": 0, "op_tankage": 0, "stock_percentage": 0},
                "avg_sales": {"dom": 0, "non_dom": 0, "bulk": 0}, "days_cover": 0, "in_transit": 0}

    zones = [cond['value'] if cond['value'] else cond.get('val') for cond in filters
             if cond['key'].strip('"') == 'zone_name' and (cond['value'] or cond.get('val'))]
    # if not zones:
    #     zones = ['SCZ', 'SZ']
    plants = [cond['value'] if cond['value'] else cond.get('val') for cond
              in filters if cond['key'].strip('"') == 'plant_name' and (cond['value'] or cond.get('val'))]
    filters = [cond for cond in filters if cond['key'].strip('"') not in ['zone_name', 'sap_id', 'plant_name']]
    if not plants and zones:
        in_clause_raw = ", ".join(f"'{value}'" for value in zones)
        query = f"""select sap_id from location_master where bu='LPG' and zone in ({in_clause_raw})"""
        resp = await hpcl_ceg_model.LocationMaster.get_aggr_data(query, limit=1000)
        plants = [rec['sap_id'] for rec in resp['data']]

    # Fetching required data from tibco
    hpcl_sales = await fetch_hpcl_sales(plants)
    omc_sales = await fetch_omc_sales(plants)
    opening_stock_dom, opening_stock_non_dom, operating_tankage = await fetch_opening_stock(plants)
    opening_stock = opening_stock_dom + opening_stock_non_dom
    stock_transfer = await fetch_stock_transfer(plants)
    receipt_stock = await fetch_receipt_stock_transfer(plants)

    lpg_data['stock'] = round(opening_stock)
    lpg_data['receipt_stock'] = round(float(sum(list(receipt_stock.values()))))
    # Updating sales data
    for key, value in hpcl_sales.items():
        lpg_data['avg_sales'][key] += value
    for key, value in omc_sales.items():
        lpg_data['avg_sales'][key] += value
    for key, value in stock_transfer.items():
        lpg_data['avg_sales'][key] += value
    dom_avg_sales, non_dom_avg_sales = await get_hpcl_average_sale(plants)
    lpg_data['opening_stock'].update({"dom": opening_stock_dom, "non_dom": opening_stock_non_dom})
    lpg_data['avg_sales']['dom'] = dom_avg_sales
    lpg_data['avg_sales']['non_dom'] = non_dom_avg_sales
    lpg_data['hpcl_sales'].update(hpcl_sales)
    lpg_data['omc_sales'].update(omc_sales)
    lpg_data['stock_transfers'].update(stock_transfer)
    lpg_data['in_transit'] = round(await fetch_intransit_stock_transfer(plants))

    avg_sales = float(sum(list(lpg_data['avg_sales'].values())))
    lpg_data['current_inventory'] = round((float(opening_stock) + float(sum(list(receipt_stock.values()))) - avg_sales))
    lpg_data['days_cover'] = round(float(lpg_data['current_inventory']) / avg_sales) if avg_sales else 0
    dom_days_cover = round(float((opening_stock_dom - dom_avg_sales) / dom_avg_sales)) if dom_avg_sales else 0
    non_dom_days_cover = round(float((opening_stock_non_dom - non_dom_avg_sales) / non_dom_avg_sales)) \
        if non_dom_avg_sales else 0
    lpg_data['days_cover_stock'] = {"dom": dom_days_cover if dom_days_cover > 0 else 0,
                                    "non_dom": non_dom_days_cover if non_dom_days_cover > 0 else 0}
    lpg_data['tankage']['total'] = 0
    lpg_data['tankage']['op_tankage'] = operating_tankage
    lpg_data['tankage']['stock_percentage'] = (opening_stock / operating_tankage) * 100 if operating_tankage else 0

    for key in lpg_data:
        if isinstance(lpg_data[key], dict):
            for key_ in lpg_data[key]:
                lpg_data[key][key_] = round(lpg_data[key][key_])
    return lpg_data


async def fetch_hpcl_sales(plants):
    """
    For fetching hpcl sales data
    :param plants:
    :return:
    """
    plant_cond = ''
    if plants:
        in_clause_raw = ", ".join(f"'{value}'" for value in plants)
        plant_cond = f" AND ZM.plant in ({in_clause_raw})"
    # HPCL Sales Query
    query_hpcl_sales = f"""
SELECT ZM.MATERIAL_NUMBER,ZM.plant as Locationcode, sum(quantity)/(1000 * 7) AS Average_Sales 
from  CONN_ENT.ZMMCI_MATDOC_V1_STG ZM
LEFT JOIN CONN_ENT.ZSDCV_CUST_SA_STG ZS ON ZM.GOODS_RECIPIENT = ZS.CUSTOMER
WHERE ZM.MVT_TYPE_INVENTORY_MANAGEMENT in ('309','601') AND ZS.DIST_CHANNEL in ('11', '12') AND 
ZM.MATERIAL_NUMBER in ('0949036', '0949109', '0948064', '0948450', '0949000', '0948042', '0948149')
AND DATE_FORMAT( ZM.POSTING_DATE_IN_THE_DOCUMENT,'%Y-%m-%d') between date_sub(CURRENT_DATE,interval 7 day) 
and date_sub(CURRENT_DATE,interval 1 day) {plant_cond}
group by  ZM.plant,ZM.MATERIAL_NUMBER
"""
    hpcl_sales = {"dom": 0, "non_dom": 0, "bulk": 0}
    resp = await fetch_from_tibco(query_hpcl_sales)
    df = pd.DataFrame(resp)
    if not df.empty:
        for rec in df.groupby('MATERIAL_NUMBER', as_index=False).sum().to_dict(orient='records'):
            if rec['MATERIAL_NUMBER'] in material_code_domestic:
                hpcl_sales['dom'] += float(rec['Average_Sales'])
            elif rec['MATERIAL_NUMBER'] in material_code_non_domestic:
                hpcl_sales['non_dom'] += float(rec['Average_Sales'])
            elif rec['MATERIAL_NUMBER'] in material_code_bulk:
                hpcl_sales['bulk'] += float(rec['Average_Sales'])
    return hpcl_sales


async def fetch_omc_sales(plants):
    """
    For fetching omc sales data
    :param plants:
    :return:
    """
    plant_cond = ''
    if plants:
        in_clause_raw = ", ".join(f"'{value}'" for value in plants)
        plant_cond = f" AND ZM.plant in ({in_clause_raw})"
    query_omc_sales = f"""
SELECT ZM.MATERIAL_NUMBER,ZM.plant as Locationcode, sum(quantity)/(1000 * 7) AS Average_Sales 
from  CONN_ENT.ZMMCI_MATDOC_V1_STG ZM
LEFT JOIN CONN_ENT.ZSDCV_CUST_SA_STG ZS ON ZM.GOODS_RECIPIENT = ZS.CUSTOMER
WHERE ZM.MVT_TYPE_INVENTORY_MANAGEMENT in ('309','601','643') AND ZS.DIST_CHANNEL in ('13') AND 
ZM.MATERIAL_NUMBER in ('0949036', '0949109', '0948064', '0948450', '0949000', '0948042', '0948149')
AND DATE_FORMAT( ZM.POSTING_DATE_IN_THE_DOCUMENT,'%Y-%m-%d') between date_sub(CURRENT_DATE,interval 7 day) 
and date_sub(CURRENT_DATE,interval 1 day) {plant_cond}
group by  ZM.plant,ZM.MATERIAL_NUMBER
"""
    omc_sales = {"dom": 0, "non_dom": 0, "bulk": 0}
    resp = await fetch_from_tibco(query_omc_sales)
    df = pd.DataFrame(resp)
    if not df.empty:
        for rec in df.groupby('MATERIAL_NUMBER', as_index=False).sum().to_dict(orient='records'):
            if rec['MATERIAL_NUMBER'] in material_code_domestic:
                omc_sales['dom'] += float(rec['Average_Sales'])
            elif rec['MATERIAL_NUMBER'] in material_code_non_domestic:
                omc_sales['non_dom'] += float(rec['Average_Sales'])
            elif rec['MATERIAL_NUMBER'] in material_code_bulk:
                omc_sales['bulk'] += float(rec['Average_Sales'])
    return omc_sales


async def fetch_stock_transfer(plants):
    """
    For fetching Stock Transfer data
    :param plants:
    :return:
    """
    plant_cond = ''
    if plants:
        in_clause_raw = ", ".join(f"'{value}'" for value in plants)
        plant_cond = f" AND ZM.plant in ({in_clause_raw})"
    query = f"""SELECT ZM.MATERIAL_NUMBER,ZM.plant as Locationcode, sum(quantity)/(1000 * 7) AS Average_Sales 
from  CONN_ENT.ZMMCI_MATDOC_V1_STG ZM
LEFT JOIN CONN_ENT.ZSDCV_CUST_SA_STG ZS ON ZM.GOODS_RECIPIENT = ZS.CUSTOMER
WHERE ZM.MVT_TYPE_INVENTORY_MANAGEMENT in ('641') AND ZM.GOODS_RECIPIENT LIKE 'P%' AND ZS.SALES_ORG='2000'
AND ZM.MATERIAL_NUMBER in ('0949036', '0949109', '0948064', '0948450', '0949000', '0948042', '0948149')
AND DATE_FORMAT( ZM.POSTING_DATE_IN_THE_DOCUMENT,'%Y-%m-%d') between date_sub(CURRENT_DATE,interval 7 day) 
and date_sub(CURRENT_DATE,interval 1 day) {plant_cond}
group by  ZM.plant,ZM.MATERIAL_NUMBER"""
    resp = await fetch_from_tibco(query)
    df = pd.DataFrame(resp)
    receipt_stock = {"dom": 0, "non_dom": 0, "bulk": 0}
    if not df.empty:
        for rec in df.groupby('MATERIAL_NUMBER', as_index=False).sum().to_dict(orient='records'):
            if rec['MATERIAL_NUMBER'] in material_code_domestic:
                receipt_stock['dom'] += float(rec['Average_Sales'])
            elif rec['MATERIAL_NUMBER'] in material_code_non_domestic:
                receipt_stock['non_dom'] += float(rec['Average_Sales'])
            elif rec['MATERIAL_NUMBER'] in material_code_bulk:
                receipt_stock['bulk'] += float(rec['Average_Sales'])
    return receipt_stock


async def fetch_receipt_stock_transfer(plants):
    """
    For fetching Receipt Stock data
    :param plants:
    :return:
    """
    plant_cond = ''
    if plants:
        in_clause_raw = ", ".join(f"'{value}'" for value in plants)
        plant_cond = f" AND ZM.plant in ({in_clause_raw})"
    query = f"""SELECT ZM.MATERIAL_NUMBER,ZM.plant as Locationcode, sum(quantity)/(1000 * 7) AS Average_Sales 
from  CONN_ENT.ZMMCI_MATDOC_V1_STG ZM
LEFT JOIN CONN_ENT.ZSDCV_CUST_SA_STG ZS ON ZM.GOODS_RECIPIENT = ZS.CUSTOMER
WHERE ZM.MVT_TYPE_INVENTORY_MANAGEMENT in ('101') AND 
ZM.MATERIAL_NUMBER in ('0949036', '0949109', '0948064', '0948450', '0949000', '0948042', '0948149')
AND DATE_FORMAT( ZM.POSTING_DATE_IN_THE_DOCUMENT,'%Y-%m-%d') between date_sub(CURRENT_DATE,interval 7 day) 
and date_sub(CURRENT_DATE,interval 1 day) {plant_cond}
group by  ZM.plant,ZM.MATERIAL_NUMBER"""
    resp = await fetch_from_tibco(query)
    df = pd.DataFrame(resp)
    receipt_stock = {"dom": 0, "non_dom": 0, "bulk": 0}
    if not df.empty:
        for rec in df.groupby('MATERIAL_NUMBER', as_index=False).sum().to_dict(orient='records'):
            if rec['MATERIAL_NUMBER'] in material_code_domestic:
                receipt_stock['dom'] += float(rec['Average_Sales'])
            elif rec['MATERIAL_NUMBER'] in material_code_non_domestic:
                receipt_stock['non_dom'] += float(rec['Average_Sales'])
            elif rec['MATERIAL_NUMBER'] in material_code_bulk:
                receipt_stock['bulk'] += float(rec['Average_Sales'])
    return receipt_stock


async def fetch_intransit_stock_transfer(plants):
    """
    For fetching Intransit Stock data
    :param plants:
    :return:
    """
    plant_cond = ''
    if plants:
        in_clause_raw = ", ".join(f"'{value}'" for value in plants)
        plant_cond = f" AND ZM.plant in ({in_clause_raw})"
    current_date = helpers.get_time_stamp_by_delta(urdhva_base.utilities.get_present_time(), days=1,
                                                    with_month_start_day=False, date_time_format='%Y%m%d')
    query = f"""SELECT ZM.plant as Locationcode, sum(quantity)/(1000 * 7) AS Average_Sales 
from  CONN_ENT.ZMMCI_MATDOC_V1_STG ZM
LEFT JOIN CONN_ENT.ZSDCV_CUST_SA_STG ZS ON ZM.GOODS_RECIPIENT = ZS.CUSTOMER
WHERE ZM.MVT_TYPE_INVENTORY_MANAGEMENT in ('101') AND 
ZM.MATERIAL_NUMBER in ('0949000')
AND ZM.POSTING_DATE_IN_THE_DOCUMENT={current_date} {plant_cond}
group by  ZM.plant"""
    resp = await fetch_from_tibco(query)
    receipt_stock = sum([float(rec['Average_Sales']) for rec in resp])
    return receipt_stock


async def fetch_opening_stock(plants):
    """
    For fetching opening stock  data
    :param plants:
    :return:
    """
    plant_cond = ''
    if plants:
        in_clause_raw = ", ".join(f"'{value}'" for value in plants)
        plant_cond = f" AND plant in ({in_clause_raw})"
    current_date = helpers.get_time_stamp_by_delta(urdhva_base.utilities.get_present_time(), days=1,
                                                   with_month_start_day=False, date_time_format='%Y%m%d')
    # Opening Stock
    query_open_stock = f"""select plant,valuation_type as val_type,sum(stock_quantity)/1000 QTY from 
    CONN_ENT.ZMMCI_MATDOC_V1_STG WHERE POSTING_DATE_IN_THE_DOCUMENT between '20230601' and '{current_date}' and 
    valuation_type in ('HPC_DOM', 'HPC_NDM') and plant like "2%" and 
    (STORAGE_LOCATION <> '' and STORAGE_LOCATION <> 'PINT') and MATERIAL_NUMBER ='0949000' {plant_cond} 
    group by plant,valuation_type
"""
    tank_capacity_master_data = load_lpg_tank_capacity()
    if plants:
        tank_capacity_master_data = tank_capacity_master_data[tank_capacity_master_data['LPGPlantCode'].isin(plants)]
    operating_tankage = tank_capacity_master_data['OperatingTankage'].sum()
    dom, non_dom = load_opening_stock_from_csv(plants)
    return round(float(dom)), round(float(non_dom)), round(operating_tankage)
    # resp = await fetch_from_tibco(query_open_stock)
    # df = pd.DataFrame(resp)
    # df = df[['val_type', 'QTY']]
    # dom, non_dom = df[df['val_type'] == 'HPC_DOM'].sum()['QTY'], df[df['val_type'] == 'HPC_NDM'].sum()['QTY']
    # return round(float(dom)), round(float(non_dom)), round(operating_tankage)


async def get_hpcl_average_sale(plants):
    """
        For fetching average stock data for plants provided by HPCL
        :param plants:
        :return:
    """
    plant_cond = ''
    if plants:
        in_clause_raw = ", ".join(f"'{value}'" for value in plants)
        plant_cond = f" AND supply_loc in ({in_clause_raw})"
    query_avg_sales = f"""select supply_loc,material_grp,sum(net_weight)/(1000*7) as QTY from CONN_ENT.ZSDCV_AY_INV3_STG 
    where sales_org='2000' and  material_grp in ('002','003') 
and DATE_FORMAT( invoice_date,'%Y%m%d') between date_sub(CURRENT_DATE,interval 7 day) 
and DATE_FORMAT(date_sub(CURRENT_DATE,interval 1 day) ,'%Y%m%d')
and distribution_channel in ('11','12','13','16') {plant_cond}
group by supply_loc,material_grp
    """
    resp = await fetch_from_tibco(query_avg_sales)
    df = pd.DataFrame(resp)
    if df.empty:
        return 0, 0
    df['material_grp'] = df['material_grp'].astype(str)
    df = df[['material_grp', 'QTY']]
    dom, non_dom = df[df['material_grp'] == '002'].sum()['QTY'], df[df['material_grp'] == '003'].sum()['QTY']
    return round(float(dom)), round(float(non_dom))
    tank_capacity_master_data = load_lpg_tank_capacity()
    if plants:
        tank_capacity_master_data = tank_capacity_master_data[tank_capacity_master_data['LPGPlantCode'].isin(plants)]
    dom, non_dom = (tank_capacity_master_data['DAILY_AVERAGE_SALES_DOM'].sum(),
                    tank_capacity_master_data['DAILY_AVERAGE_SALES_NonDOM'].sum())
    return dom, non_dom


async def lpg_plants_insights(filters, cross_filters, drill_state, metric_type):
    try:

        conditions = []
        date_filter = None

        # HANDLE FILTERS + VALIDATION
        if cross_filters:
            for f in cross_filters:
                if "DATE" in f.key:
                    start, end = f.value.split(",")
                    start_dt = datetime.strptime(start, "%Y-%m-%d")
                    end_dt = datetime.strptime(end, "%Y-%m-%d")

                    if (end_dt - start_dt).days < 7:
                        return {"status": False, "message": "Minimum 7 days data required" }

                    date_filter = f""" process_date >= '{start}' AND process_date < '{end}'::date + INTERVAL '1 day' """
                else:
                    conditions.append(f"{f.key} = '{f.value}'")

        # default last 7 days
        if not date_filter:
            date_filter = """ process_date >= CURRENT_DATE - INTERVAL '7 days' AND process_date < CURRENT_DATE """

        conditions.append(date_filter)
        where_clause = " WHERE " + " AND ".join(conditions)

        # METRIC CONFIG
        config = {
            "top_productivity": {
                "expr": "SUM(total_production)/NULLIF(SUM(total_net_hours),0)",
                "col": "productivity",
                "cond": "slope > 0 AND inc > dec",
                "order": "DESC"
            },
            "bottom_productivity": {
                "expr": "SUM(total_production)/NULLIF(SUM(total_net_hours),0)",
                "col": "productivity",
                "cond": "slope < 0 AND dec > inc",
                "order": "ASC"
            },
            "rejections": {
                "expr": "SUM(COALESCE(cs_rejection,0)+COALESCE(gd_rejection,0)+COALESCE(pt_rejection,0))",
                "col": "rejections",
                "cond": "slope > 0 AND inc > dec",
                "order": "DESC"
            }
        }

        if metric_type not in config:
            return {"status": False, "message": "Invalid metric_type"}

        cfg = config[metric_type]

        # QUERY
        query = f"""
        WITH d AS (
            SELECT sap_id, location_name, DATE(process_date) dt,
                   {cfg['expr']} AS {cfg['col']},
                   SUM(cs_rejection) cs_rejection,
                   SUM(gd_rejection) gd_rejection,
                   SUM(pt_rejection) pt_rejection
            FROM public.lpg_plant_operations
            {where_clause}
            GROUP BY sap_id, location_name, dt
            HAVING SUM(COALESCE(cs_rejection,0) + COALESCE(gd_rejection,0) + COALESCE(pt_rejection,0)) > 0
        ),

        i AS (
            SELECT *,
                   ROW_NUMBER() OVER (PARTITION BY sap_id ORDER BY dt) idx,
                   LAG({cfg['col']}) OVER (PARTITION BY sap_id ORDER BY dt) prev,
                   FIRST_VALUE({cfg['col']}) OVER (PARTITION BY sap_id ORDER BY dt) first_val,
                   LAST_VALUE({cfg['col']}) OVER (
                       PARTITION BY sap_id ORDER BY dt
                       ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                   ) last_val
            FROM d
        ),

        p AS (
            SELECT sap_id,
                   COUNT(*) FILTER (WHERE {cfg['col']} > prev) inc,
                   COUNT(*) FILTER (WHERE {cfg['col']} < prev) dec
            FROM i WHERE prev IS NOT NULL GROUP BY sap_id
        ),

        t AS (
            SELECT sap_id, regr_slope({cfg['col']}, idx) slope
            FROM i GROUP BY sap_id
        ),

        s AS (
            SELECT t.sap_id
            FROM t JOIN p USING (sap_id)
            WHERE {cfg['cond']}
            ORDER BY slope {cfg['order']}
            LIMIT 5
        )

        SELECT dt AS process_date, sap_id, location_name AS plant,
               ROUND({cfg['col']},2) AS value,
               cs_rejection, gd_rejection, pt_rejection,
               ROUND(
                   CASE WHEN first_val = 0 THEN NULL
                        ELSE ((last_val - first_val)/first_val)*100 END,2
               ) AS trend_pct
        FROM i
        WHERE sap_id IN (SELECT sap_id FROM s)
        ORDER BY sap_id, dt;
        """

        result = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
        rows = result.get("data", [])

        # FORMAT RESPONSE
        if metric_type == "rejections":
            plants = {}

            for r in rows:
                pid = r["sap_id"]

                if pid not in plants:
                    plants[pid] = {
                        "sap_id": pid,
                        "location_name": r["plant"],
                        "overall": {
                            "total_rejections": 0,
                            "cs_rejection": 0,
                            "gd_rejection": 0,
                            "pt_rejection": 0,
                            "trend_pct": r.get("trend_pct")
                        },
                        "daily": []
                    }

                plants[pid]["daily"].append({
                    "process_date": r["process_date"],
                    "total_rejections": r["value"],
                    "cs_rejection": r["cs_rejection"],
                    "gd_rejection": r["gd_rejection"],
                    "pt_rejection": r["pt_rejection"]
                })

                plants[pid]["overall"]["total_rejections"] += r["value"]
                plants[pid]["overall"]["cs_rejection"] += r["cs_rejection"]
                plants[pid]["overall"]["gd_rejection"] += r["gd_rejection"]
                plants[pid]["overall"]["pt_rejection"] += r["pt_rejection"]

            data = list(plants.values())

        else:
            data = rows

        return {"status": True, "message": "success", "data": data}

    except Exception as e:
        return {"status": False, "message": str(e)}
    

async def lpg_car_download(data):
    """ downloading the lpg plant Carousel"""
    
    start_date = None
    end_date = None
    all_conditions = []
    where_clause = []
    final_where_clause = ""

    if data.cross_filters:
        for filter in data.cross_filters:

            # -------- DATE FILTER --------
            if "DATE" in filter.key:

                filter_values = filter.value if filter.value else filter.val
                if not filter_values:
                    continue

                if isinstance(filter_values, str):
                    dates = [d.strip() for d in filter_values.split(",") if d.strip()]
                elif isinstance(filter_values, list):
                    dates = filter_values
                else:
                    continue

                start_date = dates[0]
                end_date = dates[-1]

                start_date = datetime.strptime(start_date, "%Y-%m-%d").strftime("%Y-%m-%d")
                end_date = datetime.strptime(end_date, "%Y-%m-%d").strftime("%Y-%m-%d")


                print("start_date----->\n", start_date)
                print("end_date---->\n", end_date)
                continue

            # -------- NON-DATE FILTER --------
            vals = []

            if filter.val:
                if isinstance(filter.val, list):
                    vals = filter.val
                elif isinstance(filter.val, str):
                    vals = [v.strip() for v in filter.val.split(",") if v.strip()]

            elif filter.value:
                if isinstance(filter.value, list):
                    vals = filter.value
                elif isinstance(filter.value, str):
                    vals = [v.strip() for v in filter.value.split(",") if v.strip()]

            if not vals:
                continue

            if len(vals) == 1:
                condition = f"{filter.key} = '{vals[0]}'"
            else:
                vals_str = ",".join([f"'{v}'" for v in vals])
                condition = f"{filter.key} IN ({vals_str})"

            all_conditions.append(condition)

    # ---------------- NORMAL FILTERS ----------------
    if data.filters:
        conditions = []

        for rec in data.filters:

            vals = []

            if rec.val:
                if isinstance(rec.val, list):
                    vals = rec.val
                elif isinstance(rec.val, str):
                    vals = [v.strip() for v in rec.val.split(",") if v.strip()]

            elif rec.value:
                if isinstance(rec.value, list):
                    vals = rec.value
                elif isinstance(rec.value, str):
                    vals = [v.strip() for v in rec.value.split(",") if v.strip()]

            if not vals:
                continue

            if len(vals) == 1:
                condition = f"{rec.key} = '{vals[0]}'"
            else:
                vals_str = ",".join([f"'{v}'" for v in vals])
                condition = f"{rec.key} IN ({vals_str})"

            conditions.append(condition)

        if conditions:
            all_conditions.extend(conditions)

    # ---------------- FINAL WHERE ----------------
    final_where_clause_car = ""

    if where_clause:
        all_conditions.extend(where_clause)

    if all_conditions:
        final_where_clause = " AND " + " AND ".join(all_conditions)
        final_where_clause_car = " WHERE " + " AND ".join(all_conditions)


    if start_date == end_date:
        query = f"""
            SELECT * FROM public.lpg_plant_operations 
            WHERE process_date::date = '{start_date}'
            {final_where_clause}
            """
    else:
        query = f"""
            SELECT * FROM public.lpg_plant_operations 
            where process_date >= '{start_date}' 
            and process_date < '{end_date}' 
            {final_where_clause}
        """ 

    car_query = f"""SELECT * FROM lpg_carousals {final_where_clause_car}"""
    
    plant_details_query = """SELECT DISTINCT sap_id, plant_name, zone FROM lpg_plants_master"""

    charts_actions.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    charts_actions.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_actions.charts_connection_vault_routing(charts_actions.Charts_Connection_Vault_RoutingParams)
    resp = await function(query=query)
    
    plant_details = await function(query=plant_details_query)
    plant_details_df = pl.DataFrame(plant_details)

    from decimal import Decimal

    def clean_data(data):
        cleaned = []
        for row in data:
            new_row = {}
            for k, v in row.items():
                if v is pd.NaT or str(v) == "NaT":
                    new_row[k] = None
                elif v == "NULL":
                    new_row[k] = None
                elif isinstance(v, Decimal):
                    new_row[k] = round(float(v), 2)
                else:
                    new_row[k] = v
            cleaned.append(new_row)
        return cleaned

    clean_resp = clean_data(resp)
    data = pl.DataFrame(clean_resp, infer_schema_length=10000)

    car_data = await function(query= car_query)
    car_df = pl.DataFrame(car_data)
    def calculate_hours(time_range_str):
        import json
        time_ranges = json.loads(time_range_str)
        total_seconds = 0

        for t in time_ranges:
            start_str = t["start_time"]
            stop_str = t["stop_time"]
            # Handle both HH:MM and HH:MM:SS formats
            try:
                start = datetime.strptime(start_str, "%H:%M:%S")
            except ValueError:
                start = datetime.strptime(start_str, "%H:%M")

            try:
                stop = datetime.strptime(stop_str, "%H:%M:%S")
            except ValueError:
                stop = datetime.strptime(stop_str, "%H:%M")

            diff = (stop - start).total_seconds()
            total_seconds += diff
        # convert seconds → hours
        return round(total_seconds / 3600, 2)
    
    car_df = car_df.with_columns([
        pl.col("production_hrs")
        .map_elements(calculate_hours)
        .alias("production_hours"),

        pl.col("breaks")
        .map_elements(calculate_hours)
        .alias("break_available_hours")
    ])

    # Derived column
    car_df = car_df.with_columns([
        (pl.col("production_hours") - pl.col("break_available_hours"))
        .round(2)
        .alias("normal_available_hrs")
    ])

    df = car_df.with_columns(pl.col("sap_id").cast(pl.Utf8))
    data = data.with_columns([
        pl.col("sap_id").cast(pl.Utf8),
        pl.col("carousel").cast(pl.Int64)  
    ])
    df = df.join(data, left_on=["sap_id", "carousal_id"], right_on=["sap_id", "carousel"], how="left")
    rename_cols = {
        "carousal_id" :"carousal", "normal_gap_hrs" :"normal_gaps","break_gap_hrs" :"break_gaps",
        "overtime_gap_hrs" :"overtime_gaps", "cs_handled" :"cs_total_cylinders_checked", 
        "cs_underfilled" :"cs_underweight", "cs_overfilled" :"cs_overweight","cs_sortout" :"cs_total", 
        "gd_handled" :"gd_total_cylinders_checked", "gd_sortout" :"gd_total", 
        "pt_handled": "pt_total_cylinders_checked", "pt_sortout": "pt_total", 
       }
    df = df.with_columns([
        pl.sum_horizontal([
            pl.col("production_14_2kg").fill_null(0),
            pl.col("production_19kg").fill_null(0)
        ]).alias("Total Cylinders")
    ])

    df = df.rename(rename_cols)

    for col in ("late_start", "early_stop", "lpg_breakdown", "intervening_gaps"):
        if col not in df.columns:
            df = df.with_columns(pl.lit(None).cast(pl.Float64).alias(col))

    group_cols = ["sap_id", "location_name", "carousal", "heads"]

    sum_cols = [
        "production_14_2kg", "production_19kg", "Total Cylinders", "normal_total_production", 
        "normal_available_hrs", "normal_gaps", "break_total_production", "break_available_hours", 
        "break_gaps", "overtime_total_production", "overtime_gaps"
        ]

    round_sum_cols = [
        "normal_net_hours", "break_net_hours", "overtime_net_hours", "cs_total_cylinders_checked",
        "cs_underweight", "cs_overweight", "cs_other_errors", "cs_total",
        "gd_total_cylinders_checked", "gd_total", "pt_total_cylinders_checked", "pt_total",
        "late_start", "early_stop", "lpg_breakdown", "intervening_gaps",
    ]

    car_sap_carousal = car_df.select(["sap_id", "carousal_id", "heads"]).unique()
    car_sap_carousal = car_sap_carousal.with_columns(pl.col("sap_id").cast(pl.Utf8))

    all_plant_carousals = car_sap_carousal.join(
        plant_details_df.with_columns(pl.col("sap_id").cast(pl.Utf8)),
        on="sap_id",
        how="left"
    ).rename({"carousal_id": "carousal", "plant_name": "location_name"})

    df_grouped = df.group_by(group_cols).agg(
        [pl.col(c).sum() for c in sum_cols] +
        [pl.col(c).sum().round(2) for c in round_sum_cols]
    )

    df_grouped = all_plant_carousals.join(
        df_grouped,
        on=["sap_id", "location_name", "carousal", "heads"],
        how="left"
    ).sort(["location_name", "carousal"])

    df_grouped = df_grouped.with_columns([
        # Productivity calculation
        pl.when(pl.col("normal_total_production").is_null() | pl.col("normal_net_hours").is_null())
        .then(None)
        .when(pl.col("normal_net_hours") == 0)
        .then(0)
        .otherwise((pl.col("normal_total_production") / pl.col("normal_net_hours")).round(2))
        .alias("normal_productivity"),

        pl.when(pl.col("break_total_production").is_null() | pl.col("break_net_hours").is_null())
        .then(None)
        .when(pl.col("break_net_hours") == 0)
        .then(0)
        .otherwise((pl.col("break_total_production") / pl.col("break_net_hours")).round(2))
        .alias("break_productivity"),

        pl.when(pl.col("overtime_total_production").is_null() | pl.col("overtime_net_hours").is_null())
        .then(None)
        .when(pl.col("overtime_net_hours") == 0)
        .then(0)
        .otherwise((pl.col("overtime_total_production") / pl.col("overtime_net_hours")).round(2))
        .alias("overtime_productivity"),

        # Rejection calculation
        pl.when(pl.col("cs_total").is_null() | pl.col("cs_total_cylinders_checked").is_null())
        .then(None)
        .when(pl.col("cs_total_cylinders_checked") == 0)
        .then(0)
        .otherwise((pl.col("cs_total") / pl.col("cs_total_cylinders_checked") * 100).round(2))
        .alias("cs_rejection"),

        pl.when(pl.col("gd_total").is_null() | pl.col("gd_total_cylinders_checked").is_null())
        .then(None)
        .when(pl.col("gd_total_cylinders_checked") == 0)
        .then(0)
        .otherwise((pl.col("gd_total") / pl.col("gd_total_cylinders_checked") * 100).round(2))
        .alias("gd_rejection"),

        pl.when(pl.col("pt_total").is_null() | pl.col("pt_total_cylinders_checked").is_null())
        .then(None)
        .when(pl.col("pt_total_cylinders_checked") == 0)
        .then(0)
        .otherwise((pl.col("pt_total") / pl.col("pt_total_cylinders_checked") * 100).round(2))
        .alias("pt_rejection"),
    ])

    df_grouped = df_grouped.sort(["location_name", "carousal"])
    
    def val(x):
        return "N/A" if x is None else x
    
    plants_output = []

    # sorted plant names
    plant_names = df_grouped["location_name"].drop_nulls().unique().sort().to_list()

    for plant_name in plant_names:
        plant_df = df_grouped.filter(pl.col("location_name") == plant_name)
        cars_list = []
        for row in plant_df.to_dicts():
            cars_list.append({
                "carName": row["carousal"],
                "bottlingSummary": {
                    "14_2kgCylinders": val(row.get("production_14_2kg")),
                    "19kgCylinders": val(row.get("production_19kg")),
                    "total": val(row.get("Total Cylinders"))
                },
                "normalHours": {
                    "production": val(row.get("normal_total_production")),
                    "availableHours": val(row.get("normal_available_hrs")),
                    "stoppagesHours": val(row.get("normal_gaps")),
                    "netBottlingHours": val(row.get("normal_net_hours")),
                    "productivity": val(row.get("normal_productivity")),
                    "lateStart": val(row.get("late_start")),
                    "earlyStop": val(row.get("early_stop")),
                    "interveningGaps": val(row.get("intervening_gaps")),
                    "lpgBreakdown": val(row.get("lpg_breakdown")),
                },
                "breakHours": {
                    "production": val(row.get("break_total_production")),
                    "availableHours": val(row.get("break_available_hours")),
                    "stoppagesHours": val(row.get("break_gaps")),
                    "netBottlingHours": val(row.get("break_net_hours")),
                    "productivity": val(row.get("break_productivity"))
                },
                "overtimeHours": {
                    "production": val(row.get("overtime_total_production")),
                    "stoppagesHours": val(row.get("overtime_gaps")),
                    "netBottlingHours": val(row.get("overtime_net_hours")),
                    "productivity": val(row.get("overtime_productivity"))
                },
                "checkScaleSummary": {
                    "TotalCylindersChecked": val(row.get("cs_total_cylinders_checked")),
                    "RejectionUnderweight": val(row.get("cs_underweight")),
                    "RejectionOverweight": val(row.get("cs_overweight")),
                    "RejectionOtherErrors": val(row.get("cs_other_errors")),
                    "RejectionTotal": val(row.get("cs_total")),
                    "RejectionPercentage": val(row.get("cs_rejection"))
                },
                "electronicLeakDetectorSummary": {
                    "TotalCylindersChecked": val(row.get("gd_total_cylinders_checked")),
                    "RejectionTotal": val(row.get("gd_total")),
                    "RejectionPercentage": val(row.get("gd_rejection"))
                },
                "O-RingTesterSummary": {
                    "TotalCylindersChecked": val(row.get("pt_total_cylinders_checked")),
                    "RejectionTotal": val(row.get("pt_total")),
                    "RejectionPercentage": val(row.get("pt_rejection"))
                }
            })
        plants_output.append({"plantName": plant_name, "cars": cars_list})

    final_response = {"plants": plants_output}

    return final_response
