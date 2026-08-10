from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import urdhva_base
import fastapi
import pandas as pd
import datetime
import traceback
from http.client import HTTPException
import orchestrator.dashboard.chart_factory.infra_functions as infra_functions
from fastapi.responses import FileResponse, JSONResponse
import polars as pl

router = fastapi.APIRouter(prefix='/aviationinfra')


# Action upload_aviation_file
@router.post('/upload_aviation_file', tags=['AVIATIONInfra'])
async def aviationinfra_upload_aviation_file(file: fastapi.UploadFile):
    try:
        df = pd.read_excel(file.file, sheet_name='Aviation').fillna("")
        save_path = "/opt/ceg/algo/orchestrator/masterdata/infra_inputs"
        os.makedirs(save_path, exist_ok=True)
        dt_str = datetime.datetime.now().strftime("%Y%m%d_%H-%M-%S") + f"_{datetime.datetime.now().microsecond}"
        filename = f"Aviation_{dt_str}.xlsx"
        file_location = os.path.join(save_path, filename)
        print('file_location: ', file_location)
        df.to_excel(file_location, sheet_name='Aviation', index=False)
        df.columns = df.columns.str.strip().str.lower()
        df['sbu'] = 'AVIATION'
        df['filename'] = filename

        df = df.rename(
            columns={'sap code': 'sap_id', 'company': 'company', 'source 1': 'location_name', 'source 2': 'name',
                     'zone': 'zone', 'state': 'state', 'district': 'district', 'aviation sbu': 'city', 'tankage': 'tankage', 'operation status': 'operation_status', 'mode': 'mode',
                     'address': 'address', 'pin code': 'pincode', 'status': 'status', 'latitude': 'latitude', 'longitude': 'longitude'
                     })
        rpt = urdhva_base.context.context.get('rpt', {})
        username = rpt.get("username")
        df['updated_by'] = username
        df['sap_id'] = df['sap_id'].apply(
            lambda x: str(int(float(x))) if pd.notnull(x) and str(x).strip() != "" else ""
        )
        df['tankage'] = pd.to_numeric(df['tankage'], errors='coerce').fillna(0.0)
        df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce').fillna(0.0)
        df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce').fillna(0.0)
        df['state'] = df['state'].astype(str).str.replace(r"&", "and", regex=True)
        df['region'] = df['state']
        df['name'] = df['name'].fillna('').astype(str)
        df['pincode'] = df['pincode'].fillna('').astype(str)

        df = df[[
            'sap_id', 'sbu', 'zone', 'state', 'district', 'city', 'address', 'region',
            'company', 'location_name', 'name', 'tankage', 'operation_status',
            'mode', 'address', 'pincode', 'status', 'latitude', 'longitude', 'filename', 'updated_by'
        ]]

        final_records = df.fillna("").to_dict(orient="records")
        today_str = datetime.datetime.now().strftime("%Y-%m-%d")
        current_data = await AVIATIONInfra.get_all(urdhva_base.QueryParams(limit=0), resp_type="plain")
        existing_records = current_data.get("data", [])
        print('existing_records count: ', len(existing_records))

        if existing_records:
            print("----Moving current AVIATIONInfra to Historic before inserting new data----")

            numeric_fields = ["tankage", "latitude", "longitude"]
            for rec in existing_records:
                rec["snapshot_date"] = today_str
                for field in numeric_fields:
                    try:
                        rec[field] = float(rec[field]) if rec[field] not in ("", None) else 0.0
                    except:
                        rec[field] = 0.0

            await HistoricAVIATIONInfra.bulk_update(existing_records, upsert=False)
        await urdhva_base.BasePostgresModel.execute_query("DELETE FROM aviation_infra")
        await AVIATIONInfra.bulk_update(final_records, upsert=False)

        return 'Uploaded successfully'

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")



# Action get_all_aviation_infra
@router.post('/get_all_aviation_infra', tags=['AVIATIONInfra'])
async def aviationinfra_get_all_aviation_infra(data: Aviationinfra_Get_All_Aviation_InfraParams):
    try:
        params = urdhva_base.queryparams.QueryParams()
        params.fields = []
        params.limit = 0
        resp = await AVIATIONInfra.get_all(params, resp_type="plain")
        return resp
    except Exception as e:
        print(f"Error in get_all_aviation_infra': {e}")
        return JSONResponse(status_code=500, content={"detail": f"Internal Server Error: {str(e)}"})


# Action update_aviation_data
@router.post('/update_aviation_data', tags=['AVIATIONInfra'])
async def aviationinfra_update_aviation_data(data: Aviationinfra_Update_Aviation_DataParams):
    try:
        aviation_data = data.aviation_data
        q = f"id='{aviation_data.unique_id}'"
        existing = await AVIATIONInfra.get_all(urdhva_base.QueryParams(q=q, limit=1), resp_type="plain")
        if existing["data"]:
            aviation_data = aviation_data.dict()
            aviation_data["id"] = existing["data"][0].get("id")
        else:
            return {"status": False, "message": f"No record found for ID {aviation_data.unique_id}"}

        await AVIATIONInfra(**aviation_data).modify()
        return {"status": True, "message": "AVIATION Data Updated Successfully"}

    except Exception as e:
        print("Error in update_aviation_data:", str(e))
        traceback.print_exc()
        return {"status": False, "message": "An error occurred while updating AVIATION data", "error": str(e)}

# Action add_aviation_data
@router.post('/add_aviation_data', tags=['AVIATIONInfra'])
async def aviationinfra_add_aviation_data(data: Aviationinfra_Add_Aviation_DataParams):
    try:
        aviation_data = data.aviation_data.dict()
        aviation_data["id"] = None
        await AVIATIONInfra(**aviation_data).create()
        return {"status": True, "message": "AVIATION Data Created Successfully"}
    except Exception as e:
        print("Error in add_aviation_data:", str(e))
        traceback.print_exc()
        return {"status": False, "message": "An error occurred while creating AVIATION data", "error": str(e)}


# Action delete_aviation_data
@router.post('/delete_aviation_data', tags=['AVIATIONInfra'])
async def aviationinfra_delete_aviation_data(data: Aviationinfra_Delete_Aviation_DataParams):
    try:
        unique_ids = data.unique_id or []
        if not unique_ids:
            return {"status": False, "message": "No unique_id(s) provided for deletion"}

        deleted_ids = []
        not_found_ids = []

        for uid in unique_ids:
            q = f"id='{uid}'"
            existing = await AVIATIONInfra.get_all( urdhva_base.QueryParams(q=q, limit=1), resp_type="plain")

            if existing["data"]:
                record_id = existing["data"][0].get("id")
                await AVIATIONInfra.delete(record_id)
                deleted_ids.append(uid)
                print(f"Deleted AVIATION record with ID: {uid}")
            else:
                not_found_ids.append(uid)
                print(f"No AVIATION record found for ID: {uid}")

        print(f"Total AVIATION deleted: {len(deleted_ids)}, Not found: {len(not_found_ids)}")

        return {
            "status": True, "message": f"AVIATION Data Deleted Successfully. Deleted: {len(deleted_ids)}, Not Found: {len(not_found_ids)}", "deleted_ids": deleted_ids, "not_found_ids": not_found_ids}

    except Exception as e:
        print("Error in delete_aviation_data:", str(e))
        traceback.print_exc()
        return {"status": False, "message": "An error occurred while deleting AVIATION data", "error": str(e)}
