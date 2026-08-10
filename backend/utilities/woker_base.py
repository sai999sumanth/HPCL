import urdhva_base
import time
import json
import msgpack
import datetime
import traceback
import dateutil.tz
import urdhva_base.redispool
from dateutil.tz import tzlocal

logger = urdhva_base.logger.Logger.getInstance("worker")


class Worker:
    def __init__(self, worker_queue_name):
        """
        Initializes a Worker instance.

        Args:
            worker_queue_name (str): The name of the worker queue.

        Returns:
            None
        """
        self.worker_queue_name = worker_queue_name
        self.worker_start_time = int(time.time())


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
            if await cls.restart_validator() > start_time:
                return True
        except Exception as _:
            pass
        return False
