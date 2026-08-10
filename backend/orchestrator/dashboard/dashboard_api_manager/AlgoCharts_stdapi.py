import urdhva_base.postgresmodel
import urdhva_base.queryparams
import urdhva_base.types
from AlgoCharts_enum import *
from AlgoCharts_model import *
import fastapi
router = fastapi.APIRouter()


@router.post('/algocharts', response_model=AlgoCharts, tags=['AlgoCharts'])
async def create(inputObj: AlgoChartsCreate):
    return await inputObj.create()


@router.put('/algocharts', response_model=AlgoCharts, tags=['AlgoCharts'])
async def update(inputObj: AlgoCharts):
    return await inputObj.update()


@router.get('/algocharts/{id}', response_model=AlgoCharts, tags=['AlgoCharts'])
async def get(id: str):
    return await AlgoCharts.get(id)


@router.get('/algocharts', response_model=AlgoChartsGetResp, tags=['AlgoCharts'])
async def get_all(response: fastapi.Response, params = fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    if params.download:
        response.headers['Content-Disposition'] = f'attachment; filename="algocharts.html"'
    return await AlgoCharts.get_all(params)


@router.delete('/algocharts/{id}', tags=['AlgoCharts'])
async def delete(id: str):
    return await AlgoCharts.delete(id)
