import re
import typing
from enum import Enum
TEMPORAL_RANGE_PATTERN = r'datetime\("([^"]{1,50})"\) : datetime\("([^"]{1,50})"\)'


class FilterOperator(str, Enum):
    """
    Operators used filter controls
    Returns: String Operator
    """

    EQUALS = "="
    NOT_EQUALS = "!="
    GREATER_THAN = ">"
    LESS_THAN = "<"
    GREATER_THAN_OR_EQUALS = ">="
    LESS_THAN_OR_EQUALS = "<="
    LIKE = "LIKE"
    ILIKE = "ILIKE"
    IS_NULL = "IS NULL"
    IS_NOT_NULL = "IS NOT NULL"
    IN = "IN"
    NOT_IN = "NOT IN"
    IS_TRUE = "IS TRUE"
    IS_FALSE = "IS FALSE"
    TEMPORAL_RANGE = "TEMPORAL_RANGE"


class FilterStringOperator(str, Enum):
    """
    Operators used filter controls
    Returns: String Operator
    """

    EQUALS = "EQUALS"
    NOT_EQUALS = "NOT_EQUALS"
    GREATER_THAN = "GREATER_THAN"
    LESS_THAN = "LESS_THAN"
    GREATER_THAN_OR_EQUALS = "GREATER_THAN_OR_EQUALS"
    LESS_THAN_OR_EQUALS = "LESS_THAN_OR_EQUALS"
    LIKE = "LIKE"
    ILIKE = "ILIKE"
    IS_NULL = "IS_NULL"
    IS_NOT_NULL = "IS_NOT_NULL"
    IN = "IN"
    NOT_IN = "NOT_IN"
    IS_TRUE = "IS_TRUE"
    IS_FALSE = "IS_FALSE"
    TEMPORAL_RANGE = "TEMPORAL_RANGE"


class AggregationOperator(str, Enum):
    """
    Operators used filter controls
    Returns: String Operator
    """

    SUM = "sum"
    AVG = "avg"
    MAX = "max"
    MIN = "min"
    COUNT = "count"


class JoinOperator(str, Enum):
    """
    Operators used filter controls
    Returns: String Operator
    """

    inner = "INNER JOIN"
    full = "FULL JOIN"
    right = "RIGHT JOIN"
    left = "LEFT JOIN"


async def is_str_val(val) -> str:
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


async def is_num_val(dtype, val) -> str:
    """

    Args:
        dtype:
        val:

    Returns:

    """
    query_val = ''
    if dtype in ["bigint", "integer"]:
        if isinstance(val, list):
            query_val = ', '.join(f"{v}" for v in val)
        else:
            query_val = val
    else:
        if isinstance(val, list):
            query_val = ', '.join(f"'{v}'" for v in val)
        else:
            query_val = f"'{val}'"
    return query_val


