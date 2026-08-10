import urdhva_base
import json
import traceback
import utilities.helpers as helpers
import orchestrator.alerting.alert_helper as alert_helper
import orchestrator.alerting.alert_factory as alert_factory

logger = urdhva_base.logger.Logger.getInstance("lpg_alert_processing")


class LPGAlertManager(alert_factory.AlertFactory):
    @classmethod
    async def create_bu_alert(cls, alert_data, camunda_url=urdhva_base.settings.camunda_url):
        """
        Create a business unit level alert

        Parameters:
            alert_data (dict): A dictionary containing the data to create the alert
                - bu (str): Business unit
                - sapid (str): SAP ID
                - sopid (str): SOP ID
                - staticalert_data (dict): Additional static data to be stored in the alert document
                - deviceId (str): Device ID
                - interlockName (str): Interlock name
                - severity (str): Severity of the alert
                - message (str): Alert message
                - alertHistory (list): List of alert history messages
            camunda_url:

        Returns:
            dict: A dictionary containing the status, message and the created alert document
        """
        try:
            logger.info(f"alert_data received to create alert {alert_data}")
            # Retrieve necessary fields from the alert_data
            status, loc_dt = await alert_helper.get_location_details(bu=alert_data['BU'],sap_id=alert_data['sapid'])
            if status:
                alert_data['location_data'] = loc_dt
            return await cls.create_alert(alert_data,camunda_url)

        except Exception as e:
            logger.error(e)
            print(traceback.format_exc())
            print("error -> ", e)
            return {"status": False, "message": str(e), "alert_data": None}

    @classmethod
    async def close_bu_alert(cls, alert_data):
        """
        Close a BU level alert.

        Parameters:
            alert_data (dict): A dictionary containing the data to close the alert
                - bu (str): Business unit
                - sap_id (str): SAP ID
                - sop_id (str): SOP ID
                - alert_id (str): Unique alert ID

        Returns:
            dict: A dictionary containing the status, message and the closed alert document
        """        
        try:
            logger.info(f"Alert data received to close alert: {alert_data}")
            return await cls.close_alert(alert_data)
            
        except Exception as e:
            raise Exception(status_code=500, detail="Error closing alert.") from e
