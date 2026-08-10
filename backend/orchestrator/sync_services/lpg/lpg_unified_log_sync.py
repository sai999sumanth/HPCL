"""
Unified incremental sync for **event_log** and **production_log** in one module.

This is **not** a calendar-day full-table pull: each run asks the plant DB only for rows
**after the last saved keyset** (or after the latest row already in APP_DB when the
unified cursor is new), so routine runs stay small.

Fixes carried over from analysis of ``event_log_sync`` / ``production_log_sync``:

* **Keyset pagination** on ``(process_date, <native_id>)`` instead of ``LIMIT/OFFSET``,
  avoiding skipped / duplicated rows when the source table changes or many rows share
  the same ``process_date``.
* **Cursor watermark** per (plant, log kind) stores ``(last_process_date, last_source_id)``
  so the window predicate is not ``> max(process_date)`` only (which breaks when many
  rows share one timestamp).
* **Deduplication before insert**: rows already present in APP_DB for the same
  ``sap_id`` + native id are skipped (works with legacy rows that predate ``plan_id``).
* **Safe temp files** for ``COPY`` (unique paths; no shared ``/tmp/production_log_0.csv``
  across threads).
* Adds **plan_id** (ERP id from credentials), **plant_id** (CSV ``id``), and **time_stamp**
  (full-fidelity ``process_date``) on every inserted row.

Uniqueness in practice is ``(sap_id, event_log_id)`` / ``(sap_id, production_log_id)``
because timestamps can collide; ``plan_id`` + ``time_stamp`` are populated for
filtering and reporting.

Environment:

* Plant credentials are loaded from ``lpg_plants_master`` via ``LpgPlantsMaster.get_aggr_data``.
* ``LPG_UNIFIED_CHUNK_SIZE`` — rows per plant fetch (default ``25000``).
* ``LPG_UNIFIED_MAX_CHUNKS`` — safety cap per plant per kind per run (default ``500``).
* ``LPG_UNIFIED_START_TS`` — ISO timestamp only when nothing else defines a resume
  point (default ``2025-08-01T00:00:00``).
* ``LPG_UNIFIED_ALWAYS_DEDUPE`` — if ``1``/``true``, query APP_DB for existing ids on
  every chunk (slower; use if another writer may insert overlapping rows). Default is
  to dedupe only when the resume point comes from legacy/default seeding.
* ``LPG_UNIFIED_SKIP_APP_MAX_SEED`` — if ``1``/``true``, never run the expensive
  ``ORDER BY process_date DESC … LIMIT 1`` scan on APP_DB for resume (use when every
  plant already has a unified or legacy extraction row).
* ``LPG_MAX_WORKERS`` — thread pool size (default ``10``, same scale as legacy sync).
* ``LPG_UNIFIED_SKIP_EXTRA_COL_DDL`` — if ``1``/``true``, do not run ``ALTER TABLE`` for
  ``plan_id`` / ``plant_id`` / ``time_stamp`` (use if columns are already created).
* ``LPG_UNIFIED_DDL_LOCK_TIMEOUT_MS`` — max wait for table locks during ``ADD COLUMN``
  (default ``30000``). Prevents indefinite hangs when the log table is busy.
* ``LPG_UNIFIED_VERBOSE_PLANT_SQL`` — if ``1``/``true``, print full plant SQL and
  per-chunk fetch noise from ``fetch_data`` (default off to reduce I/O and log volume).
* ``LPG_UNIFIED_DEDUPE_ANY_BATCH`` — max ids per APP_DB dedupe probe (default ``12000``).
  Dedupe uses ``= ANY(ARRAY[...]::bigint[])`` plus a composite index on ``(sap_id, *_id)``
  instead of huge ``IN (...)`` lists (lower planner/CPU cost).
* ``LPG_UNIFIED_SLOW_PLANT_THRESHOLD_S`` — wall-seconds above which a plant appears in
  ``performance_summary.slow_plants`` in the JSON report and the stdout ranked table
  (default ``60``). Set to ``0`` to list every plant.
* ``LPG_UNIFIED_QUERY_TIMEOUT_S`` — max seconds per plant DB chunk fetch (default ``600``,
  10 minutes). Exceeding this with 0 rows fails the plant instead of marking OK.

**Resume order** (first match wins): stored unified cursor → legacy
``lpg_*_extraction_log.last_extracted_date`` (cheap PK lookup) → only if still unknown,
max row in APP_DB for that ``sap_id`` (can be heavy on huge tables) →
``LPG_UNIFIED_START_TS``. Plant queries always use a **keyset** from that point, not a
full calendar day.

**APP_DB load:** index DDL and ``ALTER … ADD COLUMN`` run **once per process** in
``main()``; each ``COPY`` uses ``ensure_indexes=False`` so six ``CREATE INDEX IF NOT
EXISTS`` checks are not repeated on every chunk (that dominated CPU/time vs legacy).

This module is **self-contained** (no imports from ``lpg_log_daily_reconciliation_sync``).

**Final JSON report** (stdout + temp file) contains:

* ``run`` — ``started_at_utc``, ``finished_at_utc``, ``total_wall_seconds``, plant counts,
  ``totals.event_log_rows_inserted_app_db`` / ``production_log_rows_inserted_app_db``.
* ``plants`` — per plant: ``total_wall_seconds``, nested ``event_log`` and ``production_log``
  each with ``plant_fetch_seconds``, ``app_db_copy_seconds``, ``app_db_dedupe_seconds``,
  ``rows_fetched_from_plant_db``, ``rows_inserted_into_app_db``, ``success``, and on
  failure ``error_message``, ``error_stage``, ``traceback``. ``failure`` on the plant
  object summarises which stage broke.

**APP_DB CPU:** dedupe uses ``ANY(ARRAY[bigint])`` (not giant ``IN`` lists), a composite
index on ``(sap_id, event_log_id)`` / ``(sap_id, production_log_id)``, and the plant's
open APP connection. Plant SQL echo is off by default; per-chunk ``COPY`` skips extra
logger lines. Set ``LPG_UNIFIED_VERBOSE_PLANT_SQL=1`` only when debugging.

**Bug fixes applied (v3)**:

* **Fix 1 — Cursor always persisted to DB after every chunk**, regardless of whether
  rows were inserted or fully deduped. Previously the cursor was only saved when
  ``to_insert`` was non-empty. When all rows in a chunk were deduped, the cursor was
  never written to the DB, so the next run re-read the same stale watermark, applied
  the rollback again, fetched the same rows again — indefinitely until ``max_chunks``
  was hit. This was the direct cause of 3+ hour runtimes.

* **Fix 2 — 1-hour rollback is a fetch-window concept only; it is never saved back.**
  ``get_resume_cursor_conn`` returns the TRUE saved watermark (no rollback baked in).
  ``sync_one_kind`` derives ``fetch_from_ts = cur_ts - 1h`` used only for the first
  chunk query. All subsequent chunk queries and the cursor save use the true tail of
  fetched data. Because the saved value is always the true tail and never a rolled-back
  value, the watermark advances each run instead of oscillating in the same window.

* **Fix 3 — ``copy_dataframe_to_app_table`` accepts an optional ``conn`` parameter** so
  the caller can pass the already-open ``app_conn`` and avoid opening a new TCP
  connection per COPY chunk. With 10 workers × many plants × 2 log kinds × N chunks,
  the connection overhead was significant.

* **Fix 4 — PostgreSQL advisory lock in ``main()``** prevents two scheduler instances
  from running concurrently. Without this, an overlapping run fetches from the same
  cursor before either has committed, both pass the dedupe check, and both insert the
  same rows. The lock is released automatically when the lock connection is closed.

Run::

    python -m orchestrator.sync_services.lpg.lpg_unified_log_sync
"""
from __future__ import annotations

import asyncio
import concurrent.futures
import datetime as dt
import json
import os
import socket
import time
import sys
import tempfile
import traceback
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import mysql.connector
import pandas as pd
import polars as pl
import psycopg2
import urdhva_base

sys.path.append("/opt/ceg/algo")
import hpcl_ceg_model
import orchestrator.dbconnector.credential_loader as credential_loader
import orchestrator.support_services.lpg_plant_connection_check as lpg_plant_connection_check

logger = urdhva_base.logger.Logger.getInstance("lpg_unified_log_sync")


def _sync_print(msg: str) -> None:
    """Human-readable progress line for operators (always flushed)."""
    print(f"[LPG-SYNC] {msg}", flush=True)


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

EVENT_PG_TABLE = "event_log"
EVENT_MYSQL_TABLE = "gd_pt_data"
PROD_PG_TABLE = "production_log"
PROD_MYSQL_TABLE = "production_data"
EVENT_ID_COL = "event_log_id"
PROD_ID_COL = "production_log_id"

CURSOR_TABLE = "lpg_unified_sync_cursor"
TABLE_EXTRACTION_EVENT = "lpg_eventlog_extraction_log"
TABLE_EXTRACTION_PRODUCTION = "lpg_plant_extraction_log"
LogKind = str  # "event" | "production"
ResumeSource = str  # "unified" | "app_max" | "legacy" | "default"

