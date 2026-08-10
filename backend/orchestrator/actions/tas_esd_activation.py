import urdhva_base
import asyncio
import json
import datetime
import traceback
import hpcl_ceg_enum
import hpcl_ceg_model
import utilities.helpers as helpers
import orchestrator.alerting.alert_factory as alert_create
import orchestrator.alerting.listener.tas_maintenance_alert_check as alert_close

logger = urdhva_base.logger.Logger.getInstance("workflow_process-log")


async def retry_query(query_func, *args, max_retries=3, retry_delay=2, empty_retries=2, **kwargs):
    """
    Enhanced retry function for database queries that also retries on empty data
    
    Args:
        query_func: The async function to call
        *args: Arguments to pass to the function
        max_retries: Maximum number of retry attempts for exceptions
        retry_delay: Initial delay between retries in seconds
        empty_retries: Maximum number of additional retries when data is empty
        **kwargs: Keyword arguments to pass to the function
        
    Returns:
        The result of the query function or None if all retries fail
    """
    attempt = 0
    empty_attempt = 0
    last_exception = None
    
    while attempt <= max_retries:
        try:
            if attempt > 0:
                logger.info(f"Retry attempt {attempt}/{max_retries} for {query_func.__name__}")
            
            result = await query_func(*args, **kwargs)
            
            # Check if result is empty or doesn't contain data
            is_empty = False
            if result is None:
                is_empty = True
            elif isinstance(result, dict) and "data" in result and (not result["data"] or len(result["data"]) == 0):
                is_empty = True
            elif isinstance(result, list) and len(result) == 0:
                is_empty = True
                
            if is_empty and empty_attempt < empty_retries:
                empty_attempt += 1
                logger.info(f"Empty data received from {query_func.__name__}, empty retry attempt {empty_attempt}/{empty_retries}")
                
                # Use shorter backoff for empty data retries
                backoff_time = retry_delay / 2 * (1.5 ** empty_attempt) 
                logger.info(f"Retrying empty data in {backoff_time:.2f} seconds...")
                await asyncio.sleep(backoff_time)
                continue
                
            return result
            
        except Exception as e:
            attempt += 1
            last_exception = e
            logger.warning(f"Query failed: {query_func.__name__}, attempt {attempt}/{max_retries}, error: {str(e)}")
            
            if attempt <= max_retries:
                # Use exponential backoff with jitter for retry delays
                jitter = 0.1 * retry_delay * (2 ** (attempt - 1))
                backoff_time = retry_delay * (2 ** (attempt - 1)) + jitter
                logger.info(f"Retrying in {backoff_time:.2f} seconds...")
                await asyncio.sleep(backoff_time)
            else:
                logger.error(f"All retries failed for {query_func.__name__}: {str(last_exception)}")
                logger.error(traceback.format_exc())
    
    # All retries have failed
    return None


