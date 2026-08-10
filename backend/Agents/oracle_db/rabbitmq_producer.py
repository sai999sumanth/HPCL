import json
import aio_pika
import asyncio
import traceback

class RabbitMQProducer:
    def __init__(self, config_path="config.json"):
        """
        Load RabbitMQ configuration from JSON file for the producer.
        """
        
        with open(config_path, 'r') as config_file:
            config = json.load(config_file)

        self.rabbitmq_host = config.get('conn_host', '')
        self.rabbitmq_port = int(config.get('conn_port', 5672))  # Default RabbitMQ port
        self.rabbitmq_user = config.get('conn_user', '')
        self.rabbitmq_password = config.get('conn_secret', '')
        self.queue_name = config.get('conn_channel', '')
        self.virtualhost = config.get('conn_vhost', 'hpcl_ceg')
        self.connection = None  # Store connection instance

    async def connect(self):
        """
        Establish connection to RabbitMQ with automatic retry.
        """
        
        while True:
            try:
                print(f"Connecting to RabbitMQ ({self.rabbitmq_host})...")
                self.connection = await aio_pika.connect_robust(
                    host=self.rabbitmq_host,
                    port=self.rabbitmq_port,
                    virtualhost=self.virtualhost,
                    login=self.rabbitmq_user,
                    password=self.rabbitmq_password,
                    heartbeat=60
                )
                print("Connected to RabbitMQ!")
                return
            except Exception as e:
                print(f"Connection failed: {e}. Retrying")
                await asyncio.sleep(5)
                

    async def send_to_rabbitmq(self, data):
        """
        Send a list of dictionaries to RabbitMQ queue.
        """
        try:
            if self.connection is None or self.connection.is_closed:
                await self.connect()

            async with self.connection.channel() as channel:
                await channel.default_exchange.publish(
                    aio_pika.Message(body=json.dumps(data, default=str).encode()),
                    routing_key=self.queue_name
                )
                print(f"Message sent to RabbitMQ queue: {self.queue_name}")

        except Exception as ex:
            print(traceback.format_exc())
            print(f"Error sending data to RabbitMQ: {ex}")
            await asyncio.sleep(5)  # Prevent infinite fast retries
            await self.connect()  # Reconnect on failure


