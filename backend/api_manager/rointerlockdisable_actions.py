from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import urdhva_base
import utilities.helpers as helpers
import utilities.cris_alert_mapping as cris_alert_mapping
import orchestrator.alerting.alert_manager as alert_manager

router = fastapi.APIRouter(prefix='/rointerlockdisable')


# Action get_service_request_raise_details
@router.post('/get_service_request_raise_details', tags=['RoInterlockDisable'])
async def rointerlockdisable_get_service_request_raise_details(data: Rointerlockdisable_Get_Service_Request_Raise_DetailsParams):
    return {
        "status": True,
        "message": "Success",
        "violation_type": ["Decantation", "High Water", "NANF", "Pump Test", "Low Product", "TT Receipt"],
        "device_type": ["Tank", "PUMP", "ATG", "Nozzle"],
        "device_number": list(range(1, 21)),
        "actions": {"Raise Request": "Raised"},
        "category": {"Others": "Others"},
        "rca_reason": ["Others"]
    }


# Action submit_service_request
@router.post('/submit_service_request', tags=['RoInterlockDisable'])
async def rointerlockdisable_submit_service_request(data: Rointerlockdisable_Submit_Service_RequestParams):
    entry = data.__dict__
    entry['return_data'] = True
    entry['bu'] = 'RO'
    interlock_data = cris_alert_mapping.Cris_Alert_Mapping[entry['bu']][entry['violation_type']]
    entry['interlock_name'] = interlock_data['name']
    entry['sop_id'] = interlock_data['sop_id']
    entry['alert_section'] = 'RO'
    camunda_url = await helpers.get_camunda_url(bu=entry['location_type'], sap_id=entry['sap_id'],
                                                alert_section="RO")
    _, alert_data = await alert_manager.create_alert({**entry, "alert_type": "RO"}, camunda_url=camunda_url)
    entry['alert_id'] = alert_data['id']
    return await alert_manager.AlertAction().update_alert_data(entry)

