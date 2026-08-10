import urdhva_base
import os
import json
import asyncio
import traceback
import hpcl_ceg_model
import uuid
from datetime import datetime, timedelta, timezone
import tas_duplicate_alert_check as duplicates_check
from orchestrator.alerting.alert_manager import close_alert, read_template
from orchestrator.notification_manager.notify_email import NotifyEMail
from orchestrator.alerting.alert_factory import AlertFactory

async def check_master_status():
    """
    This function checks for alerts related to master status and creates alerts if certain conditions are met.
    It queries the master_status table for specific active server names and checks the status count.  
    If the status count is exactly 30, it creates an alert with relevant details.
    
    Scenarios handled:
    1. Create alert only once for every 30-day cycle per active_server_name
    2. Reset count if active_server_name changes mid-cycle
    3. Log switchover events 
    """ 
    try:
        # Calculate the date range for the last 30 days
        today = datetime.now()
        past_30_days = today - timedelta(days=30)
        past_30_days_str = past_30_days.strftime("%Y-%m-%d")
        today_str = today.strftime("%Y-%m-%d")
        
        # Query to get status count for each sap_id and active_server_name combination
        query = f"""
                SELECT active_server_name, sap_id, location_name, COUNT(*) as status_count,
                       MIN(created_at) as first_occurrence_date,
                       MAX(created_at) as last_occurrence_date
                FROM master_status
                WHERE status = '1'
                AND created_at::DATE BETWEEN '{past_30_days_str}' AND '{today_str}'
                AND active_server_name IN ('LRCA', 'LRCB')
                GROUP BY active_server_name, sap_id, location_name
                ORDER BY sap_id, first_occurrence_date
             """
        
        # Execute the query
        try:
            resp = await hpcl_ceg_model.Alerts.get_aggr_data(query)
        except Exception as e:
            print(f"Error executing query: {e}")
            return
        
        # Check if resp contains data
        if not resp.get("data", []):
            print("No data found for master status check")
            return
        
        # Process the response
        for record in resp.get("data", []):
            active_server_name = record.get("active_server_name") 
            if not active_server_name:
                print(f"Active server name is missing in the record: {record}")
                continue
                
            sap_id = record.get("sap_id", "")
            status_count = record.get("status_count", 0)
            first_occurrence_date = record.get("first_occurrence_date")
            
            # Scenario 3: Check for switchover and handle count reset
            switchover_occurred = await handle_switchover_detection(sap_id, active_server_name)
            
            # If switchover occurred, recalculate the count from switchover date
            if switchover_occurred:
                print(f"Switchover detected for sap_id: {sap_id}. Recalculating count from switchover date.")
                # Get the actual count from when this server became active
                adjusted_record = await get_count_from_switchover_date(sap_id, active_server_name, past_30_days_str, today_str)
                if adjusted_record:
                    record = adjusted_record
                    status_count = record.get("status_count", 0)
                    first_occurrence_date = record.get("first_occurrence_date")
                    print(f"Adjusted count for {active_server_name}: {status_count} days from switchover date")
            
            # Scenario 1: Check if we already created an alert for this continuous period
            # to avoid duplicate alerts for overlapping windows
            if await is_alert_already_created_for_cycle(sap_id, active_server_name, first_occurrence_date):
                print(f"Alert already created for this continuous period for sap_id: {sap_id}, server: {active_server_name}")
                continue
            
            # Additional check: Verify this is actually a continuous period with enough days
            if not await is_continuous_period_check(sap_id, active_server_name, past_30_days_str, today_str, status_count):
                print(f"Not meeting continuous period requirements for sap_id: {sap_id}, server: {active_server_name}")
                continue
            
            # Send email notifications for status_count 25-29
            if 2 <= status_count <= 3:
                await send_notification_email(record, sap_id)
            
            # Scenario 1: Check if the status count is exactly 30 and create alert 
            if status_count == 5:
                await create_master_status_alert(record, active_server_name, sap_id)
                
    except Exception as e:
        print(f"Error in check_master_status: {traceback.format_exc()}")


