import urdhva_base
import traceback
import hpcl_ceg_model
import utilities.helpers as helpers
import orchestrator.alerting.tas_alert as tas_alert


logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")

class CheckBCUAlert:
    async def get_required_variables(self):
        return ["BU", "sap_id", "sop_id", "alert_id", "interlock_name", "tas_device_name"]

    async def bcu_alert_check(self, params):
        try:
            interlock = params.get("interlock_name")
            tas_device_name = params.get("tas_device_name")

            # # Check only if this is the Gantry Permissive Off_ACK alert
            # if interlock == "Gantry Permissive Off_ACK from TAS":
            #     query_params = urdhva_base.queryparams.QueryParams(
            #         q=f"""bu = '{params.get("BU")}' and sap_id = '{params.get("sap_id")}' 
            #         and sop_id = '{params.get("sop_id")}' and alert_status = 'Open' 
            #         and interlock_name = 'BCU Permissive Off_Fail'""")
            #     bcu_alert = await hpcl_ceg_model.Alerts.get_all(query_params, resp_type='plain')

            #     if bcu_alert['data']:
            #         params = {
            #             "bu": params.get("BU"),
            #             "sap_id": params.get("sap_id"),
            #             "sop_id": params.get("sop_id"),
            #             "alert_id": bcu_alert["data"][0]["external_id"],
            #             "interlock_name": "BCU Permissive Off_Fail"
            #         }

            #         # Close BCU Permissive Off_Fail alert first
            #         await tas_alert.TASAlertManager().close_bu_alert({**params})

            return True, {"message": "BCU alert check completed and Closing Gantry Permissive Off_ACK alert"}

        except Exception as e:
            print(traceback.format_exc())
            logger.error(f"Error processing alert: {traceback.format_exc()}")
            return None