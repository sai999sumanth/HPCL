from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import orchestrator.tank_analytics.tank_analytics as tank
from datetime import datetime


router = fastapi.APIRouter(prefix='/tankdetails')


# Action get_tank_details
@router.post('/get_tank_details', tags=['TankDetails'])
async def tankdetails_get_tank_details(data: Tankdetails_Get_Tank_DetailsParams):
    # sap_id = data.sap_id
    # date = data.date #if date.date else datetime.now()
    # formatted_date = date.strftime("%Y-%m-%d")
    # action = data.action
    return await tank.tank_analytics(
        filters=data.filters,
        action=data.action,
        drill_state=data.drill_state,
        cross_filters=data.cross_filters,
        payload=data.payload
    )
    # func = getattr(tank, action)
    # return await func(sap_id=sap_id, date=formatted_date) 
