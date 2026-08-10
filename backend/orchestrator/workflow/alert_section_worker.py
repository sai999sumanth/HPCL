import urdhva_base
import sys
import asyncio
import importlib
import traceback
import orchestrator
from functools import partial
from concurrent.futures import ThreadPoolExecutor
import utilities.connection_mapping as connection_mapping
from orchestrator.alerting.listener.dry_out_listener import *
from camunda.external_task.external_task import ExternalTask, TaskResult
from camunda.external_task.external_task_worker import ExternalTaskWorker

logger = urdhva_base.logger.Logger.getInstance("workflow_process-log")
CAMUNDA_URL = ''


async def get_alert_section_wise_camunda_url(alert_section):
    """

    Args:
        alert_section:

    Returns:

    """
    camunda_url_dict = urdhva_base.settings.camunda_configuration
    camunda_url_list = []
    for bu, alert_section_url in camunda_url_dict.items():
        for dict_url in alert_section_url:
            if dict_url.get('alert_section') == alert_section:
                camunda_url_list.append(dict_url['url'])
    return list(set(camunda_url_list))


async def algo_external_task(task: ExternalTask) -> TaskResult:
    """
    This function is the entry point for all the external tasks.
    It takes an ExternalTask object as argument and calls the corresponding function
    from the orchestrator.actions module based on the module_name, class_name and function_name variables
    passed in the task variables.
    It also handles the failure scenario and returns the appropriate task result.
    """
    global CAMUNDA_URL
    variables = task.get_variables()
    # print("variables --> ", variables)
    module_name = variables.pop('module_name', None)
    class_name = variables.pop('class_name', None)
    function_name = variables.pop('function_name', None)
    try:
        module = importlib.import_module(f"orchestrator.actions.{module_name}")
        class_instance = getattr(module, class_name)()
        req_variables = await class_instance.get_required_variables()
        function = getattr(class_instance, function_name)
        # print("req_variables --> ", req_variables)
        # print("variables --> ", variables)
        params = {key: variables.get(key, None) for key in req_variables}
        params['CAMUNDA_URL'] = CAMUNDA_URL
        status, data = await function(**{"params": params})
        # print("status: ", status)
        # print("data: ", data)
        if status:
            if data:
                return task.complete(global_variables=data)
            else:
                return task.complete({})
        if not status:
            logger.error(f"Task failed: {data}")
            return task.failure(
                error_message="task failed", error_details=data, max_retries=3, retry_timeout=5000
            )

    except Exception as e:
        logger.error(f"Task failed: {e}")
        logger.error(traceback.format_exc())
        return task.failure(error_message=str(e), error_details=str(e), max_retries=3, retry_timeout=5000)


# Wrapper function to run async functions synchronously
def run_async_function(async_func, task):
    """
    Runs an asynchronous function synchronously.

    Args:
        async_func: An asynchronous function to be executed.
        task: The task to be passed as an argument to the asynchronous function.

    Returns:
        The result of executing the asynchronous function.
    """
    return asyncio.run(async_func(task))


async def process_topic(alert_section, topic, worker_id):
    """
    Processes a single Camunda topic using an ExternalTaskWorker.
    """
    # conn = connection_mapping.camunda_listener_mapping[camunda_connector_name]
    camunda_url_list = await get_alert_section_wise_camunda_url(alert_section)
    for conn in camunda_url_list:
        # engine_local_base_url = f"http://{conn['host']}:{conn['port']}/engine-rest"
        engine_local_base_url = f"{conn}/engine-rest"

        # Create the ExternalTaskWorker
        etw = ExternalTaskWorker(
            worker_id=worker_id,
            base_url=engine_local_base_url,
            config=urdhva_base.settings.camunda_default_config,
        )

        # Subscribe to the topic
        print(f"Worker {worker_id} subscribing to topic: {topic}")
        await etw.subscribe(topic, lambda task: run_async_function(algo_external_task, task))


async def main(alert_section):
    """
    Main entry point of the workflow manager.

    This function sets up an ExternalTaskWorker and subscribes to the 'workflow_consumer' topic.
    It then runs the algo_external_task function for each incoming task in a separate thread.
    """
    # engine_local_base_url = f"{urdhva_base.settings.camunda_url}/engine-rest"
    global CAMUNDA_URL
    loop = asyncio.get_event_loop()
    executor = ThreadPoolExecutor(max_workers=200)  # Adjust the number of workers as needed
    tasks = []

    # conn = connection_mapping.camunda_listener_mapping[camunda_connector_name]
    camunda_url_list = await get_alert_section_wise_camunda_url(alert_section)
    for conn in camunda_url_list:
        task_id = 1
        engine_local_base_url = f"{conn}/engine-rest"
        CAMUNDA_URL = f"{conn}"
        topics = [f'workflow_consumer'] + [f'{alert_section}_workflow_consumer_{t_id}' for t_id in range(1, 21)]
        for topic in topics:
            for i in range(0, 1):
                # Creating Unique WorkerId based on Topic and incremental task id
                etw = ExternalTaskWorker(f"{task_id}-{topic}", base_url=engine_local_base_url,
                                         config=urdhva_base.settings.camunda_default_config)
                # tasks.append(loop.run_in_executor(
                #         executor, partial(lambda: etw.subscribe(topic,
                #                                                 lambda task: run_async_function(algo_external_task, task))))
                # )
                subscribe_task = loop.run_in_executor(
                    executor, partial(etw.subscribe, topic, lambda task: run_async_function(algo_external_task, task))
                )
                tasks.append(subscribe_task)
                task_id += 1
    await asyncio.gather(*tasks)


def usage():
    print(f"Usage:- python {sys.argv[0]} <alert_section>")


if __name__ == "__main__":
    if len(sys.argv) == 1:
        print("Invalid arguments")
        usage()
        sys.exit(-1)
    asyncio.run(main(sys.argv[1]))


