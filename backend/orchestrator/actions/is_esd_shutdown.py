import urdhva_base
import json
import traceback
import hpcl_ceg_model

class IsEsdShutdown:
    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the action.

        Returns:
            list: A list of strings representing the required variables.
        """
        return ["alert_id"]
        
    async def isESDShutdown(self, params):
        """
        Checks if the percentage of ESDs (Emergency Shutdown Devices) associated with a given
        alert is greater than 15%. If so, sets esdshutdown to True, else False.

        Args:
            params (dict): A dictionary containing the alert_id

        Returns:
            tuple: A tuple containing a boolean indicating success and a dictionary
            with the key "esdshutdown" set to the value of esdshutdown
        """
        alertid = ''
        esdshutdown = True  # Default to True in case of failure
        try:
            alertid = params.get("alert_id")
            aldata = await hpcl_ceg_model.Alerts.get(alertid)
            sapid = aldata.get('sap_id', '0')
            
            query = f"(BU = 'TAS' AND sap_id = '{sapid}' AND deviceType = 'ESD') OR status = 'closed'"
            params = urdhva_base.queryparams.QueryParams()
            params.q = query
            resp = int(await hpcl_ceg_model.Alerts.count(params))

            lquery = f"BU = 'TAS' AND sap_id = '{sapid}'"
            params.q = lquery
            lresp = await hpcl_ceg_model.LocationMaster.get_all(params)
            
            if not lresp.get('data') or len(lresp['data']) == 0:
                raise ValueError("No data found in LocationMaster response.")
            
            data = lresp['data'][0]
            totalesdcount = int(data.get('ESD', 0))
            
            if totalesdcount == 0:
                raise ValueError("Total ESD count is zero, cannot calculate percentage.")
            
            percent = (resp / totalesdcount) * 100
            print('TOTAL:%s CURRENT:%s PERCENTAGE:%s' % (totalesdcount, resp, percent))
            esdshutdown = percent > 15

            aldata['alert_id'] = alertid
            aldata["action_msg"] = "ESD Shutdown"
            aldata["action_type"] = "ESDShutdown"
            await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)

        except Exception as e:
            print(f"Exception Occurred While Sending isESDShutdown for alert {alertid}: {e}")
            print(f"Traceback: {traceback.format_exc()}")
        return True, {"esdshutdown": esdshutdown}
