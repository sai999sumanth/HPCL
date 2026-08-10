import json
import uuid
import typing
import importlib
import traceback
import math
import locale
import utilities.helpers
import re
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy import text
from api_manager.hpcl_ceg_enum import *
from orchestrator.dashboard.charts import *
from sqlalchemy.ext.asyncio import AsyncSession
from orchestrator.dashboard.chart_factory import database
from orchestrator.dashboard.chart_factory import query_context
from orchestrator.dashboard.chart_factory.charts_helpers import quick_columns, unsupported_tables


async def check_db(db):
    """
    Description:
        Get the async session of respective databases using the given database id
    Param:
        Database id
    Returns:
        Async session of the respective database
    """
    return await database.get_db_session(db)

async def execute_query(query):
    async_session = await check_db("")
    async with async_session() as db_session:
        result = await db_session.execute(text(query))
        return result

async def process_recommendations(query_result):
    return [
        {
            **dict(
                zip(
                    query_result.keys(),
                    [float(col) if isinstance(col, Decimal) else col for col in row]
                )
            )
        }
        for row in query_result.fetchall()
    ]

async def getTables(db: AsyncSession, schema):
    """
    Description:
        Get the available table names in the given database and schema
    Params:
        Database name, schema
    Returns:
        List of table names
    """

    qry = f"""
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = '{schema}' 
    AND table_type = 'BASE TABLE';
    """
    result = await db.execute(text(qry))
    tables = result.scalars().all()
    return tables


async def getColumns(db: AsyncSession, schema, table):
    """
    Description:
        Get all the column names in the given table
    Params:
        Database name, schema, table name
    Return:
        List of column names
    """

    qry = f"""
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = '{schema}'
    AND table_name = '{table}';
    """
    result = await db.execute(text(qry))
    columns = result.fetchall()
    return columns


async def getUniqueValues(db: AsyncSession, schema, table, columns, where_cond={}):
    """
    Description:
        Get the unique values of the given columns
    Params:
        Database name, schema, table name and list of column names
    Returns:
        Dictionary of column name as a key and respective list of unique values as a value
    """

    columns_mapping = {}
    if not schema:
        schema = 'public'
    for column in columns:
        if column in quick_columns:
            return {column:quick_columns[column]}
        elif table in unsupported_tables:
            return {table: "Unsupported table"}
        elif where_cond:
            where_query = ''
            for key, value in where_cond.items():
                where_query += f'"{key}" = \'{value}\' AND '
            where_query = where_query[:-5]
            qry = f"""
            SELECT DISTINCT "{column}"
            FROM {schema}."{table}"
            WHERE {where_query};
            """
        else:
            qry = f"""
            SELECT DISTINCT "{column}"
            FROM {schema}."{table}";
            """
        result = await db.execute(text(qry))
        values = result.scalars().all()
        vals = [v for v in values if v not in ['', None]]
        columns_mapping[column] = vals
    return columns_mapping


async def get_dbs():
    async_session = check_db("db")
    session = async_session()
    try:
        query = """
        SELECT datname FROM pg_database WHERE datistemplate = false;
        """
        results = session.execute(query)
        db_list = [i[0] for i in results]
        return db_list
    except Exception as e:
        return []
    finally:
        await session.close()


async def retrieve_data(viz_type, metric_data):
    """
    Description:
        Call the respective chart file
    Params:
        Visualization type and request data
    Returns:
        Returns the dictionary form of results of corresponding chart
    """
    viz_type = viz_type.lower()
    if "_chart" not in viz_type:
        viz_type = viz_type + "_chart"
    module_path = "orchestrator.dashboard.charts." + viz_type
    klas_ = viz_type.title().replace("_", "")
    module = importlib.import_module(module_path)
    klass = getattr(module, klas_)
    method = "get_data"
    function = getattr(klass, method)
    return await function(klass, metric_data)


async def add_metrics(queryStr, metrics):
    """
    Description:
        Add metrics with the corresponding aggregate function given and finally append this into the overall query structure
    Params:
        Overall query structure, metrics in the given request
    Returns:
        Overall query structure in string with the updated metrics
    """

    for metric in metrics:
        label = metric.label
        aggregate = metric.aggregate
        column = metric.column.column_name
        if not label:
            label = f"{aggregate}({column})"
        if aggregate.upper().startswith("COUNT") and "DISTINCT" in aggregate.upper():
            queryStr += 'COUNT(DISTINCT "' + column + '") AS "' + label + '",'
        elif (
                aggregate.upper().startswith("COUNT")
                and "DISTINCT" not in aggregate.upper()
        ):
            queryStr += 'COUNT("' + column + '") AS "' + label + '",'
        elif aggregate.upper().startswith("SUM"):
            queryStr += 'SUM("' + column + '") AS "' + label + '",'
        elif aggregate.upper().startswith("AVG"):
            queryStr += 'AVG("' + column + '") AS "' + label + '",'
        elif aggregate.upper().startswith("MAX"):
            queryStr += 'MAX("' + column + '") AS "' + label + '",'
        elif aggregate.upper().startswith("MIN"):
            queryStr += 'MIN("' + column + '") AS "' + label + '",'
    return queryStr


async def add_filters(queryStr, filters):
    """
    Description:
        Add filters with the corresponding filter operations and values to the overall query structure
    Params:
        Overall query structure and filters in the given request
    Returns:
        Overall query structure in string with the updated filters and also the filter part alone in string (future use, not used anywhere yet)
    """
    bool_true = "TRUE"
    bool_false = "FALSE"
    filter_alone = ""
    if len(filters) == 1:
        for filter in filters:
            filterCol = filter.col
            filterOp = filter.op
            filterVal = filter.val
            is_exec = True
            if filterVal[0] == "No filter" or "no" in filterVal[0].lower():
                is_exec = False
            fval = ""
            if filterOp == "IN" or filterOp == "NOT IN":
                fval = "("
                for val in filterVal:
                    if isinstance(val, bool):
                        if val:
                            fval += f"{bool_true},"
                        else:
                            fval += f"{bool_false},"
                    if val == None:
                        fval += "NULL" + ","
                    else:
                        fval += "'" + val + "'" + ","
                fval = fval.rstrip(",") + ")"

            if filterOp in ["=", "!=", "LIKE", "ILIKE", "<", "<=", ">", ">="]:
                if not filterVal:
                    filterVal = ""
                fval = ""
                FILTERVAL = filterVal[0]
                if not isinstance(FILTERVAL, str):
                    for val in FILTERVAL:
                        if isinstance(fval, bool):
                            if val:
                                fval += f"{bool_true},"
                            else:
                                fval += f"{bool_false},"
                        if val == None:
                            fval += "NULL" + ","
                        else:
                            fval += "'" + str(val) + "' " + ","
                else:
                    fval = "'" + FILTERVAL + "'"
                fval = fval.rstrip(",")

            if filterOp == "TEMPORAL_RANGE":
                if is_exec:
                    fval = filterVal[0].split(" : ")
                    queryStr += "WHERE "
                    queryStr = (
                            queryStr
                            + '"'
                            + filterCol
                            + '"'
                            + " BETWEEN "
                            + "'"
                            + str(fval[0]).strip(" ")
                            + "'"
                            + " AND "
                            + "'"
                            + str(fval[1]).strip(" ")
                            + "'"
                    )

            if filterOp != "TEMPORAL_RANGE":
                if "WHERE" not in queryStr:
                    queryStr += "WHERE "
                if (filterOp == "!=" or "NOT IN") and not filterVal:
                    filterOp = " IS"
                    fval = " NOT NULL "

                queryStr = (
                        queryStr + '"' + filterCol + '" ' + filterOp + " " + fval + " "
                )
    else:
        for filter in filters:
            filterCol = filter.col
            filterOp = filter.op
            print("filterOp: ", filterOp)
            filterVal = filter.val
            is_exec = True
            if filterVal[0] == "No filter" or "no" in filterVal[0].lower():
                is_exec = False
            if filterOp == "IN" or filterOp == "NOT IN":
                fval = "("
                for val in filterVal:
                    if isinstance(val, bool):
                        if val:
                            fval += f"{bool_true},"
                        else:
                            fval += f"{bool_false},"
                    else:
                        fval += "'" + val + "'" + ","
                fval = fval.rstrip(",") + ")"
                filterVal = fval
            if filterOp in ["=", "!=", "LIKE", "ILIKE", "<", "<=", ">", ">="]:
                filterVal = filterVal[0]
                if filterVal and not isinstance(filterVal, bool):
                    filterVal = f"'{filterVal}'"
            if filterOp == "TEMPORAL_RANGE":
                if is_exec:
                    fval = filterVal[0].split(" : ")
                    if "WHERE" not in queryStr:
                        queryStr += " WHERE "
                    queryStr = (
                            queryStr
                            + '"'
                            + filterCol
                            + '"'
                            + " BETWEEN "
                            + "'"
                            + str(fval[0]).strip(" ")
                            + "'"
                            + " AND "
                            + "'"
                            + str(fval[1]).strip(" ")
                            + "'"
                            + " AND "
                    )
                    filter_alone += (
                            '"'
                            + filterCol
                            + '"'
                            + " BETWEEN "
                            + "'"
                            + str(fval[0])
                            + "'"
                            + " AND "
                            + "'"
                            + str(fval[1])
                            + "'"
                            + " AND "
                    )
            if filterOp != "TEMPORAL_RANGE":
                if "WHERE" not in queryStr:
                    queryStr += "WHERE "
                print("filterOp: ", filterOp, "  ", "filterVal: ", filterVal)

                if filterOp == "!=" and not filterVal:
                    filterOp = " IS"
                    filterVal = " NOT NULL "

                print(
                    " after_filterOp: ", filterOp, "  ", " after_filterVal: ", filterVal
                )
                queryStr = (
                        queryStr
                        + '"'
                        + filterCol
                        + '" '
                        + filterOp
                        + " "
                        + filterVal
                        + "  "
                        + " AND "
                )
                filter_alone += (
                        '"' + filterCol + '" ' + filterOp + " " + filterVal + "  " + " AND "
                )
    queryStr = queryStr.rstrip(" AND ")
    filter_alone = filter_alone.rstrip(" AND ")
    return queryStr, filter_alone


