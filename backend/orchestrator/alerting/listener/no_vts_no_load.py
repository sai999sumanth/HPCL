import urdhva_base
import asyncio
import datetime
import httpx
import pyodbc
import hpcl_ceg_model
import polars as pl
import utilities.helpers as helpers
import orchestrator.alerting.alert_manager as alert_manager
import orchestrator.dbconnector.credential_loader as credential_loader

class VTSNoLoadAlert:
    def __init__(self):
        """
        Initializes the VTSNoLoadAlert class.
        """
        self.connection = None

    async def get_connection(self):
        """
        Establishes and returns a connection to the VTS_TRACK_DB database.
        If a connection already exists, it returns the existing connection.
        """
        if self.connection:
            return self.connection
        creds = credential_loader.get_credentials('VTS_TRACK_DB')
        self.connection = pyodbc.connect(
            'DRIVER={ODBC Driver 18 for SQL Server};'
            f'Server={creds['host']},{creds['port']};'
            f'Database={creds['database']};'
            f'UID={creds['user']};'
            f'PWD={creds['password']};'
            'TrustServerCertificate=yes;MARS_Connection=yes;',
        )
        return self.connection

    async def close_connection(self):
        """
        Closes the database connection if it exists.
        """
        if self.connection is not None:
            try:
                self.connection.close()
            except Exception as e:
                print(f"Exception while closing connection: {e}")
    
    async def create_alerts(self, alerts_to_create):
        for alert in alerts_to_create:

            query = f"""
                        SELECT * FROM alerts 
                        WHERE alert_section='VTS' 
                        AND vehicle_number='{alert['TRUCK_REGNO']}'
                        AND vehicle_unblocked_date is null
                    """
            nrd_alert_data_ = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
            nrd_alert_data = nrd_alert_data_.get('data',[])
            if nrd_alert_data:
                print(f"Alert Already Created For This Vehicle: {alert['TRUCK_REGNO']}")
                continue

            entry = {
                "vehicle_number": alert['TRUCK_REGNO'],
                "last_check_date": alert['LAST_CHECK_DATE'],
                "last_check_time": alert['LAST_CHECK_TIME'],
                "reported_at": f"{alert['LAST_CHECK_DATE']} {alert['LAST_CHECK_TIME']}",
                "latitude": alert['LATITUDE'],
                "longitude": alert['LONGITUDE'],
                "bu": alert['location_type'],
                "tt_type": alert['tt_type'],
                "sap_id": alert['location'],
                "alert_section": 'VTS'
            }
            print('*'*200)
            print('entry',entry)
            print('*'*200)
            await alert_manager.create_alert({**entry, "alert_type": "NRD"})
    
    async def close_alerts(self, alerts_to_close):
        for alert in alerts_to_close:
            query = f"""
                        SELECT * FROM alerts 
                        WHERE alert_section='VTS' 
                        AND vehicle_number='{alert['TRUCK_REGNO']}'
                        AND vehicle_unblocked_date is null
                        AND interlock_name = 'No VTS No Load'
                    """
            nrd_alert_data_ = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
            nrd_alert_data = nrd_alert_data_.get('data',[])
            if not nrd_alert_data:
                print(f"Alert Not Found For Vehicle {alert['TRUCK_REGNO']}")
                continue

            messaged_data = {
                "messageName": "Unblock",
                "businessKey": nrd_alert_data[0].get('unique_id','')
            }
            # print("messaged_data: ", messaged_data)
            # Posting data to camunda
            url = await helpers.get_camunda_url(
                bu=nrd_alert_data[0].get('bu',''),
                sap_id=nrd_alert_data[0].get('sap_id',''),
                alert_section=nrd_alert_data[0].get('alert_section','')
            )
            # url = urdhva_base.settings.camunda_url + "/engine-rest/message"
            url += "/engine-rest/message"
            print("url: ", url)
            r = httpx.post(url, headers={'Content-Type': 'application/json'}, json=messaged_data, verify=False)

            if int(r.status_code / 100) != 2:
                print(f"Error while sending message to camunda: {r.status_code} - {r.text} - {nrd_alert_data[0].get('unique_id','')}")
            else:
                print("Message sent to camunda")
        return "Successfull"

    async def create_nrd_alerts(self, alerts_df):
        """
        Identifies trucks with non-working VTS devices that do not have an existing open alert.
        Args:
            alerts_df (pl.DataFrame): A DataFrame containing existing open alerts.
        """
        query = f"""SELECT TRUCK_REGNO, LAST_CHECK_DATE, LAST_CHECK_TIME, LATITUDE, LONGITUDE, 
        location_type, tt_type, location from VTS_DEVICE_STATUS_HIST 
        where DEVICEWORKING='N' and location not like '500%' order by LAST_CHECK_DATE desc"""
        connection = await self.get_connection()
        cursor = connection.cursor()
        cursor.execute(query)
        data = cursor.fetchall()
        columns = [column[0] for column in cursor.description]
        resp = [dict(zip(columns, row)) for row in data]
        df_vts = pl.DataFrame(resp)

        business_units = ['TAS','LPG']

        for bu in business_units:
            if bu in ['TAS']:
                df_filtered = df_vts.filter(pl.col("location_type") == "TAS")
                continue

            if bu in ['LPG']:
                df_filtered = df_vts.filter(
                    (pl.col("location_type") == "LPG") &
                    (pl.col("location").cast(pl.Utf8).str.starts_with("2"))
                )
            
            # If nothing to process, skip safely
            if df_filtered.is_empty():
                continue

            if not alerts_df.is_empty():
                existing_alert_vehicles = alerts_df['vehicle_number'].to_list()
                unmatched_df = df_filtered.filter(~pl.col('TRUCK_REGNO').is_in(existing_alert_vehicles))
                alerts_to_create = unmatched_df.to_dicts()
            else:
                unmatched_df = df_filtered
                alerts_to_create = unmatched_df.to_dicts()
                if alerts_to_create and len(alerts_to_create) > 0:
                    # print("*"*200)
                    # print('alerts_to_create',alerts_to_create)
                    # print('*'*200)
                    await self.create_alerts(alerts_to_create)
                    print(
                        'Total Alerts to create :', len(alerts_to_create)
                    )

    async def close_nrd_alerts(self, alerts_df):
        """
        Identifies existing open alerts for trucks where the VTS device is now working.
        Args:
            alerts_df (pl.DataFrame): A DataFrame containing existing open alerts.
        """
        query = f"""SELECT TRUCK_REGNO from VTS_DEVICE_STATUS_HIST 
                where DEVICEWORKING='Y' and location not like '500%'"""
        connection = await self.get_connection()
        cursor = connection.cursor()
        cursor.execute(query)
        data = cursor.fetchall()
        columns = [column[0] for column in cursor.description]
        resp = [dict(zip(columns, row)) for row in data]
        df_vts = pl.DataFrame(resp)
        alerts_to_close = []
        if not alerts_df.is_empty():
            existing_alert_vehicles = alerts_df['vehicle_number'].to_list()
            alerts_to_close_df = df_vts.filter(pl.col('TRUCK_REGNO').is_in(existing_alert_vehicles))
            alerts_to_close = alerts_to_close_df.to_dicts()
        
        if alerts_to_close and len(alerts_to_close) > 0:
            # print("*"*200)
            # print('alerts_to_close',alerts_to_close)
            # print('*'*200)
            await self.close_alerts(alerts_to_close)
            print(
                'Total Alerts to close :', len(alerts_to_close)
            )

    async def get_open_alerts(self):
        """
        Fetches all open 'No VTS No Load' alerts from the alerts system.
        Returns:
            pl.DataFrame: A DataFrame containing the open alerts.
        """
        alerts_query = f"""select id,vehicle_number from alerts where alert_section='VTS' and alert_status='Open' 
                and interlock_name='No VTS No Load'"""
        alerts_data = await hpcl_ceg_model.Alerts.get_aggr_data(alerts_query, limit=0)
        alerts_df = pl.DataFrame(alerts_data['data'])
        return alerts_df

    async def sync_nrd_alerts(self):
        """
        Orchestrates the VTS alert synchronization process.
        It fetches open alerts, identifies alerts to be created, and identifies alerts to be closed.
        """
        alerts_df = await self.get_open_alerts()
        await self.create_nrd_alerts(alerts_df)
        await self.close_nrd_alerts(alerts_df)


if __name__ == "__main__":
    asyncio.run(VTSNoLoadAlert().sync_nrd_alerts())
