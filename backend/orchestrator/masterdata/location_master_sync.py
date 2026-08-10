import pandas

import urdhva_base
import orchestrator.connection_vault.database.mssql as mssql


def get_tibco_connection_details():
    params = {}
    if not urdhva_base.settings.db_urls.get('tibco'):
        return params
    url = urdhva_base.settings.db_urls['tibco'][0]
    params.update({"user_name": url.username, "password": url.password, "host": url.host, "port": url.port})
    return params


async def get_db_connection():
    credentials = get_tibco_connection_details()
    if not credentials:
        return None
    return mssql.Mssql(credentials).get_connection()


async def fetch_locations():
    locations_data = []


async def get_sod_locations():
    locations = []
    query = "SELECT * from PS.EDW_PLANT_DIM where  CODE2='O&D' and PLANT_CD like '1%' ORDER BY "
    conn = get_db_connection()
    if not conn:
        return locations
    while True:
        await conn.get_data(schema_name=None, table_name=None, query=query, limit=1000)


async def get_ret_locations():
    ...


async def get_lpg_locations():
    ...


async def sync_ro_master(file_path):
    keys_rename = {"Zone": "", "Region": "", "Sales Area": "", "RO Code": "bu_id",
                   " RO SAP Code": "LOCATION_ID",
                   "RO Name": "", "Project Phase": "", "Vendor": "", "RO Type": "", "RO Category": "",
                   "Head Office": "", "Address": "", "City": "", "District": "", "State": "", "Pin Code": "",
                   "Location Type": "", "Dealer Name": "", "Dealer Phone No": "", "Dealer Mobile No": "",
                   "HPCL Email": "", "Explosive Reg": "", "Tin No.": "", "VSAT ID": "", "IP": "", "VSAT": "",
                   "VSAT IP": "", "Updated By": "", "Updated Date": "", "Last RO Communicated Date": "",
                   "RO Status": "", "FZD Status": ""}
    df = pandas.read_csv(file_path)
    initial_rename = {}
    for column in list(df.columns):
        if column != column.strip():
            initial_rename[column] = column.strip()
    if initial_rename:
        df = df.rename(columns=initial_rename)




