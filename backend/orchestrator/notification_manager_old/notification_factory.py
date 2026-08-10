"""Factory module for creating notification service instances.

This module provides a factory pattern implementation for creating different types
of notification service objects (SMS, Email, WhatsApp) based on the requested type.
"""

import orchestrator.notification_manager.notify_sms as notify_sms
import orchestrator.notification_manager.notify_email as notify_email
import orchestrator.notification_manager.notify_whatsapp as notify_whatsapp


async def get_notification_module(module_type):
    """Create and return a notification service instance based on the specified type.

    Args:
        module_type (str): The type of notification service to create.
                          Valid values are "sms", "email", or "whatsapp".

    Returns:
        NotificationBase or None: An instance of the requested notification service,
                                or None if the module_type is not recognized.
    """
    if module_type == "sms":
        return notify_sms.NotifySMS()
    elif module_type == "email":
        return notify_email.NotifyEMail()
    elif module_type == "whatsapp":
        return notify_whatsapp.NotifyWhatsApp()
    else:
        return None
