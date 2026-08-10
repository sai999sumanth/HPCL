import urdhva_base
import asyncio
import importlib
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import MetaData, Table, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
# from orchestrator.dashboard.chart_factory import charts_functions

DATABASE_URL = str(urdhva_base.settings.db_urls["postgres_async"][0])

async_engine = create_async_engine(DATABASE_URL, echo=False)

async_session = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

# async_session = await charts_functions.check_db("")

column_type_mapping = {
    "DATETIME": "TIMESTAMP WITH TIME ZONE",
    "ARRAY INTEGER": "INTEGER[]",
    "ARRAY VARCHAR": "CHARACTER VARYING[]",
}


async def get_table_columns(table_name: str):
    """
    Asynchronously retrieves the columns and their properties for a given table.

    Parameters:
    table_name (str): The name of the table to inspect.

    Returns:
    dict: A dictionary of column names with their types and nullable status.
    """
    try:
        async with async_engine.connect() as connection:
            metadata = MetaData()
            table = await connection.run_sync(lambda conn: Table(table_name, metadata, autoload_with=conn))
            column_details = {
                column.name: {
                    'type': str(column.type),
                    'nullable': column.nullable
                } for column in table.columns
            }
            return column_details
    except Exception as e:
        print(f"Exception while checking table {table_name}, {e}")
        return {}


async def get_model_columns(schema_class):
    """
    Retrieves columns and their properties for the table corresponding to the SQLAlchemy model.

    Args:
        model: SQLAlchemy model class to inspect.

    Returns:
        A dictionary with column names as keys and their types and nullable status.
    """
    inspector = inspect(schema_class)
    columns = {}

    for column in inspector.columns:
        column_info = {
            'type': str(column.type),
            'nullable': column.nullable,
            'sub_type': column.type.item_type if hasattr(column.type, 'item_type') else ''
        }
        columns[column.name] = column_info

    return columns


async def add_column_to_table(table_name, column_name, column_schema):
    """
    Adds a new column to the table.
    """
    column_type = column_type_mapping.get(column_schema['type'], column_schema['type'])
    if column_schema.get('sub_type'):
        if column_type == "ARRAY":
            column_type = column_type_mapping.get(f"{column_schema['type']} {column_schema['sub_type']}",
                                                  column_schema['type'])
    nullable = 'NULL' if column_schema['nullable'] else 'NOT NULL'
    if column_type == 'BOOLEAN' and not column_schema['nullable']:
        nullable = 'NOT NULL DEFAULT FALSE'
    elif column_type == 'VARCHAR' and not column_schema['nullable']:
        nullable = "NOT NULL DEFAULT ''"
    alter_query = f'ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type} {nullable};'

    async with async_session() as connection:
        async with connection.begin():
            try:
                await connection.execute(text(alter_query))
                await connection.commit()
                print(f"Added column {column_name} to {table_name}")
            except SQLAlchemyError as e:
                await connection.rollback()
                print(f"Error adding column {column_name}: {str(e)}")


async def drop_column_from_table(table_name, column_name):
    """
    Drops a column from the table.
    """
    drop_query = f'ALTER TABLE {table_name} DROP COLUMN {column_name};'

    async with async_session() as session:
        async with session.begin():
            try:
                await session.execute(text(drop_query))
                await session.commit()
                print(f"Dropped column {column_name} from {table_name}")
            except SQLAlchemyError as e:
                await session.rollback()
                print(f"Error dropping column {column_name}: {str(e)}")


async def alter_column_type(table_name, column_name, column_type):
    """
    Alters the data type of an existing column.
    """
    alter_query = f'ALTER TABLE {table_name} ALTER COLUMN {column_name} TYPE {column_type};'

    async with async_session() as session:
        async with session.begin():
            try:
                await session.execute(text(alter_query))
                await session.commit()
                print(f"Altered column {column_name} type to {column_type} in {table_name}")
            except SQLAlchemyError as e:
                await session.rollback()
                print(f"Error altering column {column_name}: {str(e)}")


async def sync_check_table_columns(table_name, schema_name, module_path):
    """
    Inspects and retrieves columns for a specific table in the database and compares
    them with the expected schema from the SQLAlchemy model.
    """

    # Get actual columns from the table
    columns = await get_table_columns(table_name)
    if not columns:
        return

    module = importlib.import_module(module_path)
    klas_ = schema_name
    klass = getattr(module, klas_)
    # Get expected columns from the SQLAlchemy model
    expected_columns = await get_model_columns(klass)

    # Find columns not in the model (extra columns in the table)
    actual_column_names = set(columns.keys())
    expected_column_names = set(expected_columns.keys())
    columns_not_in_model = actual_column_names - expected_column_names
    columns_not_in_table = expected_column_names - actual_column_names

    # Handle extra columns in the database that are not in the model
    # if columns_not_in_model:
    #     print(f"Columns present in table {table_name} but not in model: {columns_not_in_model}")
    #     for column in columns_not_in_model:
    #         await drop_column_from_table('billing_details', column)

    # Handle missing columns in the table
    if columns_not_in_table:
        for col_name in columns_not_in_table:
            print(
                f"Column {col_name} is missing in the table {table_name}, consider adding it...")
            await add_column_to_table(table_name, col_name, expected_columns[col_name])

    # Check data type mismatches for columns that exist in both the table and the model
    # common_columns = actual_column_names & expected_column_names
    # for col_name in common_columns:
    #     db_type = columns[col_name]['type']
    #     expected_type = expected_columns[col_name]['type']
    #     if db_type.lower() != expected_type.lower():
    #         print(f"Type mismatch in table {table_name} for column {col_name}:
    #         actual type {db_type}, expected type {expected_type}")
    #         # await alter_column_type('billing_details', col_name, expected_type)
    #     # else:
    #     #     print(f"Column {col_name} is in sync with the schema")


async def sync_db_model():
    modules = ["api_manager.hpcl_ceg_model", "api_manager.dashboard_studio_model"]
    for module_path in modules:
        print(f"Running db schema updater for {module_path}")
        module = importlib.import_module(module_path)
        tables = [{"schema": eval(f"module.{mod}.__name__"), "table_name": eval(f"module.{mod}.__tablename__")}
                  for mod in dir(module) if mod.endswith('Schema')]
        for rec in tables:
            await sync_check_table_columns(table_name=rec['table_name'], schema_name=rec['schema'],
                                           module_path=module_path)


if __name__ == '__main__':
    print("Running db schema updater")
    asyncio.run(sync_db_model())
