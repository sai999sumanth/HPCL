from abc import ABC, abstractmethod
from decimal import Decimal
# import pyodbc
import pymysql
import psycopg2
import orchestrator.dbconnector.credential_loader as credential_loader


class DBConnectorFactory(ABC):
    def __init__(self, conn_type):
        self.conn_type=conn_type
        self.connection = None

    @abstractmethod
    def get_connection(self, cred_type):
        """Establish a connection to the database."""
        pass

    @abstractmethod
    def generate_query(self, table_name: str, conditions: dict = None):
        """Generate a query based on the table name and conditions."""
        pass

    @staticmethod
    def get_default_conditions():
        """Provide default conditions for user-level access control."""
        return {}  # Example default condition

    def generate_filter_clause(self, filters):
        def generate_sql_where_clause(filters):
            """
            Generate SQL WHERE clause conditions from the provided filter list.

            :param filters: List of dictionaries, each containing 'key', 'cond', and 'value'.
            :return: A string representing the SQL WHERE clause.
            """
            conditions = []

            for filter_item in filters:
                key = filter_item['key']
                condition = filter_item['cond']
                value = filter_item['value']

                if condition == 'equals':
                    conditions.append(f"{key} = '{value}'")
                elif condition == 'prefix':
                    conditions.append(f"{key} LIKE '{value}%'")
                elif condition == 'contains':
                    conditions.append(f"{key} LIKE '%{value}%'")
                elif condition == 'suffix':
                    conditions.append(f"{key} LIKE '%{value}'")
                elif condition == 'oneof' and isinstance(value, list):
                    values = "', '".join(map(str, value))
                    conditions.append(f"{key} IN ('{values}')")
                elif condition == 'pattern':
                    conditions.append(f"{key} ILIKE '%{value}%'")
                elif condition == 'date_filter':
                    if value == '24h':
                        conditions.append(f"{key} >= CURRENT_TIMESTAMP - INTERVAL '24 hours'")
                    elif value == 't':
                        conditions.append(f"{key}::DATE = CURRENT_DATE")
                    elif value == '1d':
                        conditions.append(f"{key}::DATE = CURRENT_DATE - INTERVAL '1 DAY'")
                    elif value == '1w':
                        conditions.append(f"{key}::DATE >= CURRENT_DATE - INTERVAL '7 DAY'")
                    elif value == '15d':
                        conditions.append(f"{key}::DATE >= CURRENT_DATE - INTERVAL '15 DAY'")
                    elif value == '1m':
                        conditions.append(f"{key}::DATE >= CURRENT_DATE - INTERVAL '1 MONTH'") 
                    elif value == '3m':
                        conditions.append(f"{key}::DATE >= CURRENT_DATE - INTERVAL '3 MONTH'") 
                elif condition == 'date_range':
                    value = value.split(",")
                    start, end = value
                    if not isinstance(value, str):
                        if len(value) == 1:
                            conditions.append(f"{key}::DATE = '{value}'")
                        else:
                            conditions.append(f"{key}::DATE BETWEEN '{start}' AND '{end}'")
                else:
                    raise ValueError(f"Unsupported condition: {condition}")
        return "WHERE " + " AND ".join(f"{col} = '{val}'" for col, val in filters.items())

    def execute_query(self, query):
        """
        Executes a query on the respective database and returns the results.
        """
        conn = self.get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(query)
                column_names = [desc[0] for desc in cursor.description]
                return column_names, cursor.fetchall()
        finally:
            conn.close()

    def process_recommendations(self, keys, query_result):
        """
        Converts a Decimal values into proper float values and returns the data as key value pairs
        with the columns as key and data for the columns as value
        """
        return [
            {
                **dict(
                    zip(
                        keys,
                        [float(col) if isinstance(col, Decimal) else col for col in row]
                    )
                )
            }
            for row in query_result
        ]



class MySQLConnector(DBConnectorFactory):
    def get_connection(self):
        self.connection = pymysql.connect(
            host="localhost",
            user="root",
            password="password",
            database="mysql_db"
        )
        return self.connection

    def generate_query(self, table_name: str, conditions: dict = None):
        query = f"SELECT * FROM {table_name}"
        if conditions:
            condition_str = " AND ".join([f"{k}='{v}'" for k, v in conditions.items()])
            query += f" WHERE {condition_str}"
        return query


class MSSQLConnector(DBConnectorFactory):
    def get_connection(self):
        self.connection = "" '''pyodbc.connect(
            "Driver={SQL Server};"
            "Server=localhost;"
            "Database=mssql_db;"
            "Trusted_Connection=yes;"
        )'''
        return self.connection

    def generate_query(self, table_name: str, conditions: dict = None):
        query = f"SELECT * FROM {table_name}"
        if conditions:
            condition_str = " AND ".join([f"{k}='{v}'" for k, v in conditions.items()])
            query += f" WHERE {condition_str}"
        return query


class PostgreSQLConnector(DBConnectorFactory):
    def get_connection(self):
        creds = credential_loader.get_credentials(self.conn_type)
        self.connection = psycopg2.connect(
            host=creds["host"], # localhost
            user=creds["user"], # postgres
            password=creds["password"], # password
            database=creds["database"] # postgres_db
        )
        return self.connection

    def generate_query(self, table_name: str, conditions: dict = None):
        query = f"SELECT * FROM {table_name}"
        if conditions:
            condition_str = " AND ".join([f"{k}='{v}'" for k, v in conditions.items()])
            query += f" WHERE {condition_str}"
        return query


# Example usage
def example_usage():
    db_factories = {
        "mysql": MySQLConnector(),
        "mssql": MSSQLConnector(),
        "postgres": PostgreSQLConnector()
    }

    # Select a database type
    db_type = "mysql"
    connector = db_factories[db_type]

    # Connect to the database
    connection = connector.get_connection()
    print(f"Connected to {db_type} database.")

    # Generate a query
    query = connector.generate_query("users", {"status": "active", "role": "admin"})
    print(f"Generated Query: {query}")


if __name__ == "__main__":
    """
    Filters Example
    [{'key': 'name', 'cond': 'equals', 'value': 'abcd'}, {'key': 'name', 'cond': 'prefix', 'value': 'abcd'}, 
    {'key': 'name', 'cond': 'contains', 'value': 'abcd'}, {'key': 'name', 'cond': 'suffix', 'value': 'abcd'}, 
    {'key': 'name', 'cond': 'oneof', 'value': ['a', 'b']}]
    """
    example_usage()
