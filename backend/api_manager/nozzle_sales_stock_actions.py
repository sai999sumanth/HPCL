from field_force_enum import *
from field_force_model import *
import fastapi
import orchestrator.field_force.cris as field_force_cris

router = fastapi.APIRouter(prefix='/nozzle_sales_stock')


def _params(data):
    return data.model_dump() if hasattr(data, 'model_dump') else data.dict()


# Action stock_availability
@router.post('/stock_availability', tags=['nozzle_sales_stock'])
async def nozzle_sales_stock_stock_availability(data: Nozzle_Sales_Stock_Stock_AvailabilityParams):
    return await field_force_cris.stock_availability(**_params(data))


# Action tank_utilization
@router.post('/tank_utilization', tags=['nozzle_sales_stock'])
async def nozzle_sales_stock_tank_utilization(data: Nozzle_Sales_Stock_Tank_UtilizationParams):
    return await field_force_cris.tank_utilization(**_params(data))


# Action nozzle_sales_analysis
@router.post('/nozzle_sales_analysis', tags=['nozzle_sales_stock'])
async def nozzle_sales_stock_nozzle_sales_analysis(data: Nozzle_Sales_Stock_Nozzle_Sales_AnalysisParams):
    return await field_force_cris.nozzle_sales_analysis(**_params(data))


# Action nozzle_sales_comparison
@router.post('/nozzle_sales_comparison', tags=['nozzle_sales_stock'])
async def nozzle_sales_stock_nozzle_sales_comparison(data: Nozzle_Sales_Stock_Nozzle_Sales_ComparisonParams):
    return await field_force_cris.nozzle_sales_comparison(**_params(data))


# Action nozzle_sales_prev_day_comparison
@router.post('/nozzle_sales_prev_day_comparison', tags=['nozzle_sales_stock'])
async def nozzle_sales_stock_nozzle_sales_prev_day_comparison(data: Nozzle_Sales_Stock_Nozzle_Sales_Prev_Day_ComparisonParams):
    return await field_force_cris.get_nozzle_sales_day_comparison(**_params(data))


# Action product_availability_days
@router.post('/product_availability_days', tags=['nozzle_sales_stock'])
async def nozzle_sales_stock_product_availability_days(data: Nozzle_Sales_Stock_Product_Availability_DaysParams):
    return await field_force_cris.get_product_availability(data)
