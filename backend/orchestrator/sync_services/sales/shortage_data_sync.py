import mysql.connector
import sys
import psycopg2
import polars as pl

sys.path.append("/opt/ceg/algo")
import orchestrator.dbconnector.credential_loader as credential_loader

# ---------- CONFIGURATION ----------
MYSQL_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "password",
    "database": "source_db",
    "port": 3306,
}

# ---------- CONFIGURATION ----------
TARGET_TABLE = "sales_trips_till_date"
CONFLICT_COLUMNS = ["invoice_no", "vehicle_id", "sap_id", "item_no", "invoice_type"]

ITEM_NAME_MAP = {
    "2812000": "HSD",
    "4210000": "EBMS 15%",
    "4383000": "EBMS 20% P95",
    "2815000": "B5 HSD",
    "2814000": "EBMS 10%",
    "4211000": "EBMS 15 % P95",
    "2813000": "EBMS 5%",
    "2820000": "B7 HSD",
    "2822000": "EBMS 20%",
    "3912000": "HSD TURBO",
    "3925000": "EBMS 12% POWER",
    "3672000": "EBMS 11% P95",
    "2946000": "BULK PROPANE",
    "2982000": "BULK BUTANE",
    "0948149": "5KG CYLINDER BLUE (NON DOM)FUL",
    "0949109": "5 KG FILLED LPG CYLINDER-DOM",
    "0949000": "BULK LPG",
    "0948064": "19 KG FILLED LPG CYLINDER",
    "0949036": "14.2 KG FILLED LPG CYLINDER"
}

# ---------- CONNECTION HELPERS ----------
def get_mysql_connection():
    return mysql.connector.connect(**credential_loader.get_credentials('TIBCO'))


def get_postgres_connection():
    return psycopg2.connect(**credential_loader.get_credentials('APP_DB'))

# ============================================================
# MYSQL FETCH (ONLY QUERY CHANGED)
# ============================================================
def fetch_mysql_data(conn, table, key_column, last_key, user_wheres=None):
    """Fetch incremental + multiple user filters OR logic"""

    base_query = """
        SELECT DISTINCT
            zinv.*,
            zsh.original_inv,
            zsh.billing_dt,
            zsh.plant,
            zsh.shortage,
            zsh.material,
            zsh.vehicle
            FROM CONN_ENT.ZSDCV_SHORTAGE_STG zsh
            INNER JOIN CONN_ENT.ZSDCV_AY_INV3_STG zinv
            ON zsh.original_inv = zinv.inv_ref
            AND zsh.material = zinv.ITEM_NO 
            WHERE
            zsh.shortage > 0
            AND zinv.load_status IN ('6', '7')
            
    """

    conditions = []
    params = []

    # Incremental only on zinv.syncdt
    if last_key is not None:
        conditions.append(f"zinv.{key_column} > %s")
        params.append(last_key)

    if conditions:
        base_query += " AND " + " AND ".join(conditions)

    cur = conn.cursor(dictionary=True)
    cur.execute(base_query, params)
    rows = cur.fetchall()
    cur.close()

    if not rows:
        return pl.DataFrame()

    all_keys = set()
    for row in rows:
        all_keys.update(row.keys())

    columns_data = {key: [] for key in all_keys}

    for row in rows:
        for key in all_keys:
            val = row.get(key)
            columns_data[key].append(str(val) if val is not None else None)

    return pl.DataFrame({k: pl.Series(v, dtype=pl.Utf8) for k, v in columns_data.items()})



# ---------- LOCATION MASTER ----------
def get_location_master_data(pg_conn):
    cur = pg_conn.cursor()
    cur.execute("""
        SELECT sap_id, name AS plant_nm, zone AS zone_nm, region, bu AS sbu_nm
        FROM location_master
    """)
    rows = cur.fetchall()
    columns = [col[0].lower() for col in cur.description]
    cur.close()
    if not rows:
        return pl.DataFrame()
    return pl.DataFrame(rows, schema=columns)


