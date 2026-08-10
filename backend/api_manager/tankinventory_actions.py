from field_force_enum import *
from field_force_model import *
import fastapi

import orchestrator.field_force.cris as field_force_cris

router = fastapi.APIRouter(prefix='/tankinventory')


def _params(data):
    return data.model_dump() if hasattr(data, 'model_dump') else data.dict()


# Action stock_availability
@router.post('/stock_availability', tags=['TankInventory'])
async def tankinventory_stock_availability(data: Tankinventory_Stock_AvailabilityParams):
    return await field_force_cris.stock_availability(**_params(data))


# Action tank_utilization
@router.post('/tank_utilization', tags=['TankInventory'])
async def tankinventory_tank_utilization(data: Tankinventory_Tank_UtilizationParams):
    return await field_force_cris.tank_utilization(**_params(data))
