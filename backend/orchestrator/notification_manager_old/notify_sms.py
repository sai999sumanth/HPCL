import orchestrator.notification_manager.notification_manager as notification_manager


class NotifySMS(notification_manager.NotificationManager):
    def __init__(self):
        super().__init__()
        self.notification_type = "SMS"

    def load_credentials(self):
        """
        Function to load credentials
        :return:
        """

    def publish_message(self, body, subject, to_email, from_email=None, cc=None, **kwargs):
        """
        Function to send an email
        :param body:
        :param subject:
        :param to_email:
        :param from_email:
        :param cc:
        :param kwargs:
        :return:
        """


