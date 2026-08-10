import pika
from opc_data_simulator import *


def callback(ch, method, properties, body):
    """
    Callback function that gets called when a message is received.

    Args:
        ch: The channel object.
        method: Delivery details.
        properties: Message properties.
        body: The message body (payload).
    """
    print(f"Received message: {body.decode()}")


def main():
    ins = OPCDataSimulator("data.json", "config.json")
    config_data = ins.load_config()
    location_id = config_data['location_id']
    rabbitmq_host = config_data['conn_host']
    rabbitmq_port = config_data['conn_port']
    queue_name = config_data['conn_channel']
    rabbitmq_exchange = config_data.get('conn_exchange', '')
    rabbitmq_vhost = config_data['conn_vhost']

    credentials = pika.PlainCredentials(config_data['conn_user'], config_data['conn_secret'])
    connection = pika.BlockingConnection(pika.ConnectionParameters(host=rabbitmq_host, port=rabbitmq_port,
                                                                   virtual_host=rabbitmq_vhost,
                                                                   credentials=credentials))

    channel = connection.channel()
    channel.queue_declare(queue=queue_name, durable=True)
    channel.basic_consume(queue=queue_name, on_message_callback=callback, auto_ack=True)

    print(f"Waiting for messages from queue: '{queue_name}'. To exit, press CTRL+C.")
    try:
        # Start consuming messages
        channel.start_consuming()
    except KeyboardInterrupt:
        print("Exiting...")
        channel.stop_consuming()
    connection.close()


if __name__ == "__main__":
    main()
