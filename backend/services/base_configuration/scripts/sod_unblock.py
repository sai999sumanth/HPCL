import urdhva_base
import sys
import asyncio
import requests
import datetime
import hpcl_ceg_model
import dateutil.parser as dateutil_parser

url = urdhva_base.settings.post_to_ims_url
headers = {
    "Content-Type": "application/json",
}


'''
#payload = [{
#    "transactNo": "57477341",
#    "truckRegNo": "MH13DQ4533",
#    "blockingFlag": "Y",
#    "blockingFrom": "20250920",
#    "blockingTo": "20251020"
#}]
'''
async def operation_ims(vehicle_number, operation_type='Y'):
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
    alert_data = {"blockingFlag": operation_type, "transactNo": transaction_id,
                  "truckRegNo": alert_data['vehicle_number'],
                  "blockingFrom": alert_data['vehicle_blocked_start_date'].strftime("%Y%m%d"),
                  "blockingTo": alert_data['vehicle_blocked_end_date'].strftime("%Y%m%d")}

    try:
        resp = requests.post(url, json=[alert_data], headers=headers, timeout=30)
        resp.raise_for_status()  # raises HTTPError for bad responses (4xx/5xx)
        # If response is JSON:
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
        data = resp.json()
        print("Status:", resp.status_code)
        print("Response JSON:", data)
        delete_url = f"{camunda_url}/engine-rest/process-instance/{process_instance_id}"
        delete_response = requests.delete(delete_url)
        print("workflow_deletion Status code:", delete_response.status_code)
        print("workflow_deletion Response body:", delete_response.text)
    except requests.exceptions.HTTPError as e:
        print("HTTP error:", e, "Body:", getattr(e.response, "text", None))
    except requests.exceptions.RequestException as e:
        print("Request failed:", e)


if __name__ == "__main__":
    asyncio.run(operation_ims(sys.argv[1], sys.argv[2]))
