"""
Daily LPG **event_log** and **production_log** sync with ID-based reconciliation.

Runs from any working directory: resolves ``LPG_PLANTS_CREDENTIALS.csv`` next to this
package unless ``LPG_PLANTS_CREDENTIALS_PATH`` is set.

Strategy (per plant, per log type, per calendar day window):

1. Load **all rows for that day** from the plant server (same tables as legacy sync).
2. Load **all rows for that day** already present in APP_DB for that ``sap_id``.
3. Compare on natural keys ``event_log_id`` / ``production_log_id``.
4. **INSERT** only server rows whose IDs are missing in APP_DB (no duplicate re-inserts).
5. Optionally **DELETE duplicate** rows in APP_DB (same id + sap_id + day), keeping one row.

This avoids gaps and duplicates caused by incremental ``last_extracted_date`` windows and
overlapping runs.

Environment:

* ``LPG_PLANTS_CREDENTIALS_PATH`` — optional override for the plants CSV.
* ``LPG_SYNC_DATE`` — optional ``YYYY-MM-DD`` (default: **today** in ``LPG_SYNC_TZ``).
* ``LPG_SYNC_TZ`` — optional IANA timezone name (default ``Asia/Kolkata``) used to pick
  **today** when ``LPG_SYNC_DATE`` is unset.
* ``LPG_DEDUPE_APP_DB`` — if ``1``/``true``, run duplicate cleanup on APP_DB after inserts.
* ``LPG_MAX_WORKERS`` — thread pool size (default ``5``).

**APP_DB (required):** ``credential_loader`` must resolve ``APP_DB`` so extraction
tables and ``event_log`` / ``production_log`` can be created and written. Plant DB
access uses the plants CSV (same as legacy sync).

Usage::

    python -m orchestrator.sync_services.lpg.lpg_log_daily_reconcilisation_sync
"""
from __future__ import annotations

import concurrent.futures
import datetime as dt
import json
import os
import sys
import socket
import tempfile
import traceback
import uuid
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional
import time
import mysql.connector
import pandas as pd
import polars as pl
import psycopg2
import urdhva_base
from zoneinfo import ZoneInfo

import orchestrator.dbconnector.credential_loader as credential_loader

logger = urdhva_base.logger.Logger.getInstance("lpg_log_daily_reconciliation_sync")

# --- constants matching legacy sync ---
EVENT_PG_TABLE = "event_log"
EVENT_MYSQL_TABLE = "gd_pt_data"
PROD_PG_TABLE = "production_log"
PROD_MYSQL_TABLE = "production_data"

EVENT_ID_COL = "event_log_id"
PROD_ID_COL = "production_log_id"

TABLE_EXTRACTION_EVENT = "lpg_eventlog_extraction_log"
TABLE_EXTRACTION_PRODUCTION = "lpg_plant_extraction_log"
ExtractionKind = Literal["event", "production"]

_EXTRACTION_TABLE: Dict[ExtractionKind, str] = {
    "event": TABLE_EXTRACTION_EVENT,
    "production": TABLE_EXTRACTION_PRODUCTION,
}

_DTYPE_MAP = {
    "String": "text",
    "Int64": "bigint",
    "Int32": "bigint",
    "Boolean": "text",
    "Float64": "double precision",
    "Float32": "double precision",
    "Object": "text",
    "Datetime": "timestamp",
    "Date": "date",
    "Utf8": "text",
    "Datetime(time_unit='us', time_zone=None)": "timestamp",
    "Datetime(time_unit='ns', time_zone=None)": "timestamp",
}


def _resolve_plants_csv_path() -> Path:
    # /opt/ceg/algo/orchestrator/sync_services/lpg/LPG_PLANTS_CREDENTIALS.csv
    file_path = os.path.join(os.path.dirname(credential_loader.__file__), "..", "sync_services",
                             "lpg", "LPG_PLANTS_CREDENTIALS.csv").strip()
    return Path(file_path).expanduser().resolve()


def _sync_date_from_env() -> dt.date:
    raw = os.environ.get("LPG_SYNC_DATE", "").strip()
    if raw:
        return dt.date.fromisoformat(raw)
    tz_name = os.environ.get("LPG_SYNC_TZ", "Asia/Kolkata")
    return dt.datetime.now(ZoneInfo(tz_name)).date()


