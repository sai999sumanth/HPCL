import asyncio
import asyncpg
import httpx
import urdhva_base
import os
import sys
import logging
from typing import Optional
sys.path.append("/opt/ceg/algo")
import orchestrator.dbconnector.credential_loader as credential_loader

logger = urdhva_base.Logger.getInstance("device_installation_aot_status")

creds_app = credential_loader.get_credentials('APP_DB')


HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
}


async def call_hpcl_status_api(
    client: httpx.AsyncClient,
    request_id: int
):
    """
    Call AOT Status API for a given request ID
    """
    try:
        response = await client.post(
            urdhva_base.settings.aot_status_url,
            json={"ID": str(request_id)},
            headers=HEADERS
        )
        
        print(f"API Response | ID={request_id} | Status={response.status_code}")
        
        if response.status_code // 100 != 2:
            print(f"API Error | ID={request_id} | Status={response.status_code} | Body={response.text}")
            return False, {
                "status_code": response.status_code,
                "body": response.text,
                "message": "Error to get the link"
            }
        
        return True, response.json()

    except httpx.TimeoutException:
        print(f"API Timeout | ID={request_id}")
        return False, {"error": "Request timeout"}

    except Exception as e:
        print(f"API Exception | ID={request_id} | Error={str(e)}")
        return False, {"error": str(e)}


async def process_record(
    conn: asyncpg.Connection,
    client: httpx.AsyncClient,
    record_id: int,
):
    """
    Fetch aot status and update device_installation table
    """
    success, response = await call_hpcl_status_api(client, record_id)

    if not success:
        return False

    if not response.get("success"):
        print(f"Failed  ID={record_id}")
        return False

    data_list = response.get("data") or []
    
    if not data_list or len(data_list) == 0:
        print(f"No data in response for ID={record_id}")
        return False
    
    record = data_list[0]
    print(f"Record received | ID={record_id} | Data={record}")
    
    sap_tt_no = record.get("SAP_TT_No")
    status = record.get("STATUS")
    request_type = record.get("REQUEST_TYPE")
    
    if not sap_tt_no or not status:
        print(f"Missing required fields | ID={record_id} | SAP_TT={sap_tt_no} | Status={status}")
        return False

    await conn.execute(
        """
        UPDATE device_installation
        SET
            aot_sap_tt_no = COALESCE(aot_sap_tt_no, $1),
            aot_status = $2,
            aot_request_type = $3,
            aot_last_checked_at = NOW()
        WHERE id = $4
        """,
        sap_tt_no,
        status,
        request_type,
        record_id,
    )

    print(
        f"Updated | ID={record_id} | Status={status} | SAP_TT={sap_tt_no} | Type={request_type}"
    )
    return True


async def run_aot_status_job():
    """
    - Fetch pending device_installation rows
    - Call AOT API and Update DB
    """
    conn: Optional[asyncpg.Connection] = None

    try:
        print("Connecting to database...")
        conn = await asyncpg.connect(
            user=creds_app['user'],
            password=creds_app['password'],
            host=creds_app['host'],
            port=creds_app['port'],
            database=creds_app['database']
        )
        print("Database connected")

        rows = await conn.fetch(
            """
            SELECT id
            FROM device_installation
            WHERE commissioning_status = 'SUCCESS'
            AND (
                aot_status IS NULL
                OR aot_status = 'REQUESTED'
                OR TRIM(aot_status) = ''
                OR aot_status = 'PENDING' OR  aot_status = 'IN PROGRESS'
            )
            ORDER BY id desc
            """
        )
        
        print(f"Processing {len(rows)} records")

        success_count = 0
        failure_count = 0

        async with httpx.AsyncClient(timeout=30) as client:
            for row in rows:
                record_id = row["id"]

                try:
                    if await process_record(conn, client, record_id):
                        success_count += 1
                    else:
                        failure_count += 1

                except Exception as e:
                    logger.error(f"Processing error | ID={record_id} | {e}")
                    failure_count += 1

                await asyncio.sleep(0.5)

        print(f"Job finished | Success={success_count} | Failed={failure_count}")
        
    except Exception as e:
        logger.error(f"Unexpected error | {e}")
        raise

    finally:
        if conn:
            await conn.close()
            print("Database connection closed")


if __name__ == "__main__":
    print("aot_status Sync  Started")
    asyncio.run(run_aot_status_job())