import os
import json
import hpcl_ceg_model
file_path = f"{os.path.dirname(hpcl_ceg_model.__file__)}/../orchestrator/masters/pipeline_master.json"


async def get_pipeline_locations():
    # All pipeline details provided by HPCL
    with open(file_path) as json_file:
        pipeline_details = json.load(json_file)
    return {'status':True, 'message':'Success', 'data':pipeline_details['pipelines']}