def _plant_params_from_row(plant: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "PlantName": plant["PlantName"],
        "host": plant["host_ip"],
        "database": plant["db_database"],
        "user": plant["db_user"],
        "password": plant["db_password"],
        "port": plant["port"],
        "db_type": plant["db_type"],
        "sap_id": plant["erp_id"],
    }


def _source_table(db_type: str, kind: str) -> str:
    is_mysql = str(db_type).lower() == "mysql"
    if kind == "event":
        return EVENT_MYSQL_TABLE if is_mysql else EVENT_PG_TABLE
    return PROD_MYSQL_TABLE if is_mysql else PROD_PG_TABLE


def _build_server_day_query(source_table: str, sync_date: dt.date, db_type: str) -> str:
    """Entire calendar day: match ``DATE(process_date)`` to avoid timezone window bugs."""
    d = sync_date.strftime("%Y-%m-%d")
    if str(db_type).lower() == "mysql":
        return f"""
            SELECT * FROM {source_table}
            WHERE DATE(process_date) = '{d}'
            ORDER BY process_date ASC
        """
    return f"""
        SELECT * FROM {source_table}
        WHERE (process_date::date) = DATE '{d}'
        ORDER BY process_date ASC
    """


def fetch_data(
    query: str,
    *,
    getData: bool = False,
    params: Optional[Dict[str, Any]] = None,
    timeout: int = 10,
    query_timeout: int = 30,
    chunk_size: int = 50000,
):
    """
    Fetch from plant MySQL or PostgreSQL (same behavior as ``event_log_sync.fetch_data``):
    socket pre-check, connection timeouts, optional chunked ``LIMIT/OFFSET`` for large reads.
    """
    if params is None:
        return pl.DataFrame() if getData else None
    print("\n" + "-"*50)
    query = query.replace(";", "")
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        result = sock.connect_ex((params["host"], int(params["port"])))
        if not result == 0:
            logger.error(
                "Connection timed out to %s:%s after %ss",
                params["host"],
                params["port"],
                timeout,
            )
            print(
                f"Connection timed out to {params['host']}:{params['port']} after {timeout} seconds"
            )
            return pl.DataFrame() if getData else None
    except Exception as e:
        logger.error("Socket connection error: %s", e)
        print(f"Socket connection error: {str(e)}")
        return pl.DataFrame() if getData else None
    finally:
        sock.close()

    try:
        if str(params.get("db_type", "")).lower() == "mysql":
            pg_conn = mysql.connector.connect(
                host=params["host"],
                database=params["database"],
                user=params["user"],
                password=params["password"],
                port=int(params["port"]),
                connection_timeout=timeout,
            )
            cursor = pg_conn.cursor()
            cursor.execute(
                f"SET SESSION max_execution_time = {query_timeout * 1000};"
            )
        else:
            pg_conn = psycopg2.connect(
                host=params["host"],
                database=params["database"],
                user=params["user"],
                password=params["password"],
                port=params["port"],
                connect_timeout=timeout,
            )
            pg_conn.set_session(autocommit=True)
            cursor = pg_conn.cursor()
            cursor.execute(f"SET statement_timeout = {query_timeout * 1000};")

    except Exception as e:
        logger.error(
            "Database connection error for %s: %s",
            params.get("PlantName", "unknown"),
            e,
        )
        print(
            f"Database connection error for {params.get('PlantName', 'unknown')}: {str(e)}"
        )
        return pl.DataFrame() if getData else None

    try:
        print("-" * 50)
        print(f"Running Query with {query_timeout}s timeout...")
        print(query)

        if not getData:
            cursor.execute(query)
            resp = cursor.fetchone()
            cursor.close()
            pg_conn.close()
            return resp[0] if resp else None
        if "LIMIT" not in query.upper():
            base_query = query.rstrip(";")
            base_query += f" LIMIT {chunk_size} OFFSET "
        else:
            cursor.execute(query)
            data = cursor.fetchall()
            columns = [column[0] for column in cursor.description]
            data = pd.DataFrame.from_records(data, columns=columns)
            data = pl.from_pandas(data)
            cursor.close()
            pg_conn.close()
            return data

        all_data = []
        offset = 0
        columns = []
        while True:
            chunk_query = f"{base_query} {offset};"
            cursor.execute(chunk_query)
            chunk_data = cursor.fetchall()

            if not chunk_data:
                break

            print(f"Retrieved {len(chunk_data)} records in this chunk")
            if not all_data:
                columns = [column[0] for column in cursor.description]

            all_data.extend(chunk_data)
            offset += chunk_size

            if len(chunk_data) < chunk_size:
                break

            if offset > 2000000:
                print("Reached maximum record limit (1M)")
                break

        print(f"Total Records: {len(all_data)}")
        print("-" * 50)

        if all_data:
            data = pd.DataFrame.from_records(all_data, columns=columns)
            data = pl.from_pandas(data)
            cursor.close()
            pg_conn.close()
            return data
        cursor.close()
        pg_conn.close()
        return pl.DataFrame()

    except psycopg2.errors.QueryCanceled:
        logger.error(
            "Query timed out after %s seconds - skipping this plant", query_timeout
        )
        print(f"Query timed out after {query_timeout} seconds - skipping this plant")
        cursor.close()
        pg_conn.close()
        return pl.DataFrame() if getData else None
    except Exception as e:
        logger.error("Query execution error: %s", e)
        print(f"Query execution error: {str(e)}")
        cursor.close()
        pg_conn.close()
        return pl.DataFrame() if getData else None


