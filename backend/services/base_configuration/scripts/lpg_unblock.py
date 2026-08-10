import urdhva_base
import hpcl_ceg_model
import asyncio
import requests
import json
import sys
import datetime

# ----------------------------
# Config
# ----------------------------
OAUTH_URL = urdhva_base.settings.lpg_vts_auth_url
#OAUTH_URL = "https://apim.hpcl.co.in/oauth2/token"
CLIENT_ID = urdhva_base.settings.lpg_vts_client_id
CLIENT_SECRET = urdhva_base.settings.lpg_vts_client_secret_key

PUBLISH_URL = urdhva_base.settings.lpg_publish_url

async def fetch_access_token():
    headers = {"Content-Type": "application/x-www-form-urlencoded"}

    # Option A: Send everything in body (like your Java code)
    data = {
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "client_authentication": "send_as_basic_auth_header"
    }

    try:
        print(OAUTH_URL)
        print(headers)
        print(data)
        response = requests.post(OAUTH_URL, headers=headers, data=data, timeout=20, verify=False)
        response.raise_for_status()
        token_data = response.json()
        return token_data.get("access_token")
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Failed to fetch token: {e}")
        return None

async def operation_sap(vehicle_number, operation_type='B'):
    query = (f"select id from alerts where vehicle_number = '{vehicle_number}' and vehicle_unblocked_date is null and alert_section='VTS'")
    vts_alert_data = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
    print("vts_alert_data",vts_alert_data)
    alert_id = vts_alert_data['data'][0]['id']
    print("alert_id",alert_id)
    alert = await hpcl_ceg_model.Alerts.get(alert_id)
    alert_data = alert.__dict__
    transaction_id = f"{alert_data['id']}0"
    closed_at = alert_data.get('closed_at')
    process_instance_id = alert_data['workflow_instance_id']
    camunda_url = alert_data['workflow_url']
    for key in ['created_at', 'updated_at', '_sa_instance_state', '']:
        if key in alert_data:
            del alert_data[key]
    alert_id = alert_data['id']
    vehicle_number = alert_data['vehicle_number']
    
    payload = {
        "Request":{
        "Request_ID": transaction_id,
        "Vehicle_ID": alert_data['vehicle_number'],
        "Status": operation_type,
        "User_ID": "NOVEX_SYSTEM",
        "IP_Address": "10.90.38.218"
        }
    }

    access_token = await fetch_access_token()

    if not access_token:
        print(f"[ERROR] Failed to fetch token")
        return None
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    try:
        print("*" * 50)
        print(PUBLISH_URL)
        print(headers)
        print(payload)
        print("*" * 50)
        response = requests.post(PUBLISH_URL, headers=headers, data=json.dumps(payload),
                                 timeout=15, verify=False)
        post_sap_response = {
            "request_id": str(response.json().get("Response", {}).get("Request_ID")),
            "vehicle_number": response.json().get("Response", {}).get("Vehicle_ID"),
            "status": response.json().get("Response", {}).get("Status"),
            "remark": response.json().get("Response", {}).get("Remark"),
            "updated_date": str(response.json().get("Response", {}).get("Updated_Date")),
            "updated_time": str(response.json().get("Response", {}).get("Updated_Time"))
        }
        await hpcl_ceg_model.LpgDataPostingAuditCreate(**post_sap_response).create()
        response.raise_for_status()
        print("status",response.status_code)
        unblock_query = f"update vts_truck_details set truck_status = 'UNBLOCKED', blacklist='false' where truck_regno = '{vehicle_number}'"
        await hpcl_ceg_model.VtsTruckDetails.update_by_query(unblock_query)
        vehicle_unblocked_date = datetime.datetime.now(tz=datetime.timezone.utc)
        if closed_at:
            print("closed_at",closed_at)
            print("alert_id",alert_id)
            await hpcl_ceg_model.Alerts(**{"id": alert_id,
                "vehicle_unblocked_date": vehicle_unblocked_date,
                "mark_as_false": True}).modify()
        else:
            await hpcl_ceg_model.Alerts(**{"id": alert_id,
                "vehicle_unblocked_date": vehicle_unblocked_date,
                "closed_at": vehicle_unblocked_date,
                "alert_status": "Close",
                "alert_state": "Resolved",
                "mark_as_false": True}).modify()
        
        data = response.json()
        print("Status:", response.status_code)
        print("Response JSON:", data)
        delete_url = f"{camunda_url}/engine-rest/process-instance/{process_instance_id}"
        delete_response = requests.delete(delete_url)
        print("workflow_deletion Status code:", delete_response.status_code)
        print("workflow_deletion Response body:", delete_response.text)
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Publish API call failed: {e}")
        return None
    
if __name__ == "__main__":
    asyncio.run(operation_sap(sys.argv[1], sys.argv[2]))