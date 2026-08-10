from AlgoCharts_enum import *
from AlgoCharts_model import *
import fastapi
import sys
import json
import charts_functions

router = fastapi.APIRouter(prefix='/algocharts')

# Action get_tables
@router.post('/get_tables', tags=['AlgoCharts'])
async def algocharts_get_tables(data: Algocharts_Get_TablesParams):
    '''
    Description:
        Retrieves the tables from the given database and schema
    Input:
        {
            "database": "recon",
            "schema": "public"
        }
    Returns: 
        List: A list of table names
    Output:
        ["Employee_Details","smartrecondev_data_validation","6077e41f9a2b160016f14ec3","sample_table"]
    '''

    session = await charts_functions.check_db(data.database)
    if not session:
        return {"status":False,"message":"check the database name","data":[]}
    async with session() as db:
        try:
            tables_list = await charts_functions.getTables(db,data.schema)
            if not tables_list:
                return {"status":False,"message":"check the schema name","data":[]}
        except Exception as e:
            return {"status":False,"message":str(e),"data":[]}
        return {"status":True,"message":"success","data":tables_list}

# Action get_columns
@router.post('/get_columns', tags=['AlgoCharts'])
async def algocharts_get_columns(data: Algocharts_Get_ColumnsParams):
    '''
    Description:
        Retrieves the column names from the given table, schema and database
    Input:
        {
            "database": "recon",
            "schema": "public",
            "table": "smartrecondev_recon_exec_details_log"
        }
    Returns:
        List: A list of column names
    Output:
        ["_id","statementDate","jobStatus","errorMsg","reconName","reconProcess","reconId","reconExecutionId","stmtDate"]
    '''

    session = await charts_functions.check_db(data.database)
    if not session:
        return {"status":False,"message":"check the database name","data":[]}
    async with session() as db:
        try:
            columns_list =  await charts_functions.getColumns(db,data.schema,data.table)
            if not columns_list:
                return {"status":False,"message":"check the table or schema name","data":[]}
        except Exception as e:
            return {"status":False,"message":str(e),"data":[]}
        return {"status":True,"message":"success","data":columns_list}

# Action get_unique_values
@router.post('/get_unique_values', tags=['AlgoCharts'])
async def algocharts_get_unique_values(data: Algocharts_Get_Unique_ValuesParams):
    '''
    Description:
        Retrives unique values of the given column names
    Input:
        {
            "database": "recon",
            "schema": "public",
            "table": "smartrecondev_recon_exec_details_log",
            "column": ["jobStatus"]
        }
    Returns:
        Dictionary: A dictionary of column as a key and its respective unique values as value
    Output:
        {"jobStatus":["Success","Failed","Running","RolledBack"]}
    '''

    session = await charts_functions.check_db(data.database)
    if not session:
        return {"status":False,"message":"check the database name","data":[]}
    async with session() as db:
        try:
            columns_mapping =  await charts_functions.getUniqueValues(db,data.schema,data.table,data.column)
            if not columns_mapping:
                return {"status":False,"message":"check the table or column name","data":[]}
        except Exception as e:
            return {"status":False,"message":str(e),"data":[]}
        return {"status":True,"message":"success","data":columns_mapping}
    
# Action create_charts
@router.post('/chart',tags=['AlgoCharts'])
async def algocharts_create_charts(data:AlgoChartsCreate):
    """
    Description:
        Retrieves data as per the model and return the data in the respective chart format
    Input:
        Look into the model 'AlgoChartsCreate'
    Returns:
        List of dictionaries
    Output:
        {"data":[{}]}
    """

    viztype = data.visualization_name
    table_name = data.table
    table_schema = data.schema
    chart_data_str = await charts_functions.retrieve_data(viztype,data)
    # print('DATA--> ',chart_data_str)
    chart_data = chart_data_str
    if not isinstance(chart_data_str,dict):
        chart_data = json.loads(chart_data_str)
    if not chart_data['data']:
        return {"status":False,"message":"Query returns none","data":chart_data['data']}
    return {"status":True,"message":"success","data":chart_data['data']}


# Action create_charts
@router.post('/inline-chart',tags=['AlgoCharts'])
async def algocharts_create_charts(data:AlgoChartsCreate):
    """
    Description:
        Retrieves data as per the model and return the data in the respective chart format
    Input:
        Look into the model 'AlgoChartsCreate'
    Returns:
        List of dictionaries
    Output:
        {"data":[{}]}
    """

    viztype = data.visualization_name
    table_name = data.table
    table_schema = data.schema
    chart_data_str = await charts_functions.retrieve_data(viztype,data)
    # print('DATA--> ',chart_data_str)
    chart_data = chart_data_str
    if not isinstance(chart_data_str,dict):
        chart_data = json.loads(chart_data_str)
    if not chart_data['data']:
        return {"status":False,"message":"Query returns none","data":chart_data['data']}
    return {"status":True,"message":"success","data":chart_data['data']}