def fetch_app_db_day(
    table_name: str,
    sap_id: str,
    sync_date: dt.date,
) -> pl.DataFrame:
    """Rows already in APP_DB for this ``sap_id`` on ``sync_date`` (calendar day)."""
    creds = credential_loader.get_credentials("APP_DB")
    
    conn = psycopg2.connect(
        host=creds["host"],
        database=creds["database"],
        user=creds["user"],
        password=creds["password"],
        port=int(creds["port"]),
        connect_timeout=15,
    )
    try:
        cur = conn.cursor()
        q = f"""
            SELECT * FROM "{table_name}"
            WHERE sap_id = %s
              AND DATE(process_date) = %s
        """
        cur.execute(q, (sap_id, sync_date))
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        cur.close()
        if not rows:
            return pl.DataFrame()
        pdf = pd.DataFrame.from_records(rows, columns=cols)
        return pl.from_pandas(pdf)
    finally:
        conn.close()


def _enrich_server_frame(data: pl.DataFrame, params: Dict[str, Any]) -> pl.DataFrame:
    if data.is_empty():
        return data
    out = data.with_columns(pl.lit(params["PlantName"]).alias("Plant Name"))
    out = out.with_columns(pl.lit(params["sap_id"]).alias("sap_id"))
    if "process_date" in out.columns:
        out = out.with_columns(pl.col("process_date").cast(pl.Date).alias("pdate"))
    return out


def _id_set(frame: pl.DataFrame, id_col: str) -> set:
    if frame.is_empty() or id_col not in frame.columns:
        return set()
    s = (
        frame.select(pl.col(id_col))
        .drop_nulls()
        .unique()
        .to_series()
        .to_list()
    )
    return set(s)


def reconcile_missing_ids(
    server: pl.DataFrame, app: pl.DataFrame, id_col: str
) -> pl.DataFrame:
    """Return server rows whose ``id_col`` is not present in ``app`` (anti-join on id)."""
    if server.is_empty():
        return server
    if id_col not in server.columns:
        raise ValueError(f"Server data has no column {id_col!r}")
    need = _id_set(server, id_col) - _id_set(app, id_col)
    if not need:
        return server.head(0)
    return server.filter(pl.col(id_col).is_in(list(need)))


def _strip_utf8_nulls(data: pl.DataFrame) -> pl.DataFrame:
    out = data
    for col in out.columns:
        if out[col].dtype == pl.Utf8:
            out = out.with_columns(pl.col(col).str.replace_all("\x00", "").alias(col))
    return out


