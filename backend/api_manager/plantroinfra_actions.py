from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import urdhva_base
import fastapi
import pandas as pd
import datetime
import traceback
from http.client import HTTPException
import orchestrator.dashboard.chart_factory.infra_functions as infra_functions
import orchestrator.dashboard.chart_factory.plant_retail_functions as plant_retail_functions
from fastapi.responses import FileResponse, JSONResponse
import polars as pl

router = fastapi.APIRouter(prefix='/plantroinfra')


# Action upload_plant_ro_file
@router.post('/upload_plant_ro_file', tags=['PlantRoInfra'])
async def plantroinfra_upload_plant_ro_file(file: fastapi.UploadFile):
    df = pd.read_excel(file.file, sheet_name='RO',header=None)

    start_date = df.iloc[3, 1]
    to_date = df.iloc[3, 4]
    print('to_date: ',to_date)
    start_date = pd.to_datetime(start_date, errors='coerce').strftime('%d/%m/%Y') if not pd.isna(start_date) else ""
    to_date = pd.to_datetime(to_date, errors='coerce').strftime('%d/%m/%Y') if not pd.isna(to_date) else ""


    state_zone_mapping = {
        "ANDHRA PRADESH": "SCR", "ARUNACHAL PRADESH": "EAS", "ASSAM": "EAS", "BIHAR": "ECZ",
        "CHHATISGARH": "CEN", "DELHI": "NOR", "GOA": "WES", "GUJARAT": "EAS", "HARYANA": "NOR",
        "HIMACHAL PRADESH": "NFZ", "JHARKHAND": "ECZ", "KARNATAKA": "SWZ", "KERALA": "SWZ",
        "MADHYA PRADESH": "CEN", "MAHARASHTRA": "WES", "MANIPUR": "EAS", "MEGHALAYA": "EAS",
        "MIZORAM": "EAS", "NAGALAND": "EAS", "ODISHA": "ECZ", "PUNJAB": "NFZ", "RAJASTHAN": "NWR",
        "SIKKIM": "EAS", "TAMIL NADU": "EAS", "TELANGANA": "SCR", "TRIPURA": "EAS",
        "UTTAR PRADESH": "NCR", "UTTARAKHAND": "NCR", "WEST BENGAL": "EAS", "ANDAMAN & NICOBAR": "EAS",
        "CHANDIGARH": "NFZ", "DADRA & NAGAR HAVELI": "NWR", "DAMAN & DIU": "NWR",
        "JAMMU & KASHMIR": "NOR", "LADAKH": "NFZ", "LAKSHADWEEP": "SOU", "PUDUCHERRY": "Unknown"
    }
    union_territories = {"ANDAMAN & NICOBAR", "CHANDIGARH", "DADRA & NAGAR HAVELI", "DAMAN & DIU",
                         "JAMMU & KASHMIR", "LADAKH", "LAKSHADWEEP", "PUDUCHERRY", "DELHI"}

    companies = []
    company_row = df.iloc[1].fillna("")
    status_row = df.iloc[2].fillna("")

    col = 1
    while col < len(company_row):
        comp_name = str(company_row[col]).strip()
        if comp_name:
            companies.append({
                "name": comp_name,
                "col": col
            })
        col += 4

    seen = set()
    clean_companies = []
    for comp in companies:
        if comp["name"] not in seen:
            clean_companies.append(comp)
            seen.add(comp["name"])
    companies = clean_companies

    psu_list = {"IOCL", "BPCL", "HPCL", "NRL", "MRPL", "ONGC", "PSU", "RBML", "NEL"}
    pvt_list = {"SHELL", "RSIL", "PVT"}
    industry_list = {"INDUSTRY"}

    for comp in companies:
        if comp["name"] in psu_list:
            comp["status"] = "PSU"
        elif comp["name"] in pvt_list:
            comp["status"] = "PVT"
        elif comp["name"] in industry_list:
            comp["status"] = "INDUSTRY"
        else:
            comp["status"] = "OTHER"

    blocks = []
    current_status = None
    for i, val in df[0].items():
        if pd.isna(val): continue
        sval = str(val).upper()
        if "REGULAR+RURAL RETAIL OUTLETS" in sval:
            current_status = "Total"
        elif "REGULAR RETAIL OUTLETS" in sval and "RURAL" not in sval:
            current_status = "Regular"
        elif "RURAL RETAIL OUTLETS" in sval:
            current_status = "Rural"
        elif current_status and sval not in ["STATES", "STATE", "T O T A L", "TOTAL", "NAN"]:
            blocks.append((i, val, current_status))

    records = []
    for i, place, status in blocks:
        if (not place) or str(place).strip() == "" or "T O T A L" in str(place).upper():
            continue
        place_upper = str(place).upper().strip()
        zone = state_zone_mapping.get(place_upper, "Unknown")
        region_type = "Union territory" if place_upper in union_territories else "State"
        row = df.iloc[i]

        for comp in companies:
            base_col = comp['col']
            try:
                ro = row[base_col]
                comm = row[base_col + 1]
                decomm = row[base_col + 2]
            except IndexError:
                continue
            is_valid = False
            for v in (ro, comm, decomm):
                if (not pd.isna(v)) and (str(v).strip() != "" and str(v).strip() != "nan"):
                    is_valid = True
            if is_valid:
                records.append({
                    "start_date": start_date,
                    "to_date": to_date,
                    "zone": zone,
                    "state": place,
                    "category": region_type,
                    "company": comp["name"],
                    "status": comp["status"],
                    "ro_status": status,
                    "retail_outlet": ro if not pd.isna(ro) else 0,
                    "ros_commissioned": comm if not pd.isna(comm) else 0,
                    "ros_decommissioned": decomm if not pd.isna(decomm) else 0,
                })

    final_df = pd.DataFrame(records)
    final_df['sbu'] = 'RO'
    numeric_cols = ["retail_outlet", "ros_commissioned", "ros_decommissioned"]
    final_df[numeric_cols] = final_df[numeric_cols].apply(pd.to_numeric, errors='coerce').fillna(0).astype(float)

    final_df = final_df.fillna("").to_dict(orient="records")

    query = ''' DELETE FROM plant_ro_infra '''
    result = await urdhva_base.BasePostgresModel.execute_query(query)

    await PlantRoInfra.bulk_update(final_df, upsert=False)

    return 'Uploaded successfully'





