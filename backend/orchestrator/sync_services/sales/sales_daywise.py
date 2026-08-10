import os
import uuid
import pyodbc
import psycopg2
import traceback
import datetime
import pandas as pd
import polars as pl
import mysql.connector
from dateutil.relativedelta import relativedelta
import hashlib
import urdhva_base
import sys
import argparse


import orchestrator.notification_manager.notification_factory
import os
from datetime import datetime
from zoneinfo import ZoneInfo
sys.path.append("/opt/ceg/algo")
import orchestrator.dbconnector.credential_loader as credential_loader

logger = urdhva_base.logger.Logger.getInstance('sales_day_data_sync_log')

def get_db_connection(params):
    """
    Establish a database connection
    Args:
        connection_string (str): Database connection string
    Returns:
        pyodbc connection
    """
    server = params['host']
    database = params['database']
    username = params['user']
    password = params["password"]
    port = params["port"]
    if "connection_type" in params:
        if params["connection_type"].lower() == "postgres":
            connection = psycopg2.connect(
                host=server,
                database=database,
                user=username,
                password=password,
                port=port
            )
        if params["connection_type"].lower() == "mssql":
            connection = mysql.connector.connect(
                host=server,
                user=username,
                passwd=password,
                port=port
                #database=database
            )
    print(connection)
    return connection