def copy_dataframe_to_app_table(data: pl.DataFrame, table_name: str, batch_size: int = 50_000) -> None:
    """
    CREATE TABLE IF NOT EXISTS (from frame schema) + indexes, then COPY rows in slices.
    Matches legacy ``insertToDB`` behavior without the broken ``group_by`` batching.
    """
    print("\n" + "-"*60)
    print(f"Starting data insertion into table: {table_name}")
    print("-"*60)
    if data.is_empty():
        print("No data to insert")
        logger.info("copy_dataframe_to_app_table: empty frame, skip")
        return
    print(f"Total records to insert: {len(data)}")

    data = _strip_utf8_nulls(data)
    creds = credential_loader.get_credentials("APP_DB")
    print(f"Connecting to database {creds['database']} at {creds['host']}:{creds['port']}...")
    conn = psycopg2.connect(
        host=creds["host"],
        database=creds["database"],
        user=creds["user"],
        password=creds["password"],
        port=int(creds["port"]),
        connect_timeout=30,
    )
    cur = conn.cursor()
    try:
        parts: List[str] = []
        for col in data.columns:
            dt_name = _DTYPE_MAP.get(str(data[col].dtype))
            if not dt_name:
                dt_name = "text"
            parts.append(f'"{col}" {dt_name}')
        ddl = f'CREATE TABLE IF NOT EXISTS "{table_name}" ({",".join(parts)})'
        cur.execute(ddl)
        print("Creating indexes if not exists...")
        for idx_sql in (
            f'CREATE INDEX IF NOT EXISTS "{table_name}_sap_id_index" ON "{table_name}" ("sap_id")',
            f'CREATE INDEX IF NOT EXISTS "{table_name}_pdate_index" ON "{table_name}" ("pdate")',
            f'CREATE INDEX IF NOT EXISTS "{table_name}_system_id_index" ON "{table_name}" ("system_id")',
            f'CREATE INDEX IF NOT EXISTS "{table_name}_process_id_index" ON "{table_name}" ("process_id")',
            f'CREATE INDEX IF NOT EXISTS "{table_name}_process_status_index" ON "{table_name}" ("process_status")',
            f'CREATE INDEX IF NOT EXISTS "{table_name}_cyl_type_index" ON "{table_name}" ("cyl_type")',
        ):
            try:
                cur.execute(idx_sql)
            except Exception:
                print(f"Index creation failed or already exists, continuing...")
                pass
        conn.commit()

        cur.execute(f'SELECT * FROM "{table_name}" LIMIT 1')
        existing_cols = [d[0] for d in cur.description]
        aligned = data
        for c in existing_cols:
            if c not in aligned.columns:
                aligned = aligned.with_columns(pl.lit(None).alias(c))
        aligned = aligned.select(existing_cols)

        copy_sql = f'COPY "{table_name}" FROM STDIN CSV HEADER DELIMITER \'~\''
        n = len(aligned)
        print(f"Starting batch insertion with batch size: {batch_size}")
        for start in range(0, n, batch_size):
            chunk = aligned.slice(start, min(batch_size, n - start))
            with tempfile.NamedTemporaryFile(
                mode="w+", suffix=".csv", delete=False, encoding="utf-8"
            ) as tmp:
                path = tmp.name
            try:
                chunk.write_csv(path, separator="~")
                with open(path, "r", encoding="utf-8") as fh:
                    cur.copy_expert(copy_sql, fh)
                conn.commit()
                print(f"Batch inserted successfully")
            finally:
                try:
                    os.remove(path)
                except OSError:
                    pass
        print(f"\nAll {n} records inserted successfully into {table_name}")
        logger.info('COPY completed for "%s" (%s rows)', table_name, n)
    finally:
        cur.close()
        conn.close()
        print("Connection closed.")


def dedupe_app_table_by_id(
    table_name: str,
    id_column: str,
    sap_id: str,
    sync_date: dt.date,
) -> int:
    """
    Delete duplicate rows in APP_DB, keeping one row per (id_column, sap_id) for that day.
    Returns deleted row count (best-effort).
    """
    creds = credential_loader.get_credentials("APP_DB")
    conn = psycopg2.connect(
        host=creds["host"],
        database=creds["database"],
        user=creds["user"],
        password=creds["password"],
        port=int(creds["port"]),
        connect_timeout=30,
    )
    cur = conn.cursor()
    try:
        print(f"Deleting duplicates in {table_name} for sap_id={sap_id}...")
        # ctid-based delete: keep smallest ctid per group
        sql = f"""
            DELETE FROM "{table_name}" a
            WHERE a.ctid IN (
                SELECT ctid FROM (
                    SELECT ctid,
                           ROW_NUMBER() OVER (
                               PARTITION BY "{id_column}", sap_id
                               ORDER BY process_date NULLS LAST, ctid
                           ) AS rn
                    FROM "{table_name}"
                    WHERE sap_id = %s
                      AND DATE(process_date) = %s
                ) t
                WHERE rn > 1
            )
        """
        cur.execute(sql, (sap_id, sync_date))
        deleted = cur.rowcount
        print(f"Deleted {deleted if deleted else 0} duplicate rows from {table_name}")
        conn.commit()
        return deleted if deleted and deleted > 0 else 0
    finally:
        cur.close()
        conn.close()


