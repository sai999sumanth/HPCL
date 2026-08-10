import urdhva_base
import re
import os
import sys
import json
import base64
import typing
import asyncpg
import traceback
import pandas as pd
import polars as pl
import hpcl_ceg_model
import urdhva_base.redispool
from itertools import islice
from sshtunnel import SSHTunnelForwarder
from orchestrator.dashboard.chart_factory.query_operator import (
    FilterStringOperator,
    AggregationOperator,
    JoinOperator
)
TEMPORAL_RANGE_PATTERN = r'datetime\("([^"]{1,50})"\) : datetime\("([^"]{1,50})"\)'
import utilities.helpers as helpers



class BaseAction:
    def __init__(self, params: typing.Dict):
        self.params = params


class Postgresql(BaseAction):
    def __init__(self, params: typing.Dict):
        super().__init__(params)

    async def get_connection(self):
        if 'connection_name' in self.params.keys() and self.params['connection_name']:
            # redis_ins = urdhva_base.redispool.get_synchronous_redis_connection()
            # try:
            #     redis_key = f"cred_store_{self.params['connection_name']}"
            #     if redis_ins.exists(f"cred_store_{self.params['connection_name']}"):
            #         self.params = json.loads(base64.b64decode(redis_ins.get(redis_key)))
            #     else:
            #         self.params = await hpcl_ceg_model.CredsModel.get(self.params['connection_name'])
            #         redis_ins.setex(redis_key, 24 * 60 * 60,
            #                               base64.b64encode(json.dumps(self.params, default=str).encode()).decode())
            # except:
            self.params = await hpcl_ceg_model.CredsModel.get(self.params['connection_name'])
            # finally:
            #     try:
            #         redis_ins.close()
            #     except:
            #         ...
            if not isinstance(self.params, dict):
                self.params = self.params.__dict__
            if 'credentials' in self.params.keys():
                self.params = self.params['credentials']
        else:
            db = urdhva_base.settings.db_urls['postgres_async'][0]
            self.params = {'host': db.host, 'port': db.port, 'user_name': db.query.split("&")[0].split("=")[-1],
                           'password': db.query.split("&")[1].split("=")[-1], 'database_name': db.path.split("/")[-1]}
            
        if self.params.get('is_ssh_tunnel', False):
            tunnel = SSHTunnelForwarder(
                (self.params['ssh_tunnel']['host'], self.params['ssh_tunnel']['port']),
                ssh_username=self.params['ssh_tunnel']['user_name'],
                ssh_pkey=self.params['ssh_tunnel']['private_key'] if 'private_key' in self.params['ssh_tunnel'].keys() else None,
                ssh_password=self.params['ssh_tunnel']['password'] if 'password' in self.params['ssh_tunnel'].keys() else None,
                remote_bind_address=(self.params['host'], self.params['port']),
            )
            tunnel.start()
            self.params['host'] = tunnel.local_bind_host
            self.params['port'] = tunnel.local_bind_port
            self.params['tunnel'] = tunnel
        connection = await asyncpg.connect(
            host=self.params['host'],
            port=self.params['port'],
            user=self.params['user_name'],
            password=self.params['password'],
            database=self.params['database_name']
        )
        return connection

    async def get_default_schema(self):
        return "public"

    async def close_connection(self, connection):
        if connection:
            await connection.close()
        if 'tunnel' in self.params.keys():
            self.params['tunnel'].stop()

    async def test_connection(self):
        """
        @description:
        :return:
        """
        try:

            connection = await self.get_connection()
            # await connection.close()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Connected to PostgresSQL",
                "data": []
            }
        except asyncpg.PostgresConnectionError as err:
            print(err, traceback.format_exc())
            # traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": "Unable to connect to PostgresSQL",
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
            stmt = await connection.prepare("SELECT datname FROM pg_catalog.pg_database")
            columns = [a.name for a in stmt.get_attributes()]
            data = await stmt.fetch()
            data = pd.DataFrame(data, columns=columns)
            # await connection.close()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Connected to PostgresSQL",
                "data": data['datname'].unique().tolist()
            }
        except asyncpg.PostgresConnectionError as err:
            # logger.error(err)
            print(err, traceback.format_exc())
            # traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": "Unable to connect to PostgresSQL",
                "data": []
            }

    async def get_schema(self, debug=False, **kwargs):
        """
        @description:
        :param debug:
        :return:
        """
        try:
            connection = await self.get_connection()
            stmt = await connection.prepare("SELECT schema_name FROM information_schema.schemata")
            columns = [a.name for a in stmt.get_attributes()]
            data = await stmt.fetch()
            data = pd.DataFrame(data, columns=columns)
            # await connection.close()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Connected to PostgresSQL",
                "data": data['schema_name'].unique().tolist()
            }
        except asyncpg.PostgresConnectionError as err:
            print(err, traceback.format_exc())
            # logger.error(err)
            # traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": "Unable to connect to PostgresSQL",
                "data": []
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
            stmt = await connection.prepare(
                f"""SELECT table_name FROM information_schema.tables WHERE table_schema='{schema_name}'""")
            columns = [a.name for a in stmt.get_attributes()]
            data = await stmt.fetch()
            data = pd.DataFrame(data, columns=columns)
            # await connection.close()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Connected to PostgresSQL",
                "data": data['table_name'].unique().tolist()
            }
        except asyncpg.PostgresConnectionError as err:
            # logger.error(err)
            print(err, traceback.format_exc())
            # traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": "Unable to connect to PostgresSQL",
                "data": []
            }

    async def query_builder(self, schema_name, table_name, condition=None, columns=None, limit=None):
        """
        @description:
        :param schema_name:
        :param table_name:
        :param condition:
        :param columns:
        :param limit:
        :return:
        """
        query = f'''SELECT '''
        if columns:
            query += ", ".join(f'"{item["value"]}" AS "{item["label"]}"' for item in columns)
        else:
            query += '*'
        if schema_name:
            query += f' FROM "{schema_name}"."{table_name}"'
        else:
            query += f' FROM "{table_name}"'
        if condition:
            query += f' WHERE {condition}'
        if limit:
            query += f' LIMIT {limit}'
        query = f"""{query};"""
        return query

    async def get_data(self, schema_name, table_name, query=None, columns=None, limit=None, debug=False, **kwargs):
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
            if query:
                self.params['query'] = query
            else:
                query = await self.query_builder(
                    schema_name=schema_name, table_name=table_name, columns=columns, limit=limit
                )
                # self.params['query'] = f'''select * from {schema_name}."{table_name}";'''
                self.params['query'] = query

            stmt = await connection.prepare(self.params['query'])
            rows = await stmt.fetch()
            column_names = [a.name for a in stmt.get_attributes()]
            df = pd.DataFrame(rows, columns=column_names)
            # await connection.close()
            await self.close_connection(connection)

            if df.empty:
                df = pd.DataFrame(columns=column_names)
            df = pl.from_pandas(df)
            if debug:
                return {
                    "status": True, "message": "Success",
                    "data": df.to_dicts()
                }
            return df
        except Exception as err:
            # logger.error(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": f"Not able to fetch data {err}", "data": []
            }

    async def primary_key(self, schema_name, table_name, debug=False, **kwargs):
        """
        @description:
        :param schema_name:
        :param table_name:
        :return:
        """
        try:
            connection = await self.get_connection()
            stmt = await connection.prepare(
                f"""SELECT column_name FROM information_schema.key_column_usage WHERE table_name = '{table_name}'""")
            columns = [a.name for a in stmt.get_attributes()]
            data = await stmt.fetch()
            data = pd.DataFrame(data, columns=columns)
            # await connection.close()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Connected to PostgresSQL",
                "data": data['column_name'].unique().tolist()
            }
        except asyncpg.PostgresConnectionError as err:
            print(err, traceback.format_exc())
            # logger.error(err)
            # traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": "Unable to connect to PostgresSQL",
                "data": []
            }

    async def column_names(self, schema_name, table_name, debug=False, **kwargs):
        """
        @description:
        :param schema_name:
        :param table_name:
        :return:
        """
        try:
            connection = await self.get_connection()
            stmt = await connection.prepare(
                f"""SELECT column_name FROM information_schema.columns WHERE table_schema = '{schema_name}' AND table_name = '{table_name}'""")
            columns = [a.name for a in stmt.get_attributes()]
            data = await stmt.fetch()
            data = pd.DataFrame(data, columns=columns)
            # await connection.close()
            await self.close_connection(connection)
            return {
                "status": True, "message": "Connected to PostgresSQL",
                "data": data['column_name'].unique().tolist()
            }
        except asyncpg.PostgresConnectionError as err:
            print(err, traceback.format_exc())
            # logger.error(err)
            # traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": "Unable to connect to PostgresSQL",
                "data": []
            }

    async def create_table(
            self, schema_name, table_name,
            sample_records, primary_key=[],
            unique_key=[], debug=False, **kwargs
    ):
        if not isinstance(sample_records, pl.DataFrame):
            sample_records = pl.DataFrame(sample_records)
        connection = await self.get_connection()
        table_create_sql = ''
        dtype_dict = {'String': str('text'), 'Int64': str('bigint'), 'Int32': str('text'), 'Boolean': str('text'),
                      'Float64': str('double precision'), 'Float32': str('double precision'),
                      'Decimal(precision=5, scale=0)': "numeric(10,0)",
                      'Decimal(precision=None, scale=0)': "numeric(10,0)",
                      'Object': str('text'), 'Datetime': str('timestamp'), 'Utf8': str('text'),
                      "Datetime(time_unit='us', time_zone=None)": str('timestamp'),
                      "Date": str('timestamp'),
                      "Decimal(precision=9, scale=3)": "numeric(10,3)",
                      "Decimal(precision=10, scale=3)": "numeric(10,3)",
                      "Decimal(precision=None, scale=3)": "numeric(10,3)",
                      "Decimal(precision=None, scale=4)": "numeric(10,3)",
                      "Decimal(precision=8, scale=3)": "numeric(10,3)", "Decimal(precision=5, scale=2)": "numeric(10,2)",
                      "Decimal(precision=10, scale=4)": "numeric(10,4)", "Datetime(time_unit='ns', time_zone=None)": str('timestamp')}
        col_dtype = {col: sample_records[col].dtype for col in sample_records.columns}
        print("col_dtype: ", col_dtype)
        for col, dty in col_dtype.items():
            dty = dtype_dict.get(str(dty), 'text')
            if col == 'Json Data':
                dty = str('jsonb')
            if col == 'DC_AMOUNT':
                dty = str('double precision')
            table_create_sql += f'"{col}" {dty},'


        constraint_query = ""
        if primary_key:
            result_string = ', '.join(f'"{s}"' for s in primary_key)
            constraint_query = f'CONSTRAINT pk_{schema_name}_{table_name} PRIMARY KEY ({result_string}),'
        if unique_key:
            result_string = ', '.join(f'"{s}"' for s in unique_key)
            constraint_query = f'CONSTRAINT uk_{schema_name}_{table_name} UNIQUE ({result_string}),'
        if constraint_query:
            table_create_sql = f''' {table_create_sql} {constraint_query}'''
        table_create_sql = table_create_sql[:-1]
        if schema_name:
            table_name = f'''{schema_name}"."{table_name}'''
        table_create_sql = '''CREATE TABLE IF NOT EXISTS "''' + table_name + '''" (''' + table_create_sql + ''')'''
        print("table_create_sql: ", table_create_sql)
        await connection.execute(table_create_sql)
        await self.close_connection(connection)
        # await connection.commit()
        return True

    async def write_data_from_csv(self, records, create_table_name, schema_name='public', **kwargs):
        """
        @description:
        :param records:
        :param create_table_name:
        :param schema_name:
        :return:
        """
        connection = await self.get_connection()
        if not isinstance(records, pl.DataFrame):
            records = pl.DataFrame(records)
        records.write_csv(f"/tmp/{create_table_name}.csv")
        # cur = connection.cursor()
        result = await self.create_table(schema_name, create_table_name, records.head(10))
        await connection.copy_to_table(
            table_name=create_table_name,
            source=f'/tmp/{create_table_name}.csv',
            schema_name=schema_name,
            delimiter='~', header=False,
        )
        os.remove(f"/tmp/{create_table_name}.csv")
        # await connection.close()
        await self.close_connection(connection)
        return {
            "status": True, "message": "Data inserted Successfully", "data": []
        }

    async def write_data(self, records, schema_name, create_table_name, **kwargs):
        """
        @description:
        :param records:
        :param schema_name:
        :param create_table_name:
        :return:
        """
        connection = await self.get_connection()
        if not isinstance(records, pl.DataFrame):
            records = pd.DataFrame(records)
            records = records.astype(str)

        result = await self.create_table(schema_name, create_table_name, records.head(10))
        tuples = [tuple(x) for x in records.values]
        if not records.empty:
            await connection.copy_records_to_table(
                create_table_name,
                schema_name=schema_name,
                records=tuples,
                columns=list(records.columns),
                timeout=10
            )
        # await connection.close()
        await self.close_connection(connection)
        return {
            "status": True, "message": "Data inserted Successfully", "data": []
        }

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
        # try:
        #     columns_mapping = dict()
        #     connection = await self.get_connection()
        #     for column in column_name:
        #         query = f'''SELECT DISTINCT "{column}" FROM "{schema_name}"."{table_name}"'''
        #         if where_clause:
        #             where_query = ''
        #             for key, value in where_clause.items():
        #                 where_query += f'"{key}" = \'{value}\' AND '
        #             where_query = where_query[:-5]
        #             if where_query:
        #                 query = f"""SELECT DISTINCT "{column}" FROM {schema_name}."{table_name}" WHERE {where_query};"""
        #         stmt = await connection.prepare(
        #             query
        #         )
        #         data = await stmt.fetch()
        #         # data = pd.DataFrame(data)
        #         # columns_mapping[column] = data[column].unique().tolist()
        #         columns_mapping[column] = [record[column] for record in data]
        #     # await connection.close()
        #     await self.close_connection(connection)
        #     return {
        #         "status": True, "message": "Connected to PostgresSQL",
        #         "data": columns_mapping
        #     }
        # except Exception as err:
        #     print(err, traceback.format_exc())
        #     # traceback.print_exc(file=sys.stdout)
        #     return {
        #         "status": False, "message": "Unable to connect to PostgresSQL",
        #         "data": []
        #     }
        if table_name in ['industry_performance','MOM_DAY_LEVEL_DATA','M60_LEVEL_METADATA']:
            data = helpers.get_user_details(where_clause)
            #for filter_key in access_filters:
            #    print("filter_key",filter_key)
            #    if filter_key.key =='SBU_Name':
            #        access_filters[access_filters.index(filter_key)][filter_key.key] == 'sbu_name'
            for f in data:
                    
                    if table_name == 'industry_performance':
                        f.key = f['key'].strip().lower()
                    
                    if f['key'].strip().lower()== 'sbu_name':
                        if f['value'] =='DS':
                            f['value'] = 'I&C'
                    #if f.key.strip().lower() == "sbu_name":
                    #            f.key = "sbu_name"
            if data and table_name == 'industry_performance':
                data = [rec for rec in data if rec['key'] not in ['SalesArea_Name', 'Region_Name']]
            if data:
                where_clause = data
        else:
            conditions = await urdhva_base.BasePostgresModel.get_clause_conditions()
            if where_clause:
                if isinstance(where_clause, dict):
                    where_clause =[where_clause]
            else:
                where_clause = []
            if conditions:
                where_clause.extend(conditions)
        try:
            columns_mapping = dict()
            connection = await self.get_connection()

            # Iterate over column names
            for column in column_name:
                # Base query
                query = f'''SELECT DISTINCT "{column}" FROM "{schema_name}"."{table_name}"'''
                
                # Handle where_clause
                if where_clause:
                    where_query = ''
                    
                    # Check if `where_clause` is a list
                    if isinstance(where_clause, list):
                        for condition in where_clause:
                            if isinstance(condition, dict):  # Ensure the condition is a dictionary
                                key = condition.get("key")
                                cond = condition.get("cond")  # Default to '=' if not provided
                                value = condition.get("value")
                                # This was to remove empty or * values from the query
                                if cond in ['=', 'equals'] and value is not None and value.lower() in ['*', '_empty', 'all', '']:
                                    continue
                                
                                # Like condition
                                elif cond in ['LIKE', 'like']:
                                    where_query += f'''"{key}" LIKE '%{value}%' AND '''
                                    continue
                                # IN condition explicitly sent from UI
                                elif cond in ['IN', 'in']:
                                    values = "', '".join([v.strip() for v in value.split(',')])
                                    where_query += f'''"{key}" IN ('{values}') AND '''
                                    continue                                  
                                if key is not None and value is not None:  # Ensure required fields are present
                                    if cond in [' ', 'one-off', 'in']:
                                        value = "', '".join(map(str, value))
                                        where_query += f'''"{key}" {cond} ('{value}') AND '''
                                    elif cond in ['ilike', 'like']:
                                        where_query += f'''"{key}" {cond} '%{value}%' AND '''
                                    else:
                                        where_query += f'''"{key}" {cond} '{value}' AND '''
                            elif isinstance(condition, str):  # Handle shorthand single condition (string format)
                                for key, value in condition.items():
                                    where_query += f'''"{key}" = '{value}' AND '''
                    
                    # Check if `where_clause` is a dictionary
                    elif isinstance(where_clause, dict):
                        for key, value in where_clause.items():
                            where_query += f'''"{key}" = '{value}' AND '''
                    
                    # Remove the trailing ' AND '
                    if where_query.endswith(" AND "):
                        where_query = where_query[:-5]
                    
                    # Append WHERE clause to the query
                    if where_query:
                        query = f'''{query} WHERE {where_query};'''
                
                # Prepare and execute the query
                stmt = await connection.prepare(query)
                data = await stmt.fetch()
                
                # Collect data
                columns_mapping[column] = [record[column] for record in data if record.get(column)]

            # Close the connection
            await self.close_connection(connection)

            # Return results
            return {
                "status": True,
                "message": "Connected to PostgreSQL",
                "data": columns_mapping
            }

        except Exception as err:
            print(err, traceback.format_exc())
            # traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": "Unable to connect to PostgresSQL",
                "data": []
            }
            
            
    async def get_product_values(self, schema_name, table_name, column_name, where_clause=None, debug=False, **kwargs):
        """
        @description:
        :param schema_name:
        :param table_name:
        :param column_name:
        :param where_clause:
        :param debug:
        :return:
        """
        # try:
        #     columns_mapping = dict()
        #     connection = await self.get_connection()
        #     for column in column_name:
        #         query = f'''SELECT DISTINCT "{column}" FROM "{schema_name}"."{table_name}"'''
        #         if where_clause:
        #             where_query = ''
        #             for key, value in where_clause.items():
        #                 where_query += f'"{key}" = \'{value}\' AND '
        #             where_query = where_query[:-5]
        #             if where_query:
        #                 query = f"""SELECT DISTINCT "{column}" FROM {schema_name}."{table_name}" WHERE {where_query};"""
        #         stmt = await connection.prepare(
        #             query
        #         )
        #         data = await stmt.fetch()
        #         # data = pd.DataFrame(data)
        #         # columns_mapping[column] = data[column].unique().tolist()
        #         columns_mapping[column] = [record[column] for record in data]
        #     # await connection.close()
        #     await self.close_connection(connection)
        #     return {
        #         "status": True, "message": "Connected to PostgresSQL",
        #         "data": columns_mapping
        #     }
        # except Exception as err:
        #     print(err, traceback.format_exc())
        #     # traceback.print_exc(file=sys.stdout)
        #     return {
        #         "status": False, "message": "Unable to connect to PostgresSQL",
        #         "data": []
        #     }
        data = helpers.get_user_details(where_clause)
        if table_name in ['industry_performance','MOM_DAY_LEVEL_DATA','M60_LEVEL_METADATA']:
        #for filter_key in access_filters:
        #    print("filter_key",filter_key)
        #    if filter_key.key =='SBU_Name':
        #        access_filters[access_filters.index(filter_key)][filter_key.key] == 'sbu_name'
            for f in data:
                    
                    if table_name == 'industry_performance':
                        f.key = f['key'].strip().lower()
                    
                    if f['key'].strip().lower()== 'sbu_name':
                        if f['value'] =='DS':
                            f['value'] = 'I&C'
                    #if f.key.strip().lower() == "sbu_name":
                    #            f.key = "sbu_name"
        if data:
            where_clause = data
        try:
            columns_mapping = dict()
            connection = await self.get_connection()

            # Iterate over column names
            for column in column_name:
                # Base query
                query = f'''SELECT DISTINCT "{column}" FROM "{schema_name}"."{table_name}"'''
                
                # Handle where_clause
                if where_clause:
                    where_query = ''
                    
                    # Check if `where_clause` is a list
                    if isinstance(where_clause, list):
                        for condition in where_clause:
                            if isinstance(condition, dict):  # Ensure the condition is a dictionary
                                key = condition.get("key")
                                cond = condition.get("cond")  # Default to '=' if not provided
                                value = condition.get("value")
                                # This was to remove empty or * values from the query
                                if cond in ['=', 'equals'] and value is not None and value.lower() in ['*', '_empty', 'all', '']:
                                    continue
                                
                                if key is not None and value is not None:  # Ensure required fields are present
                                    if cond in [' ', 'one-off', 'in']:
                                        value = "', '".join(map(str, value))
                                        where_query += f'''"{key}" {cond} ('{value}') AND '''
                                    else:
                                        where_query += f'''"{key}" {cond} '{value}' AND '''
                            elif isinstance(condition, str):  # Handle shorthand single condition (string format)
                                for key, value in condition.items():
                                    where_query += f'''"{key}" = '{value}' AND '''
                    
                    # Check if `where_clause` is a dictionary
                    elif isinstance(where_clause, dict):
                        for key, value in where_clause.items():
                            where_query += f'''"{key}" = '{value}' AND '''
                    
                    # Remove the trailing ' AND '
                    if where_query.endswith(" AND "):
                        where_query = where_query[:-5]
                    
                    # Append WHERE clause to the query
                    if where_query:
                        query = f'''{query} WHERE {where_query};'''
                
                # Prepare and execute the query
                stmt = await connection.prepare(query)
                data = await stmt.fetch()
                
                # Collect data
                columns_mapping[column] = [record[column] for record in data if record.get(column)]

            # Close the connection
            await self.close_connection(connection)

            # Return results
            return {
                "status": True,
                "message": "Connected to PostgreSQL",
                "data": columns_mapping
            }

        except Exception as err:
            print(err, traceback.format_exc())
            # traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": "Unable to connect to PostgresSQL",
                "data": []
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
            # print("execute query: ", query)
            stmt = await connection.prepare(query)
            columns = [a.name for a in stmt.get_attributes()]
            data = await stmt.fetch()
            data = pd.DataFrame(data, columns=columns)
            # await connection.close()
            await self.close_connection(connection)
            return data.to_dict(orient='records')
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            raise asyncpg.RaiseError(err)

    async def upsert_data(self, records, schema_name, table_name, conflict_columns=[], update_columns=[], **kwargs):
        """
        @description:
        :param records:
        :param schema_name:
        :param table_name:
        :param conflict_columns:
        :param update_columns:
        :return:
        """
        connection = await self.get_connection()
        if not isinstance(records, pl.DataFrame):
            records = pl.DataFrame(records)

        BATCH_SIZE = 1000  # Adjust this based on your system's capacity
        if not update_columns:
            update_columns = [col for col in records.columns if col not in conflict_columns]
        all_columns = conflict_columns + update_columns
        columns = ', '.join(f'"{key}"' for key in all_columns)
        conflict_clause = ', '.join(f'"{key}"' for key in conflict_columns)
        placeholders = ', '.join([f'${i + 1}' for i in range(len(all_columns))])
        updates = ', '.join([f'"{column}" = EXCLUDED."{column}"' for column in all_columns if column not in conflict_columns])

        result = await self.create_table(schema_name, table_name, records.head(10), unique_key=conflict_columns)
        if schema_name:
            table_name = f'{schema_name}"."{table_name}'
        sql_query = f"""
            INSERT INTO "{table_name}" ({columns})
            VALUES ({placeholders})
            ON CONFLICT ({conflict_clause}) DO UPDATE
            SET {updates};
        """
        for batch in self.chunked_iterable(records.to_dicts(), BATCH_SIZE):
            # values = [[value for value in project.values()] for project in batch]
            rows = [tuple(row[col] for col in all_columns) for row in batch]
            await connection.executemany(sql_query, rows)
        await self.close_connection(connection)

        return {"status": True, "message": "Data Upsert Successfully", "data": []}

    def chunked_iterable(self, iterable, size):
        """Helper function to split iterable into chunks."""
        it = iter(iterable)
        return iter(lambda: list(islice(it, size)), [])


