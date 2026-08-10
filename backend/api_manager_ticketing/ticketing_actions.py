import urdhva_base
from hpcl_ceg_ticketing_enum import *
from typing import Optional
from fastapi.responses import FileResponse
from fastapi import Form, File, UploadFile
from hpcl_ceg_ticketing_model import (
    Ticketing,
    TicketUserMails,
    TicketingCreate,
    Ticketing_Get_TicketParams,
    Ticketing_Create_TicketParams,
    Ticketing_Delete_TicketParams,
    Ticketing_Close_TicketParams,
    Ticketing_Update_TicketParams,
    Ticketing_Attach_FileParams,
    Ticketing_Delete_CommentParams,
    Ticketing_Edit_DescriptionParams,
    Ticketing_Edit_CommentParams,
    Ticketing_Update_PriorityParams,
    Ticketing_Update_ReporterParams,
    Ticketing_Update_AssigneeParams,
    Ticketing_Delete_File_AttachmentParams,
    Ticketing_Merge_TicketParams,
    Ticketing_Download_File_AttachmentParams,
    Ticketing_Add_Comment_To_TicketParams,
    Ticketing_Delete_DescriptionParams,
    Ticketing_Attach_File_To_CommentParams,
    Ticketing_Delete_File_From_CommentParams,
    Ticketing_Get_Location_DataParams,
    Ticketing_Vts_Block_TrucksParams,
    Ticketing_Pm_OrdersParams,
    Ticketing_Pm_Orders_WeeklyParams,
    Ticketing_Run_Alert_CloserParams

)
import os, uuid
import fastapi
import logging
import traceback
import urdhva_base
import api_manager
import hpcl_ceg_model
from dateutil import parser
from datetime import datetime, timezone
from hpcl_ceg_enum import AlertActionType
from fastapi import UploadFile, File, Depends
from orchestrator.alerting import alert_helper
from fastapi import APIRouter, HTTPException
from urdhva_base.queryparams import QueryParams
from fastapi import UploadFile, File, Form
import utilities.minio_connector as minio_connector
import json
import api_manager_ticketing.api_helpers as api_helpers
from typing import List,Dict
from zoneinfo import ZoneInfo
import orchestrator.alerting.alert_manager as alert_manager
import orchestrator.notification_manager.notify_email as notify_email
import orchestrator.alerting.alert_ticket_close as alert_ticket_close



router = fastapi.APIRouter(prefix='/ticketing')
logger = logging.getLogger(__name__)



BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_TEMPLATE_PATH = os.path.join(BASE_DIR, "orchestrator", "notification_templates")


MAIL_TRIGGER_STATES = {
    State.UpdatedByInitiator.value,
    State.ReturnedByOcc.value,
    State.ReviewedByOcc.value,
}

TEMPLATE_MAP = {
    State.Open.value: "create_ticket.html",
    State.Reassigned.value: "reassigned_ticket.html",
    State.Escalated.value: "escalated_ticket.html",
    State.UpdatedByInitiator.value: "updated_ticket.html",
    State.ReturnedByOcc.value: "returned_ticket.html",
    State.ReviewedByOcc.value: "reviewed_ticket.html",
}

CATEGORY_FUNCTIONAL_MAP = {
    "Transportation Discipline": "Transportation & Bio-fuels",
    "VTS Live Tracking": "Transportation & Bio-fuels",
    "Inventory Management": "Operations & Automation",
    "Safety Performance": "HSE, M&I and Projects",
    "Asset Integrity": "HSE, M&I and Projects",
}

ZONAL_FUNCTIONAL_MAP = {
            "Transportation Discipline": f"Zonal SOD Ticketing",
            "VTS Live Tracking": f"Zonal SOD Ticketing",
            "Inventory Management": f"Zonal SOD Ticketing",
            "Safety Performance": f"Zonal SOD Ticketing",
            "Asset Integrity": f"Zonal SOD Ticketing",
        }


async def _location_incharge_data(sap_ids: list[str]) -> tuple[set[str], set[str]]:
    if not sap_ids:
        return set(), set()

    sap_in = ",".join(f"'{s}'" for s in sap_ids)
    params = urdhva_base.queryparams.QueryParams(
        q=f"sap_id IN ({sap_in}) and level='Location'", limit=0
    )
    params.fields = ["email_id", "zone"]

    records = ((await TicketUserMails.get_all(params, resp_type="plain")) or {}).get("data", [])

    emails: set[str] = set()
    zones:  set[str] = set()

    for rec in records:
        email = rec.get("email_id")
        zone = rec.get("zone")

        # handle list values from postgres array
        if isinstance(email, list):
            email = email[0] if email else None

        if isinstance(zone, list):
            zone = zone[0] if zone else None

        email = (email or "").strip()
        zone = (zone or "").strip()

        if email:
            emails.add(email)

        if zone:
            zones.add(zone)

    return emails, zones


async def _fetch_role_emails(
        zonal_functionary_roles: list[str],
        zonal_head_roles: list[str],
        hqo_roles: list[str],
) -> tuple[set[str], set[str], set[str]]:
    """
    Single IN query for all roles combined.
    Buckets results back into three sets by matching the role column
    against each role-group's known strings.

    Returns (zonal_functionary_emails, zonal_head_emails, hqo_emails).
    """
    all_roles = zonal_functionary_roles + zonal_head_roles + hqo_roles
    if not all_roles:
        return set(), set(), set()

    roles_in = ",".join(f"'{r}'" for r in all_roles)
    params = urdhva_base.queryparams.QueryParams(
        q=f"role IN ({roles_in})", limit=0
    )
    params.fields = ["email_id", "role"]

    records = (
            (await TicketUserMails.get_all(params, resp_type="plain")) or {}
    ).get("data", [])

    zf_set = set(zonal_functionary_roles)
    zh_set = set(zonal_head_roles)
    hqo_set = set(hqo_roles)

    zonal_functionary_emails: set[str] = set()
    zonal_head_emails: set[str] = set()
    hqo_emails: set[str] = set()

    for rec in records:
        email = (rec.get("email_id") or "").strip()
        role = (rec.get("role") or "").strip()
        if not email:
            continue
        if role in zf_set:
            zonal_functionary_emails.add(email)
        elif role in zh_set:
            zonal_head_emails.add(email)
        elif role in hqo_set:
            hqo_emails.add(email)

    return zonal_functionary_emails, zonal_head_emails, hqo_emails


        
async def send_ticket_mail(ticket_data: dict) -> None:
    ticket_state: str = ticket_data.get("ticket_state", "")
    try:
        state_enum = State(ticket_state)
    except ValueError:
        print(f"send_ticket_mail: unknown ticket_state '{ticket_state}' "
              f"for ticket {ticket_data.get('ticket_id')}: mail skipped")
        return

    escalation_level: str = (ticket_data.get("escalation_level") or "").strip()

    category_list = ticket_data.get("category") or []
    sub_category_list = ticket_data.get("sub_category") or []
    category = category_list[0] if category_list else ""
    sub_category = sub_category_list[0] if sub_category_list else ""
    functional_area: str = CATEGORY_FUNCTIONAL_MAP.get(category, "")

    sap_ids = ticket_data.get("sap_id") or []
    if not isinstance(sap_ids, list):
        sap_ids = [sap_ids]
    sap_ids = list({str(s) for s in sap_ids if s})

    loc_names = ticket_data.get("location_name") or []
    if not isinstance(loc_names, list):
        loc_names = [loc_names]
    location_name_str = ", ".join(sorted({l for l in loc_names if l}))

    location_emails, zones_seen = await _location_incharge_data(sap_ids)

    if not zones_seen:
        zone_raw = ticket_data.get("zone") or []
        if not isinstance(zone_raw, list):
            zone_raw = [zone_raw]
        zones_seen = {z.strip() for z in zone_raw if (z or "").strip()}
        if zones_seen:
            print(
                f"send_ticket_mail: sap_id absent for ticket "
                f"{ticket_data.get('ticket_id')} - using zone from ticket_data: {zones_seen}"
            )

    zonal_functionary_roles: list[str] = []
    zonal_head_roles: list[str] = []
    hqo_roles: list[str] = ["HQO"]

    if zones_seen and functional_area:
        zonal_functionary_roles = [f"{z}-{functional_area}" for z in zones_seen]
        zonal_head_roles = [f"{z}-Zonal Head" for z in zones_seen]

    zonal_functionary_emails, zonal_head_emails, hqo_emails = (
        await _fetch_role_emails(zonal_functionary_roles, zonal_head_roles, hqo_roles))

    to_emails: set[str] = set()
    cc_emails: set[str] = set()

    if state_enum == State.Open:
        if location_emails:
            to_emails = location_emails
            cc_emails = set.union(zonal_functionary_emails, zonal_head_emails, hqo_emails)
        else:
            to_emails = zonal_functionary_emails
            cc_emails = set.union(zonal_head_emails, hqo_emails)
    
    elif state_enum == State.Reassigned:
        re_assignee_mails: set[str] = {m.strip() for m in (ticket_data.get("re_assingee_mail") or []) if (m or "").strip()}
        if re_assignee_mails:
            to_emails = re_assignee_mails
            cc_emails = set.union(location_emails,zonal_functionary_emails,zonal_head_emails,hqo_emails)

    elif state_enum == State.Escalated:
        if escalation_level == "L1":
            to_emails = zonal_functionary_emails
            cc_emails = set.union(zonal_head_emails, hqo_emails)

        elif escalation_level == "L2":
            to_emails = zonal_head_emails
            cc_emails = hqo_emails

        else:
            to_emails = zonal_functionary_emails
            cc_emails = set.union(zonal_head_emails, hqo_emails)

    elif state_enum == State.UpdatedByInitiator:
        to_emails = hqo_emails
        cc_emails = zonal_head_emails

    elif state_enum in (State.ReturnedByOcc, State.ReviewedByOcc):
        if location_emails:
            to_emails = location_emails
            cc_emails = set.union(zonal_functionary_emails, zonal_head_emails, hqo_emails)
        else:
            to_emails = zonal_functionary_emails
            cc_emails = set.union(zonal_head_emails, hqo_emails)

    cc_emails -= to_emails

    if not to_emails and not cc_emails:
        print(
            f"send_ticket_mail: no recipients for ticket "
            f"{ticket_data.get('ticket_id')} "
            f"(state={ticket_state}, escalation_level={escalation_level or '-'}) - skipped"
        )
        return

    template_path = os.path.join(BASE_TEMPLATE_PATH, TEMPLATE_MAP[state_enum.value])

    response_days = None
    start = ticket_data.get("start_date")
    end = ticket_data.get("ticket_end_date")
    if start and end:
        try:
            response_days = (end.date() - start.date()).days
        except Exception as exc:
            print(f"response_days calc failed: {exc}")

    zone_name_str = next(iter(zones_seen)) if zones_seen else ""
    template_data = {
        "ticket_id": ticket_data.get("ticket_id"),
        "ticket_state": ticket_state,
        "location_name": location_name_str,
        "zone_name": zone_name_str,
        "category": category,
        "sub_category": sub_category,
        "response_days": response_days,
        "escalation_level": escalation_level or None,
    }

    subject = f"[{ticket_state}] Ticket {ticket_data.get('ticket_id')} | {category} | {location_name_str}"
    if escalation_level:
        subject = f"[{ticket_state} - {escalation_level}] Ticket {ticket_data.get('ticket_id')} | {category} | {location_name_str}"

    to_list = list(to_emails)
    cc_list = list(cc_emails)

    notify_ins = notify_email.NotifyEMail()
    await notify_ins.publish_message(
        recipients=to_list,
        cc_recipients=cc_list,
        subject=subject,
        body=alert_manager.read_template(template_path, data=template_data),
        html_content=True,
        force_send=True,
    )

    print(
        f"Mail Sent | Ticket={ticket_data.get('ticket_id')} "
        f"| State={ticket_state} | EscLevel={escalation_level or 'None'} "
        f"| TO={to_list} | CC={cc_list}"
    )


