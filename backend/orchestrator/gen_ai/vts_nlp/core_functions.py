
import os
import re
import logging
import requests
import pandas as pd
from datetime import datetime
from sqlalchemy import create_engine, text, inspect, exc
import orchestrator.dbconnector.credential_loader as credential_loader
from typing import List, Optional


def get_db_engine():
    """Returns the SQLAlchemy engine for the configured database."""
    try:
        creds = credential_loader.get_credentials('APP_DB')
        connection_string = (
            f"postgresql+psycopg2://{creds['user']}:{creds['password']}@"
            f"{creds['host']}:{creds['port']}/{creds['database']}"
        )
        engine = create_engine(
            connection_string,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            pool_recycle=3600
        )
        return engine
    except Exception as e:
        logging.error(f"Error creating database engine: {e}")
        raise


def validate_sql_against_schema(sql: str) -> bool:
    """Validate if SQL references existing tables."""
    valid_tables = ['vts_alert_history',  'vts_truck_master', 
                   'vts_ongoing_trips', 'alerts','vts_tripauditmaster']
    
    sql_lower = sql.lower()
    for table in valid_tables:
        if table in sql_lower:
            return True
    
    return False

def run_sql_query(sql: str, params: dict = None):
    """Execute SQL query and return results."""
    if not validate_sql_against_schema(sql):
        return pd.DataFrame({
            "error": [f"Generated SQL references non-existent tables. Please rephrase your question."],
            "generated_sql": [sql]
        })
    
    engine = get_db_engine()
    if params is None:
        params = {}
    
    try:
        logging.info(f"Executing SQL: {sql[:200]}...")
        with engine.connect() as conn:
            df = pd.read_sql(text(sql), conn, params=params)
        logging.info(f"Query returned {len(df)} rows")
        return df
        
    except (exc.SQLAlchemyError, Exception) as e:
        logging.error(f"SQL Execution error: {e}")
        return pd.DataFrame({
            "error": [f"Database error: {str(e)}"],
            "generated_sql": [sql]
        })

def is_valid_query(question: str) -> tuple[bool, str]:
    return True, ""

