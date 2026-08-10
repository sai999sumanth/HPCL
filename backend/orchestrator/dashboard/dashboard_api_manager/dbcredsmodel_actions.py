from DBCredsModel_enum import *
from DBCredsModel_model import *
import fastapi

router = fastapi.APIRouter(prefix='/dbcredsmodel')


# Action load_dbcreds
@router.post('/load_dbcreds', tags=['DBCredsModel'])
async def dbcredsmodel_load_dbcreds(data: Dbcredsmodel_Load_DbcredsParams):
    ...
