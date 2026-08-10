import urdhva_base
import json
import asyncio
import aio_pika
import traceback
import tas_listener

logger = urdhva_base.logger.Logger.getInstance("rabbitmq_processing_log")

semaphore = asyncio.Semaphore(1)
async def on_message(message: aio_pika.abc.AbstractIncomingMessage) -> None:
    """
    Callback for processing received messages.
    """
    async with message.process(ignore_processed=True):
        async with semaphore:
            try:
                # Process the message
                payload = json.loads(message.body.decode())
                print(f"Received message: {payload}")
                await tas_listener.tas_listener(payload)
            except Exception as e:
                print(traceback.format_exc())
                print(f"Error processing message: {e}")
            # Manual acknowledgment is not needed if auto_ack=True.

async def consume_from_queue(queue_name: str, channel) -> None:
    """
    Consume messages from a specific queue.
    """
    try:
        # Declare the queue (idempotent)
        queue = await channel.declare_queue(
            name=queue_name,
            durable=True,
        )

        # Start consuming messages from the queue
        print(f"Waiting for messages in queue: '{queue_name}'")
        await queue.consume(on_message, no_ack=urdhva_base.settings.rabbitmq_auto_ack)

    except Exception as e:
        print(f"Error while consuming from queue {queue_name}: {e}")

async def consume_message():
    """
    Asynchronous consumer to read messages from RabbitMQ queues.
    """
    try:
        # Connect to RabbitMQ server
        connection = await aio_pika.connect_robust(
            host=urdhva_base.settings.rabbitmq_host,
            port=urdhva_base.settings.rabbitmq_port,
            login=urdhva_base.settings.rabbitmq_username,
            password=urdhva_base.settings.rabbitmq_password,
            virtualhost=urdhva_base.settings.rabbitmq_vhost,
        )

        async with connection:
            # Create a channel
            channel = await connection.channel()
            await channel.set_qos(prefetch_count=1)

            # List of queues to consume
            rabbitmq_queues = urdhva_base.settings.rabbitmq_queue
            cleaned_queues = rabbitmq_queues.strip("[]").replace("'", "").split(',')

            # Strip any extra spaces from each queue name
            rabbitmq_queues_list = [queue.strip() for queue in cleaned_queues]

            # Print to verify the correct format
            print(f"Queue names: {rabbitmq_queues_list}")

            # Now consume messages from each queue
            for queue_name in rabbitmq_queues_list:
                asyncio.create_task(consume_from_queue(queue_name, channel))
            # Keep the consumer running
            await asyncio.Future()  # Runs indefinitely until interrupted

    except aio_pika.exceptions.AMQPConnectionError as e:
        print(f"Connection error: {e}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(consume_message())
