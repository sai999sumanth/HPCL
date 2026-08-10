from ingestion_api_enum import *
from ingestion_api_model import *
import fastapi
from orchestrator.alerting.listener.tas_listener import tas_listener

router = fastapi.APIRouter(prefix='/taslistener')


# Action get_data
@router.post('/get_data', tags=['TasListener'])
async def taslistener_get_data(data: Taslistener_Get_DataParams):
    data = data.__dict__
    resp = await tas_listener(data['input_data'])
    return resp
