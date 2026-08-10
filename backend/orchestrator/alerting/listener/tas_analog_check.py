import urdhva_base
import os
import json
import asyncio
import traceback
import hpcl_ceg_model
import uuid
from datetime import datetime, timedelta, timezone
import tas_duplicate_alert_check as duplicates_check
from orchestrator.alerting.alert_manager import create_alert
from orchestrator.alerting.alert_factory import AlertFactory


# Define a mapping of interlock names
INTERLOCK_NAME_MAPPING = {
    "BCU K- Factor Change": "K Factor BCU Permissive Off_Fail",
    "BCU Local Loading": "Local Loading BCU Permissive Off_Fail",
    "MFM factor Change": "MFM Factor BCU Permissive Off_Fail"
}


async def tas_bcu_analog():
    """
    This function checks for alerts related to BCU analog interlocks and creates alerts if certain conditions are met.
    It monitors specific interlock names and checks for the number of occurrences in the current week.
    If the number of occurrences exceeds a threshold, it creates an alert with relevant details.
    
    Args:
        None
    Returns:
        None
    """
    try:
        # Interlock names to monitor
        interlock_names = ["BCU K- Factor Change", "BCU Local Loading", "MFM factor Change"]
        
        # Calculate the start of the current week (Monday)
        today = datetime.now()
        start_of_week = (today - timedelta(days=today.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        start_of_week_str = start_of_week.strftime("%Y-%m-%d")
        end_of_week = start_of_week + timedelta(days=6, hours=23, minutes=59, seconds=59)
        end_of_week_str = end_of_week.strftime("%Y-%m-%d %H:%M:%S")
        
        # Loop through each interlock name
        for interlock_name in interlock_names:
            # Query to get the count of alerts for each device_name for the interlock in the current week
            query1 = f"""
                SELECT device_name, sap_id, COUNT(*) as alert_count
                FROM alerts
                WHERE interlock_name = '{interlock_name}'
                AND created_at BETWEEN '{start_of_week_str}' AND '{end_of_week_str}'
                GROUP BY device_name, sap_id
            """
           
            try:
                resp1 = await hpcl_ceg_model.Alerts.get_aggr_data(query1)
            except Exception as e:
                print(f"Error executing query: {e}")
                continue
            # Check if resp1 contains data
            if not resp1.get("data", []):
                print(f"No data found for interlock: {interlock_name}")
                continue
            
            # Process the response
            for record in resp1.get("data", []):
                device_name = record.get("device_name")
                if not device_name:
                    print(f"Device name is missing in the record: {record}")
                    continue
                sap_id = record.get("sap_id", "")
                alert_count = record.get("alert_count", 0)
                
                # Trigger alert only when exactly 3 occurrences are found in the week
                if alert_count > 2:
                    # Map the interlock name if it exists in the mapping
                    mapped_interlock_name = INTERLOCK_NAME_MAPPING.get(interlock_name, interlock_name)
                    # Create alert data
                    query2 = f"""
                        SELECT severity, device_type, bu
                        FROM alerts
                        WHERE interlock_name = '{interlock_name}'
                        AND device_name = '{device_name}'
                        ORDER BY created_at DESC
                    """
                    
                    resp2 = await hpcl_ceg_model.Alerts.get_aggr_data(query2)
                    if resp2.get("data", []):
                       severity = resp2["data"][0].get("severity", "")
                       bu = resp2["data"][0].get("bu", "")
                       device_type = resp2["data"][0].get("device_type", "")
                    
                    alert_data = {
                        "interlock_name": mapped_interlock_name,
                        "device_name": device_name,
                        "sop_id": "SOP028A",
                        "sap_id": sap_id,
                        "bu": bu,
                        "device_type": device_type,
                        "severity": severity,
                        "alert_id": str(uuid.uuid1()),
                        "alert_type": "TAS"     
                    }
                    
                    # Check for duplicates
                    is_duplicate = await duplicates_check.duplicate_check(alert_data)
                    if is_duplicate:
                        print(f"Duplicate alert found for {interlock_name} on device {device_name}. Skipping alert creation.")
                        continue
                    
                    # Check alert history
                    alert_history = await duplicates_check.alert_history_check(alert_data, month_check=True)
                    if alert_history:
                        print(f"Alert history exists for {interlock_name} on device {device_name}. Skipping alert creation.")
                        continue
                    # Create the alert
                    success, msg = await create_alert(alert_data)
                    if success:
                        print(f"Weekly summary alert created successfully for {interlock_name} on device {device_name}.")
                    else:
                        print(f"Failed to create weekly summary alert for {interlock_name} on device {device_name}: {msg}")
    except Exception as e:
        print(f"Error in tas_bcu_analog: {traceback.format_exc()}")
        

async def check_bayreassignment():
    """
    This function checks for alerts related to Bay reassignment and creates alerts if certain conditions are met.
    It processes day-end data for all sap_id values and checks if the alert count exceeds 5% of the total count.
    If the condition is met, it creates an alert with relevant details.
    """
    try:
        # Step 1: Query the alerts table to get the day-end count of alerts for each sap_id
        query1 = f"""
            SELECT sap_id, COUNT(*) AS alert_count
            FROM alerts
            WHERE interlock_name = 'Bay reassignment'
            AND DATE(created_at) = CURRENT_DATE
            GROUP BY sap_id
        """
    
        try:
            resp1 = await hpcl_ceg_model.Alerts.get_aggr_data(query1)
        except Exception as e:
            print(f"Error executing query1: {e}")
            return

        
        # Check if resp1 contains data
        if not resp1.get("data", []):
            print("No data found for Bay reassignment check")
            return

        # Step 2: Process the response for each sap_id
        for record in resp1.get("data", []):
        
            sap_id = record.get("sap_id")
            alert_count = record.get("alert_count", 0)

            if not sap_id or alert_count == 0:
                print(f"Invalid data for sap_id: {sap_id}, alert_count: {alert_count}")
                continue

            
            # Query the host_manual_fan_printed table to get the day-end total count for the same sap_id
            query2 = f"""
                SELECT  total_count
                FROM host_manual_fan_printed
                WHERE sap_id = '{sap_id}'
                AND DATE(created_at) = CURRENT_DATE
            """
            try:
                resp2 = await hpcl_ceg_model.Alerts.get_aggr_data(query2)
            except Exception as e:
                print(f"Error executing query2: {e}")
                continue
            
            # Check if resp2 contains data
            if not resp2.get("data", []):
                print(f"No total count data found for sap_id: {sap_id}")
                continue

            # Get the total_count from the response
            total_count = resp2.get("data", [])[0].get("total_count", 0)

            if total_count == 0:
                print(f"Invalid total_count for sap_id: {sap_id}")
                continue
            
            # Calculate the threshold (5% of the total_count)
            fan_printed = total_count * 0.05

            # Check if the alert_count exceeds the threshold
            
            if   alert_count > fan_printed:
                
                # Create the alert
                # Initialize or extract alert history
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
                    "action_msg": "Alert due to Analog input",
                    })

                alert_data = {
                    "interlock_name": "Manual FAN printed more than 5% of total TT loaded",
                    "device_name": "",
                    "sop_id": "SOP063",
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
                    print(f"Duplicate alert found for Bay Reassignment on sap_id {sap_id}. Skipping alert creation.")
                    continue

                # Create the alert
                success, msg = await AlertFactory.create_alert(alert_data)
                if success:
                    print(f"Bay reassignment alert created successfully for sap_id {sap_id}.")
                else:
                    print(f"Failed to create Bay reassignment alert for sap_id {sap_id}: {msg}")
    except Exception as e:
        print(f"Error in check_bayreassignment: {traceback.format_exc()}")


if __name__ == "__main__":
    asyncio.run(check_bayreassignment())