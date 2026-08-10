import os.path
import typing
import pytz
import datetime
import traceback
import urdhva_base
from jinja2 import Template
from typing import Dict, List
import hpcl_ceg_model
from utilities.interlock_template_mapping import (
    InterlockTemplateMapping,
    TemplateMapping
)
from camunda.external_task.external_task import (
    ExternalTask,
    TaskResult
)

logger = urdhva_base.logger.Logger.getInstance("workflow_process-log")


class SendNotification:
    def __init__(self):
        """Initialize handler with Camunda external task"""
        self.alert_data = None
        self.params = None
        self.IST = pytz.timezone('Asia/Kolkata')
        self.roles_mapper = hpcl_ceg_model.RoleMaster  # TODO : NEED TO WRITE SEPERATE BLOCKS FOR EMAIL AND SMS BASED ON ROLES
        self.update_alert = {}
        self.mail_recipients = []
        self.sms_recipients = []
        self.subject = ""
        self.body = ""
        self.sms = ""

    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the action.

        Returns:
            list: A list of strings representing the required variables.
        """
        return [
            "alert_id", "BU", "interlock_name", "interlock_id", "messagetype",
            "msg_subject", "mqofrole", "location_type", "location_device_id",
            "rolemailto", "alert_id", "escalationlevel_inmail", "sap_id", "escalationtime_inmail"
        ]

    async def process(self, params: typing.Dict):
        self.params = params
        # return True, {"msg": "Notification skipped"}
        """Main processing method that orchestrates the notification flow"""
        try:
            if not await self._load_and_validate_alert():
                return await self._handle_invalid_alert()

            # if self._should_skip_notification():
            #     return True, {"msg": "Notification skipped"}

            await self._prepare_base_alert_data()
            await self._process_roles_and_users()
            await self._process_message_type()
            await self._send_notifications()
            await self._update_alert_status()

            return await self._create_task_result()

        except Exception as e:
            print(traceback.format_exc())
            # Log the error or add appropriate error handling
            return False, "Failed to process notification"

    async def _load_and_validate_alert(self) -> bool:
        """Load alert data and validate its existence"""
        alert_id = self.params.get("alert_id")
        print("alert_id --> ", alert_id)
        alert_data = await hpcl_ceg_model.Alerts.get(alert_id)

        if alert_data:
            self.alert_data = alert_data.__dict__ if not isinstance(alert_data, dict) else alert_data
            return True
        return False

    async def _process_roles_and_users(self):
        """Process roles and users for notifications"""
        bu = self.params.get("BU")
        sap_id = self.alert_data.get("plant_id", "")
        message_type = self.params.get("message_type")

    #         # Get roles based on business unit and message type
    #         roles = await self._get_roles(bu, sap_id)
    #         # Prepare recipients and message content
    #         await self._prepare_recipients(roles)
    #         await self._prepare_message_content(bu, message_type)

    async def _get_roles(self, bu: str, sap_id: str) -> List[Dict]:
        """Get users based on dynamically generated Redis key using BU, sap_id, and role"""
        roles_key = "roles"  # Assuming all roles data is stored under a single key "roles"
        redis_client = await urdhva_base.redispool.get_redis_connection()
        all_roles_data = await redis_client.hgetall(roles_key)

    #         # Filter users based on the dynamic key format
    #         matching_users = []
    #         for role_key, role_data in all_roles_data.items():
    #             # Generate the expected key format
    #             expected_key = f"{bu}_{sap_id}"
    #             if role_key.startswith(expected_key):
    #                 user_data = eval(role_data)  # Convert stored JSON string to dictionary if needed
    #                 matching_users.append({
    #                     "email": user_data.get("email"),
    #                     "phone": user_data.get("phone")
    #                 })

    #         return matching_users

    #     async def _prepare_recipients(self, users: List[Dict]):
    #         """Prepare email and SMS recipients"""
    #         for user in users:
    #             if user.get("email"):
    #                 self.mail_recipients.append(user["email"])
    #             if user.get("phone"):
    #                 self.sms_recipients.append(user["phone"])

    #         self.mail_recipients = list(dict.fromkeys(self.mail_recipients))
    #         self.sms_recipients = list(dict.fromkeys(self.sms_recipients))

    async def _prepare_message_content(self, bu: str, message_type: str):
        """Prepare message content (subject, body, and SMS)"""
        template_data = {
            **self.base_alert_data,
            "bu": bu,
            "message_type": message_type,
            "alert_details": self.alert_data.get("msg", ""),
            "status": self.update_alert.get("status", ""),
            "template": eval(f"TemplateMapping.{message_type.upper()}.value")
        }

        # Load templates based on message type and business unit
        templates = await self._load_message_templates(template_data['template'])

    #         # Render templates
    #         self.subject = Template(templates["subject"]).render(**template_data)
    #         self.body = Template(templates["body"]).render(**template_data)
    #         self.sms = Template(templates["sms"]).render(**template_data)

    async def _load_message_templates(self, template_name: str) -> Dict[str, str]:
        """Load message templates from configuration or database"""
        # This would typically load from a template store or database
        # For now, returning basic templates
        return {
            "subject": "{{ bu }} Alert: {{ action_msg }} - {{ interlock_name }}",
            "body": self.read_template(eval(f"InterlockTemplateMapping.{template_name.upper()}.value")),
            "sms": "{{ bu }} Alert: {{ action_msg }} - {{ interlock_name }} at {{ plant_location }}"
        }

    async def _handle_invalid_alert(self):
        """Handle case when alert is not found"""
        return False, "Alert not found"

    async def _should_skip_notification(self) -> bool:
        """Check if notification should be skipped based on message type and status"""
        message_type = self.params.get("message_type")
        logger.info(f"self.alert_data1: {self.alert_data}")
        active_msg = self.alert_data.get("active", False)
        closed_msg = self.alert_data.get("closed", False)

        if active_msg and message_type == "active":
            return True
        if closed_msg and message_type == "resolved":
            return True
        return False

    async def _prepare_base_alert_data(self):
        """Prepare basic alert data for notification"""
        # print("self.alert_data: ", self.alert_data)
        # logger.info(f"self.alert_data: {self.alert_data}")
        curr_time = datetime.datetime.now(self.IST).strftime('%d-%m-%Y %H:%M:%S')
        # opened_time = datetime.datetime.fromtimestamp(
        #     self.alert_data['created_at'], self.IST).strftime('%d-%m-%Y %H:%M:%S')
        opened_time = self.alert_data['created_at'].strftime('%d-%m-%Y %H:%M:%S')

        self.base_alert_data = {
            "alert_id": self.params.get("alert_id"),
            "interlock_name": await self._get_interlock_name(),
            "plant_id": self.alert_data.get("sap_id", ''),
            "plant_location": self.alert_data["location_name"][:30],
            "date_time": curr_time,
            "opened_time": opened_time,
            "portal_link": "https://ceg.hpcl.co.in",
            "user": self.params.get("user") or '',
            "asset_name": self.alert_data["device_type"],
            "asset_id": self.alert_data.get("device_name", self.alert_data["location_name"])
            # this should be location_id
        }

    async def _get_interlock_name(self) -> str:
        """Get interlock name from alert data"""
        return self.alert_data.get('sopName',
                                   self.alert_data.get("interlock_name", self.alert_data.get('msg', ''))
                                   )

    async def _process_message_type(self):
        """Process notification based on message type"""
        message_type = self.params.get("message_type")
        processors = {
            "escalation": self._process_escalation,
            "escalate": self._process_escalation,
            "active": self._process_active,
            "notify": self._process_notify,
            "reject": self._process_reject,
            "justified": self._process_justified,
            "resolved": self._process_resolved
        }

    async def _process_escalation(self):
        """Handle escalation type notifications"""
        bu = self.params.get("BU")
        self.base_alert_data["action_msg"] = "ESCALATED"

        self.update_alert["status"] = "Escalated"
        self.update_alert["isEscalated"] = True

    async def _process_active(self):
        """Handle active type notifications"""
        self.base_alert_data["action_msg"] = "ACTIVE"

    # async def _process_active(self):
    #     """Handle notify type notifications"""
    #     justify = self.params.get("justify", False)
    #     await self._process_approval("REQUEST", justify)

    async def _process_notify(self):
        """Handle notify type notifications"""
        justify = self.params.get("justify", False)
        await self._process_approval("REQUEST", justify)

    async def _process_reject(self):
        """Handle reject type notifications"""
        await self._process_approval("REQUEST REJECTED", False)

    async def _process_justified(self):
        """Handle justified type notifications"""
        await self._process_approval("REQUEST", True)

    async def _process_resolved(self):
        """Handle resolved type notifications"""
        self.base_alert_data.update({
            "action": "CLOSED",
            "reason_closure": "InterLock OK",
            "user": "CEG",
            "action_msg": "CLOSED"
        })
        self.update_alert["status"] = "closed"

    async def _process_approval(self, action_prefix: str, justify: bool):
        """Process approval-related notifications"""
        bu = self.params.get("BU")
        user = self.params.get("user", "").split('@')[0].strip()

        action = f"{action_prefix} {'APPROVED' if not justify else ''}"
        self.base_alert_data["action"] = action
        self.base_alert_data["action_msg"] = f"{action} by {user}"

        self.update_alert["status"] = "Pending Approval" if justify else "Request Approved"

    async def _send_notifications(self):
        """Send notifications based on business unit and message type"""
        bu = self.params.get("BU").upper()
        sop_id = self.alert_data.get('sop_id')

    #         await self._send_notifications_with_sms(bu)

    async def _send_notifications_with_sms(self, bu: str):
        """Send notifications with SMS based on business unit"""
        message_type = self.params.get("message_type")

        if message_type == "active":
            await self._send_active_notification()
        elif message_type == "resolved":
            await self._send_resolved_notification()
        elif message_type == 'Resolved':
            await self._send_other_notification()
        else:
            await self._send_standard_notification()

    async def _send_active_notification(self):
        """Send notifications for LPG/TAS active messages"""
        await self.send_email_with_sms(
            self.mail_recipients, self.sms_recipients,
            self.subject, self.body, self.sms, True
        )

    async def _send_resolved_notification(self):
        """Send notifications for LPG/TAS resolved messages"""
        sent_sms = self.alert_data.get('sentsms', '').split(",")
        await self.send_email_with_sms(
            self.mail_recipients, sent_sms,
            self.subject, self.body, self.sms, True
        )

    async def _send_other_notification(self):
        """Send notifications for other LPG/TAS messages"""
        await self.send_email_with_sms(
            self.mail_recipients, [],
            self.subject, self.body, self.sms, True
        )

    async def _send_standard_notification(self):
        """Send standard notifications"""
        await self.send_email_with_sms(
            self.mail_recipients, self.sms_recipients,
            self.subject, self.body, self.sms, True
        )

    async def _update_alert_status(self):
        """Update alert status in database"""
        alert_id = self.params.get("alert_id")
        self.update_alert['id'] = alert_id
        # print(self.params)
        # print('self.params.get("rolemailto")', self.params.get("rolemailto"))
        # print('self.params.get("mqofrole")', self.params.get("mqofrole"))
        # if self.params.get("escalationlevel_inmail"):
        #     self.update_alert['last_escalated_to'] = self.params.get("rolemailto").split(',')
        #     self.update_alert['assigned_user_roles'] = self.params.get("mqofrole").split(',')
        #     self.update_alert['last_mailed_to'] = self.params.get("rolemailto").split(',')
        # else:
        #     self.update_alert['last_notified_to'] = self.params.get("rolemailto").split(',')
        #     self.update_alert['assigned_user_roles'] = self.params.get("mqofrole").split(',')
        #     self.update_alert['last_mailed_to'] = self.params.get("rolemailto").split(',')
        # print("**self.update_alert", self.update_alert)
        alert_data = hpcl_ceg_model.Alerts(**self.update_alert)
        print("alert_data ", alert_data)
        await alert_data.modify()

    @staticmethod
    def read_template(filename):
        filename = os.path.join(urdhva_base.settings.template_path, filename)
        with open(filename, 'r') as f:
            html_string = f.read()
        return html_string

    async def handle_task_notification(self, params: typing.Dict):
        """Main entry point for handling task notifications"""
        # handler = SendNotification(task)
        return await self.process(params)

    async def send_email_with_sms(self, mail_recipients, sms_recipients, subject, body, sms, is_active):
        pass

    async def _create_task_result(self):
        if "_sa_instance_state" in self.alert_data.keys():
            del self.alert_data["_sa_instance_state"]
        return True, {"alert_id": self.params['alert_id']}