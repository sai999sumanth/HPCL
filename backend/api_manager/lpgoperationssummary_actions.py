from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi

router = fastapi.APIRouter(prefix='/lpgoperationssummary')


# Action get_productions_rate
@router.post('/get_productions_rate', tags=['LpgOperationsSummary'])
async def lpgoperationssummary_get_productions_rate(data: Lpgoperationssummary_Get_Productions_RateParams):
    ...


# Action get_productivity_rate
@router.post('/get_productivity_rate', tags=['LpgOperationsSummary'])
async def lpgoperationssummary_get_productivity_rate(data: Lpgoperationssummary_Get_Productivity_RateParams):
    ...
