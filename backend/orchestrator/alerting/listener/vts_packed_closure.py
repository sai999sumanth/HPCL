import urdhva_base
import time
import requests
import datetime
import hpcl_ceg_model

logger = urdhva_base.Logger.getInstance("vts_packed_closing")

async def get_process_instance_id(business_key, camunda_url):
    process_instance_id = ""
    params = {"businessKey": business_key}

    url = f"{camunda_url}/engine-rest/process-instance"
    
    try:
        response = requests.get(
            url,
            params=params,
            timeout=(15, 15)  # (connect timeout, read timeout)
        )

        response.raise_for_status()

        instances = response.json()

        if instances:
            process_instance_id = instances[0]["id"]
            return process_instance_id

        print(f"Camunda flow not found for business key: {business_key}")

    except Exception as e:
        print(f"Unexpected error while fetching process instance: {str(e)}")

    return process_instance_id


async def _close_camunda_workflow(alert_data=None):
    # camunda_url = await helpers.get_alert_camunda_url(self.params['alert_id'], "error")
    camunda_url = alert_data.get("workflow_url", "")
    MAX_RETRIES = 3
    RETRY_DELAY = 10
    headers = {"Content-Type": "application/json"}
    business_key = alert_data.get("unique_id")
    instance_id = await get_process_instance_id(business_key,camunda_url)

    if not instance_id:
        instance_id = alert_data.get("workflow_instance_id")

    url = f"{camunda_url}/engine-rest/process-instance/{instance_id}"
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.delete(url, headers=headers, timeout=(15, 15))  # (connect timeout, read timeout)

            if response.status_code == 204:  # Success in Camunda
                print(f"{instance_id} Deleted successfully.")
                logger.info(f"{instance_id} Deleted successfully.")
                break
            else:
                print(
                    f"Error Deleting {alert_data['id']} {instance_id} {camunda_url} (attempt {attempt + 1}): {response.status_code} - {response.text}")
                logger.info(
                    f"Error Deleting {alert_data['id']} {camunda_url} {instance_id} (attempt {attempt + 1}): {response.status_code} - {response.text}")

        except requests.RequestException as e:
            print(f"Request error for {camunda_url} {instance_id} {alert_data['id']} (attempt {attempt + 1}): {e}")
            logger.info(f"Request error for {camunda_url} {instance_id} {alert_data['id']} (attempt {attempt + 1}): {e}")

        # Retry logic with exponential backoff
        if attempt < MAX_RETRIES - 1:
            time.sleep(RETRY_DELAY)
        else:
            print(f"Failed to Deleting {camunda_url} {instance_id} after {MAX_RETRIES} retries.")
            logger.info(f"Failed to Deleting {camunda_url} {instance_id} after {MAX_RETRIES} retries.")
            return False
    return True

async def vts_packed_closure():
    query = f"""SELECT
                    *
                FROM alerts
                WHERE alert_section = 'VTS'
                AND bu = 'LPG'
                AND alert_status != 'Close'
                AND tt_type = 'packed'
                """
    
    result = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)

    print(f"Total alerts to be closed: {len(result.get('data', []))}")

    if result.get("data", []):
        alert_counts = result["data"]
        for alert in alert_counts:
            alert['alert_status'] = 'Close'
            alert['alert_state'] = 'Resolved'
            alert['mark_as_false'] = True 
            alert['auto_close'] = True
            alert['closed_at'] = datetime.datetime.utcnow()
            alert['vehicle_unblocked_date'] = datetime.datetime.utcnow()
            alert['alert_history'] = (alert.get('alert_history') or []) + [{
                'action_type': 'Resolved',
                'action_msg': 'As advised by HQO LPG',
                'alert_status': 'Close',
                'action_by': 'SYSTEM',
                'processed_time': datetime.datetime.now(datetime.timezone.utc).isoformat()
            }]
            await hpcl_ceg_model.Alerts(**alert).modify()
            
            try:
                status = await _close_camunda_workflow(alert_data=alert)
                if not status:
                    logger.error(
                        f"Failed to close Camunda workflow for alert {alert.get('id')}"
                    )
            except Exception as e:
                logger.exception(
                    f"Unexpected error while closing Camunda workflow for alert "
                    f"{alert.get('id')}: {str(e)}"
                )

if __name__ == "__main__":
    import asyncio
    asyncio.run(vts_packed_closure())
