import urdhva_base
import os
import json
import requests
import pandas as pd
import hpcl_ceg_model


def load_bu_asset_master(file_path, bu, location_id, location_name, force_delete=False):
    """
    Load and process asset data from an Excel file containing multiple sheets.

    Args:
        file_path (str): The path to the Excel file.
        bu (str): Type of BU
        location_id (str): SAP ID of the location
        location_name (str): Name of the location
        force_delete (bool, optional): Placeholder argument for potential future functionality.
                                        Currently, it has no effect. Default is False.

    Returns:
        dict:
        {
            Devices Data (data): list of device, Includes device details, such as names and associated
            sensors for each device in list.
            Location ID (location_id): Identifies the specific location related to the devices.
            Business Unit (bu): Represents the organizational context.
            Location Name (location_name): Currently an empty string, likely intended for cases where a location name
            is required but isn't available yet.
        }
    """
    # Read all sheets from the Excel file into a dictionary of DataFrames
    sheets = pd.read_excel(file_path, engine="openpyxl", sheet_name=None)
    devices_data = []  # Initialize a list to store processed device data

    # Iterate over each sheet and its corresponding DataFrame
    for sheet_name, df in sheets.items():
        df = df.fillna("")  # Replace NaN values with empty strings to simplify processing
        print("df --> ", df)
        # Convert each row in the DataFrame to a dictionary
        for record in df.to_dict(orient="records"):
            # Extract and clean the device name, then remove it from the record
            device_name = record.pop("Name").strip()

            # Remove the "S.No" field if it exists, handling potential absence gracefully
            record.pop("S.No", None)

            # Construct a list of sensors from the remaining key-value pairs in the record
            # sensors = [
            #     {"sensor_name": key.strip(), "sensor_tag": value.strip()}
            #     for key, value in record.items() if value  # Include only non-empty values
            # ]
            sensors = [
                {"sensor_name": key.strip(), "sensor_tag": value.strip()}
                for key, value in record.items()  # Include only non-empty values
            ]

            # Add the processed device data to the list
            devices_data.append({"device_name": device_name, "device_id": "", "device_type": sheet_name,
                                 "device_key": "", "entity_id": "", "sensors": sensors})
            # device['device_id'] = device_id
            #                 device['device_key'] = self.get_device_cred_key(device_id)
    return {"data": devices_data, "location_id": location_id, "bu": bu, "location_name": location_name}