async def add_metric_to_col(
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
            alias_col = f'''"{metric['aggregate']}({metric['column']})"'''
            agg_op = eval(f"AggregationOperator.{metric['aggregate']}.value")
            agg_col = f'''{agg_op}("{table_mappings.get(table, "a")}"."{metric["column"]}")'''
            map_columns[table].update({agg_col: alias_col})

    for table, columns in join_conditions.items():
        map_columns[table] = dict()
        group_by_map[table] = []
        for col, alias_col in columns['columns'].items():
            map_columns[table].update({f'"{col}"': f'"{alias_col}"'})
            group_by_map[table].append(f'"{col}"')
    return map_columns, group_by_map


async def where_clause(filter: typing.Dict, table: str, table_mapping: typing.Dict) -> str:
    """

    Args:
        table_mapping:
        table:
        filter:
            {
                "column": "",
                "dtype": "",
                "op": "",
                "val": "",
                "cond": "",
            }
    Returns:

    """
    op = filter["op"]
    val = filter["val"]
    col = filter["column"]
    dtype = filter["dtype"]
    table_alias = table_mapping.get(table, "a")
    where_clause_cond: str = ""
    if op == "TEMPORAL_RANGE":
        match = re.match(TEMPORAL_RANGE_PATTERN, val)
        if match:
            start_date, end_date = match.groups()
            where_clause_cond += f'''{table_alias}."{col}" BETWEEN '{start_date}' AND '{end_date}' '''
    elif op == FilterStringOperator.IN or op == FilterStringOperator.NOT_IN:
        val_list = await is_num_val(dtype, val)
        where_clause_cond += f'''{table_alias}."{col}" IN ({val_list}) '''
    elif op == FilterStringOperator.IS_TRUE:
        where_clause_cond += f'''{table_alias}."{col}" IS TRUE '''
    elif op == FilterStringOperator.IS_FALSE:
        where_clause_cond += f'''{table_alias}."{col}" IS FALSE '''
    elif op == FilterStringOperator.NOT_EQUALS:
        val = await is_num_val(dtype, val)
        where_clause_cond += f'''{table_alias}."{col}" != {val} '''
    elif op == FilterStringOperator.EQUALS:
        val = await is_num_val(dtype, val)
        where_clause_cond += f'''{table_alias}."{col}" = {val} '''
    elif op == FilterStringOperator.GREATER_THAN:
        val = await is_num_val(dtype, val)
        where_clause_cond += f'''{table_alias}."{col}" > {val} '''
    elif op == FilterStringOperator.LESS_THAN:
        val = await is_num_val(dtype, val)
        where_clause_cond += f'''{table_alias}."{col}" < {val} '''
    elif op == FilterStringOperator.GREATER_THAN_OR_EQUALS:
        val = await is_num_val(dtype, val)
        where_clause_cond += f'''{table_alias}."{col}" >= {val} '''
    elif op == FilterStringOperator.LESS_THAN_OR_EQUALS:
        val = await is_num_val(dtype, val)
        where_clause_cond += f'''{table_alias}."{col}" <= {val} '''
    elif op == FilterStringOperator.LIKE:
        where_clause_cond += f'''{table_alias}."{col}" LIKE '%{val}%' '''
    elif op == FilterStringOperator.ILIKE:
        where_clause_cond += f'''{table_alias}."{col}" ILIKE '%{val}%' '''
    elif op == FilterStringOperator.IS_NULL:
        where_clause_cond += f'''{table_alias}."{col}" IS NULL '''
    elif op == FilterStringOperator.IS_NOT_NULL:
        where_clause_cond += f'''{table_alias}."{col}" IS NOT NULL '''
    return where_clause_cond


async def get_select_columns(
        columns_dicts: typing.Dict[str, typing.Any],
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


async def map_alias_name_to_table(tables_list: typing.List[str]) -> typing.Dict[str, str]:
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
    for table_name in tables_list:
        map_tables[table_name] = chr(ascii_num)
        ascii_num += 1

    return map_tables


async def join_query_builder(
        join_query_json: typing.Dict[str, typing.Any],
        table_mapping: typing.Dict[str, str]
) -> str:
    """

    Args:
        join_query_json:
        table_mapping:

    Returns:

    """
    join_query = ""
    for table, join_dict in join_query_json.items():
        join_cond = eval(f"JoinOperator.{join_dict['join']}.value")
        on_cond = f'{table_mapping.get(join_dict["cond"]["from"]["table"], "a")}.{join_dict["cond"]["from"]["column"]} = {table_mapping.get(join_dict["cond"]["to"]["table"], "a")}.{join_dict["cond"]["to"]["column"]}'
        join_query += f'{join_cond} "{table}" AS {table_mapping.get(table, "a")} ON {on_cond} '

        operator = "AND"
        join_where_clause = ""
        for filters in join_dict["filters"]:
            filters = filters.copy()
            filters['dtype'] = filters.get('dtype', 'character varying')
            where_cond = await where_clause(filters, table, table_mapping)
            join_where_clause += f'{operator} {where_cond}'
            operator = filters.get("cond", "AND")

        if join_where_clause:
            join_query += f'{join_where_clause} '

    return join_query