async def get_orderbycol(queryStr, orderbyColumn):
    """
    Description:
        Add the columns which are given in orderby into the overall query structure
    Params:
        Overall query structure, orderby columns
    Returns:
        Overall query structure with the updated orderby columns and true/false based on the sorting column
    """

    orderbyCol = {}
    ord_given = False
    for orderCol in orderbyColumn["data"]:
        if orderCol.order_by:
            ord_agg = orderCol.aggregate
            ord_col = orderCol.column.column_name
            if not orderCol.label:
                orderCol.label = ord_col
            if ord_col in queryStr:

                orderbyCol[orderCol.label] = "ASC"
                if orderbyColumn["sortbydesc"]:
                    orderbyCol[orderCol.label] = "DESC"
            else:
                ord_given = True
                combine_order = f'{ord_agg}("{ord_col}")'
                orderbyCol[combine_order] = "ASC"
                if orderbyColumn["sortbydesc"]:
                    orderbyCol[combine_order] = "DESC"
    return orderbyCol, ord_given


async def add_grpbycol_orderbycol(
        queryStr, groupbyCol, orderbyCol, rowlimit, ord_given, query_mode, time_grain
):
    """
    Description:
        If both groupby and orderby columns are there, add both columns into the overall query structure and
        It checks the query mode if it is aggregate it will execute the function else it returns the given query str
    Params:
        Overall query structure, groupby columns, orderby columns, rowlimit, sorting column present or not (bool)
    Returns:
        Overall query structure with the updated groupby and orderby columns
    """
    if query_mode.lower() == "aggregate":
        queryStr += " GROUP BY "
        if time_grain:
            queryStr += f'''DATE_TRUNC('{time_grain['granularity'].lower()}',"{time_grain['column']}"), '''
        for grpcol in groupbyCol:
            # queryStr+= f'"{grpcol.label}",' if grpcol.label else f'"{grpcol.name}",'
            try:
                if grpcol.label:
                    queryStr += f'"{grpcol.name}",'
                elif grpcol.name:
                    queryStr += f'"{grpcol.name}",'
            except:
                queryStr += f'"{grpcol["name"]}",'

        queryStr = queryStr.rstrip(",")
        print("GROUPBYCOL: ", groupbyCol)
    if not ord_given:
        for k, v in orderbyCol.items():
            queryStr += f' ORDER BY "{k}" {v} LIMIT {rowlimit} ;'
    else:
        for k, v in orderbyCol.items():
            queryStr += f" ORDER BY {k} {v} LIMIT {rowlimit} ;"
    return queryStr


async def add_only_grpbycol(queryStr, groupbyCol, query_mode, time_grain):
    """
    Description:
        If the group by column is present and there is no orderby column, it adds the groupby columns into the overall query structure and
        It checks the query mode if it is aggregate it will execute the function else it returns the given query str
    Params:
        Overall query structure, groupby columns
    Returns:
        Overall query structure with the updated groupby columns
    """
    if query_mode.lower() == "aggregate":
        queryStr += " GROUP BY "
        if time_grain:
            queryStr += f'''DATE_TRUNC('{time_grain['granularity'].lower()}',"{time_grain['column']}"), '''
        for grpcol in groupbyCol:
            # queryStr+= f'"{grpcol}",'
            queryStr += f'"{grpcol.name}",'

        queryStr = queryStr.rstrip(",")
    return queryStr


async def add_only_orderbycol(queryStr, orderbyCol, rowlimit, ord_given):
    """
    Description:
        If the order by column is present and there is no groupby column, it adds the orderby columns into the overall query structure
    Params:
        Overall query structure, orderby columns, rowlimit, sorting column present or not (bool)
    Returns:
        Overall query structure with the updated orderby columns
    """

    if not ord_given:
        for k, v in orderbyCol.items():
            queryStr += f' ORDER BY "{k}" {v} LIMIT {rowlimit};'
    else:
        for k, v in orderbyCol.items():
            queryStr += f" ORDER BY {k} {v} LIMIT {rowlimit};"
    return queryStr

