import aio_pika
import json
import asyncio
from pika.credentials import PlainCredentials

async def connect_to_rabbitmq():
    # Directly use username and password in the connection URL
    username = 'hpcl_ceg'
    password = 'algo@4321'
    credentials = PlainCredentials(username, password)
    
    # Establish connection using the credentials object
    connection = await aio_pika.connect_robust(
        host='140.245.238.142',  # RabbitMQ host
        port=5672,  # RabbitMQ port
        virtualhost='hpcl_ceg',  # Virtual host name
        login=username,  # Use username directly
        password=password  # Use password directly
    )
    return connection

async def send_message(channel, queue_name, message):
    # Send message to the specified queue asynchronously
    await channel.default_exchange.publish(
        aio_pika.Message(
            body=message.encode(),  # Convert message to bytes
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT  # Make the message persistent
        ),
        routing_key=queue_name  # Queue name
    )
    print(f" [x] Sent {message}")

def create_message():
    # Create the message in JSON format
    message = {
        
            "location_id":"1128",
            "tags_data":{"TANK.51-TT-CR-003D.LEVEL":"1"}
        
    }
    return json.dumps(message)

async def main():
    # Connect to RabbitMQ
    connection = await connect_to_rabbitmq()
    async with connection:
        # Open a new channel
        channel = await connection.channel()

        # Declare the queue (durable means it will survive RabbitMQ restarts)
        queue_name = 'command_listener_1128'
        await channel.declare_queue(queue_name, durable=True)

        # Create the message
        for i in range(10):  
          message = create_message()

        # Send the message
          await send_message(channel, queue_name, message)

if __name__ == '__main__':
    asyncio.run(main())