# ----------------------------------------------------
# Common helper for create_ticket & update_ticket
# ----------------------------------------------------
def clean_list(value):
    """convert '', [''], None -> [] and remove blanks"""
    if not value:
        return []
    if isinstance(value, list):
        return [str(v) for v in value if str(v).strip()]
    if str(value).strip():
        return [str(value)]
    return []


# ----------------------------------------------------

# Action get_ticket
@router.post('/get_ticket', tags=['Ticketing'])
async def ticketing_get_ticket(data: Ticketing_Get_TicketParams):
    """
    Get ticket details by ticket id
    """
    try:
        id = data.ticket_id
        result = await Ticketing.get(int(id))
        return result
    except Exception as e:
        print(traceback.format_exc())
        print(f"Error in getting ticket: {e}, InputData {data.dict()}, Traceback: {traceback.format_exc()}")
        return False, "Error in getting ticket"


# Action create_ticket
# Action create_ticket
@router.post('/create_ticket', tags=['Ticketing'])
async def ticketing_create_ticket(data: Ticketing_Create_TicketParams):
    """
    Create a new ticket
    """
    rpt = urdhva_base.context.context.get('rpt', None)
    print("rpt", rpt)
    user_name = rpt.get('username') if rpt else None
    employee_id = data.employee_id

    tdata = data.model_dump()
    order_ids = tdata.get("order_id")
    if order_ids in ("", None):
        tdata["order_id"] = []
    elif isinstance(order_ids, list):
        tdata["order_id"] = [x for x in order_ids if x]
    else:
        tdata["order_id"] = [order_ids]

    # FIX 1: correct typo was re_asningee -> re_assingee
    for field in ["re_assingee_employee_id", "re_assingee_mail"]:
        if tdata.get(field) == "" or tdata.get(field) is None:
            tdata[field] = []

    frontend_reporter = tdata.get("reporter")
    reporter_value = frontend_reporter if frontend_reporter else user_name
    auto_close_flag_raw = tdata.get("auto_ticket_close", "")
    auto_close_flag = False

    if str(auto_close_flag_raw).lower() in ["yes", "true", "1"]:
        auto_close_flag = True

    if not tdata.get("subtask_id"):
        tdata["subtask_id"] = []

    conditions = [
        f"bu='{tdata['bu']}'",
        f"alert_section='{tdata['alert_section']}'"
    ]

    sap_ids = tdata.get("sap_id") or []
    if isinstance(sap_ids, list) and sap_ids:
        sap_values = ",".join(f"'{x}'" for x in sap_ids if x)
        if sap_values:
            conditions.append(f"sap_id IN ({sap_values})")

    loc_names = tdata.get("location_name") or []
    if isinstance(loc_names, list) and loc_names:
        loc_values = ",".join(f"'{x}'" for x in loc_names if x)
        if loc_values:
            conditions.append(f"location_name IN ({loc_values})")

    where_clause = " and ".join(conditions)

    params = urdhva_base.queryparams.QueryParams(q=where_clause, limit=10000)
    params.fields = [
        'bu',
        'sop_id',
        'alert_section',
        'sap_id',
        'location_name',
        'interlock_name',
        'unique_id'
    ]

    resp = await hpcl_ceg_model.Alerts.get_all(params, resp_type='plain')

    if not resp or len(resp) == 0:
        raise fastapi.HTTPException(status_code=404, detail="Alerts not found")

    alert_data = resp.get('data', [])

    # Group alerts by interlock_name
    grouped_alerts = {}
    for alert in alert_data:
        alert_type = alert.get('interlock_name')
        if alert_type:
            grouped_alerts.setdefault(alert_type, []).append(alert)

    selected_type_raw = tdata.get("alert_type")
    manual_ticket = False

    if not selected_type_raw:
        if grouped_alerts:
            result = [
                {
                    "alert_type": alert_type,
                    "sop_id": alerts[0].get('sop_id') if alerts else None
                }
                for alert_type, alerts in grouped_alerts.items()
            ]
            return {"reporter": user_name, "alert_types": result}
        else:
            manual_ticket = True
            selected_types = [None]

    else:
        selected_types = selected_type_raw if isinstance(selected_type_raw, list) else [selected_type_raw]

        # convert [""] -> manual ticket
        selected_types = [t for t in selected_types if t and str(t).strip()]

        if len(selected_types) == 0:
            manual_ticket = True
            selected_types = [None]

        manual_ticket = False

        if not selected_type_raw:
            if grouped_alerts:
                result = [
                    {
                        "alert_type": alert_type,
                        "sop_id": alerts[0].get('sop_id') if alerts else None
                    }
                    for alert_type, alerts in grouped_alerts.items()
                ]
                return {"reporter": user_name, "alert_types": result}
            else:
                manual_ticket = True
                selected_types = [None]

        else:
            selected_types = selected_type_raw if isinstance(selected_type_raw, list) else [selected_type_raw]

            # remove empty strings like [""]
            selected_types = [t for t in selected_types if t and str(t).strip()]

            if len(selected_types) == 0:
                manual_ticket = True
                selected_types = [None]

    # Validate
    if not manual_ticket:
        for selected_type in selected_types:
            if selected_type not in grouped_alerts:
                raise fastapi.HTTPException(status_code=400, detail=f"Alert type '{selected_type}' not found.")

    # collect all alerts for single ticket
    selected_alerts = []
    selected_unique_ids = []

    if not manual_ticket:
        for st in selected_types:
            alerts_for_type = grouped_alerts[st]
            selected_alerts.extend(alerts_for_type)
            selected_unique_ids.append(alerts_for_type[0].get("unique_id"))
    else:
        selected_alerts = [{}]
        selected_unique_ids = [None]

    # main alert reference
    selected_alert = selected_alerts[0]
    alert_unique_id = selected_unique_ids[0]

    tickets_created = []

    # ----------------------------
    # Proceed to TICKET CREATION
    # ----------------------------

    # Build iteration list — sap_ids first, fall back to zones, else single manual pass
    sap_ids_to_create = [s for s in (tdata.get("sap_id") or []) if s]
    zones_to_create   = [z for z in (tdata.get("zone") or []) if z]

    if sap_ids_to_create:
        iterate_by = "sap"
        iter_list  = sap_ids_to_create
    elif zones_to_create:
        iterate_by = "zone"
        iter_list  = zones_to_create
    else:
        iterate_by = "manual"
        iter_list  = [None]

    req_sap_ids   = [s for s in (tdata.get("sap_id") or []) if s]
    req_loc_names = tdata.get("location_name") or []
    sap_to_location = {
        sap: req_loc_names[i]
        for i, sap in enumerate(req_sap_ids)
        if i < len(req_loc_names) and req_loc_names[i]
    }
    

    for current_iter_val in iter_list:

        selected_type = selected_types[0] if selected_types else None

        ticket_data = tdata.copy()

        # Pin sap_id / zone / location_name depending on what we're iterating over
        if iterate_by == "sap":
            ticket_data['sap_id'] = [current_iter_val]
            sap_for_name = current_iter_val or "NA"
            # get corresponding location for this sap from positional map, fallback to alert_data
            matched_location = sap_to_location.get(current_iter_val)
            if not matched_location:
                matched_location = next(
                    (a.get('location_name') for a in alert_data
                     if a.get('sap_id') == current_iter_val and a.get('location_name')),
                    None
                )
            ticket_data['location_name'] = [matched_location] if matched_location else []

        elif iterate_by == "zone":
            ticket_data['sap_id'] = []
            ticket_data['zone']   = [current_iter_val]
            sap_for_name = current_iter_val or "NA"
            # location_name stays as-is for zone level tickets

        else:
            ticket_data['sap_id'] = []
            sap_for_name = "NA"
            # manual ticket — keep whatever location_name was in payload

        # FIX 2: safety guard — ensure list fields are always lists before TicketingCreate
        for field in ["re_assingee_employee_id", "re_assingee_mail"]:
            if not isinstance(ticket_data.get(field), list):
                ticket_data[field] = []

        # Core fields
        ticket_data['alert_id'] = alert_unique_id

        ticket_data['ticket_id'] = await alert_helper.get_alert_unique_id(
            'OCC',
            ticket_data.get('sop_id')
        )
        ticket_data['ticket_id'] = f"TKT-{ticket_data['ticket_id']}"
        print("ticket_data['ticket_id']: ", ticket_data['ticket_id'])

        # Generate incremental ticket_name
        redis_ins = await urdhva_base.redispool.get_redis_connection()
        redis_key = f"ticket_counter:{ticket_data['bu']}"
        ticket_count = await redis_ins.incr(redis_key)

        ticket_data['ticket_name'] = (
            f"{ticket_data['bu']}_{sap_for_name}_{ticket_count}"
            if not ticket_data.get('ticket_name')
            else f"{ticket_data.get('ticket_name')}_{ticket_data['bu']}_{sap_for_name}_{ticket_count}"
        )

        category = ticket_data.get("category")
        if isinstance(category, list):
            category = category[0] if category else None
        functional_area = CATEGORY_FUNCTIONAL_MAP.get(category)
        print("functional_area: ", functional_area)
        bu = ticket_data.get("bu")
        zonal_area = ZONAL_FUNCTIONAL_MAP.get(category)

        zones_list = ticket_data.get("zone") or []
        zones = ",".join([f"'{z}'" for z in zones_list if z])
        sap_ids = ticket_data.get("sap_id")
        print("sap_ids: ", sap_ids)
        employee_ids = []
        if functional_area and zones and not sap_ids:
            role_condition = f"role LIKE '%{functional_area}%'"
            query = f"""
                            SELECT zone, employee_id,role
                            FROM ticket_user_mails
                            WHERE {role_condition}
                            AND zone IN ({zones})
                            ORDER BY zone DESC
                        """
            users_rec = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
            users = users_rec.get("data", [])
            employee_ids = [u.get("employee_id") for u in users if u.get("employee_id")]
            employee_roles = [zonal_area]
        else:
            sap_values = ",".join(f"'{s}'" for s in sap_ids if s)
            query = f"""
                                        SELECT zone, employee_id,role
                                        FROM ticket_user_mails
                                        WHERE sap_id IN ({sap_values})
                                        AND zone IN ({zones})
                                        ORDER BY zone DESC
                                    """
            users_rec = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
            users = users_rec.get("data", [])
            # employee_ids = [u.get("employee_id") for u in users if u.get("employee_id")]
            employee_roles = [u.get("role") for u in users if u.get("role")]

        ticket_data["employee_id"] = employee_ids
        ticket_data["employee_role"] = employee_roles

        # Linked alerts if provided
        clean_linked_ids = [x for x in (data.linked_alert_id or []) if str(x).strip()]

        linked_res = []

        if clean_linked_ids:
            linked_data = f"id in ({','.join(map(str, clean_linked_ids))})"
            params = urdhva_base.queryparams.QueryParams(q=linked_data, limit=10000)
            params.fields = ["id", "alert_status", "alert_history", "interlock_name"]
            resp = await hpcl_ceg_model.Alerts.get_all(params, resp_type='plain')
            linked_res = resp.get('data', [])

        all_alerts_closed = True
        alert_status = None

        if clean_linked_ids:
            for alert in linked_res:
                alert_status = alert.get("alert_status")
                if alert_status in ["Open", "Pending", None]:
                    all_alerts_closed = False
                    break
        else:
            all_alerts_closed = False

        startdate = ticket_data.get("start_date")

        ticket_state_str = ticket_data.get('ticket_state')
        if isinstance(ticket_state_str, State):
            ticket_state_str = ticket_state_str.name
        if auto_close_flag and all_alerts_closed:
            ticket_state_str = "ReviewedByOcc"
            ticket_data["ticket_state"] = "ReviewedByOcc"
        else:
            ticket_state_str = "Open"
            ticket_data["ticket_state"] = "Open"

        ticket_data["auto_ticket_close"] = "Yes" if auto_close_flag else "No"

        ticket_data["comment_history"] = [{
            "updated_by": user_name,
            "updated_time": datetime.now().isoformat(),
            "ticket_msg": ticket_data.get("ticket_state")
        }]

        ticket_end_date = ticket_data.get('ticket_end_date')
        for key, value in {
            'ticket_name': ticket_data['ticket_name'],
            'sop_id': ticket_data.get('sop_id', selected_alert.get('sop_id')),
            'reporter': reporter_value,
            'ticket_status': Status.Close.value if ticket_state_str in ["ReviewedByOcc"] else Status.Open.value,
            'ticket_state': State[ticket_state_str].value,
            'ticket_severity': ticket_data.get('ticket_severity') or Severity.Medium.value,
            'startdate': startdate,
            'ticket_history': [],
            'linked_alert_id': data.linked_alert_id,
            'interlock_name': [] if manual_ticket else selected_types,
            'comment': ticket_data.get('comment'),
            'file_attachment': data.file_attachment,
            'file_attachment_name': data.file_attachment_name,
            'file_attachment_id': data.file_attachment_id,
            'ticket_id': ticket_data['ticket_id'],
            'comment_text': '',
            'comment_id': '',
            'ticket_end_date': ticket_end_date,
            'truck_no': ticket_data.get('truck_no'),
            'ticket_section': ticket_data.get('ticket_section'),
            'category': ticket_data.get('category'),
            'sub_category': ticket_data.get('sub_category'),
            'employee_id': ticket_data.get('employee_id')
        }.items():
            ticket_data[key] = value
        ticket_data['parent_id'] = tdata.get('parent_id')

        action_type_str = TicketType[ticket_state_str].value
        action_type = AlertActionType(action_type_str)

        # Append first history entry
        processed_time = datetime.now()
        ticket_data['ticket_history'].append({
            "processed_time": processed_time.isoformat(),
            "allocated_time": startdate.isoformat() if startdate else processed_time.isoformat(),
            "action_msg": f"Ticket is created and is in {ticket_data['ticket_state']} state",
            "action_type": action_type_str,
            "description": ticket_data.get("comment") or "",
            "created_by": user_name
        })

        print(f"file_attachment count for {ticket_data['ticket_id']}: {len(ticket_data.get('file_attachment') or [])}")
        print(f"file_attachment_id: {ticket_data.get('file_attachment_id')}")
        # Create the ticket
        ticket_resp = await TicketingCreate(**ticket_data).create()

        # FIX 3: safe DB fetch with clear error if TicketingCreate silently failed
        params = urdhva_base.queryparams.QueryParams()
        params.q = f"ticket_id='{ticket_data['ticket_id']}'"
        params.limit = 1
        params.fields = ["id", "ticket_id"]
        resp = await Ticketing.get_all(params, resp_type='plain')

        resp_data = resp.get('data', [])
        if not resp_data:
            raise fastapi.HTTPException(
                status_code=500,
                detail=f"Ticket {ticket_data['ticket_id']} was not saved to DB. "
                       f"Check TicketingCreate validation errors in logs."
            )
        db_ticket_id = resp_data[0]['id']

        parent_tid = ticket_data.get("parent_id")

        existing_subtasks = []
        if parent_tid:
            params_p = urdhva_base.queryparams.QueryParams()
            params_p.q = f"ticket_id='{parent_tid}'"
            params_p.limit = 1
            params_p.fields = ["id", "subtask_id"]

            parent_resp = await Ticketing.get_all(params_p, resp_type='plain')

            if parent_resp and parent_resp.get("data"):
                parent_ticket = parent_resp["data"][0]
                parent_db_id = parent_ticket["id"]

                existing_subtasks = parent_ticket.get("subtask_id") or []
                if not isinstance(existing_subtasks, list):
                    existing_subtasks = []
                existing_subtasks = [x for x in existing_subtasks if x]

                new_subtask_id = ticket_data["ticket_id"]
                if new_subtask_id not in existing_subtasks:
                    existing_subtasks.append(new_subtask_id)

                await Ticketing(
                    id=parent_db_id,
                    subtask_id=existing_subtasks
                ).modify()

        if not manual_ticket:
            for lr in linked_res:
                if lr.get("interlock_name") in selected_types:
                    alert_hist = lr.get("alert_history") or []
                    action_type_str = TicketType[ticket_state_str].value
                    action_type = AlertActionType(action_type_str)

                    processed_time = datetime.now()
                    alert_hist.append({
                        "processed_time": processed_time.isoformat(),
                        "allocated_time": startdate.isoformat() if startdate else processed_time.isoformat(),
                        "action_msg": f"Ticket is raised and is in {ticket_data['ticket_state']} state",
                        "action_type": action_type
                    })

                    await hpcl_ceg_model.Alerts(
                        id=lr["id"],
                        alert_history=alert_hist
                    ).modify()

                    lr["alert_history"] = alert_hist

        tickets_created.append({
            "tid": db_ticket_id,
            "ticket_id": ticket_data['ticket_id'],
            "ticket_name": ticket_data['ticket_name'],
            "alert_type": selected_types,
            "alert_data": selected_alert,
            "alert_section": tdata.get("alert_section"),
            "reporter": reporter_value,
            "ticket_history": ticket_data['ticket_history'],
            "parent_id": parent_tid,
            "subtask_id": existing_subtasks if parent_tid else [],
            "ticket_end_date": ticket_data['ticket_end_date'],
            "linked_alerts": [
                {
                    "sap_id": lr.get("sap_id"),
                    "location_name": lr.get("location_name"),
                    "alert_type": lr.get("interlock_name"),
                    "unique_id": lr.get("unique_id"),
                    "created_at": lr.get("created_at"),
                    "alert_history": lr.get("alert_history", [])
                }
                for lr in linked_res
            ]
        })

    # END of per-sap/zone loop

    # ONE mail after all tickets created — tdata still has full sap_ids/zones list
    mail_payload = tdata.copy()
    mail_payload["ticket_state"] = ticket_data.get("ticket_state")
    mail_payload["ticket_id"] = tickets_created[0]["ticket_id"] if tickets_created else ""
    if mail_payload.get("ticket_state") in (State.Open.value, State.ReviewedByOcc.value):
        try:
            await send_ticket_mail(mail_payload)
        except Exception as e:
            print(f"Error sending ticket mail for {mail_payload['ticket_id']}: {e}")
            print(traceback.format_exc())

    # ----------------------------
    # END OF TICKET CREATION
    # ----------------------------

    return {
        "message": "Tickets created successfully",
        "tickets": tickets_created
    }