async def getQuery(
    viztype,
    table_name,
    table_schema,
    metrics,
    filters,
    grp_by_col,
    query_mode,
    orderbyColumn,
    time_grain={},
    rowlimit=1000,
    serieslimit=0,
):
    """
    Description:
        Get all the necessary data to create an query
    Params:
        Viztype,table_name,table_schema,metrics,columns,filters,groupbyCol,orderbyColumn,rowlimit,serieslimit
    Returns:
        Query as a string
    """

    queryStr = "SELECT "
    if viztype == "bignumber":
        queryStr = await add_metrics(queryStr, metrics)
        queryStr = (
                queryStr.rstrip(",") + " FROM " + table_schema + '."' + table_name + '" '
        )
        queryStr, filter_alone = await add_filters(queryStr, filters)
        queryStr += f" LIMIT {rowlimit};"
        return queryStr
    granular = 'month'
    if time_grain:
        time_frame_map = {
            "YEARLY": "year",
            "QUARTERLY": "quarter",
            "MONTHLY": "month",
            "DAILY": "day",
            "WEEKLY": "week",
            "HOURLY": "hour",
            "MINUTE": "minute",
            "SECOND": "second"
        }
        granularity_map = {
            "year": "FMYYYY",
            "quarter": "FMQ",
            "month": "FMMonth",
            "day": "FMMonth-DD",
            "week": "FMWW",
            "hour": "FMMonth-DD HH24",
            "minute": "FMMonth-DD HH24:MI",
            "second": "FMMonth-DD HH24:MI:SS"
        }
        # granular = time_frame_map.get(time_grain['granularity'])
        granular = time_grain['granularity']
        alias_structure = ""
        if time_grain['column_label']:
            alias_structure+= f' AS "{time_grain["column_label"]}"'
        else:
            alias_structure += f' AS "{time_grain["column"]}"'

        if granular in ['hour', 'minute', 'second', 'year']:
            select_statement = f'''TO_CHAR(DATE_TRUNC('{granular}', "{time_grain['column']}"), '{granularity_map[granular]}') {alias_structure}, '''
        else:
            select_statement = f'''TO_CHAR(DATE_TRUNC('{granular}', "{time_grain['column']}"), 'YYYY-MM-DD') {alias_structure}, '''
        # select_statement = f'''DATE_TRUNC('{granular}', "{time_grain['column']}") AS "{granular.title()}", '''
        queryStr += select_statement

    orderbyCol = dict()
    ord_given = False
    is_groupbycol = False
    if len(grp_by_col) > 0:
        is_groupbycol = True
    # groupbyCol = [i.name for i in grp_by_col]
    groupbyCol = grp_by_col
    if serieslimit >= 0:
        if len(grp_by_col) > 0:
            for grpcol in grp_by_col:
                # queryStr += (
                #     f'"{grpcol.name}" AS "{grpcol.label}",'
                #     if grpcol.label
                #     else f'"{grpcol.name}" AS "{grpcol.name}",'
                # )
                if grpcol.label:
                    queryStr += (f'"{grpcol.name}" AS "{grpcol.label}",')
                elif grpcol.name:
                    queryStr += (f'"{grpcol.name}" AS "{grpcol.name}",')

        # if viztype in ["bar", "line", "area"]:
        #     # x axis column
        #     axisColumn = ""
        #     for col in columns:
        #         if isinstance(col,dict):
        #             axisColumn = col["label"]
        #         else:
        #             axisColumn = col
        #     if axisColumn:
        #         queryStr += '"' + axisColumn + '" AS "' + axisColumn + '",'
        #         groupbyCol.append({"name": axisColumn, "label": axisColumn})

        # checking for count aggregation
        queryStr = await add_metrics(queryStr, metrics)

        # adding table schema and name
        queryStr = (
                queryStr.rstrip(",") + " FROM " + table_schema + '."' + table_name + '" '
        )

        # adding filters
        queryStr, filter_alone = await add_filters(queryStr, filters)

        orderbyCol, ord_given = await get_orderbycol(queryStr, orderbyColumn)

        if len(groupbyCol) == 0:
            is_groupbycol = False

        if not is_groupbycol and time_grain:
            queryStr += f''' GROUP BY DATE_TRUNC('{granular}',"{time_grain['column']}")'''

        # group by and order by
        if is_groupbycol and orderbyCol:
            q = await add_grpbycol_orderbycol(
                queryStr, groupbyCol, orderbyCol, rowlimit, ord_given, query_mode, time_grain
            )
            return q
        # only groupby col without orderbycol
        if is_groupbycol and not orderbyCol:
            queryStr = await add_only_grpbycol(queryStr, groupbyCol, query_mode, time_grain)

        # only order by col without groupbycol
        if orderbyCol and not is_groupbycol:
            q = await add_only_orderbycol(queryStr, orderbyCol, rowlimit, ord_given)
            return q
        queryStr += f" LIMIT {rowlimit} ;"
        return queryStr

    elif serieslimit > 0 and is_groupbycol:
        # adding groupby col
        for grpcol in grp_by_col:
            queryStr += (
                f'"{grpcol.name}" AS "{grpcol.label}",'
                if grpcol.label
                else f'"{grpcol.name}" AS "{grpcol.name}",'
            )
        # checking for count aggregation
        queryStr = await add_metrics(queryStr, metrics)

        # adding table schema and name
        queryStr = (
                queryStr.rstrip(",") + " FROM " + table_schema + '."' + table_name + '" '
        )

        queryStr += " JOIN (SELECT "

        for grpcol_ in grp_by_col:
            queryStr += f""""{grpcol_['name']}" AS "{grpcol_.get('label', grpcol_['name'])}__","""

        queryStr = await add_metrics(queryStr, metrics)

        queryStr = (
                queryStr.rstrip(",") + " FROM " + table_schema + '."' + table_name + '" '
        )

        if orderbyCol:
            queryStr = await add_grpbycol_orderbycol(
                queryStr, groupbyCol, orderbyCol, rowlimit, ord_given, query_mode, time_grain
            )

        # only groupby col without orderbycol
        if not orderbyCol:
            queryStr = await add_only_grpbycol(queryStr, groupbyCol, query_mode, time_grain)
        queryStr = queryStr.rstrip(";") + ") AS series_limit ON "

        for grpcol_ in grp_by_Col:
            queryStr += f""""{grpcol_['name']}" = "{grpcol_.get('label', grpcol_['name'])}__" AND """
        queryStr = queryStr.rstrip(" AND ")

        # adding filters
        queryStr, filter_alone = await add_filters(queryStr, filters)

        orderbyCol, ord_given = await get_orderbycol(queryStr, orderbyColumn)

        # group by and order by
        if orderbyCol:
            q = await add_grpbycol_orderbycol(
                queryStr, groupbyCol, orderbyCol, rowlimit, ord_given, query_mode, time_grain
            )
            return q
        # only groupby col without orderbycol
        if not orderbyCol:
            queryStr = await add_only_grpbycol(queryStr, groupbyCol, query_mode, time_grain)

        queryStr += f" LIMIT {rowlimit};"

    print("queryStr: ", queryStr)
    return queryStr


async def get_drill_down_data(
        table_name: str,
        table_schema: str,
        filter_mapping: typing.Dict[str, typing.List[str]],
        limit: int = 1000
):
    """

    Args:
        table_name:
        table_schema:
        filter_mapping:
        limit:

    Returns:

    """
    async_session = await check_db("db")
    session = async_session()
    try:
        drill_down_cond = await drill_down_query(table_name, table_schema, filter_mapping, limit)
        result = await session.execute(text(drill_down_cond))

        # Get the column names
        column_names = result.keys()

        # Convert to list of dict
        rows = [dict(zip(column_names, row)) for row in result.fetchall()]
        return rows
    except Exception as e:
        print(e)
        print(traceback.print_exc())
        return []
    finally:
        await session.close()


async def drill_down_query(
        table_name: str,
        table_schema: str,
        filter_mapping: typing.Dict[str, typing.List[str]],
        limit: int = 0
):
    """

    Args:
        table_name:
        table_schema:
        filter_mapping:
        limit:

    Returns:

    """
    query = "SELECT * FROM " + table_schema + '."' + table_name + '" '
    if filter_mapping:
        query += "WHERE "
        count = 1
        for key, values in filter_mapping.items():
            where_cond = ', '.join(f"'{value}'" if not isinstance(value, int) else f"{value}" for value in values)
            if count > 1:
                query += f'"{key}" IN ({where_cond}) AND '
            else:
                query += f'"{key}" IN ({where_cond}) '
            count += 1
    query = query[:-1]
    if limit:
        query += f" LIMIT {limit}"

    query += ';'
    return query


