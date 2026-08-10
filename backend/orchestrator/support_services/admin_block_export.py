import urdhva_base
import hpcl_ceg_model
import orchestrator.alerting.alert_factory as alert_factory
import asyncio
import utilities.helpers as helpers
import orchestrator.alerting.alert_helper as alert_helper
from datetime import datetime

async def get_vts_manual_blocked():
    query = "blocking_status='blocked'"
    manual_blocked = await hpcl_ceg_model.VtsManualBlocked.get_all(
        urdhva_base.queryparams.QueryParams(q=query), resp_type='plain'
    )
    if not manual_blocked.get('data'):
        return []
    return manual_blocked['data']

async def get_vts_manual_unblocked():
    query = "blocking_status='unblocked'"
    manual_unblocked = await hpcl_ceg_model.VtsManualBlocked.get_all(
        urdhva_base.queryparams.QueryParams(q=query), resp_type='plain'
    )
    if not manual_unblocked.get('data'):
        return []
    return manual_unblocked['data']

async def create_vts_manual_block():
    manual_block_data = await get_vts_manual_blocked()
    results = []
    
    for rec in manual_block_data:
        vehicle_number = rec.get('truck_number', '')
        bu = rec.get('bu', '')
        
        # Check if truck is already blocked
        query = (f"vehicle_unblocked_date is null and alert_section='VTS' "
                f"and bu='{bu}' and vehicle_number='{vehicle_number}'")
        
        alert_data = await hpcl_ceg_model.Alerts.get_all(
            urdhva_base.queryparams.QueryParams(q=query), resp_type='plain'
        )
        
        if alert_data.get('data') and len(alert_data['data']) > 0:
            results.append({
                "vehicle": vehicle_number,
                "status": "skipped",
                "reason": "Truck is already blocked in alerts"
            })
            continue
        
        # Get location data
        location_data = await get_truck_location_data(vehicle_number)
        if not location_data:
            location_data = {}
        
        location_name = location_data.get('name', '')
        zone = location_data.get('zone', '') 
        sap_id = location_data.get('sap_id', '') 
        region = location_data.get('region', '') 
        transporter_code = location_data.get('transporter_code', '')
        end_date = rec.get('blocking_to')
        
        totalWaitTime = await check_timer_to_unblock(end_date)
        
        alert_history = [{
            "action_msg": f"Truck '{vehicle_number}' blocked manually by '{rec.get('blocked_by', '')}' from '{rec.get('blocking_from')}' to '{rec.get('blocking_to')}'",
            "action_type": "Blocked",
            "action_by": rec.get('blocked_by', '')
        }]
        
        alert_payload = {
            "vehicle_number": vehicle_number,
            "bu": bu,
            "severity": "High",
            "sop_id": "SOP009B",
            "alert_history": alert_history,
            "vehicle_blocked_start_date": rec.get('blocking_from', ''),
            "vehicle_blocked_end_date": end_date,
            "alert_section": "VTS",
            "interlock_name": "Itdg Admin Blocked",
            "transporter_code": transporter_code,
            "sap_id": sap_id,
            "violation_type": rec.get('remarks', ''),
            "waitTime": totalWaitTime,
            "location_name": location_name,
            "zone": zone,
            "region": region,
            "auto_unblock": "true"
        }
        
        cls =  alert_factory.AlertFactory()
        camunda_url = await helpers.get_alert_camunda_url(bu,sap_id,alert_section='VTS')
        await cls.create_alert(alert_payload, camunda_url)
    
    
    return {"status": "processed for block", "results": results}

