import urdhva_base
from ingestion_api_enum import *
from ingestion_api_model import *
import fastapi
import datetime
import pytz
import traceback
import polars as pl
import hpcl_ceg_model
import urdhva_base.utilities
import urdhva_base.redispool
import utilities.helpers as helpers
import orchestrator.analytics.va_analysis as va_analysis
import orchestrator.analytics.ro_analysis as ro_analysis
import utilities.connection_mapping as connection_mapping
import orchestrator.alerting.alert_manager as alert_manager
import orchestrator.alerting.ro_va_alert_handler as ro_va_alert_handler

router = fastapi.APIRouter(prefix='/va')

logger = urdhva_base.logger.Logger.getInstance("va_data_ingestion")

# Action ingest_data
@router.post('/ingest_data', tags=['VA'])
async def va_ingest_data(data: Va_Ingest_DataParams):
    """
    API endpoint to ingest VA data.

    Args:
    - data (Va_Ingest_DataParams): VA data ingestion parameters

    Processes each VA data entry by constructing a payload with vendor, location, and VA details,
    then sends it to the Camunda process engine for processing.

    Returns:
    - dict: Status message indicating the success of the data submission.
    """
    try:
      logger.info(f"Received VA data ingestion from vendor {data.location_id}({data.location_type}) {data.dict()}")
      # Ensure data.data is a list and contains items
      if isinstance(data.data, list) and len(data.data) > 0:
         enriched_data = [
            {
               **entry.dict(),
               'vendor_id': data.vendor_id,
               'location_id': data.location_id,
               'location_type': data.location_type.value if hasattr(data.location_type, 'value') else str(data.location_type),
            }
            for entry in data.data
            ]
      else:
          logger.error(f"Invalid data structure: data.data is not a list or is empty")
          return {"status": False, "message": "Invalid data", "data": []}

      enriched_data = pl.DataFrame(enriched_data)
      enriched_data = await va_analysis.assign_values_to_dataframe(
          enriched_data, list(connection_mapping.camunda_listener_va_mapping.values())
      )
      enriched_data = enriched_data.to_dicts()
      for entry in enriched_data:
          entry['alert_section'] = entry['alert_type']
          entry['alert_timestamp'] = (
              datetime.datetime.strptime(entry['alert_timestamp'], "%m/%d/%Y %I:%M:%S %p") + 
              datetime.timedelta(hours=5, minutes=30))
          IST = pytz.timezone("Asia/Kolkata")
          now_current_time = datetime.datetime.now(IST).replace(tzinfo=None)
          diff = now_current_time - entry['alert_timestamp']
          if diff.days < 30:
            if diff.total_seconds() >= 2 * 3600:
                if not await va_analysis.is_alert_exists(entry['alert_id']):
                    await hpcl_ceg_model.VaAlertHistoryCreate(**entry).create()
                    camunda_url = urdhva_base.settings.camunda_url
                    if 'camunda_host' in entry.keys():
                        camunda_url = f"http://{entry['camunda_host']}:{entry['camunda_port']}"
                    await alert_manager.create_alert({**entry, "alert_type": "VA"}, camunda_url=camunda_url)
                else:
                    return True, "Success"
            else:
                await hpcl_ceg_model.VaAlertHistoryCreate(**entry).create()
                # entry['vendor_alert_id'] = entry.pop("alert_id")
                camunda_url = urdhva_base.settings.camunda_url
                if 'camunda_host' in entry.keys():
                    camunda_url = f"http://{entry['camunda_host']}:{entry['camunda_port']}"
                await alert_manager.create_alert({**entry, "alert_type": "VA"}, camunda_url=camunda_url)
      return True, "Success"
        
    except Exception as e:
        print(traceback.format_exc())
        logger.error(e)
        return {"status": False, "message": "Error", "data": []}


# Action ingest_data_score
@router.post('/ingest_data_score', tags=['VA'])
async def va_ingest_data_score(data: Va_Ingest_Data_ScoreParams):
    """
    Args:
        data:
    Returns:
    """
    try:
        logger.info(f"Received VA data ingestion from vendor {data.location_id}({data.location_type}) {data.dict()}")
        return True, "Success"
    except Exception as e:
        print(traceback.format_exc())
        logger.error(e)
        return False, e


