import urdhva_base
import os
import sys
import psycopg2
import datetime
import numpy as np
import polars as pl
import pandas as pd
sys.path.append("/opt/ceg/algo")
import orchestrator.dbconnector.credential_loader as credential_loader

logger = urdhva_base.logger.Logger.getInstance("offline_permanent_closed")


def fetch_data(cursor, query, getData=False, params=None):
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
        return data
    if params:
        pg_conn.commit()
        cursor.close()
        pg_conn.close()


def insertToDB(data, table_name, indexing_col=(), schema_name="HPCL_HOS"):
    data = pl.from_pandas(data)
    print("-"*50)
    print(f"-- Inserting Data to {schema_name}.{table_name} --")
    print("Length of Data :", len(data))
    creds = credential_loader.get_credentials('APP_DB')
    pg_conn = psycopg2.connect(
                host=creds['host'],
                database=creds['database'],
                user=creds['user'],
                password=creds['password'],
                port=creds['port']
            )
    cur = pg_conn.cursor()

    # ensure schema exists
    cur.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}";')

    dtype_dict = {
        'String':str('text'),'Int64': str('bigint'), 'Int32': str('bigint'), 
        'Boolean': str('text'), 'Float64': str('double precision'),
        'Float32': str('double precision'),'Object': str('text'), 
        'Datetime': str('timestamp'), 'Utf8': str('text'),"dtype('O')": str('text'), 
        "Datetime(time_unit='us', time_zone=None)": str('timestamp'), 
        "Datetime(time_unit='ns', time_zone=None)":str('timestamp'), 
        "Decimal(precision=5, scale=2)": str('double precision')
        }
    col_dtype = {col: data[col].dtype for col in data.columns}
    table_create_sql = ""
    for col, dty in col_dtype.items():
        dty = dtype_dict.get(str(dty), str('text'))
        table_create_sql += f'"{col}" {dty},'
    table_create_sql = table_create_sql[:-1]
        
    columns_formatted = ", ".join(f'"{col}"' for col in indexing_col)
    create_table_index = f"""CREATE INDEX IF NOT EXISTS "{table_name}_index" ON "{schema_name}"."{table_name}" ({columns_formatted})"""
    
    print("table_create_sql :",table_create_sql)
    table_create_sql = f'CREATE TABLE IF NOT EXISTS "{schema_name}"."{table_name}" ({table_create_sql})'
        
    cur.execute(table_create_sql)
    pg_conn.commit()
    cur.execute(create_table_index)

    sql = f"""SELECT * FROM "{schema_name}"."{table_name}" LIMIT 1"""
    cur.execute(sql)
    column_names = [desc[0] for desc in cur.description]
    columns=[]
    for i in column_names:
        columns.append(i)
    data = data.select(columns)

    try:
        query = f'''
        COPY "{schema_name}"."{table_name}"
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
        print(f"-- Data has been inserted to {schema_name}.{table_name} --")
    except Exception as e:
        logger.error(f"-- Failed to insert data into {schema_name}.{table_name} --")
        print("Error :", str(e))
        raise Exception(e)


def sync_data(table_name):
    query = f"""SELECT erp_code AS sap_id, enable FROM "HPCL_HOS".ms_site WHERE enable='false'"""
    creds = credential_loader.get_credentials('CRIS')
    params = {
            "host": creds["host"],
            "database": creds["database"],
            "user": creds["user"],
            "password": creds["password"],
            "port": creds["port"]
            }
    data = fetch_data(cursor=None, query=query, params=params, getData=True)
    data["synced_datetime"] = datetime.datetime.now()
    data = data.fillna("")
    data["sap_id"] = data["sap_id"].fillna(0).str.strip().replace('', 0).astype(np.float64).astype(int).astype(str)
    print(data)
    print(data.dtypes)

    creds = credential_loader.get_credentials('APP_DB')
    params = {
            "host": creds["host"],
            "database": creds["database"],
            "user": creds["user"],
            "password": creds["password"],
            "port": creds["port"]
            }

    # Safe truncate for HPCL_HOS schema
    try:
        query = f"""TRUNCATE "HPCL_HOS".ms_site_offline_permanent_closed"""
        fetch_data(cursor=None, query=query, params=params, getData=False)
    except Exception:
        print("-- Could not truncate --")

    insertToDB(data, table_name="ms_site_offline_permanent_closed", indexing_col=["sap_id"], schema_name="HPCL_HOS")
    print(f"-- {table_name.lower()} synced successfully --")


def main():        
    table_name = "ms_site"
    sync_data(table_name=table_name)


if __name__=="__main__":
    main()