# Action close_ticket
@router.post('/close_ticket', tags=['Ticketing'])
async def ticketing_close_ticket(data: Ticketing_Close_TicketParams):
    await Ticketing(**{"id": data.close_id, "ticket_status": Status.Close.value, "ticket_state": State.Resolved.value,
                       "end_date": data.end_date}).modify()
    return {"status": True, "message": "Ticket closed successfully", "data": data.close_id}


# Action update_ticket
# @router.post('/update_ticket', tags=['Ticketing'])
# async def ticketing_update_ticket(data: Ticketing_Update_TicketParams):
#     # data_dict = data.model_dump()
#     # print("Ticket Data: ", data_dict)
#     # await Ticketing(**{"id": data.update_id, **data_dict}).modify()
#     # return {"status": True,"message": "Ticket updated successfully", "data": data.update_id}
#     try:
#         data_dict = data.model_dump()
#         print("data_dict",data_dict)
#         if "alert_type" in data_dict:
#             data_dict["interlock_name"] = data_dict.pop("alert_type")
#         ticket_id = data.update_id
#         # print("data_dict",data_dict)
#         # Fetch existing ticket
#         params = urdhva_base.queryparams.QueryParams()
#         params.q = f"id='{ticket_id}'"
#         params.limit = 1
#         params.fields = ["id", "ticket_state", "ticket_history", "linked_alert_id"]
#         resp = await Ticketing.get_all(params, resp_type='plain')
#         if not resp or not resp.get("data"):
#             return {"status": False, "message": f"Ticket {ticket_id} not found"}

#         existing_ticket = resp["data"][0]

#         # --- TIMINGS as per _update_alert_history ---
#         processed_time = datetime.utcnow()
#         existing_history = existing_ticket.get("ticket_history", []) or []
#         last_allocated_time = processed_time.isoformat()
#         if existing_history:
#             last_allocated_time = existing_history[-1].get("processed_time", processed_time.isoformat())

#         # --- UPDATE ticket_history ---
#         ticket_state = data_dict.get("ticket_state")  # e.g., "InProgress"
#         action_type_enum = TicketType[ticket_state].value  # e.g., "TicketInProgress"
#         ticket_update_entry = {
#             "action_msg": f"Ticket updated, state changed to {ticket_state}",
#             "action_type": action_type_enum,
#             "allocated_time": last_allocated_time,
#             "processed_time": processed_time.isoformat()
#         }
#         updated_history = existing_history + [ticket_update_entry]
#         if ticket_state in ["Resolved", "Cancelled"]:
#             data_dict["ticket_status"] = "Close"
#         else:
#             data_dict["ticket_status"] = "Open"
#             # print("ticket_status>>>>>>>",data_dict["ticket_status"])
#         data_dict["ticket_history"] = updated_history

#         # --- UPDATE THE TICKET ---
#         await Ticketing(id=ticket_id, **data_dict).modify()

#         # --- UPDATE ALERT HISTORY for linked_alert_id ---
#         linked_alert_ids = data_dict.get("linked_alert_id", []) or existing_ticket.get("linked_alert_id", [])
#         for alert_id in linked_alert_ids:
#             # Fetch alert
#             params = urdhva_base.queryparams.QueryParams()
#             params.q = f"id='{alert_id}'"
#             params.limit = 1
#             params.fields = ["id", "alert_history"]
#             resp_alert = await hpcl_ceg_model.Alerts.get_all(params, resp_type='plain')
#             if not resp_alert or not resp_alert.get("data"):
#                 continue

