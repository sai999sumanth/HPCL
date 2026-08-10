import urdhva_base
import os
import sys
import pyodbc
import psycopg2
import datetime
import pandas as pd
import polars as pl
sys.path.append("/opt/ceg/algo")
from dateutil.relativedelta import relativedelta
import orchestrator.dbconnector.credential_loader as credential_loader

logger = urdhva_base.logger.Logger.getInstance("cdcms_data_sync_log")

def get_db_connection():
    """
    Establish a database connection
    Args:
        connection_string (str): Database connection string
    Returns:
        pyodbc connection
    """
    creds = credential_loader.get_credentials('VTS_TRACK_DB')
    connection = pyodbc.connect(
        (
            "DRIVER={ODBC Driver 18 for SQL Server};"
            f"Server={creds['host']},{creds['port']};"
            f"Database={creds['database']};"
            f"UID={creds['user']};"
            f"PWD={creds['password']};"
            "TrustServerCertificate=yes;"
            "MARS_Connection=yes;"
        )
    )
    return connection


def fetch_data(cursor, query, getData=False, params=None):
    """
    Fetch data from database using a SQL query
    Args:
        cursor (pyodbc cursor): Database cursor
        query (str): SQL query to execute
    Returns:
        pandas DataFrame
    """
    if params:
        pg_conn = psycopg2.connect(
                host=params["host"],
                database=params["database"],
                user=params["user"],
                password=params["password"],
                port=params["port"]
            )
        cursor = pg_conn.cursor()
        
    print("-" * 50)
    print("query -->", query)
    print("-" * 50)
    print("Running Query ...")
    cursor.execute(query)
    if getData:
        data = cursor.fetchall()
        print('Total Records :', len(data))
        columns = [column[0] for column in cursor.description]
        data = pd.DataFrame.from_records(data, columns=columns)
        data = pl.from_pandas(data)
        return data
    if params:
        pg_conn.commit()
        cursor.close()
        pg_conn.close()

def insertToDB(data, table_name, indexing_col=()):
    print("-"*50)
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
    dtype_dict = {
        'String':str('text'),'Int64': str('bigint'), 'Int32': str('bigint'), 
        'Boolean': str('text'), 'Float64': str('double precision'),
        'Float32': str('double precision'),'Object': str('text'), 
        'Datetime': str('timestamp'), 'Utf8': str('text'), 
        "Datetime(time_unit='us', time_zone=None)": str('timestamp'), 
        "Datetime(time_unit='ns', time_zone=None)":str('timestamp'), 
        "Decimal(precision=5, scale=2)": str('double precision')
        }
    col_dtype = {col: data[col].dtype for col in data.columns}
    for col, dty in col_dtype.items():
        dty = dtype_dict.get(str(dty))
        table_create_sql += f'"{col}" {dty},'
    table_create_sql = table_create_sql[:-1]
        
    columns_formatted = ", ".join(f'"{col}"' for col in indexing_col)
    create_table_index = f"""CREATE INDEX IF NOT EXISTS "{table_name}_index" ON "{table_name}" ({columns_formatted})"""
    
    table_create_sql = f'CREATE TABLE IF NOT EXISTS "{table_name}" ({table_create_sql})'
        
    cur.execute(table_create_sql)
    pg_conn.commit()
    cur.execute(create_table_index)

    sql = f"""SELECT * FROM "{table_name}" LIMIT 1"""
    cur.execute(sql)
    db_column_names = [desc[0] for desc in cur.description]

    # This handles cases where extra columns were added to the DB table manually
    columns = [col for col in db_column_names if col in data.columns]
    missing_in_data = [col for col in db_column_names if col not in data.columns]
    if missing_in_data:
        print(f"Columns in DB but not in incoming data (will be NULL): {missing_in_data}")

    data = data.select(columns)
    try:
        # Explicitly list columns in COPY so PostgreSQL skips the extra DB columns
        
        copy_columns_formatted = ", ".join(f'"{col}"' for col in columns)
        query = f'''
        COPY "{table_name}" ({copy_columns_formatted})
        FROM STDIN
        CSV HEADER DELIMITER '~';
        '''
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
        logger.error(f"-- Failed to inserted data into {table_name} --")
        print("Error :", str(e))
        raise Exception(e)

