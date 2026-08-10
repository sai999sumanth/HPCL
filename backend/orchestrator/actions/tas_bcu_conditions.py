import urdhva_base
import hpcl_ceg_model
from datetime import datetime
logger = urdhva_base.logger.Logger.getInstance("workflow_process-log")

class BCUAlertConditions:
    def __init__(self):
        self.alert_data = None
    
    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the action.

        Returns:
            list: A list of strings representing the required variables.
        """
        return [
            "alert_id", "BU", "interlock_name", "interlock_id", "messagetype",
            "msg_subject", "mqofrole", "location_type", "device_id", "device_name", "va_level",
            "rolemailto", "alert_id", "escalationlevel_inmail", "sap_id", "escalationtime_inmail"
        ]

    async def is_in_justification_check(self, params):
        try:
            date_check = datetime.now().strftime("%Y-%m-%d")
            query = (
                        f"""bu = 'TAS' and """
                        f"""sap_id = '{params.get('sap_id', '')}' and """
                        f"""alert_section = 'TAS' and """
                        f"""device_id = '{params.get('device_id', '')}' and """
                        f"""device_name = '{params.get('device_name', '')}' and """
                        f"""interlock_name = '{params.get('interlock_name', '')}' and """
                        f"""DATE(created_at) = '{date_check}' and """
                        f"""alert_message = 'command_sent' """
                    )
            logger.info("query : %s", query)
            params = urdhva_base.queryparams.QueryParams(q=query)
            resp = await hpcl_ceg_model.Alerts.get_all(params,resp_type='plain')
            if resp["data"]:
                return True
            return False
        except Exception as e:
            print("Exception in is_in_justification_check :", str(e))
            return False

    async def alert_history_check(self, params):
        try:
            print("-"*50)
            logger.info("params :", params)
            print("-"*50)
            date_check = datetime.now().strftime("%Y-%m-%d")
            if params.get("month_check"):
                month = datetime.now().strftime("%Y-%b")
                query = (
                    f"""bu = 'TAS' and """
                    f"""sap_id = '{params.get('sap_id', '')}' and """
                    f"""alert_section = 'TAS' and """
                    f"""device_id = '{params.get('device_id', '')}' and """
                    f"""device_name = '{params.get('device_name', '')}' and """
                    f"""interlock_name = '{params.get('interlock_name', '')}' and """
                    f"""TO_CHAR(created_at, 'YYYY-Mon') = '{month}' and alert_status='Close'"""
                )
            else:
                query = (
                    f"""bu = 'TAS' and """
                    f"""sap_id = '{params.get('sap_id', '')}' and """
                    f"""alert_section = 'TAS' and """
                    f"""device_id = '{params.get('device_id', '')}' and """
                    f"""device_name = '{params.get('device_name', '')}' and """
                    f"""interlock_name = '{params.get('interlock_name', '')}' and """
                    f"""DATE(created_at) = '{date_check}' and alert_status='Close' """
                )
            logger.info("query : %s", query)
            params = urdhva_base.queryparams.QueryParams(q=query)
            resp = await hpcl_ceg_model.Alerts.get_all(params,resp_type='plain')
            print("-"*50)
            if resp["data"]:
                return True, {"alert_status": "historic"}
            # elif await self.is_in_justification_check(params):
            #     return True, {"alert_status": "historic"}
            else:
                return True, {"alert_status": "new"}
        except Exception as e:
            logger.error("Exception :", str(e))
            return False