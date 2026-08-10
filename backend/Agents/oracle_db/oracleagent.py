import sys
import json
import datetime
import typing
import asyncio
import oracledb
import traceback
import pandas as pd
import polars as pl
from rabbitmq_producer import RabbitMQProducer

# Set stdout encoding to UTF-8 to handle non-ASCII characters
sys.stdout.reconfigure(encoding='utf-8')

dtype_map = {
    'String': 'VARCHAR2(255)',
    'Int64': 'NUMBER',
    'Int32': 'NUMBER',
    'Boolean': 'NUMBER(1)',
    'Float64': 'NUMBER',
    'Float32': 'NUMBER',
    'Object': 'VARCHAR2(4000)',
    'Datetime': 'DATE',
    'Utf8': 'NVARCHAR2(255)',
    "Datetime(time_unit='us', time_zone=None)": 'DATE'
}

with open("config.json", "r", encoding="utf-8") as config_file:
    config = json.load(config_file)

# Extract configuration
oracle_config = config["oracle"]
oracle_config["opcdaipmapp"] = config.get("opcdaipmapp", {})
oracle_config["opcdaservicepath"] = config.get("opcdaservicepath", "")
table_names = config["oracle_tables"]
sap_id = config.get("sap_id", "")

# Define table_queries
table_queries = {}


class BaseAction:
    def __init__(self, params: typing.Dict, sleep_duration=30):
        self.params = params
        self.previous_data = set()
        self.sleep_duration = sleep_duration


