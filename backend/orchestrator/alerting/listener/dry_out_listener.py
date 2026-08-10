import urdhva_base
import asyncio
import math
import json
import os
import traceback
import jinja2
import pytz
import datetime
import polars as pl
import hpcl_ceg_model
import urdhva_base.redispool
import orchestrator.alerting.alert_helper as alert_helper
import utilities.connection_mapping as connection_mapping
from charts_actions import charts_connection_vault_routing
from orchestrator.alerting.alert_manager import create_alert
import orchestrator.analytics.dry_out_analysis as dry_out_analysis
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams
from orchestrator.actions.indent_dry_out import IndentDryOut as indent_dry_out
import utilities.minio_connector as minio_connector
import orchestrator.notification_manager.notification_factory


logger = urdhva_base.Logger.getInstance("dryout_listener.log")

class DryoutCollector:
    @classmethod
    def assign_values_to_dataframe(cls, df, values):
        """
        Assigning camunda urls equally for each flow
        :param df:
        :param values:
        :return:
        """
        n = len(df)
        if n == 0:
            df = df.with_columns(pl.Series("camunda_listener", []))
            return df
        if n <= 10:
            assigned_values = values[:n]
        else:
            repeats = math.ceil(n / len(values))
            assigned_values = (values * repeats)[:n]
        df = df.with_columns(pl.Series("camunda_listener", assigned_values))
        return df

    @classmethod
    def get_product_codes(cls, product_name):
        _mapping_code = {
            "MS": "2811000",
            "HSD": "2812000",
            "TURBO": "3912000",
            "E20": "2822000",
            "POWER 95": "3672000",
            "POWER 99": "2816000",
            "POWER 100": "3373000"
        }
        return _mapping_code.get(product_name.upper(), "")

    @classmethod
    async def get_dry_out_data(cls):
        try:
            redis_queue = urdhva_base.redispool.RedisQueue('dry_out_camunda_queue')
            # Query to fetch dry out locations, intraday dry-out and potential dry out location
            # Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("cris", "2")
            # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
            charts_ins = Charts_Connection_Vault_RoutingParams(
                connection_id=connection_mapping.connection_mapping.get("cris", "2"),
                action='execute_query'
            )
            function = await charts_connection_vault_routing(charts_ins)
            schema = connection_mapping.schema_mapping.get("cris", "public")
            table = connection_mapping.table_mapping.get("dry_out", "")
            query = f'''select site_id, fcc_code, item_name,item_name product_grp, rosapcode, tank_no, status, tank_cnt
                        from (
                                select site_id, fcc_code,product_grp item_name,count(distinct tank_no) tank_cnt, 
                                rosapcode, STRING_AGG(CAST(tank_no AS TEXT), ',') tank_no,
                                case when sum(case when pumpable_Stock>=0 then pumpable_Stock else 0 end) <=0 then 1 
                                when sum(case when pumpable_Stock>=0 then pumpable_Stock else 0 end) < 
                                (sum(sch.avgsales_7days)/7) then 2
                                when sum(case when pumpable_Stock>=0 then pumpable_Stock else 0 end) >= 
                                (sum(sch.avgsales_7days)/7) and sum(case when pumpable_Stock>=0 
                                then pumpable_Stock else 0 end) <= (sum(sch.avgsales_7days)/7)*3 then 3
                                when sum(case when pumpable_Stock>=0 then pumpable_Stock else 0 end) > 
                                (sum(sch.avgsales_7days)/7)*3 and sum(case when pumpable_Stock>=0 then 
                                pumpable_Stock else 0 end) <=(sum(sch.avgsales_7days)/7)*6 then 4 
                                else 5 end status
                                from "{schema}".{table} sch
                                where sch.volume>0
                                group by site_id, fcc_code, product_grp,rosapcode
                                order by site_id, fcc_code, product_grp
                            ) result1
            '''
            # records = await function(schema_name=schema, table_name=table, query=query)
            records = await function(query=query)
            for rec in records:
                rec['product_no'] = cls.get_product_codes(rec['item_name'])
            dry_out_data = pl.DataFrame(records)
            records = pl.DataFrame(records)
            # records = records.filter(~pl.col("indent_status").is_in(['Raised', 'Completed']))
            records = records.unique(subset=['site_id', 'fcc_code', 'item_name', 'product_no'], keep='first')
            # potential_records = records.filter(pl.col('status') > 2)
            records = records.filter(pl.col('status') <= 2)
            records = cls.assign_values_to_dataframe(records,
                                                    list(connection_mapping.camunda_listener_mapping.values()))
            records = records.to_dicts()

            alert_data = {
                'bu': 'RO',
                'alert_type': 'RO',
                'sop_id': 'SOP293',
                'interlock_name': 'Dry Out Triggering Flow',
                'sap_id': '',  # location_id
                'product_code': '',
                'indent_no': '',
                'dealer_id': '',
                'severity': "",
                'workflow_datetime': '',
                'terminal_plant_id': '',
                'connection_name': 'ims'
            }

            _mapping = await indent_dry_out().prod_code_mapping()

            for _dry in records:
                _dry['indent_status'] = 'Raised'
                status = _dry['status']
                # alert_data['product_code'] = _dry['product_no']
                alert_data['product_code'] = _mapping.get(_dry['item_name'], _dry['product_no'])
                alert_data['sap_id'] = _dry['rosapcode']
                alert_data['device_id'] = str(_dry['tank_no'])
                alert_data['device_name'] = "Tank"
                alert_data[
                    'severity'] = 'Critical' if status == 1 else 'High' if status == 2 else 'Medium' if status == 3 else 'Low'
                status, location_data = await alert_helper.get_location_details("RO", _dry['rosapcode'])
                if location_data.get("category") == 'R01':
                    alert_data['severity'] = 'Critical'
                alert_data['indent_no'] = ''
                alert_data['dealer_id'] = _dry['rosapcode']
                alert_data['workflow_datetime'] = (datetime.datetime.now(datetime.UTC).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3]
                                                + "Z")
                alert_data['terminal_plant_id'] = ''
                alert_data['camunda_host'] = _dry['camunda_listener']['host']
                alert_data['camunda_port'] = _dry['camunda_listener']['port']
                alert_data['dry_out_in_days'] = str(_dry['status'])
                await redis_queue.put(json.dumps(alert_data))

            # Get all open dry out history details
            # Compare with dry out records -> if not there for product and location id close and update end_time
            # Closed alerts day wise unique by sap_id and product -> Create Close
            query = f"SELECT id, sap_id, product_no, dry_out_in_days from dry_out_history where status='Open'"
            dry_out_history = await hpcl_ceg_model.DryOutHistory.get_aggr_data(query, limit=50000)
            dry_out_hist_data = {f"{rec['sap_id']}_{rec['product_no']}": rec for rec in dry_out_history['data']}
            dry_out_alert = {f"{rec['rosapcode']}_{rec['product_no']}": rec for rec in records}
            closed_alerts = list(set(list(dry_out_hist_data.keys())) - set(list(dry_out_alert.keys())))
            closed_ids = list({dry_out_hist_data[key]['id'] for key in closed_alerts})
            # for index in range(0, len(closed_ids), 1000):
            #     ids = [f"{key}" for key in closed_ids[index:index+1000]]
            #     conditions = [f"id in {tuple(ids)}" if len(ids) > 1 else f"id={ids[0]}"]
            #     query = (f"Update dry_out_history set "
            #              f"status='Close',end_time='{datetime.datetime.now(tz=datetime.timezone.utc)}' "
            #              f"where {' AND '.join(conditions)}")
            #     await hpcl_ceg_model.DryOutHistory.update_by_query(query)

            # await dry_out_analysis.update_dry_out_from_cris(records)
            for index in range(0, len(closed_ids), 1000):
                batch_ids = closed_ids[index:index+1000]
                ids_1 = []
                ids_2 = []
                ids_3 = []
                for cid in batch_ids:
                    # Find the key corresponding to this id in dry_out_hist_data
                    key = next(k for k, v in dry_out_hist_data.items() if v['id'] == cid)
                    dry_out_in_days = dry_out_hist_data[key].get('dry_out_in_days','')
                    if dry_out_in_days == '1':
                        ids_1.append(cid)
                    elif dry_out_in_days == '2':
                        ids_2.append(cid)
                    else:
                        ids_3.append(cid)
                now_utc = datetime.datetime.now(tz=datetime.timezone.utc)
                # Update for dry_out_in_days == '1'
                if ids_1:
                    ids_text = tuple(ids_1) if len(ids_1) > 1 else f"('{ids_1[0]}')"
                    query = (
                        f"UPDATE dry_out_history SET "
                        f"status='Close', "
                        f"end_time='{now_utc}', "
                        f"dry_out_end_time='{now_utc}' "
                        f"WHERE id IN {ids_text}"
                    )
                    await hpcl_ceg_model.DryOutHistory.update_by_query(query)
                # Update for dry_out_in_days == '2'
                if ids_2:
                    ids_text = tuple(ids_2) if len(ids_2) > 1 else f"('{ids_2[0]}')"
                    query = (
                        f"UPDATE dry_out_history SET "
                        f"status='Close', "
                        f"end_time='{now_utc}', "
                        f"intra_day_dry_out_end_time='{now_utc}' "
                        f"WHERE id IN {ids_text}"
                    )
                    await hpcl_ceg_model.DryOutHistory.update_by_query(query)
                if ids_3:
                    ids_text = tuple(ids_3) if len(ids_3) > 1 else f"('{ids_3[0]}')"
                    query = (
                        f"UPDATE dry_out_history SET "
                        f"status='Close', "
                        f"end_time='{now_utc}' "
                        f"WHERE id IN {ids_text}"
                    )
                    await hpcl_ceg_model.DryOutHistory.update_by_query(query)
            # await dry_out_analysis.mark_as_false_for_potential_records(potential_records)
            dry_ou_days = [1, 2]
            ist = pytz.timezone('Asia/Kolkata')
            sync_date = datetime.datetime.now(ist).strftime("%y%m%d-%H") + "00"
            for i in dry_ou_days:
                total_dryouts = (dry_out_data.filter(pl.col("status") == i).select(pl.col("rosapcode").n_unique()).item())

                ms_hsd_dryouts = (dry_out_data.filter((pl.col("status") == i) & 
                                                    (pl.col("item_name").is_in(["MS", "HSD"])))
                                                    .select(pl.col("rosapcode").n_unique())
                                                    .item())
                
                ms_dryouts = (dry_out_data.filter((pl.col("status") == i) & 
                                                    (pl.col("item_name").is_in(["MS"])))
                                                    .select(pl.col("rosapcode").n_unique())
                                                    .item())
                
                hsd_dryouts = (dry_out_data.filter((pl.col("status") == i) & 
                                                    (pl.col("item_name").is_in(["HSD"])))
                                                    .select(pl.col("rosapcode").n_unique())
                                                    .item())
                
                turbo_dryouts = (dry_out_data.filter((pl.col("status") == i) & 
                                                    (pl.col("item_name").is_in(["TURBO"])))
                                                    .select(pl.col("rosapcode").n_unique())
                                                    .item())
                
                e20_dryouts = (dry_out_data.filter((pl.col("status") == i) & 
                                                    (pl.col("item_name").is_in(["E20"])))
                                                    .select(pl.col("rosapcode").n_unique())
                                                    .item())
                
                power95_dryouts = (dry_out_data.filter((pl.col("status") == i) & 
                                                    (pl.col("item_name").is_in(["POWER 95"])))
                                                    .select(pl.col("rosapcode").n_unique())
                                                    .item())
                
                power99_dryouts = (dry_out_data.filter((pl.col("status") == i) & 
                                                    (pl.col("item_name").is_in(["POWER 99"])))
                                                    .select(pl.col("rosapcode").n_unique())
                                                    .item())
                
                power100_dryouts = (dry_out_data.filter((pl.col("status") == i) & 
                                                    (pl.col("item_name").is_in(["POWER 100"])))
                                                    .select(pl.col("rosapcode").n_unique())
                                                    .item())
                
                dry_out_df = (
                    dry_out_data
                        .filter(pl.col("status") == i)
                        .select([
                            pl.col("rosapcode").alias("sap_id"),
                            pl.col("product_grp").alias("product_name"),
                            pl.col("tank_cnt").alias("tank"),
                            pl.col("status").alias("dry_out_in_days"),
                        ])
                )

                path = ""
                if i == 1:
                    path = f"/tmp/{sync_date}_day_dry_out_details.csv"
                    dry_out_df.write_csv(path)
                if i == 2:
                    path = f"/tmp/{sync_date}_intra_day_dry_out_details.csv"
                    dry_out_df.write_csv(path)
                    
                status, minio_path = minio_connector.upload_to_minio("RO", "DryOut", str(sync_date.split('-')[0]), path)

                if status:
                    print("File uploaded to minio successfully")
                    logger.info(f"File uploaded to minio successfully")
                    try:
                        os.remove(path)
                        print(f"Local file removed: {path}")
                    except Exception as e:
                        print(f"Failed to remove local file: {e}")
                else:
                    print("File Failed to upload minio")
                    logger.info(f"File Failed to upload minio")
                
                dryout_records = {
                    "run_id": str(sync_date),
                    "total_dryouts": total_dryouts if total_dryouts else 0,
                    "ms_hsd_dryouts": ms_hsd_dryouts if ms_hsd_dryouts else 0,
                    "ms_dryouts": ms_dryouts if ms_dryouts else ms_dryouts,
                    "hsd_dryouts": hsd_dryouts if hsd_dryouts else hsd_dryouts,
                    "turbo_dryouts": turbo_dryouts if turbo_dryouts else 0,
                    "e20_dryouts": e20_dryouts if e20_dryouts else 0,
                    "power95_dryouts": power95_dryouts if power95_dryouts else 0,
                    "power99_dryouts": power99_dryouts if power99_dryouts else power99_dryouts,
                    "power100_dryouts": power100_dryouts if power100_dryouts else power100_dryouts,
                    "dry_out_in_days": str(i),
                    "file_path": minio_path if minio_path else ""
                }
                await hpcl_ceg_model.CrisDryOutSyncCreate(**dryout_records).create()

        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Data Sync Failed.")
            date = urdhva_base.utilities.get_present_time()
            formatted = date.strftime("%d %b %Y, %I:%M %p")
            final_data = {
                "generated_time": formatted,
                "error_message": repr(e),
                "traceback": tb
            }
            print("final data ----<>\n", final_data)
            await send_email(
                template_name="dryout_sync_failure.html",   
                to_recipients=["sreedhar.maddipati@algofusiontech.com","bala@algofusiontech.com"],
                cc_recipients=["venu@algofusiontech.com", "moufikali@algofusiontech.com", "aditya@algofusiontech.com", "yesu.p@algofusiontech.com", "vamsi.c@algofusiontech.com"],
                bcc_recipients=["manohar.v@algofusiontech.com", "gayathri.m@algofusiontech.com", "mohith.p@algofusiontech.com", 
                            "poojitha.gumma@algofusiontech.com", "pawann.k@algofusiontech.com"],
                subject="Daily Sync Failed - Dry Out Listerner",
                final_data=final_data
            )

            return {"status": False, "message": "Failed", "error": repr(e)}


async def send_email(template_name, to_recipients, subject, cc_recipients, bcc_recipients,  final_data=None, attachments=None):
    ins = await orchestrator.notification_manager.notification_factory.get_notification_module("email")

    # Load HTML template
    template_path = os.path.join(
        os.path.dirname(hpcl_ceg_model.__file__),
        '..', 'orchestrator', 'reporting_services',
        'templates', template_name
        )

    with open(template_path, "r") as f:
        template = jinja2.Template(f.read())

    html_body = template.render(**final_data)

    # Send email
    await ins.publish_message(
        subject=subject,
        recipients=to_recipients if to_recipients else [],
        cc_recipients=cc_recipients if cc_recipients else [],
        bcc_recipients= bcc_recipients if bcc_recipients else [],
        html_content=True,
        body=html_body,
        force_send=True,
        inline_images={},
        attachments=attachments or []
    )


if __name__ == "__main__":
    print(f"Executing dry-out alert creation at {datetime.datetime.now(datetime.timezone.utc)}")
    asyncio.run(DryoutCollector.get_dry_out_data())
