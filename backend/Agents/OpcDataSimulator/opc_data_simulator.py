import os
import pika
import json
import time
import requests


class OPCDataSimulator:
    def __init__(self, data_file, config_file):
        self.data_file = data_file
        self.config_file = config_file
        self.config_data = self.load_config()
        self.headers = {}

    def load_data(self):
        # return {"SAFETY_PLC.SCS0101.OPN_HCD01_H": 1, "SAFETY_PLC.SCS0101.OPN_HCD01_HH": 1}
        with open(self.data_file, "r") as f:
            data = json.load(f)
        return data

    def load_config(self):
        with open(self.config_file, "r") as f:
            config = json.load(f)
        return config

    def prepare_simulated_data(self, location_id):
        data = self.load_data()
        publishing_data = []
        with open(f"{location_id}.json") as f:
            sensor_data = json.load(f)
            for device_data in sensor_data["data"]:
                for sensor in device_data["sensors"]:
                    if sensor['sensor_tag'] in data:
                        publishing_data.append({"device_id": device_data["device_id"],
                                                "sensor_name": sensor["sensor_name"],
                                                "value": data[sensor['sensor_tag']],
                                                "device_type": device_data["device_type"],
                                                "device_key": device_data["device_key"],
                                                "device_name": device_data["device_name"]
                                                })
        return publishing_data

    def publish_telemetry_data(self, device_data):
        headers = {"Content-Type": "application/json"}

        payload = {device_data['sensor_name']: device_data['value']}
        telemetry_url = f"{self.config_data['things_board_url']}/api/v1/{device_data['device_key']}/telemetry"
        resp = requests.post(telemetry_url, json=payload, headers=headers)
        if resp.status_code // 100 != 2:
            print(resp.status_code, resp.text)

    def run(self):
        location_id = self.config_data['location_id']
        # rabbitmq_host = self.config_data['conn_host']
        # rabbitmq_port = self.config_data['conn_port']
        # rabbitmq_channel = self.config_data['conn_channel']
        # rabbitmq_exchange = self.config_data.get('conn_exchange', '')
        # rabbitmq_vhost = self.config_data['conn_vhost']
        # print("Connecting to OPC Data ingestion node")
        # credentials = pika.PlainCredentials(self.config_data['conn_user'], self.config_data['conn_secret'])
        # connection = pika.BlockingConnection(pika.ConnectionParameters(host=rabbitmq_host, port=rabbitmq_port,
        #                                                                virtual_host=rabbitmq_vhost,
        #                                                                credentials=credentials))
        # channel = connection.channel()
        # channel.queue_declare(queue=rabbitmq_channel)
        print("Starting OPC Data Publisher")
        while True:
            # Loading data
            data = self.prepare_simulated_data(location_id)
            # print(data)
            for device_data in data:
                # print(device_data)
                self.publish_telemetry_data(device_data)
            # channel.basic_publish(routing_key=rabbitmq_channel, exchange=rabbitmq_exchange, body=json.dumps(data))
            print("Data Published")
            break
            # time.sleep(60)
        # connection.close()


def main():
    OPCDataSimulator("data_old.json", "config.json").run()


if __name__ == "__main__":
    main()
