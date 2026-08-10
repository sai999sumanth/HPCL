import urdhva_base
from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import json
import fastapi
import traceback
from pathlib import Path
import utilities.minio_connector as minio_connector
import authenticator.authentication_manager_ad as authentication_manager_ad

router = fastapi.APIRouter(prefix='/usermaster')


# Action create_user
@router.post('/create_user', tags=['UserMaster'])
async def usermaster_create_user(data: Usermaster_Create_UserParams):
    rpt = {}
    original_data = data
    try:
        if not urdhva_base.context.context.exists():
            return {
                "success": False,
                "message": "Not allowed to perform this operation"
            }

        rpt = urdhva_base.context.context.get('rpt', {})
        login_user_id= rpt.get("employee_id") or rpt.get("first_name")

        # Normalize roles (lowercase + remove spaces)
        user_roles = [r.replace(" ", "").lower() for r in rpt.get("novex_role", [])]

        # Roles to check
        allowed = ['admin', 'superadmin', 'creatorsod', 'creatorlpg', 'approversod']

        # Check
        is_allowed = False if not user_roles else any(role in allowed for role in user_roles)

        if is_allowed:
            # Creator SOD was only for TAS
            if 'creatorsod' in user_roles and data.data.bu != ['TAS']:
                is_allowed = False
            
            if 'approversod' in user_roles and data.data.bu != ['TAS']:
                is_allowed = False
            
            if rpt.get("username","").lower() in ["dnc_admin"]:
                is_allowed = False

        if not is_allowed:
            return {
                "success": False,
                "message": "Not allowed to perform this operation"
            }

        if not isinstance(data.data,dict):
            data = data.data.__dict__
        
        query = f"""username = '{data.get('username','')}'"""
        user_data = await Users.get_all(urdhva_base.QueryParams(q=query), resp_type="plain")
        if user_data["data"]:
            return {
                "success": False, 
                "message": "User Already Exists"
            }

        if not data.get('is_ad_user') and not data.get('password'):
            return {
                "success": False, 
                "message": "Not a Valid ADUser"
            }
        
        user_response = await UsersCreate(**{
            "username": data.get('username',''),
            "email": data.get("email",""),
            "first_name": data.get('first_name',''),
            "last_name": data.get('last_name'),
            "password": data.get('password',''),
            "employee_id": data.get('username',''),
            "bu": data.get('bu',["TAS"]),
            "sap_id": data.get('sap_id',[]),
            "system_role": data.get('system_role',[]),
            "novex_role": data.get('novex_role',[]),
            "region": data.get('region',[]),
            "state": data.get('state',[]),
            "zone": data.get('zone',[]),
            "sales_area": data.get('sales_area',[]),
            "manual_user": True,
            "status": data.get('status'),
            "is_ad_user": data.get('is_ad_user'),
            "contact_number": data.get('contact_number',''),
            "login_user_id": login_user_id,       
            "file_path": data.get('file_path','')         
        }).create()

        if user_response:
            if not data.get("bu"):
                query = f"""
                            UPDATE users
                            SET bu = ARRAY[]::varchar[]
                            WHERE username = '{data.get("username")}'
                            """
                await Users.update_by_query(query)

            if rpt:
                await SystemAuditLogCreate(
                    **{
                        "employee_id": rpt["username"],
                        "role": rpt["novex_role"],
                        "email": rpt.get("email",""),
                        "section": "User Action",
                        "remarks": f"User {data.get('username')} created successfully",
                        "raw_data": {}
                    }
                    ).create()
                return {
                    "success": True, 
                    "message": "User created successfully",
                }
    except Exception as e:
        print("traceback :", traceback.format_exc())
        username_for_log = (
            data.get('username') if isinstance(data, dict)
            else getattr(getattr(original_data, 'data', None), 'username', None)
        )
        if rpt:
            try:
                await SystemAuditLogCreate(
                    **{
                        "employee_id": rpt.get("username", ""),
                        "role": rpt.get("novex_role", []),
                        "email": rpt.get("email", ""),
                        "section": "User Action",
                        "remarks": f"Failed to create user {username_for_log}",
                        "raw_data": {}
                    }
                ).create()
            except Exception:
                print("Failed to write audit log:", traceback.format_exc())
        
        return {
            "success": False, 
            "message": "An error occurred while creating user details."
        }


