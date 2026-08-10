import urdhva_base
import os
import sys
import typing
import pyodbc
import datetime
import traceback
import pandas as pd
import polars as pl
import hpcl_ceg_model
import urdhva_base.types
from sshtunnel import SSHTunnelForwarder


dtype_map = {
    "int64": "bigint",
    "int32": "int",
    "int16": "smallint",
    "int8": "tinyint",
    "float64": "float",
    "object": "nvarchar(255)",
    "datetime64[ns]": "datetime2",
    "bool": "bit",
}


class BaseAction:
    def __init__(self, params: typing.Dict):
        self.params = params


class Mssql(BaseAction):
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
                ssh_pkey=urdhva_base.types.Secret(self.params['ssh_tunnel']['private_key'] if 'private_key' in self.params['ssh_tunnel'].keys() else None).get_secret(),
                ssh_password=urdhva_base.types.Secret(self.params['ssh_tunnel']['password'] if 'password' in self.params['ssh_tunnel'].keys() else None).get_secret(),
                remote_bind_address=(self.params['host'], self.params['port']),
            )
            tunnel.start()
            self.params['host'] = tunnel.local_bind_host
            self.params['port'] = tunnel.local_bind_port
            self.params['tunnel'] = tunnel

        connection = pyodbc.connect(
            'DRIVER={ODBC Driver 18 for SQL Server};'
            f'Server={self.params["host"]},{self.params["port"]};'
            f'Database={self.params["database_name"]};'
            # f'Port={port};'
            f'UID={self.params["user_name"]};'
            f'PWD={self.params["password"]};'
            'TrustServerCertificate=yes;MARS_Connection=yes;',
        )
        return connection

    async def get_default_schema(self, connection):
        return "dbo"

    async def close_connection(self, connection):
        if connection:
            connection.close()
        if 'tunnel' in self.params.keys():
            self.params['tunnel'].stop()

    async def test_connection(self):
        try:
            connection = await self.get_connection()
            # connection.close()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Successfully Connected MsSQL Server", "data": []
            }
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": f"Not able to connect {err}", "data": None
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
            query = "SELECT name FROM sys.databases;"
            cursor.execute(query)
            row = cursor.fetchall()
            column_names = [desc[0] for desc in cursor.description]
            df = pd.DataFrame({column: [row[i] for row in row] for i, column in enumerate(column_names)})

            # connection.close()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Success", "data": df['name'].unique().tolist()
            }
        except Exception as err:
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
            query = "SELECT schema_name FROM information_schema.schemata;"
            cursor.execute(query)
            row = cursor.fetchall()
            column_names = [desc[0] for desc in cursor.description]
            df = pd.DataFrame({column: [row[i] for row in row] for i, column in enumerate(column_names)})

            # connection.close()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Success", "data": df['schema_name'].unique().tolist()
            }
        except Exception as err:
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
            query = f"""SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '{schema_name}';"""
            cursor.execute(query)
            row = cursor.fetchall()
            column_names = [desc[0] for desc in cursor.description]
            df = pd.DataFrame({column: [row[i] for row in row] for i, column in enumerate(column_names)})

            # connection.close()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Success", "data": df['TABLE_NAME'].unique().tolist()
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
        :param args:
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
                query = f'SELECT * FROM {schema_name}."{table_name}"'
                if not schema_name and schema_name == 'None':
                    query = f'SELECT * FROM "{table_name}"'
            cursor.execute(query)
            batch_size = 1000000
            count = 0

            final_df = pd.DataFrame()
            while True:
                rows = cursor.fetchmany(batch_size)
                if not rows:
                    break

                column_names = [desc[0] for desc in cursor.description]
                df = pd.DataFrame({column: [row[i] for row in rows] for i, column in enumerate(column_names)})
                final_df = pd.concat([df, final_df])
                count += 1
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
            query = f"""select C.COLUMN_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS T """\
                    f"""JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE C """\
                    f"""ON C.CONSTRAINT_NAME=T.CONSTRAINT_NAME WHERE C.TABLE_NAME='{table_name}' """\
                    f"""and T.CONSTRAINT_TYPE='PRIMARY KEY';"""
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
            query = f"""SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{table_name}';"""
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
            table_create_sql = f"CREATE TABLE {schema_name}.{table_name} ({table_create_sql});"
            cursor.execute(f"SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '{table_name}'")
            if not cursor.fetchone():
                cursor.execute(table_create_sql)
                connection.commit()
            return True
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return False

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
                    table_schema[c] = "varchar(255)"
                else:
                    table_schema[c] = dtype_map[dtype]

            await self.create_table(schema_name, table_name, table_schema)
            csv_file = f"/tmp/{table_name}.csv"
            records.write_csv(csv_file)
            sql = f"""
            BULK INSERT {table_name}
            FROM '{csv_file}'
            WITH (
                FIELDTERMINATOR = ',',
                ROWTERMINATOR = '\n',
                FIRSTROW = 2,
                BATCHSIZE=250000
            );
            """
            cursor.execute(sql)
            connection.commit()
            # connection.close()
            await self.close_connection(connection)
            os.remove(f"/tmp/{table_name}.csv")

            """
            from sqlalchemy import event
            @event.listens_for(engine, "before_cursor_execute")
            def receive_before_cursor_execute(
                   conn, cursor, statement, params, context, executemany
                    ):
                        if executemany:
                            cursor.fast_executemany = True
            
            df.to_sql(tbl, engine, index=False, if_exists="append", schema="dbo")
            """
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)

    async def write_data(self, *records, schema_name, table_name, debug=False, **kwargs):
        """
        @description:
        :param records:
        :param schema_name:
        :param table_name::
        :param debug:
        :return:
        """
        try:
            connection = await self.get_connection()
            cursor = connection.cursor()
            cursor.fast_executemany = True
            records = records[0]
            if not isinstance(records, pd.DataFrame):
                records = pd.DataFrame(records)
            table_schema: typing.Dict[str, str] = {}
            for c in list(records.columns):
                dtype = str(records[c].dtype)
                if dtype not in dtype_map:
                    table_schema[c] = "varchar(255)"
                else:
                    table_schema[c] = dtype_map[dtype]
            await self.create_table(schema_name, table_name, table_schema)
            values_stmt = f"({','.join(['?' for _ in table_schema])})"
            insert_sql = f"insert into [{schema_name}].[{table_name}] values {values_stmt}"
            insert_cols = records.values.tolist()
            insert_cols = [[None if pd.isna(cell) else cell for cell in row] for row in insert_cols]
            cursor.executemany(insert_sql, insert_cols)
            connection.commit()
            cursor.close()
            await self.close_connection(connection)
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            raise pyodbc.Error

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
                sql = f"""SELECT DISTINCT "{column}" FROM {schema_name}."{table_name}";"""
                if where_clause:
                    where_query = ''
                    for key, value in where_clause.items():
                        where_query += f'"{key}" = \'{value}\' AND '
                    where_query = where_query[:-5]
                    if where_query:
                        sql = f"""SELECT DISTINCT "{column}" FROM {schema_name}."{table_name}" WHERE {where_query};"""
                cursor.execute(sql)
                row = cursor.fetchall()
                list_columns = [desc[0] for desc in cursor.description]
                df = pd.DataFrame({col: [row[i] for row in row] for i, col in enumerate(list_columns)})
                columns_mapping[column] = df[column].unique().tolist()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Success", "data": columns_mapping
            }
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": f"Not able to connect {err}", "data": None
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
            raise pyodbc.Error
