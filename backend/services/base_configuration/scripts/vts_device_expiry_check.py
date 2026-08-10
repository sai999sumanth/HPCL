import urdhva_base
import hpcl_ceg_model
import hpcl_ceg_enum
import asyncio
import orchestrator.alerting.alert_factory as alert_factory
import utilities.helpers as helpers
import datetime
import dateutil.relativedelta


logger = urdhva_base.logger.Logger.getInstance("vts_truck_device_expiry_check")


class CheckVTSDeviceExpiry:
    """
    Check VTS device expiry and create alerts safely.
    """

    async def get_vts_truck_device_expiry_records(self):
        try:
            query = """
                SELECT
                    sap_tt_no AS vehicle_number,
                    sap_id,
                    location AS location_name,
                    select_business AS bu,
                    transporter AS transporter_code,
                    zone,
                    id AS device_installation_id,
                    tibco_expiry_date
                FROM device_installation
                WHERE TO_DATE(tibco_expiry_date, 'DD-MM-YYYY')
                      <= CURRENT_DATE + INTERVAL '30 days'
                AND (expiry_alert_created IS NULL OR expiry_alert_created = false)
                ORDER BY created_at DESC;
            """

            result = await urdhva_base.BasePostgresModel.get_aggr_data(query=query, limit=0)

            return result.get("data", [])

        except Exception as e:
            logger.error(f"Error while fetching expiry records: {e}", exc_info=True)
            return []

    async def create_alert_for_expiring_device(self):
        try:
            records = await self.get_vts_truck_device_expiry_records()
            logger.info(f"Found {len(records)} expiry records")

            today = datetime.date.today()

            for record in records:
                try:
                    bu = record.get("bu")
                    sap_id = record.get("sap_id")

                    if not bu or not sap_id:
                        logger.warning(f"Skipping record due to missing bu/sap_id: {record}")
                        continue

                    expiry_str = record.get("tibco_expiry_date")
                    expiry_date = datetime.datetime.strptime(expiry_str, "%d-%m-%Y").date()

                    days_remaining = (expiry_date - today).days + 1 # Adding 1 to include the expiry day itself

                    if days_remaining == 30:
                        before30days = True
                        total_wait_time_days = days_remaining

                    elif 1 <= days_remaining < 30:
                        before30days = False
                        total_wait_time_days = days_remaining 
                    else:
                        # today or already expired
                        before30days = False
                        total_wait_time_days = 0

                    totalWaitTime = f"P{total_wait_time_days}D"

                    # Vehicle block dates
                    vehicle_blocked_start_date = expiry_date
                    vehicle_blocked_end_date = (expiry_date + dateutil.relativedelta.relativedelta(years=5))

                    alert_data = {
                        "vehicle_number": record.get("vehicle_number"),
                        "sap_id": sap_id,
                        "sop_id": "SOP001E",
                        "location_name": record.get("location_name"),
                        "device_installation_id": record.get("device_installation_id"),
                        "contract_valid_upto": expiry_str,
                        "vehicle_blocked_start_date": vehicle_blocked_start_date.isoformat(),
                        "vehicle_blocked_end_date": vehicle_blocked_end_date.isoformat(),
                        "bu": bu,
                        "transporter_code": record.get("transporter_code"),
                        "alert_section": "VTS",
                        "interlock_name": "Truck Contract Validity Status",
                        "severity": hpcl_ceg_enum.Severity.High.value,
                        "zone": record.get("zone"),
                        "before30days": before30days,
                        "waitTime": totalWaitTime,
                        "days_remaining": days_remaining
                    }

                    camunda_url = await helpers.get_camunda_url(bu, sap_id, alert_section="VTS")

                    cls = alert_factory.AlertFactory()
                    status, msg = await cls.create_alert(alert_data, camunda_url)

                    if status:
                        logger.info(f"Alert creation status: {status}, message: {msg}")
                        # Mark as processed
                        await hpcl_ceg_model.DeviceInstallation(
                            id=record["device_installation_id"],
                            expiry_alert_created=True,
                        ).modify()

                except Exception as alert_err:
                    logger.error(f"Alert creation failed for record {record}: {alert_err}", exc_info=True)
                    continue

            return {"status": True, "message": "Expiry alert job completed"}

        except Exception as e:
            logger.error(f"Fatal error in expiry alert job: {e}", exc_info=True)
            return {"status": False, "message": "Job failed"}

if __name__ == "__main__":
    asyncio.run(CheckVTSDeviceExpiry().create_alert_for_expiring_device())