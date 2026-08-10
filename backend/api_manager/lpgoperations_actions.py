# import urdhva_base
# from hpcl_ceg_enum import *
# from hpcl_ceg_model import *
# import fastapi
# import datetime
# import polars as pl
# import utilities.connection_mapping as connection_mapping
# from charts_actions import charts_connection_vault_routing
# from dashboard_studio_model import Charts_Connection_Vault_RoutingParams

# router = fastapi.APIRouter(prefix='/lpgoperations')


# # Action get_productions_rate
# @router.post('/get_productions_rate', tags=['LpgOperations'])
# async def lpgoperations_get_productions_rate(data: Lpgoperations_Get_Productions_RateParams):
#     Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
#     Charts_Connection_Vault_RoutingParams.action = 'execute_query'
#     function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
#     query = """ SELECT * FROM "LPG_OPERATIONS_SUMMARY_DATA" """
#     if not data.days == 0:
#         start_date = (datetime.datetime.now() - datetime.timedelta(days=data.days)).strftime('%Y-%m-%d')
#         query = f""" SELECT * FROM "LPG_OPERATIONS_SUMMARY_DATA" WHERE process_date >= '{start_date}' """
#     resp = await function(
#         query=query
#     )
#     df = pl.DataFrame(resp)
#     if df.is_empty():
#         return {"data": []}
#     df = df.rename({"short_name":"plant"})
#     group_col = [data.dimension]
#     if data.daywise == True:
#         group_col = ["process_date", data.dimension]
#     df = df.group_by(group_col
#                      ).agg(pl.col("productivity.normal.production"
#                                   ).mean().round(2)).rename({"productivity.normal.production": "production"})
#     _sort = ["production"] + group_col
#     if data.daywise == True:
#         df = df.sort("process_date")
#     else:
#         df = df.sort(_sort, descending=True)
#     if not data.top == 0:
#         df = df.head(data.top)
#     if not data.bottom == 0:
#         df = df.tail(data.bottom)
#     return {"data": df.to_dicts()}


# # Action get_productivity_rate
# @router.post('/get_productivity_rate', tags=['LpgOperations'])
# async def lpgoperations_get_productivity_rate(data: Lpgoperations_Get_Productivity_RateParams):
#     Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
#     Charts_Connection_Vault_RoutingParams.action = 'execute_query'
#     function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
#     query = """ SELECT * FROM "LPG_OPERATIONS_SUMMARY_DATA" """            
#     if not data.days == 0:
#         start_date = (datetime.datetime.now() - datetime.timedelta(days=data.days)).strftime('%Y-%m-%d')
#         query = f""" SELECT * FROM "LPG_OPERATIONS_SUMMARY_DATA" WHERE process_date >= '{start_date}' """
    
#     resp = await function(
#         query=query
#     )
#     df = pl.DataFrame(resp)
#     if df.is_empty():
#         return {"data": []}
#     df = df.rename({"short_name":"plant"})
#     group_col = [data.dimension]
#     if data.daywise == True:
#         group_col = ["process_date", data.dimension]
#     df = df.group_by(group_col
#                      ).agg(pl.col("productivity.normal.productivity"
#                                   ).mean().round(2)).rename({"productivity.normal.productivity": "productivity"})
#     _sort = ["productivity"] + group_col
#     if data.daywise == True:
#         df = df.sort("process_date")
#     else:
#         df = df.sort(_sort, descending=True)
#     if not data.top == 0:
#         df = df.head(data.top)
#     if not data.bottom == 0:
#         df = df.tail(data.bottom)
#     return {"data": df.to_dicts()}
