from dashboard_studio_enum import *
from dashboard_studio_model import *
from hpcl_ceg_model import *
import fastapi
import json
import httpx
import base64
import importlib
import traceback
import hpcl_ceg_model
import urdhva_base.context
import urdhva_base.redispool
import utilities.connection_mapping as connection_mapping
import polars as pl
import pandas as pd
from orchestrator.dashboard.chart_factory import JSONHashing
from orchestrator.dashboard.chart_factory import date_actions
from orchestrator.dashboard.chart_factory import charts_helpers
from orchestrator.dbconnector.widget_actions import widget_actions
from orchestrator.dashboard.chart_factory import charts_functions
from orchestrator.dashboard.dashboard_actions.superset_embedded_dashboard import SupersetManager
import orchestrator.dbconnector.widget_actions.lpg_plant_queries as lpg_plant_queries
router = fastapi.APIRouter(prefix='/charts')


# Action get_tables
@router.post('/get_tables', tags=['Charts'])
async def charts_get_tables(data: Charts_Get_TablesParams):
    '''
    Description:
        Retrieves the tables from the given database and schema
    Input:
        {
            "database": "hpcl_ceg",
            "schema": "public"
        }
    Returns: 
        List: A list of table names
    Output:
        ["organization","credential_vault","billing_cost","cloud_accounts","recommendations","metrics"]
    '''
    # Charts_Connection_Vault_RoutingParams.connection_id = data.connection_id
    # Charts_Connection_Vault_RoutingParams.action = 'table_name'
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=data.connection_id,
        action='table_name'
    )
    function = await charts_connection_vault_routing(charts_ins)
    return await function(schema_name=data.schema)


# Action get_columns
@router.post('/get_columns', tags=['Charts'])
async def charts_get_columns(data: Charts_Get_ColumnsParams):
    '''
    Description:
        Retrieves the column names from the given table, schema and database
    Input:
        {
            "database": "hpcl_ceg",
            "schema": "public",
            "table": "recommendations"
        }
    Returns:
        List: A list of column names
    Output:
        ["resource_type","cloud_account_id","cloud_account_name","tenant_id"]
    '''
    # Charts_Connection_Vault_RoutingParams.connection_id = data.connection_id
    # Charts_Connection_Vault_RoutingParams.action = 'column_names'
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=data.connection_id,
        action='column_names'
    )
    function = await charts_connection_vault_routing(charts_ins)
    return await function(schema_name=data.schema, table_name=data.table)


@router.post('/get_databases', tags=['Charts'])
async def get_databases(connection_id: str):
    """
    Description:
        Retrieves the available databases
    Returns:
        List of databases
    Output:
        ["database1","database2","database3 "]
    """
    # Charts_Connection_Vault_RoutingParams.connection_id = connection_id
    # Charts_Connection_Vault_RoutingParams.action = 'get_databases'
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=connection_id,
        action='get_databases'
    )
    function = await charts_connection_vault_routing(charts_ins)
    return await function()


# Action get_unique_values
@router.post('/get_unique_values', tags=['Charts'])
async def charts_get_unique_values(data: Charts_Get_Unique_ValuesParams):
    '''
    Description:
        Retrives unique values of the given column names
    Input:
        {
            "database": "hpcl_ceg",
            "schema": "public",
            "table": "recommendations",
            "column": ["resource_type"]
        }
    Returns:
        Dictionary: A dictionary of column as a key and its respective unique values as value
    Output:
        {"jobStatus":["Success","Failed","Running","RolledBack"]}
    '''
    # Charts_Connection_Vault_RoutingParams.connection_id = data.connection_id
    # Charts_Connection_Vault_RoutingParams.action = 'get_distinct_values'
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=data.connection_id,
        action='get_distinct_values'
    )
    function = await charts_connection_vault_routing(charts_ins)
    return await function(schema_name=data.schema, table_name=data.table, column_name=data.column)