# Action update_user
@router.post('/update_user', tags=['UserMaster'])
async def usermaster_update_user(data: Usermaster_Update_UserParams):
    rpt = {}
    original_data = data
    try:
        if not urdhva_base.context.context.exists():
            return {
                "success": False,
                "message": "Not allowed to perform this operation"
            }

        rpt = urdhva_base.context.context.get('rpt', {})

        # Normalize roles (lowercase + remove spaces)
        user_roles = [r.replace(" ", "").lower() for r in rpt.get("novex_role", [])]

        # Roles to check
        allowed = ['admin', 'superadmin', 'creatorsod', 'creatorlpg', 'approversod']

        # Check
        is_allowed = False if not user_roles else any(role in allowed for role in user_roles)

        if is_allowed:
            # Creator SOD was only for TAS
            if 'creatorsod' in user_roles and data.data.bu != ['TAS']:
                is_allowed = False

            if 'approversod' in user_roles and data.data.bu != ['TAS']:
                is_allowed = False
            
            if rpt.get("username","").lower() in ["dnc_admin"]:
                is_allowed = False

        if not isinstance(data.data, dict):
            data = data.data.__dict__
        else:
            data = data.data

        if not data.get('username','') or not is_allowed:
            return {
                "success": False, 
                "message": "Not allowed to perform this operation"
            }

        # No one can change admin and superadmin
        if data['username'].lower() in ["admin", "superadmin"]:
            return {
                "success": False,
                "message": "Not allowed to perform this operation"
            }
        
        query = f"""username = '{data.get('username','')}'"""

        user_data = await Users.get_all(urdhva_base.QueryParams(q=query), resp_type="plain")
        if not user_data["data"]:
            return {
                "success": False, 
                "message": "User does not exists to modify"
            }
        
        data_dict = data
        data_dict.update({"id": user_data['data'][0]['id']})
        if 'lock_for_auto_sync' in data:
            data_dict["manual_user"] = data['lock_for_auto_sync']
            del data['lock_for_auto_sync']
        params = urdhva_base.QueryParams(q="", limit=0, fields=json.dumps(['name']))
        role = await Roles.get_all(params, resp_type="plain")
        roles = []
        if role["data"]:
            roles = [u['name'] for u in role["data"]]
        
        changes = []
        for key, new_value in data_dict.items():
            old_value = user_data['data'][0].get(key)

            # Condition only for novex_role
            if key == "novex_role":
                if new_value is not None and old_value != new_value:
                    invalid_roles = [role for role in new_value if role not in roles]
                    if invalid_roles:
                        return {
                            "success": False,
                            "message": "Update failed: Invalid Roles",
                            "details": {
                                "invalid_roles_attempted": invalid_roles,
                                "valid_roles_available": roles
                            }
                        }

                    changes.append(f"{key} changed from '{old_value}' to '{new_value}'")

                # For all other keys — just detect change, no validation
                elif new_value is not None and old_value != new_value:
                    changes.append(f"{key} changed from '{old_value}' to '{new_value}'")
        
        if changes:
            remarks = "Changes: " + "; ".join(changes)
        else:
            remarks = "No changes detected"
        
        response = await Users(**data_dict).modify()

        if response:
            if rpt:
                await SystemAuditLogCreate(
                    **{
                        "employee_id": rpt["username"],
                        "role": rpt["novex_role"],
                        "email": rpt.get("email",""),
                        "section": "User Action",
                        "remarks": f"{remarks} For The User {data.get('username')} ",
                        "raw_data": {}
                    }
                ).create()
            return {
                "success": True, 
                "message": "User details updated successfully",
                "changes": changes if changes else ["No changes detected"]
            }
    except Exception as e:
        print("traceback :", traceback.format_exc())
        username_for_log = (
            data.get('username') if isinstance(data, dict)
            else getattr(getattr(original_data, 'data', None), 'username', None)
        )
        if rpt:
            await SystemAuditLogCreate(
                **{
                    "employee_id": rpt["username"],
                    "role": rpt["novex_role"],
                    "email": rpt.get("email",""),
                    "section": "User Action",
                    "remarks": f"Failed to update user details For The User {username_for_log} ",
                    "raw_data": {}
                }
            ).create()
        return {
            "success": False, 
            "message": "An error occurred while updating user details. "
        }


