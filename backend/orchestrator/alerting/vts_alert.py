import urdhva_base
import json
import copy
import datetime
import traceback
import hpcl_ceg_model
import hpcl_ceg_enum
import utilities.interlock_mapping
import utilities.helpers as helpers
import dateutil.parser as dt_parser
import utilities.vts_mapping as vts_mapping
import orchestrator.alerting.alert_helper as alert_helper
import orchestrator.alerting.alert_manager as alert_manager
import orchestrator.alerting.alert_factory as alert_factory
import orchestrator.analytics.vts_analysis as vts_analysis
import orchestrator.actions.check_violation_count as check_violation_count

logger = urdhva_base.logger.Logger.getInstance('vts_alert_processing')


class VTSAlertManager(alert_factory.AlertFactory):
    @classmethod
    async def create_bu_alert(cls, alert_data, camunda_url=urdhva_base.settings.camunda_url):
        """
        Create a business unit level alert

        Parameters:
            alert_data (dict): A dictionary containing the data to create the alert
                - bu (str): Business unit
                - sap_id (str): SAP ID
                - sop_id (str): SOP ID
                - staticalert_data (dict): Additional static data to be stored in the alert document
                - deviceId (str): Device ID
                - interlockName (str): Interlock name
                - severity (str): Severity of the alert
                - message (str): Alert message
                - alertHistory (list): List of alert history messages
            camunda_url:

        Returns:
            dict: A dictionary containing the status, message and the created alert document
        """
        location_details = {}
        if alert_data['base_location_id'].startswith('4'):
            query = (f"select * from location_master where sap_id = '{alert_data["base_location_id"]}'")
            vts_location_data = await hpcl_ceg_model.LocationMaster.get_aggr_data(query, limit=0)
            if vts_location_data.get("data", []):
                location_details = vts_location_data['data'][0]
        else:
            status, location_details = await alert_helper.get_location_details(alert_data['location_type'],
                                                                           alert_data['base_location_id'])
            if not status:
                logger.info(f"Error in finding location {alert_data['base_location_id']} "
                            f"for bu {alert_data['location_type']} - {location_details}")
                location_details = {}
                
        # Fetch VTS Instance Details
        instance_data, violation_name, vts_alert_history_ids = await vts_analysis.get_vts_instance(alert_data['tl_number'],alert_data['base_location_id'],alert_data['location_type'],alert_data.get('tt_type',''))
        # Exit if no violation instance is applicable.
        if not instance_data:
            logger.info(f"No Max Violation for TT {alert_data['tl_number']}")
            return
        # Prepare Initial Alert Payload
        vts_alert_data = {"bu": alert_data['location_type'],
                          "sap_id": alert_data['base_location_id'],
                          "location_name": location_details.get('name',''),
                          "vehicle_number": alert_data['tl_number'],
                          "violation_type": violation_name}
        # Fetch Interlock Details
        interlock_details = utilities.interlock_mapping.get_interlock_name(
            alert_data['location_type'], instance_data['interlock_name'])
        
        # Create the first history entry when the alert is created.
        alert_message = (
            f"Vehicle Number: {alert_data['tl_number']} \n"
            f"Violation Type: {violation_name} \n"
            f"Reported at: {alert_data['vts_end_datetime']}"
        )
        allocated_time = datetime.datetime.now(datetime.timezone.utc)
        processed_time = datetime.datetime.now(datetime.timezone.utc)
        alert_history = [
            {
                "action_msg": alert_message,
                "action_type": "Created",
                "alert_status": "Open",
                "allocated_time": allocated_time.isoformat(),
                "processed_time": processed_time.isoformat()
            }
        ]
        # Count existing VTS alerts for this vehicle
        query = (f"""select count(*) as "count" from alerts """
                 f"where bu = '{alert_data['location_type']}' and "
                 f"alert_section = 'VTS' and "
                 f"vehicle_number = '{alert_data['tl_number']}'")
        resp = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
        resp = resp.get("data", [])
        instance_count=0
        if resp:
            resp = resp[0]
            instance_count = resp.get("count", 0)
        interlock_name, instance = helpers.get_interlock_name_and_instance_name_vts(interlock_details.get("interlock_name"),instance_count+1)
        vts_alert_data.update(interlock_details)
        vts_alert_data['location_data'] = location_details.__dict__ if not isinstance(location_details,dict) else location_details
        vts_alert_data['alert_section'] = 'VTS'
        vts_alert_data['block_status'] = hpcl_ceg_enum.BlockStatus.WaitingForBlockAck
        vts_alert_data['alert_history'] = alert_history
        vts_alert_data['severity'] = instance_data['severity']
        vts_alert_data['vts_alert_history_ids'] = vts_alert_history_ids
        vts_alert_data['alert_timestamp'] = alert_data['vts_end_datetime'].isoformat()
        vts_alert_data['transporter_name'] = ''
        vts_alert_data['tt_type'] = alert_data.get('tt_type','')
        vts_alert_data['transporter_code'] = alert_data['vendor_id']
        vts_alert_data['device_id'] = instance_data['instance']
        vts_alert_data['device_name'] = instance
        vts_alert_data['equipment_name'] = interlock_name
        vts_alert_data['vehicle_blocked_start_date'] = urdhva_base.utilities.get_present_time().isoformat()
        days_to_add = instance_data['block_duration'] if not await vts_analysis.is_vehicle_blacklisted(alert_data['tl_number']) else 1826
        vts_alert_data['vehicle_blocked_end_date'] = urdhva_base.utilities.get_present_time() + datetime.timedelta(days=days_to_add)
        # vts_alert_data['vehicle_blocked_end_date'] = (
        #         urdhva_base.utilities.get_present_time() +
        #         datetime.timedelta(days=instance_data['block_duration']) +
        #         datetime.timedelta(days=1)
        # )
        # vts_alert_data['vehicle_blocked_end_date'] = helpers.get_time_stamp_by_delta(
        #     days=instance_data['block_duration'],
        #     with_month_start_day=False,
        #     ascending=True,
        #     date_time_format=None).isoformat()
        # Mark the corresponding violation instance
        vts_alert_data['mark_as_false'] = False
        tl_number = alert_data['tl_number']
        query = ""
        if instance_data['instance'] == 'Instance - 1':
            query = (f"update vts_truck_details set instance_1 = 1, truck_status = 'BLOCKED', block_start_datetime = '{vts_alert_data['vehicle_blocked_start_date']}', block_end_datetime = '{vts_alert_data['vehicle_blocked_end_date']}' "
                        f"where truck_regno = '{tl_number}'")
        if instance_data['instance'] == 'Instance - 2':
            #query = f"update vts_truck_details set instance_2 = 1, truck_status = 'BLOCKED' where truck_regno = '{tl_number}'"
            query = (f"update vts_truck_details set instance_2 = 1, truck_status = 'BLOCKED', block_start_datetime = '{vts_alert_data['vehicle_blocked_start_date']}', block_end_datetime = '{vts_alert_data['vehicle_blocked_end_date']}' "
                        f"where truck_regno = '{tl_number}'")
        if instance_data['instance'] == 'Instance - 3':
            #query = f"update vts_truck_details set instance_3 = 1, truck_status = 'BLOCKED' where truck_regno = '{tl_number}'"
            query = (f"update vts_truck_details set instance_3 = 1, truck_status = 'BLOCKED', block_start_datetime = '{vts_alert_data['vehicle_blocked_start_date']}', block_end_datetime = '{vts_alert_data['vehicle_blocked_end_date']}' "
                        f"where truck_regno = '{tl_number}'")
        if instance_data['instance'] == 'Instance - 4':
            #query = f"update vts_truck_details set instance_4 = 1, truck_status = 'BLOCKED' where truck_regno = '{tl_number}'"
            query = (f"update vts_truck_details set instance_4 = 1, truck_status = 'BLOCKED', block_start_datetime = '{vts_alert_data['vehicle_blocked_start_date']}', block_end_datetime = '{vts_alert_data['vehicle_blocked_end_date']}' "
                        f"where truck_regno = '{tl_number}'")
        if instance_data['instance'] == 'Instance - 5':
            #query = f"update vts_truck_details set instance_5 = 1, truck_status = 'BLOCKED' where truck_regno = '{tl_number}'"
            query = (f"update vts_truck_details set instance_5 = 1, truck_status = 'BLOCKED', block_start_datetime = '{vts_alert_data['vehicle_blocked_start_date']}', block_end_datetime = '{vts_alert_data['vehicle_blocked_end_date']}' "
                        f"where truck_regno = '{tl_number}'")
        if instance_data['instance'] == 'Instance - 6':
            #query = f"update vts_truck_details set instance_3 = 1, truck_status = 'BLOCKED' where truck_regno = '{tl_number}'"
            query = (f"update vts_truck_details set instance_6 = 1, truck_status = 'BLOCKED', block_start_datetime = '{vts_alert_data['vehicle_blocked_start_date']}', block_end_datetime = '{vts_alert_data['vehicle_blocked_end_date']}' "
                        f"where truck_regno = '{tl_number}'")
        # Execute the truck update query if generated.
        if query:
            await hpcl_ceg_model.VtsTruckDetails.update_by_query(query)
        # Trigger Workflow and Create Alert
        camunda_url = await helpers.get_camunda_url(bu=alert_data['location_type'], sap_id=alert_data['base_location_id'],
                                                    alert_section="VTS")
        await cls.create_alert(vts_alert_data, camunda_url)


    @classmethod
    async def create_bu_alert_old(cls, alert_data, camunda_url=urdhva_base.settings.camunda_url):
        """
        Create a business unit level alert

        Parameters:
            alert_data (dict): A dictionary containing the data to create the alert
                - bu (str): Business unit
                - sap_id (str): SAP ID
                - sop_id (str): SOP ID
                - staticalert_data (dict): Additional static data to be stored in the alert document
                - deviceId (str): Device ID
                - interlockName (str): Interlock name
                - severity (str): Severity of the alert
                - message (str): Alert message
                - alertHistory (list): List of alert history messages
            camunda_url:

        Returns:
            dict: A dictionary containing the status, message and the created alert document
        """
        try:
            # alert_data -->  {'tl_number': 'MP09HH7297', 'report_duration': '2024-12-2316: 19: 15', 'total_trips': 1, 
            # 'stoppage_violations_count': 1, 'route_deviation_count': 0, 'speed_violation_count': 0, 
            # 'main_supply_removal_count': 0, 'night_driving_count': 0, 'no_halt_zone_count': 0, 
            # 'device_offline_count': 0, 'device_tamper_count': 0, 'approved_by': '', 
            # 'vendor_id': '0027048953', 'location_id': '2539', 'location_type': 'LPG', 'alert_type': 'VTS'}
            
            status, location_details = await alert_helper.get_location_details(alert_data['location_type'], alert_data['location_id'])
            if not status:
                logger.info(f"Error in finding location {alert_data['location_id']} "
                            f"for bu {alert_data['location_type']} - {location_details}")
                location_details = {'name': ""}
                return
            # Processing alert for each record
            recv_time = datetime.datetime.now(tz=datetime.timezone.utc)
            if isinstance(alert_data, dict):
                alert_records = [alert_data]  # Wrap single record in a list for uniform processing
            elif isinstance(alert_data, list):
                alert_records = alert_data  # Use directly if it's already a list
            else:
                logger.error("Invalid alert_data format. Expected dict or list of dicts.")
                return

            for record in alert_records:
                try:
                    # getting key and details from vts_interlock_mapping from vts_mapping.
                    for key, details in vts_mapping.vts_interlock_mapping.items():
                        if not record.get(key):
                            continue
                        # checking the instance of violation_type(key) from the alerts table
                        # whether it is first instance or second instance and so on..... 
                        alert_count = await check_violation_count.CheckViolationCount().check_violation_count(record['location_id'],
                                                                                                            record['location_type'],
                                                                                                            record['tl_number'], key)
                        maintenance_time = helpers.get_time_stamp_by_delta(days=14, 
                                            with_month_start_day=False, 
                                            ascending=False,
                                            date_time_format=None).strftime("%Y-%m-%d")
                        maintenance_time = datetime.datetime.strptime(maintenance_time, "%Y-%m-%d")
                        #print("maintenance_time----->",maintenance_time)
                        #fortnight_stating_date, fortnight_ending_date = await check_violation_count.CheckViolationCount().get_violation_period()
                        #fortnight_stating_date = datetime.datetime.strptime(fortnight_stating_date, "%Y-%m-%d")
                        data={}
                        # if it is not first instance then check the frequency of records from the vts_alert_history
                        # within fortnight period and using {key}_instance='' example stoppage_violation_count_instance=''
                        # and stoppage_violation_count >= 1 based on bu, location_id and tl_number(vehicle_number).
                        if alert_count['count']:
                            # created_at taken from last successfully closed alert from the alerts.
                            # if created_at is more than maintenance_time we need quey the greated than maintenance time else
                            # if we need query based on maintenance time.

                            #print("last_created_at---->",last_created_at)
                            last_created_at = alert_count['data'][0]['created_at']
                            if last_created_at > maintenance_time:
                                logger.info(f"Instance Already created for this for {key} vehicle_number:{record['tl_number']} bu:{record['location_type']} sap_id:{record['location_id']}")
                                #print(f"Instance Already created for this vehicle_number:{record['tl_number']} bu:{record['location_type']} sap_id:{record['location_id']}")
                                continue
                            else:
                                query = (f"location_id='{record['location_id']}' and tl_number='{record['tl_number']}' "
                                    f"and {key}>=1 and created_at::DATE>='{maintenance_time}' and location_type='{record['location_type']}' "
                                    f"and auto_unblock!='false'")
                                data = await hpcl_ceg_model.VtsAlertHistory.get_all(urdhva_base.queryparams.QueryParams(q=query),
                                                                    resp_type='plain')
                        # if it is first instance then check the frequency of records from the vts_alert_history
                        # within fortnight period and using example stoppage_violation_count>=1 based on bu, 
                        # location_id and tl_number(vehicle_number).   
                        else:
                            query = (f"location_id='{record['location_id']}' and tl_number='{record['tl_number']}' "
                                    f"and {key}>=1 and created_at::DATE>='{maintenance_time}' and location_type='{record['location_type']}' "
                                    f"and auto_unblock!='false'")
                            data = await hpcl_ceg_model.VtsAlertHistory.get_all(urdhva_base.queryparams.QueryParams(q=query),
                                                                    resp_type='plain')
                        # check violation if frequency of records count greter than the threshold of paricular key
                        vts_alert_history_ids = []
                        # data['count'] will the violation count of a violation type and 
                        # details['alert_threshold'] will be the threshold of a violation type
                        if data['count'] > details['alert_threshold']:
                            vts_alert_history_ids = [item['id'] for item in data['data'] if 'id' in item and item['id']]
                            finarResp ={}
                            previous_data = list(reversed(alert_count['data']))
                            if alert_count['count']:
                                for i in range(alert_count['count']):
                                    instance_key = f"{i+1} Instance"
                                    if instance_key not in finarResp:
                                        finarResp[instance_key] = []
                                    entry = {
                                        "alert_type": previous_data[i]['interlock_name'],
                                        "alert_id": previous_data[i]['unique_id'],
                                        "created_at": previous_data[i]['created_at'].strftime('%Y-%m-%d %H:%M:%S %p'),
                                        "vehicle_number": previous_data[i]['vehicle_number']
                                    }
                                    finarResp[instance_key].append(entry)

                            if data['data']:
                                new_instance_key = f"{alert_count['count']+1} Instance"
                                if new_instance_key not in finarResp:
                                    finarResp[new_instance_key] = []  
                                for item in data['data']:
                                    entry = {
                                        "violation": key,
                                        "created_at": item['created_at'].strftime('%Y-%m-%d %H:%M:%S %p'),
                                        "vehicle_number": item['tl_number']
                                    }
                                    finarResp[new_instance_key].append(entry)

                            #print("finarResp--->", finarResp)
                            # altcount will be the instance count of a violation type created in a quarter period
                            # max_limit will be the maximum instance count of violation type
                            altcount = alert_count['count']
                            max_limit = int(max(list(details['alerting_rules'].keys())))
                            if altcount > max_limit:
                                altcount = max_limit
                            alert_message = (
                                f"Vehicle Number: {record['tl_number']} "
                                f"Violation Type: {key} "
                                f"Reported at: {record['report_duration']}"
                                f"Violation Count: {data['count']} "
                                f"Violation_instance_count: {finarResp}"
                            )
                            alert_history = [
                                {
                                    "action_msg": alert_message,
                                    "action_type": "Created",  # Replace with an appropriate value
                                    "alert_status": "Open",  # Replace with the correct alert status
                                }]
                            vts_alert_data = {"bu": record['location_type'],
                                            "sap_id": record['location_id'],
                                            "location_name": location_details['name'],
                                            "vehicle_number": record['tl_number'],
                                            "violation_type": key}
                            interlock_details = utilities.interlock_mapping.get_interlock_name(
                                record['location_type'], details['alerting_rules'][str(altcount)]['interlock_name'])
                            if not interlock_details:
                                continue
                            vts_alert_data.update(interlock_details)
                            # checking if alert already is in active or not based on violation_type if already in active
                            # continue
                            tripinterlockname = await check_violation_count.CheckViolationCount().checktripcount(record['location_id'],
                                                                                                                    record['location_type'],
                                                                                                                    record['tl_number'],key)
                            if tripinterlockname and tripinterlockname["violation_type"]==key:
                                logger.info(f"alert already exists for bu: {vts_alert_data["bu"]} sap_id:{vts_alert_data["sap_id"]} for {key} vehicle_number:{vts_alert_data["vehicle_number"]}")
                                continue
                            # checking if alert already is in active or not based on interlock_name if already in active
                            # then continue.
                            interlocknamecheck = await check_violation_count.CheckViolationCount().check_interlock(record['location_id'],
                                                                                                                    record['location_type'],
                                                                                                                    record['tl_number'],
                                                                                                                    interlock_details.get("interlock_name",""),
                                                                                                                    key)
                            if interlocknamecheck and interlocknamecheck['interlock_name']==interlock_details["interlock_name"]:
                                logger.info(f"alert already exists for bu: {vts_alert_data["bu"]} sap_id:{vts_alert_data["sap_id"]} for {key} vehicle_number:{vts_alert_data["vehicle_number"]}")
                                continue
                            vts_alert_data.update(interlock_details)
                            vts_alert_data['alert_section'] = 'VTS'
                            vts_alert_data['alert_history'] = alert_history
                            vts_alert_data['clear_count'] = details['alerting_rules'][str(altcount)]['clear_count']
                            vts_alert_data['severity'] = details['severity']
                            vts_alert_data['alert_timestamp'] = datetime.datetime.strptime(record['report_duration'], "%Y-%m-%d %H:%M:%S").isoformat()
                            vts_alert_data['vts_alert_history_ids'] = vts_alert_history_ids
                            vts_alert_data['transporter_name'] = ''
                            vts_alert_data['transporter_code'] = alert_data['vendor_id']
                            vts_alert_data['device_id'] = f"Instance {altcount+1}: {key}"
                            vts_alert_data['device_name'] = f"Instance {altcount+1}: {key}"
                            vts_alert_data['vehicle_blocked_start_date'] = recv_time.isoformat()
                            vts_alert_data['vehicle_blocked_end_date'] = helpers.get_time_stamp_by_delta(
                                                                            days=details['alerting_rules'][str(altcount)]['block_duration'],
                                                                            with_month_start_day=False,
                                                                            ascending=True,
                                                                            date_time_format=None).isoformat()
                            vts_alert_data['mark_as_false'] = False
                            
                            vts_alert_payload = {
                                'vendor_id': alert_data['vendor_id'],
                                'location_id': alert_data['location_id'],
                                'location_type': alert_data['location_type'],
                                'data': [
                                    {
                                      'tt_no':record['tl_number'],
                                      'location_name': location_details['name'],
                                      'transporter_name': '',
                                      'transporter_code': alert_data['vendor_id'],
                                      'vehicle_blocked_desc': f"Instance {altcount+1}: {key}",
                                      'vehicle_blocked_start_date': recv_time.strftime("%Y-%m-%d"),
                                      'vehicle_blocked_end_date': helpers.get_time_stamp_by_delta(days=details['alerting_rules'][str(altcount)]['block_duration'],
                                                                                                  with_month_start_day=False,
                                                                                                  ascending=True,
                                                                                                  date_time_format=None).strftime("%Y-%m-%d"),
                                      'vehicle_blocked_instance_no': f"Instance {altcount+1}",
                                      'vehicle_blocked_instance_type': key,
                                      'alert_type': 'VTS'
                                    }
                                ]
                            }
                            #print('vts_alert_payload----->',vts_alert_payload)
                            camunda_url = await helpers.get_camunda_url(bu=alert_data['location_type'], sap_id=alert_data['location_id'],
                                                        alert_section="VTS")
                            await cls.create_alert(vts_alert_data, camunda_url)
          
                except Exception as e:
                    print(traceback.format_exc())
                    logger.error(f"Exception in processing alert data {e}, Traceback "
                                 f"{traceback.format_exc()}, data {alert_data}")
        except Exception as e:
            print(traceback.format_exc())
            logger.error(f"Exception in processing alert data {e}, Traceback "
                         f"{traceback.format_exc()}, data {alert_data}")

    @classmethod
    async def close_bu_alert(cls, alert_data):
        """
        Close a BU level alert asynchronously.

        Parameters:
            alert_data (dict): A dictionary containing the data to close the alert
                - bu (str): Business unit
                - sap_id (str): SAP ID
                - sop_id (str): SOP ID
                - alert_id (str): Unique alert ID

        Returns:
            dict: A dictionary containing the status, message, and the closed alert document.

        Raises:
            Exception: If the alert is not found or there's an error in closing the alert.
        """
        try:
            logger.info(f"Alert data received to close alert: {alert_data}")
            return await cls.close_alert(alert_data)
            
        except Exception as e:
            raise Exception(status_code=500, detail="Error closing alert.") from e
