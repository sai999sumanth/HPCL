import urdhva_base.postgresmodel
import urdhva_base.queryparams
import urdhva_base.types
from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
router = fastapi.APIRouter()


@router.get('/roles/{id}', response_model=Roles, tags=['Roles'])
async def get(id: str):
    return await Roles.get(id, skip_secrets=True)


@router.get('/roles', response_model=RolesGetResp, tags=['Roles'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await Roles.get_all(params, skip_secrets=True)


@router.post('/userloginaudit', response_model=UserLoginAudit, tags=['UserLoginAudit'])
async def create(inputObj: UserLoginAuditCreate):
    return await inputObj.create()


@router.put('/userloginaudit', response_model=UserLoginAudit, tags=['UserLoginAudit'])
async def update(inputObj: UserLoginAudit):
    return await inputObj.modify()


@router.get('/userloginaudit/{id}', response_model=UserLoginAudit, tags=['UserLoginAudit'])
async def get(id: str):
    return await UserLoginAudit.get(id, skip_secrets=True)


@router.get('/userloginaudit', response_model=UserLoginAuditGetResp, tags=['UserLoginAudit'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await UserLoginAudit.get_all(params, skip_secrets=True)


@router.delete('/userloginaudit/{id}', tags=['UserLoginAudit'])
async def delete(id: str):
    return await UserLoginAudit.delete(id)


# @router.get('/users/{id}', response_model=Users, tags=['Users'])
# async def get(id: str):
#     return await Users.get(id, skip_secrets=True)


@router.get('/users', response_model=UsersGetResp, tags=['Users'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await Users.get_all(params, skip_secrets=True)


@router.post('/tasactionlogs', response_model=TasActionLogs, tags=['TasActionLogs'])
async def create(inputObj: TasActionLogsCreate):
    return await inputObj.create()


@router.put('/tasactionlogs', response_model=TasActionLogs, tags=['TasActionLogs'])
async def update(inputObj: TasActionLogs):
    return await inputObj.modify()


@router.get('/tasactionlogs/{id}', response_model=TasActionLogs, tags=['TasActionLogs'])
async def get(id: str):
    return await TasActionLogs.get(id, skip_secrets=True)


@router.get('/tasactionlogs', response_model=TasActionLogsGetResp, tags=['TasActionLogs'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await TasActionLogs.get_all(params, skip_secrets=True)


@router.delete('/tasactionlogs/{id}', tags=['TasActionLogs'])
async def delete(id: str):
    return await TasActionLogs.delete(id)


@router.get('/locationmaster/{id}', response_model=LocationMaster, tags=['LocationMaster'])
async def get(id: str):
    return await LocationMaster.get(id, skip_secrets=True)


@router.get('/locationmaster', response_model=LocationMasterGetResp, tags=['LocationMaster'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LocationMaster.get_all(params, skip_secrets=True)


@router.get('/rolemaster/{id}', response_model=RoleMaster, tags=['RoleMaster'])
async def get(id: str):
    return await RoleMaster.get(id, skip_secrets=True)


@router.get('/rolemaster', response_model=RoleMasterGetResp, tags=['RoleMaster'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await RoleMaster.get_all(params, skip_secrets=True)


@router.get('/roassetmaster/{id}', response_model=ROAssetMaster, tags=['ROAssetMaster'])
async def get(id: str):
    return await ROAssetMaster.get(id, skip_secrets=True)


@router.get('/roassetmaster', response_model=ROAssetMasterGetResp, tags=['ROAssetMaster'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await ROAssetMaster.get_all(params, skip_secrets=True)


@router.get('/tasassetmaster/{id}', response_model=TASAssetMaster, tags=['TASAssetMaster'])
async def get(id: str):
    return await TASAssetMaster.get(id, skip_secrets=True)


@router.get('/tasassetmaster', response_model=TASAssetMasterGetResp, tags=['TASAssetMaster'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await TASAssetMaster.get_all(params, skip_secrets=True)


@router.get('/lpgassetmaster/{id}', response_model=LPGAssetMaster, tags=['LPGAssetMaster'])
async def get(id: str):
    return await LPGAssetMaster.get(id, skip_secrets=True)


@router.get('/lpgassetmaster', response_model=LPGAssetMasterGetResp, tags=['LPGAssetMaster'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LPGAssetMaster.get_all(params, skip_secrets=True)


@router.get('/interlock/{id}', response_model=Interlock, tags=['Interlock'])
async def get(id: str):
    return await Interlock.get(id, skip_secrets=True)


@router.get('/interlock', response_model=InterlockGetResp, tags=['Interlock'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await Interlock.get_all(params, skip_secrets=True)


@router.get('/emlock/{id}', response_model=EMLock, tags=['EMLock'])
async def get(id: str):
    return await EMLock.get(id, skip_secrets=True)


@router.get('/emlock', response_model=EMLockGetResp, tags=['EMLock'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await EMLock.get_all(params, skip_secrets=True)


@router.get('/vts/{id}', response_model=VTS, tags=['VTS'])
async def get(id: str):
    return await VTS.get(id, skip_secrets=True)


@router.get('/vts', response_model=VTSGetResp, tags=['VTS'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await VTS.get_all(params, skip_secrets=True)


@router.post('/vtsmanualblocked', response_model=VtsManualBlocked, tags=['VtsManualBlocked'])
async def create(inputObj: VtsManualBlockedCreate):
    return await inputObj.create()


@router.put('/vtsmanualblocked', response_model=VtsManualBlocked, tags=['VtsManualBlocked'])
async def update(inputObj: VtsManualBlocked):
    return await inputObj.modify()


@router.get('/vtsmanualblocked/{id}', response_model=VtsManualBlocked, tags=['VtsManualBlocked'])
async def get(id: str):
    return await VtsManualBlocked.get(id, skip_secrets=True)


@router.get('/vtsmanualblocked', response_model=VtsManualBlockedGetResp, tags=['VtsManualBlocked'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await VtsManualBlocked.get_all(params, skip_secrets=True)


@router.delete('/vtsmanualblocked/{id}', tags=['VtsManualBlocked'])
async def delete(id: str):
    return await VtsManualBlocked.delete(id)


@router.get('/alerts/{id}', response_model=Alerts, tags=['Alerts'])
async def get(id: str):
    return await Alerts.get(id, skip_secrets=True)


@router.get('/alerts', response_model=AlertsGetResp, tags=['Alerts'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await Alerts.get_all(params, skip_secrets=True)


@router.post('/cemslocationmaster', response_model=CEMSLocationMaster, tags=['CEMSLocationMaster'])
async def create(inputObj: CEMSLocationMasterCreate):
    return await inputObj.create()


@router.put('/cemslocationmaster', response_model=CEMSLocationMaster, tags=['CEMSLocationMaster'])
async def update(inputObj: CEMSLocationMaster):
    return await inputObj.modify()


@router.get('/cemslocationmaster/{id}', response_model=CEMSLocationMaster, tags=['CEMSLocationMaster'])
async def get(id: str):
    return await CEMSLocationMaster.get(id, skip_secrets=True)


@router.get('/cemslocationmaster', response_model=CEMSLocationMasterGetResp, tags=['CEMSLocationMaster'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await CEMSLocationMaster.get_all(params, skip_secrets=True)


@router.delete('/cemslocationmaster/{id}', tags=['CEMSLocationMaster'])
async def delete(id: str):
    return await CEMSLocationMaster.delete(id)


@router.post('/cemsquantitymaster', response_model=CEMSQuantityMaster, tags=['CEMSQuantityMaster'])
async def create(inputObj: CEMSQuantityMasterCreate):
    return await inputObj.create()


@router.put('/cemsquantitymaster', response_model=CEMSQuantityMaster, tags=['CEMSQuantityMaster'])
async def update(inputObj: CEMSQuantityMaster):
    return await inputObj.modify()


@router.get('/cemsquantitymaster/{id}', response_model=CEMSQuantityMaster, tags=['CEMSQuantityMaster'])
async def get(id: str):
    return await CEMSQuantityMaster.get(id, skip_secrets=True)


@router.get('/cemsquantitymaster', response_model=CEMSQuantityMasterGetResp, tags=['CEMSQuantityMaster'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await CEMSQuantityMaster.get_all(params, skip_secrets=True)


@router.delete('/cemsquantitymaster/{id}', tags=['CEMSQuantityMaster'])
async def delete(id: str):
    return await CEMSQuantityMaster.delete(id)


@router.post('/credsmodel', response_model=CredsModel, tags=['CredsModel'])
async def create(inputObj: CredsModelCreate):
    return await inputObj.create()


@router.put('/credsmodel', response_model=CredsModel, tags=['CredsModel'])
async def update(inputObj: CredsModel):
    return await inputObj.modify()


@router.get('/credsmodel/{id}', response_model=CredsModel, tags=['CredsModel'])
async def get(id: str):
    return await CredsModel.get(id, skip_secrets=True)


@router.get('/credsmodel', response_model=CredsModelGetResp, tags=['CredsModel'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await CredsModel.get_all(params, skip_secrets=True)


@router.delete('/credsmodel/{id}', tags=['CredsModel'])
async def delete(id: str):
    return await CredsModel.delete(id)


@router.get('/dryouthistory/{id}', response_model=DryOutHistory, tags=['DryOutHistory'])
async def get(id: str):
    return await DryOutHistory.get(id, skip_secrets=True)


@router.get('/dryouthistory', response_model=DryOutHistoryGetResp, tags=['DryOutHistory'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await DryOutHistory.get_all(params, skip_secrets=True)


@router.post('/carryfwdindent', response_model=CarryFwdIndent, tags=['CarryFwdIndent'])
async def create(inputObj: CarryFwdIndentCreate):
    return await inputObj.create()


@router.put('/carryfwdindent', response_model=CarryFwdIndent, tags=['CarryFwdIndent'])
async def update(inputObj: CarryFwdIndent):
    return await inputObj.modify()


@router.get('/carryfwdindent/{id}', response_model=CarryFwdIndent, tags=['CarryFwdIndent'])
async def get(id: str):
    return await CarryFwdIndent.get(id, skip_secrets=True)


@router.get('/carryfwdindent', response_model=CarryFwdIndentGetResp, tags=['CarryFwdIndent'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await CarryFwdIndent.get_all(params, skip_secrets=True)


@router.delete('/carryfwdindent/{id}', tags=['CarryFwdIndent'])
async def delete(id: str):
    return await CarryFwdIndent.delete(id)


@router.post('/indentdryout', response_model=IndentDryOut, tags=['IndentDryOut'])
async def create(inputObj: IndentDryOutCreate):
    return await inputObj.create()


@router.put('/indentdryout', response_model=IndentDryOut, tags=['IndentDryOut'])
async def update(inputObj: IndentDryOut):
    return await inputObj.modify()


@router.get('/indentdryout/{id}', response_model=IndentDryOut, tags=['IndentDryOut'])
async def get(id: str):
    return await IndentDryOut.get(id, skip_secrets=True)


@router.get('/indentdryout', response_model=IndentDryOutGetResp, tags=['IndentDryOut'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await IndentDryOut.get_all(params, skip_secrets=True)


@router.delete('/indentdryout/{id}', tags=['IndentDryOut'])
async def delete(id: str):
    return await IndentDryOut.delete(id)


@router.post('/lpgplantoperations', response_model=LpgPlantOperations, tags=['LpgPlantOperations'])
async def create(inputObj: LpgPlantOperationsCreate):
    return await inputObj.create()


@router.put('/lpgplantoperations', response_model=LpgPlantOperations, tags=['LpgPlantOperations'])
async def update(inputObj: LpgPlantOperations):
    return await inputObj.modify()


@router.get('/lpgplantoperations/{id}', response_model=LpgPlantOperations, tags=['LpgPlantOperations'])
async def get(id: str):
    return await LpgPlantOperations.get(id, skip_secrets=True)


@router.get('/lpgplantoperations', response_model=LpgPlantOperationsGetResp, tags=['LpgPlantOperations'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LpgPlantOperations.get_all(params, skip_secrets=True)


@router.delete('/lpgplantoperations/{id}', tags=['LpgPlantOperations'])
async def delete(id: str):
    return await LpgPlantOperations.delete(id)


@router.post('/lpgplantoperationsresync', response_model=LpgPlantOperationsResync, tags=['LpgPlantOperationsResync'])
async def create(inputObj: LpgPlantOperationsResyncCreate):
    return await inputObj.create()


@router.put('/lpgplantoperationsresync', response_model=LpgPlantOperationsResync, tags=['LpgPlantOperationsResync'])
async def update(inputObj: LpgPlantOperationsResync):
    return await inputObj.modify()


@router.get('/lpgplantoperationsresync/{id}', response_model=LpgPlantOperationsResync, tags=['LpgPlantOperationsResync'])
async def get(id: str):
    return await LpgPlantOperationsResync.get(id, skip_secrets=True)


@router.get('/lpgplantoperationsresync', response_model=LpgPlantOperationsResyncGetResp, tags=['LpgPlantOperationsResync'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LpgPlantOperationsResync.get_all(params, skip_secrets=True)


@router.delete('/lpgplantoperationsresync/{id}', tags=['LpgPlantOperationsResync'])
async def delete(id: str):
    return await LpgPlantOperationsResync.delete(id)


@router.post('/lpgoperationssummary', response_model=LpgOperationsSummary, tags=['LpgOperationsSummary'])
async def create(inputObj: LpgOperationsSummaryCreate):
    return await inputObj.create()


@router.put('/lpgoperationssummary', response_model=LpgOperationsSummary, tags=['LpgOperationsSummary'])
async def update(inputObj: LpgOperationsSummary):
    return await inputObj.modify()


@router.get('/lpgoperationssummary/{id}', response_model=LpgOperationsSummary, tags=['LpgOperationsSummary'])
async def get(id: str):
    return await LpgOperationsSummary.get(id, skip_secrets=True)


@router.get('/lpgoperationssummary', response_model=LpgOperationsSummaryGetResp, tags=['LpgOperationsSummary'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LpgOperationsSummary.get_all(params, skip_secrets=True)


@router.delete('/lpgoperationssummary/{id}', tags=['LpgOperationsSummary'])
async def delete(id: str):
    return await LpgOperationsSummary.delete(id)


@router.post('/lpgcsrejections', response_model=LpgCsRejections, tags=['LpgCsRejections'])
async def create(inputObj: LpgCsRejectionsCreate):
    return await inputObj.create()


@router.put('/lpgcsrejections', response_model=LpgCsRejections, tags=['LpgCsRejections'])
async def update(inputObj: LpgCsRejections):
    return await inputObj.modify()


@router.get('/lpgcsrejections/{id}', response_model=LpgCsRejections, tags=['LpgCsRejections'])
async def get(id: str):
    return await LpgCsRejections.get(id, skip_secrets=True)


@router.get('/lpgcsrejections', response_model=LpgCsRejectionsGetResp, tags=['LpgCsRejections'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LpgCsRejections.get_all(params, skip_secrets=True)


@router.delete('/lpgcsrejections/{id}', tags=['LpgCsRejections'])
async def delete(id: str):
    return await LpgCsRejections.delete(id)


@router.post('/lpggdrejections', response_model=LpgGdRejections, tags=['LpgGdRejections'])
async def create(inputObj: LpgGdRejectionsCreate):
    return await inputObj.create()


@router.put('/lpggdrejections', response_model=LpgGdRejections, tags=['LpgGdRejections'])
async def update(inputObj: LpgGdRejections):
    return await inputObj.modify()


@router.get('/lpggdrejections/{id}', response_model=LpgGdRejections, tags=['LpgGdRejections'])
async def get(id: str):
    return await LpgGdRejections.get(id, skip_secrets=True)


@router.get('/lpggdrejections', response_model=LpgGdRejectionsGetResp, tags=['LpgGdRejections'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LpgGdRejections.get_all(params, skip_secrets=True)


@router.delete('/lpggdrejections/{id}', tags=['LpgGdRejections'])
async def delete(id: str):
    return await LpgGdRejections.delete(id)


@router.post('/lpgptrejections', response_model=LpgPtRejections, tags=['LpgPtRejections'])
async def create(inputObj: LpgPtRejectionsCreate):
    return await inputObj.create()


@router.put('/lpgptrejections', response_model=LpgPtRejections, tags=['LpgPtRejections'])
async def update(inputObj: LpgPtRejections):
    return await inputObj.modify()


@router.get('/lpgptrejections/{id}', response_model=LpgPtRejections, tags=['LpgPtRejections'])
async def get(id: str):
    return await LpgPtRejections.get(id, skip_secrets=True)


@router.get('/lpgptrejections', response_model=LpgPtRejectionsGetResp, tags=['LpgPtRejections'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LpgPtRejections.get_all(params, skip_secrets=True)


@router.delete('/lpgptrejections/{id}', tags=['LpgPtRejections'])
async def delete(id: str):
    return await LpgPtRejections.delete(id)


@router.post('/lpgrejections', response_model=LpgRejections, tags=['LpgRejections'])
async def create(inputObj: LpgRejectionsCreate):
    return await inputObj.create()


@router.put('/lpgrejections', response_model=LpgRejections, tags=['LpgRejections'])
async def update(inputObj: LpgRejections):
    return await inputObj.modify()


@router.get('/lpgrejections/{id}', response_model=LpgRejections, tags=['LpgRejections'])
async def get(id: str):
    return await LpgRejections.get(id, skip_secrets=True)


@router.get('/lpgrejections', response_model=LpgRejectionsGetResp, tags=['LpgRejections'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LpgRejections.get_all(params, skip_secrets=True)


@router.delete('/lpgrejections/{id}', tags=['LpgRejections'])
async def delete(id: str):
    return await LpgRejections.delete(id)


@router.post('/lpgsalessummarydata', response_model=LpgSalesSummaryData, tags=['LpgSalesSummaryData'])
async def create(inputObj: LpgSalesSummaryDataCreate):
    return await inputObj.create()


@router.put('/lpgsalessummarydata', response_model=LpgSalesSummaryData, tags=['LpgSalesSummaryData'])
async def update(inputObj: LpgSalesSummaryData):
    return await inputObj.modify()


@router.get('/lpgsalessummarydata/{id}', response_model=LpgSalesSummaryData, tags=['LpgSalesSummaryData'])
async def get(id: str):
    return await LpgSalesSummaryData.get(id, skip_secrets=True)


@router.get('/lpgsalessummarydata', response_model=LpgSalesSummaryDataGetResp, tags=['LpgSalesSummaryData'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LpgSalesSummaryData.get_all(params, skip_secrets=True)


@router.delete('/lpgsalessummarydata/{id}', tags=['LpgSalesSummaryData'])
async def delete(id: str):
    return await LpgSalesSummaryData.delete(id)


@router.post('/lpgconsumerssummary', response_model=LpgConsumersSummary, tags=['LpgConsumersSummary'])
async def create(inputObj: LpgConsumersSummaryCreate):
    return await inputObj.create()


@router.put('/lpgconsumerssummary', response_model=LpgConsumersSummary, tags=['LpgConsumersSummary'])
async def update(inputObj: LpgConsumersSummary):
    return await inputObj.modify()


@router.get('/lpgconsumerssummary/{id}', response_model=LpgConsumersSummary, tags=['LpgConsumersSummary'])
async def get(id: str):
    return await LpgConsumersSummary.get(id, skip_secrets=True)


@router.get('/lpgconsumerssummary', response_model=LpgConsumersSummaryGetResp, tags=['LpgConsumersSummary'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LpgConsumersSummary.get_all(params, skip_secrets=True)


@router.delete('/lpgconsumerssummary/{id}', tags=['LpgConsumersSummary'])
async def delete(id: str):
    return await LpgConsumersSummary.delete(id)


@router.post('/screens', response_model=Screens, tags=['Screens'])
async def create(inputObj: ScreensCreate):
    return await inputObj.create()


@router.put('/screens', response_model=Screens, tags=['Screens'])
async def update(inputObj: Screens):
    return await inputObj.modify()


@router.get('/screens/{id}', response_model=Screens, tags=['Screens'])
async def get(id: str):
    return await Screens.get(id, skip_secrets=True)


@router.get('/screens', response_model=ScreensGetResp, tags=['Screens'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await Screens.get_all(params, skip_secrets=True)


@router.delete('/screens/{id}', tags=['Screens'])
async def delete(id: str):
    return await Screens.delete(id)


@router.get('/devicemaster/{id}', response_model=DeviceMaster, tags=['DeviceMaster'])
async def get(id: str):
    return await DeviceMaster.get(id, skip_secrets=True)


@router.get('/devicemaster', response_model=DeviceMasterGetResp, tags=['DeviceMaster'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await DeviceMaster.get_all(params, skip_secrets=True)


@router.get('/vtsalerthistory/{id}', response_model=VtsAlertHistory, tags=['VtsAlertHistory'])
async def get(id: str):
    return await VtsAlertHistory.get(id, skip_secrets=True)


@router.get('/vtsalerthistory', response_model=VtsAlertHistoryGetResp, tags=['VtsAlertHistory'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await VtsAlertHistory.get_all(params, skip_secrets=True)


@router.get('/emlockalerthistory/{id}', response_model=EmLockAlertHistory, tags=['EmLockAlertHistory'])
async def get(id: str):
    return await EmLockAlertHistory.get(id, skip_secrets=True)


@router.get('/emlockalerthistory', response_model=EmLockAlertHistoryGetResp, tags=['EmLockAlertHistory'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await EmLockAlertHistory.get_all(params, skip_secrets=True)


@router.get('/vaalerthistory/{id}', response_model=VaAlertHistory, tags=['VaAlertHistory'])
async def get(id: str):
    return await VaAlertHistory.get(id, skip_secrets=True)


@router.get('/vaalerthistory', response_model=VaAlertHistoryGetResp, tags=['VaAlertHistory'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await VaAlertHistory.get_all(params, skip_secrets=True)


@router.post('/m60levelmetadata', response_model=M60LevelMetaData, tags=['M60LevelMetaData'])
async def create(inputObj: M60LevelMetaDataCreate):
    return await inputObj.create()


@router.put('/m60levelmetadata', response_model=M60LevelMetaData, tags=['M60LevelMetaData'])
async def update(inputObj: M60LevelMetaData):
    return await inputObj.modify()


@router.get('/m60levelmetadata/{id}', response_model=M60LevelMetaData, tags=['M60LevelMetaData'])
async def get(id: str):
    return await M60LevelMetaData.get(id, skip_secrets=True)


@router.get('/m60levelmetadata', response_model=M60LevelMetaDataGetResp, tags=['M60LevelMetaData'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await M60LevelMetaData.get_all(params, skip_secrets=True)


@router.delete('/m60levelmetadata/{id}', tags=['M60LevelMetaData'])
async def delete(id: str):
    return await M60LevelMetaData.delete(id)


@router.post('/momlevelfinalmetadata', response_model=MomLevelFinalMetaData, tags=['MomLevelFinalMetaData'])
async def create(inputObj: MomLevelFinalMetaDataCreate):
    return await inputObj.create()


@router.put('/momlevelfinalmetadata', response_model=MomLevelFinalMetaData, tags=['MomLevelFinalMetaData'])
async def update(inputObj: MomLevelFinalMetaData):
    return await inputObj.modify()


@router.get('/momlevelfinalmetadata/{id}', response_model=MomLevelFinalMetaData, tags=['MomLevelFinalMetaData'])
async def get(id: str):
    return await MomLevelFinalMetaData.get(id, skip_secrets=True)


@router.get('/momlevelfinalmetadata', response_model=MomLevelFinalMetaDataGetResp, tags=['MomLevelFinalMetaData'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await MomLevelFinalMetaData.get_all(params, skip_secrets=True)


@router.delete('/momlevelfinalmetadata/{id}', tags=['MomLevelFinalMetaData'])
async def delete(id: str):
    return await MomLevelFinalMetaData.delete(id)


@router.post('/industryperformance', response_model=IndustryPerformance, tags=['IndustryPerformance'])
async def create(inputObj: IndustryPerformanceCreate):
    return await inputObj.create()


@router.put('/industryperformance', response_model=IndustryPerformance, tags=['IndustryPerformance'])
async def update(inputObj: IndustryPerformance):
    return await inputObj.modify()


@router.get('/industryperformance/{id}', response_model=IndustryPerformance, tags=['IndustryPerformance'])
async def get(id: str):
    return await IndustryPerformance.get(id, skip_secrets=True)


@router.get('/industryperformance', response_model=IndustryPerformanceGetResp, tags=['IndustryPerformance'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await IndustryPerformance.get_all(params, skip_secrets=True)


@router.delete('/industryperformance/{id}', tags=['IndustryPerformance'])
async def delete(id: str):
    return await IndustryPerformance.delete(id)


@router.post('/consumerpumptankdelivery', response_model=ConsumerPumpTankDelivery, tags=['ConsumerPumpTankDelivery'])
async def create(inputObj: ConsumerPumpTankDeliveryCreate):
    return await inputObj.create()


@router.put('/consumerpumptankdelivery', response_model=ConsumerPumpTankDelivery, tags=['ConsumerPumpTankDelivery'])
async def update(inputObj: ConsumerPumpTankDelivery):
    return await inputObj.modify()


@router.get('/consumerpumptankdelivery/{id}', response_model=ConsumerPumpTankDelivery, tags=['ConsumerPumpTankDelivery'])
async def get(id: str):
    return await ConsumerPumpTankDelivery.get(id, skip_secrets=True)


@router.get('/consumerpumptankdelivery', response_model=ConsumerPumpTankDeliveryGetResp, tags=['ConsumerPumpTankDelivery'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await ConsumerPumpTankDelivery.get_all(params, skip_secrets=True)


@router.delete('/consumerpumptankdelivery/{id}', tags=['ConsumerPumpTankDelivery'])
async def delete(id: str):
    return await ConsumerPumpTankDelivery.delete(id)


@router.post('/consumperpumptransaction', response_model=ConsumperPumpTransaction, tags=['ConsumperPumpTransaction'])
async def create(inputObj: ConsumperPumpTransactionCreate):
    return await inputObj.create()


@router.put('/consumperpumptransaction', response_model=ConsumperPumpTransaction, tags=['ConsumperPumpTransaction'])
async def update(inputObj: ConsumperPumpTransaction):
    return await inputObj.modify()


@router.get('/consumperpumptransaction/{id}', response_model=ConsumperPumpTransaction, tags=['ConsumperPumpTransaction'])
async def get(id: str):
    return await ConsumperPumpTransaction.get(id, skip_secrets=True)


@router.get('/consumperpumptransaction', response_model=ConsumperPumpTransactionGetResp, tags=['ConsumperPumpTransaction'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await ConsumperPumpTransaction.get_all(params, skip_secrets=True)


@router.delete('/consumperpumptransaction/{id}', tags=['ConsumperPumpTransaction'])
async def delete(id: str):
    return await ConsumperPumpTransaction.delete(id)


@router.get('/bulevelgeocoordinates/{id}', response_model=BuLevelGeoCoordinates, tags=['BuLevelGeoCoordinates'])
async def get(id: str):
    return await BuLevelGeoCoordinates.get(id, skip_secrets=True)


@router.get('/bulevelgeocoordinates', response_model=BuLevelGeoCoordinatesGetResp, tags=['BuLevelGeoCoordinates'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await BuLevelGeoCoordinates.get_all(params, skip_secrets=True)


@router.post('/lpgsubsidyexceptiondata', response_model=LpgSubsidyExceptionData, tags=['LpgSubsidyExceptionData'])
async def create(inputObj: LpgSubsidyExceptionDataCreate):
    return await inputObj.create()


@router.put('/lpgsubsidyexceptiondata', response_model=LpgSubsidyExceptionData, tags=['LpgSubsidyExceptionData'])
async def update(inputObj: LpgSubsidyExceptionData):
    return await inputObj.modify()


@router.get('/lpgsubsidyexceptiondata/{id}', response_model=LpgSubsidyExceptionData, tags=['LpgSubsidyExceptionData'])
async def get(id: str):
    return await LpgSubsidyExceptionData.get(id, skip_secrets=True)


@router.get('/lpgsubsidyexceptiondata', response_model=LpgSubsidyExceptionDataGetResp, tags=['LpgSubsidyExceptionData'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LpgSubsidyExceptionData.get_all(params, skip_secrets=True)


@router.delete('/lpgsubsidyexceptiondata/{id}', tags=['LpgSubsidyExceptionData'])
async def delete(id: str):
    return await LpgSubsidyExceptionData.delete(id)


@router.post('/lpgsubsidyfailuredata', response_model=LpgSubsidyFailureData, tags=['LpgSubsidyFailureData'])
async def create(inputObj: LpgSubsidyFailureDataCreate):
    return await inputObj.create()


@router.put('/lpgsubsidyfailuredata', response_model=LpgSubsidyFailureData, tags=['LpgSubsidyFailureData'])
async def update(inputObj: LpgSubsidyFailureData):
    return await inputObj.modify()


@router.get('/lpgsubsidyfailuredata/{id}', response_model=LpgSubsidyFailureData, tags=['LpgSubsidyFailureData'])
async def get(id: str):
    return await LpgSubsidyFailureData.get(id, skip_secrets=True)


@router.get('/lpgsubsidyfailuredata', response_model=LpgSubsidyFailureDataGetResp, tags=['LpgSubsidyFailureData'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LpgSubsidyFailureData.get_all(params, skip_secrets=True)


@router.delete('/lpgsubsidyfailuredata/{id}', tags=['LpgSubsidyFailureData'])
async def delete(id: str):
    return await LpgSubsidyFailureData.delete(id)


@router.post('/lpgoperationsrejections', response_model=LpgOperationsRejections, tags=['LpgOperationsRejections'])
async def create(inputObj: LpgOperationsRejectionsCreate):
    return await inputObj.create()


@router.put('/lpgoperationsrejections', response_model=LpgOperationsRejections, tags=['LpgOperationsRejections'])
async def update(inputObj: LpgOperationsRejections):
    return await inputObj.modify()


@router.get('/lpgoperationsrejections/{id}', response_model=LpgOperationsRejections, tags=['LpgOperationsRejections'])
async def get(id: str):
    return await LpgOperationsRejections.get(id, skip_secrets=True)


@router.get('/lpgoperationsrejections', response_model=LpgOperationsRejectionsGetResp, tags=['LpgOperationsRejections'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LpgOperationsRejections.get_all(params, skip_secrets=True)


@router.delete('/lpgoperationsrejections/{id}', tags=['LpgOperationsRejections'])
async def delete(id: str):
    return await LpgOperationsRejections.delete(id)


@router.post('/consumerpumptransactions', response_model=ConsumerPumpTransactions, tags=['ConsumerPumpTransactions'])
async def create(inputObj: ConsumerPumpTransactionsCreate):
    return await inputObj.create()


@router.put('/consumerpumptransactions', response_model=ConsumerPumpTransactions, tags=['ConsumerPumpTransactions'])
async def update(inputObj: ConsumerPumpTransactions):
    return await inputObj.modify()


@router.get('/consumerpumptransactions/{id}', response_model=ConsumerPumpTransactions, tags=['ConsumerPumpTransactions'])
async def get(id: str):
    return await ConsumerPumpTransactions.get(id, skip_secrets=True)


@router.get('/consumerpumptransactions', response_model=ConsumerPumpTransactionsGetResp, tags=['ConsumerPumpTransactions'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await ConsumerPumpTransactions.get_all(params, skip_secrets=True)


@router.delete('/consumerpumptransactions/{id}', tags=['ConsumerPumpTransactions'])
async def delete(id: str):
    return await ConsumerPumpTransactions.delete(id)


@router.post('/consumerpumptankinventory', response_model=ConsumerPumpTankInventory, tags=['ConsumerPumpTankInventory'])
async def create(inputObj: ConsumerPumpTankInventoryCreate):
    return await inputObj.create()


@router.put('/consumerpumptankinventory', response_model=ConsumerPumpTankInventory, tags=['ConsumerPumpTankInventory'])
async def update(inputObj: ConsumerPumpTankInventory):
    return await inputObj.modify()


@router.get('/consumerpumptankinventory/{id}', response_model=ConsumerPumpTankInventory, tags=['ConsumerPumpTankInventory'])
async def get(id: str):
    return await ConsumerPumpTankInventory.get(id, skip_secrets=True)


@router.get('/consumerpumptankinventory', response_model=ConsumerPumpTankInventoryGetResp, tags=['ConsumerPumpTankInventory'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await ConsumerPumpTankInventory.get_all(params, skip_secrets=True)


@router.delete('/consumerpumptankinventory/{id}', tags=['ConsumerPumpTankInventory'])
async def delete(id: str):
    return await ConsumerPumpTankInventory.delete(id)


@router.post('/consumerpumpstocksreceipts', response_model=ConsumerPumpStocksReceipts, tags=['ConsumerPumpStocksReceipts'])
async def create(inputObj: ConsumerPumpStocksReceiptsCreate):
    return await inputObj.create()


@router.put('/consumerpumpstocksreceipts', response_model=ConsumerPumpStocksReceipts, tags=['ConsumerPumpStocksReceipts'])
async def update(inputObj: ConsumerPumpStocksReceipts):
    return await inputObj.modify()


@router.get('/consumerpumpstocksreceipts/{id}', response_model=ConsumerPumpStocksReceipts, tags=['ConsumerPumpStocksReceipts'])
async def get(id: str):
    return await ConsumerPumpStocksReceipts.get(id, skip_secrets=True)


@router.get('/consumerpumpstocksreceipts', response_model=ConsumerPumpStocksReceiptsGetResp, tags=['ConsumerPumpStocksReceipts'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await ConsumerPumpStocksReceipts.get_all(params, skip_secrets=True)


@router.delete('/consumerpumpstocksreceipts/{id}', tags=['ConsumerPumpStocksReceipts'])
async def delete(id: str):
    return await ConsumerPumpStocksReceipts.delete(id)


@router.post('/hostsicktts', response_model=HostSickTts, tags=['HostSickTts'])
async def create(inputObj: HostSickTtsCreate):
    return await inputObj.create()


@router.put('/hostsicktts', response_model=HostSickTts, tags=['HostSickTts'])
async def update(inputObj: HostSickTts):
    return await inputObj.modify()


@router.get('/hostsicktts/{id}', response_model=HostSickTts, tags=['HostSickTts'])
async def get(id: str):
    return await HostSickTts.get(id, skip_secrets=True)


@router.get('/hostsicktts', response_model=HostSickTtsGetResp, tags=['HostSickTts'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HostSickTts.get_all(params, skip_secrets=True)


@router.delete('/hostsicktts/{id}', tags=['HostSickTts'])
async def delete(id: str):
    return await HostSickTts.delete(id)


@router.post('/hostcancelledtts', response_model=HostCancelledTts, tags=['HostCancelledTts'])
async def create(inputObj: HostCancelledTtsCreate):
    return await inputObj.create()


@router.put('/hostcancelledtts', response_model=HostCancelledTts, tags=['HostCancelledTts'])
async def update(inputObj: HostCancelledTts):
    return await inputObj.modify()


@router.get('/hostcancelledtts/{id}', response_model=HostCancelledTts, tags=['HostCancelledTts'])
async def get(id: str):
    return await HostCancelledTts.get(id, skip_secrets=True)


@router.get('/hostcancelledtts', response_model=HostCancelledTtsGetResp, tags=['HostCancelledTts'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HostCancelledTts.get_all(params, skip_secrets=True)


@router.delete('/hostcancelledtts/{id}', tags=['HostCancelledTts'])
async def delete(id: str):
    return await HostCancelledTts.delete(id)


@router.post('/hostkfactorchanges', response_model=HostKFactorChanges, tags=['HostKFactorChanges'])
async def create(inputObj: HostKFactorChangesCreate):
    return await inputObj.create()


@router.put('/hostkfactorchanges', response_model=HostKFactorChanges, tags=['HostKFactorChanges'])
async def update(inputObj: HostKFactorChanges):
    return await inputObj.modify()


@router.get('/hostkfactorchanges/{id}', response_model=HostKFactorChanges, tags=['HostKFactorChanges'])
async def get(id: str):
    return await HostKFactorChanges.get(id, skip_secrets=True)


@router.get('/hostkfactorchanges', response_model=HostKFactorChangesGetResp, tags=['HostKFactorChanges'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HostKFactorChanges.get_all(params, skip_secrets=True)


@router.delete('/hostkfactorchanges/{id}', tags=['HostKFactorChanges'])
async def delete(id: str):
    return await HostKFactorChanges.delete(id)


@router.post('/hostlocalloadedtts', response_model=HostLocalLoadedTts, tags=['HostLocalLoadedTts'])
async def create(inputObj: HostLocalLoadedTtsCreate):
    return await inputObj.create()


@router.put('/hostlocalloadedtts', response_model=HostLocalLoadedTts, tags=['HostLocalLoadedTts'])
async def update(inputObj: HostLocalLoadedTts):
    return await inputObj.modify()


@router.get('/hostlocalloadedtts/{id}', response_model=HostLocalLoadedTts, tags=['HostLocalLoadedTts'])
async def get(id: str):
    return await HostLocalLoadedTts.get(id, skip_secrets=True)


@router.get('/hostlocalloadedtts', response_model=HostLocalLoadedTtsGetResp, tags=['HostLocalLoadedTts'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HostLocalLoadedTts.get_all(params, skip_secrets=True)


@router.delete('/hostlocalloadedtts/{id}', tags=['HostLocalLoadedTts'])
async def delete(id: str):
    return await HostLocalLoadedTts.delete(id)


@router.post('/hostbayreassignment', response_model=HostBayReAssignment, tags=['HostBayReAssignment'])
async def create(inputObj: HostBayReAssignmentCreate):
    return await inputObj.create()


@router.put('/hostbayreassignment', response_model=HostBayReAssignment, tags=['HostBayReAssignment'])
async def update(inputObj: HostBayReAssignment):
    return await inputObj.modify()


@router.get('/hostbayreassignment/{id}', response_model=HostBayReAssignment, tags=['HostBayReAssignment'])
async def get(id: str):
    return await HostBayReAssignment.get(id, skip_secrets=True)


@router.get('/hostbayreassignment', response_model=HostBayReAssignmentGetResp, tags=['HostBayReAssignment'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HostBayReAssignment.get_all(params, skip_secrets=True)


@router.delete('/hostbayreassignment/{id}', tags=['HostBayReAssignment'])
async def delete(id: str):
    return await HostBayReAssignment.delete(id)


@router.post('/hostmanualfanprinted', response_model=HostManualFanPrinted, tags=['HostManualFanPrinted'])
async def create(inputObj: HostManualFanPrintedCreate):
    return await inputObj.create()


@router.put('/hostmanualfanprinted', response_model=HostManualFanPrinted, tags=['HostManualFanPrinted'])
async def update(inputObj: HostManualFanPrinted):
    return await inputObj.modify()


@router.get('/hostmanualfanprinted/{id}', response_model=HostManualFanPrinted, tags=['HostManualFanPrinted'])
async def get(id: str):
    return await HostManualFanPrinted.get(id, skip_secrets=True)


@router.get('/hostmanualfanprinted', response_model=HostManualFanPrintedGetResp, tags=['HostManualFanPrinted'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HostManualFanPrinted.get_all(params, skip_secrets=True)


@router.delete('/hostmanualfanprinted/{id}', tags=['HostManualFanPrinted'])
async def delete(id: str):
    return await HostManualFanPrinted.delete(id)


@router.post('/hostunauthorisedflow', response_model=HostUnauthorisedFlow, tags=['HostUnauthorisedFlow'])
async def create(inputObj: HostUnauthorisedFlowCreate):
    return await inputObj.create()


@router.put('/hostunauthorisedflow', response_model=HostUnauthorisedFlow, tags=['HostUnauthorisedFlow'])
async def update(inputObj: HostUnauthorisedFlow):
    return await inputObj.modify()


@router.get('/hostunauthorisedflow/{id}', response_model=HostUnauthorisedFlow, tags=['HostUnauthorisedFlow'])
async def get(id: str):
    return await HostUnauthorisedFlow.get(id, skip_secrets=True)


@router.get('/hostunauthorisedflow', response_model=HostUnauthorisedFlowGetResp, tags=['HostUnauthorisedFlow'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HostUnauthorisedFlow.get_all(params, skip_secrets=True)


@router.delete('/hostunauthorisedflow/{id}', tags=['HostUnauthorisedFlow'])
async def delete(id: str):
    return await HostUnauthorisedFlow.delete(id)


@router.post('/hostoverloadedtts', response_model=HostOverLoadedTts, tags=['HostOverLoadedTts'])
async def create(inputObj: HostOverLoadedTtsCreate):
    return await inputObj.create()


@router.put('/hostoverloadedtts', response_model=HostOverLoadedTts, tags=['HostOverLoadedTts'])
async def update(inputObj: HostOverLoadedTts):
    return await inputObj.modify()


@router.get('/hostoverloadedtts/{id}', response_model=HostOverLoadedTts, tags=['HostOverLoadedTts'])
async def get(id: str):
    return await HostOverLoadedTts.get(id, skip_secrets=True)


@router.get('/hostoverloadedtts', response_model=HostOverLoadedTtsGetResp, tags=['HostOverLoadedTts'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HostOverLoadedTts.get_all(params, skip_secrets=True)


@router.delete('/hostoverloadedtts/{id}', tags=['HostOverLoadedTts'])
async def delete(id: str):
    return await HostOverLoadedTts.delete(id)


@router.post('/hostmfmfactor', response_model=HostMFMFactor, tags=['HostMFMFactor'])
async def create(inputObj: HostMFMFactorCreate):
    return await inputObj.create()


@router.put('/hostmfmfactor', response_model=HostMFMFactor, tags=['HostMFMFactor'])
async def update(inputObj: HostMFMFactor):
    return await inputObj.modify()


@router.get('/hostmfmfactor/{id}', response_model=HostMFMFactor, tags=['HostMFMFactor'])
async def get(id: str):
    return await HostMFMFactor.get(id, skip_secrets=True)


@router.get('/hostmfmfactor', response_model=HostMFMFactorGetResp, tags=['HostMFMFactor'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HostMFMFactor.get_all(params, skip_secrets=True)


@router.delete('/hostmfmfactor/{id}', tags=['HostMFMFactor'])
async def delete(id: str):
    return await HostMFMFactor.delete(id)


@router.post('/masterstatus', response_model=MasterStatus, tags=['MasterStatus'])
async def create(inputObj: MasterStatusCreate):
    return await inputObj.create()


@router.put('/masterstatus', response_model=MasterStatus, tags=['MasterStatus'])
async def update(inputObj: MasterStatus):
    return await inputObj.modify()


@router.get('/masterstatus/{id}', response_model=MasterStatus, tags=['MasterStatus'])
async def get(id: str):
    return await MasterStatus.get(id, skip_secrets=True)


@router.get('/masterstatus', response_model=MasterStatusGetResp, tags=['MasterStatus'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await MasterStatus.get_all(params, skip_secrets=True)


@router.delete('/masterstatus/{id}', tags=['MasterStatus'])
async def delete(id: str):
    return await MasterStatus.delete(id)


@router.post('/hoststandalonetts', response_model=HostStandaloneTts, tags=['HostStandaloneTts'])
async def create(inputObj: HostStandaloneTtsCreate):
    return await inputObj.create()


@router.put('/hoststandalonetts', response_model=HostStandaloneTts, tags=['HostStandaloneTts'])
async def update(inputObj: HostStandaloneTts):
    return await inputObj.modify()


@router.get('/hoststandalonetts/{id}', response_model=HostStandaloneTts, tags=['HostStandaloneTts'])
async def get(id: str):
    return await HostStandaloneTts.get(id, skip_secrets=True)


@router.get('/hoststandalonetts', response_model=HostStandaloneTtsGetResp, tags=['HostStandaloneTts'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HostStandaloneTts.get_all(params, skip_secrets=True)


@router.delete('/hoststandalonetts/{id}', tags=['HostStandaloneTts'])
async def delete(id: str):
    return await HostStandaloneTts.delete(id)


@router.post('/hosttasuserdetails', response_model=HostTasUserDetails, tags=['HostTasUserDetails'])
async def create(inputObj: HostTasUserDetailsCreate):
    return await inputObj.create()


@router.put('/hosttasuserdetails', response_model=HostTasUserDetails, tags=['HostTasUserDetails'])
async def update(inputObj: HostTasUserDetails):
    return await inputObj.modify()


@router.get('/hosttasuserdetails/{id}', response_model=HostTasUserDetails, tags=['HostTasUserDetails'])
async def get(id: str):
    return await HostTasUserDetails.get(id, skip_secrets=True)


@router.get('/hosttasuserdetails', response_model=HostTasUserDetailsGetResp, tags=['HostTasUserDetails'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HostTasUserDetails.get_all(params, skip_secrets=True)


@router.delete('/hosttasuserdetails/{id}', tags=['HostTasUserDetails'])
async def delete(id: str):
    return await HostTasUserDetails.delete(id)


@router.post('/hostlivetankdetails', response_model=HostLiveTankDetails, tags=['HostLiveTankDetails'])
async def create(inputObj: HostLiveTankDetailsCreate):
    return await inputObj.create()


@router.put('/hostlivetankdetails', response_model=HostLiveTankDetails, tags=['HostLiveTankDetails'])
async def update(inputObj: HostLiveTankDetails):
    return await inputObj.modify()


@router.get('/hostlivetankdetails/{id}', response_model=HostLiveTankDetails, tags=['HostLiveTankDetails'])
async def get(id: str):
    return await HostLiveTankDetails.get(id, skip_secrets=True)


@router.get('/hostlivetankdetails', response_model=HostLiveTankDetailsGetResp, tags=['HostLiveTankDetails'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HostLiveTankDetails.get_all(params, skip_secrets=True)


@router.delete('/hostlivetankdetails/{id}', tags=['HostLiveTankDetails'])
async def delete(id: str):
    return await HostLiveTankDetails.delete(id)


@router.post('/hostsuspectedloads', response_model=HostSuspectedLoads, tags=['HostSuspectedLoads'])
async def create(inputObj: HostSuspectedLoadsCreate):
    return await inputObj.create()


@router.put('/hostsuspectedloads', response_model=HostSuspectedLoads, tags=['HostSuspectedLoads'])
async def update(inputObj: HostSuspectedLoads):
    return await inputObj.modify()


@router.get('/hostsuspectedloads/{id}', response_model=HostSuspectedLoads, tags=['HostSuspectedLoads'])
async def get(id: str):
    return await HostSuspectedLoads.get(id, skip_secrets=True)


@router.get('/hostsuspectedloads', response_model=HostSuspectedLoadsGetResp, tags=['HostSuspectedLoads'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HostSuspectedLoads.get_all(params, skip_secrets=True)


@router.delete('/hostsuspectedloads/{id}', tags=['HostSuspectedLoads'])
async def delete(id: str):
    return await HostSuspectedLoads.delete(id)


@router.post('/hostpltdetails', response_model=HostPltDetails, tags=['HostPltDetails'])
async def create(inputObj: HostPltDetailsCreate):
    return await inputObj.create()


@router.put('/hostpltdetails', response_model=HostPltDetails, tags=['HostPltDetails'])
async def update(inputObj: HostPltDetails):
    return await inputObj.modify()


@router.get('/hostpltdetails/{id}', response_model=HostPltDetails, tags=['HostPltDetails'])
async def get(id: str):
    return await HostPltDetails.get(id, skip_secrets=True)


@router.get('/hostpltdetails', response_model=HostPltDetailsGetResp, tags=['HostPltDetails'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HostPltDetails.get_all(params, skip_secrets=True)


@router.delete('/hostpltdetails/{id}', tags=['HostPltDetails'])
async def delete(id: str):
    return await HostPltDetails.delete(id)


@router.post('/hostdayenddetails', response_model=HostDayEndDetails, tags=['HostDayEndDetails'])
async def create(inputObj: HostDayEndDetailsCreate):
    return await inputObj.create()


@router.put('/hostdayenddetails', response_model=HostDayEndDetails, tags=['HostDayEndDetails'])
async def update(inputObj: HostDayEndDetails):
    return await inputObj.modify()


@router.get('/hostdayenddetails/{id}', response_model=HostDayEndDetails, tags=['HostDayEndDetails'])
async def get(id: str):
    return await HostDayEndDetails.get(id, skip_secrets=True)


@router.get('/hostdayenddetails', response_model=HostDayEndDetailsGetResp, tags=['HostDayEndDetails'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HostDayEndDetails.get_all(params, skip_secrets=True)


@router.delete('/hostdayenddetails/{id}', tags=['HostDayEndDetails'])
async def delete(id: str):
    return await HostDayEndDetails.delete(id)


@router.post('/hostdayendsummary', response_model=HostDayEndSummary, tags=['HostDayEndSummary'])
async def create(inputObj: HostDayEndSummaryCreate):
    return await inputObj.create()


@router.put('/hostdayendsummary', response_model=HostDayEndSummary, tags=['HostDayEndSummary'])
async def update(inputObj: HostDayEndSummary):
    return await inputObj.modify()


@router.get('/hostdayendsummary/{id}', response_model=HostDayEndSummary, tags=['HostDayEndSummary'])
async def get(id: str):
    return await HostDayEndSummary.get(id, skip_secrets=True)


@router.get('/hostdayendsummary', response_model=HostDayEndSummaryGetResp, tags=['HostDayEndSummary'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HostDayEndSummary.get_all(params, skip_secrets=True)


@router.delete('/hostdayendsummary/{id}', tags=['HostDayEndSummary'])
async def delete(id: str):
    return await HostDayEndSummary.delete(id)


@router.post('/tagsdata', response_model=TagsData, tags=['TagsData'])
async def create(inputObj: TagsDataCreate):
    return await inputObj.create()


@router.put('/tagsdata', response_model=TagsData, tags=['TagsData'])
async def update(inputObj: TagsData):
    return await inputObj.modify()


@router.get('/tagsdata/{id}', response_model=TagsData, tags=['TagsData'])
async def get(id: str):
    return await TagsData.get(id, skip_secrets=True)


@router.get('/tagsdata', response_model=TagsDataGetResp, tags=['TagsData'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await TagsData.get_all(params, skip_secrets=True)


@router.delete('/tagsdata/{id}', tags=['TagsData'])
async def delete(id: str):
    return await TagsData.delete(id)


@router.post('/tasprooftest', response_model=TasProofTest, tags=['TasProofTest'])
async def create(inputObj: TasProofTestCreate):
    return await inputObj.create()


@router.put('/tasprooftest', response_model=TasProofTest, tags=['TasProofTest'])
async def update(inputObj: TasProofTest):
    return await inputObj.modify()


@router.get('/tasprooftest/{id}', response_model=TasProofTest, tags=['TasProofTest'])
async def get(id: str):
    return await TasProofTest.get(id, skip_secrets=True)


@router.get('/tasprooftest', response_model=TasProofTestGetResp, tags=['TasProofTest'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await TasProofTest.get_all(params, skip_secrets=True)


@router.delete('/tasprooftest/{id}', tags=['TasProofTest'])
async def delete(id: str):
    return await TasProofTest.delete(id)


@router.post('/architecturedata', response_model=ArchitectureData, tags=['ArchitectureData'])
async def create(inputObj: ArchitectureDataCreate):
    return await inputObj.create()


@router.put('/architecturedata', response_model=ArchitectureData, tags=['ArchitectureData'])
async def update(inputObj: ArchitectureData):
    return await inputObj.modify()


@router.get('/architecturedata/{id}', response_model=ArchitectureData, tags=['ArchitectureData'])
async def get(id: str):
    return await ArchitectureData.get(id, skip_secrets=True)


@router.get('/architecturedata', response_model=ArchitectureDataGetResp, tags=['ArchitectureData'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await ArchitectureData.get_all(params, skip_secrets=True)


@router.delete('/architecturedata/{id}', tags=['ArchitectureData'])
async def delete(id: str):
    return await ArchitectureData.delete(id)


@router.post('/performanceindex', response_model=PerformanceIndex, tags=['PerformanceIndex'])
async def create(inputObj: PerformanceIndexCreate):
    return await inputObj.create()


@router.put('/performanceindex', response_model=PerformanceIndex, tags=['PerformanceIndex'])
async def update(inputObj: PerformanceIndex):
    return await inputObj.modify()


@router.get('/performanceindex/{id}', response_model=PerformanceIndex, tags=['PerformanceIndex'])
async def get(id: str):
    return await PerformanceIndex.get(id, skip_secrets=True)


@router.get('/performanceindex', response_model=PerformanceIndexGetResp, tags=['PerformanceIndex'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await PerformanceIndex.get_all(params, skip_secrets=True)


@router.delete('/performanceindex/{id}', tags=['PerformanceIndex'])
async def delete(id: str):
    return await PerformanceIndex.delete(id)


@router.get('/performancescore/{id}', response_model=PerformanceScore, tags=['PerformanceScore'])
async def get(id: str):
    return await PerformanceScore.get(id, skip_secrets=True)


@router.get('/performancescore', response_model=PerformanceScoreGetResp, tags=['PerformanceScore'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await PerformanceScore.get_all(params, skip_secrets=True)


@router.get('/performancescorehistory/{id}', response_model=PerformanceScoreHistory, tags=['PerformanceScoreHistory'])
async def get(id: str):
    return await PerformanceScoreHistory.get(id, skip_secrets=True)


@router.get('/performancescorehistory', response_model=PerformanceScoreHistoryGetResp, tags=['PerformanceScoreHistory'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await PerformanceScoreHistory.get_all(params, skip_secrets=True)


@router.get('/crisalerthistory/{id}', response_model=CrisAlertHistory, tags=['CrisAlertHistory'])
async def get(id: str):
    return await CrisAlertHistory.get(id, skip_secrets=True)


@router.get('/crisalerthistory', response_model=CrisAlertHistoryGetResp, tags=['CrisAlertHistory'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await CrisAlertHistory.get_all(params, skip_secrets=True)


@router.post('/dryoutalertreport', response_model=DryOutAlertReport, tags=['DryOutAlertReport'])
async def create(inputObj: DryOutAlertReportCreate):
    return await inputObj.create()


@router.put('/dryoutalertreport', response_model=DryOutAlertReport, tags=['DryOutAlertReport'])
async def update(inputObj: DryOutAlertReport):
    return await inputObj.modify()


@router.get('/dryoutalertreport/{id}', response_model=DryOutAlertReport, tags=['DryOutAlertReport'])
async def get(id: str):
    return await DryOutAlertReport.get(id, skip_secrets=True)


@router.get('/dryoutalertreport', response_model=DryOutAlertReportGetResp, tags=['DryOutAlertReport'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await DryOutAlertReport.get_all(params, skip_secrets=True)


@router.delete('/dryoutalertreport/{id}', tags=['DryOutAlertReport'])
async def delete(id: str):
    return await DryOutAlertReport.delete(id)


@router.post('/vendorapiaudit', response_model=VendorApiAudit, tags=['VendorApiAudit'])
async def create(inputObj: VendorApiAuditCreate):
    return await inputObj.create()


@router.put('/vendorapiaudit', response_model=VendorApiAudit, tags=['VendorApiAudit'])
async def update(inputObj: VendorApiAudit):
    return await inputObj.modify()


@router.get('/vendorapiaudit/{id}', response_model=VendorApiAudit, tags=['VendorApiAudit'])
async def get(id: str):
    return await VendorApiAudit.get(id, skip_secrets=True)


@router.get('/vendorapiaudit', response_model=VendorApiAuditGetResp, tags=['VendorApiAudit'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await VendorApiAudit.get_all(params, skip_secrets=True)


@router.delete('/vendorapiaudit/{id}', tags=['VendorApiAudit'])
async def delete(id: str):
    return await VendorApiAudit.delete(id)


@router.post('/vtstruckdetails', response_model=VtsTruckDetails, tags=['VtsTruckDetails'])
async def create(inputObj: VtsTruckDetailsCreate):
    return await inputObj.create()


@router.put('/vtstruckdetails', response_model=VtsTruckDetails, tags=['VtsTruckDetails'])
async def update(inputObj: VtsTruckDetails):
    return await inputObj.modify()


@router.get('/vtstruckdetails/{id}', response_model=VtsTruckDetails, tags=['VtsTruckDetails'])
async def get(id: str):
    return await VtsTruckDetails.get(id, skip_secrets=True)


@router.get('/vtstruckdetails', response_model=VtsTruckDetailsGetResp, tags=['VtsTruckDetails'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await VtsTruckDetails.get_all(params, skip_secrets=True)


@router.delete('/vtstruckdetails/{id}', tags=['VtsTruckDetails'])
async def delete(id: str):
    return await VtsTruckDetails.delete(id)


@router.post('/dryoutroloss', response_model=DryOutRoLoss, tags=['DryOutRoLoss'])
async def create(inputObj: DryOutRoLossCreate):
    return await inputObj.create()


@router.put('/dryoutroloss', response_model=DryOutRoLoss, tags=['DryOutRoLoss'])
async def update(inputObj: DryOutRoLoss):
    return await inputObj.modify()


@router.get('/dryoutroloss/{id}', response_model=DryOutRoLoss, tags=['DryOutRoLoss'])
async def get(id: str):
    return await DryOutRoLoss.get(id, skip_secrets=True)


@router.get('/dryoutroloss', response_model=DryOutRoLossGetResp, tags=['DryOutRoLoss'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await DryOutRoLoss.get_all(params, skip_secrets=True)


@router.delete('/dryoutroloss/{id}', tags=['DryOutRoLoss'])
async def delete(id: str):
    return await DryOutRoLoss.delete(id)


@router.get('/romasterdata/{id}', response_model=RoMasterData, tags=['RoMasterData'])
async def get(id: str):
    return await RoMasterData.get(id, skip_secrets=True)


@router.get('/romasterdata', response_model=RoMasterDataGetResp, tags=['RoMasterData'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await RoMasterData.get_all(params, skip_secrets=True)


@router.post('/tasmonthlyoiscores', response_model=TASMonthlyOIScores, tags=['TASMonthlyOIScores'])
async def create(inputObj: TASMonthlyOIScoresCreate):
    return await inputObj.create()


@router.put('/tasmonthlyoiscores', response_model=TASMonthlyOIScores, tags=['TASMonthlyOIScores'])
async def update(inputObj: TASMonthlyOIScores):
    return await inputObj.modify()


@router.get('/tasmonthlyoiscores/{id}', response_model=TASMonthlyOIScores, tags=['TASMonthlyOIScores'])
async def get(id: str):
    return await TASMonthlyOIScores.get(id, skip_secrets=True)


@router.get('/tasmonthlyoiscores', response_model=TASMonthlyOIScoresGetResp, tags=['TASMonthlyOIScores'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await TASMonthlyOIScores.get_all(params, skip_secrets=True)


@router.delete('/tasmonthlyoiscores/{id}', tags=['TASMonthlyOIScores'])
async def delete(id: str):
    return await TASMonthlyOIScores.delete(id)


@router.post('/sodinfra', response_model=SodInfra, tags=['SodInfra'])
async def create(inputObj: SodInfraCreate):
    return await inputObj.create()


@router.put('/sodinfra', response_model=SodInfra, tags=['SodInfra'])
async def update(inputObj: SodInfra):
    return await inputObj.modify()


@router.get('/sodinfra/{id}', response_model=SodInfra, tags=['SodInfra'])
async def get(id: str):
    return await SodInfra.get(id, skip_secrets=True)


@router.get('/sodinfra', response_model=SodInfraGetResp, tags=['SodInfra'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await SodInfra.get_all(params, skip_secrets=True)


@router.delete('/sodinfra/{id}', tags=['SodInfra'])
async def delete(id: str):
    return await SodInfra.delete(id)


@router.post('/lpginfra', response_model=LPGInfra, tags=['LPGInfra'])
async def create(inputObj: LPGInfraCreate):
    return await inputObj.create()


@router.put('/lpginfra', response_model=LPGInfra, tags=['LPGInfra'])
async def update(inputObj: LPGInfra):
    return await inputObj.modify()


@router.get('/lpginfra/{id}', response_model=LPGInfra, tags=['LPGInfra'])
async def get(id: str):
    return await LPGInfra.get(id, skip_secrets=True)


@router.get('/lpginfra', response_model=LPGInfraGetResp, tags=['LPGInfra'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LPGInfra.get_all(params, skip_secrets=True)


@router.delete('/lpginfra/{id}', tags=['LPGInfra'])
async def delete(id: str):
    return await LPGInfra.delete(id)


@router.post('/aviationinfra', response_model=AVIATIONInfra, tags=['AVIATIONInfra'])
async def create(inputObj: AVIATIONInfraCreate):
    return await inputObj.create()


@router.put('/aviationinfra', response_model=AVIATIONInfra, tags=['AVIATIONInfra'])
async def update(inputObj: AVIATIONInfra):
    return await inputObj.modify()


@router.get('/aviationinfra/{id}', response_model=AVIATIONInfra, tags=['AVIATIONInfra'])
async def get(id: str):
    return await AVIATIONInfra.get(id, skip_secrets=True)


@router.get('/aviationinfra', response_model=AVIATIONInfraGetResp, tags=['AVIATIONInfra'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await AVIATIONInfra.get_all(params, skip_secrets=True)


@router.delete('/aviationinfra/{id}', tags=['AVIATIONInfra'])
async def delete(id: str):
    return await AVIATIONInfra.delete(id)


@router.post('/lubesinfra', response_model=LUBESInfra, tags=['LUBESInfra'])
async def create(inputObj: LUBESInfraCreate):
    return await inputObj.create()


@router.put('/lubesinfra', response_model=LUBESInfra, tags=['LUBESInfra'])
async def update(inputObj: LUBESInfra):
    return await inputObj.modify()


@router.get('/lubesinfra/{id}', response_model=LUBESInfra, tags=['LUBESInfra'])
async def get(id: str):
    return await LUBESInfra.get(id, skip_secrets=True)


@router.get('/lubesinfra', response_model=LUBESInfraGetResp, tags=['LUBESInfra'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LUBESInfra.get_all(params, skip_secrets=True)


@router.delete('/lubesinfra/{id}', tags=['LUBESInfra'])
async def delete(id: str):
    return await LUBESInfra.delete(id)


@router.post('/historicsodinfra', response_model=HistoricSodInfra, tags=['HistoricSodInfra'])
async def create(inputObj: HistoricSodInfraCreate):
    return await inputObj.create()


@router.put('/historicsodinfra', response_model=HistoricSodInfra, tags=['HistoricSodInfra'])
async def update(inputObj: HistoricSodInfra):
    return await inputObj.modify()


@router.get('/historicsodinfra/{id}', response_model=HistoricSodInfra, tags=['HistoricSodInfra'])
async def get(id: str):
    return await HistoricSodInfra.get(id, skip_secrets=True)


@router.get('/historicsodinfra', response_model=HistoricSodInfraGetResp, tags=['HistoricSodInfra'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HistoricSodInfra.get_all(params, skip_secrets=True)


@router.delete('/historicsodinfra/{id}', tags=['HistoricSodInfra'])
async def delete(id: str):
    return await HistoricSodInfra.delete(id)


@router.post('/historiclpginfra', response_model=HistoricLPGInfra, tags=['HistoricLPGInfra'])
async def create(inputObj: HistoricLPGInfraCreate):
    return await inputObj.create()


@router.put('/historiclpginfra', response_model=HistoricLPGInfra, tags=['HistoricLPGInfra'])
async def update(inputObj: HistoricLPGInfra):
    return await inputObj.modify()


@router.get('/historiclpginfra/{id}', response_model=HistoricLPGInfra, tags=['HistoricLPGInfra'])
async def get(id: str):
    return await HistoricLPGInfra.get(id, skip_secrets=True)


@router.get('/historiclpginfra', response_model=HistoricLPGInfraGetResp, tags=['HistoricLPGInfra'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HistoricLPGInfra.get_all(params, skip_secrets=True)


@router.delete('/historiclpginfra/{id}', tags=['HistoricLPGInfra'])
async def delete(id: str):
    return await HistoricLPGInfra.delete(id)


@router.post('/historicaviationinfra', response_model=HistoricAVIATIONInfra, tags=['HistoricAVIATIONInfra'])
async def create(inputObj: HistoricAVIATIONInfraCreate):
    return await inputObj.create()


@router.put('/historicaviationinfra', response_model=HistoricAVIATIONInfra, tags=['HistoricAVIATIONInfra'])
async def update(inputObj: HistoricAVIATIONInfra):
    return await inputObj.modify()


@router.get('/historicaviationinfra/{id}', response_model=HistoricAVIATIONInfra, tags=['HistoricAVIATIONInfra'])
async def get(id: str):
    return await HistoricAVIATIONInfra.get(id, skip_secrets=True)


@router.get('/historicaviationinfra', response_model=HistoricAVIATIONInfraGetResp, tags=['HistoricAVIATIONInfra'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HistoricAVIATIONInfra.get_all(params, skip_secrets=True)


@router.delete('/historicaviationinfra/{id}', tags=['HistoricAVIATIONInfra'])
async def delete(id: str):
    return await HistoricAVIATIONInfra.delete(id)


@router.post('/historiclubesinfra', response_model=HistoricLUBESInfra, tags=['HistoricLUBESInfra'])
async def create(inputObj: HistoricLUBESInfraCreate):
    return await inputObj.create()


@router.put('/historiclubesinfra', response_model=HistoricLUBESInfra, tags=['HistoricLUBESInfra'])
async def update(inputObj: HistoricLUBESInfra):
    return await inputObj.modify()


@router.get('/historiclubesinfra/{id}', response_model=HistoricLUBESInfra, tags=['HistoricLUBESInfra'])
async def get(id: str):
    return await HistoricLUBESInfra.get(id, skip_secrets=True)


@router.get('/historiclubesinfra', response_model=HistoricLUBESInfraGetResp, tags=['HistoricLUBESInfra'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HistoricLUBESInfra.get_all(params, skip_secrets=True)


@router.delete('/historiclubesinfra/{id}', tags=['HistoricLUBESInfra'])
async def delete(id: str):
    return await HistoricLUBESInfra.delete(id)


@router.post('/plantroinfra', response_model=PlantRoInfra, tags=['PlantRoInfra'])
async def create(inputObj: PlantRoInfraCreate):
    return await inputObj.create()


@router.put('/plantroinfra', response_model=PlantRoInfra, tags=['PlantRoInfra'])
async def update(inputObj: PlantRoInfra):
    return await inputObj.modify()


@router.get('/plantroinfra/{id}', response_model=PlantRoInfra, tags=['PlantRoInfra'])
async def get(id: str):
    return await PlantRoInfra.get(id, skip_secrets=True)


@router.get('/plantroinfra', response_model=PlantRoInfraGetResp, tags=['PlantRoInfra'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await PlantRoInfra.get_all(params, skip_secrets=True)


@router.delete('/plantroinfra/{id}', tags=['PlantRoInfra'])
async def delete(id: str):
    return await PlantRoInfra.delete(id)


@router.post('/plantcnginfra', response_model=PlantCngInfra, tags=['PlantCngInfra'])
async def create(inputObj: PlantCngInfraCreate):
    return await inputObj.create()


@router.put('/plantcnginfra', response_model=PlantCngInfra, tags=['PlantCngInfra'])
async def update(inputObj: PlantCngInfra):
    return await inputObj.modify()


@router.get('/plantcnginfra/{id}', response_model=PlantCngInfra, tags=['PlantCngInfra'])
async def get(id: str):
    return await PlantCngInfra.get(id, skip_secrets=True)


@router.get('/plantcnginfra', response_model=PlantCngInfraGetResp, tags=['PlantCngInfra'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await PlantCngInfra.get_all(params, skip_secrets=True)


@router.delete('/plantcnginfra/{id}', tags=['PlantCngInfra'])
async def delete(id: str):
    return await PlantCngInfra.delete(id)


@router.post('/plantevinfra', response_model=PlantEvInfra, tags=['PlantEvInfra'])
async def create(inputObj: PlantEvInfraCreate):
    return await inputObj.create()


@router.put('/plantevinfra', response_model=PlantEvInfra, tags=['PlantEvInfra'])
async def update(inputObj: PlantEvInfra):
    return await inputObj.modify()


@router.get('/plantevinfra/{id}', response_model=PlantEvInfra, tags=['PlantEvInfra'])
async def get(id: str):
    return await PlantEvInfra.get(id, skip_secrets=True)


@router.get('/plantevinfra', response_model=PlantEvInfraGetResp, tags=['PlantEvInfra'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await PlantEvInfra.get_all(params, skip_secrets=True)


@router.delete('/plantevinfra/{id}', tags=['PlantEvInfra'])
async def delete(id: str):
    return await PlantEvInfra.delete(id)


@router.post('/dryoutdailyreport', response_model=DryOutDailyReport, tags=['DryOutDailyReport'])
async def create(inputObj: DryOutDailyReportCreate):
    return await inputObj.create()


@router.put('/dryoutdailyreport', response_model=DryOutDailyReport, tags=['DryOutDailyReport'])
async def update(inputObj: DryOutDailyReport):
    return await inputObj.modify()


@router.get('/dryoutdailyreport/{id}', response_model=DryOutDailyReport, tags=['DryOutDailyReport'])
async def get(id: str):
    return await DryOutDailyReport.get(id, skip_secrets=True)


@router.get('/dryoutdailyreport', response_model=DryOutDailyReportGetResp, tags=['DryOutDailyReport'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await DryOutDailyReport.get_all(params, skip_secrets=True)


@router.delete('/dryoutdailyreport/{id}', tags=['DryOutDailyReport'])
async def delete(id: str):
    return await DryOutDailyReport.delete(id)


@router.post('/rointerlockdisable', response_model=RoInterlockDisable, tags=['RoInterlockDisable'])
async def create(inputObj: RoInterlockDisableCreate):
    return await inputObj.create()


@router.put('/rointerlockdisable', response_model=RoInterlockDisable, tags=['RoInterlockDisable'])
async def update(inputObj: RoInterlockDisable):
    return await inputObj.modify()


@router.get('/rointerlockdisable/{id}', response_model=RoInterlockDisable, tags=['RoInterlockDisable'])
async def get(id: str):
    return await RoInterlockDisable.get(id, skip_secrets=True)


@router.get('/rointerlockdisable', response_model=RoInterlockDisableGetResp, tags=['RoInterlockDisable'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await RoInterlockDisable.get_all(params, skip_secrets=True)


@router.delete('/rointerlockdisable/{id}', tags=['RoInterlockDisable'])
async def delete(id: str):
    return await RoInterlockDisable.delete(id)


@router.post('/emlockstatus', response_model=EMLockStatus, tags=['EMLockStatus'])
async def create(inputObj: EMLockStatusCreate):
    return await inputObj.create()


@router.put('/emlockstatus', response_model=EMLockStatus, tags=['EMLockStatus'])
async def update(inputObj: EMLockStatus):
    return await inputObj.modify()


@router.get('/emlockstatus/{id}', response_model=EMLockStatus, tags=['EMLockStatus'])
async def get(id: str):
    return await EMLockStatus.get(id, skip_secrets=True)


@router.get('/emlockstatus', response_model=EMLockStatusGetResp, tags=['EMLockStatus'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await EMLockStatus.get_all(params, skip_secrets=True)


@router.delete('/emlockstatus/{id}', tags=['EMLockStatus'])
async def delete(id: str):
    return await EMLockStatus.delete(id)


@router.post('/notificationauditlog', response_model=NotificationAuditLog, tags=['NotificationAuditLog'])
async def create(inputObj: NotificationAuditLogCreate):
    return await inputObj.create()


@router.put('/notificationauditlog', response_model=NotificationAuditLog, tags=['NotificationAuditLog'])
async def update(inputObj: NotificationAuditLog):
    return await inputObj.modify()


@router.get('/notificationauditlog/{id}', response_model=NotificationAuditLog, tags=['NotificationAuditLog'])
async def get(id: str):
    return await NotificationAuditLog.get(id, skip_secrets=True)


@router.get('/notificationauditlog', response_model=NotificationAuditLogGetResp, tags=['NotificationAuditLog'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await NotificationAuditLog.get_all(params, skip_secrets=True)


@router.delete('/notificationauditlog/{id}', tags=['NotificationAuditLog'])
async def delete(id: str):
    return await NotificationAuditLog.delete(id)


@router.post('/emailmaster', response_model=EmailMaster, tags=['EmailMaster'])
async def create(inputObj: EmailMasterCreate):
    return await inputObj.create()


@router.put('/emailmaster', response_model=EmailMaster, tags=['EmailMaster'])
async def update(inputObj: EmailMaster):
    return await inputObj.modify()


@router.get('/emailmaster/{id}', response_model=EmailMaster, tags=['EmailMaster'])
async def get(id: str):
    return await EmailMaster.get(id, skip_secrets=True)


@router.get('/emailmaster', response_model=EmailMasterGetResp, tags=['EmailMaster'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await EmailMaster.get_all(params, skip_secrets=True)


@router.delete('/emailmaster/{id}', tags=['EmailMaster'])
async def delete(id: str):
    return await EmailMaster.delete(id)


@router.post('/salestripstilldate', response_model=SalesTripsTillDate, tags=['SalesTripsTillDate'])
async def create(inputObj: SalesTripsTillDateCreate):
    return await inputObj.create()


@router.put('/salestripstilldate', response_model=SalesTripsTillDate, tags=['SalesTripsTillDate'])
async def update(inputObj: SalesTripsTillDate):
    return await inputObj.modify()


@router.get('/salestripstilldate/{id}', response_model=SalesTripsTillDate, tags=['SalesTripsTillDate'])
async def get(id: str):
    return await SalesTripsTillDate.get(id, skip_secrets=True)


@router.get('/salestripstilldate', response_model=SalesTripsTillDateGetResp, tags=['SalesTripsTillDate'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await SalesTripsTillDate.get_all(params, skip_secrets=True)


@router.delete('/salestripstilldate/{id}', tags=['SalesTripsTillDate'])
async def delete(id: str):
    return await SalesTripsTillDate.delete(id)


@router.post('/vtsongoingtrips', response_model=VtsOngoingTrips, tags=['VtsOngoingTrips'])
async def create(inputObj: VtsOngoingTripsCreate):
    return await inputObj.create()


@router.put('/vtsongoingtrips', response_model=VtsOngoingTrips, tags=['VtsOngoingTrips'])
async def update(inputObj: VtsOngoingTrips):
    return await inputObj.modify()


@router.get('/vtsongoingtrips/{id}', response_model=VtsOngoingTrips, tags=['VtsOngoingTrips'])
async def get(id: str):
    return await VtsOngoingTrips.get(id, skip_secrets=True)


@router.get('/vtsongoingtrips', response_model=VtsOngoingTripsGetResp, tags=['VtsOngoingTrips'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await VtsOngoingTrips.get_all(params, skip_secrets=True)


@router.delete('/vtsongoingtrips/{id}', tags=['VtsOngoingTrips'])
async def delete(id: str):
    return await VtsOngoingTrips.delete(id)


@router.post('/violationhistoryvts', response_model=ViolationHistoryVts, tags=['ViolationHistoryVts'])
async def create(inputObj: ViolationHistoryVtsCreate):
    return await inputObj.create()


@router.put('/violationhistoryvts', response_model=ViolationHistoryVts, tags=['ViolationHistoryVts'])
async def update(inputObj: ViolationHistoryVts):
    return await inputObj.modify()


@router.get('/violationhistoryvts/{id}', response_model=ViolationHistoryVts, tags=['ViolationHistoryVts'])
async def get(id: str):
    return await ViolationHistoryVts.get(id, skip_secrets=True)


@router.get('/violationhistoryvts', response_model=ViolationHistoryVtsGetResp, tags=['ViolationHistoryVts'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await ViolationHistoryVts.get_all(params, skip_secrets=True)


@router.delete('/violationhistoryvts/{id}', tags=['ViolationHistoryVts'])
async def delete(id: str):
    return await ViolationHistoryVts.delete(id)


@router.post('/lpgdatapostingaudit', response_model=LpgDataPostingAudit, tags=['LpgDataPostingAudit'])
async def create(inputObj: LpgDataPostingAuditCreate):
    return await inputObj.create()


@router.put('/lpgdatapostingaudit', response_model=LpgDataPostingAudit, tags=['LpgDataPostingAudit'])
async def update(inputObj: LpgDataPostingAudit):
    return await inputObj.modify()


@router.get('/lpgdatapostingaudit/{id}', response_model=LpgDataPostingAudit, tags=['LpgDataPostingAudit'])
async def get(id: str):
    return await LpgDataPostingAudit.get(id, skip_secrets=True)


@router.get('/lpgdatapostingaudit', response_model=LpgDataPostingAuditGetResp, tags=['LpgDataPostingAudit'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LpgDataPostingAudit.get_all(params, skip_secrets=True)


@router.delete('/lpgdatapostingaudit/{id}', tags=['LpgDataPostingAudit'])
async def delete(id: str):
    return await LpgDataPostingAudit.delete(id)


@router.get('/noticesvts/{id}', response_model=NoticesVTS, tags=['NoticesVTS'])
async def get(id: str):
    return await NoticesVTS.get(id, skip_secrets=True)


@router.get('/noticesvts', response_model=NoticesVTSGetResp, tags=['NoticesVTS'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await NoticesVTS.get_all(params, skip_secrets=True)


@router.post('/deviceinstallation', response_model=DeviceInstallation, tags=['DeviceInstallation'])
async def create(inputObj: DeviceInstallationCreate):
    return await inputObj.create()


@router.put('/deviceinstallation', response_model=DeviceInstallation, tags=['DeviceInstallation'])
async def update(inputObj: DeviceInstallation):
    return await inputObj.modify()


@router.get('/deviceinstallation/{id}', response_model=DeviceInstallation, tags=['DeviceInstallation'])
async def get(id: str):
    return await DeviceInstallation.get(id, skip_secrets=True)


@router.get('/deviceinstallation', response_model=DeviceInstallationGetResp, tags=['DeviceInstallation'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await DeviceInstallation.get_all(params, skip_secrets=True)


@router.delete('/deviceinstallation/{id}', tags=['DeviceInstallation'])
async def delete(id: str):
    return await DeviceInstallation.delete(id)


@router.get('/systemauditlog/{id}', response_model=SystemAuditLog, tags=['SystemAuditLog'])
async def get(id: str):
    return await SystemAuditLog.get(id, skip_secrets=True)


@router.get('/systemauditlog', response_model=SystemAuditLogGetResp, tags=['SystemAuditLog'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await SystemAuditLog.get_all(params, skip_secrets=True)


@router.get('/crisdryoutsync/{id}', response_model=CrisDryOutSync, tags=['CrisDryOutSync'])
async def get(id: str):
    return await CrisDryOutSync.get(id, skip_secrets=True)


@router.get('/crisdryoutsync', response_model=CrisDryOutSyncGetResp, tags=['CrisDryOutSync'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await CrisDryOutSync.get_all(params, skip_secrets=True)


@router.get('/hyperlocal/{id}', response_model=HyperLocal, tags=['HyperLocal'])
async def get(id: str):
    return await HyperLocal.get(id, skip_secrets=True)


@router.get('/hyperlocal', response_model=HyperLocalGetResp, tags=['HyperLocal'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await HyperLocal.get_all(params, skip_secrets=True)


@router.get('/nozzlesales/{id}', response_model=NozzleSales, tags=['NozzleSales'])
async def get(id: str):
    return await NozzleSales.get(id, skip_secrets=True)


@router.get('/nozzlesales', response_model=NozzleSalesGetResp, tags=['NozzleSales'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await NozzleSales.get_all(params, skip_secrets=True)


@router.post('/tasfaulty', response_model=TasFaulty, tags=['TasFaulty'])
async def create(inputObj: TasFaultyCreate):
    return await inputObj.create()


@router.put('/tasfaulty', response_model=TasFaulty, tags=['TasFaulty'])
async def update(inputObj: TasFaulty):
    return await inputObj.modify()


@router.get('/tasfaulty/{id}', response_model=TasFaulty, tags=['TasFaulty'])
async def get(id: str):
    return await TasFaulty.get(id, skip_secrets=True)


@router.get('/tasfaulty', response_model=TasFaultyGetResp, tags=['TasFaulty'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await TasFaulty.get_all(params, skip_secrets=True)


@router.delete('/tasfaulty/{id}', tags=['TasFaulty'])
async def delete(id: str):
    return await TasFaulty.delete(id)


@router.post('/tassealdateform', response_model=TasSealDateForm, tags=['TasSealDateForm'])
async def create(inputObj: TasSealDateFormCreate):
    return await inputObj.create()


@router.put('/tassealdateform', response_model=TasSealDateForm, tags=['TasSealDateForm'])
async def update(inputObj: TasSealDateForm):
    return await inputObj.modify()


@router.get('/tassealdateform/{id}', response_model=TasSealDateForm, tags=['TasSealDateForm'])
async def get(id: str):
    return await TasSealDateForm.get(id, skip_secrets=True)


@router.get('/tassealdateform', response_model=TasSealDateFormGetResp, tags=['TasSealDateForm'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await TasSealDateForm.get_all(params, skip_secrets=True)


@router.delete('/tassealdateform/{id}', tags=['TasSealDateForm'])
async def delete(id: str):
    return await TasSealDateForm.delete(id)


@router.get('/tasfireenginetest/{id}', response_model=TasFireEngineTest, tags=['TasFireEngineTest'])
async def get(id: str):
    return await TasFireEngineTest.get(id, skip_secrets=True)


@router.get('/tasfireenginetest', response_model=TasFireEngineTestGetResp, tags=['TasFireEngineTest'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await TasFireEngineTest.get_all(params, skip_secrets=True)


@router.get('/terminalwisedryoutcounts/{id}', response_model=TerminalWiseDryoutCounts, tags=['TerminalWiseDryoutCounts'])
async def get(id: str):
    return await TerminalWiseDryoutCounts.get(id, skip_secrets=True)


@router.get('/terminalwisedryoutcounts', response_model=TerminalWiseDryoutCountsGetResp, tags=['TerminalWiseDryoutCounts'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await TerminalWiseDryoutCounts.get_all(params, skip_secrets=True)


@router.get('/nonreportingdevices/{id}', response_model=NonReportingDevices, tags=['NonReportingDevices'])
async def get(id: str):
    return await NonReportingDevices.get(id, skip_secrets=True)


@router.get('/nonreportingdevices', response_model=NonReportingDevicesGetResp, tags=['NonReportingDevices'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await NonReportingDevices.get_all(params, skip_secrets=True)


@router.get('/tashelpdeskvendormails/{id}', response_model=TasHelpDeskVendorMails, tags=['TasHelpDeskVendorMails'])
async def get(id: str):
    return await TasHelpDeskVendorMails.get(id, skip_secrets=True)


@router.get('/tashelpdeskvendormails', response_model=TasHelpDeskVendorMailsGetResp, tags=['TasHelpDeskVendorMails'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await TasHelpDeskVendorMails.get_all(params, skip_secrets=True)


@router.post('/lpgoperationsinsights', response_model=LpgOperationsInsights, tags=['LpgOperationsInsights'])
async def create(inputObj: LpgOperationsInsightsCreate):
    return await inputObj.create()


@router.put('/lpgoperationsinsights', response_model=LpgOperationsInsights, tags=['LpgOperationsInsights'])
async def update(inputObj: LpgOperationsInsights):
    return await inputObj.modify()


@router.get('/lpgoperationsinsights/{id}', response_model=LpgOperationsInsights, tags=['LpgOperationsInsights'])
async def get(id: str):
    return await LpgOperationsInsights.get(id, skip_secrets=True)


@router.get('/lpgoperationsinsights', response_model=LpgOperationsInsightsGetResp, tags=['LpgOperationsInsights'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LpgOperationsInsights.get_all(params, skip_secrets=True)


@router.delete('/lpgoperationsinsights/{id}', tags=['LpgOperationsInsights'])
async def delete(id: str):
    return await LpgOperationsInsights.delete(id)


@router.get('/naturalgasgvconnections/{id}', response_model=NaturalGasGVConnections, tags=['NaturalGasGVConnections'])
async def get(id: str):
    return await NaturalGasGVConnections.get(id, skip_secrets=True)


@router.get('/naturalgasgvconnections', response_model=NaturalGasGVConnectionsGetResp, tags=['NaturalGasGVConnections'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await NaturalGasGVConnections.get_all(params, skip_secrets=True)


@router.get('/tankdiadetails/{id}', response_model=TankDiaDetails, tags=['TankDiaDetails'])
async def get(id: str):
    return await TankDiaDetails.get(id, skip_secrets=True)


@router.get('/tankdiadetails', response_model=TankDiaDetailsGetResp, tags=['TankDiaDetails'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await TankDiaDetails.get_all(params, skip_secrets=True)


@router.get('/dailyemailnotificationusers/{id}', response_model=DailyEmailNotificationUsers, tags=['DailyEmailNotificationUsers'])
async def get(id: str):
    return await DailyEmailNotificationUsers.get(id, skip_secrets=True)


@router.get('/dailyemailnotificationusers', response_model=DailyEmailNotificationUsersGetResp, tags=['DailyEmailNotificationUsers'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await DailyEmailNotificationUsers.get_all(params, skip_secrets=True)


@router.get('/masterdailyreport/{id}', response_model=MasterDailyReport, tags=['MasterDailyReport'])
async def get(id: str):
    return await MasterDailyReport.get(id, skip_secrets=True)


@router.get('/masterdailyreport', response_model=MasterDailyReportGetResp, tags=['MasterDailyReport'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await MasterDailyReport.get_all(params, skip_secrets=True)


@router.get('/primarysalesaoptarget/{id}', response_model=PrimarySalesAOPTarget, tags=['PrimarySalesAOPTarget'])
async def get(id: str):
    return await PrimarySalesAOPTarget.get(id, skip_secrets=True)


@router.get('/primarysalesaoptarget', response_model=PrimarySalesAOPTargetGetResp, tags=['PrimarySalesAOPTarget'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await PrimarySalesAOPTarget.get_all(params, skip_secrets=True)


@router.get('/lpgcarousals/{id}', response_model=LpgCarousals, tags=['LpgCarousals'])
async def get(id: str):
    return await LpgCarousals.get(id, skip_secrets=True)


@router.get('/lpgcarousals', response_model=LpgCarousalsGetResp, tags=['LpgCarousals'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LpgCarousals.get_all(params, skip_secrets=True)


@router.get('/lpgplantsmaster/{id}', response_model=LpgPlantsMaster, tags=['LpgPlantsMaster'])
async def get(id: str):
    return await LpgPlantsMaster.get(id, skip_secrets=True)


@router.get('/lpgplantsmaster', response_model=LpgPlantsMasterGetResp, tags=['LpgPlantsMaster'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await LpgPlantsMaster.get_all(params, skip_secrets=True)

