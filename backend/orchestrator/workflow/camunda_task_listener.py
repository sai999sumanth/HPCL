import urdhva_base
import sys
import asyncio
import importlib
import traceback
import orchestrator
from concurrent.futures import ThreadPoolExecutor
from camunda.external_task.external_task import ExternalTask, TaskResult
from camunda.external_task.external_task_worker import ExternalTaskWorker

logger = urdhva_base.logger.Logger.getInstance("workflow_process-log")


task_count = {
    'TAS': 21,
    'VTS': 15,
    'VA': 15,
    'LPG': 10,
    'RO': 20
}


async def algo_external_task_listener(task: ExternalTask) -> TaskResult:
    """
    This function is the entry point for all the external tasks.
    It takes an ExternalTask object as argument and calls the corresponding function
    from the orchestrator.actions module based on the module_name, class_name and function_name variables
    passed in the task variables.
    It also handles the failure scenario and returns the appropriate task result.
    """
    variables = task.get_variables()
    print("variables --> ", variables)
    module_name = variables.pop('module_name', None)
    class_name = variables.pop('class_name', None)
    function_name = variables.pop('function_name', None)
    try:
        module = importlib.import_module(f"orchestrator.actions.{module_name}")
        class_instance = getattr(module, class_name)()
        req_variables = await class_instance.get_required_variables()
        function = getattr(class_instance, function_name)
        print("req_variables --> ", req_variables)
        print("variables --> ", variables)
        params = {k: v if k != "effect_sop_id" else (v if isinstance(v, list) else [v]) 
          for k, v in variables.items() if k in req_variables}

        status, data = await function(params=params) or (False, {"error": "Function returned None"})
        # status, data = await function(**{"params": {key: variables.get(key, None) for key in req_variables}})
        print("status: ", status)
        print("data: ", data)
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


def get_camunda_urls(task_type):
    config_data = []
    cfg = urdhva_base.settings.camunda_configuration
    if task_type == 'TAS':
        if cfg.get('TAS'):
            config_data.extend([{"url": rec['url'], "listener_name": 'tas_workflow_consumer'}
                                for rec in cfg['TAS'] if rec.get('alert_section') == 'TAS'])
        else:
            config_data.append({"url": urdhva_base.settings.camunda_url, "listener_name": "tas_workflow_consumer"})
    elif task_type == 'LPG':
        if cfg.get('LPG'):
            config_data.extend([{"url": rec['url'], "listener_name": 'lpg_workflow_consumer'}
                                for rec in cfg['LPG'] if rec.get('alert_section') == 'LPG'])
        else:
            config_data.append({"url": urdhva_base.settings.camunda_url, "listener_name": "lpg_workflow_consumer"})
    elif task_type == 'VA':
        urls = set()
        for bu, rules in cfg.items():
            for rule in rules:
                if rule.get('alert_section') == 'VA':
                    urls.add(rule['url'])
        if urls:
            config_data.extend([{"url": url, "listener_name": 'va_workflow_consumer'} for url in list(urls)])
        else:
            config_data.append({"url": urdhva_base.settings.camunda_url, "listener_name": "va_workflow_consumer"})
    elif task_type == 'VTS':
        urls = set()
        for bu, rules in cfg.items():
            for rule in rules:
                if rule.get('alert_section') == 'VTS':
                    urls.add(rule['url'])
        if urls:
            config_data.extend([{"url": url, "listener_name": 'vts_workflow_consumer'} for url in list(urls)])
        else:
            config_data.append({"url": urdhva_base.settings.camunda_url, "listener_name": "vts_workflow_consumer"})
    elif task_type == 'RO':
        urls = set()
        for bu, rules in cfg.items():
            for rule in rules:
                if rule.get('alert_section') == 'RO':
                    urls.add(rule['url'])
        if urls:
            config_data.extend([{"url": url, "listener_name": 'ro_workflow_consumer'} for url in list(urls)])
        else:
            config_data.append({"url": urdhva_base.settings.camunda_url, "listener_name": "ro_workflow_consumer"})
    else:
        logger.error("Invalid task type")
    return config_data


async def main(task_type):
    """
    Main entry point of the workflow manager.

    This function sets up an ExternalTaskWorker and subscribes to the 'workflow_consumer' topic.
    It then runs the algo_external_task function for each incoming task in a separate thread.
    """
    # Fetching all required camunda urls
    config_data = get_camunda_urls(task_type)
    max_flows = task_count.get(task_type, 1)
    tasks = []
    worker_num = 1
    # Looping through each camunda work flow and executing corresponding listener
    for cfg in config_data:
        engine_local_base_url = f"{cfg['url']}/engine-rest"
        topics = [f'workflow_consumer', cfg['listener_name']] + [f'{cfg['listener_name']}_{t_id}'
                                                                 for t_id in range(1, max_flows+1)]
        print(f"Starting external task worker for url {engine_local_base_url} for workers {', '.join(topics)}")
        loop = asyncio.get_event_loop()
        executor = ThreadPoolExecutor(max_workers=200)  # Adjust the number of workers as needed
        for topic in topics:
            etw = ExternalTaskWorker(worker_num, base_url=engine_local_base_url,
                                     config=urdhva_base.settings.camunda_default_config)
            tasks.append(loop.run_in_executor(
                executor, lambda: etw.subscribe(topic, lambda task: run_async_function(algo_external_task_listener,
                                                                                       task))))
            worker_num += 1
    print(f"Total {len(tasks)} task configures, Waiting for tasks to complete")
    await asyncio.gather(*tasks)


# Run the asyncio event loop
if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Invalid input arguments")
        print(f"Usage:- {sys.argv[0]} task_type")
        sys.exit(0)
    asyncio.run(main(sys.argv[1]))