# Advisory lock key: deterministic hash of this module's name so it does not
# collide with any other pg_advisory_lock in the same database.
_ADVISORY_LOCK_KEY = 0x4C50475F554C5300  # "LPG_ULS\x00" as uint64, masked to int64
_ADVISORY_LOCK_KEY = _ADVISORY_LOCK_KEY & 0x7FFFFFFFFFFFFFFF  # ensure positive int64

# Sentinel returned by fetch_data when the plant query is cancelled by the DB
# server due to statement_timeout / max_execution_time.  Distinct from an empty
# DataFrame (which means the plant has no more rows) so sync_one_kind can fail
# the plant explicitly instead of silently treating a timeout as end-of-data.
_FETCH_TIMEOUT = object()


def _app_db_connect():
    creds = credential_loader.get_credentials("APP_DB")
    return psycopg2.connect(
        host=creds["host"],
        database=creds["database"],
        user=creds["user"],
        password=creds["password"],
        port=int(creds["port"]),
        connect_timeout=45,
    )


def _strip_utf8_nulls(data: pl.DataFrame) -> pl.DataFrame:
    out = data
    for col in out.columns:
        if out[col].dtype == pl.Utf8:
            out = out.with_columns(pl.col(col).str.replace_all("\x00", "").alias(col))
    return out


def ensure_lpg_app_log_indexes(conn, table_name: str) -> None:
    cur = conn.cursor()
    try:
        idx_statements = [
            f'CREATE INDEX IF NOT EXISTS "{table_name}_sap_id_index" ON "{table_name}" ("sap_id")',
            f'CREATE INDEX IF NOT EXISTS "{table_name}_pdate_index" ON "{table_name}" ("pdate")',
            f'CREATE INDEX IF NOT EXISTS "{table_name}_system_id_index" ON "{table_name}" ("system_id")',
            f'CREATE INDEX IF NOT EXISTS "{table_name}_process_id_index" ON "{table_name}" ("process_id")',
            f'CREATE INDEX IF NOT EXISTS "{table_name}_process_status_index" ON "{table_name}" ("process_status")',
            f'CREATE INDEX IF NOT EXISTS "{table_name}_cyl_type_index" ON "{table_name}" ("cyl_type")',
        ]
        # Speeds up dedupe probes: WHERE sap_id = ? AND <id> = ANY(array) / IN (...)
        if table_name == EVENT_PG_TABLE:
            idx_statements.append(
                f'CREATE INDEX IF NOT EXISTS "{table_name}_sap_{EVENT_ID_COL}_idx" '
                f'ON "{table_name}" ("sap_id", "{EVENT_ID_COL}")'
            )
        elif table_name == PROD_PG_TABLE:
            idx_statements.append(
                f'CREATE INDEX IF NOT EXISTS "{table_name}_sap_{PROD_ID_COL}_idx" '
                f'ON "{table_name}" ("sap_id", "{PROD_ID_COL}")'
            )
        for idx_sql in idx_statements:
            try:
                cur.execute(idx_sql)
            except Exception:
                pass
        conn.commit()
    finally:
        cur.close()


# ---------------------------------------------------------------------------
# FIX 3: copy_dataframe_to_app_table now accepts an optional `conn` parameter.
# When the caller passes its already-open app_conn we reuse it instead of
# opening (and closing) a new TCP connection per COPY chunk.
# ---------------------------------------------------------------------------
def copy_dataframe_to_app_table(
    data: pl.DataFrame,
    table_name: str,
    batch_size: int = 50_000,
    *,
    conn=None,
    ensure_indexes: bool = True,
    log_rowcount: bool = True,
) -> None:
    if data.is_empty():
        if log_rowcount:
            logger.info("copy_dataframe_to_app_table: empty frame, skip")
        return

    data = _strip_utf8_nulls(data)

    own_conn = conn is None
    if conn is None:
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
        parts: List[str] = []
        for col in data.columns:
            dt_name = _DTYPE_MAP.get(str(data[col].dtype))
            if not dt_name:
                dt_name = "text"
            parts.append(f'"{col}" {dt_name}')
        ddl = f'CREATE TABLE IF NOT EXISTS "{table_name}" ({",".join(parts)})'
        cur.execute(ddl)
        if ensure_indexes:
            ensure_lpg_app_log_indexes(conn, table_name)
        else:
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
        for start in range(0, n, batch_size):
            chunk = aligned.slice(start, min(batch_size, n - start))
            with tempfile.NamedTemporaryFile(
                mode="w+",
                suffix=".csv",
                delete=False,
                encoding="utf-8",
            ) as tmp:
                path = tmp.name
            try:
                chunk.write_csv(path, separator="~")
                with open(path, "r", encoding="utf-8") as fh:
                    cur.copy_expert(copy_sql, fh)
                conn.commit()
            finally:
                try:
                    os.remove(path)
                except OSError:
                    pass

        if log_rowcount:
            logger.info('COPY completed for "%s" (%s rows)', table_name, n)
    finally:
        cur.close()
        if own_conn:
            conn.close()


def fetch_data(
    query: str,
    *,
    getData: bool = False,
    params: Optional[Dict[str, Any]] = None,
    timeout: int = 45,
    query_timeout: int = int(os.environ.get("LPG_UNIFIED_QUERY_TIMEOUT_S", "600")),
    chunk_size: int = 50000,
    verbose: bool = False,
):
    """Fetch from plant MySQL or PostgreSQL.

    Socket probe and DB connect are bounded by ``timeout`` (default 45s).
    Query execution is bounded by ``query_timeout`` (default 600s).
    On a query timeout returns ``_FETCH_TIMEOUT`` sentinel instead of an empty
    DataFrame so callers can distinguish timeout from genuinely no rows.
    """
    if params is None:
        print("fetch_data: params is None", flush=True)
        return pl.DataFrame() if getData else None
    print(
        f"fetch_data START: {params.get('PlantName')} host={params.get('host')}:"
        f"{params.get('port')} db_type={params.get('db_type')}",
        flush=True,
    )
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
                f"fetch_data SOCKET FAIL: {params.get('PlantName')} "
                f"{params['host']}:{params['port']} error={result}",
                flush=True,
            )
            return pl.DataFrame() if getData else None
        print(f"fetch_data SOCKET OK: {params.get('PlantName')}", flush=True)
    except Exception as e:
        logger.error("Socket connection error: %s", e)
        print(f"fetch_data SOCKET ERROR: {params.get('PlantName')} {e}", flush=True)
        return pl.DataFrame() if getData else None
    finally:
        sock.close()

    try:
        if str(params.get("db_type", "")).lower() == "mysql":
            print(f"fetch_data DB CONNECT MySQL: {params.get('PlantName')}", flush=True)
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
            print(f"fetch_data DB CONNECTED MySQL: {params.get('PlantName')}", flush=True)
        else:
            print(f"fetch_data DB CONNECT PostgreSQL: {params.get('PlantName')}", flush=True)
            pg_conn = psycopg2.connect(
                host=params["host"],
                database=params["database"],
                user=params["user"],
                password=params["password"],
                port=params["port"],
                connect_timeout=timeout,
                keepalives=1,
                keepalives_idle=30,
                keepalives_interval=10,
                keepalives_count=6,
                options=f"-c statement_timeout={query_timeout * 1000}",
            )
            pg_conn.set_session(autocommit=True)
            cursor = pg_conn.cursor()
            cursor.execute(f"SET statement_timeout = {query_timeout * 1000};")
            print(f"fetch_data DB CONNECTED PostgreSQL: {params.get('PlantName')}", flush=True)

    except Exception as e:
        logger.error(
            "Database connection error for %s: %s",
            params.get("PlantName", "unknown"),
            e,
        )
        print(
            f"fetch_data DB CONNECT FAIL: {params.get('PlantName', 'unknown')} {e}",
            flush=True,
        )
        return pl.DataFrame() if getData else None

    try:
        if verbose:
            print("-" * 50, flush=True)
            print(f"Running Query with {query_timeout}s timeout...", flush=True)
            print(query, flush=True)

        print(f"fetch_data QUERY EXECUTE: {params.get('PlantName')}", flush=True)

        if not getData:
            cursor.execute(query)
            resp = cursor.fetchone()
            cursor.close()
            pg_conn.close()
            print(f"fetch_data DONE scalar: {params.get('PlantName')}", flush=True)
            return resp[0] if resp else None
        if "LIMIT" not in query.upper():
            print(f"fetch_data QUERY mode=OFFSET: {params.get('PlantName')}", flush=True)
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
            print(
                f"fetch_data DONE LIMIT rows={len(data)}: {params.get('PlantName')}",
                flush=True,
            )
            return data

        all_data = []
        offset = 0
        columns = []
        while True:
            chunk_query = f"{base_query} {offset};"
            print(
                f"fetch_data QUERY OFFSET offset={offset}: {params.get('PlantName')}",
                flush=True,
            )
            cursor.execute(chunk_query)
            chunk_data = cursor.fetchall()

            if not chunk_data:
                print(
                    f"fetch_data OFFSET empty offset={offset}: {params.get('PlantName')}",
                    flush=True,
                )
                break

            if verbose:
                print(f"Retrieved {len(chunk_data)} records in this chunk", flush=True)
            if not all_data:
                columns = [column[0] for column in cursor.description]

            all_data.extend(chunk_data)
            offset += chunk_size

            if len(chunk_data) < chunk_size:
                break

            if offset > 2000000:
                if verbose:
                    print("Reached maximum record limit (1M)", flush=True)
                print(f"fetch_data OFFSET cap reached: {params.get('PlantName')}", flush=True)
                break

        if verbose:
            print(f"Total Records: {len(all_data)}", flush=True)
            print("-" * 50, flush=True)

        if all_data:
            data = pd.DataFrame.from_records(all_data, columns=columns)
            data = pl.from_pandas(data)
            cursor.close()
            pg_conn.close()
            print(
                f"fetch_data DONE OFFSET rows={len(data)}: {params.get('PlantName')}",
                flush=True,
            )
            return data
        cursor.close()
        pg_conn.close()
        print(f"fetch_data DONE empty: {params.get('PlantName')}", flush=True)
        return pl.DataFrame()

    except psycopg2.errors.QueryCanceled:
        logger.error(
            "Plant query timed out after %s seconds for %s",
            query_timeout,
            params.get("PlantName", "unknown"),
        )
        print(
            f"Plant query timed out after {query_timeout}s for "
            f"{params.get('PlantName', 'unknown')} — failing this plant"
        )
        cursor.close()
        pg_conn.close()
        # Return sentinel so caller can distinguish timeout from no-more-rows.
        # MySQL raises a generic Exception (not QueryCanceled) for max_execution_time;
        # that is caught below and also returns the sentinel.
        return _FETCH_TIMEOUT if getData else None
    except Exception as e:
        # MySQL raises DatabaseError errno 3024 when max_execution_time is hit.
        is_mysql_timeout = (
            hasattr(e, "errno") and getattr(e, "errno", None) == 3024
        )
        if is_mysql_timeout:
            logger.error(
                "Plant query timed out after %ss (MySQL) for %s",
                query_timeout,
                params.get("PlantName", "unknown"),
            )
            print(
                f"Plant query timed out after {query_timeout}s (MySQL) for "
                f"{params.get('PlantName', 'unknown')} — failing this plant"
            )
            cursor.close()
            pg_conn.close()
            return _FETCH_TIMEOUT if getData else None
        err = str(e).lower()
        if "connection timed out" in err or "could not receive data" in err:
            cursor.close()
            pg_conn.close()
            return _FETCH_TIMEOUT if getData else None
        logger.error("Query execution error: %s", e)
        print(f"Query execution error: {str(e)}")
        cursor.close()
        pg_conn.close()
        return pl.DataFrame() if getData else None


