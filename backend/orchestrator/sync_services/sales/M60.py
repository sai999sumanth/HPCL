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
import io
import numpy as np
import sys
import urdhva_base
sys.path.append("/opt/ceg/algo")
import orchestrator.dbconnector.credential_loader as credential_loader

logger = urdhva_base.logger.Logger.getInstance('M60_data_sync_log')

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

def generate_engine_id(row):
    #row_string = "|".join(str(v)for v in row_dict.values())
    values = [str(v) for v in struct.values()]
    row_string = "|".join(values)
    return hashlib.md5(row_string.encode()).hexdigest()

def insertToDB(data, table_name, indexing_col=()):
    #data["engine_id"] = data.apply(generate_engine_id, axis=1)
    data = data.with_columns(
    pl.struct(data.columns).map_elements(
        lambda row: hashlib.md5("|".join(str(v) for v in row.values()).encode()).hexdigest()
    ).alias("engine_id")
)
    data.write_csv(f"/tmp/unique_name.csv",separator='~')
    '''
    for col in data.columns:
        try:
            data = data.with_columns(pl.col(col).fill_null(0).cast(pl.float64).alias(col))
            data = data.with_columns(pl.col(col).round(2).alias(col))
        except Exception as e:
            print("Couldn't convert to Integer :", col)
            continue
    '''
    print('insert function')
    print(len(data))
    data.write_csv('/tmp/data.csv')
    #data = data.unique(subset=['engine_id'])
    print(len(data))
    print(data.schema)
    print(data['TARGET_QTY_TMT'].dtype)
    print(data['TARGET_ROUND'].dtype)
    for col in data.columns:
        if data.schema[col] in [pl.Float32, pl.Float64]:
             #data = data.with_columns(pl.col(col).round(2).alias(col))
             data = data.with_columns(pl.col(col).alias(col))
        if data[col].dtype in ['Int64']:
            data = data.with_columns(pl.col(col).round(0).alias(col))
        if 'Decimal' in str(data.schema[col]):
            print("decimal type col")
            #data = data.with_columns(pl.col(col).cast(pl.Int64).round(0).alias(col))
            data = data.with_columns(pl.col(col).alias(col))
    print(data)
    print(data.schema)
    data.write_csv(f"/tmp/table_name1.csv",separator='~')
    print("-" * 50)
    print(f"-- Inserting Data to {table_name} --")
    print("Length of Data :", len(data))
    
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
    dtype_dict =  {'String': str('text'), 'Int64': str('bigint'), 'Int32': str('bigint'), 'Boolean': str('text'),
                  'Float64': str('double precision'), 'Float32': str('double precision'),
                  'Object': str('text'), 'Datetime': str('timestamp'), 'Date': str('timestamp'), 'Utf8': str('text'),
                  "Datetime(time_unit='us', time_zone=None)": str('timestamp'),
                  "Datetime(time_unit='ns', time_zone=None)": str('timestamp'),
                  "Decimal(precision=5, scale=2)": str('double precision'),
                  "Decimal(precision=6, scale=2)": str('double precision'),
                  "Decimal(precision=6, scale=4)": str('double precision'),
                  "Decimal(precision=9, scale=4)": str('double precision'),
                  "Decimal(precision=9, scale=0)": str('double precision'),
                  "Decimal(precision=6, scale=0)": str('double precision'),
                  "Decimal(precision=4, scale=0)": str('double precision'),
                  "Decimal(precision=4, scale=2)": str('double precision'),
                  "Decimal(precision=8, scale=0)": str('double precision'),
                  "Decimal(precision=8, scale=3)": str('double precision'),
                  "Decimal(precision=6, scale=0)": str('double precision'),
                  "Decimal(precision=6, scale=3)": str('double precision'),
                  "Decimal(precision=7, scale=4)": str('double precision'),
                  "Decimal(precision=8, scale=6)": str('double precision'),
                  "Decimal(precision=11, scale=6)": str('double precision'),
                  "Decimal(precision=11, scale=8)": str('double precision'),
                  "Decimal(precision=13, scale=10)": str('double precision'),
                  "Decimal(precision=10, scale=2)": str('double precision'),
                  "Decimal(precision=10, scale=4)": str('double precision'),
                  "Decimal(precision=12, scale=8)": str('double precision'),
                  "Decimal(precision=None, scale=2)": str('double precision'),
                  "Decimal(precision=None, scale=27)": str('double precision'),
                  "Decimal(precision=None, scale=28)": str('double precision')
                  }

    print('Data Types :', data.dtypes)
    data = data.rename({'FISCAL_YEAR':'fiscal_year'})
    col_dtype = {col: data[col].dtype for col in data.columns}
    for col, dty in col_dtype.items():
        # dty = dtype_dict.get(str(dty))
        dty_str = str(dty)

        if "Decimal" in dty_str:
            dty = "double precision"
        else:
            dty = dtype_dict.get(dty_str, "text")
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
    print(len(data))
    #data = data.unique(subset = ['engine_id'])

    print(len(data))
    cur.execute(table_create_sql)
    
    pg_conn.commit()
    '''
    cur.execute(f"""
            CREATE UNIQUE INDEX IF NOT EXISTS engine_id_m60 ON "{table_name}" (engine_id);


    """)
    '''
    '''
    cur.execute(f"""
        ALTER TABLE "{table_name}" ADD constraint "engine_id_m60" UNIQUE (engine_id);


            """)
    '''
    print(columns_formatted)
    #cur.execute(create_table_index)
    #renaming the column value of month_name from full letters to first three charecters
    data = data.with_columns(
    pl.col("month_name").map_elements(lambda x: x[:3] if len(x) >= 3 else x).alias("month_name")
)
    #data = data.rename({'FISCAL_YEAR':'fiscal_year'})
    sql = f"""SELECT * FROM "{table_name}" LIMIT 1"""
    cur.execute(sql)
    column_names = [desc[0] for desc in cur.description]
    print(column_names)
    columns = []
    for i in column_names:
        columns.append(i)
    data = data.select(columns)
    #data.write_csv('/tmp/sales_data.csv')
    print(data)
    pg_conn.commit()
    try:
        cur.execute(f"""
                    DELETE FROM "M60_LEVEL_METADATA"
                    """)
        
        
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
    except Exception as e:
        logger.error(f"Error while inserting data to {table_name}")
        print("Error :", str(e))
        raise Exception(e)
    exit()

    temp_table = 'sample_m60'
    
    cur.execute(f"""
    CREATE TEMP TABLE {temp_table} (LIKE  "{table_name}" INCLUDING ALL);
""")
    '''
    try:
     cur.execute(f"""
    CREATE TEMP TABLE {temp_table} (LIKE  "{table_name}" INCLUDING DEFAULTS) ON COMMIT DROP


    """)

    except Exception as e:
        print("xontinue")
    '''
    pg_conn.commit()
    
    
    copy_query = f"""
    COPY {temp_table}
    FROM STDIN
    CSV HEADER DELIMITER '~';
"""
   
    data.write_csv(f"/tmp/{table_name}.csv",separator='~')
    with open(f"/tmp/{table_name}.csv", "r") as f:
            cur.copy_expert(copy_query, f)
    
    
    #output = io.StringIO()
    #data.write_csv(f"/tmp/{table_name}.csv",separator='~')
    #output.seek(0)
    #cur.copy_from(output, temp_table, columns=columns, null='')
    pg_conn.commit()
    

    try:
       # cur.execute(f"""
    #CREATE TEMP TABLE {temp_table} (LIKE  "{table_name}" INCLUDING DEFAULTS) ON COMMIT DROP
