import urdhva_base
from orchestrator.notification_manager.notification_manager import NotificationManager


class NotifyWhatsApp(NotificationManager):
    def __init__(self):
        super().__init__()
        self.notification_type = "WhatsApp"

    @classmethod
    def load_credentials(cls):
        """
        Function to load credentials
        :return:
        """
        return urdhva_base.settings.whatsapp_creds

    def publish_message(self, **kwargs):
        """
        Function to publish message(Whatsapp Message)
        :param kwargs:
        :return:
        """
        ...
