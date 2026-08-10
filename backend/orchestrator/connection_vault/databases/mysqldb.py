import urdhva_base
import os
import sys
import typing
import traceback
import pandas as pd
import polars as pl
import mysql.connector
import hpcl_ceg_model
from sshtunnel import SSHTunnelForwarder


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


class BaseAction:
    def __init__(self, params: typing.Dict):
        self.params = params


class Mysqldb(BaseAction):
    def __init__(self, params: typing.Dict):
        super().__init__(params)

    async def get_connection(self):
        if 'connection_name' in self.params.keys():
            self.params = await hpcl_ceg_model.CredsModel.get(self.params['connection_name'])
        if not isinstance(self.params, dict):
            self.params = self.params.__dict__
        if 'credentials' in self.params.keys():
            self.params = self.params['credentials']
            self.params["password"] = urdhva_base.types.Secret(self.params['password']).get_secret()
        if self.params.get('is_ssh_tunnel', False):
            tunnel = SSHTunnelForwarder(
                (self.params['ssh_tunnel']['host'], self.params['ssh_tunnel']['port']),
                ssh_username=self.params['ssh_tunnel']['user_name'],
                ssh_pkey=self.params['ssh_tunnel']['private_key'] if 'private_key' in self.params[
                    'ssh_tunnel'].keys() else None,
                ssh_password=self.params['ssh_tunnel']['password'] if 'password' in self.params[
                    'ssh_tunnel'].keys() else None,
                remote_bind_address=(self.params['host'], self.params['port']),
            )
            tunnel.start()
            self.params['host'] = tunnel.local_bind_host
            self.params['port'] = tunnel.local_bind_port
            self.params['tunnel'] = tunnel
        connection = mysql.connector.connect(
            host=self.params["host"],
            user=self.params["user_name"],
            passwd=self.params["password"],
            port=self.params["port"],
            database=self.params["database_name"]
        )
        return connection

    async def get_default_schema(self):
        return None

    async def close_connection(self, connection):
        if connection:
            connection.close()
        if 'tunnel' in self.params.keys():
            self.params['tunnel'].stop()

    async def test_connection(self):
        try:
            connection = self.get_connection()
            # connection.close()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Connected to MySQL",
                "data": []
            }
        except mysql.connector.Error as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": "Unable to connect to MySQL",
                "data": []
            }

    async def get_databases(self, debug=False, **kwargs):
        """
        @description:
        :param debug:
        :return:
        """
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            cursor.execute("SHOW DATABASES")
            list_of_database = cursor.fetchall()
            list_of_database = [i for i in list_of_database]
            # connection.close()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Success",
                "data": list_of_database
            }
        except mysql.connector.Error as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": f"Not able to connect {err}", "data": None
            }

    async def get_schema(self, debug=False, **kwargs):
        """
        @description:
        :param debug:
        :return:
        """
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            cursor.execute("SELECT schema_name FROM information_schema.schemata")
            row = cursor.fetchall()
            column_names = [desc[0] for desc in cursor.description]
            df = pd.DataFrame({column: [row[i] for row in row] for i, column in enumerate(column_names)})
            # connection.close()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Success",
                "data": df['schema_name'].unique().tolist()
            }
        except mysql.connector.Error as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": f"Not able to connect {err}", "data": None
            }

    async def table_name(self, schema_name, debug=False, **kwargs):
        """
        @description:
        :param schema_name:
        :param debug:
        :return:
        """
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            cursor.execute(f"SELECT table_name FROM information_schema.tables")
            row = cursor.fetchall()
            column_names = [desc[0] for desc in cursor.description]
            df = pd.DataFrame({column: [row[i] for row in row] for i, column in enumerate(column_names)})
            # connection.close()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Success",
                "data": df['table_name'].unique().tolist()
            }
        except mysql.connector.Error as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": f"Not able to connect {err}", "data": None
            }

    async def primary_key(self, schema_name, table_name, debug=False, **kwargs):
        """
        @description:
        :param schema_name:
        :param table_name:
        :param debug:
        :return:
        """
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            query = f"""SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.key_column_usage WHERE table_name = '{table_name}' AND CONSTRAINT_NAME = 'PRIMARY'"""
            cursor.execute(query)
            row = cursor.fetchall()
            column_names = [desc[0] for desc in cursor.description]
            df = pd.DataFrame({column: [row[i] for row in row] for i, column in enumerate(column_names)})

            # connection.close()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Success", "data": df['COLUMN_NAME'].unique().tolist()
            }
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": f"Not able to connect {err}", "data": None
            }

    async def column_names(self, schema_name, table_name, debug=False, **kwargs):
        """
        @description:
        :param schema_name:
        :param table_name:
        :param debug:
        :return:
        """
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            query = f"""SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{table_name}'"""
            cursor.execute(query)
            row = cursor.fetchall()
            column_names = [desc[0] for desc in cursor.description]
            df = pd.DataFrame({column: [row[i] for row in row] for i, column in enumerate(column_names)})

            # connection.close()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Success", "data": df['COLUMN_NAME'].unique().tolist()
            }
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": f"Not able to connect {err}", "data": None
            }

    async def get_data(
            self,
            *args,
            schema_name,
            table_name,
            query=None,
            columns=None,
            limit=None,
            debug=False,
            **kwargs
    ):
        """
        @description:
        :param schema_name:
        :param table_name:
        :param query:
        :param columns:
        :param limit:
        :param debug:
        :return:
        """
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            if not query:
                query = f"SELECT * FROM {schema_name}.{table_name}"
            cursor.execute(query)
            batch_size = 5000000
            count = 0
            final_df = pd.DataFrame()
            while True:
                rows = cursor.fetchmany(batch_size)
                if not rows:
                    break

                column_names = [desc[0] for desc in cursor.description]

                df = pd.DataFrame({column: [row[i] for row in rows] for i, column in enumerate(column_names)})
                final_df = pd.concat([final_df, df])
                count += 1
            await self.close_connection(connection)
            if debug:
                return {
                    "status": True, "message": "Success",
                    "data": final_df.to_dict(orient='records')
                }

            return pl.from_pandas(final_df)

        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": f"Not able to fetch data {err}", "data": []
            }

    async def create_table(self, schema_name, table_name, table_schema, debug=False, **kwargs):
        """
        @description:
        :param schema_name:
        :param table_name:
        :param table_schema:
        :param debug:
        :return:
        """
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            table_create_sql = ''

            for col, dty in table_schema.items():
                table_create_sql += f'"{col}" {dty}, '
            table_create_sql = table_create_sql[:-1]
            table_create_sql = f"CREATE TABLE IF NOT EXISTS {schema_name}.{table_name} ({table_create_sql});"
            cursor.execute(table_create_sql)
            connection.commit()
            # cursor.close()
            await self.close_connection(connection)
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)

    async def write_data_from_csv(self, *records, schema_name, table_name, debug=False, **kwargs):
        """
        @description:
        :param records:
        :param schema_name:
        :param table_name:
        :param debug:
        :return:
        """
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
            LINES TERMINATED BY '\n'
            IGNORE 1 ROWS;
            """
            cursor.execute(sql)
            connection.commit()
            # cursor.close()
            await self.close_connection(connection)
            os.remove(f"/tmp/{table_name}.csv")
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)

    async def write_data(self, *records, schema_name, table_name, debug=False, **kwargs):
        """
        @description:
        :param records:
        :param schema_name:
        :param table_name:
        :param debug:
        :return:
        """
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            records = records[0]
            if not isinstance(records, pl.DataFrame):
                records = pl.DataFrame(records)
            query = f"INSERT INTO {schema_name}.{table_name} ({', '.join(records.columns)}) VALUES ({', '.join([':' + col for col in records.columns])})"
            cursor.executemany(query, records.to_dicts())
            connection.commit()
            # cursor.close()
            await self.close_connection(connection)
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)

    async def get_distinct_values(self, schema_name, table_name, column_name, where_clause=None, debug=False, **kwargs):
        """
        @description:
        :param schema_name:
        :param table_name:
        :param column_name:
        :param where_clause:
        :param debug:
        :return:
        """
        try:
            columns_mapping = dict()
            connection = await self.get_connection()
            cursor = connection.cursor()
            for column in column_name:
                query = f'''SELECT DISTINCT "{column_name}" FROM {schema_name}."{table_name}"'''
                if where_clause:
                    where_query = ''
                    for key, value in where_clause.items():
                        where_query += f'"{key}" = \'{value}\' AND '
                    where_query = where_query[:-5]
                    if where_query:
                        query = f'''SELECT DISTINCT "{column_name}" FROM {schema_name}."{table_name}" WHERE {where_query}'''
                cursor.execute(query)
                rows = cursor.fetchall()
                list_columns = [desc[0] for desc in cursor.description]
                df = pd.DataFrame({col: [row[i] for row in rows] for i, col in enumerate(list_columns)})
                columns_mapping[column] = df[column].unique().tolist()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Success",
                "data": columns_mapping
            }
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": f"Not able to fetch data {err}", "data": []
            }

    async def execute_query(self, query, debug=False, **kwargs):
        """
        @description:
        :param query:
        :param debug:
        :return:
        """
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            cursor.execute(query)
            records = cursor.fetchall()
            column_names = [desc[0] for desc in cursor.description]
            records = {column: [record[i] for record in records] for i, column in enumerate(column_names)}
            await self.close_connection(connection)
            return records
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            raise mysql.connector.Error
