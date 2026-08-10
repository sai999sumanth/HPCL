from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import json
import mimetypes
from pathlib import Path
import utilities.minio_connector as minio_connector
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import utilities.helpers as helpers

router = fastapi.APIRouter(prefix='/noticesvts')


# Action download_notice
@router.post('/download_notice', tags=['NoticesVTS'])
async def noticesvts_download_notice(data: Noticesvts_Download_NoticeParams):
    file_path = data.file_path
    status, actual_file_path = minio_connector.download_from_minio(file_path)
    file_name = os.path.basename(actual_file_path)

    # Detect mime type automatically
    mime_type, _ = mimetypes.guess_type(actual_file_path)
    if mime_type is None:
        mime_type = "application/octet-stream"

    if not os.path.exists(actual_file_path):
        raise HTTPException(status_code=404, detail="PDF not found for given alert_id")
    return FileResponse(path=actual_file_path, filename=f"{file_name}", media_type=mime_type)

# Action upload_notice
@router.post('/upload_notice', tags=['NoticesVTS'])
async def noticesvts_upload_notice(alert_id: str, upload_file: fastapi.UploadFile = fastapi.File(None)):
    try:
        if urdhva_base.context.context.exists():
            rpt = urdhva_base.context.context.get('rpt', {})
        else:
            rpt = {}

        alert_data = await Alerts.get(int(alert_id))
        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__
        
        UPLOAD_DIR = os.path.join(urdhva_base.settings.uploads, alert_data['bu'])
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        
        # Validate the uploaded file type
        file_extension = Path(upload_file.filename).suffix.lower()
        allowed_extensions = [".png", ".jpg", ".jpeg", ".gif", ".csv", ".xlsx", ".xls", ".pdf", ".doc", ".docx"]
        if file_extension not in allowed_extensions:
            return fastapi.responses.JSONResponse(
                status_code=400, content={"message": "Unsupported file type"}
            )

        # Save the uploaded file
        file_name = upload_file.filename
        file_path = os.path.join(UPLOAD_DIR, file_name)
        with open(file_path, "wb") as f:
            f.write(await upload_file.read())

        # Generate encryption key and encrypt the file
        # encrypted_file_key = helpers.encrypt_file(file_path)

        status, minio_path = minio_connector.upload_to_minio(alert_data['bu'], alert_data['alert_section'], alert_data['unique_id'], file_path) 

        if status:
            print('-'*50)
            print("minio_path",minio_path)
            print('-'*50)
            query = f"""select * from notices_vts where alert_id='{alert_id}'"""
            notices_data = await NoticesVTS.get_aggr_data(query, limit=0)
            if notices_data.get("data", []):
                notices_data = notices_data['data'][0]
                notice_history = notices_data.get('notices',[])
                notices_respose = {
                    "doc_type": "User Created",
                    "uploaded_date": urdhva_base.utilities.get_present_time().replace(tzinfo=None).isoformat(),
                    "uploaded_by": rpt.get("employee_id",""),
                    "file_path": minio_path,
                    "uploaded_name": rpt.get("first_name",""),
                    "report_type": "User Created"
                }
                notice_history.append(notices_respose)
                #updated_notices_json = json.dumps(notice_history)
                updated_notices_json = json.dumps(notice_history).replace("'", "''")
                notices_query = f"""
                    UPDATE notices_vts
                    SET notices = '{updated_notices_json}'::jsonb
                    WHERE id = {notices_data['id']}
                """
                await NoticesVTS.update_by_query(notices_query)
            else:
                notices_respose = {
                    "doc_type": "User Created",
                    "uploaded_date": urdhva_base.utilities.get_present_time().replace(tzinfo=None).isoformat(),
                    "uploaded_by": rpt.get("employee_id",""),
                    "file_path": minio_path,
                    "uploaded_name": rpt.get("first_name",""),
                    "report_type": "User Created"
                }
                notices_resp = {
                    "alert_id": alert_id,
                    "alert_type": alert_data.get("interlock_name"),
                    "notices": [notices_respose]
                }
                await NoticesVTSCreate(**notices_resp).create()

            return {
                "message": "File uploaded and encrypted successfully",
                "original_file_path": minio_path,
                "encrypted_file_key": minio_path
            }
        else:
            return {
                    "message": "File uploaded Failed Minio",
                    "original_file_path": minio_path,
                    "encrypted_file_key": minio_path
                }
    except Exception as e:
        return fastapi.responses.JSONResponse(
            status_code=500, content={"message": "An error occurred", "details": str(e)}
        )
