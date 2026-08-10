from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import os
import datetime

router = fastapi.APIRouter(prefix='/hostsicktts')


# Action download_data
@router.post('/download_data', tags=['HostSickTts'])
async def hostsicktts_download_data(upload_file: fastapi.UploadFile = fastapi.File(None)):
    SAVE_PATH = "/opt/ceg/algo/Analog_downloads"
    os.makedirs(SAVE_PATH, exist_ok=True)
    if not upload_file:
        return {"status": "failed", "message": "No file uploaded"}
    file_path = os.path.join(SAVE_PATH, upload_file.filename)
    return {"status": "success", "message": f"File saved at {file_path}"}
