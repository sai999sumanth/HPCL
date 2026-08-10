import urdhva_base
import sys
import json
import time
import asyncio
import traceback
import urdhva_base.redispool
import orchestrator.analytics.vts_analysis as vts_analysis
import orchestrator.notification_manager.notification_factory as notification_factory

logger = urdhva_base.Logger.getInstance("vts_alerts_listener.log")


class VTSAlertsListener:
    def __init__(self, connector_name, queue_name):
        self.connector_name = connector_name
        self.queue_name = queue_name
        self.worker_start_time = int(time.time())
        self.idle_time = 3600

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
    
    async def send_no_data_mail(self,tt_type):
        ins = await notification_factory.get_notification_module("email")
        if tt_type == "bulk":
            recipients = ["mberde@aryaomnitalk.com","adeshingkar@aryaomnitalk.com","kshah@aryaomnitalk.com", "Randhir.Kumar2@hpcl.in", "Rishikesh.patil@hpcl.in"]
            body=f"""
            <p>Hi Sir,</p>

            <p>
            No VTS data has been received for the last one hour - <b>{tt_type.upper()} VTS</b>
            on server <b>{urdhva_base.settings.server_ip}</b>.

            Kindly check and resolve the issue.
            </p>

            <p>Thanks & Regards,<br>
            Novex System</p>
            """
        elif tt_type == "packed":
            recipients = ["roshaiah.b@enmovil.in","aditya.lokhande@enmovil.in", "renumeena@hpcl.in", "Randhir.Kumar2@hpcl.in", "Rishikesh.patil@hpcl.in"]
            body=f"""
            <p>Hi Sir,</p>

            <p>
            No VTS data has been received for the last one hour - <b>{tt_type.upper()} VTS</b>
            on server <b>novex.hpcl.co.in</b>.

            Kindly check and resolve the issue.
            </p>

            <p>Thanks & Regards,<br>
            Novex System</p>
            """
        await ins.publish_message(
            subject=f"VTS Issue: No Data Received - {tt_type.upper()}",
            recipients= recipients,
            cc_recipients= ["arpitaKanak.Bara@hpcl.in", "vgupta@hpcl.in", "avinashgaurav@hpcl.in",
                            "sreedhar.maddipati@algofusiontech.com","venu@algofusiontech.com","moufikali@algofusiontech.com","yesu.p@algofusiontech.com"],
            bcc_recipients= [],
            html_content=True,
            body=body,
            force_send=True,
            inline_images= {},
            attachments= []
        )

    async def listener(self):
        # Create a Redis queue instance to consume VTS messages
        queue_ins = urdhva_base.redispool.RedisQueue(self.queue_name)
        base_time = int(time.time())
        #last_event_received_time = int(time.time())
        last_bulk_received_time = int(time.time())
        last_packed_received_time = int(time.time())
        #last_reported_time = 0
        last_bulk_reported_time = 0
        last_packed_reported_time = 0
        while True:
            try:
                # Wait for data from Redis queue (timeout after 60 seconds)
                task = await queue_ins.get(timeout=60)
                if task:
                    # Convert JSON string into Python object
                    data = json.loads(task)
                    for entry in data:
                        tt_type = entry.get("tt_type", "").lower()
                        if tt_type == "bulk":
                            last_bulk_received_time = int(time.time())
                        elif tt_type == "packed":
                            last_packed_received_time = int(time.time())
                    #last_event_received_time = int(time.time())
                    await self.process_task(data)
            except Exception as e:
                if 'Timeout reading' not in str(e):
                    print(f"Exception in VTS task process {e}, {traceback.format_exc()}")
                    logger.error(f"Exception in VTS task process {e}, {traceback.format_exc()}")
            if (int(time.time()) - base_time) > 300:
                if await self.validate_restart(self.worker_start_time):
                    logger.info(f"Restart message received for {self.queue_name}")
                    break
                base_time = int(time.time())
            if int(time.time()) - last_bulk_received_time >= self.idle_time:
                # Skip if a notification was already sent recently
                if int(time.time()) - last_bulk_reported_time <= self.idle_time:
                    continue
                print(f"Not Received data for more than idle time ({self.idle_time}), Last received time: {last_bulk_received_time}")
                if urdhva_base.settings.environment not in ["development", "dev", "uat", "staging"]:
                    await self.send_no_data_mail('bulk')
                # Update the notification timestamp
                last_bulk_reported_time = int(time.time())
            
            if int(time.time()) - last_packed_received_time >= self.idle_time:
                if int(time.time()) - last_packed_reported_time <= self.idle_time:
                    continue
                print(f"Not Received data for more than idle time ({self.idle_time}), Last received time: {last_packed_received_time}")
                if urdhva_base.settings.environment not in ["development", "dev", "uat", "staging"]:
                    await self.send_no_data_mail('packed')
                last_packed_reported_time = int(time.time())

    async def process_task(self, task):
        await vts_analysis.create_vts_alerts(task)
        #await vts_analysis.create_vts_violation_alerts(task)

def usage():
    print(f"Usage:- python {sys.argv[0]} <connector_name> <queue_name>{sys.argv[0]}")


if __name__ == "__main__":
    if len(sys.argv) == 1:
        print("Invalid arguments")
        usage()
        sys.exit(-1)
    asyncio.run(VTSAlertsListener(sys.argv[1], "vts_alerts_queue").listener())
