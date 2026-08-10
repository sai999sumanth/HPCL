import urdhva_base
import time
import datetime
import requests
import pandas as pd
import charts_actions
import hpcl_ceg_model
import urdhva_base.redispool
import utilities.helpers as helpers
from hpcl_ceg_enum import AlertState as AlertState
from hpcl_ceg_enum import AlertStatus as AlertStatus
import orchestrator.alerting.alert_helper as alert_helper
from hpcl_ceg_enum import IndentStatus as IndentStatus
import utilities.connection_mapping as connection_mapping
from charts_actions import charts_connection_vault_routing
import orchestrator.alerting.alert_manager as alert_manager
from orchestrator.alerting.alert_manager import close_alert
from orchestrator.alerting.alert_manager import create_alert
from hpcl_ceg_model import Alerts_Alert_ActionParams, Alerts
from hpcl_ceg_enum import AlertActionType as AlertActionType
from alerts_actions import alerts_alert_action as alerts_alert_action
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams

logger = urdhva_base.logger.Logger.getInstance("dry-out-logging")


class IndentDryOut:
    def __init__(self):
        self.params = dict()

    async def prod_code_mapping(self):
        _mapping_code = {
            "MS": "2811000",
            "HSD": "2812000",
            "TURBO": "3912000",
            "E20": "2822000",
            "POWER 95": "3672000",
            "POWER 99": "2816000",
            "POWER 100": "3373000"
        }
        return _mapping_code

    async def prod_code_reverse_mapping(self):
        _mapping_code = {
            "MS": "1322000",
            "HSD": "1683000",
            "TURBO": "1683100",
            "E20": "1322000",
            "POWER 95": "3672000",
            "POWER 99": "2682000",
            "POWER 100": "3373000"
        }
        return _mapping_code

    async def get_connection_name(self):
        self.params['connection_name'] = connection_mapping.connection_mapping.get(
            self.params['connection_name'], self.params['connection_name']
        )
        # self.params['connection_name'] = '3'

    async def get_required_variables(self):
        """
        Returns a list of strings representing the required variables for the action.

        Returns:
            list: A list of strings representing the required variables.
        """
        return [
            "alert_id", "bu", "interlock_name", "interlock_id",
            "dealer_id", "connection_name", "indent_no", "location_no",
            "product_code", "sap_id", "sop_id", "workflow_datetime", "terminal_plant_id",
            "terminal_plant_name"
        ]

    async def send_alert_action(
            self,
            is_atr_uploaded: bool = False,
            is_maintenance_exception: bool = False,
            is_revocation: bool = False,
            no_exception: bool = False,
            is_approved: bool = False,
            is_exc_approval_time_exp: bool = False,
            is_raised: bool = False,
            is_cancelled: bool = False,
            is_allocated: bool = False,
            is_sent_to_sap: bool = False,
            is_order_placed: bool = False,
            is_created: bool = False,
            is_r1_swipe: bool = False,
            is_r2_swipe: bool = False,
            is_r3_swipe: bool = False,
            is_delivered: bool = False
    ):
        msg_block = {
            "isAtrUploaded": is_atr_uploaded,
            "isMaintenanceException": is_maintenance_exception,
            "isRevocation": is_revocation,
            "noException": no_exception,
            "approved": is_approved,
            "isExcApprovalTimeExp": is_exc_approval_time_exp,
            "raised": is_raised,
            "cancelled": is_cancelled,
            "allocated": is_allocated,
            "senttosap": is_sent_to_sap,
            "orderplaced": is_order_placed,
            "created": is_created,
            "r1swipe": is_r1_swipe,
            "r2swipe": is_r2_swipe,
            "r3swipe": is_r3_swipe,
            "delivered": is_delivered
        }
        return True, msg_block

    async def check_raised_indent(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        self.params['sop_id'] = 'SOP292'
        self.params['alert_type'] = 'RO'
        self.params['bu'] = 'RO'
        self.params['interlock_name'] = 'Dry Out Each Indent Wise MainFlow'
        camunda_url = urdhva_base.settings.camunda_url
        if self.params['camunda_host']:
            camunda_url = f"http://{self.params['camunda_host']}:{self.params['camunda_port']}"

        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        prod_code = self.params.get("product_code")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=3)).strftime("%Y-%m-%d")
        # todo:- Remove COUNT
        query = f"""SELECT a."INDENT_NO" AS "INDENT_NO" , b."PROD" AS "PROD", a."LOCN_CODE" AS "LOCN_CODE", a."INDENT_DATE" AS "INDENT_DATE", a."PROD_REQD_DT" AS "PROD_REQD_DT" """ \
                f"""FROM "IMS_SAP"."INDENT_REQUEST" a, "IMS_SAP"."INDENT_PRODUCTS" b WHERE SUBSTR(a."DEALER_CODE",1,10) = '{dealer_code}' """ \
                f"""AND a."PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') """ \
                f"""AND b."PROD" = '{prod_code}' """ \
                f"""AND a."LOCN_CODE" = b."LOCN_CODE" AND a."INDENT_NO" = b."INDENT_NO" AND a."CANCEL_INDENT" IS NULL """ \
                f"""GROUP BY a."INDENT_NO", b."PROD", a."LOCN_CODE", a."INDENT_DATE", a."PROD_REQD_DT" ORDER BY a."INDENT_NO" DESC"""

        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        total_indent = await function(query=query)

        if not total_indent:
            # Check Alert Exists for same Scenario or not
            query = (f"select id,dry_out_in_days from alerts where bu='RO' and "
                     f"interlock_name='Dry Out Each Indent Wise MainFlow' and sap_id='{self.params['sap_id']}' and "
                     f"alert_status in ('Open', 'InProgress') and product_code='{self.params['product_code']}'")
            alerts_data = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=1)
            if not alerts_data['data']:
                await create_alert(self.params, camunda_url)
                # Todo:- Create Dry-Out history data for the bu/sap_id/product if not available in Open State
            else:
                # If dry_out_days found diff, update alert
                for record in alerts_data['data']:
                    if record['dry_out_in_days'] != self.params['dry_out_in_days']:
                        query = (f"update alerts set dry_out_in_days={self.params['dry_out_in_days']} "
                                 f"where id='{record['id']}'")
                        await hpcl_ceg_model.Alerts.update_by_query(query)
        else:
            for each_indent in total_indent:
                query = (f"select id,dry_out_in_days from alerts where bu='RO' and "
                         f"interlock_name='Dry Out Each Indent Wise MainFlow' and sap_id='{self.params['sap_id']}' and "
                         f"indent_no='' and alert_status in ('Open', 'InProgress') and "
                         f"product_code='{self.params['product_code']}'")
                alerts_data = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=1)
                if alerts_data['data']:
                    # If dry_out_days found diff, update alert
                    query = (f"""update alerts set indent_no='{each_indent["INDENT_NO"]}', """
                             f"""indent_raised_date='{each_indent["INDENT_DATE"].strftime("%Y-%m-%d %H:%M:%S")}', """
                             f"""servicing_plant_id='{each_indent['LOCN_CODE']}', """
                             f"""where id='{self.params["alert_id"]}'""")
                    await hpcl_ceg_model.Alerts.update_by_query(query)
                    await self.update_indent_no(
                        str(each_indent['INDENT_NO']),
                        str(each_indent.get("LOCN_CODE")),
                        each_indent.get("INDENT_DATE")
                    )
                else:
                    query = (f"select id,dry_out_in_days from alerts where bu='RO' and "
                             f"interlock_name='Dry Out Each Indent Wise MainFlow' and sap_id='{self.params['sap_id']}' and "
                             f"indent_no='{each_indent['INDENT_NO']}' and "
                             f"alert_status in ('Open', 'Close', 'InProgress') and "
                             f"product_code='{each_indent['PROD']}'")
                    alerts_data = await hpcl_ceg_model.Alerts.get_aggr_data(query)
                    if not alerts_data['data']:
                        self.params['indent_no'] = str(each_indent['INDENT_NO'])
                        self.params['terminal_plant_id'] = str(each_indent['LOCN_CODE'])
                        self.params['indent_raised_date'] = each_indent.get('INDENT_DATE').strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + "Z"
                        self.params['prod_reqd_dt'] = each_indent.get('PROD_REQD_DT').strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + "Z"
                        await create_alert(self.params, camunda_url)
                        # Todo:- Create Dry-Out history data for the bu/sap_id/product if not available in Open State
                    else:
                        # If dry_out_days found diff, update alert
                        for record in alerts_data['data']:
                            if record['dry_out_in_days'] != self.params['dry_out_in_days']:
                                query = (f"update alerts set dry_out_in_days={self.params['dry_out_in_days']} "
                                         f"where id='{record['id']}'")
                                await hpcl_ceg_model.Alerts.update_by_query(query)
        # Todo:- Dry out location created or not for this product, if not create
        await self.generate_dry_out_history(self.params.get("dealer_id"), prod_code, connection_mapping.item_name_mapping.get(prod_code, ""))
        return True, {"msg": "Alert raised"}

    @classmethod
    async def generate_dry_out_history(cls, location_id, product_code, item_name):
        """
        Creating Dry out history based on dealer and product
        :param location_id:
        :param product_code:
        :param item_name:
        :return:
        """
        query = (f"SELECT sap_id, product_no from dry_out_history where sap_id='{location_id}' "
                 f"and product_no='{product_code}' and status='Open'")
        resp = await hpcl_ceg_model.DryOutHistory.get_aggr_data(query, limit=1)
        # If there was no alert then creating dry out history
        if not resp['data']:
            _, loc_dt = await alert_helper.get_location_details('RO', location_id)
            data = {'sap_id': location_id, "product_no": product_code, "item_name": item_name,
                    "name": loc_dt.get("name", ""), "plant_id": loc_dt.get('terminal_plant_id', ''),
                    "plant_name": loc_dt.get('terminal_plant_name',''), "bu": "RO",
                    "category": loc_dt.get('category', ""), "status": "Open",
                    "start_time": datetime.datetime.now(tz=datetime.timezone.utc)}
            await hpcl_ceg_model.DryOutHistoryCreate(**data).create()

    async def check_indent_status(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        print("Params: ", self.params)
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        prod_code = self.params.get("product_code")
        indent_no = self.params.get("indent_no")
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE SUBSTR(DEALER_CODE,1,10) = '{dealer_code}' """ \
                f"AND PROD_REQD_DT BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND CANCEL_INDENT IS NULL"

        if not self.params.get("indent_no"):
            # TODO:
            workflow_date = datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ")
            todays_date = datetime.datetime.now(datetime.timezone.utc)
            if todays_date.date() > workflow_date.date():
                if await self._is_indent_delivered():
                    if await self._close_camunda_workflow():
                        print("Indent as been delivered but still alert is in Intial stage")
                        print("Params: ", self.params)
                        input_data = {
                            "action_msg": "",
                            "event_tags": {
                                "is_delivered": False
                            }
                        }
                        input_data["action_msg"] = "Indent Delivered"
                        input_data["action_type"] = "Created"
                        input_data["event_tags"]["is_delivered"] = True
                        await self.update_alert_status(
                            indent_status=IndentStatus.Completed,
                            alert_status=AlertStatus.Close,
                            alert_state=AlertState.Resolved,
                            input_data=input_data,
                            progress_rate="11"
                        )
                        await self.close_supply_chain_alert(
                            alert_id=self.params.get("alert_id"),
                            alert_status=AlertStatus.Close,
                            alert_state=AlertState.Resolved,
                            indent_status=IndentStatus.Completed
                        )
                    return await self.send_alert_action(is_raised=False)
            query = f"""SELECT COUNT(*) AS "count", a."INDENT_NO" AS "INDENT_NO" , b."PROD" AS "PROD", a."LOCN_CODE" AS "LOCN_CODE", a."INDENT_DATE" AS "INDENT_DATE" """ \
                    f"""FROM "IMS_SAP"."INDENT_REQUEST" a, "IMS_SAP"."INDENT_PRODUCTS" b WHERE SUBSTR(a."DEALER_CODE",1,10) = '{dealer_code}' """ \
                    f"""AND a."PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') """ \
                    f"""AND b."PROD" = '{prod_code}' """ \
                    f"""AND a."LOCN_CODE" = b."LOCN_CODE" AND a."INDENT_NO" = b."INDENT_NO" AND a."CANCEL_INDENT" IS NULL """ \
                    f"""GROUP BY a."INDENT_NO", b."PROD", a."LOCN_CODE", a."INDENT_DATE" ORDER BY a."INDENT_NO" DESC"""
            Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
            Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            print("connection_nameL ", self.params['connection_name'])
            function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
            resp = await function(query=query)
            if not resp:
                return await self.send_alert_action(is_raised=False)

            count = 1
            for each_indent in resp:
                if count == 1:
                    self.params['indent_no'] = str(each_indent.get('INDENT_NO'))
                    self.params['terminal_plant_id'] = str(each_indent.get('LOCN_CODE'))
                    self.params['servicing_plant_id'] = str(each_indent.get('LOCN_CODE'))
                    self.params['servicing_plant_name'] = ''
                    status, lt = await alert_helper.get_location_details("TAS", self.params['servicing_plant_id'])
                    if status:
                        self.params['servicing_plant_name'] = lt.get('name', '')
                    # Todo:- Add LOCN_CODE terminal_plant_name instead of parent plant
                    self.params['indent_raised_date'] = each_indent.get('INDENT_DATE').strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + "Z"
                    logger.info(f"Updateding to existing workflow: {self.params}")
                    await self.update_indent_no(
                        str(self.params['indent_no']),
                        str(each_indent.get("LOCN_CODE")),
                        each_indent.get("INDENT_DATE")
                    )
                    query = (f"""update alerts set indent_no='{self.params["indent_no"]}', """
                             f"""indent_raised_date='{each_indent["INDENT_DATE"].strftime("%Y-%m-%d %H:%M:%S")}', """
                             f"""servicing_plant_id='{self.params['servicing_plant_id']}', """
                             f"""servicing_plant_name='{self.params['servicing_plant_name']}' """
                             f"""where id='{self.params["alert_id"]}'""")
                    await hpcl_ceg_model.Alerts.update_by_query(query)
                    count += 1
                else:
                    self.params['sop_id'] = 'SOP292'
                    self.params['alert_type'] = 'RO'
                    self.params['bu'] = 'RO'
                    self.params['interlock_name'] = 'Dry Out Each Indent Wise MainFlow'
                    self.params['indent_no'] = str(each_indent.get('INDENT_NO'))
                    self.params['terminal_plant_id'] = str(each_indent.get('LOCN_CODE'))
                    status, lt = await alert_helper.get_location_details("RO", self.params['dealer_id'])
                    if status:
                        self.params['terminal_plant_name'] = lt.get('terminal_plant_name', '')
                        self.params['terminal_plant_id'] = lt.get('terminal_plant_id', '')

                    self.params['servicing_plant_id'] = str(each_indent.get('LOCN_CODE'))
                    self.params['servicing_plant_name'] = ''
                    status, lt = await alert_helper.get_location_details("TAS", self.params['servicing_plant_id'])
                    if status:
                        self.params['servicing_plant_name'] = lt.get('name', '')
                    # Todo:- Add LOCN_CODE terminal_plant_name instead of parent plant
                    self.params['indent_raised_date'] = each_indent.get('INDENT_DATE').strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + "Z"
                    logger.info(f"Multiple Indents: {self.params}")
                    await create_alert(self.params)

        else:
            query = f"""SELECT COUNT(*) AS "count", a."INDENT_NO" AS "INDENT_NO" , b."PROD" AS "PROD", a."LOCN_CODE" AS "LOCN_CODE" """ \
                    f"""FROM "IMS_SAP"."INDENT_REQUEST" a, "IMS_SAP"."INDENT_PRODUCTS" b WHERE SUBSTR(a."DEALER_CODE",1,10) = '{dealer_code}' """ \
                    f"""AND a."PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') """ \
                    f"""AND b."PROD" = '{prod_code}' """ \
                    f"""AND a."LOCN_CODE" = b."LOCN_CODE" AND a."INDENT_NO" = '{indent_no}' AND a."CANCEL_INDENT" IS NULL """ \
                    f"""GROUP BY a."INDENT_NO", b."PROD", a."LOCN_CODE" ORDER BY a."INDENT_NO" DESC"""
            Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
            Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
            resp = await function(query=query)
            if not resp:
                return await self.send_alert_action(is_raised=False)
        input_data = {
            "action_msg": "",
            "event_tags": {
                "is_raised": False
            }
        }
        resp = resp[0]
        if resp.get("count") > 0:
            # self.params['indent_no'] = ",".join(indent_no)
            # self.params['terminal_plant_id'] = resp.get("LOCN_CODE")
            # await self.update_indent_no(str(self.params['indent_no']), str(resp.get("LOCN_CODE")))
            input_data["action_msg"] = "Indent Raised"
            input_data["action_type"] = "Raised"
            input_data["event_tags"]["is_raised"] = True
            await self.update_alert_status(indent_status=IndentStatus.IndentRaised, input_data=input_data, progress_rate="2")
            return await self.send_alert_action(is_raised=True)

        input_data["action_msg"] = "Indent Not Raised"
        input_data["action_type"] = "Raised"
        await self.update_alert_status(indent_status=IndentStatus.IndentNotRaised, input_data=input_data, progress_rate="1")
        return await self.send_alert_action(is_raised=False)

    async def is_truck_allocated(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        indent_no = "','".join(self.params.get("indent_no").split(","))
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE SUBSTR("DEALER_CODE",1,10) = '{dealer_code}' """ \
                f"""AND "INDENT_NO" IN ('{indent_no}') AND "PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') """ \
                f"""AND "CANCEL_INDENT" IS NULL AND "TRUCK_REGNO" IS NOT NULL"""
        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        resp = await function(query=query)
        input_data = {
            "action_msg": "",
            "event_tags": {
                "is_raised": False
            }
        }
        if not resp:
            return await self.send_alert_action(is_raised=False)
        resp = resp[0]
        if resp.get("count") > 0:
            input_data["action_msg"] = "Truck Allocated"
            input_data["action_type"] = "Allocated"
            input_data["event_tags"]["is_allocated"] = True
            await self.update_alert_status(indent_status=IndentStatus.TruckAllocated, input_data=input_data, progress_rate="4")
            return await self.send_alert_action(is_allocated=True)
        input_data["action_msg"] = "Truck Not Allocated"
        input_data["action_type"] = "Message"
        await self.update_alert_status(indent_status=IndentStatus.TruckNotAllocated, input_data=input_data)
        return await self.send_alert_action(is_allocated=False)

    async def is_indent_cancelled(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        indent_no = "','".join(self.params.get("indent_no").split(","))
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        # Todo:- Add location code
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE SUBSTR("DEALER_CODE",1,10) = '{dealer_code}' """ \
                f"""AND "PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') """ \
                f"""AND "CANCEL_INDENT" IS NOT NULL AND "INDENT_NO" IN ('{indent_no}')"""
        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        resp = await function(query=query)
        input_data = {
            "action_msg": "",
            "event_tags": {
                "is_raised": False
            }
        }
        if not resp:
            return await self.send_alert_action(is_raised=False)
        resp = resp[0]
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE SUBSTR("DEALER_CODE",1,10) = '{dealer_code}' """ \
                f"""AND "PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') """ \
                f"""AND "INDENT_NO" IN ('{indent_no}')"""

        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        resp_1 = await function(query=query)
        if not resp_1:
            return await self.send_alert_action(is_raised=False)
        resp_1 = resp_1[0]
        if resp.get("count") > 0 and resp_1.get("count") == resp.get("count"):
            input_data["action_msg"] = "Indent Cancelled"
            input_data["action_type"] = "Cancelled"
            input_data["event_tags"]["is_cancelled"] = True
            await self.update_alert_status(
                indent_status=IndentStatus.Cancelled,
                alert_status=AlertStatus.Close,
                alert_state=AlertState.Resolved,
                input_data=input_data
            )
            await self.close_supply_chain_alert(
                alert_id=self.params.get("alert_id"),
                alert_status=AlertStatus.Cancel,
                alert_state=AlertState.Resolved,
                indent_status=IndentStatus.Cancelled
            )

            return await self.send_alert_action(is_cancelled=True)
        return await self.send_alert_action(is_cancelled=False)

    async def is_indent_on_hold(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        indent_no = "','".join(self.params.get("indent_no").split(","))
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE SUBSTR("DEALER_CODE",1,10) = '{dealer_code}' """ \
                f"""AND "PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') """ \
                f"""AND "INDENT_NO" IN ('{indent_no}') AND "CANCEL_INDENT" IS NULL AND "VALID_INDENT" = 'N'"""
        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        resp = await function(query=query)
        input_data = {
            "action_msg": "",
            "event_tags": {
                "is_raised": False
            }
        }
        if not resp:
            return await self.send_alert_action(is_raised=False)
        resp = resp[0]
        if resp.get("count") > 0:
            input_data["action_msg"] = "Indent On Hold"
            input_data["action_type"] = "Message"
            input_data["event_tags"]["is_raised"] = True
            await self.update_alert_status(
                indent_status=IndentStatus.IndentOnHold,
                alert_status=AlertStatus.OnHold,
                alert_state=AlertState.InProgress,
                input_data=input_data,
                progress_rate="3"
            )
            return await self.send_alert_action(is_raised=True)
        return await self.send_alert_action(is_raised=False)

    async def is_indent_valid(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        indent_no = "','".join(self.params.get("indent_no").split(","))
        if not indent_no:
            alert_resp = await hpcl_ceg_model.Alerts.get(self.params['alert_id'])
            if alert_resp:
                if not isinstance(alert_resp, dict):
                    alert_resp = alert_resp.__dict__
                if alert_resp['indent_no']:
                    indent_no = alert_resp['indent_no']
                    await self.update_indent_no(
                        str(alert_resp['indent_no']),
                        str(alert_resp["terminal_plant_id"]),
                        alert_resp['indent_raised_date']
                    )
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE SUBSTR("DEALER_CODE",1,10) = '{dealer_code}' """ \
                f"""AND "PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND "CANCEL_INDENT" IS NULL AND """ \
                f"""("VALID_INDENT" = 'Y' OR "VALID_INDENT" = 'H') AND "INDENT_NO" IN ('{indent_no}')"""
        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        resp = await function(query=query)
        input_data = {
            "action_msg": "",
            "event_tags": {
                "is_raised": False
            }
        }
        if not resp:
            return await self.send_alert_action(is_raised=False)
        resp = resp[0]
        if resp.get("count") > 0:
            input_data["action_msg"] = "Valid Indent"
            input_data["action_type"] = "Raised"
            input_data["event_tags"]["is_raised"] = True
            await self.update_alert_status(indent_status=IndentStatus.ValidIndent, input_data=input_data, progress_rate="3")
            return await self.send_alert_action(is_raised=True)

        input_data["action_msg"] = "Indent Is On Hold"
        input_data["action_type"] = "Message"
        input_data["event_tags"]["is_raised"] = False
        await self.update_alert_status(indent_status=IndentStatus.IndentOnHold, input_data=input_data, progress_rate="2")
        return await self.send_alert_action(is_raised=False)

    async def is_indent_sent_sap(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        indent_no = "','".join(self.params.get("indent_no").split(","))
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE SUBSTR("DEALER_CODE",1,10) = '{dealer_code}' """ \
                f"""AND "PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND "CANCEL_INDENT" IS NULL AND """ \
                f"""("VALID_INDENT" = 'Y' OR "VALID_INDENT" = 'H') AND "BATCH_FLAG" = 'Y' AND "INDENT_NO" IN ('{indent_no}')"""
        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        resp = await function(query=query)
        input_data = {
            "action_msg": "",
            "event_tags": {
                "is_raised": False
            }
        }
        if not resp:
            return await self.send_alert_action(is_raised=False)
        resp = resp[0]
        if resp.get("count") > 0:
            input_data["action_msg"] = "Sent To SAP"
            input_data["action_type"] = "SentToSap"
            input_data["event_tags"]["is_sent_to_sap"] = True
            await self.update_alert_status(indent_status=IndentStatus.SentToSAP, input_data=input_data, progress_rate="5")
            return await self.send_alert_action(is_sent_to_sap=True)
        return await self.send_alert_action(is_sent_to_sap=False)

    async def is_r1_swipe(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        indent_no = self.params.get("indent_no")
        today_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        # Todo:- Need to check whether LOADED_ON was required or not in this
        query = f"""SELECT COUNT(*) AS "count", a."INDENT_NO", a."LOCN_CODE", a."TRUCK_REGNO", b."CARD_STATUS", b."LOADED_ON" 
                    FROM 
                        "IMS_SAP"."INDENT_REQUEST" a, 
                        "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" b
                    WHERE 
                        SUBSTR(a."DEALER_CODE", 1, 10) = '{dealer_code}'
                        AND a."INDENT_NO" = '{indent_no}'
                        AND a."LOCN_CODE" = b."LOCN_CODE"
                        AND a."TRUCK_REGNO" = b."TRUCK_REGNO"
                        AND b."CARD_STATUS" = 'R'
                        AND TRUNC(b."LOADED_ON") = TRUNC(TO_DATE('{today_date}', 'YYYY-MM-DD HH24:MI:SS')) 
                    GROUP BY a."INDENT_NO", a."LOCN_CODE", a."TRUCK_REGNO", b."CARD_STATUS", b."LOADED_ON" """
        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        resp = await function(query=query)
        input_data = {
            "action_msg": "",
            "event_tags": {
                "is_r1_swipe": False
            }
        }
        if not resp:
            return await self.send_alert_action(is_r1_swipe=False)
        resp = resp[0]
        if resp.get("count") > 0:
            input_data["action_msg"] = "R1 Swiped"
            input_data["action_type"] = "R1Swipe"
            input_data["event_tags"]["is_r1_swipe"] = True
            await self.update_alert_status(indent_status=IndentStatus.R1Swipe, input_data=input_data)
            return await self.send_alert_action(is_r1_swipe=True)
        return await self.send_alert_action(is_r1_swipe=False)

    async def is_r2_swipe(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        locn_code = str(self.params['terminal_plant_id'])
        indent_no = self.params.get("indent_no")
        if 'prod_reqd_dt' in self.params.keys():
            prod_reqd_dt = self.params['prod_reqd_dt'].split("T")[0]
        else:
            query = f"""SELECT "PROD_REQD_DT" FROM "IMS_SAP"."INDENT_REQUEST" WHERE "INDENT_NO" = '{indent_no}' """ \
                    f"""AND "LOCN_CODE" = '{locn_code}' """
            Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
            Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
            resp = await function(query=query)
            if resp:
                prod_reqd_dt = resp[0].get("PROD_REQD_DT").strftime("%Y-%m-%d")
            else:
                prod_reqd_dt = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        today_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        query = f"""SELECT COUNT(*) AS "count", a."INDENT_NO", a."LOCN_CODE", a."TRUCK_REGNO", b."CARD_STATUS", b."LOADED_ON" 
                            FROM 
                                "IMS_SAP"."INDENT_REQUEST" a, 
                                "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" b
                            WHERE 
                                SUBSTR(a."DEALER_CODE", 1, 10) = '{dealer_code}'
                                AND a."INDENT_NO" = '{indent_no}'
                                AND a."LOCN_CODE" = b."LOCN_CODE"
                                AND a."TRUCK_REGNO" = b."TRUCK_REGNO"
                                AND b."CARD_STATUS" = 'I'
                                AND b."LOADED_ON" >= TO_DATE('{prod_reqd_dt}', 'YYYY-MM-DD')
                            GROUP BY a."INDENT_NO", a."LOCN_CODE", a."TRUCK_REGNO", b."CARD_STATUS", b."LOADED_ON" """
        # AND b."LOADED_ON" BETWEEN TO_DATE('{prod_reqd_dt}', 'YYYY-MM-DD') AND TO_DATE('{today_date}', 'YYYY-MM-DD')
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        resp = await function(query=query)
        # logger.info(f"Query: {query}")
        # logger.info(f"Resp: {resp}")
        input_data = {
            "action_msg": "",
            "event_tags": {
                "is_r2_swipe": False
            }
        }
        if not resp:
            if await self._is_invoice_created():
                logger.info("R2 Not Swiped But Invoice Created")
                logger.info(f"alert_id: {self.params.get('alert_id')}")
                input_data["action_msg"] = "R2 Not Swiped But Invoice Created"
                input_data["action_type"] = "R2Swipe"
                input_data["event_tags"]["is_r2_swipe"] = True
                await self.update_alert_status(indent_status=IndentStatus.R2Swipe, input_data=input_data,
                                               progress_rate="7")
                return await self.send_alert_action(is_r2_swipe=True)
            elif await self._is_r3_swiped():
                logger.info("R2 Not Swiped But R3 Swiped")
                logger.info(f"alert_id: {self.params.get('alert_id')}")
                # logger.info(f"params: {self.params}")
                input_data["action_msg"] = "R2 Not Swiped But R3 Swiped"
                input_data["action_type"] = "R2Swipe"
                input_data["event_tags"]["is_r2_swipe"] = True
                await self.update_alert_status(indent_status=IndentStatus.R2Swipe, input_data=input_data,
                                               progress_rate="7")
                return await self.send_alert_action(is_r2_swipe=True)
            elif await self._is_indent_delivered():
                logger.info("R2, R3 Not Swiped But Indent Delivered")
                logger.info(f"alert_id: {self.params.get('alert_id')}")
                # logger.info(f"params: {self.params}")
                input_data["action_msg"] = "R2, R3 Not Swiped But Indent Delivered"
                input_data["action_type"] = "R2Swipe"
                input_data["event_tags"]["is_r2_swipe"] = True
                await self.update_alert_status(indent_status=IndentStatus.R2Swipe, input_data=input_data,
                                               progress_rate="7")
                return await self.send_alert_action(is_r2_swipe=True)
            return await self.send_alert_action(is_r2_swipe=False)
        resp = resp[0]
        if resp.get("count") > 0:
            input_data["action_msg"] = "R2 Swiped"
            input_data["action_type"] = "R2Swipe"
            input_data["event_tags"]["is_r2_swipe"] = True
            await self.update_alert_status(indent_status=IndentStatus.R2Swipe, input_data=input_data, progress_rate="7")
            return await self.send_alert_action(is_r2_swipe=True)
        return await self.send_alert_action(is_r2_swipe=False)

    async def is_r3_swipe(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        indent_no = self.params.get("indent_no")
        locn_code = self.params.get("terminal_plant_id")
        today_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        if 'prod_reqd_dt' in self.params.keys():
            prod_reqd_dt = self.params['prod_reqd_dt'].split("T")[0]
        else:
            query = f"""SELECT "PROD_REQD_DT" FROM "IMS_SAP"."INDENT_REQUEST" WHERE "INDENT_NO" = '{indent_no}' """ \
                    f"""AND "LOCN_CODE" = '{locn_code}' """
            Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
            Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
            resp = await function(query=query)
            if resp:
                prod_reqd_dt = resp[0].get("PROD_REQD_DT").strftime("%Y-%m-%d")
            else:
                prod_reqd_dt = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")

        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        query = f"""SELECT COUNT(*) AS "count", a."INDENT_NO", a."LOCN_CODE", a."TRUCK_REGNO", b."CARD_STATUS", b."LOADED_ON" 
                            FROM 
                                "IMS_SAP"."INDENT_REQUEST" a, 
                                "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" b
                            WHERE 
                                SUBSTR(a."DEALER_CODE", 1, 10) = '{dealer_code}'
                                AND a."INDENT_NO" = '{indent_no}'
                                AND a."LOCN_CODE" = b."LOCN_CODE"
                                AND a."TRUCK_REGNO" = b."TRUCK_REGNO"
                                AND b."CARD_STATUS" = 'O'
                                AND b."LOADED_ON" >= TO_DATE('{prod_reqd_dt}', 'YYYY-MM-DD')
                            GROUP BY a."INDENT_NO", a."LOCN_CODE", a."TRUCK_REGNO", b."CARD_STATUS", b."LOADED_ON" """
        # AND b."LOADED_ON" BETWEEN TO_DATE('{prod_reqd_dt}', 'YYYY-MM-DD') AND TO_DATE('{today_date}', 'YYYY-MM-DD')
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        resp = await function(query=query)
        # logger.info(f"Query: {query}")
        # logger.info(f"Resp: {resp}")
        input_data = {
            "action_msg": "",
            "event_tags": {
                "is_r3_swipe": False
            }
        }
        if not resp:
            if await self._is_indent_delivered():
                logger.info("R3 Not Swiped But Indent Delivered")
                logger.info(f"alert_id: {self.params.get('alert_id')}")
                # logger.info(f"params: {self.params}")
                input_data["action_msg"] = "R3 Not Swiped But Indent Delivered"
                input_data["action_type"] = "R3Swipe"
                input_data["event_tags"]["is_r3_swipe"] = True
                await self.update_alert_status(indent_status=IndentStatus.R3Swipe, input_data=input_data,
                                               progress_rate="9")
                return await self.send_alert_action(is_r3_swipe=True)
            return await self.send_alert_action(is_r3_swipe=False)
        resp = resp[0]
        if resp.get("count") > 0:
            input_data["action_msg"] = "R3 Swiped"
            input_data["action_type"] = "R3Swipe"
            input_data["event_tags"]["is_r3_swipe"] = True
            await self.update_alert_status(indent_status=IndentStatus.R3Swipe, input_data=input_data, progress_rate="9")
            return await self.send_alert_action(is_r3_swipe=True)
        return await self.send_alert_action(is_r3_swipe=False)

    async def is_invoice_created(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        indent_no = "','".join(self.params.get("indent_no").split(","))
        location_no = self.params.get("location_no")
        query = f"""SELECT * FROM "IMS_SAP"."INDENT_PRODUCTS" where SUBSTR("DEALER_CODE",1,10) = '{dealer_code}' """ \
                f"""AND "PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND "INDENT_NO" IN ('{indent_no}') """ \
                f"""AND "LOCN_CODE" = '{location_no}' AND "SALES_ORDERNO" IS NOT NULL AND "INVOICE_NO" IS NOT NULL"""

        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" a, "IMS_SAP"."INDENT_PRODUCTS" b WHERE SUBSTR(a."DEALER_CODE",1,10) = '{dealer_code}' AND """ \
                f"""a."LOCN_CODE" = b."LOCN_CODE" AND a."PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND a."INDENT_NO" = b."INDENT_NO" """ \
                f"""AND a."CANCEL_INDENT" IS NULL AND a."TRUCK_REGNO" IS NOT NULL AND (a."VALID_INDENT" = 'Y' OR a."VALID_INDENT" = 'H') """ \
                f"""AND a."BATCH_FLAG" = 'Y' AND b."SALES_ORDERNO" IS NOT NULL AND b."INVOICE_NO" IS NOT NULL"""

        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" a, "IMS_SAP"."INDENT_PRODUCTS" b WHERE SUBSTR(a."DEALER_CODE",1,10) = '{dealer_code}' AND """ \
                f"""a."LOCN_CODE" = b."LOCN_CODE" AND a."PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND a."INDENT_NO" IN ('{indent_no}') """ \
                f"""AND a."CANCEL_INDENT" IS NULL AND a."TRUCK_REGNO" IS NOT NULL AND (a."VALID_INDENT" = 'Y' OR a."VALID_INDENT" = 'H') """ \
                f"""AND a."BATCH_FLAG" = 'Y' AND b."SALES_ORDERNO" IS NOT NULL AND b."INVOICE_NO" IS NOT NULL"""

        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        resp = await function(query=query)
        input_data = {
            "action_msg": "",
            "event_tags": {
                "is_raised": False
            }
        }
        if not resp:
            return await self.send_alert_action(is_raised=False)
        resp = resp[0]
        if resp.get("count") > 0:
            input_data["action_msg"] = "Invoice created"
            input_data["action_type"] = "Created"
            input_data["event_tags"]["is_created"] = True

            await self.update_alert_status(
                indent_status=IndentStatus.InvoiceCreated,
                input_data=input_data,
                progress_rate="8"
            )
            # await self.close_supply_chain_alert(
            #     alert_id=self.params.get("alert_id"),
            #     alert_status=AlertStatus.Close,
            #     alert_state=AlertState.Resolved,
            #     indent_status=IndentStatus.Completed
            # )
            # await self.update_alert_status(indent_status=IndentStatus.InvoiceCreated)
            return await self.send_alert_action(is_created=True)
        return await self.send_alert_action(is_created=False)

    async def is_product_delivered(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("cris")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id"))
        indent_no = "','".join(self.params.get("indent_no").split(","))
        alert_id = self.params.get("alert_id")
        # query = f'''select item_name, rosapcode, STRING_AGG(CAST(tank_no AS TEXT), ',') tank_no, product_no,
        #         case when sum(pumpable_Stock) <=0 then 1
        #         when sum(pumpable_Stock) <(sum(sch.avgsales_7days)/7) then 2
        #         when sum(pumpable_Stock) between (sum(sch.avgsales_7days)/7) and (sum(sch.avgsales_7days)/7)*3 then 3
        #         when sum(pumpable_Stock) between (sum(sch.avgsales_7days)/7)*3 and (sum(sch.avgsales_7days)/7)*6 then 4
        #         else 5 end status
        #         from "HPCL_HOS".sch_inventory_forecast_dashboard sch
        #         where 1=1 and sch.volume>0 and rosapcode = '{dealer_code}'
        #         group by item_name, rosapcode, product_no
        #         order by item_name, rosapcode, product_no'''
        query = f"""SELECT
                        site_id,
                        fcc_code,
                        rosapcode,
                        item_name,
                        product_grp AS product_grp,
                        product_no,
                        COUNT(DISTINCT tank_no) AS tank_cnt,
                        STRING_AGG(CAST(tank_no AS TEXT), ',') AS tank_no,
                        CASE
                            WHEN SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) <= 0 THEN 1
                            WHEN SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) < (SUM(sch.avgsales_7days) / 7) THEN 2
                            WHEN SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) >= (SUM(sch.avgsales_7days) / 7)
                                 AND SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) <= (SUM(sch.avgsales_7days) / 7) * 3 THEN 3
                            WHEN SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) > (SUM(sch.avgsales_7days) / 7) * 3
                                 AND SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) <= (SUM(sch.avgsales_7days) / 7) * 6 THEN 4
                            ELSE 6
                        END AS status
                    FROM "HPCL_HOS".sch_inventory_forecast_dashboard as sch
                    WHERE sch.volume > 0 and rosapcode = '{dealer_code}'
                    GROUP BY site_id, fcc_code, product_grp, rosapcode, product_no, item_name
                    ORDER BY site_id, fcc_code, product_grp, rosapcode, product_no, item_name"""
        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        cris_resp = await function(query=query)
        if not cris_resp:
            cris_resp = pd.DataFrame({"item_name": [], "rosapcode": [], "tank_no": [], "product_no": [], "status": [], "product_grp": []})
        else:
            cris_resp = pd.DataFrame(cris_resp)
        # print("cris_resp: ", cris_resp[["item_name", "rosapcode", "status", "product_grp"]])

        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        query = f'''SELECT product_code, 
                    dry_out_in_days FROM public.alerts
                    where id = '{alert_id}' '''
        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        ceg_resp = await function(query=query)
        ceg_resp = ceg_resp[0]
        product_code = ceg_resp.get("product_code")
        dry_out_in_days = ceg_resp.get("dry_out_in_days")
        # ceg_resp = pd.DataFrame(ceg_resp)

        _prod_map = await self.prod_code_mapping()
        # cris_resp.replace({"item_name": _prod_map}, inplace=True)
        # cris_resp = cris_resp[cris_resp['item_name'] == str(product_code)]
        cris_resp.replace({"product_grp": _prod_map}, inplace=True)
        cris_resp = cris_resp[cris_resp['product_grp'] == str(product_code)]
        # print("cris_resp after filter: ", cris_resp[["item_name", "product_grp", "rosapcode", "status"]])
        cris_resp = cris_resp.to_dict("records")
        if cris_resp:
            cris_resp = cris_resp[0]
        else:
            cris_resp = {}
        if int(cris_resp.get("status", 1)) > int(dry_out_in_days):
            input_data = {
                "action_msg": "",
                "event_tags": {
                    "is_delivered": False
                }
            }
            input_data["action_msg"] = "Indent Delivered"
            input_data["action_type"] = "Created"
            input_data["event_tags"]["is_delivered"] = True

            await self.update_alert_status(
                indent_status=IndentStatus.Completed,
                alert_status=AlertStatus.Close,
                alert_state=AlertState.Resolved,
                input_data=input_data,
                progress_rate="11"
            )
            await self.close_supply_chain_alert(
                alert_id=self.params.get("alert_id"),
                alert_status=AlertStatus.Close,
                alert_state=AlertState.Resolved,
                indent_status=IndentStatus.Completed
            )
            # await self.update_alert_status(indent_status=IndentStatus.InvoiceCreated)
            return await self.send_alert_action(is_delivered=True)
        return await self.send_alert_action(is_delivered=False)

    async def _is_product_delivered(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        indent_no = "','".join(self.params.get("indent_no").split(","))
        location_no = self.params.get("location_no")
        query = f"""SELECT * FROM "IMS_SAP"."INDENT_PRODUCTS" where SUBSTR("DEALER_CODE",1,10) = '{dealer_code}' """ \
                f"""AND "PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND "INDENT_NO" IN ('{indent_no}') """ \
                f"""AND "LOCN_CODE" = '{location_no}' AND "SALES_ORDERNO" IS NOT NULL AND "INVOICE_NO" IS NOT NULL"""

        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" a, "IMS_SAP"."INDENT_PRODUCTS" b WHERE SUBSTR(a."DEALER_CODE",1,10) = '{dealer_code}' AND """ \
                f"""a."LOCN_CODE" = b."LOCN_CODE" AND a."PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND a."INDENT_NO" = b."INDENT_NO" """ \
                f"""AND a."CANCEL_INDENT" IS NULL AND a."TRUCK_REGNO" IS NOT NULL AND (a."VALID_INDENT" = 'Y' OR a."VALID_INDENT" = 'H') """ \
                f"""AND a."BATCH_FLAG" = 'Y' AND b."SALES_ORDERNO" IS NOT NULL AND b."INVOICE_NO" IS NOT NULL"""

        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" a, "IMS_SAP"."INDENT_PRODUCTS" b WHERE SUBSTR(a."DEALER_CODE",1,10) = '{dealer_code}' AND """ \
                f"""a."LOCN_CODE" = b."LOCN_CODE" AND a."PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND a."INDENT_NO" IN ('{indent_no}') """ \
                f"""AND a."CANCEL_INDENT" IS NULL AND a."TRUCK_REGNO" IS NOT NULL AND (a."VALID_INDENT" = 'Y' OR a."VALID_INDENT" = 'H') """ \
                f"""AND a."BATCH_FLAG" = 'Y' AND b."SALES_ORDERNO" IS NOT NULL AND b."INVOICE_NO" IS NOT NULL"""

        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        resp = await function(query=query)
        input_data = {
            "action_msg": "",
            "event_tags": {
                "is_delivered": False
            }
        }
        if not resp:
            return await self.send_alert_action(is_raised=False)
        resp = resp[0]
        if resp.get("count") > 0:
            input_data["action_msg"] = "Indent Delivered"
            input_data["action_type"] = "Created"
            input_data["event_tags"]["is_delivered"] = True

            await self.update_alert_status(
                indent_status=IndentStatus.Completed,
                alert_status=AlertStatus.Close,
                alert_state=AlertState.Resolved,
                input_data=input_data,
                progress_rate="11"
            )
            await self.close_supply_chain_alert(
                alert_id=self.params.get("alert_id"),
                alert_status=AlertStatus.Close,
                alert_state=AlertState.Resolved,
                indent_status=IndentStatus.Completed
            )
            # await self.update_alert_status(indent_status=IndentStatus.InvoiceCreated)
            return await self.send_alert_action(is_delivered=True)
        return await self.send_alert_action(is_delivered=False)

    async def check_sales_order(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        indent_no = "','".join(self.params.get("indent_no").split(","))
        location_no = self.params.get("location_no")

        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" a, "IMS_SAP"."INDENT_PRODUCTS" b WHERE SUBSTR(a."DEALER_CODE",1,10) = '{dealer_code}' AND """ \
                f"""a."LOCN_CODE" = b."LOCN_CODE" AND a."PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND a."INDENT_NO" IN ('{indent_no}') """ \
                f"""AND a."CANCEL_INDENT" IS NULL AND a."TRUCK_REGNO" IS NOT NULL AND (a."VALID_INDENT" = 'Y' OR a."VALID_INDENT" = 'H') """ \
                f"""AND a."BATCH_FLAG" = 'Y' AND b."SALES_ORDERNO" IS NOT NULL"""

        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        resp = await function(query=query)
        input_data = {
            "action_msg": "",
            "event_tags": {
                "is_raised": False
            }
        }
        if not resp:
            return await self.send_alert_action(is_raised=False)
        resp = resp[0]
        if resp.get("count") > 0:
            input_data["action_msg"] = "Sales order created"
            input_data["action_type"] = "OrderPlaced"
            input_data["event_tags"]["is_order_placed"] = True
            await self.update_alert_status(indent_status=IndentStatus.SalesOrderPlaced, input_data=input_data, progress_rate="6")
            return await self.send_alert_action(is_order_placed=True)
        return await self.send_alert_action(is_order_placed=False)

    async def vts_check(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        return True, {"msg": "Success"}

    async def indent_wait_time(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        start_time = datetime.time(6, 0)  # 6:00 AM
        end_time = datetime.time(16, 0)  # 4:00 PM

        current_time = datetime.datetime.now(datetime.timezone.utc).time()

        if start_time <= current_time <= end_time:
            return await self.send_alert_action(is_approved=True)
        return await self.send_alert_action(is_approved=False)

    async def update_alert_status(
            self,
            indent_status: str,
            alert_status: str = AlertStatus.InProgress,
            alert_state: str = AlertState.InProgress,
            input_data: dict = {},
            progress_rate: str = "0"
    ):
        alert_id = self.params.get("alert_id")
        alert_data = await Alerts.get(alert_id)

        # input_data = {
        #     "action_type": "RO"
        # }
        if alert_data.indent_status != indent_status:  # type: ignore
            alert_history = alert_data
            if not isinstance(alert_data, dict):
                alert_history = alert_data.__dict__
            action_msgs = [entry["action_msg"] for entry in alert_history['alert_history']]
            if input_data['action_msg'] not in action_msgs:
                await alert_manager.AlertAction().update_alert_history(
                    input_data=input_data, alert_data=alert_data
                )

        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__
            
        if "_sa_instance_state" in alert_data.keys():
                del alert_data["_sa_instance_state"]

        if alert_data['indent_status'] != indent_status:  # type: ignore
            alert_data['indent_status'] = indent_status
            alert_data['alert_status'] = alert_status
            alert_data['alert_state'] = alert_state
            if str(progress_rate) != "0":
                alert_data['progress_rate'] = str(progress_rate)
            alert_data = Alerts(**alert_data)
            await alert_data.modify()

    async def get_prod_code_and_indent_no(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        _mapping = await self.prod_code_mapping()
        indent_no = self.params.get("indent_no")
        location_no = self.params.get("location_no")

        prod_code = _mapping.get(self.params.get("product_code"))

        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        query = f"""SELECT a."INDENT_NO" AS "indent_no", b."PROD" AS "product_nonumber" FROM "IMS_SAP"."INDENT_REQUEST" AS a, "IMS_SAP"."INDENT_PRODUCTS" AS b WHERE SUBSTR(a."DEALER_CODE",1,10) = '{dealer_code}' AND """ \
                f"""a."LOCN_CODE" = b."LOCN_CODE" AND a."PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND a."INDENT_NO" = b."INDENT_NO" """ \
                f"""AND a."CANCEL_INDENT" IS NULL AND (a."VALID_INDENT" = 'Y' OR a."VALID_INDENT" = 'H') """

        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        resp = await function(query=query)
        if not resp:
            return False, {}
        result = {}
        for entry in resp:
            indent_no = entry["indent_no"]
            product_no = entry["product_no"]
            if indent_no not in result:
                result[indent_no] = []
            result[indent_no].append(product_no)
        return result

    async def close_supply_chain_alert(
            self, alert_id: str,
            alert_status: str = AlertStatus.Close,
            alert_state: str = AlertState.Resolved,
            indent_status: str = IndentStatus.Completed
    ):
        alert_data = await Alerts.get(alert_id)
        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__

        alert_data['alert_type'] = 'RO'
        alert_data['alert_id'] = alert_id
        alert_data['indent_status'] = indent_status
        alert_data['alert_status'] = alert_status
        alert_data['alert_state'] = alert_state
        await close_alert(alert_data)

        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'upsert_data'
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        # for each_tank in str(alert_data['device_id']).split(","):
        _mapping = await self.prod_code_mapping()
        prod_key = next((k for k, v in _mapping.items() if v == str(alert_data['product_code'])), None)
        _reverse_mapping = await self.prod_code_reverse_mapping()
        alert_data['product_code'] = _reverse_mapping.get(prod_key, alert_data['product_code'])
        # await function(
        #     schema_name="HPCL_HOS",
        #     table_name=connection_mapping.table_mapping.get("dry_out", ""),
        #     records={
        #         "indent_status": "Completed",
        #         "site_id": alert_data['sap_id'],
        #         "fcc_code": alert_data['sap_id'],
        #         "product_no": int(alert_data['product_code']),
        #         "tank_no": int(alert_data['device_id']),
        #     },
        #     conflict_columns=["site_id", "fcc_code", "product_no", "tank_no"]
        # )
        query = f"""UPDATE "HPCL_HOS".sch_inventory_forecast_dashboard SET "indent_status" = 'Completed' """ \
                f"""WHERE "site_id" = '{alert_data['sap_id']}' """ \
                f"""AND "fcc_code" = '{alert_data['sap_id']}' """ \
                f"""AND "product_no" = '{alert_data['product_code']}' """
        # await function(
        #     query=query
        # )
        return

    async def update_indent_no(self, indent_no: str, loc_code: str, indent_raised_date):
        MAX_RETRIES = 5
        RETRY_DELAY = 5
        alert_data = await Alerts.get(self.params["alert_id"])

        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__
        instance_id = alert_data.get("workflow_instance_id")
        # CAMUNDA_URL = await helpers.get_alert_camunda_url(self.params["alert_id"],
        #                                                   f"{urdhva_base.settings.camunda_url}")
        CAMUNDA_URL = self.params['CAMUNDA_URL']

        headers = {"Content-Type": "application/json"}
        # url = f"{CAMUNDA_URL}/process-instance/{instance_id}/variables/indent_no"
        # payload = {
        #     "indent_no": {"value": indent_no, "type": "String"},
        #     "terminal_plant_id": {"value": loc_code, "type": "String"},
        # }
        # payload = {"value": indent_no, "type": "String"}
        #
        # response = requests.put(url, json=payload, headers=headers)
        # if response.status_code != 200:
        #     print("Error updating indent no", response.text)
        # else:
        #     print("Indent no updated successfully")
        #
        # url = f"{CAMUNDA_URL}/process-instance/{instance_id}/variables/terminal_plant_id"
        # payload = {"value": loc_code, "type": "String"}
        # response = requests.put(url, json=payload, headers=headers)
        # if response.status_code != 200:
        #     print("Error updating indent no", response.text)
        # else:
        #     print("Indent no updated successfully")
        #
        # url = f"{CAMUNDA_URL}/process-instance/{instance_id}/variables/indent_raised_date"
        # payload = {"value": indent_raised_date.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + "Z", "type": "String"}
        # response = requests.put(url, json=payload, headers=headers)
        # if response.status_code != 200:
        #     print("Error updating indent no", response.text)
        # else:
        #     print("Indent no updated successfully")
        #
        # return True
        variables = {
            "indent_no": {"value": indent_no, "type": "String"},
            "terminal_plant_id": {"value": loc_code, "type": "String"},
            "indent_raised_date": {
                "value": indent_raised_date.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + "Z",
                "type": "String"
            },
        }

        for var_name, payload in variables.items():
            url = f"{CAMUNDA_URL}/engine-rest/process-instance/{instance_id}/variables/{var_name}"

            for attempt in range(MAX_RETRIES):
                try:
                    response = requests.put(url, json=payload, headers=headers)

                    if response.status_code == 204:  # Success in Camunda
                        print(f"{var_name} updated successfully.")
                        logger.info(f"{var_name} updated successfully.")
                        break
                    else:
                        print(
                            f"Error updating {var_name} (attempt {attempt + 1}): {response.status_code} - {response.text}")
                        logger.info(
                            f"Error updating {var_name} (attempt {attempt + 1}): {response.status_code} - {response.text}")

                except requests.RequestException as e:
                    print(f"Request error for {var_name} (attempt {attempt + 1}): {e}")
                    logger.info(f"Request error for {var_name} (attempt {attempt + 1}): {e}")

                # Retry logic with exponential backoff
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY * (2 ** attempt))
                else:
                    print(f"Failed to update {var_name} after {MAX_RETRIES} retries.")
                    logger.info(f"Failed to update {var_name} after {MAX_RETRIES} retries.")
                    return False

        return True

    async def _is_r3_swiped(self):
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        indent_no = self.params.get("indent_no")
        locn_code = self.params.get("terminal_plant_id")
        today_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        if 'prod_reqd_dt' in self.params.keys():
            prod_reqd_dt = self.params['prod_reqd_dt'].split("T")[0]
        else:
            query = f"""SELECT "PROD_REQD_DT" FROM "IMS_SAP"."INDENT_REQUEST" WHERE "INDENT_NO" = '{indent_no}' """ \
                    f"""AND "LOCN_CODE" = '{locn_code}' """
            Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
            Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
            resp = await function(query=query)
            if resp:
                prod_reqd_dt = resp[0].get("PROD_REQD_DT").strftime("%Y-%m-%d")
            else:
                prod_reqd_dt = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        query = f"""SELECT COUNT(*) AS "count", a."INDENT_NO", a."LOCN_CODE", a."TRUCK_REGNO", b."CARD_STATUS", b."LOADED_ON" 
                                    FROM 
                                        "IMS_SAP"."INDENT_REQUEST" a, 
                                        "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" b
                                    WHERE 
                                        SUBSTR(a."DEALER_CODE", 1, 10) = '{dealer_code}'
                                        AND a."INDENT_NO" = '{indent_no}'
                                        AND a."LOCN_CODE" = b."LOCN_CODE"
                                        AND a."TRUCK_REGNO" = b."TRUCK_REGNO"
                                        AND b."CARD_STATUS" = 'O'
                                        AND b."LOADED_ON" >= TO_DATE('{prod_reqd_dt}', 'YYYY-MM-DD')
                                    GROUP BY a."INDENT_NO", a."LOCN_CODE", a."TRUCK_REGNO", b."CARD_STATUS", b."LOADED_ON" """
        # AND b."LOADED_ON" BETWEEN TO_DATE('{prod_reqd_dt}', 'YYYY-MM-DD') AND TO_DATE('{today_date}', 'YYYY-MM-DD')
        # print("connection_name: ", self.params['connection_name'])
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        # logger.info(f"Query: {query}")
        resp = await function(query=query)
        if not resp:
            return False
        resp = resp[0]
        if resp.get("count") > 0:
            return True
        return False

    async def _is_indent_delivered(self):
        dealer_code = str(self.params.get("dealer_id"))
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("cris")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        alert_id = self.params.get("alert_id")
        query = f"""SELECT
                        site_id,
                        fcc_code,
                        rosapcode,
                        item_name,
                        product_grp AS product_grp,
                        product_no,
                        COUNT(DISTINCT tank_no) AS tank_cnt,
                        STRING_AGG(CAST(tank_no AS TEXT), ',') AS tank_no,
                        CASE
                            WHEN SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) <= 0 THEN 1
                            WHEN SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) < (SUM(sch.avgsales_7days) / 7) THEN 2
                            WHEN SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) >= (SUM(sch.avgsales_7days) / 7)
                                 AND SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) <= (SUM(sch.avgsales_7days) / 7) * 3 THEN 3
                            WHEN SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) > (SUM(sch.avgsales_7days) / 7) * 3
                                 AND SUM(CASE WHEN pumpable_Stock >= 0 THEN pumpable_Stock ELSE 0 END) <= (SUM(sch.avgsales_7days) / 7) * 6 THEN 4
                            ELSE 6
                        END AS status
                    FROM "HPCL_HOS".sch_inventory_forecast_dashboard as sch
                    WHERE sch.volume > 0 and rosapcode = '{dealer_code}'
                    GROUP BY site_id, fcc_code, product_grp, rosapcode, product_no, item_name
                    ORDER BY site_id, fcc_code, product_grp, rosapcode, product_no, item_name"""
        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        cris_resp = await function(query=query)
        if not cris_resp:
            cris_resp = pd.DataFrame({"item_name": [], "rosapcode": [], "tank_no": [], "product_no": [], "status": [], "product_grp": []})
        else:
            cris_resp = pd.DataFrame(cris_resp)
        # print("cris_resp: ", cris_resp)

        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        query = f'''SELECT product_code, 
                            dry_out_in_days FROM public.alerts
                            where id = '{alert_id}' '''
        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        ceg_resp = await function(query=query)
        if not ceg_resp:
            print(f"{alert_id} Alerts not Present")
            return False
        ceg_resp = ceg_resp[0]
        product_code = ceg_resp.get("product_code")
        dry_out_in_days = ceg_resp.get("dry_out_in_days")
        # ceg_resp = pd.DataFrame(ceg_resp)

        _prod_map = await self.prod_code_mapping()
        # cris_resp.replace({"item_name": _prod_map}, inplace=True)
        # cris_resp = cris_resp[cris_resp['item_name'] == str(product_code)]
        cris_resp.replace({"product_grp": _prod_map}, inplace=True)
        cris_resp = cris_resp[cris_resp['product_grp'] == str(product_code)]
        cris_resp = cris_resp.to_dict("records")
        if cris_resp:
            cris_resp = cris_resp[0]
        else:
            cris_resp = {}
        # print("cris_resp: ", cris_resp)
        # print("dry_out_in_days: ", ceg_resp)
        if int(cris_resp.get("status", 1)) > int(dry_out_in_days):
            return True
        return False

    async def _is_invoice_created(self):
        Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        indent_no = "','".join(self.params.get("indent_no").split(","))
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" a, "IMS_SAP"."INDENT_PRODUCTS" b WHERE SUBSTR(a."DEALER_CODE",1,10) = '{dealer_code}' AND """ \
                f"""a."LOCN_CODE" = b."LOCN_CODE" AND a."PROD_REQD_DT" BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND a."INDENT_NO" IN ('{indent_no}') """ \
                f"""AND a."CANCEL_INDENT" IS NULL AND a."TRUCK_REGNO" IS NOT NULL AND (a."VALID_INDENT" = 'Y' OR a."VALID_INDENT" = 'H') """ \
                f"""AND a."BATCH_FLAG" = 'Y' AND b."SALES_ORDERNO" IS NOT NULL AND b."INVOICE_NO" IS NOT NULL"""

        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        resp = await function(query=query)
        if not resp:
            return False
        resp = resp[0]
        if resp.get("count") > 0:
            return True
        return False

    async def _close_camunda_workflow(self):
        # camunda_url = await helpers.get_alert_camunda_url(self.params['alert_id'], "error")
        camunda_url = self.params['CAMUNDA_URL']
        MAX_RETRIES = 5
        RETRY_DELAY = 5
        headers = {"Content-Type": "application/json"}
        if camunda_url != 'error':
            alert_data = await Alerts.get(self.params["alert_id"])

            if not isinstance(alert_data, dict):
                alert_data = alert_data.__dict__
            instance_id = alert_data.get("workflow_instance_id")
            url = f"{camunda_url}/engine-rest/process-instance/{instance_id}"
            for attempt in range(MAX_RETRIES):
                try:
                    response = requests.delete(url, headers=headers)

                    if response.status_code == 204:  # Success in Camunda
                        print(f"{instance_id} Deleted successfully.")
                        logger.info(f"{instance_id} Deleted successfully.")
                        break
                    else:
                        print(
                            f"Error Deleting {instance_id} {camunda_url} (attempt {attempt + 1}): {response.status_code} - {response.text}")
                        logger.info(
                            f"Error Deleting {camunda_url} {instance_id} (attempt {attempt + 1}): {response.status_code} - {response.text}")

                except requests.RequestException as e:
                    print(f"Request error for {camunda_url} {instance_id} (attempt {attempt + 1}): {e}")
                    logger.info(f"Request error for {camunda_url} {instance_id} (attempt {attempt + 1}): {e}")

                # Retry logic with exponential backoff
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY * (2 ** attempt))
                else:
                    print(f"Failed to Deleting {camunda_url} {instance_id} after {MAX_RETRIES} retries.")
                    logger.info(f"Failed to Deleting {camunda_url} {instance_id} after {MAX_RETRIES} retries.")
                    return False
            return True
        return False
