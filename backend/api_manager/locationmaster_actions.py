import urdhva_base
from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import os
import json
import shutil
import fastapi
import traceback
import polars as pl
import urdhva_base.redispool
import utilities.helpers as helpers
from fastapi.responses import FileResponse
import orchestrator.alerting.alert_helper as alert_helper
import orchestrator.analytics.pipeline_details as pipeline_details
import orchestrator.analytics.sod_location_stats as sod_location_stats
import orchestrator.tas_operations.command_control as tas_command_control
import orchestrator.masterdata.location_master_upload as location_master_upload
import orchestrator.field_force.location_master_metadata as location_master_metadata

router = fastapi.APIRouter(prefix='/locationmaster')

logger = urdhva_base.logger.Logger.getInstance("api_manager")


# Action upload_location_master
@router.post('/upload_location_master', tags=['LocationMaster'])
async def locationmaster_upload_location_master(upload_file: fastapi.UploadFile = fastapi.File(None)):
    """
    Upload Location Master file.

    This API endpoint accepts a CSV file and saves it to the MFT path.
    It then reads the CSV file and returns the data as a JSON response.

    Args:
        data (Locationmaster_Upload_Location_MasterParams): The CSV file to be uploaded.

    Returns:
        Dict[str, Any]: A JSON response containing the filename and data.

    Raises:
        HTTPException: If there is an error uploading the file.
        HTTPException: If there is an error processing the CSV file.
    """
    try:
        df = pl.read_csv(upload_file.file, infer_schema_length=0).with_columns(pl.all().cast(pl.Utf8, strict=False))
    except Exception as e:
        print(traceback.format_exc())
        print(f"Exception while reading CSV file, {e}")
        return False, "Failed to process CSV file, Please reverify uploaded content and reverify"
    return await location_master_upload.upload_location_master_data(df)


# Action download_location_master
@router.post('/download_location_master', tags=['LocationMaster'])
async def locationmaster_download_location_master(data: Locationmaster_Download_Location_MasterParams):
    # Fetching data from the LocationMaster model
    """
    Download Location Master data.

    This API endpoint fetches the data from the LocationMaster model and saves it as a CSV file to the download path specified in the settings.
    The API then returns a JSON response containing a success message and the file path of the saved CSV file.

    Args:
        data (Locationmaster_Download_Location_MasterParams): The input data containing the BU, SAP ID, and other optional parameters.

    Returns:
        Dict[str, Any]: A JSON response containing the status, message, and data (if any).

    Raises:
        HTTPException: If there is an error fetching the data or saving the CSV file.
    """
    data = await LocationMaster.get_all()
    
    # Convert to a dictionary if it's a custom object
    resp_dict = data.__dict__
    
    if resp_dict.get('body'):
        # Decode the byte string to a normal string
        body_str = resp_dict['body'].decode('utf-8')
        
        # Parse the JSON string into a Python dictionary
        loc_data = json.loads(body_str)
        
        # Check if there are multiple records in the "data" key
        records = loc_data.get("data", [])
        
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
            df.write_csv(downloadpath + "location_master.csv")  # Save directly to file
            return {"status": True, "message": "Success","data": os.path.join('/downloads', "location_master.csv")}        
        return {"status": False, "message": "No data found", "data": []}
    return {"status": False, "message": "No response", "data": []}


# Action fetch_global_stats
@router.post('/fetch_global_stats', tags=['LocationMaster'])
async def locationmaster_fetch_global_stats(data: Locationmaster_Fetch_Global_StatsParams):
    ...


# Action download_template
@router.post('/download_template', tags=['LocationMaster'])
async def locationmaster_download_template(data: Locationmaster_Download_TemplateParams):
    """
    Download Location Master Template.

    This API endpoint creates a template CSV file for the Location Master data
    with the same columns as the existing location master CSV, but without any data.
    The template file is then served for download.

    Args:
        data (Locationmaster_Download_TemplateParams): The parameters for the 
        download template request.

    Returns:
        FileResponse: A response that serves the template CSV file for download.

    Raises:
        HTTPException: If there is an error creating or serving the CSV template.
    """
    download_path = urdhva_base.settings.download_path
    template_file_path = os.path.join(download_path, "templates", "location_master_template.csv")

    # Read the CSV file into a DataFrame
    df = pl.read_csv(f"{download_path}/location_master.csv")

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
        filename="location_master_template.csv"
    )