#             alert_obj = resp_alert["data"][0]
#             alert_history = alert_obj.get("alert_history", []) or []

#             # Determine allocated_time from last relevant entry
#             last_alloc = processed_time.isoformat()
#             for entry in reversed(alert_history):
#                 if entry.get("action_type") in [
#                     "TicketRaised", "TicketInProgress", "TicketCancelled", "TicketResolved", "TicketOnHold"
#                 ]:
#                     last_alloc = entry.get("processed_time", processed_time.isoformat())
#                     break

#             # Append new alert_history entry
#             new_alert_entry = {
#                 "action_msg": f"Ticket updated, state changed to {ticket_state}",
#                 "action_type": action_type_enum,
#                 "allocated_time": last_alloc,
#                 "processed_time": processed_time.isoformat()
#             }
#             updated_alert_history = alert_history + [new_alert_entry]

#             await hpcl_ceg_model.Alerts(id=alert_id, alert_history=updated_alert_history).modify()

#         # return {"status": True, "message": "Ticket updated successfully", "data": ticket_id}
#         return {
#             "status": True,
#             "message": "Ticket updated successfully",
#             "data": {
#                 "ticket_id": ticket_id,
#                 "ticket_history": updated_history
#             }
#         }

#     except Exception as e:
#         print(f"Error in update_ticket: {str(e)}")
#         # return {"status": False, "message": str(e)}
#         return {
#             "status": True,
#             "message": "Ticket updated successfully",
#             "data": {
#                 "ticket_id": ticket_id,
#                 "ticket_history": updated_history
#             }
#         }
@router.post('/update_ticket', tags=['Ticketing'])
async def ticketing_update_ticket(data: Ticketing_Update_TicketParams):
    try:
        data_dict = data.model_dump()

        # ---------------- SAFE NORMALIZATION ----------------
        list_fields = ["truck_no", "category", "sub_category", "linked_alert_id", "subtask_id", "alert_type"]
        for f in list_fields:
            if f in data_dict:
                data_dict[f] = clean_list(data_dict.get(f))

        if data_dict.get("ticket_section") == "":
            data_dict["ticket_section"] = None

        if data_dict.get("reassigne_due_date") == "":
            data_dict["reassigne_due_date"] = None
        # Rename alert_type → interlock_name safely
        if "alert_type" in data_dict:
            data_dict["interlock_name"] = clean_list(data_dict.pop("alert_type"))
        
        re_assingee_employee_id: list[str] = data_dict.get("re_assingee_employee_id") or []
        re_assingee_mail:        list[str] = data_dict.get("re_assingee_mail")        or []
        
        raw_due_date = data_dict.get("reassigne_due_date")
        if raw_due_date and str(raw_due_date).strip() not in ("", "null", "none"):
            data_dict["reassigne_due_date"] = str(raw_due_date).strip()
        else:
            data_dict["reassigne_due_date"] = None
     
        ticket_id = data.update_id

        params = urdhva_base.queryparams.QueryParams()
        params.q = f"id='{ticket_id}'"
        params.limit = 1
        params.fields = [
            "id", "ticket_id", "ticket_state", "ticket_history", "linked_alert_id",
            "sap_id", "location_name", "zone", "category", "sub_category",
            "start_date", "ticket_end_date", "comment_history","file_attachment","file_attachment_name",
            "file_attachment_id","assignee_name","assignee_mail","ticket_end_date"
        ]
        resp = await Ticketing.get_all(params, resp_type='plain')

        if not resp or not resp.get("data"):
            return {"status": False, "message": f"Ticket {ticket_id} not found"}

        existing_ticket = resp["data"][0]
        existing_history = existing_ticket.get("ticket_history", []) or []
        tracked_fields = [
            "ticket_state",
            "category",
            "sub_category",
            "linked_alert_id",
            "sap_id",
            "location_name",
            "zone",
            "assignee_name",
            "assignee_mail",
            "re_assingee_employee_id",
            "re_assingee_mail",
            "ticket_end_date",
            ]

        changed_fields = {}
        for field in tracked_fields:
            if field == "ticket_end_date":
                old_val = str(existing_ticket.get(field) or "").split("T")[0].split(" ")[0]
                new_val = str(data_dict.get(field) or "").split("T")[0].split(" ")[0]
            else:
                old_val = clean_list(existing_ticket.get(field))
                new_val = clean_list(data_dict.get(field))
            if field in data_dict and old_val != new_val:
                changed_fields[field] = {
                    "old_value": old_val,
                    "new_value": new_val
                }
                
        # Use payload value if sent, else use existing DB value
        if "auto_ticket_close" in data_dict:
            auto_close_flag_raw = data_dict.get("auto_ticket_close")
        else:
            auto_close_flag_raw = existing_ticket.get("auto_ticket_close", False)

        # Normalize to boolean
        auto_close_flag = False
        if str(auto_close_flag_raw).lower() in ["yes", "true", "1"] or auto_close_flag_raw is True:
            auto_close_flag = True

        processed_time = datetime.utcnow()
        # existing_history = existing_ticket.get("ticket_history", []) or []
        last_allocated_time = processed_time.isoformat()

        if existing_history:
            last_allocated_time = existing_history[-1].get("processed_time", processed_time.isoformat())

        # ----------- IMPORTANT FIX: respect payload ----------
        if "linked_alert_id" in data_dict:
            linked_alert_ids = clean_list(data_dict.get("linked_alert_id"))
        else:
            linked_alert_ids = clean_list(existing_ticket.get("linked_alert_id"))

        is_manual_ticket = len(linked_alert_ids) == 0

        # ----------- SAFE LOOP (no id='') -------------------
        all_alerts_closed = True
        if not is_manual_ticket:
            for alert_id in linked_alert_ids:
                params = urdhva_base.queryparams.QueryParams()
                params.q = f"id='{alert_id}'"
                params.limit = 1
                params.fields = ["id", "alert_status"]

                alert_resp = await hpcl_ceg_model.Alerts.get_all(params, resp_type='plain')

                if not alert_resp or not alert_resp.get("data"):
                    all_alerts_closed = False
                    break

                alert_status = alert_resp["data"][0].get("alert_status")

                if alert_status in ["Open", "Pending", None]:
                    all_alerts_closed = False
                    break
        # ----------------------------------------------------
        STATE_UI_TO_ENUM = {
            "Open": "Open",
            "Escalated": "Escalated",
            "Reassigned": "Reassigned",
            "Updated By Initiator": "UpdatedByInitiator",
            "Returned By Occ": "ReturnedByOcc",
            "Reviewed By Occ": "ReviewedByOcc"
        }

        ticket_state = data_dict.get("ticket_state", existing_ticket.get("ticket_state"))
        ticket_state = STATE_UI_TO_ENUM.get(ticket_state, ticket_state)
        if ticket_state not in TicketType.__members__:
            raise Exception(f"Invalid ticket_state: {ticket_state}")

        action_type_str = TicketType[ticket_state].value
        print("action_type_str: ", action_type_str)
        action_type_enum = AlertActionType(action_type_str).value

        rpt = urdhva_base.context.context.get('rpt', None)
        employee_id = rpt.get('employee_id') if rpt else None

        # ---------------- FINAL STATE DECISION ----------------
        ticket_state_from_ui = data_dict.get("ticket_state")

        if is_manual_ticket:
            final_state = ticket_state_from_ui or existing_ticket.get("ticket_state")
            action_msg = f"Ticket updated, state changed to {final_state}"
            action_type_val = action_type_enum

        else:
            # Case 1: Auto close ON and alerts closed
            if all_alerts_closed and auto_close_flag:
                final_state = "Reviewed By Occ"
                action_msg = "All linked alerts are closed, ticket auto resolved"
                action_type_val = "TicketResolved"


            # Case 2: Auto close turned OFF but no state sent from UI
            elif not auto_close_flag and existing_ticket.get("ticket_state") == "Reviewed By Occ":

                # Find last non-resolved state from history
                previous_state = None
                for entry in reversed(existing_history):
                    msg = entry.get("action_msg", "")
                    if "state changed to" in msg and "Reviewed By Occ" not in msg:
                        previous_state = msg.split("state changed to")[-1].strip()
                        break

                final_state = previous_state or "InProgress"
                action_msg = f"Auto close disabled, state reverted to {final_state}"
                action_type_val = action_type_enum

            # Normal case
            else:
                final_state = ticket_state_from_ui or existing_ticket.get("ticket_state")
                action_msg = f"Ticket updated, state changed to {final_state}"
                action_type_val = action_type_enum

        # APPLY FINAL STATE
        data_dict["ticket_state"] = final_state
        print("final_state: ", final_state)

        ticket_end_date = data_dict.get(
            "ticket_end_date",
            existing_ticket.get("ticket_end_date")
        )
        data_dict["ticket_end_date"] = ticket_end_date
        # ---------------- COMMENT HISTORY ----------------

        previous_state = existing_ticket.get("ticket_state")

        rpt = urdhva_base.context.context.get('rpt', None)
        user_name = rpt.get('username') if rpt else None

        existing_comment_history = existing_ticket.get("comment_history", []) or []
        print("existing_comment_history: ", existing_comment_history)

        # If state changed → append new entry
        if previous_state != final_state:
            new_comment_entry = {
                "updated_by": user_name,
                "updated_time": datetime.now().isoformat(),
                "ticket_msg": f"{previous_state} -> {final_state}",
                "comments": data_dict.get("comment"),
            }
            existing_comment_history.append(new_comment_entry)
        else:
            new_comment_entry = {
                "updated_by": user_name,
                "updated_time": datetime.now().isoformat(),
                "ticket_msg": f"{final_state}",
                "comments": data_dict.get("comment"),
            }
            existing_comment_history.append(new_comment_entry)

        data_dict["comment_history"] = existing_comment_history

        # -------------------------------------------------

        if final_state in ["Reviewed By Occ", "Cancelled"]:
            data_dict["ticket_status"] = Status.Close.value
            print("ticket_status set to Close", data_dict["ticket_status"])
        else:
            data_dict["ticket_status"] = Status.Open.value

        ticket_update_entry = {
            "action_msg": action_msg,
            "action_type": action_type_val,
            "allocated_time": last_allocated_time,
            "processed_time": processed_time.isoformat(),
            "employee_id": employee_id,
            "description": str(changed_fields),
            "remarks": data_dict.get("remarks"),
            "reason": data_dict.get("reason")
        }

        updated_history = existing_history + [ticket_update_entry]

        data_dict["ticket_history"] = updated_history
        data_dict["auto_ticket_close"] = auto_close_flag
        if "auto_ticket_close" in data_dict:
            val = data_dict["auto_ticket_close"]
            if str(val).lower() in ["yes", "true", "1"]:
                data_dict["auto_ticket_close"] = "Yes"
            else:
                data_dict["auto_ticket_close"] = "No"

        await Ticketing(id=ticket_id, **data_dict).modify()

        # -------- FIX SUBTASK LINK ----------
        new_subtasks = clean_list(data_dict.get("subtask_id"))
        if new_subtasks:
            params_parent = urdhva_base.queryparams.QueryParams()
            params_parent.q = f"id='{ticket_id}'"
            params_parent.limit = 1
            params_parent.fields = ["id", "parent_id"]

            parent_info = await Ticketing.get_all(params_parent, resp_type='plain')

            if parent_info and parent_info.get("data"):
                parent_id = parent_info["data"][0].get("parent_id")

                if parent_id:
                    params_p = urdhva_base.queryparams.QueryParams()
                    params_p.q = f"ticket_id='{parent_id}'"
                    params_p.limit = 1
                    params_p.fields = ["id", "subtask_id"]

                    parent_resp = await Ticketing.get_all(params_p, resp_type='plain')

                    if parent_resp and parent_resp.get("data"):
                        parent_ticket = parent_resp["data"][0]
                        parent_db_id = parent_ticket["id"]

                        existing_subtasks = parent_ticket.get("subtask_id") or []
                        if not isinstance(existing_subtasks, list):
                            existing_subtasks = []

                        for sub in new_subtasks:
                            if sub not in existing_subtasks:
                                existing_subtasks.append(sub)

                        await Ticketing(id=parent_db_id, subtask_id=existing_subtasks).modify()
        # ------------------------------------

        # alert history update (safe)
        if not is_manual_ticket:
            for alert_id in linked_alert_ids:
                params = urdhva_base.queryparams.QueryParams()
                params.q = f"id='{alert_id}'"
                params.limit = 1
                params.fields = ["id", "alert_history"]

                resp_alert = await hpcl_ceg_model.Alerts.get_all(params, resp_type='plain')
                if not resp_alert or not resp_alert.get("data"):
                    continue

                alert_obj = resp_alert["data"][0]
                alert_history = alert_obj.get("alert_history", []) or []

                last_alloc = processed_time.isoformat()
                for entry in reversed(alert_history):
                    if entry.get("action_type") in [
                        "TicketRaised", "TicketInProgress", "TicketCancelled",
                        "TicketResolved", "TicketOnHold", "TicketReOpen", "TicketOnCompleted"
                    ]:
                        last_alloc = entry.get("processed_time", processed_time.isoformat())
                        break

                new_alert_entry = {
                    "action_msg": f"Ticket updated, state changed to {final_state}",
                    "action_type": action_type_val,
                    "allocated_time": last_alloc,
                    "processed_time": processed_time.isoformat(),
                    "remarks": data_dict.get("remarks"),
                    "reason": data_dict.get("reason")
                }

                updated_alert_history = alert_history + [new_alert_entry]
                # print("updated_alert_history: ",updated_alert_history)
                await hpcl_ceg_model.Alerts(id=alert_id, alert_history=updated_alert_history).modify()

        if final_state in MAIL_TRIGGER_STATES:
            try:
                # Build a slim ticket_data dict for send_ticket_mail
                mail_payload = {
                    "ticket_id": existing_ticket.get("ticket_id") or ticket_id,
                    "ticket_state": final_state,
                    "escalation_level": existing_ticket.get("escalation_level"),
                    "sap_id": existing_ticket.get("sap_id"),
                    "location_name": existing_ticket.get("location_name"),
                    "category": data_dict.get("category") or existing_ticket.get("category"),
                    "sub_category": data_dict.get("sub_category") or existing_ticket.get("sub_category"),
                    "start_date": existing_ticket.get("start_date"),
                    "zone": existing_ticket.get("zone"),
                    "ticket_end_date": existing_ticket.get("ticket_end_date"),
                    "re_assingee_mail":  re_assingee_mail,
                }
                await send_ticket_mail(mail_payload)
            except Exception as e:
                logger.warning(f"Error sending ticket mail on update for ticket {ticket_id}: {e}")
                logger.warning(traceback.format_exc())

        return {
            "status": True,
            "message": "Ticket updated successfully",
            "data": {
                "ticket_id": ticket_id,
                "ticket_history": updated_history,
                "auto_ticket_close": "Yes" if auto_close_flag else "No"
            }
        }

    except Exception as e:
        print(f"Error in update_ticket: {str(e)}")
        return {"status": False, "message": str(e)}


