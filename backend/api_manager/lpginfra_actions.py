from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
import pandas as pd
import traceback
from http.client import HTTPException
from fastapi.responses import FileResponse, JSONResponse
router = fastapi.APIRouter(prefix='/lpginfra')


# Action upload_lpg_file
@router.post('/upload_lpg_file', tags=['LPGInfra'])
async def lpginfra_upload_lpg_file(file: fastapi.UploadFile):
    try:
        df = pd.read_excel(file.file, sheet_name='LPG').fillna("")
        save_path = "/opt/ceg/algo/orchestrator/masterdata/infra_inputs"
        os.makedirs(save_path, exist_ok=True)
        dt_str = datetime.datetime.now().strftime("%Y%m%d_%H-%M-%S") + f"_{datetime.datetime.now().microsecond}"
        filename = f"LPG_{dt_str}.xlsx"
        file_location = os.path.join(save_path, filename)
        df.to_excel(file_location, sheet_name='LPG', index=False)
        df.columns = df.columns.str.strip().str.lower()
        df['sbu'] = 'LPG'
        df['filename'] = filename

        df = df.rename(
            columns={
                'company': 'company', 'location': 'location_name', 'zone': 'zone', 'state': 'state',
                'district': 'district', 'installed bottling capacity    (tmtpa)': 'installed_bottling_capacity',
                'operating bottling capacity    (tmtpa)': 'operating_bottling_capacity', 'ccoe tankage  (tmt)': 'ccoe_tankage',
                'time of commissioning': 'time_of_commissioning', 'mode': 'mode', 'supply': 'supply', 'LOCATION': 'location_name',
                'latitude': 'latitude', 'longitude': 'longitude'
            }
        )

        query = ''' * FROM location_master'''
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        loc_df = pd.DataFrame(resp['data'])
        rpt = urdhva_base.context.context.get('rpt', {})
        username = rpt.get("username")
        loc_df['updated_by'] = ''
        df['updated_by'] = username
        df['sap code'] = df['sap code'].apply(
            lambda x: str(int(float(x))) if pd.notnull(x) and str(x).strip() != "" else ""
        )
        df['time_of_commissioning'] = df['time_of_commissioning'].astype(str)
        df['installed_bottling_capacity'] = pd.to_numeric(df['installed_bottling_capacity'], errors='coerce').fillna(0.0)
        df['operating_bottling_capacity'] = pd.to_numeric(df['operating_bottling_capacity'], errors='coerce').fillna(0.0)
        df['ccoe_tankage'] = pd.to_numeric(df['ccoe_tankage'], errors='coerce').fillna(0.0)
        df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce').fillna(0.0)
        df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce').fillna(0.0)
        df['state'] = df['state'].astype(str).str.replace(r"&", "and", regex=True)
        loc_df['sap_id'] = loc_df['sap_id'].astype(str)

        merged_df = df.merge(
            loc_df[['sap_id', 'zone', 'state', 'district', 'city', 'address', 'region', 'name']],
            left_on='sap code',
            right_on='sap_id',
            how='left', suffixes=('', '_Y')
        )

        merged_df['sap_id'] = merged_df['sap_id'].fillna(merged_df['sap code'])

        for col in ['sbu', 'zone', 'state', 'district', 'city', 'address', 'region', 'name']:
            merged_df[col] = merged_df[col].fillna("")

        merged_df = merged_df[[
            'sap_id', 'sbu', 'zone', 'state', 'district', 'city', 'address', 'region',
            'company', 'location_name', 'name', 'installed_bottling_capacity', 'operating_bottling_capacity',
            'ccoe_tankage', 'time_of_commissioning', 'mode', 'supply', 'latitude', 'longitude', 'filename', 'updated_by'
        ]]
        for col in merged_df.select_dtypes(include='object').columns:
            merged_df[col] = merged_df[col].astype(str).str.strip()
        final_records = merged_df.fillna("").to_dict(orient="records")
        today_str = datetime.datetime.now().strftime("%Y-%m-%d")
        current_data = await LPGInfra.get_all(urdhva_base.QueryParams(limit=0), resp_type="plain")
        existing_records = current_data.get("data", [])

        if existing_records:
            print("----Moving current LPGInfra to Historic before inserting new data----")

            numeric_fields = ["installed_bottling_capacity", "operating_bottling_capacity", "ccoe_tankage", "latitude", "longitude"]
            for rec in existing_records:
                rec["snapshot_date"] = today_str
                for field in numeric_fields:
                    try:
                        rec[field] = float(rec[field]) if rec[field] not in ("", None) else 0.0
                    except:
                        rec[field] = 0.0

            await HistoricLPGInfra.bulk_update(existing_records, upsert=False)

        await urdhva_base.BasePostgresModel.execute_query("DELETE FROM lpg_infra")
        await LPGInfra.bulk_update(final_records, upsert=False)

        return 'Uploaded successfully'

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


