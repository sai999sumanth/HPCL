import urdhva_base
import datetime
import requests
import charts_actions
from hpcl_ceg_enum import AlertState as AlertState
from hpcl_ceg_enum import AlertStatus as AlertStatus
from hpcl_ceg_enum import IndentStatus as IndentStatus
import utilities.connection_mapping as connection_mapping
from charts_actions import charts_connection_vault_routing
import orchestrator.alerting.alert_manager as alert_manager
from orchestrator.alerting.alert_manager import close_alert
from hpcl_ceg_model import Alerts_Alert_ActionParams, Alerts
from hpcl_ceg_enum import AlertActionType as AlertActionType
from alerts_actions import alerts_alert_action as alerts_alert_action
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams


class IndentDryOut:
    def __init__(self):
        self.params = dict()

    async def update_dry_out_histrory(self, dry_out_alerts):
        # Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        # Charts_Connection_Vault_RoutingParams.action = 'upsert_data'
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        charts_ins = Charts_Connection_Vault_RoutingParams(
            connection_id=connection_mapping.connection_mapping.get("hpcl_ceg", "1"),
            action='execute_query'
        )
        function = await charts_connection_vault_routing(charts_ins)
        resp = await function(
            schema_name="HPCL_HOS",
            table_name=connection_mapping.table_mapping.get("dry_out", ""),
            records=dry_out_alerts,
            conflict_columns=["ro_sap_code", "dry_out_start_date", "product_no"]
        )
        return resp

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
            is_created: bool = False
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
            "created": is_created
        }
        return True, msg_block

    async def check_indent_status(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        print("Params: ", self.params)
        # Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        charts_ins = Charts_Connection_Vault_RoutingParams(
            connection_id=self.params['connection_name'],
            action='execute_query'
        )
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        prod_code = self.params.get("product_code")
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE SUBSTR(DEALER_CODE,1,10) = '{dealer_code}' """ \
                f"AND PROD_REQD_DT BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND CANCEL_INDENT IS NULL"

        query = f"""SELECT COUNT(*) AS "count", a.INDENT_NO AS "INDENT_NO" , b.PROD AS "PROD", a.LOCN_CODE AS "LOCN_CODE" """ \
                f"""FROM "IMS_SAP"."INDENT_REQUEST" a, "IMS_SAP"."INDENT_PRODUCTS" b WHERE SUBSTR(a.DEALER_CODE,1,10) = '{dealer_code}' """ \
                f"""AND a.PROD_REQD_DT BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') """ \
                f"""AND b.PROD = '{prod_code}' """ \
                f"""AND a.LOCN_CODE = b.LOCN_CODE AND a.INDENT_NO = b.INDENT_NO AND a.CANCEL_INDENT IS NULL """ \
                f"""GROUP BY a.INDENT_NO, b.PROD, a.LOCN_CODE ORDER BY a.INDENT_NO DESC"""

        # function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        function = await charts_connection_vault_routing(charts_ins)
        resp = await function(query=query)
        input_data = {
            "action_msg": "",
            "event_tags": {
                "is_raised": False
            }
        }
        if not resp:
            return await self.send_alert_action(is_raised=False)

        indent_no = [str(i.get("INDENT_NO")) for i in resp]
        resp = resp[0]

        if resp.get("count") > 0:
            self.params['indent_no'] = ",".join(indent_no)
            self.params['terminal_plant_id'] = resp.get("LOCN_CODE")
            await self.update_indent_no(str(self.params['indent_no']), str(resp.get("LOCN_CODE")))
            # await self.update_alert_status(indent_status=IndentStatus.IndentRaised)
            return await self.send_alert_action(is_raised=True)
        input_data["action_msg"] = "Indent Not Raised"
        input_data["action_type"] = "Raised"
        await self.update_alert_status(indent_status=IndentStatus.IndentNotRaised, input_data=input_data)
        return await self.send_alert_action(is_raised=False)

    async def is_truck_allocated(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        # Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        charts_ins = Charts_Connection_Vault_RoutingParams(
            connection_id=self.params['connection_name'],
            action='execute_query'
        )
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        indent_no = "','".join(self.params.get("indent_no").split(","))
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE SUBSTR(DEALER_CODE,1,10) = '{dealer_code}' """ \
                f"AND INDENT_NO IN ('{indent_no}') AND PROD_REQD_DT BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') " \
                f"AND CANCEL_INDENT IS NULL AND TRUCK_REGNO IS NOT NULL"
        # function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        function = await charts_connection_vault_routing(charts_ins)
        resp = await function(query=query)
        print("resp: ", resp)
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
            await self.update_alert_status(indent_status=IndentStatus.TruckAllocated, input_data=input_data)
            return await self.send_alert_action(is_allocated=True)
        input_data["action_msg"] = "Truck Not Allocated"
        input_data["action_type"] = "Message"
        await self.update_alert_status(indent_status=IndentStatus.TruckNotAllocated, input_data=input_data)
        return await self.send_alert_action(is_allocated=False)


    async def is_indent_cancelled(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        # Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        charts_ins = Charts_Connection_Vault_RoutingParams(
            connection_id=self.params['connection_name'],
            action='execute_query'
        )
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        indent_no = "','".join(self.params.get("indent_no").split(","))
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE SUBSTR(DEALER_CODE,1,10) = '{dealer_code}' """ \
                f"AND PROD_REQD_DT BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') " \
                f"AND CANCEL_INDENT IS NOT NULL AND INDENT_NO IN ('{indent_no}')"
        # function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        function = await charts_connection_vault_routing(charts_ins)
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
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE SUBSTR(DEALER_CODE,1,10) = '{dealer_code}' """ \
                f"AND PROD_REQD_DT BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD')" \
                f"AND INDENT_NO IN ('{indent_no}')"
        function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        resp_1 = await function(query=query)
        if not resp_1:
            return await self.send_alert_action(is_raised=False)
        resp_1 = resp_1[0]
        if resp.get("count") > 0 & resp_1.get("count") == resp.get("count"):
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
        # Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        charts_ins = Charts_Connection_Vault_RoutingParams(
            connection_id=self.params['connection_name'],
            action='execute_query'
        )
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        indent_no = "','".join(self.params.get("indent_no").split(","))
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE SUBSTR(DEALER_CODE,1,10) = '{dealer_code}' """ \
                f"AND PROD_REQD_DT BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') " \
                f"AND INDENT_NO IN ('{indent_no}') AND CANCEL_INDENT IS NULL AND VALID_INDENT = 'N'"
        # function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        function = await charts_connection_vault_routing(charts_ins)
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
                input_data=input_data
            )
            return await self.send_alert_action(is_raised=True)
        return await self.send_alert_action(is_raised=False)

    async def is_indent_valid(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        print("params1111: ", self.params)
        # Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        charts_ins = Charts_Connection_Vault_RoutingParams(
            connection_id=self.params['connection_name'],
            action='execute_query'
        )
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        indent_no = "','".join(self.params.get("indent_no").split(","))
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE SUBSTR(DEALER_CODE,1,10) = '{dealer_code}' """ \
                f"AND PROD_REQD_DT BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND CANCEL_INDENT IS NULL AND " \
                f"(VALID_INDENT = 'Y' OR VALID_INDENT = 'H') AND INDENT_NO IN ('{indent_no}')"
        # function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        function = await charts_connection_vault_routing(charts_ins)
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
            await self.update_alert_status(indent_status=IndentStatus.ValidIndent, input_data=input_data)
            return await self.send_alert_action(is_raised=True)

        input_data["action_msg"] = "Indent Is On Hold"
        input_data["action_type"] = "Message"
        input_data["event_tags"]["is_raised"] = False
        await self.update_alert_status(indent_status=IndentStatus.IndentOnHold, input_data=input_data)
        return await self.send_alert_action(is_raised=False)

    async def is_indent_sent_sap(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        # Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        charts_ins = Charts_Connection_Vault_RoutingParams(
            connection_id=self.params['connection_name'],
            action='execute_query'
        )
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        indent_no = "','".join(self.params.get("indent_no").split(","))
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE SUBSTR(DEALER_CODE,1,10) = '{dealer_code}' """ \
                f"AND PROD_REQD_DT BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND CANCEL_INDENT IS NULL AND " \
                f"(VALID_INDENT = 'Y' OR VALID_INDENT = 'H') AND BATCH_FLAG = 'Y' AND INDENT_NO IN ('{indent_no}')"
        # function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        function = await charts_connection_vault_routing(charts_ins)
        resp = await function(query=query)
        input_data = {
            "action_msg": "",
            "event_tags": {
                "is_raised": False
            }
        }
        print(resp)
        if not resp:
            return await self.send_alert_action(is_raised=False)
        resp = resp[0]
        if resp.get("count") > 0:
            input_data["action_msg"] = "Sent To SAP"
            input_data["action_type"] = "SentToSap"
            input_data["event_tags"]["is_sent_to_sap"] = True
            await self.update_alert_status(indent_status=IndentStatus.SentToSAP, input_data=input_data)
            return await self.send_alert_action(is_sent_to_sap=True)
        return await self.send_alert_action(is_sent_to_sap=False)

    async def check_r1_status(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        # Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        charts_ins = Charts_Connection_Vault_RoutingParams(
            connection_id=self.params['connection_name'],
            action='execute_query'
        )
        r1_status = self.params.get("r1_status")
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE R1_STATUS = '{r1_status}'"""
        # function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        function = await charts_connection_vault_routing(charts_ins)
        resp = await function(query=query)
        print(resp)
        if resp:
            return True
        return False

    async def check_r2_status(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        # Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        charts_ins = Charts_Connection_Vault_RoutingParams(
            connection_id=self.params['connection_name'],
            action='execute_query'
        )
        r2_status = self.params.get("r2_status")
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE R2_STATUS = '{r2_status}'"""
        # function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        function = await charts_connection_vault_routing(charts_ins)
        resp = await function(query=query)
        print(resp)
        if not resp:
            return False, {}
        resp = resp[0]
        if resp.get("count") > 0:
            return True, {"msg": "R2 status is generated"}
        return False, {}

    async def check_r3_status(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        # Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        charts_ins = Charts_Connection_Vault_RoutingParams(
            connection_id=self.params['connection_name'],
            action='execute_query'
        )
        r3_status = self.params.get("r3_status")
        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" WHERE R3_STATUS = '{r3_status}'"""
        # function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        function = await charts_connection_vault_routing(charts_ins)
        resp = await function(query=query)
        print(resp)
        if resp:
            return True
        return False

    async def is_invoice_created(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        # Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        charts_ins = Charts_Connection_Vault_RoutingParams(
            connection_id=self.params['connection_name'],
            action='execute_query'
        )
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
        query = f"""SELECT * FROM "IMS_SAP"."INDENT_PRODUCTS" where SUBSTR(DEALER_CODE,1,10) = '{dealer_code}' """ \
                f"AND PROD_REQD_DT BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND INDENT_NO IN ('{indent_no}') " \
                f"AND LOCN_CODE = '{location_no}' AND SALES_ORDERNO IS NOT NULL AND INVOICE_NO IS NOT NULL"

        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" a, "IMS_SAP"."INDENT_PRODUCTS" b WHERE SUBSTR(a.DEALER_CODE,1,10) = '{dealer_code}' AND """ \
                f"a.LOCN_CODE = b.LOCN_CODE AND a.PROD_REQD_DT BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND a.INDENT_NO = b.INDENT_NO " \
                f"AND a.CANCEL_INDENT IS NULL AND a.TRUCK_REGNO IS NOT NULL AND (a.VALID_INDENT = 'Y' OR a.VALID_INDENT = 'H') " \
                f"AND a.BATCH_FLAG = 'Y' AND b.SALES_ORDERNO IS NOT NULL AND b.INVOICE_NO IS NOT NULL"

        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" a, "IMS_SAP"."INDENT_PRODUCTS" b WHERE SUBSTR(a.DEALER_CODE,1,10) = '{dealer_code}' AND """ \
                f"a.LOCN_CODE = b.LOCN_CODE AND a.PROD_REQD_DT BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND a.INDENT_NO IN ('{indent_no}') " \
                f"AND a.CANCEL_INDENT IS NULL AND a.TRUCK_REGNO IS NOT NULL AND (a.VALID_INDENT = 'Y' OR a.VALID_INDENT = 'H') " \
                f"AND a.BATCH_FLAG = 'Y' AND b.SALES_ORDERNO IS NOT NULL AND b.INVOICE_NO IS NOT NULL"

        # function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        function = await charts_connection_vault_routing(charts_ins)
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
                indent_status=IndentStatus.Completed,
                alert_status=AlertStatus.Close,
                alert_state=AlertState.Resolved,
                input_data=input_data
            )
            await self.close_supply_chain_alert(
                alert_id=self.params.get("alert_id"),
                alert_status=AlertStatus.Close,
                alert_state=AlertState.Resolved,
                indent_status=IndentStatus.Completed
            )
            # await self.update_alert_status(indent_status=IndentStatus.InvoiceCreated)
            return await self.send_alert_action(is_created=True)
        return await self.send_alert_action(is_created=False)

    async def check_sales_order(self, params: dict):
        if not self.params:
            self.params = params
            await self.get_connection_name()
        # Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        charts_ins = Charts_Connection_Vault_RoutingParams(
            connection_id=self.params['connection_name'],
            action='execute_query'
        )
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

        query = f"""SELECT COUNT(*) AS "count" FROM "IMS_SAP"."INDENT_REQUEST" a, "IMS_SAP"."INDENT_PRODUCTS" b WHERE SUBSTR(a.DEALER_CODE,1,10) = '{dealer_code}' AND """ \
                f"a.LOCN_CODE = b.LOCN_CODE AND a.PROD_REQD_DT BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND a.INDENT_NO IN ('{indent_no}') " \
                f"AND a.CANCEL_INDENT IS NULL AND a.TRUCK_REGNO IS NOT NULL AND (a.VALID_INDENT = 'Y' OR a.VALID_INDENT = 'H') " \
                f"AND a.BATCH_FLAG = 'Y' AND b.SALES_ORDERNO IS NOT NULL"

        # function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        function = await charts_connection_vault_routing(charts_ins)
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
            await self.update_alert_status(indent_status=IndentStatus.SalesOrderPlaced, input_data=input_data)
            return await self.send_alert_action(is_order_placed=True)
        return await self.send_alert_action(is_order_placed=False)

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
            input_data: dict = {}
    ):
        alert_id = self.params.get("alert_id")
        alert_data = await Alerts.get(alert_id)

        # input_data = {
        #     "action_type": "RO"
        # }
        if alert_data.indent_status != indent_status:  # type: ignore
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
            print("alert_data: ", alert_data)
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

        # Charts_Connection_Vault_RoutingParams.connection_id = self.params['connection_name']
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        charts_ins = Charts_Connection_Vault_RoutingParams(
            connection_id=self.params['connection_name'],
            action='execute_query'
        )
        dealer_code = str(self.params.get("dealer_id")).zfill(10)
        # now = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        # now = (self.params.get("workflow_datetime") - datetime.timedelta(days=0)).strftime("%Y-%m-%d")
        now = (
                datetime.datetime.strptime(self.params.get("workflow_datetime"), "%Y-%m-%dT%H:%M:%S.%fZ") -
                datetime.timedelta(days=0)
        ).strftime("%Y-%m-%d")
        next_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        query = f"""SELECT a.INDENT_NO AS "indent_no", b.PROD AS "product_nonumber = "12345678"" FROM "IMS_SAP"."INDENT_REQUEST" AS a, "IMS_SAP"."INDENT_PRODUCTS" AS b WHERE SUBSTR(a.DEALER_CODE,1,10) = '{dealer_code}' AND """ \
                f"a.LOCN_CODE = b.LOCN_CODE AND a.PROD_REQD_DT BETWEEN TO_DATE('{now}', 'YYYY-MM-DD') AND TO_DATE('{next_date}', 'YYYY-MM-DD') AND a.INDENT_NO = b.INDENT_NO " \
                f"AND a.CANCEL_INDENT IS NULL AND (a.VALID_INDENT = 'Y' OR a.VALID_INDENT = 'H') "

        # function = await charts_actions.charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        function = await charts_connection_vault_routing(charts_ins)
        resp = await function(query=query)
        print("resp: ", resp)
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

        # Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        # Charts_Connection_Vault_RoutingParams.action = 'upsert_data'
        # Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        # function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        charts_ins = Charts_Connection_Vault_RoutingParams(
            connection_id=connection_mapping.connection_mapping.get("hpcl_ceg", "1"),
            action='execute_query'
        )
        function = await charts_connection_vault_routing(charts_ins)
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
        await function(
            query=query
        )
        return

    async def update_indent_no(self, indent_no: str, loc_code: str):
        alert_data = await Alerts.get(self.params["alert_id"])

        if not isinstance(alert_data, dict):
            alert_data = alert_data.__dict__
        instance_id = alert_data.get("workflow_instance_id")
        CAMUNDA_URL = f"{urdhva_base.settings.camunda_url}/engine-rest"
        headers = {"Content-Type": "application/json"}
        url = f"{CAMUNDA_URL}/process-instance/{instance_id}/variables/indent_no"
        payload = {
            "indent_no": {"value": indent_no, "type": "String"},
            "terminal_plant_id": {"value": loc_code, "type": "String"},
        }
        payload = {"value": indent_no, "type": "String"}

        response = requests.put(url, json=payload, headers=headers)
        if response.status_code != 200:
            print("Error updating indent no", response.text)
        else:
            print("Indent no updated successfully")

        url = f"{CAMUNDA_URL}/process-instance/{instance_id}/variables/terminal_plant_id"
        payload = {"value": loc_code, "type": "String"}
        response = requests.put(url, json=payload, headers=headers)
        if response.status_code != 200:
            print("Error updating indent no", response.text)
        else:
            print("Indent no updated successfully")
        return True
