class NotificationManager:
    def __init__(self):
        self.notification_type = ''

    @classmethod
    def load_credentials(cls):
        """
        Function to load credentials
        :return:
        """
        ...

    def publish_message(self, **kwargs):
        """
        Function to publish message(SMS/Email/Whatsapp Message)
        :param kwargs:
        :return:
        """
        ...