# Action delete_ticket
@router.post('/delete_ticket', tags=['Ticketing'])
async def ticketing_delete_ticket(data: Ticketing_Delete_TicketParams):
    await Ticketing.delete(data.delete_id)
    return {"status": True, "message": "Ticket deleted successfully", "data": data.delete_id}


# Action attach_file
@router.post('/attach_file', tags=['Ticketing'])
async def ticketing_attach_file(
        ticket_id: Optional[str] = Form(None),
        tid: Optional[str] = Form(None),
        uploadfile: UploadFile = File(None)
):
    try:
        if not uploadfile:
            return {"status": False, "message": "No file provided"}

        if not ticket_id or not tid:
            return {"status": False, "message": "ticket_id and tid are required"}

        # print("ticket_id -->", ticket_id)
        # print("tid -->", tid)

        # ---------------- FETCH TICKET ----------------
        query = f"ticket_id='{ticket_id}' and id={tid}"
        params = urdhva_base.queryparams.QueryParams(q=query)
        result = await Ticketing.get_all(params, resp_type='plain')
        resp = result.get("data", [])

        if not resp:
            return {"status": False, "message": "Ticket not found"}

        # ---------------- MINIO UPLOAD ----------------

        unique_filename = f"{uuid.uuid4()}_{uploadfile.filename}"

        # Save file temporarily
        temp_path = f"/tmp/{unique_filename}"

        with open(temp_path, "wb") as f:
            f.write(await uploadfile.read())

        # Upload using existing minio function
        status, minio_path = minio_connector.upload_to_minio(
            "ticketing",  # bu
            ticket_id,  # section
            str(tid),  # unique_id (safe to pass as string)
            temp_path
        )

        # Remove temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

        if not status:
            return {
                "status": False,
                "message": "File upload to Minio failed",
                "file_path": minio_path
            }

        # ---------------- UPDATE DB ----------------
        existing_files = resp[0].get("file_attachment") or []
        updated_files = existing_files + [minio_path]

        await Ticketing(
            **{
                "id": resp[0].get("id"),
                "file_attachment": updated_files
            }
        ).modify()

        return {
            "status": True,
            "message": f"File {uploadfile.filename} uploaded successfully",
            "file_attachment": minio_path,
            "file_attachment_name": uploadfile.filename,
            "file_attachment_id": str(uuid.uuid4()),
            "content_type": uploadfile.content_type
        }

    except Exception as e:
        return {"status": False, "message": f"Error saving file: {str(e)}"}


# Action delete_file_attachment
@router.post('/delete_file_attachment', tags=['Ticketing'])
async def ticketing_delete_file_attachment(data: Ticketing_Delete_File_AttachmentParams):
    ticket_id = data.ticket_id

    # Prepare query params to fetch the ticket
    params = QueryParams()
    params.q = f"id='{ticket_id}'"
    params.limit = 1

    # Fetch ticket row
    main_resp = await Ticketing.get_all(params, resp_type="plain")
    if not main_resp or len(main_resp.get("data", [])) == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")

    db_record = main_resp["data"][0]

    # Extract file paths from the DB (file_attachment is a list)
    file_list = db_record.get("file_attachment") or []

    # Delete each file from the server if it exists
    for file_path in file_list:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)

    update_payload = {
        "file_attachment": [],
        "file_attachment_name": "",
        "file_attachment_id": ""
    }

    await Ticketing(**{"id": ticket_id, **update_payload}).modify()

    return {
        "status": True,
        "message": "File attachment deleted successfully",
        "data": ticket_id
    }


# Action download_file_attachment
@router.post('/download_file_attachment', tags=['Ticketing'])
async def ticketing_download_file_attachment(data: Ticketing_Download_File_AttachmentParams):
    ticket_id = data.ticket_id
    requested_file_name = data.file_attachment_name

    # ---------------- FETCH TICKET ----------------
    params = urdhva_base.queryparams.QueryParams()
    params.q = f"id='{ticket_id}'"
    params.limit = 1

    ticket_resp = await Ticketing.get_all(params, resp_type="plain")

    if not ticket_resp or len(ticket_resp.get("data", [])) == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket = ticket_resp["data"][0]

    file_paths = ticket.get("file_attachment") or []
    db_file_name = ticket.get("file_attachment_name")

    if not file_paths:
        raise HTTPException(status_code=404, detail="No file attachments found")

    # Since you're storing list
    matched_path = None
    for path in file_paths:
        if requested_file_name in path:
            matched_path = path
            break

    if not matched_path:
        raise HTTPException(status_code=404, detail="Requested file not found")

    print("Downloading from MinIO path:", matched_path)

    # ---------------- DOWNLOAD FROM MINIO ----------------
    success, local_file_path = minio_connector.download_from_minio(matched_path)

    if not success:
        raise HTTPException(status_code=500, detail=local_file_path)

    print("Downloaded to temp path:", local_file_path)

    return FileResponse(
        path=local_file_path,
        filename=requested_file_name,
        media_type="application/octet-stream"
    )


# Action update_assignee
@router.post('/update_assignee', tags=['Ticketing'])
async def ticketing_update_assignee(data: Ticketing_Update_AssigneeParams):
    ticket_id = data.ticket_id
    assignee_name = data.assignee_name or []
    assignee_mail = data.assignee_mail or []

    params = QueryParams()
    params.q = f"id='{ticket_id}'"
    params.limit = 1
    ticket_resp = await Ticketing.get_all(params, resp_type="plain")

    if not ticket_resp or len(ticket_resp.get("data", [])) == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")

    await Ticketing(**{
        "id": ticket_id,
        "assignee_name": assignee_name,
        "assignee_mail": assignee_mail
    }).modify()

    return {
        "status": True,
        "message": f"Assignee updated successfully",
        "data": {
            "ticket_id": ticket_id,
            "assignee_name": assignee_name,
            "assignee_mail": assignee_mail
        }
    }


# Action update_reporter
@router.post('/update_reporter', tags=['Ticketing'])
async def ticketing_update_reporter(data: Ticketing_Update_ReporterParams):
    ticket_id = data.ticket_id
    new_reporter = data.reporter  # from request

    # Check if ticket exists
    params = QueryParams()
    params.q = f"id='{ticket_id}'"
    params.limit = 1
    ticket_resp = await Ticketing.get_all(params, resp_type="plain")

    if not ticket_resp or len(ticket_resp.get("data", [])) == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Update reporter
    await Ticketing(**{
        "id": ticket_id,
        "reporter": new_reporter
    }).modify()

    return {
        "status": True,
        "message": f"Ticket {ticket_id} reporter updated to {new_reporter} successfully",
        "data": {
            "ticket_id": ticket_id,
            "reporter": new_reporter
        }
    }


# Action update_priority
@router.post('/update_priority', tags=['Ticketing'])
async def ticketing_update_priority(data: Ticketing_Update_PriorityParams):
    ticket_id = data.ticket_id
    new_priority = data.ticket_priority  # from request

    # Check if ticket exists
    params = QueryParams()
    params.q = f"id='{ticket_id}'"
    params.limit = 1
    ticket_resp = await Ticketing.get_all(params, resp_type="plain")

    if not ticket_resp or len(ticket_resp.get("data", [])) == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Update ticket_severity (column in DB)
    await Ticketing(**{
        "id": ticket_id,
        "ticket_severity": new_priority
    }).modify()

    return {
        "status": True,
        "message": f"Ticket {ticket_id} priority updated to {new_priority} successfully",
        "data": {
            "ticket_id": ticket_id,
            "ticket_priority": new_priority
        }
    }


