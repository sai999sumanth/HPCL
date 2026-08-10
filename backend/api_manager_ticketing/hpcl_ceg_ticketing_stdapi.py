import urdhva_base.postgresmodel
import urdhva_base.queryparams
import urdhva_base.types
from hpcl_ceg_ticketing_enum import *
from hpcl_ceg_ticketing_model import *
import fastapi
router = fastapi.APIRouter()


@router.get('/ticketing/{id}', response_model=Ticketing, tags=['Ticketing'])
async def get(id: str):
    return await Ticketing.get(id, skip_secrets=True)


@router.get('/ticketing', response_model=TicketingGetResp, tags=['Ticketing'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await Ticketing.get_all(params, skip_secrets=True)


@router.post('/ticketcomment', response_model=TicketComment, tags=['TicketComment'])
async def create(inputObj: TicketCommentCreate):
    return await inputObj.create()


@router.put('/ticketcomment', response_model=TicketComment, tags=['TicketComment'])
async def update(inputObj: TicketComment):
    return await inputObj.modify()


@router.get('/ticketcomment/{id}', response_model=TicketComment, tags=['TicketComment'])
async def get(id: str):
    return await TicketComment.get(id, skip_secrets=True)


@router.get('/ticketcomment', response_model=TicketCommentGetResp, tags=['TicketComment'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await TicketComment.get_all(params, skip_secrets=True)


@router.delete('/ticketcomment/{id}', tags=['TicketComment'])
async def delete(id: str):
    return await TicketComment.delete(id)


@router.get('/ticketusermails/{id}', response_model=TicketUserMails, tags=['TicketUserMails'])
async def get(id: str):
    return await TicketUserMails.get(id, skip_secrets=True)


@router.get('/ticketusermails', response_model=TicketUserMailsGetResp, tags=['TicketUserMails'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await TicketUserMails.get_all(params, skip_secrets=True)


@router.post('/alertcategorymaster', response_model=AlertCategoryMaster, tags=['AlertCategoryMaster'])
async def create(inputObj: AlertCategoryMasterCreate):
    return await inputObj.create()


@router.put('/alertcategorymaster', response_model=AlertCategoryMaster, tags=['AlertCategoryMaster'])
async def update(inputObj: AlertCategoryMaster):
    return await inputObj.modify()


@router.get('/alertcategorymaster/{id}', response_model=AlertCategoryMaster, tags=['AlertCategoryMaster'])
async def get(id: str):
    return await AlertCategoryMaster.get(id, skip_secrets=True)


@router.get('/alertcategorymaster', response_model=AlertCategoryMasterGetResp, tags=['AlertCategoryMaster'])
async def get_all(response: fastapi.Response, params=fastapi.Depends(urdhva_base.queryparams.QueryParams)):
    return await AlertCategoryMaster.get_all(params, skip_secrets=True)


@router.delete('/alertcategorymaster/{id}', tags=['AlertCategoryMaster'])
async def delete(id: str):
    return await AlertCategoryMaster.delete(id)