import urdhva_base
import hpcl_ceg_model 
import asyncio
import aiohttp
from datetime import datetime, timedelta
from typing import Dict, List
import pytz
import urdhva_base.redispool


CHECK_PERIOD_MINUTES = 5  # Monitoring period in minutes
API_BASE_URL = "https://localhost"  # Replace with your actual API URL

IST = pytz.timezone('Asia/Kolkata')


class SapMonitor:
    def __init__(self, interval_minutes: int):
        self.interval = interval_minutes * 60

    async def get_locations(self) -> List[Dict]:
        """Fetch onboarded locations"""
        query = """
        SELECT sap_id, name
        FROM location_master
        WHERE bu = 'TAS' AND location_onboard = true
        """
        result = await hpcl_ceg_model.LocationMaster.get_aggr_data(query)
        return result.get("data", [])

    async def send_failure(self, sap_id: str, location_name: str = None):
        """Send failure status to API"""
        payload = {
            "sap_id": sap_id,
            "status": "failed",
            "message": "Agent Stopped/No ping received",
            "location_name": location_name
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{API_BASE_URL}/api/tas/get_agent_service_status", json=payload) as resp:
                    if resp.status == 200:
                        print(f"Failure sent for {sap_id}")
        except Exception as e:
            print(f"Error sending failure for {sap_id}: {e}")

    async def monitor_loop(self):
        print("Starting SAP ID monitor...")
        redis_client = await urdhva_base.redispool.get_redis_connection()
        first_cycle = True 

        while True:
            try:
                locations = await self.get_locations()
                location_map = {loc["sap_id"]: loc["name"] for loc in locations}
                now_ist = datetime.now(IST)
                print(f"\n[{now_ist}] Monitoring {len(location_map)} SAP IDs")

                for sap_id, name in location_map.items():
                    # Get last ping time from Redis
                    last_ping_str = await redis_client.hget("tas_agent_up_status", sap_id)
                    if last_ping_str:
                        last_ping_time = datetime.fromisoformat(last_ping_str.decode())
                        if last_ping_time.tzinfo is None:
                            last_ping_time = IST.localize(last_ping_time)
                        # If last ping is older than CHECK_PERIOD, send failure
                        if not first_cycle and now_ist - last_ping_time > timedelta(minutes=CHECK_PERIOD_MINUTES):
                            print(f"last_ping {sap_id} - {last_ping_time}")
                            await self.send_failure(sap_id, name)
                    else:
                        if not first_cycle:
                            print(f"No ping record for {sap_id}, sending failure.")
                            await self.send_failure(sap_id, name)
                first_cycle = False
                await asyncio.sleep(self.interval)

            except Exception as e:
                print(f"Monitor error: {e}")
                await asyncio.sleep(60)


# Run monitor
if __name__ == "__main__":
    monitor = SapMonitor(interval_minutes=CHECK_PERIOD_MINUTES)
    asyncio.run(monitor.monitor_loop())