def ensure_cursor_table() -> None:
    conn = _app_db_connect()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {CURSOR_TABLE} (
                plant_name VARCHAR(255) NOT NULL,
                log_kind VARCHAR(32) NOT NULL,
                last_process_date TIMESTAMP NULL,
                last_source_id BIGINT NOT NULL DEFAULT 0,
                last_synced_at TIMESTAMP NULL,
                updated_at TIMESTAMP DEFAULT NOW(),
                PRIMARY KEY (plant_name, log_kind)
            );
            """
        )
        cur.execute(
            f"""
            ALTER TABLE {CURSOR_TABLE}
            ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP NULL
            """
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def _columns_present_in_public(conn, table: str) -> set:
    """Lowercase column names for ``public.<table>`` (unquoted physical name)."""
    rel = table.replace('"', "").lower()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT a.attname
            FROM pg_catalog.pg_attribute a
            INNER JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
            INNER JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = %s
              AND a.attnum > 0
              AND NOT a.attisdropped
            """,
            (rel,),
        )
        return {str(r[0]).lower() for r in cur.fetchall()}
    finally:
        cur.close()


def ensure_log_extra_columns_conn(conn, table: str) -> None:
    """
    Add ``plan_id`` / ``plant_id`` / ``time_stamp`` only when missing, so routine runs
    do not take ``ALTER`` locks on huge busy tables. Uses ``lock_timeout`` so a
    contended table does not block the whole sync indefinitely.
    """
    if os.environ.get("LPG_UNIFIED_SKIP_EXTRA_COL_DDL", "").lower() in (
        "1",
        "true",
        "yes",
    ):
        logger.info(
            'Skipping extra-column DDL for "%s" (LPG_UNIFIED_SKIP_EXTRA_COL_DDL)',
            table,
        )
        return

    want = ("plan_id", "plant_id", "time_stamp")
    present = _columns_present_in_public(conn, table)
    missing = [c for c in want if c.lower() not in present]
    if not missing:
        logger.info('Extra columns already on "%s"; skipping ALTER', table)
        return

    lock_ms = int(os.environ.get("LPG_UNIFIED_DDL_LOCK_TIMEOUT_MS", "30000"))
    lock_ms = max(1000, min(lock_ms, 600_000))
    ddls = {
        "plan_id": f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS plan_id BIGINT',
        "plant_id": f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS plant_id BIGINT',
        "time_stamp": (
            f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS time_stamp TIMESTAMPTZ'
        ),
    }

    for col in missing:
        cur = conn.cursor()
        try:
            cur.execute("SET lock_timeout TO %s", (f"{lock_ms}ms",))
            cur.execute(ddls[col])
            logger.info('ADD COLUMN %s on "%s" (if not already present)', col, table)
        except psycopg2.errors.LockNotAvailable:
            logger.warning(
                'Lock wait timed out adding %s on "%s" (table busy). '
                "Skip or retry later; set LPG_UNIFIED_DDL_LOCK_TIMEOUT_MS to wait longer.",
                col,
                table,
            )
            conn.rollback()
        except psycopg2.Error as exc:
            logger.warning(
                'Could not add column %s on "%s": %s', col, table, exc.pgerror or exc
            )
            conn.rollback()
        else:
            conn.commit()
        finally:
            cur.close()


def _legacy_extraction_table(kind: LogKind) -> str:
    return (
        TABLE_EXTRACTION_EVENT if kind == "event" else TABLE_EXTRACTION_PRODUCTION
    )


def get_resume_cursor_conn(
    conn,
    plant_name: str,
    kind: LogKind,
    sap_id: str,
    app_table: str,
    id_col: str,
) -> Tuple[dt.datetime, int, ResumeSource]:
    """
    Resume point for plant-server keyset fetch. Uses one transaction/connection to avoid
    extra round-trips. Legacy extraction is checked **before** the heavy APP_DB max row
    query so routine runs avoid sorting large ``event_log`` / ``production_log`` tables.

    Returns the true saved watermark (not a rolled-back value). The 1-hour safety
    rollback is applied by the caller (sync_one_kind) **only for the fetch query**,
    and is never saved back to the cursor table. This ensures the watermark always
    advances and never gets permanently stuck in a re-fetch loop.
    """
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT last_process_date, last_source_id
            FROM {CURSOR_TABLE}
            WHERE plant_name = %s AND log_kind = %s
            """,
            (plant_name, kind),
        )
        row = cur.fetchone()
        if row and row[0] is not None:
            ts = pd.Timestamp(row[0]).to_pydatetime()
            # Return the TRUE watermark. Caller applies the 1-hour rollback only
            # when building the fetch query, and saves the true tail back — so the
            # cursor always advances and never loops over the same window every run.
            return ts, int(row[1] or 0), "unified"

        leg_table = _legacy_extraction_table(kind)
        try:
            cur.execute(
                f"SELECT last_extracted_date FROM {leg_table} WHERE plant_name = %s",
                (plant_name,),
            )
            leg = cur.fetchone()
            if leg and leg[0] is not None:
                return pd.Timestamp(leg[0]).to_pydatetime(), -1, "legacy"
        except Exception:
            pass

        if os.environ.get("LPG_UNIFIED_SKIP_APP_MAX_SEED", "").lower() not in (
            "1",
            "true",
            "yes",
        ):
            try:
                cur.execute(
                    f"""
                    SELECT process_date, "{id_col}"
                    FROM "{app_table}"
                    WHERE sap_id = %s
                    ORDER BY process_date DESC NULLS LAST, "{id_col}" DESC NULLS LAST
                    LIMIT 1
                    """,
                    (str(sap_id),),
                )
                app = cur.fetchone()
                if app and app[0] is not None and app[1] is not None:
                    return pd.Timestamp(app[0]).to_pydatetime(), int(app[1]), "app_max"
            except Exception:
                pass

        return _default_start_ts(), 0, "default"
    finally:
        cur.close()


def _set_cursor_conn(
    conn,
    plant_name: str,
    kind: LogKind,
    last_ts: Optional[dt.datetime],
    last_id: int,
) -> None:
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            INSERT INTO {CURSOR_TABLE}
                (plant_name, log_kind, last_process_date, last_source_id, updated_at)
            VALUES (%s, %s, %s, %s, NOW())
            ON CONFLICT (plant_name, log_kind) DO UPDATE SET
                last_process_date = EXCLUDED.last_process_date,
                last_source_id = EXCLUDED.last_source_id,
                updated_at = NOW()
            """,
            (plant_name, kind, last_ts, int(last_id)),
        )
        conn.commit()
    finally:
        cur.close()


