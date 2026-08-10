import os
import uuid
import psycopg2
import hashlib
import polars as pl
import urdhva_base
import sys
import mysql.connector
import pandas as pd
import time
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
from psycopg2.extras import execute_values

sys.path.append("/opt/ceg/algo")
import orchestrator.dbconnector.credential_loader as credential_loader

logger = urdhva_base.logger.Logger.getInstance('vts_sync_log')


# ---------------- Database Connections ----------------
def get_db_connection(params):
    """Establish connection based on connection_type"""
    if params["connection_type"].lower() == "postgres":
        return psycopg2.connect(
            host=params["host"],
            database=params["database"],
            user=params["user"],
            password=params["password"],
            port=params["port"]
        )
    elif params["connection_type"].lower() == "mssql":
        return mysql.connector.connect(
            host=params["host"],
            user=params["user"],
            passwd=params["password"],
            port=params["port"],
            database=params["database"]
        )


# ---------------- Create Table ----------------
def create_table_from_source(pg_conn, data, table_name):
    """Create Postgres table dynamically from Polars dataframe schema"""
    if data.is_empty():
        print("No data available to infer schema.")
        return
    cur = pg_conn.cursor()
    cols = []
    for name, dtype in data.schema.items():
        if dtype == pl.Utf8:
            sql_type = "TEXT"
        elif dtype in [pl.Int64, pl.Int32]:
            sql_type = "BIGINT"
        elif dtype in [pl.Float64, pl.Float32]:
            sql_type = "DOUBLE PRECISION"
        elif dtype == pl.Boolean:
            sql_type = "BOOLEAN"
        elif dtype in [pl.Datetime, pl.Date]:
            sql_type = "TIMESTAMP"
        else:
            sql_type = "TEXT"
        cols.append(f'"{name.lower()}" {sql_type}')
    create_sql = f'CREATE TABLE IF NOT EXISTS "{table_name}" ({", ".join(cols)});'
    cur.execute(create_sql)
    pg_conn.commit()
    cur.close()
    print(f"Created table '{table_name}' with {len(cols)} columns.")


# ---------------- Insert Data ----------------
def insert_to_db(pg_conn, data, table_name, chunk_size=50000):
    """Efficient batch insert from Polars → Postgres"""
    if data.is_empty():
        print("-- No rows to insert --")
        return
    cur = pg_conn.cursor()
    data = data.rename({col: col.lower() for col in data.columns})
    cols = list(data.columns)
    col_names = ','.join(f'"{c}"' for c in cols)
    insert_sql = f'INSERT INTO "{table_name}" ({col_names}) VALUES %s;'
    for i in range(0, len(data), chunk_size):
        chunk = data[i:i + chunk_size].to_pandas()
        #  Fix NaT values for timestamps
        chunk = chunk.replace({pd.NaT: None})
        values = [tuple(row) for row in chunk.to_numpy()]
        execute_values(cur, insert_sql, values)
        pg_conn.commit()
        print(f"Inserted rows {i} - {i + len(chunk)}")
    cur.close()
    print(f"Insert complete for table '{table_name}'.")