def _app_db_connect():
    creds = credential_loader.get_credentials("APP_DB")
    return psycopg2.connect(
        host=creds["host"],
        database=creds["database"],
        user=creds["user"],
        password=creds["password"],
        port=int(creds["port"]),
        connect_timeout=15,
    )


def _normalize_max_process_date(value: Any, sync_date: dt.date) -> dt.datetime:
    """Turn server ``process_date`` max (or missing) into a timestamp for extraction_log."""
    end_of_day = dt.datetime.combine(sync_date, dt.time(23, 59, 59))
    if value is None:
        return end_of_day
    if isinstance(value, dt.datetime):
        return value
    if isinstance(value, dt.date):
        return dt.datetime.combine(value, dt.time(23, 59, 59))
    try:
        if hasattr(value, "item"):
            return _normalize_max_process_date(value.item(), sync_date)
    except Exception:
        pass
    try:
        ts = pd.Timestamp(value)
        if pd.isna(ts):
            return end_of_day
        pyd = ts.to_pydatetime()
        if isinstance(pyd, dt.datetime):
            return pyd
        if isinstance(pyd, dt.date):
            return dt.datetime.combine(pyd, dt.time(23, 59, 59))
    except Exception:
        pass
    return end_of_day


def _max_date_for_kind_stats(stats: Dict[str, Any], sync_date: dt.date) -> dt.datetime:
    return _normalize_max_process_date(stats.get("max_process_date"), sync_date)


def ensure_plant_extraction_rows(plant_name: str, sync_date: dt.date) -> None:
    """Insert tracking rows for new plants (same pattern as ``get_extraction_date`` in legacy sync)."""
    base = dt.datetime.combine(sync_date, dt.time.min)
    conn = _app_db_connect()
    cur = conn.cursor()
    try:
        for table in (TABLE_EXTRACTION_EVENT, TABLE_EXTRACTION_PRODUCTION):
            cur.execute(
                f"""
                INSERT INTO {table}
                    (plant_name, last_extracted_date, last_processed_date, extraction_status)
                VALUES (%s, %s, %s, 'NEW')
                ON CONFLICT (plant_name) DO NOTHING
                """,
                (plant_name, base, base),
            )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def update_extraction_log_daily(
    plant_name: str,
    kind: ExtractionKind,
    status: str,
    max_date: Optional[dt.datetime] = None,
) -> None:
    """Mirror ``production_log_sync.update_extraction_log`` for event vs production tables."""
    table = _EXTRACTION_TABLE[kind]
    conn = _app_db_connect()
    cur = conn.cursor()
    try:
        if status == "EXTRACTED" and max_date is not None:
            cur.execute(
                f"""
                UPDATE {table}
                SET last_extracted_date = %s,
                    extraction_status = %s,
                    last_synced_at = NOW()
                WHERE plant_name = %s
                """,
                (max_date, status, plant_name),
            )
        elif status == "PROCESSED":
            cur.execute(
                f"""
                UPDATE {table}
                SET last_processed_date = last_extracted_date,
                    extraction_status = %s,
                    last_synced_at = NOW()
                WHERE plant_name = %s
                """,
                (status, plant_name),
            )
        else:
            cur.execute(
                f"""
                UPDATE {table}
                SET extraction_status = %s,
                    last_synced_at = NOW()
                WHERE plant_name = %s
                """,
                (status, plant_name),
            )
        conn.commit()
    except Exception as e:
        logger.error(
            "update_extraction_log_daily failed plant=%s kind=%s status=%s: %s",
            plant_name,
            kind,
            status,
            e,
        )
    finally:
        cur.close()
        conn.close()


