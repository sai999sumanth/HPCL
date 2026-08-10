from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import traceback
import polars as pl
import orchestrator.masterdata.geo_master_upload as geo_master_upload

router = fastapi.APIRouter(prefix='/bulevelgeocoordinates')


# Action upload_geo_master
@router.post('/upload_geo_master', tags=['BuLevelGeoCoordinates'])
async def bulevelgeocoordinates_upload_geo_master(upload_file: fastapi.UploadFile = fastapi.File(None)):
    try:
        df = pl.read_csv(upload_file.file, infer_schema_length=0).with_columns(pl.all().cast(pl.Utf8, strict=False))
    except Exception as e:
        print(traceback.format_exc())
        print(f"Exception while reading CSV file, {e}")
        return False, "Failed to process CSV file, Please reverify uploaded content and reverify"
    return await geo_master_upload.upload_geo_master_data(df)
