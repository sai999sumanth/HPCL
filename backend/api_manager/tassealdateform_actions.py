from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi

import orchestrator.tas_analytics.tas_analytics as tas_analytics
import json

router = fastapi.APIRouter(prefix='/tassealdateform')


# Action tas_seal_date_form_create
@router.post('/tas_seal_date_form_create', tags=['TasSealDateForm'])
async def tassealdateform_tas_seal_date_form_create(
    data: Tassealdateform_Tas_Seal_Date_Form_CreateParams = fastapi.Depends(
        Tassealdateform_Tas_Seal_Date_Form_CreateParams),
    certificate_files: list[fastapi.UploadFile] = fastapi.File([])
):
    resp = await tas_analytics.tassealdateform_tas_seal_date_form_create(data, certificate_files)
    return resp


# Action get_filtered_mfm_data
@router.post('/get_filtered_mfm_data', tags=['TasSealDateForm'])
async def tassealdateform_get_filtered_mfm_data(data: Tassealdateform_Get_Filtered_Mfm_DataParams):
    resp = await tas_analytics.tassealdateform_get_filtered_mfm_data(data)
    return resp