class TasEsdActivation:
    async def get_required_variables(self):
        return [
            "BU", "sap_id", "sop_id", "device_id",
            "device_type", "device_name", "cause_effect",
            "effect_sop_id", "cause_sop_id", "alert_id", "interlock_name",
            "rosov_interlock_name", "dbbv_interlock_name", "esd_rosov_fail_status",
            "rosov_pl_mode", "esd_rosov_close_status", "esd_mov_fail_status",
            "mov_pl_mode", "esd_mov_close_status"
        ]

    # async def tas_esd_activation_check(self, params):
    #     try:
    #         # Extract basic parameters
    #         bu = params.get("BU", "")
    #         sap_id = params.get("sap_id", "")
    #         sop_id = params.get("sop_id", "")
    #         device_id = params.get("device_id", "")
    #         device_name = params.get("device_name", "")
    #         alert_id = params.get("alert_id", "")
            
    #         # Get the incoming interlock name
    #         interlock_name = params.get("interlock_name", "")
            
    #         # Define the known interlock names
    #         ROSOV_INTERLOCK = "All ROSOVs Closed(Except PL Receipt)_Fail"
    #         DBBV_INTERLOCK = "All DBBVs Closed(Except PL Receipt)_Fail"
    #         ESD_ROSOV_FAIL = "ESD ROSOV_Close Status_Fail"
    #         ROSOV_PL_MODE = "ROSOV in PL Receipt Mode"
    #         ESD_ROSOV_CLOSE = "ESD ROSOV_Close Status"
    #         ESD_MOV_FAIL = "ESD MOV_Close Status_Fail"
    #         MOV_PL_MODE = "MOV in PL Receipt Mode"
    #         ESD_MOV_CLOSE = "ESD MOV_Close Status"
            
    #         time_window = 2

    #         # Polling configuration for alert checking
    #         max_attempts = 6  # Total 30 seconds (6 attempts × 5 seconds)
    #         poll_interval = 5  # Check every 5 seconds
            
    #         # Determine which alert type we're dealing with based on interlock name
    #         is_rosov_alert = (interlock_name == ROSOV_INTERLOCK)
    #         is_dbbv_alert = (interlock_name == DBBV_INTERLOCK)
            
    #         # Step 1: Poll for required alerts
    #         esd_device_names = []
    #         location_name = ""
    #         alerts_found = False
    #         attempt_count = 0
            
    #         fail_status_interlock = ESD_ROSOV_FAIL if is_rosov_alert else ESD_MOV_FAIL
            
    #         while not alerts_found and attempt_count < max_attempts:
    #             if is_rosov_alert or is_dbbv_alert:
    #                 # Query for related failure status with retry
    #                 esd_close_data = await retry_query(
    #                     self._query_esd_alerts,
    #                     sap_id, 
    #                     fail_status_interlock, 
    #                     time_window,
    #                     max_retries=5,
    #                     retry_delay=4
    #                 )
                    
    #                 if esd_close_data:
    #                     alerts_found = True
    #                     logger.info(f"Found relevant alerts for {fail_status_interlock} on attempt {attempt_count+1}")
    #                     # Process the found alerts
    #                     for alert in esd_close_data:
    #                         esd_device_name = alert.get('tas_device_name', '')
    #                         if esd_device_name:
    #                             esd_device_names.append(esd_device_name)
                        
    #                     if esd_close_data:
    #                         location_name = esd_close_data[0].get("location_name", "")
                
    #             if not alerts_found:
    #                 attempt_count += 1
    #                 logger.info(f"Attempt {attempt_count}/{max_attempts}: Waiting for alerts to arrive...")
    #                 await asyncio.sleep(poll_interval)
            
    #         # Step 2: Get all the counts we need for decision making with retries
    #         # Check for maintenance alerts - get unique device names
    #         maint_alerts, maintenance_alert_count, device_alerts_map = await retry_query(
    #             self._query_maintenance_alerts, 
    #             sap_id,
    #             max_retries=5,
    #             retry_delay=4
    #         )
    #         logger.info(f"maintenance alertcount: {maintenance_alert_count}")
            
    #         # Check for fault alerts - get unique device names with retry
    #         fault_alerts, fault_alert_count, device_alerts_map = await retry_query(
    #             self._query_fault_alerts, 
    #             sap_id,
    #             max_retries=5,
    #             retry_delay=4
    #         )
    #         logger.info(f"fault_alert_count: {fault_alert_count}")
            
    #         # Get pipeline mode and close status counts for both types
    #         rosov_pl_close_count = mov_pl_close_count = esd_close_status_count = esd_mov_close_status_count = 0
            
    #         # Get PL mode and close status counts for ROSOV
    #         if is_rosov_alert:
    #             esd_status_data = await retry_query(
    #                 self._query_esd_status_alerts, 
    #                 sap_id, 
    #                 ESD_ROSOV_CLOSE, 
    #                 time_window,
    #                 max_retries=5,
    #                 retry_delay=4
    #             )
    #             esd_close_status_count = len(esd_status_data.get("data", []))
                
    #             rosov_pl_data = await retry_query(
    #                 self._query_pl_mode_alerts, 
    #                 sap_id, 
    #                 ROSOV_PL_MODE, 
    #                 time_window,
    #                 max_retries=5,
    #                 retry_delay=4
    #             )
    #             rosov_pl_close_count = len(rosov_pl_data.get("data", []))
            
    #         # Get PL mode and close status counts for DBBV/MOV
    #         if is_dbbv_alert:
    #             esd_mov_status_data = await retry_query(
    #                 self._query_esd_status_alerts, 
    #                 sap_id, 
    #                 ESD_MOV_CLOSE, 
    #                 time_window,
    #                 max_retries=5,
    #                 retry_delay=4
    #             )
    #             esd_mov_close_status_count = len(esd_mov_status_data.get("data", []))
                
    #             mov_pl_data = await retry_query(
    #                 self._query_pl_mode_alerts, 
    #                 sap_id, 
    #                 MOV_PL_MODE, 
    #                 time_window,
    #                 max_retries=5,
    #                 retry_delay=4
    #             )
    #             mov_pl_close_count = len(mov_pl_data.get("data", []))
                    
    #         # Get total tank count from architecture data with retry
    #         total_tank_count = await retry_query(
    #             self._get_total_tank_count, 
    #             sap_id,
    #             max_retries=5,
    #             retry_delay=4
    #         )
            
    #         # Step 3: Implement the logic patterns for decision making
            
    #         # Calculate totals for comparison with tank count - KEEPING MAINTENANCE AND FAULT SEPARATE
    #         rosov_total_with_maintenance = maintenance_alert_count + rosov_pl_close_count + esd_close_status_count
    #         rosov_total_with_fault = fault_alert_count + rosov_pl_close_count + esd_close_status_count
            
    #         dbbv_total_with_maintenance = maintenance_alert_count + mov_pl_close_count + esd_mov_close_status_count
    #         dbbv_total_with_fault = fault_alert_count + mov_pl_close_count + esd_mov_close_status_count
            
    #         # Flag for PL mode, maintenance status, fault status
    #         has_pl_mode = (rosov_pl_close_count > 0) if is_rosov_alert else (mov_pl_close_count > 0)
    #         has_maintenance = maintenance_alert_count > 0
    #         has_fault = fault_alert_count > 0
            
    #         logger.info(f"ROSOV counts - maintenance path: {rosov_total_with_maintenance}, fault path: {rosov_total_with_fault}")
    #         logger.info(f"DBBV counts - maintenance path: {dbbv_total_with_maintenance}, fault path: {dbbv_total_with_fault}")
            
    #         # Determine if we should create a new alert
    #         create_alert = False
    #         using_path = ""
            
    #         if is_rosov_alert:
    #             # Logic Pattern 1: PL Mode + Maintenance + Counts Match
    #             if has_pl_mode and has_maintenance and rosov_total_with_maintenance == total_tank_count:
    #                 create_alert = True
    #                 using_path = "maintenance"
    #                 logger.info("Pattern 1A: ROSOV - PL Mode + Maintenance + Counts Match")
                
    #             # Logic Pattern 1: PL Mode + Fault + Counts Match
    #             elif has_pl_mode and has_fault and rosov_total_with_fault == total_tank_count:
    #                 create_alert = True
    #                 using_path = "fault"
    #                 logger.info("Pattern 1B: ROSOV - PL Mode + Fault + Counts Match")
                
    #             # Logic Pattern 2: PL Mode + NO Maintenance + NO Fault + Counts Match
    #             elif has_pl_mode and not has_maintenance and not has_fault and (rosov_pl_close_count + esd_close_status_count) == total_tank_count:
    #                 create_alert = True
    #                 using_path = "clean"
    #                 logger.info("Pattern 2: ROSOV - PL Mode + NO Maintenance/Fault + Counts Match")
                
    #             # Logic Pattern 3: NO PL Mode + Maintenance + Counts Match
    #             elif not has_pl_mode and has_maintenance and rosov_total_with_maintenance == total_tank_count:
    #                 create_alert = True
    #                 using_path = "maintenance_no_pl"
    #                 logger.info("Pattern 3A: ROSOV - NO PL Mode + Maintenance + Counts Match")
                
    #             # Logic Pattern 3: NO PL Mode + Fault + Counts Match
    #             elif not has_pl_mode and has_fault and rosov_total_with_fault == total_tank_count:
    #                 create_alert = True
    #                 using_path = "fault_no_pl"
    #                 logger.info("Pattern 3B: ROSOV - NO PL Mode + Fault + Counts Match")
                
    #             if create_alert:
    #                 return await retry_query(
    #                     self._create_rosov_alert,
    #                     bu, 
    #                     sap_id, 
    #                     location_name, 
    #                     max(rosov_total_with_maintenance, rosov_total_with_fault),
    #                     max_retries=5,
    #                     retry_delay=4
    #                 )
            
    #         elif is_dbbv_alert:
    #             # Logic Pattern 1: PL Mode + Maintenance + Counts Match
    #             if has_pl_mode and has_maintenance and dbbv_total_with_maintenance == total_tank_count:
    #                 create_alert = True
    #                 using_path = "maintenance"
    #                 logger.info("Pattern 1A: DBBV - PL Mode + Maintenance + Counts Match ---> %s", dbbv_total_with_maintenance, total_tank_count)
                
    #             # Logic Pattern 1: PL Mode + Fault + Counts Match
    #             elif has_pl_mode and has_fault and dbbv_total_with_fault == total_tank_count:
    #                 create_alert = True
    #                 using_path = "fault"
    #                 logger.info("Pattern 1B: DBBV - PL Mode + Fault + Counts Match ---> %s", dbbv_total_with_fault, total_tank_count)
                
    #             # Logic Pattern 2: PL Mode + NO Maintenance + NO Fault + Counts Match
    #             elif has_pl_mode and not has_maintenance and not has_fault and (mov_pl_close_count + esd_mov_close_status_count) == total_tank_count:
    #                 create_alert = True
    #                 using_path = "clean"
    #                 logger.info("Pattern 2: DBBV - PL Mode + NO Maintenance/Fault + Counts Match ---> %s", (mov_pl_close_count + esd_mov_close_status_count), total_tank_count)
                
    #             # Logic Pattern 3: NO PL Mode + Maintenance + Counts Match
    #             elif not has_pl_mode and has_maintenance and dbbv_total_with_maintenance == total_tank_count:
    #                 create_alert = True
    #                 using_path = "maintenance_no_pl"
    #                 logger.info("Pattern 3A: DBBV - NO PL Mode + Maintenance + Counts Match ---> %s", dbbv_total_with_maintenance, total_tank_count)
                
    #             # Logic Pattern 3: NO PL Mode + Fault + Counts Match
    #             elif not has_pl_mode and has_fault and dbbv_total_with_fault == total_tank_count:
    #                 create_alert = True
    #                 using_path = "fault_no_pl"
    #                 logger.info("Pattern 3B: DBBV - NO PL Mode + Fault + Counts Match ---> %s", dbbv_total_with_fault, total_tank_count)
                
    #             if create_alert:
    #                 return await retry_query(
    #                     self._create_dbbv_alert,
    #                     bu, 
    #                     sap_id, 
    #                     location_name, 
    #                     max(dbbv_total_with_maintenance, dbbv_total_with_fault),
    #                     max_retries=5,
    #                     retry_delay=4
    #                 )
            
    #         # Otherwise (no conditions met): Update alert history
    #         logger.info("No pattern matched: Updating alert history for %s", esd_device_names)
    #         if esd_device_names:
    #             if is_rosov_alert:
    #                 for dev_name in esd_device_names:
    #                     await retry_query(
    #                         self._update_alert_history,
    #                         bu=bu,
    #                         sap_id=sap_id,
    #                         device_name=dev_name,
    #                         interlock_name=ROSOV_INTERLOCK,
    #                         fail_status_interlock=ESD_ROSOV_FAIL,
    #                         max_retries=5,
    #                         retry_delay=4
    #                     )
    #             elif is_dbbv_alert:
    #                 for dev_name in esd_device_names:
    #                     await retry_query(
    #                         self._update_alert_history,
    #                         bu=bu,
    #                         sap_id=sap_id,
    #                         device_name=dev_name,
    #                         interlock_name=DBBV_INTERLOCK,
    #                         fail_status_interlock=ESD_MOV_FAIL,
    #                         max_retries=5,
    #                         retry_delay=4
    #                     )
        
    #         return True, {
    #             "status": "counts don't match", 
    #             "path_used": using_path,
    #             "rosov_total_maintenance": rosov_total_with_maintenance,
    #             "rosov_total_fault": rosov_total_with_fault,
    #             "dbbv_total_maintenance": dbbv_total_with_maintenance,
    #             "dbbv_total_fault": dbbv_total_with_fault,
    #             "tank_count": total_tank_count,
    #             "has_pl_mode": has_pl_mode,
    #             "has_maintenance": has_maintenance,
    #             "has_fault": has_fault
    #         }
        
    #     except Exception as e:
    #         logger.info(traceback.format_exc())
    #         logger.error(traceback.format_exc())
    #         return False, {"status": str(e)}
    async def tas_esd_activation_check(self, params):
        try:
            # Extract basic parameters
            bu = params.get("BU", "")
            sap_id = params.get("sap_id", "")
            sop_id = params.get("sop_id", "")
            device_id = params.get("device_id", "")
            device_name = params.get("device_name", "")
            alert_id = params.get("alert_id", "")
            
            # Get the incoming interlock name
            interlock_name = params.get("interlock_name", "")
            
            # Define the known interlock names
            ROSOV_INTERLOCK = "All ROSOVs Closed(Except PL Receipt)_Fail"
            DBBV_INTERLOCK = "All DBBVs Closed(Except PL Receipt)_Fail"
            ESD_ROSOV_FAIL = "ESD ROSOV_Close Status_Fail"
            ROSOV_PL_MODE = "ROSOV in PL Receipt Mode"
            ESD_ROSOV_CLOSE = "ESD ROSOV_Close Status"
            ESD_MOV_FAIL = "ESD MOV_Close Status_Fail"
            MOV_PL_MODE = "MOV in PL Receipt Mode"
            ESD_MOV_CLOSE = "ESD MOV_Close Status"
            
            time_window = 2

            # Polling configuration for alert checking
            max_attempts = 6  # Total 30 seconds (6 attempts × 5 seconds)
            poll_interval = 5  # Check every 5 seconds
            
            # Determine which alert type we're dealing with based on interlock name
            is_rosov_alert = (interlock_name == ROSOV_INTERLOCK)
            is_dbbv_alert = (interlock_name == DBBV_INTERLOCK)
            
            # Step 1: Poll for required alerts
            esd_device_names = []
            location_name = ""
            alerts_found = False
            attempt_count = 0
            
            fail_status_interlock = ESD_ROSOV_FAIL if is_rosov_alert else ESD_MOV_FAIL
            
            while not alerts_found and attempt_count < max_attempts:
                if is_rosov_alert or is_dbbv_alert:
                    # Query for related failure status with retry
                    esd_close_data = await retry_query(
                        self._query_esd_alerts,
                        sap_id, 
                        fail_status_interlock, 
                        time_window,
                        max_retries=5,
                        retry_delay=4
                    )
                    
                    if esd_close_data:
                        alerts_found = True
                        logger.info(f"Found relevant alerts for {fail_status_interlock} on attempt {attempt_count+1}")
                        # Process the found alerts
                        for alert in esd_close_data:
                            esd_device_name = alert.get('tas_device_name', '')
                            if esd_device_name:
                                esd_device_names.append(esd_device_name)
                        
                        if esd_close_data:
                            location_name = esd_close_data[0].get("location_name", "")
                
                if not alerts_found:
                    attempt_count += 1
                    logger.info(f"Attempt {attempt_count}/{max_attempts}: Waiting for alerts to arrive...")
                    await asyncio.sleep(poll_interval)
            
            logger.info(f"ESD device names found: {esd_device_names}")
            
            if not esd_device_names:
                logger.info("No ESD device names found, cannot proceed with alert creation")
                return True, {"status": "no ESD device names found"}
                
            # Step 2: Get maintenance and fault alerts, but filter them for relevant devices
            # Check for maintenance alerts - get unique device names
            maint_alerts, maintenance_alert_count, device_alerts_map = await retry_query(
                self._query_maintenance_alerts, 
                sap_id,
                device_names=esd_device_names,  # Pass device names to filter
                max_retries=5,
                retry_delay=4
            )
            logger.info(f"maintenance alertcount for relevant ESD devices: {maintenance_alert_count}")
            
            # Check for fault alerts - get unique device names with retry
            fault_alerts, fault_alert_count, device_alerts_map = await retry_query(
                self._query_fault_alerts, 
                sap_id,
                device_names=esd_device_names,  # Pass device names to filter
                max_retries=5,
                retry_delay=4
            )
            logger.info(f"fault_alert_count for relevant ESD devices: {fault_alert_count}")
            
            # Get pipeline mode and close status counts for both types
            rosov_pl_close_count = mov_pl_close_count = esd_close_status_count = esd_mov_close_status_count = 0
            
            # Get PL mode and close status counts for ROSOV
            if is_rosov_alert:
                esd_status_data = await retry_query(
                    self._query_esd_status_alerts, 
                    sap_id, 
                    ESD_ROSOV_CLOSE, 
                    time_window,
                    max_retries=5,
                    retry_delay=4
                )
                esd_close_status_count = len(esd_status_data.get("data", []))
                
                rosov_pl_data = await retry_query(
                    self._query_pl_mode_alerts, 
                    sap_id, 
                    ROSOV_PL_MODE, 
                    time_window,
                    max_retries=5,
                    retry_delay=4
                )
                rosov_pl_close_count = len(rosov_pl_data.get("data", []))
            
            # Get PL mode and close status counts for DBBV/MOV
            if is_dbbv_alert:
                esd_mov_status_data = await retry_query(
                    self._query_esd_status_alerts, 
                    sap_id, 
                    ESD_MOV_CLOSE, 
                    time_window,
                    max_retries=5,
                    retry_delay=4
                )
                esd_mov_close_status_count = len(esd_mov_status_data.get("data", []))
                
                mov_pl_data = await retry_query(
                    self._query_pl_mode_alerts, 
                    sap_id, 
                    MOV_PL_MODE, 
                    time_window,
                    max_retries=5,
                    retry_delay=4
                )
                mov_pl_close_count = len(mov_pl_data.get("data", []))
                    
            # Get total tank count from architecture data with retry
            total_tank_count = await retry_query(
                self._get_total_tank_count, 
                sap_id,
                max_retries=5,
                retry_delay=4
            )
            
            # Step 3: Implement the logic patterns for decision making
            
            # Calculate totals for comparison with tank count - KEEPING MAINTENANCE AND FAULT SEPARATE
            rosov_total_with_maintenance = maintenance_alert_count + rosov_pl_close_count + esd_close_status_count
            rosov_total_with_fault = fault_alert_count + rosov_pl_close_count + esd_close_status_count
            
            dbbv_total_with_maintenance = maintenance_alert_count + mov_pl_close_count + esd_mov_close_status_count
            dbbv_total_with_fault = fault_alert_count + mov_pl_close_count + esd_mov_close_status_count
            
            # Flag for PL mode, maintenance status, fault status
            has_pl_mode = (rosov_pl_close_count > 0) if is_rosov_alert else (mov_pl_close_count > 0)
            has_maintenance = maintenance_alert_count > 0
            has_fault = fault_alert_count > 0
            
            logger.info(f"ROSOV counts - maintenance path: {rosov_total_with_maintenance}, fault path: {rosov_total_with_fault}")
            logger.info(f"DBBV counts - maintenance path: {dbbv_total_with_maintenance}, fault path: {dbbv_total_with_fault}")
            
            # Determine if we should create a new alert
            create_alert = False
            using_path = ""
            
            if is_rosov_alert:
                # Logic Pattern 1: PL Mode + Maintenance + Counts Match
                if has_pl_mode and has_maintenance and rosov_total_with_maintenance == total_tank_count:
                    create_alert = True
                    using_path = "maintenance"
                    logger.info("Pattern 1A: ROSOV - PL Mode + Maintenance + Counts Match")
                
                # Logic Pattern 1: PL Mode + Fault + Counts Match
                elif has_pl_mode and has_fault and rosov_total_with_fault == total_tank_count:
                    create_alert = True
                    using_path = "fault"
                    logger.info("Pattern 1B: ROSOV - PL Mode + Fault + Counts Match")
                
                # Logic Pattern 2: PL Mode + NO Maintenance + NO Fault + Counts Match
                elif has_pl_mode and not has_maintenance and not has_fault and (rosov_pl_close_count + esd_close_status_count) == total_tank_count:
                    create_alert = True
                    using_path = "clean"
                    logger.info("Pattern 2: ROSOV - PL Mode + NO Maintenance/Fault + Counts Match")
                
                # Logic Pattern 3: NO PL Mode + Maintenance + Counts Match
                elif not has_pl_mode and has_maintenance and rosov_total_with_maintenance == total_tank_count:
                    create_alert = True
                    using_path = "maintenance_no_pl"
                    logger.info("Pattern 3A: ROSOV - NO PL Mode + Maintenance + Counts Match")
                
                # Logic Pattern 3: NO PL Mode + Fault + Counts Match
                elif not has_pl_mode and has_fault and rosov_total_with_fault == total_tank_count:
                    create_alert = True
                    using_path = "fault_no_pl"
                    logger.info("Pattern 3B: ROSOV - NO PL Mode + Fault + Counts Match")
                
                if create_alert:
                    return await retry_query(
                        self._create_rosov_alert,
                        bu, 
                        sap_id, 
                        location_name, 
                        max(rosov_total_with_maintenance, rosov_total_with_fault),
                        max_retries=5,
                        retry_delay=4
                    )
            
            elif is_dbbv_alert:
                # Logic Pattern 1: PL Mode + Maintenance + Counts Match
                if has_pl_mode and has_maintenance and dbbv_total_with_maintenance == total_tank_count:
                    create_alert = True
                    using_path = "maintenance"
                    logger.info("Pattern 1A: DBBV - PL Mode + Maintenance + Counts Match ---> %s", dbbv_total_with_maintenance, total_tank_count)
                
                # Logic Pattern 1: PL Mode + Fault + Counts Match
                elif has_pl_mode and has_fault and dbbv_total_with_fault == total_tank_count:
                    create_alert = True
                    using_path = "fault"
                    logger.info("Pattern 1B: DBBV - PL Mode + Fault + Counts Match ---> %s", dbbv_total_with_fault, total_tank_count)
                
                # Logic Pattern 2: PL Mode + NO Maintenance + NO Fault + Counts Match
                elif has_pl_mode and not has_maintenance and not has_fault and (mov_pl_close_count + esd_mov_close_status_count) == total_tank_count:
                    create_alert = True
                    using_path = "clean"
                    logger.info("Pattern 2: DBBV - PL Mode + NO Maintenance/Fault + Counts Match ---> %s", (mov_pl_close_count + esd_mov_close_status_count), total_tank_count)
                
                # Logic Pattern 3: NO PL Mode + Maintenance + Counts Match
                elif not has_pl_mode and has_maintenance and dbbv_total_with_maintenance == total_tank_count:
                    create_alert = True
                    using_path = "maintenance_no_pl"
                    logger.info("Pattern 3A: DBBV - NO PL Mode + Maintenance + Counts Match ---> %s", dbbv_total_with_maintenance, total_tank_count)
                
                # Logic Pattern 3: NO PL Mode + Fault + Counts Match
                elif not has_pl_mode and has_fault and dbbv_total_with_fault == total_tank_count:
                    create_alert = True
                    using_path = "fault_no_pl"
                    logger.info("Pattern 3B: DBBV - NO PL Mode + Fault + Counts Match ---> %s", dbbv_total_with_fault, total_tank_count)
                
                if create_alert:
                    return await retry_query(
                        self._create_dbbv_alert,
                        bu, 
                        sap_id, 
                        location_name, 
                        max(dbbv_total_with_maintenance, dbbv_total_with_fault),
                        max_retries=5,
                        retry_delay=4
                    )
            
            # Otherwise (no conditions met): Update alert history
            logger.info("No pattern matched: Updating alert history for %s", esd_device_names)
            if esd_device_names:
                if is_rosov_alert:
                    for dev_name in esd_device_names:
                        await retry_query(
                            self._update_alert_history,
                            bu=bu,
                            sap_id=sap_id,
                            device_name=dev_name,
                            interlock_name=ROSOV_INTERLOCK,
                            fail_status_interlock=ESD_ROSOV_FAIL,
                            max_retries=5,
                            retry_delay=4
                        )
                elif is_dbbv_alert:
                    for dev_name in esd_device_names:
                        await retry_query(
                            self._update_alert_history,
                            bu=bu,
                            sap_id=sap_id,
                            device_name=dev_name,
                            interlock_name=DBBV_INTERLOCK,
                            fail_status_interlock=ESD_MOV_FAIL,
                            max_retries=5,
                            retry_delay=4
                        )
        
            return True, {
                "status": "counts don't match", 
                "path_used": using_path,
                "rosov_total_maintenance": rosov_total_with_maintenance,
                "rosov_total_fault": rosov_total_with_fault,
                "dbbv_total_maintenance": dbbv_total_with_maintenance,
                "dbbv_total_fault": dbbv_total_with_fault,
                "tank_count": total_tank_count,
                "has_pl_mode": has_pl_mode,
                "has_maintenance": has_maintenance,
                "has_fault": has_fault,
                "esd_device_names": esd_device_names
            }
        
        except Exception as e:
            logger.info(traceback.format_exc())
            logger.error(traceback.format_exc())
            return False, {"status": str(e)}

    # async def _query_maintenance_alerts(self, sap_id):
    #     """Query for maintenance alerts with empty data retry"""
    #     try:
    #         logger.info(f"Querying maintenance alerts for SAP ID: {sap_id}")
            
    #         # List of maintenance alert types to check for
    #         maintenance_types = ["Tank_Under Maintenance", "ROSOV_Under Maintenance", "MOV_Under Maintenance"]
            
    #         # Query for open maintenance alerts
    #         maintenance_query = (
    #             f"bu = 'TAS' AND "
    #             f"sap_id = '{sap_id}' AND "
    #             f"alert_section = 'TAS' AND "
    #             f"alert_status != 'Close'"
    #         )
            
    #         maintenance_params = urdhva_base.queryparams.QueryParams(q=maintenance_query)
            
    #         # First attempt the query
    #         maintenance_resp = await hpcl_ceg_model.Alerts.get_all(maintenance_params, resp_type='plain')
            
    #         # If we get empty data, retry up to 3 more times
    #         empty_retry_count = 0
    #         max_empty_retries = 3
    #         while (not maintenance_resp or 
    #             "data" not in maintenance_resp or 
    #             not maintenance_resp["data"]) and empty_retry_count < max_empty_retries:
                
    #             empty_retry_count += 1
    #             logger.info(f"Empty maintenance alerts data, retry attempt {empty_retry_count}/{max_empty_retries}")
                
    #             # Increasing backoff delay for each retry
    #             retry_delay = 2 * (1.5 ** empty_retry_count)
    #             await asyncio.sleep(retry_delay)
                
    #             # Retry the query
    #             maintenance_resp = await hpcl_ceg_model.Alerts.get_all(maintenance_params, resp_type='plain')
            
    #         logger.debug(f"Maintenance alerts query response after {empty_retry_count} empty retries: {json.dumps(maintenance_resp, default=str)}")
            
    #         # Filter alerts for maintenance types
    #         maintenance_alerts = []
    #         device_alerts_map = {}  # Dictionary to track alerts by device_id and device
            
    #         if maintenance_resp and "data" in maintenance_resp and maintenance_resp["data"]:
    #             # Make sure we're working with a list of dictionary objects
    #             alerts_data = maintenance_resp["data"]
                
    #             for alert in alerts_data:
    #                 # Ensure alert is a dictionary before using .get()
    #                 if isinstance(alert, dict):
    #                     interlock_name = alert.get("interlock_name", "")
    #                     # Check if this alert is a maintenance type alert
    #                     if any(maint_type in interlock_name for maint_type in maintenance_types):
    #                         maintenance_alerts.append(alert)
                            
    #                         # Track devices with alerts
    #                         device_id = alert.get("device_id")
    #                         device = alert.get("device")
                            
    #                         if device_id and device:
    #                             # Create a unique key using device_id and device
    #                             device_key = f"{device_id}_{device}"
                                
    #                             if device_key not in device_alerts_map:
    #                                 device_alerts_map[device_key] = []
                                
    #                             device_alerts_map[device_key].append(alert)
    #                 else:
    #                     logger.warning(f"Unexpected alert data type: {type(alert)}, expected dict. Value: {alert}")
            
    #         maintenance_alert_count = len(maintenance_alerts)
    #         logger.info(f"Found {maintenance_alert_count} maintenance alerts")
            
    #         # Find devices with multiple alerts
    #         devices_with_multiple_alerts = {
    #             device_key: alerts for device_key, alerts in device_alerts_map.items() 
    #             if len(alerts) > 1
    #         }
            
    #         if devices_with_multiple_alerts:
    #             logger.info(f"Found {len(devices_with_multiple_alerts)} devices with multiple maintenance alerts")
    #             for device_key, alerts in devices_with_multiple_alerts.items():
    #                 device_id, device = device_key.split('_', 1)
    #                 logger.info(f"Device ID: {device_id}, Device: {device} has {len(alerts)} maintenance alerts")
            
    #         return maintenance_alerts, maintenance_alert_count, device_alerts_map
            
    #     except Exception as e:
    #         logger.error(f"Error in _query_maintenance_alerts: {e}")
    #         logger.error(traceback.format_exc())
    #         # Return empty list, zero count, and empty map in case of error
    #         return [], 0, {}


    # async def _query_fault_alerts(self, sap_id):
    #     """Query for fault alerts with empty data retry"""
    #     try:
    #         fault_query = (
    #             f"bu = 'TAS' AND sap_id = '{sap_id}' AND alert_section = 'TAS' "
    #             f"AND sop_id = 'SOP018' AND alert_status != 'Close'"
    #         )
    #         fault_params = urdhva_base.queryparams.QueryParams()
    #         fault_params.q = fault_query
    #         logger.info(f"Fault query: {fault_params.q}")
    #         fault_params.fields = ["tas_device_name"]

    #         # First attempt the query
    #         fault_resp = await hpcl_ceg_model.Alerts.get_all(fault_params, resp_type='plain')
            
    #         # If we get empty data, retry up to 3 more times
    #         empty_retry_count = 0
    #         max_empty_retries = 3
    #         while (not fault_resp or 
    #             "data" not in fault_resp or 
    #             not fault_resp["data"]) and empty_retry_count < max_empty_retries:
                
    #             empty_retry_count += 1
    #             logger.info(f"Empty fault alerts data, retry attempt {empty_retry_count}/{max_empty_retries}")
                
    #             # Increasing backoff delay for each retry
    #             retry_delay = 2 * (1.5 ** empty_retry_count)
    #             await asyncio.sleep(retry_delay)
                
    #             # Retry the query
    #             fault_resp = await hpcl_ceg_model.Alerts.get_all(fault_params, resp_type='plain')
            
    #         logger.debug(f"Fault alerts response after {empty_retry_count} empty retries: {json.dumps(fault_resp, default=str)}")
            
    #         # Process and organize fault alerts by device
    #         fault_alerts = []
    #         device_alerts_map = {}  # Dictionary to track alerts by device_id and device
            
    #         if fault_resp and "data" in fault_resp and fault_resp["data"]:
    #             # Make sure we're working with a list of dictionary objects
    #             alerts_data = fault_resp["data"]
                
    #             for alert in alerts_data:
    #                 # Ensure alert is a dictionary before using .get()
    #                 if isinstance(alert, dict):
    #                     fault_alerts.append(alert)
                        
    #                     # Track devices with alerts
    #                     device_id = alert.get("device_id")
    #                     device = alert.get("device") or alert.get("tas_device_name")
                        
    #                     if device_id and device:
    #                         # Create a unique key using device_id and device
    #                         device_key = f"{device_id}_{device}"
                            
    #                         if device_key not in device_alerts_map:
    #                             device_alerts_map[device_key] = []
                            
    #                         device_alerts_map[device_key].append(alert)
    #                 else:
    #                     logger.warning(f"Unexpected alert data type: {type(alert)}, expected dict. Value: {alert}")
            
    #         fault_alert_count = len(fault_alerts)
    #         logger.info(f"Found {fault_alert_count} fault alerts")
            
    #         # Find devices with multiple alerts
    #         devices_with_multiple_alerts = {
    #             device_key: alerts for device_key, alerts in device_alerts_map.items() 
    #             if len(alerts) > 1
    #         }
            
    #         if devices_with_multiple_alerts:
    #             logger.info(f"Found {len(devices_with_multiple_alerts)} devices with multiple fault alerts")
    #             for device_key, alerts in devices_with_multiple_alerts.items():
    #                 device_id, device = device_key.split('_', 1)
    #                 logger.info(f"Device ID: {device_id}, Device: {device} has {len(alerts)} fault alerts")
            
    #         return fault_alerts, fault_alert_count, device_alerts_map
            
    #     except Exception as e:
    #         logger.error(f"Error in _query_fault_alerts: {e}")
    #         logger.error(traceback.format_exc())
    #         # Return empty list, zero count, and empty map in case of error
    #         return [], 0, {}


    # async def _query_maintenance_alerts(self, sap_id):
    #     """Query for maintenance alerts with empty data retry"""
    #     try:
    #         logger.info(f"Querying maintenance alerts for SAP ID: {sap_id}")
            
    #         # List of maintenance alert types to check for
    #         maintenance_types = ["Tank_Under Maintenance", "ROSOV_Under Maintenance", "MOV_Under Maintenance"]
            
    #         # Query for open maintenance alerts
    #         maintenance_query = (
    #             f"bu = 'TAS' AND "
    #             f"sap_id = '{sap_id}' AND "
    #             f"alert_section = 'TAS' AND "
    #             f"alert_status != 'Close'"
    #         )
            
    #         maintenance_params = urdhva_base.queryparams.QueryParams(q=maintenance_query)
            
    #         # First attempt the query
    #         maintenance_resp = await hpcl_ceg_model.Alerts.get_all(maintenance_params, resp_type='plain')
            
    #         # If we get empty data, retry up to 3 more times
    #         empty_retry_count = 0
    #         max_empty_retries = 3
    #         while (not maintenance_resp or 
    #             "data" not in maintenance_resp or 
    #             not maintenance_resp["data"]) and empty_retry_count < max_empty_retries:
                
    #             empty_retry_count += 1
    #             logger.info(f"Empty maintenance alerts data, retry attempt {empty_retry_count}/{max_empty_retries}")
                
    #             # Increasing backoff delay for each retry
    #             retry_delay = 2 * (1.5 ** empty_retry_count)
    #             await asyncio.sleep(retry_delay)
                
    #             # Retry the query
    #             maintenance_resp = await hpcl_ceg_model.Alerts.get_all(maintenance_params, resp_type='plain')
            
    #         logger.debug(f"Maintenance alerts query response after {empty_retry_count} empty retries: {json.dumps(maintenance_resp, default=str)}")
            
    #         # Filter alerts for maintenance types
    #         maintenance_alerts = []
    #         device_alerts_map = {}  # Dictionary to track alerts by device name (not device_id)
            
    #         if maintenance_resp and "data" in maintenance_resp and maintenance_resp["data"]:
    #             # Make sure we're working with a list of dictionary objects
    #             alerts_data = maintenance_resp["data"]
                
    #             for alert in alerts_data:
    #                 # Ensure alert is a dictionary before using .get()
    #                 if isinstance(alert, dict):
    #                     interlock_name = alert.get("interlock_name", "")
    #                     # Check if this alert is a maintenance type alert
    #                     if any(maint_type in interlock_name for maint_type in maintenance_types):
    #                         maintenance_alerts.append(alert)
                            
    #                         # Track devices with alerts - UPDATED to use device_name as key for easier comparison
    #                         device_name = alert.get("device") or alert.get("tas_device_name", "")
                            
    #                         if device_name:
    #                             # Standardize key for comparison with fault alerts
    #                             if device_name not in device_alerts_map:
    #                                 device_alerts_map[device_name] = []
                                
    #                             device_alerts_map[device_name].append(alert)
    #                 else:
    #                     logger.warning(f"Unexpected alert data type: {type(alert)}, expected dict. Value: {alert}")
            
    #         maintenance_alert_count = len(maintenance_alerts)
    #         logger.info(f"Found {maintenance_alert_count} maintenance alerts across {len(device_alerts_map)} unique devices")
            
    #         # Find devices with multiple alerts
    #         devices_with_multiple_alerts = {
    #             device_name: alerts for device_name, alerts in device_alerts_map.items() 
    #             if len(alerts) > 1
    #         }
            
    #         if devices_with_multiple_alerts:
    #             logger.info(f"Found {len(devices_with_multiple_alerts)} devices with multiple maintenance alerts")
    #             for device_name, alerts in devices_with_multiple_alerts.items():
    #                 logger.info(f"Device: {device_name} has {len(alerts)} maintenance alerts")
            
    #         return maintenance_alerts, maintenance_alert_count, device_alerts_map
            
    #     except Exception as e:
    #         logger.error(f"Error in _query_maintenance_alerts: {e}")
    #         logger.error(traceback.format_exc())
    #         # Return empty list, zero count, and empty map in case of error
    #         return [], 0, {}


    # async def _query_fault_alerts(self, sap_id):
    #     """Query for fault alerts with empty data retry"""
    #     try:
    #         fault_query = (
    #             f"bu = 'TAS' AND sap_id = '{sap_id}' AND alert_section = 'TAS' "
    #             f"AND sop_id = 'SOP018' AND alert_status != 'Close'"
    #         )
    #         fault_params = urdhva_base.queryparams.QueryParams()
    #         fault_params.q = fault_query
    #         logger.info(f"Fault query: {fault_params.q}")
    #         fault_params.fields = ["tas_device_name"]

    #         # First attempt the query
    #         fault_resp = await hpcl_ceg_model.Alerts.get_all(fault_params, resp_type='plain')
            
    #         # If we get empty data, retry up to 3 more times
    #         empty_retry_count = 0
    #         max_empty_retries = 3
    #         while (not fault_resp or 
    #             "data" not in fault_resp or 
    #             not fault_resp["data"]) and empty_retry_count < max_empty_retries:
                
    #             empty_retry_count += 1
    #             logger.info(f"Empty fault alerts data, retry attempt {empty_retry_count}/{max_empty_retries}")
                
    #             # Increasing backoff delay for each retry
    #             retry_delay = 2 * (1.5 ** empty_retry_count)
    #             await asyncio.sleep(retry_delay)
                
    #             # Retry the query
    #             fault_resp = await hpcl_ceg_model.Alerts.get_all(fault_params, resp_type='plain')
            
    #         logger.debug(f"Fault alerts response after {empty_retry_count} empty retries: {json.dumps(fault_resp, default=str)}")
            
    #         # Process and organize fault alerts by device
    #         fault_alerts = []
    #         device_alerts_map = {}  # Dictionary to track alerts by device name for comparison with maintenance
            
    #         if fault_resp and "data" in fault_resp and fault_resp["data"]:
    #             # Make sure we're working with a list of dictionary objects
    #             alerts_data = fault_resp["data"]
                
    #             for alert in alerts_data:
    #                 # Ensure alert is a dictionary before using .get()
    #                 if isinstance(alert, dict):
    #                     fault_alerts.append(alert)
                        
    #                     # Track devices with alerts - UPDATED to use device_name as key
    #                     device_name = alert.get("tas_device_name", "")
                        
    #                     if device_name:
    #                         # Standardize key for comparison with maintenance alerts
    #                         if device_name not in device_alerts_map:
    #                             device_alerts_map[device_name] = []
                            
    #                         device_alerts_map[device_name].append(alert)
    #                 else:
    #                     logger.warning(f"Unexpected alert data type: {type(alert)}, expected dict. Value: {alert}")
            
    #         fault_alert_count = len(fault_alerts)
    #         logger.info(f"Found {fault_alert_count} fault alerts across {len(device_alerts_map)} unique devices")
            
    #         # Find devices with multiple alerts
    #         devices_with_multiple_alerts = {
    #             device_name: alerts for device_name, alerts in device_alerts_map.items() 
    #             if len(alerts) > 1
    #         }
            
    #         if devices_with_multiple_alerts:
    #             logger.info(f"Found {len(devices_with_multiple_alerts)} devices with multiple fault alerts")
    #             for device_name, alerts in devices_with_multiple_alerts.items():
    #                 logger.info(f"Device: {device_name} has {len(alerts)} fault alerts")
            
    #         return fault_alerts, fault_alert_count, device_alerts_map
            
    #     except Exception as e:
    #         logger.error(f"Error in _query_fault_alerts: {e}")
    #         logger.error(traceback.format_exc())
    #         # Return empty list, zero count, and empty map in case of error
    #         return [], 0, {}


    async def _query_maintenance_alerts(self, sap_id, device_names=None):
        """
        Query for maintenance alerts with empty data retry
        
        Args:
            sap_id (str): The SAP ID to query for
            device_names (list): Optional list of ESD device names to filter by
        
        Returns:
            tuple: (maintenance_alerts, maintenance_alert_count, device_alerts_map)
        """
        try:
            logger.info(f"Querying maintenance alerts for SAP ID: {sap_id}")
            if device_names:
                logger.info(f"Filtering by {len(device_names)} device names: {device_names}")
            
            # List of maintenance alert types to check for
            maintenance_types = ["Tank_Under Maintenance", "ROSOV_Under Maintenance", "MOV_Under Maintenance"]
            
            # Query for open maintenance alerts
            maintenance_query = (
                f"bu = 'TAS' AND "
                f"sap_id = '{sap_id}' AND "
                f"alert_section = 'TAS' AND "
                f"alert_status != 'Close'"
            )
            
            maintenance_params = urdhva_base.queryparams.QueryParams(q=maintenance_query)
            
            # First attempt the query
            maintenance_resp = await hpcl_ceg_model.Alerts.get_all(maintenance_params, resp_type='plain')
            
            # If we get empty data, retry up to 3 more times
            empty_retry_count = 0
            max_empty_retries = 3
            while (not maintenance_resp or 
                "data" not in maintenance_resp or 
                not maintenance_resp["data"]) and empty_retry_count < max_empty_retries:
                
                empty_retry_count += 1
                logger.info(f"Empty maintenance alerts data, retry attempt {empty_retry_count}/{max_empty_retries}")
                
                # Increasing backoff delay for each retry
                retry_delay = 2 * (1.5 ** empty_retry_count)
                await asyncio.sleep(retry_delay)
                
                # Retry the query
                maintenance_resp = await hpcl_ceg_model.Alerts.get_all(maintenance_params, resp_type='plain')
            
            logger.debug(f"Maintenance alerts query response after {empty_retry_count} empty retries: {json.dumps(maintenance_resp, default=str)}")
            
            # Filter alerts for maintenance types
            maintenance_alerts = []
            device_alerts_map = {}  # Dictionary to track alerts by device name for comparison with ESD alerts
            
            if maintenance_resp and "data" in maintenance_resp and maintenance_resp["data"]:
                # Make sure we're working with a list of dictionary objects
                alerts_data = maintenance_resp["data"]
                
                for alert in alerts_data:
                    # Ensure alert is a dictionary before using .get()
                    if isinstance(alert, dict):
                        interlock_name = alert.get("interlock_name", "")
                        device_name = alert.get("device") or alert.get("tas_device_name", "")
                        
                        # Check if this alert is a maintenance type alert
                        if any(maint_type in interlock_name for maint_type in maintenance_types):
                            # Check if we need to filter by specific device names
                            if device_names and device_name not in device_names:
                                logger.info(f"Skipping maintenance alert for device {device_name} - not in ESD device list")
                                continue
                                
                            maintenance_alerts.append(alert)
                            
                            # Track devices with alerts
                            if device_name:
                                # Standardize key for comparison
                                if device_name not in device_alerts_map:
                                    device_alerts_map[device_name] = []
                                
                                device_alerts_map[device_name].append(alert)
                    else:
                        logger.warning(f"Unexpected alert data type: {type(alert)}, expected dict. Value: {alert}")
            
            maintenance_alert_count = len(maintenance_alerts)
            logger.info(f"Found {maintenance_alert_count} maintenance alerts across {len(device_alerts_map)} unique devices")
            
            # Find devices with multiple alerts
            devices_with_multiple_alerts = {
                device_name: alerts for device_name, alerts in device_alerts_map.items() 
                if len(alerts) > 1
            }
            
            if devices_with_multiple_alerts:
                logger.info(f"Found {len(devices_with_multiple_alerts)} devices with multiple maintenance alerts")
                for device_name, alerts in devices_with_multiple_alerts.items():
                    logger.info(f"Device: {device_name} has {len(alerts)} maintenance alerts")
            
            return maintenance_alerts, maintenance_alert_count, device_alerts_map
            
        except Exception as e:
            logger.error(f"Error in _query_maintenance_alerts: {e}")
            logger.error(traceback.format_exc())
            # Return empty list, zero count, and empty map in case of error
            return [], 0, {}


    async def _query_fault_alerts(self, sap_id, device_names=None):
        """
        Query for fault alerts with empty data retry
        
        Args:
            sap_id (str): The SAP ID to query for
            device_names (list): Optional list of ESD device names to filter by
        
        Returns:
            tuple: (fault_alerts, fault_alert_count, device_alerts_map)
        """
        try:
            fault_query = (
                f"bu = 'TAS' AND sap_id = '{sap_id}' AND alert_section = 'TAS' "
                f"AND sop_id = 'SOP018' AND alert_status != 'Close'"
            )
            fault_params = urdhva_base.queryparams.QueryParams()
            fault_params.q = fault_query
            logger.info(f"Fault query: {fault_params.q}")
            fault_params.fields = ["tas_device_name"]

            # First attempt the query
            fault_resp = await hpcl_ceg_model.Alerts.get_all(fault_params, resp_type='plain')
            
            # If we get empty data, retry up to 3 more times
            empty_retry_count = 0
            max_empty_retries = 3
            while (not fault_resp or 
                "data" not in fault_resp or 
                not fault_resp["data"]) and empty_retry_count < max_empty_retries:
                
                empty_retry_count += 1
                logger.info(f"Empty fault alerts data, retry attempt {empty_retry_count}/{max_empty_retries}")
                
                # Increasing backoff delay for each retry
                retry_delay = 2 * (1.5 ** empty_retry_count)
                await asyncio.sleep(retry_delay)
                
                # Retry the query
                fault_resp = await hpcl_ceg_model.Alerts.get_all(fault_params, resp_type='plain')
            
            logger.debug(f"Fault alerts response after {empty_retry_count} empty retries: {json.dumps(fault_resp, default=str)}")
            
            # Process and organize fault alerts by device
            fault_alerts = []
            device_alerts_map = {}  # Dictionary to track alerts by device name for comparison with ESD alerts
            
            if fault_resp and "data" in fault_resp and fault_resp["data"]:
                # Make sure we're working with a list of dictionary objects
                alerts_data = fault_resp["data"]
                
                for alert in alerts_data:
                    # Ensure alert is a dictionary before using .get()
                    if isinstance(alert, dict):
                        device_name = alert.get("tas_device_name", "")
                        
                        # Check if we need to filter by specific device names
                        if device_names and device_name not in device_names:
                            logger.info(f"Skipping fault alert for device {device_name} - not in ESD device list")
                            continue
                        
                        fault_alerts.append(alert)
                        
                        # Track devices with alerts
                        if device_name:
                            # Standardize key for comparison
                            if device_name not in device_alerts_map:
                                device_alerts_map[device_name] = []
                            
                            device_alerts_map[device_name].append(alert)
                    else:
                        logger.warning(f"Unexpected alert data type: {type(alert)}, expected dict. Value: {alert}")
            
            fault_alert_count = len(fault_alerts)
            logger.info(f"Found {fault_alert_count} fault alerts across {len(device_alerts_map)} unique devices")
            
            # Find devices with multiple alerts
            devices_with_multiple_alerts = {
                device_name: alerts for device_name, alerts in device_alerts_map.items() 
                if len(alerts) > 1
            }
            
            if devices_with_multiple_alerts:
                logger.info(f"Found {len(devices_with_multiple_alerts)} devices with multiple fault alerts")
                for device_name, alerts in devices_with_multiple_alerts.items():
                    logger.info(f"Device: {device_name} has {len(alerts)} fault alerts")
            
            return fault_alerts, fault_alert_count, device_alerts_map
            
        except Exception as e:
            logger.error(f"Error in _query_fault_alerts: {e}")
            logger.error(traceback.format_exc())
            # Return empty list, zero count, and empty map in case of error
            return [], 0, {}


    async def _query_esd_alerts(self, sap_id, interlock_name, time_window):
        """Query for ESD alerts based on interlock name with empty data retry"""
        esd_query = (
            f"bu = 'TAS' AND sap_id = '{sap_id}' AND alert_section = 'TAS' "
            f"AND interlock_name = '{interlock_name}' "
            f"AND alert_status != 'Close' "
            f"AND created_at >= NOW() - INTERVAL '{time_window} minutes'"
        )
        esd_params = urdhva_base.queryparams.QueryParams()
        esd_params.q = esd_query
        logger.info(f"Query for {interlock_name}: {esd_params.q}")
        esd_params.fields = ["tas_device_name", "location_name"]

        # First attempt the query
        esd_close_alerts = await hpcl_ceg_model.Alerts.get_all(esd_params, resp_type='plain')
        
        # If we get empty data, retry up to 3 more times
        empty_retry_count = 0
        max_empty_retries = 3
        alert_data = esd_close_alerts.get("data", [])
        
        while (not alert_data or len(alert_data) == 0) and empty_retry_count < max_empty_retries:
            empty_retry_count += 1
            logger.info(f"Empty ESD alerts data for {interlock_name}, retry attempt {empty_retry_count}/{max_empty_retries}")
            
            # Increasing backoff delay for each retry
            retry_delay = 2 * (1.5 ** empty_retry_count)
            await asyncio.sleep(retry_delay)
            
            # Retry the query
            esd_close_alerts = await hpcl_ceg_model.Alerts.get_all(esd_params, resp_type='plain')
            alert_data = esd_close_alerts.get("data", [])
        
        logger.info(f"ESD alerts for {interlock_name} after {empty_retry_count} empty retries: {len(alert_data)} alerts found")
        return alert_data


    async def _query_esd_status_alerts(self, sap_id, interlock_name, time_window):
        """Query for ESD status alerts with empty data retry"""
        esd_status_query = (
            f"bu = 'TAS' AND sap_id = '{sap_id}' AND alert_section = 'TAS' AND "
            f"interlock_name = '{interlock_name}' AND alert_status != 'Open' AND created_at >= NOW() - INTERVAL '{time_window} minutes'"
        )
        esd_status_params = urdhva_base.queryparams.QueryParams()
        esd_status_params.q = esd_status_query
        logger.info(f"ESD status query: {esd_status_params.q}")
        
        # First attempt the query
        esd_status_data = await hpcl_ceg_model.Alerts.get_all(esd_status_params, resp_type='plain')
        
        # If we get empty data, retry up to 3 more times
        empty_retry_count = 0
        max_empty_retries = 3
        
        while (not esd_status_data or 
            "data" not in esd_status_data or 
            not esd_status_data["data"]) and empty_retry_count < max_empty_retries:
            
            empty_retry_count += 1
            logger.info(f"Empty ESD status data for {interlock_name}, retry attempt {empty_retry_count}/{max_empty_retries}")
            
            # Increasing backoff delay for each retry
            retry_delay = 2 * (1.5 ** empty_retry_count)
            await asyncio.sleep(retry_delay)
            
            # Retry the query
            esd_status_data = await hpcl_ceg_model.Alerts.get_all(esd_status_params, resp_type='plain')
        
        logger.info(f"ESD status data for {interlock_name} after {empty_retry_count} empty retries: {esd_status_data}")
        return esd_status_data


    async def _query_pl_mode_alerts(self, sap_id, interlock_name, time_window):
        """Query for PL mode alerts with empty data retry"""
        pl_query = (
            f"bu = 'TAS' AND sap_id = '{sap_id}' AND alert_section = 'TAS' AND "
            f"interlock_name = '{interlock_name}' AND alert_status != 'Open' AND created_at >= NOW() - INTERVAL '{time_window} minutes'"
        )
        pl_params = urdhva_base.queryparams.QueryParams()
        pl_params.q = pl_query
        logger.info(f"PL mode query: {pl_params.q}")
        
        # First attempt the query
        pl_data = await hpcl_ceg_model.Alerts.get_all(pl_params, resp_type='plain')
        
        # If we get empty data, retry up to 3 more times
        empty_retry_count = 0
        max_empty_retries = 3
        
        while (not pl_data or 
            "data" not in pl_data or 
            not pl_data["data"]) and empty_retry_count < max_empty_retries:
            
            empty_retry_count += 1
            logger.info(f"Empty PL mode data for {interlock_name}, retry attempt {empty_retry_count}/{max_empty_retries}")
            
            # Increasing backoff delay for each retry
            retry_delay = 2 * (1.5 ** empty_retry_count)
            await asyncio.sleep(retry_delay)
            
            # Retry the query
            pl_data = await hpcl_ceg_model.Alerts.get_all(pl_params, resp_type='plain')
        
        logger.info(f"PL mode data for {interlock_name} after {empty_retry_count} empty retries: {pl_data}")
        return pl_data


    async def _get_total_tank_count(self, sap_id):
        """Get total tank count from architecture data with empty data retry"""
        arch_query = f"sap_id = '{sap_id}'"
        arch_params = urdhva_base.queryparams.QueryParams()
        arch_params.q = arch_query
        logger.info(f"Architecture query: {arch_params.q}")
        arch_params.fields = ["total_tank_count"]

        # First attempt the query
        arch_data = await hpcl_ceg_model.ArchitectureData.get_all(arch_params, resp_type='plain')
        
        # If we get empty data, retry up to 3 more times
        empty_retry_count = 0
        max_empty_retries = 3
        
        while (not arch_data or 
            "data" not in arch_data or 
            not arch_data["data"]) and empty_retry_count < max_empty_retries:
            
            empty_retry_count += 1
            logger.info(f"Empty architecture data, retry attempt {empty_retry_count}/{max_empty_retries}")
            
            # Increasing backoff delay for each retry
            retry_delay = 2 * (1.5 ** empty_retry_count)
            await asyncio.sleep(retry_delay)
            
            # Retry the query
            arch_data = await hpcl_ceg_model.ArchitectureData.get_all(arch_params, resp_type='plain')
        
        logger.info(f"Architecture data after {empty_retry_count} empty retries: {arch_data}")
        tank_counts = {item.get("total_tank_count", 0) for item in arch_data.get("data", [])}
        total_tank_count = max(tank_counts) if tank_counts else 0
        logger.info(f"Total tank count: {total_tank_count}")
        return total_tank_count
    
    async def _create_rosov_alert(self, bu, sap_id, location_name, total_count):
        """Create ROSOV alert"""
        alert_message = "All ROSOVs Closed(Except PL Receipt)"
        alert_data = {
            "bu": bu,
            "sap_id": sap_id,
            "location_name": location_name,
            "sop_id": "SOP02A",
            "interlock_name": alert_message,
            "alert_status": "Open",
            "alert_state": "InProgress",
            "severity": "CRITICAL",
            "alert_section": "TAS",
            "device_name": "",
            "return_data": True
        }
        camunda_url = await helpers.get_camunda_url(bu=bu, sap_id=sap_id,
                                                        alert_section="TAS")
        status, created_alert = await alert_create.AlertFactory().create_alert(alert_data=alert_data, camunda_url=camunda_url)
        logger.info(f"created_alert ROSOV ---> {created_alert}")
        if created_alert and isinstance(created_alert, dict):
            alert_data["id"] = created_alert.get("id")
            al_data = await hpcl_ceg_model.Alerts.get(alert_data['id'])
            if not isinstance(al_data, dict):
                al_data = al_data.__dict__
            if "_sa_instance_state" in al_data.keys():
                del al_data["_sa_instance_state"]
            al_data['alert_status'] = hpcl_ceg_enum.AlertStatus.Close.value
            al_data['alert_state'] = hpcl_ceg_enum.AlertState.Resolved.value
            al_data['closed_at'] = datetime.datetime.now()
            # Update the alert record
            data_obj = hpcl_ceg_model.Alerts(**al_data)
            await data_obj.modify()
            return True, {"status": "success"}
        return True, {"status": "ROSOV alert creation failed"}
    
    async def _create_dbbv_alert(self, bu, sap_id, location_name, total_count):
        """Create DBBV alert"""
        alert_message = "All DBBVs Closed(Except PL Receipt)"
        alert_data = {
            "bu": bu,
            "sap_id": sap_id,
            "location_name": location_name,
            "sop_id": "SOP02A",
            "interlock_name": alert_message,
            "alert_status": "Open",
            "alert_state": "InProgress",
            "severity": "CRITICAL",
            "alert_section": "TAS",
            "device_name": "",
            "return_data": True
        }
        camunda_url = await helpers.get_camunda_url(bu=bu, sap_id=sap_id,
                                                        alert_section="TAS")
        status, created_alert = await alert_create.AlertFactory().create_alert(alert_data=alert_data, camunda_url=camunda_url)
        logger.info(f"created_alert DBBV ---> {created_alert}")
        if created_alert and isinstance(created_alert, dict):
            alert_data["id"] = created_alert.get("id")
            al_data = await hpcl_ceg_model.Alerts.get(alert_data['id'])
            if not isinstance(al_data, dict):
                al_data = al_data.__dict__
            if "_sa_instance_state" in al_data.keys():
                del al_data["_sa_instance_state"]
            al_data['alert_status'] = hpcl_ceg_enum.AlertStatus.Close.value
            al_data['alert_state'] = hpcl_ceg_enum.AlertState.Resolved.value
            al_data['closed_at'] = datetime.datetime.now()
            # Update the alert record
            data_obj = hpcl_ceg_model.Alerts(**al_data)
            await data_obj.modify()
            return True, {"status": "success"}
        return True, {"status": "DBBV alert creation failed"}

    async def _update_alert_history(self, bu, sap_id, device_name, interlock_name, fail_status_interlock):
        """Update alert history for a device when no maintenance or fault alerts are found"""
        try:
            # Query for the specific alert to update
            query = (
                f"bu = 'TAS' AND sap_id = '{sap_id}' AND alert_section = 'TAS' AND "
                f"interlock_name = '{interlock_name}' "
                f"AND alert_status != 'Close'"
            )
            params = urdhva_base.queryparams.QueryParams()
            params.q = query
            params.fields = ["id", "alert_history"]
            logger.info(f"[UpdateHistory] Query: {params.q}")
            
            alerts = await hpcl_ceg_model.Alerts.get_all(params, resp_type='plain')
            processed_time = datetime.datetime.utcnow()

            for alert in alerts.get("data", []):
                alert_id = alert.get("id")
                existing_history = alert.get("alert_history", []) or []
                last_processed_time = processed_time.isoformat()

                # Try to get last InterlockCreated time if exists
                for entry in existing_history:
                    if entry.get("action_type") == "InterlockCreated" and entry.get("processed_time"):
                        last_processed_time = entry["processed_time"]
                        break

                # Avoid adding duplicate ESDFailure entries
                already_exists = any(
                    h.get("action_type") == "ESDFailure" and device_name in h.get("action_msg", "")
                    for h in existing_history
                )

                if not already_exists:
                    device_type = "ROSOV" if "ROSOV" in fail_status_interlock else "MOV"
                    new_entry = {
                        "processed_time": processed_time.isoformat(),
                        "allocated_time": last_processed_time,
                        "action_msg": f"{device_type} close failure alert for device {device_name}",
                        "action_type": "ESDFailure"
                    }
                    updated_history = existing_history + [new_entry]
                    logger.info(f"[UpdateHistory] Updating alert ID {alert_id} with history: {new_entry}")
                    
                    alert_obj = hpcl_ceg_model.Alerts(id=alert_id, alert_history=updated_history)
                    await alert_obj.modify()

            return True
        except Exception as e:
            logger.info(traceback.format_exc())
            logger.error(f"Error in _update_alert_history: {str(e)}")
            return False
            