async def select_query_builder(query_builder_json: typing.Dict[str, typing.Any]) -> str:
    """
    Args:
        query_builder_json:
            {
                "schema": "",
                "table": "",
                "join_tables": [],
                "columns": {
                    "original col": "alias col",
                },
                "order_by": {
                    "columns": "condition" ---> ["ASC", "DESC"]
                },
                "limit": 1000,
                "filters": [
                    {
                        "column": "",
                        "dtype": "",
                        "op": "",
                        "val": "",
                        "cond": "",
                    }
                ],
                "metrics": [
                    {
                        "aggregate": "",
                        "column": "",
                        "label": "",   ---> alias column name
                        "dtype": "",
                    }
                ],
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
                        "cond": {
                            "from": {
                                "table": "",
                                "column": ""
                            },
                            "to": {
                                "table": "",
                                "column": ""
                            },
                        }
                        "columns": {}
                    }
                }
            }
    Returns:
        Generated query string
    """

    if not query_builder_json:
        return ""

    query_builder_json = query_builder_json.copy()

    # Adding default schema
    query_builder_json["schema"] = query_builder_json.get("schema", "public")

    # Adding table mappings
    table_mappings = await query_context.map_alias_name_to_table(
        [query_builder_json.get("table", [])] + query_builder_json.get("join_tables", [])
    )

    # Adding Metrics Columns to select columns
    query_builder_json["map_column"], group_by_map = await query_context.add_metric_to_col(
        {query_builder_json['table']: query_builder_json.get("columns", {})},
        query_builder_json.get("metrics", []),
        query_builder_json.get("join_condition", {}),
        table_mappings
    )

    # Adding Select Columns
    query = "SELECT "
    if query_builder_json.get("map_column", {}):
        table_column_map = await query_context.get_select_columns(query_builder_json["map_column"], table_mappings)
        for table, column_str in table_column_map.items():
            query += f'{column_str}'
            query += ", "
        query = query[:-2]
        query += " "
    else:
        query += "* "

    # Adding From Clause Schema.TableName
    query += f'''FROM "{query_builder_json['schema']}"."{query_builder_json['table']}" AS {table_mappings.get(query_builder_json['table'], "a")} '''

    # Adding Join Clause
    if query_builder_json.get("join_tables", []):
        query += await query_context.join_query_builder(
            query_builder_json.get("join_condition", {}),
            table_mappings
        )

    # Adding Where Clause
    if query_builder_json.get("filters", []):
        count = 1
        operator = ""
        for filters in query_builder_json["filters"]:
            filters = filters.copy()
            filters['dtype'] = filters.get('dtype', 'character varying')
            where_clause = await query_context.where_clause(
                filters, query_builder_json['table'], table_mappings
            )
            if count == 1:
                query += "WHERE {}".format(where_clause)
            else:
                query += "{} {}".format(operator, where_clause)
            count += 1
            operator = filters.get("cond", "AND")

    # Adding Group By Clause
    if query_builder_json.get("metrics", []):
        count = 1
        for table, column in group_by_map.items():
            for each_col in column:
                if count == 1:
                    query += f'GROUP BY "{table_mappings.get(table, "a")}".{each_col} '
                else:
                    query += f', "{table_mappings.get(table, "a")}".{each_col} '
                count += 1

    # Adding Order By Clause
    if query_builder_json.get("order_by", {}):
        query += "ORDER BY "
        count = 1
        for column, condition in query_builder_json["order_by"].items():
            if count == 1:
                query += f'"{column}" {condition} '
            else:
                break
            count += 1

    # Adding Limit
    if query_builder_json.get("limit", None):
        query += f"LIMIT {query_builder_json['limit']} "

    query = query[:-1] + ";"

    return query


async def join_query_builder(query_builder_json: typing.Dict[str, typing.Any]) -> str:
    """

    Args:
        query_builder_json:

    Returns:

    """
    pass


async def get_list_of_charts(ui_data=True) -> typing.List[typing.Dict]:
    """
    Returns:
        List of charts
    """
    with open("../orchestrator/dashboard/charts/charts_elements.json") as f:
        data = json.load(f)

    if not ui_data:
        return data

    filtered_data = []

    # # Iterate through each section in the data
    for section in data:
        filtered_component = dict()
        filtered_component['section'] = section['section']
        filtered_component['components'] = []
        # Iterate through each component in the section
        for component in section["components"]:
            # Extract the required details
            filtered_component['components'].append({
                "key": component["key"],
                "name": component["name"],
                "unique_id": component["unique_id"],
                "image": component["image"],
                "execute_action": component["execute_action"] if "execute_action" in component.keys() else "",
                "tags": component["tags"]
            })
            # Add the filtered component to the list
        filtered_data.append(filtered_component)
    return filtered_data


async def get_chart_data(unique_id: str) -> typing.Dict:
    """
    Args:
        unique_id
    Returns:
        Chart data
    """
    data = await get_list_of_charts(ui_data=False)

    for section in data:
        for component in section["components"]:
            if component["unique_id"] == unique_id:
                component['unique_uuid'] = str(uuid.uuid4())
                return component
    raise ValueError("Chart not found")


async def get_resources_unique_value(db: AsyncSession, columns_list: list):
    """
    Input: AsyncSession
    Returns: List of dictionaries
    """
    columns = columns_list
    table = "resources"
    columns_mapping = {}
    for column in columns:
        qry = f"""
            SELECT DISTINCT "{column}"
            FROM public."{table}" 
            WHERE "{column}" != '';
            """
        result = await db.execute(text(qry))
        values = result.scalars().all()
        columns_mapping[column] = values
    return columns_mapping

async def generate_auto_complete_text(prompt):
    """
       Input: Prompt
       Returns: List of texts that contains prompt
    """
    async_session = await check_db("db")
    session = async_session()
    try:
        # query = f"""
        #     SELECT DISTINCT user_ai_text
        #     FROM public.charts
        #     WHERE user_ai_text ILIKE '%{prompt}%'
        #     LIMIT 6;
        #     """

        query = f"""
            SELECT DISTINCT ai_texts
            FROM public.ai_texts
            WHERE ai_texts ILIKE '%{prompt}%'
            LIMIT 6;
            """
        result = await session.execute(text(query))
        resp = result.scalars().all()
        return resp
    except Exception as e:
        print(e)
        return []
    finally:
        await session.close()

async def fetch_dashboard_details(org_id,name,value):
    """
       Input: column name, column value
       Returns: List of dashboards contains the given value of the given column
    """
    async_session = await check_db("db")
    session = async_session()
    where_condition = f"WHERE organization_id = {org_id} "
    if name and value:
        where_condition += f"AND {name} = '{value}' "
    print("where_condition: ",where_condition)
    try:
        query = f"""
            SELECT *  
            FROM public.dash_boards
            {where_condition};
            """
        print("query: ",query)
        query_results = await session.execute(text(query))
        column_names = query_results.keys()
        final_list = [dict(zip(column_names, row)) for row in query_results.fetchall()]
        if not name: name = 'id'
        sorted_data = sorted(final_list, key=lambda x: x[name])
        return sorted_data

    except Exception as e:
        print(e)
        return []
    finally:
        await session.close()

async def fetch_dashboard_group_details(org_id, group_id):
    """
       Input: Organization id, group id
       Returns: Group name and its dashboards count
    """
    async_session = await check_db("db")
    session = async_session()

    where_condition = f"WHERE organization_id = {org_id}"
    if group_id:
        # where_condition+= f" AND group_id = {group_id}"
        where_condition+= f" AND {group_id} = ANY(group_id)"

    try:
        query = f"""
                SELECT group_name, COUNT(id) as dashboards_count
                FROM public.dash_boards
                {where_condition}
                GROUP BY group_name;
                """
        query_results = await session.execute(text(query))
        column_names = query_results.keys()
        final_list = [dict(zip(column_names, row)) for row in query_results.fetchall()]
        row_total = sum(item['dashboards_count'] for item in final_list)
        final_list.append({"group_name": "All", "dashboard_count": row_total})
        sorted_data = sorted(final_list, key=lambda x: x['group_name'])
        return sorted_data

    except Exception as e:
        print(e)
        return str(e)
    finally:
        await session.close()

async def fetch_all_alerts(csp):
    async_session = await check_db("db")
    session = async_session()

    where_condition = ""
    if csp:
        where_condition = f" WHERE cloud_provider='{csp.value}'"
    try:
        query = f"""
                SELECT *
                FROM public.alerts
                {where_condition}
                """
        query_results = await session.execute(text(query))
        column_names = query_results.keys()
        final_list = [dict(zip(column_names, row)) for row in query_results.fetchall()]
        return final_list

    except Exception as e:
        print(e)
        return str(e)
    finally:
        await session.close()


