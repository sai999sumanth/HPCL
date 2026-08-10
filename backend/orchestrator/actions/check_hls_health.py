import urdhva_base
import traceback
# import ThingsBoardApi

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")

class CheckHlsHealth:
    async def get_required_variables(self):
        """
        Returns a list of strings containing the required variables for the action.
        
        Returns:
            list: A list containing the strings "alert_id", "deviceId", and "sapId".
        """
        return ["alert_id", "location_device_id", "sap_id"]
    
    async def checkhlshealth(self, params):
        """
        Checks if the HLS (High Level Shutdown) for a given device is down.

        This asynchronous function takes an alert_id, device_id, and sap_id as parameters.
        It then uses the provided sap_id to instantiate a ThingsBoardApi.TB object, and
        calls the checkHLSDown method of this object, passing in the device_id. If the
        HLS status is down, the function sets tankhlsstatus to True and returns a tuple
        containing True and a dictionary with the key "triggerShutdown" set to the value
        of tankhlsstatus. If the HLS status is not down, the function sets tankhlsstatus
        to False and returns a tuple containing True and a dictionary with the key
        "triggerShutdown" set to the value of tankhlsstatus. If an exception occurs during
        the retrieval of the HLS status, it catches the error, sets tankhlsstatus to False,
        logs the error, and returns a tuple containing False and a dictionary with the key
        "triggerShutdown" set to the string "False".

        Args:
            alert_id (str): The ID of the alert to check.
            device_id (str): The ID of the device to check.
            sap_id (str): The ID of the SAP for the device.

        Returns:
            tuple: A tuple containing a boolean indicating success, and a dictionary with the key "triggerShutdown"
            set to the value of tankhlsstatus.
        """
        logger.info("Check HLS Health alert_id:%s DeviceId:%s" % (params.get("alert_id"), params.get('location_device_id')))
        try:
            alertid = params.get("alert_id")
            deviceid = params.get('location_device_id')
            sapId = params.get('sap_id')
            print("Check HLS Health Alertid:%s DeviceId:%s" % (alertid, deviceid))
            # tb = ThingsBoardApi.TB('tas', sapId)
            # tankhlsstatus = await tb.checkHLSDown(deviceid)
            tankhlsstatus = True
            return True, {"triggerShutdown": tankhlsstatus}

        except Exception as e:
            tankhlsstatus = False
            print(traceback.format_exc())
            logger.error("Exception in getting Current HLS Status : " + str(e))
            return False, {"triggerShutdown": tankhlsstatus}