# Action ingest_data_close
@router.post('/ingest_data_close', tags=['VA'])
async def va_ingest_data_close(data: Va_Ingest_Data_CloseParams):
    try:
        logger.info(f"Received VA data ingestion data close {data}")
        # va_query = f"select * from va_alert_history where alert_id = '{data.alert_id}'"
        # va_alert = await hpcl_ceg_model.VaAlertHistory.get_aggr_data(va_query, limit=0)
        # if va_alert.get("data", []):
        #     va_alert = va_alert.get("data", [])[0]
        #     va_alert['status'] = data.status
        #     va_alert['acknowledged_by'] = data.acknowledged_by
        #     va_alert['closed_at'] = (
        #         datetime.datetime.strptime(data.closed_at, "%m/%d/%Y %I:%M:%S %p") + 
        #         datetime.timedelta(hours=5, minutes=30))
        #     va_alert['action_description'] = data.action_description
        #     va_alert['action_code'] = data.action_code
        #     va_alert['action_reason'] = data.action_reason
        #     va_alert['action_category'] = data.action_category
        #     await hpcl_ceg_model.VaAlertHistory(**va_alert).modify()

        # alert_query1 = f"select * from alerts where alert_section = 'VA' and external_id = '{data.alert_id}' and alert_status = 'Close'"
        # alert_data1 = await hpcl_ceg_model.Alerts.get_aggr_data(alert_query1, limit=0)
        # if alert_data1.get("data", []):
        #     return {"status": True, "message": "Alert already Closed in Novex", "data": []}
        
        # alert_query = f"select * from alerts where alert_section = 'VA' and external_id = '{data.alert_id}' and alert_status != 'Close'"
        # alert_data = await hpcl_ceg_model.Alerts.get_aggr_data(alert_query, limit=0)
        # if not alert_data.get("data", []):
        #     return {"status": False, "message": "Alert not found", "data": []}

        # alert_data = alert_data.get("data", [])[0]
        # alert_data['alert_status'] = 'Close'
        # alert_data['alert_state'] = 'Resolved'
        # alert_data['closed_at'] = datetime.datetime.now()
        # alert_data['alert_history'].append({
        #     "action_type": "Resolved", "alert_status": "Close", "action_msg": data.action_code or data.status,
        #     "remarks": data.action_description, "action_by": data.acknowledged_by,
        #     "processed_time": (
        #         datetime.datetime.strptime(data.closed_at, "%m/%d/%Y %I:%M:%S %p") + 
        #         datetime.timedelta(hours=5, minutes=30)).isoformat()
        # })
        # await hpcl_ceg_model.Alerts(**alert_data).modify()
        # camunda_url = await helpers.get_camunda_url(bu=alert_data['bu'], sap_id=alert_data['bu'],
        #                                             alert_section="VA")
        # await ro_analysis.close_camunda_workflow(alert_data, camunda_url=camunda_url)
        return {"status": True, "message": "Success", "data": []}

    except Exception as e:
        print(traceback.format_exc())
        logger.error(e)
        return {"status": False, "message": "Error", "data": []}


# Action ro_no_video_upload_list
@router.post('/ro_no_video_upload_list', tags=['VA'])
async def va_ro_no_video_upload_list(data: Va_Ro_No_Video_Upload_ListParams):
    try:
        logger.info(f"Received No Video Upload data ingestion from vendor {data.model_dump()}")
        print('*'*200)
        ro_cleanliness_data = data.model_dump()
        print(ro_cleanliness_data)
        print('*'*200)
        await ro_va_alert_handler.ROVaAlertHandler().ro_cleanliness_master_data(ro_cleanliness_data.get('data',[]))
        return {"status": True, "message": "Success", "data": []}
    except Exception as e:
        print(traceback.format_exc())
        logger.error(e)
        return {"status": False, "message": "Error", "data": []}


# Action ro_no_video_upload_list_status
@router.post('/ro_no_video_upload_list_status', tags=['VA'])
async def va_ro_no_video_upload_list_status(data: Va_Ro_No_Video_Upload_List_StatusParams):
    try:
        logger.info(f"Received No Video Upload Status data ingestion from vendor {data.model_dump()}")
        ro_cleanliness_status_data = data.model_dump()
        print('*'*200)
        print(ro_cleanliness_status_data['data'])
        print('*'*200)
        await ro_va_alert_handler.ROVaAlertHandler().ro_cleanliness_uploaded_master_data(ro_cleanliness_status_data.get('data',[]))
        return {"status": True, "message": "Success", "data": []}
    except Exception as e:
        print(traceback.format_exc())
        logger.error(e)
        return {"status": False, "message": "Error", "data": []}
    finally:
        try:
            redis_ins = await urdhva_base.redispool.get_redis_connection()
            await redis_ins.set("va_cleanliness_last_sync",
                                 urdhva_base.utilities.get_present_time().strftime("%Y/%m/%d %-I:%M %p"))
            await redis_ins.close()
        except Exception as e:
            print(traceback.format_exc())
            print(e)
