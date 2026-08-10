import urdhva_base
from ingestion_api_enum import *
from ingestion_api_model import *
import fastapi
import json
import requests

router = fastapi.APIRouter(prefix='/ims')

logger = urdhva_base.logger.Logger.getInstance("ims_data_ingestion")

# Action ingest_data
@router.post('/ingest_data', tags=['IMS'])
async def ims_ingest_data(data: Ims_Ingest_DataParams):
    """
    API endpoint to ingest IMS data.

    Args:
    - data (Ims_Ingest_DataParams): IMS data ingestion parameters

    Processes each IMS data entry by constructing a payload with vendor, location, and IMS details,
    then sends it to the Camunda process engine for processing.

    Returns:
    - dict: Status message indicating the success of the data submission.
    """
    logger.info(f"Received IMS data ingestion for Location {data.location_id}({data.location_type}) {data.dict()}")

    # try:
    #     header = {"Content-Type": "application/json", "Accept": "application/json"}

    #     tagmap = dict()
    #     alertid = ""
        
    #     for _data in data.data:
    #         if isinstance(_data, dict):
    #             _data = _data.__dict__
        
    #         ims_interlock = {"businessKey": alertid,
    #                 "variables": {"vendor_id": {"value": data.vendor_id, "type": "String"},
    #                                 "location_id": {"value": data.location_id, "type": "String"},
    #                                 "location_type": {"value": data.location_type, "type": "String"},
    #                                 "vehicle_number": {"value": _data['vehicle_number'], "type": "String"},
    #                                 "violation_type": {"value": _data['violation_type'], "type": "String"},
    #                                 "initiated_date": {"value": _data['initiated_date'], "type": "String"},
    #                                 "approved_date": {"value": _data['approved_date'], "type": "String"},
    #                                 "approved_by": {"value": _data['approved_by'], "type": "String"}
    #                                 }}
    #         camundaurl = urdhva_base.settings.camundaurl + "/engine-rest/process-definition/key/" + tagmap[alertname] + "/start"
    #         r = requests.post(camundaurl, headers=headers, data=json.dumps(ims_interlock))
    #         logger.info("Justify for:%s Data:%s Camunda Resp:%s" % (businesskey, body, r.status_code))
    #     return {
    #         "status": True, "message": "Justification Submitted", "data": []
    #     }
        
    # except Exception as e:
    #     logger.error(e)
    #     return {"status": False, "message": str(e), "data": []}

