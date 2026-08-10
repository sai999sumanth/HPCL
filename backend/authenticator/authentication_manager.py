import urdhva_base
import os
import json
import glob
import typing
import argparse
import pydantic
import traceback
import urllib.parse
import urdhva_base.redispool
from urllib.parse import urlparse
import utilities.helpers as helpers
# from keycloak import (KeycloakAdmin,
#                       urls_patterns,
#                       exceptions,
#                       KeycloakOpenIDConnection)


class RolesParams(pydantic.BaseModel):
    role_name: str


class AuthenticationManager:
    def __init__(self, realm_name="master"):
        self.realm_name = realm_name.lower()
        self.username = ""
        self.password = ""
        self.admin_conn = None
        self.realm_client_id = None
        self.generate_admin_connection()

    def get_keycloak_url(self, internal_uri=True):
        extension = urdhva_base.settings.keycloak_auth_default
        if self.realm_name and self.realm_name != "master":
            redis_ins = urdhva_base.redispool.get_synchronous_redis_connection()
            if redis_ins.hexists("customer_authentication_mapping", self.realm_name):
                extension = redis_ins.hget("customer_authentication_mapping", self.realm_name)
        base_uri = urdhva_base.settings.keycloak_internal_url.__str__() if internal_uri else (
            urdhva_base.settings.keycloak_external_url.__str__())
        resp = urllib.parse.urljoin(base_uri, extension)
        if not resp[-1] == "/":
            resp += "/"
        return resp

    def generate_admin_connection(self):
        if self.admin_conn:
            return self.admin_conn
        keycloak_connection = KeycloakOpenIDConnection(
            server_url=self.get_keycloak_url(),
            username=urdhva_base.settings.keycloak_admin,
            password=urdhva_base.settings.keycloak_password,
            realm_name="master" if not self.realm_name else self.realm_name,
            user_realm_name="master",
            verify=False)
        self.admin_conn = KeycloakAdmin(connection=keycloak_connection)
        return self.admin_conn

    def configure_realm(self, realm_name, first_name, last_name, email_id, base_uri, skip_on_exist=True, password=None):
        """
        @description: Creating new realm and configuring client with auto email sending
        @param realm_name: Tenant Name in lower characters
        @param first_name: Tenant admin firstname
        @param last_name: Tenant admin lastname
        @param email_id: Tenant admin email id
        @param base_uri: Tenant Base Url (Ex:- test.algofusiontech.com)
        @param skip_on_exist: Skip creating realm if already exists
        @param password:
        @return:
        """
        realm_name = realm_name.lower()
        try:
            self.admin_conn.get_realm(realm_name)
            if skip_on_exist:
                return False, "Realm Exists"
            else:
                print(f"Realm {realm_name} exists")
        except:
            ...
        realm_payload = {
            "realm": realm_name,
            "notBefore": 0,
            "enabled": True,
            "sslRequired": "all",
            "bruteForceProtected": True,
            "failureFactor": 10,
            "eventsEnabled": False
        }
        creation_obj = self.admin_conn.create_realm(realm_payload, skip_exists=True)
        # Adding realm_name to base after realm creation and recreating admin connection for the newly configured realm
        self.realm_name = realm_name
        self.admin_conn = None
        self.admin_conn = self.generate_admin_connection()
        # Creating realm client
        self.create_realm_client(base_uri)
        # Configuring auth flow
        self.configure_realm_authentications()
        # Configuring realm with SMTP
        self.configure_realm_smtp()
        # Creating basic user roles
        self.configure_initial_client_roles(self.get_client_id())
        # Creating user
        user_data = {'username': email_id, "email": email_id, "firstName": first_name, "lastName": last_name,
                     'enabled': True, "attributes": {"organizations_permitted": "", "organizations_prohibited": "",
                                                     "credentials_permitted": "", "credentials_prohibited": ""},
                     "requiredActions": ["CONFIGURE_TOTP", "terms_and_conditions",
                                         "TERMS_AND_CONDITIONS", "UPDATE_PASSWORD"]}
        if not password:
            password = helpers.password_generator()
        status, resp = self.create_user(user_data, role_name='admin', password=password, send_email=False)
        if status:
            print(f"User Created Successfully\nEmail:- {email_id}, Password:- {password}, Url:- {base_uri}")

    def configure_initial_client_roles(self, client_id):
        """
        @description:
        @param client_id:
        @return:
        """
        base_roles = [{"name": "superAdmin", "description": "Super Admin Privileges"},
                      {"name": "admin", "description": "Administrative Privileges"},
                      {"name": "readOnly", "description": "Read Only Privileges"}]
        role_ids = {}
        for role in base_roles:
            print(self.admin_conn.create_realm_role({**role, "attributes": {}}, skip_exists=True))
            role_ids[role["name"]] = self.admin_conn.get_realm_role(role_name=role['name'])["id"]

        # Configuring role policies
        for role_name, role_id in role_ids.items():
            payload = {"roles": [{"id": role_id}], "type": "role", "logic": "POSITIVE", "decisionStrategy": "UNANIMOUS",
                       "name": f"{role_name}Policy"}
            params_path = {"realm-name": self.realm_name, "id": client_id, "policy-id": "role"}
            # Todo:- need to validate output
            data_raw = self.admin_conn.connection.raw_post(
                urls_patterns.URL_ADMIN_CLIENT_AUTHZ_POLICY.format(**params_path),
                data=json.dumps(payload),
            )
            print(data_raw)
        self.configure_client_role()

    def configure_realm_authentications(self):
        """
        @description: Configuring default parameters required for user authentication
        @return: None
        """
        required_actions = [
            {"alias": "CONFIGURE_TOTP", "name": "Configure OTP", "enabled": True, "defaultAction": False,
             "priority": 10, "config": {}},
            {"alias": "terms_and_conditions", "name": "Terms and Conditions", "enabled": True,
             "defaultAction": True,
             "priority": 20, "config": {}},
            {"alias": "TERMS_AND_CONDITIONS", "name": "Terms and Conditions", "enabled": True,
             "defaultAction": True,
             "priority": 20, "config": {}},
            {"alias": "UPDATE_PASSWORD", "name": "Update Password", "enabled": True,
             "defaultAction": True,
             "priority": 30, "config": {}},
            {"alias": "UPDATE_PROFILE", "name": "Update Profile", "enabled": True,
             "defaultAction": False,
             "priority": 40, "config": {}},
            {"alias": "VERIFY_EMAIL", "name": "Verify Email", "enabled": True, "defaultAction": False,
             "priority": 50,
             "config": {}}]
        for record in required_actions:
            try:
                self.admin_conn.update_required_action(record["alias"], record)
            except Exception as e:
                print(f'Exception {e} while adding {record["alias"]}')

    def configure_realm_smtp(self):
        """
        @description: Configuring SMTP connection for realm
        @return:
        """
        smtp_user = ''
        smtp_password = ''
        resp = self.admin_conn.get_realm(self.realm_name)
        resp.update({"rememberMe": True, "resetPasswordAllowed": True,
                     "smtpServer": {'password': smtp_password,
                                    'replyToDisplayName': 'support@algofusiontech.com',
                                    'starttls': True, 'auth': 'true',
                                    'port': 587,
                                    'host': 'email-smtp.ap-south-1.amazonaws.com',
                                    'from': 'venu@algofusiontech.com',
                                    'ssl': False, 'user': smtp_user,
                                    'displayName': 'AlgoFusion Technologies SMTP Settings'}})
        self.admin_conn.update_realm(self.realm_name, resp)

    def get_client_name(self):
        return f'{self.realm_name}_client'

    def get_client_id(self):
        """
        @description: Get unique id of the configured client
        @return: uuid of the client
        """
        if self.realm_client_id:
            return self.realm_client_id
        client_id = self.admin_conn.get_client_id(self.get_client_name())
        if client_id:
            self.realm_client_id = client_id
        return self.realm_client_id

    def create_realm_client(self, base_uri):
        """
        @description: Creating realm client[Along with create client we also generate client secrets, update
                      client details and add mappers to the client  ]
        @param base_uri: base uri of the portal
        @return:
        """
        url_parse = urlparse(base_uri)
        if not url_parse.scheme:
            schema = 'https' if not url_parse.scheme else url_parse.scheme
            base_uri = f"{schema}://{url_parse.path}"
        client_name = self.get_client_name()
        client_data = {'clientId': client_name, 'publicClient': False,
                       'redirectUris': [f"{base_uri}/api/{self.realm_name}/login", f"{base_uri}/api/login",
                                        f"{base_uri}/"]}
        # Creating new client if not exists
        self.realm_client_id = self.admin_conn.create_client(client_data, skip_exists=True)

        # Configuring client secrets which was required for client authorization
        self.admin_conn.generate_client_secrets(self.realm_client_id)

        client_data = self.admin_conn.get_client(self.realm_client_id)
        client_data.update({"name": "UrdhvaPay", "serviceAccountsEnabled": True, "authorizationServicesEnabled": True})
        client_data["attributes"]['post.logout.redirect.uris'] = urllib.parse.urljoin(base_uri, "/")
        self.admin_conn.update_client(self.realm_client_id, client_data)
        existing_mappers = {rec['name']: rec for rec in self.admin_conn.get_mappers_from_client(self.realm_client_id)}
        client_attribute_map = [{"name": "organizations_permitted", "protocol": "openid-connect",
                                 "protocolMapper": "oidc-usermodel-attribute-mapper",
                                 "config": {"access.token.claim": "true", "aggregate.attrs": "",
                                            "claim.name": "organizations_permitted", "id.token.claim": "true",
                                            "jsonType.label": "String", "multivalued": "",
                                            "user.attribute": "organizations_permitted", "userinfo.token.claim": "true"}},
                                {"name": "organizations_prohibited", "protocol": "openid-connect",
                                 "protocolMapper": "oidc-usermodel-attribute-mapper",
                                 "config": {"access.token.claim": "true", "aggregate.attrs": "",
                                            "claim.name": "organizations_prohibited", "id.token.claim": "true",
                                            "jsonType.label": "String", "multivalued": "",
                                            "user.attribute": "organizations_prohibited", "userinfo.token.claim": "true"}},
                                {"name": "credentials_permitted", "protocol": "openid-connect",
                                 "protocolMapper": "oidc-usermodel-attribute-mapper",
                                 "config": {"access.token.claim": "true", "aggregate.attrs": "",
                                            "claim.name": "credentials_permitted", "id.token.claim": "true",
                                            "jsonType.label": "String", "multivalued": "",
                                            "user.attribute": "credentials_permitted",
                                            "userinfo.token.claim": "true"}},
                                {"name": "credentials_prohibited", "protocol": "openid-connect",
                                 "protocolMapper": "oidc-usermodel-attribute-mapper",
                                 "config": {"access.token.claim": "true", "aggregate.attrs": "",
                                            "claim.name": "credentials_prohibited", "id.token.claim": "true",
                                            "jsonType.label": "String", "multivalued": "",
                                            "user.attribute": "credentials_prohibited",
                                            "userinfo.token.claim": "true"}}
                                ]
        for payload in client_attribute_map:
            if payload["name"] not in existing_mappers:
                self.admin_conn.add_mapper_to_client(self.realm_client_id, payload)
            else:
                try:
                    self.admin_conn.update_client_mapper(self.realm_client_id,
                                                         existing_mappers[payload['name']]['id'], payload)
                except Exception as e:
                    print(f"Exception while updating mapper {payload['name']} with id "
                          f"{existing_mappers[payload['name']]['id']} skipping {e}")

    def _cleanup_all_default_client_resources(self):
        """
        @description: This method will fetch all resources having name def and delete those,
        This was to avoid configuring default roles to users
        @return:
        """

        resources = self.admin_conn.get_client_authz_resources(self.get_client_name())
        for resource in resources:
            if resource["name"].startswith("default"):
                self.admin_conn.delete_client_authz_resource(self.get_client_name(), resource["id"])

        policies = self.admin_conn.get_client_authz_policies(self.get_client_name())
        for policy in policies:
            if policy["name"].startswith("default"):
                self.admin_conn.delete_client_authz_policy(self.get_client_name(), policy["id"])

    @classmethod
    def fetch_roles_data(cls):
        """
        @description: Fetching all roles from roles.json files in provided folders
        :return: list of roles
        """
        roles_data = []
        folders = urdhva_base.settings.roles_directories
        for folder in folders:
            for file in glob.glob(os.path.join(folder, "*_roles.json")):
                with open(file) as f:
                    roles_data.append(json.load(f))
        return roles_data

    def configure_client_role(self):
        """
        @description: Configures client role by reading details from roles mapping json files
        :return:
        """
        roles = {}
        for data in self.fetch_roles_data():
            for key, value in data.items():
                if key not in ["resources", "policies", "scopes"]:
                    roles[key] = value
                else:
                    if key not in roles:
                        roles[key] = []
                    for record in value:
                        if record not in roles[key]:
                            roles[key].append(record)
        params_path = {
            "realm-name": self.realm_name,
            "id": self.realm_client_id,
            "resource-id": "import",
        }
        data_raw = self.admin_conn.connection.raw_post(
            (urls_patterns.URL_ADMIN_CLIENT_AUTHZ + "/{resource-id}").format(**params_path),
            data=json.dumps(roles)
        )
        exceptions.raise_error_from_response(data_raw, exceptions.KeycloakPostError, expected_codes=[201, 200, 204])

    def list_users(self, query=None, limit=100, skip=0):
        """
        @description: for getting list of users from keycloak
        @param query: dictionary having query params
        @param limit: max users
        @param skip: no of elements to skip
        @return:
        """
        query_params = dict(max=limit, first=skip * limit)
        if query:
            if query.get("search"):
                query_params["search"] = query["search"]
            elif query:
                query_params["q"] = " ".join([f"{key}:{value}" for key, value in query.items()])
        users = self.admin_conn.get_users(query_params)
        # Todo:- fetch role of each user and update
        return users

    def create_user(self, data: typing.Dict, role_name: str, password: typing.Optional[str]="",
                    send_email: typing.Optional[bool]=False):
        """
        everytime of creation username must be unique
        @description:creates a user in the realm
        @param data: dictionary having the query parameters like realm name
        :param send_email: Whether to send email post user creation or not
        :param password: Password of the user account, This was an optional field
        @return: UserRepresentation
        f7411cf4-38de-40f3-a372-3d41ec78f4d6(id of user created)

        """
        try:
            data["requiredActions"] = ["CONFIGURE_TOTP", "terms_and_conditions", "TERMS_AND_CONDITIONS",
                                       "UPDATE_PASSWORD"]
            data['firstName'] = data['firstName']
            data['lastName'] = data['lastName']
            data["attributes"] = {}
            data['username'] = data['email']
            if data.get('user_acls'):
                for key, value in data.get('user_acls', {}).items():
                    data["attributes"][key] = [value]
            for key in ['first_name', 'last_name', 'user_acls']:
                if key in data:
                    del data[key]
            resp = self.admin_conn.create_user(data, exist_ok=True)
            if not password:
                password = helpers.password_generator()
            self.admin_conn.set_user_password(resp, password)
            self.assign_role_user(resp, role_name)
            if send_email:
                print("Sending Email")
                # send password email...
            return True, f"User created successfully in realm"
        except Exception as e:
            print(f"Exception in user creation for realm {self.admin_conn.realm_name}, {traceback.format_exc()}")
            return False, "Failed to create user in the realm  '{}' :{}".format(self.admin_conn.realm_name, str(e))

    def assign_role_user(self, user_id, role_name):
        """
        @description: Assigning given role to the user, Validating whether given role was correct or not.
        :param user_id: ID of the given user
        :param role_name: ame of the role
        :return: status(bool), msg(string)
        """
        available_roles = self.admin_conn.get_available_realm_roles_of_user(user_id)
        roles = [rec for rec in available_roles if rec['name'].lower() == role_name.lower()]
        if len(roles) == 0:
            return False, "Invalid role"
        assigned_roles = self.admin_conn.get_realm_roles_of_user(user_id)
        if len(assigned_roles) > 0:
            self.admin_conn.delete_realm_roles_of_user(user_id, assigned_roles)
        self.admin_conn.assign_realm_roles(user_id, roles)
        return True, "Role(s) Assigned Successfully"

    def get_user(self, email_id):
        """
        @description: Get user details for the given  email
        :param email_id: string
        :return: UserRepresentation
        """
        user_id = self.admin_conn.get_user_id(email_id)
        return self.admin_conn.get_user(user_id)

    def list_roles(self, search_text=""):
        """
        @description: this is for getting the list of roles present in that specific realm
        @param search_text:
        @return:returns the list of roles present in that realm, and each role contains various attributes like name, id,
                scope etc. By default we are returning role names
        """

        # if not search_text:
        #     return 'realm details not provided'
        roles = self.admin_conn.get_realm_roles(brief_representation=False, search_text=search_text)
        skip_roles = ['offline_access', 'uma_authorization', f'default-roles-{self.realm_name.lower()}']
        role_details = [{'name': role['name'], 'description': role['description']}
                        for role in roles if role['name'].lower() not in skip_roles and "default-" not in role['name'].lower()]
        return role_details

    def get_role_info(self, role_name=""):
        if not role_name or role_name.lower() in ["superadmin", "base"]:
            role_name = "all"
        params_path = {
            "realm-name": self.realm_name,
            "id": self.get_client_id(),
            "role": role_name
        }
        data_raw = self.admin_conn.connection.raw_get(
            (urls_patterns.URL_ADMIN_CLIENT_AUTHZ + "/resource?deep=true&type={role}&max=1000").format(**params_path),
        )
        return exceptions.raise_error_from_response(data_raw, exceptions.KeycloakPostError, expected_codes=[201, 200, 204])

    def create_role(self, data: typing.Dict):
        """
        @description: this will create a role in that realm based on our requirements
        @return: return a message based on the role creation
        it returns the name of the role that is created(eg : test_role)
        """

        role_name = data['name']
        role_description = data['description']
        configuration = {key: value for key, value in data['configuration'].items() if value}
        # we can add more attributes tp role creation based on our requirement
        try:
            s = self.admin_conn.create_realm_role({'name': role_name, 'description': role_description},
                                                  skip_exists=True)
            print(s)
            # Todo:- Configure , Policies and Permissions
            for name, scopes in configuration.items():
                params = dict(
                    name=f"{name}_{role_name}", type=role_name, ownerManagedAccess="", uris=[],
                    displayName=f"{name} {role_description if role_description else role_name}", scopes=scopes
                )
            return 'Role created successfully'
        except Exception as e:
            print("Error:", e)
            print("Failed to create role in realm :", self.realm_name)
            return "An error occurred '{}'".format(str(e))

    def update_role(self, data):
        """
        @description : Update a role for the realm by name.
        @return : name of the role that is updated/ error responde from keycloak
        """

        try:

            s = self.admin_conn.update_realm_role(data['name'], data)
            if not s:
                print("User %s updated successfully" % data['name'])
                return True, "User %s updated successfully" % data['name']
            else:
                print(s)
                return False, s
        except Exception as e:
            print(e)
            return False, str(s)

    def update_user(self, data, role_name=""):
        """
        @description : Update user for the realm by name.
        @params: data -> contains the dict with the parameters that are to be updated for that user
        @:params: role_name
        @return : status(bool), message(str)
        """
        try:
            user_id = self.admin_conn.get_user_id(data['username'])
            print('user id is %s' % user_id)

            s = self.admin_conn.update_user(user_id, data)
            print(s)

            if s:
                self.assign_role_user(user_id, role_name)
                print("User %s updated successfully" % data['username'])
                return True, "User %s updated successfully" % data['username']

            else:
                print(s)
                return False, str(s)
        except Exception as e:
            print(e)
        return True, "Successfully updated user"

    def disable_user(self, data):
        status = self.admin_conn.disable_user(data['userId'])
        if status:
            return True, "User %s disabled successfully" % data['userId']
        else:
            return False, str(data)

    def enable_user(self, data):
        status = self.admin_conn.enable_user(data['userId'])
        if status:
            return True, "User %s enabled successfully" % data['userId']
        else:
            return False, str(data)

    def list_role_resources(self, role_type: str):
        """

        @param role_type: name of the role from where resources should be listed
        Ex:- all(all available resources), admin for admin role,
        @return:
        """
        params_path = {"realm-name": self.admin_conn.realm_name, "id": self.get_client_id()}
        data_raw = self.admin_conn.raw_get(
            urls_patterns.URL_ADMIN_CLIENT_AUTHZ_RESOURCES.format(**params_path) + f"&type={role_type}"
        )
        try:
            resp = exceptions.raise_error_from_response(data_raw, exceptions.KeycloakGetError)
            return True, resp
        except Exception as e:
            print(f"Error in getting data from authentication module {e}")
            return False, "Error in getting data from authentication module"


def tenant_onboard(parsed_args):
    print(parsed_args)
    if not parsed_args.get("entity"):
        parsed_args["entity"] = parsed_args["email"].split("@")[-1].split(".")[0]
    resp = AuthenticationManager().configure_realm(parsed_args["entity"], parsed_args['first_name'],
                                                   parsed_args['last_name'], parsed_args['email'],
                                                   "<Base URL>", skip_on_exist=True,
                                                   password=parsed_args['password'])
    print(resp)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='KeyCloak')
    parser.add_argument('-o', '--entity', help='Entity Name / Customer Name', required=False)
    parser.add_argument('-f', '--first_name', help='FirstName', required=True)
    parser.add_argument('-l', '--last_name', help='Last Name', required=True)
    parser.add_argument('-e', '--email', help='Email Address', required=True)
    parser.add_argument('-p', '--password', help='Password', required=False)
    parsed_args = vars(parser.parse_args())
    tenant_onboard(parsed_args)
