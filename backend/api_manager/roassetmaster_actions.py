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
import orchestrator.masterdata.ro_master_upload as ro_master_upload

router = fastapi.APIRouter(prefix='/roassetmaster')

logger = urdhva_base.logger.Logger.getInstance("api_manager")


# Action upload_ro_asset_master
@router.post('/upload_ro_asset_master', tags=['ROAssetMaster'])
async def roassetmaster_upload_ro_asset_master(upload_file: fastapi.UploadFile = fastapi.File(None)):
    """
    Upload RO Asset Master file.

    This API endpoint accepts a CSV file and saves it to the MFT path.
    It then reads the CSV file and returns the data as a JSON response.

    Args:
        data (Roassetmaster_Upload_Ro_Asset_MasterParams): The CSV file to be uploaded.

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
    return await ro_master_upload.upload_ro_master_data(df)


# Action download_ro_asset_master
@router.post('/download_ro_asset_master', tags=['ROAssetMaster'])
async def roassetmaster_download_ro_asset_master(data: Roassetmaster_Download_Ro_Asset_MasterParams):
    """
    Download RO Asset Master data.

    This API endpoint fetches the data from the ROAssetMaster model and saves it as a CSV file to the download path specified in the settings.
    The API then returns a JSON response containing a success message and the file path of the saved CSV file.

    Args:
        data (Roassetmaster_Download_Ro_Asset_MasterParams): The input data containing the BU, SAP ID, and other optional parameters.

    Returns:
        Dict[str, Any]: A JSON response containing the status, message, and data (if any).

    Raises:
        HTTPException: If there is an error fetching the data or saving the CSV file.
    """
    data = await ROAssetMaster.get_all()
    
    # Convert to a dictionary if it's a custom object
    resp_dict = data.__dict__
    
    if resp_dict.get('body'):
        # Decode the byte string to a normal string
        body_str = resp_dict['body'].decode('utf-8')
        
        # Parse the JSON string into a Python dictionary
        ro_data = json.loads(body_str)
        
        # Check if there are multiple records in the "data" key
        records = ro_data.get("data", [])
        
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
            df.write_csv(downloadpath + "ro_master.csv")  # Save directly to file
            return {"status": True, "message": "Success","data": os.path.join('/downloads', "ro_master.csv")}        
        return {"status": False, "message": "No data found", "data": []}
    return {"status": False, "message": "No response", "data": []}


# Action download_template
@router.post('/download_template', tags=['ROAssetMaster'])
async def roassetmaster_download_template(data: Roassetmaster_Download_TemplateParams):
    """
    Download RO Asset Master Template.

    This API endpoint creates a template CSV file for the RO Asset Master data
    with the same columns as the existing location master CSV, but without any data.
    The template file is then served for download.

    Args:
        data (Roassetmaster_Download_TemplateParams): The parameters for the 
        download template request.

    Returns:
        FileResponse: A response that serves the template CSV file for download.

    Raises:
        HTTPException: If there is an error creating or serving the CSV template.
    """
    download_path = urdhva_base.settings.download_path
    template_file_path = os.path.join(download_path, "templates", "ro_master_template.csv")

    # Read the CSV file into a DataFrame
    df = pl.read_csv(f"{download_path}/ro_master.csv")

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
        filename="ro_master_template.csv"
    )