class QueryBuilder:
    def __init__(self):
        pass

    async def is_str_val(self, val) -> str:
        """

        Args:
            val:

        Returns:

        """
        query_val = ''
        if isinstance(val, list):
            query_val = ', '.join(f"'{v}'" for v in val)
        else:
            query_val = f"'{val}'"
        return query_val

    def isfloat(self, val) -> bool:
        """

        Args:
            val:

        Returns:

        """
        try:
            float(val)
            return True
        except ValueError:
            return False

    async def is_num_val(self, val) -> str:
        """

        Args:
            dtype:
            val:

        Returns:

        """
        query_val = ''
        if isinstance(val, list):
            query_val = ', '.join(f"'{val}'" if self.isfloat(val) else f"'{v}'" for v in val)
        else:
            query_val = f"'{val}'" if self.isfloat(val) else f"'{val}'"

        return query_val

    async def select_col(self, agg: str, col: str, table_alias: str) -> str:
        """

        Args:
            agg:
            col:
            table_alias:

        Returns:

        """
        if agg:
            return f'''{agg.upper()}({table_alias}."{col}")'''
        return f'''{table_alias}."{col}"'''

    async def map_alias_name_to_table(
            self, tables_list: typing.List[str]
    ) -> typing.Dict[str, str]:
        """
        Args:
            tables_list: a list of table

        Returns: a dictionary of table as key and alias as value
            Ex:
                {
                    "table1": "a",
                    "table2": "b"
                }

        """
        map_tables = dict()
        ascii_num = 97
        print("tables_list: ", tables_list)
        for table_name in tables_list:
            if table_name:
                map_tables[table_name] = chr(ascii_num)
                ascii_num += 1

        return map_tables

    async def add_metric_to_col(
            self,
            columns_map: typing.Dict[str, typing.Any],
            metrics: typing.List[typing.Dict],
            join_conditions: typing.Dict,
            table_mappings: typing.Dict
    ) -> tuple[typing.Dict[str, typing.Any], typing.Dict[str, typing.Any]]:
        """

        Args:
            columns_map:
            metrics:
            join_conditions:
            table_mappings:

        Returns:

        """
        map_columns = dict()
        group_by_map = dict()

        for table, columns in columns_map.items():
            map_columns[table] = dict()
            group_by_map[table] = []
            for col, alias_col in columns.items():
                map_columns[table].update({f'"{col}"': f'"{alias_col}"'})
                group_by_map[table].append(f'"{col}"')
            for metric in metrics:
                if metric:
                    alias_col = f'''"{metric['agg']}({metric['column']})"'''
                    agg_op = eval(f"AggregationOperator.{metric['agg'].upper()}.value")
                    agg_col = f'''{agg_op}("{table_mappings.get(table, "a")}"."{metric["column"]}")'''
                    map_columns[table].update({agg_col: alias_col})

        for json_condition in join_conditions:
            if json_condition.get("source_table", "") and json_condition.get("target_table", ""):
                if json_condition.get("source_table", "") not in map_columns.keys():
                    map_columns[json_condition.get("source_table", "")] = dict()
                if json_condition.get("target_table", "") not in map_columns.keys():
                    map_columns[json_condition.get("target_table", "")] = dict()

                if json_condition.get("source_table", "") not in group_by_map.keys():
                    group_by_map[json_condition.get("source_table", "")] = []
                if json_condition.get("target_table", "") not in group_by_map.keys():
                    group_by_map[json_condition.get("target_table", "")] = []

                for json_col in json_condition.get("join_where_clause", []):
                    map_columns[json_condition.get("source_table", "")].update({f'"{json_col["source_column"]}"': f'"{json_col["source_label"]}"'})
                    map_columns[json_condition.get("target_table", "")].update({f'"{json_col["target_column"]}"': f'"{json_col["target_label"]}"'})
                    group_by_map[json_condition.get("source_table", "")].append(f'"{json_col["source_column"]}"')
                    group_by_map[json_condition.get("target_table", "")].append(f'"{json_col["target_column"]}"')

                for column, alias_col in json_condition.get("select_columns", {}).items():
                    map_columns[json_condition.get("target_table", "")].update({f'"{column}"': f'"{alias_col}"'})
                    group_by_map[json_condition.get("target_table", "")].append(f'"{column}"')

        return map_columns, group_by_map

    async def get_select_columns(
            self,
            columns_dicts: typing.Dict[str, typing.Any],
            group_by_json: typing.List[typing.Dict[str, typing.Any]],
            table_mapping: typing.Dict[str, str] = None
    ) -> typing.Dict[str, typing.Any]:
        """

        Args:
            table_mapping: a dictionary of table as key and alias as value
                Ex:
                    {
                        "table1": "a",
                        "table2": "b"
                    }
            columns_dicts: a dictionary of column as key and alias as value
                Ex:
                    {
                        "table1": {
                            "column1": "col1",
                            "column2": "col2"
                        },
                        "table2": {
                            "column3": "col3",
                            "column4": "col4"
                        }
                    }
            group_by_json: a list of dictionary of column as key and alias as value
                Ex:
                    [
                        {
                            "column": "",
                            "agg": "",
                        }
                    ]
        Returns: a dictionary of table as key and columns as value
            Ex:
                {
                    "table1": '"a.column1" AS "col1", "a.column2" AS "col2"',
                    "table2": '"b.column3" AS "col3", "b.column4" AS "col4"'
                }

        """
        select_column_dict = dict()

        if not table_mapping:
            table_mapping = dict()

        for table_name, columns_dict in columns_dicts.items():
            query_columns = ", ".join(
                f'{table_mapping.get(table_name, "a")}.{column} AS {alias_column}'
                if column.split("(")[0] not in [op.value for op in AggregationOperator]
                else f'{column} AS {alias_column}'
                for column, alias_column
                in columns_dict.items()
            )
            select_column_dict[table_name] = query_columns

        return select_column_dict

    async def from_clause(
            self,
            table: str,
            table_mapping: typing.Dict
    ) -> str:
        """

        Args:
            table_mapping:
            table:

        Returns:

        """
        table_alias = table_mapping.get(table, "a")
        return f'''FROM "{table}" AS {table_alias}'''

    async def join_query_builder(
            self,
            join_query_json: typing.Dict[str, typing.Any],
            table_mappings: typing.Dict[str, str]
    ) -> str:
        """

        Args:
            join_query_json:
                "join_conditions": {
                    "table1": {
                        "join": "inner",
                        "filters": [
                            {
                                "column": "",
                                "dtype": "",
                                "op": "",
                                "val": "",
                                "cond": "",
                            }
                        ],
                        "cond": [{
                            "from": {
                                "table": "",
                                "column": "",
                                "vale": ""
                            },
                            "to": {
                                "table": "",
                                "column": "",
                                "vale": ""
                            },
                        }]
                        "columns": {}
                    }
                }
            table_mapping:

        Returns:

        """
        final_json_query = ""
        for each_join_query in join_query_json:
            target_table = each_join_query['target_table']
            join_query = ""
            join_type = eval(f"JoinOperator.{each_join_query['join']}.value")

            join_where_clause = ""
            count = 1
            for filters in each_join_query["filters"]:
                filters['dtype'] = filters.get('dtype', 'character varying') # To Do need to get datatype from table
                where_cond = await self.where_clause(filters, target_table, table_mappings)
                operator = filters.get("cond", "AND")
                if count == 1:
                    join_where_clause += f' {where_cond} '
                else:
                    join_where_clause += f'{operator} {where_cond} '
                count += 1

            join_cond = " (SELECT "
            if each_join_query.get("select_columns", {}):
                for column, alias_column in each_join_query.get("select_columns", {}).items():
                    join_cond += f'{table_mappings.get(target_table, "a")}."{column}"'
                    join_cond += ", "
                join_cond = join_cond[:-2]
                join_cond += " "
            else:
                join_cond += "* "

            join_cond += f' FROM "{target_table}" AS {table_mappings.get(target_table, "a")}'
            if join_where_clause:
                join_cond += f' WHERE {join_where_clause})'
            else:
                join_cond += f')'
            count = 1
            for each_cond in each_join_query["join_where_clause"]:
                source_cond = f"""'{each_cond["source_column"]}'""" \
                    if each_cond['textSSBox'] \
                    else \
                    f'''{table_mappings.get(each_join_query["source_table"], "a")}."{each_cond['source_column']}"'''
                target_cond = f"""'{each_cond["target_column"]}'""" \
                    if each_cond['textSTBox'] \
                    else \
                    f'''{table_mappings.get(each_join_query["target_table"], "a")}."{each_cond['target_column']}"'''
                on_cond = f'{source_cond}::text = {target_cond}::text'
                if count == 1:
                    join_query += f'ON {on_cond} AND '
                else:
                    join_query += f' {on_cond} AND '
                count += 1

            if join_query.endswith(" AND "):
                join_query = join_query[:-4]

            join_query = f'{join_cond} AS {table_mappings.get(target_table, "a")} {join_query}'
            final_json_query += f' {join_type} {join_query}\n'

        return final_json_query

    async def where_clause(
            self,
            filter_cond: typing.Dict,
            table: str,
            table_mapping: typing.Dict
    ) -> str:
        """

        Args:
            table_mapping:
            table:
            filter_cond:
                {
                    "column": "",
                    "dtype": "",
                    "op": "",
                    "val": "",
                    "cond": "",
                }
        Returns:

        """
        agg = filter_cond.get("agg", "")
        op = filter_cond["op"]
        val = filter_cond["val"]
        col = filter_cond["column"]
        # dtype = filter_cond["dtype"]
        table_alias = table_mapping.get(table, "a")
        where_clause_cond: str = ""
        select_column = await self.select_col(agg, col, table_alias)
        if op == "TEMPORAL_RANGE":
            match = re.match(TEMPORAL_RANGE_PATTERN, val)
            if match:
                start_date, end_date = match.groups()
                where_clause_cond += f'''{select_column} BETWEEN '{start_date}' AND '{end_date}' '''
        elif op == FilterStringOperator.IN or op == FilterStringOperator.NOT_IN:
            val_list = await self.is_num_val(val)
            where_clause_cond += f'''{select_column} IN ({val_list}) '''
        elif op == FilterStringOperator.IS_TRUE:
            where_clause_cond += f'''{select_column} IS TRUE '''
        elif op == FilterStringOperator.IS_FALSE:
            where_clause_cond += f'''{select_column} IS FALSE '''
        elif op == FilterStringOperator.NOT_EQUALS:
            val = await self.is_num_val(val)
            where_clause_cond += f'''{select_column} != {val} '''
        elif op == FilterStringOperator.EQUALS:
            val = await self.is_num_val(val)
            where_clause_cond += f'''{select_column} = {val} '''
        elif op == FilterStringOperator.GREATER_THAN:
            val = await self.is_num_val(val)
            where_clause_cond += f'''{select_column} > {val} '''
        elif op == FilterStringOperator.LESS_THAN:
            val = await self.is_num_val(val)
            where_clause_cond += f'''{select_column} < {val} '''
        elif op == FilterStringOperator.GREATER_THAN_OR_EQUALS:
            val = await self.is_num_val(val)
            where_clause_cond += f'''{select_column} >= {val} '''
        elif op == FilterStringOperator.LESS_THAN_OR_EQUALS:
            val = await self.is_num_val(val)
            where_clause_cond += f'''{select_column} <= {val} '''
        elif op == FilterStringOperator.LIKE:
            where_clause_cond += f'''{select_column} LIKE '%{val}%' '''
        elif op == FilterStringOperator.ILIKE:
            where_clause_cond += f'''{select_column} ILIKE '%{val}%' '''
        elif op == FilterStringOperator.IS_NULL:
            where_clause_cond += f'''{select_column} IS NULL '''
        elif op == FilterStringOperator.IS_NOT_NULL:
            where_clause_cond += f'''{select_column} IS NOT NULL '''
        return where_clause_cond

    async def group_by_query_builder(
            self,
            group_by_json: typing.List[typing.Dict[str, typing.Any]],
            table_mapping: typing.Dict[str, str],
            table_name: str
    ) -> str:
        """

        Args:
            group_by_json:
                [
                    {
                        "column": "",
                        "agg": "",
                        "label": "", # TO DO
                    }
                ]
            table_mapping:
            table_name:

        Returns:

        """
        group_by_query = ""
        for group in group_by_json:
            select_column = await self.select_col("", group["column"], table_mapping.get(table_name, "a"))
            group_by_query += f'{select_column}, '

        if group_by_query.endswith(", "):
            group_by_query = group_by_query[:-2]
            group_by_query += " "
        return group_by_query

    async def having_query_builder(
            self,
            having_query_json: typing.List[typing.Dict[str, typing.Any]],
            table_mapping: typing.Dict[str, str],
            table_name: str
    ) -> str:
        """

        Args:
            having_query_json:
                [
                    {
                        "column": "",
                        "agg": "",
                        "dtype": "",
                        "op": "",
                        "val": "",
                        "cond": "",
                    }
                ]
            table_mapping:
            table_name:

        Returns:

        """
        having_query = ""
        count = 1
        for filters in having_query_json:
            filters = filters.copy()
            filters['dtype'] = filters.get('dtype', 'character varying')
            where_cond = await self.where_clause(filters, table=table_name, table_mapping=table_mapping)
            if count == 1:
                having_query += f' {where_cond} '
            else:
                having_query += f'{filters.get("cond", "AND")} {where_cond} '
            count += 1

        return having_query

    async def order_by_query_builder(
            self,
            order_by_query_json: typing.List[typing.Dict[str, typing.Any]],
            table_mapping: typing.Dict[str, str],
            table_name: str
    ) -> str:
        """

        Args:
            order_by_query_json:
                [
                    {
                        "column": "",
                        "agg": "",
                        "cond": "",
                    }
                ]
            table_mapping:
            table_name:

        Returns:

        """
        order_by_query = ""
        for filters in order_by_query_json:
            select_column = await self.select_col(filters["agg"], filters["column"], table_mapping.get(table_name, "a"))
            order_by_query += f'{select_column} {filters.get("cond", "ASC")}, '
        if order_by_query.endswith(", "):
            order_by_query = order_by_query[:-2]
            order_by_query += " "
        return order_by_query

    async def limit_query_builder(
            self,
            limit: int
    ) -> str:
        """

        Args:
            limit:

        Returns:

        """
        return f"LIMIT {limit}"

    async def offset_query_builder(
            self,
            offset: int
    ) -> str:
        """

        Args:
            offset:

        Returns:

        """
        return f"OFFSET {offset}"

    async def generate_query(
            self,
            query_context: typing.Dict[str, typing.Any],
    ) -> str:
        """

        Args:
            query_context:

        Returns:

        """
        query = ""

        # getting mapping tables
        table_mappings = await self.map_alias_name_to_table([query_context["table_name"]] + query_context["join_tables"])

        # including groupby columns to select columns
        query_context["map_column"], group_by_map = await self.add_metric_to_col(
            {query_context['table_name']: query_context.get("select_columns", {})},
            query_context.get("metrics", []),
            query_context.get("join_conditions", {}),
            table_mappings
        )

        # Select Query
        query = "SELECT "
        if query_context.get("map_column", {}):
            table_column_map = await self.get_select_columns(query_context["map_column"], [{}], table_mappings)
            for table, column_str in table_column_map.items():
                query += f'{column_str}'
                query += ", "
            query = query[:-2]
            query += " "
        else:
            query += "* "

        # From Query
        query += await self.from_clause(query_context["table_name"], table_mappings)

        # Join Query
        if query_context.get("join_tables", []):
            query += await self.join_query_builder(
                query_context.get("join_conditions", {}),
                table_mappings
            )

        # Where Query
        if query_context.get("filters", []):
            count = 1
            operator = ""
            for filters in query_context["filters"]:
                filters = filters.copy()
                filters['dtype'] = filters.get('dtype', 'character varying')
                where_clause = await self.where_clause(
                    filters, query_context['table_name'], table_mappings
                )
                if count == 1:
                    query += " WHERE {}".format(where_clause)
                else:
                    query += "{} {}".format(operator, where_clause)
                count += 1
                operator = filters.get("cond", "AND")

        # Group By Query
        if query_context.get("metrics", []):
            count = 1
            for table, column in group_by_map.items():
                for each_col in column:
                    if count == 1:
                        query += f'GROUP BY "{table_mappings.get(table, "a")}".{each_col} '
                    else:
                        query += f', "{table_mappings.get(table, "a")}".{each_col} '
                    count += 1

        # Having Query
        # TO DO

        # Order By Query
        if query_context.get("order_by", {}):
            if query_context['order_by'].get("column", ""):
                column = await self.select_col(
                    "",
                    query_context['order_by'].get("column", ""),
                    table_mappings.get(query_context['table_name'], "a")
                )
                cond = query_context['order_by'].get("cond", "ASC")
                query += f'ORDER BY {column} {cond} '

        # Limit Query
        if query_context.get("limit", 0):
            query += await self.limit_query_builder(query_context["limit"])

        # Offset Query
        if query_context.get("offset", 0):
            query += await self.offset_query_builder(query_context["offset"])

        return query.strip()
