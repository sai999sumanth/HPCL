import json
import time
import requests
from opcua import Client

# Configuration Class
class Config:
    def __init__(self, config_file):
        self.config_file = config_file
        self.load_config()

    def load_config(self):
        try:
            with open(self.config_file, 'r') as file:
                config_data = json.load(file)
                self.opcua_server_url = config_data.get("opcua_server_url")
                self.thingsboard_url = config_data.get("thingsboard_url")
                self.device_token = config_data.get("device_token")
                self.polling_interval = config_data.get("polling_interval", 10)
                self.variables = config_data.get("variables", {})  
                self.log_debug = config_data.get("log_debug", False)
        except Exception as e:
            raise ValueError(f"Error loading configuration: {e}")

# OPC UA Manager Class
class OpcUaManager:
    def __init__(self, server_url, debug=False):
        self.server_url = server_url
        self.debug = debug
        self.client = None

    def connect(self):
        try:
            self.client = Client(self.server_url)
            self.client.connect()
            if self.debug:
                print(f"Connected to OPC UA server at {self.server_url}")
        except Exception as e:
            if self.debug:
                print(f"Failed to connect to OPC UA server: {e}")
            raise

    def disconnect(self):
        if self.client:
            self.client.disconnect()
            if self.debug:
                print("Disconnected from OPC UA server")

    def read_variables(self, variables):
        data = {}
        try:
            for var_name, node_id in variables.items():
                try:
                    node = self.client.get_node(node_id)
                    value = node.get_value()

                    if isinstance(value, bool):
                        value = 1 if value else 0  
                    elif isinstance(value, (int,float)):
                        value = value  
                    else:
                        if self.debug:
                            print(f"Unsupported value type for {var_name}: {type(value)}")
                        value = None 


                    data[var_name] = value
                    if self.debug:
                        print(f"Read {var_name}: {value}")
                except Exception as e:
                    if self.debug:
                        print(f"Error reading {var_name} ({node_id}): {e}")
                    data[var_name] = None  
        except Exception as e:
            if self.debug:
                print(f"Error reading variables: {e}")
            raise
        return data

class ThingsBoardManager:
    def __init__(self, thingsboard_url, device_token, debug=False):
        self.thingsboard_url = thingsboard_url
        self.device_token = device_token
        self.debug = debug

    def send_data(self, data):
        # url = f"{self.thingsboard_url}/api/v1/{self.device_token}/telemetry"
        url=self.thingsboard_url.format(device_token=self.device_token)
        headers = {"Content-Type": "application/json"}
        try:
            response = requests.post(url, headers=headers, data=json.dumps(data))
            if self.debug:
                print(f"ThingsBoard Response: {response.status_code}")
            if response.status_code != 200:
                raise Exception(f"Failed to send data to ThingsBoard: {response.text}")
        except Exception as e:
            if self.debug:
                print(f"Error sending data to ThingsBoard: {e}")
            raise

# Main Application Class
class OpcToThingsBoardApp:
    def __init__(self, config_file):
        self.config = Config(config_file)
        self.opcua_manager = OpcUaManager(self.config.opcua_server_url, debug=self.config.log_debug)
        self.thingsboard_manager = ThingsBoardManager(
            self.config.thingsboard_url, self.config.device_token, debug=self.config.log_debug
        )

    def run(self):
        while True:
            try:
                self.opcua_manager.connect()

                variables = self.config.variables
                data = self.opcua_manager.read_variables(variables)

                self.thingsboard_manager.send_data(data)

                self.opcua_manager.disconnect()

                if self.config.log_debug:
                    print(f"Waiting for {self.config.polling_interval} seconds before next cycle...")
                time.sleep(self.config.polling_interval)

            except Exception as e:
                if self.config.log_debug:
                    print(f"Error during monitoring cycle: {e}")
                time.sleep(self.config.polling_interval)

# Entry Point
if __name__ == "__main__":
    try:
        app = OpcToThingsBoardApp("Details.json")
        app.run()
    except Exception as e:
        print(f"Critical error: {e}")