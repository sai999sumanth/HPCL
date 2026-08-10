import urdhva_base
import asyncio
import importlib
import traceback
import orchestrator
from concurrent.futures import ThreadPoolExecutor
from camunda.external_task.external_task import ExternalTask, TaskResult
from camunda.external_task.external_task_worker import ExternalTaskWorker

logger = urdhva_base.logger.Logger.getInstance("workflow_process-log")


async def algo_external_task(task: ExternalTask) -> TaskResult:
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


async def main():
    """
    Main entry point of the workflow manager.

    This function sets up an ExternalTaskWorker and subscribes to the 'workflow_consumer' topic.
    It then runs the algo_external_task function for each incoming task in a separate thread.
    """
    engine_local_base_url = urdhva_base.settings.camunda_url + "/engine-rest"
    # etw = ExternalTaskWorker(10, base_url=ENGINE_LOCAL_BASE_URL, config=default_config)
    topics = [f'workflow_consumer'] + [f'tas_workflow_consumer_{t_id}' for t_id in range(1, 21)]
    loop = asyncio.get_event_loop()
    executor = ThreadPoolExecutor(max_workers=400)  # Adjust the number of workers as needed
    tasks = []
    for topic in topics:
        for i in range(0, 1):
            etw = ExternalTaskWorker(i, base_url=engine_local_base_url,
                                     config=urdhva_base.settings.camunda_default_config)
            tasks.append(loop.run_in_executor(
                executor, lambda: etw.subscribe(topic, lambda task: run_async_function(algo_external_task, task)))
            )
    await asyncio.gather(*tasks)

# Run the asyncio event loop
if __name__ == "__main__":
    asyncio.run(main())
