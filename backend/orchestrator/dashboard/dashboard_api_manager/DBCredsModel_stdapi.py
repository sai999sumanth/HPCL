import urdhva_base.postgresmodel
import urdhva_base.queryparams
import urdhva_base.types
from DBCredsModel_enum import *
from DBCredsModel_model import *
import fastapi
router = fastapi.APIRouter()


@router.post('/dbcredsmodel', response_model=DBCredsModel, tags=['DBCredsModel'])
async def create(inputObj: DBCredsModelCreate):
    return await inputObj.create()


@router.put('/dbcredsmodel', response_model=DBCredsModel, tags=['DBCredsModel'])
async def update(inputObj: DBCredsModel):
    return await inputObj.update()


@router.get('/dbcredsmodel/{id}', response_model=DBCredsModel, tags=['DBCredsModel'])
async def get(id: str):
    return await DBCredsModel.get(id)


@router.get('/dbcredsmodel', response_model=DBCredsModelGetResp, tags=['DBCredsModel'])
async def get_all(response: fastapi.Response, params = fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    if params.download:
        response.headers['Content-Disposition'] = f'attachment; filename="dbcredsmodel.html"'
    return await DBCredsModel.get_all(params)


@router.delete('/dbcredsmodel/{id}', tags=['DBCredsModel'])
async def delete(id: str):
    return await DBCredsModel.delete(id)