# Action get_all_plant_ro_infra
@router.post('/get_all_plant_ro_infra', tags=['PlantRoInfra'])
async def plantroinfra_get_all_plant_ro_infra(data: Plantroinfra_Get_All_Plant_Ro_InfraParams):
    return await plant_retail_functions.get_all_plant_ro_info(filters=data.filters, cross_filters=data.cross_filters,
                                           drill_state=data.drill_state, limit=data.limit, time_grain=data.time_grain)


# Action get_plant_ro_count_infra
@router.post('/get_plant_ro_count_infra', tags=['PlantRoInfra'])
async def plantroinfra_get_plant_ro_count_infra(data: Plantroinfra_Get_Plant_Ro_Count_InfraParams):
    return await plant_retail_functions.get_plant_ro_count_info(filters=data.filters, cross_filters=data.cross_filters,
                                                       drill_state=data.drill_state, limit=data.limit,
                                                       time_grain=data.time_grain)


# Action get_retail_company_infra
@router.post('/get_retail_company_infra', tags=['PlantRoInfra'])
async def plantroinfra_get_retail_company_infra(data: Plantroinfra_Get_Retail_Company_InfraParams):
    return await plant_retail_functions.get_retail_company_info(filters=data.filters, cross_filters=data.cross_filters,
                                                       drill_state=data.drill_state, limit=data.limit,
                                                       time_grain=data.time_grain)


# Action get_distinct_ro_retail_infra
@router.post('/get_distinct_ro_retail_infra', tags=['PlantRoInfra'])
async def plantroinfra_get_distinct_ro_retail_infra(data: Plantroinfra_Get_Distinct_Ro_Retail_InfraParams):
    return await plant_retail_functions.get_distinct_ro_retail_info(data.sbu, data.company, data.zone, data.state,data.status,data.ro_status)


# Action get_top_five_ro_infra
@router.post('/get_top_five_ro_infra', tags=['PlantRoInfra'])
async def plantroinfra_get_top_five_ro_infra(data: Plantroinfra_Get_Top_Five_Ro_InfraParams):
    return await plant_retail_functions.get_top_five_ro_info(filters=data.filters,
                                                              cross_filters=data.cross_filters,
                                                              drill_state=data.drill_state, limit=data.limit,
                                                              time_grain=data.time_grain)


# Action get_zone_wise_ro_infra
@router.post('/get_zone_wise_ro_infra', tags=['PlantRoInfra'])
async def plantroinfra_get_zone_wise_ro_infra(data: Plantroinfra_Get_Zone_Wise_Ro_InfraParams):
    return await plant_retail_functions.get_zone_wise_ro_info(filters=data.filters,
                                                             cross_filters=data.cross_filters,
                                                             drill_state=data.drill_state, limit=data.limit,
                                                             time_grain=data.time_grain)



# Action get_ro_status_ro_infra
@router.post('/get_ro_status_ro_infra', tags=['PlantRoInfra'])
async def plantroinfra_get_ro_status_ro_infra(data: Plantroinfra_Get_Ro_Status_Ro_InfraParams):
    return await plant_retail_functions.get_ro_status_ro_info(filters=data.filters,
                                                              cross_filters=data.cross_filters,
                                                              drill_state=data.drill_state, limit=data.limit,
                                                              time_grain=data.time_grain)


# Action get_zone_table_ro_infra
@router.post('/get_zone_table_ro_infra', tags=['PlantRoInfra'])
async def plantroinfra_get_zone_table_ro_infra(data: Plantroinfra_Get_Zone_Table_Ro_InfraParams):
    return await plant_retail_functions.get_zone_table_ro_info(filters=data.filters,
                                                              cross_filters=data.cross_filters,
                                                              drill_state=data.drill_state, limit=data.limit,
                                                              time_grain=data.time_grain)
