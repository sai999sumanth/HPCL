import fastapi
import importlib
from field_force_enum import *
from field_force_model import *
import orchestrator.field_force.ims as field_force_ims
import orchestrator.field_force.ims_lpg as field_force_ims_lpg

router = fastapi.APIRouter(prefix='/indentmanagement')


def _params(data):
    return data.model_dump() if hasattr(data, 'model_dump') else data.dict()
   

# Action get_indents_by_product_volume
@router.post('/get_indents_by_product_volume', tags=['IndentManagement'])
async def indentmanagement_get_indents_by_product_volume(data: Indentmanagement_Get_Indents_By_Product_VolumeParams):
    return await field_force_ims.get_indents_by_product_volume(**_params(data))


# Action get_pending_vs_executed_indents
@router.post('/get_pending_vs_executed_indents', tags=['IndentManagement'])
async def indentmanagement_get_pending_vs_executed_indents(data: Indentmanagement_Get_Pending_Vs_Executed_IndentsParams):
    return await field_force_ims.get_pending_vs_executed_indents(**_params(data))


# Action get_cancelled_indents
@router.post('/get_cancelled_indents', tags=['IndentManagement'])
async def indentmanagement_get_cancelled_indents(data: Indentmanagement_Get_Cancelled_IndentsParams):
    return await field_force_ims.get_cancelled_indents(**_params(data))


# Action get_dtp_dealers_count
@router.post('/get_dtp_dealers_count', tags=['IndentManagement'])
async def indentmanagement_get_dtp_dealers_count(data: Indentmanagement_Get_Dtp_Dealers_CountParams):
    return await field_force_ims.get_dtp_dealers_count(**_params(data))


# Action get_top_dtp_customers
@router.post('/get_top_dtp_customers', tags=['IndentManagement'])
async def indentmanagement_get_top_dtp_customers(data: Indentmanagement_Get_Top_Dtp_CustomersParams):
    return await field_force_ims.get_top_dtp_customers(**_params(data))


# Action get_dct_indents_by_product_volume
@router.post('/get_dct_indents_by_product_volume', tags=['IndentManagement'])
async def indentmanagement_get_dct_indents_by_product_volume(data: Indentmanagement_Get_Dct_Indents_By_Product_VolumeParams):
    return await field_force_ims.get_dct_indents_by_product_volume(**_params(data))


# Action get_trucks_failed_to_report
@router.post('/get_trucks_failed_to_report', tags=['IndentManagement'])
async def indentmanagement_get_trucks_failed_to_report(data: Indentmanagement_Get_Trucks_Failed_To_ReportParams):
    return await field_force_ims.get_trucks_failed_to_report(**_params(data))


# Action get_tpt_indents_vs_availability
@router.post('/get_tpt_indents_vs_availability', tags=['IndentManagement'])
async def indentmanagement_get_tpt_indents_vs_availability(data: Indentmanagement_Get_Tpt_Indents_Vs_AvailabilityParams):
    return await field_force_ims.get_tpt_indents_vs_availability(**_params(data))


# Action get_indents_details
@router.post('/get_indents_details', tags=['IndentManagement'])
async def indentmanagement_get_indents_details(data: Indentmanagement_Get_Indents_DetailsParams):
    return await field_force_ims.get_indents_details(**_params(data))


# Action get_r3_r1_details
@router.post('/get_r3_r1_details', tags=['IndentManagement'])
async def indentmanagement_get_r3_r1_details(data: Indentmanagement_Get_R3_R1_DetailsParams):
    action_name = data.action
    func = getattr(field_force_ims, action_name, None)
    if not callable(func):
        raise ValueError(f"{action_name} is not a valid function")
    return await func(data)


# Action get_indent_details
@router.post('/get_indent_details', tags=['IndentManagement'])
async def indentmanagement_get_indent_details(data: Indentmanagement_Get_Indent_DetailsParams):
    if (data.bu or "").strip().upper() == "LPG":
        return await field_force_ims_lpg.get_indent_details(data)
    return {"status": False, "data": [], "message": "Invalid inputs"}
