import urdhva_base
import traceback
# import ThingsBoardApi
import hpcl_ceg_model

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class CheckTankStatus:
    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the CheckRoTime action.
        
        Returns:
            list: A list containing a single string, "alert_id".
        """
        return ["alert_id", "location_device_id", "sap_id"]

    async def checkTankStatus(self, params):
        """
        Checks the status of a tank alert for a given alert ID.

        This asynchronous function takes an alert_id, device_id, and sap_id as parameters.
        It then uses the provided sap_id to instantiate a ThingsBoardApi.TB object, and
        calls the checkTankHLevel method of this object, passing in the device_id. If the
        tank status is down, the function sets tankhstatus and pumpStatus to True. If an
        exception occurs during the retrieval of the tank status, it catches the error,
        sets tankhstatus and pumpStatus to True, logs the error, and returns a tuple containing
        True and a dictionary with the key "shutdownReady" set to the value of tankhstatus,
        and the key "shutdownPump" set to the value of pumpStatus.

        Args:
            alert_id (str): The ID of the alert to check.
            device_id (str): The ID of the device to check.
            sap_id (str): The ID of the SAP for the device.

        Returns:
            tuple: A tuple containing a boolean indicating success, and a dictionary with the key "shutdownReady"
            set to the value of tankhstatus, and the key "shutdownPump" set to the value of pumpStatus.
        """
        try:
            alertid = params.get("alert_id")
            print("CHECK TANK STATUS ALERTID:%s" % alertid)
            deviceid = params.get('location_device_id')
            sapId = params.get('sap_id')
            # tb = ThingsBoardApi.TB('tas', sapId)
            # tankhstatus, pumpStatus = tb.checkTankHLevel(deviceid)
        except:
            tankhstatus, pumpStatus = True, True
        print(traceback.format_exc())
        return True, {"shutdownReady": True, "shutdownPump": True}
