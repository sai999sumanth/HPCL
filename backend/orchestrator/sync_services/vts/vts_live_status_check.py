import urdhva_base
import asyncio
import traceback
import datetime
import charts_actions
import dashboard_studio_model
import utilities.connection_mapping as connection_mapping
import orchestrator.sync_services.vts.vts_ongoing_trips as vts_ongoing_trips
import hpcl_ceg_enum
import orchestrator.dbconnector.widget_actions.vts_analytics as vts_analytics
import polars as pl
import orchestrator.dbconnector.credential_loader as credential_loader
import psycopg2
import psycopg2.extras


logger = urdhva_base.Logger.getInstance("vts_live_trips_check")

class VTSTripSyncService:
    CHUNK_SIZE = 1000
    BULK_UPDATE_BATCH_SIZE = 1000
    
    @staticmethod
    async def get_completed_invoices_from_vts(invoice_list):
        """Get completed invoices from VTS COMPLETED_TRIP table with completion time"""
        completed_dict = {}
        
        try:
            conn = vts_ongoing_trips.get_db_connection()
            cursor = conn.cursor()
            
            for i in range(0, len(invoice_list), VTSTripSyncService.CHUNK_SIZE):
                chunk = invoice_list[i:i + VTSTripSyncService.CHUNK_SIZE]
                invoices_str = "', '".join(chunk)
                
                cursor.execute(f"""
                    SELECT DISTINCT CHALLAN_NO, RET_DEPOT_IN
                    FROM COMPLETED_TRIP
                    WHERE CHALLAN_NO IN ('{invoices_str}')
                """)
                
                for row in cursor.fetchall():
                    if row[0]:
                        invoice_key = str(row[0]).strip().replace(" ", "")
                        completion_time = row[1] if row[1] else None
                        
                        # Remove timezone info if present to store as-is
                        if completion_time and hasattr(completion_time, 'tzinfo') and completion_time.tzinfo is not None:
                            completion_time = completion_time.replace(tzinfo=None)
                        
                        completed_dict[invoice_key] = completion_time
                        
            cursor.close()
            conn.close()
            
        except Exception as e:
            logger.error(f"VTS query error: {str(e)}")
            logger.error(traceback.format_exc())
            
        return completed_dict
    
    @staticmethod
    async def get_completed_invoices_from_ims(base_invoice_list, ims_function):
        """Get completed invoices from IMS AUTO_DC_REQUESTS table with completion time"""
        completed_dict = {}
        
        try:
            for i in range(0, len(base_invoice_list), VTSTripSyncService.CHUNK_SIZE):
                chunk = base_invoice_list[i:i + VTSTripSyncService.CHUNK_SIZE]
                invoices_str = "', '".join(chunk)
                
                ims_rows = await ims_function(query=f"""
                    SELECT DISTINCT INVOICE_NO, AUTODC_UPDATE_DATE, AUTODC_UPDATE_TIME
                    FROM "IMS_SAP"."AUTO_DC_REQUESTS"
                    WHERE "INVOICE_NO" IN ('{invoices_str}')
                """)
                
                if ims_rows:
                    for row in ims_rows:
                        if row.get("INVOICE_NO"):
                            invoice_key = str(row["INVOICE_NO"]).strip().replace(" ", "")
                            
                            # Parse IMS datetime from date and time strings
                            completion_time = None
                            try:
                                date_str = str(row.get("AUTODC_UPDATE_DATE", "")).strip()
                                time_str = str(row.get("AUTODC_UPDATE_TIME", "")).strip()
                                
                                if date_str and time_str and date_str != "None" and time_str != "None":
                                    # date_str format: 20260209, time_str format: 095709
                                    # Parse and ensure it's a naive datetime (no timezone info)
                                    completion_time = datetime.datetime.strptime(f"{date_str}{time_str}", "%Y%m%d%H%M%S")
                                    # Remove any timezone info if present
                                    if completion_time.tzinfo is not None:
                                        completion_time = completion_time.replace(tzinfo=None)
                            except Exception as e:
                                logger.warning(f"Failed to parse IMS datetime for {invoice_key}: {str(e)}")
                            
                            completed_dict[invoice_key] = completion_time
                    
        except Exception as e:
            logger.error(f"IMS query error: {str(e)}")
            logger.error(traceback.format_exc())
            
        return completed_dict
    
    @staticmethod
    async def bulk_update_trips(trips_data):
        """
        Bulk update trips using direct database connection for faster updates
        """
        update_count = 0
        failed_count = 0
        conn = None
        cursor = None
        
        try:
            # Get database credentials
            creds = credential_loader.get_credentials('APP_DB')
            params = {
                "host": creds["host"],
                "database": creds["database"],
                "user": creds["user"],
                "password": creds["password"],
                "port": creds["port"]
            }
            
            # Establish connection
            conn = psycopg2.connect(**params)
            cursor = conn.cursor()
            
            # Prepare update query
            update_query = """
                UPDATE vts_ongoing_trips
                SET trip_status = %s,
                    vts_status = %s,
                    ims_status = %s,
                    trip_completed_time = %s
                WHERE id = %s
            """
            
            # Process in batches
            for i in range(0, len(trips_data), VTSTripSyncService.BULK_UPDATE_BATCH_SIZE):
                batch = trips_data[i:i + VTSTripSyncService.BULK_UPDATE_BATCH_SIZE]
                
                # Prepare batch data
                # Since PostgreSQL 'timestamp with time zone' column adds +5:30, we subtract it first
                batch_values = []
                for record in batch:
                    trip_time = record['trip_completed_time']
                    
                    if trip_time:
                        # Subtract 5 hours 30 minutes to compensate for PostgreSQL's auto-conversion
                        adjusted_time = trip_time - datetime.timedelta(hours=5, minutes=30)
                        trip_time_str = adjusted_time.strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        trip_time_str = None
                    
                    batch_values.append((
                        record['trip_status'],
                        record['vts_status'],
                        record['ims_status'],
                        trip_time_str,
                        record['id']
                    ))

                
                try:
                    # Execute batch update using psycopg2.extras.execute_batch for performance
                    psycopg2.extras.execute_batch(cursor, update_query, batch_values)
                    conn.commit()
                    
                    batch_success = len(batch)
                    update_count += batch_success
                    logger.info(f"Batch {i//VTSTripSyncService.BULK_UPDATE_BATCH_SIZE + 1}: {batch_success}/{len(batch)} successful")
                    
                except Exception as e:
                    conn.rollback()
                    failed_count += len(batch)
                    logger.error(f"Batch update failed: {str(e)}")
                    logger.error(traceback.format_exc())
            
            return update_count, failed_count
            
        except Exception as e:
            logger.error(f"Bulk update error: {str(e)}")
            logger.error(traceback.format_exc())
            return update_count, failed_count
            
        finally:
            # Clean up resources
            if cursor:
                cursor.close()
            if conn:
                conn.close()
    
    @staticmethod
    async def sync_trip_completion_status():
        """Main sync function"""
        try:
            logger.info(f"[{datetime.datetime.now()}] Starting sync...")
            
            vts_live_query = """
                SELECT id, invoice_no, trip_status, vts_status, ims_status
                FROM vts_ongoing_trips
                WHERE trip_status IS NULL OR trip_status != 'Closed'
            """
            
            # Get ongoing trips
            df = await vts_analytics.VTSAnalyticsActions.execute_query(vts_live_query, engine='polars')
            
            if df.is_empty():
                return {"status": True, "message": "No trips to sync", "updated": 0}
            
            logger.info(f"Checking {df.height} trips")
            
            # Normalize and extract base invoice numbers
            df = df.with_columns([
                pl.col("invoice_no").str.strip_chars().str.replace_all(r"\s+", "").alias("invoice_clean"),
                pl.col("invoice_no").str.strip_chars().str.replace_all(r"\s+", "").str.split("-").list.first().alias("base_invoice")
            ])
            
            invoice_list = df.select("invoice_clean").drop_nulls().unique().to_series().to_list()
            base_invoice_list = df.select("base_invoice").drop_nulls().unique().to_series().to_list()
            
            if not invoice_list:
                return {"status": True, "message": "No valid invoices", "updated": 0}
            
            # Get IMS function
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("ims", "1")
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            ims_function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
            
            # Fetch from both tables in parallel - now returns dictionaries with completion times
            vts_dict, ims_dict = await asyncio.gather(
                VTSTripSyncService.get_completed_invoices_from_vts(invoice_list),
                VTSTripSyncService.get_completed_invoices_from_ims(base_invoice_list, ims_function)
            )
            
            logger.info(f"VTS completed: {len(vts_dict)}, IMS completed: {len(ims_dict)}")
            
            # Prepare bulk update data
            trips_data = []
            
            for row in df.iter_rows(named=True):
                invoice_clean = row['invoice_clean']
                base_invoice = row['base_invoice']
                
                # Check if invoice exists in VTS and IMS
                in_vts = invoice_clean in vts_dict
                in_ims = base_invoice in ims_dict
                
                # Determine trip status and completion time
                if in_vts or in_ims:
                    trip_status = hpcl_ceg_enum.VtsLive.TripCompleted.value
                    
                    # Priority: VTS completion time if available, otherwise IMS completion time
                    # If both are present, use VTS time as per requirement
                    if in_vts:
                        trip_completed_time = vts_dict[invoice_clean]
                    elif in_ims:
                        trip_completed_time = ims_dict[base_invoice]
                    else:
                        trip_completed_time = None
                else:
                    trip_status = hpcl_ceg_enum.VtsLive.TripOngoing.value
                    trip_completed_time = None
                
                # Safety check: Ensure trip_status is never empty
                if not trip_status:
                    trip_status = hpcl_ceg_enum.VtsLive.TripOngoing.value
                    logger.warning(f"Empty trip_status for id {row['id']}, defaulting to TripOngoing")
                
                trips_data.append({
                    'id': row['id'],
                    'trip_status': trip_status,
                    'vts_status': (hpcl_ceg_enum.VtsLive.TripCompleted if in_vts else hpcl_ceg_enum.VtsLive.TripOngoing).value,
                    'ims_status': (hpcl_ceg_enum.VtsLive.TripCompleted if in_ims else hpcl_ceg_enum.VtsLive.TripOngoing).value,
                    'trip_completed_time': trip_completed_time
                })
            
            if not trips_data:
                logger.info("No trips to update")
                return {"status": True, "message": "No updates needed", "updated": 0}
            
            logger.info(f"Preparing to update {len(trips_data)} trips")
            
            # Perform bulk update
            update_count, failed_count = await VTSTripSyncService.bulk_update_trips(trips_data)
            
            logger.info(f"[{datetime.datetime.now()}] Sync completed: {update_count} updated, {failed_count} failed")
            
            return {
                "status": True,
                "message": "Sync completed",
                "updated": update_count,
                "failed": failed_count,
                "total_checked": df.height
            }
            
        except Exception as e:
            logger.error(f"Sync error: {str(e)}")
            logger.error(traceback.format_exc())
            return {"status": False, "message": str(e), "updated": 0}


async def main():
    result = await VTSTripSyncService.sync_trip_completion_status()
    logger.info(f"Final Result: {result}")
    return result


if __name__ == "__main__":
    asyncio.run(main())