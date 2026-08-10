import urdhva_base
import json
import requests

def load_site_data(site_id):
    """
    Loads site data from a JSON file.
    """
    try:
        file_name = f"{site_id}.json"  # JSON file name derived from site_id
        with open("/opt/ceg/algo/Thingsboard/tags/" + file_name, "r") as file:
            return json.load(file)
    except FileNotFoundError:
        print(f"File {site_id}.json not found.")
        return None
    except json.JSONDecodeError:
        print(f"Error decoding JSON from {site_id}.json")
        return None


def post_telemetry(device_key, sensor_type, tag_value):
    """
    Sends telemetry data to ThingsBoard for a specific device.
    """
    telemetry_data = {
        sensor_type:tag_value
    }
    url = f"{urdhva_base.settings.things_board_url}/api/v1/{device_key}/telemetry"  # Using deviceKey as the token
    
    try:
        response = requests.post(url, json=telemetry_data)
        if response.status_code == 200:
            print(f"Telemetry sent successfully for DeviceKey: {device_key}, SensorType: {sensor_type}")
        else:
            print(f"Failed to send telemetry for DeviceKey: {device_key}, SensorType: {sensor_type}")
            print(f"Response: {response.status_code} - {response.text}")
    except requests.RequestException as e:
        print(f"Error sending telemetry: {e}")


def send_telemetry_for_all(site_id, tag_value):
    """
    Sends telemetry for all components and sensors in a site.
    """
    print("into send_telemetry_for_all ")
    site_data = load_site_data(site_id)
    if not site_data:
        print(f"No data found for site ID: {site_id}")
        return

    print("site_data --> ", site_data)
    for component in site_data.get("data", []):
        device_key = component.get("device_key")
        if not device_key:
            print(f"Device key missing in component: {component}")
            continue

        print(f"Processing device key: {device_key}")
        for sensor in component.get("sensors", []):
            tag_path = sensor.get("sensor_tag")
            if not tag_path:
                print(f"TagPath missing in sensor: {sensor}")
                continue
            
            print(f"Processing TagPath: {tag_path}")
            post_telemetry(device_key, sensor.get("sensor_name"), tag_value)


# Example Usage
site_id = "1999"
tag_value = "false"  # Replace with the actual value you want to send
send_telemetry_for_all(site_id, tag_value)
