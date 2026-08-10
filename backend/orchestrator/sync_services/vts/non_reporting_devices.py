import io
import ast
import psycopg2
import asyncio
import datetime
import urdhva_base
import polars as pl
import pandas as pd
import charts_actions
import dashboard_studio_model
import hpcl_ceg_model as ceg_model
import orchestrator.dbconnector.credential_loader as credential_loader

logger = urdhva_base.Logger.getInstance("nrd_data")

async def db_insert(data: pl.DataFrame):
    logger.info("Inserting data to DB")
    try:
        creds = credential_loader.load_credentials("APP_DB_")
        conn = psycopg2.connect(
            host=creds['APP_DB_HOST'],
            database=creds['APP_DB_DB'],
            user=creds["APP_DB_USER"],
            password=creds["APP_DB_PASSWORD"]
        )
        cur = conn.cursor()
        buffer = io.StringIO()
        data.write_csv(buffer)
        buffer.seek(0)
        cur.copy_expert(
            "COPY public.non_reporting_devices FROM STDIN WITH CSV HEADER",
            buffer
        )
        conn.commit()
        cur.close()
        conn.close()
        logger.info("SUCCESSFULLY inserted Non Reporting Devices Data to DB")

    except Exception as e:
        print(f"error while inserting to db {e}")
        logger.error(f"ERROR while inserting Non Reporting Devices data to db {e}")

async def non_reporting_devices_data():
#  ims_id=3, vts_id=6, 162_db_id=1
    # connection for ims
    print("executing non reporting devices")
    try:
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)

        # get last scn number
        redis_ins = await urdhva_base.redispool.get_redis_connection()
        last_scn = await redis_ins.get("last_scn")
        scn_decoded = last_scn.decode("utf-8")
        last_scn = ast.literal_eval(scn_decoded)
        last_scn = int(last_scn)

        # get last loaded_on time
        last_loaded_on = await redis_ins.get("last_loaded_on")
        loaded_decoded = last_loaded_on.decode("utf-8")
        last_loaded_on = datetime.datetime.strptime(loaded_decoded, '%Y-%m-%d %H:%M:%S')

        # get latest scn from oracle db
        query = "SELECT CURRENT_SCN FROM V$DATABASE"
        latest_scn = await function(query=query)
        latest_scn = latest_scn[0]["CURRENT_SCN"]

        # get latest trucks with R3 swipe
        try:
            query = f"""SELECT
                           TRUCK_REGNO as "truck_regno",
                           CARD_DATE as "card_date",
                           CARD_TIME as "card_time",
                           TO_TIMESTAMP(
                           TO_CHAR(card_date, 'YYYYMMDD') ||
                           LPAD(REGEXP_REPLACE(card_time, '[^0-9]', ''), 6, '0'),
                           'YYYYMMDDHH24MISS'
                           ) AS "card_datetime",
                           READER_ID as "reader_id",
                           LOADED_ON as "loaded_on"
                       FROM IMS_SAP.TRUCK_SWIPE_ENTRY_SAP
                       WHERE ORA_ROWSCN > {last_scn}
                           AND ORA_ROWSCN <= {latest_scn}
                           AND READER_ID='R3'
                           AND LOADED_ON > TIMESTAMP '{last_loaded_on}'
                   """

            resp = await function(query=query)
            res_df = pl.DataFrame(resp)
            logger.info(f"SUCCESSFULLY retreived latest trucks with R3 swipe")
        except Exception as e:
            # return if query fails
            logger.error(f"ERROR while retreiving latest trucks with R3 swipe {e}")
            return False
        
        # set last_scn with latest_scn
        await redis_ins.set("last_scn", str(latest_scn))

        # set last_loaded_on with latest_loaded_on
        latest_loaded_on =  res_df.select(
        pl.col("loaded_on").max()
        ).item()
        await redis_ins.set("last_loaded_on", str(latest_loaded_on))

        # connection for vts_truck
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 5
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)

        truck_list = tuple(res_df['truck_regno'])
        if not truck_list:
            logger.info("No trucks found with R3 swipe")
            return

        try:
            # query to get trucks with non reporting device
            # removed  LOCATION_NAME as location_name from query
            query = f"""
            SELECT
               TRUCK_REGNO as truck_regno,
               LAST_CHECK_DATE as last_check_date,
               LAST_CHECK_TIME as last_check_time,
               LATITUDE as latitude,
               LONGITUDE as longitude,
               LOCATION as location
            FROM VTS_DEVICE_STATUS_HIST
            WHERE TRUCK_REGNO IN {truck_list}
               AND (
               CAST(LAST_CHECK_DATE AS DATETIME)
               + CAST(LAST_CHECK_TIME AS DATETIME)
               ) <= DATEADD(MINUTE, -30, GETDATE())
            """

            not_working_device_resp = await function(query=query)
            vts_device_df = pl.DataFrame(not_working_device_resp)
            
            # add column DEVICEWORKING and set it to 'N'
            vts_device_df = vts_device_df.with_columns(
                pl.lit("N").alias("device_working")
            )

            # add column completed_trip and set to default value 'open'
            vts_device_df = vts_device_df.with_columns(
                pl.lit("open").alias("completed_trip")
            )

            # add column completed_trip_auto_dc and set to default value 'open'
            vts_device_df = vts_device_df.with_columns(
                pl.lit("open").alias("completed_trip_auto_dc")
            )

            # convert longitutde and latitude to string
            vts_device_df = vts_device_df.with_columns([
                pl.col("latitude").cast(pl.Utf8),
                pl.col("longitude").cast(pl.Utf8)
            ])

            print("device data -->", vts_device_df)
            if not vts_device_df.is_empty():
                vts_device_df = vts_device_df.join(
                    res_df,
                    on="truck_regno",
                    how='left'
                )
                logger.info("SUCCESSFULLY retrieved trucks with Non Reporting Devices")
               
                # add bu zone location name
                dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 1
                dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
                function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)

                locations = tuple(vts_device_df['location'].unique().to_list())
                query = f"""
                    SELECT sap_id AS location, name as location_name, zone, bu
                    FROM public.location_master
                    WHERE sap_id in {locations}
                """
                lm_data = await function(query=query)
                lm_data_df = pl.DataFrame(lm_data)
                logger.info("SUCCESSFULLY retrieved bu, zone, location_name for all sap_id")
                if not lm_data_df.is_empty():
                    vts_device_df = vts_device_df.join(
                    lm_data_df,
                    on="location",
                    how='left'
                    )
                try:
                    logger.info("Inserting data into non_reporting_devices")
                    nrd_data = vts_device_df.to_dicts()
                    await ceg_model.NonReportingDevices.bulk_update(nrd_data, upsert=True)
                    return
                except Exception as e:
                    logger.error(f"error while inserting data to non_reporting_devices {e}")
                    return
            else:
                logger.info("no trucks found for non reporting devices")
                return
        except Exception as e:
            logger.error(f"ERROR while retreiving trucks with non reporting devices {e}")
            return
    except Exception as e:
        logger.error(f"ERROR while retreving non reporting devices data {e}")
        return


