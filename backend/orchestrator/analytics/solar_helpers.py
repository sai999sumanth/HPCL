import urdhva_base
import hpcl_ceg_model
import dashboard_studio_model
import pyodbc
import os
import datetime
import calendar
import psycopg2
import traceback
import polars as pl

import orchestrator.dbconnector.credential_loader as credential_loader
from orchestrator.dbconnector.widget_actions import widget_actions


class SolarHelpers:
    """
    Helper class for solar capacity analytics operations.
    Contains utility methods used by SolarCapacity class.
    """

    @classmethod
    def validate_filters_for_query(cls, filters, query=None, available_columns=None):
        """
        Validate filters against available columns in a query.
        Only returns filters that reference columns present in the query.

        Args:
            filters (list): List of filter objects/dicts
            query (str, optional): SQL query string to extract columns from
            available_columns (list, optional): List of available column names

        Returns:
            list: List of valid filters that reference existing columns
        """
        if not filters:
            return []

        # Extract available columns from query if provided
        if query and not available_columns:
            # Simple extraction of column names from SELECT statement
            import re
            # Try to find columns in SELECT ... FROM pattern
            select_match = re.search(r'SELECT\s+(.*?)\s+FROM', query, re.IGNORECASE)
            if select_match:
                columns_str = select_match.group(1)
                # Extract column names (handle aliases, functions, etc.)
                # This is a simple approach - may need refinement
                columns = [col.strip().split(' AS ')[0].strip().split(' ')[-1].replace('"', '').replace("'", '')
                          for col in columns_str.split(',')]
                available_columns = [col.lower() for col in columns if col]

        if not available_columns:
            # If no columns found, return all filters (no validation)
            return filters.copy() if isinstance(filters, list) else []

        # Normalize available columns to lowercase
        available_columns_lower = [col.lower() for col in available_columns]

        # Filter out filters that reference columns not in the query
        valid_filters = []
        for filter_item in filters:
            # Extract key from filter_item (handle both dict and object)
            if isinstance(filter_item, dict):
                key = filter_item.get('key', '')
            elif hasattr(filter_item, 'key'):
                key = filter_item.key
            elif hasattr(filter_item, 'dict'):
                key = filter_item.dict().get('key', '')
            else:
                continue

            # Remove quotes and check case-insensitive
            key_clean = str(key).replace('"', '').replace("'", '').lower().strip()

            # Check if key matches any available column (case-insensitive)
            if key_clean in available_columns_lower:
                valid_filters.append(filter_item)

        return valid_filters

    @classmethod
    async def enrich_with_location_master(cls, df: pl.DataFrame, join_column: str = "BU Code", filters=None, drill_state=""):
        """
        Enrich a DataFrame with location_master data by joining on sap_id.

        Args:
            df (pl.DataFrame): DataFrame to enrich with location_master data
            join_column (str): Column name in df to use for joining (default: "BU Code")
            filters (list, optional): Filters to apply to location_master query
            drill_state (str, optional): Drill state for filter application

        Returns:
            pl.DataFrame: DataFrame enriched with location_master columns (bu, sap_id, name, zone)
        """
        try:
            # Get location_master data
            query = f"SELECT bu, sap_id, name, zone from location_master"

            # Available columns in location_master query
            available_columns = ['bu', 'sap_id', 'name', 'zone']

            # Apply filters if provided
            if filters:
                # Validate filters against available columns
                valid_filters = cls.validate_filters_for_query(filters, available_columns=available_columns)

                # Add clause conditions
                valid_filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                          for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]

                # Apply only valid filters
                if valid_filters:
                    query = await widget_actions.WidgetActions.apply_filter_drilldown(query, valid_filters, drill_state)

            result = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
            rows = result.get("data", [])

            # Use join_column as sap_id for joining
            if join_column not in df.columns:
                return df

            # Convert to Polars DataFrame
            if rows:
                location_df = pl.DataFrame(rows)
                # Clean sap_id (remove leading zeros) for matching
                if "sap_id" in location_df.columns:
                    location_df = location_df.with_columns(
                        pl.col("sap_id").cast(pl.Utf8).str.replace_all(r"^00+", "").alias("sap_id")
                    )

                # Clean the join column for matching (remove leading zeros)
                df = df.with_columns(
                    pl.col(join_column).cast(pl.Utf8).str.replace_all(r"^00+", "").alias("sap_id_clean")
                )

                # Join on sap_id
                df = df.join(
                    location_df.select(["bu", "sap_id", "name", "zone"]).unique(subset=["sap_id"]).with_columns(pl.col("sap_id").alias("sap_id_join")),
                    left_on="sap_id_clean",
                    right_on="sap_id_join",
                    how="left"
                )

                # Drop the temporary column
                df = df.drop("sap_id_clean")
            else:
                # If no location_master data, add columns with null values
                df = df.with_columns([
                    pl.lit(None).cast(pl.Utf8).alias("bu"),
                    pl.lit(None).cast(pl.Utf8).alias("sap_id"),
                    pl.lit(None).cast(pl.Utf8).alias("name"),
                    pl.lit(None).cast(pl.Utf8).alias("zone")
                ])

            return df
        except Exception as e:
            print(f"Error enriching with location_master: {e}")
            traceback.print_exc()
            return df

    @classmethod
    async def get_solar_master_data(cls, filters=None, drill_state=""):
        """
        Read solar installation master data from Excel file and enrich with location_master data.

        Args:
            filters (list, optional): Filters to apply to location_master query during enrichment
            drill_state (str, optional): Drill state for filter application

        Returns:
            polars DataFrame: DataFrame containing solar installation data enriched with location_master data

        Raises:
            Exception: If file cannot be read or doesn't exist
        """
        try:
            base_path = os.path.join(urdhva_base.settings.base_path, 'orchestrator', 'masters',
                                     'Solar_installation.xlsx')
            if not os.path.exists(base_path):
                return {'status': False, 'message': 'File not found', 'data': []}
            solar = pl.read_excel(base_path)

            # Enrich with location_master data (vlookup to get bu, sap_id, name, zone)
            solar = await cls.enrich_with_location_master(solar, join_column="BU Code", filters=filters, drill_state=drill_state)

            return solar

        except Exception as e:
            print(f"Error reading solar master data: {e}")
            traceback.print_exc()
            raise

    @classmethod
    def get_db_connection(cls, bu: str = None, db_name: str = None):
        """
        Establish a database connection.

        Args:
            bu (str, optional): Business unit name. If provided, db_name will be constructed as f'{bu}_SOLAR'
            db_name (str, optional): Name of the database credential to retrieve.
                                     If bu is provided, this will be overridden by f'{bu}_SOLAR'
                                     If neither bu nor db_name is provided, defaults to 'SOLAR'

        Returns:
            pyodbc connection: Database connection object
        """
        if bu:
            db_name = f'{bu}_SOLAR'
        elif not db_name:
            db_name = 'SOLAR'

        creds = credential_loader.get_credentials(db_name)
        connection = pyodbc.connect(
            'DRIVER={ODBC Driver 18 for SQL Server};'
            f'Server={creds["host"]},{creds["port"]};'
            f'Database={creds.get("database", "ION_Data")};'
            f'UID={creds["user"]};'
            f'PWD={creds["password"]};'
            'TrustServerCertificate=yes;MARS_Connection=yes;',
        )
        return connection

    @classmethod
    async def fetch_data(cls, cursor, query, getData=False, params=None, enrich_with_location=True, filters=None, drill_state=""):
        """
        Fetch data from database using a SQL query.

        Args:
            cursor (pyodbc cursor or None): Database cursor. If None and params provided, will use PostgreSQL
            query (str): SQL query to execute
            getData (bool): If True, fetch and return data as DataFrame. If False, just execute query
            params (dict, optional): PostgreSQL connection parameters if using PostgreSQL instead of pyodbc
                Should contain: host, database, user, password, port
            enrich_with_location (bool): If True, enrich data with location_master using PLANT_CD as join column
            filters (list, optional): Filters to apply to location_master query during enrichment
            drill_state (str, optional): Drill state for filter application

            Returns:
            polars DataFrame if getData=True, None otherwise
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

        cursor.execute(query)

        if getData:
            data = cursor.fetchall()
            columns = [column[0] for column in cursor.description]
            # Convert to Polars DataFrame
            if data:
                # Convert list of tuples to dict format for Polars
                data_dict = {col: [row[i] for row in data] for i, col in enumerate(columns)}
                data = pl.DataFrame(data_dict)
            else:
                data = pl.DataFrame(schema=columns)

            # Enrich with location_master if requested and PLANT_CD column exists
            if enrich_with_location and "PLANT_CD" in data.columns:
                try:
                    # Enrich with location_master using PLANT_CD as join column, passing filters
                    data = await cls.enrich_with_location_master(data, join_column="PLANT_CD", filters=filters, drill_state=drill_state)
                except Exception as e:
                    print(f"Warning: Could not enrich with location_master: {e}")
                    traceback.print_exc()

            if params:
                cursor.close()
                pg_conn.close()
            return data

        if params:
            pg_conn.commit()
            cursor.close()
            pg_conn.close()

    @staticmethod
    def _get_capped_month_range(current_date, months):
        """
        Month-based range ending at current_date,
        capped to months * 31 days.
        """
        year = current_date.year
        month = current_date.month - months
        while month <= 0:
            month += 12
            year -= 1
        try:
            month_ago = current_date.replace(year=year, month=month)
        except ValueError:
            # Handle month-end overflow (e.g., March 31 → Feb 28/29)
            _, last_day = calendar.monthrange(year, month)
            month_ago = current_date.replace(
                year=year,
                month=month,
                day=last_day
            )
        max_days = months * 31
        actual_days = (current_date - month_ago).days
        if (actual_days + 1) > max_days:
            start_date = current_date - datetime.timedelta(days=max_days - 1)
        else:
            start_date = month_ago
        return start_date, current_date

    @classmethod
    def extract_date_range_from_filters(cls, filters):
        """
        Extract date range from filters (date_filter, date_range, or comparison operators).

        Args:
            filters (list): List of filter objects/dicts

        Returns:
            tuple: (start_date, end_date) as datetime.date objects, or (None, None) if not found
        """
        if not filters:
            return None, None

        start_date = None
        end_date = None

        for filter_item in filters:
            # Convert filter_item to dict if it's an object
            if not isinstance(filter_item, dict):
                if hasattr(filter_item, 'dict'):
                    filter_dict = filter_item.dict()
                elif hasattr(filter_item, '__dict__'):
                    filter_dict = filter_item.__dict__
                else:
                    continue
            else:
                filter_dict = filter_item

            # Support multiple key names
            col = filter_dict.get("key") or filter_dict.get("columns") or filter_dict.get("column") or filter_dict.get("field") or filter_dict.get("col")
            op = (filter_dict.get("cond") or filter_dict.get("operator") or filter_dict.get("op") or "").strip().lower()
            val = filter_dict.get("value") or filter_dict.get("val")

            # Check if this is a date-related filter on TimestampUTC or similar date columns
            if col and col.lower() in ['timestamputc', 'date', 'reading_date']:
                # Handle comparison operators
                if op in ['>=', '>']:
                    try:
                        if isinstance(val, str):
                            # Try parsing YYYY-MM-DD first
                            parsed_date = None
                            try:
                                parsed_date = datetime.datetime.strptime(val[:10], "%Y-%m-%d").date()
                            except ValueError:
                                pass

                            if parsed_date:
                                start_date = parsed_date
                    except Exception:
                        pass
                elif op in ['<=', '<']:
                    try:
                        if isinstance(val, str):
                            # Try parsing YYYY-MM-DD first
                            parsed_date = None
                            try:
                                parsed_date = datetime.datetime.strptime(val[:10], "%Y-%m-%d").date()
                            except ValueError:
                                pass

                            if parsed_date:
                                end_date = parsed_date
                    except Exception:
                        pass
                # Handle date_filter and date_range
                elif op in ['date_filter', 'date_range']:
                    if op == 'date_range' and isinstance(val, str) and ',' in val:
                        # Date range: start,end
                        date_range = val.split(",")
                        if len(date_range) == 2:
                            try:
                                s_date = datetime.datetime.strptime(date_range[0].strip(), "%Y-%m-%d").date()
                                e_date = datetime.datetime.strptime(date_range[1].strip(), "%Y-%m-%d").date()
                                start_date = s_date
                                end_date = e_date
                            except ValueError:
                                pass
                    elif op == 'date_filter':
                        # Handle date_filter special values
                        current_date = datetime.date.today()

                        if isinstance(val, str) and ',' in val:
                            # Date range in date_filter (e.g., "2025-01-01,2025-01-15")
                            date_range = val.split(",")
                            if len(date_range) == 2:
                                try:
                                    s_date = datetime.datetime.strptime(date_range[0].strip(), "%Y-%m-%d").date()
                                    e_date = datetime.datetime.strptime(date_range[1].strip(), "%Y-%m-%d").date()
                                    start_date = s_date
                                    end_date = e_date
                                except ValueError:
                                    pass
                        elif isinstance(val, str) and len(val) == 10:  # Single date YYYY-MM-DD
                            try:
                                single_date = datetime.datetime.strptime(val, "%Y-%m-%d").date()
                                start_date = single_date
                                end_date = single_date
                            except ValueError:
                                pass
                        elif isinstance(val, str):
                            # Handle special date_filter values
                            if val == 't':
                                # 't' means today, so start and end are today
                                # But apply_filters_to_dataframe handles 't' with > current_datetime logic
                                # For extracting range, returning today is fine
                                start_date = current_date
                                end_date = current_date
                            elif val == '1d' or val == '1y':
                                yesterday = current_date - datetime.timedelta(days=1)
                                start_date = yesterday
                                end_date = yesterday
                            elif val == '1w':
                                week_ago = current_date - datetime.timedelta(days=6)
                                start_date = week_ago
                                end_date = current_date
                            elif val == '15d':
                                days_ago = current_date - datetime.timedelta(days=14)
                                start_date = days_ago
                                end_date = current_date
                            elif val == '1m':
                                start_date, end_date = cls._get_capped_month_range(current_date, 1)

                            elif val == '3m':
                                start_date, end_date = cls._get_capped_month_range(current_date, 3)

                            elif val == '6m':
                                start_date, end_date = cls._get_capped_month_range(current_date, 6)
                            elif val == '24h':
                                start_date = current_date
                                end_date = current_date

        return start_date, end_date

    @classmethod
    def apply_filters_to_dataframe(cls, df: pl.DataFrame, filters):
        """
        Apply filters to a Polars DataFrame based on WidgetFiltersCreate objects.

        Args:
            df (pl.DataFrame): DataFrame to filter
            filters (list): List of WidgetFiltersCreate objects or dicts with 'key'/'column'/'field'/'col', 'cond'/'operator'/'op', 'value'/'val'

        Returns:
            pl.DataFrame: Filtered DataFrame
        """
        if not filters:
            return df

        try:
            df_columns = df.columns

            filter_list = []

            # Convert filters to a list of dicts
            for filter_item in filters:
                if not isinstance(filter_item, dict):
                    if hasattr(filter_item, 'dict'):
                        filter_dict = filter_item.dict()
                    elif hasattr(filter_item, '__dict__'):
                        filter_dict = filter_item.__dict__
                    else:
                        continue
                else:
                    filter_dict = filter_item
                filter_list.append(filter_dict)

            # Apply filters using simpler approach
            for f in filter_list:
                # Support multiple key names: key, columns, column, field, col
                col = f.get("key") or f.get("columns") or f.get("column") or f.get("field") or f.get("col")
                # Support multiple operator names: cond, operator, op
                op = (f.get("cond") or f.get("operator") or f.get("op") or "").strip()
                # Support multiple value names: value, val
                val = f.get("value") or f.get("val")

                # Normalize column name
                col = str(col).strip() if col else ""

                if not col or col not in df_columns:
                    continue

                expr = pl.col(col)
                op_lower = op.lower()

                try:
                    # Handle date_filter and date_range first (complex logic)
                    if op_lower == 'date_filter':
                        date_col = pl.col(col)
                        if df[col].dtype == pl.Utf8:
                            date_col = pl.col(col).str.strptime(pl.Date, format="%Y-%m-%d", strict=False)
                        elif df[col].dtype not in [pl.Date, pl.Datetime]:
                            date_col = pl.col(col).cast(pl.Date, strict=False)

                        current_date = datetime.date.today()
                        current_datetime = datetime.datetime.now()

                        if val == '24h':
                            if df[col].dtype == pl.Datetime:
                                df = df.filter(pl.col(col) >= current_datetime - datetime.timedelta(hours=24))
                            else:
                                df = df.filter(date_col == pl.lit(current_date))
                        elif val == 't':
                            # User requested >= and 't' as current date (no time)
                            # For 'today', we want data exactly from today onwards (which usually means today)
                            # Or if it's strictly just 'today', it should probably be ==
                            # But usually 't' means 'today' filter.
                            # The issue might be string comparison vs date comparison.
                            # Let's ensure strict date comparison

                            # If the intention is "Today", it should be == current_date
                            # If the intention is "Today onwards", it should be >= current_date
                            # Given standard analytics filters, 't' usually means "Today" (this specific day)

                            df = df.filter(date_col == pl.lit(current_date))
                        elif val == '1d' or val == '1y':
                            yesterday = current_date - datetime.timedelta(days=1)
                            df = df.filter((date_col >= pl.lit(yesterday)) & (date_col < pl.lit(current_date)))
                        elif val == '1w':
                            week_ago = current_date - datetime.timedelta(days=6)
                            df = df.filter(date_col >= pl.lit(week_ago))
                        elif val == '15d':
                            days_ago = current_date - datetime.timedelta(days=14)
                            df = df.filter(date_col >= pl.lit(days_ago))
                        elif val == '1m':
                            start_date, _ = cls._get_capped_month_range(current_date, 1)
                            df = df.filter(date_col >= pl.lit(start_date))
                        elif val == '3m':
                            start_date, _ = cls._get_capped_month_range(current_date, 3)
                            df = df.filter(date_col >= pl.lit(start_date))
                        elif val == '6m':
                            start_date, _ = cls._get_capped_month_range(current_date, 6)
                            df = df.filter(date_col >= pl.lit(start_date))
                        elif isinstance(val, str) and ',' in val:
                            date_range = val.split(",")
                            if len(date_range) == 2:
                                start, end = date_range[0].strip(), date_range[1].strip()
                                try:
                                    start_date = datetime.datetime.strptime(start, "%Y-%m-%d").date()
                                    end_date = datetime.datetime.strptime(end, "%Y-%m-%d").date()
                                    df = df.filter((date_col >= pl.lit(start_date)) & (date_col <= pl.lit(end_date)))
                                except ValueError:
                                    pass
                            else:
                                try:
                                    single_date = datetime.datetime.strptime(date_range[0].strip(), "%Y-%m-%d").date()
                                    df = df.filter(date_col == pl.lit(single_date))
                                except ValueError:
                                    pass
                        else:
                            try:
                                single_date = datetime.datetime.strptime(str(val), "%Y-%m-%d").date()
                                df = df.filter(date_col == pl.lit(single_date))
                            except ValueError:
                                pass
                        continue

                    elif op_lower == 'date_range':
                        if isinstance(val, str) and ',' in val:
                            date_range = val.split(",")
                            if len(date_range) == 2:
                                start, end = date_range[0].strip(), date_range[1].strip()
                                date_col = pl.col(col)
                                if df[col].dtype == pl.Utf8:
                                    date_col = pl.col(col).str.strptime(pl.Date, format="%Y-%m-%d", strict=False)
                                elif df[col].dtype not in [pl.Date, pl.Datetime]:
                                    date_col = pl.col(col).cast(pl.Date, strict=False)
                                try:
                                    start_date = datetime.datetime.strptime(start, "%Y-%m-%d").date()
                                    end_date = datetime.datetime.strptime(end, "%Y-%m-%d").date()
                                    df = df.filter((date_col >= pl.lit(start_date)) & (date_col <= pl.lit(end_date)))
                                except ValueError:
                                    pass
                            else:
                                date_col = pl.col(col)
                                if df[col].dtype == pl.Utf8:
                                    date_col = pl.col(col).str.strptime(pl.Date, format="%Y-%m-%d", strict=False)
                                elif df[col].dtype not in [pl.Date, pl.Datetime]:
                                    date_col = pl.col(col).cast(pl.Date, strict=False)
                                try:
                                    single_date = datetime.datetime.strptime(date_range[0].strip(), "%Y-%m-%d").date()
                                    df = df.filter(date_col == pl.lit(single_date))
                                except ValueError:
                                    pass
                        continue

                    # Handle TimestampUTC special case for equals
                    if col == 'TimestampUTC' and df[col].dtype in [pl.Datetime] and op_lower in ['=', 'equals', 'equal']:
                        if isinstance(val, list):
                            df = df.filter(expr.cast(pl.Date).cast(pl.Utf8).is_in([str(v) for v in val]))
                        elif isinstance(val, str) and ',' in val:
                            values_list = [v.strip() for v in val.split(',')]
                            df = df.filter(expr.cast(pl.Date).cast(pl.Utf8).is_in(values_list))
                        else:
                            df = df.filter(expr.cast(pl.Date).cast(pl.Utf8) == str(val))
                        continue

                    # Standard operators
                    if op_lower in ["=", "equals", "equal"]:
                        if isinstance(val, list):
                            df = df.filter(expr.is_not_null() & expr.is_in(val))
                        elif isinstance(val, str) and ',' in val:
                            values_list = [v.strip() for v in val.split(',')]
                            df = df.filter(expr.is_not_null() & expr.cast(pl.Utf8).str.strip_chars().is_in(values_list))
                        else:
                            df = df.filter(expr.is_not_null() & (expr.cast(pl.Utf8).str.strip_chars() == str(val)))
                    elif op_lower in ["!=", "not_equals"]:
                        df = df.filter(expr != val)
                    elif op_lower == "contains":
                        if isinstance(val, str) and ',' in val:
                            values_list = [v.strip() for v in val.split(',')]
                            condition = pl.lit(False)
                            for v in values_list:
                                condition = condition | (expr.cast(pl.Utf8).str.contains(str(v), literal=True))
                            df = df.filter(condition)
                        else:
                            df = df.filter(expr.cast(pl.Utf8).str.contains(str(val), literal=True))
                    elif op_lower in ["in", "one-off", " "]:
                        if isinstance(val, list):
                            df = df.filter(expr.is_in(val))
                        elif isinstance(val, str) and ',' in val:
                            values_list = [v.strip() for v in val.split(',')]
                            df = df.filter(expr.cast(pl.Utf8).str.strip_chars().is_in(values_list))
                        else:
                            df = df.filter(expr.cast(pl.Utf8).str.strip_chars() == str(val))
                    elif op_lower == "prefix":
                        df = df.filter(expr.cast(pl.Utf8).str.starts_with(str(val)))
                    elif op_lower == "suffix":
                        df = df.filter(expr.cast(pl.Utf8).str.ends_with(str(val)))
                    elif op_lower == "pattern":
                        df = df.filter(expr.cast(pl.Utf8).str.contains(str(val), literal=False))
                    elif op_lower in [">", "<", ">=", "<="]:
                        # Handle date/datetime columns for comparison operators
                        if df[col].dtype in [pl.Date, pl.Datetime]:
                            # Convert string value to appropriate date/datetime type
                            if isinstance(val, str):
                                try:
                                    if df[col].dtype == pl.Datetime:
                                        # Try parsing as datetime
                                        try:
                                            parsed_val = datetime.datetime.strptime(val, "%Y-%m-%d %H:%M:%S")
                                        except ValueError:
                                            try:
                                                parsed_val = datetime.datetime.strptime(val, "%Y-%m-%d")
                                            except ValueError:
                                                parsed_val = datetime.datetime.strptime(val, "%Y-%m-%dT%H:%M:%S")
                                    else:
                                        # Date type
                                        parsed_val = datetime.datetime.strptime(val, "%Y-%m-%d").date()

                                    if op_lower == ">":
                                        df = df.filter(expr > pl.lit(parsed_val))
                                    elif op_lower == "<":
                                        df = df.filter(expr < pl.lit(parsed_val))
                                    elif op_lower == ">=":
                                        df = df.filter(expr >= pl.lit(parsed_val))
                                    elif op_lower == "<=":
                                        df = df.filter(expr <= pl.lit(parsed_val))
                                except ValueError:
                                    pass
                            else:
                                if op_lower == ">":
                                    df = df.filter(expr > pl.lit(val))
                                elif op_lower == "<":
                                    df = df.filter(expr < pl.lit(val))
                                elif op_lower == ">=":
                                    df = df.filter(expr >= pl.lit(val))
                                elif op_lower == "<=":
                                    df = df.filter(expr <= pl.lit(val))
                        else:
                            if op_lower == ">":
                                df = df.filter(expr > val)
                            elif op_lower == "<":
                                df = df.filter(expr < val)
                            elif op_lower == ">=":
                                df = df.filter(expr >= val)
                            elif op_lower == "<=":
                                df = df.filter(expr <= val)
                except Exception:
                    continue

            return df

        except Exception as e:
            print(f"Error applying filters to DataFrame: {e}")
            traceback.print_exc()
            return df

    @classmethod
    def _clean_plant_code(cls, code):
        """Helper method to clean plant code by removing leading zeros."""
        if code is None:
            return None
        code_str = str(code).strip()
        if not code_str:
            return None
        cleaned = code_str.lstrip('0')
        return cleaned if cleaned else code_str
