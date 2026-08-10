from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import time
import asyncio

router = fastapi.APIRouter(prefix='/lpgplantoperations')


async def check_telnet(host_ip: str, port: int):
    start_time = time.time()
    try:
        # asyncio open_connection is fully async
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host_ip, port),
            timeout=5
            )
        writer.close()
        await writer.wait_closed()
        latency = round((time.time() - start_time) * 1000)  # ms
        return {"status": "live", "latency": f"{latency}"}
    except Exception:
        return {"status": "down", "latency": "-"}


# Action check_connection_status
@router.post('/check_connection_status', tags=['LpgPlantOperations'])
async def lpgplantoperations_check_connection_status(data: Lpgplantoperations_Check_Connection_StatusParams):
    sap_id = data.sap_id

    query = f"""
        SELECT id, sap_id, plant_name, ip_address, port_no
        FROM lpg_plants_master
        WHERE sap_id = '{sap_id}'
    """
    result = await LpgPlantsMaster.get_aggr_data(query=query, limit=1)
    rows = result.get("data", []) if result else []

    if not rows:
        return {"status": True, "message": "success", "data": {sap_id: []}}

    plants = []
    for row in rows:
        if not row.get("port_no"):
            continue
        plants.append({
            "plant_name": row.get("plant_name"),
            "host_ip": row.get("ip_address"),
            "port": int(row.get("port_no")),
        })

    if not plants:
        return {"status": True, "message": "success", "data": {sap_id: []}}

    # Run checks concurrently using asyncio
    tasks = [check_telnet(p['host_ip'], p['port']) for p in plants]
    statuses = await asyncio.gather(*tasks)

    # Combine results
    results = []
    for plant, status in zip(plants, statuses):
        results.append({
            "plant_name": plant["plant_name"],
            "status": status["status"],
            "latency": status["latency"]
        })

    return {
        "status": True,
        "message": "success",
        "data": {
            "sap_id": sap_id,
            "connection_status": results
        }
    }
