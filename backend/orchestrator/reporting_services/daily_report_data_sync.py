import urdhva_base
import sys
import asyncio
import pandas as pd
from datetime import datetime, date, timezone
from typing import Optional, List
import dateutil.parser as dateutil_parser

import orchestrator.analytics.dry_out_analysis as dry_out_analysis
from sqlalchemy import (
    MetaData, Table, Column, String, Boolean, DateTime, Date,
    text, insert, Numeric
)
import orchestrator.reporting_services.reporting_helpers.retail_data as retail_data
import orchestrator.reporting_services.novex_daily_report_segregation as novex_daily_report_dryout
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import orchestrator.dbconnector.credential_loader as credential_loader


DATABASE_URL = str(urdhva_base.settings.db_urls["postgres_async"][0])
SCHEMA_NAME = "HPCL_NOVEX"
TABLE_NAME = "dryout_data"

"""
-- 1. Create user
CREATE USER "TIBCO" WITH PASSWORD 'StrongPassword@123';

-- 2. Ensure schema exists
CREATE SCHEMA IF NOT EXISTS "HPCL_NOVEX";

-- 3. Revoke default public privileges
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "TIBCO";
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "HPCL_NOVEX" FROM "TIBCO";


-- 4. Grant usage on our schema
GRANT USAGE ON SCHEMA public TO "TIBCO";
GRANT USAGE ON SCHEMA "HPCL_NOVEX" TO "TIBCO";

-- 5. Grant read-only access to table
GRANT SELECT ON public.alerts TO "TIBCO";
GRANT SELECT ON "HPCL_NOVEX".dryout_data TO "TIBCO";


-- 6. Optional: prevent accidental writes
ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE ALL ON TABLES FROM "TIBCO";

ALTER DEFAULT PRIVILEGES IN SCHEMA "HPCL_NOVEX"
REVOKE ALL ON TABLES FROM "TIBCO";


"""
engine = create_async_engine(DATABASE_URL, echo=False, future=True)
async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

metadata = MetaData(schema=SCHEMA_NAME)


# ---------------------------------------------------------
# Table definition
# ---------------------------------------------------------
DryOutDailyReport = Table(
    TABLE_NAME,
    metadata,
    Column("sap_id", String, primary_key=True),
    Column("location_name", String),
    Column("terminal_id", String),
    Column("terminal_name", String),
    Column("product_no", String),
    Column("product_name", String),
    Column("product_grp", String),
    Column("zone", String),
    Column("region", String),
    Column("low_volume", Boolean),
    Column("dry_out_start", DateTime),
    Column("indent_no", String, nullable=True),
    Column("valid_indent", Boolean, nullable=True),
    Column("pending_indents", Numeric, nullable=True),
    Column("indent_raised_date", DateTime, nullable=True),
    Column("indent_not_raised_days", Numeric, nullable=True),
    Column("report_date", Date, primary_key=True),
    Column("dry_out_type", String, primary_key=True),
)


# ---------------------------------------------------------
# Create schema + table if not exists
# ---------------------------------------------------------
async def init_schema_and_table():
    async with engine.begin() as conn:
        # Create schema
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA_NAME}"'))

        # Create table
        await conn.run_sync(metadata.create_all)


