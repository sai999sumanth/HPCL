import urdhva_base
import time
import asyncio
import datetime
import urdhva_base.redispool
from woker_base import Worker
from apscheduler.triggers.cron import CronTrigger
import apscheduler.triggers.interval as apinterval
import hpcl_ceg_model
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.executors.asyncio import AsyncIOExecutor
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.schedulers.background import BackgroundScheduler
from scheduled_actions import (
                                location_master,
                                location_device
                              )

# Schedule Constants
ThreadPoolSize = 1000
Concurrent_Workers = 50
MisFire_Time = round(datetime.timedelta(minutes=15).total_seconds())
ProcessPoolSize = 20


async def worker_action(*args, **kwargs):
    """
    Scheduler Worker function
    :param action_data:
    :return:
    """
    # action_method = sch_data.get("action", "")
    # action_module = sch_data.get("action_module")
    action = kwargs.get("action")
    print(action)
    await eval(action)()


class Scheduler(Worker):
    def __init__(self, worker_queue_name=""):
        """
        Scheduler initialization code, worker_queue_name field was a static field, not using
        """
        super().__init__(worker_queue_name)
        self.scheduler_ins = None

    async def initialize_scheduler(self):
        """
        Schedule initializer
        :return: No return
        """
        self.scheduler_ins = AsyncIOScheduler(job_defaults={
            'misfire_grace_time': MisFire_Time, 'max_instances': Concurrent_Workers,
            'processpool': ProcessPoolSize})
        # self.scheduler_ins.add_executor(ThreadPoolExecutor(ThreadPoolSize))
        self.scheduler_ins.add_executor(AsyncIOExecutor())
        self.scheduler_ins.start()
        # todo:- need to configure database for storing schedule info

    async def add_scheduler(self, unique_id, action, trigger_interval=None,
                            cron_data=None, replace_scheduler=False, trigger_args=None, args=None):
        """
        Adding scheduler trigger point to ApScheduler
        :param unique_id: Scheduler Unique ID for managing scheduler uniqueness
        :param action: Method to call on schedule trigger
        :param trigger_interval: Interval when this scheduler has to trigger
            Ex:- {"hours": 2, "minutes": 12, "seconds": 30}
        :param cron_data: Cron mapping required for cron based scheduler
            Ex:- {"minute": "*/2", "seconds": 12, "hours": "*/12"}
        :param replace_scheduler: Whether one need to forcefully update existing scheduler or not
        :param args: Arguments required for worker function which was triggered by scheduler
        :param trigger_args:
        :return: Status(bool), Scheduler job / Error Message
        """
        if replace_scheduler and self.verify_scheduler(unique_id):
            return False, "Scheduler already exists, Discarding action"
        base_data = dict(id=unique_id, replace_existing=True, max_instances=Concurrent_Workers, coalesce=True,
                         misfire_grace_time=MisFire_Time, args=args, jitter=120,
                         kwargs=trigger_args)
        if trigger_interval:
            interval_keys = ["hours", "minutes", "seconds"]
            interval = apinterval.IntervalTrigger(**{key: trigger_interval[key]
                                                     for key in interval_keys if key in trigger_interval})
            return True, self.scheduler_ins.add_job(action, interval, **base_data)
        else:
            cron_trigger = CronTrigger(**cron_data)
            return True, self.scheduler_ins.add_job(action, cron_trigger, **base_data)

    async def delete_scheduler(self, unique_id):
        """
        For deleting existing scheduler
        :param unique_id:
        :return:
        """
        if self.verify_scheduler(unique_id):
            self.scheduler_ins.remove_job(unique_id)
        return True, "Success"

    async def verify_scheduler(self, unique_id):
        """
        For validating whether scheduler was running or not with given id
        :param unique_id:
        :return:
        """
        return True if self.scheduler_ins.get_job(unique_id) else False

    async def schedule_runner(self):
        """
        Initial schedule runner
        :return:
        """
        await asyncio.sleep(1)
        redis_ins = urdhva_base.redispool.RedisQueue("scheduler")
        restart_sch_check_count = 0
        while True:
            sch_data = await redis_ins.get(timeout=30)
            if not sch_data:
                restart_sch_check_count += 1
                if restart_sch_check_count > 10:
                    if await self.validate_restart(self.worker_start_time):
                        print("Restart required for scheduler")
                        return
                await asyncio.sleep(1)
                continue
            sch_args = sch_data.get("sch_args", {})
            trigger_args = sch_data.get("trigger_args", {})
            interval = sch_data.get("internal", {})
            cron_data = sch_data.get("cron", {})
            sch_id = sch_data["sch_id"]
            if sch_data["task"] == "add":
                status, resp = await self.add_scheduler(sch_id, "worker_action", trigger_interval=interval,
                                                        cron_data=cron_data, replace_scheduler=False,
                                                        trigger_args=trigger_args, args=sch_args)
                print(f"Scheduler Add with status {status}, Response Msg {resp}")
            elif sch_data["task"] == "remove":
                status, resp = await self.delete_scheduler(sch_id)
                print(f"Scheduler Delete with status {status}, Response Msg {resp}")


async def scheduler_configuration():
    ins = Scheduler()
    await ins.initialize_scheduler()
    status, resp = await ins.add_scheduler("location_master", worker_action, cron_data={"hour": "*/6"},
                                           args=["a", "b"], trigger_args={"action": "location_master"})
    print(status, resp)

    status, resp2 = await ins.add_scheduler("location_device", worker_action, cron_data={"hour": "*/6"},
                                            args=["a", "b"], trigger_args={"action": "location_device"})
    print(status, resp2)

    status, resp3 = await ins.add_scheduler("role_master", worker_action, cron_data={"hour": "*/6"},
                                            args=["a", "b"], trigger_args={"action": "role_master"})
    print(status, resp3)

    status, resp4 = await ins.add_scheduler("asset_master", worker_action, cron_data={"hour": "*/6"},
                                            args=["a", "b"], trigger_args={"action": "asset_master"})
    print(status, resp4)
    await ins.schedule_runner()

if __name__ == "__main__":
    asyncio.run(scheduler_configuration())
