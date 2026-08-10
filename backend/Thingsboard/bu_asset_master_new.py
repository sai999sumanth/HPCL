import urdhva_base
import os
import json
import sys
sys.path.append("/opt/ceg/algo/api_manager")
import requests
import pandas as pd


def load_bu_asset_master(file_path, bu, location_id, location_name, force_delete=False):
    """
    Load and process asset data from all sheets of an Excel file.

    Args:
        file_path: Path to the Excel file
        bu: Type of BU
        location_id: SAP ID of the location
        location_name: Name of the location
        force_delete: Placeholder for future functionality (default: False)

    Returns:
        Dictionary containing processed device data and metadata
    """
    try:
        # Read all sheets
        sheets = pd.read_excel(file_path, engine="openpyxl", sheet_name=None)
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        return {}

    if not sheets:
        print("The Excel file is empty. No data to process.")
        return {}

    devices_data = []

    for sheet_name, df in sheets.items():
        device_type = sheet_name.replace(" Master", "").strip() 
        print(f"\nProcessing sheet: {sheet_name} (Device Type: {device_type})")

        # Find indices of columns containing "Normal Value"
        normal_value_indices = [i for i, col in enumerate(df.columns)
                                if 'normal value' in str(col).lower()]

        # Process each normal value column to find associated sensor_id and sensor_type
        sensor_columns = []
        for nv_idx in normal_value_indices:
            if nv_idx > 0:  # Ensure there's a preceding column for sensor tag
                sensor_tag_idx = nv_idx - 1
                sensor_id_idx = nv_idx + 1 if (nv_idx + 1) < len(df.columns) else None
                sensor_type_idx = nv_idx + 2 if (nv_idx + 2) < len(df.columns) else None

                # Check if sensor_id column exists and has correct name
                valid_sensor_id = False
                if sensor_id_idx is not None:
                    col_name = str(df.columns[sensor_id_idx]).lower()
                    valid_sensor_id = 'sensor_id' in col_name
                
                # Check if sensor_type column exists and has correct name
                valid_sensor_type = False
                if sensor_type_idx is not None:
                    col_name = str(df.columns[sensor_type_idx]).lower()
                    valid_sensor_type = 'sensor_type' in col_name

                # Append indices only if columns are correctly named
                sensor_id_idx_final = sensor_id_idx if valid_sensor_id else None
                sensor_type_idx_final = sensor_type_idx if valid_sensor_type else None
                sensor_columns.append((sensor_tag_idx, nv_idx, sensor_id_idx_final, sensor_type_idx_final))

        def normalize_value(value):
            def is_float(string):
                try:
                    float(string)
                    return True
                except ValueError:
                    return False
            if value.isnumeric():
                return str(int(value))
            elif is_float(value):
                if len(value.split(".")[-1]) == 1:
                    return str(int(float(value)))
            return str(value)

        # Process each row
        for _, row in df.iterrows():
            # Extract values safely
            values = [str(row.iloc[2]).strip(), str(row.iloc[1]).strip()]  # iloc[2] (location2), iloc[1] (location1)

            # Join non-empty values with '@'
            device_name = "@".join(filter(None, values))

            # Skip empty device names
            if not device_name or device_name.lower() == "nan":
                continue

            sensors = []
            for sensor_tag_idx, nv_idx, sensor_id_idx, sensor_type_idx in sensor_columns:
                sensor_name = str(df.columns[sensor_tag_idx]).strip()
                sensor_tag = str(row.iloc[sensor_tag_idx]).strip()
                normal_value = normalize_value(str(row.iloc[nv_idx]).strip())

                sensor_entry = {
                    "sensor_name": sensor_name,
                    "sensor_tag": sensor_tag if sensor_tag.lower() != 'nan' else "",
                    "normal_value": normal_value if normal_value.lower() != 'nan' else '0'
                }

                # Add sensor_id if column exists
                if sensor_id_idx is not None:
                    sensor_id = str(row.iloc[sensor_id_idx]).strip()
                    sensor_entry["sensor_id"] = sensor_id if sensor_id.lower() != 'nan' else ""

                # Add sensor_type if column exists
                if sensor_type_idx is not None:
                    sensor_type = str(row.iloc[sensor_type_idx]).strip()
                    sensor_entry["sensor_type"] = sensor_type if sensor_type.lower() != 'nan' else ""

                # Include sensor entry even if tag is empty (to capture normal values)
                sensors.append(sensor_entry)

            if sensors:
                devices_data.append({
                    "device_name": device_name,
                    "device_id": "",
                    "device_type": device_type,
                    "device_key": "",
                    "entity_id": "",
                    "sensors": sensors
                })

    return {"data": devices_data, "location_id": location_id, "bu": bu, "location_name": location_name}



