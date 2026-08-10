import urdhva_base
import pytz
import asyncio
import datetime
import polars as pl
import hpcl_ceg_model
import utilities.helpers as helpers
from dateutil.relativedelta import relativedelta
from hpcl_ceg_enum import AlertState as AlertState
from hpcl_ceg_enum import AlertStatus as AlertStatus
from hpcl_ceg_enum import IndentStatus as IndentStatus
import utilities.connection_mapping as connection_mapping
from charts_actions import charts_connection_vault_routing
from orchestrator.alerting.alert_manager import create_alert
from hpcl_ceg_enum import AlertActionType as AlertActionType
from alerts_actions import alerts_alert_action as alerts_alert_action
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams


class LpgRejections:
    def __init__(self):
        self.params = dict()
    
    async def get_required_variables(self):
        return ["alert_id", "interlock_name", "bu", "interlock_id", "sap_id"]

    async def get_current_cs_rejections(self):
        yesterday = (datetime.datetime.now(pytz.timezone("Asia/Kolkata")) - relativedelta(days=1)).strftime("%Y-%m-%d")
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        query = f""" SELECT 
                        SUM(cs_handled) AS total, SUM(cs_sortout) AS totalsortout, sap_id, location_name as plant, zone
                    FROM 
                        "lpg_plant_operations"
                    WHERE
                        DATE(process_date)='{yesterday}' GROUP BY sap_id, location_name, zone """
        rejections = await function(query=query)
        rejections = pl.DataFrame(rejections)
        rejections = rejections.with_columns(((pl.col("totalsortout")/pl.col("total"))*100).alias("rejection"))
        rejections = rejections.with_columns(pl.lit("cs_rejections").alias("rejection_type"))
        rejections = rejections.sort("rejection").with_columns(pl.col("rejection").fill_null(0).cast(pl.Float64).round(2).alias("rejection"))
        rejections = rejections.filter(pl.col("rejection") > 8)
        check_alerts = f""" SELECT 
                                sap_id, device_name, created_at
                            FROM
                                "alerts"
                            WHERE
                                "bu"= 'LPG' AND alert_status='Open' AND interlock_name ='Check Scale Rejection' """
        check_alerts = await function(query=check_alerts)
        check_alerts = pl.DataFrame(check_alerts)
        for data in rejections.iter_rows(named=True):
            self.params["sap_id"] = data["sap_id"]
            self.params["sapid"] = data["sap_id"]
            self.params["alert_type"] = 'LPG'
            self.params["alert_section"] = 'LPG'
            self.params["bu"] = 'LPG'
            self.params["BU"] = 'LPG'
            self.params["location_name"] = data["plant"]
            self.params["severity"] = "Critical"
            self.params["zone"] = data["zone"]
            self.params["device_name"] = str(data['rejection'])
            self.params["device_type"] = "Check Scale Rejection"
            self.params["interlock_name"] = "Check Scale Rejection"
            self.params["sop_id"] = "SOP077"
            self.params["violation_type"] = "Check Scale Rejection"
            self.params["message"] = f"Check Scale rejection is going above 8%. The current rejection rate is {str(data['rejection'])}"
            self.params["alert_history"] = [{"action_msg": self.params["message"],  "action_type": "Created"}]
            camunda_url = await helpers.get_camunda_url(bu=self.params["alert_type"], sap_id=self.params["sap_id"],
                                                        alert_section=self.params["alert_section"])
            await create_alert(self.params,camunda_url)


    async def get_current_gd_rejections(self):
        yesterday = (datetime.datetime.now(pytz.timezone("Asia/Kolkata")) - relativedelta(days=1)).strftime("%Y-%m-%d")
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        query = f""" SELECT 
                        SUM(gd_handled) AS total, SUM(gd_sortout) AS totalsortout, sap_id, location_name as plant, zone
                    FROM 
                        "lpg_plant_operations"
                    WHERE
                        DATE(process_date)='{yesterday}' GROUP BY sap_id, location_name, zone """
        rejections = await function(query=query)
        rejections = pl.DataFrame(rejections)
        rejections = rejections.with_columns(((pl.col("totalsortout")/pl.col("total"))*100).alias("rejection"))
        rejections = rejections.with_columns(pl.lit("gd_rejections").alias("rejection_type"))
        rejections = rejections.sort("rejection").with_columns(pl.col("rejection").fill_null(0).cast(pl.Float64).round(2).alias("rejection"))
        rejections = rejections.filter((pl.col("rejection") > 6) | (pl.col("rejection") < 1))
        check_alerts = f""" SELECT 
                                sap_id, device_name, created_at
                            FROM
                                "alerts"
                            WHERE
                                "bu"= 'LPG' AND alert_status='Open' AND interlock_name ='Valve Leak Rejection' """
        check_alerts = await function(query=check_alerts)
        check_alerts = pl.DataFrame(check_alerts)
        for data in rejections.iter_rows(named=True):
            self.params["sap_id"] = data["sap_id"]
            self.params["sapid"] = data["sap_id"]
            self.params["alert_type"] = 'LPG'
            self.params["alert_section"] = 'LPG'
            self.params["bu"] = 'LPG'
            self.params["BU"] = 'LPG'
            self.params["location_name"] = data["plant"]
            self.params["severity"] = "Critical"
            self.params["zone"] = data["zone"]
            self.params["device_name"] = str(data['rejection'])
            self.params["device_type"] = "Valve Leak Rejection"
            self.params["interlock_name"] = "Valve Leak Rejection"
            self.params["sop_id"] = "SOP078"
            self.params["violation_type"] = "Valve Leak Rejection"
            if float(data['rejection']) < 1:
                self.params["message"] = f"Valve Leak rejection is going below 1%. The current rejection rate is {str(data['rejection'])}"
            else:
                self.params["message"] = f"Valve Leak rejection is going above 6%. The current rejection rate is {str(data['rejection'])}"
            self.params["alert_history"] = [{"action_msg": self.params["message"], "action_type": "Created"}]
            camunda_url = await helpers.get_camunda_url(bu=self.params["alert_type"], sap_id=self.params["sap_id"],
                                                        alert_section=self.params["alert_section"])
            await create_alert(self.params,camunda_url)


    async def get_current_pt_rejections(self):
        yesterday = (datetime.datetime.now(pytz.timezone("Asia/Kolkata")) - relativedelta(days=1)).strftime("%Y-%m-%d")
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        query = f""" SELECT 
                        SUM(pt_handled) AS total, SUM(pt_sortout) AS totalsortout, sap_id, location_name as plant, zone
                    FROM 
                        "lpg_plant_operations"
                    WHERE
                        DATE(process_date)='{yesterday}' GROUP BY sap_id, location_name, zone """
        rejections = await function(query=query)
        rejections = pl.DataFrame(rejections)
        rejections = rejections.with_columns(((pl.col("totalsortout")/pl.col("total"))*100).alias("rejection"))
        rejections = rejections.with_columns(pl.lit("pt_rejections").alias("rejection_type"))
        rejections = rejections.sort("rejection").with_columns(pl.col("rejection").fill_null(0).cast(pl.Float64).round(2).alias("rejection"))
        rejections = rejections.filter((pl.col("rejection") < 6) | (pl.col("rejection") < 1))
        check_alerts = f""" SELECT
                                sap_id, device_name, created_at
                            FROM
                                "alerts"
                            WHERE
                                "bu"= 'LPG' AND alert_status='Open' AND interlock_name ='O-Ring Leak Rejection' """
        check_alerts = await function(query=check_alerts)
        check_alerts = pl.DataFrame(check_alerts)
        for data in rejections.iter_rows(named=True):
            self.params["sap_id"] = data["sap_id"]
            self.params["sapid"] = data["sap_id"]
            self.params["alert_type"] = 'LPG'
            self.params["alert_section"] = 'LPG'
            self.params["bu"] = 'LPG'
            self.params["BU"] = 'LPG'
            self.params["location_name"] = data["plant"]
            self.params["severity"] = "Critical"
            self.params["zone"] = data["zone"]
            self.params["device_name"] = str(data['rejection'])
            self.params["device_type"] = "O-Ring Leak Rejection"
            self.params["interlock_name"] = "O-Ring Leak Rejection"
            self.params["sop_id"] = "SOP079"
            self.params["violation_type"] = "O-Ring Leak Rejection"
            if float(data['rejection']) < 1:
                self.params["message"] = f"O-Ring Leak rejection is going below 1%. The current rejection rate is {str(data['rejection'])}"
            else:
                self.params["message"] = f"O-Ring Leak rejection is going below 6%. The current rejection rate is {str(data['rejection'])}"
            self.params["alert_history"] = [{"action_msg": self.params["message"], "action_type": "Created"}]
            camunda_url = await helpers.get_camunda_url(bu=self.params["alert_type"], sap_id=self.params["sap_id"],
                                                        alert_section=self.params["alert_section"])
            await create_alert(self.params,camunda_url)

    async def check_rejections(self, params):
        if not self.params:
            self.params = params
        rejection_type = params["interlock_name"]
        print(f"- Checking Rejection of {rejection_type} -")

        check_alerts = await hpcl_ceg_model.Alerts.get(self.params['alert_id'])
        if not isinstance(check_alerts, dict):
            check_alerts = check_alerts.__dict__
        check_alerts = pl.DataFrame([check_alerts])        
        Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
        
        previous_rejection = f""" SELECT * FROM alerts WHERE created_at>='{(datetime.datetime.now() - relativedelta(days=1)).strftime("%Y-%m-%d")}' and interlock_name='{params["interlock_name"]}' """
        previous_rejection = await function(query=previous_rejection)
        previous_rejection = pl.DataFrame(previous_rejection)
        
        if check_alerts['location_name'][-1] in previous_rejection["location_name"].unique().to_list():
            return True, {"rejection_status": "increased"}
        elif check_alerts['location_name'][-1] not in previous_rejection["location_name"].unique().to_list():
            return True, {"rejection_status": "decreased"}
                
        
if __name__ == "__main__":
    lpg = LpgRejections()
    asyncio.run(lpg.get_current_cs_rejections())
    asyncio.run(lpg.get_current_gd_rejections())
    asyncio.run(lpg.get_current_pt_rejections())