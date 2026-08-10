import urdhva_base
import fastapi
import polars as pl
from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import utilities.connection_mapping as connection_mapping
from charts_actions import charts_connection_vault_routing
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams

router = fastapi.APIRouter(prefix='/lpgrejections')


# Action get_cs_rejections
@router.post('/get_cs_rejections', tags=['LpgRejections'])
async def lpgrejections_get_cs_rejections(data: Lpgrejections_Get_Cs_RejectionsParams):
    ...


# Action get_gd_rejections
@router.post('/get_gd_rejections', tags=['LpgRejections'])
async def lpgrejections_get_gd_rejections(data: Lpgrejections_Get_Gd_RejectionsParams):
    ...


# Action get_pt_rejections
@router.post('/get_pt_rejections', tags=['LpgRejections'])
async def lpgrejections_get_pt_rejections(data: Lpgrejections_Get_Pt_RejectionsParams):
    ...


# Action get_rejections
@router.post('/get_rejections', tags=['LpgRejections'])
async def lpgrejections_get_rejections(data: Lpgrejections_Get_RejectionsParams):
    # Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    charts_ins = Charts_Connection_Vault_RoutingParams(
        connection_id=connection_mapping.connection_mapping.get("hpcl_ceg", "1"),
        action='execute_query'
    )
    function = await charts_connection_vault_routing(charts_ins)
    cs_query = """ select * from lpg_cs_rejections """
    gd_query = """ select * from lpg_gd_rejections """
    pt_query = """ select * from lpg_pt_rejections """
    if not data.days == 0:
        start_date = (datetime.datetime.now() - datetime.timedelta(days=data.days)).strftime('%Y-%m-%d')
        cs_query = f""" select * from lpg_cs_rejections WHERE process_date >= '{start_date}' """
        gd_query = f""" select * from lpg_gd_rejections WHERE process_date >= '{start_date}' """
        pt_query = f""" select * from lpg_pt_rejections WHERE process_date >= '{start_date}' """
        
    # CS rejection
    resp = await function(
        query=cs_query
    )
    cs = pl.DataFrame(resp)
    # GD rejection    
    resp = await function(
        query=gd_query
    )
    gd = pl.DataFrame(resp)
    # PT rejection    
    resp = await function(
        query=pt_query
    )
    pt = pl.DataFrame(resp)
    
    group_col = [data.dimension]
    if data.daywise == True:
        group_col = ["process_date", data.dimension]

    cs = cs.group_by(group_col
            ).agg(pl.col("sortoutpercentage").mean().round(2) *100).rename({"sortoutpercentage": "cs_rejection"})
    gd = gd.group_by(group_col
            ).agg(pl.col("sortoutpercentage").mean().round(2) *100).rename({"sortoutpercentage": "gd_rejection"})
    pt = pt.group_by(group_col
            ).agg(pl.col("sortoutpercentage").mean().round(2) *100).rename({"sortoutpercentage": "pt_rejection"})

    rejections = cs.join(gd, on=data.dimension, how='outer')
    rejections = rejections.drop(col for col in rejections.columns if "_right" in col)
    rejections = rejections.join(pt, on=data.dimension, how='outer')
    rejections = rejections.drop(col for col in rejections.columns if "_right" in col)

    for col in rejections.columns:
        if rejections[col].dtype == pl.Float64:
            rejections = rejections.with_columns(pl.col(col).fill_null(0).cast(pl.Utf8).str.replace("NaN",0).cast(pl.Float64).round(2).alias(col))
    rejections = rejections.with_columns((pl.col("cs_rejection") + pl.col("gd_rejection") + pl.col("pt_rejection")).alias("TotalRejections"))
    if data.daywise == True:
        rejections = rejections.sort("process_date")
    else:
        rejections = rejections.sort("TotalRejections", descending=True)
    if not data.top == 0:
        rejections = rejections.head(data.top)
    if not data.bottom == 0:
        rejections = rejections.tail(data.bottom)
    rejections = rejections.drop("TotalRejections")
    return {"data": rejections.to_dicts()}