class ThingsBoardInterface:
    def __init__(self):
        self._auth_token = None
        self.location = None
        self.bu_id = None
        # determine the environment
        environment = urdhva_base.settings.environment

        if environment == 'prod':
            self.data_path = "/opt/ceg/algo/prod/"
        elif environment == 'uat':
            self.data_path = "/opt/ceg/algo/uat/"
        else:
            self.data_path = "/opt/ceg/algo/things_board/device_data"

    @staticmethod
    def get_auth_token():
        """
        Authenticate and retrieve the auth token from ThingsBoard.

        :return: str, the authentication token.
        """
        url = f"{urdhva_base.settings.things_board_url}/api/auth/login"
        headers = {"Content-Type": "application/json"}
        payload = {
            "username": urdhva_base.settings.things_board_username,
            "password": urdhva_base.settings.things_board_password
        }


        try:
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            auth_token = response.json().get("token")
            return auth_token
        except requests.RequestException as e:
            print(f"Error authenticating: {e}")
            return None

    def api_handler(self, method, url, headers, payload):
        """
        Handles API requests to the ThingsBoard server with proper authorization.

        Args:
            method (str): HTTP method ('GET', 'POST', etc.).
            url (str): API endpoint to be called.
            headers (dict): Additional HTTP headers.
            payload (dict): Data to be sent with the request (query params or JSON body).

        Returns:
            dict or None: Parsed JSON response if successful; otherwise, None.
        """
        if not self._auth_token:
            self._auth_token = self.get_auth_token()

        if not headers:
            headers = {}
        headers.update({"Content-Type": "application/json", "X-Authorization": f"Bearer {self._auth_token}"})

        data = {"headers": headers}
        if method == "GET":
            data["params"] = payload
        else:
            data["json"] = payload

        response = requests.request(method, f"{urdhva_base.settings.things_board_url}{url}", **data)
        if response.status_code // 100 != 2:
            print(f"API {url}, status_code {response.status_code}, response {response.text}")
            print(f"{response.url}")
            return None

        return response.json() if response.text else {"status": "Success"}

    def get_bu(self, bu):
        """
        Retrieves or creates a business unit (BU) in ThingsBoard.

        Args:
            bu (str): The name of the business unit.

        Returns:
            str or None: ID of the business unit if found or created; otherwise, None.
        """
        resp = self.api_handler("GET", "/api/customers", {}, {'pageSize': 100, 'page': 0})
        if resp:
            for rec in resp['data']:
                if rec['title'].lower() == bu.lower():
                    self.bu_id = rec["id"]["id"]
                    return self.bu_id

        payload = {
            "additionalInfo": {
                "description": f"BU: {bu}",
                "homeDashboardHideToolbar": True,
                "homeDashboardId": None
            },
            "country": "India",
            "title": bu.upper()
        }
        response = self.api_handler("POST", "/api/customer", {}, payload)
        if response and response.get("id"):
            self.bu_id = response["id"]["id"]
            return self.bu_id

        return None

    def get_location(self, bu, location_name):
        """
        Retrieves or creates a location asset under a given business unit.

        Args:
            bu (str): The name of the business unit.
            location_name (str): The name of the location.

        Returns:
            tuple or dict: Tuple (True, asset details) if the location exists,
                           otherwise newly created location asset details.
        """
        bu_id = self.get_bu(bu)
        page_size = 100
        page = 0
        headers = {"Content-Type": "application/json", "X-Authorization": f"Bearer {self._auth_token}"}

        while True:
            response = self.api_handler("GET", "/api/tenant/assets", headers, {
                'pageSize': page_size, 'page': page, "type": "Location"
            })
            if response:
                for asset in response["data"]:
                    if asset["name"].lower() == location_name.lower():
                        return asset["id"]["id"]
                if not response.get("hasNext"):
                    break
            else:
                break
            page += 1

        additional_info = {
            "description": f"Asset for {bu}",
            "homeDashboardHideToolbar": True,
            "homeDashboardId": None
        }
        data = {
            "additionalInfo": additional_info,
            "customerId": {"id": bu_id, "entityType": "CUSTOMER"},
            "label": f"{bu.upper()}",
            "name": location_name,
            "type": "Location"
        }

        print(data)
        response = self.api_handler("POST", "/api/asset", {}, data)

        self.api_handler("POST", f"/api/plugins/telemetry/ASSET/{response['id']['id']}/SERVER_SCOPE", {},
                         additional_info)
        self.location = response
        return response['id']['id']

    def create_device(self, bu, location_id, location_name, device_name, device_type="", device=""):
        """
        Creates or updates a device in ThingsBoard under a specified business unit (BU) and location.

        Parameters:
            bu (str): The business unit name to associate with the device.
            location_id (str): The unique identifier for the location where the device belongs.
            location_name (str): The name of the location where the device belongs.
            device_name (str): The name of the device to create or update.
            device_type (str): The type of the device to create or update.

        Returns:
            str: The ID of the created or updated device.
            None: If device creation or association fails.
        """
        #device_name_with_location = f"{device_name}"  
        bu_id = self.get_bu(bu)
        print(f"Creating device for {device_name}")

        device_scope = {
            "location_id": f"{location_id}",
            "location_name": location_name,
            "plantlocationid": f"{location_id}",
            "plantlocation": location_name,
            "bu_id": f"{bu_id}",
            "SAPID": f"{location_id}",
            "BU": bu,
            device_name: 1
        }

        if "sensors" in device:
            for sensor in device['sensors']:
                sensor_name = sensor.get('sensor_name')
                normal_value = sensor.get('normal_value', '0')
                sensor_id = sensor.get('sensor_id')
                sensor_type = sensor.get('sensor_type')
                device_scope[sensor_name] = normal_value

        device_data = self.api_handler("GET", "/api/tenant/deviceInfos", {},
                                       {"textSearch": device_name, "pageSize": 100, "page": 0,
                                        "sortProperty": "createdTime", "sortOrder": "DESC"})

        if device_data and device_data.get("data"):
            for record in device_data["data"]:
                if record["name"] == device_name:
                    self.api_handler("POST", f"/api/plugins/telemetry/DEVICE/{record['id']['id']}/SERVER_SCOPE",
                                     {}, device_scope)
                    return record['id']['id']

        data = {
            "additionalInfo": {**device_scope, "deviceType": device_type, "deviceName": device_name,
                               'sap_id': location_id},
            "name": device_name,
            "label": device_name,
            "type": device_type,
            "customerId": {"entityType": "CUSTOMER", "id": bu_id}
        }
        device = self.api_handler("POST", "/api/device", {}, data)

        if device:
            tele_device = self.api_handler("POST",
                                           f"/api/plugins/telemetry/DEVICE/{device['id']['id']}/SERVER_SCOPE", {},
                                           {**device_scope, "deviceType": device_type})
            if tele_device:
                data = {
                    "additionalInfo": {**device_scope, "deviceType": device_type, "deviceName": device_name,
                                       'sap_id': location_id},
                    "customerId": {
                        "entityType": "CUSTOMER",
                        "id": bu_id
                    },
                    "id": {
                        "entityType": "DEVICE",
                        "id": device["id"]["id"]
                    }
                }
                resp = self.api_handler("POST", f"/api/customer/{bu_id}/device/{device['id']['id']}", {}, data)
                if resp:
                    return resp['id']['id']

        return None

    def get_device_cred_key(self, device_id):
        resp = self.api_handler("GET", f"/api/device/{device_id}/credentials", {}, {})
        if resp:
            return resp['credentialsId']
        return ''

    def create_bu_devices(self, bu, location_id, location_name, file_path):
        """
        Creates multiple devices for a given business unit (BU) and location by reading details from a file.

        Parameters:
            bu (str): The business unit name.
            location_id (str): The unique identifier for the location.
            location_name (str): The name of the location.
            file_path (str): The file path containing device details.

        Returns:
            None: Writes the created device data to a JSON file named after the location ID.
        """
        print(f"Create Asset Master For Location {location_name} with file {file_path}")
        bu_device_data = load_bu_asset_master(file_path, bu, location_id, location_name)

        entity_id = self.get_location(bu_device_data['bu'], bu_device_data['location_name'])

        for device in bu_device_data["data"]:
            # Append @location_id to the device name
            device_name = f"{device['device_name']}"
            print("device --> ", device_name)

            # Update the device name in the data
            device["device_name"] = device_name

            # Create the device using the updated name
            device_id = self.create_device(
                bu_device_data['bu'],
                bu_device_data['location_id'],
                bu_device_data['location_name'],
                device_name,  # Use the updated name here
                device["device_type"],
                device
            )

            if device_id:
                device['device_id'] = device_id
                device['device_key'] = self.get_device_cred_key(device_id)
            device['entity_id'] = entity_id

        # Save the updated data to the JSON file with the correct names
        if not os.path.exists(self.data_path):
            os.makedirs(self.data_path)
        file_path_write = f"{self.data_path}/{location_id}"
        
        with open(f"{file_path_write}.json", "w+") as f:
            f.write(json.dumps(bu_device_data, indent=4))
        
        # Save the Excel file
        with open(f"{file_path}", 'rb') as f:
            data = f.read()
            with open(f"{file_path_write}.xlsx", 'wb+') as fw:
                fw.write(data)


if __name__ == "__main__":
    file_path = "path to your excel"
    ThingsBoardInterface().create_bu_devices("TAS", "11128", "Mathura", file_path)


