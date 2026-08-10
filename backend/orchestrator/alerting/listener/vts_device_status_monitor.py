import urdhva_base
import httpx
import pyodbc
import asyncio
import datetime
import psycopg2
import traceback
import pandas as pd
import hpcl_ceg_model
import cache_gateway.cache_api_actions as cache_api_actions
from orchestrator.alerting.alert_manager import create_alert
import orchestrator.dbconnector.credential_loader as credential_loader

class VtsDeviceStatusMonitor:
    def __init__(self) -> None:
        ...


    def get_db_connection(self):
        """
        Establish a database connection
        Args:
            connection_string (str): Database connection string
        Returns:
            pyodbc connection
        """
        creds = credential_loader.get_credentials('VTS_TRACK_DB')
        connection = pyodbc.connect(
                'DRIVER={ODBC Driver 18 for SQL Server};'
                f'Server={creds['host']},{creds['port']};'
                f'Database={creds['database']};'
                f'UID={creds['user']};'
                f'PWD={creds['password']};'
                'TrustServerCertificate=yes;MARS_Connection=yes;',
            )
        return connection
    

    def fetch_data(self, cursor, query, getData=False, params=None):
        """
        Fetch data from database using a SQL query
        Args:
            cursor (pyodbc cursor): Database cursor
            query (str): SQL query to execute
        Returns:
            pandas DataFrame
        """
        if params:
            pg_conn = psycopg2.connect(
                    host=params["host"],
                    database=params["database"],
                    user=params["user"],
                    password=params["password"],
                    port=params["port"]
                )
            cursor = pg_conn.cursor()
            
        print("-" * 50)
        print("query -->", query)
        print("-" * 50)
        print("Running Query ...")
        cursor.execute(query)
        if getData:
            data = cursor.fetchall()
            print('Total Records :', len(data))
            columns = [column[0] for column in cursor.description]
            data = pd.DataFrame.from_records(data, columns=columns)
            return data
        if params:
            pg_conn.commit()
            cursor.close()
            pg_conn.close()


    async def create_device_alert(self):
        connection = self.get_db_connection()
        cursor = connection.cursor()
        query = """ SELECT * FROM VTS_DEVICE_STATUS_HIST """
        vts_data = self.fetch_data(cursor, query, getData=True)

        print("-"*50)
        print("----- vts status data -----")
        print(vts_data)
        print("-"*50)

        alert_query = """ SELECT id as alert_id, vehicle_number FROM alerts where alert_section='VTS' and alert_status='Open' and violation_type='NRD' """
        
        creds = credential_loader.get_credentials('APP_DB')
        params={
                "host": creds["host"],
                "database": creds["database"],
                "user": creds["user"],
                "password": creds["password"],
                "port": creds["port"]
                }
        alert_data = self.fetch_data(cursor=None, query=alert_query, getData=True, params=params)
        print("-"*50)
        print("-------- alert_data --------")
        print(alert_data)
        print("-"*50)

        print("Before Merge :",len(vts_data))
        vts_data = pd.merge(vts_data, alert_data, left_on=["TRUCK_REGNO"], right_on=["vehicle_number"], how="left", indicator=True)
        print("After Merge :",len(vts_data))

        vts_data["alert_closure"] = False
        vts_data["alert_creation"] = False

        vts_data.loc[(vts_data["_merge"] == "both") & (vts_data["DEVICE_WORKING"].fillna("") == "Y"), "alert_closure"] = True
        vts_data.loc[(vts_data["_merge"] != "both") & (vts_data["DEVICE_WORKING"].fillna("") == "N"), "alert_creation"] = True
        
        for data in vts_data.to_dict(orient="records"):
            if data.get("alert_closure"):
                alert_data = {}
                alert_data["id"] = data["alert_id"]
                alert_data["alert_status"] = "Close"
                alert_data["alert_state"] = "Resolved"

                alert_data["alert_history"] = data["alert_history"].append(
                    {
                        "action_msg": "Device is being connected. Closing the Alert",
                        "action_type": "Resolved",
                        "processed_time": datetime.datetime.now()
                    }
                )
                alert_object = hpcl_ceg_model.Alerts(**alert_data)
                await alert_object.modify()
            elif data.get("alert_creation"):
                truck_details = f"SELECT sap_id, bu FROM vts_truck_details WHERE truck_regno='{data.get('TRUCK_REGNO')}'"
                truck_details = self.fetch_data(cursor=None, query=truck_details, getData=True, params=params)
                if not truck_details.empty:
                    truck_details = truck_details.iloc[0].to_dict() 
                else:
                    truck_details = {}

                _, location_data = await cache_api_actions.get_location_data(
                    bu=truck_details.get("bu", ""),
                    location_id=truck_details.get("sap_id", "")
                    )
                alert_data = {}
                alert_data["violation_type"] = "NRD"
                alert_data["bu"] = truck_details.get("bu", "")
                alert_data["sap_id"] = truck_details.get("sap_id", "")
                alert_data["interlock_name"] = "VTS NRD"
                alert_data["sop_id"] = "SOP100"
                alert_data["vehicle_number"] = data["TRUCK_REGNO"]
                alert_data["alert_status"] = "Open"
                alert_data["alert_state"] = "InProgress"
                alert_data["location_name"] = location_data.get("name", "")
                alert_data["zone"] = location_data.get("zone", "")
                alert_data["region"] = location_data.get("region", "")
                alert_data["state"] = location_data.get("state", "")
                alert_data["city"] = location_data.get("city", "")
                alert_data["severity"] = "Medium"

                alert_data["alert_history"] = [
                    {
                        "action_msg": "Device is not being connected. Creating the Alert",
                        "action_type": "Created",
                        "processed_time": datetime.datetime.now()
                    }
                ]
                async with httpx.AsyncClient(verify=False) as client:
                    base_url = f"http://{urdhva_base.settings.cache_gateway_host}:{urdhva_base.settings.cache_gateway_port}"
                    resp = await client.get(
                        f"{base_url}/api_cache/v1/get_unique_alert_id", 
                        params={
                            "bu": alert_data["bu"], 
                            "sap_id": alert_data["sap_id"], 
                            "sop_id": alert_data["sop_id"]
                            })

                    if resp.status_code // 100 == 2:
                        unique_id = resp.text.strip('"')

                alert_data["unique_id"] = unique_id
                await hpcl_ceg_model.AlertsCreate(**alert_data).create()


if __name__ == "__main__":
    ins = VtsDeviceStatusMonitor()
    asyncio.run(ins.create_device_alert())