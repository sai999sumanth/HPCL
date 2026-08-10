import urdhva_base
from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import os
import json
import shutil
import fastapi
import traceback
import polars as pl
from fastapi.responses import FileResponse
import utilities.bu_key_mapping as bu_key_mapping
import orchestrator.masterdata.lpg_master_upload as lpg_master_upload

router = fastapi.APIRouter(prefix='/lpgassetmaster')

logger = urdhva_base.logger.Logger.getInstance("api_manager")


# Action upload_lpg_asset_master
@router.post('/upload_lpg_asset_master', tags=['LPGAssetMaster'])
async def lpgassetmaster_upload_tas_asset_master(upload_file: fastapi.UploadFile = fastapi.File(None)):
    """
    Upload TAS Asset Master file.

    This API endpoint accepts a CSV file and saves it to the MFT path.
    It then reads the CSV file and returns the data as a JSON response.

    Args:
        data (Lpgassetmaster_Upload_Tas_Asset_MasterParams): The CSV file to be uploaded.

    Returns:
        Dict[str, Any]: A JSON response containing the filename and data.

    Raises:
        HTTPException: If there is an error uploading the file.
        HTTPException: If there is an error processing the CSV file.
    """
    try:
        df = pl.read_csv(upload_file.file).with_columns(pl.all().cast(pl.Utf8, strict=False))
    except Exception as e:
        print(f"Exception while reading CSV file, {e}")
        return False, "Failed to process CSV file, Please reverify uploaded content and reverify"
    return await lpg_master_upload.upload_lpg_master_data(df)


# Action download_lpg_asset_master
@router.post('/download_lpg_asset_master', tags=['LPGAssetMaster'])
async def lpgassetmaster_download_lpg_asset_master(data: Lpgassetmaster_Download_Lpg_Asset_MasterParams):
    """
    Download LPG Asset Master data.

    This API endpoint retrieves all the records from the LPG Asset Master collection
    and saves them to a CSV file. The CSV file is then returned as a JSON response.

    Args:
        data (Lpgassetmaster_Download_Lpg_Asset_MasterParams): The request body containing the filters to apply to the data.
            Currently, there are no filters, so the entire collection is returned.

    Returns:
        Dict[str, Any]: A JSON response containing the status, message and data.
            If the operation is successful, the "status" is True, the "message" is a success message,
            and the "data" contains the records from the collection.
            If the operation fails, the "status" is False, the "message" is an error message,
            and the "data" is an empty list.
    """
    data = await LPGAssetMaster.get_all()
    
    # Convert to a dictionary if it's a custom object
    resp_dict = data.__dict__
    
    if resp_dict.get('body'):
        # Decode the byte string to a normal string
        body_str = resp_dict['body'].decode('utf-8')
        
        # Parse the JSON string into a Python dictionary
        lpg_data = json.loads(body_str)
        
        # Check if there are multiple records in the "data" key
        records = lpg_data.get("data", [])
        
        if records:
            # Convert the records to a Polars DataFrame
            df = pl.DataFrame(records)
            
            # Save the Polars DataFrame as a CSV file
            download_path = urdhva_base.settings.download_path
            downloadpath = os.path.join(download_path, "downloads")
            if not os.path.exists(downloadpath):
                os.makedirs(downloadpath)
            
            if not os.path.exists(f'{urdhva_base.settings.ui_path}/downloads'):
                os.system(f'ln -s {downloadpath} {urdhva_base.settings.ui_path}')
            df.write_csv(downloadpath + "lpg_master.csv")  # Save directly to file
            return {"status": True, "message": "Success","data": os.path.join('/downloads', "lpg_master.csv")}        
        return {"status": False, "message": "No data found", "data": []}
    return {"status": False, "message": "No response", "data": []}


# Action download_template
@router.post('/download_template', tags=['LPGAssetMaster'])
async def lpgassetmaster_download_template(data: Lpgassetmaster_Download_TemplateParams):
    """
    Download LPG Asset Master Template.

    This API endpoint creates a template CSV file for the LPG Asset Master data
    with the same columns as the existing location master CSV, but without any data.
    The template file is then served for download.

    Args:
        data (Lpgassetmaster_Download_TemplateParams): The parameters for the 
        download template request.

    Returns:
        FileResponse: A response that serves the template CSV file for download.

    Raises:
        HTTPException: If there is an error creating or serving the CSV template.
    """
    download_path = urdhva_base.settings.download_path
    template_file_path = os.path.join(download_path, "templates", "lpg_master_template.csv")

    # Read the CSV file into a DataFrame
    df = pl.read_csv(f"{download_path}/lpg_master.csv")

    # Create a new empty DataFrame with the same columns as the original
    template_df = pl.DataFrame({col: pl.Series(name=col, values=[]) for col in df.columns})

    # Ensure the "templates" directory exists
    os.makedirs(os.path.dirname(template_file_path), exist_ok=True)

    # Save the empty DataFrame as a template CSV
    template_df.write_csv(template_file_path)

    # Serve the template file for download
    return FileResponse(
        path=template_file_path,
        media_type="application/octet-stream",
        filename="lpg_master_template.csv"
    )
