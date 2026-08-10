import urdhva_base
import json
import asyncio
import requests
import traceback
import hpcl_ceg_model


logger = urdhva_base.logger.Logger.getInstance("workflow_process_log")


class Camunda:
    def __init__(self):
        self.camunda_url = urdhva_base.settings.camunda_url
        self.headers = {"Content-Type": "application/json"}

    async def start_workflow(self, payload, workflowId, camunda_url=urdhva_base.settings.camunda_url):
        """
        Initiates a workflow using the specified payload and process key.

        :param payload: Dictionary containing the data to be sent to the workflow engine.
        :param workflowId: String representing the process definition key to start.
        :param camunda_url: String representing the camunda connection.
        :return: JSON response from the workflow engine.
        If the request is successful (status code 200), the response is returned as JSON.
        If there is an exception during the request (e.g., network error, timeout, etc.),
        an error message is printed and None is returned
        """
        if camunda_url:
            self.camunda_url = camunda_url
        url = f" {self.camunda_url}/engine-rest/process-definition/key/{workflowId}/start"
        MAX_RETRIES = 5
        RETRY_DELAY = 10

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = requests.post(url, data=json.dumps(payload), headers=self.headers)
                if response.status_code // 100 == 2:
                    logger.info(response.json())
                    print(response.json())
                    await self.update_alerts_with_instance_id(payload['variables']['alert_id']['value'], response.json().get("id"))
                    return response.json()
                logger.error(f"Attempt {attempt} - Error while starting workflow: {response.status_code}")
            except requests.exceptions.RequestException as e:
                logger.error(f"Attempt {attempt} - Error while starting workflow: {e}")
                print(traceback.format_exc())
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY)

    async def closeWorkflow(self, payload, workflowId, camunda_url=urdhva_base.settings.camunda_url):
        if camunda_url:
            self.camunda_url = camunda_url
        url = f" {self.camunda_url}/engine-rest/message"

        try:
            response = requests.post(url, data=json.dumps(payload), headers=self.headers, verify=False)
            response.raise_for_status()
            print(response.json())
            logger.info(response.json())
            print("InterLock Ok Successfully Sent to : " + str(workflowId))
        
        except requests.exceptions.RequestException as e:
            print(f"Error closing workflow: {e}")
            logger.error(f"Error closing workflow: {e}")
            print(traceback.format_exc())

    async def update_alerts_with_instance_id(self, alert_id, instance_id):
        alert_data = await hpcl_ceg_model.Alerts.get(alert_id)
        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__
        
        if "_sa_instance_state" in alert_data.keys():
            del alert_data["_sa_instance_state"]

        alert_data['workflow_instance_id'] = instance_id
        await hpcl_ceg_model.Alerts(**alert_data).modify()
        
    
    async def start_tas_faulty_workflow(self, payload, workflowId, camunda_url=urdhva_base.settings.tas_faulty_camunda_url):
        """
        Initiates a workflow using the specified payload and process key.
        :param payload: Dictionary containing the data to be sent to the workflow engine.
        :param workflowId: String representing the process definition key to start.
        :param camunda_url: String representing the camunda connection.
        :return: JSON response from the workflow engine.
        If the request is successful (status code 200), the response is returned as JSON.
        If there is an exception during the request (e.g., network error, timeout, etc.),
        an error message is printed and None is returned
        """
        if camunda_url:
            self.camunda_url = camunda_url
        url = f" {self.camunda_url}/engine-rest/process-definition/key/{workflowId}/start"
        MAX_RETRIES = 5
        RETRY_DELAY = 10

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = requests.post(url, data=json.dumps(payload), headers=self.headers)
                if response.status_code // 100 == 2:
                    logger.info(response.json())
                    print(response.json())
                    return response.json()
                logger.error(f"Attempt {attempt} - Error while starting workflow: {response.status_code}")
            except requests.exceptions.RequestException as e:
                logger.error(f"Attempt {attempt} - Error while starting workflow: {e}")
                print(traceback.format_exc())
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY)


    async def start_workflow_vts(self, payload, workflowId, camunda_url=urdhva_base.settings.camunda_url):
        """
        Initiates a workflow using the specified payload and process key.

        :param payload: Dictionary containing the data to be sent to the workflow engine.
        :param workflowId: String representing the process definition key to start.
        :param camunda_url: String representing the camunda connection.
        :return: JSON response from the workflow engine.
        If the request is successful (status code 200), the response is returned as JSON.
        If there is an exception during the request (e.g., network error, timeout, etc.),
        an error message is printed and None is returned
        """
        if camunda_url:
            self.camunda_url = camunda_url
        url = f" {self.camunda_url}/engine-rest/process-definition/key/{workflowId}/start"
        MAX_RETRIES = 5
        RETRY_DELAY = 10

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = requests.post(url, data=json.dumps(payload), headers=self.headers)
                if response.status_code // 100 == 2:
                    logger.info(response.json())
                    print(response.json())
                    await self.update_alerts_with_instance_id_vts(payload['variables']['alert_id']['value'], response.json().get("id"))
                    return response.json()
                logger.error(f"Attempt {attempt} - Error while starting workflow: {response.status_code}")
            except requests.exceptions.RequestException as e:
                logger.error(f"Attempt {attempt} - Error while starting workflow: {e}")
                print(traceback.format_exc())
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY)
    
    async def update_alerts_with_instance_id_vts(self, alert_id, instance_id):
        violation_data = await hpcl_ceg_model.ViolationHistoryVts.get(alert_id)
        if not isinstance(violation_data, dict):
            violation_data = violation_data.__dict__
        
        if "_sa_instance_state" in violation_data.keys():
            del violation_data["_sa_instance_state"]

        violation_data['workflow_instance_id'] = instance_id
        await hpcl_ceg_model.ViolationHistoryVts(**violation_data).modify()
