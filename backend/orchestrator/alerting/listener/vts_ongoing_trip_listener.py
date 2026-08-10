import urdhva_base
import sys
import json
import time
import asyncio
import hpcl_ceg_model
import hpcl_ceg_enum
import traceback
import urdhva_base.redispool
import cache_gateway.cache_api_actions as cache_api_actions


logger = urdhva_base.Logger.getInstance("vts_ongoing_trips_listener")


class VTSOnGoingTripListener:
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
    

    async def clean_destination_code(self, code):
        """
        Remove leading '00' and 'P' from destination code and strip extra spaces
        
        Args:
            code (str): The destination code to clean
            
        Returns:
            str: Cleaned destination code
        """
        if not code:
            return code
        
        code_str = str(code).strip()
        code_str = code_str[2:] if code_str.startswith('00') else code_str
        code_str = code_str[1:] if code_str.startswith('P') else code_str
        return code_str
    

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
                    logger.error(f"Exception in VTS task process {e}, {traceback.format_exc()}")
            if (int(time.time()) - base_time) > 300:
                if await self.validate_restart(self.worker_start_time):
                    logger.info(f"Restart message received for {self.queue_name}")
                    break
                base_time = int(time.time())

    async def process_task(self, task):
        enriched_tasks = []
        
        # Loop over each item in the task list
        for data in task:
            location_row = {}
            destination_row = {}
    
            if data.get('location_code'):
                location_query = f"select name,zone,region from location_master where sap_id = '{data['location_code']}'"
                location_data  = await urdhva_base.BasePostgresModel.get_aggr_data(location_query)
                location_row = ( location_data.get('data')[0] if location_data and location_data.get('data') else {})
    
            if data.get('destination_code'):
                destination_code = await self.clean_destination_code(data['destination_code'])
                destination_query = f"select name from location_master where sap_id = '{destination_code}'"
                destination_data = await urdhva_base.BasePostgresModel.get_aggr_data(destination_query)
                destination_row = ( destination_data.get('data')[0] if destination_data and destination_data.get('data') else {})

            # Add region from result to data
            data_with_region = {
                **data,
                "event_start_datetime": data.get("event_date"),
                "sap_id": data.get("location_code"),
                "bu": data.get("location_type"),
                "region": location_row.get('region'),
                "zone" : location_row.get('zone'),
                "location_name": location_row.get('name'),
                "destination_name": destination_row.get('name'), 
                "trip_status": hpcl_ceg_enum.VtsLive.TripOngoing.value

            }

            enriched_tasks.append(data_with_region)

        # Push all enriched tasks concurrently
        await asyncio.gather(
            *(hpcl_ceg_model.VtsOngoingTripsCreate(**data).create() for data in enriched_tasks)
        )

       

def usage():
    logger.info(f"Usage:- python {sys.argv[0]} <connector_name> <queue_name>{sys.argv[0]}")


if __name__ == "__main__":
    if len(sys.argv) == 1:
        print("Invalid arguments")
        usage()
        sys.exit(-1)
    asyncio.run(VTSOnGoingTripListener(sys.argv[1], "vts_ongoing_trips_queue").listener())
