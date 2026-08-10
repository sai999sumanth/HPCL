from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import re

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

router = fastapi.APIRouter(prefix='/dailyemailnotificationusers')


# Action add_recipients
@router.post('/add_recipients', tags=['DailyEmailNotificationUsers'])
async def dailyemailnotificationusers_add_recipients(data: Dailyemailnotificationusers_Add_RecipientsParams):
    existing_users = await DailyEmailNotificationUsers.get_all(resp_type='plain')
    
    def normalize(value):
        if isinstance(value, list):
            return [x.strip() for x in value if x]
        elif isinstance(value, str):
            return [x.strip() for x in value.split(",") if x.strip()]
        return []
    
    def get_invalid_emails(email_list):
        return [email for email in email_list if not EMAIL_REGEX.match(email)]

    email_type = data.email_type
    bu = data.bu
    subject = data.subject
    audience = data.audience
    action = (data.action or "").lower()

    to_list = normalize(data.to_recipients)
    cc_list = normalize(data.cc_recipients)
    bcc_list = normalize(data.bcc_recipients)

    all_inputs = to_list + cc_list + bcc_list
    invalid_emails = get_invalid_emails(all_inputs)

    if invalid_emails:
        return {
            "status": "error",
            "message": f"Invalid email addresses: {', '.join(invalid_emails)}"
        }

    # for user in existing_users["data"]:
    matched_user = next(
        (
            user
            for user in existing_users["data"]
            if (
                user["email_type"] == email_type
                and user["bu"] == bu
                # and user.get("subject") == subject
                and user.get("audience") == audience
            )
        ),
        None
    )
        # if user["email_type"] == email_type and bu == user["bu"]:
    if matched_user:

        existing_subject = matched_user.get("subject")

        response_data = {
            "subject": {},
            "Already_exists_emails": [],
            "Updated_to_recipients": [],
            "Updated_cc_recipients": [],
            "Updated_bcc_recipients": []
        }

        to_set = set(normalize(matched_user.get("to_recipients")))
        cc_set = set(normalize(matched_user.get("cc_recipients")))
        bcc_set = set(normalize(matched_user.get("bcc_recipients")))

        messages = []
        changes_made = False

        if action == "add" and data.subject is not None:
            if existing_subject != data.subject:
                changes_made = True
                response_data["subject"] = {
                    "old": existing_subject,
                    "new": data.subject
                }
                messages.append(f"Subject updated from '{existing_subject}' to '{data.subject}'")


        # ------------------------
        # DELETE LOGIC
        # ------------------------
        if action == "delete":
            def remove_emails(target_set, remove_list, label):
                removed = []
                nonlocal changes_made
                for email in remove_list:
                    if email in target_set:
                        target_set.remove(email)
                        removed.append(email)
                        changes_made = True  
                    else:
                        # messages.append(f"{email} not found in {label}")
                        messages.append(f"The email address '{email}' was not found in the {label} Recipients list.")
                return removed

            removed_to = remove_emails(to_set, to_list, "TO")
            removed_cc = remove_emails(cc_set, cc_list, "CC")
            removed_bcc = remove_emails(bcc_set, bcc_list, "BCC")

            msg_parts = []
            if removed_to:
                msg_parts.append(f"Removed from TO: {', '.join(removed_to)}")
            if removed_cc:
                msg_parts.append(f"Removed from CC: {', '.join(removed_cc)}")
            if removed_bcc:
                msg_parts.append(f"Removed from BCC: {', '.join(removed_bcc)}")

            final_message = "; ".join(msg_parts + messages)


        # ------------------------
        # ADD LOGIC
        # ------------------------
        elif action == "add":

            email_map = {}
            for e in to_set:
                email_map[e] = "TO"
            for e in cc_set:
                email_map[e] = "CC"
            for e in bcc_set:
                email_map[e] = "BCC"

            added_map = {"TO": [], "CC": [], "BCC": []}
            already_exists = []

            def add_emails(new_list, target_set, target_type):
                nonlocal changes_made
                for email in new_list:
                    if email in email_map:
                        # messages.append(f"{email} already exists in {email_map[email]}")
                        messages.append(f"The email address '{email}' already exists in the {email_map[email]} Recipients list.")
                        already_exists.append(email)
                    else:
                        target_set.add(email)
                        added_map[target_type].append(email)
                        email_map[email] = target_type
                        changes_made = True 

            add_emails(to_list, to_set, "TO")
            add_emails(cc_list, cc_set, "CC")
            add_emails(bcc_list, bcc_set, "BCC")

            response_data["Already_exists_emails"] = already_exists
            response_data["Updated_to_recipients"] = added_map["TO"]
            response_data["Updated_cc_recipients"] = added_map["CC"]
            response_data["Updated_bcc_recipients"] = added_map["BCC"]

            msg_parts = []
            if added_map["TO"]:
                msg_parts.append(f"Added to TO: {', '.join(added_map['TO'])}")
            if added_map["CC"]:
                msg_parts.append(f"Added to CC: {', '.join(added_map['CC'])}")
            if added_map["BCC"]:
                msg_parts.append(f"Added to BCC: {', '.join(added_map['BCC'])}")

            final_message = "; ".join(msg_parts + messages)

        else:
            return {"status": "error", "message": "Invalid action. Use 'add' or 'delete'"}

        if not changes_made:
            return {
                "status": "success",
                "message": "; ".join(messages) if messages else "No changes made",
                "data": response_data
            }

        # ---------------- DB UPDATE ----------------
        resp = await DailyEmailNotificationUsers(
            id=matched_user["id"],
            email_type=email_type,
            bu=matched_user["bu"],
            name=data.name if data.name is not None else matched_user.get("name"),
            subject=data.subject if data.subject is not None else matched_user.get("subject"),
            description=data.description if data.description is not None else matched_user.get("description"),
            enabled=data.enabled if data.enabled is not None else matched_user.get("enabled", True),
            audience=audience,
            to_recipients=list(to_set),
            cc_recipients=list(cc_set),
            bcc_recipients=list(bcc_set)
        ).modify()
        rpt = urdhva_base.context.context.get("rpt", {})
        if resp:
            if action == 'add':
                await SystemAuditLogCreate(
                    **{
                        "employee_id": rpt.get("username"),
                        "role": rpt.get("novex_role", []),
                        "email": rpt.get("email", ""),
                        "bu": "",
                        "action": "UPDATE",
                        "section": "EMAIL",
                        "action_model": "EMAIL_ACTION",
                        "remarks": f"Email recipients updated for '{email_type}' (Audience: {audience}, Subject: '{matched_user.get("subject")}'). {final_message}",
                        "raw_data": {
                            "old_data": {
                                "email_type": email_type,
                                "to_recipients": list(normalize(matched_user.get("to_recipients"))),
                                "cc_recipients": list(normalize(matched_user.get("cc_recipients"))),
                                "bcc_recipients": list(normalize(matched_user.get("bcc_recipients"))),
                                "subject": matched_user.get("subject"),
                            },
                            "new_data": {
                                "email_type": email_type,
                                "to_recipients": list(to_set),
                                "cc_recipients": list(cc_set),
                                "bcc_recipients": list(bcc_set),
                                "subject": data.subject if getattr(data, "subject", None) is not None else matched_user.get("subject"),
                            }
                        }
                    }
                ).create()

            if action == 'delete':
                await SystemAuditLogCreate(
                    **{
                        "employee_id": rpt.get("username"),
                        "role": rpt.get("novex_role", []),
                        "email": rpt.get("email", ""),
                        "bu": "",
                        "action": "UPDATE",
                        "section": "EMAIL",
                        "action_model": "EMAIL_ACTION",
                        "remarks": f"Email recipients removed from '{email_type}' (Audience: {audience}, Subject: '{subject}'). {final_message}",
                        "raw_data": {
                            "old_data": {
                                "email_type": email_type,
                                "to_recipients": list(normalize(matched_user.get("to_recipients"))),
                                "cc_recipients": list(normalize(matched_user.get("cc_recipients"))),
                                "bcc_recipients": list(normalize(matched_user.get("bcc_recipients"))),
                                "subject": matched_user.get("subject"),
                            },
                            "new_data": {
                                "email_type": email_type,
                                "to_recipients": list(to_set),
                                "cc_recipients": list(cc_set),
                                "bcc_recipients": list(bcc_set),
                                "subject": matched_user.get("subject"), 
                            }
                        }
                    }
                ).create()
        return {
            "status": "success",
            "message": final_message if final_message else "No changes made",
            "data": response_data
        }

    # ------------------------
    # CREATE ONLY FOR ADD
    # ------------------------
    # if action == "add":
    #     resp = await DailyEmailNotificationUsersCreate(**dict(data)).create()
    #     return {
    #         "status": "success",
    #         "message": "New record created",
    #         "data": resp
    #     }

    return {
        "status": "error",
        "message": "Record not found for delete operation"
    }




# Action get_email_audience
@router.post('/get_email_audience', tags=['DailyEmailNotificationUsers'])
async def dailyemailnotificationusers_get_email_audience(data: Dailyemailnotificationusers_Get_Email_AudienceParams):
    if urdhva_base.context.context.exists():
        rpt = urdhva_base.context.context.get('rpt', {})
    else:
        rpt = {}

    all_audiences = ["Scheduled Report", "Dev Testing", "Test Report"]
    limited_audiences = ["Scheduled Report", "Test Report"]

    print(rpt.get('novex_role'))
    user_roles = rpt.get('novex_role', [])
    admin_roles = {'Admin', 'Super Admin'}

    if any(role in admin_roles for role in user_roles):
        return {
            "status": "success",
            "data": all_audiences
        }
    else:
        return {
            "status": "success",
            "data": limited_audiences
        }