class Oracle(BaseAction):
    def __init__(self, params: typing.Dict):
        super().__init__(params)

        if 'opcdaipmapp' not in self.params or 'opcdaservicepath' not in self.params:
            raise ValueError("OPC DA IP mapping configuration is required (opcdaipmapp and opcdaservicepath)")

        try:
            # Read and store the OPC DA IP at init time
            current_opcda_ip = self._get_current_opcda_ip()
            if not current_opcda_ip:
                raise ValueError("Could not determine OPC DA IP from service file")

            oracle_ip = self.params['opcdaipmapp'].get(current_opcda_ip)
            if not oracle_ip:
                raise ValueError(f"No Oracle IP mapping found for OPC DA IP {current_opcda_ip}")

            self.params['host'] = oracle_ip

            # Remember which OPC DA IP we are currently connected through
            self.active_opcda_ip = current_opcda_ip

            # Persistent connection — shared across all queries, explicitly closed on IP change
            self._connection = None

            print(f"Using Oracle IP: {oracle_ip} (mapped from OPC DA IP {current_opcda_ip})")

        except Exception as e:
            raise ValueError(f"OPC DA IP mapping failed: {str(e)}")

    # ── NEW: read the OPC DA IP from the service file (static helper) ──────────
    def _get_current_opcda_ip(self):
        """Read the currently configured OPC DA IP from the service file."""
        try:
            opcda_path = self.params['opcdaservicepath']
            print(f"Reading OPC DA IP from file: {opcda_path}")

            with open(opcda_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("ip="):
                        ip = line.split("=")[1].strip()
                        if ip:
                            print(f"Found OPC DA IP: {ip}")
                            return ip

            raise ValueError("No valid IP found in OPC DA service file (looking for line starting with 'ip=')")

        except FileNotFoundError:
            raise ValueError(f"OPC DA service file not found at: {opcda_path}")
        except Exception as e:
            raise ValueError(f"Error reading OPC DA service file: {str(e)}")

    # ── NEW: check whether the IP in the file differs from what we connected with
    def is_opcda_ip_changed(self):
        """
        Returns (changed: bool, new_ip: str | None).
        Reads the service file and compares against self.active_opcda_ip.
        """
        try:
            new_ip = self._get_current_opcda_ip()
            if new_ip and new_ip != self.active_opcda_ip:
                print(f"OPC DA IP changed: {self.active_opcda_ip} → {new_ip}")
                return True, new_ip
            return False, new_ip
        except Exception as e:
            print(f"Warning: Could not check OPC DA IP change: {e}")
            return False, None

    async def get_connection(self):
        # Reuse persistent connection if already open and alive
        if self._connection is not None:
            try:
                self._connection.ping()
                return self._connection
            except Exception:
                print("Existing Oracle connection is no longer alive. Reconnecting...")
                self._connection = None

        self.params['dns'] = f"{self.params['host']}:{self.params['port']}"

        if self.params.get('sid', ''):
            self.params['dns'] += f"/{self.params['sid']}"
        elif self.params.get('service_name', ''):
            self.params['dns'] += f"/{self.params['service_name']}"
        elif self.params.get('database_name', ''):
            self.params['dns'] += f"/{self.params['database_name']}"

        self._connection = oracledb.connect(
            user=self.params["user_name"],
            password=self.params["password"],
            dsn=self.params["dns"]
        )
        print(f"Oracle connection opened -> {self.params['dns']}")
        return self._connection

    async def disconnect(self):
        """Explicitly close and discard the persistent connection completely."""
        if self._connection is not None:
            try:
                self._connection.close()
                print(f"Oracle connection to {self.params.get('dns', self.params.get('host'))} "
                      f"(OPC DA IP: {self.active_opcda_ip}) CLOSED and exited completely.")
            except Exception as e:
                print(f"Warning during connection close: {e}")
            finally:
                self._connection = None
        else:
            print("No active Oracle connection to close.")

    async def get_default_schema(self):
        return None

    async def close_connection(self, connection):
        # NOTE: do NOT close here — connection is persistent and shared.
        # It is only closed explicitly via disconnect() on IP change.
        if 'tunnel' in self.params.keys():
            self.params['tunnel'].stop()

    async def test_connection(self):
        try:
            connection = await self.get_connection()
            await self.close_connection(connection)
            return {"status": True, "message": "Connected to Oracle", "data": []}
        except oracledb.Error as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {"status": False, "message": "Unable to connect to Oracle", "data": []}

    async def get_schema(self, debug=False, **kwargs):
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            cursor.execute("SELECT username FROM sys.all_users")
            row = cursor.fetchall()
            column_names = [desc[0] for desc in cursor.description]
            df = pd.DataFrame({column: [row[i] for row in row] for i, column in enumerate(column_names)})
            await self.close_connection(connection)
            print(df['USERNAME'].unique().tolist())
            df.to_csv("schema-list.csv", index=False)
            return {"status": True, "message": "Success", "data": df['USERNAME'].unique().tolist()}
        except oracledb.Error as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {"status": False, "message": f"Not able to connect {err}", "data": None}

    async def table_name(self, schema_name, debug=False, **kwargs):
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            cursor.execute(f"""SELECT table_name FROM all_tables WHERE OWNER = '{schema_name}'""")
            row = cursor.fetchall()
            column_names = [desc[0] for desc in cursor.description]
            df = pd.DataFrame({column: [row[i] for row in row] for i, column in enumerate(column_names)})
            await self.close_connection(connection)
            print(df['TABLE_NAME'].unique().tolist())
            df.to_csv("tables_list.csv", index=False)
            return {"status": True, "message": "Success", "data": df['TABLE_NAME'].unique().tolist()}
        except oracledb.Error as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {"status": False, "message": f"Not able to connect {err}", "data": None}

    async def primary_key(self, schema_name, table_name, debug=False, **kwargs):
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            cursor.execute(f"SELECT DISTINCT cols.COLUMN_NAME FROM all_constraints cons, "
                           f"all_cons_columns cols WHERE cols.TABLE_NAME = '{table_name}' "
                           f"AND cons.CONSTRAINT_TYPE = 'P' AND cons.STATUS ='ENABLED'")
            row = cursor.fetchall()
            column_names = [desc[0] for desc in cursor.description]
            df = pd.DataFrame({column: [row[i] for row in row] for i, column in enumerate(column_names)})
            await self.close_connection(connection)
            return {"status": True, "message": "Success", "data": df['COLUMN_NAME'].unique().tolist()}
        except oracledb.Error as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {"status": False, "message": f"Not able to connect {err}", "data": None}

    async def column_names(self, schema_name, table_name, debug=False, **kwargs):
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            cursor.execute(f"""SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE TABLE_NAME='{table_name}'""")
            row = cursor.fetchall()
            column_names = [desc[0] for desc in cursor.description]
            df = pd.DataFrame({column: [row[i] for row in row] for i, column in enumerate(column_names)})
            await self.close_connection(connection)
            return {"status": True, "message": "Success", "data": df['COLUMN_NAME'].unique().tolist()}
        except oracledb.Error as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {"status": False, "message": f"Not able to connect {err}", "data": None}

    async def create_table(self, schema_name, table_name, table_schema, debug=False, **kwargs):
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            table_create_sql = ''
            for col, dty in table_schema.items():
                table_create_sql += f'"{col}" {dty}, '
            table_create_sql = table_create_sql[:-1]
            table_create_sql = f"""CREATE TABLE {schema_name}.{table_name} ({table_create_sql})"""
            list_table = await self.table_name(schema_name)
            if table_name not in list_table.get("data", []):
                cursor.execute(table_create_sql)
                connection.commit()
            await self.close_connection(connection)
        except oracledb.Error as err:
            print(err)
            traceback.print_exc(file=sys.stdout)

    async def write_data_from_csv(self, *records, schema_name, table_name, debug=False, **kwargs):
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            records = records[0]
            if not isinstance(records, pl.DataFrame):
                records = pl.DataFrame(records)

            table_schema: typing.Dict[str, str] = {}
            for c in list(records.columns):
                dtype = str(records[c].dtype)
                if dtype not in dtype_map:
                    table_schema[c] = "text"
                else:
                    table_schema[c] = dtype_map[dtype]

            await self.create_table(schema_name, table_name, table_schema)

            csv_file = f"/tmp/{table_name}.csv"
            records.write_csv(csv_file)
            sql = f"""
            LOAD DATA INFILE '{csv_file}'
            INTO TABLE {schema_name}.{table_name}
            FIELDS TERMINATED BY ','
            OPTIONALLY ENCLOSED BY '"'
            TRAILING NULLCOLS
            """
            cursor.execute(sql)
            connection.commit()
            await self.close_connection(connection)
        except oracledb.Error as err:
            print(err)
            traceback.print_exc(file=sys.stdout)

    async def write_data(self, *records, schema_name, table_name, debug=False, **kwargs):
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            records = records[0]
            if not isinstance(records, pl.DataFrame):
                records = pl.DataFrame(records)
            query = f"INSERT INTO {schema_name}.{table_name} ({', '.join(records.columns)}) VALUES ({', '.join([':' + col for col in records.columns])})"
            cursor.executemany(query, records.to_dicts())
            connection.commit()
            await self.close_connection(connection)
        except oracledb.Error as err:
            print(err)
            traceback.print_exc(file=sys.stdout)

    async def get_data(self, table_name, query=None, columns=None, limit=None,
                       debug=False, schema_name=None, **kwargs):
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            if query:
                cursor.execute(query)
            elif schema_name:
                cursor.execute(f"SELECT * FROM {schema_name}.{table_name}")
            else:
                cursor.execute(f"SELECT * FROM {table_name}")
            batch_size = 1000000
            final_df = pd.DataFrame()
            while True:
                rows = cursor.fetchmany(batch_size)
                if not rows:
                    break
                column_names = [desc[0] for desc in cursor.description]
                df = pd.DataFrame({column: [row[i] for row in rows] for i, column in enumerate(column_names)})
                final_df = pd.concat([final_df, df])
            await self.close_connection(connection)
            if debug:
                return {"status": True, "message": "Success", "data": final_df.to_dict(orient='records')}

            try:
                print("Saving data for table:", table_name)
                final_df.to_csv(f"{table_name}.csv", mode='a', index=False, header=False, encoding='utf-8')
                print(f"Data saved to {table_name}.csv")
            except UnicodeEncodeError:
                print(f"Warning: Encoding issue when saving {table_name}.csv - trying alternate encoding")
                final_df.to_csv(f"{table_name}.csv", mode='a', index=False, header=False, encoding='utf-8-sig')

            return pl.from_pandas(final_df)
        except oracledb.Error as err:
            print(f"Oracle Error for table {table_name}: {err}")
            traceback.print_exc(file=sys.stdout)
            return {"status": False, "message": f"Not able to fetch data {err}", "data": []}

    async def get_distinct_values(self, schema_name, table_name, column_name,
                                   where_clause=None, debug=False, **kwargs):
        try:
            columns_mapping = dict()
            connection = await self.get_connection()
            cursor = connection.cursor()
            for column in column_name:
                query = f'''SELECT DISTINCT "{column}" FROM {schema_name}."{table_name}"'''
                if where_clause:
                    where_query = ''
                    for key, value in where_clause.items():
                        where_query += f'"{key}" = \'{value}\' AND '
                    where_query = where_query[:-5]
                    if where_query:
                        query = f'''SELECT DISTINCT "{column}" FROM {schema_name}."{table_name}" WHERE {where_query}'''
                cursor.execute(query)
                rows = cursor.fetchall()
                list_columns = [desc[0] for desc in cursor.description]
                df = pd.DataFrame({col: [row[i] for row in rows] for i, col in enumerate(list_columns)})
                columns_mapping[column] = df[column].unique().tolist()
            await self.close_connection(connection)
            return {"status": True, "message": "Success", "data": columns_mapping}
        except oracledb.Error as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {"status": False, "message": f"Not able to fetch data {err}", "data": []}

    async def execute_query(self, query, debug=False, **kwargs):
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            cursor.execute(query)
            records = cursor.fetchall()
            column_names = [desc[0] for desc in cursor.description]
            records = {column: [record[i] for record in records] for i, column in enumerate(column_names)}
            records = pd.DataFrame(records)
            await self.close_connection(connection)
            return records.to_dict(orient='records')
        except oracledb.Error as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            raise err


class DataMonitor:
    def __init__(self, oracle: Oracle, table_names, sleep_duration=300):
        self.oracle = oracle
        self.table_names = table_names
        self.sleep_duration = sleep_duration
        self.previous_data = {}
        self.table_queries = table_queries

    async def _refresh_oracle_if_ip_changed(self):
        """
        Every cycle: read the OPC DA service file and compare IP with what is
        currently connected.

        - IP NOT changed  → do nothing, keep using the same connection.
        - IP changed      → explicitly close & exit the current Oracle connection
                            completely, then establish a brand-new connection for
                            the new mapped Oracle IP.
        Returns True if a reconnection was performed.
        """
        changed, new_opcda_ip = self.oracle.is_opcda_ip_changed()
        if not changed:
            return False

        old_opcda_ip  = self.oracle.active_opcda_ip
        old_oracle_ip = self.oracle.params.get('host', 'unknown')
        print(f"{'='*60}")
        print(f"OPC DA IP CHANGE DETECTED")
        print(f"  Old OPC DA IP : {old_opcda_ip}  →  Oracle IP: {old_oracle_ip}")
        print(f"  New OPC DA IP : {new_opcda_ip}")
        print(f"{'='*60}")

        # Verify the new IP has a mapping BEFORE closing the old connection
        new_oracle_ip = self.oracle.params['opcdaipmapp'].get(new_opcda_ip)
        if not new_oracle_ip:
            print(f"WARNING: No Oracle IP mapping found for new OPC DA IP {new_opcda_ip}. "
                  f"Keeping existing connection unchanged.")
            return False

        # ── STEP 1: Explicitly close and exit the current connection completely ──
        print(f"Closing existing Oracle connection to {old_oracle_ip} completely...")
        await self.oracle.disconnect()
        print(f"Existing Oracle connection CLOSED. Exited from {old_oracle_ip} successfully.")

        # ── STEP 2: Build a fresh Oracle instance for the new IP ────────────────
        new_params = dict(self.oracle.params)
        new_params.pop('host', None)   # __init__ will set host from mapping
        new_params.pop('dns', None)

        try:
            print(f"Establishing new Oracle connection via OPC DA IP {new_opcda_ip} → Oracle IP {new_oracle_ip} ...")
            new_oracle = Oracle(new_params)

            # Test the new connection before committing to it
            test = await new_oracle.test_connection()
            if not test["status"]:
                print(f"ERROR: New Oracle connection test failed: {test['message']}. "
                      f"Cannot reconnect. Will retry next cycle.")
                return False

            # ── STEP 3: Swap in the new Oracle instance ──────────────────────────
            self.oracle = new_oracle
            print(f"New Oracle connection ESTABLISHED successfully.")
            print(f"  Active OPC DA IP : {new_opcda_ip}")
            print(f"  Active Oracle IP : {new_oracle_ip}")
            print(f"{'='*60}")
            return True

        except Exception as e:
            print(f"ERROR: Failed to create new Oracle instance after IP change: {e}")
            print(traceback.format_exc())
            return False

    async def compare_and_send(self, current_data):
        """
        Compare current data with previous data and send only changed records to RabbitMQ.
        (Logic unchanged — do not modify.)
        """
        try:
            if not current_data:
                print("Warning: No data received to compare. Skipping comparison.")
                return

            changed_data = {}

            for table_name, records in current_data.items():
                if not isinstance(records, list):
                    print(f"Warning: Expected list for table {table_name}, but got {type(records)}")
                    continue

                previous_records = self.previous_data.get(table_name, [])
                new_records = [record for record in records if record not in previous_records]

                if new_records:
                    changed_data[table_name] = new_records

            tables = [
                "HOST_MANUALFANPRINTED",
                "HOST_SICKTTS",
                "HOST_CANCELLEDTTS",
                "HOST_LOCALLOADEDTTS",
                "HOST_BAYREASSIGNMENT",
                "HOST_OVERLOADEDTTS",
                "HOST_UNAUTHORIZEDFLOW",
                "HOST_StandaloneTTs",
                "HOST_TASUserDetails",
                "HOST_LiveTankDetails",
                "HOST_SuspectedLoads",
                "HOST_PLTDetails",
                "HOST_DayEndDetails",
                "HOST_DayEndSummary",
                "HOST_KFACTORCHANGES",
                "HOST_MFMKFACTOR",
                "HOST_MASTERSTATUS",
            ]

            current_date = datetime.datetime.today().date()
            current_datetime = datetime.datetime.now().isoformat()

            for table in tables:
                if table in changed_data:
                    for record in changed_data[table]:
                        record["date"] = current_date
                        record["date_time"] = current_datetime

            if changed_data:
                await RabbitMQProducer().send_to_rabbitmq(changed_data)
                print(f"Sent changed data to RabbitMQ for tables: {list(changed_data.keys())}")
            else:
                print("No changes detected. Nothing to send.")

            self.previous_data = current_data.copy()

        except Exception as e:
            print(traceback.format_exc())
            print(f"Error in compare_and_send: {e}")

    async def fetch_data(self):
        """Fetch data asynchronously from Oracle tables."""
        fetch_start = datetime.datetime.now()
        print(f"[{fetch_start.strftime('%Y-%m-%d %H:%M:%S')}] Fetch started...")
        try:
            tasks = {}
            results = {}

            for table in self.table_names:
                if table == "HOST_UNAUTHORIZEDFLOW":
                    query = f"""
                        SELECT t.*, TO_CHAR(t.timestamp, 'YYYY-MM-DD') AS timestamp
                        FROM {table} t
                        ORDER BY t.bcu_number, t.timestamp
                    """
                    tasks[table] = self.oracle.get_data(table_name=table, query=query)
                elif table in self.table_queries and self.table_queries[table]:
                    tasks[table] = self.oracle.get_data(table_name=table, query=self.table_queries[table])
                else:
                    tasks[table] = self.oracle.get_data(table_name=table)

            for table_name, task in tasks.items():
                try:
                    result = await task
                    results[table_name] = result
                except Exception as e:
                    print(f"Error fetching data for table {table_name}: {e}")
                    results[table_name] = None

            print(f"Number of results: {len(results)}")

            processed_results = {}

            for table_name, result in results.items():
                if result is None:
                    continue
                if isinstance(result, dict):
                    print(f"Error in {table_name}:", result.get("message", "Unknown error"))
                    continue
                if isinstance(result, pl.DataFrame) and result.shape[0] > 0:
                    try:
                        records = result.to_dicts()
                        for record in records:
                            record["sap_id"] = sap_id
                        processed_results[table_name] = records
                        print(f"Processed {len(records)} records for {table_name}")
                    except Exception as e:
                        print(f"Error processing data for table {table_name}: {e}")
                        print(traceback.format_exc())

            print(f"Processed data for {len(processed_results)} tables: {list(processed_results.keys())}")
            return processed_results

        except Exception as e:
            print(traceback.format_exc())
            print(f"Error in fetch_data: {e}")
            return {}

    async def run(self):
        """Periodically check Oracle DB for data changes."""
        try:
            connection_test = await self.oracle.test_connection()
            if not connection_test["status"]:
                print(f"ERROR: Cannot connect to Oracle database: {connection_test['message']}")
                print("Please check your Oracle credentials and connection settings.")
                return

            print("Starting data monitoring... datetime:", datetime.datetime.now().isoformat())
            while True:
                print(f"Fetching data (checking every {self.sleep_duration} seconds)")

                # ── NEW: check for OPC DA IP change before every fetch cycle ──
                ip_changed = await self._refresh_oracle_if_ip_changed()
                if ip_changed:
                    # IP switched — clear previous_data so we don't do a stale diff
                    # against records fetched from the old Oracle instance.
                    print("Clearing previous_data cache after IP change to avoid stale comparison.")
                    self.previous_data = {}

                current_data = await self.fetch_data()

                if current_data:
                    await self.compare_and_send(current_data)
                else:
                    print("No data fetched, skipping comparison")

                await asyncio.sleep(self.sleep_duration)

        except Exception as e:
            print(traceback.format_exc())
            print(f"Error in run: {e}")
            print("Restarting monitoring in 300 seconds...")
            await asyncio.sleep(300)
            await self.run()


async def main():
    oracle = Oracle(oracle_config)

    print("Testing Oracle connection...")
    connection_result = await oracle.test_connection()
    if not connection_result["status"]:
        print(f"ERROR: Could not connect to Oracle: {connection_result['message']}")
        print("Check your connection details in config.json and try again.")
        return

    print("Oracle connection successful!")

    monitor = DataMonitor(oracle, table_names, sleep_duration=300)

    print(f"Configured to monitor {len(table_names)} tables:")
    for i, table in enumerate(table_names):
        print(f"  {i+1}. {table}")

    await monitor.run()


if __name__ == "__main__":
    asyncio.run(main())