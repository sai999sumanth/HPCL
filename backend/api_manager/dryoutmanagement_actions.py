from field_force_enum import *
from field_force_model import *
import fastapi

import orchestrator.field_force.novex as field_force_novex

router = fastapi.APIRouter(prefix='/dryoutmanagement')


def _params(data):
    return data.model_dump() if hasattr(data, 'model_dump') else data.dict()


# Action get_dry_out_locations
@router.post('/get_dry_out_locations', tags=['DryOutManagement'])
async def dryoutmanagement_get_dry_out_locations(data: Dryoutmanagement_Get_Dry_Out_LocationsParams):
    return await field_force_novex.get_dry_out_locations(**_params(data))


# Action get_dry_out_indent_analysis
@router.post('/get_dry_out_indent_analysis', tags=['DryOutManagement'])
async def dryoutmanagement_get_dry_out_indent_analysis(data: Dryoutmanagement_Get_Dry_Out_Indent_AnalysisParams):
    return await field_force_novex.get_dry_out_indent_analysis(**_params(data))


# Action get_dry_out_indents
@router.post('/get_dry_out_indents', tags=['DryOutManagement'])
async def dryoutmanagement_get_dry_out_indents(data: Dryoutmanagement_Get_Dry_Out_IndentsParams):
    return await field_force_novex.get_dry_out_indents(**_params(data))


# Action get_retail_outlet_stockouts
@router.post('/get_retail_outlet_stockouts', tags=['DryOutManagement'])
async def dryoutmanagement_get_retail_outlet_stockouts(data: Dryoutmanagement_Get_Retail_Outlet_StockoutsParams):
    return await field_force_novex.get_retail_outlet_stockouts(data)


# Action get_loss_of_sales_volume
@router.post('/get_loss_of_sales_volume', tags=['DryOutManagement'])
async def dryoutmanagement_get_loss_of_sales_volume(data: Dryoutmanagement_Get_Loss_Of_Sales_VolumeParams):
    return await field_force_novex.get_loss_of_sales_volume(data)