async def update_trip_status():
    try:
        # get open trucks from postgres table
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 1
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        query = f"""SELECT truck_regno, card_datetime FROM public.non_reporting_devices WHERE completed_trip='open' and completed_trip_auto_dc='open'; """
        try:
            truck_data_res =  await function(query=query)
            truck_data = pd.DataFrame(truck_data_res)
            truck_data_df = pl.from_pandas(truck_data)
        except Exception as e:
            return
        if not truck_data_df.is_empty():
            print("GET load_no. ship_to dealer code for each truck")
            # GET load_no. ship_to dealer code for each truck
            try:
                #truck_nos_clause = ",".join(f"('{v}')" for v in truck_data['truck_regno'])
                rows = []
                for i, truck in enumerate(truck_data_df['truck_regno']):
                   if i == 0:
                      rows.append(f"SELECT '{truck}' AS truck_no FROM dual")
                   else:
                      rows.append(f"SELECT '{truck}' FROM dual")
                truck_nos_clause = "\nUNION ALL\n".join(rows)
                print("tuck_no clause", truck_nos_clause)
                query = f"""
                        SELECT ip.JDE_TRUCK_NO AS "truck_regno", ip.SHIP_TO AS "ship_to", ip.JDE_TRUCK_LOADNO AS "loadno"
                        FROM IMS_SAP.INDENT_PRODUCTS ip
                        JOIN (
                            SELECT i.JDE_TRUCK_NO, MAX(i.INVOICE_DATE) AS max_date
                            FROM IMS_SAP.INDENT_PRODUCTS i
                            JOIN (
                                {truck_nos_clause}
                            ) v
                                ON i.JDE_TRUCK_NO = v.truck_no
                            GROUP BY i.JDE_TRUCK_NO
                        ) t
                        ON ip.JDE_TRUCK_NO = t.JDE_TRUCK_NO
                        AND ip.INVOICE_DATE = t.max_date
                """
        
                dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
                dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
                function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
                
                loadno_dealercode_resp = await function(query = query)
                loadno_dealercode = pl.DataFrame(loadno_dealercode_resp)

                if loadno_dealercode.is_empty():
                    logger.warning("no load number and ship to dealer code found for trucks")
                    return

            except Exception as e:
                logger.error(f"ERROR while retrieving latest loadno and ship_to dealer code {e}")

            # Updating trip status from completed_trip table
            logger.info("CHECKING TRIP STATUS FROM COMPLETED_TRIP TABLE")
            
            # joining load_no, ship_to dealer code with card date
            print("joining load_no, ship_to dealer code with card date")
            truck_data = loadno_dealercode.join(
                truck_data_df,
                on='truck_regno',
                how='left'
            )
            # clause with truck name, r3 swipe datetime, loadno and ship_to(dealer code)
            truck_data_clause = ",".join(
                f"('{truck_regno}', '{card_datetime.strftime('%Y-%m-%d %H:%M:%S')}', '{loadno}', '{dealer_code}')"
                for truck_regno, card_datetime, loadno, dealer_code in zip(
                    truck_data['truck_regno'],
                    truck_data['card_datetime'],
                    truck_data['loadno'],
                    truck_data['ship_to']
                )
                if pd.notna(card_datetime)
            )

            # connection for vts_truck
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 5
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)

            #query to check if trip is completed for each truck from completed_trips table
            query = f"""
                    WITH truck_r3_swipe_data(vehicle_rto_no, card_date, loadno, ship_to) AS (
                    SELECT 
                        v.vehicle_rto_no,
                        v.card_date,
                        v.loadno,
                        v.ship_to
                    FROM (VALUES
                        {truck_data_clause}
                        ) v(vehicle_rto_no, card_date, loadno, ship_to)
                    )
                    SELECT 
                    c.vehicle_rto_no,
                    t.card_date
                    FROM completed_trip c
                    JOIN truck_r3_swipe_data t
                    ON c.vehicle_rto_no = t.vehicle_rto_no
                    WHERE CAST(c.RET_DEPOT_IN AS DATE) >= CAST(t.card_date AS DATE)
                    AND c.LOADNO = t.loadno
                    AND c.TRIP_NAME LIKE '%' + t.ship_to + '%';
                """
            
            trip_completed_resp = await function(query=query)
            completed_trips = pl.DataFrame(trip_completed_resp)

            # trucks_completed_trips = tuple(completed_trips['vehicle_rto_no'])

            logger.info(f"CHECKING TRIP STATUS FROM AUTO_DC TABLE")
            #connection for ims
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
            
            # clause for auto_dc_requests table
            rows = []
            for truck, loadno, card_datetime in zip(truck_data['truck_regno'], truck_data['loadno'], truck_data['card_datetime']):
                rows.append(
                    f"SELECT '{truck}', '{loadno}', '{card_datetime}' FROM dual"
                )
            auto_dc_clause = "\nUNION ALL\n".join(rows)
            
            # query to check if trip is completed for each truck from auto_dc_requests table
            query = f"""
                   WITH truck_data (truck_no, loadno, card_datetime ) AS (
                   {auto_dc_clause}
                   )
                   SELECT t.truck_no as "truck_regno",
                       t.card_datetime as "card_datetime"
                   FROM IMS_SAP.AUTO_DC_REQUESTS a
                   JOIN truck_data t
                       ON a.LOAD_NO = t.loadno
               """
    
            trip_completed_resp = await function(query=query)
            auto_completed_trips = pl.DataFrame(trip_completed_resp)
           
            logger.info("UPDATING TRIP STATUS")
            
            # update completed trip status
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 1
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
            
            if not completed_trips.is_empty():
                completed_trip_clause = ",".join(
                        f"('{k}', '{v}')"
                        for k, v in zip(completed_trips['vehicle_rto_no'], completed_trips['card_date'])
                    )
                completed_trip_query = f"""
                        UPDATE public.non_reporting_devices t
                        SET completed_trip = 'closed'
                    FROM (
                        VALUES
                        {completed_trip_clause}
                        ) AS v(truck_no, card_date)
                    WHERE t.truck_regno = v.truck_no
                    AND t.card_datetime = v.card_date::timestamp;
                """
                
                await function(query=completed_trip_query)
            else:
                print("data is empty completed trips")
            
            if not auto_completed_trips.is_empty():
                completed_auto_dc_clause = ",".join(
                    f"('{k}', '{v}')"
                    for k, v in zip(auto_completed_trips['truck_regno'], auto_completed_trips['card_datetime'])
                )
                completed_auto_dc_query = f"""
                UPDATE public.non_reporting_devices t
                    SET completed_trip_auto_dc = 'closed'
                FROM (
                    VALUES
                    {completed_auto_dc_clause}
                    ) AS v(truck_no, card_date)
                WHERE t.truck_regno = v.truck_no
                AND t.card_datetime = v.card_date::timestamp;
                """
                await function(query=completed_auto_dc_query)
            return
        logger.warning("NO data found with open trips")
        return 
    except Exception as e:
        print(e)
        logger.error(f"ERROR While updating trip status")

async def main():
    await non_reporting_devices_data()
    await update_trip_status()

if __name__ == '__main__':
    asyncio.run(main())