def extract_vehicle_details_safe(vehicle_id: str, engine) -> dict:
    """Extract comprehensive vehicle details with proper column existence checking."""
    vehicle_id = vehicle_id.upper().strip()
    
    details = {
        'vehicle_number': vehicle_id,
        'zone': 'Not available',
        'location_name': 'Not available',
        'transporter_name': 'Not available',
        'tt_risk_score': 'Not available',
        'transporter_risk_score': 'Not available',
        'found_in_tables': [],
        'all_zones': [],
        'all_locations': [],
        'all_transporters': []
    }
    
    def is_valid_value(value):
        """Check if value is valid and non-empty"""
        if not value or pd.isna(value) or value == '':
            return False
        value_str = str(value).strip()
        return len(value_str) > 0 and value_str.lower() not in ['n/a', 'null', 'none', 'unknown']
    
    def check_column_exists(table_name, column_name):
        """Check if column exists in table schema"""
        try:
            inspector = inspect(engine)
            columns = [col['name'] for col in inspector.get_columns(table_name)]
            exists = column_name in columns
            logging.info(f"Column {column_name} in {table_name}: {exists}")
            return exists
        except Exception as e:
            logging.warning(f"Error checking column {column_name} in {table_name}: {e}")
            return False
    
    def extract_values_from_table(table_name, id_column, zone_column, location_column, transporter_column=None):
        """Extract values from table if columns exist"""
        try:
            has_zone = check_column_exists(table_name, zone_column)
            has_location = check_column_exists(table_name, location_column)
            has_transporter = check_column_exists(table_name, transporter_column) if transporter_column else False
            
            select_cols = [id_column]
            if has_zone:
                select_cols.append(zone_column)
            if has_location:
                select_cols.append(location_column)
            if has_transporter:
                select_cols.append(transporter_column)
            
            query = f"SELECT {', '.join(select_cols)} FROM {table_name} WHERE {id_column} = '{vehicle_id}'"
            df = pd.read_sql(text(query), engine)
            
            if not df.empty:
                excluded_tables = ['vts_truck_master', 'alerts']
                if table_name not in excluded_tables:
                    details['found_in_tables'].append(table_name)
                
                if has_zone:
                    zones = [str(z).strip() for z in df[zone_column].dropna() if is_valid_value(z)]
                    details['all_zones'].extend(zones)
                
                if has_location:
                    locations = [str(loc).strip() for loc in df[location_column].dropna() if is_valid_value(loc)]
                    details['all_locations'].extend(locations)
                
                if has_transporter:
                    transporters = [str(t).strip() for t in df[transporter_column].dropna() if is_valid_value(t)]
                    details['all_transporters'].extend(transporters)
            
            return len(df) > 0
            
        except (exc.SQLAlchemyError, Exception) as e:
            logging.warning(f"Error querying {table_name}: {e}")
            return False
    
    try:
        tables_config = [
            ('vts_truck_master', 'truck_no', 'zone', 'location_name', 'transporter_name'),
            ('vts_alert_history', 'tl_number', 'zone', 'location_name', None),
            ('alerts', 'vehicle_number', 'zone', 'location_name', 'transporter_name'),
            ('vts_ongoing_trips', 'tt_number', 'zone', 'location_name', 'transporter_name')
        ]
        
        for table_config in tables_config:
            extract_values_from_table(*table_config)

        try:
            tt_risk_query = f"SELECT risk_score, transporter_code FROM tt_risk_score WHERE tt_number = '{vehicle_id}' LIMIT 1"
            tt_risk_df = pd.read_sql(text(tt_risk_query), engine)

            if not tt_risk_df.empty:
                tt_risk_score = tt_risk_df['risk_score'].iloc[0]
                transporter_code = tt_risk_df['transporter_code'].iloc[0]
                
                if is_valid_value(tt_risk_score):
                    details['tt_risk_score'] = tt_risk_score

                if is_valid_value(transporter_code):
                    prefixed_transporter_code = f"00{transporter_code}"
                    transporter_risk_query = f"SELECT risk_score FROM transporter_risk_score WHERE transporter_code = '{prefixed_transporter_code}' LIMIT 1"
                    transporter_risk_df = pd.read_sql(text(transporter_risk_query), engine)

                    if not transporter_risk_df.empty:
                        transporter_risk_score = transporter_risk_df['risk_score'].iloc[0]
                        if is_valid_value(transporter_risk_score):
                            details['transporter_risk_score'] = transporter_risk_score
        except Exception as risk_e:
            logging.warning(f"Error fetching risk scores for {vehicle_id}: {risk_e}")
        
        details['all_zones'] = sorted(list(set(details['all_zones'])))
        details['all_locations'] = sorted(list(set(details['all_locations'])))
        details['all_transporters'] = sorted(list(set(details['all_transporters'])))
        
        if details['all_zones']:
            details['zone'] = details['all_zones'][0]
        if details['all_locations']:
            details['location_name'] = details['all_locations'][0]
        if details['all_transporters']:
            details['transporter_name'] = details['all_transporters'][0]

        logging.info(f"Vehicle {vehicle_id} details - zones: {details['all_zones']}, locations: {details['all_locations']}, transporters: {details['all_transporters']}")
        logging.info(f"Vehicle {vehicle_id} found in tables: {details['found_in_tables']}")
                    
    except Exception as e:
        logging.error(f"Error in vehicle details extraction: {e}")
        details['error'] = str(e)
    
    return details

