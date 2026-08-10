import urdhva_base
import hpcl_ceg_model
import asyncio
import msgpack
import traceback
import mysql.connector
import typing
import redis.exceptions


import orchestrator.dbconnector.credential_loader as credential_loader


# ---------------------------------------------------------
# Load TIBCO Credentials
# ---------------------------------------------------------
tibco_creds = credential_loader.get_credentials("TIBCO")


# ---------------------------------------------------------
# Sync DB Fetch
# ---------------------------------------------------------
def _sync_fetch_from_tibco(query: str, params=None) -> typing.List[typing.Dict]:
    try:
        connection = mysql.connector.connect(
            host=tibco_creds['host'],
            user=tibco_creds['user'],
            passwd=tibco_creds['password'],
            port=tibco_creds['port']
        )

        cursor = connection.cursor()
        cursor.execute(query, params or ())
        rows = cursor.fetchall()

        columns = [col[0] for col in cursor.description]
        result = [dict(zip(columns, row)) for row in rows]

        cursor.close()
        connection.close()

        print(f"TIBCO: Fetched {len(result)} records")
        return result

    except Exception as e:
        print(f"TIBCO Error: {str(e)}")
        return []


# ---------------------------------------------------------
# Async Wrapper
# ---------------------------------------------------------
async def fetch_from_tibco(query: str, params=None) -> typing.List[typing.Dict]:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, _sync_fetch_from_tibco, query, params
    )


# ---------------------------------------------------------
# Queue Helper
# ---------------------------------------------------------
async def get_queue_ins(worker_queue_name):
    return urdhva_base.redispool.RedisQueue(worker_queue_name)


# ---------------------------------------------------------
# Queue Listener
# ---------------------------------------------------------
class VTSLoadTypeListener:

    QUEUE_NAME = "vts_load_type_processing"

    @classmethod
    async def start_listener(cls):
        try:
            queue_ins = await get_queue_ins(cls.QUEUE_NAME)

            print("VTS Load Type Queue Listener Started...")

            while True:
                try:
                    msg_data = await queue_ins.get()

                    if not msg_data:
                        await asyncio.sleep(1)
                        continue

                    data = msgpack.unpackb(msg_data)
                    row = data.get("vts_load_type")

                    if row:
                        await cls.process_record(row)

                except redis.exceptions.TimeoutError:
                    # Queue empty - normal case
                    await asyncio.sleep(1)
                    continue
                except Exception:
                    print("Error inside queue listener loop")
                    traceback.print_exc()

        except Exception:
            print("Error starting VTSLoadTypeListener")
            traceback.print_exc()

    # ---------------------------------------------------------
    # Process Each Record
    # ---------------------------------------------------------
    @staticmethod
    async def process_record(data: typing.Dict):

        alert_id = data.get("id")
        vehicle_number = data.get("vehicle_number")
        sap_id = data.get("sap_id")

        if not alert_id or not vehicle_number or not sap_id:
            print("Invalid data:", data)
            return

        try:

            fetch_query = """
                SELECT 
                    ztcs.transport_unit
                FROM CONN_ENT.ZSDCV_TRUCK_STG zts
                INNER JOIN CONN_ENT.ZSDCV_TRUCK_CO_STG ztcs
                    ON zts.TRUCK_NO = ztcs.TRUCK_NO
                WHERE zts.supplying_plant = %s
                  AND zts.TRUCK_NO = %s
                ORDER BY zts.LOAD_DT DESC
                LIMIT 1
            """

            result = await fetch_from_tibco(fetch_query, (sap_id, vehicle_number))

            print("TIBCO result:", result)

            if not result:
                print(f"No transport_unit found for {vehicle_number}")
                return

            transport_unit = result[0].get("transport_unit")

            if not transport_unit:
                print(f"transport_unit empty for {vehicle_number}")
                return

            # Update Alert
            await hpcl_ceg_model.Alerts(
                **{
                    "id": alert_id,
                    "load_type": transport_unit
                }
            ).modify()

            print(f"Alert {alert_id} updated with load_type {transport_unit}")

        except Exception:
            print("Error in process_record")
            traceback.print_exc()


# ---------------------------------------------------------
# Start Listener
# ---------------------------------------------------------
if __name__ == "__main__":
    asyncio.run(VTSLoadTypeListener.start_listener())