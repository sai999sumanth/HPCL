from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import traceback
import orchestrator.alerting.alert_manager as alert_manager
import utilities.connection_mapping as connection_mapping

router = fastapi.APIRouter(prefix='/violationhistoryvts')

logger = urdhva_base.logger.Logger.getInstance("api_manager")

# Action alert_action_vts
@router.post('/alert_action_vts', tags=['ViolationHistoryVts'])
async def violationhistoryvts_alert_action_vts(data: Violationhistoryvts_Alert_Action_VtsParams):
    try:
        logger.info(f"Alert data received to perform action: {data}")
        return await alert_manager.AlertAction().update_alert_data_vts(data.dict())
    except Exception as e:
        print(traceback.format_exc())
        logger.error(f"Error in performing action on alert: {e}, InputData {data.dict()}, Traceback: {traceback.format_exc()}")
        return False, "Error in performing action on alert"
    
# Action get_closed_alerts_details_vts
@router.post('/get_closed_alerts_details_vts', tags=['ViolationHistoryVts'])
async def violationhistoryvts_get_closed_alerts_details_vts(data: Violationhistoryvts_Get_Closed_Alerts_Details_VtsParams):
    if urdhva_base.context.context.exists():
        rpt = urdhva_base.context.context.get('rpt', {})
    else:
        rpt = {}

    alert_data = await ViolationHistoryVts.get(int(data.alert_id))
    if not isinstance(alert_data, dict):
        alert_data = alert_data.__dict__

    alert_role = alert_data['assigned_user_roles'][0] if alert_data['assigned_user_roles'] else ""

    close_alert_details = {
        "actions": {},
        "category": {},
        "rca_reason": []
    }
    action_data = connection_mapping.vts_alert_section.get(data.bu)[data.alert_section]
    close_alert_details['category'] = action_data.get("category", {"Others": "Others"})
    close_alert_details['rca_reason'] = action_data.get("rca_reason", ["Other"])
    close_alert_details['actions'] = {
        key: value['name'] for key, value in action_data.get("actions", {}).items()
        if alert_role in value.get("roles", [])
    }
    return close_alert_details