# Action add_comment_to_ticket
@router.post('/add_comment_to_ticket', tags=['Ticketing'])
async def ticketing_add_comment_to_ticket(data: Ticketing_Add_Comment_To_TicketParams):
    ticket_id = data.ticket_id
    comment_text = data.comment_text

    # Check if ticket exists
    params = QueryParams()
    params.q = f"id='{ticket_id}'"
    params.limit = 1
    ticket_resp = await Ticketing.get_all(params, resp_type="plain")

    if not ticket_resp or len(ticket_resp.get("data", [])) == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Generate unique comment_id
    comment_id = str(uuid.uuid4())

    # Add comment to ticket (assumes your DB has a 'comments' list field)
    ticket = ticket_resp["data"][0]
    existing_comments = ticket.get("comments", [])
    existing_comments.append({
        "comment_id": comment_id,
        "comment_text": comment_text
    })

    await Ticketing(**{
        "id": ticket_id,
        "comment_text": comment_text,
        "comment_id": comment_id
    }).modify()
    # Return response
    return {
        "status": True,
        "message": f"Comment added to ticket {ticket_id} successfully",
        "data": {
            "ticket_id": ticket_id,
            "comment_id": comment_id,
            "comment_text": comment_text
        }
    }


# Action edit_comment
@router.post('/edit_comment', tags=['Ticketing'])
async def ticketing_edit_comment(data: Ticketing_Edit_CommentParams):
    ticket_id = data.ticket_id
    comment_id = data.comment_id
    new_comment = data.new_comment

    # Fetch ticket details
    params = QueryParams()
    params.q = f"id='{ticket_id}'"
    params.limit = 1
    ticket_resp = await Ticketing.get_all(params, resp_type="plain")

    if not ticket_resp or len(ticket_resp.get("data", [])) == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket = ticket_resp["data"][0]

    # Verify comment_id matches
    if ticket.get("comment_id") != comment_id:
        raise HTTPException(status_code=404, detail="Comment not found for this ticket")

    # Move old comment_text to comment (history)
    old_comment = ticket.get("comment_text", "")
    existing_history = ticket.get("comment", "")
    updated_history = existing_history
    if old_comment:
        if existing_history:
            updated_history += f"\n{old_comment}"
        else:
            updated_history = old_comment

    # Update ticket with new comment_text
    await Ticketing(**{
        "id": ticket_id,
        "comment_text": new_comment,
        "comment": updated_history
    }).modify()

    # Return response
    return {
        "status": True,
        "message": f"Comment {comment_id} on ticket {ticket_id} updated successfully",
        "data": {
            "ticket_id": ticket_id,
            "comment_id": comment_id,
            "comment_text": new_comment,
            "comment_history": updated_history
        }
    }


# Action delete_comment
@router.post('/delete_comment', tags=['Ticketing'])
async def ticketing_delete_comment(data: Ticketing_Delete_CommentParams):
    ticket_id = data.ticket_id
    comment_id = data.comment_id
    existing_comment_text = data.existing_comment_text

    # Fetch ticket details
    params = QueryParams()
    params.q = f"id='{ticket_id}'"
    params.limit = 1
    ticket_resp = await Ticketing.get_all(params, resp_type="plain")

    if not ticket_resp or len(ticket_resp.get("data", [])) == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket = ticket_resp["data"][0]

    # Debug: show current comments
    print("[DEBUG] Ticket data before deletion:", ticket)

    # Check if the comment_id matches current comment_text
    current_comment_text = ticket.get("comment_text", "")
    current_comment_id = ticket.get("comment_id", "")

    if current_comment_id != comment_id or current_comment_text != existing_comment_text:
        raise HTTPException(status_code=400, detail="Comment ID or text does not match")

    # Clear the comment_text, comment_id, and comment (history) columns
    await Ticketing(**{
        "id": ticket_id,
        "comment_text": "",
        "comment_id": "",
        "comment": ""
    }).modify()

    # Debug: show after deletion
    print(f"[DEBUG] Comment {comment_id} deleted. Updated ticket fields: comment_text='', comment_id='', comment=''")

    return {
        "status": True,
        "message": f"Comment {comment_id} deleted successfully from ticket {ticket_id}",
        "data": {
            "ticket_id": ticket_id,
            "comment_id": comment_id
        }
    }


# Action edit_description
@router.post('/edit_description', tags=['Ticketing'])
async def ticketing_edit_description(data: Ticketing_Edit_DescriptionParams):
    ticket_id = data.ticket_id
    new_description = data.new_description

    # Fetch ticket details
    params = QueryParams()
    params.q = f"id='{ticket_id}'"
    params.limit = 1
    ticket_resp = await Ticketing.get_all(params, resp_type="plain")

    if not ticket_resp or len(ticket_resp.get("data", [])) == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Update description
    await Ticketing(**{
        "id": ticket_id,
        "description": new_description
    }).modify()

    return {
        "status": True,
        "message": f"Description updated successfully for ticket {ticket_id}",
        "data": {
            "ticket_id": ticket_id,
            "description": new_description
        }
    }


# Action delete_description
@router.post('/delete_description', tags=['Ticketing'])
async def ticketing_delete_description(data: Ticketing_Delete_DescriptionParams):
    ticket_id = data.ticket_id
    existing_description = data.delete_existing_desctiption  # value from request

    # Fetch ticket details
    params = QueryParams()
    params.q = f"id='{ticket_id}'"
    params.limit = 1
    ticket_resp = await Ticketing.get_all(params, resp_type="plain")

    if not ticket_resp or len(ticket_resp.get("data", [])) == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket = ticket_resp["data"][0]
    current_description = ticket.get("description", "")
    print(f"[DEBUG] Current description for ticket {ticket_id}: {current_description}")

    # Validate existing description
    if current_description != existing_description:
        raise HTTPException(status_code=400, detail="Existing description does not match")

    # Clear description
    await Ticketing(**{
        "id": ticket_id,
        "description": ""
    }).modify()

    print(f"[DEBUG] Description cleared for ticket {ticket_id}")

    return {
        "status": True,
        "message": f"Description deleted successfully for ticket {ticket_id}",
        "data": {
            "ticket_id": ticket_id,
            "description": ""
        }
    }


# Action attach_file_to_comment
@router.post('/attach_file_to_comment', tags=['Ticketing'])
async def ticketing_attach_file_to_comment(
        ticket_id: str,
        comment_id: str,
        upload_files: List[fastapi.UploadFile] = fastapi.File(...)
):
    try:
        return await api_helpers.attach_file_common(
            model_class=Ticketing,
            ticket_id=ticket_id,
            comment_id=comment_id,
            upload_files=upload_files,
            attachment_field="documents"
        )
    except Exception as e:
        return {
            "status": False,
            "message": f"Error attaching file: {str(e)}"
        }


# Action delete_file_from_comment
@router.post('/delete_file_from_comment', tags=['Ticketing'])
async def ticketing_delete_file_from_comment(data: Ticketing_Delete_File_From_CommentParams):
    try:
        ticket_id = data.ticket_id
        comment_id = data.comment_id

        # Fetch ticket record by ticket_id
        params = urdhva_base.queryparams.QueryParams(q=f"id='{ticket_id}'", limit=1)
        ticket_resp = await Ticketing.get_all(params, resp_type='plain')
        if not ticket_resp or len(ticket_resp.get("data", [])) == 0:
            return {"status": False, "message": "Ticket not found"}

        ticket = ticket_resp["data"][0]

        # Check if comment_id matches
        if ticket.get("comment_id") != comment_id:
            return {"status": False, "message": "Comment not found"}

        # Clear the comment_attachment_path field
        await Ticketing(
            **{
                "id": ticket.get("id"),
                "comment_attachment_path": ""
            }
        ).modify()

        return {
            "status": True,
            "message": f"Attachment cleared for comment {comment_id} successfully"
        }

    except Exception as e:
        return {
            "status": False,
            "message": f"Error clearing attachment from comment: {str(e)}"
        }


# Action merge_ticket
@router.post('/merge_ticket', tags=['Ticketing'])
async def ticketing_merge_ticket(data: Ticketing_Merge_TicketParams):
    ticket_id = data.ticket_id  # main ticket internal ID
    merge_ticket_ids = data.merge_ticket_id or []
    comment_text = data.comment or ""

    # Fetch main ticket
    params = urdhva_base.queryparams.QueryParams()
    params.q = f"id='{ticket_id}'"
    params.limit = 1
    main_resp = await Ticketing.get_all(params, resp_type="plain")

    if not main_resp or len(main_resp.get("data", [])) == 0:
        raise HTTPException(status_code=404, detail="Main ticket not found")

    main_ticket = main_resp["data"][0]
    if "merge_history" not in main_ticket:
        main_ticket["merge_history"] = []
    if "ticket_history" not in main_ticket:
        main_ticket["ticket_history"] = []

    processed_time = datetime.now()

    for merge_ticket_id in merge_ticket_ids:
        # Fetch ticket to merge by ticket_id (name)
        merge_params = urdhva_base.queryparams.QueryParams()
        merge_params.q = f"ticket_id='{merge_ticket_id}'"
        merge_params.limit = 1
        merge_resp = await Ticketing.get_all(merge_params, resp_type="plain")

        if not merge_resp or len(merge_resp.get("data", [])) == 0:
            continue  # skip if merge ticket not found

        merge_ticket = merge_resp["data"][0]

        # Determine if SAP IDs or ticket_status differ
        main_sap_id = main_ticket.get("alert_data", {}).get("sap_id")
        merge_sap_id = merge_ticket.get("alert_data", {}).get("sap_id")
        main_status = main_ticket.get("ticket_status")
        merge_status = merge_ticket.get("ticket_status")

        entry_comment = comment_text
        if main_sap_id != merge_sap_id or main_status != merge_status:
            entry_comment = "Merging different SAP IDs or statuses"

        # Build merge_history entry (add 'merge_ticket_id' for Pydantic validation)
        merge_entry = {
            "processed_time": processed_time.isoformat(),
            "allocated_time": processed_time.isoformat(),
            "action_msg": f"Ticket {merge_ticket_id} merged into {main_ticket['ticket_id']}",
            "action_type": "TicketMerged",
            "description": entry_comment,
            "merge_ticket_id": [merge_ticket_id],  # <- list of strings
            "comment": entry_comment
        }

        # Append to merge_history
        # Ensure merge_history and ticket_history are always lists
        main_ticket["merge_history"] = main_ticket.get("merge_history") or []
        main_ticket["ticket_history"] = main_ticket.get("ticket_history") or []

        # Append the merge entry
        main_ticket["merge_history"].append(merge_entry)

        # For the merge ticket as well
        merge_ticket["merge_history"] = merge_ticket.get("merge_history") or []
        merge_ticket["ticket_history"] = merge_ticket.get("ticket_history") or []

        merge_ticket_entry = {
            "processed_time": processed_time.isoformat(),
            "allocated_time": processed_time.isoformat(),
            "action_msg": f"Ticket {merge_ticket_id} merged into {main_ticket['ticket_id']}",
            "action_type": "TicketMerged",
            "description": entry_comment,
            "merge_ticket_id": [main_ticket["ticket_id"]],
            "comment": entry_comment
        }
        if merge_ticket["merge_history"] is None:
            merge_ticket["merge_history"] = []
        merge_ticket["merge_history"].append(merge_ticket_entry)

        if merge_ticket["ticket_history"] is None:
            merge_ticket["ticket_history"] = []
        merge_ticket_history_entry = {
            "processed_time": processed_time.isoformat(),
            "allocated_time": processed_time.isoformat(),
            "action_msg": f"Ticket {merge_ticket_id} merged into {main_ticket['ticket_id']}",
            "action_type": "TicketMerged",
            "comment": entry_comment
        }
        merge_ticket["ticket_history"].append(merge_ticket_history_entry)
        merge_ticket["merge_status"] = "Merged"

        await Ticketing(id=merge_ticket["id"], merge_history=merge_ticket["merge_history"],
                        ticket_history=merge_ticket["ticket_history"],
                        merge_status=merge_ticket["merge_status"]).modify()

        # ----- NEW: Update ticket_history also -----
        ticket_history_entry = {
            "processed_time": processed_time.isoformat(),
            "allocated_time": processed_time.isoformat(),
            "action_msg": f"Ticket {merge_ticket_id} merged into {main_ticket['ticket_id']}",
            "action_type": "TicketMerged",
            "comment": entry_comment
        }
        main_ticket["ticket_history"].append(ticket_history_entry)

        # Update linked alerts (commented out if not needed)
        # for alert in merge_ticket.get("linked_alerts", []):
        #     alert_hist = alert.get("alert_history", [])
        #     alert_hist.append({
        #         "processed_time": processed_time.isoformat(),
        #         "allocated_time": processed_time.isoformat(),
        #         "action_msg": f"Ticket {merge_ticket_id} merged into {main_ticket['ticket_id']}",
        #         "action_type": "TicketMerged"
        #     })
        #     await Alerts(id=alert["id"], alert_history=alert_hist).modify()
        #     alert["alert_history"] = alert_hist

        # Optionally keep linked_alerts in main ticket
        main_ticket.setdefault("linked_alerts", []).extend(merge_ticket.get("linked_alerts", []))
        main_ticket["merge_status"] = None
        print("coming")

    # Save main ticket with updated merge_history and ticket_history
    await Ticketing(id=main_ticket["id"], merge_history=main_ticket["merge_history"],
                    ticket_history=main_ticket["ticket_history"], merge_status=None).modify()

    return {
        "message": "Tickets merged successfully",
        "ticket": main_ticket
    }