# ---------------------------------------------------------
# Helper function to normalize datetime fields
# ---------------------------------------------------------
def normalize_datetime_fields(records: List[dict]) -> List[dict]:
    """
    Normalize all datetime fields to timezone-aware UTC datetime objects.
    Converts pandas Timestamps, strings, and naive datetimes to timezone-aware UTC.
    Handles NaT (Not a Time) values from pandas by converting them to None.
    """
    datetime_fields = ['dry_out_start', 'indent_raised_date']
    date_fields = ['report_date']
    
    normalized_records = []
    for record in records:
        normalized_record = record.copy()
        
        # Normalize datetime fields
        for field in datetime_fields:
            if field not in normalized_record:
                continue
                
            value = normalized_record[field]
            
            # Check for None, NaT, or NaN values
            if value is None or pd.isna(value):
                normalized_record[field] = None
                continue
            
            try:
                # Handle pandas Timestamp (including NaT)
                if isinstance(value, pd.Timestamp):
                    if pd.isna(value):
                        normalized_record[field] = None
                        continue
                    dt = value.to_pydatetime()
                    # Check if conversion resulted in a valid datetime
                    if pd.isna(dt):
                        normalized_record[field] = None
                        continue
                # Handle string
                elif isinstance(value, str):
                    # Check for empty or NaN-like strings
                    if not value or value.lower() in ('nan', 'nat', 'none', ''):
                        normalized_record[field] = None
                        continue
                    try:
                        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    except ValueError:
                        try:
                            dt = dateutil_parser.parse(value)
                        except:
                            normalized_record[field] = None
                            continue
                # Handle datetime
                elif isinstance(value, datetime):
                    dt = value
                else:
                    # Try to convert unknown types
                    try:
                        if hasattr(value, 'to_pydatetime'):
                            dt = value.to_pydatetime()
                            if pd.isna(dt):
                                normalized_record[field] = None
                                continue
                        else:
                            normalized_record[field] = None
                            continue
                    except:
                        normalized_record[field] = None
                        continue
                
                # Ensure timezone-aware (UTC)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                else:
                    # Convert to UTC if not already
                    dt = dt.astimezone(timezone.utc)
                
                # Convert to timezone-naive for PostgreSQL DateTime column
                # (PostgreSQL DateTime doesn't store timezone, assumes UTC)
                normalized_record[field] = dt.replace(tzinfo=None)
            except (ValueError, TypeError, OverflowError) as e:
                # If any conversion fails, set to None
                normalized_record[field] = None
        
        # Normalize date fields
        for field in date_fields:
            if field not in normalized_record:
                continue
                
            value = normalized_record[field]
            
            # Check for None, NaT, or NaN values
            if value is None or pd.isna(value):
                normalized_record[field] = None
                continue
            
            try:
                # Handle pandas Timestamp (including NaT)
                if isinstance(value, pd.Timestamp):
                    if pd.isna(value):
                        normalized_record[field] = None
                        continue
                    normalized_record[field] = value.date()
                # Handle string
                elif isinstance(value, str):
                    # Check for empty or NaN-like strings
                    if not value or value.lower() in ('nan', 'nat', 'none', ''):
                        normalized_record[field] = None
                        continue
                    try:
                        normalized_record[field] = datetime.strptime(value, '%Y-%m-%d').date()
                    except ValueError:
                        try:
                            normalized_record[field] = dateutil_parser.parse(value).date()
                        except:
                            normalized_record[field] = None
                # Handle datetime
                elif isinstance(value, datetime):
                    normalized_record[field] = value.date()
                # Handle date
                elif isinstance(value, date):
                    normalized_record[field] = value
                else:
                    normalized_record[field] = None
            except (ValueError, TypeError, AttributeError) as e:
                # If any conversion fails, set to None
                normalized_record[field] = None
        
        normalized_records.append(normalized_record)
    
    return normalized_records


# ---------------------------------------------------------
# Upsert function
# ---------------------------------------------------------
async def upsert_dryout_records(records: List[dict]):
    """
    records => list of dicts matching the model
    Primary key/upsert keys: sap_id + dry_out_type + report_date
    """
    # Normalize all datetime fields before inserting
    normalized_records = normalize_datetime_fields(records)
    
    async with async_session() as session:
        stmt = pg_insert(DryOutDailyReport).values(normalized_records)

        update_fields = {
            c.name: getattr(stmt.excluded, c.name)
            for c in DryOutDailyReport.c
            if c.name not in ("sap_id", "dry_out_type", "report_date")
        }

        upsert_stmt = stmt.on_conflict_do_update(
            index_elements=["sap_id", "dry_out_type", "report_date"],
            set_=update_fields,
        )

        await session.execute(upsert_stmt)
        await session.commit()