async def generate_comprehensive_vehicle_query(vehicle_id: str, engine=None, cross_filters=None) -> str:
    """
    Generate comprehensive query with dynamic column mapping using existing cross-filter logic.
    Filter to show only records with violations and use appropriate datetime columns.
    """
    if engine is None:
        engine = get_db_engine()
    
    def column_exists(table_name, column_name):
        """Check if column exists in table schema"""
        try:
            inspector = inspect(engine)
            columns = [col['name'] for col in inspector.get_columns(table_name)]
            exists = column_name in columns
            logging.info(f"Column {column_name} in {table_name}: {exists}")
            return exists
        except Exception as e:
            logging.warning(f"Error checking column {column_name} in {table_name}: {e}")
            return False
    
    vah_has_zone = column_exists('vts_alert_history', 'zone')
    vah_has_location = column_exists('vts_alert_history', 'location_name')
    vah_has_transporter = column_exists('vts_alert_history', 'transporter_name')
    vah_has_vts_end_datetime = column_exists('vts_alert_history', 'vts_end_datetime')
    vah_has_created_at = column_exists('vts_alert_history', 'created_at')
    
    alerts_has_zone = column_exists('alerts', 'zone')
    alerts_has_location = column_exists('alerts', 'location_name')
    alerts_has_transporter = column_exists('alerts', 'transporter_name')
    
    trips_has_zone = column_exists('vts_ongoing_trips', 'zone')
    trips_has_location = column_exists('vts_ongoing_trips', 'location_name')
    trips_has_transporter = column_exists('vts_ongoing_trips', 'transporter_name')
        
    tam_has_zone = column_exists('vts_tripauditmaster', 'zone')
    tam_has_location = column_exists('vts_tripauditmaster', 'location_name')
    tam_has_transporter = column_exists('vts_tripauditmaster', 'transporter_name') 

    def build_column_with_source(table_alias, column_name, has_column, master_column, table_name):
        """Build column expression and track source"""
        if has_column:
            return {
                'expression': f"{table_alias}.{column_name}",
                'source': table_name
            }
        else:
            return {
                'expression': f"md.{master_column}",
                'source': 'vts_truck_master'
            }
    
    vah_zone = build_column_with_source("vah", "zone", vah_has_zone, "master_zone", "vts_alert_history")
    vah_location = build_column_with_source("vah", "location_name", vah_has_location, "master_location", "vts_alert_history")
    vah_transporter = build_column_with_source("vah", "transporter_name", vah_has_transporter, "master_transporter", "vts_alert_history")
    
    alerts_zone = build_column_with_source("a", "zone", alerts_has_zone, "master_zone", "alerts")
    alerts_location = build_column_with_source("a", "location_name", alerts_has_location, "master_location", "alerts")
    alerts_transporter = build_column_with_source("a", "transporter_name", alerts_has_transporter, "master_transporter", "alerts")
    
    trips_zone = build_column_with_source("vot", "zone", trips_has_zone, "master_zone", "vts_ongoing_trips")
    trips_location = build_column_with_source("vot", "location_name", trips_has_location, "master_location", "vts_ongoing_trips")
    trips_transporter = build_column_with_source("vot", "transporter_name", trips_has_transporter, "master_transporter", "vts_ongoing_trips")
    
    tam_zone = build_column_with_source("tam", "zone", tam_has_zone, "master_zone", "vts_tripauditmaster")
    tam_location = build_column_with_source("tam", "location_name", tam_has_location, "master_location", "vts_tripauditmaster")
    tam_transporter = build_column_with_source("tam", "transporter_name", tam_has_transporter, "master_transporter", "vts_tripauditmaster")

    vah_date_condition = ""
    alerts_date_condition = ""
    crd_date_condition = ""
    trips_date_condition = ""
    tam_date_condition = ""

    if cross_filters:
        for filter_item in cross_filters:
            if hasattr(filter_item, 'key') and filter_item.key == "DATE" and hasattr(filter_item, 'value'):
                date_value = filter_item.value
                if "," in date_value:
                    start_date, end_date = date_value.split(",")
                    start_date = start_date.strip()
                    end_date = end_date.strip()
                    
                    logging.info(f"Applying date filter: {start_date} to {end_date} for vehicle {vehicle_id}")
                    
                    if vah_has_vts_end_datetime:
                        vah_date_condition = f" AND vah.vts_end_datetime::date BETWEEN '{start_date}' AND '{end_date}'"
                        logging.info(f"Using vts_end_datetime for vts_alert_history date filtering")
                    elif vah_has_created_at:
                        vah_date_condition = f" AND vah.created_at::date BETWEEN '{start_date}' AND '{end_date}'"
                        logging.info(f"Using created_at for vts_alert_history date filtering")
                    else:
                        logging.warning("No date column found for vts_alert_history")
                    
                    alerts_date_condition = f" AND a.created_at::date BETWEEN '{start_date}' AND '{end_date}'"
                        
                    trips_date_condition = f" AND vot.created_at::date BETWEEN '{start_date}' AND '{end_date}'"
                    tam_date_condition = f" AND tam.createdat::date BETWEEN '{start_date}' AND '{end_date}'"

                    break
    
    vah_display_time = 'vah.vts_end_datetime' if vah_has_vts_end_datetime else 'vah.created_at'
    
    query = f"""
    WITH master_data AS (
        SELECT 
            truck_no,
            zone as master_zone,
            location_name as master_location,
            transporter_name as master_transporter
        FROM vts_truck_master 
        WHERE truck_no = '{vehicle_id}'
        LIMIT 1
    )
    
    SELECT * FROM (
        -- vts_alert_history (shown as Compliance)
        SELECT
            'Compliance'::TEXT AS "Data Table",
            'vts_alert_history'::TEXT AS "Source Table",  -- Add source table for internal reference
            TRIM(BOTH ', ' FROM
                CONCAT_WS(', ',
                    NULLIF(rtrim(repeat('stoppage_violations_count, ', COALESCE(vah.stoppage_violations_count, 0)::int), ', '), ''),
                    NULLIF(rtrim(repeat('route_deviation_count, ', COALESCE(vah.route_deviation_count_orig, 0)::int), ', '), ''),
                    NULLIF(rtrim(repeat('device_tamper_count, ', COALESCE(vah.device_tamper_count, 0)::int), ', '), ''),
                    NULLIF(rtrim(repeat('main_supply_removal_count, ', COALESCE(vah.main_supply_removal_count, 0)::int), ', '), ''),
                    NULLIF(rtrim(repeat('night_driving_count, ', COALESCE(vah.night_driving_count, 0)::int), ', '), ''),
                    NULLIF(rtrim(repeat('speed_violation_count, ', COALESCE(vah.speed_violation_count, 0)::int), ', '), ''),
                    NULLIF(rtrim(repeat('continuous_driving_count, ', COALESCE(vah.continuous_driving_count, 0)::int), ', '), '')
                )
            ) AS "Event Type",
            {vah_display_time}::TIMESTAMP AS "Event Time",
            {vah_location['expression']} AS "Location Info",
            vah.invoice_number::TEXT AS "Invoice Number",
            'zone: ' || COALESCE({vah_zone['expression']}::text, '') ||
            ', location_name: ' || COALESCE({vah_location['expression']}::text, '') ||
            ', transporter_name: ' || COALESCE({vah_transporter['expression']}::text, '') AS "Additional Detail",
            vah.tl_number::TEXT AS "Vehicle_Identifier"
        FROM vts_alert_history vah
        LEFT JOIN master_data md ON vah.tl_number = md.truck_no
        WHERE vah.tl_number = '{vehicle_id}'
        AND (
            COALESCE(vah.stoppage_violations_count, 0) > 0 OR
            COALESCE(vah.route_deviation_count_orig, 0) > 0 OR
            COALESCE(vah.device_tamper_count, 0) > 0 OR
            COALESCE(vah.main_supply_removal_count, 0) > 0 OR
            COALESCE(vah.night_driving_count, 0) > 0 OR
            COALESCE(vah.speed_violation_count, 0) > 0 OR
            COALESCE(vah.continuous_driving_count, 0) > 0
        )
        {vah_date_condition}

        UNION ALL

        -- alerts (shown as VTS Dashboard)
        SELECT
            'VTS Dashboard'::TEXT AS "Data Table",
            'alerts'::TEXT AS "Source Table",  -- Add source table for internal reference
            COALESCE(a.violation_type, 'Alert') AS "Event Type",
            a.created_at::TIMESTAMP AS "Event Time",
            {alerts_location['expression']} AS "Location Info",
            NULL AS "Invoice Number",
            'zone: ' || COALESCE({alerts_zone['expression']}::text, '') ||
            ', location_name: ' || COALESCE({alerts_location['expression']}::text, '') ||
            ', transporter_name: ' || COALESCE({alerts_transporter['expression']}::text, '') ||
            ', severity: ' || COALESCE(a.severity::TEXT, 'N/A') AS "Additional Detail",
            COALESCE(a.vehicle_number, a.tt_load_number)::TEXT AS "Vehicle_Identifier"
        FROM alerts a
        LEFT JOIN master_data md ON (a.vehicle_number = md.truck_no OR a.tt_load_number = md.truck_no)
        WHERE (a.vehicle_number = '{vehicle_id}' OR a.tt_load_number = '{vehicle_id}')
        AND a.alert_section = 'VTS'
        AND a.alert_status = 'Open'
        AND a.violation_type IS NOT NULL  -- Filter for violations only
        {alerts_date_condition}

        UNION ALL

        -- vts_ongoing_trips (shown as VTS Live)
        SELECT 
            'VTS Live'::TEXT AS "Data Table",
            'vts_ongoing_trips'::TEXT AS "Source Table",  -- Add source table for internal reference
            CASE vot.violation_type
                WHEN 'HS' THEN 'Unauthorized stoppage at Hotspots'
                WHEN 'RD' THEN 'Route deviation beyond 2 km'
                WHEN 'TC' THEN 'Trip pending closure (2+ hrs)'
                WHEN 'WR' THEN 'TT without Route ID'
                ELSE COALESCE(vot.violation_type, 'Ongoing Trip')
            END AS "Event Type",
            vot.created_at::TIMESTAMP AS "Event Time",
            {trips_location['expression']} AS "Location Info",
            vot.invoice_no::TEXT AS "Invoice Number",
            'zone: ' || COALESCE({trips_zone['expression']}::text, '') ||
            ', location_name: ' || COALESCE({trips_location['expression']}::text, '') ||
            ', transporter_name: ' || COALESCE({trips_transporter['expression']}::text, '') AS "Additional Detail",
            vot.tt_number::TEXT AS "Vehicle_Identifier"
        FROM vts_ongoing_trips vot
        LEFT JOIN master_data md ON vot.tt_number = md.truck_no
        WHERE vot.tt_number = '{vehicle_id}'
        AND vot.violation_type IS NOT NULL  -- Filter for violations only
        {trips_date_condition}

        UNION ALL

        -- vts_tripauditmaster (Swipe Out Violations)
        SELECT
            'Trip Audit'::TEXT AS "Data Table",
            'vts_tripauditmaster'::TEXT AS "Source Table",
            TRIM(BOTH ', ' FROM
                CONCAT_WS(', ',
                    CASE WHEN tam.swipeoutL1 = 'False' THEN 'swipeoutL1' ELSE NULL END,
                    CASE WHEN tam.swipeoutL2 = 'False' THEN 'swipeoutL2' ELSE NULL END
                )
            ) AS "Event Type",
            tam.createdat::TIMESTAMP AS "Event Time",
            {tam_location['expression']} AS "Location Info",
            tam.invoicenumber::TEXT AS "Invoice Number",
            'zone: ' || COALESCE({tam_zone['expression']}::text, '') ||
            ', location_name: ' || COALESCE({tam_location['expression']}::text, '') ||
            ', transporter_name: ' || COALESCE({tam_transporter['expression']}::text, '') AS "Additional Detail",
            tam.trucknumber::TEXT AS "Vehicle_Identifier"
        FROM vts_tripauditmaster tam
        LEFT JOIN master_data md ON tam.trucknumber = md.truck_no
        WHERE tam.trucknumber = '{vehicle_id}'
          AND (tam.swipeoutL1 = 'False' OR tam.swipeoutL2 = 'False')
        {tam_date_condition}
    ) AS all_data
    ORDER BY "Event Time" DESC
    LIMIT 100;
    """
    
    logging.info(f"Generated comprehensive query for {vehicle_id}")
    logging.info(f"Date conditions applied:")
    logging.info(f"  - Compliance (vts_alert_history): {vah_date_condition}")
    logging.info(f"  - VTS Dashboard (alerts): {alerts_date_condition}")
    logging.info(f"  - Risk Data: {crd_date_condition}")
    logging.info(f"  - VTS Live (trips): {trips_date_condition}")
    logging.info(f"  - Trip Audit (vts_tripauditmaster): {tam_date_condition}")
    
    return query