# Action create_charts
@router.post('/chart', tags=['Charts'])
async def create_charts(data: ChartsCreate):
    """
    Description:
        Retrieves data as per the model and return the data in the respective chart format
    Input:
        Look into the model 'ChartsCreate'
    Returns:
        List of dictionaries
    Output:
        {"data":[{}]}
    """

    viztype = data.visualization_name
    if not data.table:
        data.table = "hpcl_ceg"
    if not data.schema:
        data.schema = "public"
    chart_data_str = await charts_functions.retrieve_data(viztype, data)
    if not isinstance(chart_data_str, dict):
        chart_data = json.loads(chart_data_str)
    chart_data = chart_data_str

    if not chart_data['status']:
        return {
            "status": False, "message": str(chart_data['message']), "data": chart_data['data']
        }

    if viztype in ['bar', 'line', 'area', 'custom_bar', 'time_series_bar']:
        return {
            "status": True, "message": "success",
            "query": chart_data['query'],
            "x_axis": chart_data['x_axis'],
            "data": chart_data['data']
        }

    return {
        "status": True, "message": "success", "query": chart_data['query'], "data": chart_data['data']
    }


@router.post('/get_drill_down_data', tags=['Charts'])
async def drill_down_data(data: Charts_Drill_Down_DataParams):
    """
    Description:
        Retrieves data as per the model and return the data in the respective chart format
    Input:
        Look into the model 'Drill_Down_DataParams'
    Returns:
        List of dictionaries
    Output:
        {"data":[{}]}
    """
    _query = await charts_functions.drill_down_query(
        data.table_name, data.table_schema, data.filter_mapping, data.limit
    )  # TO DO need to get query from respective database
    # Charts_Connection_Vault_RoutingParams.connection_id = data.connection_id
    # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=data.connection_id,
        action='execute_query'
    )
    function = await charts_connection_vault_routing(charts_ins)
    resp = await function(query=_query)
    return {
        "status": True, "message": "success", "data": resp
    }


@router.post('/dashboard_charts', tags=['Charts'])
async def dashboard_charts(data: Charts_Dashboard_ChartsParams):
    """
    Description:
        Retrieves data as per the model and return the data in the respective chart format
    Input:
        Look into the model 'DashBoard_ChartsParams'
    Returns:
        List of dictionaries
    Output:
        {"data":[{}]}
    """
    return {
        "status": True, "message": "success", "data": await charts_functions.get_list_of_charts()
    }


@router.post('/get_chart_form', tags=['Charts'])
async def get_dashboard_chart_form(data: Charts_Get_Dashboard_Chart_FormParams):
    """
    Description:
        Retrieves data as per the model and return the data in the respective chart format
    Input:
        Look into the model 'Get_Chart_DataParams'
    Returns:
        List of dictionaries
    Output:
        {"data":[{}]}
    """
    return {
        "status": True, "message": "success", "data": await charts_functions.get_chart_data(data.unique_id)
    }

# Action get_distinct_values
@router.post('/get_distinct_values', tags=['Charts'])
async def charts_get_distinct_values(data: Charts_Get_Distinct_ValuesParams):
    """
    Description:
        Retrives unique values of the given column names
    Input:
        {
            "database": "hpcl_ceg",
            "schema": "public",
            "table": "recommendations",
            "column": ["resource_type"]
        }
    Returns:
        Dictionary: A dictionary of column as a key and its respective unique values as value
    Output:
        {"jobStatus":["Success","Failed","Running","RolledBack"]}
    """
    # Charts_Connection_Vault_RoutingParams.connection_id = data.connection_id
    # Charts_Connection_Vault_RoutingParams.action = 'get_distinct_values'
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=data.connection_id,
        action='get_distinct_values'
    )
    function = await charts_connection_vault_routing(charts_ins)
    return await function(
        schema_name=data.schema, table_name=data.table, column_name=data.column,
        where_clause=[cond.dict() for cond in data.where_cond]
    )