# Action get_location_data
@router.post('/get_location_data', tags=['Ticketing'])
async def ticketing_get_location_data(data: Ticketing_Get_Location_DataParams):
    # ------------------ BUILD FILTERS ------------------
    filters = []

    def add_filter(field, value):
        if not value:
            return

        # If list → remove empty values
        if isinstance(value, list):
            cleaned = [v for v in value if v not in ("", None)]
            if not cleaned:
                return
            formatted_values = ",".join([f"'{v}'" for v in cleaned])
            filters.append(f"{field} IN ({formatted_values})")
        else:
            if value not in ("", None):
                filters.append(f"{field} = '{value}'")

    add_filter("bu", data.bu)
    add_filter("zone", data.zone)
    add_filter("region", data.region)
    add_filter("sales_area", data.sales_area)
    add_filter("sap_id", data.sap_id)

    # ------------------ QUERY PARAMS ------------------
    params = urdhva_base.queryparams.QueryParams()
    params.q = " AND ".join(filters) if filters else None
    params.limit = 100000000
    params.fields = ["sap_id", "bu", "zone", "region", "sales_area", "name"]

    resp = await hpcl_ceg_model.LocationMaster.get_all(params, resp_type="plain")
    rows = resp.get("data", [])

    # ------------------ PREPARE UNIQUE VALUES (Single Loop) ------------------
    import ast

    bu_set = set()
    zone_set = set()
    region_set = set()
    sales_area_set = set()

    for r in rows:

        # Collect BU
        bu = r.get("bu")
        if bu:
            bu_set.add(bu)

        # Collect Zone
        zone = r.get("zone")
        if zone:
            zone_set.add(zone)

        # Collect Region
        region = r.get("region")
        if region:
            region_set.add(region)

        # Collect Sales Area (convert string list to real list)
        raw_sales_area = r.get("sales_area")
        if raw_sales_area:
            try:
                parsed = ast.literal_eval(raw_sales_area)
                if isinstance(parsed, list):
                    sales_area_set.update(parsed)
                else:
                    sales_area_set.add(raw_sales_area)
            except:
                sales_area_set.add(raw_sales_area)

    # Sort results
    bu_list = sorted(bu_set)
    zones = sorted(zone_set)
    regions = sorted(region_set)
    sales_areas = sorted(sales_area_set)

    # ------------------ SORT LOCATIONS ------------------
    rows.sort(key=lambda x: x["name"])

    locations = [
        {"sap_id": r["sap_id"], "name": r["name"]}
        for r in rows
    ]

    # ------------------ RETURN ------------------
    return {
        "status": True,
        "message": "All filter values",
        "data": {
            "bu_list": bu_list,
            "zones": zones,
            "regions": regions,
            "sales_areas": sales_areas,
            "locations": locations
        }
    }


# Action vts_block_trucks
@router.post('/vts_block_trucks', tags=['Ticketing'])
async def ticketing_vts_block_trucks(data: Ticketing_Vts_Block_TrucksParams):
    results = []

    # Validate trucks
    if not data.truck_info:
        return {
            "status": False,
            "message": "No trucks provided to block",
            "results": results
        }

    try:
        rpt = urdhva_base.context.context.get('rpt', {})
        if not rpt:
            return {
                "status": False,
                "message": "Session got expired, Please Re-Login",
                "results": results
            }

        redis_queue = urdhva_base.redispool.RedisQueue("ticket_block_trucks_queue")

        # Loop through each truck
        for truck in data.truck_info:
            try:
                queue_payload = {
                    "truck_number": truck.truck_number,
                    "blocking_days": data.block_days,
                    "remarks": data.remarks,
                    "reason": data.reason,
                    "bu": truck.bu or "TAS",
                    "location_name": truck.location_name or "",
                    "sap_id": truck.sap_id or "",
                    "region": truck.region or "",
                    "zone": truck.zone or "",
                    "ticket_id": data.ticket_id,
                    "check_ticket_close": data.check_ticket_close,
                    "rpt": {
                        "username": rpt.get("username", ""),
                        "email": rpt.get("email", ""),
                        "novex_role": rpt.get("novex_role", []),
                    },
                    "entity_id": urdhva_base.context.context.get("entity_id", "Novex")
                }

                await redis_queue.put(json.dumps(queue_payload))
                results.append({
                    "truck_number": truck.truck_number,
                    "status": "queued",
                    "message": "Queued for blocking"
                })

            except Exception as inner_e:
                logger.exception(f"Error queueing truck {truck.truck_number}: {str(inner_e)}")
                results.append({
                    "truck_number": truck.truck_number,
                    "status": False,
                    "message": "Failed to queue"
                })

        return {
            "status": True,
            "message": "Block requests queued for processing",
            "results": results
        }

    except Exception as e:
        logger.exception(f"Error in Multi Truck Block Flow: {str(e)}")
        return {
            "status": False,
            "message": "Failed to process truck blocking",
            "results": results
        }


async def get_escalation_config() -> List[Dict]:
    return [
        {
            "level": "L1",
            "query": "ticket_status='Open' AND ticket_state = 'Open' AND (escalation_level IS NULL OR escalation_level = '')",
            "multiplier": 1
        },
        {
            "level": "L2",
            "query": "ticket_status='Open' and escalation_level='L1'",
            "multiplier": 2
        }
    ]


# Action process_escalations
@router.post('/process_escalations', tags=['Ticketing'])
async def ticketing_process_escalations():
    try:

        now = datetime.now(ZoneInfo("Asia/Kolkata"))

        reverted_count = await revert_reassigned_tickets()
        print(f"Reverted {reverted_count} reassigned tickets back to Open")
 
        rules = await get_escalation_config()
        escalated_count = 0

        for rule in rules:

            params = urdhva_base.queryparams.QueryParams()
            params.q = rule["query"]
            params.limit = 100000
            params.fields = [
                "id", "ticket_id", "start_date", "ticket_end_date",
                "ticket_history", "escalation_level",
                "sap_id", "location_name", "zone", "category", "sub_category"
            ]

            resp = await Ticketing.get_all(params, resp_type="plain")
            tickets = resp.get("data", [])

            for ticket in tickets:

                start_date = ticket.get("start_date")
                end_date = ticket.get("ticket_end_date")

                if not start_date or not end_date:
                    continue

                try:
                    start_date = start_date.astimezone(ZoneInfo("Asia/Kolkata"))
                    end_date = end_date.astimezone(ZoneInfo("Asia/Kolkata"))
                except:
                    continue

                # SLA days
                # sla_days = (end_date - start_date).days
                sla_days = max(1, abs((end_date - start_date).days))
                open_days = (now - start_date).days
                print("open_days: ", open_days)
                print("sla_days: ", sla_days)
                category_list = ticket.get("category") or []
                category = category_list[0] if isinstance(category_list, list) and category_list else category_list

                functional_area = CATEGORY_FUNCTIONAL_MAP.get(category)
                zonal_area = ZONAL_FUNCTIONAL_MAP.get(category)
                if not functional_area:
                    continue

                print("functional_area:", functional_area, category)
                ticket_zone = ticket.get("zone")
                location_name = ticket.get("location_name")
                zones = ",".join([f"'{z}'" for z in ticket_zone])

                print("ticket_zone: ",ticket_zone)
                # If zone available but location missing → direct L2
                if ticket_zone and not location_name:
                    rule_level = "L2"
                else:
                    rule_level = rule["level"]

                if rule_level == "L2":
                    role_condition = "role LIKE '%Zonal Head%'"
                    employee_roles = ["Zonal Head SOD Ticketing"]
                else:
                    role_condition = f"role LIKE '%{functional_area}%'"
                    employee_roles = [zonal_area]

                query = f"""
                select zone, employee_id, role 
                from ticket_user_mails 
                where {role_condition}
                and zone in ({zones})
                ORDER BY zone DESC
                """
                users_rec = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
                users = users_rec.get("data", [])
                print("users: ",users)
                # users = users_rec.get("data", [])
                employee_ids = [u.get("employee_id") for u in users if u.get("employee_id")]
                print("employee_ids: ",employee_ids)
                # employee_roles = [u.get("role") for u in users if u.get("role")]

                # if sla_days <= 0:
                #    continue

                # Dynamic escalation check
                limit_days = abs(sla_days) * rule["multiplier"]
                print("ticket.get", ticket.get("escalation_level"))
                print("rule: ", rule["level"])

                if open_days > limit_days and ticket.get("escalation_level") != rule["level"]:
                    await escalate_ticket(ticket, rule_level,employee_ids,employee_roles)
                    escalated_count += 1
                print("rule level: ",rule["level"])

        return {
            "status": True,
            "message": "Escalation completed successfully",
            "total_escalated": escalated_count
        }

    except Exception as e:
        return {
            "status": False,
            "message": str(e)
        }