async def handle_switchover_detection(sap_id, current_active_server):
    """
    Scenario 3: Detect LRC switchover events and return whether switchover occurred
    Note: Alert closing functionality has been removed as per requirement
    """
    try:
        switchover_query = f"""
            SELECT id, device_name AS previous_device_name, external_id,id
            FROM alerts
            WHERE interlock_name = 'LRC Master Switchover required in 30 days'
            AND sap_id = '{sap_id}' 
            AND alert_status = 'Open'
            AND device_name IN ('LRCA', 'LRCB')
            AND device_name != '{current_active_server}'
        """
        
        switchover_resp = await hpcl_ceg_model.Alerts.get_aggr_data(switchover_query)
        
        if switchover_resp.get("data", []):
            for switchover_record in switchover_resp.get("data", []):
                id_data = switchover_record.get("id")
                alert_id = switchover_record.get("external_id")
                previous_device_name = switchover_record.get("previous_device_name")
                
                if alert_id and previous_device_name in ['LRCA', 'LRCB']:
                    # Log the switchover event 

                    close_data = {
                        "id":id_data,    
                        "device_name": previous_device_name,
                        "alert_id": alert_id,
                        "alert_status": "Close",
                        "bu" : "TAS",
                        "interlock_name": "LRC Master Switchover required in 30 days",
                        "sap_id": sap_id,
                        "sop_id": "SOP022",
                        "alert_type": "TAS"

                    }

                    # Update the alert status to closed
                    try:
                        success = await close_alert(close_data)
                        if success:
                            print(f"Closed alert {alert_id} due to switchover from {previous_device_name} to {current_active_server}")
                        else:
                            print(f"Failed to close alert {alert_id}")
                    except Exception as e:
                        print(f"Error closing switchover alert {alert_id}: {e}")
                    return True  # Switchover occurred
        else:
            print(f"No previous alerts found for switchover detection for sap_id: {sap_id}")
            
        return False  # No switchover detected
            
    except Exception as e:
        print(f"Error in handle_switchover_detection: {e}")
        return False


async def get_count_from_switchover_date(sap_id, active_server_name, past_30_days_str, today_str):
    """
    Get the actual count from when the current server became active (switchover date)
    This ensures we count only from the switchover point, not the full 30 days
    """
    try:
        # First, find when this server last became active by looking at the sequence of changes
        # We need to find the most recent date when this server started being the active one
        
        # Get all records for this sap_id ordered by date to find switchover points
        switchover_detection_query = f"""
            WITH server_changes AS (
                SELECT 
                    active_server_name,
                    created_at,
                    LAG(active_server_name) OVER (ORDER BY created_at) as prev_server
                FROM master_status 
                WHERE sap_id = '{sap_id}'
                AND created_at::DATE BETWEEN '{past_30_days_str}' AND '{today_str}'
                AND active_server_name IN ('LRCA', 'LRCB')
                ORDER BY created_at
            )
            SELECT MIN(created_at) as switchover_date
            FROM server_changes
            WHERE active_server_name = '{active_server_name}'
            AND (prev_server != '{active_server_name}' OR prev_server IS NULL)
            AND created_at >= (
                SELECT MAX(created_at) 
                FROM server_changes 
                WHERE active_server_name != '{active_server_name}'
            )
        """
        
        switchover_resp = await hpcl_ceg_model.Alerts.get_aggr_data(switchover_detection_query)
        
        if not switchover_resp.get("data") or not switchover_resp["data"][0].get("switchover_date"):
            print(f"Could not determine switchover date for {active_server_name}, using original count")
            return None
            
        switchover_date = switchover_resp["data"][0]["switchover_date"]
        switchover_date_str = switchover_date.strftime("%Y-%m-%d") if isinstance(switchover_date, datetime) else switchover_date[:10]
        
        # Now get the count from switchover date to today
        adjusted_query = f"""
            SELECT active_server_name, sap_id, location_name, COUNT(*) as status_count,
                   MIN(created_at) as first_occurrence_date,
                   MAX(created_at) as last_occurrence_date
            FROM master_status
            WHERE status = '1'
            AND created_at::DATE BETWEEN '{switchover_date_str}' AND '{today_str}'
            AND active_server_name = '{active_server_name}'
            AND sap_id = '{sap_id}'
            GROUP BY active_server_name, sap_id, location_name
        """
        
        adjusted_resp = await hpcl_ceg_model.Alerts.get_aggr_data(adjusted_query)
        
        if adjusted_resp.get("data"):
            adjusted_record = adjusted_resp["data"][0]
            print(f"Count adjusted from switchover date {switchover_date_str}: {adjusted_record.get('status_count')} days")
            return adjusted_record
        else:
            print(f"No data found from switchover date {switchover_date_str}")
            return None
            
    except Exception as e:
        print(f"Error getting count from switchover date: {e}")
        return None


