import urdhva_base
import sys
import json
import time
import asyncio
import traceback
import urdhva_base.redispool
from orchestrator.actions.indentwise_dry_out import IndentDryOut

logger = urdhva_base.Logger.getInstance("dry_out_camunda_listener.log")


class DryOutCamundaListener:
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
                    print(f"Exception in dry-out task process {e}, {traceback.format_exc()}")
                    logger.error(f"Exception in dry-out task process {e}, {traceback.format_exc()}")
            if (int(time.time()) - base_time) > 300:
                if await self.validate_restart(self.worker_start_time):
                    logger.info(f"Restart message received for {self.queue_name}")
                    break
                base_time = int(time.time())

    async def process_task(self, task):
        location_id = task['sap_id']
        product_id = task['product_code']
        print(f"Location: {location_id} Product: {product_id}")
        # Todo:-
        # Get All non cancelled indents from IMS
        await IndentDryOut().check_raised_indent(task)


def usage():
    print(f"Usage:- python {sys.argv[0]} <connector_name> <queue_name>{sys.argv[0]}")


if __name__ == "__main__":
    if len(sys.argv) == 1:
        print("Invalid arguments")
        usage()
        sys.exit(-1)
    asyncio.run(DryOutCamundaListener(sys.argv[1], "dry_out_camunda_queue").listener())
