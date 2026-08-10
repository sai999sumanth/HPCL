import typing
import traceback
import aiofiles
import urdhva_base
import jinja2
import orchestrator.notification_manager.notification_factory as notification_factory
import hpcl_ceg_model

logger = urdhva_base.logger.Logger.getInstance("vendor_notification-log")

class VendorEmailNotification:

    def __init__(self):
        """Initialize VendorEmailNotification object"""
        self.params = {}
        self.mail_recipients = []
        self.cc_recipients = []
        self.subject = ""
        self.body = ""

    async def get_required_variables(self):
        return [
            "sap_id", "vendor_name", "device_type", "device_name",
            "zone", "bu", "remarks", "status", "messagetype", "location_name",
            "escalationlevel", "tas_faulty_unique_id", "resolved", "faulty_date"
        ]

    async def get_vendor_emails(self, sap_id, vendor_name, zone, bu, escalationlevel):
        try:
            records = await hpcl_ceg_model.TasHelpDeskVendorMails.get_all(
                 urdhva_base.queryparams.QueryParams(q=f"sap_id='{sap_id}' and vendor_name='{vendor_name}'", limit=0),
                 resp_type="plain"
            )
            record_list = records.get("data") if isinstance(records, dict) else records
            if not record_list:
                return [], []

            # Determine fields based on level
            level_fields = ["level1", "level2", "level3"] if int(escalationlevel) == 0 else [f"level{escalationlevel}"]
            
            emails = []
            for record in record_list:
                for field in level_fields:
                    val = record.get(field)
                    if val: emails.extend(addr.strip() for addr in val.split(",") if addr.strip())

            unique_emails = list(set(emails))

            # CC Logic (Users with SOD Roles)
            cc_roles = ["Location In-Charge SOD", "Maintenance Officer SOD", "Plant In-Charge SOD", "Planning Officer SOD", "Safety Officer SOD"]
            roles_array = "{" + ",".join(cc_roles) + "}"
            
            cc_query = f"SELECT email FROM users WHERE '{sap_id}' = ANY(sap_id) AND novex_role && '{roles_array}'::varchar[] AND email IS NOT NULL"
            cc_data = await hpcl_ceg_model.Users.get_aggr_data(cc_query, limit=0)

            cc_emails = [u["email"] for u in cc_data.get("data", []) if u.get("email")] if cc_data else []
            return unique_emails, list(set(cc_emails))
        except Exception as e:
            logger.exception(f"Error fetching emails: {e}")
            return [], []

    async def read_template(self) -> str:
        try:
            filepath = f"{urdhva_base.settings.template_path}/vendor_notification_notify.html"
            async with aiofiles.open(filepath, "r") as f:
                return await f.read()
        except Exception:
            return ""

    async def process(self, params: dict):
        self.params = params
        try:
            # Helper to extract Camunda's {"value": x} or raw x
            def get_val(key, default=None):
                v = params.get(key, default)
                return v.get("value") if isinstance(v, dict) and "value" in v else v

            # 1. Variable Extraction
            sap_id = get_val("sap_id")
            vendor_name = get_val("vendor_name")
            location_name = get_val("location_name", "N/A")
            escalation_level = int(get_val("escalationlevel", 1))
            tas_id = get_val("tas_faulty_unique_id")
            remarks = get_val("remarks", "")
            logged_date = get_val("faulty_date", "N/A")
            
            # Resolution logic
            resolved = get_val("resolved", False)
            is_resolved = True if str(resolved).lower() == "true" else False

            # 2. Fetch Emails
            self.mail_recipients, self.cc_recipients = await self.get_vendor_emails(
                sap_id, vendor_name, get_val("zone"), get_val("bu"), escalation_level
            )

            # 3. Dynamic Subject Construction
            if is_resolved:
                self.subject = f"Resolved: TAS Service Request - {location_name}"
            elif escalation_level >= 2:
                self.subject = f"TAS Service Request Escalation - {location_name}"
            else:
                self.subject = f"TAS Service Request - {location_name}"

            # 4. Render Template
            template_content = await self.read_template()
            if not template_content: return False, "Template not found"

            self.body = jinja2.Template(template_content).render(
                is_resolved=is_resolved,
                escalation_level=escalation_level,
                location_name=location_name,
                sr_number=tas_id,
                description=remarks,
                logged_date=logged_date,
                assigned_to=", ".join(self.mail_recipients),
                subject=self.subject
            )

            # 5. Dispatch
            await self._send_notification()
            return True, {"msg": "Notification sent successfully"}

        except Exception as e:
            logger.error(traceback.format_exc())
            return False, str(e)

    async def _send_notification(self):
        notification_module = await notification_factory.get_notification_module(module_type="email")
        await notification_module.publish_message(
            recipients=self.mail_recipients,
            cc_recipients=self.cc_recipients,
            subject=self.subject,
            body=self.body,
            force_send=True,
            html_content=True,
        )

    async def handle_vendor_notification(self, params: dict):
        return await self.process(params)