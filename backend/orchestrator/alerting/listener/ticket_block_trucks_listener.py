import urdhva_base
import json
import time
import asyncio
import traceback
import sys
import urdhva_base.redispool
import hpcl_ceg_model
import hpcl_ceg_enum
import api_manager.alerts_actions


logger = urdhva_base.Logger.getInstance("ticket_block_trucks_listener")


class TicketBlockTrucksListener:
    def __init__(self, connector_name, queue_name):
        self.connector_name = connector_name
        self.queue_name = queue_name
        self.worker_start_time = int(time.time())

    @classmethod
    async def restart_validator(cls):
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
        try:
            if int(time.time()) - start_time > 3600:
                return True
            if await cls.restart_validator() > start_time:
                return True
        except Exception:
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
                    logger.error(f"Exception in ticket block trucks task process {e}, {traceback.format_exc()}")
            if (int(time.time()) - base_time) > 300:
                if await self.validate_restart(self.worker_start_time):
                    logger.info(f"Restart message received for {self.queue_name}")
                    break
                base_time = int(time.time())

    async def process_task(self, task):
        truck_number = task.get("truck_number")
        ticket_id = task.get("ticket_id")
        bu_str = task.get("bu", "TAS")

        if not truck_number or not ticket_id:
            logger.error("Invalid task: missing truck_number or ticket_id")
            return

        try:
            bu = hpcl_ceg_enum.BusinessUnit(bu_str) if isinstance(bu_str, str) else bu_str
        except (ValueError, TypeError):
            logger.error(f"Invalid BU value: {bu_str}")
            return

        rpt = task.get("rpt", {})
        context_data = {
            "rpt": rpt,
            "entity_id": task.get("entity_id", "Novex"),
            "domain": None,
            "entity_obj": urdhva_base.entity.Entity() if hasattr(urdhva_base, "entity") else None,
        }
        token = None
        try:
            token = urdhva_base.context._request_scope_context_storage.set(context_data)
            block_params = hpcl_ceg_model.Alerts_Block_Vts_TruckParams(
                truck_number=truck_number,
                blocking_days=task.get("blocking_days", 0),
                remarks=task.get("remarks", "") or "",
                reason=task.get("reason", "") or "",
                bu=bu,
                location_name=task.get("location_name", "") or "",
                zone=task.get("zone", "") or "",   
                region=task.get("region", "") or "", 
                sap_id=task.get("sap_id", "") or "", 
                check_ticket_close=task.get("check_ticket_close", False),
            )
            block_resp = await api_manager.alerts_actions.alerts_block_vts_truck(block_params)

            if not block_resp.get("status"):
                logger.error(f"Block failed for truck {truck_number}: {block_resp.get('message')}")
                return

            query = (
                f"vehicle_number='{truck_number}' "
                f"and alert_section='VTS' "
                f"and interlock_name='Itdg Admin Blocked'"
                f"and vehicle_unblocked_date is null"
            )
            params = urdhva_base.queryparams.QueryParams(q=query, limit=1, sort=json.dumps({"created_at": "desc"}))

            alert_resp = await hpcl_ceg_model.Alerts.get_all(
                params,
                resp_type="plain"
            )

            if not alert_resp or not alert_resp.get("data"):
                logger.error(f"Alert created but not found for truck {truck_number}")
                return

            alert_id = alert_resp["data"][0]["id"]

            await hpcl_ceg_model.Alerts(
                id=alert_id,
                ticket_id=ticket_id
            ).modify()

            logger.info(f"Truck {truck_number} blocked and linked to ticket {ticket_id}, alert_id={alert_id}")

        except Exception as e:
            logger.exception(f"Error processing block for truck {truck_number}: {str(e)}")
        finally:
            if token is not None:
                urdhva_base.context._request_scope_context_storage.reset(token)


if __name__ == "__main__":
    if len(sys.argv) == 1:
        print("Invalid arguments")
        print(f"Usage: python {sys.argv[0]} <connector_name> <queue_name>")
        sys.exit(-1)
    asyncio.run(
        TicketBlockTrucksListener(sys.argv[1], "ticket_block_trucks_queue").listener()
    )