async def number_formatting(number,type):
    locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
    D3_FORMAT_OPTIONS_PYTHON = {
        "SMART_NUMBER": locale.format_string("%.2f", number),  # General formatting with 2 decimals
        "~g": f"{number:g}",  # Original value
        ",d": f"{int(number):,}",  # Integer with commas (e.g., 12,345)
        ".1s": f"{number / 1000:.1f}k" if number >= 1000 else f"{number:.1f}",  # Abbreviation to 10k
        ".3s": f"{number / 1000:.3g}k" if number >= 1000 else f"{number:.3g}",  # Abbreviation to 12.3k
        ",.1%": f"{number * 100:,.1f}%",  # Percentage with commas (e.g., 1,234,543.2%)
        ".3%": f"{number * 100:.3f}%",  # Percentage to 3 decimal places
        ".4r": f"{round(number, -1)}",  # Rounded to 4 significant figures (e.g., 12350)
        ",.3f": f"{number:,.3f}",  # Comma-separated with 3 decimals
        "+,": f"{number:+,.3f}",  # Comma-separated with sign (e.g., +12,345.432)
        "$,.2f": f"${number:,.2f}",  # Dollar sign with 2 decimals
    }
    return D3_FORMAT_OPTIONS_PYTHON.get(type, number)


async def timestamp_formatting(dt,type):
    if isinstance(dt, str):
        date_formats = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%Y%m%d", "%m/%d/%Y %H:%M:%S",
                        "%Y", "%B-%d %H", "%B-%d %H:%M", "%B-%d %H:%M:%S"]

        for fmt in date_formats:
            try:
                dt = datetime.strptime(dt, fmt)
                break
            except ValueError:
                continue
        else:
            print('DATE: ',dt)
            raise ValueError("Date format not supported")

    elif isinstance(dt, (int, float)):  # If a timestamp is provided as a number
        dt = datetime.fromtimestamp(dt)

    def adaptive_format(dt):
        try:
            delta = datetime.now() - dt
        except:
            delta = datetime.now(dt.tzinfo) - dt
        if delta.days > 365:
            return dt.strftime("%Y")  # year
        elif delta.days > 30:
            return dt.strftime("%B")  # month
        elif delta.days > 7:
            return dt.strftime("%b %d")  # week
        elif delta.days > 0:
            return dt.strftime("%a %d")  # day
        elif delta.seconds > 3600:
            return dt.strftime("%I %p")  # hour
        elif delta.seconds > 60:
            return dt.strftime("%I:%M")  # minute
        elif delta.seconds > 0:
            return dt.strftime(":%S") + "s"  # second
        else:
            return dt.strftime("%S.%f")[:-3] + "ms"

    TIME_FORMAT_OPTIONS = {
        "Adaptive formatting": adaptive_format(dt),
        "dd/mm/yyyy": dt.strftime("%d/%m/%Y"),
        "mm/dd/yyyy": dt.strftime("%m/%d/%Y"),
        "yyyy-mm-dd": dt.strftime("%Y-%m-%d"),
        "yyyy-mm-dd hh:mm:ss": dt.strftime("%Y-%m-%d %H:%M:%S"),
        "dd-mm-yyyy hh:mm:ss": dt.strftime("%d-%m-%Y %H:%M:%S"),
        "hh:mm:ss": dt.strftime("%H:%M:%S"),
        "yyyy": dt.strftime("%Y"),
        "Month-Day Hour": dt.strftime("%B-%d %H"),
        "Month-Day Hour:Minute": dt.strftime("%B-%d %H:%M"),
        "Month-Day Hour:Minute:Second": dt.strftime("%B-%d %H:%M:%S")
    }
    return TIME_FORMAT_OPTIONS.get(type, dt)

async def list_column_configs(column_labels,column_config):
    column_number_formatting = []
    if column_config:
        for config in column_config:
            if config.d3_number_format:
                print(column_labels)
                config.column_name = column_labels.get(config.column_name, config.column_name)
                print(config.column_name)
                column_number_formatting.append(
                    {
                        "name": config.column_name,
                        "type": config.d3_number_format
                    }
                )
    return column_number_formatting

async def list_symbol_formats(column_labels,column_config):
    symbol_formatting = []
    if column_config:
        for config in column_config:
            if config.currency_format:
                config.column_name = column_labels.get(config.column_name, config.column_name)
                symbol_formatting.append(
                    {
                        "name": config.column_name,
                        "type": config.currency_format
                    }
                )
    return symbol_formatting

async def add_symbol_format(input,position,symbol):
    input = str(input)
    currency_symbols = {
        "USD": "$",  # United States Dollar
        "EUR": "€",  # Euro
        "GBP": "£",  # British Pound Sterling
        "INR": "₹",  # Indian Rupee
        "MXN": "$",  # Mexican Peso
        "JPY": "¥",  # Japanese Yen
        "CNY": "¥",  # Chinese Yuan
    }
    if position == "prefix":
        output = f"{currency_symbols.get(symbol, symbol)} {input}"
    else:
        output = f"{input} {currency_symbols.get(symbol, symbol)}"
    return output

async def get_not_join_query(user_query, organization_id):
    # query contains where clause, add organization id directly in the where clause
    if re.search(r'\bwhere\b', user_query, re.IGNORECASE):
        splitted_query = re.split(r'\bwhere\b', user_query, flags=re.IGNORECASE)
        splitted_query[1] = f"organization_id = {organization_id} AND " + splitted_query[1]
        user_query_ = f"{splitted_query[0]} WHERE {splitted_query[1]}"
        return user_query_

    # query doesn't contain where clause, check for group by clause or order by clause or limit
    #   -> to place the where condition of organization id before the group by or order by or limit

    elif not re.search(r'\bwhere\b', user_query, re.IGNORECASE):
        where_cond = f" WHERE organization_id = {organization_id}"
        user_query = user_query.strip().rstrip(';')

        if re.search(r'\bgroup by\b', user_query, re.IGNORECASE):
            clause_split = re.split(r'\bgroup by\b', user_query, flags=re.IGNORECASE)
            user_q = f"{clause_split[0]}{where_cond} GROUP BY {clause_split[1]}"

        elif re.search(r'\border by\b', user_query, re.IGNORECASE):
            clause_split = re.split(r'\border by\b', user_query, flags=re.IGNORECASE)
            user_q = f"{clause_split[0]}{where_cond} ORDER BY {clause_split[1]}"

        elif re.search(r'\blimit\b', user_query, re.IGNORECASE):
            clause_split = re.split(r'\blimit\b', user_query, flags=re.IGNORECASE)
            user_q = f"{clause_split[0]}{where_cond} LIMIT {clause_split[1]}"

        else:
            user_query += where_cond
            user_q = user_query
        return  user_q



async def get_join_query(user_query, organization_id):
    aliases = re.findall(r'\bFROM\s+\w+\s+as\s+(\w+)|\bJOIN\s+\w+\s+as\s+(\w+)', user_query, re.IGNORECASE)
    table_aliases = [alias for group in aliases for alias in group if alias]
    org_id_condition = " AND".join(f" {alias}.organization_id = {organization_id}" for alias in table_aliases)
    print("org_id_condition: ",org_id_condition)

    # query contains where clause, add organization id directly in the where clause
    if re.search(r'\bwhere\b', user_query, re.IGNORECASE):
        splitted_query = re.split(r'\bwhere\b', user_query, flags=re.IGNORECASE)
        splitted_query[1] = f"{org_id_condition} AND " + splitted_query[1]
        user_query_ = f"{splitted_query[0]} WHERE {splitted_query[1]}"
        return user_query_

    # query doesn't contain where clause, check for group by clause or order by clause or limit
    #   -> to place the where condition of organization id before the group by or order by or limit

    elif not re.search(r'\bwhere\b', user_query, re.IGNORECASE):
        where_cond = f" WHERE {org_id_condition}"
        if re.search(r'\bgroup by\b', user_query, re.IGNORECASE):
            clause_split = re.split(r'\bgroup by\b', user_query, flags=re.IGNORECASE)
            user_q = f"{clause_split[0]}{where_cond} GROUP BY {clause_split[1]}"

        elif re.search(r'\border by\b', user_query, re.IGNORECASE):
            clause_split = re.split(r'\border by\b', user_query, flags=re.IGNORECASE)
            user_q = f"{clause_split[0]}{where_cond} ORDER BY {clause_split[1]}"

        elif re.search(r'\blimit\b', user_query, re.IGNORECASE):
            clause_split = re.split(r'\blimit\b', user_query, flags=re.IGNORECASE)
            user_q = f"{clause_split[0]}{where_cond} LIMIT {clause_split[1]}"

        else:
            user_query += where_cond
            user_q = user_query
        return user_q


