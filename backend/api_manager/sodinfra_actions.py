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

router = fastapi.APIRouter(prefix='/sodinfra')


# Action upload_sod_file

@router.post('/upload_sod_file', tags=['SodInfra'])
async def sodinfra_upload_sod_file(file: fastapi.UploadFile):
    try:
        df = pd.read_excel(file.file, sheet_name='SOD').fillna("")
        save_path = "/opt/ceg/algo/orchestrator/masterdata/infra_inputs"
        os.makedirs(save_path, exist_ok=True)
        dt_str = datetime.datetime.now().strftime("%Y%m%d_%H-%M-%S") + f"_{datetime.datetime.now().microsecond}"
        filename = f"SOD_{dt_str}.xlsx"
        file_location = os.path.join(save_path, filename)
        df.to_excel(file_location, sheet_name='SOD', index=False)
        df.columns = df.columns.str.strip().str.lower()
        df['sbu'] = 'SOD'
        df['filename'] = filename
        df = df.rename(
            columns={'company': 'company', 'type': 'type', 'location name': 'location_name', 'region ppac': 'region_ppac', 'ms (kl)': 'ms', 'sko(kl)': 'sko',
                     'hsd(kl)': 'hsd', 'total(kl)': 'total', 'mode of reciept': 'mode_of_receipt', 'latitude': 'latitude', 'longitude': 'longitude'
                     }
        )

        query = ''' * FROM location_master'''
        resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0, skip=0)
        loc_df = pd.DataFrame(resp['data'])

        loc_df['updated_by'] = ''
        rpt = urdhva_base.context.context.get('rpt', {})
        username = rpt.get("username")
        df['updated_by'] = username
        df['location code'] = df['location code'].apply(
            lambda x: str(int(float(x))) if pd.notnull(x) and str(x).strip() != "" else ""
        )
        df['ms'] = pd.to_numeric(df['ms'], errors='coerce').fillna(0).astype(int)
        df['sko'] = pd.to_numeric(df['sko'], errors='coerce').fillna(0).astype(int)
        df['hsd'] = pd.to_numeric(df['hsd'], errors='coerce').fillna(0).astype(int)
        df['total'] = pd.to_numeric(df['total'], errors='coerce').fillna(0).astype(int)
        df['state'] = df['state'].astype(str).str.replace(r"&", "and", regex=True)
        loc_df['sap_id'] = loc_df['sap_id'].astype(str)

        merged_df = df.merge(
            loc_df[['sap_id', 'zone', 'state', 'district', 'city', 'address', 'region', 'name']],
            left_on='location code',
            right_on='sap_id',
            how='left', suffixes=('', '_Y')
        )

        merged_df['sap_id'] = merged_df['sap_id'].fillna(merged_df['location code'])

        for col in ['sbu', 'zone', 'state', 'district', 'city', 'address', 'region', 'name']:
            merged_df[col] = merged_df[col].fillna("")

        merged_df = merged_df[[
            'sap_id', 'sbu', 'zone', 'state', 'district', 'city', 'address', 'region',
            'company', 'type', 'location_name', 'name', 'region_ppac', 'ms', 'sko',
            'hsd', 'total', 'mode_of_receipt', 'latitude', 'longitude', 'filename', 'updated_by'
        ]]
        for col in merged_df.select_dtypes(include='object').columns:
            merged_df[col] = merged_df[col].astype(str).str.strip()

        final_records = merged_df.fillna("").to_dict(orient="records")

        today_str = datetime.datetime.now().strftime("%Y-%m-%d")
        current_data = await SodInfra.get_all(urdhva_base.QueryParams(limit=0), resp_type="plain")
        existing_records = current_data.get("data", [])
        print('existing_records count: ', len(existing_records))

        if existing_records:
            print("----Moving current SodInfra to Historic before inserting new data----")

            numeric_fields = [ "latitude", "longitude"]
            for rec in existing_records:
                rec["snapshot_date"] = today_str
                for field in numeric_fields:
                    try:
                        rec[field] = float(rec[field]) if rec[field] not in ("", None) else 0.0
                    except:
                        rec[field] = 0.0

            await HistoricSodInfra.bulk_update(existing_records, upsert=False)

        await urdhva_base.BasePostgresModel.execute_query("DELETE FROM sod_infra")
        await SodInfra.bulk_update(final_records, upsert=False)

        return "Uploaded successfully"

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


# Action get_all_sod_lpg_infra
@router.post('/get_all_sod_lpg_infra', tags=['SodInfra'])
async def sodinfra_get_all_sod_lpg_infra(data: Sodinfra_Get_All_Sod_Lpg_InfraParams):
    return await infra_functions.sod_infra(filters=data.filters, cross_filters=data.cross_filters,
                                           drill_state=data.drill_state, limit=data.limit, time_grain=data.time_grain)


# Action get_count_company_infra
@router.post('/get_count_company_infra', tags=['SodInfra'])
async def sodinfra_get_count_company_infra(data: Sodinfra_Get_Count_Company_InfraParams):
    return await infra_functions.get_count_company_info(filters=data.filters, cross_filters=data.cross_filters,
                                                        drill_state=data.drill_state, limit=data.limit,
                                                        time_grain=data.time_grain)


# Action get_sod_lpg_infra
@router.post('/get_sod_lpg_infra', tags=['SodInfra'])
async def sodinfra_get_sod_lpg_infra(data: Sodinfra_Get_Sod_Lpg_InfraParams):
    return await infra_functions.get_sod_lpg_info(filters=data.filters, cross_filters=data.cross_filters,
                                                  drill_state=data.drill_state, limit=data.limit,
                                                  time_grain=data.time_grain)


