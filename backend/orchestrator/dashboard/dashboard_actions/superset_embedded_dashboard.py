import urdhva_base
import json
import httpx
import requests
import orchestrator.dbconnector.connector_factory as connector_factory


class SupersetManager:
    def __init__(self):
        self.base_url = urdhva_base.settings.superset_internal_url
        self.login_data = {
            "username": urdhva_base.settings.superset_user,
            "password": urdhva_base.settings.superset_password,
            "provider": "db",
            "refresh": True
        }
        self.base_headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        self.dashboard_mapping = {"LPG Plant Analysis": {"id": "5", "embed_id": "4227fef3-7e5a-4f74-bcd8-4817f3785aae",
                                                         "desc": "LPG Plant Analysis"},
                                  "Sales Growth": {"id": "8", "embed_id": "ac4ebd92-b5fa-4648-bb69-d5bc50694abe",
                                                   "desc": "Sales Growth"},
                                  "Dry Out Indents": {"id": "14", "embed_id": "9db8255f-7e33-4cf0-b4b5-d553bf2ca830",
                                                      "desc": "Dry Out Indents"},
                                  "Mission 60": {"id": "13", "embed_id": "707d935a-5543-424e-a2bf-c7d0e4d15f2e",
                                                 "desc": "Mission 60"},
                                  "LPG Sales": {"id": "7", "embed_id": "fcdc94b8-fea7-46f7-9b00-171074c93540",
                                                "desc": "LPG Sales"}}

    async def get_access_token(self):
        login_url = f"{self.base_url}/api/v1/security/login"
        try:
            response = requests.post(login_url, headers=self.base_headers, json=self.login_data)
        except Exception as e:
            print(f"Exception while authenticating with dashboard component {e}")
            return False, "Service not available, Please contact the administrator"
        if response.status_code / 100 != 2:
            print(f"Error loging to dashboard url with status code {response.status_code} and message {response.text}")
            return False, f"Error while communicating with dashboard component {response.status_code}"
        return True, response.json().get("access_token")

    async def get_dashboard_url(self, dashboard_name):
        ...

    async def get_embedded_dashboard_uri(self, dashboard_id):
        dashboard_id_mapping = {
            "15": "8805091f-04cc-42f2-8713-5871155d240f",
            "33": "2c634125-dd20-452b-a9c0-1b6dbe31ae33",
            "34": "5d1f7dd3-9458-47cf-b972-fc378a04ed58",
            "38": "6b455419-a4e7-491c-be57-57aae4bdb061",  # Volume Recommendations
            "39": "763fc438-36a9-43cf-9113-da93b7485463",  # Instance Recommendations
            "46": "6a0c6dbc-55b5-4054-94e6-7c29aae13dc6",  # New Executive Dashboard
            "48": "d58c5a28-2a86-4199-9dce-4e15d2fffebe",
            "49": "111b88bb-9a50-402f-a1f8-ee2c51f415bb",
        }

        base_url = urdhva_base.settings.superset_internal_url
        login_url = f"{base_url}/api/v1/security/login"
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        login_data = {
            "username": urdhva_base.settings.superset_user,
            "password": urdhva_base.settings.superset_password,
            "provider": "db",
            "refresh": True
        }
        try:
            response = requests.post(login_url, headers=headers, json=login_data)
        except Exception as e:
            print(f"Exception while authenticating with dashboard component {e}")
            return False, "Service not available, Please contact the administrator"
        if response.status_code / 100 != 2:
            print(f"Error loging to dashboard url with status code {response.status_code} and message {response.text}")
            return False, f"Error while communicating with dashboard component {response.status_code}"
        access_token = response.json().get("access_token")
        token_url = f"{base_url}/api/v1/security/guest_token/"
        rls = []
        if urdhva_base.context.context.exists():
            rpt = urdhva_base.context.context.get('rpt', {})
        else:
            rpt = {}
        payload = {
            "resources": [
                {
                    "id": dashboard_id,
                    "type": "dashboard"
                }
            ],
            "rls": rls,
            "user": {
                "first_name": rpt.get("given_name", "dash_user"),
                "last_name": rpt.get("family_name", "dash_user"),
                "username": rpt.get('email', 'dash_user')
            }
        }
        try:
            headers = {"Accept": "application/json", "Authorization": f"Bearer {access_token}",
                       "Content-Type": "application/json"}
            response = requests.post(token_url, json=payload, headers=headers)
        except Exception as e:
            print(f"Exception in getting dashboard access {e}")
            return False, "Error in getting dashboard access, Please contact the administrator"
        if response.status_code / 100 != 2:
            print(
                f"Error getting dashboard guest token with status code {response.status_code} and message {response.text}")
            return False, f"Error while communicating with dashboard component {response.status_code}"
        auth_token = response.json()['token']
        dashboard_id = dashboard_id_mapping.get(f"{dashboard_id}", f"{dashboard_id}")

        return True, {
            "id": f"{dashboard_id}",
            "url": urdhva_base.settings.superset_external_url,
            "token": auth_token
        }

    # async def get_embedded_dashboard_uri(self, dashboard_name, filters):
    #     conditions = connector_factory.DBConnectorFactory().generate_filter_clause(filters)
    #     rls = [
    #     ]
    #     if conditions:
    #         rls.append({
    #             "clause": conditions
    #         })
    #     status, access_token = self.get_access_token()
    #     try:
    #         headers = {"Accept": "application/json", "Authorization": f"Bearer {access_token}",
    #                    "Content-Type": "application/json"}
    #         payload = {
    #             "resources": [
    #                 {
    #                     "id": self.dashboard_mapping[dashboard_name]['embed_id'],
    #                     "type": "dashboard"
    #                 }
    #             ],
    #             "rls": rls,
    #             "user": {
    #                 "first_name": rpt.get("given_name", "dash_user"),
    #                 "last_name": rpt.get("family_name", "dash_user"),
    #                 "username": rpt.get('email', 'dash_user')
    #             }
    #         }
    #         response = requests.post(token_url, json=payload, headers=headers)
    #     except Exception as e:
    #         print(f"Exception in getting dashboard access {e}")
    #         return False, "Error in getting dashboard access, Please contact the administrator"
    #     if response.status_code / 100 != 2:
    #         print(
    #             f"Error getting dashboard guest token with status code {response.status_code} and message {response.text}")
    #         return False, f"Error while communicating with dashboard component {response.status_code}"