async def get_start_end_data(time_range):
    
    # Calculate date range based on time_range parameter
    today = datetime.now()
    if time_range == "0-30":
        start_date = today - timedelta(days=30)
        end_date = today
    elif time_range == "31-60":
        start_date = today - timedelta(days=60)
        end_date = today - timedelta(days=31)
    elif time_range == "61-90":
        start_date = today - timedelta(days=90)
        end_date = today - timedelta(days=61)
    elif time_range == "90+":
        start_date = today - timedelta(days=365*10)  # A far back date, just for fallback
        end_date = today - timedelta(days=90)
    else:
        raise ValueError(f"Invalid time range: {time_range}")
    return start_date,end_date
    
async def get_alerts_cost(org_id,cloud_provider,cloud_account_id,time_range):
    month_days = utilities.helpers.get_month_days()
    start_date,end_date = await get_start_end_data(time_range)
    # Format start_date and end_date to match the format in your database
    start_date_str = start_date.strftime('%Y-%m-%d %H:%M:%S')
    end_date_str = end_date.strftime('%Y-%m-%d %H:%M:%S')
    print("start_date_str", start_date_str)
    where_condition = f"WHERE organization_id = {org_id} AND created_at BETWEEN '{start_date_str}' AND '{end_date_str}'"
    
    if cloud_provider:
        where_condition += f" AND cloud_provider = '{cloud_provider.value}'"
    if cloud_account_id:
        where_condition += f" AND cloud_account_id = '{cloud_account_id}'"
    
    #where_condition = f"WHERE organization_id = {org_id}"
    try:
        query = f"""
                SELECT recommendation_data
                FROM alerts
                
                {where_condition}
                """
        print("printing the query")
        print("query: ", query)
        
        query_results = await execute_query(query)
        recommendation_data = await process_recommendations(query_results)
        
        total_recommendations_data = []
        
        for data in recommendation_data:
            rec = data['recommendation_data']
            present_cost = rec['present_cost']*24*month_days
            revised_cost = rec['revised_cost']*24*month_days
            savings_cost = present_cost - revised_cost
            total_recommendations_data.append({
                "present_cost": present_cost,
                "savings_cost": savings_cost
            })

        total_present_cost = sum([rec['present_cost'] for rec in total_recommendations_data])
        total_savings_cost = sum([rec['savings_cost'] for rec in total_recommendations_data])

        realized_where_condition = where_condition + " AND alert_status = 'Closed'"
        realized_query = f"""
                SELECT recommendation_data
                FROM alerts
                {realized_where_condition}
            """
        suppressed_where_condition = where_condition + " AND alert_status = 'Suppressed'"
        suppressed_query = f"""
                SELECT recommendation_data
                FROM alerts
                {suppressed_where_condition}
            """
        total_realized_cost = 0
        rel_qry_res = await execute_query(realized_query)
        rel_data = await process_recommendations(rel_qry_res)
        for rel_d in rel_data:
            rel = rel_d['recommendation_data']
            total_realized_cost += rel['savings_per_hour']*24*month_days
        
        total_suppressed_cost = 0
        sup_qry_res = await execute_query(suppressed_query)
        sup_data = await process_recommendations(sup_qry_res)
        for sup_d in sup_data:
            sup = sup_d['recommendation_data']
            total_suppressed_cost += sup['savings_per_hour']*24*month_days
        
        
        res = {
            "total_present_cost":total_present_cost,
            "total_savings_cost":total_savings_cost,
            "total_realized_cost":total_realized_cost,
           
            "total_suppressed_cost": total_suppressed_cost
        }
        print("res",res)

        return {"status": True, "message": "success", "data": res}

    except Exception as e:
        print(e)
        return {"status": False, "message": str(e), "data": []}

async def get_alerts_cost_by_recommendation_type(org_id, recommendation_type,cloud_provider,cloud_account_id,time_range):
    month_days = utilities.helpers.get_month_days()
    start_date,end_date = await get_start_end_data(time_range)
    start_date_str = start_date.strftime('%Y-%m-%d %H:%M:%S')
    end_date_str = end_date.strftime('%Y-%m-%d %H:%M:%S')
    where_condition = f"WHERE organization_id = {org_id} AND created_at BETWEEN '{start_date_str}' AND '{end_date_str}'"

    if cloud_provider:
        where_condition += f" AND cloud_provider = '{cloud_provider.value}'"
    if cloud_account_id:
        where_condition += f" AND cloud_account_id = '{cloud_account_id}'"
    if recommendation_type:
        where_condition += f" AND recommendation_type ='{recommendation_type}'"
    try:
        query = f"""
                SELECT recommendation_type, recommendation_data
                FROM alerts
                {where_condition}
                """
        print("query: ",query)
        try:
            query_results = await execute_query(query)
        except Exception as e:
            print(e)
        print("query_results",query_results)
        
        recommendation_data = await process_recommendations(query_results)
        total_recommendations_data = {}
        final_data = {}
        print("recommendation_data",recommendation_data)
        for data in recommendation_data:
            rec = data['recommendation_data']
            res_type = data['recommendation_type']
            present_cost = rec['present_cost']*24*month_days
            revised_cost = rec['revised_cost']*24*month_days
            savings_cost = present_cost - revised_cost
            total_recommendations_data.setdefault(res_type, []).append({
                "present_cost": present_cost,
                "savings_cost": savings_cost
            })

        print("total_recommendations_data",total_recommendations_data)
        for rec, rec_data in total_recommendations_data.items():
            if rec not in final_data:
                final_data[rec] = {}
            final_data[rec]['total_present_cost'] = sum(r['present_cost'] for r in rec_data)
            final_data[rec]['total_savings_cost'] = sum(r['savings_cost'] for r in rec_data)
            
        print("final_data",final_data)
        realized_where_condition = where_condition+" AND alert_status = 'Closed'"
        realized_query = f"""
            SELECT recommendation_type, recommendation_data
            FROM alerts
            {realized_where_condition}
        """
        total_realized_data = {}
        rel_qry_res =  await execute_query(realized_query)
        rel_data = await process_recommendations(rel_qry_res)

        for rel_d in rel_data:
            rel = rel_d['recommendation_data']
            rel_type = rel_d['recommendation_type']
            total_realized_data.setdefault(rel_type, []).append(
                {"total_realized_cost":rel['present_cost']*24*month_days}
            )
        print("rel_data",rel_data)
        
        print("total_realized_data",total_realized_data)
        try:
            for realized_type, realized_data in total_realized_data.items():
                if realized_type not in final_data:
                    final_data[realized_type] = {}
                final_data[realized_type]['total_realized_cost'] = sum(r['total_realized_cost'] for r in realized_data)
        except Exception as e:
            print('e')
        print("final_data",final_data)
        suppressed_where_condition = where_condition+" AND alert_status = 'Suppressed'"
        suppressed_query = f"""
            SELECT resource_type, recommendation_data
            FROM alerts
            {realized_where_condition}
        """
        total_suppressed_data = {}
        
        sup_qry_res =  await execute_query(suppressed_query)
        sup_data = await process_recommendations(sup_qry_res)

        for sup_d in sup_data:
            sup = sup_d['recommendation_data']
            sup_type = sup_d['resource_type']
            total_suppressed_data.setdefault(sup_type, []).append(
                {"total_suppressed_cost":rel['present_cost']*24*month_days}
            )
        print("total_suppressed_data",total_suppressed_data)
        try:
            
            for suppressed_type, suppressed_data in total_suppressed_data.items():
                if suppressed_type not in final_data:
                    final_data[suppressed_type] = {}
                final_data[suppressed_type]['total_suppressed_cost'] = sum(r['total_suppressed_cost'] for r in suppressed_data)
            print("final_data",final_data)   
        except Exception as e:
            print(e)
        return {"status": True, "message": "success", "data": final_data}

    except Exception as e:
        print(e)
        return {"status": False, "message": str(e), "data": []}