async def process_vts_query(vehicle_number: str, question: str = None, context: str = "run_sql", top_k: int = 3, cross_filters: List = None) -> dict:
    """
    Main entry point for processing VTS queries with cross-filters support.
    Handles vehicle lookup, invoice queries, and NL questions.
    """
    try:
        vehicle_pattern = r'^[A-Z]{2}\d{2}[A-Z0-9]{2,6}'
        
        if vehicle_number and re.match(vehicle_pattern, vehicle_number.upper()) and not question:
            try:
                engine = get_db_engine()
                
                basic_details = extract_vehicle_details_safe(vehicle_number, engine)
                
                generated_sql = await generate_comprehensive_vehicle_query(vehicle_number, engine, cross_filters)
                
                resp = {
                    "vehicle_details": basic_details
                }
                
                if context and hasattr(context, 'lower') and "run_sql" in context.lower():
                    df = run_sql_query(generated_sql, params={"vehicle_number": vehicle_number.upper()})

                    if isinstance(df, dict) and "error" in df:
                        resp["query_error"] = df.get("error")
                    else:
                        if not df.empty and "Event Type" in df.columns:
                            try:
                                df['Event Type'] = df['Event Type'].str.split(r',\s*')
                                df = df.explode('Event Type')
                                df['Event Type'] = df['Event Type'].str.strip()
                                df.reset_index(drop=True, inplace=True)
                                logging.info(f"Exploded DataFrame to {len(df)} rows for individual violations.")
                            except Exception as explode_error:
                                logging.error(f"Could not explode DataFrame for event types: {explode_error}")


                            try:
                                summary_df = df.copy()
                                summary_df["Event Type"] = summary_df["Event Type"].str.split(r',\s*')
                                summary_df = summary_df.explode("Event Type")
                                summary_df["Event Type"] = summary_df["Event Type"].str.strip()

                                event_summary = summary_df.groupby("Event Type").size().reset_index(name="count")
                                resp["event_type_summary"] = event_summary.to_dict("records")
                            except Exception as summary_error:
                                logging.error(f"Could not generate event summary: {summary_error}")
                                resp["event_type_summary"] = []

                        try:
                            records = df.to_dict("records")
                            
                            source_tables_in_data = set()
                            zones_in_data = set()
                            locations_in_data = set()
                            transporters_in_data = set()
                            
                            for record in records:
                                source_table = record.get("Source Table", "")
                                if source_table:
                                    source_tables_in_data.add(source_table)
                                
                                additional_detail = record.get("Additional Detail", "")
                                if additional_detail:
                                    zone_match = re.search(r'zone:\s*([^,]+)', additional_detail)
                                    location_match = re.search(r'location_name:\s*([^,]+)', additional_detail)
                                    transporter_match = re.search(r'transporter_name:\s*([^,]+)', additional_detail)
                                    
                                    if zone_match:
                                        zone = zone_match.group(1).strip()
                                        if zone and zone.lower() not in ['', 'n/a', 'null']:
                                            zones_in_data.add(zone)
                                    
                                    if location_match:
                                        location = location_match.group(1).strip()
                                        if location and location.lower() not in ['', 'n/a', 'null']:
                                            locations_in_data.add(location)
                                    
                                    if transporter_match:
                                        transporter = transporter_match.group(1).strip()
                                        if transporter and transporter.lower() not in ['', 'n/a', 'null']:
                                            transporters_in_data.add(transporter)
                            
                            for record in records:
                                if "Source Table" in record:
                                    del record["Source Table"]
                            
                            violation_mapping = {
                                "HS": "Unauthorized stoppage at Hotspots", "RD": "Route deviation beyond 2 km",
                                "TC": "Trip pending closure (2+ hrs)", "WR": "TT without Route ID"
                            }
                            for record in records:
                                if record.get("Data Table") == "VTS Live" and record.get("Event Type") in violation_mapping:
                                    record["Event Type"] = violation_mapping[record["Event Type"]]

                            resp["vehicle_data"] = records
                            resp["row_count"] = len(records)
                            
                            resp["vehicle_details"]["found_in_tables"] = sorted(list(source_tables_in_data))
                            resp["vehicle_details"]["all_zones"] = sorted(list(zones_in_data))
                            resp["vehicle_details"]["all_locations"] = sorted(list(locations_in_data))
                            resp["vehicle_details"]["all_transporters"] = sorted(list(transporters_in_data))
                            
                            if zones_in_data:
                                resp["vehicle_details"]["zone"] = sorted(list(zones_in_data))[0]
                            if locations_in_data:
                                resp["vehicle_details"]["location_name"] = sorted(list(locations_in_data))[0]
                            if transporters_in_data:
                                resp["vehicle_details"]["transporter_name"] = sorted(list(transporters_in_data))[0]
                                    
                        except Exception as df_error:
                            logging.error(f"DataFrame conversion error: {df_error}")
                            resp["vehicle_data"] = []
                            resp["row_count"] = 0

                return {
                    "success": True,
                    "data": resp,
                    "error": None,
                    "message": f"Vehicle details retrieved for {vehicle_number}"
                }
                
            except Exception as vehicle_error:
                logging.error(f"Vehicle lookup error: {vehicle_error}")
                return {
                    "success": False,
                    "data": None,
                    "error": str(vehicle_error),
                    "message": "Error retrieving vehicle details"
                }
        
        return {
            "success": False,
            "data": None,
            "error": "Either question or vehicle_number must be provided",
            "message": "Either question or vehicle_number must be provided"
        }
        
    except Exception as e:
        logging.error(f"Unexpected error in process_vts_query: {e}")
        return {
            "success": False,
            "data": None,
            "error": str(e),
            "message": "Internal error processing VTS query"
        }

logging.info("VTS Query System initialized successfully")