def sync_location_master(pg_conn, df: pl.DataFrame) -> pl.DataFrame:
    lm_df = get_location_master_data(pg_conn)
    if lm_df.is_empty():
        print("location_master empty, skipping enrichment.")
        return df

    if "supply_loc" in df.columns:
        df = df.with_columns(pl.col("supply_loc").cast(pl.Utf8).str.replace_all(r"^00+", ""))
    if "sap_id" in lm_df.columns:
        lm_df = lm_df.with_columns(pl.col("sap_id").cast(pl.Utf8).str.replace_all(r"^00+", ""))

    if "supply_loc" in df.columns:
        df = df.join(lm_df, left_on="supply_loc", right_on="sap_id", how="left")
        df = df.rename({"supply_loc": "sap_id"})
        print(f"Enriched with location_master → total rows: {df.height}")

    return df


# ---------- ENRICHMENT ----------
def enrich_data(pg_conn, df: pl.DataFrame) -> pl.DataFrame:
    df.columns = [col.lower() for col in df.columns]
    # If invoice table column exists → remove it
    if "qty_shortage" in df.columns:
        df = df.drop("qty_shortage")

    # Rename shortage → qty_shortage
    if "shortage" in df.columns:
        df = df.rename({"shortage": "qty_shortage"})
    # Clean sold_to_party (remove starting 'P')
    if "sold_to_party" in df.columns:
        df = df.with_columns(
            pl.when(pl.col("sold_to_party").cast(pl.Utf8).str.to_uppercase().str.starts_with("P"))
            .then(pl.col("sold_to_party").str.slice(1))
            .otherwise(pl.col("sold_to_party"))
            .alias("sold_to_party")
        )


    if "material" in df.columns:
        df = df.drop("item_no") if "item_no" in df.columns else df
        df = df.rename({"material": "item_no"})

    df = sync_location_master(pg_conn, df)

    if "ship_to_party" in df.columns:
        df = df.with_columns(
            pl.when(pl.col("ship_to_party").cast(pl.Utf8).str.starts_with("P"))
            .then(pl.col("ship_to_party").str.slice(1))
            .when(pl.col("ship_to_party").cast(pl.Utf8).str.starts_with("00"))
            .then(pl.col("ship_to_party").str.slice(2))
            .otherwise(pl.col("ship_to_party"))
            .alias("destination_code")
        )
        df = df.drop("ship_to_party")

    # SAME OLD MATERIAL GROUP LOGIC
    if any(c.lower() == "item_no" for c in df.columns):
        item_col = next(c for c in df.columns if c.lower() == "item_no")

        df = df.with_columns(
            pl.col(item_col)
            .cast(pl.Utf8)
            .str.strip_chars()
            .replace(ITEM_NAME_MAP)
            .alias("material_group_nm")
        )
        print(" Added 'material_group_nm' column based on item_no mapping")
    else:
        print(" 'item_no' column not found — skipping material_group_nm mapping")
    return df