async def create_vts_manual_unblocked():
    manual_unblock_data = await get_vts_manual_unblocked()
    results = []
    
    for rec in manual_unblock_data:
        vehicle_number = rec.get('truck_number', '')
        bu = rec.get('bu', '')
        
        # Check if there's an unblock
        query = (f"vehicle_unblocked_date is not null and alert_section='VTS' "
                f"and bu='{bu}' and vehicle_number='{vehicle_number}' and interlock_name = 'Itdg Admin Blocked'")
        
        alert_data = await hpcl_ceg_model.Alerts.get_all(
            urdhva_base.queryparams.QueryParams(q=query), resp_type='plain'
        )
        
        if  alert_data.get('data') and len(alert_data['data']) > 0:
            results.append({
                "vehicle": vehicle_number,
                "status": "skipped",
                "reason": "No active unblocked alert found"
            })
            continue
        
        # Get location data
        location_data = await get_truck_location_data(vehicle_number)
        if not location_data:
            results.append({
                "vehicle": vehicle_number,
                "status": "error",
                "reason": "Location data not found"
            })
            continue
            
        location_name = location_data.get('name', '')
        zone = location_data.get('zone', '')
        sap_id = location_data.get('sap_id', '')
        region = location_data.get('region', '')
        transporter_code = location_data.get('transporter_code', '')
        
        alert_history = [{
            "action_msg": f"Truck '{vehicle_number}' blocked manually by '{rec.get('blocked_by', 'admin')}' from '{rec.get('blocking_from', '')}' to '{rec.get('blocking_to', '')}'",
            "action_type": "Blocked",
            "action_by": rec.get('blocked_by', 'admin'),
        }, {
            "action_msg": f"Truck '{vehicle_number}' unblocked manually by '{rec.get('unblocked_by', 'admin')}' at '{rec.get('unblocked_date', '')}'",
            "action_type": "UnBlocked",
            "action_by": rec.get('unblocked_by', 'admin')
        }]
        
        unique_id = await alert_helper.get_alert_unique_id(bu, sap_id, sop_id="SOP009B")
        alert_payload = {
            "sop_id": "SOP009B",
            "interlock_name": "Itdg Admin Blocked",
            "severity": "High",
            "alert_status": "Close",
            "alert_state": "Resolved",
            "unique_id": unique_id,
            "location_name": location_name,
            "sap_id": sap_id,
            "bu": bu,
            "zone": zone,
            "region": region,
            "alert_section": "VTS",
            "vehicle_number": vehicle_number,
            "alert_history": alert_history,
            "transporter_code": transporter_code,
            "vehicle_blocked_start_date": rec.get('blocking_from'),
            "vehicle_blocked_end_date": rec.get('blocking_to'),
            "mark_as_false": True,
            "violation_type": str(rec.get('remarks', '')),
            "vehicle_unblocked_date": rec.get('unblocked_date'),
            # Explicitly set array fields to empty lists to avoid "" default
            "raw_data": {},
            "last_sms_to": [],
            "last_mailed_to": [],
            "last_escalated_to": [],
            "last_notified_to": [],
            "assigned_users": [],
            "assigned_user_roles": [],
            "vts_alert_history_ids": []
        }
        
        await hpcl_ceg_model.AlertsCreate(**alert_payload).create()
    return {"status": "processed for unblock"}

async def get_truck_location_data(truck_number):
    transporter_code = ""
    sap_id = None

    query = f"select * from vts_truck_master where truck_no='{truck_number}'"
    res = await urdhva_base.BasePostgresModel.get_aggr_data(query)
    
    if res.get("data"):
        row = res["data"][0]
        sap_id = row.get("sap_id")
        transporter_code = row.get("transporter_code", "")
    else:
        res = await hpcl_ceg_model.VtsAlertHistory.get_all(
            urdhva_base.queryparams.QueryParams(q=f"tl_number='{truck_number}'", limit=1),
            resp_type="plain"
        )
        if not res.get("data"):
            return None

        row = res["data"][0]
        sap_id = row.get("sap_id")
        transporter_code = row.get("vendor_id", "")

    if not sap_id:
        return None

    query =f"select * from location_master where sap_id='{sap_id}'"
    loc = await urdhva_base.BasePostgresModel.get_aggr_data(query)
    location = loc["data"][0] if loc.get("data") else {"name": "", "zone": "", "region": ""}
    location["sap_id"] = sap_id
    location["transporter_code"] = transporter_code

    return location


async def check_timer_to_unblock(end_date):
    now = urdhva_base.utilities.get_present_time()
    
    if end_date <= now:
        return "PT1M"
    
    total_wait_time_minutes = int((end_date - now).total_seconds() / 60)
    totalWaitTime = f"PT{total_wait_time_minutes}M"
    
    return totalWaitTime

async def process():
    try:
        block_resp = await create_vts_manual_block()
        unblock_resp = await create_vts_manual_unblocked()
        print(block_resp)
        print(unblock_resp)
        
    except Exception as e:
        return {
            "error": str(e),
            "status": "failed"
        }

if __name__ == "__main__":
    result = asyncio.run(process())
    print(result)