async def is_continuous_period_check(sap_id, active_server_name, start_date, end_date, status_count):
    """
    Verify that we have the required continuous days of status=1 for the given server
    This prevents creating alerts for periods with gaps or interruptions
    """
    try:
    
        required_days = status_count
        
        # Check if we have continuous days without gaps
        continuous_check_query = f"""
            WITH recent_days AS (
                SELECT generate_series(
                    CURRENT_DATE - INTERVAL '{required_days - 1} days', 
                    CURRENT_DATE, 
                    '1 day'::interval
                )::date as check_date
            ),
            status_days AS (
                SELECT DISTINCT created_at::date as status_date
                FROM master_status
                WHERE sap_id = '{sap_id}'
                AND active_server_name = '{active_server_name}'
                AND status = '1'
                AND created_at::date >= CURRENT_DATE - INTERVAL '{required_days - 1} days'
            )
            SELECT 
                COUNT(rd.check_date) as total_days,
                COUNT(sd.status_date) as status_days,
                CASE 
                    WHEN COUNT(sd.status_date) = {required_days}
                    THEN true 
                    ELSE false 
                END as is_continuous
            FROM recent_days rd
            LEFT JOIN status_days sd ON rd.check_date = sd.status_date
        """        
        continuous_resp = await hpcl_ceg_model.Alerts.get_aggr_data(continuous_check_query)
        
        if continuous_resp.get("data"):
            result = continuous_resp["data"][0]
            is_continuous = result.get("is_continuous", False)
            actual_status_days = result.get("status_days", 0)
            
            print(f"Continuity check for {active_server_name}: {actual_status_days}/{required_days} days with status=1, continuous: {is_continuous}")
            return is_continuous and actual_status_days == required_days
        
        return False
        
    except Exception as e:
        print(f"Error checking continuous period: {e}")
        return False


async def is_alert_already_created_for_cycle(sap_id, active_server_name, first_occurrence_date):
    """
    Scenario 1: Check if an alert was already created for this continuous status period
    This prevents duplicate alerts for overlapping 5-day windows in the same continuous period
    """
    try:
        # Get the most recent alert for this sap_id and server
        recent_alert_query = f"""
            SELECT created_at, external_id
            FROM alerts
            WHERE interlock_name = 'LRC Master Switchover required in 5 days'
            AND sap_id = '{sap_id}'
            AND device_name = '{active_server_name}'
            AND alert_status IN ('Open', 'Close')
            ORDER BY created_at DESC
        """
        
        recent_alert_resp = await hpcl_ceg_model.Alerts.get_aggr_data(recent_alert_query)
        
        if not recent_alert_resp.get("data"):
            return False  # No previous alert found
            
        last_alert_date = recent_alert_resp["data"][0]["created_at"]
        
        # Convert dates to datetime objects for comparison
        if isinstance(last_alert_date, str):
            last_alert_datetime = datetime.strptime(last_alert_date, "%Y-%m-%d %H:%M:%S")
        else:
            last_alert_datetime = last_alert_date
            
        if isinstance(first_occurrence_date, str):
            current_cycle_start = datetime.strptime(first_occurrence_date, "%Y-%m-%d %H:%M:%S")
        else:
            current_cycle_start = first_occurrence_date
        
        # Check if there's been a break in the continuous status period
        # If the gap between last alert and current cycle start is more than a few days,
        # it means the status was reset and this is a new continuous period
        days_gap = (current_cycle_start - last_alert_datetime).days
        
       
        
        # If the gap is less than 30 days, we consider it a continuation of the same period
        if days_gap >=30:  
            print(f"Alert already exists for continuous period. Last alert: {last_alert_date}, Current cycle start: {first_occurrence_date}")
            return True
        
        # If there's a significant gap, this is a new continuous period
        return False
        
    except Exception as e:
        print(f"Error checking existing alerts for cycle: {e}")
        return False


