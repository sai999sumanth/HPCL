from multiprocessing.connection import Client
import os
import json
import asyncio
import requests
import asyncua
import pika
from pathlib import Path

class ConnectionConfig:
    def __init__(self, config_path):
        """
        Load configuration from local JSON file
        """
        with open(config_path, 'r') as config_file:
            config = json.load(config_file)

        # Central server configuration
        self.central_server = config.get('central_server')
        self.api_key = config.get('Api_Key')
        self.location_id = config.get('location_id')

        # OPC UA Server Configuration
        self.opc_url = config.get('opc_ua_url')
        self.username = config.get('opc_ua_user', "")
        self.password = config.get('opc_ua_password', "")
        self.OpcIpAddresses = config.get('OpcIpAddresses', "")
        self.connection_parameter = int(config.get('connection_parameter',""))


        # RabbitMQ Configuration
        self.rabbitmq_host = config.get('conn_host', '')
        self.rabbitmq_port = int(config.get('conn_port', ''))
        self.rabbitmq_user = config.get('conn_user', '')
        self.rabbitmq_password = config.get('conn_secret', '')
        self.queue_name = f"{config.get('conn_channel', '')}{self.location_id}"


class OPCUASimulator:
    def __init__(self, config_path):
        """
        Initialize OPC UA Simulator with configuration
        """
        self.config = ConnectionConfig(config_path)

    def download_location_json(self):
        """
        Download JSON from central server for specific location
        """
        try:
            # Construct the full URL
            if not self.config.central_server or not self.config.api_key:
                raise ValueError("Central server or API key is missing in the configuration.")

            full_url = f"{self.config.central_server}?location_id={self.config.location_id}"
            headers = {"X-API-Key": self.config.api_key}
            response = requests.get(full_url, headers=headers)
            response.raise_for_status()

            # Save the downloaded JSON to a local file
            base_directory = Path(__file__).resolve().parent
            output_file_path = base_directory / f"{self.config.location_id}.json"

            with open(output_file_path, 'w') as f:
                f.write(response.text)

            return output_file_path
        except Exception as ex:
            print(f"Error downloading JSON from API: {ex}")
            raise

    def load_sensor_tags(self, file_path):
        """
        Load sensor tags from downloaded JSON
        """
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)

            sensor_tags = []
            for device in data.get('data', []):
                sensors = device.get('sensors', [])
                sensor_tags.extend([sensor['sensor_tag'] for sensor in sensors])

            return sensor_tags
        except Exception as ex:
            print(f"Error reading sensor tags from {file_path}: {ex}")
            return []

    async def connect_opc_ua_server(self):
        """
        Connect to OPC UA Server
        """
        for url in self.config.opc_urls:
            try:
                print(f"Trying to connect to OPC UA server: {url}")
                client = Client(url)
                await asyncio.wait_for(client.connect(), timeout=self.config.connection_parameter)
                print(f"Connected to OPC UA server: {url}")
                return client
            except Exception as ex:
                print(f"Failed to connect to {url}: {ex}")
        raise Exception("Unable to connect to any OPC UA servers.")
    async def read_node_values(self, client, node_ids):
        """
        Read values from specified OPC UA nodes
        """
        tags_data = {}
        for node_id in node_ids:
            try:
                node = client.get_node(f"ns=4;s={node_id}")
                value = await node.read_value()
                tags_data[node_id] = value
            except Exception as ex:
                print(f"Error reading node {node_id}: {ex}")

        return tags_data

    def send_to_rabbitmq(self, data):
        """
        Send data to RabbitMQ queue
        """
        try:
            credentials = pika.PlainCredentials(
                self.config.rabbitmq_user,
                self.config.rabbitmq_password
            )
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host=self.config.rabbitmq_host,
                    port=self.config.rabbitmq_port,
                    credentials=credentials
                )
            )
            channel = connection.channel()

            # Declare queue
            channel.queue_declare(queue=self.config.queue_name, durable=True)

            # Prepare message
            message = json.dumps({
                'location_id': self.config.location_id,
                'tags_data': data
            })

            channel.basic_publish(
                exchange='',
                routing_key=self.config.queue_name,
                body=message
            )

            connection.close()
        except Exception as ex:
            print(f"Error sending data to RabbitMQ: {ex}")

    async def run(self):
        """
        Main execution method
        """
        try:
            # Download location-specific JSON
            json_file_path = self.download_location_json()

            # Load sensor tags from downloaded JSON
            sensor_tags = self.load_sensor_tags(json_file_path)

            # Connect to OPC UA server
            opc_client = await self.connect_opc_ua_server()

            try:
                # Read values for sensor tags
                tags_data = await self.read_node_values(opc_client, sensor_tags)

                # Send data to RabbitMQ
                self.send_to_rabbitmq(tags_data)
            finally:
                await opc_client.disconnect()

        except Exception as ex:
            print(f"Error in main execution: {ex}")

def main():
    # Configuration file path
    config_path = 'config.json'

    # Create simulator and run
    simulator = OPCUASimulator(config_path)
    asyncio.run(simulator.run())

if __name__ == "__main__":
    main()
