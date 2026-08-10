import requests

# Camunda REST API base URL
CAMUNDA_BASE_URL = "http://10.90.38.169:9089/engine-rest"

camunda_listener_mapping = {
    "camunda_dryout_01": {"host": "10.90.38.167", "port": 9080},
    "camunda_dryout_02": {"host": "10.90.38.167", "port": 9081},
    "camunda_dryout_03": {"host": "10.90.38.167", "port": 9082},
    "camunda_dryout_04": {"host": "10.90.38.167", "port": 9083},
    "camunda_dryout_05": {"host": "10.90.38.167", "port": 9084},
    "camunda_dryout_06": {"host": "10.90.38.167", "port": 9085},
    "camunda_dryout_07": {"host": "10.90.38.167", "port": 9086},
    "camunda_dryout_08": {"host": "10.90.38.167", "port": 9087},
    "camunda_dryout_09": {"host": "10.90.38.167", "port": 9088},
    "camunda_dryout_10": {"host": "10.90.38.167", "port": 9089}
}

#camunda_listener_mapping = {
#    "camunda_dryout_01": {"host": "10.90.38.167", "port": 9086}
#}


# Camunda credentials (if required)
USERNAME = "demo"
PASSWORD = "demo"

def get_failed_workflows(url):
    """
    Get a list of failed workflows.
    """
    url = f"{url}/external-task"
    params = {
        "notLocked": "true",  # Only retrieve tasks that are not currently locked
        "withRetriesLeft": "false",  # Only retrieve tasks with no retries left
    }
    response = requests.get(url, params=params)
    response.raise_for_status()
    return response.json()

def retry_workflow(url, task_id):
    """
    Retry a specific failed workflow by its task ID.
    """
    url = f"{url}/external-task/{task_id}/retries"
    data = {"retries": 3}  # Set the number of retries
    response = requests.put(url, json=data)
    response.raise_for_status()
    print("status: ", response.status_code)
    return response.status_code

def main():
    try:
        for key, values in camunda_listener_mapping.items():
            url = f"http://10.90.38.167:{values['port']}/engine-rest"
            # Get all failed workflows
            failed_tasks = get_failed_workflows(url)
            if not failed_tasks:
                print("No failed workflows found.")
                return

            print(f"Found {len(failed_tasks)} failed workflows.")

            # Retry each failed workflow
            for task in failed_tasks:
                print("task: ", task)
                task_id = task.get("id")
                print(f"Retrying workflow with task ID: {task_id}")
                retry_workflow(url, task_id)
                print(f"Workflow with task ID {url} {task_id} retried successfully.")

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
