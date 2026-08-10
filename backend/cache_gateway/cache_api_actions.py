import urdhva_base
import os
import sys
import fastapi
import uvicorn
import logging
import cache_gateway.data_loader as cache_handler
import asyncio
import orchestrator.alerting.alert_helper as alert_helper


app = fastapi.FastAPI()

unique_id_lock = asyncio.Lock()

class LogFilter(logging.Filter):
    # Discarding fastapi logger
    def filter(self, record):
        # if record.args and len(record.args) >= 3:
        #     if record.args[2] in block_endpoints:
        #         return False
        return False


@app.get("/api_cache/v1/get_location_data")
async def get_location_data(bu: str, location_id: str):
    return await cache_handler.get_location_details(bu, location_id)


@app.get("/api_cache/v1/get_employee_details")
async def get_employee_details(bu: str, location_id: str, role: str):
    print("cache api actions role --> ", role)
    return await cache_handler.get_roles(bu, location_id, role)

@app.get("/api_cache/v1/get_unique_alert_id")
async def get_unique_alert_id(bu: str, sap_id: str, sop_id: str, device_id: str = None):  
    async with unique_id_lock:
        return await alert_helper.get_alert_unique_id(bu, sap_id, sop_id, device_id)


if __name__ == "__main__":
    port = urdhva_base.settings.cache_gateway_port
    host = "0.0.0.0"
    log_level: any = None
    reload: bool = False
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    # Disabling request logging
    uvicorn_logger = logging.getLogger("uvicorn.access")
    uvicorn_logger.addFilter(LogFilter())
    # Starting uvicorn rest api
    uvicorn.run("cache_gateway.cache_api_actions:app", host=host, port=port, log_level=log_level, reload=reload,
                reload_dirs=[os.getcwd()])