async def get_alerts_cost_by_resource_type(org_id, resource_type,cloud_provider,cloud_account_id,time_range):
    month_days = utilities.helpers.get_month_days()
    start_date,end_date = await get_start_end_data(time_range)
    start_date_str = start_date.strftime('%Y-%m-%d %H:%M:%S')
    end_date_str = end_date.strftime('%Y-%m-%d %H:%M:%S')
    where_condition = f"WHERE organization_id = {org_id} AND created_at BETWEEN '{start_date_str}' AND '{end_date_str}'"

    if cloud_provider:
        where_condition += f" AND cloud_provider = '{cloud_provider.value}'"
    if cloud_account_id:
        where_condition += f" AND cloud_account_id = '{cloud_account_id}'"
    if resource_type:
        where_condition += f" AND resource_type ='{resource_type}'"
    
    try:
        query = f"""
                SELECT resource_type, recommendation_data
                FROM alerts
                {where_condition}
                """
        print("query: ",query)
        query_results = await execute_query(query)
        resources_data = await process_recommendations(query_results)
        total_resources_data = {}
        final_data = {}

        for data in resources_data:
            rec = data['recommendation_data']
            res_type = data['resource_type']
            present_cost = rec['present_cost']*24*month_days
            revised_cost = rec['revised_cost']*24*month_days
            savings_cost = present_cost - revised_cost
            total_resources_data.setdefault(res_type, []).append({
                "present_cost": present_cost,
                "savings_cost": savings_cost
            })

        for rec, rec_data in total_resources_data.items():
            if rec not in final_data:
                final_data[rec] = {}
            final_data[rec]['total_present_cost'] = sum(r['present_cost'] for r in rec_data)
            final_data[rec]['total_savings_cost'] = sum(r['savings_cost'] for r in rec_data)
            final_data[rec]['total_realized_cost'] = 0
            final_data[rec]['total_suppressed_cost'] = 0

        realized_where_condition = where_condition+" AND alert_status = 'Closed'"
        realized_query = f"""
            SELECT resource_type, recommendation_data
            FROM alerts
            {realized_where_condition}
        """
        total_realized_data = {}
        rel_qry_res =  await execute_query(realized_query)
        rel_data = await process_recommendations(rel_qry_res)

        for rel_d in rel_data:
            rel = rel_d['recommendation_data']
            rel_type = rel_d['resource_type']
            total_realized_data.setdefault(rel_type, []).append(
                {"total_realized_cost":rel['present_cost']*24*month_days}
            )
    
            
        for realized_type, realized_data in total_realized_data.items():
            final_data[realized_type]['total_realized_cost'] = sum(r['total_realized_cost'] for r in realized_data)
            
        suppressed_where_condition = where_condition+" AND alert_status = 'Suppressed'"
        suppressed_query = f"""
            SELECT resource_type, recommendation_data
            FROM alerts
            {suppressed_where_condition}
        """
        total_suppressed_data = {}
        sup_qry_res =  await execute_query(suppressed_query)
        sup_data = await process_recommendations(sup_qry_res)

        for sup_d in sup_data:
            sup = sup_d['recommendation_data']
            sup_type = sup_d['resource_type']
            total_suppressed_data.setdefault(rel_type, []).append(
                {"total_suppressed_cost":rel['present_cost']*24*month_days}
            )
    
            
        for suppressed_type,suppressed_data in total_suppressed_data.items():
            final_data[suppressed_type]['total_suppressed_cost'] = sum(r['total_suppressed_cost'] for r in suppressed_data)
            
        return {"status": True, "message": "success", "data": final_data}

    except Exception as e:
        print(e)
        return {"status": False, "message": str(e), "data": []}

async def get_alerts_cost_by_regions(org_id, region,cloud_provider,cloud_account_id,time_range):
    
    
    month_days = utilities.helpers.get_month_days()
    start_date,end_date = await get_start_end_data(time_range)
    start_date_str = start_date.strftime('%Y-%m-%d %H:%M:%S')
    end_date_str = end_date.strftime('%Y-%m-%d %H:%M:%S')
    
    if region:
        where_condition = f"WHERE a.organization_id = {org_id} AND b.organization_id = {org_id} AND a.created_at BETWEEN '{start_date_str}' AND '{end_date_str}' AND b.region ='{region}'"
    else:
        where_condition = ""
        
    if cloud_provider:
        where_condition += f" AND a.cloud_provider = '{cloud_provider.value}'"
    if cloud_account_id:
        where_condition += f" AND a.cloud_account_id = '{cloud_account_id}'"
    print("where_condition",where_condition)
    try:
        query = f"""
                SELECT b.region as region, a.recommendation_data as recommendation_data
                FROM alerts as a
                JOIN resources as b 
                ON a.resource_id = b.resource_id AND a.organization_id = b.organization_id
                {where_condition}
                """
                
        print("query: ",query)
        query_results = await execute_query(query)
        resources_data = await process_recommendations(query_results)
        total_resources_data = {}
        final_data = {}

        for data in resources_data:
            rec = data['recommendation_data']
            res_type = data['region']
            present_cost = rec['present_cost']*24*month_days
            revised_cost = rec['revised_cost']*24*month_days
            savings_cost = present_cost - revised_cost
            total_resources_data.setdefault(res_type, []).append({
                "present_cost": present_cost,
                "savings_cost": savings_cost
            })

        for rec, rec_data in total_resources_data.items():
            if rec not in final_data:
                final_data[rec] = {}
            final_data[rec]['total_present_cost'] = sum(r['present_cost'] for r in rec_data)
            final_data[rec]['total_savings_cost'] = sum(r['savings_cost'] for r in rec_data)
            final_data[rec]['total_realized_cost'] = 0
            final_data[rec]['total_suppressed_cost'] = 0
        realized_where_condition = where_condition+" AND alert_status = 'Closed'"
        realized_query = f"""
            SELECT b.region as region, a.recommendation_data as recommendation_data
            FROM alerts as a
            JOIN resources as b 
            ON a.resource_id = b.resource_id AND a.organization_id = b.organization_id
            {realized_where_condition}
        """
        total_realized_data = {}
        rel_qry_res =  await execute_query(realized_query)
        rel_data = await process_recommendations(rel_qry_res)

        for rel_d in rel_data:
            rel = rel_d['recommendation_data']
            rel_type = rel_d['region']
            total_realized_data.setdefault(rel_type, []).append(
                {"total_realized_cost":rel['present_cost']*24*month_days}
            )
        for realized_type, realized_data in total_realized_data.items():
            print("realized_type: ",realized_type)
            final_data[realized_type]['total_realized_cost'] = sum(r['total_realized_cost'] for r in realized_data)
            
        
        suppressed_where_condition = where_condition+" AND alert_status = 'Suppressed'"
        suppressed_query = f"""
            SELECT b.region as region, a.recommendation_data as recommendation_data
            FROM alerts as a
            JOIN resources as b 
            ON a.resource_id = b.resource_id AND a.organization_id = b.organization_id
            {suppressed_where_condition}
        """
        total_suppressed_data = {}
        sup_qry_res =  await execute_query(suppressed_query)
        sup_data = await process_recommendations(sup_qry_res)

        for sup_d in sup_data:
            sup = sup_d['recommendation_data']
            sup_type = sup_d['region']
            total_suppressed_data.setdefault(rel_type, []).append(
                {"total_suppressed_cost":rel['present_cost']*24*month_days}
            )
        for suppressed_type, suppressed_data in total_suppressed_data.items():
            print("suppressed_type: ",suppressed_type)
            final_data[suppressed_type]['total_suppressed_cost'] = sum(r['total_suppressed_cost'] for r in suppressed_data)
            


        return {"status": True, "message": "success", "data": final_data}

    except Exception as e:
        print(e)
        return {"status": False, "message": str(e), "data": []}
    
