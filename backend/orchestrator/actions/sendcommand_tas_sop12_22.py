import urdhva_base
import traceback
import hpcl_ceg_model
# from constants import *
# import send_tas_rq_message
from utilities.bu_key_mapping import tasSopcommands
import orchestrator.alerting.alert_manager as alert_manager

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class SendcommandTasSop1222:
    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the SendcommandTasSop1222 action.
        
        This asynchronous function specifies the variables needed to perform the action, 
        which in this case, are the alert_id and interrupt variables.
        
        Returns:
            list: A list containing two strings, "alert_id" and "interrupt".
        """
        return ["alert_id", "interrupt"]

    async def sendcommand_tas(self, params):
        """
        Sends a command to the TAS (Terminal Automation System) based on the parameters passed in 'params'.

        Args:
            params (dict): A dictionary containing 'alert_id' and 'interuptName'.

        Returns:
            tuple: A tuple containing a boolean indicating success, and a dictionary with the key "sendcommand".
        """
        try:
            alert_id = params.get("alert_id")
            interuptName = params.get("interrupt")

            if not alert_id or not interuptName:
                raise ValueError("Required parameters 'alert_id' and 'interrupt' are missing.")

            logger.info('SENDING COMMAND TO TAS FOR alert_id:%s' % alert_id)
            alert_data = await hpcl_ceg_model.Alerts.get(alert_id)

            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__
            sap_id = alert_data['sap_id']
            sop_id = alert_data['sop_id']
            deviceName = alert_data['device_name'].replace(" ", "")
            loadingPointId = (deviceName.split("@")[0]).split("LP")[1]
            if len(loadingPointId) == 1:
                loadingPointId = "0" + loadingPointId

            alert_data["event_tags"] = {}
            interuptName = interuptName.lower()
            if interuptName == "terminateloading":
                messageBody = {"tagsData": {tasSopcommands[sop_id].replace("ID", loadingPointId): 1}}
                # await send_tas_rq_message.sendTASRQMessage(sap_id, messageBody)
                print("Recieved input for tripping the loading point %s" % str(sap_id))
                alert_data['alert_id'] = alert_id
                alert_data["event_tags"]['is_tripped'] = True
                alert_data["action_msg"] = "Tripped"
                alert_data["action_type"] = "Tripped"
                await alert_manager.AlertAction().update_alert_data(input_data=alert_data)
                # data_object = hpcl_ceg_model.Alerts(**alert_data)
                # await data_object.modify()

            elif interuptName == "unterminateloading":
                print("Recieved input for untripping the loading point %s" % str(sap_id))
                messageBody = {"tagsData": {tasSopcommands[sop_id].replace("ID", loadingPointId): 0}}
                # await send_tas_rq_message.sendTASRQMessage(sap_id, messageBody)
                alert_data['alert_id'] = alert_id
                alert_data["event_tags"]['is_tripped'] = True
                alert_data["action_msg"] = "Tripped"
                alert_data["action_type"] = "Tripped"
                await alert_manager.AlertAction().update_alert_data(input_data=alert_data)
                # alert_data['isTripped'] = False
                # data_object = hpcl_ceg_model.Alerts(**alert_data)
                # await data_object.modify()
            else:
                print("Unknown interrupt came")

            return True, {"sendcommand": True}

        except Exception as e:
            print("Traceback %s" % traceback.format_exc())
            logger.error("Exception Occured While Sending Command for alert %s ", alert_id)
            return False, {"sendcommand": False}
