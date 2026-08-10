import urdhva_base
import pytz
import json
import requests
from requests.auth import HTTPBasicAuth
import asyncio
import datetime
import hpcl_ceg_model
import orchestrator.alerting.alert_manager as alert_manager

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class SendSapCommand:

    async def get_required_variables(self):
        return ["alert_id", "interrupt", "vehicle"]
    
    async def sendsapcommand(self, params):
        print("params --->", params)
        IST = pytz.timezone('Asia/Kolkata')
        currtime = datetime.datetime.now(IST).strftime('%d-%m-%Y %H:%M:%S')
        interuptName = params.get('interrupt')
        isvehicle = params.get('vehicle')
        processcodemap = {'RO': '1', 'TAS': '2', 'VTS': '3', 'TAS_vehicle': '3', 'LPG_vehicle': '4'}

        alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id'))

        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__
        
        flag = 'B'
        if interuptName.lower() == 'unblock':
            flag = 'U'
        alert_message=''
        alert_history=[]
        if alert_data:
            print("SAP",alert_data)
            if flag=='B':
                alert_message = (
                                f"IMS Response :success,Status :Blocked, Remarks : Updatted successfuklly" 
                            )
                alert_data["action_msg"] = alert_message
                alert_data["action_type"] = "SentToSap"
            else:
                print("Failed")
                alert_message = (
                                f"IMS Response :success,Status :Unb lock, Remarks : Updatted successfuklly" 
                            )
                alert_data["action_msg"] = alert_message
                alert_data["action_type"] = "SentToSap"  # Replace with an appropriate value
                #alert_data["alert_status"]: "Open"  # Replace with the correct alert status
            print("alert_data",alert_data)
            await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
            return True, {"sapcommandsent": True}
        else:
            return False, {"sapcommandsent": False}
        
 