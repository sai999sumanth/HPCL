import mysql.connector
import psycopg2
import polars as pl
import sys
from decimal import Decimal
from datetime import date, datetime

sys.path.append("/opt/ceg/algo")

import orchestrator.dbconnector.credential_loader as credential_loader

TARGET_TABLE = "blend_ethonal"


# ----------------------------------------------------
# CONNECTIONS
# ----------------------------------------------------
def get_mysql_conn():
    return mysql.connector.connect(**credential_loader.get_credentials("TIBCO"))


def get_pg_conn():
    return psycopg2.connect(**credential_loader.get_credentials("APP_DB"))


# ----------------------------------------------------
# FETCH SOURCE DATA
# ----------------------------------------------------
def fetch_blend_ethonal(mysql_conn):
    query = """
        SELECT *
        FROM BITEAM.VW_EDW_SOD_BLEND_PCNTG_FACT
        WHERE MATERIAL_GRP_DESCRIPTION = 'MS'
          AND INVOICE_DATE BETWEEN '20260401' AND '20270331'
    """

    cur = mysql_conn.cursor(dictionary=True)
    cur.execute(query)
    rows = cur.fetchall()
    cur.close()

    if not rows:
        return pl.DataFrame()

    # Preserve original datatypes
    processed_rows = []
    for row in rows:
        processed_row = {}
        for k, v in row.items():
            if isinstance(v, Decimal):
                # Convert Decimal to int if it has no fractional part
                if v == v.to_integral_value():
                    processed_row[k.lower()] = int(v)
                else:
                    processed_row[k.lower()] = float(v)
            else:
                processed_row[k.lower()] = v
        processed_rows.append(processed_row)

    return pl.DataFrame(processed_rows)


# ----------------------------------------------------
# MAP POLARS TYPE TO POSTGRES TYPE
# ----------------------------------------------------
def get_pg_type(dtype):
    if dtype in [pl.Int8, pl.Int16, pl.Int32, pl.Int64]:
        return "BIGINT"

    if dtype in [pl.Float32, pl.Float64]:
        return "DOUBLE PRECISION"

    if dtype == pl.Boolean:
        return "BOOLEAN"

    if dtype == pl.Date:
        return "DATE"

    if dtype == pl.Datetime:
        return "TIMESTAMP"

    return "TEXT"


# ----------------------------------------------------
# CREATE TABLE
# ----------------------------------------------------
def create_table_if_not_exists(pg_conn, df):

    if df.is_empty():
        return

    columns = []

    for col in df.columns:
        columns.append(f'"{col}" {get_pg_type(df[col].dtype)}')

    create_query = f"""
        CREATE TABLE IF NOT EXISTS {TARGET_TABLE} (
            {",".join(columns)}
        )
    """

    with pg_conn.cursor() as cur:
        cur.execute(create_query)

    pg_conn.commit()


# ----------------------------------------------------
# TRUNCATE TABLE
# ----------------------------------------------------
def truncate_table(pg_conn):

    with pg_conn.cursor() as cur:
        cur.execute(f"TRUNCATE TABLE {TARGET_TABLE}")

    pg_conn.commit()


# ----------------------------------------------------
# INSERT DATA
# ----------------------------------------------------
def insert_data(pg_conn, df):

    if df.is_empty():
        print("No records found.")
        return

    columns = df.columns

    column_list = ",".join(f'"{c}"' for c in columns)
    placeholders = ",".join(["%s"] * len(columns))

    insert_query = f"""
        INSERT INTO {TARGET_TABLE}
        ({column_list})
        VALUES ({placeholders})
    """

    data = df.rows()

    with pg_conn.cursor() as cur:
        cur.executemany(insert_query, data)

    pg_conn.commit()

    print(f"Inserted {df.height} rows")


# ----------------------------------------------------
# MAIN SYNC
# ----------------------------------------------------
def sync_blend_ethonal():

    mysql_conn = get_mysql_conn()
    pg_conn = get_pg_conn()

    try:

        print("Fetching data...")
        df = fetch_blend_ethonal(mysql_conn)

        if df.is_empty():
            print("No data found.")
            return

        print(df.dtypes)

        print("Creating table...")
        create_table_if_not_exists(pg_conn, df)

        print("Deleting existing data...")
        truncate_table(pg_conn)

        print("Inserting fresh data...")
        insert_data(pg_conn, df)

        print("Blend Ethonal Sync Completed Successfully.")

    except Exception as e:
        pg_conn.rollback()
        print(e)
        raise

    finally:
        mysql_conn.close()
        pg_conn.close()


if __name__ == "__main__":
    sync_blend_ethonal()