import urdhva_base
import hpcl_ceg_model
from ingestion_api_enum import *
from ingestion_api_model import *
import fastapi
import traceback

router = fastapi.APIRouter(prefix='/hyperlocal')

logger = urdhva_base.logger.Logger.getInstance("hyper_local_ingestion")


# Action ingest_data
@router.post('/ingest_data', tags=['HyperLocal'])
async def hyperlocal_ingest_data(data: Hyperlocal_Ingest_DataParams):
    try:
        logger.info(f"Received Hyper Local data ingestion from vendor {data.dict()}")
        hyper_local_data = data.model_dump()
        await hpcl_ceg_model.HyperLocalCreate(**hyper_local_data).create()
        return True, "Success"
    except Exception as e:
        print(traceback.format_exc())
        logger.error(e)
        return {"status": False, "message": "Error", "data": []}