# Action get_product_values
@router.post('/get_product_values', tags=['Charts'])
async def charts_get_product_values(data: Charts_Get_Distinct_ValuesParams):
    """
    Description:
        Retrives unique values of the given column names
    Input:
        {
            "database": "hpcl_ceg",
            "schema": "public",
            "table": "recommendations",
            "column": ["resource_type"]
        }
    Returns:
        Dictionary: A dictionary of column as a key and its respective unique values as value
    Output:
        {"jobStatus":["Success","Failed","Running","RolledBack"]}
    """
    productOrders = {
            "Retail": ["MS", "HSD", "CNG", "SKO", "Compressed Bio Gas (CBG)", "LPG BLK"],
            "Aviation": ["ATF"],
            "I&C": ["HSD", "LDO", "LSHS", "FO", "Naptha", 'Bitumen Blk', "Bitumen Pkd", "Bitumen Modified", "Solvent 2445",
                    "Solvent 1425", "JBO", "Sulphur", "Propylene"],
            "LPG": ["LPG PKD - Domestic", "LPG PKD - Non Domestic", "LPG BLK", "BULK PROPANE", "BULK BUTANE"],
            "PETCHEM": ["PETCHEM"],
            "Lubes": ["LUBES RETAIL", "Automotive Oils", "Automotive Greases", "Automotive Specialities", "Industrial oils",
                    "Industrial Greases", "Industrial Specialities", "Base Oil"],
            "GAS": ["CNG", "LNG", "Compressed Bio Gas (CBG)"]
        }
    # Charts_Connection_Vault_RoutingParams.connection_id = data.connection_id
    # Charts_Connection_Vault_RoutingParams.action = 'get_product_values'
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=data.connection_id,
        action='get_product_values'
    )
    function = await charts_connection_vault_routing(charts_ins)
    res_data  = await function(
        schema_name=data.schema, table_name=data.table, column_name=data.column, where_clause=[cond.dict() for cond in data.where_cond]
    )
  
    if 'SBU_Name' in [x.key for x in data.where_cond]:
        #if 'Retail' in [x.value for x in data.where_cond]:
            sbu_name = [x.value for x in data.where_cond if x.key == 'SBU_Name' and x.value not in ['0','']][0]
            
            retail_order = productOrders[sbu_name]
            if 'data' in res_data:
                result_data = res_data['data']['ProductName']
                sorted_products = sorted(result_data, key=lambda x: (retail_order.index(x) if x in retail_order else float('inf')))
                res_data["data"]["ProductName"] = sorted_products
            
            
    return res_data


# Action drill_down_data
@router.post('/drill_down_data', tags=['Charts'])
async def charts_drill_down_data(data: Charts_Drill_Down_DataParams):
    ...


# Action generate_dynamic_chart_query
@router.post('/generate_dynamic_chart_query', tags=['Charts'])
async def charts_generate_dynamic_chart_query(data: Charts_Generate_Dynamic_Chart_QueryParams):
    """
    Description:
        This function will generate NLP queries by using the trained model in openai
    Input:
        {
            "query_context": "<NLP Query String>",
        }
    Returns:
        Dictionary: A dictionary of column as a key and its respective unique values as value
    Output:
        {"jobStatus":["Success","Failed","Running","RolledBack"]}
    """
    redis_ins = await urdhva_base.redispool.get_redis_connection()
    if not data.query_context:
        return False, "Invalid inputs"

    redis_key = base64.b64encode("_".join(data.query_context.lower().split()).encode()).decode()
    if await redis_ins.hexists("nlp_cache", redis_key):
        nlp_data = await redis_ins.hget("nlp_cache", redis_key)
        return True, json.loads(nlp_data)

    base_url = "https://api.openai.com/v1/completions"

    # Encrypted key
    nlp_key = ('c2stcHJvai11NHNBWmJsTy1CWDVBaVZwUl95aEwwWjlzSkhJT0ZXV2NMU1FPTW9FaGxnLWZKd2NsZi0wQ3NuQ'
               '2xpVkRsUXhaLWwwLXlWV2htN1QzQmxia0ZKVTVhM1F3ejRud0tWTlF1N0IxeHM3d1pyTUpNZEVQTTBsMTVTdDlx'
               'QTZpbWlnaERETWdoM0cxQUFYQXFwSXZlbE1sQm82YUNIZ0E=')

    # Creating authentication headers
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {base64.b64decode(nlp_key.encode()).decode()}"
    }

    # Generating json data required for data query
    input_context = {
        "model": "ft:davinci-002:personal::AKgLf2q5", "prompt": data.query_context, "temperature": 1,
        "max_tokens": 512, "top_p": 1, "frequency_penalty": 0, "presence_penalty": 0
    }

    # Running http request for fetching data from base url
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(base_url, headers=headers, json=input_context, timeout=120)
            if resp.status_code // 100 != 2:
                return False, "Error getting data, Please retry after few seconds"
            response = resp.json()
            if not response.get("choices"):
                return False, "Error: The response does not contain valid choices."
            if not response['choices'][0].get('text'):
                return False, "Error: The first choice does not contain a 'text' field."

            # Extract the text from the first choice
            result_text = response['choices'][0]['text']

            # Try to parse the result as JSON
            try:
                context_result = json.loads(result_text)
                context_result["database"] = urdhva_base.settings.db_urls['postgres_async'][0].path.split("/")[-1]
                context_result["schema"] = "public"
                await redis_ins.hset("nlp_cache", redis_key, json.dumps(context_result))
                return True, context_result
            except json.JSONDecodeError as e:
                print(f"Exception while decoding response {e}, Traceback: {traceback.format_exc()}")
                return False, ("Error: The response text is not a valid JSON object. "
                               "Please try again with a different prompt.")
    except httpx._exceptions.TimeoutException as e:
        print(f"Exception while getting response {e}")
        return False, "Response timedout"
    except Exception as e:
        print(f"Exception while running openai api {e}, Traceback: {traceback.format_exc()}")
        return False, f"Error: Request failed due to {str(e)}"