def _touch_last_synced_at_conn(
    conn,
    plant_name: str,
    kind: LogKind,
) -> None:
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            INSERT INTO {CURSOR_TABLE}
                (plant_name, log_kind, last_process_date, last_source_id, last_synced_at, updated_at)
            VALUES (
                %s,
                %s,
                NULL,
                0,
                timezone('Asia/Kolkata', now()),
                NOW()
            )
            ON CONFLICT (plant_name, log_kind) DO UPDATE SET
                last_synced_at = timezone('Asia/Kolkata', now())
            """,
            (plant_name, kind),
        )
        conn.commit()
    finally:
        cur.close()


def _default_start_ts() -> dt.datetime:
    raw = os.environ.get("LPG_UNIFIED_START_TS", "").strip()
    if raw:
        return pd.Timestamp(raw).to_pydatetime()
    return dt.datetime(2025, 8, 1, 0, 0, 0)


def _source_table(db_type: str, kind: LogKind) -> str:
    is_mysql = str(db_type).lower() == "mysql"
    if kind == "event":
        return EVENT_MYSQL_TABLE if is_mysql else EVENT_PG_TABLE
    return PROD_MYSQL_TABLE if is_mysql else PROD_PG_TABLE


def _id_col(kind: LogKind) -> str:
    return EVENT_ID_COL if kind == "event" else PROD_ID_COL


def _app_table(kind: LogKind) -> str:
    return EVENT_PG_TABLE if kind == "event" else PROD_PG_TABLE


def _build_keyset_query(
    *,
    source_table: str,
    id_col: str,
    cursor_ts: dt.datetime,
    cursor_id: int,
    limit: int,
    db_type: str,
) -> str:
    """Single-chunk query (LIMIT in query → fetch_data returns one DataFrame, no OFFSET)."""
    is_mysql = str(db_type).lower() == "mysql"
    ts_sql = cursor_ts.strftime("%Y-%m-%d %H:%M:%S")
    lim = int(limit)
    if is_mysql:
        return f"""
            SELECT * FROM {source_table}
            WHERE process_date < NOW()
              AND process_date >= '{ts_sql}'
            ORDER BY process_date ASC, {id_col} ASC
            LIMIT {lim}
        """
    return f"""
        SELECT * FROM {source_table}
        WHERE process_date < NOW()
          AND process_date >= '{ts_sql}'
        ORDER BY process_date ASC, {id_col} ASC
        LIMIT {lim}
    """


def _enrich_frame(
    data: pl.DataFrame,
    *,
    plant_name: str,
    sap_id: Any,
    erp_id: Any,
    plant_row_id: Any,
) -> pl.DataFrame:
    if data.is_empty():
        return data
    plan_id = int(erp_id) if erp_id is not None and str(erp_id).strip() != "" else None
    plant_id = int(plant_row_id) if plant_row_id is not None else None
    out = data.with_columns(pl.lit(plant_name).alias("Plant Name"))
    out = out.with_columns(pl.lit(str(sap_id)).alias("sap_id"))
    if "process_date" in out.columns:
        out = out.with_columns(pl.col("process_date").cast(pl.Date).alias("pdate"))
        # Full-resolution event time for analytics (mirrors process_date; APP_DB column timestamptz).
        out = out.with_columns(pl.col("process_date").alias("time_stamp"))
    else:
        out = out.with_columns(pl.lit(None).alias("pdate"))
        out = out.with_columns(pl.lit(None).alias("time_stamp"))
    out = out.with_columns(pl.lit(plan_id).alias("plan_id"))
    out = out.with_columns(pl.lit(plant_id).alias("plant_id"))
    return out


def _bigint_array_sql_literal(ids: List[int]) -> str:
    """
    Build ``ARRAY[...]::bigint[]`` from validated integers only (no string concat from
    untrusted input). Used with ``= ANY(...)`` instead of huge ``IN (...)`` lists, which
    are expensive for the planner and CPU on large ``event_log`` / ``production_log`` tables.
    """
    if not ids:
        return "ARRAY[]::bigint[]"
    return "ARRAY[" + ",".join(str(int(x)) for x in ids) + "]::bigint[]"


def _existing_source_ids(
    app_table: str,
    id_col: str,
    sap_id: str,
    ids: List[Any],
    app_conn=None,
) -> set:
    if not ids:
        return set()
    own_conn = app_conn is None
    conn = app_conn if app_conn is not None else _app_db_connect()
    cur = conn.cursor()
    found: set = set()
    # One array per round-trip; cap literal size (~12k ids keeps SQL under ~150KB).
    batch = int(os.environ.get("LPG_UNIFIED_DEDUPE_ANY_BATCH", "12000"))
    batch = max(500, min(batch, 50_000))
    try:
        for i in range(0, len(ids), batch):
            part = [int(x) for x in ids[i : i + batch]]
            arr = _bigint_array_sql_literal(part)
            cur.execute(
                f"""
                SELECT "{id_col}", process_date FROM "{app_table}"
                WHERE sap_id = %s AND "{id_col}" = ANY({arr})
                """,
                (str(sap_id),),
            )
            for row in cur.fetchall():
                if row[0] is not None:
                    pdt = pd.Timestamp(row[1]) if row[1] is not None else None
                    found.add((int(row[0]), pdt))
        return found
    finally:
        cur.close()
        if own_conn:
            conn.close()


def _filter_new_rows(
    data: pl.DataFrame,
    *,
    app_table: str,
    id_col: str,
    sap_id: str,
    app_conn=None,
) -> pl.DataFrame:
    if data.is_empty() or id_col not in data.columns:
        return data
    ids_series = data[id_col].drop_nulls()
    ids = [int(x) for x in ids_series.to_list()]
    if not ids:
        return data.head(0)
    have = _existing_source_ids(
        app_table, id_col, sap_id, ids, app_conn=app_conn
    )
    if not have:
        return data
    keep: List[bool] = []
    for row in data.iter_rows(named=True):
        rid = row.get(id_col)
        pdt = row.get("process_date")
        if rid is None:
            keep.append(True)
            continue
        key = (int(rid), pd.Timestamp(pdt) if pdt is not None else None)
        keep.append(key not in have)
    return data.filter(pl.Series("_keep", keep))


def _tail_cursor(data: pl.DataFrame, id_col: str) -> Tuple[Optional[dt.datetime], int]:
    if data.is_empty():
        return None, 0
    last = data.tail(1)
    ts = last["process_date"][0]
    rid = last[id_col][0]
    if ts is None or rid is None:
        return None, 0
    ts_py = pd.Timestamp(ts).to_pydatetime()
    return ts_py, int(rid)


def _kind_label(kind: LogKind) -> str:
    return "event_log" if kind == "event" else "production_log"


def _last_synced_at_raw(ts: Optional[Any]) -> str:
    """Return cursor timestamp formatted without microseconds."""
    if ts is None:
        return ""
    return pd.Timestamp(ts).strftime("%Y-%m-%d %H:%M:%S")


def _format_elapsed(delta: dt.timedelta) -> str:
    """Human-readable duration (e.g. ``2h 15m``, ``3d 4h``)."""
    secs = max(0, int(delta.total_seconds()))
    if secs < 60:
        return f"{secs}s"
    mins, rem_secs = divmod(secs, 60)
    if mins < 60:
        return f"{mins}m {rem_secs}s" if rem_secs else f"{mins}m"
    hours, rem_mins = divmod(mins, 60)
    if hours < 24:
        return f"{hours}h {rem_mins}m" if rem_mins else f"{hours}h"
    days, rem_hours = divmod(hours, 24)
    return f"{days}d {rem_hours}h" if rem_hours else f"{days}d"


def _time_elapsed_since(ts: Optional[Any]) -> str:
    """Elapsed time since ``last_synced_at`` (IST), empty when unknown."""
    if ts is None:
        return ""
    now_ist = dt.datetime.now(ZoneInfo("Asia/Kolkata"))
    py_ts = pd.Timestamp(ts).to_pydatetime()
    if py_ts.tzinfo is None:
        py_ts = py_ts.replace(tzinfo=ZoneInfo("Asia/Kolkata"))
    else:
        py_ts = py_ts.astimezone(ZoneInfo("Asia/Kolkata"))
    return _format_elapsed(now_ist - py_ts)


def _load_last_synced_at_map(
    plant_names: List[str],
) -> Dict[str, Dict[str, Any]]:
    """Read ``last_synced_at`` and ``last_process_date`` from cursor (ILIKE plant match)."""
    names = list({str(n).strip() for n in plant_names if n})
    if not names:
        return {}
    conn = _app_db_connect()
    cur = conn.cursor()
    out: Dict[str, Dict[str, Any]] = {
        n: {
            "event": {"synced": None, "process": None},
            "production": {"synced": None, "process": None},
        }
        for n in names
    }
    try:
        for master_name in names:
            cur.execute(
                f"""
                SELECT plant_name, log_kind, last_synced_at, last_process_date
                FROM {CURSOR_TABLE}
                WHERE plant_name = %s
                   OR %s ILIKE '%%' || plant_name || '%%'
                   OR plant_name ILIKE '%%' || %s || '%%'
                """,
                (master_name, master_name, master_name),
            )
            bucket = out[master_name]
            for _cursor_plant, log_kind, last_synced_at, last_process_date in cur.fetchall():
                kind = str(log_kind).strip().lower()
                if kind not in ("event", "production"):
                    continue
                slot = bucket[kind]
                if last_synced_at is not None:
                    py_synced = pd.Timestamp(last_synced_at).to_pydatetime()
                    if slot["synced"] is None or py_synced > slot["synced"]:
                        slot["synced"] = py_synced
                if last_process_date is not None:
                    py_process = pd.Timestamp(last_process_date).to_pydatetime()
                    if slot["process"] is None or py_process > slot["process"]:
                        slot["process"] = py_process
        return out
    finally:
        cur.close()
        conn.close()


def _resolve_display_sync_ts(
    bucket: Dict[str, Any],
    *,
    connected: bool,
) -> Optional[dt.datetime]:
    """
    Prefer ``last_synced_at``. For not-connected plants only, fall back to
    ``last_process_date`` when ``last_synced_at`` is null (e.g. first run skip).
    """
    picks: List[dt.datetime] = []
    for kind in ("event", "production"):
        slot = bucket.get(kind, {})
        synced = slot.get("synced")
        process = slot.get("process")
        if synced is not None:
            picks.append(synced)
        elif not connected and process is not None:
            picks.append(process)
    return max(picks) if picks else None


def _not_connected_from_sync_results(
    results: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in results:
        if r.get("connected", True):
            continue
        plant_name = str(r.get("plant_name", ""))
        out.append(
            {
                "s_no": len(out) + 1,
                "erp_id": str(r.get("sap_id", "")),
                "plant_name": plant_name,
                "short_name": plant_name,
                "zone": str(r.get("zone", "")),
                "host_ip": str(r.get("host_ip", "")),
                "port": str(r.get("port", "")),
                "status": "NOT CONNECTED",
                "last_synced_at": r.get("last_synced_at", ""),
                "time_elapsed": r.get("time_elapsed", ""),
                "error_message": str(
                    r.get("connectivity_error")
                    or (r.get("failure") or {}).get("error_message")
                    or "Connection failed during sync"
                ),
                "mail_recipients": lpg_plant_connection_check._normalize_mail_recipients(
                    r.get("mail_recipients")
                ),
            }
        )
    return out


def _check_plant_connectivity(params: Dict[str, Any]) -> Tuple[bool, str]:
    """Port + DB check using helpers from lpg_plant_connection_check."""
    is_connected, status_message = lpg_plant_connection_check.test_telnet_connection(
        params["host"], params["port"]
    )
    if not is_connected:
        return False, status_message
    db_ok, db_msg = lpg_plant_connection_check.test_db_connection(
        params["host"],
        params["port"],
        params["database"],
        params["user"],
        params["password"],
        params["db_type"],
    )
    if db_ok:
        return True, "Connected"
    return False, db_msg


async def _send_not_connected_plants_mail(
    not_connected: List[Dict[str, Any]],
) -> None:
    if not not_connected:
        _sync_print("Connectivity mail: all plants connected — no email sent.")
        return
    lpg_plant_connection_check.not_connected_plants = not_connected
    csv_path = lpg_plant_connection_check.create_not_connected_plants_csv()
    if not csv_path:
        _sync_print("Connectivity mail: failed to create CSV — email not sent.")
        return
    await lpg_plant_connection_check.send_connectivity_mail(csv_path)
    _sync_print(
        f"Connectivity mail sent for {len(not_connected)} not-connected plant(s) "
        "(summary + plant-recipient alerts)."
    )


# ---------------------------------------------------------------------------
# FIX 4: Advisory lock helpers — prevent two scheduler instances from running
# concurrently and inserting the same rows before either commits.
# pg_try_advisory_lock is non-blocking: returns True if the lock was acquired,
# False if another session already holds it.  The lock is released automatically
# when lock_conn is closed (end of main()).
# ---------------------------------------------------------------------------
def _acquire_run_lock(conn) -> bool:
    """
    Try to acquire a session-level advisory lock unique to this sync module.
    Returns True if the lock was acquired (safe to proceed), False if another
    instance already holds it (caller should exit immediately).
    """
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT pg_try_advisory_lock(%s)",
            (_ADVISORY_LOCK_KEY,),
        )
        return bool(cur.fetchone()[0])
    finally:
        cur.close()


def sync_one_kind(
    params: Dict[str, Any],
    *,
    plant_row: Dict[str, Any],
    kind: LogKind,
    chunk_size: int,
    max_chunks: int,
    app_conn,
) -> Dict[str, Any]:
    plant_name = params["PlantName"]
    sap_s = str(params["sap_id"])
    id_col = _id_col(kind)
    app_table = _app_table(kind)
    source_table = _source_table(params["db_type"], kind)
    label = _kind_label(kind)
    sql_verbose = os.environ.get("LPG_UNIFIED_VERBOSE_PLANT_SQL", "").lower() in (
        "1",
        "true",
        "yes",
    )

    # Timeout constants used for both the fetch_data call and error reporting.
    # Defined here so _fail() and the sentinel check can reference them by name
    # instead of repeating magic literals.
    connect_timeout_s: int = 45
    query_timeout_s: int = int(os.environ.get("LPG_UNIFIED_QUERY_TIMEOUT_S", "600"))

    t_kind_start = time.perf_counter()
    sec_fetch = 0.0
    sec_copy = 0.0
    sec_dedupe = 0.0
    rows_fetched = 0
    rows_inserted = 0

    # get_resume_cursor_conn returns the TRUE saved watermark (no rollback baked in).
    # Apply the 1-hour safety rollback here, only to derive fetch_from_ts — the start
    # of the first query window. cur_ts remains the true watermark and is what gets
    # saved back after each chunk, so the cursor always advances and never re-fetches
    # the same rollback window on every run.
    cur_ts, cur_id, resume_src = get_resume_cursor_conn(
        app_conn, plant_name, kind, sap_s, app_table, id_col
    )
    print("before cur_ts--->", cur_ts)
    fetch_from_ts = (cur_ts - dt.timedelta(hours=1)).replace(
        minute=0, second=0, microsecond=0
    )
    print("before cur_ts--->", fetch_from_ts)

    always_dedupe = os.environ.get("LPG_UNIFIED_ALWAYS_DEDUPE", "").lower() in (
        "1",
        "true",
        "yes",
    )
    dedupe_chunks = always_dedupe or resume_src in ("legacy", "default")

    _sync_print(
        f"{plant_name} | {label}: starting (resume={resume_src}, "
        f"cursor_ts={cur_ts}, cursor_id={cur_id}, dedupe_against_app_db={dedupe_chunks})"
    )
    logger.info(
        "[%s %s] resume=%s cursor=(%s, %s) dedupe=%s",
        plant_name,
        kind,
        resume_src,
        cur_ts,
        cur_id,
        dedupe_chunks,
    )

    def _fail(
        *,
        message: str,
        stage: str,
        chunks_done: int,
        exc: Optional[BaseException] = None,
    ) -> Dict[str, Any]:
        elapsed = round(time.perf_counter() - t_kind_start, 3)
        out = {
            "kind": kind,
            "log_table": label,
            "ok": False,
            "success": False,
            "error_message": message,
            "error_stage": stage,
            "plant_fetch_seconds": round(sec_fetch, 3),
            "app_db_dedupe_seconds": round(sec_dedupe, 3),
            "app_db_copy_seconds": round(sec_copy, 3),
            "wall_seconds_total": elapsed,
            "rows_fetched_from_plant_db": rows_fetched,
            "rows_inserted_into_app_db": rows_inserted,
            "chunks_processed": chunks_done,
            "resume_source": resume_src,
            "dedupe_each_chunk": dedupe_chunks,
            "connect_timeout_s": connect_timeout_s,
            "query_timeout_s": query_timeout_s,
        }
        if exc is not None:
            out["exception_type"] = type(exc).__name__
            out["traceback"] = traceback.format_exc()
        _sync_print(
            f"{plant_name} | {label}: FAILED after {elapsed}s — stage={stage}: {message}"
        )
        return out

    chunks = 0
    first_chunk = True

    while chunks < max_chunks:
        # First chunk uses fetch_from_ts (cur_ts rolled back 1 hour) to catch any
        # out-of-order rows near the boundary. Subsequent chunks use cur_ts directly
        # (already advanced to the tail of the previous chunk), so we don't keep
        # re-fetching the same rollback window on every iteration.
        query_ts = fetch_from_ts if first_chunk else cur_ts
        print("query_ts")
        query = _build_keyset_query(
            source_table=source_table,
            id_col=id_col,
            cursor_ts=query_ts,
            cursor_id=cur_id,
            limit=chunk_size,
            db_type=params["db_type"],
        )
        _sync_print(
            f"{plant_name} | {label}: chunk {chunks + 1}/{max_chunks} — "
            f"query_ts={query_ts} | "
            f"fetching up to {chunk_size} rows from plant DB ({source_table})…"
        )
        t_fetch = time.perf_counter()
        chunk = fetch_data(
            query,
            getData=True,
            params=params,
            timeout=connect_timeout_s,
            query_timeout=query_timeout_s,
            chunk_size=chunk_size,
            verbose=sql_verbose,
        )
        dt_fetch = time.perf_counter() - t_fetch
        sec_fetch += dt_fetch
        chunks += 1
        first_chunk = False

        # Sentinel means the plant DB cancelled the query (statement_timeout /
        # max_execution_time).  Fail this plant explicitly — do not treat it as
        # end-of-data and silently mark success.
        if chunk is _FETCH_TIMEOUT:
            _sync_print(
                f"{plant_name} | {label}: fetch took too long ({round(dt_fetch)}s), exited"
            )
            return _fail(
                message=(
                    f"Plant query timed out after {query_timeout_s}s on chunk {chunks} "
                    f"(>{query_timeout_s}s limit). Plant is too slow or overloaded."
                ),
                stage="plant_fetch_timeout",
                chunks_done=chunks,
            )
        if chunk is None:
            chunk = pl.DataFrame()
        n = len(chunk)
        rows_fetched += n
        _sync_print(
            f"{plant_name} | {label}: chunk {chunks} — received {n} rows from plant "
            f"(this fetch: {dt_fetch:.2f}s)"
        )

        if chunk.is_empty():
            if dt_fetch >= query_timeout_s * 0.85:
                _sync_print(
                    f"{plant_name} | {label}: fetch took too long ({round(dt_fetch)}s), exited"
                )
                return _fail(
                    message=f"Plant query timed out after {dt_fetch:.0f}s (0 rows)",
                    stage="plant_fetch_timeout",
                    chunks_done=chunks,
                )
            _sync_print(
                f"{plant_name} | {label}: no more rows from plant (empty chunk). "
                f"Totals: fetched={rows_fetched}, inserted={rows_inserted}, "
                f"fetch={sec_fetch:.2f}s, copy={sec_copy:.2f}s, dedupe={sec_dedupe:.2f}s"
            )
            break

        if id_col not in chunk.columns:
            logger.error("[%s %s] server result missing %s", plant_name, kind, id_col)
            return _fail(
                message=f"Plant data has no column {id_col!r}",
                stage="validate_plant_columns",
                chunks_done=chunks,
            )

        # Capture the tail cursor from the *fetched* chunk before any filtering.
        # FIX 1: We must advance cur_ts/cur_id from the raw fetched chunk, not from
        # to_insert.  When all rows are deduped, to_insert is empty so the old code
        # left the cursor unchanged — the next run fetched the same rows again, and
        # with dedupe_chunks=False (the default on unified resume) it inserted them
        # again, creating duplicates.  By advancing from the fetched chunk we always
        # move past processed data regardless of how many rows survived deduplication.
        tail_ts, tail_id = _tail_cursor(chunk, id_col)

        enriched = _enrich_frame(
            chunk,
            plant_name=plant_name,
            sap_id=params["sap_id"],
            erp_id=plant_row.get("erp_id"),
            plant_row_id=plant_row.get("id"),
        )
        if dedupe_chunks:
            t0 = time.perf_counter()
            to_insert = _filter_new_rows(
                enriched,
                app_table=app_table,
                id_col=id_col,
                sap_id=sap_s,
                app_conn=app_conn,
            )
            sec_dedupe += time.perf_counter() - t0
        else:
            to_insert = enriched

        if not to_insert.is_empty():
            _sync_print(
                f"{plant_name} | {label}: inserting {len(to_insert)} rows into APP_DB "
                f'table "{app_table}"…'
            )
            try:
                t0 = time.perf_counter()
                # FIX 3: pass the already-open app_conn so we do not open a new TCP
                # connection per COPY chunk (was: a fresh connect/close every call).
                copy_dataframe_to_app_table(
                    to_insert,
                    app_table,
                    conn=app_conn,
                    ensure_indexes=False,
                    log_rowcount=False,
                )
                sec_copy += time.perf_counter() - t0
                rows_inserted += len(to_insert)
            except Exception as exc:
                logger.exception(
                    "COPY failed plant=%s kind=%s: %s", plant_name, kind, exc
                )
                return _fail(
                    message=str(exc),
                    stage="copy_to_app_db",
                    chunks_done=chunks,
                    exc=exc,
                )
        else:
            _sync_print(
                f"{plant_name} | {label}: chunk {chunks} — all rows already in APP_DB "
                "(dedupe); advancing cursor without insert"
            )

        # Always advance and persist the cursor from the tail of the RAW fetched chunk,
        # regardless of whether any rows were inserted or fully deduped.
        #
        # This is the core fix for long runtimes:
        #   - cursor stores the TRUE high-water mark (not a rolled-back value)
        #   - next run reads that mark, applies 1-hour rollback only for fetch_from_ts
        #   - the watermark always moves forward, so the job never re-fetches the same
        #     already-synced window on every run
        #
        # Previously, when to_insert was empty (all deduped), the cursor was not saved,
        # so the next run re-read the same stale cursor, applied rollback again, fetched
        # the same rows, deduped them all again — indefinitely until max_chunks was hit.


        # if not to_insert.is_empty():
        #     cur_ts, cur_id = _tail_cursor(to_insert, id_col,)
        # print("cur_ts->", cur_ts)
        # print("cur_id--->", cur_id)
        if tail_ts and tail_id:
            print("tail_ts-->", tail_ts)
            print("tail_id-->", tail_id)
            cur_ts, cur_id = tail_ts, tail_id
            _set_cursor_conn(app_conn, plant_name, kind, cur_ts, cur_id)

        if len(chunk) < chunk_size:
            _sync_print(
                f"{plant_name} | {label}: last page (< {chunk_size} rows). "
                f"Totals: fetched={rows_fetched}, inserted={rows_inserted}"
            )
            break

    elapsed = round(time.perf_counter() - t_kind_start, 3)
    _sync_print(
        f"{plant_name} | {label}: OK in {elapsed}s — "
        f"fetched={rows_fetched}, inserted={rows_inserted}, "
        f"plant_fetch={sec_fetch:.2f}s, app_copy={sec_copy:.2f}s, app_dedupe={sec_dedupe:.2f}s"
    )
    return {
        "kind": kind,
        "log_table": label,
        "ok": True,
        "success": True,
        "error_message": None,
        "error_stage": None,
        "plant_fetch_seconds": round(sec_fetch, 3),
        "app_db_dedupe_seconds": round(sec_dedupe, 3),
        "app_db_copy_seconds": round(sec_copy, 3),
        "wall_seconds_total": elapsed,
        "rows_fetched_from_plant_db": rows_fetched,
        "rows_inserted_into_app_db": rows_inserted,
        "chunks_processed": chunks,
        "resume_source": resume_src,
        "dedupe_each_chunk": dedupe_chunks,
    }
    

def process_plant(plant_row: Dict[str, Any]) -> Dict[str, Any]:
    wall0 = time.perf_counter()
    params = {
        "PlantName": plant_row["PlantName"],
        "host": plant_row["host_ip"],
        "database": plant_row["db_database"],
        "user": plant_row["db_user"],
        "password": plant_row["db_password"],
        "port": plant_row["port"],
        "db_type": plant_row["db_type"],
        "sap_id": plant_row["erp_id"],
    }
    chunk_size = int(os.environ.get("LPG_UNIFIED_CHUNK_SIZE", "25000"))
    max_chunks = int(os.environ.get("LPG_UNIFIED_MAX_CHUNKS", "500"))

    out: Dict[str, Any] = {
        "plant_name": params["PlantName"],
        "csv_plant_id": plant_row.get("id"),
        "sap_id": str(params["sap_id"]),
        "host_ip": params["host"],
        "port": str(params["port"]),
        "zone": str(plant_row.get("zone", "")),
        "db_database": params["database"],
        "db_type": params["db_type"],
        "mail_recipients": plant_row.get("mail_recipients"),
        "connected": True,
        "connectivity_error": None,
        "success": False,
        "total_wall_seconds": 0.0,
        "event_log": {},
        "production_log": {},
        "failure": None,
        "chunk_size": chunk_size,
        "max_chunks_per_kind": max_chunks,
    }

    _sync_print(
        f"=== Plant START: {params['PlantName']} | sap_id={params['sap_id']} | "
        f"host={params['host']} | chunk_size={chunk_size} max_chunks/kind={max_chunks} ==="
    )

    is_connected, conn_msg = _check_plant_connectivity(params)
    if not is_connected:
        out["connected"] = False
        out["connectivity_error"] = conn_msg
        out["failure"] = {
            "where": "connectivity",
            "error_message": conn_msg,
        }
        out["total_wall_seconds"] = round(time.perf_counter() - wall0, 3)
        _sync_print(
            f"=== Plant END (NOT CONNECTED): {params['PlantName']} — {conn_msg} ==="
        )
        return out

    app_conn = None
    try:
        app_conn = _app_db_connect()
        print(f"Updating last_synced_at for {params['PlantName']}")
        _touch_last_synced_at_conn(app_conn, params["PlantName"], "event")
        _touch_last_synced_at_conn(app_conn, params["PlantName"], "production")
        ev = sync_one_kind(
            params,
            plant_row=plant_row,
            kind="event",
            chunk_size=chunk_size,
            max_chunks=max_chunks,
            app_conn=app_conn,
        )
        out["event_log"] = ev
        if not ev.get("ok", False):
            out["failure"] = {
                "where": "event_log",
                "error_message": ev.get("error_message"),
                "error_stage": ev.get("error_stage"),
                "exception_type": ev.get("exception_type"),
                "traceback": ev.get("traceback"),
            }
            out["total_wall_seconds"] = round(time.perf_counter() - wall0, 3)
            _sync_print(
                f"=== Plant END (FAILED): {params['PlantName']} — event_log failed in "
                f"{out['total_wall_seconds']}s ==="
            )
            return out

        pr = sync_one_kind(
            params,
            plant_row=plant_row,
            kind="production",
            chunk_size=chunk_size,
            max_chunks=max_chunks,
            app_conn=app_conn,
        )
        out["production_log"] = pr
        if not pr.get("ok", False):
            out["failure"] = {
                "where": "production_log",
                "error_message": pr.get("error_message"),
                "error_stage": pr.get("error_stage"),
                "exception_type": pr.get("exception_type"),
                "traceback": pr.get("traceback"),
            }
            out["total_wall_seconds"] = round(time.perf_counter() - wall0, 3)
            _sync_print(
                f"=== Plant END (FAILED): {params['PlantName']} — production_log failed in "
                f"{out['total_wall_seconds']}s ==="
            )
            return out

        out["success"] = True
        out["total_wall_seconds"] = round(time.perf_counter() - wall0, 3)
        _sync_print(
            f"=== Plant END (OK): {params['PlantName']} in {out['total_wall_seconds']}s | "
            f"event: fetched={ev.get('rows_fetched_from_plant_db')} inserted="
            f"{ev.get('rows_inserted_into_app_db')} ({ev.get('wall_seconds_total')}s in log sync) | "
            f"production: fetched={pr.get('rows_fetched_from_plant_db')} inserted="
            f"{pr.get('rows_inserted_into_app_db')} ({pr.get('wall_seconds_total')}s in log sync) ==="
        )
    except Exception as exc:
        logger.exception("process_plant failed: %s", exc)
        out["success"] = False
        out["failure"] = {
            "where": "process_plant_unhandled",
            "error_message": str(exc),
            "exception_type": type(exc).__name__,
            "traceback": traceback.format_exc(),
        }
        out["total_wall_seconds"] = round(time.perf_counter() - wall0, 3)
        _sync_print(
            f"=== Plant END (FAILED): {params['PlantName']} — unhandled error in "
            f"{out['total_wall_seconds']}s: {exc} ==="
        )
    finally:
        if app_conn is not None:
            try:
                app_conn.close()
            except Exception:
                pass
    return out


# ---------------------------------------------------------------------------
# Slow-plant performance summary
# ---------------------------------------------------------------------------
_SLOW_PLANT_THRESHOLD_S: float = float(
    os.environ.get("LPG_UNIFIED_SLOW_PLANT_THRESHOLD_S", "60")
)
"""
Plants whose ``total_wall_seconds`` exceeds this value are included in the
``performance_summary.slow_plants`` section of the final JSON report and
printed as a ranked table to stdout.  Default 60s.  Override via env var
``LPG_UNIFIED_SLOW_PLANT_THRESHOLD_S``.
"""


def _build_performance_summary(
    results: List[Dict[str, Any]],
    threshold_s: float = _SLOW_PLANT_THRESHOLD_S,
) -> Dict[str, Any]:
    """
    Build a ``performance_summary`` block for the final JSON report.

    Fields per slow plant:
      plant_name, sap_id, zone, total_wall_seconds, connected, success,
      event_log_fetch_s, event_log_copy_s, event_log_dedupe_s,
      event_log_rows_fetched, event_log_rows_inserted,
      production_log_fetch_s, production_log_copy_s, production_log_dedupe_s,
      production_log_rows_fetched, production_log_rows_inserted,
      failure_stage  (populated only when success=False)
    """
    slow: List[Dict[str, Any]] = []
    for r in results:
        wall = float(r.get("total_wall_seconds") or 0)
        if wall < threshold_s:
            continue
        ev = r.get("event_log") or {}
        pr = r.get("production_log") or {}
        failure = r.get("failure") or {}
        slow.append(
            {
                "plant_name": r.get("plant_name", ""),
                "sap_id": r.get("sap_id", ""),
                "zone": r.get("zone", ""),
                "host_ip": r.get("host_ip", ""),
                "connected": r.get("connected", False),
                "success": r.get("success", False),
                "total_wall_seconds": round(wall, 2),
                "event_log": {
                    "fetch_seconds": round(float(ev.get("plant_fetch_seconds") or 0), 2),
                    "copy_seconds": round(float(ev.get("app_db_copy_seconds") or 0), 2),
                    "dedupe_seconds": round(float(ev.get("app_db_dedupe_seconds") or 0), 2),
                    "chunks_processed": ev.get("chunks_processed", 0),
                    "rows_fetched": ev.get("rows_fetched_from_plant_db", 0),
                    "rows_inserted": ev.get("rows_inserted_into_app_db", 0),
                    "success": ev.get("success", False),
                    "error_stage": ev.get("error_stage"),
                },
                "production_log": {
                    "fetch_seconds": round(float(pr.get("plant_fetch_seconds") or 0), 2),
                    "copy_seconds": round(float(pr.get("app_db_copy_seconds") or 0), 2),
                    "dedupe_seconds": round(float(pr.get("app_db_dedupe_seconds") or 0), 2),
                    "chunks_processed": pr.get("chunks_processed", 0),
                    "rows_fetched": pr.get("rows_fetched_from_plant_db", 0),
                    "rows_inserted": pr.get("rows_inserted_into_app_db", 0),
                    "success": pr.get("success", False),
                    "error_stage": pr.get("error_stage"),
                },
                "failure_stage": failure.get("where") or failure.get("error_stage"),
                "failure_message": failure.get("error_message"),
            }
        )

    slow.sort(key=lambda x: x["total_wall_seconds"], reverse=True)

    all_walls = [float(r.get("total_wall_seconds") or 0) for r in results]
    avg_wall = round(sum(all_walls) / len(all_walls), 2) if all_walls else 0.0
    max_wall = round(max(all_walls), 2) if all_walls else 0.0
    timeout_plants = [
        r.get("plant_name", "")
        for r in results
        if (r.get("event_log") or {}).get("error_stage") == "plant_fetch_timeout"
        or (r.get("production_log") or {}).get("error_stage") == "plant_fetch_timeout"
    ]

    return {
        "threshold_seconds": threshold_s,
        "slow_plant_count": len(slow),
        "avg_plant_wall_seconds": avg_wall,
        "max_plant_wall_seconds": max_wall,
        "timeout_plant_count": len(timeout_plants),
        "timeout_plants": timeout_plants,
        "slow_plants": slow,
    }


def _print_slow_plant_table(perf: Dict[str, Any]) -> None:
    """Print a human-readable ranked table of slow plants to stdout."""
    slow = perf.get("slow_plants", [])
    threshold = perf.get("threshold_seconds", 60)
    timeout_plants = set(perf.get("timeout_plants", []))

    _sync_print(
        f"\nPERFORMANCE SUMMARY — plants taking >{threshold}s "
        f"({perf['slow_plant_count']} of {perf.get('slow_plant_count', 0) } flagged | "
        f"avg={perf['avg_plant_wall_seconds']}s max={perf['max_plant_wall_seconds']}s | "
        f"query-timeouts={perf['timeout_plant_count']})"
    )
    if not slow:
        _sync_print("  All plants completed within the threshold.")
        return

    header = (
        f"  {'#':>3}  {'Plant':<35} {'Zone':<10} {'Wall(s)':>8} "
        f"{'EV fetch':>9} {'EV ins':>8} {'PR fetch':>9} {'PR ins':>8}  Status"
    )
    _sync_print(header)
    _sync_print("  " + "-" * (len(header) - 2))
    for i, p in enumerate(slow, 1):
        ev = p["event_log"]
        pr = p["production_log"]
        status_parts = []
        if not p["connected"]:
            status_parts.append("NOT-CONNECTED")
        elif not p["success"]:
            stage = p.get("failure_stage") or "FAILED"
            if p["plant_name"] in timeout_plants:
                status_parts.append(f"TIMEOUT({stage})")
            else:
                status_parts.append(f"FAILED({stage})")
        else:
            status_parts.append("OK")
        if p["plant_name"] in timeout_plants:
            status_parts.append("⚠ QUERY-TIMEOUT")
        status = " ".join(status_parts)
        _sync_print(
            f"  {i:>3}  {p['plant_name']:<35} {p['zone']:<10} "
            f"{p['total_wall_seconds']:>8.1f} "
            f"{ev['fetch_seconds']:>9.1f} {ev['rows_inserted']:>8} "
            f"{pr['fetch_seconds']:>9.1f} {pr['rows_inserted']:>8}  {status}"
        )
    _sync_print("")


def main() -> None:
    """
    Run unified LPG log sync for all plants, then email not-connected plants.
    After sync, not-connected plants are written to ``/data/not_connected_plants.csv``
    and ``send_connectivity_mail()`` is called from ``lpg_plant_connection_check``.
    Connectivity email is **skipped by default**. To send mail after sync, set::
        export LPG_UNIFIED_SKIP_CONNECTIVITY_MAIL=0
    """
    run_wall0 = time.perf_counter()
    started_at = dt.datetime.now(dt.timezone.utc).isoformat()

    query = """
        SELECT id, sap_id, plant_name, ip_address, port_no, username, password,
               db_name, db_type, zone, region, mail_recipients
        FROM lpg_plants_master
        ORDER BY id ASC
    """
    result = asyncio.run(hpcl_ceg_model.LpgPlantsMaster.get_aggr_data(query=query, limit=0))
    rows = result.get("data", []) if result else []
    if not rows:
        raise RuntimeError("No rows found in lpg_plants_master")
    for row in rows:
        if str(row["password"]).startswith("enc#_"):
            row["password"] = urdhva_base.types.Secret(row["password"]).get_secret()

        row["erp_id"] = row.get("sap_id")
        row["PlantName"] = row.get("plant_name")
        row["host_ip"] = row.get("ip_address")
        row["port"] = row.get("port_no")
        row["db_user"] = row.get("username")
        row["db_password"] = row.get("password")
        row["db_database"] = row.get("db_name")
        row["SiteRegion"] = row.get("region")
    plants = pl.from_dicts(rows)
    max_workers = max(1, min(int(os.environ.get("LPG_MAX_WORKERS", "10")), len(plants)))
    n_plants = len(plants)

    _sync_print(
        f"RUN START | UTC {started_at} | plants={n_plants} | workers={max_workers} | "
        "source=lpg_plants_master"
    )

    _sync_print("Step 1/4: Ensuring unified cursor table on APP_DB…")
    ensure_cursor_table()
    _sync_print("Step 1/4: Done (lpg_unified_sync_cursor).")

    # FIX 4: Acquire a session-level advisory lock before any plant work so that if
    # the scheduler fires a second instance while we are still running (which was
    # causing duplicate inserts), the second instance exits immediately instead of
    # fetching from the same cursors and inserting the same rows concurrently.
    _sync_print("Step 2/4: Acquiring run advisory lock on APP_DB…")
    lock_conn = _app_db_connect()
    if not _acquire_run_lock(lock_conn):
        _sync_print(
            "Another lpg_unified_log_sync instance is already running — "
            "exiting to prevent concurrent inserts and duplicates."
        )
        lock_conn.close()
        return
    _sync_print("Step 2/4: Advisory lock acquired — this is the only running instance.")

    try:
        _sync_print(
            "Step 3/4: Ensuring extra columns + standard indexes on APP_DB "
            f'("{EVENT_PG_TABLE}", "{PROD_PG_TABLE}")…'
        )
        setup = _app_db_connect()
        try:
            ensure_log_extra_columns_conn(setup, EVENT_PG_TABLE)
            ensure_log_extra_columns_conn(setup, PROD_PG_TABLE)
            ensure_lpg_app_log_indexes(setup, EVENT_PG_TABLE)
            ensure_lpg_app_log_indexes(setup, PROD_PG_TABLE)
        finally:
            setup.close()
        _sync_print("Step 3/4: Done.")

        logger.info(
            "LPG unified sync: source=lpg_plants_master workers=%s chunk=%s",
            max_workers,
            os.environ.get("LPG_UNIFIED_CHUNK_SIZE", "25000"),
        )

        _sync_print(
            f"Step 4/4: Syncing all plants (parallel pool size={max_workers}) — "
            "watch per-plant lines below…"
        )
        results: List[Dict[str, Any]] = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
            futs = [
                ex.submit(process_plant, dict(row)) for row in plants.iter_rows(named=True)
            ]
            for fut in concurrent.futures.as_completed(futs):
                results.append(fut.result())

        last_synced_map = _load_last_synced_at_map([r.get("plant_name") for r in results])
        for r in results:
            plant_name = r.get("plant_name", "")
            connected = bool(r.get("connected", False))
            bucket = last_synced_map.get(plant_name, {})
            latest_ts = _resolve_display_sync_ts(bucket, connected=connected)
            r["status"] = ("CONNECTED" if connected else "NOT CONNECTED")
            r["last_synced_at"] = _last_synced_at_raw(latest_ts)
            r["time_elapsed"] = _time_elapsed_since(latest_ts)

        finished_at = dt.datetime.now(dt.timezone.utc).isoformat()
        total_run_s = round(time.perf_counter() - run_wall0, 3)
        ok_n = sum(1 for r in results if r.get("success"))
        fail_n = n_plants - ok_n
        ev_rows = sum(
            int(r.get("event_log", {}).get("rows_inserted_into_app_db") or 0) for r in results
        )
        pr_rows = sum(
            int(r.get("production_log", {}).get("rows_inserted_into_app_db") or 0)
            for r in results
        )

        perf_summary = _build_performance_summary(results)
        report: Dict[str, Any] = {
            "run": {
                "started_at_utc": started_at,
                "finished_at_utc": finished_at,
                "total_wall_seconds": total_run_s,
                "plants_in_db": n_plants,
                "plants_succeeded": ok_n,
                "plants_failed": fail_n,
                "max_workers": max_workers,
                "plants_source": "lpg_plants_master",
                "connect_timeout_s": 45,
                "query_timeout_s": int(os.environ.get("LPG_UNIFIED_QUERY_TIMEOUT_S", "600")),
                "totals": {
                    "event_log_rows_inserted_app_db": ev_rows,
                    "production_log_rows_inserted_app_db": pr_rows,
                },
            },
            "performance_summary": perf_summary,
            "plants": results,
        }

        summary_path = Path(tempfile.gettempdir()) / f"lpg_unified_sync_{uuid.uuid4().hex[:10]}.json"
        summary_path.write_text(json.dumps(report, default=str, indent=2), encoding="utf-8")

        _print_slow_plant_table(perf_summary)
        _sync_print(
            f"Plants exited due to fetch timeout: "
            f"{', '.join(perf_summary.get('timeout_plants') or []) or 'none'}"
        )
        _sync_print(
            f"RUN END | UTC {finished_at} | total {total_run_s}s | "
            f"ok={ok_n} failed={fail_n} | "
            f"rows inserted — event_log={ev_rows}, production_log={pr_rows}"
        )
        _sync_print(f"Full JSON report written to: {summary_path}")
        logger.info("Wrote summary: %s", summary_path)
        print(json.dumps(report, default=str, indent=2), flush=True)

        if os.environ.get("LPG_UNIFIED_SKIP_CONNECTIVITY_MAIL", "1").lower() not in (
            "1",
            "true",
            "yes",
        ):
            not_connected = _not_connected_from_sync_results(results)
            _sync_print(f"Connectivity mail: checking {len(not_connected)} not-connected plant(s)…")
            try:
                asyncio.run(_send_not_connected_plants_mail(not_connected))
            except Exception as exc:
                logger.exception("Connectivity mail failed: %s", exc)
                _sync_print(f"Connectivity mail FAILED: {exc}")
        else:
            _sync_print("Connectivity mail: skipped (LPG_UNIFIED_SKIP_CONNECTIVITY_MAIL)")

    finally:
        # FIX 4: Releasing lock_conn releases the advisory lock automatically.
        # This runs even if the sync raises an unhandled exception, ensuring no
        # stale lock blocks the next scheduled run.
        try:
            lock_conn.close()
        except Exception:
            pass
        _sync_print("Advisory lock released.")


if __name__ == "__main__":
    _code = 0
    try:
        main()
    except KeyboardInterrupt:
        _code = 130
    except Exception:
        traceback.print_exc()
        _code = 1
    finally:
        sys.stdout.flush()
        sys.stderr.flush()
    if _code:
        sys.exit(_code)