from ingestion_api_enum import *
from ingestion_api_model import *
import fastapi
import traceback
import hpcl_ceg_model

router = fastapi.APIRouter(prefix='/emlockstatus')

logger = urdhva_base.logger.Logger.getInstance("emlock_events_ingestion")


# Action ingest_data
@router.post('/ingest_data', tags=['EMLockStatus'])
async def emlockstatus_ingest_data(data: Emlockstatus_Ingest_DataParams):
    """
        API endpoint to ingest EMLockEvents data.

        Args:
            - data (Emlockstatus_Ingest_DataParams): Contains vendor ID, location ID, location type,
              and a list of Emlockstatus_Ingest_DataParams.Config objects with EMLockEvents data.

        Processes each EMLockEvents data entry by constructing a payload with vendor, location,
        and EMLockEvents details, then sends it to the Camunda process engine for processing.

        Returns:
            - dict: Status message indicating the success of the data submission.
        """
    try:
        data = data.model_dump()
        print("data --> ", data)
        logger.info(f"Received EMLockEvents data ingestion from vendor {data.get('vendor_id')} {data}")
        if isinstance(data, dict):
            enriched_data = [
                {
                    **entry,  # take all fields from entry
                    "vendor_id": data.get("vendor_id"),  # enforce top-level vendor_id
                }
                for entry in data.get("data", [])
            ]

            for entry in enriched_data:
                await hpcl_ceg_model.EMLockStatusCreate(**entry).create()

            return {"status": True, "message": "Ok"}

        else:
            logger.error("Invalid data structure: expected dict with 'data' list")
            return {"status": False, "message": "Invalid data", "data": []}

    except Exception as e:
        print(traceback.format_exc())
        logger.error(e)