#""")
        conflict_column = 'engine_id'
        update_cols = [col for col in columns if col != conflict_column]
        set_clause = ", ".join([f'"{col}" = EXCLUDED."{col}"' for col in update_cols])
        columns = ['"'+col+'"' for col in columns]
        print("columns",columns)
        cur.execute(f'select count(*) FROM "{temp_table}"')
        print(f'select count(*) FROM "{temp_table}"')

        data = cur.fetchall()
        print(data)
        cur.execute(f"""
            INSERT INTO "{table_name}" ({', '.join(columns)})
            SELECT {', '.join(columns)}
            FROM {temp_table}
            ON CONFLICT ("engine_id")
            DO UPDATE SET {set_clause}
        """)
        pg_conn.commit()
        cur.close()
        exit()

        copy_query = f"""
    COPY {temp_table}
    FROM STDIN
    CSV HEADER DELIMITER '~';
"""
        
        with open(f"/tmp/{table_name}.csv", "r") as f:
            cur.copy_expert(copy_query, f)

        upsert_query = f"""
    INSERT INTO "{table_name}"
    SELECT * FROM {temp_table}
    ON CONFLICT (engine_id) DO UPDATE
    SET {', '.join([f'{col} = EXCLUDED.{col}' for col in column_names if col != 'engine_id'])};
"""
        cur.execute(upsert_query)
        conn.commit()
        cur.execute(f"DROP TABLE IF EXISTS {temp_table};")
        cur.close()
        copy_query = f"""
    COPY {temp_table}
    FROM STDIN
    CSV HEADER DELIMITER '~';
"""
        query = f'''
        COPY "{table_name}"
        FROM STDIN
        CSV HEADER DELIMITER '~';
        '''
        for g, split_df in data.group_by(len(data) // 10000000):
            csv_file = f'/tmp/{table_name}.csv'
            print("*"*50)
            print("length ",len(split_df))
            split_df.write_csv(csv_file, separator='~')
            with open(csv_file, 'r') as f:
                cur.copy_expert(query, f)
                pg_conn.commit()
        cur.close()
        if os.path.exists(f'/tmp/{table_name}.csv'):
            os.remove(f'/tmp/{table_name}.csv')
        print(f"-- Data has been inserted to {table_name} --")
    except Exception as e:
        logger.error(f"Error while inserting data to {table_name}")
        print("Error :", str(e))
        raise Exception(e)


def get_and_insert_data(cursor, query, params=None):
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
    print(data.columns.tolist())
    print(data['SBU_Name'].unique().tolist())
    data['SBU_Name'] = data['SBU_Name'].fillna('0').astype(str).apply(lambda x:x.split()[-1] if len(x.split()) >=3 else x)
    
    data['TARGET_QTY_TMT'] = data['TARGET_QTY_TMT'].fillna('0').astype(np.float64)
    data['NETWEIGHT_TMT'] = data['NETWEIGHT_TMT'].fillna('0').astype(np.float64)
    
    data['SBU_Name'] = data['SBU_Name'].str.replace('PETROCHEMICALS SBU','PETCHEM').str.replace('GAS HQO','GAS')
    data.to_csv('/tmp/tibco_data.csv',index = False)
    data.loc[data['SBU_Name'] =='GAS','Zone_Name'] = 'HQO Customer'
    print(data.columns.tolist())
    mapping_dict = {
    "West": "WZ",
    "East": "EZ",
    "North": "NZ",
    "South": "SZ",
    "SOU":"SZ",
    "WES":"WZ",
    "NOR":"NZ",
    "EAS":"EZ"
    }
    data["ORGZONECD"] = data["Zone_Name"].map(mapping_dict).combine_first(data["ORGZONECD"])

    data = pl.from_pandas(data)
    
    print("*" * 50)
    print("Data Schema", data.schema)
    print("*" * 50)
    print(len(data))
   # data.write_csv('/tmp/sales_data.csv')
    data = data.with_columns(pl.lit(0).alias("Prediction_Value"))
    data = data.with_columns(pl.lit(0).alias("Act_Tgt_Achievement"))
    data = data.with_columns(pl.lit(0).alias("Zone_Region_Achievement"))
    data = data.with_columns(pl.lit(0).alias("Product_Achievement"))
    #data = data.with_columns(pl.lit(0).alias("Actual_Achievement"))
    for each_year in data['FISCAL_YEAR'].unique().to_list():
      for each_month in data['fy_month'].unique().to_list():
        curr_month = data.filter((pl.col('FISCAL_YEAR') == each_year)&(pl.col('fy_month') == each_month))['NETWEIGHT_TMT'].sum()
        prev_month = data.filter((pl.col('FISCAL_YEAR') == each_year)&(pl.col('fy_month') == each_month-1))['NETWEIGHT_TMT'].sum()
        print(each_month)
        print(curr_month)
        print(prev_month)
        calculated_value = 0
        if curr_month != 0 and prev_month !=0:
            calculated_value = ((curr_month-prev_month) /prev_month) *100
        data = data.with_columns(pl.when((pl.col("FISCAL_YEAR") == each_year) & (pl.col("fy_month")==each_month)).then(pl.lit(calculated_value)).otherwise(pl.col("Prediction_Value")).alias("Prediction_Value"))
        print(data.schema)
        data = data.with_columns(pl.col("Prediction_Value").fill_null(0).cast(pl.Float64).round(2).alias("Prediction_Value"))
    data.write_csv('/tmp/data.csv')
    data_tmp = data.filter(pl.col("FISCALYEAR").is_not_null())
    for each_year in data_tmp['FISCAL_YEAR'].unique().to_list():
     for each_month in data_tmp['fy_month'].unique().to_list(): 
        
        net_sum = data_tmp.filter((pl.col('FISCAL_YEAR') == each_year) & (pl.col('fy_month') == each_month))['NETWEIGHT_TMT'].sum()
        target_sum = data_tmp.filter((pl.col('FISCAL_YEAR') == each_year) & (pl.col('fy_month') == each_month))['TARGET_QTY_TMT'].sum()
        achievement=0
        if net_sum != 0 and target_sum!=0:
            achievement = round(((net_sum)/(target_sum))*100,2)
        data = data.with_columns(pl.when((pl.col('FISCAL_YEAR') == each_year)&(pl.col('fy_month') == each_month)).then(pl.lit(achievement)).otherwise(pl.col('Act_Tgt_Achievement')).alias('Act_Tgt_Achievement'))

    for each_Zone in data['Zone_Name'].unique().to_list():
    
     for each_region in data['Region_Name'].unique().to_list():
        net_sum = data.filter((pl.col('Zone_Name') ==each_Zone)&(pl.col('Region_Name') == each_region))['NETWEIGHT_TMT'].sum()
        target_sum = data.filter((pl.col('Zone_Name') ==each_Zone)&(pl.col('Region_Name') == each_region))['TARGET_QTY_TMT'].sum()
        achievement_zone = 0
        if net_sum !=0 and target_sum !=0:
            achievement_zone = round((net_sum/target_sum)*100,2)
        data = data.with_columns(pl.when((pl.col('Zone_Name') == each_Zone)&(pl.col('Region_Name') == each_region)).then(pl.lit(achievement_zone)).otherwise(pl.col('Zone_Region_Achievement')).alias('Zone_Region_Achievement'))
    for each_product in data['ProductName'].unique().to_list():
        net_sum = data.filter(pl.col('ProductName') == each_product)['NETWEIGHT_TMT'].sum()
        target_sum = data.filter(pl.col('ProductName') == each_product)['TARGET_QTY_TMT'].sum()
        achievement_product = 0
        if net_sum !=0 and target_sum != 0:
            achievement_product = round((net_sum/target_sum)*100,2)
        data = data.with_columns(pl.when(pl.col('ProductName') == each_product).then(pl.lit(achievement_product)).otherwise(pl.col('Product_Achievement')).alias('Product_Achievement'))
    
    '''
    for each_year in data_tmp['FISCAL_YEAR'].unique().to_list():
        net_sum = data_tmp.filter((pl.col('FISCAL_YEAR') == each_year))['NETWEIGHT_TMT'].sum()
        targett_sum = data_tmp.filter((pl.col('FISCAL_YEAR') == each_year))['Target_Quantity_TMTT'].sum()
        if net_sum !=0 and targett_sum != 0:
            Actual_Achievement = net_sum/targett_sum
        #data = data.with_columns(pl.when(pl.col('FISCAL_YEAR')== each_year)).then(pl.lit(Actual_Achievement,allow_object=True)).otherwise(pl.col('Actual_Achievement')).alias('Actual_Achievement')
        data = data.with_columns(
    pl.when(pl.col('FISCAL_YEAR') == each_year)
    .then(pl.lit(Actual_Achievement, allow_object=True))
    .otherwise(pl.col('Actual_Achievement'))
    .alias('Actual_Achievement')
)
    '''
    print(data.columns)

    #insertToDB(data, params["table_name"], indexing_col=params["indexing_col"])
    print(len(data))
    data.write_csv('/tmp/result_data.csv')
    print(data['NETWEIGHT_TMT'].unique().to_list())
    #data= data.with_columns(pl.col("ORGZONECD").replace("ORGZONECD").alias("col"))
    #EAS':'EZ' 'NOR':'NZ' 'SOU':'SZ' , 'WES':'WZ',
    data = data.with_columns(
        pl.col("FISCAL_YEAR")
        .str.replace("^FY\\s*", "")
        .alias("FISCAL_YEAR")
    )
    insertToDB(data, params["table_name"])



if __name__ == "__main__":
    
    creds = credential_loader.get_credentials('TIBCO') 
    print("creds",creds)
    params = {
            "host":creds['host'],
            "database":creds['database'],
            "user":creds['user'],
            "password":creds['password'],
            "port":creds['port'],
            "table_name":"M60_LEVEL_METADATA",
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
    query = """

  WITH PendingDaysData AS (

    SELECT 

        ts.*,

        st.*,

        

        -- Calculate Total Days till Present Day

        DATEDIFF(CURDATE(), 

            CASE 

                WHEN MONTH(CURDATE()) < 4 THEN DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 YEAR), '%Y-04-01')

                ELSE DATE_FORMAT(CURDATE(), '%Y-04-01')

            END

        ) + 1 AS Total_Days_Till_PresentDay,

        

        -- Calculate Number of Sundays till Present Day

        FLOOR(

            DATEDIFF(CURDATE(), 

                CASE 

                    WHEN MONTH(CURDATE()) < 4 THEN DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 YEAR), '%Y-04-01')

                    ELSE DATE_FORMAT(CURDATE(), '%Y-04-01')

                END

            ) / 7

        ) + 1 AS Number_Of_Sundays_Till_PresentDay

    FROM 

        CONN_ENT.TARGET_SALES_DATA ts

    LEFT JOIN 

        CONN_ENT.ACTUAL_SALES_VW st

    ON 

        LTRIM(RTRIM(st.ORGSBUCD)) = LTRIM(RTRIM(ts.SBU)) AND 

        LTRIM(RTRIM(st.ORGZONECD)) = LTRIM(RTRIM(ts.ZONE)) AND 

        LTRIM(RTRIM(st.ORGROCD)) = LTRIM(RTRIM(ts.REGION)) AND 

        LTRIM(RTRIM(st.ORGSACD)) = LTRIM(RTRIM(ts.SA)) AND 

        LTRIM(RTRIM(st.PRODUCTCODE)) = LTRIM(RTRIM(ts.PRODUCT)) AND 

        st.YEARMONTH = ts.INVOICE_DT

),

AggregatedValues AS (

    -- Calculate the aggregate values

    SELECT 

        SUM(TARGET_QTY_TMT) AS FinalSum,        -- Total TARGET_QTY_TMT

        SUM(NETWEIGHT_TMT) AS FinalActualSum,   -- Total NETWEIGHT_TMT

        MAX(Total_Days_Till_PresentDay) AS MaxTotalDaysTillPresentDay,  -- Max Total Days till Present Day

        MAX(Number_Of_Sundays_Till_PresentDay) AS MaxNumberOfSundaysTillPresentDay, -- Max Number of Sundays till Present Day

        

        -- Calculate Working Days till Present Day (Excluding Sundays)

        MAX(Total_Days_Till_PresentDay) - MAX(Number_Of_Sundays_Till_PresentDay) AS Working_Days_Till_PresentDay_WithoutSundays,

        

        -- Calculate the Total_Days_in_FY based on whether the fiscal year starts on Sunday

        CASE 

            WHEN DAYOFWEEK(

                CASE 

                    WHEN MONTH(CURDATE()) < 4 THEN DATE_FORMAT(CURDATE(), '%Y-04-01')

                    ELSE DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 YEAR), '%Y-04-01')

                END

            ) = 1 THEN 365 - 53  -- Start of FY is Sunday

            ELSE 365 - 52         -- Start of FY is not Sunday

        END AS Total_Days_in_FY,

        

        -- Calculate Pending Days as Total Days in Fiscal Year - Working Days till Present Day without Sundays

        (365 - 52) - (MAX(Total_Days_Till_PresentDay) - MAX(Number_Of_Sundays_Till_PresentDay)) AS Pending_Days

    FROM 

        PendingDaysData

),

FinalCalculation AS (

    -- Calculate the required metrics

    SELECT 

        FinalSum,

        FinalActualSum,

        MAX(Pending_Days) as MaxPendingDays,

        Working_Days_Till_PresentDay_WithoutSundays,

        Total_Days_in_FY,

        Pending_Days,

        

        -- Calculate req_sum

        (FinalSum - FinalActualSum) / MaxPendingDays AS Rate_Per_Day_Required_MMT,



        -- Calculate Rate_per_day_current_MMT

        CASE 

            WHEN (FinalActualSum / Working_Days_Till_PresentDay_WithoutSundays) < 10 THEN

                ROUND(FinalActualSum / Working_Days_Till_PresentDay_WithoutSundays, 2)

            ELSE

                ROUND(FinalActualSum / Working_Days_Till_PresentDay_WithoutSundays, 0)

        END AS Rate_Per_Day_Current_MMT

    FROM 

        AggregatedValues

)

SELECT 

    pd.*, 

    fc.FinalSum,

    fc.FinalActualSum,

    fc.MaxPendingDays,

    fc.Working_Days_Till_PresentDay_WithoutSundays,

    fc.Rate_Per_Day_Required_MMT,

    fc.Rate_per_day_current_MMT,

    fc.Total_Days_in_FY,  -- Added column for total days in FY

    fc.Pending_Days,      -- Added column for pending days

    

    -- Extract month_year as integer

    CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) AS month_year,

    

    -- Map month_year to full month name

    CASE 

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 1 THEN 'January'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 2 THEN 'February'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 3 THEN 'March'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 4 THEN 'April'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 5 THEN 'May'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 6 THEN 'June'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 7 THEN 'July'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 8 THEN 'August'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 9 THEN 'September'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 10 THEN 'October'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 11 THEN 'November'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 12 THEN 'December'

        ELSE NULL

    END AS month_name,



    -- Map month_name to fiscal year month number

    CASE 

        WHEN month_name = 'April' THEN 1

        WHEN month_name = 'May' THEN 2

        WHEN month_name = 'June' THEN 3

        WHEN month_name = 'July' THEN 4

        WHEN month_name = 'August' THEN 5

        WHEN month_name = 'September' THEN 6

        WHEN month_name = 'October' THEN 7

        WHEN month_name = 'November' THEN 8

        WHEN month_name = 'December' THEN 9

        WHEN month_name = 'January' THEN 10

        WHEN month_name = 'February' THEN 11

        WHEN month_name = 'March' THEN 12

        ELSE NULL

    END AS fy_month,



    -- Create year_monthname column

    CAST(CONCAT(LEFT(CAST(pd.INVOICE_DT AS CHAR), 4), '-', LPAD(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2), 2, '0'), '-01') AS DATE) AS year_monthname,
    CASE

        WHEN (CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) >= 4 

              AND CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) <= MONTH(DATE_ADD(CURDATE(), INTERVAL -1 MONTH))) THEN 

            pd.TARGET_QTY_TMT  -- Use the column `TARGET_QTY_TMT` for valid months

        ELSE 

            NULL  -- Set to NULL if the condition is not met

    END AS Target_Quantity_TMTT

FROM 

    PendingDaysData pd

CROSS JOIN 

    FinalCalculation fc;

    
    """
    query = """
    WITH PendingDaysData AS (

    SELECT

        ts.*,

        st.*,



        -- Calculate Total Days till Present Day

        DATEDIFF(CURDATE(),

            CASE

                WHEN MONTH(CURDATE()) < 4 THEN DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 YEAR), '%Y-04-01')

                ELSE DATE_FORMAT(CURDATE(), '%Y-04-01')

            END

        ) + 1 AS Total_Days_Till_PresentDay,



        -- Calculate Number of Sundays till Present Day

        FLOOR(

            DATEDIFF(CURDATE(),

                CASE

                    WHEN MONTH(CURDATE()) < 4 THEN DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 YEAR), '%Y-04-01')

                    ELSE DATE_FORMAT(CURDATE(), '%Y-04-01')

                END

            ) / 7

        ) + 1 AS Number_Of_Sundays_Till_PresentDay

    FROM

        CONN_ENT.TARGET_SALES_DATA ts

    LEFT JOIN

        CONN_ENT.ACTUAL_SALES_VW st

    ON

        LTRIM(RTRIM(st.ORGSBUCD)) = LTRIM(RTRIM(ts.SBU)) AND

        LTRIM(RTRIM(st.ORGZONECD)) = LTRIM(RTRIM(ts.ZONE)) AND

        LTRIM(RTRIM(st.ORGROCD)) = LTRIM(RTRIM(ts.REGION)) AND

        LTRIM(RTRIM(st.ORGSACD)) = LTRIM(RTRIM(ts.SA)) AND

        LTRIM(RTRIM(st.PRODUCTCODE)) = LTRIM(RTRIM(ts.PRODUCT)) AND

        st.YEARMONTH = ts.INVOICE_DT

),

AggregatedValues AS (

    -- Calculate the aggregate values

    SELECT

        ROUND(SUM(TARGET_QTY_TMT),4) AS FinalSum,        -- Total TARGET_QTY_TMT

        ROUND(SUM(NETWEIGHT_TMT),4) AS FinalActualSum,   -- Total NETWEIGHT_TMT

        MAX(Total_Days_Till_PresentDay) AS MaxTotalDaysTillPresentDay,  -- Max Total Days till Present Day

        MAX(Number_Of_Sundays_Till_PresentDay) AS MaxNumberOfSundaysTillPresentDay, -- Max Number of Sundays till Present Day



        -- Calculate Working Days till Present Day (Excluding Sundays)

        MAX(Total_Days_Till_PresentDay) - MAX(Number_Of_Sundays_Till_PresentDay) AS Working_Days_Till_PresentDay_WithoutSundays,



        -- Calculate the Total_Days_in_FY based on whether the fiscal year starts on Sunday

        CASE

            WHEN DAYOFWEEK(

                CASE

                    WHEN MONTH(CURDATE()) < 4 THEN DATE_FORMAT(CURDATE(), '%Y-04-01')

                    ELSE DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 YEAR), '%Y-04-01')

                END

            ) = 1 THEN 365 - 53  -- Start of FY is Sunday

            ELSE 365 - 52         -- Start of FY is not Sunday

        END AS Total_Days_in_FY,



        -- Calculate Pending Days as Total Days in Fiscal Year - Working Days till Present Day without Sundays

        (365 - 52) - (MAX(Total_Days_Till_PresentDay) - MAX(Number_Of_Sundays_Till_PresentDay)) AS Pending_Days

    FROM

        PendingDaysData

),

FinalCalculation AS (

    -- Calculate the required metrics

    SELECT

        FinalSum,

        FinalActualSum,

        MAX(Pending_Days) as MaxPendingDays,

        Working_Days_Till_PresentDay_WithoutSundays,

        Total_Days_in_FY,

        Pending_Days,



        -- Calculate req_sum

        (FinalSum - FinalActualSum) / MaxPendingDays AS Rate_Per_Day_Required_MMT,



        -- Calculate Rate_per_day_current_MMT

        CASE

            WHEN (FinalActualSum / Working_Days_Till_PresentDay_WithoutSundays) < 10 THEN

                ROUND(FinalActualSum / Working_Days_Till_PresentDay_WithoutSundays, 2)

            ELSE

                ROUND(FinalActualSum / Working_Days_Till_PresentDay_WithoutSundays, 0)

        END AS Rate_Per_Day_Current_MMT

    FROM

        AggregatedValues

)

SELECT

    pd.*,ROUND(pd.TARGET_QTY_TMT,2) AS TARGET_ROUND,ROUND(pd.NETWEIGHT_TMT,2) AS Actual_ROUND,

    fc.FinalSum,

    fc.FinalActualSum,

    fc.MaxPendingDays,

    fc.Working_Days_Till_PresentDay_WithoutSundays,

    fc.Rate_Per_Day_Required_MMT,

    fc.Rate_per_day_current_MMT,

    fc.Total_Days_in_FY,  -- Added column for total days in FY

    fc.Pending_Days,      -- Added column for pending days



    -- Extract month_year as integer

    CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) AS month_year,



    -- Map month_year to full month name

    CASE

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 1 THEN 'January'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 2 THEN 'February'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 3 THEN 'March'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 4 THEN 'April'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 5 THEN 'May'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 6 THEN 'June'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 7 THEN 'July'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 8 THEN 'August'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 9 THEN 'September'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 10 THEN 'October'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 11 THEN 'November'

        WHEN CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) = 12 THEN 'December'

        ELSE NULL

    END AS month_name,



    -- Map month_name to fiscal year month number

    CASE

        WHEN month_name = 'April' THEN 1

        WHEN month_name = 'May' THEN 2

        WHEN month_name = 'June' THEN 3

        WHEN month_name = 'July' THEN 4

        WHEN month_name = 'August' THEN 5

        WHEN month_name = 'September' THEN 6

        WHEN month_name = 'October' THEN 7

        WHEN month_name = 'November' THEN 8

        WHEN month_name = 'December' THEN 9

        WHEN month_name = 'January' THEN 10

        WHEN month_name = 'February' THEN 11

        WHEN month_name = 'March' THEN 12

        ELSE NULL

    END AS fy_month,



    -- Create year_monthname column

    CAST(CONCAT(LEFT(CAST(pd.INVOICE_DT AS CHAR), 4), '-', LPAD(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2), 2, '0'), '-01') AS DATE) AS year_monthname,

    CASE

        WHEN (CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) >= 4

              AND CAST(RIGHT(CAST(pd.INVOICE_DT AS CHAR), 2) AS UNSIGNED) <= MONTH(DATE_ADD(CURDATE(), INTERVAL -1 MONTH))) THEN

            pd.TARGET_QTY_TMT  -- Use the column `TARGET_QTY_TMT` for valid months

        ELSE

            NULL  -- Set to NULL if the condition is not met

    END AS Target_Quantity_TMTT

FROM

    PendingDaysData pd

CROSS JOIN

    FinalCalculation fc;


    """
    connection = get_db_connection(params)
    cursor = connection.cursor()
    get_and_insert_data(cursor, query, params=params)

