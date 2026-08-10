from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import json
import fastapi
import traceback
import urdhva_base.settings
from cryptography.fernet import Fernet
import urdhva_base.utilities
import urdhva_base.queryparams as queryparams
import authenticator.saml_validation as saml_validation
import authenticator.authentication_manager_ad as auth_manager
router = fastapi.APIRouter(prefix='/users')

async def parse_device_info(user_agent) -> str:
    """Simple parser to guess device type from user-agent"""
    ua = str(user_agent.lower())
    if "mobile" in ua:
        return "Mobile Device"
    elif "mac" in ua:
        return "MacOS Device"
    elif "windows" in ua:
        return "Windows Device"
    elif "linux" in ua:
        return "Linux Device"
    return "Unknown Device"

# Action fetch_users
@router.post('/fetch_users', tags=['Users'])
async def users_fetch_users(data: Users_Fetch_UsersParams):
    params = queryparams.QueryParams(search_text=data.search_string, limit=data.limit, skip=data.skip)
    return await Users.get_all(params)


# Action create_user
@router.post('/create_user', tags=['Users'])
async def users_create_user(data: Users_Create_UserParams):
    return await auth_manager.AuthenticationManager.create_user(data.username, data.password, data.role,
                                                                data.first_name, data.last_name, data.employee_id, True)


# Action login
@router.post('/login', tags=['Users'])
async def users_login(request: fastapi.Request, data: Users_LoginParams):
    status, resp, user_info = await auth_manager.AuthenticationManager.login(data.username, data.password, data.login_type)
    if not status:
        response = fastapi.responses.JSONResponse({"status": False, "msg": resp}, 401)
    else:
        response = fastapi.responses.JSONResponse({"status": True, "msg": "Logged in Successfully"},
                                                  200)
        response.set_cookie(urdhva_base.settings.cookie_name, resp, httponly=urdhva_base.settings.session_httponly,
                            secure=urdhva_base.settings.session_secure, samesite=urdhva_base.settings.session_same_site)
    
        user_agent = await parse_device_info(request.headers.get("user-agent", "Unknown"))
        print("user_agent :", user_agent)

        f = Fernet(urdhva_base.settings.fernet_key)
        cookie_data = json.loads(f.decrypt(resp.encode()).decode())

        login_audit = {
            "login_id": cookie_data["cookie_id"],
            "user_agent": user_agent,
            "employee_id": data.username,
            "email": user_info.get("email", ""),
            "role": ",".join(user_info.get("novex_role", [])),
            "login_time": urdhva_base.utilities.get_present_time(),
            "login_status": LoginStatus.login,
            "failure_reason": "",
            "auth_method": "SSO" if user_info["is_ad_user"] else "Password",
            "remarks": ""
            }
        # print("login_audit :", login_audit)
        await UserLoginAuditCreate(**login_audit).create()
    return response


# Action applogin
@router.post('/applogin', tags=['Users'])
async def users_applogin(data: Users_ApploginParams):
    status, resp, user_info = await auth_manager.AuthenticationManager.login(data.username, data.password, data.login_type, jwt_auth=True)
    if not status:
        response = fastapi.responses.JSONResponse({"status": False, "msg": resp}, 401)
    else:
        response = fastapi.responses.JSONResponse({
            "status": True,
            "message": "Logged in Successfully",
            "access_token": resp.get("jwt_token", ""),
            "token_type": "bearer",
            "expires_in": urdhva_base.settings.jwt_expiration_hours * 3600,
            "user": resp.get("user_data", "")
        })
    return response
    

# Action update_user_status
@router.post('/update_user_status', tags=['Users'])
async def users_update_user_status(request: fastapi.Request, data: Users_Update_User_StatusParams):
    if not data.username:
        return False, "Invalid input"
    try:
        user_name = data.username  # Assuming user_id is the primary key
        query = f"username='{user_name}'"
        params = urdhva_base.queryparams.QueryParams()
        params.fields = []
        params.q = query
        resp = await Users.get_all(params, resp_type="plain")

        if not isinstance(resp, dict):
            resp = resp._dict_

        if resp["data"]:
            resp = resp["data"][0]
            specific_columns = ["sap_id", "region", "sales_area", "zone"]
            for key in specific_columns:
                if not hasattr(data, key) or "*" in getattr(data, key):
                    setattr(data, key, [])

            resp['first_name'] = data.first_name
            resp['last_name'] = data.last_name
            resp['region'] = data.region
            resp['state'] = data.state
            resp['zone'] = data.zone
            resp['sap_id'] = data.sap_id
            resp['bu'] = data.bu
            resp['sales_area'] = data.sales_area
            resp['novex_role'] = data.novex_role
            await Users(**resp).modify()
            return True, "User updated successfully"

    except Exception as e:
        print(traceback.format_exc())
        return False, "Error updating user details, Contact support"


# Action logout
@router.post('/logout', tags=['Users'])
async def users_logout(request: fastapi.Request, data: Users_LogoutParams):
    # Clearing the session
    return await auth_manager.AuthenticationManager.logout(request)


# Action sso_auth_callback
@router.get('/sso_auth_callback', tags=['Users'])
async def sso_auth_callback(request: fastapi.Request, code: typing.Optional[str] = None,
                entity_id: typing.Optional[str] = ""):
    status, resp, user_info = await saml_validation.auth_callback(code, urdhva_base.settings.saml_tenant_id,
                                               urdhva_base.settings.saml_client_id,
                                               urdhva_base.settings.saml_client_secret,
                                               urdhva_base.settings.saml_redirect_uri)
    if not status:
        response = fastapi.responses.JSONResponse({"status": False, "msg": resp}, 401)
        return response
    else:
        response = fastapi.responses.JSONResponse({"status": True, "msg": "Logged in Successfully"},
                                                  200)
        response.set_cookie(urdhva_base.settings.cookie_name, resp,
                            httponly=urdhva_base.settings.session_httponly,
                            secure=urdhva_base.settings.session_secure,
                            samesite=urdhva_base.settings.session_same_site)

    user_agent = await parse_device_info(request.headers.get("user-agent", "Unknown"))

    f = Fernet(urdhva_base.settings.fernet_key)
    cookie_data = json.loads(f.decrypt(resp.encode()).decode())

    login_audit = {
        "login_id": cookie_data["cookie_id"],
        "user_agent": user_agent,
        "employee_id": user_info.get("employee_id", ""),
        "email": user_info.get("email", ""),
        "role": ",".join(user_info.get("novex_role", [])),
        "login_time": urdhva_base.utilities.get_present_time(),
        "login_status": LoginStatus.login,
        "failure_reason": "",
        "auth_method": "SSO",
        "remarks": ""
    }

    await UserLoginAuditCreate(**login_audit).create()
    return response


# Action sso_auth_url
@router.get('/sso_auth_url', tags=['Users'])
async def sso_auth_url(request: fastapi.Request):
    return await saml_validation.get_redirect_url(urdhva_base.settings.saml_tenant_id,
                                                  urdhva_base.settings.saml_client_id,
                                                  urdhva_base.settings.saml_client_secret,
                                                  urdhva_base.settings.saml_redirect_uri)

# Action sso_redirection_url
@router.get('/sso_redirection_url', tags=['Users'])
async def sso_redirection_url(request: fastapi.Request):
    return await saml_validation.get_redirect_url(urdhva_base.settings.saml_tenant_id,
                                                  urdhva_base.settings.saml_client_id,
                                                  urdhva_base.settings.saml_client_secret,
                                                  urdhva_base.settings.saml_redirect_uri, "redirection")