# Action get_distinct_sod_lpg_infra
@router.post('/get_distinct_sod_lpg_infra', tags=['SodInfra'])
async def sodinfra_get_distinct_sod_lpg_infra(data: Sodinfra_Get_Distinct_Sod_Lpg_InfraParams):
    return await infra_functions.get_distinct_sod_lpg_info(data.sbu, data.zone, data.state, data.district, data.company,
                                                           data.location_name)


# Action get_all_sod_infra
@router.post('/get_all_sod_infra', tags=['SodInfra'])
async def sodinfra_get_all_sod_infra(data: Sodinfra_Get_All_Sod_InfraParams):
    try:
        params = urdhva_base.queryparams.QueryParams()
        params.fields = []
        params.limit = 0
        resp = await SodInfra.get_all(params, resp_type="plain")
        print('resp: ', resp)
        return resp
    except Exception as e:
        print(f"Error in get_all_sod_infra: {e}")
        return JSONResponse(status_code=500, content={"detail": f"Internal Server Error: {str(e)}"})


# Action download_template
@router.post('/download_template', tags=['SodInfra'])
async def sodinfra_download_template(data: Sodinfra_Download_TemplateParams):
    return await infra_functions.get_download_template_info(data.sbu)


# Action get_sales_infra
@router.post('/get_sales_infra', tags=['SodInfra'])
async def sodinfra_get_sales_infra(data: Sodinfra_Get_Sales_InfraParams):
    return await infra_functions.get_sales_info(filters=data.filters, cross_filters=data.cross_filters,
                                                  drill_state=data.drill_state, limit=data.limit,
                                                  time_grain=data.time_grain)


# Action get_sales_officer_infra
@router.post('/get_sales_officer_infra', tags=['SodInfra'])
async def sodinfra_get_sales_officer_infra(data: Sodinfra_Get_Sales_Officer_InfraParams):
    return await infra_functions.get_sales_officer_info(data.sbu, data.sap_id)

# Action get_download_data
@router.post('/get_download_data', tags=['SodInfra'])
async def sodinfra_get_download_data(data: Sodinfra_Get_Download_DataParams, background_tasks: fastapi.BackgroundTasks):
    return await infra_functions.get_download_info(data.sbu, background_tasks)


# Action update_sod_data
@router.post('/update_sod_data', tags=['SodInfra'])
async def sodinfra_update_sod_data(data: Sodinfra_Update_Sod_DataParams):
    try:
        sod_data = data.sod_data
        q = f"id='{sod_data.unique_id}'"
        existing = await SodInfra.get_all(urdhva_base.QueryParams(q=q, limit=1), resp_type="plain")
        if existing["data"]:
            sod_data = sod_data.dict()
            sod_data["id"] = existing["data"][0].get("id")
        else:
            return {"status": False, "message": f"No record found for ID {sod_data.unique_id}"}

        await SodInfra(**sod_data).modify()
        return {"status": True, "message": "SOD Data Updated Successfully"}

    except Exception as e:
        print("Error in update_sod_data:", str(e))
        traceback.print_exc()
        return {"status": False, "message": "An error occurred while updating user data", "error": str(e)}


# Action add_sod_data
@router.post('/add_sod_data', tags=['SodInfra'])
async def sodinfra_add_sod_data(data: Sodinfra_Add_Sod_DataParams):
    try:
        sod_data = data.sod_data.dict()
        sod_data["id"] = None
        await SodInfra(**sod_data).create()
        return {"status": True, "message": "SOD Data Created Successfully"}
    except Exception as e:
        print("Error in add_sod_data:", str(e))
        traceback.print_exc()
        return {"status": False, "message": "An error occurred while creating SOD data", "error": str(e)
}


# Action delete_sod_data
@router.post('/delete_sod_data', tags=['SodInfra'])
async def sodinfra_delete_sod_data(data: Sodinfra_Delete_Sod_DataParams):
    try:
        unique_ids = data.unique_id or []
        if not unique_ids:
            return {"status": False, "message": "No unique_id(s) provided for deletion"}

        deleted_ids = []
        not_found_ids = []

        for uid in unique_ids:
            q = f"id='{uid}'"
            existing = await SodInfra.get_all(
                urdhva_base.QueryParams(q=q, limit=1), resp_type="plain"
            )

            if existing["data"]:
                record_id = existing["data"][0].get("id")
                await SodInfra.delete(record_id)
                deleted_ids.append(uid)
                print(f"Deleted record with ID: {uid}")
            else:
                not_found_ids.append(uid)
                print(f"No record found for ID: {uid}")

        print(f"Total deleted: {len(deleted_ids)}, Not found: {len(not_found_ids)}")

        return {"status": True, "message": f"SOD Data Deleted Successfully. Deleted: {len(deleted_ids)}, Not Found: {len(not_found_ids)}", "deleted_ids": deleted_ids, "not_found_ids": not_found_ids}

    except Exception as e:
        print("Error in delete_sod_data:", str(e))
        traceback.print_exc()
        return {"status": False, "message": "An error occurred while deleting SOD data", "error": str(e)}


# Action get_updated_by_infra
@router.post('/get_updated_by_infra', tags=['SodInfra'])
async def sodinfra_get_updated_by_infra(data: Sodinfra_Get_Updated_By_InfraParams):
    return await infra_functions.get_updated_by_info(data.sbu)
