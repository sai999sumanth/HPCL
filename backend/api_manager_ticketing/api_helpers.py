import urdhva_base
from hpcl_ceg_ticketing_enum import *
from hpcl_ceg_ticketing_model import *
from fastapi.responses import FileResponse
from fastapi import HTTPException
import uuid
import traceback
import datetime
import json
from pathlib import Path
import utilities.minio_connector as minio_connector
from typing import List

async def attach_file_common(
    model_class,
    ticket_id: str,
    comment_id: str,
    upload_files: List[fastapi.UploadFile],
    attachment_field: str
):

    if not upload_files:
        return {"status": False, "message": "No files uploaded"}

    allowed_extensions = [
        ".png", ".jpg", ".jpeg", ".gif",
        ".csv", ".xlsx", ".xls",
        ".pdf", ".doc", ".docx"
    ]

    target_dir = urdhva_base.settings.ticketing_attachments or "/tmp"
    os.makedirs(target_dir, exist_ok=True)

    # Fetch record first
    params = urdhva_base.queryparams.QueryParams(
        q=f"id='{comment_id}' and ticket_id='{ticket_id}'",
        limit=1
    )

    resp = await model_class.get_all(params, resp_type="plain")

    if not resp or not resp.get("data"):
        return {"status": False, "message": "Record not found"}

    record = resp["data"][0]

    # Get existing attachments (LIST SAFE)
    existing_attachments = record.get(attachment_field) or []

    if isinstance(existing_attachments, str):
        try:
            existing_attachments = json.loads(existing_attachments)
        except:
            existing_attachments = []

    uploaded_paths = []

    for upload_file in upload_files:

        file_extension = Path(upload_file.filename).suffix.lower()

        if file_extension not in allowed_extensions:
            continue  # skip unsupported file

        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = uuid.uuid4().hex
        # unique_filename = f"{timestamp}_{upload_file.filename}_{timestamp}"
        original_name = Path(upload_file.filename).stem  # Solar_installation
        extension = Path(upload_file.filename).suffix  # .xlsx
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{original_name}_{timestamp}{extension}"
        saved_file_path = os.path.join(target_dir, unique_filename)

        try:
            # Save locally
            content = await upload_file.read()
            with open(saved_file_path, "wb") as f:
                f.write(content)
            await upload_file.close()

            # Upload to MinIO
            status, minio_path = minio_connector.upload_to_minio(
                "ticket_comments",
                record.get("ticket_id"),
                unique_id,
                saved_file_path
            )

            if status:
                existing_attachments.append(minio_path)
                uploaded_paths.append(minio_path)
            else:
                print(f"MinIO upload failed for {saved_file_path}")
        except Exception as e:
            print(f"Error processing file {upload_file.filename}: {e}")

        finally:
            try:
                if os.path.exists(saved_file_path):
                    os.remove(saved_file_path)
                else:
                    print(f"File not found for deletion: {saved_file_path}")
            except Exception as e:
                print(f"Failed to delete {saved_file_path}: {e}")

    # Update DB once
    await model_class(
        **{
            "id": record.get("id"),
            attachment_field: existing_attachments
        }
    ).modify()

    return {
        "status": True,
        "message": "Files attached successfully",
        attachment_field: existing_attachments
    }
async def download_attachment_common(
    model_class,
    record_id: str,
    requested_file_name: str,
    attachment_field: str
):
    # ---------------- FETCH RECORD ----------------
    params = urdhva_base.queryparams.QueryParams(
        q=f"id='{record_id}'",
        limit=1
    )

    resp = await model_class.get_all(params, resp_type="plain")

    if not resp or not resp.get("data"):
        raise HTTPException(status_code=404, detail="Record not found")

    record = resp["data"][0]

    file_paths = record.get(attachment_field) or []

    if isinstance(file_paths, str):
        try:
            file_paths = json.loads(file_paths)
        except:
            file_paths = []

    if not file_paths:
        raise HTTPException(status_code=404, detail="No attachments found")

    # ---------------- FIND FILE ----------------
    matched_path = None
    for path in file_paths:
        if requested_file_name in path:
            matched_path = path
            break

    if not matched_path:
        raise HTTPException(status_code=404, detail="Requested file not found")

    # ---------------- DOWNLOAD ----------------
    success, local_file_path = minio_connector.download_from_minio(matched_path)

    if not success:
        raise HTTPException(status_code=500, detail=local_file_path)

    return FileResponse(
        path=local_file_path,
        filename=requested_file_name,
        media_type="application/octet-stream"
    )