# Action upload_tags_data
@router.post('/upload_tags_data', tags=['LocationMaster'])
async def locationmaster_upload_tags_data(upload_file: fastapi.UploadFile = fastapi.File(None)):
    """
    Upload Tags Data.

    This API endpoint accepts a JSON file and returns its content as a JSON response.

    Args:
        upload_file (fastapi.UploadFile): The JSON file to be uploaded.

    Returns:
        Dict[str, Any]: A JSON response containing the status and data.

    Raises:
        HTTPException: If there is an error processing the JSON file.
    """
    try:
        # Read the file content
        file_content = await upload_file.read()

        # Parse the JSON content
        data = json.loads(file_content)

        return data

    except json.JSONDecodeError as e:
        logger.error(f"Failed to decode JSON file: {e}")
        return {"status": False, "message": "Invalid JSON file. Please upload a valid JSON."}

    except Exception as e:
        logger.error(f"An error occurred while processing the JSON file: {traceback.format_exc()}")
        return {"status": False, "message": f"An error occurred: {e}"}
    

# Action update_location_master
@router.post('/update_location_master', tags=['LocationMaster'])
async def locationmaster_update_location_master(request: fastapi.Request, data: Locationmaster_Update_Location_MasterParams):
    try:
        user_sap_id = data.sap_id  
        query = f"sap_id='{user_sap_id}'" 
        # Use parameterized query
        params = urdhva_base.queryparams.QueryParams()
        params.fields = []
        params.q = query
        resp = await LocationMaster.get_all(params, resp_type="plain")
        
        print("resp --> ", resp)
        if resp["data"]:
            resp = resp["data"][0]
            if not isinstance(resp, dict):
                resp = resp._dict_
            if data.sap_id:
                resp['name'] = data.name
                resp['city'] = data.city
                resp['region'] = data.region
                resp['state'] = data.state
                resp['zone'] = data.zone
                resp['district'] = data.district
                resp['address'] = data.address
                resp['sales_area'] = data.sales_area
                resp['pincode'] = data.pincode
                res = LocationMaster(**resp)
                resp = await res.modify()
                return {"status": True, "message": "Successfully updated credential", "data": resp}

        return {"status": False, "message": "No data found for the given sap_id", "data": []}

    except Exception as e:
        error_trace = traceback.format_exc()
        print("Error Traceback:", error_trace)
        return {
            "status": False,
            "message": "An error occurred while updating user status.",
            "error": str(e),
            "traceback": error_trace
        }


# Action get_sod_engineering_stats
@router.post('/get_sod_engineering_stats', tags=['LocationMaster'])
async def locationmaster_get_sod_engineering_stats(data: Locationmaster_Get_Sod_Engineering_StatsParams):
    return await sod_location_stats.generate_sod_engineering_location_stats(data.sap_id)


# Action location_command_control
@router.post('/location_command_control', tags=['LocationMaster'])
async def locationmaster_location_command_control(data: Locationmaster_Location_Command_ControlParams):
    rpt = urdhva_base.context.context.get('rpt', {})
    user_name = rpt.get("username")
    employee_id = rpt.get("employee_id")
    status, location_data = await helpers.get_location_details('TAS', data.sap_id)
    if not status or not location_data or not location_data.get('location_onboard'):
        return False, "Location not onboarded"
    bu = location_data['bu']
    location_name = location_data.get('name', '')
    return await tas_command_control.publish_command(data.sap_id, data.action, bu,
                                                     location_name, user_name, employee_id, "1")
    
    
# Action get_dist_loc_details
@router.post('/get_dist_loc_details', tags=['LocationMaster'])
async def locationmaster_get_dist_loc_details(data: Locationmaster_Get_Dist_Loc_DetailsParams):
    return await sod_location_stats.get_filtered_location_data(bu=data.bu, location_onboard=data.location_onboard, 
                                                                specific_zone=data.zone, specific_sap_id=data.plant)


# Action get_pipeline_locations
@router.post('/get_pipeline_locations', tags=['LocationMaster'])
async def locationmaster_get_pipeline_locations():
     return await pipeline_details.get_pipeline_locations()


# Action get_location_metadata
@router.post('/get_location_metadata', tags=['LocationMaster'])
async def locationmaster_get_location_metadata(data: Locationmaster_Get_Location_MetadataParams):
    return await location_master_metadata.get_location_metadata(
        data.bu,
        data.metadata_filters or {},
        data.required_fields or [],
    )