# Action save_charts
@router.post('/save_charts', tags=['Charts'])
async def charts_save_charts(data: Charts_Save_ChartsParams):
    """
    Description:
        This function will save the chart if no record id and update the chart if record id
    Input:
        Charts_Save_ChartsParams
    Returns:
        A dictionary of status and message
    Output:
        {"status":True, "message": "Chart Data Created"}
    """
    if urdhva_base.context.context.exists():
        rpt = urdhva_base.context.context.get('rpt', {})
    else:
        rpt = {}
    created_by = rpt.get('email', 'system')
    created_user = rpt.get('given_name', 'hpcl_ceg') +' '+ rpt.get('family_name', 'Engine')
    data.created_by = created_by
    data.created_user = created_user
    fields_included_in_hash = ['database', 'schema', 'table', 'visualization_name', 'type', 'created_by']
    filtered_fields = {field: getattr(data, field) for field in fields_included_in_hash if hasattr(data, field)}
    chart_params = {"params": data.params.dict()}
    filtered_fields.update(chart_params)
    hashed_value = JSONHashing.generate_json_hash(filtered_fields)
    data.hashed_value = hashed_value
    if data.group_id == 0:
        grp_data = GroupsCreate(**{"name": data.group_name, "created_by": data.created_by,
                                   "created_user": data.created_user, "organization_id": data.organization_id})
        collected = await grp_data.create()
        print("collected create: ", collected)
        print("Groups created")
        data.group_id = collected['id'] if isinstance(collected, dict) else collected.id
    else:
        grp_data = Groups(**{"id": data.group_id, "name": data.group_name,
                             "created_by": data.created_by, "created_user": data.created_user,
                             "organization_id": data.organization_id})
        await grp_data.modify()
        collected = grp_data
        print("collected modified: ", collected)
        print("Groups modified")

    if data.record_id:
        chart_data = data.dict()
        chart_data.update({"id": data.record_id, "params": data.params.dict()})
        chart_data = Charts(**chart_data)
        await chart_data.modify()
        message = "Chart Data Modified"

    else:
        chart_data = data.dict()
        chart_data.update({"params": data.params.dict()})
        chart_data = ChartsCreate(**chart_data)
        await chart_data.create()
        message = "Chart Data Created"

    return {"status": True, "message": message}


# Action get_time_range
@router.post('/get_time_range', tags=['Charts'])
async def charts_get_time_range(data: Charts_Get_Time_RangeParams):
    """
    Description:
        This function will provide the time range data
    Input:
        {
            "text": "Last week"
        }
    Returns:
        A dictionary of time range
    Output:
        {
          "since": "2024-10-22T00:00:00",
          "until": "2024-10-29T00:00:00",
          "timeRange": "Last week",
          "shift": null
        }
    """
    return await date_actions.time_range(**data.dict())


# Action dashboard_charts
@router.post('/dashboard_charts', tags=['Charts'])
async def charts_dashboard_charts(data: Charts_Dashboard_ChartsParams):
    ...


# Action get_dashboard_chart_form
@router.post('/get_dashboard_chart_form', tags=['Charts'])
async def charts_get_dashboard_chart_form(data: Charts_Get_Dashboard_Chart_FormParams):
    ...


