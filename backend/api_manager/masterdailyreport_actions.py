from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi

router = fastapi.APIRouter(prefix='/masterdailyreport')


# Action insert_data
@router.post('/insert_data', tags=['MasterDailyReport'])
async def masterdailyreport_insert_data(data: Masterdailyreport_Insert_DataParams):
    resp = await MasterDailyReportCreate(**dict(data)).create()
    return resp
