import hpcl_ceg_model
from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import urdhva_base
import traceback
import json
file_path = f"{os.path.dirname(hpcl_ceg_model.__file__)}/../orchestrator/masterdata/menu_submenu_master.json"


router = fastapi.APIRouter(prefix='/roles')


# Action create_role
@router.post('/create_role', tags=['Roles'])
async def roles_create_role(data: Roles_Create_RoleParams):
    role_data = {"name": data.name, "status": True, "allowed_pages": [{'menu_name': rec.menu_name,
                                                                       "allowed_sub_menus": rec.allowed_sub_menus}
                                                                      for rec in data.allowed_pages]}
    await hpcl_ceg_model.RolesCreate(**role_data).create()
    return True, f"Role {data.name} created successfully"


# Action update_role_status
@router.post('/update_role_status', tags=['Roles'])
async def roles_update_role_status(data: Roles_Update_Role_StatusParams):
    ...


# Action get_all_pages
@router.post('/get_all_pages', tags=['Roles'])
async def roles_get_all_pages(data: Roles_Get_All_PagesParams):
    role_mapping = [
        {"menu_name": "Home", "allowed_sub_menus": []}, {"menu_name": "CEMS", "allowed_sub_menus": []},
        {"menu_name": "Retail Outlet",
         "allowed_sub_menus": ["RO Home", "Supply Chain", "Dashboard", "Video Analytics", "Asset Master"]},
        {"menu_name": "Supply Chain", "allowed_sub_menus": ["Supply Chain Home", "Dashboard"]},
        {"menu_name": "SOD Terminal",
         "allowed_sub_menus": ["Terminal Home", "Supply Chain", "Dashboard", "Video Analytics"]},
        {"menu_name": "VTS", "allowed_sub_menus": ["VTS Home", "Video Analytics"]},
        {"menu_name": "VA", "allowed_sub_menus": ["VA Home", "Dashboard"]},
        {"menu_name": "LPG", "allowed_sub_menus": ["Plant", "Sales CDCMS", "LPG Analytics"]},
        {"menu_name": "CEMS", "allowed_sub_menus": ["Home", "Screens"]},
        {"menu_name": "Consumer Pump", "allowed_sub_menus": ["CP Home"]},
        {"menu_name": "RCD", "allowed_sub_menus": ["RCD Home"]}, {"menu_name": "Masters",
                                                                  "allowed_sub_menus": ["Location Masters",
                                                                                        "Role Masters",
                                                                                        "Asset Masters",
                                                                                        "State Code Masters"]},
        {"menu_name": "Settings",
         "allowed_sub_menus": ["Analytical-Studio", "Notification", "Alerts", "DNC Settings", "Users", "Roles",
                               "Jobs", "Configurations", "User", "Changelog", "Documentation"]}]
    return role_mapping


# Action create_role_ui
@router.post('/create_role_ui', tags=['Roles'])
async def roles_create_role_ui(request: fastapi.Request, data: Roles_Create_Role_UiParams):
    try:
        response = await request.json()
        role_name = response.get("role_name")
        allowed_pages = response.get("allowed_pages")
        bu = response.get("bu", [])

        query = f"name = '{role_name}'"
        role_data = await Roles.get_all(urdhva_base.QueryParams(q=query), resp_type="plain")
        rpt = urdhva_base.context.context.get('rpt', {})
        
        if role_data["data"]:
            await hpcl_ceg_model.Roles.bulk_update(
                [{"name": role_name, "status": True, "allowed_pages": allowed_pages, "bu": bu}],
                upsert=True,
                upsert_skip_keys=['name']
            )
            # Audit log for successful update
            if rpt:
                await SystemAuditLogCreate(
                    **{
                        "employee_id": rpt.get("username", ""),
                        "role": rpt.get("novex_role", ""),
                        "email": rpt.get("email", ""),
                        "section": "Role Action",
                        "remarks": f"Role {role_name} updated successfully",
                        "raw_data": {}
                    }
                ).create()
            return True, f"Role {role_name} updated successfully"

        else:
            await hpcl_ceg_model.Roles.bulk_update(
                [{"name": role_name, "status": True, "allowed_pages": allowed_pages, "bu": bu}],
                upsert=True,
                upsert_skip_keys=['name']
            )
            # Audit log for successful creation
            if rpt:
                await SystemAuditLogCreate(
                    **{
                        "employee_id": rpt.get("username", ""),
                        "role": rpt.get("novex_role", ""),
                        "email": rpt.get("email", ""),
                        "section": "Role Action",
                        "remarks": f"Role {role_name} created successfully",
                        "raw_data": {}
                    }
                ).create()
            return True, f"Role {role_name} created successfully"

    except Exception as e:
        print("traceback :", traceback.format_exc())
        if rpt:
            await SystemAuditLogCreate(
                **{
                    "employee_id": rpt.get("username", ""),
                    "role": rpt.get("novex_role", ""),
                    "email": rpt.get("email", ""),
                    "section": "Role Action",
                    "remarks": f"Failed to create role {role_name}: {str(e)}",
                    "raw_data": {}
                }
            ).create()
        return False, f"Failed to create role: {str(e)}"


# Action delete_role_ui
@router.post('/delete_role_ui', tags=['Roles'])
async def roles_delete_role_ui(data: Roles_Delete_Role_UiParams):
    try:
        if not isinstance(data,dict):
            data = data.__dict__

        role_name = data.get("role_name")
        query = f"name = '{role_name}'"
        rpt = urdhva_base.context.context.get('rpt', {})
       
        role_data = await Roles.get_all(urdhva_base.QueryParams(q=query), resp_type="plain")
        if role_data["data"]:
            role_id = role_data["data"][0]["id"]
            await Roles.delete(role_id)

            # Audit log for successful deletion
            if rpt:
                await SystemAuditLogCreate(
                    **{
                        "employee_id": rpt.get("username", ""),
                        "role": rpt.get("novex_role", ""),
                        "email": rpt.get("email", ""),
                        "section": "Role Action",
                        "remarks": f"Role {role_name} deleted successfully",
                        "raw_data": {}
                    }
                ).create()
            return True, f"Role {role_name} deleted successfully"

        return False, f"Role {role_name} not found"
        
    except Exception as e:
        print("traceback :", traceback.format_exc())
        if rpt:
            await SystemAuditLogCreate(
                **{
                    "employee_id": rpt.get("username", ""),
                    "role": rpt.get("novex_role", ""),
                    "email": rpt.get("email", ""),
                    "section": "Role Action",
                    "remarks": f"Failed to delete role {role_name}: {str(e)}",
                    "raw_data": {}
                }
            ).create()
        return False, f"Failed to delete role: {str(e)}"


# Action get_menu_submenu_details
@router.post('/get_menu_submenu_details', tags=['Roles'])
async def roles_get_menu_submenu_details():
    with open(file_path) as json_file:
        menu_submenu_details = json.load(json_file)
    return {'status':True, 'message':'Success', 'data':menu_submenu_details}
    
