import urdhva_base
import sys
import typing
import traceback
import pandas as pd
import polars as pl
import hpcl_ceg_model
from hana_ml import dataframe
from hana_ml import ConnectionContext

dtype_map = {
    "int64": "bigint",
    "int32": "int",
    "int16": "smallint",
    "int8": "tinyint",
    "float64": "float",
    "object": "nvarchar(255)",
    "datetime64[ns]": "datetime2",
    "bool": "bit"
}


class BaseAction:
    def __init__(self, params: typing.Dict):
        self.params = params


class S4Hana(BaseAction):
    def __init__(self, params: typing.Dict):
        super().__init__(params)

    async def get_connection(self):
        if 'connection_name' in self.params.keys():
            self.params = await hpcl_ceg_model.CredsModel.get(self.params['connection_name'])
        if not isinstance(self.params, dict):
            self.params = self.params.__dict__
        if 'credentials' in self.params.keys():
            self.params = self.params['credentials']
        connection = ConnectionContext(
            self.params["host"],
            self.params["port"],
            self.params["user_name"],
            self.params["password"],
            databasename=self.params['database_name'],
            sslValidateCertificate=False
        )
        return connection

    async def get_default_schema(self):
        return None

    async def test_connection(self):
        try:
            connection = self.get_connection()
            connection.close()
            return {
                "status": True, "message": "Connected to S4 Hana",
                "data": []
            }
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": "Unable to connect to S4 Hana",
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
            current_batch = connection.sql("SELECT DATABASE_NAME FROM m_databases")
            df = current_batch.collect()
            connection.close()
            return {
                "status": True, "message": "Connected to S4 Hana",
                "data": df['DATABASE_NAME'].unique().tolist()
            }
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": "Unable to connect to S4 Hana",
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
            current_batch = connection.sql("SELECT SCHEMA_NAME FROM schemas")
            df = current_batch.collect()
            connection.close()
            return {
                "status": True, "message": "Connected to S4 Hana",
                "data": df['SCHEMA_NAME'].unique().tolist()
            }
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": "Unable to connect to S4 Hana",
                "data": []
            }

    async def table_name(self, schema_name=None, debug=False, **kwargs):
        """
        @description:
        :param schema_name:
        :param debug:
        :return:
        """
        try:
            connection = await self.get_connection()
            if schema_name:
                current_batch = connection.sql(f"SELECT TABLE_NAME FROM tables WHERE SCHEMA_NAME = '{schema_name}'")
            else:
                current_batch = connection.sql(f"SELECT TABLE_NAME FROM tables")
            df = current_batch.collect()
            df = df.head(10)
            connection.close()
            return {
                "status": True, "message": "Connected to S4 Hana",
                "data": ['SAP_VENDOR_EXTRACTED', 'VENDOR_MAPPING_TABLE'] + df['TABLE_NAME'].unique().tolist()
            }
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": "Unable to connect to S4 Hana",
                "data": []
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
            current_batch = connection.sql(
                f"""SELECT COLUMN_NAME FROM CONSTRAINTS WHERE SCHEMA_NAME = '{schema_name}' AND TABLE_NAME = '{table_name}'""")
            df = current_batch.collect()
            connection.close()
            return {
                "status": True, "message": "Connected to S4 Hana",
                "data": df['COLUMN_NAME'].unique().tolist()
            }
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": "Unable to connect to S4 Hana",
                "data": []
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
            current_batch = connection.sql(f"""SELECT COLUMN_NAME FROM SYS.TABLE_COLUMNS WHERE SCHEMA_NAME = '{schema_name}' AND TABLE_NAME = '{table_name}'""")
            df = current_batch.collect()
            connection.close()
            return {
                "status": True, "message": "Connected to S4 Hana",
                "data": df['COLUMN_NAME'].unique().tolist()
            }
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            return {
                "status": False, "message": "Unable to connect to S4 Hana",
                "data": []
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
            list_table_name = await self.table_name(schema_name)
            if table_name not in list_table_name.get("data", []):
                connection.create_table(
                    table=table_name,
                    table_structure=table_schema,
                    schema=schema_name
                )
            connection.close()
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)

    async def write_data(self, *records, schema_name, create_table_name, debug=False, **kwargs):
        """
        @description:
        :param records:
        :param schema_name:
        :param create_table_name:
        :param debug:
        :return:
        """
        try:
            connection = await self.get_connection()
            records = records[0]
            if not isinstance(records, pd.DataFrame):
                records = pd.DataFrame(records)
            table_schema: typing.Dict[str, str] = {}
            for c in list(records.columns):
                dtype = str(records[c].dtype)
                if dtype not in dtype_map:
                    table_schema[c] = "nvarchar(255)"
                else:
                    table_schema[c] = dtype_map[dtype]
            await self.create_table(schema_name, create_table_name, table_schema)
            hana_df = dataframe.create_dataframe_from_pandas(
                connection,
                records,
                create_table_name,
                schema=schema_name,
                drop_exist_tab=False
            )
            hana_df.save((schema_name, create_table_name))
            connection.close()
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)

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
            if not query:
                query = f'SELECT * FROM {schema_name}."{table_name}"'

            batch_size = 1000000
            count = 1
            offset = 0
            final_df = pd.DataFrame()
            LIMIT = 1000
            while True:
                query_with_limit = f"{query} LIMIT {batch_size} OFFSET {offset}"
                current_batch = connection.sql(query_with_limit)
                if current_batch.empty():
                    break
                current_batch_pd = current_batch.collect()
                # break
                offset += batch_size
                count += 1
                final_df = pd.concat([current_batch_pd, final_df])
            connection.close()
            final_df = pl.from_pandas(final_df)
            print(final_df)
            if 'VARNUMH' in final_df.columns:
                final_df = final_df.drop('VARNUMH')
            if debug:
                return {
                    "status": True, "message": "Success", "data": final_df.to_dicts()
                }

            return final_df
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
            for column in column_name:
                query = f'''SELECT DISTINCT "{column_name}" FROM {schema_name}."{table_name}"'''
                if where_clause:
                    where_query = ''
                    for key, value in where_clause.items():
                        where_query += f'"{key}" = \'{value}\' AND '
                    where_query = where_query[:-5]
                    if where_query:
                        query = f'''SELECT DISTINCT "{column_name}" FROM {schema_name}."{table_name}" WHERE {where_query}'''
                current_batch = connection.sql(query)
                df = current_batch.collect()
                columns_mapping[column] = df[column].unique().tolist()
            connection.close()
            return {
                "status": True, "message": "Connected to S4 Hana",
                "data": columns_mapping
            }
        except Exception as err:
            print(err)
            return {
                "status": False, "message": f"Not able to fetch data {err}", "data": []
            }

    async def execute_query(self, query, debug=False, **kwargs):
        """
        @description:
        Args:
            query:
            debug:
            **kwargs:

        Returns:

        """
        try:
            connection = await self.get_connection()
            current_batch = connection.sql(query)
            df = current_batch.collect()
            connection.close()
            return df.to_dict(orient='records')
        except Exception as err:
            print(err)
            traceback.print_exc(file=sys.stdout)
            raise err
