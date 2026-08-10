from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi

router = fastapi.APIRouter(prefix='/romasterdata')


# Action update_ro_master_data
@router.post('/update_ro_master_data', tags=['RoMasterData'])
async def romasterdata_update_ro_master_data(data: Romasterdata_Update_Ro_Master_DataParams):
    if not isinstance(data, dict):
        data = data.dict()
    data['id'] = data['record_id']
    del data['record_id']
    return await RoMasterData(**data).modify()