async def fetch_current_month_alerts(data):
    async_session = await check_db("db")
    session = async_session()
    cloud_providers = [rec for rec in BusinessUnit.__members__]
    
    critical_mapping = {'P1':'Critical','P2':'Medium','P3':'Low'}
    where_condition = f"""
     

   WHERE  organization_id = '{data.organization_id}' 
    and (
        (created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' 
         AND created_at < DATE_TRUNC('month', CURRENT_DATE))
        OR
        (created_at >= DATE_TRUNC('month', CURRENT_DATE) 
         AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')
      )
    
    """
    print("data",data)
    if data.csp:
        query = f"""
        SELECT 
    CASE 
        WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) 
             AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        THEN 'current_month'
        WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' 
             AND created_at < DATE_TRUNC('month', CURRENT_DATE)
        THEN 'prev_month'
    END AS month_category,
    json_agg(alerts) AS grouped_records
FROM public.alerts
{where_condition}
  AND (
        (created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' 
         AND created_at < DATE_TRUNC('month', CURRENT_DATE))
        OR
        (created_at >= DATE_TRUNC('month', CURRENT_DATE) 
         AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')
      )
GROUP BY month_category;

        """
        result_list = {}
       
        sum_where_condition = f"""

        WHERE organization_id = '{data.organization_id}' 
        """
        sum_query = f"""
                    SELECT 
                cloud_provider,
                SUM(
                    CASE 
                        WHEN recommendation_data IS NOT NULL 
                            AND recommendation_data::text ~* 'monthly_savings'
                        THEN (REPLACE(REPLACE(recommendation_data::text, '''', '"'), 'None', 'null')::jsonb ->> 'monthly_savings')::numeric
                        ELSE 0
                    END
                ) AS total_monthly_savings
            FROM 
                public.alerts
            {sum_where_condition}
            GROUP BY 
                cloud_provider
            ORDER BY 
                cloud_provider;
        """
        sum_results = await session.execute(text(sum_query))
        column_names = sum_results.keys()
        sum_list = [dict(zip(column_names, row)) for row in sum_results.fetchall()]
        
        for each_csp in sum_list:
            result_list[each_csp['cloud_provider']+'_recommendedSavings'] = float(round(each_csp['total_monthly_savings'],4))
        print("result_list",result_list)
        
        critical_where_condition = f"""

                WHERE organization_id = '{data.organization_id}'  and cloud_provider IN ('AWS', 'OCI', 'GCP', 'Azure') 
                    AND priority IN ('P1', 'P2', 'P3')
        """
        critical_query = f"""
                        SELECT 
                    cloud_provider,
                    priority,
                    COUNT(*) AS alert_count
                FROM 
                    alerts
                {critical_where_condition}
                                 
                GROUP BY 
                    cloud_provider, 
                    priority
                ORDER BY 
                    cloud_provider, 
                    priority;
                                   
        """
        priority_results = await session.execute(text(critical_query))
        column_names = priority_results.keys()
        critical_list = [dict(zip(column_names, row)) for row in priority_results.fetchall()]
        print("critical_list",critical_list)
        
        for each_priority in critical_list:
            result_list[each_priority['cloud_provider']+'_'+critical_mapping.get(each_priority['priority'],'')] = each_priority['alert_count']
        query_results = await session.execute(text(query))
        column_names = query_results.keys()
        final_list = [dict(zip(column_names, row)) for row in query_results.fetchall()]
        total_alerts = []
        print('grouped_records',len(final_list))
        if len(final_list)>1:
            total_alerts.extend(final_list[0]['grouped_records'])
            total_alerts.extend(final_list[1]['grouped_records'])
        if len(final_list)==1:
            total_alerts.extend(final_list[0]['grouped_records'])
        if len(final_list) ==0:
            return {'msg':'No data present'}
        
        result_list['current_month'] = {}
        result_list['prev_month'] = {}
        
        if len(final_list) >=1:
            result_list['current_month']['data'] = final_list[0]['grouped_records']
            result_list['current_month']['total'] = len(final_list[0]['grouped_records'])
            result_list['current_month']['open'] = len([x for x in result_list['current_month']['data'] if x['alert_status'] == 'Open'])
            result_list['current_month']['close'] = len([x for x in result_list['current_month']['data'] if x['alert_status'] == 'Closed'])
            result_list['current_month']['suppressed'] = len([x for x in result_list['current_month']['data'] if x['alert_status'] == 'suppressed'])
        if len(final_list)>1:    
            result_list['prev_month']['data'] = final_list[1]['grouped_records']
            result_list['prev_month']['total']  = len(final_list[1]['grouped_records'])
            result_list['prev_month']['open'] = len([x for x in result_list['prev_month']['data'] if x['alert_status'] == 'Open'])
            result_list['prev_month']['close'] = len([x for x in result_list['prev_month']['data'] if x['alert_status'] == 'Closed'])
            result_list['prev_month']['suppressed'] = len([x for x in result_list['prev_month']['data'] if x['alert_status'] == 'suppressed'])
        for cloud_provider in cloud_providers:
            result_list[cloud_provider+'_total'] = len([x for x in total_alerts if x['cloud_provider'] == cloud_provider])
            result_list[cloud_provider+'_open'] = len([x for x in total_alerts if x['cloud_provider'] == cloud_provider and x['alert_status'] == 'Open'])
            result_list[cloud_provider+'_close'] = len([x for x in total_alerts if x['cloud_provider'] == cloud_provider and x['alert_status'] == 'Closed'])
            
            
        print("result_list",result_list)
        '''
        print("result_list",result_list)
        print(result_list['current_month']['total'])
        print(result_list['prev_month']['total'])
        print(result_list['prev_month']['open'])
        print(result_list['prev_month']['close'])
        print(result_list['current_month']['open'])
        print(result_list['current_month']['close'])
        '''
        
        return result_list
async def fetch_previous_month_alerts(data):
    async_session = await check_db("db")
    session = async_session()

    where_condition = ""
    print("data",data)
    if data.csp:
        where_condition = f""" WHERE cloud_provider='{data.csp.value}' and organization_id= '{data.organization_id}' and   created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
  and created_at < DATE_TRUNC('month', CURRENT_DATE)"""
    try:
        query = f"""
                SELECT *
                FROM public.alerts
                {where_condition}
                """
        query_results = await session.execute(text(query))
        column_names = query_results.keys()
        final_list = [dict(zip(column_names, row)) for row in query_results.fetchall()]
        return final_list

    except Exception as e:
        print(e)
        return str(e)
    finally:
        await session.close()

async def alert_filters(org_id,column_filters):
    select_cols = ['cloud_provider', 'resource_type', 'resource_id', 'recommendation_type','recommendation_data',
                   'alert_type', 'description', 'priority', 'alert_status', 'created_at']
    spl_col = ['description', 'created_at', 'savings_percentage']
    filt_query = f"SELECT {','.join(select_cols)} FROM alerts WHERE organization_id = {org_id}"
    for col, val in column_filters.items():
        if col in spl_col:
            if col == 'description':
                filt_query += f" AND {col} ILIKE '%{val}%'"
            elif col == 'created_at':
                start_date, end_date = map(lambda x: datetime.strptime(x, "%Y-%m-%d %H:%M:%S"), val.split(" : "))
                filt_query += f" AND created_at BETWEEN '{start_date}' and '{end_date}'"
            elif col == 'savings_percentage':
                filt_query += f" AND recommendation_data->>'{col}' = '{val}'"
        else:
            filt_query += f" AND {col} = '{val}'"
    print('Alert Filter: ',filt_query)
    resp = await execute_query(filt_query)
    return await process_recommendations(resp)


async def alerts_charts():
    charts_details = {
        "previous_month_alerts": "",
        "present_month_alerts": "",
        "open_alerts": "",
        "closed_alerts": "",

    }