import urdhva_base
import hpcl_ceg_model
import hpcl_ceg_enum
import traceback
import datetime
import json
import urdhva_base.redispool
import utilities.helpers as helpers
import orchestrator.alerting.alert_factory as alert_factory

InterlockName = 'Restroom Cleaning Evidence Missing'


def chunked(iterable, size=50):
    for i in range(0, len(iterable), size):
        yield iterable[i:i + size]


class ROVaAlertHandler(object):

    @classmethod
    async def get_existing_alerts(cls):
        query = """
        SELECT sap_id, id, block_status
        FROM alerts
        WHERE interlock_name = 'Restroom Cleaning Evidence Missing'
          AND alert_status != 'Close'
        """
        resp = await hpcl_ceg_model.Alerts.get_aggr_data(query,limit=0)
        return resp["data"]
    
    @classmethod
    async def create_alert(cls,data):
        try:
            allocated_time = datetime.datetime.now(datetime.timezone.utc)
            processed_time = datetime.datetime.now(datetime.timezone.utc)
            alert_history = [{
                "action_msg" : (
                    f"Violation Type: Restroom Cleaning Evidence Missing \n"
                    f"for Outlet: {data.get('ro_name','')}"
                ),
                "action_type": "Created",
                "alert_status": "Open",
                "allocated_time": allocated_time.isoformat(),
                "processed_time": processed_time.isoformat()
            }]

            alert_data = {
                "bu": "RO",
                "severity": "High",
                "sop_id": "SOP023",
                "alert_history": alert_history,
                "alert_section": "RO",
                "violation_type": "Restroom Cleaning Evidence Missing",
                "interlock_name": "Restroom Cleaning Evidence Missing",
                "sap_id": data.get('ro_code',''),
                "location_name": data.get('','ro_name'),
                "zone": data.get('zone',''),
                "region": data.get('region',''),
                "sales_area": data.get('sales_area',''),
                "block_status": None
            }
            # need to trigger camunda workflow 
            camunda_url = await helpers.get_camunda_url("RO",data.get('ro_code'),alert_section='RO')
            print('*'*200)
            print('alert_data',alert_data)
            print('*'*200)
            await alert_factory.AlertFactory().create_alert(alert_data, camunda_url)
        except Exception as e:
            print(traceback.format_exc())
    
    @classmethod
    async def ro_cleanliness_master_data(cls, data):
        """
        data → MasterList [{ ro_code: "xxxx" }]
        """
        redis_queue = urdhva_base.redispool.RedisQueue('ro_va_queue')
        pending_alerts = await cls.get_existing_alerts()
        pending_map = {rec["sap_id"]: rec for rec in pending_alerts}

        master_ro_codes = {rec["ro_code"] for rec in data}

        # Alerts to Create
        alerts_to_create = [
            rec for rec in data if rec["ro_code"] not in pending_map
        ]

        # Alerts to Close / Resolve
        alerts_to_update = [
            rec for sap_id, rec in pending_map.items()
            if sap_id not in master_ro_codes
        ]

        # CREATE ALERTS
        for rec in alerts_to_create:
            print("Creating new alert {}".format(rec.get("sap_id","")))
            await redis_queue.put(json.dumps(rec))
            # await cls.create_alert(rec)

        # CLOSE / RESOLVE ALERTS
        for batch in chunked(alerts_to_update):
            close_ids = []
            resolve_ids = []

            for rec in batch:
                if not rec.get("block_status"):
                    close_ids.append(rec["id"])
                else:
                    resolve_ids.append(rec["id"])

            if close_ids:
                ids = ",".join(f"'{i}'" for i in close_ids)
                await hpcl_ceg_model.Alerts.update_by_query(
                    f"UPDATE alerts SET alert_status='Close', alert_state = 'Resolved' WHERE id IN ({ids})"
                )
                # To do, send it to camunda to close the alert

            if resolve_ids:
                ids = ",".join(f"'{i}'" for i in resolve_ids)
                await hpcl_ceg_model.Alerts.update_by_query(
                    f"UPDATE alerts SET alert_state = 'Resolved' WHERE id IN ({ids})"
                )

    @classmethod
    async def ro_cleanliness_uploaded_master_data(cls, data):
        """
        data → [{ ROCode, upload_done }]
        """
        pending_alerts = await cls.get_existing_alerts()
        pending_map = {rec["sap_id"]: rec for rec in pending_alerts}

        resolved = [
            rec for rec in data
            if rec["upload_done"] and rec["ro_code"] in pending_map
        ]
        redis_queue = urdhva_base.redispool.RedisQueue('ro_blocking_queue')

        for batch in chunked(resolved):
            close_ids = []
            resolve_ids = []

            for rec in batch:
                alert = pending_map[rec["ro_code"]]
                if not alert.get("block_status"):
                    close_ids.append(alert["id"])
                else:
                    resolve_ids.append(alert["id"])

            if close_ids:
                ids = ",".join(f"'{i}'" for i in close_ids)
                await hpcl_ceg_model.Alerts.update_by_query(
                    f"UPDATE alerts SET alert_state = 'Resolved', "
                    f"image_uploaded = true WHERE id IN ({ids})"
                )

                # Closing and deleting workflows
                alert_data = {}
                alert_data["task_type"] = "close alerts"
                alert_data["alert_ids"] = close_ids
                alert_data['reason'] = "Toilet Image Uploaded, Auto Closing"
                alert_data['username'] = "System"
                await redis_queue.put(json.dumps(alert_data))

            if resolve_ids:
                ids = ",".join(f"'{i}'" for i in resolve_ids)
                await hpcl_ceg_model.Alerts.update_by_query(
                    f"UPDATE alerts SET alert_state = 'Resolved', "
                    f"image_uploaded = true WHERE id IN ({ids})"
                )
                # Auto unblocking of alerts
                alert_data = {}
                alert_data["task_type"] = "unblock outlets"
                alert_data["alert_ids"] = resolve_ids
                alert_data['reason'] = "Toilet Image Uploaded, Auto Closing"
                alert_data['username'] = "System"
                await redis_queue.put(json.dumps(alert_data))
