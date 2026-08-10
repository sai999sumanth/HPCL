import urdhva_base
import re
import json
import httpx
import datetime
import importlib
import aiofiles
import hpcl_ceg_model
import traceback
import pandas as pd
from jinja2 import Template
from weasyprint import HTML
import utilities.helpers as helpers
# import orchestrator.alerting.ro_alert as ro_alert
# import orchestrator.alerting.va_alert as va_alert
# import orchestrator.alerting.vts_alert as vts_alert
# import orchestrator.alerting.tas_alert as tas_alert
# import orchestrator.alerting.lpg_alert as lpg_alert
import orchestrator.analytics.va_analysis as va_analysis
import utilities.connection_mapping as connection_mapping
# import orchestrator.alerting.emlock_alert as emlock_alert
import orchestrator.analytics.vts_analysis as vts_analysis
from orchestrator.notification_manager.notify_email import *
import orchestrator.analytics.emlock_analysis as emlock_analysis
import orchestrator.analytics.dry_out_analysis as dry_out_analysis
from utilities.interlock_template_mapping import (
    InterlockTemplateMapping,
    TemplateMapping
)
import utilities.minio_connector as minio_connector


async def create_alert(alert_data, camunda_url=urdhva_base.settings.camunda_url):
    """
    Create an alert based on input alert data. This function delegates the actual creation of the alert to the specific
    alert manager (e.g. ROAlertManager, VAAlertManager, etc.) based on the 'alert_type' field in the input alert data.

    Parameters:
        alert_data (dict): A dictionary containing the data to create the alert.
        camunda_url (String): Camunda Connection String.

    Returns:
        dict: A dictionary containing the status, message and the created alert document.
    """
    # print("into create alert", alert_data)
    alert_type = alert_data['alert_type']
    module_name = f"orchestrator.alerting.{alert_type.lower()}_alert"
    module = importlib.import_module(module_name)
    class_name = f"{alert_type}AlertManager"
    alert_class = getattr(module, class_name)
    instance = alert_class()
    return await instance.create_bu_alert(alert_data, camunda_url)
    # return await eval(f"{alert_type.lower()}_alert.{alert_type}AlertManager").create_bu_alert(alert_data, camunda_url)


async def close_alert(alert_data):
    """
    Close an alert based on input alert data. This function delegates the actual closure of the alert to the specific alert manager (e.g. ROAlertManager, VAAlertManager, etc.) based on the 'alert_type' field in the input alert data.

    Parameters:
        alert_data (dict): A dictionary containing the data to close the alert.

    Returns:
        dict: A dictionary containing the status, message and the closed alert document.
    """
    # print("alert_data for close alert", alert_data)
    # alert_type = alert_data['alert_type']
    # return await eval(f"{alert_type.lower()}_alert.{alert_type}AlertManager").close_bu_alert(alert_data)
    alert_type = alert_data['alert_type']
    module_name = f"orchestrator.alerting.{alert_type.lower()}_alert"
    module = importlib.import_module(module_name)
    class_name = f"{alert_type}AlertManager"
    alert_class = getattr(module, class_name)
    instance = alert_class()
    return await instance.close_bu_alert(alert_data)


async def get_function_mapping():
    function_map = {
        "Justification": "is_justify", "Rejected": "is_rejected", "Approved": "is_approved",
        "Override": "is_override", "interLockOk": "is_interlockok",
        "excApprovalTimeExp": "is_exc_approval_time_exp", "Message": "is_message",
        "Raised": "is_raised", "Cancelled": "is_cancelled", "Allocated": "is_allocated",
        "SentToSap": "is_sent_to_sap", "OrderPlaced": "is_order_placed",
        "Created": "is_created", "Tripped": "is_tripped", "VTS": "is_vts",
        "AcceptClose": "is_accept", "InvalidAlert": "is_invalid", "FalseAlert": "is_false", "ValidAlert": "is_valid",
        "Blocked": "is_blocked", "UnBlocked": "is_unblocked", "Interrupt": "is_interrupt", "Request": "is_extra_days"
    }
    return function_map

async def close_va_alert(alert_data, input_data):
    """
    Args:
        alert_data:
        input_data:

    Returns:
    """
    if not isinstance(alert_data, dict):
        alert_data = alert_data.__dict__
    if not input_data.get("doc_link", ""):
        input_data["doc_link"] = await get_doc_link_from_alert_history(alert_data)

    if input_data['doc_link']:
        if isinstance(input_data['doc_link'], list):
            input_data['doc_link'] = input_data['doc_link'][0]
        else:
            input_data['doc_link'] = ""
    else:
        input_data['doc_link'] = ""

    action_code = "VALID"
    if input_data.get("action_type") == 'InvalidAlert':
        action_code = 'INVALID'
    if input_data.get("action_type") == 'FalseAlert':
        action_code = 'FALSE'
    params = {
        "AlarmId": alert_data['external_id'],
        "Status": "CLOSED",
        "AcknowledgedBy": input_data.get("acknowledged_by", "1234"),
        "ActionCode": action_code,
        "ActionReason": input_data.get("rca_reason", "Other"),
        "ActionCategory": input_data.get("category", "Others"),
        "doc_link": input_data.get("doc_link", ""),
        "ActionDescription": input_data.get("action_description", "")
    }
    return await va_analysis.close_va_alerts(params)