# ---------------- Sync Logic ----------------
def sync_table(source_table, target_table):
    print("\nStarting sync for ZSDCV_TRUCK_STG + ZSDCV_TRANSP_STG → Postgres")

    # Load DB credentials
    source_creds = credential_loader.get_credentials('TIBCO')
    pg_creds = credential_loader.get_credentials('APP_DB')

    # Connect to Source (MySQL)
    source_conn = get_db_connection({
        "host": source_creds['host'],
        "database": source_creds['database'],
        "user": source_creds['user'],
        "password": source_creds['password'],
        "port": source_creds['port'],
        "connection_type": "mssql"
    })
    source_cursor = source_conn.cursor()

    # Connect to Postgres
    pg_conn = get_db_connection({
        "host": pg_creds['host'],
        "database": pg_creds['database'],
        "user": pg_creds['user'],
        "password": pg_creds['password'],
        "port": pg_creds['port'],
        "connection_type": "postgres"
    })

    # ---------- STEP 1: Fetch Both Source Tables ----------
    print("Fetching source tables from MySQL...")

    source_cursor.execute("SELECT * FROM CONN_ENT.ZSDCV_TRANSP_STG")
    df_transp = pd.DataFrame(source_cursor.fetchall(), columns=[c[0].lower() for c in source_cursor.description])
    df_transp = pl.from_pandas(df_transp)

    source_cursor.execute("SELECT * FROM CONN_ENT.ZSDCV_TRUCK_STG")
    df_truck = pd.DataFrame(source_cursor.fetchall(), columns=[c[0].lower() for c in source_cursor.description])
    df_truck = pl.from_pandas(df_truck)

    print(f"Fetched {len(df_transp)} rows from TRANSP_STG, {len(df_truck)} from TRUCK_STG")

    # ---------- STEP 2: Clean Join Keys Before Merge ----------
    print("Cleaning join keys before merging...")
    if "transporter_code" in df_truck.columns:
        df_truck = df_truck.with_columns(pl.col("transporter_code").cast(pl.Utf8).str.replace_all(r"^00+", ""))
    if "transporter_code" in df_transp.columns:
        df_transp = df_transp.with_columns(pl.col("transporter_code").cast(pl.Utf8).str.replace_all(r"^00+", ""))

    # Remove exact duplicates (same transporter_code + transporter_name)
    df_transp = df_transp.unique(subset=["transporter_code", "transporter_name"])

    # ---------- STEP 3: Merge on transporter_code ----------
    print("Merging truck + transp data...")
    if "transporter_code" in df_truck.columns and "transporter_code" in df_transp.columns:
        merged_df = df_truck.join(
            df_transp.select(["transporter_code", "transporter_name"]),
            on="transporter_code",
            how="left"
        )
    else:
        raise ValueError("Column 'transporter_code' missing in one of the source tables")

    print(f"Merged records: {len(merged_df)}")

    # ---------- STEP 4: Fetch Location Master ----------
    print("Fetching location_master from Postgres...")
    loc_cur = pg_conn.cursor()
    loc_cur.execute("SELECT sap_id, name AS location_name, bu, region, zone FROM location_master")
    loc_df = pd.DataFrame(loc_cur.fetchall(), columns=[c[0].lower() for c in loc_cur.description])
    loc_cur.close()
    df_location = pl.from_pandas(loc_df)
    print(f"Loaded {len(df_location)} records from location_master")

    # ---------- STEP 5: Clean Plant Keys Before Merge ----------
    if "supplying_plant" in merged_df.columns:
        merged_df = merged_df.rename({"supplying_plant": "sap_id"})
        merged_df = merged_df.with_columns(pl.col("sap_id").cast(pl.Utf8).str.replace_all(r"^00+", ""))
    if "sap_id" in df_location.columns:
        df_location = df_location.with_columns(pl.col("sap_id").cast(pl.Utf8).str.replace_all(r"^00+", ""))

    # ---------- STEP 6: Merge with location_master ----------
    print("Merging with location_master (on sap_id)...")
    if "sap_id" in merged_df.columns:
        merged_df = merged_df.join(
            df_location,
            on="sap_id",
            how="left"
        )
    else:
        raise ValueError("Column 'sap_id' not found in merged_df")

    print(f"Final merged records: {len(merged_df)}")

    # ---------- STEP 7: Drop + Recreate Target Table ----------
    target_table = "vts_truck_master"
    cur = pg_conn.cursor()
    cur.execute(f'DROP TABLE IF EXISTS "{target_table}" CASCADE;')
    pg_conn.commit()
    cur.close()

    create_table_from_source(pg_conn, merged_df, target_table)
    insert_to_db(pg_conn, merged_df, target_table)

    print(f"\n Sync complete! Final table: {target_table}, total rows: {len(merged_df)}")

    # ---------- STEP 8: Close Connections ----------
    source_cursor.close()
    source_conn.close()
    pg_conn.close()


if __name__ == "__main__":
    print("Starting sync script...")
    sync_table("CONN_ENT.ZSDCV_TRANSP_STG", "zsdcv_transp_stg")
