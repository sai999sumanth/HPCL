import urdhva_base
from ingestion_api_enum import *
from ingestion_api_model import *
import fastapi
import datetime
import hpcl_ceg_model
import utilities.helpers as helpers
import orchestrator.analytics.ro_analysis as ro_analysis
import utilities.cris_alert_mapping as cris_alert_mapping
import orchestrator.alerting.alert_manager as alert_manager

router = fastapi.APIRouter(prefix='/cris')

logger = urdhva_base.logger.Logger.getInstance("cris_data_ingestion")

# Action ingest_data
@router.post('/ingest_data', tags=['CRIS'])
async def cris_ingest_data(data: Cris_Ingest_DataParams):
    """
    API endpoint to ingest CRIS data.

    Args:
    - data (Cris_Ingest_DataParams): Contains vendor ID, location ID, location type, 
      and a list of crisDataCreate objects with interlock details.

    Processes each interlock data entry by constructing a payload with vendor, location, 
    and interlock details, then sends it to the Camunda process engine for processing.

    Returns:
    - dict: Status message indicating the success of the data submission.
    """
    # return True, "Success"
    logger.info(f"Received CRIS data ingestion for Location {data.location_id}({data.location_type}) {data.dict()}")

    if isinstance(data.data, list) and len(data.data) > 0:
        enriched_data = [
            {
                **entry.dict(),
                'vendor_name': data.vendor_name,
                'vendor_id': data.vendor_id,
                'location_id': data.location_id,
                'ro_code': data.ro_code,
                'location_type': data.location_type,
            }
            for entry in data.data
        ]
    else:
        logger.error(f"Invalid data structure: data.data is not a list or is empty")
        return {"status": False, "message": "Invalid data", "data": []}
    for entry in enriched_data:
        if entry['severity'] in ['Normal','NORMAL']:
            entry['severity'] = 'Medium'
        entry['occurrence_date'] = datetime.datetime.strptime(entry['occurrence_date'], "%Y%m%d%H%M%S")
        if entry.get("closure_date", ""):
            entry['closure_date'] = datetime.datetime.strptime(entry['closure_date'], "%Y%m%d%H%M%S")
        if not entry.get("closure_date", ""):
            entry['closure_date'] = None
        await hpcl_ceg_model.CrisAlertHistory.bulk_update([entry], upsert=True)

        entry['alert_id'] = entry['alarm_id']
        entry['bu'] = 'RO'
        entry['sap_id'] = entry['location_id']
        entry['violation_type'] = entry['interlock_type']
        interlock_data = cris_alert_mapping.Cris_Alert_Mapping[entry['bu']][entry['interlock_type']]
        entry['interlock_name'] = interlock_data['name']
        entry['sop_id'] = interlock_data['sop_id']
        entry['alert_section'] = 'RO'
        camunda_url = await helpers.get_camunda_url(bu=entry['location_type'], sap_id=entry['location_id'],
                                                    alert_section="RO")
        if not entry.get("closure_date", ""):
            if not await ro_analysis.check_alert_exists(entry['alarm_id'], entry['violation_type'], entry['sap_id']):
                await alert_manager.create_alert({**entry, "alert_type": "RO"}, camunda_url=camunda_url)
            else:
                logger.info(f"Alert already exists {entry['alarm_id']} - {entry['sap_id']}")
                print(f"Alert already exists {entry['alarm_id']} - {entry['sap_id']}")
        else:
            query = (f"""select * from alerts where external_id = '{entry["alarm_id"]}'"""
                     f"and violation_type = '{entry["interlock_type"]}' and alert_status != 'Close'")
            alert_data = await hpcl_ceg_model.Alerts.get_aggr_data(query)
            alert_data = alert_data.get("data", [])
            if alert_data:
                alert_data = alert_data[0]
                alert_data['alert_type'] = alert_data['bu']
                alert_data['alert_id'] = alert_data['id']
                await alert_manager.close_alert(alert_data=alert_data)
                await ro_analysis.close_camunda_workflow(alert_data=alert_data, camunda_url=camunda_url)
            else:
                print(f"Alert Not Found Query: {query}")

    return True, "Success"


# Action api_ack
@router.post('/api_ack', tags=['CRIS'])
async def cris_api_ack(data: Cris_Api_AckParams):
    """

    Args:
        data:

    Returns:

    """
    logger.info(f"Received CRIS API Ack {data.dict()}")
    return True, {"msg": "Ok"}
