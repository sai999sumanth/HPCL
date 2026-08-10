from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi

import orchestrator.tas_analytics.tas_analytics as tas_analytics
import json

router = fastapi.APIRouter(prefix='/tasfaulty')


# Action tas_faulty_create
@router.post("/tas_faulty_create", tags=["TasFaulty"])
async def tasfaulty_tas_faulty_create(
    data: Tasfaulty_Tas_Faulty_CreateParams  = fastapi.Depends(Tasfaulty_Tas_Faulty_CreateParams),
    certificate_file: fastapi.UploadFile | None = fastapi.File(None)
):
       
        resp = await tas_analytics.create_tas_faulty(data, certificate_file)
        return resp


# Action update_faulty
@router.post('/update_faulty', tags=['TasFaulty'])
async def tasfaulty_update_faulty(data: Tasfaulty_Update_FaultyParams):
    resp = await tas_analytics.update_tas_faulty(data)
    return resp


# Action get_info
@router.post("/get_info", tags=["TasFaulty"])
async def tasfaulty_get_info(data: Tasfaulty_Get_InfoParams):

    resp = await tas_analytics.get_info_tas_faulty(data)
    return resp
