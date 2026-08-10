import urdhva_base
import uuid
import ldap
import json
import fastapi
import base64
import requests
import hpcl_ceg_model
import urdhva_base.settings
import urdhva_base.redispool
from typing import Dict, Any
from jose import JWTError, jwt
from cryptography.fernet import Fernet
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status as resp_status


class AuthenticationManager:
    """
    A class to manage user authentication, roles, and permissions.
    """

    @classmethod
    async def validate_ldap_auth(cls, username, password):
        """
        Authenticates a user based on their username and password in ad

        Args:
            username (str): The username of the user.
            password (str): The password of the user.

        Returns:
            bool: True if authentication is successful, False otherwise.
        """
        try:
            # build a client
            ldap_client = ldap.initialize(f"ldap://{urdhva_base.settings.ldap_host}:{urdhva_base.settings.ldap_port}")
            # perform a synchronous bind
            ldap_client.set_option(ldap.OPT_REFERRALS, 0)
            ldap_client.simple_bind_s(f"{username}@{urdhva_base.settings.ldap_domain}", f"{password}")
            print("User Successfully Valid...")
            return True
        except ldap.INVALID_CREDENTIALS as e:
            ldap_client.unbind()
            print(f"User Validation Failed {e}")
            return False
    
    @classmethod
    async def cleanup_internal_jwt(cls, token: str):
        redis_ins = await urdhva_base.redispool.get_redis_connection()
        payload = jwt.decode(
            token,
            urdhva_base.settings.jwt_secret_key,
            algorithms=[urdhva_base.settings.jwt_algorithm]
        )
        rkey = payload["sec_key"]
        if redis_ins.exists(rkey):
            redis_ins.delete(rkey)
        redis_ins.close()

    @classmethod
    async def verify_internal_jwt(cls, token: str) -> Dict[str, Any]:
        """Verify internal JWT token"""
        redis_ins = await urdhva_base.redispool.get_redis_connection()
        try:
            payload = jwt.decode(
                token,
                urdhva_base.settings.jwt_secret_key,
                algorithms=[urdhva_base.settings.jwt_algorithm]
            )

            # Check token expiration
            if datetime.now(timezone.utc).timestamp() > payload.get("exp", 0):
                raise HTTPException(status_code=resp_status.HTTP_401_UNAUTHORIZED,
                                    detail="Token has expired")

            # Validating redis key information
            rkey = payload["sec_key"]
            user_info = redis_ins.get(rkey)
            if not user_info:
                # Missing user information in redis, marking as invalid login headers
                raise HTTPException(status_code=resp_status.HTTP_401_UNAUTHORIZED,
                                     detail="Invalid authentication token")
            user_info = json.loads(base64.b64decode(user_info))
            return user_info
        except JWTError as e:
            raise HTTPException(
                status_code=resp_status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}"
            )
        finally:
            redis_ins.close()
    
    @classmethod
    async def create_internal_jwt(cls, user_data: Dict[str, Any]) -> str:
        """Create internal JWT token after successful Keycloak authentication"""
        # rkey will be used to fetch information from redis
        # Adding user id to rkey, so incase if any changes in userdata,
        # we can do auto-logout
        rkey = f"Novex_SessionData_{uuid.uuid4().hex}"
        for key in ["password", "created_at", "updated_at"]:
            if key in user_data.keys():
                del user_data[key]
        payload = {
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(hours=urdhva_base.settings.jwt_expiration_hours),
            "sec_key": rkey
        }
        payload.update(user_data)
        redis_client = await urdhva_base.redispool.get_redis_connection()
        timeout = int(timedelta(hours=urdhva_base.settings.jwt_expiration_hours).total_seconds())
        await redis_client.setex(rkey, 
                                 timeout,
                                 base64.urlsafe_b64encode(json.dumps(user_data, default=str).encode()).decode())
        return {
            "jwt_token": jwt.encode(payload, 
                                    urdhva_base.settings.jwt_secret_key, 
                                    algorithm=urdhva_base.settings.jwt_algorithm),
            "user_data": user_data
            }

    @classmethod
    def get_access_token(cls):
        """
        Get access token using Basic Authentication

        Returns:
            True if token obtained successfully, False otherwise
        """
        try:
            token_url = urdhva_base.settings.openldap_token_url
            client_username = urdhva_base.settings.openldap_client_username
            client_password = urdhva_base.settings.openldap_client_password

            credentials = base64.b64encode(f"{client_username}:{client_password}".encode()).decode()
            headers = {
                'Authorization': f'Basic {credentials}',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            }
            token_data = {'grant_type': 'client_credentials'}
            response = requests.post(
                token_url,
                data=token_data,
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            token_response = response.json()
            access_token = token_response.get('access_token')           
            return access_token
        
        except Exception as e:
            print(f"Error getting token: {e}")
            return False

    @classmethod
    async def validate_open_ldap_auth(cls, username, password):
        """

        Args:
            username:
            password:

        Returns:

        """
        auth_url = urdhva_base.settings.openldap_auth_url
        access_token = cls.get_access_token()
        if not access_token:
            return False
        try:
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
            auth_data = {
                'user_id': username,
                'password': password
            }

            response = requests.post(
                auth_url,
                headers=headers,
                json=auth_data,
                timeout=30
            )
            response.raise_for_status()
            result = response.json()

            if isinstance(result, dict):
                if result.get('success') in ('true', True):
                    return True
            return False
        except Exception as e:
            print(f"Error checking authentication: {e}")
            return False
        

    @classmethod
    async def login(cls, username, password, login_type, jwt_auth=False):
        """
        Authenticates a user based on their username and password(LDAP or Local Authentication)

        Args:
            username (str): The username of the user.
            password (str): The password of the user.
            login_type (str): Login Type Employee / Dealer

        Returns:
            bool: True if authentication is successful, False otherwise.
        """

        # Checking whether user exists in ceg local database or not, If not return Invalid else proceed further
        user_data = await hpcl_ceg_model.Users.get_aggr_data(f"select * from users where "
                                                             f"lower(username)='{username.lower()}'", skip_total=True)
        if not user_data["data"]:
            await cls.update_login_failure_attempts(username)
            return False, "Invalid Login Credentials", {}
        user_info = user_data['data'][0]
        # If lock enabled, then sending user locked out status. This one moved here as per VAPT
        if await cls.verify_locked_check(f'{username.lower()}'):
            print(f"User {username} locked out")
            return False, "User locked out", {}
        
        # Is Active User
        if not user_info.get('status'):
            print(f"User {username} status not set")
            return False, "User was disabled, Please contact administrator", {}

        # If ldap authentication enabled allow user to validate with LDAP, else check local login
        if user_info.get('is_ad_user'):  # urdhva_base.settings.ldap_auth_enabled:
            if login_type == 'dealer':
                # Validating user in with Open LDAP.
                try:
                    status = await cls.validate_open_ldap_auth(username, password)
                except Exception as e:
                    print(f"Exception while validating ldap auth for user {username}")
                    status = False
                if not status:
                    await cls.update_login_failure_attempts(username)
                    return False, "Invalid Login Credentials", {}
            else:
                # Validating user in with LDAP.
                try:
                    status = await cls.validate_ldap_auth(username, password)
                except Exception as e:
                    print(f"Exception while validating ldap auth for user {username}")
                    status = False
                if not status:
                    await cls.update_login_failure_attempts(username)
                    return False, "Invalid Login Credentials", {}
        else:
            # If provided password not equals to db password, skip authentication
            if urdhva_base.types.Secret(user_info["password"]).get_secret() != password:
                await cls.update_login_failure_attempts(username)
                return False, "Invalid Login Credentials", {}
        return await cls.generate_auth_info(user_info, jwt_auth=jwt_auth)

    @classmethod
    async def generate_auth_info(cls, user_info, jwt_auth=False):

        role_names = ", ".join(f"'{val}'" for val in user_info['novex_role'])
        role = await hpcl_ceg_model.Roles.get_aggr_data(f"select * from roles where name in ({role_names})")
        if not role['data']:
            print("-- Roles not found in database --")
            return False, "Access Restricted", {}

        def unique_dicts(dict_list):
            seen = set()
            unique = []
            for d in dict_list:
                # Convert dict to a tuple of sorted items so it's hashable
                # items_tuple = tuple(sorted(d.items()))
                items_tuple = make_hashable(d)
                if items_tuple not in seen:
                    seen.add(items_tuple)
                    unique.append(d)
            return unique

        def make_hashable(value):
            if isinstance(value, dict):
                return tuple(sorted((k, make_hashable(v)) for k, v in value.items()))
            elif isinstance(value, (list, set, tuple)):
                return tuple(make_hashable(v) for v in value)
            else:
                return value


        if role["data"]:
            allowed_roles = {}
            for role_data in role["data"]:
                for menu in role_data['allowed_pages']:
                    if menu['menu_name'] not in allowed_roles:
                        allowed_roles[menu['menu_name']] = menu
                    else:
                        allowed_roles[menu['menu_name']]["allowed_sub_menus"].extend(menu['allowed_sub_menus'])
                        allowed_roles[menu['menu_name']]["allowed_sub_menus"] = (
                            unique_dicts(allowed_roles[menu['menu_name']]["allowed_sub_menus"]))

            user_info["allowed_roles"] = list(allowed_roles.values())
        # Adding session data
        if jwt_auth:
            return True, await cls.create_internal_jwt(user_data=user_info), {}
        return True, await cls.generate_cookie(user_info), user_info

    @classmethod
    async def verify_locked_check(cls, username):
        redis_ins = await urdhva_base.redispool.get_redis_connection()
        failed_count = 0
        if await redis_ins.exists(f"login_failure_{username.lower()}"):
            failed_count = int(await redis_ins.get(f"login_failure_{username.lower()}"))
        if failed_count > urdhva_base.settings.max_password_retires:
            return True
        return False

    @classmethod
    async def update_login_failure_attempts(cls, username):
        redis_ins = await urdhva_base.redispool.get_redis_connection()
        failed_count = 0
        if await redis_ins.exists(f"login_failure_{username.lower()}"):
            failed_count = int(await redis_ins.get(f"login_failure_{username.lower()}"))
        await redis_ins.setex(f"login_failure_{username.lower()}", urdhva_base.settings.lockout_time, failed_count+1)

    @classmethod
    async def generate_cookie(cls, cookie_data):
        cookie_id = str(uuid.uuid4())
        if "password" in cookie_data:
            del cookie_data["password"]
        redis_client = await urdhva_base.redispool.get_redis_connection()
        rkey = f"Novex_SessionData_{cookie_id}"
        f = Fernet(urdhva_base.settings.fernet_key)
        d = {"entity_id": "Novex", "cookie_id": cookie_id}
        cookie_key = f.encrypt(json.dumps(d).encode()).decode()
        time = 24 * 60 * 60
        await redis_client.setex(rkey, time,
                                 base64.urlsafe_b64encode(json.dumps(cookie_data, default=str).encode()).decode())
        return cookie_key

    @classmethod
    async def logout(cls, request: fastapi.Request):
        response = fastapi.responses.JSONResponse({'url': f"{request.base_url}/login"}, 401)
        cookie_id = request.cookies.get(urdhva_base.settings.cookie_name, None)
        if cookie_id:
            try:
                f = Fernet(urdhva_base.settings.fernet_key)
                d = json.loads(f.decrypt(cookie_id.encode()).decode())
                cookie_id = d["cookie_id"]
            except:
                ...
            redis_client = await urdhva_base.redispool.get_redis_connection()
            rkey = f"Novex_SessionData_{cookie_id}"
            await redis_client.delete(rkey)
        response.delete_cookie(urdhva_base.settings.cookie_name)
        # todo:- Need to clear dashboard sessions
        return response

    @classmethod
    async def create_user(cls, username, password, role, first_name, last_name, employee_id, status=True):
        """
        Creates a new user with the specified username, password, and status.

        Args:
            username (str): The username for the new user.
            password (str): The password for the new user.
            role (list): Role attached for user
            first_name (str): First name of the user
            last_name (str): Last name of the user
            employee_id (str): Employee ID of the user
            status (bool): The active status of the user (default is True).

        Returns:
            None
        """
        data = await hpcl_ceg_model.Users.get_aggr_data(f"select username from users where "
                                                  f"lower(username)='{username.lower()}'", skip_total=True)
        if data["data"]:
            for user in data["data"]:
                if user["username"].lower() == username.lower():
                    return False, "user exists"
        await hpcl_ceg_model.UsersCreate(**{"username": username.lower(), "password": password, "role": role,
                                      "first_name": first_name, "last_name": last_name, "employee_id": employee_id,
                                      "status": True}).create()
        return True, "User created successfully"

    @classmethod
    async def update_user_role(cls, username, role):
        """
        Updates the role assigned to a specific user.

        Args:
            username (str): The username of the user whose role is being updated.
            role (str): The new role to assign to the user.

        Returns:
            None
        """
        ...

    @classmethod
    async def update_user_status(cls, username, status):
        """
        Updates the active status of a user.

        Args:
            username (str): The username of the user.
            status (bool): The new status (True for active, False for inactive).

        Returns:
            None
        """
        ...

    @classmethod
    async def fetch_users(cls, search_string, limit, skip):
        """
        Fetches a list of users based on a search query, with pagination support.

        Args:
            search_string (str): A string to filter users by (e.g., username or other criteria).
            limit (int): The maximum number of users to fetch in this query.
            skip (int): The number of users to skip (used for pagination).

        Returns:
            list: A list of user objects or dictionaries matching the search criteria.
        """
        ...

    @classmethod
    async def create_role(cls, name, allowed_pages, status=True):
        """
        Creates a new role with the specified permissions and status.

        Args:
            name (str): The name of the role.
            allowed_pages (list): A list of pages or actions the role has access to.
            status (bool): The active status of the role (default is True).

        Returns:
            None
        """
        ...

    @classmethod
    async def update_role_status(cls, name, status):
        """
        Updates the active status of a role.

        Args:
            name (str): The name of the role.
            status (bool): The new status (True for active, False for inactive).

        Returns:
            None
        """
        ...

    @classmethod
    async def get_all_role_pages(cls):
        """
        Retrieves all roles and their associated allowed pages.

        Returns:
            dict: A dictionary mapping roles to their allowed pages.
        """
        ...
