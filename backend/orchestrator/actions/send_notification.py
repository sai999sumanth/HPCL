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
import utilities.role_configuration as role_configuration
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

logger = urdhva_base.logger.Logger.getInstance("workflow_process-log")


class SendNotification:
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
            "alert_id", "BU", "interlock_name", "interlock_id", "messagetype",
            "msg_subject", "mqofrole", "location_type", "location_device_id", "va_level",
            "rolemailto", "alert_id", "escalationlevel_inmail", "sap_id", "escalationtime_inmail",
            "days_remaining", "contract_valid_upto"

        ]
    
    async def check_sap_id_empty(self):
        if self.alert_data.get('interlock_name') in ['Itdg Admin Blocked']:
            if not self.alert_data.get('bu') or not self.alert_data.get('sap_id'):
                return True
            return False
        return False

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
            if not await self._load_and_validate_alert():
                return await self._handle_invalid_alert()
            
            check_status = await self.check_sap_id_empty()
            if check_status:
                return True, {"empty_sap_id": "Notification skipped Because Of Admin Module"}
            
            await self._prepare_base_alert_data()
            if self.base_alert_data['interlock_name'] in ['Dry Out Each Indent Wise MainFlow']:
                return True, {"msg": "Notification skipped"}
            await self._process_roles_and_users()
            await self._process_message_type()
            send_email = self.params.get("send_email", True)
        
            if send_email is True:
                await self._send_notifications()
            await self._update_alert_status()
            return await self._create_task_result()

        except Exception as e:
            logger.error(f"Error during notification process: {str(e)}")
            logger.error(traceback.format_exc())
            print(traceback.format_exc())
            return False, "Failed to process notification"

    async def _load_and_validate_alert(self) -> bool:
        """
        Load alert data and validate its existence.

        Returns:
            bool: True if alert data is found, False otherwise.
        """
        alert_id = self.params.get("alert_id")
        print("alert_id --> ", alert_id)
        alert_data = await hpcl_ceg_model.Alerts.get(alert_id)

        if alert_data:
            self.alert_data = alert_data.__dict__ if not isinstance(alert_data, dict) else alert_data
            if self.alert_data['transporter_code']:
                transporter_code = (
                    str(int(self.alert_data['transporter_code']))
                    if str(self.alert_data.get('transporter_code', '')).strip().isdigit()
                    else "0"
                )
                query = (f"transporter_code='{transporter_code}'")
                transporter_details_data = await hpcl_ceg_model.EmailMaster.get_all(urdhva_base.queryparams.QueryParams(q=query),
                                                                                    resp_type='plain')
                if len(transporter_details_data.get("data",[])):
                    self.alert_data['transporter_name'] = transporter_details_data['data'][0]['transporter_name']
            return True
        return False

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
        if self.alert_data.get("alert_section","") in ["VTS","RO","TAS"]:
            roles_list = (await self._role_configuration_rolemailto() or "")
        elif self.alert_data.get("alert_section","") in ["VA","LPG","EMLock"]:
            roles_list = await self._get_va_roles_list()
        else:
            roles_list = self.params.get("rolemailto", "")
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
        for role in roles:
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

    # async def _prepare_recipients(self, users: List[Dict]):
    #     """Prepare email and SMS recipients"""
    #     print("users --> ", users)
    #     # for user in users:
    #     #     print("user ", user)
    #     if users.get("email"):
    #         self.mail_recipients.append(users["email"])
    #     if users.get("phone"):
    #         self.sms_recipients.append(users["phone"])
                
    #     self.mail_recipients = list(dict.fromkeys(self.mail_recipients))
    #     self.sms_recipients = list(dict.fromkeys(self.sms_recipients))
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

    async def get_subject_for_vts(self):
        if self.params.get('messagetype','') in ['active']:
            if not await vts_analysis.is_vehicle_blacklisted(self.alert_data['vehicle_number']):
                subject_template = f"VTS Alert: Blocking of truck {self.alert_data.get('vehicle_number', '')} at {self.alert_data.get("location_name", "")};"
                return subject_template
            else:
                subject_template = f"VTS Alert: Blacklisting of truck {self.alert_data.get('vehicle_number', '')} at {self.alert_data.get("location_name", "")};"
                return subject_template
        if self.params.get('messagetype','') in ['resolved']:
            subject_template = f"VTS Alert: Unblocking of truck {self.alert_data.get('vehicle_number', '')} at {self.alert_data.get("location_name", "")};"
            return subject_template
   
    async def get_subject_for_ro(self):
        if self.params.get('messagetype','') in ['notify'] and self.alert_data.get('interlock_name') in ['Restroom Cleaning Evidence Missing']:
            subject_template = f"Outlet Blocked"
            return subject_template
        if self.params.get('messagetype','') in ['resolved'] and self.alert_data.get('interlock_name') in ['Restroom Cleaning Evidence Missing']:
            subject_template = f"Outlet Unblocked"
            return subject_template
              
    async def get_subject_for_tas(self):
        if self.params.get('messagetype','') in ['active'] and self.alert_data.get('interlock_name') in ['Loss Of Communication']:
            device_type_map = {
                "OPC DA connection failed": "OPC DA",
                "Data receiving connection failed": "Connection Failed",
            }
            device_type = device_type_map.get(self.alert_data.get('device_type', ''), "Unknown")
            subject_template = f"Communication Loss between Location TAS & NOVEX due to {device_type} @ {self.alert_data.get('location_name', '')}"
            return subject_template
        if self.params.get('messagetype','') in ['resolved'] and self.alert_data.get('interlock_name') in ['Loss Of Communication']:
            subject_template = f"Communication has been established between NOVEX and TAS"
            return subject_template  
        
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

        if self.alert_data["alert_section"] in ['VTS'] and self.params.get('messagetype','') in ['active','resolved']:
            subject_template = await self.get_subject_for_vts()
        
        if self.alert_data["interlock_name"] in ['Restroom Cleaning Evidence Missing'] and self.params.get('messagetype','') in ['notify','resolved']:
            subject_template = await self.get_subject_for_ro()
                        
        if self.alert_data["interlock_name"] in ['Loss Of Communication'] and self.params.get('messagetype','') in ['active','resolved']:
            subject_template = await self.get_subject_for_tas()

        # Append alert_section only if it exists and is different from BU
        if alert_section and bu != alert_section:
            if alert_section not in ['VTS']:
                subject_template += f", Alert Section: {alert_section}"

        # Render the final subject
        self.subject = Template(subject_template).render(**template_data)

        # self.subject = Template(self.params.get("msg_subject")).render(**template_data)
        self.body = Template(templates["body"]).render(**template_data)
        # self.sms = Template(templates["sms"]).render(**template_data)
    
    async def get_vts_messagetype(self):
        if self.params.get('messagetype','') in ['active']:
            if not await vts_analysis.is_vehicle_blacklisted(self.alert_data['vehicle_number']):
                return 'BLOCKING'
            return 'BLACKLISTED'
        elif self.params.get('messagetype','') in ['resolved']:
            return 'VTSRESOLVED'
        
    async def get_ro_messagetype(self):
        if self.params.get('messagetype','') in ['notify']:
            return 'BLOCKOUTLET'
        elif self.params.get('messagetype','') in ['resolved']:
            return 'UNBLOCKOUTLET'
        
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
        if self.alert_data.get("interlock_name") == "Loss Of Communication" and message_type == "ACTIVE":
            body = await self.read_template(InterlockTemplateMapping.LOSS_OF_COMMUNICATION_ALERT.value)
            return {"template": "LOSS_OF_COMMUNICATION_ALERT", "body": body}
        if self.alert_data.get("interlock_name") == "Loss Of Communication" and message_type == "RESOLVED":
            body = await self.read_template(InterlockTemplateMapping.LOSS_OF_COMMUNICATION_RESOLVED.value)
            return {"template": "LOSS_OF_COMMUNICATION_RESOLVED", "body": body}
        if self.alert_data.get("alert_section") in ["VTS"] and self.params.get('messagetype','') in ['active','resolved']:
            message_type = await self.get_vts_messagetype()
        if self.alert_data.get("interlock_name") in ['Restroom Cleaning Evidence Missing'] and self.params.get('messagetype','') in ['notify','resolved']:
            message_type = await self.get_ro_messagetype()
        template_value = getattr(TemplateMapping, message_type, None)
        template = template_value.value if template_value else ""
        interlock_value = getattr(InterlockTemplateMapping, template.upper(), None)
        body = await self.read_template(interlock_value.value) if interlock_value else ""
        return {"template": template, "body": body}

    async def _handle_invalid_alert(self):
        """
        Handle case when alert is not found.

        Returns:
            tuple: A tuple containing a boolean indicating failure, and a string
            describing the reason.
        """        
        return False, "Alert not found"
    
    async def _should_skip_notification(self) -> bool:
        """
        Determine if the notification should be skipped based on the current alert data and message type.

        This method checks the alert data to see if it contains information indicating that a notification
        should not be sent. Specifically, it checks if the alert is active and the message type is "active",
        or if the alert is closed and the message type is "resolved". In either of these cases, the notification
        will be skipped.

        Returns:
            bool: True if the notification should be skipped, False otherwise.
        """
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
        """
        Prepare the base alert data for notifications.

        This method constructs a dictionary with base alert data from the alert data
        and parameters. The dictionary includes the alert ID, interlock name, plant ID,
        plant location, portal link, user, asset name, date and time, and opened time.

        Returns:
            dict: A dictionary containing the base alert data.
        """
        # logger.info(f"self.alert_data: {self.alert_data}") 
        if self.alert_data["alert_section"] in ['VTS'] and self.alert_data["bu"] in ['TAS']:
            self.interlock_name = self.alert_data.get('interlock_name', '')
            if self.alert_data['interlock_name'] not in ['No VTS No Load', 'Itdg Admin Blocked']:
                self.interlock_name = ' '.join(self.alert_data.get('interlock_name', '').split()[:2])
            if self.alert_data.get('interlock_name').startswith('VTS Device Tampering'):
                self.interlock_name = ' '.join(self.alert_data.get('interlock_name', '').split()[:3])
            self.vts_assigned_role = "Location In-Charge SOD" if self.alert_data.get('violation_type','') not in ['device_tamper_count','main_supply_removal_count'] else (await self._role_configuration_mqofrole() or "")
            if not await vts_analysis.is_vehicle_blacklisted(self.alert_data['vehicle_number']):
                  self.days = (self.alert_data['vehicle_blocked_end_date'] - self.alert_data['vehicle_blocked_start_date']).days
        
        if self.alert_data["alert_section"] in ['VTS'] and self.alert_data["bu"] in ['LPG'] and self.alert_data.get('tt_type','').lower() in ['packed']:
            self.interlock_name = self.alert_data.get('interlock_name', '')
            if self.alert_data['interlock_name'] not in ['No VTS No Load', 'Itdg Admin Blocked']:
                self.interlock_name = ' '.join(self.alert_data.get('interlock_name', '').split()[:2])
            if self.alert_data.get('interlock_name').startswith('VTS Device Tampering'):
                self.interlock_name = ' '.join(self.alert_data.get('interlock_name', '').split()[:3])
            self.vts_assigned_role = "Location In-Charge LPG"
            if not await vts_analysis.is_vehicle_blacklisted(self.alert_data['vehicle_number']):
                  self.days = (self.alert_data['vehicle_blocked_end_date'] - self.alert_data['vehicle_blocked_start_date']).days
        
        lost_duration = ""
        if self.alert_data.get("interlock_name") == "Loss Of Communication":
            try:
                fmt = '%d-%m-%Y %H:%M:%S'
                created_at_IST_str = self.alert_data['created_at'].replace(tzinfo=pytz.utc).astimezone(self.IST).strftime(fmt)
                date_time_str = datetime.datetime.now(self.IST).strftime(fmt)

                created_dt = datetime.datetime.strptime(created_at_IST_str, fmt)
                restored_dt = datetime.datetime.strptime(date_time_str, fmt)

                delta = restored_dt - created_dt
                total_seconds = int(delta.total_seconds())
                hours, remainder = divmod(total_seconds, 3600)
                minutes, seconds = divmod(remainder, 60)
                lost_duration = f"{hours}h {minutes}m {seconds}s"
            except Exception as e:
                logger.error(f"Failed to compute lost_duration: {e}")
                lost_duration = "N/A"

        self.base_alert_data = {
            "alert_id": self.params.get("alert_id"),
            "interlock_name": self.interlock_name if self.interlock_name else await self._get_interlock_name(),
            "plant_id": self.alert_data.get("sap_id", ''),
            "plant_location": self.alert_data["location_name"][:30],
            "portal_link": "https://ceg.hpcl.co.in",
            "user": self.params.get("user") or '',
            "asset_name": self.alert_data["device_type"],
            "date_time": datetime.datetime.now(self.IST).strftime('%d-%m-%Y %H:%M:%S'),
            "opened_time": self.alert_data['created_at'].strftime('%d-%m-%Y %H:%M:%S'),
            "created_at_IST": self.alert_data['created_at'].replace(tzinfo=pytz.utc).astimezone(self.IST).strftime('%d-%m-%Y %H:%M:%S'),
            "lost_duration": lost_duration, 
            "days": self.days if self.days else 0,
            "transporter_name": self.alert_data['transporter_name'] if self.alert_data['transporter_name'] else "",
            "block_start_date": self.alert_data['vehicle_blocked_start_date'].strftime("%d.%m.%Y") if self.alert_data['vehicle_blocked_start_date'] else None,
            "block_end_date": self.alert_data['vehicle_blocked_end_date'].strftime("%d.%m.%Y") if self.alert_data['vehicle_blocked_end_date'] else None,
            "unblock_date": self.alert_data['vehicle_unblocked_date'].strftime("%d.%m.%Y") if self.alert_data['vehicle_unblocked_date'] else None,
            "vts_assigned_role": self.vts_assigned_role if self.vts_assigned_role else "",
            "asset_id": self.alert_data.get("device_name", self.alert_data["location_name"]), # this should be location_id
            "vehicle_number": self.alert_data.get("vehicle_number", ""),
            "location_name": self.alert_data.get("location_name", ""),
            "contract_valid_upto": self.alert_data.get("contract_valid_upto", "").strftime("%d.%m.%Y") if self.alert_data.get("contract_valid_upto") else "",
            "days_remaining": int(self.params.get("days_remaining", 0) or 0),
            "vts_portal_link": "https://vtsenmovil.hpcl.co.in/" if self.alert_data.get("tt_type", "").lower() in ["packed"] else "https://hpclvts.hpcl.co.in/ ",
            "vts_description": "Packed" if self.alert_data.get("tt_type", "").lower() in ["packed"] else "Bulk Petroleum",
        }
        return self.base_alert_data

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
        return self.alert_data.get('sopName', self.alert_data.get("interlock_name", self.alert_data.get('msg', '')))

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
        if self.alert_data['alert_section'] in ['VTS'] and self.alert_data['bu'] in ['TAS']:
            self.base_alert_data["action_type"] = hpcl_ceg_enum.AlertState.Notified.value
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
            "accept": self._process_accept,
            "vts_device_expiry": self._process_active,  # Assuming VTS Device Expiry is treated as active
        }
        processor = processors.get(message_type)  # Retrieve the function
        if processor:
            print(f"Executing processor for message_type: {message_type}")
            await processor()  # Call the function asynchronously
        else:
            print(f"Unknown message type: {message_type}")

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
        elif message_type == 'vts_device_expiry':
            await self._send_vts_device_expiry_notification()
        else:
            await self._send_standard_notification()

    async def get_ro_recipients(self):
        dealer_mail = f"{self.alert_data.get("sap_id")}@retail.co.in"
        mail_recipients = []
        query = f"""SELECT *
                        FROM users
                        WHERE '{self.alert_data.get('sales_area')}' = ANY(sales_area)
                        AND 'Sales Officer RO' = ANY(novex_role)"""
        ro_users_data = await hpcl_ceg_model.Users.get_aggr_data(query,limit=0)
        if ro_users_data['data']:
            for rec in ro_users_data['data']:
                if rec.get('email'):
                    mail_recipients.append(rec['email'])
        #mail_recipients.append(dealer_mail)
        print('*'*200)
        print(mail_recipients)
        print('*'*200)
        return mail_recipients

    async def get_vts_recipients(self):
        transporter_code = (
            str(int(self.alert_data['transporter_code']))
            if str(self.alert_data.get('transporter_code', '')).strip().isdigit()
            else "0"
        )
        query = (f"transporter_code='{transporter_code}'")
        transporter_details_data = await hpcl_ceg_model.EmailMaster.get_all(urdhva_base.queryparams.QueryParams(q=query),
                                                                                    resp_type='plain')
        transporter_mail = []
        if len(transporter_details_data.get("data",[])):
            transporter_details_data = transporter_details_data['data'][0]
            self.transporter_details["transporter_name"] = transporter_details_data['transporter_name']
            if transporter_details_data.get('transporter_email1',""):
                transporter_mail.append(transporter_details_data['transporter_email1'])
            if transporter_details_data.get('transporter_email2',""):
                transporter_mail.append(transporter_details_data['transporter_email2'])
            self.transporter_details['transporter_email'] = ",".join(str(x) for x in transporter_mail)
        
        cc_query = (f"sap_id='{self.alert_data['sap_id']}'")
        cc_query_data = await hpcl_ceg_model.EmailMaster.get_all(urdhva_base.queryparams.QueryParams(q=cc_query),
                                                                                    resp_type='plain')
        cc_recipients = []
        if len(cc_query_data.get("data",[])):
            cc_recipients_data = cc_query_data['data'][0]
            keys = ["location_officer","zonal_transport_officer","zonal_head","hqo1","hqo2","hqo3","hqo4"]
            for key in keys:
                if key in ['hqo2','hqo3','hqo4'] and self.alert_data.get('tt_type','').lower() in ['packed']:
                    continue
                if key in ['location_officer'] and self.alert_data.get('tt_type','').lower() in ['packed']:
                    transporter_mail.append(cc_recipients_data.get(key,""))
                    continue
                if self.alert_data['violation_type'] in ['speed_violation_count']:
                    cc_recipients.append(cc_recipients_data.get(key,""))
                else:
                    # For other violation types, exclude hqo4
                    if key != "hqo4":
                        cc_recipients.append(cc_recipients_data.get(key, ""))

        if self.alert_data.get('tt_type','').lower() in ['packed']:
            cc_recipients.append("Randhir.Kumar2@hpcl.in")
        
        self.usernames = set(cc_recipients)        
        mail_recipients = transporter_mail
        cc_recipients = cc_recipients
        from_url = "VTS<VTSGovernance@hpcl.co.in>"
        return mail_recipients, cc_recipients, from_url
    
    async def update_notication_audit_log(self):
        notification_record = {
            "bu": self.alert_data['bu'],
            "sap_id": self.alert_data['sap_id'],
            "alert_section": self.alert_data['alert_section'],
            "interlock_name": self.alert_data['interlock_name'], 
            "vehicle_number": self.alert_data.get("vehicle_number",""),
            "officers_username": ",".join(str(username) for username in self.usernames),
            "notification_type": self.params.get("messagetype"), 
            "template_path": self.template_path, 
            "alert_id": str(self.alert_data['id']),
            "transporter_details": [self.transporter_details]
        }
        #print("notification_record",notification_record)
        await hpcl_ceg_model.NotificationAuditLogCreate(**notification_record).create()


    async def _send_vts_device_expiry_notification(self):
        """
        Send VTS device contract expiry notification to transporter and location officers.

        Called from _send_notifications_with_sms() when messagetype is 'vts_device_expiry'.
        Uses self.alert_data (already populated) to fetch recipients and render the template.

        alert_data expected keys:
            - transporter_code, sap_id, vehicle_number, location_name, contract_valid_upto
        """
        try:
            # Fetch TO (transporter) and CC (location officers) using the existing helper
            mail_recipients, cc_recipients, from_url = await self.get_vts_recipients()

            if not mail_recipients:
                logger.warning(
                    f"_send_vts_device_expiry_notification: No recipients found for "
                    f"transporter_code={self.alert_data.get('transporter_code')}, "
                    f"sap_id={self.params.get('sap_id')}"
                )
                return

            # Render email subject
            subject = (
                f"Contract Expiry Intimation - Vehicle {self.alert_data['vehicle_number']} "
                f"at {self.alert_data['location_name']} "
                f"(Valid Upto: {self.params['contract_valid_upto']})"
            )

            # Read and render the HTML template
            template_filename = "vts_device_expiry.html"
            template_content = await self.read_template(template_filename)
            body = Template(template_content).render(
                location_name=self.alert_data["location_name"],
                contract_valid_upto=self.params["contract_valid_upto"],
            )

            # Send email
            notification_module = await notification_factory.get_notification_module(module_type="email")
            res = await notification_module.publish_message(
                from_url=from_url,
                recipients=mail_recipients,
                cc_recipients=cc_recipients,
                subject=subject,
                body=body,
                force_send=True,
                html_content=True,
            )
            logger.info(
                f"_send_vts_device_expiry_notification: Email sent to {mail_recipients}, "
                f"CC: {cc_recipients}. Response: {res}"
            )
            return res

        except Exception as e:
            logger.error(f"_send_vts_device_expiry_notification error: {str(e)}")
            logger.error(traceback.format_exc())
    


    async def get_tas_recipients(self):
        try:
            sap_id = self.alert_data.get("sap_id")
            zone = self.alert_data.get("zone")
            bu = self.alert_data.get("bu")

            mailto = self.params.get("rolemailto", "")
            interlock_name = self.alert_data.get("interlock_name", "")

            tas_mapping = tas_role_configuration.tas_role_mapping.get("TAS", {}).get(interlock_name, {})

            if mailto in ["0", "1", "2", "3", "4", "5"]:
                role_string = tas_mapping.get("rolemailto", {}).get(mailto, "")
            else:
                role_string = mailto

            if not role_string:
                return []

            roles = [r.strip() for r in role_string.split(",") if r.strip()]
            roles_array = "{" + ",".join(f'"{r}"' for r in roles) + "}"

            recipients = []
            users_data = None

            query = f"""
            SELECT email, username
            FROM users
            WHERE '{sap_id}' = ANY(sap_id)
            AND novex_role && '{roles_array}'::varchar[]
            AND email IS NOT NULL
            """

            users_data = await hpcl_ceg_model.Users.get_aggr_data(query, limit=0)

            if not users_data or not users_data.get("data"):
                query = f"""
                SELECT email, username
                FROM users
                WHERE '{zone}' = ANY(zone)
                AND '{bu}' = ANY(bu)   
                AND novex_role && '{roles_array}'::varchar[]
                AND email IS NOT NULL
                """

                users_data = await hpcl_ceg_model.Users.get_aggr_data(query, limit=0)

            if users_data and users_data.get("data"):
                for user in users_data["data"]:
                    if user.get("email"):
                        recipients.append(user["email"])
                        self.usernames.add(user.get("username", ""))

            return recipients
        
        except Exception as e:
            logger.error(f"TAS recipient error: {e}")
            return []
       
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
           
            if self.alert_data['alert_section'] in ['VTS'] and self.params.get('messagetype','') in ['active'] and self.alert_data['bu'] in ['TAS']:
                self.mail_recipients, self.cc_recipients, self.from_url = await self.get_vts_recipients()
                await self.update_notication_audit_log()
                if self.mail_recipients:
                    res = await notification_module.publish_message(from_url=self.from_url, recipients=self.mail_recipients, cc_recipients=self.cc_recipients, subject=self.subject, body=self.body, force_send=True, html_content=True)
                    return res
            
            if self.alert_data['alert_section'] in ['VTS'] and self.params.get('messagetype','') in ['active'] and self.alert_data['bu'] in ['LPG'] and self.alert_data['tt_type'].lower() in ['packed']:
                self.mail_recipients, self.cc_recipients, self.from_url = await self.get_vts_recipients()
                await self.update_notication_audit_log()
                if self.mail_recipients:
                    res = await notification_module.publish_message(from_url=self.from_url, recipients=self.mail_recipients, cc_recipients=self.cc_recipients, subject=self.subject, body=self.body, force_send=True, html_content=True)
                    return res
                
            if self.alert_data.get('alert_section','') in ['TAS'] and self.alert_data.get('bu','') in ['TAS'] and self.alert_data.get('severity', '').lower() in ['critical']:
                await self.update_notication_audit_log()
                tas_recipients = await self.get_tas_recipients()

                if tas_recipients:
                    self.mail_recipients = tas_recipients

                    tas_cc = ["ArpitaKanak.Bara@hpcl.in"]
                    if self.alert_data['interlock_name'] in ['Loss Of Communication']:
                        for email in ["vgupta@hpcl.in","TarunGhisulal.Chauhan@hpcl.in","avinashgaurav@hpcl.in","dineshkumar.chudasama@advancedsystek.com","mohith.p@algofusiontech.com","moufikali@algofusiontech.com"]:
                            if email not in tas_cc:
                                tas_cc.append(email)

                    args = {
                        "recipients": self.mail_recipients,
                        "subject": self.subject,
                        "body": self.body,
                        "force_send": True,
                        "html_content": True
                    }

                    if tas_cc:
                        args["cc_recipients"] = tas_cc

                    res = await notification_module.publish_message(**args)
                    return res
            
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
            if self.alert_data['alert_section'] in ['VTS'] and self.params.get('messagetype','') in ['resolved'] and self.alert_data['bu'] in ['TAS']:
                alert_history = list(reversed(self.alert_data.get('alert_history', [])))
                if len(alert_history) >= 2:
                    if alert_history[1]['action_type'] in ["AcceptClose", "Rejected"]:
                        await self.update_notication_audit_log()
                        res = await notification_module.publish_message(recipients=self.mail_recipients, subject=self.subject, body=self.body, html_content=True)
                        return res
                self.mail_recipients, self.cc_recipients, self.from_url = await self.get_vts_recipients()
                await self.update_notication_audit_log()
                #if self.mail_recipients and self.alert_data["created_at"] > datetime.datetime.strptime('2025-09-23', '%Y-%m-%d'):
                if self.mail_recipients:
                    res = await notification_module.publish_message(from_url=self.from_url, 
                                                                    recipients=self.mail_recipients, 
                                                                    cc_recipients=self.cc_recipients, 
                                                                    subject=self.subject, body=self.body, 
                                                                    force_send=True, html_content=True)
                    return res
            
            if self.alert_data['alert_section'] in ['VTS'] and self.params.get('messagetype','') in ['resolved'] and self.alert_data['bu'] in ['LPG'] and self.alert_data['tt_type'].lower() in ['packed']:
                alert_history = list(reversed(self.alert_data.get('alert_history', [])))
                if len(alert_history) >= 2:
                    if alert_history[1]['action_type'] in ["AcceptClose", "Rejected"]:
                        await self.update_notication_audit_log()
                        res = await notification_module.publish_message(recipients=self.mail_recipients, subject=self.subject, body=self.body, html_content=True)
                        return res
                self.mail_recipients, self.cc_recipients, self.from_url = await self.get_vts_recipients()
                await self.update_notication_audit_log()
                #if self.mail_recipients and self.alert_data["created_at"] > datetime.datetime.strptime('2025-09-23', '%Y-%m-%d'):
                if self.mail_recipients:
                    res = await notification_module.publish_message(from_url=self.from_url, 
                                                                    recipients=self.mail_recipients, 
                                                                    cc_recipients=self.cc_recipients, 
                                                                    subject=self.subject, body=self.body, 
                                                                    force_send=True, html_content=True)
                    return res
                
            if self.alert_data.get('interlock_name','') in ['Restroom Cleaning Evidence Missing']:
                await self.update_notication_audit_log()
                self.mail_recipients = await self.get_ro_recipients()
                self.cc_recipients = ["shubhra.Narayan@hpcl.in","sachinkwarghane@hpcl.in","purushm@hpcl.in","adityapandey@hpcl.in","shrikantsaini@hpcl.in"]
                if self.mail_recipients:
                    res = await notification_module.publish_message(recipients=self.mail_recipients,
                                                                    cc_recipients=self.cc_recipients,
                                                                    subject=self.subject, 
                                                                    body=self.body, 
                                                                    force_send=False,
                                                                    html_content=True)
                    return res
                
            if self.alert_data.get('alert_section','') in ['TAS'] and self.alert_data.get('bu','') in ['TAS'] and self.alert_data.get('severity', '').lower() in ['critical']:
                await self.update_notication_audit_log()
                tas_recipients = await self.get_tas_recipients()
                if tas_recipients:
                    self.mail_recipients = tas_recipients
                    tas_cc = ["ArpitaKanak.Bara@hpcl.in"]
                    if self.alert_data['interlock_name'] in ['Loss Of Communication']:
                        for email in ["vgupta@hpcl.in","TarunGhisulal.Chauhan@hpcl.in","avinashgaurav@hpcl.in","dineshkumar.chudasama@advancedsystek.com","mohith.p@algofusiontech.com","moufikali@algofusiontech.com"]:
                            if email not in tas_cc:
                                tas_cc.append(email)
                    
                    args = {
                        "recipients": self.mail_recipients,
                        "subject": self.subject,
                        "body": self.body,
                        "force_send": True,
                        "html_content": True
                    }

                    if tas_cc:
                        args["cc_recipients"] = tas_cc

                    res = await notification_module.publish_message(**args)
                    return res
                
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
            if self.alert_data.get('interlock_name','') in ['Restroom Cleaning Evidence Missing'] and self.params.get('messagetype','') in ['notify']:
                await self.update_notication_audit_log()
                self.mail_recipients = await self.get_ro_recipients()
                self.cc_recipients = ["shubhra.Narayan@hpcl.in","sachinkwarghane@hpcl.in","purushm@hpcl.in","adityapandey@hpcl.in","shrikantsaini@hpcl.in"]
                if self.mail_recipients:
                    res = await notification_module.publish_message(recipients=self.mail_recipients,
                                                                    cc_recipients=self.cc_recipients,
                                                                    subject=self.subject,
                                                                    body=self.body, 
                                                                    force_send=False,
                                                                    html_content=True)
                    return res
            self.mail_recipients = ['default@example.com']
            await self.update_notication_audit_log()
            res = await notification_module.publish_message(recipients=self.mail_recipients, subject=self.subject, body=self.body, html_content=True)
            return res

    # async def _update_alert_status(self):
    #     """Update alert status in database"""
    #     alert_id = self.params.get("alert_id")
    #     if self.params.get("escalationlevel_inmail"):
    #         self.update_alert["action_type"] = self.base_alert_data.get("action_type")
    #         self.update_alert["action_msg"] = self.base_alert_data["action_msg"]
    #         self.update_alert['last_escalated_to'] = self.params.get("rolemailto").split(',')
    #         self.update_alert['assigned_user_roles'] = self.params.get("mqofrole").split(',')
    #         self.update_alert['last_mailed_to'] = [self.base_alert_data.get("email")] if isinstance(self.base_alert_data.get("email"), str) else self.base_alert_data.get("email")
    #     else:
    #         self.update_alert["action_type"] = self.base_alert_data.get("action_type")
    #         self.update_alert["action_msg"] = self.base_alert_data.get("action_msg")
    #         self.update_alert['last_notified_to'] = self.params.get("rolemailto").split(',')
    #         self.update_alert['assigned_user_roles'] = self.params.get("mqofrole").split(',')
    #         self.update_alert['last_mailed_to'] = [self.base_alert_data.get("email")] if isinstance(self.base_alert_data.get("email"), str) else self.base_alert_data.get("email")
    #     alert_data = await hpcl_ceg_model.Alerts.get(alert_id)
    #     if not isinstance(alert_data, dict):
    #         alert_data = alert_data.__dict__
    #     alert_history = alert_data.get("alert_history") if alert_data.get("alert_history") else []
    #     # Append the new update to alert history
    #     alert_history.append(self.update_alert)
    #     # Assign the updated history back to the alert data
    #     alert_data["alert_history"] = alert_history
    #     alert_data["last_escalated_to"] = self.update_alert['last_escalated_to'] if self.update_alert['last_escalated_to'] else []
    #     alert_data["assigned_user_roles"] = self.update_alert['assigned_user_roles']
    #     alert_data["last_mailed_to"] = self.update_alert['last_mailed_to']
    #     await hpcl_ceg_model.Alerts(**alert_data).modify()
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

        assigning_roles = ""
        if self.alert_data.get("alert_section","") in ["VTS","VA","LPG","EMLock","RO","TAS"]:
            assigning_roles = (await self._role_configuration_mqofrole() or "")
        else:
            assigning_roles = self.params.get("mqofrole", "")

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
                    "action_type": hpcl_ceg_enum.AlertActionType.Escalated.value,
                    "action_msg": self.params.get("msg_subject"),
                    "assigned_user_roles": assigning_roles,
                    # "last_mailed_to": [self.base_alert_data.get("email")] if isinstance(self.base_alert_data.get("email"), str) else self.base_alert_data.get("email", [])
                    "last_mailed_to": list(self.roles_mapper.get("rolemailto", {}).keys())
            })
        #print("self.update_alert ---> ", self.update_alert)

        if self.params.get("messagetype") in ["escalation", "escalate"]:
            if self.alert_data.get("alert_section","") in ["VTS","RO","TAS"]:
                self.update_alert["last_escalated_to"] = (await self._role_configuration_rolemailto()).split(",")
            elif self.alert_data.get("alert_section", "") in ["VA","LPG","EMLock"]:
                self.update_alert["last_escalated_to"] = (await self._get_va_roles_list()).split(",")
            else:
                self.update_alert["last_escalated_to"] = self.params.get("rolemailto", "").split(",")
            self.update_alert["action_msg"] = "Escalated to " + ", ".join(f"'{roles_name}'" for roles_name in self.update_alert["last_escalated_to"])
        else:
            if self.alert_data.get("alert_section","") in ["VTS","RO","TAS"]:
                self.update_alert["last_notified_to"] = (await self._role_configuration_rolemailto()).split(",")
            elif self.alert_data.get("alert_section", "") in ["VA", "LPG", "EMLock"]:
                self.update_alert["last_notified_to"] = (await self._get_va_roles_list()).split(",")
            else:
                self.update_alert["last_notified_to"] = self.params.get("rolemailto", "").split(",")
            self.update_alert["action_msg"] = "Mail sent to " + ", ".join(f"'{roles_name}'" for roles_name in self.update_alert["last_notified_to"])
            if self.params.get("messagetype") in ["resolved"] and self.alert_data.get("alert_section","") in ["VTS"]:
                self.update_alert["action_msg"] = f"ALERT ID: {self.alert_data.get('unique_id')}, MOVED TO CLOSED TAB"

        # Convert assigned_user_roles to a list
        self.update_alert["assigned_user_roles"] = (
            self.update_alert["assigned_user_roles"].split(',') if self.update_alert["assigned_user_roles"] else []
        )
        
        # Fetch alert data from DB and ensure it's a dictionary
        alert_data = await hpcl_ceg_model.Alerts.get(alert_id)
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
        if self.params.get("messagetype") in ["escalation", "escalate"]:
            if self.alert_data['alert_section'] in ['TAS','RO','LPG','EMLock']:
                alert_data.setdefault("alert_history", []).append(self.update_alert)
        else:
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
        
        if self.alert_data.get("bu") == "TAS" and not (self.alert_data.get("interlock_name") or "").strip().endswith("Maintenance"):
            alert_data["assigned_user_roles"] = alert_data.get("assigned_user_roles", [])

        # Update alert_data with required fields
        alert_data.update({
            "last_escalated_to": self.update_alert.get("last_escalated_to", []),
            "last_mailed_to": self.update_alert["last_mailed_to"]
        })

        if alert_data.get('alert_section','') in ['VTS'] and self.params.get('messagetype','') in ['active','senditback'] and alert_data['bu'] in ['TAS','LPG']:
            alert_data['action_on'] = hpcl_ceg_enum.MakerChecker.MAKER.value
        
        if alert_data.get('alert_section','') in ['VTS'] and self.params.get('messagetype','') in ['justified'] and alert_data['bu'] in ['TAS','LPG']:
            alert_data['action_on'] = hpcl_ceg_enum.MakerChecker.CHECKER.value
        
        if alert_data.get('alert_section','') in ['VTS'] and self.params.get('messagetype','') in ['notify'] and alert_data['bu'] in ['TAS','LPG']:
            alert_data_history = alert_data['alert_history'][-2]
            if alert_data_history.get('action_type',"") in ['Justification']:
                alert_data['action_on'] = hpcl_ceg_enum.MakerChecker.CHECKER.value
            if alert_data_history.get('action_type',"") in ['SendItBack']:
                alert_data['action_on'] = hpcl_ceg_enum.MakerChecker.MAKER.value

        #print("before updating alert_data ---> ", alert_data)

        if "_sa_instance_state" in alert_data.keys():
            del alert_data["_sa_instance_state"]

        # Update the database
        if alert_data.get('interlock_name') not in ['No VTS No Load', 'Itdg Admin Blocked']:
            await hpcl_ceg_model.Alerts(**alert_data).modify()


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

    async def handle_task_notification(self, params: typing.Dict):
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
    
    async def _role_configuration_rolemailto(self):
        mailto=self.params.get("rolemailto","")
        interlock_name = self.alert_data.get("interlock_name","")
        alert_section = self.alert_data.get("alert_section","")
        if self.alert_data.get("alert_section","") in ["VTS"]:
            if self.alert_data['bu'] in ['LPG']:
                if self.alert_data['sap_id'] in role_configuration.lpg_locations_with_one_officer and self.alert_data.get('tt_type','') in ['bulk']:
                    rolemapping = role_configuration.lpg_one_officer_unblocking_matrix[alert_section][self.alert_data.get("bu","")][self.params.get('va_level','level - 1')]
                elif (self.alert_data['sap_id'] in role_configuration.lpg_locations_with_no_officer or self.alert_data['sap_id'].startswith('4')) and self.alert_data.get('tt_type','') in ['bulk']:
                    rolemapping = role_configuration.lpg_no_officer_unblocking_matrix[alert_section][self.alert_data.get("bu","")][self.params.get('va_level','level - 1')]
                elif self.alert_data.get('tt_type','') in ['packed']:
                    rolemapping = role_configuration.lpg_packed_unblocking_matrix[alert_section][self.alert_data.get("bu","")][self.params.get('va_level','level - 1')]
                else:
                    rolemapping = role_configuration.vts_unblocking_matrix[alert_section][self.alert_data.get("bu","")][self.params.get('va_level','level - 1')]
                if mailto and mailto in ["0","1","2"]:
                    return rolemapping["rolemailto"].get(mailto,"")
            if self.alert_data['created_at']> datetime.datetime(2025, 10, 3, 13, 20, 0) and self.alert_data['bu'] in ['TAS'] and self.alert_data['violation_type'] not in ['device_tamper_count','main_supply_removal_count']:
                rolemapping = role_configuration.vts_unblocking_matrix[alert_section][self.alert_data.get("bu","")][self.params.get('va_level','level - 1')]
                if self.alert_data['sap_id'] in role_configuration.top_sod_sap_ids:
                    rolemapping = role_configuration.vts_sod_top_unblocking_matrix[alert_section][self.alert_data.get("bu","")][self.params.get('va_level','level - 1')]
                if mailto and mailto in ["0","1","2"]:
                    print("taking roles using va_level---->",rolemapping["rolemailto"].get(mailto,""))
                    return rolemapping["rolemailto"].get(mailto,"")   
            if mailto and mailto in ["0","1","2"]:
                rolemapping = role_configuration.role_Mapping[alert_section][self.alert_data.get("bu","")][self.alert_data.get("tt_type","bulk").lower()].get(interlock_name, {})
                return rolemapping["rolemailto"].get(mailto,"")
            
        elif self.alert_data.get("alert_section","") in ["RO"]:
            if self.params.get("va_level", "level - 1") in ['', None]:
                self.params["va_level"] = "level - 1"
            cris_mapping = cris_alert_mapping.Cris_Alert_Mapping[self.alert_data.get("bu", "")]
            if self.alert_data['violation_type'] in cris_mapping.keys():
                cris_mapping = cris_mapping[self.alert_data['violation_type']]['escalations'][self.params.get("va_level", "level - 1")]
                if mailto and mailto in ["0","1","2","3","4"]:
                    return cris_mapping.get(mailto,"")
        
        elif self.alert_data.get("alert_section","") in ["TAS"]:
            tas_mapping = tas_role_configuration.tas_role_mapping[alert_section].get(interlock_name, {})
            if mailto and mailto in ["0","1","2","3","4","5"]:
                return tas_mapping["rolemailto"].get(mailto,"")
            
        return mailto
    
    async def _role_configuration_mqofrole(self):
        mqof = self.params.get("mqofrole","")
        if self.alert_data.get("alert_section","") in ["VTS"]:
            interlock_name = self.alert_data.get("interlock_name","")
            alert_section = self.alert_data.get("alert_section","")
            if self.alert_data['bu'] in ['LPG']:
                if self.alert_data['sap_id'] in role_configuration.lpg_locations_with_one_officer and self.alert_data.get('tt_type','') in ['bulk']:
                    rolemapping = role_configuration.lpg_one_officer_unblocking_matrix[alert_section][self.alert_data.get("bu","")][self.params.get('va_level','level - 1')]
                elif (self.alert_data['sap_id'] in role_configuration.lpg_locations_with_no_officer or self.alert_data['sap_id'].startswith('4')) and self.alert_data.get('tt_type','') in ['bulk']:
                    rolemapping = role_configuration.lpg_no_officer_unblocking_matrix[alert_section][self.alert_data.get("bu","")][self.params.get('va_level','level - 1')]
                elif self.alert_data.get('tt_type','') in ['packed']:
                    rolemapping = role_configuration.lpg_packed_unblocking_matrix[alert_section][self.alert_data.get("bu","")][self.params.get('va_level','level - 1')]
                else:
                    rolemapping = role_configuration.vts_unblocking_matrix[alert_section][self.alert_data.get("bu","")][self.params.get('va_level','level - 1')]
                if mqof and mqof in ["0","1","2"]:
                    return rolemapping["mqof"].get(mqof,"")
            if self.alert_data['created_at']> datetime.datetime(2025, 10, 3, 13, 20, 0) and self.alert_data['bu'] in ['TAS'] and self.alert_data['violation_type'] not in ['device_tamper_count','main_supply_removal_count']:
                rolemapping = role_configuration.vts_unblocking_matrix[alert_section][self.alert_data.get("bu","")][self.params.get('va_level','level - 1')]
                if self.alert_data['sap_id'] in role_configuration.top_sod_sap_ids:
                    rolemapping = role_configuration.vts_sod_top_unblocking_matrix[alert_section][self.alert_data.get("bu","")][self.params.get('va_level','level - 1')]
                if mqof and mqof in ["0","1","2"]:
                    return rolemapping["mqof"].get(mqof,"")
            if mqof and mqof in ["0","1","2"]:
                rolemapping = role_configuration.role_Mapping[alert_section][self.alert_data.get("bu","")][self.alert_data.get("tt_type").lower()].get(interlock_name, {})
                return rolemapping["mqof"].get(mqof,"")
            
        elif self.alert_data.get("alert_section","") in ["VA"]:
            if self.params.get("va_level", "level - 1") in ['', None]:
                self.params["va_level"] = "level - 1"

            va_mapping = va_alert_mapping.VA_Alert_Mapping[self.alert_data.get("bu", "")]
            if self.alert_data['violation_type'] in va_mapping.keys():
                if mqof and mqof in ["0","1","2"]:
                    va_mapping = va_mapping[self.alert_data['violation_type']]['escalations'][self.params.get("va_level", "level - 1")]
                    if mqof == "0":
                        if isinstance(va_mapping['assign_role'],tuple):
                            return ",".join(va_mapping['assign_role'])
                        return va_mapping['assign_role']
                    if mqof == "1":
                        if isinstance(va_mapping['escalation_role'],tuple):
                            return ",".join(va_mapping['escalation_role'])
                        return va_mapping['escalation_role']
                    
        elif self.alert_data.get("alert_section","") in ["EMLock"]:
            if self.params.get("va_level", "level - 1") in ['', None]:
                self.params["va_level"] = "level - 1"
            
            emlock_mappings = emlock_mapping.emlock_vehicle_mapping[self.alert_data.get("bu", "")]
            if mqof and mqof in ["0"]:
                emlock_mappings = emlock_mappings[self.alert_data['violation_type']]['escalations'][self.params.get("va_level", "level - 1")]
                if mqof == "0":
                    return emlock_mappings['assign_role']
        
        elif self.alert_data.get("alert_section","") in ["LPG"]:
            if self.params.get("va_level", "level - 1") in ['', None]:
                self.params["va_level"] = "level - 1"
            lpg_mapping = lpg_role_configuration.lpg_role_mapping[self.alert_data.get("bu", "")]
            if self.alert_data['violation_type'] in lpg_mapping.keys():
                if mqof and mqof in ["0","1","2"]:
                    lpg_mapping = lpg_mapping[self.alert_data['violation_type']]['escalations'][self.params.get("va_level", "level - 1")]
                    if mqof == "0":
                        return lpg_mapping['assign_role']
                    if mqof == "1":
                        return lpg_mapping['escalation_role']
        
        elif self.alert_data.get("alert_section","") in ["RO"]:
            if self.params.get("va_level", "level - 1") in ['', None]:
                self.params["va_level"] = "level - 1"
            cris_mapping = cris_alert_mapping.Cris_Alert_Mapping[self.alert_data.get("bu", "")]
            if self.alert_data['violation_type'] in cris_mapping.keys():
                if mqof and mqof in ["0","1","2","3","4"]:
                    cris_mapping = cris_mapping[self.alert_data['violation_type']]['escalations'][self.params.get("va_level", "level - 1")]
                    return cris_mapping.get(mqof,"")
                
        elif self.alert_data.get("alert_section","") in ["TAS"]:
            interlock_name = self.alert_data.get("interlock_name","")
            alert_section = self.alert_data.get("alert_section","")
            tas_mapping = tas_role_configuration.tas_role_mapping[alert_section].get(interlock_name, {})
            if mqof and mqof in ["0","1","2","3","4","5"]:
                return tas_mapping["rolemailto"].get(mqof,"")
        
        return mqof

    async def _get_va_roles_list(self):
        mailto = self.params.get("rolemailto", "")
        if self.params.get("va_level", "level - 1") in ['', None]:
            self.params["va_level"] = "level - 1"

        if self.alert_data.get("alert_section") in ["VA"]:
            va_mapping = va_alert_mapping.VA_Alert_Mapping[self.alert_data.get("bu", "")]
        
        if self.alert_data.get("alert_section") in ["LPG"]:
            va_mapping = lpg_role_configuration.lpg_role_mapping[self.alert_data.get("bu", "")]

        if self.alert_data.get("alert_section") in ["EMLock"]:
            va_mapping = emlock_mapping.emlock_vehicle_mapping[self.alert_data.get("bu", "")]

        if self.alert_data['violation_type'] in va_mapping.keys():
            va_mapping = va_mapping[self.alert_data['violation_type']]['escalations'][self.params.get("va_level", "level - 1")]
            if mailto == "0":
                if isinstance(va_mapping['assign_role'],tuple):
                    return ",".join(va_mapping['assign_role'])
                return va_mapping['assign_role']
            if mailto == "1":
                if isinstance(va_mapping['escalation_role'],tuple):
                    return ",".join(va_mapping['escalation_role'])
                return va_mapping['escalation_role']
            if mailto == "2":
                if isinstance(va_mapping['assign_role'],tuple) and isinstance(va_mapping['escalation_role'],tuple):
                    combined_roles = va_mapping['assign_role'] + va_mapping['escalation_role']
                    roles = []
                    for item in combined_roles:
                        roles.extend(item.split(","))

                    # remove empty + duplicates (preserve order)
                    distinct_roles = list(dict.fromkeys(r.strip() for r in roles if r.strip()))

                    return ",".join(distinct_roles)
                
                return f"{va_mapping['assign_role']},{va_mapping['escalation_role']}"
        return mailto
