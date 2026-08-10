import urdhva_base
import datetime
import traceback
import hpcl_ceg_model
import pytz
import math
from collections import Counter
import utilities.helpers as helpers
import utilities.interlock_mapping
import orchestrator.alerting.alert_manager as alert_manager
import utilities.vts_mapping as vts_mapping
import orchestrator.analytics.va_analysis as va_analysis
import orchestrator.analytics.vts_analysis as vts_analysis
import orchestrator.alerting.alert_helper as alert_helper
import utilities.vts_instance_mapping as vts_instance_mapping
import orchestrator.alerting.alert_factory as alert_factory

logger = urdhva_base.logger.Logger.getInstance("actions-processing-log")


class CreateVTSBlockAlert:
    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the action.
        
        Returns:
            list: A list of strings representing the required variables.
        """
        return ["alert_id", "regular"]
    
    async def is_vehicle_blacklisted(self,tl_number: str):
        black_list_query = f"select * from vts_truck_details where truck_regno = '{tl_number}' and blacklist='true'"
        vts_blacklist_data = await hpcl_ceg_model.VtsTruckDetails.get_aggr_data(black_list_query, limit=0)
        if vts_blacklist_data.get("data", []):
            return True
        return False
    
    async def is_alert_exists(self,tl_number: str):
        query = f"select id from alerts where vehicle_number = '{tl_number}' and vehicle_unblocked_date is null and alert_section = 'VTS'"
        print("query: ", query)
        vts_alert_data = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
        print("vts_alert_data: ", vts_alert_data)
        if vts_alert_data.get("data", []):
            return True
        return False
    
    async def last_closed_at(self, tt_number: str):
        query = f"vehicle_number = '{tt_number}' and alert_status = 'Close' and alert_section = 'VTS' and vehicle_unblocked_date is not null"
        print("query: ", query)
        vts_alert_data = await hpcl_ceg_model.Alerts.get_all(urdhva_base.queryparams.QueryParams(q=query,limit=5),resp_type='plain')
        if len(vts_alert_data['data']):
            return vts_alert_data['data'][0]['closed_at']
        return None
    
    async def get_instance(self, tt_number: str, sap_id: str, bu: str, get_raw_data=False):
        query = f"select * from vts_truck_details where truck_regno = '{tt_number}'"
        vts_truck_data = await hpcl_ceg_model.VtsTruckDetails.get_aggr_data(query, limit=0)
        if get_raw_data:
            return vts_truck_data.get("data", [])
        if not vts_truck_data.get("data", []):
            vts_truck_record = {
                "truck_regno": tt_number,
                "sap_id": sap_id,
                "bu": bu,
                "truck_status": "UNBLOCKED", 
                "violation_type": "",
                "block_start_datetime": None,
                "block_end_datetime": None, 
                "instance_1": 0, 
                "instance_2": 0,
                "instance_3": 0,
                "alert_id": "",
                "blacklist": False,
                "truck_history": []
            }
            #print("vts_truck_record",vts_truck_record)
            await hpcl_ceg_model.VtsTruckDetailsCreate(**vts_truck_record).create()
            return "0"
        vts_truck_data = vts_truck_data.get("data", [])[0]
        print(vts_truck_data)
        if not vts_truck_data['instance_1']:
            return "0"
        if not vts_truck_data['instance_2']:
            return "1"
        return "2"
    
    async def is_vehicle_blacklisted_in_alerts(self, tl_number, sap_id, bu):
        query = (f"vehicle_number = '{tl_number}' and bu = '{bu}' and alert_section = 'VTS' and "
                f"violation_type in ('device_tamper_count','main_supply_removal_count')")
        vts_alert_data = await hpcl_ceg_model.Alerts.get_all(urdhva_base.queryparams.QueryParams(q=query,limit=5),resp_type='plain')
        if len(vts_alert_data['data']):
            query = (f"update vts_truck_details set blacklist='true' "
                    f"where truck_regno = '{tl_number}'")
            await hpcl_ceg_model.VtsTruckDetails.update_by_query(query)
            return True
        return False
    
    async def get_vts_instance(self,tt_number: str, sap_id: str, bu: str, violation_type: str):
        vts_map = vts_mapping.vts_interlock_mapping
        instance_mapping = vts_instance_mapping.instance_mapping
        start_date, end_date = await va_analysis.get_period_datetime(period='fortnight')
        start_date = start_date.strftime("%Y-%m-%d")
        end_date = end_date.strftime("%Y-%m-%d")
        vts_closed_alert_data = await self.last_closed_at(tt_number)
        vts_alert_data = []
        if vts_closed_alert_data:
            last_updated_at_ist = vts_closed_alert_data + datetime.timedelta(hours=5, minutes=30)
            start_date_ = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date_ = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
            if start_date_ <= last_updated_at_ist.date() <= end_date_:
                query = (f"select DISTINCT ON (vehicle_number, invoice_number) violation_type, id from violation_history_vts where vehicle_number = '{tt_number}' "
                         f"and vts_end_datetime::date between '{start_date}' and '{end_date}' and created_at > '{vts_closed_alert_data}' and violation_type = '{violation_type}' and approved_status='true'")
                vts_alert_data = await hpcl_ceg_model.ViolationHistoryVts.get_aggr_data(query, limit=0)
            else:
                query = (f"select DISTINCT ON (vehicle_number, invoice_number) violation_type, id from violation_history_vts where vehicle_number = '{tt_number}' "
                         f"and vts_end_datetime::date between '{start_date}' and '{end_date}' and violation_type = '{violation_type}' and approved_status='true'")
                vts_alert_data = await hpcl_ceg_model.ViolationHistoryVts.get_aggr_data(query, limit=0)
        else:
            query = (f"select DISTINCT ON (vehicle_number, invoice_number) violation_type, id from violation_history_vts where vehicle_number = '{tt_number}' "
                     f"and vts_end_datetime::date between '{start_date}' and '{end_date}' and violation_type = '{violation_type}' and approved_status='true'")
            vts_alert_data = await hpcl_ceg_model.ViolationHistoryVts.get_aggr_data(query, limit=0)

        if not vts_alert_data.get("data", []):
            return True, {"sapcommandsent": True}
        all_violations = [data['violation_type'] for data in vts_alert_data['data']]
        violations_ids = [str(d["id"]) for d in vts_alert_data['data']]
        violation_counts = dict(Counter(all_violations))
        violations_ids = [str(d["id"]) for d in vts_alert_data['data']]
        instance = {}
        violation_name = ""
        current_instance = await self.get_instance(tt_number,sap_id,bu)
        instance_data = instance_mapping[bu].get(current_instance,{})
        for key, violation_data in instance_data.items():
            if key in violation_counts.keys() and violation_counts[key] > violation_data['violation_count']:
                if key in ['device_tamper_count', 'main_supply_removal_count']:
                    await self.is_vehicle_blacklisted_in_alerts(tt_number,sap_id,bu)
                instance = vts_map[key]['alerting_rules'][current_instance]
                instance['severity'] = vts_map[key]["severity"]
                violation_name = key
        return instance, violation_name, violations_ids
    
    async def create_bu_alert(self, alert_data, camunda_url=urdhva_base.settings.camunda_url):
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
        status, location_details = await alert_helper.get_location_details(alert_data['bu'],
                                                                           alert_data['sap_id'])
        if not status:
            logger.info(f"Error in finding location {alert_data['sap_id']} "
                        f"for bu {alert_data['bu']} - {location_details}")
            location_details = {'name': ""}
        
        instance_data, violation_name, vts_alert_history_ids = await self.get_vts_instance(alert_data['vehicle_number'],alert_data['sap_id'],alert_data['bu'],alert_data['violation_type'])
        if not instance_data:
            logger.info(f"No Max Violation for TT {alert_data['vehicle_number']}")
            return True, {"sapcommandsent": True}
        
        vts_alert_data = {"bu": alert_data['bu'],
                          "sap_id": alert_data['sap_id'],
                          "location_name": location_details['name'],
                          "vehicle_number": alert_data['vehicle_number'],
                          "violation_type": violation_name}
        interlock_details = utilities.interlock_mapping.get_interlock_name(
            alert_data['bu'], instance_data['interlock_name'])
        
        alert_message = (
            f"Vehicle Number: {alert_data['vehicle_number']} \n"
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

        vts_alert_data.update(interlock_details)
        vts_alert_data['alert_section'] = 'VTS'
        vts_alert_data['alert_history'] = alert_history
        vts_alert_data['severity'] = instance_data['severity']
        vts_alert_data['vts_alert_history_ids'] = vts_alert_history_ids
        vts_alert_data['alert_timestamp'] = alert_data['vts_end_datetime'].isoformat()
        vts_alert_data['transporter_name'] = ''
        vts_alert_data['transporter_code'] = alert_data['vendor_id']
        vts_alert_data['device_id'] = instance_data['instance']
        vts_alert_data['device_name'] = instance_data['instance']
        vts_alert_data['vehicle_blocked_start_date'] = (
                urdhva_base.utilities.get_present_time() +
                datetime.timedelta(days=1)
        ).isoformat()
        days_to_add = instance_data['block_duration'] + 1 if not await self.is_vehicle_blacklisted(alert_data['vehicle_number']) else 1826
        vts_alert_data['vehicle_blocked_end_date'] = urdhva_base.utilities.get_present_time() + datetime.timedelta(days=days_to_add)
        vts_alert_data['mark_as_false'] = False
        tl_number = alert_data['vehicle_number']
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
        if query:
            await hpcl_ceg_model.VtsTruckDetails.update_by_query(query)

        camunda_url = await helpers.get_camunda_url(bu=alert_data['bu'], sap_id=alert_data['sap_id'],
                                                    alert_section="VTS")
        await alert_factory.AlertFactory().create_alert(vts_alert_data, camunda_url)
    
    async def last_opened_at(self, tt_number: str):
        query = f"vehicle_number = '{tt_number}' and vehicle_unblocked_date is null and alert_section = 'VTS'"
        print("query: ", query)
        vts_alert_data = await hpcl_ceg_model.Alerts.get_all(urdhva_base.queryparams.QueryParams(q=query,limit=5),resp_type='plain')
        #print("vts_alert_data: ", vts_alert_data)
        if len(vts_alert_data['data']):
            alert_history = list(reversed(vts_alert_data['data'][0]['alert_history']))
            created_at = vts_alert_data['data'][0]['created_at']
            for record in alert_history:
                action_msg = record.get("action_msg", "")
                if action_msg.startswith("Instance Updated for this Vehicle Number:"):
                    created_at = datetime.datetime.fromisoformat(record.get("processed_time"))
                    #print("First processed_time:", created_at)
                    break
            return created_at, vts_alert_data['data'][0]['id']
        return None, None
    
    async def get_updated_vts_instance(self, tt_number: str, sap_id: str, bu: str, violation_type: str):
        vts_map = vts_mapping.vts_interlock_mapping
        instance_mapping = vts_instance_mapping.instance_mapping
        start_date, end_date = await va_analysis.get_period_datetime(period='fortnight')
        start_date = start_date.strftime("%Y-%m-%d")
        end_date = end_date.strftime("%Y-%m-%d")
        vts_opened_alert_data, alert_id = await self.last_opened_at(tt_number)
        vts_alert_data = []
        if vts_opened_alert_data:
            last_updated_at_ist = vts_opened_alert_data + datetime.timedelta(hours=5, minutes=30)
            start_date_ = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date_ = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
            if start_date_ <= last_updated_at_ist.date() <= end_date_:
                query = (f"select DISTINCT ON (vehicle_number, invoice_number) violation_type, id from violation_history_vts where vehicle_number = '{tt_number}' "
                         f"and vts_end_datetime::date between '{start_date}' and '{end_date}' and created_at > '{vts_opened_alert_data}' and violation_type = '{violation_type}' and approved_status='true'")
                vts_alert_data = await hpcl_ceg_model.ViolationHistoryVts.get_aggr_data(query, limit=0)
            else:
                query = (f"select DISTINCT ON (vehicle_number, invoice_number) violation_type, id from violation_history_vts where vehicle_number = '{tt_number}' "
                         f"and vts_end_datetime::date between '{start_date}' and '{end_date}' and violation_type = '{violation_type}' and approved_status='true'")
                vts_alert_data = await hpcl_ceg_model.ViolationHistoryVts.get_aggr_data(query, limit=0)
        else:
            query = (f"select DISTINCT ON (vehicle_number, invoice_number) violation_type, id from violation_history_vts where vehicle_number = '{tt_number}' "
                     f"and vts_end_datetime::date between '{start_date}' and '{end_date}' and violation_type = '{violation_type}' and approved_status='true'")
            vts_alert_data = await hpcl_ceg_model.ViolationHistoryVts.get_aggr_data(query, limit=0)
        
        if not vts_alert_data.get("data", []):
            return True, {"sapcommandsent": True}
        
        print("vts_alert_data: ", vts_alert_data)
        all_violations = [d['violation_type'] for d in vts_alert_data['data']]
        violations_ids = [str(d["id"]) for d in vts_alert_data['data']]
        violation_counts = dict(Counter(all_violations))
        instance = {}
        violation_name = ""
        current_instance = await self.get_instance(tt_number,sap_id,bu)
        instance_data = instance_mapping[bu].get(current_instance,{})
        for key, violation_data in instance_data.items():
            if key in violation_counts.keys() and violation_counts[key] > violation_data['violation_count']:
                if key in ['device_tamper_count', 'main_supply_removal_count']:
                    await self.is_vehicle_blacklisted_in_alerts(tt_number,sap_id,bu)
                instance = vts_map[key]['alerting_rules'][current_instance]
                instance['severity'] = vts_map[key]["severity"]
                violation_name = key
        return instance, violation_name, violations_ids, alert_id
    
    async def update_alert_id_to_vts_history(self, alert_id: str, vts_alert_id: list[str]):
        if vts_alert_id:
            if not isinstance(vts_alert_id, list):
                vts_alert_id = [vts_alert_id]

            vts_alert_id = "', '".join(vts_alert_id)
            query = (f"""update violation_history_vts set alert_id='{alert_id}' """
                    f"""where id in ('{vts_alert_id}')""")
            await hpcl_ceg_model.ViolationHistoryVts.update_by_query(query)
    
    async def update_vts_instance(self, alert_data):
        vts_end_datetime = alert_data.get('vts_end_datetime',None)
        instance_data, violation_name, vts_alert_history_ids, alert_id = await self.get_updated_vts_instance(alert_data['vehicle_number'],alert_data['sap_id'],alert_data['bu'],alert_data['violation_type'])
        if not instance_data:
            logger.info(f"No Max Violation for TT {alert_data['vehicle_number']}")
            return True, {"sapcommandsent": True}
        alert_data = await hpcl_ceg_model.Alerts.get(alert_id)
        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__
        if "_sa_instance_state" in alert_data.keys():
            del alert_data["_sa_instance_state"]
        
        alert_message = (
            f"Instance Updated for this Vehicle Number: {alert_data['vehicle_number']} from {alert_data['device_id']} to {instance_data['instance']} with violation {violation_name}"
        )
        alert_data["action_msg"] = alert_message
        alert_data["action_type"] = "Blocked"

        await alert_manager.AlertAction().update_alert_history(input_data=alert_data, alert_data=alert_data)

        vehicle_blocked_end_date = (
            alert_data['vehicle_blocked_start_date'] +
            datetime.timedelta(days=instance_data['block_duration'])
        )

        await hpcl_ceg_model.Alerts(**{"id": alert_data['id'], 
                                       "vehicle_blocked_end_date": vehicle_blocked_end_date,
                                       "device_id": instance_data['instance'],
                                       "external_timestamp": vts_end_datetime,
                                       "device_name": instance_data['instance']}).modify()
        
        if instance_data['instance'] == 'Instance - 1':
            query = (f"update vts_truck_details set instance_1 = 1, truck_status = 'BLOCKED', block_start_datetime = '{alert_data['vehicle_blocked_start_date']}', block_end_datetime = '{vehicle_blocked_end_date}' "
                     f"where truck_regno = '{alert_data['vehicle_number']}'")
        if instance_data['instance'] == 'Instance - 2':
            query = (f"update vts_truck_details set instance_2 = 1, truck_status = 'BLOCKED', block_start_datetime = '{alert_data['vehicle_blocked_start_date']}', block_end_datetime = '{vehicle_blocked_end_date}' "
                     f"where truck_regno = '{alert_data['vehicle_number']}'")
        if instance_data['instance'] == 'Instance - 3':
            query = (f"update vts_truck_details set instance_3 = 1, truck_status = 'BLOCKED', block_start_datetime = '{alert_data['vehicle_blocked_start_date']}', block_end_datetime = '{vehicle_blocked_end_date}' "
                     f"where truck_regno = '{alert_data['vehicle_number']}'")
        if query:
            await hpcl_ceg_model.VtsTruckDetails.update_by_query(query)
        
        await self.update_alert_id_to_vts_history(alert_id=str(alert_data['id']), vts_alert_id=vts_alert_history_ids)
        return True

    async def block_vehicle(self, params):
        """
        This function checks if the given alert is ready to be unblocked. 
        It retrieves the alert's creation time and the number of days it should wait, 
        then calculates the time difference between the current time and the creation time. 
        If the time difference is less than the specified number of days, it calculates 
        the remaining wait time and returns it in the format 'PTXMX', where X is the 
        number of minutes. Otherwise, it returns a wait time of 1 minute.
        
        Args:
            alert_id (str): The ID of the alert to check.
            days (str): The number of days the alert should wait before being unblocked.
        
        Returns:
            tuple: A tuple containing a boolean indicating success, and a dictionary with the key 
            "waitTime" set to the value of the calculated wait time.
        """
        try:
            #print("params --->", params)
            alert_data = await hpcl_ceg_model.ViolationHistoryVts.get(params.get('alert_id'))
            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__
            
            if await self.is_vehicle_blacklisted(alert_data['vehicle_number']):
                black_list_query = f"select * from vts_truck_details where truck_regno = '{alert_data['vehicle_number']}'"
                vts_blacklist_data = await hpcl_ceg_model.VtsTruckDetails.get_aggr_data(black_list_query, limit=0)
                vts_truck_data = vts_blacklist_data['data'][0]
                truck_history = vts_truck_data.get("truck_history") or []
                truck_history.append({
                    "violated_date": alert_data["vts_end_datetime"].isoformat() if isinstance(alert_data["vts_end_datetime"], datetime.datetime) else alert_data["vts_end_datetime"],
                    "transporter_code": alert_data["vendor_id"],
                    "invoice_number": alert_data["invoice_number"],
                    alert_data['violation_type']: alert_data["violation_count"],
                    "last_violated_date": truck_history[-1]['violated_date'] if len(truck_history) else ""})
                await hpcl_ceg_model.VtsTruckDetails(**{"id": vts_truck_data['id'], "truck_history": truck_history}).modify()
                return True, {"sapcommandsent": True}
            
            if not await self.is_alert_exists(alert_data['vehicle_number']):                
                await self.create_bu_alert(alert_data=alert_data)
            else:
                await self.update_vts_instance(alert_data)
            return True, {"sapcommandsent": True}
        except Exception as e:
            print(traceback.format_exc())
            logger.error(e)
            return False