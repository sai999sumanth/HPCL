import datetime
import json
import uuid
import logging
import pytz
import urdhva_base
import urdhva_base.queryparams
import urdhva_base.redispool
import hpcl_ceg_model
import ingestion_api_model
import orchestrator.alerting.alert_manager as alert_manager
import orchestrator.alerting.listener.tas_duplicate_alert_check as tas_duplicate_alert_check
import orchestrator.tas_analytics.tas_analytics as tas_analytics
import asyncio

logger = urdhva_base.logger.Logger.getInstance("tas_communication_loss_cron")
IST = pytz.timezone("Asia/Kolkata")

async def run_communication_loss_cron() -> dict:
    """
    Simplified Cron logic to detect and alert on TAS Communication Loss:
    1. Call operability_index_health_check using UI payload format.
    2. For any device returned as "Down":
       - Find sap_id from location_master.
       - Check Redis last update (tas_agent_up_status). If active in last 1 hour, skip.
       - Check TasAgentCommStatus table in DB:
         - If the latest status is 'failed', OR
         - If the DB record is older than 1 hour (or doesn't exist):
           -> Create the "Loss Of Communication" alert.
    """

    
    # 1. Run operability index health check
    try:
        payload = hpcl_ceg_model.Tasanalytics_Tas_AnalyticsParams(
            analytical_model="Run Daily Data Check"
        )
        operability_result = await tas_analytics.operability_index_health_check(payload)
    except Exception as e:
        logger.error(f"Failed to run operability_index_health_check: {e}")
        return {"status": "error", "message": str(e)}

    devices = operability_result.get("devices", [])
    down_devices = [d for d in devices if d.get("status") == "Down"]
    if not down_devices:
        return {"status": "success", "processed": 0, "alerts_created": 0}

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    five_minutes_ago = now_utc - datetime.timedelta(minutes=5)
    
    alerts_created = 0
    
    # Get Redis Connection
    try:
        redis_client = await urdhva_base.redispool.get_redis_connection()
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        redis_client = None

    for dev in down_devices:
        device_name = dev.get("device_name", "")
        if not device_name:
            continue
            
        # Resolve sap_id
        sap_id = None
        try:
            query = f"""
                SELECT sap_id FROM location_master
                WHERE bu = 'TAS'
                  AND name ILIKE '%{device_name}%'
                  AND location_onboard = true
            """
            res = await hpcl_ceg_model.LocationMaster.get_aggr_data(query)
            data_list = res.get("data", [])
            if data_list:
                sap_id = data_list[0].get("sap_id")
        except Exception as e:
            logger.error(f"Error resolving sap_id for {device_name}: {e}")
            
        if not sap_id:
            logger.warning(f"Could not resolve sap_id for device: {device_name}")
            continue

        # Check Redis uptime
        redis_active = False
        if redis_client:
            try:
                raw_redis = await redis_client.hget("tas_agent_up_status", sap_id)
                if raw_redis:
                    redis_time_str = raw_redis if isinstance(raw_redis, str) else raw_redis.decode()
                    redis_dt = datetime.datetime.fromisoformat(redis_time_str)
                    if redis_dt.tzinfo is None:
                        redis_dt = IST.localize(redis_dt).astimezone(datetime.timezone.utc)
                    else:
                        redis_dt = redis_dt.astimezone(datetime.timezone.utc)
                    
                    if redis_dt > five_minutes_ago:
                        redis_active = True
            except Exception as e:
                logger.error(f"Error checking Redis for sap_id {sap_id}: {e}")

        # If Redis was active within the last hour, we consider the agent alive
        if redis_active:
            continue

        # Check DB (TasAgentCommStatus)
        db_last_failed = False
        db_silent = True
        last_record = None
        try:
            db_res = await ingestion_api_model.TasAgentCommStatus.get_all(
                urdhva_base.queryparams.QueryParams(
                    q=f"sap_id = '{sap_id}'",
                    limit=1,
                    sort=json.dumps({"created_at": "desc"}),
                ),
                resp_type="plain"
            )
            records = db_res.get("data", [])
            if records:
                last_record = records[0]
                # Check status
                if last_record.get("status") == "failed":
                    db_last_failed = True
                
                raw_created = last_record.get("created_at")
                if raw_created:
                    db_dt = raw_created
                    if isinstance(db_dt, str):
                        db_dt = datetime.datetime.fromisoformat(db_dt)
                    if db_dt.tzinfo is None:
                        db_dt = db_dt.replace(tzinfo=datetime.timezone.utc)
                    else:
                        db_dt = db_dt.astimezone(datetime.timezone.utc)
                    
                    if db_dt > five_minutes_ago:
                        db_silent = False
        except Exception as e:
            logger.error(f"Error checking DB for sap_id {sap_id}: {e}")

        # We trigger the alert if:
        # 1. DB has a "failed" status, OR
        # 2. DB has been silent for more than 1 hour (db_silent is True)
        if not (db_last_failed or db_silent):
            continue

        # Check if an open alert already exists
        alert_exists = False
        try:
            query = (
                f"interlock_name = 'Loss Of Communication' "
                f"and bu = 'TAS' "
                f"and sap_id = '{sap_id}' "
                f"and alert_section = 'TAS' "
                f"and alert_status != 'Close'"
            )
            params = urdhva_base.queryparams.QueryParams(q=query, limit=1)
            resp = await hpcl_ceg_model.Alerts.get_all(params, resp_type="plain")
            if resp.get("data"):
                alert_exists = True
        except Exception as e:
            logger.error(f"Error checking open alerts for sap_id {sap_id}: {e}")

        if alert_exists:
            continue

        # Infer failure reason for alert details
        failure_reason = "Location not posting data — no status received from TAS agent"
        if last_record:
            if last_record.get("configuration_healthy") is False:
                failure_reason = "Configuration issue detected — agent reported unhealthy configuration."
            elif last_record.get("opcda_status") is False:
                failure_reason = "OPC-DA port / connection issue — agent cannot connect to OPC server."
            elif last_record.get("data_receiving_status") is False:
                failure_reason = "Data not flowing — OPC connection may be up but no tag values are being received."

        # Create the alert payload
        alert_history = [{
            "processed_time": now_utc.isoformat(),
            "allocated_time": now_utc.isoformat(),
            "action_msg": failure_reason,
            "action_type": "InterlockCreated",
        }]

        alert_data = {
            "bu": "TAS",
            "sap_id": sap_id,
            "sop_id": "SOP099",
            "interlock_name": "Loss Of Communication",
            "device_name": "Communication Loss",
            "alert_type": "TAS",
            "device_type": failure_reason,
            "severity": "critical",
            "alert_id": str(uuid.uuid1()),
            "alert_history": alert_history,
        }

        # Final duplicate safety net
        if not await tas_duplicate_alert_check.duplicate_loss_of_comm_check(alert_data):
            continue

        # Create alert
        try:
            success = await alert_manager.create_alert(alert_data)
            if success:
                alerts_created += 1
                logger.info(f"Alert created successfully for sap_id {sap_id}.")
            else:
                logger.error(f"Failed to create alert for sap_id {sap_id}.")
        except Exception as e:
            logger.error(f"Exception creating alert for sap_id {sap_id}: {e}")

    return {"status": "success", "processed": len(down_devices), "alerts_created": alerts_created}


if __name__ == "__main__":
    async def main():

        result = await run_communication_loss_cron()
        print(json.dumps(result, indent=2))
        
    asyncio.run(main())