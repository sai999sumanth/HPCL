import urdhva_base
import traceback
import aio_pika
import json
import asyncio

async def send_command_rabbitmq(message, queue_name):
    """
    Sends a command to RabbitMQ.
    This function connects to RabbitMQ, declares a queue, and sends a message to that queue.

    Args:
        message (dict): The message to be sent.
        queue_name (str): The name of the queue to send the message to (should be unique)

    Returns:
        tuple: A tuple containing a boolean indicating success and a message string.
    """
    try:
        connection = await aio_pika.connect_robust(
            host=urdhva_base.settings.rabbitmq_host,
            port=urdhva_base.settings.rabbitmq_port,
            virtualhost=urdhva_base.settings.rabbitmq_vhost,
            login=urdhva_base.settings.rabbitmq_username,
            password=urdhva_base.settings.rabbitmq_password
        )
        async with connection:
            channel = await connection.channel()
            # Print the queue name for debugging
            print(f"Queue name sending to RabbitMQ: {queue_name}")
            # Declare the queue
            await channel.declare_queue(queue_name, durable=True)
            # Create and send the message
            await channel.default_exchange.publish(
                aio_pika.Message(
                    body=json.dumps(message).encode(),
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                ),
                routing_key=queue_name
            )
            return True, {"Message": "Command successfully sent to RabbitMQ"}
    except Exception as e:
        print(f"Error in send command to RabbitMQ: {e}")
        print(traceback.format_exc())
        return False, str(e)

# if __name__ == "__main__":
    # Dynamically construct the queue name
    # sap_id = "1919"
    # queue_name = f"command_write_{sap_id}"
    # message = {
    #     "command": "write",
    #     "sensor_tag": "tag_name",
    #     "value": 1
    # }
    # asyncio.run(send_command_rabbitmq(message, queue_name))