async def escalate_ticket(ticket: Dict, level: str,employee_ids: List[str],employee_roles: List[str]):
    now = datetime.now(ZoneInfo("Asia/Kolkata"))
    history = ticket.get("ticket_history") or []

    history.append({
        "processed_time": now.isoformat(),
        "allocated_time": now.isoformat(),
        "action_msg": f"Ticket auto escalated to {level}",
        "action_type": f"AutoEscalation {level}"
    })
    employee_id = employee_ids if employee_ids else []
    employee_roles = employee_roles if employee_roles else []

    await Ticketing(
        id=ticket["id"],
        ticket_state="Escalated",
        escalation_level=level,
        employee_id=employee_id,
        employee_role=employee_roles,
        ticket_history=history
    ).modify()

    try:
        mail_payload = {
            "ticket_id": ticket.get("ticket_id"),
            "ticket_state": State.Escalated.value,  # "Escalated"
            "escalation_level": level,  # "L1" or "L2"
            "sap_id": ticket.get("sap_id"),
            "location_name": ticket.get("location_name"),
            "category": ticket.get("category"),
            "sub_category": ticket.get("sub_category"),
            "start_date": ticket.get("start_date"),
            "zone": ticket.get("zone"),
            "ticket_end_date": ticket.get("ticket_end_date"),
        }
        await send_ticket_mail(mail_payload)
    except Exception as e:
        logger.warning(f"Error sending escalation mail for ticket {ticket.get('ticket_id')}: {e}")
        logger.warning(traceback.format_exc())


async def revert_reassigned_tickets():
    # 1. Get current time in IST
    tz_ist = ZoneInfo("Asia/Kolkata")
    now_ist = datetime.now(tz_ist)
    

    now_utc = now_ist.astimezone(timezone.utc)
    formatted_utc = now_utc.strftime('%Y-%m-%d %H:%M:%S')

    today_str = now_ist.strftime('%Y-%m-%d')

    params = urdhva_base.queryparams.QueryParams()
    params.q = f"ticket_state = 'Reassigned' AND reassigne_due_date < '{today_str}'"
    params.fields = ["id", "ticket_id", "ticket_state", "reassigne_due_date"]
    
    resp = await Ticketing.get_all(params, resp_type="plain")
    tickets = resp.get("data", [])
    reverted_count = 0

    for ticket in tickets:
        try:
            update_payload = {
                "id": ticket["id"],
                "ticket_state": "Open",
                "updated_at": formatted_utc  # Send UTC string to the UTC column
            }
            
            # Use the .modify() pattern
            await Ticketing(**update_payload).modify()
            
            reverted_count += 1
            print(f"SUCCESS: Ticket {ticket['ticket_id']} reverted. DB UTC Time: {formatted_utc}")
            
        except Exception as err:
            print(f"ERROR updating ticket {ticket.get('id')}: {err}")
            
    return reverted_count

# Action pm_orders
@router.post('/pm_orders', tags=['Ticketing'])
async def ticketing_pm_orders(data: Ticketing_Pm_OrdersParams):
    try:
        filters = []
        filters.append("LOWER(system_status_desc) != 'technically completed'")
        
        # Date filter
        if data.start_date and data.end_date:
            filters.append(f"""
                TO_DATE(planned_date,'YYYYMMDD')
                BETWEEN '{data.start_date}' AND '{data.end_date}'
            """)

        # Planning plant filter
        if data.planning_plant:
            if isinstance(data.planning_plant, list):
                plants = "', '".join([str(p).strip() for p in data.planning_plant])
                filters.append(f"TRIM(planning_plant) IN ('{plants}')")
            else:
                filters.append(f"TRIM(planning_plant) = '{str(data.planning_plant).strip()}'")
        if data.search:
            search_text = data.search.strip().lower()

            filters.append(f"""
                (
                    LOWER(order_no) LIKE '%{search_text}%'
                    OR LOWER(order_type) LIKE '%{search_text}%'
                    OR LOWER(order_description) LIKE '%{search_text}%'
                    OR LOWER(planner_group_desc) LIKE '%{search_text}%'
                    OR LOWER(system_status_desc) LIKE '%{search_text}%'
                    OR LOWER(equipment_description) LIKE '%{search_text}%'
                    OR LOWER(planning_plant) LIKE '%{search_text}%'
                    OR LOWER(planning_plant_desc) LIKE '%{search_text}%'
                )
            """)

        where_clause = ""
        if filters:
            where_clause = "WHERE " + " AND ".join(filters)

        skip = data.skip if data.skip is not None else 0
        limit = data.limit if data.limit is not None else 50

        #  data query
        query = f"""
            SELECT
                order_no,
                order_type,
                order_description,
                planner_group_desc,
                system_status_desc,
                equipment_description,
                planning_plant,
                planning_plant_desc,
                planned_date
            FROM pm_orders
            {where_clause}
            ORDER BY planned_date
            LIMIT {limit}
            OFFSET {skip}
        """

        print(query)
        

        rows = []

        if data.data_required:
            result = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
            rows = result.get("data", [])
        
        base_filters = [f for f in filters if "system_status_desc" not in f]

        total_orders_where = ""
        if base_filters:
            total_orders_where = "WHERE " + " AND ".join(base_filters)

        total_orders_query = f"""
            SELECT COUNT(*) AS total_orders
            FROM pm_orders
            {total_orders_where}
        """

        # active orders count (same as current filter)
        active_orders_query = f"""
            SELECT COUNT(*) AS active_orders
            FROM pm_orders
            {where_clause}
        """

        # completed orders count
        completed_orders_where = ""
        if base_filters:
            completed_orders_where = "AND " + " AND ".join(base_filters)

        completed_orders_query = f"""
            SELECT COUNT(*) AS completed_orders
            FROM pm_orders
            WHERE LOWER(system_status_desc) = 'technically completed'
            {completed_orders_where}
        """

        # execute counts
        total_orders_res = await hpcl_ceg_model.Alerts.get_aggr_data(total_orders_query, limit=0)
        active_orders_res = await hpcl_ceg_model.Alerts.get_aggr_data(active_orders_query, limit=0)
        completed_orders_res = await hpcl_ceg_model.Alerts.get_aggr_data(completed_orders_query, limit=0)

        total_orders_count = total_orders_res.get("data", [{}])[0].get("total_orders", 0)
        active_orders_count = active_orders_res.get("data", [{}])[0].get("active_orders", 0)
        completed_orders_count = completed_orders_res.get("data", [{}])[0].get("completed_orders", 0)

        return {
            "status": True,
            "message": "PM Orders fetched successfully",
            "total_orders_count": total_orders_count,
            "active_orders_count": active_orders_count,
            "completed_orders_count": completed_orders_count,
            "data": rows if data.data_required else []
        }

    except Exception as e:
        print(f"Error fetching PM orders: {e}")
        return {
            "status": False,
            "message": f"Error fetching PM orders: {e}",
            "data": []
        }


# Action pm_orders_weekly
@router.post('/pm_orders_weekly', tags=['Ticketing'])
async def ticketing_pm_orders_weekly(data: Ticketing_Pm_Orders_WeeklyParams):
    try:
        filters = []

        # only technically completed orders
        filters.append("LOWER(system_status_desc) = 'technically completed'")

        # date filter
        if data.start_date and data.end_date:
            filters.append(f"""
                TO_DATE(planned_date,'YYYYMMDD')
                BETWEEN '{data.start_date}' AND '{data.end_date}'
            """)

        # plant filter
        if data.planning_plant:
            if isinstance(data.planning_plant, list):
                plants = "', '".join([str(p).strip() for p in data.planning_plant])
                filters.append(f"TRIM(planning_plant) IN ('{plants}')")
            else:
                filters.append(f"TRIM(planning_plant) = '{str(data.planning_plant).strip()}'")

        # search filter
        if data.search:
            search_text = data.search.strip().lower()
            filters.append(f"""
                (
                    LOWER(order_no) LIKE '%{search_text}%'
                    OR LOWER(order_type) LIKE '%{search_text}%'
                    OR LOWER(order_description) LIKE '%{search_text}%'
                    OR LOWER(planner_group_desc) LIKE '%{search_text}%'
                    OR LOWER(equipment_description) LIKE '%{search_text}%'
                    OR LOWER(planning_plant) LIKE '%{search_text}%'
                    OR LOWER(planning_plant_desc) LIKE '%{search_text}%'
                )
            """)

        where_clause = "WHERE " + " AND ".join(filters)

        skip = data.skip or 0
        limit = data.limit or 50

        #  segmentation switch
        if data.segment_type == "month":

            segment_expr = """
                TO_CHAR(TO_DATE(planned_date,'YYYYMMDD'),'Mon-YYYY')
            """
            message = "Monthly technically completed PM orders fetched successfully"

        else:

            segment_expr = """
                CASE
                    WHEN EXTRACT(DAY FROM TO_DATE(planned_date,'YYYYMMDD')) BETWEEN 1 AND 7 THEN 'Week-1'
                    WHEN EXTRACT(DAY FROM TO_DATE(planned_date,'YYYYMMDD')) BETWEEN 8 AND 14 THEN 'Week-2'
                    WHEN EXTRACT(DAY FROM TO_DATE(planned_date,'YYYYMMDD')) BETWEEN 15 AND 21 THEN 'Week-3'
                    ELSE 'Week-4'
                END
            """
            message = "Weekly technically completed PM orders fetched successfully"

        #  main query
        query = f"""
            SELECT
                {segment_expr} AS segment,
                order_no,
                order_type,
                order_description,
                planner_group_desc,
                system_status_desc,
                equipment_description,
                planning_plant,
                planning_plant_desc,
                planned_date
            FROM pm_orders
            {where_clause}
            ORDER BY TO_DATE(planned_date,'YYYYMMDD')
            LIMIT {limit}
            OFFSET {skip}
        """

        # count query
        count_query = f"""
            SELECT
                {segment_expr} AS segment,
                COUNT(*) AS total_count
            FROM pm_orders
            {where_clause}
            GROUP BY segment
            ORDER BY segment
        """

        print(query)
        print(count_query)

        rows = []

        if data.data_required:
            data_res = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
            rows = data_res.get("data", [])
            

        count_result = await hpcl_ceg_model.Alerts.get_aggr_data(count_query, limit=0)
        segment_counts = count_result.get("data", [])

        return {
            "status": True,
            "message": message,
            "segment_counts": segment_counts,
            "data": rows if data.data_required else []
        }

    except Exception as e:
        print(f"Error fetching segmented PM orders: {e}")
        return {
            "status": False,
            "message": str(e),
            "data": []
        }


# Action run_alert_closer
@router.post('/run_alert_closer', tags=['Ticketing'])
async def ticketing_run_alert_closer(data: Ticketing_Run_Alert_CloserParams):
    await alert_ticket_close.process_and_enqueue_alert_closer()
    return {"message": "Alert closer triggered"}