# Action get_auto_complete_text
@router.post('/get_auto_complete_text', tags=['Charts'])
async def charts_get_auto_complete_text(data: Charts_Get_Auto_Complete_TextParams):
    """
   Description:
       This function will provide the text based on the prompt
   Input:
       {
        "prompt" : "top"
       }
   Returns:
       List of texts that contains prompt
   Output:
      [
        "Display the total billing amount for the top 30 regions and components, grouped by region and component",
        "Display the total billing amount for the top 30 regions and components, grouped by region and component in a pivot table format.",
      ]
   """
    return await charts_functions.generate_auto_complete_text(data.prompt)


# Action connection_vault_routing
@router.post('/connection_vault_routing', tags=['Charts'])
async def charts_connection_vault_routing(data: Charts_Connection_Vault_RoutingParams):
    # if not data.connection_id:
    #     data.connection_id = "4"
    if not data.connection_id:
        Charts_Get_Creds_DetailsParams.connection_id = None
        creds_details = {"cred_model": "Databases", 'cred_type': "PostgreSQL"}
    else:
        Charts_Get_Creds_DetailsParams.connection_id = data.connection_id
        creds_details = await charts_get_creds_details(Charts_Get_Creds_DetailsParams)
    module_path = f"orchestrator.connection_vault." \
                f"{creds_details['cred_model'].lower()}.{creds_details['cred_type'].lower()}"
    name = creds_details['cred_type']
    module = importlib.import_module(module_path)
    klass = getattr(module, name.title().replace("_", ""))
    klass = klass({"connection_name": data.connection_id})
    function = getattr(klass, data.action)
    return function


# Action get_creds_details
@router.post('/get_creds_details', tags=['Charts'])
async def charts_get_creds_details(data: Charts_Get_Creds_DetailsParams):
    # redis_ins = urdhva_base.redispool.get_synchronous_redis_connection()
    try:
        # try:
        #     if redis_ins.exists(f"cred_store_{data.connection_id}"):
        #         creds_details = json.loads(base64.b64decode(redis_ins.get(f"cred_store_{data.connection_id}")))
        #         return {"cred_model": creds_details['cred_model'], "cred_type": creds_details['cred_type']}
        #     creds_details = await CredsModel.get(data.connection_id)
        #     if not isinstance(creds_details, dict):
        #         creds_details = creds_details.__dict__
        #     redis_ins.setex(f"cred_store_{data.connection_id}", 24*60*60,
        #                           base64.b64encode(json.dumps(creds_details).encode()).decode())
        # except:
        # creds_details = await CredsModel.get(data.connection_id)
        # if not isinstance(creds_details, dict):
        #     creds_details = creds_details.__dict__
        creds_details = connection_mapping.creds_type.get(f"{data.connection_id}", "1")
        return {"cred_model": creds_details['cred_model'], "cred_type": creds_details['cred_type']}
    except Exception as e:
        raise ValueError(e)
        # return {"status": False, "message": "Failed to get credentials", "data": {}}
    # finally:
    #     try:
    #         redis_ins.close()
    #     except:
    #         ...


# Action get_schema
@router.post('/get_schema', tags=['Charts'])
async def charts_get_schema(data: Charts_Get_SchemaParams):
    '''

    Args:
        data:

    Returns:

    '''

    # Charts_Connection_Vault_RoutingParams.connection_id = data.connection_id
    # Charts_Connection_Vault_RoutingParams.action = 'get_schema'
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=data.connection_id,
        action='get_schema'
    )
    function = await charts_connection_vault_routing(charts_ins)
    return await function(schema_name=data.schema)


# Action generate_vis_data
@router.post('/generate_vis_data', tags=['Charts'])
async def charts_generate_vis_data(data: Charts_Generate_Vis_DataParams):
    """
    Function to generate widget data
    :param data:
    :return:
    """
    if data.action == 'no_of_locations':
        if data.filters[0].value == "TAS":
            return {"status": True, "message": "success", "data": [{"count": 78}]}
        elif data.filters[0].value == "RO":
            return {"status": True, "message": "success", "data": [{"count": 22631}]}
        elif data.filters[0].value == "LPG":
            return {"status": True, "message": "success", "data": [{"count": 56}]}
        elif data.filters[0].value == "CP":
            return {"status": True, "message": "success", "data": [{"count": 10}]}
    return await widget_actions.WidgetActions.execute_widget_action(data.action, filters=data.filters,
                                                                    cross_filters=data.cross_filters,
                                                                    drill_state=data.drill_state, limit=data.limit,
                                                                    time_grain=data.time_grain,
                                                                    resp_format=data.resp_format,
                                                                    resp_level = data.resp_level, payload=data.payload)