def ensure_extraction_tables() -> None:
    """
    Create legacy tracking tables (same DDL as ``event_log_sync.create_extraction_log_table``
    and ``production_log_sync.create_extraction_log_table``).

    **Requires:** ``credential_loader.get_credentials('APP_DB')`` with host, database,
    user, password, port; PostgreSQL user must be allowed ``CREATE TABLE``; package
    ``psycopg2``.
    """
    conn = _app_db_connect()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS lpg_eventlog_extraction_log (
                plant_name VARCHAR(255),
                last_extracted_date TIMESTAMP,
                last_processed_date TIMESTAMP,
                extraction_status VARCHAR(50),
                PRIMARY KEY (plant_name)
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS lpg_plant_extraction_log (
                plant_name VARCHAR(255),
                last_extracted_date TIMESTAMP,
                last_processed_date TIMESTAMP,
                extraction_status VARCHAR(50),
                PRIMARY KEY (plant_name)
            );
            """
        )
        cur.execute(
            f"ALTER TABLE {TABLE_EXTRACTION_EVENT} "
            "ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;"
        )
        cur.execute(
            f"ALTER TABLE {TABLE_EXTRACTION_PRODUCTION} "
            "ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;"
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def sync_one_kind(params: Dict[str, Any], *,  kind: str, app_table: str, id_col: str, sync_date: dt.date, dedupe: bool) -> Dict[str, Any]:
    """kind: 'event' | 'production'"""
    plant = params["PlantName"]
    print(f"\nFetching data for plant {plant} ({kind}) with chunking...")
    source = _source_table(params["db_type"], kind)
    query = _build_server_day_query(source, sync_date, params["db_type"])
    print(f"Running query for {plant} ({kind})...")
    print("query-->", query)
    server = fetch_data(
        query,
        getData=True,
        params=params,
        timeout=15,
        query_timeout=300,
        chunk_size=25000,
    )
    if server is None:
        server = pl.DataFrame()

    app = fetch_app_db_day(app_table, str(params["sap_id"]), sync_date)
    print(f"Server rows fetched for {plant} ({kind}): {len(server)}")
    print(f"Existing APP DB rows for {plant} ({kind}): {len(app)}")
    dedupe_deleted = 0
    if dedupe and not app.is_empty():
        print(f"Checking duplicates for {plant} ({kind})...")
        dedupe_deleted = dedupe_app_table_by_id(app_table, id_col, str(params["sap_id"]), sync_date)
        print(f"Duplicates deleted for {plant} ({kind}): {dedupe_deleted}")
        print(f"Re-fetching APP DB data after dedupe for {plant} ({kind})...")
        app = fetch_app_db_day(app_table, str(params["sap_id"]), sync_date)
    else:
        print(f"No duplicates check required for {plant} ({kind})")
    server = _enrich_server_frame(server, params)

    max_process_date = None
    if not server.is_empty() and "process_date" in server.columns:
        max_process_date = server["process_date"].max()
        print(f"Max process_date for {plant} ({kind}): {max_process_date}")

    stats = {
        "plant": plant,
        "kind": kind,
        "server_rows": len(server),
        "app_rows_before": len(app),
        "inserted": 0,
        "dedupe_deleted_before_insert": dedupe_deleted,
        "max_process_date": max_process_date,
    }

    if id_col not in server.columns and not server.is_empty():
        logger.error("[%s %s] missing %s on server extract", plant, kind, id_col)
        return {**stats, "error": f"missing column {id_col}"}

    to_insert = reconcile_missing_ids(server, app, id_col)
    print(f"Total missing records for {plant} ({kind}): {len(to_insert)}")
    if not to_insert.is_empty():
        print(f"Removing duplicates within insert set for {plant} ({kind})...")
        to_insert = to_insert.unique(subset=[id_col], keep="last")
    stats["missing_ids"] = len(to_insert)

    if not to_insert.is_empty():
        print(f"Inserting {len(to_insert)} records into {app_table} for {plant} ({kind})...")
        copy_dataframe_to_app_table(to_insert, app_table)
        print(f"-- Data Inserted to {app_table} for {plant} ({kind}) --")
        stats["inserted"] = len(to_insert)

    print(f"Completed {kind.upper()} sync for plant: {plant}")
    print("-"*60)
    return stats


def process_plant(plant_row: Dict[str, Any], sync_date: dt.date, dedupe: bool) -> Dict[str, Any]:
    params = _plant_params_from_row(plant_row)
    plant = params["PlantName"]
    print("\n" + "-"*60)
    print(f"Sync started for plant: {plant}")
    print("-"*60)

    out: Dict[str, Any] = {"plant": plant, "event": {}, "production": {}}
    try:
        ensure_plant_extraction_rows(plant, sync_date)
        print(f"\n--- EVENT LOG SYNC STARTED for {plant} ---")
        out["event"] = sync_one_kind(
            params,
            kind="event",
            app_table=EVENT_PG_TABLE,
            id_col=EVENT_ID_COL,
            sync_date=sync_date,
            dedupe=dedupe,
        )
        if out["event"].get("error"):
            print(f"Event sync FAILED for {plant}")
            update_extraction_log_daily(plant, "event", "FAILED")
        else:
            print(f"Event sync EXTRACTED for {plant}")
            update_extraction_log_daily(
                plant,
                "event",
                "EXTRACTED",
                max_date=_max_date_for_kind_stats(out["event"], sync_date),
            )

        print(f"\n--- PRODUCTION LOG SYNC STARTED for {plant} ---")
        out["production"] = sync_one_kind(
            params,
            kind="production",
            app_table=PROD_PG_TABLE,
            id_col=PROD_ID_COL,
            sync_date=sync_date,
            dedupe=dedupe,
        )
        if out["production"].get("error"):
            print(f"Production sync FAILED for {plant}")
            update_extraction_log_daily(plant, "production", "FAILED")
        else:
            print(f"Production sync EXTRACTED for {plant}")
            update_extraction_log_daily(
                plant,
                "production",
                "EXTRACTED",
                max_date=_max_date_for_kind_stats(out["production"], sync_date),
            )

        if not out["event"].get("error") and not out["production"].get("error"):
            print(f"Both EVENT and PRODUCTION processed successfully for {plant}")
            update_extraction_log_daily(plant, "event", "PROCESSED")
            update_extraction_log_daily(plant, "production", "PROCESSED")

        print(f"Successfully processed plant: {plant}")
        out["ok"] = True
    except Exception as e:
        print(f"Failed to process plant: {plant}")
        print(f"Error: {str(e)}")
        print(traceback.format_exc())
        logger.exception("process_plant failed: %s", e)
        out["ok"] = False
        out["error"] = str(e)
        out["traceback"] = traceback.format_exc()
        try:
            update_extraction_log_daily(plant, "event", "FAILED")
            update_extraction_log_daily(plant, "production", "FAILED")
        except Exception:
            pass

    print(f"Finished processing plant: {plant}")
    print("-"*60)
    return out


def main() -> None:
    start_time = time.time()
    csv_path = _resolve_plants_csv_path()
    if not csv_path.is_file():
        raise FileNotFoundError(
            f"Plants credentials CSV not found: {csv_path}. "
            "Set LPG_PLANTS_CREDENTIALS_PATH or place LPG_PLANTS_CREDENTIALS.csv beside this module."
        )

    plants = pl.read_csv(csv_path)
    #plants = plants.filter(pl.col("PlantName") == "Unnao")
    sync_date = _sync_date_from_env()
    print(f"Sync date: {sync_date}")
    dedupe = os.environ.get("LPG_DEDUPE_APP_DB", "").lower() in ("1", "true", "yes")
    dedupe = True
    max_workers = int(os.environ.get("LPG_MAX_WORKERS", "10"))

    logger.info("LPG daily reconciliation: date=%s csv=%s dedupe=%s", sync_date, csv_path, dedupe)
    ensure_extraction_tables()

    max_workers = max(1, min(max_workers, len(plants)))
    results: List[Dict[str, Any]] = []
    
    print(f"Processing {len(plants)} plants using {max_workers} parallel workers")

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
        futs = [
            ex.submit(process_plant, dict(row), sync_date, dedupe)
            for row in plants.iter_rows(named=True)
        ]
        for fut in concurrent.futures.as_completed(futs):
            try:
                result = fut.result()
                print(f"Completed plant: {result.get('plant')} | Status: {result.get('ok')}")
                results.append(result)
            except Exception as e:
                print(f"Error in future execution: {str(e)}")
    print("All plants processed. Preparing summary file...")
    summary_path = Path(tempfile.gettempdir()) / f"lpg_reconcile_{sync_date}_{uuid.uuid4().hex[:8]}.json"
    summary_path.write_text(json.dumps(results, default=str, indent=2), encoding="utf-8")
    logger.info("Wrote summary: %s", summary_path)
    print("\nFinal Summary:")
    print(json.dumps(results, default=str, indent=2), flush=True)

    # Added to calculate total execution time    
    end_time = time.time()
    total_time = end_time - start_time
    print(f"\n{'='*50}\nTOTAL EXECUTION TIME: {total_time:.2f} sec ({total_time/60:.2f} min)\n{'='*50}", flush=True)


if __name__ == "__main__":
    main()