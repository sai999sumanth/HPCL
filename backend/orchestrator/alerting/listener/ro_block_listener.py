import urdhva_base
import sys
import json
import time
import pytz
import asyncio
import requests
import traceback
import urdhva_base.redispool
from hpcl_ceg_model import (
    Alerts
    )
from orchestrator.alerting import alert_manager


logger = urdhva_base.Logger.getInstance("ro_block_listener")


class ROBlockListener:
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
                    print(f"Exception in  task process {e}, {traceback.format_exc()}")
                    logger.error(f"Exception in RO task process {e}, {traceback.format_exc()}")
            if (int(time.time()) - base_time) > 300:
                if await self.validate_restart(self.worker_start_time):
                    logger.info(f"Restart message received for {self.queue_name}")
                    break
                base_time = int(time.time())

    async def process_task(self, task):
        if task.get('task_type') in ['block outlets']:
            for alert_id in task['alert_ids']:
                query = f"id='{alert_id}'"
                alert_data = await Alerts.get_all(
                    urdhva_base.queryparams.QueryParams(q=query, limit=1),
                    resp_type="plain"
                )
                if not alert_data.get("data"):
                    continue

                alert_record = alert_data["data"][0]

                payload = {
                    "messageName": "BlockNozzles",
                    "processInstanceId": alert_record.get("workflow_instance_id")
                }

                camunda_url = f"{alert_record.get('workflow_url')}/engine-rest/message"

                response = requests.post(camunda_url, json=payload)

                if response.status_code != 204:
                    logger.error(
                        f"Camunda block failed | "
                        f"alert_id={alert_record.get('id')} | "
                        f"status={response.status_code} | "
                        f"response={response.text}"
                    )

                event_time_utc = urdhva_base.utilities.get_present_time()
                ist_time = event_time_utc.astimezone(pytz.timezone("Asia/Kolkata"))
                alert_history = alert_record.get("alert_history", [])

                alert_history.append({
                    "action_msg": (
                        f"Block Initiated For Outlet {alert_record.get('sap_id')} "
                        f"initiated by {task.get('username','')} "
                        f"at {ist_time.strftime('%d-%m-%Y %I:%M:%S %p')} IST"
                    ),
                    "action_type": "Blocked",
                    "action_by": task.get('username',''),
                    "processed_time": event_time_utc.isoformat()
                })
                await Alerts(**{
                    "id": alert_record.get("id"),
                    "alert_history": alert_history,
                    "remarks_unblocked": task.get('reason','')
                }).modify()
        elif task.get('task_type') in ['unblock outlets']:
            for alert_id in task['alert_ids']:
                query = f"id='{alert_id}'"
                alert_data = await Alerts.get_all(
                    urdhva_base.queryparams.QueryParams(q=query, limit=1),
                    resp_type="plain"
                )
                if not alert_data.get("data"):
                    continue

                alert_record = alert_data["data"][0]

                payload = {
                    "messageName": "UnblockNozzles",
                    "processInstanceId": alert_record.get("workflow_instance_id")
                }

                camunda_url = f"{alert_record.get('workflow_url')}/engine-rest/message"

                response = requests.post(camunda_url, json=payload)

                if response.status_code != 204:
                    logger.error(
                        f"Camunda unblock failed | "
                        f"alert_id={alert_record.get('id')} | "
                        f"status={response.status_code} | "
                        f"response={response.text}"
                    )

                event_time_utc = urdhva_base.utilities.get_present_time()
                ist_time = event_time_utc.astimezone(pytz.timezone("Asia/Kolkata"))
                alert_history = alert_record.get("alert_history", [])

                alert_history.append({
                    "action_msg": (
                        f"Unblock for Outlet {alert_record.get('sap_id')} "
                        f"initiated by {task.get('username','')} "
                        f"at {ist_time.strftime('%d-%m-%Y %I:%M:%S %p')} IST"
                    ),
                    "action_type": "UnBlocked",
                    "action_by": task.get('username',''),
                    "processed_time": event_time_utc.isoformat()
                })
                await Alerts(**{
                    "id": alert_record.get("id"),
                    "alert_history": alert_history,
                    "remarks_unblocked": task.get('reason','')
                }).modify()
        elif task.get('task_type') in ['close alerts']:
            ids = ",".join(f"'{i}'" for i in task['alert_ids'])
            await Alerts.update_by_query(
                f"UPDATE alerts SET alert_status='Close', "
                f"alert_state = 'Resolved', "
                f"block_status = NULL, "
                f"alert_closure_reason = 'AUTO_CLOSE' WHERE id IN ({ids})"
            )
            for alert_id in task['alert_ids']:
                query = f"id='{alert_id}'"
                alert_data = await Alerts.get_all(
                    urdhva_base.queryparams.QueryParams(q=query, limit=1),
                    resp_type="plain"
                )
                if not alert_data.get("data"):
                    continue
                data = alert_data["data"][0]
                delete_url = f"{data.get('workflow_url')}/engine-rest/process-instance/{data.get("workflow_instance_id")}"
                try:
                    delete_response = requests.delete(delete_url)
                except Exception as e:
                    print(f"Exception while deleting workflow for id {id}: {e}")

if __name__ == "__main__":
    if len(sys.argv) == 1:
        print("Invalid arguments")
        print(f"Usage:- python {sys.argv[0]} <connector_name> <queue_name>{sys.argv[0]}")
        sys.exit(-1)
    asyncio.run(ROBlockListener(sys.argv[1], "ro_blocking_queue").listener())
