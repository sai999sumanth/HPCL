import urdhva_base
import requests
import asyncio
import traceback
import pandas as pd
import charts_actions
import dashboard_studio_model

class Workflows_Deletion:

    async def get_camunda_urls(self,alert_section):
        """
        Retrieves a list of Camunda URLs based on the provided alert section.

        Args:
            alert_section (str): The alert section for which Camunda URLs are to be retrieved.

        Returns:
            list: A list of URLs corresponding to the specified alert section.
        """
        urls = []
        if alert_section in ["RO"]:
            camunda_config = urdhva_base.settings.camunda_url_config
            for key, services in camunda_config.items():
                url = f"http://{services['host']}:{services['port']}"
                urls.append(url)
        return urls
    
    async def get_running_instances_in_urls(self,camunda_urls):
        """
        Fetches running instances from multiple Camunda URLs.

        Args:
            camunda_urls (list): A list of Camunda URLs to fetch running instances from.

        Returns:
            dict: A dictionary of business keys mapped to their respective instance IDs and URLs.
        """
        instance_map = []
        for camunda_url in camunda_urls:
            url = f"{camunda_url}/engine-rest/process-instance"
            try:
                response = requests.get(url)
                response.raise_for_status()
                instances = response.json()

                # Overwrite previous businessKey entries with the latest from the last URL processed
                for instance in instances:
                    if "businessKey" in instance and instance["businessKey"]:
                        instance_id = instance["id"]
                        variables_url = f"{camunda_url}/engine-rest/process-instance/{instance_id}/variables"
                        variables_response = requests.get(variables_url)
                        variables_response.raise_for_status()
                        variables = variables_response.json()
                        alert_id = variables.get("alert_id", {}).get("value", None)
                        #print("variablees--->",variables)
                        instance_map.append(int(alert_id))
            except requests.exceptions.RequestException as e:
                print(f"Error fetching running instances: {e}")
        return instance_map

    async def delete_running_instances(self, present_alert_ids_in_db, alert_section):
        """
        Deletes running instances from Camunda that are not present in the database.

        Args:
            present_workflow_ids_in_db (list): A list of workflow IDs currently present in the database.
            alert_section (str): The alert section determining which set of Camunda URLs to query.

        This method retrieves running instances from Camunda URLs associated with the given alert section.
        It compares these instances against the provided list of workflow IDs from the database and deletes
        the instances in Camunda that do not exist in the database.
        """
        business_keys = []
        camunda_urls=[]
        present_keys=[]
        camunda_urls = await self.get_camunda_urls(alert_section)
        camunda_urls = list(set(camunda_urls))
        print("camuda_urls--->",camunda_urls)
        runnig_instances_in_urls = await self.get_running_instances_in_urls(camunda_urls)
        for alert_id in present_alert_ids_in_db:
            if alert_id not in runnig_instances_in_urls:
                business_keys.append(alert_id)
            else:
                present_keys.append(alert_id)
        print("length of business_keys--->",len(business_keys))
        print("length of present_keys--->",len(present_keys))
        business_keys = ", ".join(f"'{id}'" for id in business_keys)
        if business_keys:
            query = f"""UPDATE alerts
                            SET 
                                alert_status = 'Close',
                                alert_state = 'Resolved',
                                indent_status in ('Cancelled', 'TempClosed', 'ProductLowLevel', 'OfflineOrFalseAlarm', 'NotAvailable'),
                                progress_rate = 3
                            WHERE
                                id in ({business_keys}) 
                                AND alert_section = 'RO'
                                AND alert_status != 'Close'
                                AND interlock_name = 'Dry Out Each Indent Wise MainFlow'
                                AND created_at::DATE!=CURRENT_DATE"""
            #dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 1
            #dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            #function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
            #resp = await function(query=query)
            #resp = pd.DataFrame(resp)
            #resp.to_csv("/opt/ceg/algo/running_instance.csv", index=False)

    async def process_workflow_resp(self, workflow_resp):
        """
        Processes a Pandas DataFrame containing workflow records from the database.

        Args:
            workflow_resp (pd.DataFrame): A Pandas DataFrame containing workflow records from the database.

        This method iterates over the rows in the DataFrame and for each row, it
        fetches the list of workflow IDs currently present in the database.
        It then deletes the running instances in Camunda that do not exist in the database.
        """
        for idx,record in workflow_resp.iterrows():
            if record["alert_section"] in ["RO"]:
                query = (f"select * from alerts where alert_section='RO' and alert_status!='Close' and interlock_name='Dry Out Each Indent Wise MainFlow'")
                dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 1
                dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
                function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
                resp = await function(query=query)
                data_resp = pd.DataFrame(resp)
                present_alert_ids_in_db = data_resp["id"].tolist()
                await self.delete_running_instances(present_alert_ids_in_db, record["alert_section"])

    async def instance_removal(self):
        """
        Removes workflow instances that are not present in the database.

        This method fetches distinct alert sections from the alerts table where the alert status is not 'Close'.
        It then processes each workflow response to identify and remove running instances in Camunda that do not
        exist in the database. If no records are found in the alerts table, a message is printed indicating so.

        Exceptions are caught and printed, including tracebacks for debugging purposes.
        """

        try:
            query = "SELECT DISTINCT(alert_section) FROM alerts"
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 1
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
            resp = await function(query=query)

            workflow_resp = pd.DataFrame(resp)

            if not workflow_resp.empty:
                await self.process_workflow_resp(workflow_resp)
            else:
                print("No records found in alerts.")

        except Exception as e:
            print("Exception Occurred While Removing Instances")
            print(e)
            print("Traceback:", traceback.format_exc())

if __name__ == "__main__":
    Workflow = Workflows_Deletion()
    asyncio.run(Workflow.instance_removal())