# Action enable_cross_filter
@router.post('/enable_cross_filter', tags=['Charts'])
async def charts_enable_cross_filter(data: Charts_Enable_Cross_FilterParams):
    return await widget_actions.WidgetActions.execute_cross_filters(data.filters)


# Action generate_embedded_url
@router.post('/generate_embedded_url', tags=['Charts'])
async def charts_generate_embedded_url(data: Charts_Generate_Embedded_UrlParams):
    return await SupersetManager.get_embedded_dashboard_uri(data.dash_id)


# Action previous_present_month_sales
@router.post('/previous_present_month_sales', tags=['Charts'])
async def charts_previous_present_month_sales(data: Charts_Previous_Present_Month_SalesParams):
    cross_filters = data.cross_filters
    limit = data.limit
    time_grain = data.time_grain
    drill_state = ""
    sort_by = data.sort_by
    # Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=connection_mapping.connection_mapping.get("hpcl_ceg", "1"),
        action='execute_query'
    )
    function = await charts_connection_vault_routing(charts_ins)
    present_month_sales = lpg_plant_queries.lpg_plant_query.get('previous_current_month_sales')
    product_mapper = {
        "MS": "2811000",
        "HSD": "2812000",
        "TURBO": "3912000",
        "E20": "2822000",
        "POWER 95": "3672000",
        "POWER 99": "2816000",
        "POWER 100": "3373000"
    }
    if cross_filters:
        cross_filters += [WidgetFiltersCreate(**rec)
                          for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        conditions = []
        for rec in cross_filters:
            if len(rec.value) == 1:
                rec.value = rec.value[0].split(",")
                if rec.key == 'product_name':
                    condition = f"a.product_code = '{product_mapper.get(rec.value[0])}'"
                else:
                    condition = f"a.{rec.key} = '{rec.value[0]}'"
            else:
                if rec.key == 'product_name':
                    vals = tuple([product_mapper.get(i) for i in rec.value])
                    condition = f"a.product_code in {vals}"
                else:
                    condition = f"a.{rec.key} in {tuple(rec.value)}"
            conditions.append(condition)

        if conditions:
            present_month_sales_query = present_month_sales.split("'Completed')")
            present_month_sales = present_month_sales_query[0] + "'Completed')" + ' AND ' + ' AND '.join(
                conditions) + present_month_sales_query[1]
        present_month_sales += f' {sort_by}'
        if limit:
            present_month_sales += f' LIMIT {limit}'
        print(present_month_sales)

    else:
        access_filters = [WidgetFiltersCreate(**rec)
                          for rec in
                          await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        present_month_sales = await widget_actions.WidgetActions.apply_filter_drilldown(present_month_sales,
                                                                                        access_filters, drill_state)
        present_month_sales += f' {sort_by}'
        if limit:
            present_month_sales += f' LIMIT {limit}'

    pres_mon_sales_query = present_month_sales.format(time_grain=time_grain.lower())
    pres_mon_sales_resp = await function(query=pres_mon_sales_query)
    distinct_periods = list(set(item['period'] for item in pres_mon_sales_resp))
    print("distinct_periods--> ", distinct_periods)
    formatted_results = {}

    # Iterate over the response and group the data by location_name
    for row in pres_mon_sales_resp:
        location_name = row["location_name"]
        period = row["period"]
        avg_total_sales = row["avg_total_sales"]

        if location_name not in formatted_results:
            formatted_results[location_name] = {"location_name": location_name}

        # Add the period and its corresponding average sales value to the dictionary
        formatted_results[location_name][period] = avg_total_sales

    # Convert the dictionary to a list of results
    final_result = list(formatted_results.values())
    for res in final_result:
        for p_ in distinct_periods:
            res.setdefault(p_, 0)

    return {"status": True, "message": "success", "data": final_result}


# Action sales_drop_down
@router.post('/sales_drop_down', tags=['Charts'])
async def charts_sales_drop_down(data: Charts_Sales_Drop_DownParams):
    filters = data.filters
    # Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=connection_mapping.connection_mapping.get("hpcl_ceg", "1"),
        action='execute_query'
    )
    function = await charts_connection_vault_routing(charts_ins)
    _query = ''' select distinct zone, region, sales_area ,
                    CASE 
                    WHEN "product_code" = '2811000' THEN 'MS'
                    WHEN "product_code" = '2812000' THEN 'HSD'
                    WHEN "product_code" = '3912000' THEN 'TURBO'
                    WHEN "product_code" = '2822000' THEN 'E20'
                    WHEN "product_code" = '3672000' THEN 'POWER 95'
                    WHEN "product_code" = '2816000' THEN 'POWER 99'
                    WHEN "product_code" = '3373000' THEN 'POWER 100'
                END AS "product_name"
                    from alerts '''
    if filters:
        _query += " where "
        _filters = []
        for filt in filters:
            _filters.append(f''' {filt.key} in ({', '.join([f"'{i}'" for i in filt.value])}) ''')
        _query += ' and '.join(_filters)
    resp = await function(query=_query)
    df = pl.from_pandas(pd.DataFrame(resp))
    df = df.filter(pl.col("zone").fill_null("") != "")
    df = df.filter(pl.col("region").fill_null("") != "")
    df = df.filter(pl.col("sales_area").fill_null("") != "")
    df = df.filter(pl.col("product_name").fill_null("") != "")

    zones_query = ''' select distinct zone as default_zones from alerts '''
    zones_resp = await function(query=zones_query)
    zone_df = pl.from_pandas(pd.DataFrame(zones_resp))
    zone_df = zone_df.filter(pl.col("default_zones").fill_null("") != "")
    data = {"zone": df['zone'].unique().to_list(),
            "region": df['region'].unique().to_list(), "sales_area": df['sales_area'].unique().to_list(),
            "product_name": df['product_name'].unique().to_list(),
            "default_zones": zone_df['default_zones'].to_list()}
    return data


# Action previous_present_month_sales_by_product
@router.post('/previous_present_month_sales_by_product', tags=['Charts'])
async def charts_previous_present_month_sales_by_product(data: Charts_Previous_Present_Month_Sales_By_ProductParams):
    cross_filters = data.cross_filters
    limit = data.limit
    time_grain = data.time_grain
    drill_state = ""
    sort_by = data.sort_by
    # Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=connection_mapping.connection_mapping.get("hpcl_ceg", "1"),
        action='execute_query'
    )
    function = await charts_connection_vault_routing(charts_ins)
    present_month_sales = lpg_plant_queries.lpg_plant_query.get('i_previous_current_month_sales_by_product')
    product_mapper = {
            "MS": "2811000",
            "HSD": "2812000",
            "TURBO": "3912000",
            "E20": "2822000",
            "POWER 95": "3672000",
            "POWER 99": "2816000",
            "POWER 100": "3373000"
        }
    if cross_filters:
        cross_filters += [WidgetFiltersCreate(**rec)
                          for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        conditions = []
        for rec in cross_filters:
            if len(rec.value) == 1:
                rec.value = rec.value[0].split(",")
                if rec.key == 'product_name':
                    condition = f"a.product_code = '{product_mapper.get(rec.value[0])}'"
                else:
                    condition = f"a.{rec.key} = '{rec.value[0]}'"
            else:
                if rec.key == 'product_name':
                    vals = tuple([product_mapper.get(i) for i in rec.value])
                    condition = f"a.product_code in {vals}"
                else:
                    condition = f"a.{rec.key} in {tuple(rec.value)}"
            conditions.append(condition)

        if conditions:
            present_month_sales_query = present_month_sales.split("'Completed')")
            present_month_sales = present_month_sales_query[0] + "'Completed')" + ' AND ' + ' AND '.join(
                conditions) + present_month_sales_query[1]
        present_month_sales += f' {sort_by}'
        if limit:
            present_month_sales += f' LIMIT {limit}'
        print(present_month_sales)

    else:
        access_filters = [WidgetFiltersCreate(**rec)
                          for rec in
                          await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        present_month_sales = await widget_actions.WidgetActions.apply_filter_drilldown(present_month_sales,
                                                                                        access_filters, drill_state)
        present_month_sales += f' {sort_by}'
        if limit:
            present_month_sales += f' LIMIT {limit}'

    pres_mon_sales_query = present_month_sales.format(time_grain=time_grain.lower())
    print(pres_mon_sales_query)
    pres_mon_sales_resp = await function(query=pres_mon_sales_query)
    distinct_periods = list(set(item['period'] for item in pres_mon_sales_resp))
    print("distinct_periods--> ", distinct_periods)
    formatted_results = {}

    # Iterate over the response and group the data by location_name
    for row in pres_mon_sales_resp:
        product_name = row["product_name"]
        period = row["period"]
        avg_total_sales = row["avg_total_sales"]

        if product_name not in formatted_results:
            formatted_results[product_name] = {"product_name": product_name}

        # Add the period and its corresponding average sales value to the dictionary
        formatted_results[product_name][period] = avg_total_sales

    # Convert the dictionary to a list of results
    final_result = list(formatted_results.values())
    for res in final_result:
        for p_ in distinct_periods:
            res.setdefault(p_, 0)

    return {"status": True, "message": "success", "data": final_result}


# Action previous_present_month_amount_litres
@router.post('/previous_present_month_amount_litres', tags=['Charts'])
async def charts_previous_present_month_amount_litres(data: Charts_Previous_Present_Month_Amount_LitresParams):
    cross_filters = data.cross_filters
    limit = data.limit
    time_grain = data.time_grain
    sort_by = data.sort_by
    # Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=connection_mapping.connection_mapping.get("hpcl_ceg", "1"),
        action='execute_query'
    )
    function = await charts_connection_vault_routing(charts_ins)
    present_month_sales = lpg_plant_queries.lpg_plant_query.get('i_previous_current_month_amount_litres')
    product_mapper = {
        "MS": "2811000",
        "HSD": "2812000",
        "TURBO": "3912000",
        "E20": "2822000",
        "POWER 95": "3672000",
        "POWER 99": "2816000",
        "POWER 100": "3373000"
    }
    cross_filters += [WidgetFiltersCreate(**rec)
                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
    if cross_filters:
        conditions = []
        for rec in cross_filters:
            if len(rec.value) == 1:
                rec.value = rec.value[0].split(",")
                if rec.key == 'product_name':
                    condition = f"a.product_code = '{product_mapper.get(rec.value[0])}'"
                else:
                    condition = f"a.{rec.key} = '{rec.value[0]}'"
            else:
                if rec.key == 'product_name':
                    vals = tuple([product_mapper.get(i) for i in rec.value])
                    condition = f"a.product_code in {vals}"
                else:
                    condition = f"a.{rec.key} in {tuple(rec.value)}"
            conditions.append(condition)

        if conditions:
            present_month_sales_query = present_month_sales.split("'Completed')")
            present_month_sales = present_month_sales_query[0] + "'Completed')" + ' AND ' + ' AND '.join(
                conditions) + present_month_sales_query[1]
    present_month_sales += f' {sort_by}'
    if limit:
        present_month_sales += f' LIMIT {limit}'
    pres_mon_sales_query = present_month_sales.format(time_grain=time_grain.lower())
    print(pres_mon_sales_query)
    pres_mon_sales_resp = await function(query=pres_mon_sales_query)
    distinct_periods = list(set(item['period'] for item in pres_mon_sales_resp))
    print("distinct_periods--> ", distinct_periods)
    formatted_results = {}
    amount = 'amount'
    litres = 'litres'
    for row in pres_mon_sales_resp:
        location_name = row["location_name"]
        period = row["period"]
        avg_total_sales = row["avg_total_sales"]
        avg_txn_amount = row["avg_txn_amount"]

        if location_name not in formatted_results:
            formatted_results[location_name] = {"location_name": location_name}

        formatted_results[location_name].setdefault(amount, {})
        formatted_results[location_name].setdefault(litres, {})

        formatted_results[location_name][amount].update({period: avg_txn_amount})
        formatted_results[location_name][litres].update({period: avg_total_sales})

    final_result = list(formatted_results.values())
    for res in final_result:
        for p_ in distinct_periods:
            res[amount].setdefault(p_, 0)
            res[litres].setdefault(p_, 0)

    return {"status": True, "message": "success", "data": final_result}
