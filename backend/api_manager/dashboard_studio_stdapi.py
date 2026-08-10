import urdhva_base.postgresmodel
import urdhva_base.queryparams
import urdhva_base.types
from dashboard_studio_enum import *
from dashboard_studio_model import *
import fastapi
router = fastapi.APIRouter()


@router.post('/charts', response_model=Charts, tags=['Charts'])
async def create(inputObj: ChartsCreate):
    return await inputObj.create()


@router.put('/charts', response_model=Charts, tags=['Charts'])
async def update(inputObj: Charts):
    return await inputObj.modify()


@router.get('/charts/{id}', response_model=Charts, tags=['Charts'])
async def get(id: str):
    return await Charts.get(id, skip_secrets=True)


@router.get('/charts', response_model=ChartsGetResp, tags=['Charts'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await Charts.get_all(params, skip_secrets=True)


@router.delete('/charts/{id}', tags=['Charts'])
async def delete(id: str):
    return await Charts.delete(id)


@router.post('/dashboards', response_model=DashBoards, tags=['DashBoards'])
async def create(inputObj: DashBoardsCreate):
    return await inputObj.create()


@router.put('/dashboards', response_model=DashBoards, tags=['DashBoards'])
async def update(inputObj: DashBoards):
    return await inputObj.modify()


@router.get('/dashboards/{id}', response_model=DashBoards, tags=['DashBoards'])
async def get(id: str):
    return await DashBoards.get(id, skip_secrets=True)


@router.get('/dashboards', response_model=DashBoardsGetResp, tags=['DashBoards'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await DashBoards.get_all(params, skip_secrets=True)


@router.delete('/dashboards/{id}', tags=['DashBoards'])
async def delete(id: str):
    return await DashBoards.delete(id)


@router.post('/groups', response_model=Groups, tags=['Groups'])
async def create(inputObj: GroupsCreate):
    return await inputObj.create()


@router.put('/groups', response_model=Groups, tags=['Groups'])
async def update(inputObj: Groups):
    return await inputObj.modify()


@router.get('/groups/{id}', response_model=Groups, tags=['Groups'])
async def get(id: str):
    return await Groups.get(id, skip_secrets=True)


@router.get('/groups', response_model=GroupsGetResp, tags=['Groups'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await Groups.get_all(params, skip_secrets=True)


@router.delete('/groups/{id}', tags=['Groups'])
async def delete(id: str):
    return await Groups.delete(id)


@router.post('/dashboardgroups', response_model=DashboardGroups, tags=['DashboardGroups'])
async def create(inputObj: DashboardGroupsCreate):
    return await inputObj.create()


@router.put('/dashboardgroups', response_model=DashboardGroups, tags=['DashboardGroups'])
async def update(inputObj: DashboardGroups):
    return await inputObj.modify()


@router.get('/dashboardgroups/{id}', response_model=DashboardGroups, tags=['DashboardGroups'])
async def get(id: str):
    return await DashboardGroups.get(id, skip_secrets=True)


@router.get('/dashboardgroups', response_model=DashboardGroupsGetResp, tags=['DashboardGroups'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await DashboardGroups.get_all(params, skip_secrets=True)


@router.delete('/dashboardgroups/{id}', tags=['DashboardGroups'])
async def delete(id: str):
    return await DashboardGroups.delete(id)


@router.post('/aitexts', response_model=AITexts, tags=['AITexts'])
async def create(inputObj: AITextsCreate):
    return await inputObj.create()


@router.put('/aitexts', response_model=AITexts, tags=['AITexts'])
async def update(inputObj: AITexts):
    return await inputObj.modify()


@router.get('/aitexts/{id}', response_model=AITexts, tags=['AITexts'])
async def get(id: str):
    return await AITexts.get(id, skip_secrets=True)


@router.get('/aitexts', response_model=AITextsGetResp, tags=['AITexts'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await AITexts.get_all(params, skip_secrets=True)


@router.delete('/aitexts/{id}', tags=['AITexts'])
async def delete(id: str):
    return await AITexts.delete(id)


@router.get('/solarpanelwetdrycleaning/{id}', response_model=SolarPanelWetDryCleaning, tags=['SolarPanelWetDryCleaning'])
async def get(id: str):
    return await SolarPanelWetDryCleaning.get(id, skip_secrets=True)


@router.get('/solarpanelwetdrycleaning', response_model=SolarPanelWetDryCleaningGetResp, tags=['SolarPanelWetDryCleaning'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await SolarPanelWetDryCleaning.get_all(params, skip_secrets=True)


@router.get('/historicsolarpanelwetdrycleaningcreate/{id}', response_model=HistoricSolarPanelWetDryCleaningCreate, tags=['HistoricSolarPanelWetDryCleaningCreate'])
async def get(id: str):
    return await HistoricSolarPanelWetDryCleaningCreate.get(id, skip_secrets=True)


@router.get('/historicsolarpanelwetdrycleaningcreate', response_model=HistoricSolarPanelWetDryCleaningCreateGetResp, tags=['HistoricSolarPanelWetDryCleaningCreate'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HistoricSolarPanelWetDryCleaningCreate.get_all(params, skip_secrets=True)


@router.get('/solargenerationsummary/{id}', response_model=SolarGenerationSummary, tags=['SolarGenerationSummary'])
async def get(id: str):
    return await SolarGenerationSummary.get(id, skip_secrets=True)


@router.get('/solargenerationsummary', response_model=SolarGenerationSummaryGetResp, tags=['SolarGenerationSummary'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await SolarGenerationSummary.get_all(params, skip_secrets=True)


@router.get('/solaroutagesummary/{id}', response_model=SolarOutageSummary, tags=['SolarOutageSummary'])
async def get(id: str):
    return await SolarOutageSummary.get(id, skip_secrets=True)


@router.get('/solaroutagesummary', response_model=SolarOutageSummaryGetResp, tags=['SolarOutageSummary'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await SolarOutageSummary.get_all(params, skip_secrets=True)


@router.get('/solarplantcapacity/{id}', response_model=SolarPlantCapacity, tags=['SolarPlantCapacity'])
async def get(id: str):
    return await SolarPlantCapacity.get(id, skip_secrets=True)


@router.get('/solarplantcapacity', response_model=SolarPlantCapacityGetResp, tags=['SolarPlantCapacity'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await SolarPlantCapacity.get_all(params, skip_secrets=True)

