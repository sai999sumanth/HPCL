from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import json
import polars as pl
from fastapi.responses import FileResponse
import orchestrator.masterdata.cems_master_upload as cems_master_upload

router = fastapi.APIRouter(prefix='/cemslocationmaster')


# Action upload_cems_location_master
@router.post('/upload_cems_location_master', tags=['CEMSLocationMaster'])
async def cemslocationmaster_upload_cems_location_master(upload_file: fastapi.UploadFile = fastapi.File(None)):
    """
    Upload CEMS Location Master file.

    This API endpoint accepts a CSV file and saves it to the MFT path.
    It then reads the CSV file and returns the data as a JSON response.

    Args:
        upload_file: The CSV file to be uploaded.

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
    return await cems_master_upload.upload_cems_master_data(df)


# Action download_cems_location_master
@router.post('/download_cems_location_master', tags=['CEMSLocationMaster'])
async def cemslocationmaster_download_cems_location_master(data: Cemslocationmaster_Download_Cems_Location_MasterParams):
    """
        Download CEMS Location Master data.

        This API endpoint retrieves all the records from the CEMS Location Master collection
        and saves them to a CSV file. The CSV file is then returned as a JSON response.

        Args:
            data (Cemslocationmaster_Download_Cems_Location_MasterParams): The request body containing the filters to apply to the data.
                Currently, there are no filters, so the entire collection is returned.

        Returns:
            Dict[str, Any]: A JSON response containing the status, message and data.
                If the operation is successful, the "status" is True, the "message" is a success message,
                and the "data" contains the records from the collection.
                If the operation fails, the "status" is False, the "message" is an error message,
                and the "data" is an empty list.
        """
    data = await CEMSLocationMaster.get_all()

    # Convert to a dictionary if it's a custom object
    resp_dict = data.__dict__

    if resp_dict.get('body'):
        # Decode the byte string to a normal string
        body_str = resp_dict['body'].decode('utf-8')

        # Parse the JSON string into a Python dictionary
        location_data = json.loads(body_str)

        # Check if there are multiple records in the "data" key
        records = location_data.get("data", [])

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
            return {"status": True, "message": "Success", "data": os.path.join('/downloads', "location_master.csv")}
        return {"status": False, "message": "No data found", "data": []}
    return {"status": False, "message": "No response", "data": []}


# Action download_template
@router.post('/download_template', tags=['CEMSLocationMaster'])
async def cemslocationmaster_download_template(data: Cemslocationmaster_Download_TemplateParams):
    """
        Download CEMS Location Master Template.

        This API endpoint creates a template CSV file for the CEMS Location Master data
        with the same columns as the existing location master CSV, but without any data.
        The template file is then served for download.

        Args:
            data (Cemslocationmaster_Download_TemplateParams): The parameters for the
            download template request.

        Returns:
            FileResponse: A response that serves the template CSV file for download.

        Raises:
            HTTPException: If there is an error creating or serving the CSV template.
        """

    download_path = urdhva_base.settings.download_path
    downloadpath = os.path.join(download_path, "downloads")
    template_file_path = os.path.join(download_path, "location_master_template.csv")

    df = pl.read_csv(f"{downloadpath}/location_master.csv")
    # Create a new empty DataFrame with the same columns
    template_df = pl.DataFrame({col: [] for col in df.columns})

    # Save the empty DataFrame as a template CSV
    template_df.write_csv(template_file_path)

    # Serve the template file for download
    return FileResponse(
        path=template_file_path,
        media_type="application/octet-stream",
        filename="location_master_template.csv"
    )