# Action delete_user
@router.post('/delete_user', tags=['UserMaster'])
async def usermaster_delete_user(data: Usermaster_Delete_UserParams):
    rpt = {}
    original_data = data
    try:
        if urdhva_base.context.context.exists():
            rpt = urdhva_base.context.context.get('rpt', {})
        else:
            rpt = {}

        user_roles = [r.replace(" ", "").lower() for r in rpt.get("novex_role", [])]

        # Roles to check
        allowed = ['admin', 'superadmin', 'creatorsod', 'dnc_user', 'creatorlpg', 'approversod']

        # Check
        is_allowed = False if not user_roles else any(role in allowed for role in user_roles)

        if is_allowed:
            if rpt.get("username","").lower() in ["dnc_admin"]:
                is_allowed = False

        if not is_allowed:
            return {
                "success": False,
                "message": "Not allowed to perform this operation"
            }

        if not isinstance(data,dict):
            data = data.__dict__
        
        query = f"""username = '{data.get('username','')}'"""
        user_data = await Users.get_all(urdhva_base.QueryParams(q=query), resp_type="plain")

        if not user_data.get("data"):
            return {
                "success": False,
                "message": "Invalid information."
            }

        # No one can change admin and superadmin
        if user_data['data'][0]['username'].lower() in ["admin", "superadmin"]:
            return {
                "success": False,
                "message": "Not allowed to perform this operation"
        }

        # Creator SOD was only for TAS
        if 'creatorsod' in user_roles and user_data['data'][0]['bu'] != ['TAS']:
            return {
                "success": False,
                "message": "Not allowed to perform this operation"
            }
        
        if 'approversod' in user_roles and user_data['data'][0]['bu'] != ['TAS']:
            return {
                "success": False,
                "message": "Not allowed to perform this operation"
            }

        delete_user = f"""delete from users where id='{user_data['data'][0]['id']}'
                       """
        await Users.update_by_query(delete_user)

        await SystemAuditLogCreate(
            **{
                "employee_id": rpt["username"],
                "role": rpt["novex_role"],
                "email": rpt.get("email",""),
                "section": "User Action",
                "remarks": f"User {data.get('username')} deleted successfully",
                "raw_data": {}
            }
        ).create()
        
        return {
            "success": True, 
            "message": "User deleted successfully",
            "changes": f"User {data.get('username')} deleted successfully"
        }
    except Exception as e:
        print("traceback :", traceback.format_exc())
        username_for_log = (
            data.get('username') if isinstance(data, dict)
            else getattr(getattr(original_data, 'data', None), 'username', None)
        )
        if rpt:
            await SystemAuditLogCreate(
                **{
                    "employee_id": rpt["username"],
                    "role": rpt["novex_role"],
                    "email": rpt.get("email",""),
                    "section": "User Action",
                    "remarks": f"Failed to Delete User {username_for_log} ",
                    "raw_data": {}
                }
            ).create()
        return {
            "success": False, 
            "message": f"Failed to Delete User {data.get('username')} "
        }


# Action file_upload
@router.post('/file_upload', tags=['UserMaster'])
async def usermaster_file_upload(
    username: str = fastapi.Form(...),
    bu: str | None = fastapi.Form(None),
    upload_file: fastapi.UploadFile | None = fastapi.File(None)):
    
    try:        
        if isinstance(bu, str):
            bu_list = [b.strip() for b in bu.split(",")]
        else:
            bu_list = bu if bu else []

        bu_str = "_".join(bu_list) if bu_list else "None"
    
        UPLOAD_DIR = os.path.join(urdhva_base.settings.uploads, bu_str)
        os.makedirs(UPLOAD_DIR, exist_ok=True)

        # Validate file extension
        file_extension = Path(upload_file.filename).suffix.lower()
        allowed_extensions = [".png", ".jpg", ".jpeg",".pdf", ".doc", ".docx"]
        if file_extension not in allowed_extensions:
            return {"success": False, "message": "Unsupported file type"}

        # Save temporary file
        file_name = upload_file.filename
        temp_file_path = os.path.join(UPLOAD_DIR, file_name)
        with open(temp_file_path, "wb") as f:
            f.write(await upload_file.read())

        # Upload to MinIO
        status, minio_path = minio_connector.upload_to_minio(
            username , bu_str, "True",  temp_file_path
        )

        # Clean up
        try:
            os.remove(temp_file_path)
        except OSError:
            pass
        

        if status:
            return {
                "success": True, "file_path": minio_path,
                "message": "File uploaded successfully"
            }
        else:
            return { "success": False, "message": "Failed to upload file to storage" }

    except Exception as e:
        print("traceback :", traceback.format_exc())
        return { "success": False, "message": f"An error occurred while uploading file: {str(e)}" }
