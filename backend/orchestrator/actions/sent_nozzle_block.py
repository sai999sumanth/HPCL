import urdhva_base
import pytz
import datetime
import hpcl_ceg_model
import hpcl_ceg_enum
import orchestrator.alerting.alert_manager as alert_manager
import orchestrator.alerting.ro_interlock_handler as ro_interlock_handler

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class SendNozzleCommand:

    async def get_required_variables(self):
        return ["alert_id", "interrupt", "BU"]
    
    async def sendnozzlecommand(self, params):
        print("params --->", params)

        alert_data = await hpcl_ceg_model.Alerts.get(params.get('alert_id'))
        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__

        if "_sa_instance_state" in alert_data.keys():
            del alert_data["_sa_instance_state"]

        if urdhva_base.context.context.exists():
            rpt = urdhva_base.context.context.get('rpt', {})
        else:
            rpt = {}

        if params.get("interrupt").lower() == 'block':         
            # Blocking in IMS blockingFlag="Y"
            blocking_status = None
            blocking_status,error_msg = await ro_interlock_handler.RoInterlockHandler().ro_blocking([alert_data.get('sap_id','')])
            success_resp, failed_resp = error_msg
            if (
                blocking_status 
                and isinstance(failed_resp,list) 
                and failed_resp
                and failed_resp[0].get(alert_data.get('sap_id','')) in ['Outlet Not Communicating']
                ):
                alert_message = (
                    f"Outlet Not Communicating"
                )
                alert_data["action_msg"] = alert_message
                alert_data["action_type"] = "Offline"
                await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                await hpcl_ceg_model.Alerts(**{"id": alert_data["id"],
                                               "block_status": None,
                                               "ro_offline": True}).modify()
                return True, {"blocked": False, "offline": True}
            elif not blocking_status:
                alert_message = (
                    f"Failed to Block the Outlet {alert_data.get('location_name', '')}, status: Failed, RO: {alert_data.get('sap_id', '')}"
                )
                if failed_resp:
                    alert_message += f"{failed_resp}"
                alert_data["action_msg"] = alert_message
                alert_data["action_type"] = "BlockFailed"
                await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                await hpcl_ceg_model.Alerts(**{"id": alert_data["id"],
                                               "ro_offline": False,
                                               "block_status": None}).modify()
                return True, {"blocked": False, "offline": False}
            elif blocking_status:    
                alert_message = (
                    f"Succefully Blocked Outlet {alert_data.get('location_name', '')}, status: Block, RO: {alert_data.get('sap_id', '')} details are sent successfully to CRIS to block the Outlet"
                )
                alert_data["action_msg"] = alert_message
                alert_data["action_type"] = "Blocked"
                await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                await hpcl_ceg_model.Alerts(**{"id": alert_data["id"],
                                            "ro_offline": False,
                                            "block_status": hpcl_ceg_enum.BlockStatus.Blocked}).modify()
                return True, {"blocked": True}

        if params.get("interrupt").lower() == 'unblock':
            # UnBlocking in IMS blockingFlag="N"
            unblocking_status = None
            closure_reason = "PICTURE_UPLOADED" if alert_data.get("image_uploaded") else "DNC_UNBLOCKED"
            unblocking_status,error_msg = await ro_interlock_handler.RoInterlockHandler().ro_unblocking([alert_data.get('sap_id','')])
            success_resp, failed_resp = error_msg
            if (
                unblocking_status 
                and isinstance(failed_resp,list) 
                and failed_resp
                and failed_resp[0].get(alert_data.get('sap_id','')) in ['Outlet Not Communicating']
                ):
                alert_message = (
                    f"Outlet Not Communicating"
                )
                alert_data["action_msg"] = alert_message
                alert_data["action_type"] = "Offline"
                await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                await hpcl_ceg_model.Alerts(**{"id": alert_data["id"],
                                               "block_status": hpcl_ceg_enum.BlockStatus.UnBlocked,
                                               "alert_closure_reason": "UNBLOCK_NO_CONNECTIVITY",
                                               "ro_offline": True}).modify()
                return True, {"unblocked": True}
            elif not unblocking_status:
                alert_message = (
                    f"Failed to Unblock the Outlet {alert_data.get('location_name', '')}, status: Failed, RO: {alert_data.get('sap_id', '')}"
                    )
                alert_data["action_msg"] = alert_message
                alert_data["action_type"] = "UnblockFailed"
                await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                return True, {"unblocked": False, "offline": False}
            elif unblocking_status: 
                alert_message = (
                    f"Successfully Unblocked Outlet {alert_data.get('location_name', '')}, status: Unblock, RO: {alert_data.get('sap_id', '')} details are sent successfully to CRIS to unblock the Outlet "
                )
                alert_data["action_msg"] = alert_message
                alert_data["action_type"] = "UnBlocked"
                await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)
                await hpcl_ceg_model.Alerts(**{"id": alert_data["id"],
                                            "ro_offline": False,
                                            "alert_closure_reason": closure_reason,
                                            "block_status": hpcl_ceg_enum.BlockStatus.UnBlocked}).modify()
                return True, {"unblocked": True}
            
        return False, {"sapcommandsent": False}
