import urdhva_base
import fastapi
import hpcl_ceg_model
from hpcl_ceg_enum import *
from hpcl_ceg_model import Tasactionlogs_Capture_LogsParams


router = fastapi.APIRouter(prefix='/tasactionlogs')


# Action capture_logs
@router.post('/capture_logs', tags=['TasActionLogs'])
async def tasactionlogs_capture_logs(data: Tasactionlogs_Capture_LogsParams):
    rpt = urdhva_base.context.context.get('rpt', {})
    rpt["action"] = data.action
    rpt["section"] = data.section
    rpt["comments"] = data.comments
    rpt["description"] = data.description
    query = f""" sap_id, name, zone, region from location_master where sap_id='{data.sap_id}' """
    location_name = await hpcl_ceg_model.LocationMaster.get_aggr_data(query, limit=1)
    if location_name["data"]:
        rpt["location_name"] = [location_name["data"][-1].get("name", "")]
        rpt["zone"] = [location_name["data"][-1].get("zone", "")]
        rpt["region"] = [location_name["data"][-1].get("region", "")]
        rpt["sap_id"] = [location_name["data"][-1].get("sap_id", "")]
    await hpcl_ceg_model.TasActionLogsCreate(**rpt).create()
    
    return True, "Successfully captured the log"
