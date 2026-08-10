from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi

router = fastapi.APIRouter(prefix='/lpgdatapostingaudit')


# Action get_erp_status
@router.post('/get_erp_status', tags=['LpgDataPostingAudit'])
async def lpgdatapostingaudit_get_erp_status(data: Lpgdatapostingaudit_Get_Erp_StatusParams):
    ...
