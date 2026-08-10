from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi

router = fastapi.APIRouter(prefix='/primarysalesaoptarget')


# Action insert_data
@router.post('/insert_data', tags=['PrimarySalesAOPTarget'])
async def primarysalesaoptarget_insert_data(data: Primarysalesaoptarget_Insert_DataParams):
    resp = await PrimarySalesAOPTargetCreate(**dict(data)).create()
    return resp
