from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import urdhva_base
import fastapi
import pandas as pd
import datetime
import traceback
from http.client import HTTPException
import orchestrator.dashboard.chart_factory.plant_retail_functions as plant_retail_functions
import orchestrator.dashboard.chart_factory.infra_functions as infra_functions
from fastapi.responses import FileResponse, JSONResponse
import polars as pl
router = fastapi.APIRouter(prefix='/plantcnginfra')


# Action upload_plant_cng_file
@router.post('/upload_plant_cng_file', tags=['PlantCngInfra'])
async def plantcnginfra_upload_plant_cng_file(file: fastapi.UploadFile):
    df = pd.read_excel(file.file, sheet_name='CNG',header=None)

    start_date = df.iloc[5, 1]
    to_date = df.iloc[5, 4]
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

    union_territories = {
        "ANDAMAN & NICOBAR", "CHANDIGARH", "DADRA & NAGAR HAVELI", "DAMAN & DIU",
        "JAMMU & KASHMIR", "LADAKH", "LAKSHADWEEP", "PUDUCHERRY", "DELHI"
    }

    company_row = df.iloc[3].fillna("")
    companies = []
    col = 1
    while col < len(company_row):
        comp_name = str(company_row[col]).strip()
        if comp_name and comp_name != "nan" and comp_name != "":
            companies.append({
                "name": comp_name,
                "col": col
            })
            col += 4
        else:
            col += 1

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

    records = []
    for i in range(6, len(df)):
        row = df.iloc[i]
        place = row[0]

        if pd.isna(place) or str(place).strip() == "":
            continue

        place_str = str(place).strip()

        if "T O T A L" in place_str.upper() or "UNION" in place_str.upper():
            continue

        place_upper = place_str.upper()
        zone = state_zone_mapping.get(place_upper, "Unknown")
        region_type = "Union territory" if place_upper in union_territories else "State"

        for comp in companies:
            base_col = comp['col']
            try:
                ro = row[base_col + 3] if base_col + 3 < len(row) else 0
                comm = row[base_col + 1] if base_col + 1 < len(row) else 0
                decomm = row[base_col + 2] if base_col + 2 < len(row) else 0
            except IndexError:
                ro, comm, decomm = 0, 0, 0

            if pd.notna(ro) or pd.notna(comm) or pd.notna(decomm):
                records.append({
                    "start_date": start_date,
                    "to_date": to_date,
                    "zone": zone,
                    "state": place_str.title(),
                    "category": region_type,
                    "company": comp["name"],
                    "status": comp["status"],
                    "cng_outlet": ro if pd.notna(ro) else 0,
                    "ros_commissioned": comm if pd.notna(comm) else 0,
                    "ros_decommissioned": decomm if pd.notna(decomm) else 0,
                })

    final_df = pd.DataFrame(records)
    final_df['sbu'] = 'RETAIL'

    numeric_cols = ["cng_outlet", "ros_commissioned", "ros_decommissioned"]
    final_df[numeric_cols] = final_df[numeric_cols].apply(pd.to_numeric, errors='coerce').fillna(0).astype(float)

    final_df = final_df.fillna("").to_dict(orient="records")
    print('final_df: ',final_df)

    query = ''' DELETE FROM plant_cng_infra '''
    result = await urdhva_base.BasePostgresModel.execute_query(query)
    print(result)

    await PlantCngInfra.bulk_update(final_df, upsert=False)
    # await HistoricAVIATIONInfra.bulk_update(final_df, upsert=False)
    return 'Uploaded successfully'




# Action get_plant_cng_count_infra
@router.post('/get_plant_cng_count_infra', tags=['PlantCngInfra'])
async def plantcnginfra_get_plant_cng_count_infra(data: Plantcnginfra_Get_Plant_Cng_Count_InfraParams):
    return await plant_retail_functions.get_plant_cng_count_info(filters=data.filters, cross_filters=data.cross_filters,
                                                         drill_state=data.drill_state, limit=data.limit,
                                                         time_grain=data.time_grain)


# Action get_retail_company_cng_infra
@router.post('/get_retail_company_cng_infra', tags=['PlantCngInfra'])
async def plantcnginfra_get_retail_company_cng_infra(data: Plantcnginfra_Get_Retail_Company_Cng_InfraParams):
    return await plant_retail_functions.get_retail_company_cng_info(filters=data.filters, cross_filters=data.cross_filters,
                                                          drill_state=data.drill_state, limit=data.limit,
                                                          time_grain=data.time_grain)


# Action get_top_five_cng_infra
@router.post('/get_top_five_cng_infra', tags=['PlantCngInfra'])
async def plantcnginfra_get_top_five_cng_infra(data: Plantcnginfra_Get_Top_Five_Cng_InfraParams):
    return await plant_retail_functions.get_top_five_cng_info(filters=data.filters,
                                                                    cross_filters=data.cross_filters,
                                                                    drill_state=data.drill_state, limit=data.limit,
                                                                    time_grain=data.time_grain)


# Action get_distinct_cng_retail_infra
@router.post('/get_distinct_cng_retail_infra', tags=['PlantCngInfra'])
async def plantcnginfra_get_distinct_cng_retail_infra(data: Plantcnginfra_Get_Distinct_Cng_Retail_InfraParams):
    return await plant_retail_functions.get_distinct_cng_retail_info(data.sbu, data.company, data.zone, data.state,
                                                                    data.status)


# Action get_zone_wise_cng_infra
@router.post('/get_zone_wise_cng_infra', tags=['PlantCngInfra'])
async def plantcnginfra_get_zone_wise_cng_infra(data: Plantcnginfra_Get_Zone_Wise_Cng_InfraParams):
    return await plant_retail_functions.get_zone_wise_cng_info(filters=data.filters,
                                                              cross_filters=data.cross_filters,
                                                              drill_state=data.drill_state, limit=data.limit,
                                                              time_grain=data.time_grain)
