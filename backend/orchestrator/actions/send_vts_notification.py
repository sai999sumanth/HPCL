import os.path
import typing
import pytz
import aiofiles
import datetime
import traceback
import urdhva_base
from jinja2 import Template
from typing import Dict, List
import hpcl_ceg_model
import hpcl_ceg_enum
from collections import defaultdict
import utilities.va_alert_mapping as va_alert_mapping
import utilities.vts_instance_mapping as vts_violation_role_mapping
import utilities.emlock_mapping as emlock_mapping
import orchestrator.analytics.vts_analysis as vts_analysis
import utilities.lpg_role_configuration as lpg_role_configuration
import utilities.cris_alert_mapping as cris_alert_mapping
import utilities.tas_role_configuration as tas_role_configuration
from utilities.interlock_template_mapping import (
    InterlockTemplateMapping,
    TemplateMapping
)
from camunda.external_task.external_task import (
    ExternalTask,
    TaskResult
)
import cache_gateway.cache_api_actions as cache_api_actions
import orchestrator.notification_manager.notification_factory as notification_factory

logger = urdhva_base.logger.Logger.getInstance("workflow_process_log_vts")

class SendVTSNotification:
    def __init__(self):
        """
        Initialize SendNotification object.

        Attributes:
            alert_data (dict): alert data
            params (dict): task parameters
            IST (pytz.timezone): IST timezone
            roles_mapper (dict): dictionary mapping roles to users
            update_alert (dict): alert data to be updated
            mail_recipients (list): list of email recipients
            sms_recipients (list): list of phone recipients
            subject (str): subject of the email
            body (str): body of the email
            sms (str): body of the SMS
        """
        self.alert_data = None
        self.params = None
        self.IST = pytz.timezone('Asia/Kolkata')
        self.roles_mapper = {}
        self.update_alert = {}
        self.mail_recipients = []
        self.sms_recipients = []
        self.subject = ""
        self.body = ""
        self.sms = ""
        self.usernames = set()
        self.transporter_details = {}
        self.template_path = ""
        self.interlock_name = ""
        self.days = 0
        self.vts_assigned_role = ""
    

    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the action.

        Returns:
            list: A list of strings representing the required variables.
        """
        return [
            "alert_id", "BU", "interlock_name", "messagetype",
            "msg_subject", "mqofrole", "bu", "vts_level",
            "rolemailto", "escalationlevel_inmail", "sap_id", "escalationtime_inmail"
        ]
    
    async def _load_and_validate_alert(self) -> bool:
        """
        Load alert data and validate its existence.

        Returns:
            bool: True if alert data is found, False otherwise.
        """
        alert_id = self.params.get("alert_id")
        print("alert_id --> ", alert_id)
        alert_data = await hpcl_ceg_model.ViolationHistoryVts.get(alert_id)

        if alert_data:
            self.alert_data = alert_data.__dict__ if not isinstance(alert_data, dict) else alert_data
            if self.alert_data['vendor_id']:
                query = (f"transporter_code='{self.alert_data['vendor_id']}'")
                transporter_details_data = await hpcl_ceg_model.EmailMaster.get_all(urdhva_base.queryparams.QueryParams(q=query),
                                                                                    resp_type='plain')
                if len(transporter_details_data.get("data",[])):
                    self.alert_data['transporter_name'] = transporter_details_data['data'][0]['transporter_name']
            return True
        return False
    
    async def _handle_invalid_alert(self):
        """
        Handle case when alert is not found.

        Returns:
            tuple: A tuple containing a boolean indicating failure, and a string
            describing the reason.
        """        
        return False, "Alert not found"
    
    async def _get_interlock_name(self) -> str:
        """
        Retrieve the interlock name from alert data.

        This method attempts to fetch the interlock name from the alert data
        in a prioritized order. It first looks for the 'sopName'. If 'sopName'
        is not present, it checks for 'interlock_name'. If neither is available,
        it defaults to the 'msg' field.

        Returns:
            str: The interlock name if found, otherwise an empty string.
        """
        return self.alert_data.get('sopName', self.alert_data.get("violation_name", self.alert_data.get('msg', '')))
    
    async def _prepare_recipients(self, users: Dict[str, List[Dict[str, str]]]):
        """
        Prepare email and SMS recipients based on the given user dictionary.

        Args:
            users (Dict[str, List[Dict[str, str]]]): A dictionary with roles as keys and a list of dictionaries with user details as values.

        Returns:
            None
        """
        print("users --> ", users)

        for role, user_list in users.items():  # Iterate over roles
            for user in user_list:  # Iterate over users in each role
                email = user.get("email")
                phone = user.get("phone")

                if email:
                    self.mail_recipients.append(email)
                if phone:
                    self.sms_recipients.append(phone)

        # Remove duplicates while maintaining order
        self.mail_recipients = list(dict.fromkeys(self.mail_recipients))
        self.sms_recipients = list(dict.fromkeys(self.sms_recipients))
    
    async def read_template(self, filename: str) -> str:
        """
        Reads a template file asynchronously and returns its content as a string.

        Args:
            filename (str): The name of the template file to read.

        Returns:
            str: The content of the template file.

        Raises:
            FileNotFoundError: If the template file is not found.
        """
        try:
            print("filename---->",filename)
            filepath = os.path.join(urdhva_base.settings.template_path, filename)
            self.template_path = filepath
            async with aiofiles.open(filepath, 'r') as f:
                return await f.read()
        except FileNotFoundError:
            logger.error(f"Template file not found: {filename}")
            return ""
    
    async def _load_message_templates(self, template_name: str) -> Dict[str, str]:
        """
        Load message templates based on the provided template name.

        This method retrieves and returns the template and body content for a given
        template name. It uses the message type from the parameters to fetch the 
        corresponding template from the TemplateMapping. Additionally, it reads the
        body content from the InterlockTemplateMapping based on the template name.

        Args:
            template_name (str): The name of the template to load.

        Returns:
            Dict[str, str]: A dictionary containing the template and body content.
        """
        message_type = self.params.get("messagetype", "").upper()
        template_value = getattr(TemplateMapping, message_type, None)
        template = template_value.value if template_value else ""
        interlock_value = getattr(InterlockTemplateMapping, template.upper(), None)
        body = await self.read_template(interlock_value.value) if interlock_value else ""
        return {"template": template, "body": body}

    async def _prepare_message_content(self, bu: str, message_type: str):
        """
        Prepare the message content for notifications, including the subject and body.

        This method constructs and renders the notification subject and body templates
        based on the provided business unit (BU) and message type, along with alert data.
        It uses the base alert data, alert details, and status to populate the templates.

        Args:
            bu (str): The business unit for which the notification is being prepared.
            message_type (str): The type of message (e.g., alert, notification) to determine
                the appropriate templates.

        Returns:
            None: The method sets the subject and body attributes with the rendered content.
        """
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
        # Render templates
        sap_id = self.alert_data.get("sap_id", "")
        alert_section = self.alert_data.get("alert_section", "")
        location_name = self.alert_data.get("location_name", "")

        # Construct the subject template
        subject_template = f"{self.params.get('msg_subject', '')} for BU: {bu}, Location Name: {location_name}({sap_id})"

        # Render the final subject
        self.subject = Template(subject_template).render(**template_data)

        # self.subject = Template(self.params.get("msg_subject")).render(**template_data)
        self.body = Template(templates["body"]).render(**template_data)
        # self.sms = Template(templates["sms"]).render(**template_data)
    
    # Identify the roles and users who should receive notifications for this alert.
    async def _process_roles_and_users(self):
        """
        Process roles and users for notifications.

        This method retrieves the roles and users associated with an alert based
        on the business unit, location, and message type. It stores the roles and
        users in the `roles_mapper` dictionary with the key "rolemailto". The
        values are a list of dictionaries where each dictionary represents a user
        and contains the keys "email" and "phone". The method then calls the
        `_prepare_recipients` and `_prepare_message_content` methods to prepare
        the recipients and message content.

        Args:
            None

        Returns:
            None
        """
        bu = self.params.get("BU")
        sap_id = self.alert_data.get("sap_id", "")
        message_type = self.params.get("messagetype", '')
        roles_list = ""
        # Fetch the configured roles that should receive this notification.
        roles_list = (await self._role_configuration_rolemailto() or "")
        print("bu --> ", bu)
        print("sap_id --> ", sap_id)
        print("message_type --> ", message_type)
        print("roles_list --> ", roles_list)
        # Get roles based on business unit and message type
        # status, roles = await cache_api_actions.get_location_data(bu, sap_id)
        status, roles = await cache_api_actions.get_employee_details(bu=bu, location_id=sap_id, role=roles_list)
        print("roles --> ", roles)
        # self.base_alert_data["email"] = [role["email"] for role in roles if "email" in role and role["email"]]
        # print("self.base_alert_data['email']" , self.base_alert_data["email"])
        # self.roles_mapper["roles"] = self.base_alert_data["email"]
        # # Prepare recipients and message content
        # print("roles --> ", roles)
        self.roles_mapper["rolemailto"] = defaultdict(list)
        print("self.roles_mapper['rolemailto']", self.roles_mapper["rolemailto"])
        # Create a role-to-recipient mapping where each role stores its users.
        for role in roles:
            # Extract the employee's roles and contact details.
            role_name = role.get("novex_role", [])  # Choose appropriate key
            email = role.get("email", "")
            phone = role.get("phone", "")
            self.usernames.add(role.get("username",""))
            
            if email or phone:  # Ensure we only add roles with at least one contact detail
                for single_role in role_name:
                    self.roles_mapper["rolemailto"][single_role].append({"email": email, "phone": phone})

        # Convert defaultdict to a normal dictionary
        self.roles_mapper["rolemailto"] = dict(self.roles_mapper["rolemailto"])
        await self._prepare_recipients(self.roles_mapper["rolemailto"])
        if message_type is not None:
            await self._prepare_message_content(bu, message_type)
    
    async def _prepare_base_alert_data(self):
        """
        Prepare the base alert data for notifications.

        This method constructs a dictionary with base alert data from the alert data
        and parameters. The dictionary includes the alert ID, interlock name, plant ID,
        plant location, portal link, user, asset name, date and time, and opened time.

        Returns:
            dict: A dictionary containing the base alert data.
        """
        # logger.info(f"self.alert_data: {self.alert_data}") 

        self.base_alert_data = {
            "alert_id": self.params.get("alert_id"),
            "interlock_name": self.interlock_name if self.interlock_name else await self._get_interlock_name(),
            "plant_id": self.alert_data.get("sap_id", ''),
            "plant_location": self.alert_data["location_name"][:30],
            "portal_link": "https://ceg.hpcl.co.in",
            "user": self.params.get("user") or '',
            "date_time": datetime.datetime.now(self.IST).strftime('%d-%m-%Y %H:%M:%S'),
            "opened_time": self.alert_data['created_at'].strftime('%d-%m-%Y %H:%M:%S'),
            "days": self.days if self.days else 0,
            "transporter_name": self.alert_data['transporter_name'] if self.alert_data.get('transporter_name','') else "",
            "block_start_date": self.alert_data['vehicle_blocked_start_date'].strftime("%d.%m.%Y") if self.alert_data.get('vehicle_blocked_start_date',None) else None,
            "block_end_date": self.alert_data['vehicle_blocked_end_date'].strftime("%d.%m.%Y") if self.alert_data.get('vehicle_blocked_end_date',None) else None,
            "unblock_date": self.alert_data['vehicle_unblocked_date'].strftime("%d.%m.%Y") if self.alert_data.get('vehicle_unblocked_date',None) else None,
            "vts_assigned_role": self.vts_assigned_role if self.vts_assigned_role else "",
            "asset_id": self.alert_data.get("device_name", self.alert_data["location_name"]) # this should be location_id
        }
        return self.base_alert_data
    
    async def _process_escalation(self):
        """
        Handle escalation type notifications.

        This method updates the base alert data with the action type set to
        "Escalated" and the action message set to the message subject from the
        parameters.

        Returns:
            None
        """
        self.base_alert_data["action_type"] = hpcl_ceg_enum.AlertState.Escalated.value
        self.base_alert_data["action_msg"] = self.params.get("msg_subject")

    async def _process_active(self):
        """
        Handle active type notifications.

        This method updates the base alert data by setting the action type to
        "Active" and the action message to the subject of the message from the
        parameters.

        Returns:
            None
        """
        print("_process_active")
        self.base_alert_data["action_type"] = hpcl_ceg_enum.AlertActionType.Active.value
        self.base_alert_data["action_msg"] = self.params.get("msg_subject")

    async def _process_notify(self):
        """
        Handle notify type notifications.

        This method updates the base alert data by setting the action type to
        "Notified" and the action message to the subject of the message from the
        parameters.

        Returns:
            None
        """
        self.base_alert_data["action_type"] = hpcl_ceg_enum.AlertState.Notified.value
        self.base_alert_data["action_msg"] = self.params.get("msg_subject")

    async def _process_reject(self):
        """
        Handle reject type notifications.

        This method updates the base alert data by setting the action type to
        "Rejected" and the action message to the subject of the message from the
        parameters.

        Returns:
            None
        """
        self.base_alert_data["action_type"] = hpcl_ceg_enum.AlertActionType.Rejected.value
        self.base_alert_data["action_msg"] = self.params.get("msg_subject")

    async def _process_justified(self):
        """
        Handle justification type notifications.

        This method updates the base alert data by setting the action type to
        "Justification" and the action message to the subject of the message from the
        parameters.

        Returns:
            None
        """
        self.base_alert_data["action_type"] = hpcl_ceg_enum.AlertActionType.Justification.value
        self.base_alert_data["action_msg"] = self.params.get("msg_subject")

    async def _process_resolved(self):
        """
        Handle resolved type notifications.

        This method updates the base alert data by setting the action type to
        "Resolved" and the action message to the subject of the message from the
        parameters.

        Returns:
            None
        """
        self.base_alert_data["action_type"] = hpcl_ceg_enum.AlertState.Resolved.value
        self.base_alert_data["action_msg"] = self.params.get("msg_subject")
    
    async def _process_senditback(self):
        """
        Handle resolved type notifications.

        This method updates the base alert data by setting the action type to
        "Resolved" and the action message to the subject of the message from the
        parameters.

        Returns:
            None
        """
        self.base_alert_data["action_type"] = hpcl_ceg_enum.AlertActionType.SendItBack.value
        self.base_alert_data["action_msg"] = self.params.get("msg_subject")
    
    async def _process_accept(self):
        """
        Handle resolved type notifications.

        This method updates the base alert data by setting the action type to
        "Resolved" and the action message to the subject of the message from the
        parameters.

        Returns:
            None
        """
        self.base_alert_data["action_type"] = hpcl_ceg_enum.AlertActionType.AcceptClose.value
        self.base_alert_data["action_msg"] = self.params.get("msg_subject")
    
    async def _process_message_type(self):
        """
        Process the message type and execute the corresponding processor.

        This method retrieves the message type from the parameters and uses it to
        select the appropriate processor from the processors dictionary. The
        processor is then called asynchronously to process the message type.

        If the message type is unknown, a message is printed to the console.

        Args:
            None

        Returns:
            None
        """
        message_type = self.params.get("messagetype")

        processors = {
            "escalation": self._process_escalation,
            "escalate": self._process_escalation,
            "active": self._process_active,
            "notify": self._process_notify,
            "reject": self._process_reject,
            "justified": self._process_justified,
            "resolved": self._process_resolved,
            "senditback": self._process_senditback,
            "accept": self._process_accept
        }
        processor = processors.get(message_type)  # Retrieve the function
        if processor:
            print(f"Executing processor for message_type: {message_type}")
            await processor()  # Call the function asynchronously
        else:
            print(f"Unknown message type: {message_type}")
    
    async def update_notication_audit_log(self):
        notification_record = {
            "bu": self.alert_data['bu'],
            "sap_id": self.alert_data['sap_id'],
            "alert_section": self.alert_data['alert_section'],
            "interlock_name": self.alert_data['violation_name'], 
            "vehicle_number": self.alert_data.get("vehicle_number",""),
            "officers_username": ",".join(str(username) for username in self.usernames),
            "notification_type": self.params.get("messagetype"), 
            "template_path": self.template_path, 
            "alert_id": str(self.alert_data['id']),
            "transporter_details": [self.transporter_details]
        }
        #print("notification_record",notification_record)
        await hpcl_ceg_model.NotificationAuditLogCreate(**notification_record).create()
    
    async def _send_active_notification(self):
        """
        Send notifications for LPG/TAS active messages

        This method sends notifications for LPG/TAS active messages. If the dealer_phone
        parameter is present, it sends an SMS notification. Otherwise, it sends an email
        notification.

        Parameters:
            None

        Returns:
            None
        """
        if self.params.get("dealer_phone"):
            await notification_factory.get_notification_module(module_type="sms")
        else:
            notification_module = await notification_factory.get_notification_module(module_type="email")
            print("self.mail_recipients: ", self.mail_recipients)
            self.mail_recipients = ['default@example.com']
            await self.update_notication_audit_log()
            res = await notification_module.publish_message(recipients=self.mail_recipients, subject=self.subject, body=self.body, html_content=True)
            return res

    async def _send_resolved_notification(self):
        """
        Send notifications for resolved alerts.

        This method determines the mode of notification based on the presence of
        a dealer phone number in the parameters. If a dealer phone number is present,
        it sends an SMS notification. Otherwise, it sends an email notification
        using the provided email recipients, subject, and body content.

        Returns:
            The result of the notification module's publish_message method.
        """
        if self.params.get("dealer_phone"):
            await notification_factory.get_notification_module(module_type="sms")
        else:
            notification_module = await notification_factory.get_notification_module(module_type="email")
            print("self.mail_recipients: ", self.mail_recipients)
            self.mail_recipients = ['default@example.com']
            await self.update_notication_audit_log()
            res = await notification_module.publish_message(recipients=self.mail_recipients, subject=self.subject, body=self.body, html_content=True)
            return res

    async def _send_other_notification(self):
        """
        Send notifications for other LPG/TAS messages.

        This method determines the mode of notification based on the presence of
        a dealer phone number in the parameters. If a dealer phone number is present,
        it sends an SMS notification. Otherwise, it sends an email notification
        using the provided email recipients, subject, and body content.

        Returns:
            The result of the notification module's publish_message method.
        """
        if self.params.get("dealer_phone"):
            await notification_factory.get_notification_module(module_type="sms")
        else:
            notification_module = await notification_factory.get_notification_module(module_type="email")
            print("self.mail_recipients: ", self.mail_recipients)
            self.mail_recipients = ['default@example.com']
            await self.update_notication_audit_log()
            res = await notification_module.publish_message(recipients=self.mail_recipients, subject=self.subject, body=self.body, html_content=True)
            return res

    async def _send_standard_notification(self):
        """
        Send standard notifications.

        This method determines the mode of notification based on the presence of
        a dealer phone number in the parameters. If a dealer phone number is present,
        it sends an SMS notification. Otherwise, it sends an email notification
        using the provided email recipients, subject, and body content.

        Returns:
            The result of the notification module's publish_message method.
        """
        if self.params.get("dealer_phone"):
            await notification_factory.get_notification_module(module_type="sms")
        else:
            notification_module = await notification_factory.get_notification_module(module_type="email")
            print("self.mail_recipients: ", self.mail_recipients)
            self.mail_recipients = ['default@example.com']
            await self.update_notication_audit_log()
            res = await notification_module.publish_message(recipients=self.mail_recipients, subject=self.subject, body=self.body, html_content=True)
            return res
    
    async def _send_notifications(self):
        """
        Send notifications based on business unit and message type

        This method retrieves the business unit (BU) and message type from the
        parameters and uses them to determine the appropriate processor to
        execute for sending notifications. The processor is called asynchronously
        to process the notifications.

        Args:
            None

        Returns:
            None
        """
        bu = self.params.get("BU").upper()
        sop_id = self.alert_data.get('sop_id')
        print("before _send_notifications_with_sms")
        await self._send_notifications_with_sms(bu)
    
    async def _send_notifications_with_sms(self, bu: str):
        """
        Send notifications with SMS based on business unit

        This method retrieves the business unit (BU) and message type from the
        parameters and uses them to determine the appropriate processor to
        execute for sending notifications with SMS. The processor is called
        asynchronously to process the notifications.

        Parameters:
            bu (str): The business unit for which the notification is being prepared.

        Returns:
            None
        """
        message_type = self.params.get("messagetype")
        print("message_type --> ", message_type)
        # Check if email sending is explicitly disabled
        if message_type == "active":
            await self._send_active_notification()           
        elif message_type == "resolved":
            await self._send_resolved_notification()
        elif message_type == 'Resolved':
            await self._send_other_notification()
        else:
            await self._send_standard_notification()
    
    async def _update_alert_status(self):
        """
        Update alert status in database

        This method updates the alert status in the database with the action type,
        action message, last escalated to, last notified to, assigned user roles,
        and last mailed to. It retrieves the alert data from the database, appends
        the new update to the alert history, and updates the database with the
        new fields.

        Args:
            None

        Returns:
            None
        """
        alert_id = self.params.get("alert_id")
        print("self.params ---> ", self.params)

        # Ensure self.update_alert is initialized as a dictionary
        self.update_alert = getattr(self, "update_alert", {}) or {}

        assigning_roles = (await self._role_configuration_mqofrole() or "")

        if self.base_alert_data.get("action_type") and self.base_alert_data.get("action_msg"):
            self.update_alert.update({
                    "action_type": self.base_alert_data.get("action_type"),
                    "action_msg": self.base_alert_data.get("action_msg"),
                    "assigned_user_roles": assigning_roles,
                    # "last_mailed_to": [self.base_alert_data.get("email")] if isinstance(self.base_alert_data.get("email"), str) else self.base_alert_data.get("email", [])
                    "last_mailed_to": list(self.roles_mapper.get("rolemailto", {}).keys())
            })
        else:
            self.update_alert.update({
                    "action_type": hpcl_ceg_model.AlertActionType.Escalated.value,
                    "action_msg": self.params.get("msg_subject"),
                    "assigned_user_roles": assigning_roles,
                    # "last_mailed_to": [self.base_alert_data.get("email")] if isinstance(self.base_alert_data.get("email"), str) else self.base_alert_data.get("email", [])
                    "last_mailed_to": list(self.roles_mapper.get("rolemailto", {}).keys())
            })
        print("self.update_alert ---> ", self.update_alert)

        if self.params.get("messagetype") in ["escalation", "escalate"]:
            self.update_alert["last_escalated_to"] = (await self._role_configuration_rolemailto()).split(",")
            self.update_alert["action_msg"] = "Escalated to " + ", ".join(f"'{roles_name}'" for roles_name in self.update_alert["last_escalated_to"])
        else:
            self.update_alert["last_notified_to"] = (await self._role_configuration_rolemailto()).split(",")
            self.update_alert["action_msg"] = "Mail sent to " + ", ".join(f"'{roles_name}'" for roles_name in self.update_alert["last_notified_to"])

        # Convert assigned_user_roles to a list
        self.update_alert["assigned_user_roles"] = (
            self.update_alert["assigned_user_roles"].split(',') if self.update_alert["assigned_user_roles"] else []
        )
        
        # Fetch alert data from DB and ensure it's a dictionary
        alert_data = await hpcl_ceg_model.ViolationHistoryVts.get(alert_id)
        alert_data = alert_data.__dict__ if not isinstance(alert_data, dict) else alert_data

        allocated_time = alert_data.get('updated_at', datetime.datetime.now(datetime.timezone.utc))
        alert_history = alert_data.get('alert_history', []) if isinstance(alert_data, dict) else getattr(alert_data, 'alert_history', [])
        if alert_history and alert_history[-1].get("processed_time"):
            allocated_time = alert_history[-1]["processed_time"]
            allocated_time = datetime.datetime.fromisoformat(allocated_time)
        self.update_alert["allocated_time"] = allocated_time.isoformat()
        processed_time = datetime.datetime.now(datetime.timezone.utc)
        self.update_alert["processed_time"] = processed_time.isoformat()
        # Ensure alert_history is a list and append the new update
        if self.params.get("messagetype") not in ["escalation", "escalate"]:
            alert_data.setdefault("alert_history", []).append(self.update_alert)
        # Append to assigned_user_roles only if message_type is "escalation"
        if self.params.get("messagetype", "") == "escalation":
            # Ensure existing roles are a list
            existing_roles = alert_data.get("assigned_user_roles", [])
            if not isinstance(existing_roles, list):
                existing_roles = [existing_roles]  # Convert to list if it's not already

            # Append new roles, remove duplicates, and ensure it's a list
            updated_roles = existing_roles + self.update_alert["assigned_user_roles"]
            alert_data["assigned_user_roles"] = list(set(updated_roles))
        else:
            alert_data["assigned_user_roles"] = self.update_alert["assigned_user_roles"]

        # Update alert_data with required fields
        alert_data.update({
            "last_escalated_to": self.update_alert.get("last_escalated_to", []),
            "last_mailed_to": self.update_alert["last_mailed_to"]
        })
        
        print("before updating alert_data ---> ", alert_data)

        if "_sa_instance_state" in alert_data.keys():
            del alert_data["_sa_instance_state"]

        # Update the database
        await hpcl_ceg_model.ViolationHistoryVts(**alert_data).modify()
    
    async def _create_task_result(self):
        """
        Creates a task result based on the processed alert data.

        This method takes the alert data and removes the SQLAlchemy instance state
        from the dictionary if it exists. It then returns a tuple containing a
        boolean indicating the success status and a dictionary containing the
        alert ID.

        Returns:
            Tuple[bool, dict]: A tuple containing a boolean indicating the success
            status and a dictionary containing the alert ID.
        """
        if "_sa_instance_state" in self.alert_data.keys():
            del self.alert_data["_sa_instance_state"]
        return True, {"alert_id": self.params['alert_id']}
    
    async def process(self, params: typing.Dict):
        """
        Main processing method that orchestrates the notification flow.

        This method handles the entire flow of processing a notification, from 
        loading and validating alert data, preparing base alert data, processing 
        roles and users, determining the message type, sending notifications, 
        updating alert status, and finally creating a task result.

        Args:
            params (Dict): Dictionary containing task parameters.

        Returns:
            Tuple[bool, str]: Returns a tuple indicating the success status and a 
            message. If an error occurs, returns False and an error message.
        """
        self.params = params
        # print("parms: ", self.params)
        try:
            # If the alert is not found, stop the process and return an invalid alert response.
            if not await self._load_and_validate_alert():
                return await self._handle_invalid_alert()

            # Prepare the common alert information that will be used in notifications.
            await self._prepare_base_alert_data()
            # Identify the roles and users who should receive this notification.
            await self._process_roles_and_users()
            # Process the notification based on the message type
            await self._process_message_type()
            # Check whether email notifications are enabled.
            send_email = self.params.get("send_email", True)
        
            # Send notifications only if email sending is enabled.
            if send_email is True:
                await self._send_notifications()
            # Update the alert status/history after notifications are processed.
            await self._update_alert_status()
            return await self._create_task_result()

        except Exception as e:
            logger.error(f"Error during notification process: {str(e)}")
            logger.error(traceback.format_exc())
            print(traceback.format_exc())
            return False, "Failed to process notification"

    async def handle_task_notification_vts(self, params: typing.Dict):
        # handler = SendNotification(task)
        """
        Main entry point for handling task notifications.

        This method simply calls the `process` method with the given parameters.

        Args:
            params (Dict): Dictionary containing task parameters.

        Returns:
            Tuple[bool, str]: Returns a tuple indicating the success status and a
            message. If an error occurs, returns False and an error message.
        """
        return await self.process(params)
    
    async def _role_configuration_rolemailto(self):
        mailto=self.params.get("rolemailto","")
        # Read the alert section and violation type from the alert details.
        violation_type = self.alert_data.get("violation_type","")
        alert_section = self.alert_data.get("alert_section","")
        rolemapping = vts_violation_role_mapping.violation_mapping[alert_section][self.alert_data.get("bu","")][violation_type][self.params.get('va_level','level - 1')]
        if mailto and mailto in ["0","1","2"]:
            print("taking roles using va_level---->",rolemapping["rolemailto"].get(mailto,""))
            return rolemapping["rolemailto"].get(mailto,"")   
        return mailto
    
    async def _role_configuration_mqofrole(self):
        mqof = self.params.get("mqofrole","")
        if self.alert_data.get("alert_section","") in ["VTS"]:
            violation_type = self.alert_data.get("violation_type","")
            alert_section = self.alert_data.get("alert_section","")
            rolemapping = vts_violation_role_mapping.violation_mapping[alert_section][self.alert_data.get("bu","")][violation_type][self.params.get('va_level','level - 1')]
            if mqof and mqof in ["0","1","2"]:
                return rolemapping["mqof"].get(mqof,"")
        return mqof
