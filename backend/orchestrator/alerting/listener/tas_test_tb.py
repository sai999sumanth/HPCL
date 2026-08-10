# import requests
# import json
# import time
# # ThingsBoard API endpoint and device credentials
# base_url = "https://dev.rulechain.test"
# #base_url = "https://uat.rulechain.test"
# #base_url = "http://140.245.238.142:8080"
# access_token = "552lAFh5xAGmPd8tQDEq"

# data = {
#     "TANK MAINTENANCE": "1",
#     "LEVEL SWITCH MAINTENANCE": "1",
#     "MOV MAINTENANCE IL1": "1",
#     "ROSOV MAINTENANCE IL1": "1",
#     "RADAR MAINTENANCE": "1"
# }
# # Prepare headers with the access token and content type
# headers = {
#     "Content-Type": "application/json",
#     "X-Authorization": f"Bearer {access_token}"
# }

# Payload = data
# telemetry_json = json.dumps(Payload)
# response = requests.post(f"{base_url}/api/v1/{access_token}/telemetry", data=telemetry_json, headers=headers, verify=False)
# #response = requests.post(f"{base_url}/api/v1/{access_token}/attributes", data=telemetry_json, headers=headers)
# if response.status_code == 200:
#     print("Telemetry data sent successfully")
# else:
#     print("Failed to send telemetry data. Status code:", response.status_code)





import requests
import json

# Base URL
base_url = "https://dev4.rulechain.test"

access_tokens = {
    "jW6QygKPdURELmx6d0hF": {
        "ESD STATUS": "1",
        "Barrier Gate opened": "0",
        "TLF Gantry Permissive Power Off": "0",
        "All TLF Product Pumps Stopped": "0",
        "All Tanks in Dormant Mode": "0",
        "All DBBVs Closed": "0",
        "ESD Command To Process PLC": "0",
        "Siren Activated": "0",
        "ESD Hooter activated in control room": "0",
        "Power ESD Activation after 120 Sec": "0",
        "TTL Dispatch in Dormant Mode": "0",
        "All ROSOVs closed": "0"
    },
    "1AG23sgb97El0Iw6zTL7": {
        "Tank Receipt Mode": "0",
        "ESD Active": "1",
        "MOV STATUS IL1": "1",
        "MOV STATUS IL2": "0",
        "MOV STATUS RCL": "0",
        "MOV STATUS OL": "0",
        "ROSOV OPEN STATUS IL1": "0",
        "ROSOV OPEN STATUS IL2": "1",
        "ROSOV OPEN STATUS OL": "0",
        "ROSOV OPEN STATUS RCL": "0"
    },
    "5JTcBcSxSeHEOTb2Cfgz": {
        "Tank Receipt Mode": "1",
        "ESD Active": "1",
        "MOV STATUS IL1": "1",
        "MOV STATUS IL2": "0",
        "MOV STATUS RCL": "0",
        "MOV STATUS OL": "0",
        "ROSOV OPEN STATUS IL1": "1",
        "ROSOV OPEN STATUS IL2": "0",
        "ROSOV OPEN STATUS OL": "0",
        "ROSOV OPEN STATUS RCL": "0"
    },
    "I91nu7zTCP4Sx7Zjp05Y": {
        "Tank Receipt Mode": "1",
        "ESD Active": "1",
        "MOV STATUS IL1": "1",
        "MOV STATUS IL2": "0",
        "MOV STATUS RCL": "0",
        "MOV STATUS OL": "0",
        "ROSOV OPEN STATUS IL1": "1",
        "ROSOV OPEN STATUS IL2": "0",
        "ROSOV OPEN STATUS OL": "0",
        "ROSOV OPEN STATUS RCL": "0"
    },
    "3noJTFTIhfAZYAsKUyFB": {
        "Tank Receipt Mode": "0",
        "ESD Active": "1",
        "MOV STATUS IL1": "0",
        "MOV STATUS IL2": "0",
        "MOV STATUS RCL": "0",
        "MOV STATUS OL": "0",
        "ROSOV OPEN STATUS IL1": "0",
        "ROSOV OPEN STATUS IL2": "0",
        "ROSOV OPEN STATUS OL": "0",
        "ROSOV OPEN STATUS RCL": "0"
    },
    "Lx5436xzG98ggyFKaZfD": {
        "Tank Receipt Mode": "0",
        "ESD Active": "1",
        "MOV STATUS IL1": "0",
        "MOV STATUS IL2": "0",
        "MOV STATUS RCL": "0",
        "MOV STATUS OL": "0",
        "ROSOV OPEN STATUS IL1": "0",
        "ROSOV OPEN STATUS IL2": "0",
        "ROSOV OPEN STATUS OL": "0",
        "ROSOV OPEN STATUS RCL": "0"
    }
    #TK-01_BS VI MS@Rewari_M
    # "94kRWKMciCeupo8hCmMI": {
        # "LEVEL SWITCH MAINTENANCE": "1",
        # "RADAR MAINTENANCE": "1",
        # "ROSOV MAINTENANCE IL1": "1",
        # "ROSOV MAINTENANCE OL": "1",
        # "MOV MAINTENANCE IL1": "1",
        # "MOV MAINTENANCE OL": "1",
        # "RIM SEAL MAINTENANCE STATUS": "1",
        # "TANK MAINTENANCE": "1"
    }
# }
for access_token, data in access_tokens.items():
    headers = {
        "Content-Type": "application/json",
        "X-Authorization": f"Bearer {access_token}"
    }
    telemetry_json = json.dumps(data)

    # Send telemetry data
    response = requests.post(
        f"{base_url}/api/v1/{access_token}/telemetry",
        data=telemetry_json,
        headers=headers,
        verify=False
    )
    if response.status_code == 200:
        print(f"Telemetry data sent successfully for access_token: {access_token}")
    else:
        print(f"Failed to send telemetry data for access_token: {access_token}. Status code: {response.status_code}")