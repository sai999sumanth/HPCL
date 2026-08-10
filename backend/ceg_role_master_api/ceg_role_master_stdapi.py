import urdhva_base.postgresmodel
import urdhva_base.queryparams
import urdhva_base.types
from ceg_role_master_enum import *
from ceg_role_master_model import *
import fastapi
router = fastapi.APIRouter()


@router.post('/dncrolemaster', response_model=DNCRoleMaster, tags=['DNCRoleMaster'])
async def create(inputObj: DNCRoleMasterCreate):
    return await inputObj.create()


@router.put('/dncrolemaster', response_model=DNCRoleMaster, tags=['DNCRoleMaster'])
async def update(inputObj: DNCRoleMaster):
    return await inputObj.modify()


@router.get('/dncrolemaster/{id}', response_model=DNCRoleMaster, tags=['DNCRoleMaster'])
async def get(id: str):
    return await DNCRoleMaster.get(id, skip_secrets=True)


@router.get('/dncrolemaster', response_model=DNCRoleMasterGetResp, tags=['DNCRoleMaster'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await DNCRoleMaster.get_all(params, skip_secrets=True)


@router.delete('/dncrolemaster/{id}', tags=['DNCRoleMaster'])
async def delete(id: str):
    return await DNCRoleMaster.delete(id)


@router.post('/cegrolemaster', response_model=CEGRoleMaster, tags=['CEGRoleMaster'])
async def create(inputObj: CEGRoleMasterCreate):
    return await inputObj.create()


@router.put('/cegrolemaster', response_model=CEGRoleMaster, tags=['CEGRoleMaster'])
async def update(inputObj: CEGRoleMaster):
    return await inputObj.modify()


@router.get('/cegrolemaster/{id}', response_model=CEGRoleMaster, tags=['CEGRoleMaster'])
async def get(id: str):
    return await CEGRoleMaster.get(id, skip_secrets=True)


@router.get('/cegrolemaster', response_model=CEGRoleMasterGetResp, tags=['CEGRoleMaster'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await CEGRoleMaster.get_all(params, skip_secrets=True)


@router.delete('/cegrolemaster/{id}', tags=['CEGRoleMaster'])
async def delete(id: str):
    return await CEGRoleMaster.delete(id)