def get_indent_raised_date(history_data, report_date):
    if not history_data:
        return None
    report_date_9am = datetime.strptime(
        report_date, '%Y-%m-%d').replace(hour=9, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
    
    for rec in history_data:
        if rec.get('action_msg') == "Indent Raised":
            indent_date = rec.get('ims_datetime', None)
            if indent_date is None or pd.isna(indent_date):
                continue
            
            # Try multiple parsing methods
            try:
                # Handle pandas Timestamp or NaT
                if isinstance(indent_date, pd.Timestamp):
                    if pd.isna(indent_date):
                        continue
                    indent_datetime = indent_date.to_pydatetime()
                    if pd.isna(indent_datetime):
                        continue
                elif isinstance(indent_date, str):
                    if not indent_date or indent_date.lower() in ('nan', 'nat', 'none', ''):
                        continue
                    indent_datetime = datetime.fromisoformat(indent_date.replace('Z', '+00:00'))
                elif isinstance(indent_date, datetime):
                    indent_datetime = indent_date
                else:
                    indent_datetime = dateutil_parser.parse(str(indent_date))
            except (ValueError, AttributeError, TypeError):
                try:
                    indent_datetime = dateutil_parser.parse(str(indent_date))
                except:
                    continue
            
            # Ensure timezone-aware (UTC)
            if indent_datetime.tzinfo is None:
                indent_datetime = indent_datetime.replace(tzinfo=timezone.utc)
            
            # If indent was raised post requested date 9 AM, mark it as None
            if indent_datetime > report_date_9am:
                return None
            
            return indent_datetime
    return None


def get_indent_not_raised_days(record):
    report_datetime_3_30 = datetime.strptime(record['report_date'], '%Y-%m-%d').replace(
        hour=3, minute=30, second=0, microsecond=0, tzinfo=timezone.utc
    )
    report_datetime_9_00 = datetime.strptime(record['report_date'], '%Y-%m-%d').replace(
        hour=9, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
    )

    # Parse created_at and ensure it's timezone-aware (assuming UTC if naive)
    created_at_value = record.get('created_at')
    if created_at_value is None or pd.isna(created_at_value):
        # If created_at is missing, return None or 0
        return None
    
    try:
        if isinstance(created_at_value, pd.Timestamp):
            if pd.isna(created_at_value):
                return None
            created_at_datetime = created_at_value.to_pydatetime()
            if pd.isna(created_at_datetime):
                return None
        elif isinstance(created_at_value, str):
            if not created_at_value or created_at_value.lower() in ('nan', 'nat', 'none', ''):
                return None
            created_at_datetime = datetime.fromisoformat(created_at_value.replace('Z', '+00:00'))
        elif isinstance(created_at_value, datetime):
            created_at_datetime = created_at_value
        else:
            created_at_datetime = datetime.fromisoformat(str(created_at_value))
    except (ValueError, TypeError, AttributeError):
        return None
    
    if created_at_datetime.tzinfo is None:
        created_at_datetime = created_at_datetime.replace(tzinfo=timezone.utc)

    if not record.get('indent_raised_date') or pd.isna(record.get('indent_raised_date')):
        return (report_datetime_3_30 - created_at_datetime).days

    # Parse indent_raised_date and ensure it's timezone-aware (assuming UTC if naive)
    indent_raised_value = record['indent_raised_date']
    if indent_raised_value is None or pd.isna(indent_raised_value):
        return (report_datetime_3_30 - created_at_datetime).days
    
    try:
        if isinstance(indent_raised_value, pd.Timestamp):
            if pd.isna(indent_raised_value):
                return (report_datetime_3_30 - created_at_datetime).days
            indent_raised_datetime = indent_raised_value.to_pydatetime()
            if pd.isna(indent_raised_datetime):
                return (report_datetime_3_30 - created_at_datetime).days
        elif isinstance(indent_raised_value, str):
            if not indent_raised_value or indent_raised_value.lower() in ('nan', 'nat', 'none', ''):
                return (report_datetime_3_30 - created_at_datetime).days
            indent_raised_datetime = datetime.fromisoformat(indent_raised_value.replace('Z', '+00:00'))
        elif isinstance(indent_raised_value, datetime):
            indent_raised_datetime = indent_raised_value
        else:
            indent_raised_datetime = dateutil_parser.parse(str(indent_raised_value))
    except (ValueError, TypeError, AttributeError):
        return (report_datetime_3_30 - created_at_datetime).days
    
    if indent_raised_datetime.tzinfo is None:
        indent_raised_datetime = indent_raised_datetime.replace(tzinfo=timezone.utc)

    if indent_raised_datetime < report_datetime_9_00:
        return 0

    return (report_datetime_3_30 - created_at_datetime).days


def update_product_name(product_no):
    product_mapping = {"3672000": ["POWER 95", "POWER"],
                       "2821000": ["MS", "MS"],
                       "3925000": ["POWER 95", "POWER"],
                       "2812000": ["HSD", "HSD"],
                       "3373000": ["POWER 100", "POWER"],
                       "1683000": ["HSD", "HSD"],
                       "4211000": ["MS", "MS"],
                       "1322100": ["POWER 95", "POWER"],
                       "2822000": ["E20", "MS"],
                       "1683100": ["TURBO", "TURBO"],
                       "1322000": ["MS", "MS"],
                       "2823000": ["MS", "MS"],
                       "2682000": ["POWER 99", "POWER"],
                       "2811000": ["MS", "MS"],
                       "3912000": ["TURBO", "TURBO"],
                       "2816000": ["POWER 99", "POWER"]}
    if product_no in product_mapping:
        return product_mapping[product_no]
    return "", ""


async def get_ro_count_less_50(report_date, df):
    query = (f"SELECT SUBSTRING(CUST_CD, 3) AS CUST_CD, SUM(QTY_KL) AS Total_Net_Weight "
             f"FROM PS.EDW_PRIMARY_SALES_FACT "
             f"WHERE "
             f"INVOICE_DT >= DATE('{report_date}') - INTERVAL 30 DAY "
             f"GROUP BY CUST_CD "
             f"HAVING Total_Net_Weight < 50;")
    creds = credential_loader.get_credentials('TIBCO')
    params = {
        "host": creds['host'],
        "database": creds['database'],
        "user": creds['user'],
        "password": creds['password'],
        "port": creds['port'],
        "connection_type": "mssql"
    }
    conn = dry_out_analysis.get_db_connection(params)
    cursor = conn.cursor()
    cursor.execute(query)
    data = cursor.fetchall()
    columns = [column[0] for column in cursor.description]
    data = pd.DataFrame.from_records(data, columns=columns)
    data['CUST_CD'] = data['CUST_CD'].astype(str)
    unique_locations = data['CUST_CD'].unique().tolist()

    # Low Volume (< 50 KL/PM)
    df['low_volume'] = df['sap_id'].apply(lambda x: x in unique_locations)
    return df


async def fetch_daily_report(report_date: str):
    query = f"""select * FROM dry_out_daily_report WHERE dry_out_date = '{report_date}'"""
    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query)
    if resp['data']:
        alert_ids = resp['data'][0]['dry_out_alert_ids']
        alerts_data = []
        base_alert_query = """select sap_id, location_name, terminal_plant_id, terminal_plant_name,
         product_code, created_at, indent_no, indent_raised_date, alert_history, dry_out_start_time, 
         zone, region from alerts """
        for index in range(0, len(alert_ids), 500):
            ids = ", ".join([f"'{sid}'" for sid in alert_ids[index:index + 500]])
            query = base_alert_query + f""" where id in ({ids})"""
            resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=1000)
            alerts_data.extend(resp['data'])
        df = pd.DataFrame.from_records(alerts_data)
        df['sap_id'] = df['sap_id'].astype(str)
        df['dry_out_type'] = 'DryOut'
        df['report_date'] = report_date
        df['indent_raised_date'] = df['alert_history'].apply(lambda x: get_indent_raised_date(x, report_date))
        df[['product_name', 'product_grp']] = df['product_code'].apply(lambda x: pd.Series(update_product_name(x)))
        df['indent_not_raised_days'] = df.apply(get_indent_not_raised_days, axis=1)
        df = await get_ro_count_less_50(report_date, df)
        valid_indents_count = await retail_data.supply_terminal_wise_counts(by_ro=True)
        valid_indents_count = valid_indents_count[['sap_id',
                                                   'Valid Indent Count (Supply Location+Region)',
                                                   'Average Pending Indent counts from Last 3 Days (Supply Location+Region)']]
        valid_indents_count = valid_indents_count.rename(
            columns={'Valid Indent Count (Supply Location+Region)': 'valid_indent',
                     'Average Pending Indent counts from Last 3 Days (Supply Location+Region)': 'pending_indents'})
        df = df.merge(
            valid_indents_count,
            on="sap_id",
            how="left"  # keeps all rows from df1
        )

        df["valid_indent"] = df["valid_indent"].fillna(0).astype(int).apply(lambda x: True if x > 0 else False)
        df["pending_indents"] = df["pending_indents"].fillna(0)

        df = df.rename(columns={'terminal_plant_name': 'terminal_name', 'terminal_plant_id': 'terminal_id',
                     'product_code': 'product_no', 'created_at': 'dry_out_start'})
        df = df[['sap_id', 'location_name', 'terminal_id', 'terminal_name', 'product_no',
                  'product_name', 'product_grp', 'zone', 'region', 'low_volume', 'dry_out_start',
                  'indent_no', 'valid_indent', 'pending_indents', 'indent_raised_date',
                  'indent_not_raised_days', 'report_date', 'dry_out_type']]
        
        # Replace NaN/NaT values with None for all columns before converting to dict
        # This ensures proper handling of missing values in the database
        df = df.replace({pd.NaT: None, pd.NA: None})
        df = df.where(pd.notna(df), None)
        
        # Convert to dict and clean up any remaining NaN/NaT values
        records = df.to_dict(orient='records')
        for record in records:
            for key, value in record.items():
                if pd.isna(value) or value is pd.NaT or value is pd.NA:
                    record[key] = None
        
        return records
    return []


# ---------------------------------------------------------
# Example Usage
# ---------------------------------------------------------
async def main(report_date=None):
    if not report_date:
        report_date = datetime.today().strftime('%Y-%m-%d')
    await init_schema_and_table()
    data = await fetch_daily_report(report_date)
    if data:
        await upsert_dryout_records(data)


if __name__ == '__main__':
    report_date = None
    if len(sys.argv) > 1:
        report_date = sys.argv[1]
    asyncio.run(main(report_date))
