import msgpack
import urdhva_base


async def enqueue_vts_load_type_processing(alert_row):
    """
    Push alert data to VTS load type processing queue
    """

    try:
        queue_ins = urdhva_base.redispool.RedisQueue("vts_load_type_processing")

        input_data = {
            "vts_load_type": alert_row
        }

        msg_data = msgpack.packb(input_data)

        await queue_ins.put(
            msg_data,
            skip_on_exists=True
        )

    except Exception as e:
        print("Failed to enqueue VTS load type processing:", e)