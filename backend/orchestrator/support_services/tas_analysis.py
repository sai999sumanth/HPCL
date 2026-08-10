import urdhva_base
import requests
import asyncio
import traceback
import pandas as pd
import charts_actions
import hpcl_ceg_model
import dashboard_studio_model
import utilities.helpers as helpers

class Tas_Analysis:
    
    async def process_tas_resp(self,tas_resp):
        """
        Processes a Pandas DataFrame containing TAS records from the database.

        Args:
            tas_resp (pd.DataFrame): A Pandas DataFrame containing TAS records from the database.

        This method iterates over the rows in the DataFrame and for each row, it
        fetches the list of TAS alerts currently present in the database.
        It then deletes the open instances in Camunda that do not exist in the database,
        and marks the open instances in the database as deleted.
        """
        for idx,record in tas_resp.iterrows():
            query = (f"sap_id='{record['sap_id']}' and bu='{record['bu']}' and interlock_name='{record['interlock_name']}' "
                     f"and external_id='{record['external_id']}' and device_id='{record['device_id']}' and bu='TAS' "
                     f"and device_name='{record['device_name']}' and alert_section='TAS'")
            tas_data = await hpcl_ceg_model.Alerts.get_all(urdhva_base.queryparams.QueryParams(q=query),
                                                           resp_type='plain')
            deleting_ids=[]
            closed_ids=[]
            count=0
            tas_data = list(reversed(tas_data['data']))
            for rec in tas_data:
                if not closed_ids and count == len(tas_data) - 1:
                    closed_ids.append(rec["id"])
                    continue
                elif rec["alert_status"]=="Close":
                    if not closed_ids:
                        closed_ids.append(rec["id"])
                    else:
                        deleting_ids.append(rec["id"])
                else:
                    deleting_ids.append(rec["id"])
                count+=1
            print("deleting_ids: ", deleting_ids)
            print("closed_ids: ", closed_ids)
            deleting_idss = ", ".join(f"'{id}'" for id in deleting_ids)
            if deleting_idss:
                query = (f"""delete from alerts """
                        f"where id in ({deleting_idss}) and "
                        f"alert_section = 'TAS'")
                dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 1
                dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
                function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
                resp = await function(query=query)

    async def duplicates_removal(self):
        """
        Removes duplicate alerts from the database.

        This method fetches the list of duplicate alerts from the database,
        and then calls `process_tas_resp` to delete the open instances in Camunda
        that do not exist in the database, and marks the open instances in the
        database as deleted.

        """
        try:
            query = (f"""select bu, sap_id, sop_id, interlock_name, device_id, external_id, device_name, COUNT(*) AS duplicate_count from alerts """
                    f"where bu = 'TAS' and "
                    f"alert_section = 'TAS' "
                    f"GROUP BY bu, sap_id, sop_id, interlock_name, device_id, external_id, device_name "
                    f"HAVING COUNT(*)>1")
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 1
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
            resp = await function(query=query)
            tas_resp = pd.DataFrame(resp)
            await self.process_tas_resp(tas_resp)
        except Exception as e:
            print("Exception Occured While Removing Alerts")
            print(e)
            print("Traceback %s" % traceback.format_exc())

if __name__ == "__main__":
    tas = Tas_Analysis()
    asyncio.run(tas.duplicates_removal())