class ThingsBoardInterface:
    def __init__(self):
        self._auth_token = None
        self.location = None
        self.bu_id = None
        self.data_path = os.path.join(os.path.dirname(hpcl_ceg_model.__file__), "../things_board/device_data")

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
        # Fetch and set the authentication token if not already set
        if not self._auth_token:
            self._auth_token = self.get_auth_token()

        # Initialize headers and add authorization and content-type headers
        if not headers:
            headers = {}
        headers.update({"Content-Type": "application/json", "X-Authorization": f"Bearer {self._auth_token}"})

        # Prepare the request data based on the HTTP method
        data = {"headers": headers}
        if method == "GET":
            data["params"] = payload  # Attach query parameters for GET requests
        else:
            data["json"] = payload  # Attach JSON payload for non-GET requests

        # Execute the request and handle errors
        response = requests.request(method, f"{urdhva_base.settings.things_board_url}{url}", **data)
        if response.status_code // 100 != 2:  # Check for non-success HTTP status codes
            print(f"API {url}, status_code {response.status_code}, response {response.text}")
            print(f"{response.url}")
            return None

        # Return parsed JSON response or a success status if the body is empty
        return response.json() if response.text else {"status": "Success"}

    def get_bu(self, bu):
        """
        Retrieves or creates a business unit (BU) in ThingsBoard.

        Args:
            bu (str): The name of the business unit.

        Returns:
            str or None: ID of the business unit if found or created; otherwise, None.
        """
        # Fetch existing business units with pagination
        resp = self.api_handler("GET", "/api/customers", {}, {'pageSize': 100, 'page': 0})
        if resp:
            for rec in resp['data']:
                if rec['title'].lower() == bu.lower():  # Match BU name case-insensitively
                    self.bu_id = rec["id"]["id"]
                    return self.bu_id

        # Create a new BU if it doesn't exist
        payload = {
            "additionalInfo": {
                "description": f"BU: {bu}",
                "homeDashboardHideToolbar": True,
                "homeDashboardId": None
            },
            "country": "India",
            "title": bu.upper()  # Store BU name in uppercase
        }
        response = self.api_handler("POST", "/api/customer", {}, payload)
        if response and response.get("id"):
            self.bu_id = response["id"]["id"]
            return self.bu_id

        return None  # Return None if BU creation or retrieval fails

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
        # Get or create the BU to which the location belongs
        bu_id = self.get_bu(bu)
        page_size = 100
        page = 0
        headers = {"Content-Type": "application/json", "X-Authorization": f"Bearer {self._auth_token}"}

        # Search for an existing location asset with pagination
        while True:
            response = self.api_handler("GET", "/api/tenant/assets", headers, {
                'pageSize': page_size, 'page': page, "type": "Location"
            })
            if response:
                for asset in response["data"]:
                    if asset["name"].lower() == location_name.lower():  # Match location name case-insensitively
                        return asset["id"]["id"]  # Return if location is found
                if not response.get("hasNext"):  # Exit if no more pages
                    break
            else:
                break
            page += 1

        # Create a new location asset if it doesn't exist
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

        # Add telemetry to the new asset
        self.api_handler("POST", f"/api/plugins/telemetry/ASSET/{response['id']['id']}/SERVER_SCOPE", {},
                         additional_info)
        self.location = response
        return response['id']['id']  # Return the newly created location asset details

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
        # Fetch the business unit ID
        bu_id = self.get_bu(bu)
        print(f"Creating device for {device_name}")

        data = "/Users/mac_1/PycharmProjects/Cloud/dnc_backend_v2/Agents/OpcDataSimulator/data.json"
        with open(data, 'r') as file:
            device_data = json.load(file)
            
        # Define the metadata to associate with the device
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
        # telemetry_scope = {}
        if "sensors" in device:
            for sensor in device['sensors']:
                sensor_name = sensor.get('sensor_name')
                sensor_tag = sensor.get('sensor_tag')
                
                # Check if the sensor_tag is present in the device_data
                if sensor_tag in device_data:
                    # If sensor_tag is found in the JSON, assign the corresponding value
                    sensor_value = device_data[sensor_tag]
                    device_scope[sensor_name] = '0'
                    # telemetry_scope[sensor_name] = '0'
                else:
                    # If sensor_tag is not found, log or assign a default value
                    print(f"Sensor tag {sensor_tag} not found in device data.")
                    device_scope[sensor_name] = '0'  # Or some default value
                    # telemetry_scope[sensor_name] = None

        # Check if the device already exists by querying the device info
        device_data = self.api_handler("GET", "/api/tenant/deviceInfos", {},
                                       {"textSearch": device_name, "pageSize": 100, "page": 0,
                                        "sortProperty": "createdTime", "sortOrder": "DESC"})

        if device_data and device_data.get("data"):
            # If the device exists, associate metadata (telemetry) and return its ID
            for record in device_data["data"]:
                if record["name"] == device_name:
                    self.api_handler("POST", f"/api/plugins/telemetry/DEVICE/{record['id']['id']}/SERVER_SCOPE",
                                     {}, device_scope)
                    # self.api_handler("POST", f"/api/plugins/telemetry/DEVICE/{record['id']['id']}/timeseries/LATEST_TELEMETRY",
                    #                  {}, telemetry_scope)
                    return record['id']['id']

        # If the device does not exist, create a new device with the specified details
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
            # Attach telemetry data to the newly created device
            tele_device = self.api_handler("POST",
                                           f"/api/plugins/telemetry/DEVICE/{device['id']['id']}/SERVER_SCOPE", {},
                                           {**device_scope, "deviceType": device_type})
            # latest_ts   = self.api_handler("POST", f"/api/plugins/telemetry/DEVICE/{device['id']['id']}/timeseries/LATEST_TELEMETRY",
            #                          {}, {**telemetry_scope, "deviceType": device_type})
            if tele_device:
                # Associate the device with the customer
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

        # Return None if the creation or association fails
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
        # Load device data from the external file
        bu_device_data = load_bu_asset_master(file_path, bu, location_id, location_name)

        # Get or create the location entity in ThingsBoard
        entity_id = self.get_location(bu_device_data['bu'], bu_device_data['location_name'])

        # Iterate over each device and create/update it in ThingsBoard
        for device in bu_device_data["data"]:
            print("device --> ", device)
            device_id = self.create_device(
                bu_device_data['bu'],
                bu_device_data['location_id'],
                bu_device_data['location_name'],
                device["device_name"],
                device["device_type"],
                device
            )
            if device_id:
                # Update the device data with the created device ID
                device['device_id'] = device_id
                device['device_key'] = self.get_device_cred_key(device_id)
            # Add the location entity ID to the device data
            device['entity_id'] = entity_id

        # Save the updated device data to a JSON file
        if not os.path.exists(self.data_path):
            os.makedirs(self.data_path)
        file_path_write = f"{self.data_path}/{location_id}"
        with open(f"{file_path_write}.json", "w+") as f:
            f.write(json.dumps(bu_device_data, indent=4))
        with open(f"{file_path}", 'rb') as f:
            data = f.read()
            with open(f"{file_path_write}.xlsx", 'wb+') as fw:
                fw.write(data)


if __name__ == "__main__":
    file_path = "/Users/mac_1/Downloads/OPC_Data_Collection_141124.xlsx"
    ThingsBoardInterface().create_bu_devices("TAS", "1999", "Dharmapuri", file_path)


