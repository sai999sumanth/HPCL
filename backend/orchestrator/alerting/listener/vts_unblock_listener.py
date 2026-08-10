import urdhva_base
import hpcl_ceg_model
import sys
import json
import time
import asyncio
import requests
import datetime
import traceback
import urdhva_base.redispool
from hpcl_ceg_model import (
    Alerts,
    VtsTruckDetails
    )
import orchestrator.analytics.vts_analysis as vts_analysis
from orchestrator.alerting import alert_manager


logger = urdhva_base.Logger.getInstance("vts_unblock_listener")


class VTSUnblockListener:
    def __init__(self, connector_name, queue_name):
        self.connector_name = connector_name
        self.queue_name = queue_name
        self.worker_start_time = int(time.time())

    @classmethod
    async def restart_validator(cls):
        """
        Validates whether a restart has been triggered by checking the existence of a restart trigger key in Redis.

        Args:
            None

        Returns:
            int: The restart triggered time if the key exists, otherwise 0.
        """
        restart_trigger_key = "restart_triggered_time"
        redis_ins = await urdhva_base.redispool.get_redis_connection()
        restart_triggered_time = 0
        if await redis_ins.exists(restart_trigger_key):
            try:
                restart_triggered_time = int(await redis_ins.get(restart_trigger_key))
            except Exception as e:
                logger.error(f"Exception while converting restart triggered time to integer, {e}")
        await redis_ins.connection_pool.disconnect()
        return restart_triggered_time

    @classmethod
    async def validate_restart(cls, start_time):
        """
        Validates whether a restart has been triggered after a specified start time.

        Args:
            start_time (int): The start time to check against the restart trigger time.

        Returns:
            bool: True if a restart has been triggered after the start time, False otherwise.
        """
        try:
            if int(time.time()) - start_time > 3600:
                return True
            if await cls.restart_validator() > start_time:
                return True
        except Exception as _:
            pass
        return False

    async def fetch_access_token(self):
        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        # Option A: Send everything in body (like your Java code)
        data = {
            "grant_type": "client_credentials",
            "client_id": urdhva_base.settings.lpg_vts_client_id,
            "client_secret": urdhva_base.settings.lpg_vts_client_secret_key,
            "client_authentication": "send_as_basic_auth_header"
        }

        try:
            print(urdhva_base.settings.lpg_vts_auth_url)
            print(headers)
            print(data)
            response = requests.post(urdhva_base.settings.lpg_vts_auth_url, headers=headers, data=data, timeout=20, verify=False)
            response.raise_for_status()
            token_data = response.json()
            return token_data.get("access_token")
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Failed to fetch token: {e}")
            return None

    async def listener(self):
        queue_ins = urdhva_base.redispool.RedisQueue(self.queue_name)
        base_time = int(time.time())
        while True:
            try:
                task = await queue_ins.get(timeout=60)
                if task:
                    await self.process_task(json.loads(task))
            except Exception as e:
                if 'Timeout reading' not in str(e):
                    print(f"Exception in VTS task process {e}, {traceback.format_exc()}")
                    logger.error(f"Exception in VTS task process {e}, {traceback.format_exc()}")
            if (int(time.time()) - base_time) > 300:
                if await self.validate_restart(self.worker_start_time):
                    logger.info(f"Restart message received for {self.queue_name}")
                    break
                base_time = int(time.time())

    async def process_task(self, task):
        try:
            rpt = urdhva_base.context.context.get('rpt', {})
        except Exception:
            rpt = {}
        employee_id = None
        if rpt:
            employee_id = rpt["username"]        
        if task.get("task_type") == "approve":
            for alert_id in task["alert_ids"]:
                alert = await Alerts.get(alert_id)
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
                if alert_data["bu"] in ["TAS"]:
                    try:
                        payload = [{
                            "blockingFlag": "N", 
                            "transactNo": transaction_id,
                            "truckRegNo": alert_data['vehicle_number'],
                            "blockingFrom": alert_data['vehicle_blocked_start_date'].strftime("%Y%m%d"),
                            "blockingTo": alert_data['vehicle_blocked_end_date'].strftime("%Y%m%d")
                        }]
                        headers = {
                            "Content-Type": "application/json"
                        }
                        resp = requests.post(urdhva_base.settings.post_to_ims_url, json=payload, headers=headers, timeout=30)
                        resp.raise_for_status()
                        unblock_query = f"update vts_truck_details set truck_status = 'UNBLOCKED', blacklist='false' where truck_regno = '{vehicle_number}'"
                        await VtsTruckDetails.update_by_query(unblock_query)
                        vehicle_unblocked_date = datetime.datetime.now(tz=datetime.timezone.utc)
                        if closed_at:
                            await Alerts(**{"id": alert_id,
                                            "vehicle_unblocked_date": vehicle_unblocked_date,
                                            "mark_as_false": True}).modify()
                        else:
                            if not employee_id:
                                employee_id = "Approver SOD"
                            alert_data["action_msg"] = f"Approved unblock request by {employee_id}"
                            alert_data["action_type"] = "Approved"
                            await alert_manager.AlertAction.update_alert_history(input_data=alert_data, alert_data=alert_data)
                            await Alerts(**{"id": alert_id,
                                            "vehicle_unblocked_date": vehicle_unblocked_date,
                                            "closed_at": vehicle_unblocked_date,
                                            "alert_status": "Close",
                                            "alert_state": "Resolved",
                                            "device_msg": "unblocked_by_hqo_officer",
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
                elif alert_data["bu"] in ["LPG"]:
                    try:
                        payload = {
                            "Request":{
                                "Request_ID": transaction_id,
                                "Vehicle_ID": alert_data['vehicle_number'],
                                "Status": "U",
                                "User_ID": "NOVEX_SYSTEM",
                                "IP_Address": "10.90.38.218"
                            }
                        }
                        access_token = await self.fetch_access_token()
                        if not access_token:
                            print(f"[ERROR] Failed to fetch token")
                            return None
                        
                        headers = {
                            "Authorization": f"Bearer {access_token}",
                            "Content-Type": "application/json",
                            "Accept": "application/json"
                        }
                        print("*" * 50)
                        print(urdhva_base.settings.lpg_publish_url)
                        print(headers)
                        print(payload)
                        print("*" * 50)
                        response = requests.post(urdhva_base.settings.lpg_publish_url, headers=headers, data=json.dumps(payload),
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
                        unblock_query = f"update vts_truck_details set truck_status = 'UNBLOCKED', blacklist='false' where truck_regno = '{vehicle_number}'"
                        await VtsTruckDetails.update_by_query(unblock_query)
                        vehicle_unblocked_date = datetime.datetime.now(tz=datetime.timezone.utc)
                        if closed_at:
                            await Alerts(**{"id": alert_id,
                                            "vehicle_unblocked_date": vehicle_unblocked_date,
                                            "mark_as_false": True}).modify()
                        else:
                            if not employee_id:
                                employee_id = "Approver LPG"
                            alert_data["action_msg"] = f"Approved unblock request by {employee_id}"
                            alert_data["action_type"] = "Approved"
                            await alert_manager.AlertAction.update_alert_history(input_data=alert_data, alert_data=alert_data)
                            await Alerts(**{"id": alert_id,
                                            "vehicle_unblocked_date": vehicle_unblocked_date,
                                            "closed_at": vehicle_unblocked_date,
                                            "alert_status": "Close",
                                            "alert_state": "Resolved",
                                            "device_msg": "unblocked_by_hqo_officer",
                                            "mark_as_false": True}).modify()
                        
                        data = response.json()
                        print("Status:", response.status_code)
                        print("Response JSON:", data)
                        delete_url = f"{camunda_url}/engine-rest/process-instance/{process_instance_id}"
                        delete_response = requests.delete(delete_url)
                        print("workflow_deletion Status code:", delete_response.status_code)
                        print("workflow_deletion Response body:", delete_response.text)
                    except requests.exceptions.HTTPError as e:
                        print("HTTP error:", e, "Body:", getattr(e.response, "text", None))
                    except requests.exceptions.RequestException as e:
                        print("Request failed:", e)
        elif task.get("task_type") == "unblock":
            for alert_id in task["alert_ids"]:
                alert = await Alerts.get(alert_id)
                alert_data = alert.__dict__

                if alert_data["bu"] in ['TAS']:
                    alert_data["assigned_user_roles"].remove("Creator SOD") if "Creator SOD" in alert_data["assigned_user_roles"] else alert_data["assigned_user_roles"]
                    alert_data["assigned_user_roles"].append("Approver SOD")
                elif alert_data["bu"] in ['LPG']:
                    alert_data["assigned_user_roles"].remove("Creator LPG") if "Creator LPG" in alert_data["assigned_user_roles"] else alert_data["assigned_user_roles"]
                    alert_data["assigned_user_roles"].append("Approver LPG")
                print(
                    "Updating the alert data :", {
                        "id": alert_id,
                        "assigned_user_roles": alert_data["assigned_user_roles"],
                        "device_msg": "request_raised_for_unblock"
                        })
                if not employee_id:
                    if alert_data["bu"] in ['TAS']:
                        employee_id = "Creator SOD"
                    elif alert_data["bu"] in ['LPG']:
                        employee_id = "Creator LPG"
                alert_data["action_msg"] = f"Requested for unblock by {employee_id}"
                alert_data["action_type"] = "Request"
                await alert_manager.AlertAction.update_alert_history(input_data=alert_data, alert_data=alert_data)
                
                await Alerts(**{
                    "id": alert_id,
                    "assigned_user_roles": alert_data["assigned_user_roles"],
                    "device_msg": "request_raised_for_unblock"
                    }).modify()

if __name__ == "__main__":
    if len(sys.argv) == 1:
        print("Invalid arguments")
        print(f"Usage:- python {sys.argv[0]} <connector_name> <queue_name>{sys.argv[0]}")
        sys.exit(-1)
    asyncio.run(VTSUnblockListener(sys.argv[1], "vts_unblocking_queue").listener())