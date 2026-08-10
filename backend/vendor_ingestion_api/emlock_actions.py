from ingestion_api_enum import *
from ingestion_api_model import *
import fastapi
import traceback
import hpcl_ceg_model
import utilities.helpers as helpers
import orchestrator.alerting.alert_manager as alert_manager
import orchestrator.analytics.emlock_analysis as emlock_analysis

router = fastapi.APIRouter(prefix='/emlock')
logger = urdhva_base.logger.Logger.getInstance("emlock_data_ingestion")


# Action ingest_data
@router.post('/ingest_data', tags=['EMLock'])
async def emlock_ingest_data(data: Emlock_Ingest_DataParams):
    """
    API endpoint to ingest EMLock data.

    Args:
    - data (Ims_Ingest_DataParams): IMS data ingestion parameters

    Processes each IMS data entry by constructing a payload with vendor, location, and IMS details,
    then sends it to the Camunda process engine for processing.

    Returns:
    - dict: Status message indicating the success of the data submission.
    """
    try:
        logger.info(f"Received EMLock data ingestion from vendor {data.vendor_id} {data.dict()}")

        if isinstance(data.data, list) and len(data.data) > 0:
            enriched_data = [
                {
                    **entry.dict(),
                    'vendor_id': data.vendor_id,
                    # 'location_id': str(entry.ro_code)[:8] if entry.location_type == 'RO' and entry.ro_code else entry.terminal_code
                    'location_id': entry.terminal_code,
                    entry.location_type: 'TAS'
                }
                for entry in data.data
            ]
        else:
            logger.error(f"Invalid data structure: data.data is not a list or is empty")
            return {"status": False, "message": "Invalid data", "data": []}
        for entry in enriched_data:
            entry['location_type'] = 'TAS'
            await hpcl_ceg_model.EmLockAlertHistoryCreate(**entry).create()
            camunda_url = await helpers.get_camunda_url(bu=entry['location_type'], sap_id=entry['location_id'],
                                                        alert_section="EMLock")
            if not await emlock_analysis.is_alert_exists(entry):
                await alert_manager.create_alert({**entry, "alert_type": "EMLock"}, camunda_url=camunda_url)
            else:
                print(f"Alert already exists {entry}")
                logger.info(f"Alert already exists {entry}")

        # redis_ins = await urdhva_base.redispool.get_redis_connection()
        # vendor = "hpcl_emlock"
        # db_access_key = ""
        # if await redis_ins.hexists("vendor_auth", f"{vendor}_access_key"):
        #     db_access_key = await redis_ins.hget("vendor_auth", f"{vendor}_access_key")
        return {"status": True, "message": "Ok"}
    
    except Exception as e:
        print(traceback.format_exc())
        logger.error(f"Error ingesting EMLock data: {str(e)}")
        return False, str(e)