def get_ongoing_trip_data(table_name, params, max_date=None, master_data=pl.DataFrame()):
    _datecol = "EVENT_DATE"
    if table_name in ["TripAuditMaster"]:
        _datecol = "createdAt"
    
    if table_name in ["COMPLETED_TRIP"]:
        _datecol = "insert_datetime"

    if not max_date:
        max_date = f""" select max({_datecol}) as max_date from vts_{table_name.lower()} """
        cursor = None
        data = fetch_data(cursor, max_date, getData=True, params=params)
        
        if not data.is_empty():
            max_date = str(data["max_date"][0])
        else:
            max_date = (datetime.datetime.now() - relativedelta(days=10)).strftime("%Y-%m-%d")

    connection = get_db_connection()
    cursor = connection.cursor()        
    
    query = f""" SELECT * FROM {table_name} WHERE CAST({_datecol} AS DATE) > '{max_date}';"""
    data = fetch_data(cursor, query, getData=True)
    data = data.rename({col: col.lower() for col in data.columns})
    
    for col in ["location", "terminalcode"]:
        if col in data.columns:
            data = data.rename({col: "sap_id"})
    
    rename_mapper = {
        "vehicle_rto_no": "tt_number",
        "challan_no": "invoice_no",
        "depot_erp_code": "sap_id",
        "erp_transporter_code": "transporter_code"
     }
    data = data.rename({key: value for key, value in rename_mapper.items() if key in data.columns})
        
    for col in ["name", "zone", "region"]:
        if col in data.columns:
            data = data.drop(col)
    
    for col in ["route_id", "sec_route_id"]:
        if col in data.columns:
            data = data.with_columns(pl.col(col).fill_null(0).cast(pl.Float64).cast(pl.Int64).alias(col))

    print("Before Location Master Mappings :",len(data))
    if not master_data.is_empty():
        data = data.join(
            master_data.select(["bu", "sap_id", "name", "zone", "region"]), on="sap_id", how="left"
        )
    print("After Location Master Mappings :",len(data))

    # data = data.rename({"name": "location_name"})
    if "name" in data.columns and "location_name" not in data.columns:
        data = data.rename({"name": "location_name"})
    elif "name" in data.columns and "location_name" in data.columns:
        data = data.drop("name")

    print(data)
    print(data.columns)
    
    for col in data.columns:
        if data[col].dtype in [pl.Float64, pl.Float32]:
            data = data.with_columns(pl.col(col).round(0).cast(pl.Int64).alias(col))

    insertToDB(data, f"vts_{table_name.lower()}", indexing_col=["sap_id"])
    print(f"-- vts_{table_name.lower()} synced successfully --")

def main():
    creds = credential_loader.get_credentials('APP_DB')
    params = {
            "host": creds["host"],
            "database": creds["database"],
            "user": creds["user"],
            "password": creds["password"],
            "port": creds["port"]
            }
    query = f""" select * from location_master where bu in ('TAS', 'LPG') """
    master_data = fetch_data(None, query, getData=True, params=params)
    
    for table_name in ["DEVICE_REMOVED", "HARSH_ACCELERATION", 
                       "HARSH_BRAKING", "PANIC", "TripAuditMaster", "COMPLETED_TRIP",
                       "ROUTE_DEVIATION", "STOPPAGE_VIOLATION",  "POWER_DISCONNECT"]:
        get_ongoing_trip_data(table_name=table_name, params=params, max_date=None, master_data=master_data)


if __name__=="__main__":
    main()