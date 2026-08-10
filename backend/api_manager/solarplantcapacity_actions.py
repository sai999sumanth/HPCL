from dashboard_studio_enum import *
from dashboard_studio_model import *
import fastapi

router = fastapi.APIRouter(prefix='/solarplantcapacity')


# Action upload_solar_plant_capacity
@router.post('/upload_solar_plant_capacity', tags=['SolarPlantCapacity'])
async def solarplantcapacity_upload_solar_plant_capacity(data: Solarplantcapacity_Upload_Solar_Plant_CapacityParams):
    ...