async def send_notification_email(record, sap_id):
    """
    Send notification emails for status_count between 25-29 with relevant details
    """
    try:
        recipients = []
        roles = ["Safety Officer SOD", "Maintenance Officer SOD", "Planning Officer SOD"]
        
        for role in roles:
            email_query = f"""
                SELECT email
                FROM users
                WHERE 'TAS' = ANY (bu) 
                AND '{sap_id}' = ANY (sap_id) 
                AND '{role}' = ANY(novex_role)
            """
            
            try:
                mail_resp = await hpcl_ceg_model.Users.get_aggr_data(email_query)
                if mail_resp.get("data"):
                    recipients.extend([m.get("email") for m in mail_resp["data"] if m.get("email")])
            except Exception as e:
                print(f"Error executing email query for role {role}: {e}")
                continue
        
        if recipients:
            recipients = list(set(recipients))  # Remove duplicates
            record["interlock_name"] = "LRC Master Switchover required"
            
            notify_email = NotifyEMail()
            resp = await notify_email.publish_message(**{
                'recipients': recipients,
                'subject': f"LRC Master Switch Over Notification - {record.get('status_count')} days",
                'body': read_template("/opt/ceg/algo/orchestrator/notification_templates/lrc_switchover.html", data=record),
                'html_content': True,
                'force_send': True
            })
            
            print(f"Notification email sent for sap_id: {sap_id}, status_count: {record.get('status_count')}")
        else:
            print(f"No email addresses found for sap_id: {sap_id}")
            
    except Exception as e:
        print(f"Error sending notification email: {e}")


async def create_master_status_alert(record, active_server_name, sap_id):
    """
    Create alert when status_count reaches exactly 30
    """
    try:
        # Initialize alert history
        alert_history = record.get("alert_history", [])
        if not isinstance(alert_history, list):
            alert_history = []

        # Set allocated_time and processed_time
        allocated_time = (
            alert_history[-1]["processed_time"]
            if alert_history and "processed_time" in alert_history[-1]
            else datetime.now(timezone.utc).isoformat()
        )
        processed_time = datetime.now(timezone.utc).isoformat()

        # Append new entry to alert history
        alert_history.append({
            "allocated_time": allocated_time,
            "processed_time": processed_time,
            "action_type": "Message",
            "action_msg": "Alert due to Analog Input",
        })
        
        alert_data = {
            "interlock_name": "LRC Master Switchover required in 30 days",
            "device_name": active_server_name,
            "sop_id": "SOP022",
            "sap_id": sap_id,
            "bu": "TAS",
            "device_type": "",
            "severity": "Medium",
            "alert_id": str(uuid.uuid1()),
            "alert_type": "TAS",
            "alert_history": alert_history
        }
        
        # Check for duplicates
        is_duplicate = await duplicates_check.duplicate_check(alert_data)
        if is_duplicate:
            print(f"Duplicate alert found for Master Status Check on device {active_server_name}. Skipping alert creation.")
            return
        
        # Create the alert
        success, msg = await AlertFactory.create_alert(alert_data)
        if success:
            print(f"Master status check alert created successfully for {active_server_name} with 5 days status.")
        else:
            print(f"Failed to create master status check alert for {active_server_name}: {msg}")
            
    except Exception as e:
        print(f"Error creating master status alert: {e}")

if __name__ == "__main__":
    # Run the check_master_status function
    asyncio.run(check_master_status())