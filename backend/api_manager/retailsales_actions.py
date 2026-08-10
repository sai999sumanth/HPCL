from field_force_enum import *
from field_force_model import *
import fastapi

import orchestrator.field_force.single_store as field_force_single_store

router = fastapi.APIRouter(prefix='/retailsales')


def _params(data):
    return data.model_dump() if hasattr(data, 'model_dump') else data.dict()


# Action get_sales_by_product
@router.post('/get_sales_by_product', tags=['RetailSales'])
async def retailsales_get_sales_by_product(data: Retailsales_Get_Sales_By_ProductParams):
    return await field_force_single_store.get_sales_by_product(**_params(data))


# Action get_lubes_arb_comparison
@router.post('/get_lubes_arb_comparison', tags=['RetailSales'])
async def retailsales_get_lubes_arb_comparison(data: Retailsales_Get_Lubes_Arb_ComparisonParams):
    return await field_force_single_store.get_lubes_arb_comparison(**_params(data))


# Action get_lube_sales_comparison
@router.post('/get_lube_sales_comparison', tags=['RetailSales'])
async def retailsales_get_lube_sales_comparison(data: Retailsales_Get_Lube_Sales_ComparisonParams):
    return await field_force_single_store.get_lube_sales_comparison(**_params(data))


# Action get_sales_comparison
@router.post('/get_sales_comparison', tags=['RetailSales'])
async def retailsales_get_sales_comparison(data: Retailsales_Get_Sales_ComparisonParams):
    return await field_force_single_store.get_sales_comparison(**_params(data))


# Action get_volume_tracking
@router.post('/get_volume_tracking', tags=['RetailSales'])
async def retailsales_get_volume_tracking(data: Retailsales_Get_Volume_TrackingParams):
    return await field_force_single_store.get_volume_tracking(**_params(data))
