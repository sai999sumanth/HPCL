import urdhva_base
from hpcl_ceg_enum import *
from hpcl_ceg_model import (
    TASAssetMaster,
    Tasassetmaster_Download_Tas_Asset_MasterParams,
    Tasassetmaster_Download_TemplateParams,
    Tasassetmaster_Download_Tas_ReportParams
)
import os
import json
import fastapi
import polars as pl
from datetime import datetime
import utilities.helpers as helpers
from fastapi.responses import FileResponse
import orchestrator.dbconnector.global_analytics as global_analytics
import orchestrator.masterdata.tas_master_upload as tas_master_upload

router = fastapi.APIRouter(prefix='/tasassetmaster')

logger = urdhva_base.logger.Logger.getInstance("api_manager")


# Action upload_tas_asset_master
@router.post('/upload_tas_asset_master', tags=['TASAssetMaster'])
async def tasassetmaster_upload_tas_asset_master(upload_file: fastapi.UploadFile = fastapi.File(None)):
    """
    Upload TAS Asset Master file.

    This API endpoint accepts a CSV file and saves it to the MFT path.
    It then reads the CSV file and returns the data as a JSON response.

    Args:
        data (TASAssetMaster_Upload_Tas_Asset_MasterParams): The CSV file to be uploaded.

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
    return await tas_master_upload.upload_tas_master_data(df)


# Action download_tas_asset_master
@router.post('/download_tas_asset_master', tags=['TASAssetMaster'])
async def tasassetmaster_download_tas_asset_master(data: Tasassetmaster_Download_Tas_Asset_MasterParams):
    """
    Download TAS Asset Master data.

    This API endpoint fetches the data from the TASAssetMaster model and saves it as a CSV file to the download path specified in the settings.
    The API then returns a JSON response containing a success message and the file path of the saved CSV file.

    Args:
        data (Tasassetmaster_Download_Tas_Asset_MasterParams): The input data containing the parameters for the download request.

    Returns:
        Dict[str, Any]: A JSON response containing the status, message, and data (if any).

    Raises:
        HTTPException: If there is an error fetching the data or saving the CSV file.
    """
    data = await TASAssetMaster.get_all()
    
    # Convert to a dictionary if it's a custom object
    resp_dict = data.__dict__
    
    if resp_dict.get('body'):
        # Decode the byte string to a normal string
        body_str = resp_dict['body'].decode('utf-8')
        
        # Parse the JSON string into a Python dictionary
        tas_data = json.loads(body_str)
        
        # Check if there are multiple records in the "data" key
        records = tas_data.get("data", [])
        
        if records:
            # Convert the records to a Polars DataFrame
            df = pl.DataFrame(records)
            
            download_path = urdhva_base.settings.download_path
            downloadpath = os.path.join(download_path, "/downloads")
            if not os.path.exists(downloadpath):
                os.makedirs(downloadpath)
            
            if not os.path.exists(f'{urdhva_base.settings.ui_path}/downloads'):
                os.system(f'ln -s {downloadpath} {urdhva_base.settings.ui_path}')
            df.write_csv(downloadpath + "tas_master.csv")  # Save directly to file
            return {"status": True, "message": "Success","data": os.path.join('/downloads', "tas_master.csv")}        
        return {"status": False, "message": "No data found", "data": []}
    return {"status": False, "message": "No response", "data": []}


# Action download_template
@router.post('/download_template', tags=['TASAssetMaster'])
async def tasassetmaster_download_template(data: Tasassetmaster_Download_TemplateParams):
    """
    Download TAS Asset Master Template.

    This API endpoint creates a template CSV file for the TAS Asset Master data
    with the same columns as the existing location master CSV, but without any data.
    The template file is then served for download.

    Args:
        data (Tasassetmaster_Download_TemplateParams): The parameters for the 
        download template request.

    Returns:
        FileResponse: A response that serves the template CSV file for download.

    Raises:
        HTTPException: If there is an error creating or serving the CSV template.
    """
    download_path = urdhva_base.settings.download_path
    template_file_path = os.path.join(download_path, "templates", "tas_master_template.csv")

    # Read the CSV file into a DataFrame
    df = pl.read_csv(f"{download_path}/tas_master.csv")

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
        filename="tas_master_template.csv"
    )


# Action download_tas_report
@router.post('/download_tas_report', tags=['TASAssetMaster'])
async def tasassetmaster_download_tas_report(data: Tasassetmaster_Download_Tas_ReportParams):
    # Mapping of actions to their handler functions, filename prefixes, and Excel writer functions
    print("data", data)
    filter_dict = {f.key: f.value for f in data.filters}

    filters = {
        "bcu_number": filter_dict.get("bcu_number"),
        "equipment_name": filter_dict.get("equipment_name"),
        "equipment_id": filter_dict.get("equipment_id"),
        "assigned_bay": filter_dict.get("assigned_bay"),
    }
    action_config = {
        "interlock_name_count": {
            "function": global_analytics.GlobalAnalytics.interlock_name_count,
            "filename_prefix": "BCU_Alarm_Parameters_Dashboard",
            "excel_writer": helpers.write_interlock_excel,
        },
        "tas_maintenance_fault": {
            "function": global_analytics.GlobalAnalytics.tas_maintenance_fault,
            "filename_prefix": "TAS_Maintenance_Fault_Dashboard",
            "excel_writer": helpers.generate_equipment_report,
        },
        "tas_normal_count": {
            "function": global_analytics.GlobalAnalytics.tas_normal_count,
            "filename_prefix": "Trends_and_Analytics_Dashboard",
            "excel_writer": helpers.generate_trends_report,
        },
        "local_loaded": {
            "function": global_analytics.GlobalAnalytics.local_loaded,
            "filename_prefix": "Local_Loaded_Dashboard",
            "excel_writer": helpers.critical_parameters_excel,
        },
        "unauthorised_flow": {
            "function": global_analytics.GlobalAnalytics.unauthorised_flow,
            "filename_prefix": "Unauthorised_Flow_Dashboard",
            "excel_writer": helpers.critical_parameters_excel,
        },
        "sick_tts": {
            "function": global_analytics.GlobalAnalytics.sick_tts,
            "filename_prefix": "Sick_TTS_Dashboard",
            "excel_writer": helpers.critical_parameters_excel,
        },
        "cancelled_tts": {
            "function": global_analytics.GlobalAnalytics.cancelled_tts,
            "filename_prefix": "Cancelled_TTS_Dashboard",
            "excel_writer": helpers.critical_parameters_excel,
        },
        "kfactor": {
            "function": global_analytics.GlobalAnalytics.kfactor,
            "filename_prefix": "KFactor_Dashboard",
            "excel_writer": helpers.critical_parameters_excel,
        },
        "manualfanprinted": {
            "function": global_analytics.GlobalAnalytics.manualfanprinted,
            "filename_prefix": "Manual_Fan_Printed_Dashboard",
            "excel_writer": helpers.critical_parameters_excel,
        },
        "overloaded_tts": {
            "function": global_analytics.GlobalAnalytics.overloaded_tts,
            "filename_prefix": "Overloaded_TTS_Dashboard",
            "excel_writer": helpers.critical_parameters_excel,
        },
        "mfmkfactor": {
            "function": global_analytics.GlobalAnalytics.mfmkfactor,
            "filename_prefix": "MFM_KFactor_Dashboard",
            "excel_writer": helpers.critical_parameters_excel,
        },
        "bay_reassignment": {
            "function": global_analytics.GlobalAnalytics.bay_reassignment,
            "filename_prefix": "Bay_Reassignment_Dashboard",
            "excel_writer": helpers.critical_parameters_excel,
        },
    }


    # --- Execution block ---

    # Get the action config
    config = action_config.get(data.action)

    # If unknown action
    if not config:
        resp = {"status": False, "message": f"Unknown action {data.action}"}
    else:
        # Call the corresponding function
        func = config["function"]
        resp = await func(filters=data.filters, cross_filters=data.cross_filters, drill_state=data.drill_state)

        # If success, handle Excel writing
        if resp.get("status"):
            # Detect report type
            if resp.get("monthly_data"):  # This checks for existence and that it's not empty or None
                report_type = "monthly"
            elif resp.get("daily_data"):  # Same here
                report_type = "daily"
            else:
                report_type = "daily"  # fallback

            # Generate timestamped filename
            timestamp = datetime.now().strftime("%Y-%m-%d_%H%M")
            downloads_path = urdhva_base.settings.downloads

            #Ensure the directory exists
            os.makedirs(downloads_path, exist_ok=True)

            # Build the filename
            filename = os.path.join(
                downloads_path,
                f"{config['filename_prefix']}_{timestamp}.xlsx"
            )
            print("resp --> ", resp)
            
            # Call the corresponding Excel writer
            await config["excel_writer"](resp, output_file=filename, report_type=report_type, filters=filters)

            # Attach file path to response
            resp["file_path"] = filename
    data_url = filename.replace(urdhva_base.settings.downloads, 
                                      urdhva_base.settings.downloads_url_base)
    return {"status": True, "message": "Success", "file_path": data_url}