async def close_vts_alert(alert_data, input_data):
    """

    Args:
        alert_data:
        input_data:

    Returns:

    """
    if urdhva_base.context.context.exists():
        rpt = urdhva_base.context.context.get('rpt', {})
    else:
        rpt = {}

    if not isinstance(alert_data, dict):
        alert_data = alert_data.__dict__
    if not input_data.get("doc_link", ""):
        input_data["doc_link"] = await get_doc_link_from_alert_history(alert_data)
    un_block_datetime = str(alert_data['vehicle_blocked_end_date'].strftime("%Y-%m-%d %H:%M:%S")) if input_data.get("is_autoblock", False) else str(urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d %H:%M:%S"))
    approved_datetime = await get_approved_remarks(alert_data, is_approved=False, get_approved_time=True)
    params = {
            "TT_No": alert_data['vehicle_number'],
            "UnBlockedBy": rpt.get("employee_id", "NOVEX_USER"),
            "UnBlockedDateTime": un_block_datetime,
            "UnBlockedRemarks": await get_approved_remarks(alert_data, is_approved=False),
            "ApprovedBy": rpt.get("employee_id", "NOVEX_USER"),
            "ApprovedDateTime": approved_datetime,
            "ApprovedRemarks": await get_approved_remarks(alert_data, is_approved=True),
            "BlockStartDate": str(alert_data['vehicle_blocked_start_date'].strftime("%Y-%m-%d %H:%M:%S")),
            "BlockEndDate": str(alert_data['vehicle_blocked_end_date'].strftime("%Y-%m-%d %H:%M:%S")),
            "WaivedOff": 0,
            "AlertID": str(alert_data['id']),
            "DocLink": {
                "DocPaths": input_data["doc_link"] if input_data['doc_link'] else []
            }
        }
    print("Un block tt params: ", params)
    # return True, "Success"
    resp = await vts_analysis.post_unblocked_tt(params)
    query = f"""update vts_truck_details set truck_status = 'UNBLOCKED' where truck_regno = '{alert_data["vehicle_number"]}'"""
    await hpcl_ceg_model.VtsTruckDetails.update_by_query(query)
    return resp

async def close_emlock_alert(alert_data, input_data):
    """

    Args:
        alert_data:
        input_data:

    Returns:

    """
    if urdhva_base.context.context.exists():
        rpt = urdhva_base.context.context.get('rpt', {})
    else:
        rpt = {}

    if not isinstance(alert_data, dict):
        alert_data = alert_data.__dict__
    meta_data = {}
    if alert_data['violation_type'] in ['FanNotGenerated', 'ShipmentNumberNotGenerated']:
        meta_data['loadNumber'] = input_data.get("load_number")
        meta_data['fanNumber'] = input_data.get("fan_number")
    if alert_data['violation_type'] == 'InvoiceNotGenerated':
        meta_data['loadNumber'] = input_data.get("load_number")
        meta_data['tripType'] = input_data.get("trip_type")
        meta_data['destinations'] = [
            {
                "invoiceNumber": input_data.get("invoice_number"),
                "roCode": alert_data['dealer_id'],
                "terminalCode": alert_data['servicing_plant_id']
            }
        ]

    params = {
        "emlockExceptionId": alert_data['external_id'],
        "terminalCode": alert_data['sap_id'],
        "truckNumber": alert_data['vehicle_number'],
        "exceptionType": alert_data['violation_type'],
        "status": "1" if input_data['action_type'] == 'Approved' else "2",
        "acknowledgedUser": rpt.get("employee_id", ""),
        # "acknowledgedTime": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "acknowledgedTime": urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d %H:%M:%S"),
        "remarks": input_data['action_msg'],
        "metaData": json.dumps(meta_data)
    }
    print("Params EMLock: ", params)
    await emlock_analysis.close_emlock_alert(alert_data=params)


async def get_approved_remarks(alert_data: dict, is_approved=False, get_approved_time=False):
    if get_approved_time:
        for alert_history in alert_data.get("alert_history", []):
            if alert_history.get('is_approved', False):
                if alert_history['action_type'] == 'Approved':
                    try:
                        _date = datetime.datetime.strptime(
                            alert_history['processed_time'], "%Y-%m-%dT%H:%M:%S.%f").strftime("%Y-%m-%d %H:%M:%S")
                        return _date
                    except Exception as e:
                        return str(urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d %H:%M:%S"))
        return str(urdhva_base.utilities.get_present_time().strftime("%Y-%m-%d %H:%M:%S"))
    for alert_history in alert_data.get("alert_history", []):
        if is_approved:
            if alert_history.get('is_approved', False):
                if alert_history['action_type'] == 'Approved':
                    return alert_history['action_msg']
        else:
            if alert_history['action_type'] not in ['Created', 'Approved', 'VTS', 'Active', 'Notified', 'Resolved']:
                return alert_history['action_msg']
    return ""

async def get_doc_link_from_alert_history(alert_data):
    """

    Args:
        alert_data:

    Returns:

    """
    doc_link = []
    for alert_history in alert_data.get("alert_history", []):
        if alert_history.get("doc_link", ""):
            doc_link.append(alert_history.get("doc_link", ""))
    return doc_link


def read_template(filename, data):
    with open(filename, 'r') as f:
        html_string = f.read()
    j2_template = Template(html_string)
    body=j2_template.render(data)
    return body


async def va_alert_closer(alert_data, input_data):
    """

    Args:
        alert_data:
        input_data:

    Returns:

    """
    resp = await close_va_alert(alert_data, input_data)
    if not isinstance(alert_data, dict):
        alert_data = alert_data.__dict__
    close_alert_data = {}
    close_alert_data['alert_type'] = alert_data['alert_section']
    close_alert_data['bu'] = alert_data['bu']
    close_alert_data['alert_id'] = alert_data['id']
    close_alert_data['interlock_id'] = alert_data['interlock_id']
    await close_alert(close_alert_data)
    print(f"VA Alert resp {resp}")


async def vts_alert_closer(alert_data, input_data):
    """

    Args:
        alert_data:
        input_data:

    Returns:

    """
    if not isinstance(alert_data, dict):
        alert_data = alert_data.__dict__
    close_alert_data = {}
    close_alert_data['alert_type'] = alert_data['alert_section']
    close_alert_data['bu'] = alert_data['bu']
    close_alert_data['alert_id'] = alert_data['id']
    close_alert_data['interlock_id'] = alert_data['interlock_id']
    await close_alert(close_alert_data)
    data = {}
    data['interlock_name'] = alert_data['interlock_name']
    data['asset_name'] = alert_data["violation_type"]
    data['asset_id'] = ""
    data['plant_location'] = alert_data['location_name']
    data['plant_id'] = alert_data['sap_id']
    data['opened_time'] = alert_data['created_at'].strftime('%d-%m-%Y %H:%M:%S')
    data['user'] = 'Novex User'
    data['reason_closure'] = input_data.get("action_description", "")
    data['portal_link'] = "https://ceg.hpcl.co.in"
    notify_email = NotifyEMail()
    notify_email.publish_message(
        **{
            'to_emails': ['venu@algofusiontech.com',],
            'subject': f"VTS Alert Closed FOR {close_alert_data['bu']} BU And {alert_data['sap_id']} SAP ID",
            'body': read_template("/opt/ceg/algo/orchestrator/notification_templates/interlock_alert_closure.html", data=data),
            'html_content': True
        }
    )
    print(f"VTS Alert Closed")
    resp = await close_vts_alert(alert_data, input_data)
    print("Alert Closed in VTS Portal: ", resp)

async def emlock_alert_closer(alert_data, input_data):
    if not isinstance(alert_data, dict):
        alert_data = alert_data.__dict__
    close_alert_data = {}
    close_alert_data['alert_type'] = alert_data['alert_section']
    close_alert_data['bu'] = alert_data['bu']
    close_alert_data['alert_id'] = alert_data['id']
    close_alert_data['interlock_id'] = alert_data['interlock_id']
    close_resp = await close_alert(close_alert_data)
    print("close_resp: ", close_resp)
    resp = await close_emlock_alert(alert_data, input_data)

async def execute_workflow_ro(alert_data):
    await dry_out_analysis.trigger_camunda_workflow(alert_data)

async def _is_close_alert(input_data):
    """

    Args:
        input_data:

    Returns:

    """
    action_data = connection_mapping.alert_action.get(input_data['bu'])[input_data['alert_section']]
    for key, values in action_data['actions'].items():
        if values['name'] == input_data['action_type']:
            return values['close_alert'], action_data['close_alert_func']
    return False, ""

async def _is_create_workflow(input_data):
    """

    Args:
        input_data:

    Returns:

    """
    action_data = connection_mapping.alert_action.get(input_data['bu'])[input_data['alert_section']]
    for key, values in action_data['actions'].items():
        if values['name'] == input_data['action_type']:
            return values.get('create_workflow', False), action_data.get('create_workflow_func', '')
    return False, ""


class AlertAction:
    @classmethod
    async def update_alert_data(cls, input_data):
        """
        Function to update alert data, Either reject or approve or justify or override
        :param input_data:
        :return:
        """
        print("input_data --> ", input_data)
        function_map = {"Justification": "justify_alert", "Rejected": "reject_alert", "Approved": "approve_alert",
                        "Override": "override_alert", "interLockOk": "interlock_ok_alert", 
                        "excApprovalTimeExp": "exc_approval_time_exp_alert", "Message": "message_alert",
                        "Raised": "raised_alert", "Cancelled": "cancel_alert", "Allocated": "allocate_alert",
                        "SentToSap": "sent_to_sap_alert", "OrderPlaced": "order_placed_alert",
                        "Created": "created_alert", "Tripped": "tripped_alert", "VTS": "vts_alert",
                        "AcceptClose": "accept_close", "InvalidAlert": "invalid_alert", "FalseAlert": "false_alert", "ValidAlert": "valid_alert",
                        "Blocked": "block_alert", "UnBlocked": "unblock_alert", "Interrupt": "interrupt_alert", "Request": "request_alert", 
                        "Maintenance": "maintenance_alert","SendItBack": "send_it_back"}
        event_tag_map = {"Justification": "is_justify", "Approved": "is_approved", "AcceptClose": "accept", "InvalidAlert": "invalid"}
        alert_id = input_data['alert_id']
        if input_data['doc_link']:
            input_data['doc_link'] = await helpers.get_doc_link(input_data['doc_link'])
        # input_data.update({"event_tags": {event_tag_map.get(input_data['action_type'], "is_approved"): True}})
        try:
            alert_data = await hpcl_ceg_model.Alerts.get(alert_id)
        except Exception as e:
            print("Exception in getting alert data:%s" % e)
            return False, "Provided alert id is not valid"

        # Validating whether user has access permissions for the provided action
        # status, resp, email = await cls.verify_user_access_permissions(alert_data.bu, alert_data.sap_id,
        #                                                                input_data['action_type'])
        # if not status:
        #     return status, resp

        # This creates a regular expression pattern to match anything within < and >,
        # which includes HTML tags like <div>, <span>, <br>, etc.
        # The .*? ensures a non-greedy match, meaning it will stop at the first closing >
        # rather than consuming everything until the last >
        condition = re.compile('<.*?>')
        input_data["action_msg"] = re.sub(condition, '', input_data["action_msg"])

        # get the function name
        function_name = function_map.get(input_data['action_type'], None)
        if function_name:
            if getattr(alert_data, "alert_section", None) == "VTS":
                assigned_roles = getattr(alert_data, "assigned_user_roles", None)
                existing_msg = input_data.get("action_msg", "")
                if assigned_roles:
                    prefix = " " if existing_msg else ""
                    input_data["action_msg"] = f"{existing_msg}{prefix}initiated by {', '.join(assigned_roles)}"

            await cls.update_alert_history(input_data, alert_data)
            if input_data['action_type'] == 'Approved' and input_data['bu'] == 'RO':
                interlock_disable_data = {
                    "sap_id": alert_data.sap_id,
                    "interlock_name": alert_data.interlock_name,
                    "bu": input_data['bu']
                }
                await hpcl_ceg_model.RoInterlockDisableCreate(**interlock_disable_data).create()
            # call the function
            # return await getattr(cls, function_name)(input_data, alert_data)

            # For testing added below 3 lines
            if input_data['alert_section'] != 'EMLock':
                meg_resp = await getattr(cls, function_name)(input_data, alert_data)
            else:
                meg_resp = {"status": "True", "message": "Alert Closed", "data": []}

            status, func = await _is_close_alert(input_data)
            if status and func:
                print("func: ", func)
                await eval(func)(alert_data=alert_data, input_data=input_data)

            status, func = await _is_create_workflow(input_data)
            if status and func:
                print("func: ", func)
                await eval(func)(alert_data=alert_data)
            # if input_data.get("alert_section", "") == 'VA' and input_data.get("action_type", "") in ["Approved"]:
            # if input_data.get("alert_section", "") == 'VA':
            #     if await _is_close_alert(input_data):
            #         await va_alert_closer(alert_data, input_data)

            # if input_data.get("alert_section", "") == 'VTS' and input_data.get("action_type", "") in ["Approved"]:
            # if input_data.get("alert_section", "") == 'VTS':
            #     if await _is_close_alert(input_data):
            #         await vts_alert_closer(alert_data, input_data)
            return meg_resp
        return False, "Alert action is not valid"
    
    @classmethod
    async def update_alert_data_vts(cls, input_data):
        """
        Function to update alert data, Either reject or approve or justify or override
        :param input_data:
        :return:
        """
        print("input_data --> ", input_data)
        function_map = {"Justification": "justify_alert", "Rejected": "reject_alert", "Approved": "approve_alert",
                        "Override": "override_alert", "interLockOk": "interlock_ok_alert", 
                        "excApprovalTimeExp": "exc_approval_time_exp_alert", "Message": "message_alert",
                        "Raised": "raised_alert", "Cancelled": "cancel_alert", "Allocated": "allocate_alert",
                        "SentToSap": "sent_to_sap_alert", "OrderPlaced": "order_placed_alert",
                        "Created": "created_alert", "Tripped": "tripped_alert", "VTS": "vts_alert",
                        "AcceptClose": "accept_close", "InvalidAlert": "invalid_alert", "FalseAlert": "false_alert", "ValidAlert": "valid_alert",
                        "Blocked": "block_alert", "UnBlocked": "unblock_alert", "Interrupt": "interrupt_alert", "Request": "request_alert", 
                        "Maintenance": "maintenance_alert","SendItBack": "send_it_back", "FalseViolation": "false_violation", "AcceptViolation": "accept_violation"}
        event_tag_map = {"Justification": "is_justify", "Approved": "is_approved", "AcceptClose": "accept", "InvalidAlert": "invalid"}
        alert_id = input_data['alert_id']
        if input_data['doc_link']:
            input_data['doc_link'] = await helpers.get_doc_link(input_data['doc_link'])
        # input_data.update({"event_tags": {event_tag_map.get(input_data['action_type'], "is_approved"): True}})
        try:
            alert_data = await hpcl_ceg_model.ViolationHistoryVts.get(alert_id)
        except Exception as e:
            print("Exception in getting alert data:%s" % e)
            return False, "Provided alert id is not valid"

        # Validating whether user has access permissions for the provided action
        # status, resp, email = await cls.verify_user_access_permissions(alert_data.bu, alert_data.sap_id,
        #                                                                input_data['action_type'])
        # if not status:
        #     return status, resp

        # This creates a regular expression pattern to match anything within < and >,
        # which includes HTML tags like <div>, <span>, <br>, etc.
        # The .*? ensures a non-greedy match, meaning it will stop at the first closing >
        # rather than consuming everything until the last >
        condition = re.compile('<.*?>')
        input_data["action_msg"] = re.sub(condition, '', input_data["action_msg"])

        # get the function name
        function_name = function_map.get(input_data['action_type'], None)
        if function_name:
            await cls.update_alert_history_vts(input_data, alert_data)
            # call the function
            # return await getattr(cls, function_name)(input_data, alert_data)
            # For testing added below 3 lines
            if input_data['alert_section'] == 'VTS':
                meg_resp = await getattr(cls, function_name)(input_data, alert_data)
            else:
                meg_resp = {"status": "True", "message": "Alert Closed", "data": []}
            return meg_resp
        return False, "Alert action is not valid"
    
    @classmethod
    async def update_alert_history_vts(cls, input_data, alert_data):
        """
        Function to update alert data, Either reject or approve or justify or override
        :param input_data:
        :param alert_data:
        :return:
        """
        # Todo:- here we have to write all the generic functionality like updating the alert data,
        #  history, fetching users, roles, ...
        # print("input_data for alert--> ", input_data)
        alert_history = alert_data.get('alert_history', []) if isinstance(alert_data, dict) else getattr(alert_data, 'alert_history', [])
        if urdhva_base.context.context.exists():
            rpt = urdhva_base.context.context.get('rpt', {})
        else:
            rpt = {}
        # alert_history = alert_data.alert_history
        # print("alert_history --> ", alert_history)
        # allocated_time = alert_data.updated_at
        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__
        if isinstance(alert_data, dict):
            allocated_time = alert_data.get('updated_at', datetime.datetime.now(datetime.timezone.utc))
        else:
            allocated_time = alert_data.updated_at if hasattr(alert_data, 'updated_at') else datetime.datetime.now(datetime.timezone.utc)
        
        if alert_history and alert_history[-1].get("processed_time"):
            allocated_time = alert_history[-1]["processed_time"]
        processed_time = datetime.datetime.now(datetime.timezone.utc)
        event_tags = input_data.get("event_tags", {})
        if not event_tags:
            event_tags = {}
        if alert_data['alert_section'] in ['VTS']:
            input_data['action_msg'] = input_data.get("action_msg", "") + ((" " if input_data.get("action_msg") else "") + "Remarks initiated by " + ", ".join(alert_data.get("assigned_user_roles", [])) if alert_data.get("assigned_user_roles") else "")
        # Append the updated alert history with the converted datetime strings
        alert_history.append({"allocated_time": allocated_time.isoformat() if isinstance(allocated_time, datetime.datetime) else allocated_time,
                            "processed_time": processed_time.isoformat(), "action_type": input_data["action_type"],
                            "action_msg": input_data["action_msg"], "mail_sent_to": "",
                            "action_by": rpt.get("email", "NOVEX_USER"),
                            "remarks": input_data.get("remarks", ""),
                            "ims_datetime": input_data.get("ims_datetime", ""),
                            "prod_reqd_dt": input_data.get("prod_reqd_dt", ""),
                            "doc_link": input_data.get("doc_link", ""),
                            "atr_uploaded": event_tags.get("is_atr_uploaded", False),
                            "maintenance_exception": event_tags.get("is_maintenance_exception", False), 
                            "revocation": event_tags.get("is_revocation", False),
                            "no_exception": event_tags.get("no_exception", False),
                            "is_approved": event_tags.get("is_approved", False),
                            "is_exc_approval_time_exp": event_tags.get("is_exc_approval_time_exp", False),
                            "is_raised": event_tags.get("is_raised", False),
                            "is_cancelled": event_tags.get("is_cancelled", False),
                            "is_allocated": event_tags.get("is_allocated", False),
                            "is_sent_to_sap": event_tags.get("is_sent_to_sap", False),
                            "is_order_placed": event_tags.get("is_order_placed", False),
                            "is_created": event_tags.get("is_created", False),
                            "is_r1_swipe": event_tags.get("is_r1_swipe", False),
                            "is_r2_swipe": event_tags.get("is_r2_swipe", False),
                            "is_r3_swipe": event_tags.get("is_r3_swipe", False),
                            "is_vts": event_tags.get("is_vts", False),
                            "is_delivered": event_tags.get("is_delivered", False),
                            "is_tripped": event_tags.get("is_tripped", False),
                            "is_justify": event_tags.get("is_justify", False),
                            "is_blocked": event_tags.get("is_blocked", False),
                            "is_unblocked": event_tags.get("is_unblocked", False),
                            "is_interrupt": event_tags.get("is_interrupt", False),
                            "is_extra_days": event_tags.get("is_extra_days", False),
                            "is_rejected": event_tags.get("is_rejected", False)
                        })
        # print("alert_history before update --> ", alert_history)
        # Modify the alert with the updated alert_history
        # Handle alert_data based on whether it is a dictionary or object
        alert_id = alert_data.get('id') if isinstance(alert_data, dict) else getattr(alert_data, 'id', None)
        
        if not alert_id:
            raise ValueError("Alert data does not have an 'id' field.")

        # Modify the alert with the updated alert_history
        await hpcl_ceg_model.ViolationHistoryVts(**{"id": alert_id, "alert_history": alert_history}).modify()
        # await hpcl_ceg_model.Alerts(**{"id": alert_data.id, "alert_history": alert_history}).modify()

    @classmethod
    async def update_alert_history(cls, input_data, alert_data):
        """
        Function to update alert data, Either reject or approve or justify or override
        :param input_data:
        :param alert_data:
        :return:
        """
        # Todo:- here we have to write all the generic functionality like updating the alert data,
        #  history, fetching users, roles, ...
        # print("input_data for alert--> ", input_data)
        alert_history = alert_data.get('alert_history', []) if isinstance(alert_data, dict) else getattr(alert_data, 'alert_history', [])
        if urdhva_base.context.context.exists():
            rpt = urdhva_base.context.context.get('rpt', {})
        else:
            rpt = {}
        # alert_history = alert_data.alert_history
        # print("alert_history --> ", alert_history)
        # allocated_time = alert_data.updated_at
        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__
        if isinstance(alert_data, dict):
            allocated_time = alert_data.get('updated_at', datetime.datetime.now(datetime.timezone.utc))
        else:
            allocated_time = alert_data.updated_at if hasattr(alert_data, 'updated_at') else datetime.datetime.now(datetime.timezone.utc)
        
        if alert_history and alert_history[-1].get("processed_time"):
            allocated_time = alert_history[-1]["processed_time"]
        processed_time = datetime.datetime.now(datetime.timezone.utc)
        event_tags = input_data.get("event_tags", {})
        if not event_tags:
            event_tags = {}
        # Append the updated alert history with the converted datetime strings
        alert_history.append({"allocated_time": allocated_time.isoformat() if isinstance(allocated_time, datetime.datetime) else allocated_time,
                            "processed_time": processed_time.isoformat(), "action_type": input_data["action_type"],
                            "action_msg": input_data["action_msg"], "mail_sent_to": "",
                            "rca_reason": input_data.get("rca_reason", ""),
                            "category": input_data.get("category", ""),
                            "action_by": rpt.get("email", "NOVEX_USER"),
                            "employee_id":rpt.get("employee_id",""),
                            "remarks": input_data.get("remarks", ""),
                            "ims_datetime": input_data.get("ims_datetime", ""),
                            "prod_reqd_dt": input_data.get("prod_reqd_dt", ""),
                            "doc_link": input_data.get("doc_link", ""),
                            "atr_uploaded": event_tags.get("is_atr_uploaded", False),
                            "maintenance_exception": event_tags.get("is_maintenance_exception", False), 
                            "revocation": event_tags.get("is_revocation", False),
                            "no_exception": event_tags.get("no_exception", False),
                            "is_approved": event_tags.get("is_approved", False),
                            "is_exc_approval_time_exp": event_tags.get("is_exc_approval_time_exp", False),
                            "is_raised": event_tags.get("is_raised", False),
                            "is_cancelled": event_tags.get("is_cancelled", False),
                            "is_allocated": event_tags.get("is_allocated", False),
                            "is_sent_to_sap": event_tags.get("is_sent_to_sap", False),
                            "is_order_placed": event_tags.get("is_order_placed", False),
                            "is_created": event_tags.get("is_created", False),
                            "is_r1_swipe": event_tags.get("is_r1_swipe", False),
                            "is_r2_swipe": event_tags.get("is_r2_swipe", False),
                            "is_r3_swipe": event_tags.get("is_r3_swipe", False),
                            "is_vts": event_tags.get("is_vts", False),
                            "is_delivered": event_tags.get("is_delivered", False),
                            "is_tripped": event_tags.get("is_tripped", False),
                            "is_justify": event_tags.get("is_justify", False),
                            "is_blocked": event_tags.get("is_blocked", False),
                            "is_unblocked": event_tags.get("is_unblocked", False),
                            "is_interrupt": event_tags.get("is_interrupt", False),
                            "is_extra_days": event_tags.get("is_extra_days", False),
                            "is_rejected": event_tags.get("is_rejected", False)
                        })
        # print("alert_history before update --> ", alert_history)
        # Modify the alert with the updated alert_history
        # Handle alert_data based on whether it is a dictionary or object
        alert_id = alert_data.get('id') if isinstance(alert_data, dict) else getattr(alert_data, 'id', None)
        
        if not alert_id:
            raise ValueError("Alert data does not have an 'id' field.")
        
        if alert_data['alert_section'] in ['VTS'] and input_data["action_type"] in ['Justification']:
            await hpcl_ceg_model.Alerts(**{"id": alert_id, "device_msg": "request_raised_for_unblock"}).modify()

        # Modify the alert with the updated alert_history
        await hpcl_ceg_model.Alerts(**{"id": alert_id, "alert_history": alert_history}).modify()
        # await hpcl_ceg_model.Alerts(**{"id": alert_data.id, "alert_history": alert_history}).modify()

    @classmethod
    def get_exception_message(cls, exception):
        """
        Function to get the exception message
        :param exception:
        :return:
        """
        exception_msg = {}
        if not exception:
            return exception_msg
        key_map = {"is_maintenance_exception": {"name": "isMaintenanceException", "type": "Boolean"},
                   "is_atr_uploaded": {"name": "isAtrUploaded", "type": "Boolean"},
                   "is_revocation": {"name": "isRevocation", "type": "Boolean"},
                   "no_exception": {"name": "noException", "type": "Boolean"},
                   "is_approved": {"name": "approved", "type": "Boolean"},
                   "is_exc_approval_time_exp": {"name": "isExcApprovalTimeExp", "type": "Boolean"},
                   "is_raised": {"name": "raised", "type": "Boolean"},
                   "is_cancelled": {"name": "cancelled", "type": "Boolean"},
                   "is_allocated": {"name": "allocated", "type": "Boolean"},
                   "is_sent_to_sap": {"name": "sentToSAP", "type": "Boolean"},
                   "is_order_placed": {"name": "orderPlaced", "type": "Boolean"},
                   "is_created": {"name": "created", "type": "Boolean"},
                   "is_r1_swipe": {"name": "r1Swipe", "type": "Boolean"},
                   "is_r2_swipe": {"name": "r2Swipe", "type": "Boolean"},
                   "is_r3_swipe": {"name": "r3Swipe", "type": "Boolean"},
                   "is_vts": {"name": "vts", "type": "Boolean"},
                   "is_delivered": {"name": "delivered", "type": "Boolean"},
                   "is_tripped": {"name": "tripped", "type": "Boolean"},
                   "is_justify": {"name": "justify", "type": "Boolean"},
                   "is_blocked": {"name": "blocked", "type": "Boolean"},
                   "is_unblocked": {"name": "unblocked", "type": "Boolean"},
                   "is_interrupt": {"name": "interrupt", "type": "Boolean"},
                   "is_extra_days": {"name": "request", "type": "Boolean"},
                   "is_rejected": {"name": "reject", "type": "Boolean"}
                   }
        return {value['name']: {'type': 'Boolean', 'value': exception.get(key, False)}
                for key, value in key_map.items()}

    @classmethod
    async def publish_to_camunda(cls, input_data, alert_data, action_type, msg=None):
        """
        Function to generate camunda message
        :param input_data:
        :param alert_data:
        :param action_type:
        :param msg:
        :return:
        """
        process_variables = cls.get_exception_message(input_data.get("event_tags", {}))
        process_variables.update({"override_days": {"type": "String", "value": input_data.get('days', '')},
                                  "msg": {"type": "String", "value": msg},
                                  "action_type": {"type": "String", "value": action_type}})
        print("process_variables: ", process_variables)
        messaged_data = {
            "messageName": action_type,
            "businessKey": alert_data.unique_id,
            "processVariables": process_variables
        }
        # print("messaged_data: ", messaged_data)
        # Posting data to camunda
        url = await helpers.get_camunda_url(
            bu=alert_data.bu,
            sap_id=alert_data.sap_id,
            alert_section=alert_data.alert_section
        )
        # url = urdhva_base.settings.camunda_url + "/engine-rest/message"
        url += "/engine-rest/message"
        print("url: ", url)
        r = httpx.post(url, headers={'Content-Type': 'application/json'}, json=messaged_data, verify=False)

        if int(r.status_code / 100) != 2:
            print(f"Error while sending message to camunda: {r.status_code} - {r.text} - {alert_data.unique_id}")
        else:
            print("Message sent to camunda")
        return True, "Successfull"

    @classmethod
    async def verify_user_access_permissions(cls, bu, sap_id, action_type):
        """
        Function to verify whether the user has access for the provided action
        :return: <bool> <string>
        """
        session_details = urdhva_base.context.context.get("rpt", {})
        email = session_details.get('email', '')
        # todo:- Need to update whether user has access or not for this particular BU, sapId and ActionType
        return True, "", email

    @classmethod
    async def reject_alert(cls, input_data, alert_data):
        """
        Function to reject an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        # if alert_data.alert_section in ["VA", "VTS", "TAS", "RO"]:
        #     return await cls.publish_to_camunda(input_data, alert_data, "Approved")
        return await cls.publish_to_camunda(input_data, alert_data, "Approved")

    @classmethod
    async def approve_alert(cls, input_data, alert_data):
        """
        Function to approve an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "Approved")

    @classmethod
    async def justify_alert(cls, input_data, alert_data):
        """
        Function to justify an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "Justification")
    
    @classmethod
    async def maintenance_alert(cls, input_data, alert_data):
        """
        Function to justify an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        if input_data.get("alert_section","") in ["TAS"] and input_data.get("days",0):
            # Add 30 days to the current time
            maintenance_time = helpers.get_time_stamp_by_delta(days=input_data.get("days",0), 
                                            with_month_start_day=False, 
                                            ascending=True,
                                            date_time_format=None).strftime("%Y-%m-%dT%H:%M:%S")
            alert_id = alert_data.get('id') if isinstance(alert_data, dict) else getattr(alert_data, 'id', None)
            if not alert_id:
                raise ValueError("Alert data does not have an 'id' field.")

            await hpcl_ceg_model.Alerts(**{"id": alert_id, "maintenance_time": maintenance_time}).modify()
        return await cls.publish_to_camunda(input_data, alert_data, "Maintenance")

    @classmethod
    async def override_alert(cls, input_data, alert_data):
        """
        Function to override an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "Override")

    @classmethod
    async def message_alert(cls, input_data, alert_data):
        """
        Function to override an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "Message")

    @classmethod
    async def interlock_ok_alert(cls, input_data, alert_data):
        """
        Function to override an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "interLockOk")
    
    @classmethod
    async def exc_approval_time_exp_alert(cls, input_data, alert_data):
        """
        Function to override an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "excApprovalTimeExp")

    @classmethod
    async def raised_alert(cls, input_data, alert_data):
        """
        Function to raise an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "Raised")

    @classmethod
    async def cancel_alert(cls, input_data, alert_data):
        """
        Function to cancel an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "Cancelled")

    @classmethod
    async def allocate_alert(cls, input_data, alert_data):
        """
        Function to allocate an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "Allocated")

    @classmethod
    async def sent_to_sap_alert(cls, input_data, alert_data):
        """
        Function to allocate an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "SentToSap")

    @classmethod
    async def order_placed_alert(cls, input_data, alert_data):
        """
        Function to allocate an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "OrderPlaced")

    @classmethod
    async def created_alert(cls, input_data, alert_data):
        """
        Function to allocate an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "Created")

    @classmethod
    async def delivered_alert(cls, input_data, alert_data):
        """
        Function to allocate an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "Delivered")

    @classmethod
    async def r1_swipe_alert(cls, input_data, alert_data):
        """
        Function to R1 Swipe an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "R1Swipe")

    @classmethod
    async def r2_swipe_alert(cls, input_data, alert_data):
        """
        Function to R2 Swipe an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "R2Swipe")

    @classmethod
    async def r3_swipe_alert(cls, input_data, alert_data):
        """
        Function to R3 Swipe an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "R3Swipe")
    
    @classmethod
    async def vts_read_template(cls, filename: str) -> str:
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
            cls.template_path = filepath
            async with aiofiles.open(filepath, 'r') as f:
                return await f.read()
        except FileNotFoundError:
            return ""
    
    @classmethod
    async def generate_show_cause_notice(cls, alert_data):
        try:
            if urdhva_base.context.context.exists():
                rpt = urdhva_base.context.context.get('rpt', {})
            else:
                rpt = {}

            vts_alert_history_query = f"""SELECT 
                                            vah.tl_number AS "Tank Truck No.",
                                            a.violation_type AS "Violation Type",
                                            a.severity as "Category",
                                            vah.{alert_data.violation_type} AS "Count",
                                            vah.invoice_number || ' / ' || TO_CHAR(vah.vts_end_datetime, 'DD-Mon-YY') AS "Invoice No. / Date",
                                            vah.report_duration AS "Trip Period"
                                        FROM vts_alert_history vah
                                        JOIN alerts a ON a.id = vah.alert_id::bigint
                                        WHERE vah.alert_id = '{alert_data.id}'
                                        ORDER BY vah.vts_end_datetime ASC""" 
            vts_alert_history_query_resp = await urdhva_base.BasePostgresModel.get_aggr_data(vts_alert_history_query, limit=0)
            vts_alert_history_query_resp = pd.DataFrame(vts_alert_history_query_resp.get('data',[]))
            print(vts_alert_history_query_resp.columns)
            # Insert empty Latitude & Longitude columns AFTER the "Count" column
            count_col_index = vts_alert_history_query_resp.columns.get_loc("Count")
            vts_alert_history_query_resp.insert(count_col_index + 1, "Latitude", "")
            vts_alert_history_query_resp.insert(count_col_index + 2, "Longitude", "")

            vts_alert_history_query_resp["Latitude"] = vts_alert_history_query_resp["Latitude"].fillna("")
            vts_alert_history_query_resp["Longitude"] = vts_alert_history_query_resp["Longitude"].fillna("")

            query = f"""
                    SELECT 
                        MIN(vts_end_datetime) AS violation_stat_date,
                        MAX(vts_end_datetime) AS violation_end_date
                    FROM vts_alert_history
                    WHERE alert_id = '{alert_data.id}';
                """
            resp = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
            resp = resp.get("data", [])
            
            transporter_code = str(int(alert_data.transporter_code))
            query = f"select * from email_master where transporter_code='{transporter_code}'"
            trasporter_details = await urdhva_base.BasePostgresModel.get_aggr_data(query)

            if trasporter_details["data"]:
                trasporter_details = trasporter_details["data"][0]
            else:
                trasporter_details = {}

            template_data = {}
            if resp:
                template_data = {
                    "violation_stat_date": resp[0]['violation_stat_date'].strftime("%d.%m.%Y"),
                    "violation_end_date": resp[0]['violation_end_date'].strftime("%d.%m.%Y"),
                    "transporter_code": transporter_code,
                    "transporter_name": trasporter_details.get("transporter_name",""),
                    "transporter_address": trasporter_details.get("transporter_address",""),
                    "date": urdhva_base.utilities.get_present_time().strftime("%d/%m/%Y"),
                    "count": len(vts_alert_history_query_resp),
                    "vts_violations_table": vts_alert_history_query_resp,
                    "officer_name": rpt.get("first_name",""),
                    "officer_designation": rpt.get("novex_role",""),
                    "location": alert_data.location_name,
                    "start_date": "--/--/----",
                    "end_date": "--/--/----",
                    "violation": " ".join(alert_data.interlock_name.split()[:-1])
                }
                if alert_data.device_id in ['Instance - 2','Instance - 3']:
                    template_data['black_list_conditions'] = f"""Please note, that every case of blacklisting of a TT inducted with the Transporter shall be considered 
                        as a separate case of blacklisting against the Transporter. Accordingly, the penalties for 1st, 2nd and 
                        3rd case of blacklisting shall be computed collectively for the purpose of blacklisting the entire fleet 
                        of the Transporter."""
            if alert_data.alert_section in ["VTS"] and alert_data.bu in ["TAS"]:
                template_value = getattr(TemplateMapping, "SODSHOWCAUSENOTICE", None)
            template = template_value.value if template_value else ""
            interlock_value = getattr(InterlockTemplateMapping, template.upper(), None)
            body = await cls.vts_read_template(interlock_value.value) if interlock_value else ""
            body = Template(body).render(**template_data)
            pdf_filename = f"{alert_data.id}_unsigned_scn.pdf"
            pdf_path = await cls.generate_pdf_from_html(body, pdf_filename)
            status, minio_path = minio_connector.upload_to_minio(alert_data.bu, alert_data.alert_section, alert_data.unique_id, pdf_path)
            if status:
                query = f"""select * from notices_vts where alert_id='{alert_data.id}'"""
                notices_data = await hpcl_ceg_model.NoticesVTS.get_aggr_data(query, limit=0)
                if notices_data.get("data", []):
                    notices_data = notices_data['data'][0]
                    notice_history = notices_data.get('notices',[])
                    notices_respose = {
                        "doc_type": "Show Cause Notice UnSigned",
                        "uploaded_date": urdhva_base.utilities.get_present_time().replace(tzinfo=None).isoformat(),
                        "uploaded_by": rpt.get("employee_id",""),
                        "file_path": minio_path,
                        "uploaded_name": rpt.get("first_name",""),
                        "report_type": "Show Cause Notice UnSigned"
                    }
                    notice_history.append(notices_respose)
                    await hpcl_ceg_model.NoticesVTS(**{"id": notices_data['id']}).modify()
                else:
                    notices_respose = {
                        "doc_type": "Show Cause Notice UnSigned",
                        "uploaded_date": urdhva_base.utilities.get_present_time().replace(tzinfo=None).isoformat(),
                        "uploaded_by": "Novex",
                        "file_path": minio_path,
                        "uploaded_name": "Novex",
                        "report_type": "System Generated"
                    }
                    notices_resp = {
                        "alert_id": str(alert_data.id),
                        "alert_type": alert_data.interlock_name,
                        "notices": [notices_respose]
                    }
                    await hpcl_ceg_model.NoticesVTSCreate(**notices_resp).create()

                return {
                    "message": "File uploaded and encrypted successfully",
                    "original_file_path": minio_path,
                    "encrypted_file_key": minio_path
                }
            else:
                return {
                        "message": "File uploaded Failed Minio",
                        "original_file_path": minio_path,
                        "encrypted_file_key": minio_path
                    }
        except Exception as e:
            traceback.print_exc()
            return {
                "message": "Error while generating show cause notice",
                "error": str(e)
            }

    @classmethod
    async def generate_pdf_from_html(cls, html_content: str, output_filename: str):
        pdf_path = os.path.join("/tmp", output_filename)
        HTML(string=html_content).write_pdf(pdf_path)
        return pdf_path
        

    @classmethod
    async def accept_close(cls, input_data, alert_data):
        """
                Function to Accept and Close an alert
                :param input_data:
                :param alert_data:
                :return:
                """
        if alert_data.alert_section in ['VTS'] and alert_data.bu in ['TAS']:
            await cls.generate_show_cause_notice(alert_data)
        return await cls.publish_to_camunda(input_data, alert_data, "AcceptClose")

    @classmethod
    async def invalid_alert(cls, input_data, alert_data):
        """
                Function to Accept and Close an alert
                :param input_data:
                :param alert_data:
                :return:
                """
        return await cls.publish_to_camunda(input_data, alert_data, "Invalid")

    @classmethod
    async def valid_alert(cls, input_data, alert_data):
        """
                Function to Accept and Close an alert
                :param input_data:
                :param alert_data:
                :return:
                """
        return await cls.publish_to_camunda(input_data, alert_data, "Valid")

    @classmethod
    async def false_alert(cls, input_data, alert_data):
        """
                Function to Accept and Close an alert
                :param input_data:
                :param alert_data:
                :return:
                """
        if alert_data.alert_section == "VA":
            await hpcl_ceg_model.Alerts(**{"id": input_data['alert_id'], "mark_as_false": True}).modify()
        return await cls.publish_to_camunda(input_data, alert_data, "FalseAlert")
    
    @classmethod
    async def tripped_alert(cls, input_data, alert_data):
        """
        Function to R4 Swipe an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "Tripped")

    @classmethod
    async def vts_alert(cls, input_data, alert_data):
        """
        Function to VTS an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "VTS")

    @classmethod
    async def block_alert(cls, input_data, alert_data):
        """
        Function to VTS an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "Blocked")

    @classmethod
    async def unblock_alert(cls, input_data, alert_data):
        """
        Function to VTS an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "UnBlocked")

    @classmethod
    async def interrupt_alert(cls, input_data, alert_data):
        """
        Function to VTS an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "Interrupt")

    @classmethod
    async def request_alert(cls, input_data, alert_data):
        """
        Function to VTS an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "Request")
    
    @classmethod
    async def send_it_back(cls, input_data, alert_data):
        """
        Function to justify an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "SendItBack")
    
    @classmethod
    async def false_violation(cls, input_data, alert_data):
        """
        Function to justify an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "FalseViolation")
    
    @classmethod
    async def accept_violation(cls, input_data, alert_data):
        """
        Function to justify an alert
        :param input_data:
        :param alert_data:
        :return:
        """
        return await cls.publish_to_camunda(input_data, alert_data, "AcceptViolation")