# Action get_all_lpg_infra
@router.post('/get_all_lpg_infra', tags=['LPGInfra'])
async def lpginfra_get_all_lpg_infra(data: Lpginfra_Get_All_Lpg_InfraParams):
    try:
        params = urdhva_base.queryparams.QueryParams()
        params.fields = []
        params.limit = 0
        resp = await LPGInfra.get_all(params, resp_type="plain")
        return resp
    except Exception as e:
        print(f"Error in get_all_lpg_infra: {e}")
        return JSONResponse(status_code=500, content={"detail": f"Internal Server Error: {str(e)}"})


# Action update_lpg_data
@router.post('/update_lpg_data', tags=['LPGInfra'])
async def lpginfra_update_lpg_data(data: Lpginfra_Update_Lpg_DataParams):
    try:
        lpg_data = data.lpg_data
        q = f"id='{lpg_data.unique_id}'"
        existing = await LPGInfra.get_all(urdhva_base.QueryParams(q=q, limit=1), resp_type="plain")
        if existing["data"]:
            lpg_data = lpg_data.dict()
            lpg_data["id"] = existing["data"][0].get("id")
        else:
            return {"status": False, "message": f"No record found for ID {lpg_data.unique_id}"}

        await LPGInfra(**lpg_data).modify()
        return {"status": True, "message": "LPG Data Updated Successfully"}

    except Exception as e:
        print("Error in update_lpg_data:", str(e))
        traceback.print_exc()
        return {"status": False, "message": "An error occurred while updating LPG data", "error": str(e)}


# Action add_lpg_data
@router.post('/add_lpg_data', tags=['LPGInfra'])
async def lpginfra_add_lpg_data(data: Lpginfra_Add_Lpg_DataParams):
    try:
        lpg_data = data.lpg_data.dict()
        lpg_data["id"] = None
        await LPGInfra(**lpg_data).create()
        return {"status": True, "message": "LPG Data Created Successfully"}
    except Exception as e:
        print("Error in add_lpg_data:", str(e))
        traceback.print_exc()
        return {"status": False, "message": "An error occurred while creating LPG data", "error": str(e)}


# Action delete_lpg_data
@router.post('/delete_lpg_data', tags=['LPGInfra'])
async def lpginfra_delete_lpg_data(data: Lpginfra_Delete_Lpg_DataParams):
    try:
        unique_ids = data.unique_id or []
        if not unique_ids:
            return {"status": False, "message": "No unique_id(s) provided for deletion"}

        deleted_ids = []
        not_found_ids = []

        for uid in unique_ids:
            q = f"id='{uid}'"
            existing = await LPGInfra.get_all( urdhva_base.QueryParams(q=q, limit=1), resp_type="plain")

            if existing["data"]:
                record_id = existing["data"][0].get("id")
                await LPGInfra.delete(record_id)
                deleted_ids.append(uid)
                print(f"Deleted LPG record with ID: {uid}")
            else:
                not_found_ids.append(uid)
                print(f"No LPG record found for ID: {uid}")

        print(f"Total LPG deleted: {len(deleted_ids)}, Not found: {len(not_found_ids)}")

        return {
            "status": True, "message": f"LPG Data Deleted Successfully. Deleted: {len(deleted_ids)}, Not Found: {len(not_found_ids)}", "deleted_ids": deleted_ids, "not_found_ids": not_found_ids}

    except Exception as e:
        print("Error in delete_lpg_data:", str(e))
        traceback.print_exc()
        return {"status": False, "message": "An error occurred while deleting LPG data", "error": str(e)}