# ---------- POSTGRES SCHEMA ----------
def ensure_postgres_columns(pg_conn, df: pl.DataFrame, table: str):
    with pg_conn.cursor() as cur:
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = %s
        """, (table,))
        existing = {r[0] for r in cur.fetchall()}

        if not existing:
            cols = ", ".join(f'"{c}" TEXT' for c in df.columns)
            cur.execute(f'CREATE TABLE {table} ({cols});')
            pg_conn.commit()
            return

        for c in df.columns:
            if c not in existing:
                cur.execute(f'ALTER TABLE {table} ADD COLUMN "{c}" TEXT;')

    pg_conn.commit()
    
def map_polars_dtype_to_pg(dtype) -> str:
    """Convert Polars dtype to Postgres"""
    if dtype in (pl.Int8, pl.Int16, pl.Int32, pl.Int64):
        return "BIGINT"
    elif dtype in (pl.Float32, pl.Float64):
        return "DOUBLE PRECISION"
    elif dtype == pl.Utf8:
        return "TEXT"
    elif dtype == pl.Boolean:
        return "BOOLEAN"
    elif dtype in (pl.Datetime, pl.Date):
        return "TIMESTAMP"
    else:
        return "TEXT"


# ---------- UNIQUE CONSTRAINT ----------
def ensure_unique_constraint(pg_conn, table: str):
    constraint_name = f"{table}_uniq"
    joined_cols = ", ".join(f'"{c}"' for c in CONFLICT_COLUMNS)

    with pg_conn.cursor() as cur:
        cur.execute("""
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = %s
              AND constraint_type = 'UNIQUE'
        """, (table,))
        existing = [r[0] for r in cur.fetchall()]

        if constraint_name not in existing:
            cur.execute(f'ALTER TABLE {table} ADD CONSTRAINT {constraint_name} UNIQUE ({joined_cols});')
            pg_conn.commit()
            
def log_conflicts(df, pg_conn, table, conflict_columns):
    """
    Identify rows in df that already exist in Postgres based on conflict columns.
    Write them into CSV so we know what was dropped during upsert.
    """
    cols = ",".join(f'"{c}"' for c in conflict_columns)

    sql = f"""
    SELECT {cols}
    FROM {table}
    """

    try:
        existing_df = pl.read_database(sql, connection=pg_conn)
    except Exception as e:
        print(f"Could not read existing data for conflict check: {e}")
        return

    # Normalize column names
    # df_norm = df.rename({c: c.lower() for c in df.columns})
    # existing_norm = existing_df.rename({c: c.lower() for c in existing_df.columns})
    df_norm = df.rename({c: c.lower() for c in df.columns})
    existing_norm = existing_df.rename({c: c.lower() for c in existing_df.columns})

    # Convert all join keys to strings to avoid NULL vs STRING errors
    for col in conflict_columns:
        df_norm = df_norm.with_columns(pl.col(col.lower()).cast(pl.Utf8))
        existing_norm = existing_norm.with_columns(
            pl.col(col.lower()).cast(pl.Utf8).fill_null("")
    )

    join_cols = [c.lower() for c in conflict_columns]

    # Inner join to find duplicates
    dup = df_norm.join(existing_norm, on=join_cols, how="inner")

    if dup.is_empty():
        print("No conflicting rows found.")
        return

    print(f"Found {dup.height} conflicting rows. Writing to CSV...")

    # dup.write_csv("/opt/ceg/algo/conflict_dropped_records.csv")
    # print("Saved duplicate rows → /tmp/conflict_dropped_records.csv")


# ---------- UPSERT ----------
def upsert_postgres(pg_conn, df: pl.DataFrame, table: str):
    if df.is_empty():
        print("No data to sync.")
        return

    ensure_unique_constraint(pg_conn, table)

    cols = df.columns
    col_sql = ",".join(f'"{c}"' for c in cols)
    placeholders = ",".join(["%s"] * len(cols))
    conflict_cols = ",".join(f'"{c}"' for c in CONFLICT_COLUMNS)
    update_clause = ",".join(
        [f'"{c}" = EXCLUDED."{c}"' for c in cols if c not in CONFLICT_COLUMNS]
    )

    sql = f"""
        INSERT INTO {table} ({col_sql})
        VALUES ({placeholders})
        ON CONFLICT ({conflict_cols})
        DO UPDATE SET {update_clause};
    """

    data = [tuple(row) for row in df.to_numpy()]

    with pg_conn.cursor() as cur:
        cur.executemany(sql, data)

    pg_conn.commit()
    print(f"Upserted {df.height} rows into {table}.")

def get_last_sync_key(pg_conn, table, key_column):
    try:
        with pg_conn.cursor() as cur:
            cur.execute(f'SELECT MAX({key_column}::DATE) FROM "{table}"')
            result = cur.fetchone()
            return result[0] if result and result[0] is not None else None
    except psycopg2.errors.UndefinedTable:
        pg_conn.rollback()
        print(f"Table '{table}' does not exist yet. Skipping incremental check.")
        return None
# ============================================================
# MAIN
# ============================================================
def sync_data():
    mysql_conn = get_mysql_connection()
    pg_conn = get_postgres_connection()

    try:
        last_key = get_last_sync_key(pg_conn, TARGET_TABLE, "syncdt")

        df = fetch_mysql_data(
            mysql_conn,
            "CONN_ENT.ZSDCV_AY_INV3_STG",   # table not used but keep structure
            "syncdt",
            last_key,
            user_wheres=None
        )

        if df.is_empty():
            print("No data fetched.")
            return

        df = enrich_data(pg_conn, df)
        ensure_postgres_columns(pg_conn, df, TARGET_TABLE)
        upsert_postgres(pg_conn, df, TARGET_TABLE)

        print(f"Sync completed → {df.height} rows")

    finally:
        mysql_conn.close()
        pg_conn.close()


if __name__ == "__main__":
    sync_data()
