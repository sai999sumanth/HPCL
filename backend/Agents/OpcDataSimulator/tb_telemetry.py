import os
import time
import json
import requests
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

FILE_TO_WATCH = "/opt/ceg/algo/Agents/OpcDataSimulator/data.json"
SITE_ID = "1999"
BASE_URL = "http://10.90.38.165:8080"
last_known_values = {}

def load_site_data(siteid):
    filename = f"/opt/ceg/algo/Agents/OpcDataSimulator/{siteid}.json"
    if not os.path.exists(filename):
        print(f"Site data file not found: {filename}")
        return None
    try:
        with open(filename, "r") as file:
            return json.load(file)
    except Exception as e:
        print(f"Error reading site data file {filename}: {str(e)}")
        return None

def load_tag_values():
    if not os.path.exists(FILE_TO_WATCH):
        print(f"Tag values file not found: {FILE_TO_WATCH}")
        return {}
    try:
        with open(FILE_TO_WATCH, "r") as file:
            return json.load(file)
    except Exception as e:
        print(f"Error reading tag values file {FILE_TO_WATCH}: {str(e)}")
        return {}

def post_telemetry(device_key, sensor_type, value):
    headers = {"Content-Type": "application/json"}
    payload = {sensor_type: value} #write data to json or file
    telemetry_url = f"{BASE_URL}/api/v1/{device_key}/telemetry"
    try:
        response = requests.post(telemetry_url, json=payload, headers=headers, verify=False)
        if response.status_code == 200:
            print(f"Successfully posted telemetry for deviceKey: {device_key}")
        else:
            print(f"Failed to post telemetry for deviceKey: {device_key}. Status code: {response.status_code}")
    except Exception as e:
        print(f"Error posting telemetry for deviceKey: {device_key}. Error: {str(e)}")

def send_telemetry_for_all(tag_values):
    site_data = load_site_data(SITE_ID)
    if not site_data:
        print(f"No data found for siteid: {SITE_ID}")
        return

    for component in site_data['data']:
        #dict --> deviceKey , value
        device_key = component['device_key']
        print(f"Processing deviceKey: {device_key}")
        for sensor in component['sensors']:
            tag_path = sensor['sensor_tag']
            print(f"Processing TagPath: {tag_path}")

            if tag_path in tag_values:
                value = tag_values[tag_path]
                post_telemetry(device_key, sensor['sensor_name'], value)
            else:
                print(f"No value found for TagPath: {tag_path}")

class TagValuesChangeHandler(FileSystemEventHandler):
    def on_modified(self, event):
        global last_known_values
        if event.src_path.endswith(FILE_TO_WATCH):
            print(f"Detected change in {FILE_TO_WATCH}. Checking for updates...")
            current_values = load_tag_values()
            if current_values != last_known_values:
                print("Changes detected. Sending telemetry...")
                send_telemetry_for_all(current_values)
                last_known_values = current_values
            else:
                print("No changes in data.")

if __name__ == "__main__":
    last_known_values = load_tag_values()
    if last_known_values:
        send_telemetry_for_all(last_known_values)
    event_handler = TagValuesChangeHandler()
    observer = Observer()
    observer.schedule(event_handler, path=".", recursive=False)
    observer.start()
    print(f"Monitoring changes in {FILE_TO_WATCH}...")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()