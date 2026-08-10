class NotificationManager:
    def __init__(self):
        self.notification_type = ''

    @classmethod
    def load_credentials(cls):
        """
        Function to load credentials, can be implemented by subclasses
        :return:
        """
        pass

    async def publish_message(self, **kwargs):
        """
        Function to publish message(SMS/Email/Whatsapp Message)
        :param kwargs:
        :return:
        """
        pass
