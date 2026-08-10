import orchestrator.notification_manager.notify_sms as notify_sms
import orchestrator.notification_manager.notify_email as notify_email
import orchestrator.notification_manager.notify_whatsapp as notify_whatsapp


async def get_notification_module(module_type):
    """
    Factory class generator for notification module
    :param module_type: Type of notification to create ("sms", "email", "whatsapp")
    :return: Instance of corresponding notification class
    """
    if module_type == "sms":
        return notify_sms.NotifySMS()
    elif module_type == "email":
        return notify_email.NotifyEMail()
    elif module_type == "whatsapp":
        return notify_whatsapp.NotifyWhatsApp()  # Assuming this exists
    else:
        return None
