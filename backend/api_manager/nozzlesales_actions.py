from field_force_enum import *
from field_force_model import *
import fastapi

import orchestrator.field_force.cris as field_force_cris

router = fastapi.APIRouter(prefix='/nozzlesales')


def _params(data):
    return data.model_dump() if hasattr(data, 'model_dump') else data.dict()


# Action get_nozzle_sales_by_product
@router.post('/get_nozzle_sales_by_product', tags=['NozzleSales'])
async def nozzlesales_get_nozzle_sales_by_product(data: Nozzlesales_Get_Nozzle_Sales_By_ProductParams):
    return await field_force_cris.get_nozzle_sales_by_product(**_params(data))


# Action get_nozzle_sales_day_comparison
@router.post('/get_nozzle_sales_day_comparison', tags=['NozzleSales'])
async def nozzlesales_get_nozzle_sales_day_comparison(data: Nozzlesales_Get_Nozzle_Sales_Day_ComparisonParams):
    return await field_force_cris.get_nozzle_sales_day_comparison(**_params(data))


# Action get_product_performance
@router.post('/get_product_performance', tags=['NozzleSales'])
async def nozzlesales_get_product_performance(data: Nozzlesales_Get_Product_PerformanceParams):
    return await field_force_cris.get_product_performance(**_params(data))


# Action get_degrading_outlets
@router.post('/get_degrading_outlets', tags=['NozzleSales'])
async def nozzlesales_get_degrading_outlets(data: Nozzlesales_Get_Degrading_OutletsParams):
    return await field_force_cris.get_degrading_outlets(**_params(data))


# Action get_top_degrading_dealers
@router.post('/get_top_degrading_dealers', tags=['NozzleSales'])
async def nozzlesales_get_top_degrading_dealers(data: Nozzlesales_Get_Top_Degrading_DealersParams):
    return await field_force_cris.get_top_degrading_dealers(**_params(data))


# Action get_high_risk_outlets
@router.post('/get_high_risk_outlets', tags=['NozzleSales'])
async def nozzlesales_get_high_risk_outlets(data: Nozzlesales_Get_High_Risk_OutletsParams):
    return await field_force_cris.get_high_risk_outlets(**_params(data))


# Action get_zero_sales_outlets
@router.post('/get_zero_sales_outlets', tags=['NozzleSales'])
async def nozzlesales_get_zero_sales_outlets(data: Nozzlesales_Get_Zero_Sales_OutletsParams):
    return await field_force_cris.get_zero_sales_outlets(**_params(data))


# Action get_outlets_by_degrowth_group
@router.post('/get_outlets_by_degrowth_group', tags=['NozzleSales'])
async def nozzlesales_get_outlets_by_degrowth_group(data: Nozzlesales_Get_Outlets_By_Degrowth_GroupParams):
    return await field_force_cris.get_outlets_by_degrowth_group(**_params(data))


# Action get_power_sales_growth_locations
@router.post('/get_power_sales_growth_locations', tags=['NozzleSales'])
async def nozzlesales_get_power_sales_growth_locations(data: Nozzlesales_Get_Power_Sales_Growth_LocationsParams):
    return await field_force_cris.get_power_sales_growth_locations(**_params(data))


# Action nozzle_sales_analysis
@router.post('/nozzle_sales_analysis', tags=['NozzleSales'])
async def nozzlesales_nozzle_sales_analysis(data: Nozzlesales_Nozzle_Sales_AnalysisParams):
    return await field_force_cris.nozzle_sales_analysis(**_params(data))


# Action nozzle_sales_comparison
@router.post('/nozzle_sales_comparison', tags=['NozzleSales'])
async def nozzlesales_nozzle_sales_comparison(data: Nozzlesales_Nozzle_Sales_ComparisonParams):
    return await field_force_cris.nozzle_sales_comparison(**_params(data))


# Action nozzle_sales_tmt
@router.post('/nozzle_sales_tmt', tags=['NozzleSales'])
async def nozzlesales_nozzle_sales_tmt(data: Nozzlesales_Nozzle_Sales_TmtParams):
    return await field_force_cris.nozzle_sales_tmt(**_params(data))