def insertToDB(data, table_name, indexing_col=()):
    #data.write_csv(f"/tmp/table_name.csv",separator='~')
    '''
    for col in data.columns:
        try:
            data = data.with_columns(pl.col(col).fill_null(0).cast(pl.float64).alias(col))
            data = data.with_columns(pl.col(col).round(2).alias(col))
        except Exception as e:
            print("Couldn't convert to Integer :", col)
            continue
    '''
    data = data.with_columns(
    pl.struct(data.columns).map_elements(
        lambda row: hashlib.md5("|".join(str(v) for v in row.values()).encode()).hexdigest()
    ).alias("engine_id")
)
    
    print(data.schema)
    """
    below line are for reading the data of FY23-24 APr,May and Jun
    apr_data = pl.read_csv('/tmp/jun_updated.csv',infer_schema_length=0) 
    apr_data = apr_data.rename({"DT_ID": "DAY_ID"})
    apr_data = apr_data.with_columns(
    pl.struct(apr_data.columns).map_elements(
        lambda row: hashlib.md5("|".join(str(v) for v in row.values()).encode()).hexdigest()
    ).alias("engine_id")
    )
    """
    for col in data.columns:
        if data.schema[col] in [pl.Float32, pl.Float64] :
            data = data.with_columns(pl.col(col).alias(col))
        if 'Decimal' in str(data.schema[col]):
            data = data.with_columns(pl.col(col).cast(float).alias(col))
    '''
    for col in data.columns:
        if data.schema[col] in [pl.Float32, pl.Float64]:
             data = data.with_columns(pl.col(col).round(2).alias(col))
        if data[col].dtype in ['Int64']:
            data = data.with_columns(pl.col(col).round(0).alias(col))
        if 'Decimal' in str(data.schema[col]):
            print("decimal type col")
            data = data.with_columns(pl.col(col).cast(pl.Int64).round(0).alias(col))
    '''
    print(data)
    print(data.schema)
    month_map = {'01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec'}
    data= data.with_columns( pl.lit("").cast(pl.Utf8).alias("month_name"))
    data = data.with_columns(pl.col('YEARMONTH').cast(pl.Utf8))
    for each_month in data['YEARMONTH'].unique().to_list():
        month_key = each_month[4:]
        month_value = month_map.get(month_key)
        data = data.with_columns(pl.when(pl.col("YEARMONTH") == each_month).then(pl.lit(month_value)).otherwise(pl.col("month_name")) .alias("month_name") )
    #data.write_csv(f"/tmp/table_name1.csv",separator='~')
    print("-" * 50)
    print(f"-- Inserting Data to {table_name} --")
    print("Length of Data :", len(data))
    
    print(len(data))
    #data = data.unique(['engine_id'])
    print(len(data))
    creds = credential_loader.get_credentials('APP_DB')
    pg_conn = psycopg2.connect(
                host=creds['host'],
                database=creds['database'],
                user=creds['user'],
                password=creds['password'],
                port=creds['port']
            )
    
    table_create_sql = ''
    cur = pg_conn.cursor()
    print(data['NETWEIGHT_KG'].unique())
    print(data['NETWEIGHT_KG'].dtype)
    data = data.with_columns([
    #pl.col("NETWEIGHT_KG").fill_null(0).cast(pl.Float64).round(2).alias("NETWEIGHT_KG"),
    pl.col("NETWEIGHT_KG").fill_null(0).cast(pl.Float64).alias("NETWEIGHT_KG"),
    #pl.col("NETWEIGHT_TMT").fill_null(0).cast(pl.Float64).round(2).alias("NETWEIGHT_TMT")
    pl.col("NETWEIGHT_TMT").fill_null(0).cast(pl.Float64).alias("NETWEIGHT_TMT")
    
])
    if "PLANT_CD" in data.columns:
        data = data.rename({"PLANT_CD": "plant_cd"})

    if 'plant_cd' not in data.columns:
        data = data.with_columns(pl.lit("").cast(pl.Utf8).alias("plant_cd"))
        
    dtype_dict = {'String': str('text'), 'Int64': str('bigint'), 'Int32': str('bigint'), 'Boolean': str('text'),
                  'Float64': str('double precision'), 'Float32': str('double precision'),
                  #'Float64':'Float64',
                  'Object': str('text'), 'Datetime': str('timestamp'), 'Date': str('timestamp'), 'Utf8': str('text'),
                  'Null': 'text',"Datetime(time_unit='us', time_zone=None)": str('timestamp'),
                  "Datetime(time_unit='ns', time_zone=None)": str('timestamp'),
                  "Decimal(precision=5, scale=2)": str('double precision')}
    print('Data Types :', data.dtypes)
    col_dtype = {col: data[col].dtype for col in data.columns}
    for col, dty in col_dtype.items():
        dty = dtype_dict.get(str(dty))
        table_create_sql += f'"{col}" {dty},'
    table_create_sql = table_create_sql[:-1]
    if not isinstance(indexing_col, list):
        indexing_col = [indexing_col]
    columns_formatted = ", ".join(f'"{col}"' for col in indexing_col)
    create_table_index = f"""CREATE INDEX IF NOT EXISTS "{table_name}_index" ON "{table_name}" ({columns_formatted})"""

    table_create_sql = f'CREATE TABLE IF NOT EXISTS "{table_name}" ({table_create_sql})'

    print("-" * 50)
    print("table_create_sql :", table_create_sql)
    print("-" * 50)
    cur.execute(table_create_sql)
    '''
    cur.execute(f"""
            CREATE UNIQUE INDEX IF NOT EXISTS engine_id_check ON "{table_name}" (engine_id);

    """)
    '''
    '''
    try:
       cur.execute(f"""
        ALTER TABLE "{table_name}" ADD constraint "engine_id_sales" UNIQUE (engine_id);


      """)
    except Exception as e:
        pg_conn.rollback()
    '''
    pg_conn.commit()
    print(columns_formatted)
    #cur.execute(create_table_index)

    sql = f"""SELECT * FROM "{table_name}" LIMIT 1"""
    cur.execute(sql)
    column_names = [desc[0] for desc in cur.description]
    columns = []
    for i in column_names:
        columns.append(i)
    
    data = data.select(columns)

    #data.write_csv('/tmp/sales_data.csv')
    print(data)
    #data.write_csv(f"/tmp/table_name.csv",separator='~')
    pg_conn.commit()
    try:
        #  Step 1: Delete dynamically
        fiscal_years = data['fiscal_year'].unique().to_list()
        print("Fiscal years to delete:", fiscal_years)

        for fy in fiscal_years:
            if fy == '2023-2024':
                cur.execute(f"""
                    DELETE FROM "MOM_DAY_LEVEL_DATA"
                    WHERE "fiscal_year" = %s
                    AND "month_name" NOT IN ('Apr','May','Jun')
                """, (fy,))
            else:
                cur.execute(f"""
                    DELETE FROM "MOM_DAY_LEVEL_DATA"
                    WHERE "fiscal_year" = %s
                """, (fy,))
        query = f'''
        COPY "{table_name}"
        FROM STDIN
        CSV HEADER DELIMITER '~';
        '''
        print(query)
        for g, split_df in data.group_by(len(data)// 10000000):
            csv_file = f'/tmp/{table_name}.csv'
            split_df.write_csv(csv_file, separator='~')
            with open(csv_file, 'r') as f:
                cur.copy_expert(query, f)
                pg_conn.commit()
        cur.close()
        if os.path.exists(f'/tmp/{table_name}.csv'):
            os.remove(f'/tmp/{table_name}.csv')
    
        print(f"-- Data has been inserted to {table_name} --")
        with pg_conn.cursor() as cur:
             cur.execute(f'SELECT COUNT(*) FROM "{table_name}"')
             row_count = cur.fetchone()[0]
             print(f"Total records in {table_name}: {row_count}")

    # call the async email from sync context
        import asyncio
        asyncio.run(send_sales_sync_email(table_name, row_count))
    except Exception as e:
        print("Error :", str(e))
        logger.error(f"-- Failed to insert Data into {table_name} --")
        raise Exception(e)


async def send_sales_sync_email(table_name: str, total_records: int):
    now_ist = datetime.now(ZoneInfo("Asia/Kolkata"))
    formatted_time = now_ist.strftime('%d-%m-%Y %I:%M %p IST')

    df_summary = pd.DataFrame([{
        "Table Name": table_name,
        "Load Timestamp (IST)": formatted_time,
        "Total Records": f"{total_records:,}"
    }])

    html_table = df_summary.to_html(
        index=False,
        border=1,
        justify='center',
        classes='sales-sync-table',
        escape=False
    )

    html_body = f"""
    <html>
      <body>
        <p>Hello,</p>
        <p>The sales data sync job completed successfully.</p>
        {html_table}
        <br>
        Regards,<br>
        Sales Automation
      </body>
    </html>
    """

    ins = await orchestrator.notification_manager.notification_factory.get_notification_module("email")
    await ins.publish_message(
        subject=f"Sales Sync - {formatted_time}",
        recipients=[
            "aditya@algofusiontech.com","gayathri.m@algofusiontech.com"
        ],
        html_content=True,
        body=html_body,
        force_send=True
    )
    
    


def get_and_insert_data(cursor, query, params=None, debug=False):
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
    logger.info(f"Total Records : {len(data)}")
    columns = [column[0] for column in cursor.description]
    data = pd.DataFrame.from_records(data, columns=columns)
    
    if debug:
        data.to_csv('/tmp/actual_sales_data.csv', index=False)
    print(len(data))
    
    print(len(data))
    print(len(data.drop_duplicates()))
    data = data.drop_duplicates()
    print(len(data))
    if debug:
        data.to_csv('/tmp/data_org_drop.csv', index=False)
    print(data['CURFISCALYEAR'].unique())
    data['CURFISCALYEAR'] = data['CURFISCALYEAR'].fillna('0').astype(str).apply(lambda x :x.split('.')[0] if '.' in x else x)
    print(data['CURFISCALYEAR'].unique())
    print(data.columns)
    data['fiscal_year'] = data['FISCALYEAR'].apply(lambda x:x.strip('FY').strip()if 'FY' in x else x)
    print(data['fiscal_year'].unique())
    print(data['ORGSBUNAME'].unique())
    data['ORGSBUNAME'] = data['ORGSBUNAME'].fillna('0').astype(str).apply(lambda x:' '.join(x.split(' ')[2:]) if x !=None and len(x.split(' '))>2  else x )

    #data['ORGSBUNAME'] = data['ORGSBUNAME'].fillna('0').astype(str).apply(lambda x:' '.join(x.split(' ')[2:]) if x !=None and len(x.split(' ') >2)  else x )
    print(data['ORGSBUNAME'].unique())
    data = data.rename(columns = {'ORGSBUNAME':'SBU_Name','ORGZONENAME':'Zone_Name','ORGRONAME':'Region_Name',
                                  'ORGSANAME':'SalesArea_Name','MATERIALGROUPNAME':'ProductName'})
    data['ORGSBUCD'] = data['ORGSBUCD'].fillna('').astype(str).apply(lambda x:x.split('.')[0] if '.' in x else x)
    data['SBU_Name'] = data['SBU_Name'].str.replace('DS I&C','I&C').str.replace('Direct','I&C').str.replace('DS Lubes','Lubes').str.replace('Direct I&C','I&C').str.replace('PETROCHEMICALS SBU','PETCHEM').str.replace('GAS HQO','GAS')
    data['Zone_Name'] = data['Zone_Name'].str.replace('North Central LPG Zone','North Central LPG Zo').str.replace('South Central Retail Zone','South Central Retail').str.replace('South Central LPG Zone ','South Central LPG Zo').str.replace('EAST CENTRAL ZONE','East Central Zone').str.replace('North West Frontier Zone','North West Frontier').str.replace('North West Retail Zone','North West Retail Zo').str.replace('North Central Retail Zone','North Central Retail')
    data['Zone_Name'] = data['Zone_Name'].str.replace('East Zone','East').str.replace('West Zone','West').str.replace('North Zone','North').str.replace('South Zone','South')
    data.loc[(data['SBU_Name'] == 'I&C') & (data['ProductName'] == 'PETCHEM'), 'SBU_Name'] = 'PETCHEM'
    data.loc[(data['SBU_Name'] == 'Lubes') & (data['ProductName'] == 'Solvent 2445'), ['ORGSBUCD', 'SBU_Name']] = ['3000', 'I&C']

    
    print(data['MATERIAL_CD'].unique().tolist())
    print(data.dtypes)
    data.loc[(data['MATERIAL_CD'] == '1739000')&(data['SBU_Name'] =='GAS'),'ProductName'] = 'LNG'
    data.loc[(data['MATERIAL_CD'] == '0992000')&(data['SBU_Name'] =='GAS'),'ProductName'] = 'CNG'
    
    cursor.execute(f"""
                   
                select inv3.*,zso.SALES_OFFICE_DESC, zso.SALES_GROUP_DESC FROM CONN_ENT.VW_AY_INV3_LUBES_STG inv3
                JOIN CONN_ENT.ZSDCV_CUST_SA_STG zca on inv3.SOLD_TO_PARTY = zca.CUSTOMER
                INNER join CONN_ENT.ZSDCV_CUSTOMER_STG zcs on zcs.customer_number = zca.customer 
                INNER join CONN_ENT.ZSDCV_SO_PARAM_STG zso on zso.sales_district = zca.sales_district AND
                zso.sales_org=zca.sales_org AND zso.sales_office=zca.sales_off AND zso.sales_group=zca.sales_grp
                INNER join CONN_ENT.EDW_DC_PLANT plt on zso.PLANT=plt.PLANT
                INNER join CONN_ENT.EDW_DC_PLANT deliv on deliv.PLANT=zca.deliv_plant
                   """)
    di = {}
    
    
    lubes_data = cursor.fetchall()
    columns = [column[0] for column in cursor.description]
    lubes_data = pd.DataFrame.from_records(lubes_data, columns=columns)
    for idx,row_data in lubes_data.iterrows():
        if row_data['SUPPLY_LOC'] not in di:
            di[row_data['SUPPLY_LOC']] = row_data['SALES_DISTRICT']

    lubes_ps_data = data[data['SBU_Name'] == 'Lubes']
    data = data[~(data['SBU_Name'] == 'Lubes')]
    lubes_ps_data['PLANT_CD'] = lubes_ps_data['PLANT_CD'].astype(str)
    lubes_data['SUPPLY_LOC'] = lubes_data['SUPPLY_LOC'].astype(str)

    # Create ZZONE column before assigning values
    lubes_ps_data['ZZONE'] = None

    for each_plant in lubes_ps_data['PLANT_CD'].unique().tolist():
        if each_plant in di:
            lubes_ps_data.loc[
                lubes_ps_data['PLANT_CD'] == each_plant,
                'ZZONE'
            ] = di[each_plant]

    zone_map = {
        'WES': 'West',
        'NOR': 'North',
        'SOU': 'South',
        'EAS': 'East',
        'HQO': 'HQO Customer'
    }

    print(lubes_ps_data.columns.tolist())
    print([repr(col) for col in lubes_ps_data.columns])
    print(lubes_ps_data.head())

    # Remove leading/trailing spaces from column names
    lubes_ps_data.columns = lubes_ps_data.columns.str.strip()

    # Map Zone_Name
    lubes_ps_data['Zone_Name'] = lubes_ps_data['ZZONE'].map(zone_map)
    # lubes_ps_data['Zone_Name'] = lubes_ps_data['ZZONE'].map(zone_map)
    lubes_ps_data = lubes_ps_data.rename(columns={'SALES_OFFICE_DESC':'Region_Name','SALES_GROUP_DESC':'SalesArea_Name'})
    if debug:
        lubes_ps_data.to_csv('/tmp/lubes_ps_data.csv', index=False)
    '''
    cursor.execute(f"""
                   select * FROM CONN_ENT.ZSDCV_SO_PARAM_STG
                   
                   """)
    lubes_ro_data = cursor.fetchall()
    columns = [column[0] for column in cursor.description]
    lubes_ro_data = pd.DataFrame.from_records(lubes_ro_data, columns=columns)
    ro_di = {}
    sa_di={}
    for idx,row_data in lubes_ro_data.iterrows():
        if row_data['SALES_OFFICE'] not in ro_di:
            ro_di[row_data['SALES_OFFICE']] = row_data['SALES_OFFICE_DESC']
        if row_data['SALES_GROUP'] not in sa_di:
            sa_di[row_data['SALES_GROUP']] = row_data['SALES_GROUP_DESC']
    lubes_ps_data['SA_CD'] = lubes_ps_data['SA_CD'].fillna('0').astype(str).apply(lambda x:x.split('.')[0] if '.' in x else x)
    for each_sa in lubes_ps_data['SA_CD'].unique().tolist():
        if each_sa in sa_di:
            lubes_ps_data.loc[lubes_ps_data['SA_CD'] == each_sa,'SalesArea_Name']= sa_di[each_sa]
    
    for each_ro in lubes_ps_data['ORDER_COMPANY'].unique().tolist():
        if each_ro in ro_di:
            lubes_ps_data.loc[lubes_ps_data['ORDER_COMPANY'] == each_ro,'Region_Name']= ro_di[each_ro]
    lubes_ps_data.to_csv('/tmp/lubes_latest_data.csv',index = False)
    '''
    data = pd.concat([lubes_ps_data,data])

    
    '''
    
    cursor.execute(f"""
                   
                   select t1.SUPPLY_LOC,t2.PLANT_CD,t2.ZZONE,t2.SBU FROM CONN_ENT.VW_AY_INV3_LUBES_STG t1 LEFT JOIN PS.EDW_PLANT_DIM t2 on t1.SUPPLY_LOC=t2.PLANT_CD 

                   """)
    lubes_data = cursor.fetchall()
    print('Total Records :', len(data))
    columns = [column[0] for column in cursor.description]
    lubes_data = pd.DataFrame.from_records(lubes_data, columns=columns)
    
    lubes_ps_data = data[data['SBU_Name'] == 'Lubes']
    data = data[~(data['SBU_Name'] == 'Lubes')]
    lubes_data['PLANT_CD'] = lubes_data['PLANT_CD'].astype(str)
    lubes_ps_data['PLANT_CD'] = lubes_ps_data['PLANT_CD'].astype(str)
    print(lubes_ps_data.dtypes)
    print(lubes_data.dtypes)
    di = {}
    
    for idx,row_data in lubes_data.iterrows():
        if row_data['PLANT_CD'] not in di:
            di[row_data['PLANT_CD']] = row_data['ZZONE']
    for each_plant in  lubes_ps_data['PLANT_CD'].unique().tolist():
           if each_plant in di:
            lubes_ps_data.loc[lubes_ps_data['PLANT_CD'] ==each_plant,'ZZONE'] = di[each_plant]
    zone_map = {'NWF':'North West Frontier','NZ':'North','EZ':'East','SZ':'South','ECZ':'East Central Zone','NWR':'North West Retail Zo',
                'WZ':'West','NCR':'North Central Retail','CEN':'Central Zone','SCR':'South Central Retail','NCL':'North Central LPG Zo',
                'NFZ':'North Frontier Zone','NWL':'North West LPG Zo','SCL':'South Central LPG Zo','SWZ':'South Western Zone'}
    lubes_ps_data['Zone_Name'] = lubes_ps_data['ZZONE'].map(zone_map)
    lubes_ps_data.to_csv('/tmp/lubes.csv',index = False)
    data.to_csv('/tmp/data_latest.csv',index  = False)
    print("data",len(data))
    print("psdata",len(lubes_ps_data))
    data = pd.concat([data,lubes_ps_data])
    data = pl.from_pandas(data)
    '''
    data.loc[(data['ORGSBUCD'] == '4000')&(data['MATERIAL_GROUP_CD'] =='031'),'ProductName'] = 'ALPROL'
    data.loc[(data['ORGSBUCD'] == '4000')&(~(data['MATERIAL_GROUP_CD'].isin(['031','038'])))&(data['DISTRIBUTION_CHANNEL_CD'].isin(['014','14'])),'ProductName'] = 'Lubes-Exports'
    data.loc[(data['ORGSBUCD'] == '4000')&(data['MATERIAL_GROUP_CD'] =='038')&(data['DISTRIBUTION_CHANNEL_CD'].isin(['011','11','012','12'])),'ProductName'] = 'HP DEF-Retail'
    replacements = {'EAS':'EZ',
                    'CEN':'CEN',
                    'SOU':'SZ' ,'SWZ':'SWZ','WES':'WZ'}
    
    mapping_dict = {
    "West": "WZ",
    "East": "EZ",
    "North": "NZ",
    "South": "SZ"
    }
    data["ORGZONECD"] = data["Zone_Name"].map(mapping_dict).combine_first(data["ORGZONECD"])
    print("replacements",replacements)
    data['ORGZONECD'] = data['ORGZONECD'].replace(replacements)
    
    #data.loc[((data['MATERIAL_GROUP_CD'] =='038')&(data['DISTRIBUTION_CHANNEL_CD'].isin(['011','11','012','12']) &(data['ORGSBUCD'] == '4000')),'SBU_Name','ORGSBUCD'] = ['Retail','7000']        
    data.loc[(data['MATERIAL_GROUP_CD'] == '038') & (data['DISTRIBUTION_CHANNEL_CD'].isin(['011', '11', '012', '12'])) & (data['ORGSBUCD'] == '4000'), ['SBU_Name', 'ORGSBUCD']] = ['Retail', '7000']
    data.loc[data['ProductName'] == 'DEF/Diesel Exhaust Field',['ORGSBUCD','SBU_Name']] =['4000','Lubes']
    data = pl.from_pandas(data)
    
    insertToDB(data, params["table_name"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sales Daywise Sync Job")
    parser.add_argument(
        "--debug",
        type=str,
        default="false",
        help="Enable debug file writing (true/false)"
    )

    args = parser.parse_args()
    DEBUG_MODE = args.debug.lower() == "true"

    print("DEBUG_MODE:", DEBUG_MODE)
    creds = credential_loader.get_credentials('TIBCO') 
    print("creds",creds)
    params = {
            "host":creds['host'],
            "database":creds['database'],
            "user":creds['user'],
            "password":creds['password'],
            "port":creds['port'],
            "table_name":"MOM_DAY_LEVEL_DATA",
            "connection_type":"mssql"
                
            }
    

    query = """SELECT ZS.Plant AS Plantcd,
             ZS.UNRESTRICTED_STOCK_VALUE AS Stock_value,
             IM.itemcode AS Itemcode,
             IM.ITEMNAME AS Itemname,
             ZV.Invoice_date,
             SUM(ZV.Qty_Shipped) AS Qty_Shipped,
             CASE
                 WHEN Qty_Shipped = 0 THEN NULL
                 ELSE Stock_value / Qty_Shipped
             END AS DaysCover
      FROM ZPPCV_STOCK_INV_STG ZS
      INNER JOIN ZSDCV_TIEM_MAST_STG IM ON ZS.MATERIAL_NUMBER = IM.ITEMCODE
      INNER JOIN PS.EDW_PLANT_DIM ZP ON ZS.PLANT = ZP.plant_cd
      AND ZP.CODE2 = 'LUB'
      LEFT OUTER JOIN VW_AY_INV3_LUBES_STG ZV ON ZS.plant = ZV.supply_loc
      WHERE ZV.invoice_Date BETWEEN ADDDATE(CURRENT_DATE, -365) AND CURRENT_DATE
      GROUP BY ZS.Plant,
               ZS.UNRESTRICTED_STOCK_VALUE,
               IM.itemcode,
               IM.ITEMNAME,
               ZV.Invoice_date"""
    query  = """
            WITH UniqueTSD AS (

    SELECT DISTINCT 

        PRODUCT, 

        SA, 

        ProductName,SBU_Name,Zone_Name,Region_Name,SalesArea_Name

    FROM 

        CONN_ENT.TARGET_SALES_DATA

)

SELECT 

    edw.*, 

    tsd.PRODUCT, 

    tsd.SA, 

    tsd.ProductName,

    tsd.SBU_Name,

    tsd.Zone_Name,

    tsd.Region_Name,

    tsd.SalesArea_Name

FROM 

    PS.EDW_PRIMARY_SALES_FACT edw

LEFT JOIN 

    UniqueTSD tsd 

ON 

    edw.MATERIAL_GROUP_CD = tsd.PRODUCT 

    AND edw.SA_CD = tsd.SA; 
    """
    query= """
    WITH fiscal_year_bounds AS (
    -- Define the bounds for fiscal years dynamically
    SELECT 
        DATE(CONCAT(YEAR(CURDATE()) - 1, '-04-01')) AS start_of_fy_2023_2024,
        DATE(CONCAT(YEAR(CURDATE()), '-03-31')) AS end_of_fy_2023_2024,
        DATE(CONCAT(YEAR(CURDATE()), '-04-01')) AS start_of_fy_2024_2025,
        DATE(CONCAT(YEAR(CURDATE()) + 1, '-03-31')) AS end_of_fy_2024_2025
),
month_range AS (
    -- Generate a list of all months between April 2023 and March 2025
    SELECT 
        DATE_ADD(fy.start_of_fy_2023_2024, INTERVAL seq MONTH) AS month
    FROM 
        fiscal_year_bounds fy,
        (SELECT 0 AS seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
         UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
         UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
         UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
         UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19
         UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23) AS seq_table
    WHERE 
        DATE_ADD(fy.start_of_fy_2023_2024, INTERVAL seq MONTH) <= fy.end_of_fy_2024_2025
),
sales_data AS (
    -- Aggregate total sales by month and additional columns
    SELECT
        CAST(CONCAT(SUBSTRING(INVOICE_DATE_YYYYMMDD, 1, 6), '01') AS DATE) AS month,
        SBU_CD,
        ZONE_CD,
        ORDER_COMPANY AS RO_CD,
        SA_CD,
        MATERIAL_CD,
        SUM(NET_WEIGHT / 1000000) AS total_sales
    FROM 
        PS.EDW_PRIMARY_SALES_FACT
    GROUP BY 
        CAST(CONCAT(SUBSTRING(INVOICE_DATE_YYYYMMDD, 1, 6), '01') AS DATE),
        SBU_CD,
        ZONE_CD,
        RO_CD,
        SA_CD,
        MATERIAL_CD
),
joined_data AS (
    -- Join the generated month range with the aggregated sales data
    SELECT
        mr.month,
        sd.SBU_CD,
        sd.ZONE_CD,
        sd.RO_CD,
        sd.SA_CD,
        sd.MATERIAL_CD,
        COALESCE(sd.total_sales, 0) AS total_sales
    FROM 
        month_range mr
    LEFT JOIN 
        sales_data sd ON mr.month = sd.month
)
SELECT 
    -- Month Name
    DATE_FORMAT(month, '%M') AS month_name,  -- Month name (e.g., January)
    
    -- Month Number (Sequential across fiscal years)
    CASE 
        WHEN MONTH(month) >= 4 THEN MONTH(month) - 3  -- Fiscal month number (April = 1, May = 2, ...)
        ELSE MONTH(month) + 9  -- For January to March (e.g., Jan = 10, Feb = 11, Mar = 12)
    END AS fiscal_month,

    -- Additional Grouped Columns
    SBU_CD,
    ZONE_CD,
    RO_CD,
    SA_CD,
    MATERIAL_CD,

    -- Total Sales
    total_sales,

    -- Fiscal Year Logic
    CASE 
        WHEN month BETWEEN 
            (SELECT start_of_fy_2023_2024 FROM fiscal_year_bounds)
            AND 
            (SELECT end_of_fy_2023_2024 FROM fiscal_year_bounds)
        THEN '2023-2024'  -- Assign fiscal year 2023-2024 for months between April 2023 and March 2024
        WHEN month BETWEEN 
            (SELECT start_of_fy_2024_2025 FROM fiscal_year_bounds)
            AND 
            (SELECT end_of_fy_2024_2025 FROM fiscal_year_bounds)
        THEN '2024-2025'  -- Assign fiscal year 2024-2025 for months between April 2024 and March 2025
    END AS fiscal_year,

    -- New Date Column: Combining the Month and Fiscal Year as Date type
    CAST(CONCAT(YEAR(month), '-', LPAD(MONTH(month), 2, '0'), '-01') AS DATE) AS month_year

FROM 
    joined_data
ORDER BY 
    month, SBU_CD, ZONE_CD, RO_CD, SA_CD, MATERIAL_CD LIMIT 300000;
    """
    query = f"""
        WITH fiscal_year_bounds AS (
    -- Dynamically calculate the bounds for the current and previous fiscal years
    SELECT 
        CASE 
            WHEN MONTH(CURDATE()) < 4 THEN 
                CONCAT(YEAR(CURDATE()) - 2, '-04-01')  -- Start of the previous fiscal year
            ELSE 
                CONCAT(YEAR(CURDATE()) - 1, '-04-01')  -- Start of the current fiscal year
        END AS start_of_previous_fiscal_year,
        CASE 
            WHEN MONTH(CURDATE()) < 4 THEN 
                CONCAT(YEAR(CURDATE()) - 1, '-03-31')  -- End of the previous fiscal year
            ELSE 
                CONCAT(YEAR(CURDATE()), '-03-31')      -- End of the current fiscal year
        END AS end_of_previous_fiscal_year,
        CASE 
            WHEN MONTH(CURDATE()) < 4 THEN 
                CONCAT(YEAR(CURDATE()) - 1, '-04-01')  -- Start of the current fiscal year
            ELSE 
                CONCAT(YEAR(CURDATE()), '-04-01')      -- Start of the next fiscal year
        END AS start_of_current_fiscal_year,
        CASE 
            WHEN MONTH(CURDATE()) < 4 THEN 
                CONCAT(YEAR(CURDATE()), '-03-31')      -- End of the current fiscal year
            ELSE 
                CONCAT(YEAR(CURDATE()) + 1, '-03-31')  -- End of the next fiscal year
        END AS end_of_current_fiscal_year
),
month_range AS (
    -- Generate a list of months dynamically for both fiscal years
    SELECT 
        DATE_ADD(fb.start_of_previous_fiscal_year, INTERVAL seq MONTH) AS month
    FROM 
        fiscal_year_bounds fb,
        (SELECT 0 AS seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
         UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
         UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
         UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
         UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19
         UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23) AS seq_table
    WHERE 
        DATE_ADD(fb.start_of_previous_fiscal_year, INTERVAL seq MONTH) <= fb.end_of_current_fiscal_year
),
sales_data AS (
    -- Aggregate total sales by month and additional columns
    SELECT
        CAST(CONCAT(SUBSTRING(INVOICE_DATE_YYYYMMDD, 1, 6), '01') AS DATE) AS month,
        SBU_CD,
        ZONE_CD,
        ORDER_COMPANY AS RO_CD,
        SA_CD,
        MATERIAL_CD,
        MATERIAL_GROUP_CD,
        SUM(NET_WEIGHT / 1000000) AS total_sales
    FROM 
        PS.EDW_PRIMARY_SALES_FACT
    GROUP BY 
        CAST(CONCAT(SUBSTRING(INVOICE_DATE_YYYYMMDD, 1, 6), '01') AS DATE),
        SBU_CD,
        ZONE_CD,
        RO_CD,
        SA_CD,
        MATERIAL_CD,
        MATERIAL_GROUP_CD
),
joined_data AS (
    -- Join the generated month range with the aggregated sales data
    SELECT
        mr.month,
        sd.SBU_CD,
        sd.ZONE_CD,
        sd.RO_CD,
        sd.SA_CD,
        sd.MATERIAL_CD,
        MATERIAL_GROUP_CD,
        COALESCE(sd.total_sales, 0) AS total_sales
    FROM 
        month_range mr
    LEFT JOIN 
        sales_data sd ON mr.month = sd.month
)
SELECT 
    -- Month Name
    DATE_FORMAT(month, '%M') AS month_name,  -- Month name (e.g., January)
    
    -- Month Number (Sequential across fiscal years)
    CASE 
        WHEN MONTH(month) >= 4 THEN MONTH(month) - 3  -- Fiscal month number (April = 1, May = 2, ...)
        ELSE MONTH(month) + 9  -- For January to March (e.g., Jan = 10, Feb = 11, Mar = 12)
    END AS fiscal_month,

    -- Additional Grouped Columns
    SBU_CD,
    ZONE_CD,
    RO_CD,
    SA_CD,
    MATERIAL_CD,
    MATERIAL_GROUP_CD,

    -- Total Sales
    total_sales,

    -- Fiscal Year Logic
    CASE 
        WHEN month BETWEEN 
            (SELECT start_of_previous_fiscal_year FROM fiscal_year_bounds)
            AND 
            (SELECT end_of_previous_fiscal_year FROM fiscal_year_bounds)
        THEN CONCAT(YEAR(month) - 1, '-', YEAR(month))  -- Assign fiscal year dynamically
        WHEN month BETWEEN 
            (SELECT start_of_current_fiscal_year FROM fiscal_year_bounds)
            AND 
            (SELECT end_of_current_fiscal_year FROM fiscal_year_bounds)
        THEN CONCAT(YEAR(month), '-', YEAR(month) + 1)  -- Assign fiscal year dynamically
    END AS fiscal_year,

    -- New Date Column: Combining the Month and Fiscal Year as Date type
    CAST(CONCAT(YEAR(month), '-', LPAD(MONTH(month), 2, '0'), '-01') AS DATE) AS month_year

FROM 
    joined_data 
ORDER BY 
    month, SBU_CD, ZONE_CD, RO_CD, SA_CD, MATERIAL_CD;





    """
    query = f"""

    WITH fiscal_year_bounds AS
  (-- Dynamically calculate the bounds for the current and previous fiscal years
 SELECT CASE
            WHEN MONTH(CURDATE()) < 4 THEN CONCAT(YEAR(CURDATE()) - 2, '-04-01') -- Start of the previous fiscal year

            ELSE CONCAT(YEAR(CURDATE()) - 1, '-04-01') -- Start of the current fiscal year

        END AS start_of_previous_fiscal_year,
        CASE
            WHEN MONTH(CURDATE()) < 4 THEN CONCAT(YEAR(CURDATE()) - 1, '-03-31') -- End of the previous fiscal year

            ELSE CONCAT(YEAR(CURDATE()), '-03-31') -- End of the current fiscal year

        END AS end_of_previous_fiscal_year,
        CASE
            WHEN MONTH(CURDATE()) < 4 THEN CONCAT(YEAR(CURDATE()) - 1, '-04-01') -- Start of the current fiscal year

            ELSE CONCAT(YEAR(CURDATE()), '-04-01') -- Start of the next fiscal year

        END AS start_of_current_fiscal_year,
        CASE
            WHEN MONTH(CURDATE()) < 4 THEN CONCAT(YEAR(CURDATE()), '-03-31') -- End of the current fiscal year

            ELSE CONCAT(YEAR(CURDATE()) + 1, '-03-31') -- End of the next fiscal year

        END AS end_of_current_fiscal_year),
                                                       month_range AS
  (-- Generate a list of months dynamically for both fiscal years
 SELECT DATE_ADD(fb.start_of_previous_fiscal_year, INTERVAL seq MONTH) AS MONTH
   FROM fiscal_year_bounds fb,

     (SELECT 0 AS seq
      UNION ALL SELECT 1
      UNION ALL SELECT 2
      UNION ALL SELECT 3
      UNION ALL SELECT 4
      UNION ALL SELECT 5
      UNION ALL SELECT 6
      UNION ALL SELECT 7
      UNION ALL SELECT 8
      UNION ALL SELECT 9
      UNION ALL SELECT 10
      UNION ALL SELECT 11
      UNION ALL SELECT 12
      UNION ALL SELECT 13
      UNION ALL SELECT 14
      UNION ALL SELECT 15
      UNION ALL SELECT 16
      UNION ALL SELECT 17
      UNION ALL SELECT 18
      UNION ALL SELECT 19
      UNION ALL SELECT 20
      UNION ALL SELECT 21
      UNION ALL SELECT 22
      UNION ALL SELECT 23) AS seq_table
   WHERE DATE_ADD(fb.start_of_previous_fiscal_year, INTERVAL seq MONTH) <= fb.end_of_current_fiscal_year ),
                                                       sales_data AS
  (-- Aggregate total sales by month and additional columns
 SELECT CAST(CONCAT(SUBSTRING(INVOICE_DATE_YYYYMMDD, 1, 6), '01') AS DATE) AS MONTH,
        SBU_CD,
        ZONE_CD,
        ORDER_COMPANY AS RO_CD,
        SA_CD,
        MATERIAL_CD,
        MATERIAL_GROUP_CD,
        SUM(NET_WEIGHT / 1000000) AS total_sales
   FROM PS.EDW_PRIMARY_SALES_FACT
   GROUP BY CAST(CONCAT(SUBSTRING(INVOICE_DATE_YYYYMMDD, 1, 6), '01') AS DATE),
            SBU_CD,
            ZONE_CD,
            RO_CD,
            SA_CD,
            MATERIAL_CD,
            MATERIAL_GROUP_CD),
                                                       joined_data AS
  (-- Join the generated month range with the aggregated sales data
 SELECT mr.month,
        sd.SBU_CD,
        sd.ZONE_CD,
        sd.RO_CD,
        sd.SA_CD,
        sd.MATERIAL_CD,
        MATERIAL_GROUP_CD,
        COALESCE(sd.total_sales, 0) AS total_sales
   FROM month_range mr
   LEFT JOIN sales_data sd ON mr.month = sd.month)
SELECT -- Month Name
 DATE_FORMAT(MONTH, '%M') AS month_name, -- Month name (e.g., January)
 -- Month Number (Sequential across fiscal years)
 CASE
     WHEN MONTH(MONTH) >= 4 THEN MONTH(MONTH) - 3 -- Fiscal month number (April = 1, May = 2, ...)

     ELSE MONTH(MONTH) + 9 -- For January to March (e.g., Jan = 10, Feb = 11, Mar = 12)

 END AS fiscal_month, -- Additional Grouped Columns
 SBU_CD,
 ZONE_CD,
 RO_CD,
 SA_CD,
 MATERIAL_CD,
 MATERIAL_GROUP_CD, -- Total Sales
 total_sales, -- Fiscal Year Logic
CASE
    -- For dates from January to March, assign the previous calendar year as the start of the fiscal year
    WHEN MONTH(MONTH) BETWEEN 1 AND 3 THEN 
        CONCAT(YEAR(MONTH) - 1, '-', YEAR(MONTH))
    -- For dates from April to December, assign the current calendar year as the start of the fiscal year
    WHEN MONTH(MONTH) BETWEEN 4 AND 12 THEN 
        CONCAT(YEAR(MONTH), '-', YEAR(MONTH) + 1)
END AS fiscal_year,
 CAST(CONCAT(YEAR(MONTH), '-', LPAD(MONTH(MONTH), 2, '0'), '-01') AS DATE) AS month_year
FROM joined_data
ORDER BY month_year DESC;



    """



    query = f"""
    select

ORGSBUCD,
ORGSBUNAME,
ORGZONECD,
ORGZONENAME,
/*ORGROCD,*/
CASE WHEN ORGSBUCD = '5000'  THEN '-' ELSE ORGROCD END AS ORGROCD,
ORGRONAME,
/*ORGSACD,*/
CASE WHEN ORGSBUCD = '5000' THEN  '-' ELSE ORGSACD END AS ORGSACD,
ORGSANAME,
PRODUCTCODE,
MATERIALGROUPNAME,
CURFISCALYEAR,
FISCALYEAR,
YEARMONTH,
NETWEIGHT_UOM,
NETWEIGHT AS NETWEIGHT_KG,
CASE WHEN ORGSBUCD = '7000' AND PRODUCTCODE IN ('005','007') THEN NETWEIGHT/1000000
WHEN ORGSBUCD = '5000' AND PRODUCTCODE IN ('012') THEN NETWEIGHT/1000000
WHEN ORGSBUCD = '2000' AND PRODUCTCODE IN ('001','002','003') THEN NETWEIGHT/1000000
WHEN ORGSBUCD = '3000' AND PRODUCTCODE IN ('005','006','007','009','010','011','013','014','016','017','018','019','020','021') THEN NETWEIGHT/1000000
WHEN ORGSBUCD = '4000' THEN NETWEIGHT/1000000
ELSE NETWEIGHT
END AS NETWEIGHT_TMT



from
(
        SELECT
        /*E2.ORG_SBU_CD AS ORGSBUCD,*/
        CASE WHEN E1.MATERIAL_GROUP_CD IN ('024','025','026','027','028','029','030','031','032','038') THEN '4000' ELSE E2.ORG_SBU_CD END AS ORGSBUCD,
        CASE WHEN E1.MATERIAL_GROUP_CD IN ('024','025','026','027','028','029','030','031','032','038') THEN 'HPCL Mkt DS Lubes' ELSE E8.ORG_SBU_NM END AS ORGSBUNAME,
        CASE WHEN E1.MATERIAL_GROUP_CD IN ('024','025','026','027','028','029','030','031','032','038') THEN '' ELSE E2.ORG_ZONE_CD END AS ORGZONECD,
        CASE WHEN E1.MATERIAL_GROUP_CD IN ('024','025','026','027','028','029','030','031','032','038') THEN '' ELSE E8.ORG_ZONE_NM END AS ORGZONENAME,
        CASE WHEN E1.MATERIAL_GROUP_CD IN ('024','025','026','027','028','029','030','031','032','038') THEN '' ELSE E2.ORG_RO_CD END  AS ORGROCD,
        CASE WHEN E1.MATERIAL_GROUP_CD IN ('024','025','026','027','028','029','030','031','032','038') THEN '' ELSE E8.ORG_RO_NM END  AS ORGRONAME,
        CASE WHEN E1.MATERIAL_GROUP_CD IN ('024','025','026','027','028','029','030','031','032','038') THEN '' ELSE E2.ORG_SA_CD END AS ORGSACD,
        CASE WHEN E1.MATERIAL_GROUP_CD IN ('024','025','026','027','028','029','030','031','032','038') THEN '' ELSE E8.ORG_SA_NM END AS ORGSANAME,
        CASE WHEN E2.ORG_SBU_CD<>4000 THEN E1.MATERIAL_GROUP_CD ELSE '' END as PRODUCTCODE,
        CASE WHEN E2.ORG_SBU_CD<>4000 THEN E7.MATERIAL_GROUP_NM 
            WHEN E1.MATERIAL_GROUP_CD IN ('024','025','026','027','028','029','030','031','032') THEN 'LUBES RETAIL' ELSE E7.MATERIAL_GROUP_NM END as MATERIALGROUPNAME,
        E3.CUR_FISCAL_YEAR AS CURFISCALYEAR,
        E3.FISCAL_YEAR AS FISCALYEAR,
        E3.YEARMONTH AS YEARMONTH,
        E1.WEIGHT_UNIT AS NETWEIGHT_UOM,
    SUM(E1.NET_WEIGHT) AS NETWEIGHT

        FROM 
            PS.EDW_PRIMARY_SALES_FACT E1   
            LEFT OUTER JOIN PS.EDW_CUSTOMER_SA_DIM E2 ON E2.CUST_SA_ID = E1.PS_CUST_SA_ID
            LEFT OUTER JOIN PS.EDW_DT_DIM E3 ON E3.DT_ID = E1.PS_DT_ID
             LEFT OUTER JOIN PS.EDW_CUSTOMER_DIM E5 ON E1.PS_CUST_ID = E5.CUST_ID
            LEFT OUTER JOIN PS.EDW_DISTRICT_DIM E6 ON E5.CUST_DISTRICT_CD = E6.DISTRICT_CD
            LEFT OUTER JOIN PS.EDW_MATERIAL_GROUP_DIM  E7 ON E1.PS_MATERIAL_GROUP_ID = E7.MATERIAL_GROUP_ID
            LEFT OUTER JOIN PS.EDW_SALES_ORG_DIM E8 on E2.ORG_SA_CD = E8.ORG_SA_CD 
            WHERE
            E1.PS_DT_ID >= 20240401 
        AND  E2.ORG_SBU_CD in ( '7000','5000','2000','3000','4000')
            GROUP BY E2.ORG_SBU_CD,
E8.ORG_SBU_NM,
E2.ORG_ZONE_CD,
E8.ORG_ZONE_NM,
E2.ORG_RO_CD,
E8.ORG_RO_NM,
E2.ORG_SA_CD,
E8.ORG_SA_NM,
CASE WHEN E2.ORG_SBU_CD<>4000 THEN E1.MATERIAL_GROUP_CD ELSE NULL END,
CASE WHEN E2.ORG_SBU_CD<>4000 THEN E7.MATERIAL_GROUP_NM ELSE NULL END,
E3.CUR_FISCAL_YEAR,
E3.FISCAL_YEAR,
E3.YEARMONTH,
E1.WEIGHT_UNIT
) OrigView
 ORDER BY 1,2,3,4
    """
    
    query_daywise = f"""
    SELECT
    ORGSBUCD,
    ORGSBUNAME,
    ORGZONECD,
    ORGZONENAME,
    CASE WHEN ORGSBUCD = '5000' THEN '-' ELSE ORGROCD END AS ORGROCD,
    ORGRONAME,
    CASE WHEN ORGSBUCD = '5000' THEN '-' ELSE ORGSACD END AS ORGSACD,
    ORGSANAME,
    PRODUCTCODE,
    MATERIALGROUPNAME,
    CURFISCALYEAR,
    FISCALYEAR,
    YEARMONTH,
    DAY_ID, -- Adding day-level granularity
    NETWEIGHT_UOM,
    NETWEIGHT AS NETWEIGHT_KG,
    CASE
        WHEN ORGSBUCD = '7000'  THEN NETWEIGHT / 1000000
        WHEN ORGSBUCD = '5000'  THEN NETWEIGHT / 1000000
        WHEN ORGSBUCD = '2000'  THEN NETWEIGHT / 1000000
        WHEN ORGSBUCD = '3000'  THEN NETWEIGHT / 1000000
        WHEN ORGSBUCD = '4000'  THEN NETWEIGHT / 1000000
        WHEN ORGSBUCD = '5500'  THEN NETWEIGHT / 1000000
        WHEN ORGSBUCD = '5750'  THEN NETWEIGHT / 1000000
        ELSE NETWEIGHT
    END AS NETWEIGHT_TMT
FROM (
    SELECT
     CASE
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032', '038') THEN '4000'
            ELSE E2.ORG_SBU_CD
        END AS ORGSBUCD,
        CASE
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032', '038') THEN 'HPCL Mkt DS Lubes'
            ELSE E8.ORG_SBU_NM
        END AS ORGSBUNAME,
        CASE
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032', '038') THEN ''
            ELSE E2.ORG_ZONE_CD
        END AS ORGZONECD,
        CASE
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032', '038') THEN ''
            ELSE E8.ORG_ZONE_NM
        END AS ORGZONENAME,
        CASE
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032', '038') THEN ''
            ELSE E2.ORG_RO_CD
        END AS ORGROCD,
        CASE
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032', '038') THEN ''
            ELSE E8.ORG_RO_NM
        END AS ORGRONAME,
        CASE
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032', '038') THEN ''
            ELSE E2.ORG_SA_CD
        END AS ORGSACD,
        CASE
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032', '038') THEN ''
            ELSE E8.ORG_SA_NM
        END AS ORGSANAME,
        CASE
            WHEN E2.ORG_SBU_CD <> 4000 THEN E1.MATERIAL_GROUP_CD
            ELSE ''
        END AS PRODUCTCODE,
        
        CASE
            WHEN E2.ORG_SBU_CD <> 4000 THEN E7.MATERIAL_GROUP_NM
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032') THEN 'LUBES RETAIL'
            ELSE E7.MATERIAL_GROUP_NM
        END AS MATERIALGROUPNAME,
        E3.CUR_FISCAL_YEAR AS CURFISCALYEAR,
        E3.FISCAL_YEAR AS FISCALYEAR,
        E3.YEARMONTH AS YEARMONTH,
        E3.DT_ID AS DAY_ID, -- Adding day-level granularity
        E1.WEIGHT_UNIT AS NETWEIGHT_UOM,
        SUM(E1.NET_WEIGHT) AS NETWEIGHT
    FROM
        PS.EDW_PRIMARY_SALES_FACT E1  
        LEFT OUTER JOIN PS.EDW_CUSTOMER_SA_DIM E2 ON E2.CUST_SA_ID = E1.PS_CUST_SA_ID
        LEFT OUTER JOIN PS.EDW_DT_DIM E3 ON E3.DT_ID = E1.PS_DT_ID
        LEFT OUTER JOIN PS.EDW_CUSTOMER_DIM E5 ON E1.PS_CUST_ID = E5.CUST_ID
        LEFT OUTER JOIN PS.EDW_DISTRICT_DIM E6 ON E5.CUST_DISTRICT_CD = E6.DISTRICT_CD
        LEFT OUTER JOIN PS.EDW_MATERIAL_GROUP_DIM E7 ON E1.PS_MATERIAL_GROUP_ID = E7.MATERIAL_GROUP_ID
        LEFT OUTER JOIN PS.EDW_SALES_ORG_DIM E8 ON E2.ORG_SA_CD = E8.ORG_SA_CD
    WHERE
        E1.PS_DT_ID >= 20230401
        AND E2.ORG_SBU_CD IN ('7000', '5000', '2000', '3000', '4000','5500','5750')
    GROUP BY
        E2.ORG_SBU_CD,
        E8.ORG_SBU_NM,
        E2.ORG_ZONE_CD,
        E8.ORG_ZONE_NM,
        E2.ORG_RO_CD,
        E8.ORG_RO_NM,
        E2.ORG_SA_CD,
        E8.ORG_SA_NM,
        CASE WHEN E2.ORG_SBU_CD <> 4000 THEN E1.MATERIAL_GROUP_CD ELSE NULL END,
        CASE WHEN E2.ORG_SBU_CD <> 4000 THEN E7.MATERIAL_GROUP_NM ELSE NULL END,
        E3.CUR_FISCAL_YEAR,
        E3.FISCAL_YEAR,
        E3.YEARMONTH,
        E3.DT_ID, -- Adding day-level granularity
        E1.WEIGHT_UNIT
) OrigView

ORDER BY ORGSBUCD, DAY_ID;


    """
    query_daywise =f"""
    SELECT
    ORGSBUCD,
    ORGSBUNAME,
    ORGZONECD,
    ORGZONENAME,
    CASE WHEN ORGSBUCD = '5000' THEN '-' ELSE ORGROCD END AS ORGROCD,
    ORGRONAME,
    CASE WHEN ORGSBUCD = '5000' THEN '-' ELSE ORGSACD END AS ORGSACD,
    ORGSANAME,
    PRODUCTCODE,
    MATERIAL_CD,-- Added MATERIAL_CD
    DISTRIBUTION_CHANNEL_CD,
    MATERIAL_GROUP_CD,
    PLANT_CD,
    MATERIALGROUPNAME,
    CURFISCALYEAR,
    FISCALYEAR,
    YEARMONTH,
    DAY_ID, -- Adding day-level granularity
    NETWEIGHT_UOM,
    NETWEIGHT AS NETWEIGHT_KG,
    
    CASE
        WHEN ORGSBUCD IN ('7000', '5000', '2000', '3000', '4000', '5500', '5750') THEN NETWEIGHT / 1000000
        ELSE NETWEIGHT
    END AS NETWEIGHT_TMT
FROM (
    SELECT
        CASE
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032', '038') THEN '4000'
            ELSE E2.ORG_SBU_CD 
        END AS ORGSBUCD,
        CASE
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032', '038') THEN 'HPCL Mkt DS Lubes'
            ELSE E8.ORG_SBU_NM
        END AS ORGSBUNAME,
        CASE
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032', '038') THEN ''
            ELSE E2.ORG_ZONE_CD
        END AS ORGZONECD,
        CASE
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032', '038') THEN ''
            ELSE E8.ORG_ZONE_NM
        END AS ORGZONENAME,
        CASE
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032', '038') THEN ''
            ELSE E2.ORG_RO_CD
        END AS ORGROCD,
        CASE
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032', '038') THEN ''
            ELSE E8.ORG_RO_NM
        END AS ORGRONAME,
        CASE
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032', '038') THEN ''
            ELSE E2.ORG_SA_CD
        END AS ORGSACD,
        CASE
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032', '038') THEN ''
            ELSE E8.ORG_SA_NM
        END AS ORGSANAME,
        CASE
            WHEN E2.ORG_SBU_CD <> 4000 THEN E1.MATERIAL_GROUP_CD
            ELSE ''
        END AS PRODUCTCODE,
        E1.MATERIAL_CD,  -- Added MATERIAL_CD
        E1.DISTRIBUTION_CHANNEL_CD,
        E1.MATERIAL_GROUP_CD,
        E1.PLANT_CD,
        CASE
            WHEN E2.ORG_SBU_CD <> 4000 THEN E7.MATERIAL_GROUP_NM
            WHEN E1.MATERIAL_GROUP_CD IN ('024', '025', '026', '027', '028', '029', '030', '031', '032') THEN 'LUBES RETAIL'
            ELSE E7.MATERIAL_GROUP_NM
        END AS MATERIALGROUPNAME,
        E3.CUR_FISCAL_YEAR AS CURFISCALYEAR,
        E3.FISCAL_YEAR AS FISCALYEAR,
        E3.YEARMONTH AS YEARMONTH,
        E3.DT_ID AS DAY_ID, -- Adding day-level granularity
        E1.WEIGHT_UNIT AS NETWEIGHT_UOM,
        SUM(E1.NET_WEIGHT) AS NETWEIGHT
        
    FROM
        PS.EDW_PRIMARY_SALES_FACT E1  
        LEFT OUTER JOIN PS.EDW_CUSTOMER_SA_DIM E2 ON E2.CUST_SA_ID = E1.PS_CUST_SA_ID
        LEFT OUTER JOIN PS.EDW_DT_DIM E3 ON E3.DT_ID = E1.PS_DT_ID
        LEFT OUTER JOIN PS.EDW_CUSTOMER_DIM E5 ON E1.PS_CUST_ID = E5.CUST_ID
        LEFT OUTER JOIN PS.EDW_DISTRICT_DIM E6 ON E5.CUST_DISTRICT_CD = E6.DISTRICT_CD
        LEFT OUTER JOIN PS.EDW_MATERIAL_GROUP_DIM E7 ON E1.PS_MATERIAL_GROUP_ID = E7.MATERIAL_GROUP_ID
        LEFT OUTER JOIN PS.EDW_SALES_ORG_DIM E8 ON E2.ORG_SA_CD = E8.ORG_SA_CD
    WHERE
        E1.PS_DT_ID >= 20230401
        AND E2.ORG_SBU_CD IN ('7000', '5000', '2000', '3000', '4000','5500','5750')
    GROUP BY
        E2.ORG_SBU_CD,
        E8.ORG_SBU_NM,
        E2.ORG_ZONE_CD,
        E8.ORG_ZONE_NM,
        E2.ORG_RO_CD,
        E8.ORG_RO_NM,
        E2.ORG_SA_CD,
        E8.ORG_SA_NM,
        CASE WHEN E2.ORG_SBU_CD <> 4000 THEN E1.MATERIAL_GROUP_CD ELSE NULL END,
        CASE WHEN E2.ORG_SBU_CD <> 4000 THEN E7.MATERIAL_GROUP_NM ELSE NULL END,
        E3.CUR_FISCAL_YEAR,
        E3.FISCAL_YEAR,
        E3.YEARMONTH,
        E3.DT_ID, -- Adding day-level granularity
        E1.WEIGHT_UNIT,
        E1.MATERIAL_CD,  -- Added MATERIAL_CD in GROUP BY
        E1.DISTRIBUTION_CHANNEL_CD,
        E1.MATERIAL_GROUP_CD,
        E1.PLANT_CD
) OrigView

ORDER BY ORGSBUCD, DAY_ID;
    """
    connection = get_db_connection(params)
    
    cursor = connection.cursor()
    get_and_insert_data(cursor, query_daywise, params=params, debug=DEBUG_MODE)


