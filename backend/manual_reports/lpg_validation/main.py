import urdhva_base
import psycopg2
import pandas as pd
import polars as pl
import asyncio
import sys
sys.path.append("/opt/ceg/algo")
import hpcl_ceg_model
from checking_ import process_plant_concurrent


async def connect_to_plant_db(plant_ip='10.2.36.41',plant_port=5432,plant_db_name='postgres',plant_db_user='filling',plant_db_password='ccc'):
    conn = psycopg2.connect(host=plant_ip, port=plant_port, dbname=plant_db_name, user=plant_db_user, password=plant_db_password)
    return conn

async def run_on_plant_db(details):
    query = f"""
        SELECT sap_id, plant_name, ip_address, port_no, username, password, db_name, db_type
        FROM lpg_plants_master
        WHERE sap_id = '{details["sap_id"]}'
    """
    result = await hpcl_ceg_model.LpgPlantsMaster.get_aggr_data(query=query, limit=1)
    data = result.get("data", [])[0] if result and result.get("data") else {}
    password = data.get("password", "")
    if password and str(password).startswith("enc#_"):
        password = urdhva_base.types.Secret(password).get_secret()
    plant_conn = await connect_to_plant_db(
        data["ip_address"], data["port_no"], data["db_name"], data["username"], password)
    data = await process_plant_concurrent(data,details,plant_conn,True)
    return data

async def run_on_novex_db(details):
    query = f"select * from lpg_plant_operations where sap_id = '{details['sap_id']}' and process_date::date = '{details['date']}'"
    data = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)
    data = data['data']
    return data

async def process_rejections(df):
    cs_df = df.copy()
    gd_df = df.copy()
    pt_df = df.copy()

    # --- CS ---
    cs_rejections = (
        cs_df.groupby(['location_name', 'zone'])[['cs_handled', 'cs_sortout']]
            .sum()
            .reset_index()
    )

    cs_rejections['rejection'] = (cs_rejections['cs_sortout'] / cs_rejections['cs_handled']) * 100
    cs_rejections['rejection_type'] = "cs_rejections"


    # --- GD ---
    gd_rejections = (
        gd_df.groupby(['location_name', 'zone'])[['gd_handled', 'gd_sortout']]
            .sum()
            .reset_index()
    )

    gd_rejections['rejection'] = (gd_rejections['gd_sortout'] / gd_rejections['gd_handled']) * 100
    gd_rejections['rejection_type'] = "gd_rejections"


    # --- PT ---
    pt_rejections = (
        pt_df.groupby(['location_name', 'zone'])[['pt_handled', 'pt_sortout']]
            .sum()
            .reset_index()
    )

    pt_rejections['rejection'] = (pt_rejections['pt_sortout'] / pt_rejections['pt_handled']) * 100
    pt_rejections['rejection_type'] = "pt_rejections"


    # --- Combine ---
    df = pd.concat([cs_rejections, gd_rejections, pt_rejections], ignore_index=True)
    rej = (
        df.pivot_table(
            index="location_name",
            columns="rejection_type",
            values="rejection",
            aggfunc="first"          # Each type has one row, so this is safe
        )
        .reset_index()
    )

    return rej

async def process_total_production(df):
    # --- Production & Productivity Aggregation ---
    results = (
        df[['location_name', 'total_production', 'total_productivity']]
        .groupby('location_name')
        .agg({
            'total_production': 'sum',
            'total_productivity': 'sum'
        })
        .reset_index()
    )

    # Compute productivity
    results["total_productivity"] = (
        results["total_productivity"] / len(results)
    )

    return results


async def main(details):

    # Fetch data
    novex_data = await run_on_novex_db(details)
    print("Novex Data:", novex_data)

    # Convert list of dicts to pandas DataFrame
    novex_df = pd.DataFrame(novex_data)

    # --- Process Rejections ---
    novex_rejections = await process_rejections(novex_df)

    # --- Process Total Production ---
    novex_results = await process_total_production(novex_df)
    novex_final_df = novex_results.merge(novex_rejections, on="location_name", how="left")

    print("\nFINAL SINGLE ROW OUTPUT:\n", novex_final_df)

    # Fetch Plant Data
    plant_data = await run_on_plant_db(details)
    plant_df = pd.DataFrame(plant_data)

    plant_rejections = await process_rejections(plant_df)
    plant_results = await process_total_production(plant_df)

    plant_final_df = plant_results.merge(plant_rejections, on="location_name", how="left")

    # Combine Novex and Plant Data
    novex_final_df["source"] = "novex"
    plant_final_df["source"] = "plant"

    final_df = pd.concat([novex_final_df, plant_final_df], ignore_index=True)

    # ---- ROUNDING ----
    cols_to_round = [
        "total_production",
        "total_productivity",
        "productivity",
        "cs_rejections",
        "gd_rejections",
        "pt_rejections"
    ]

    final_df[cols_to_round] = final_df[cols_to_round].astype(float).round(2)

    return final_df


if __name__ == "__main__":
    # change sap_id and date accordingly for checking particular plant at particular date
    details = {
        'sap_id':2539,
        'date': '2025-12-02',
    }
    print(asyncio.run(main(details)))


