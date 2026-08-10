import pandas as pd
from charts_actions import charts_connection_vault_routing
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams
import urdhva_base
from utilities import connection_mapping
import utilities.helpers as helpers
import hpcl_ceg_model


async def get_alert_data(alert_section):
    # Making sure alerts considering only after May 31st in prod
    date = urdhva_base.utilities.get_present_time()
    date_yes = helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                               date_time_format=None)
    month_start = helpers.get_time_stamp_by_delta(date_yes, days=0, with_month_start_day=True,
                                               date_time_format="%Y-%m-%d")
    date_filter = (
        f"(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE >= '{month_start}' "
        f"AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE <= '{date_yes.strftime('%Y-%m-%d')}' "
     ) # As per HPCL request changed the date to be in the present month
    query = f"""SELECT count(alert_section), bu, alert_section, severity FROM alerts where alert_status='Open' and 
    alert_section='{alert_section}' and {date_filter} GROUP BY bu, alert_section, severity"""
    if alert_section in ["VTS"]:
        query = f"""SELECT count(alert_section), bu, alert_section, severity FROM alerts where vehicle_unblocked_date is null and 
                    alert_section='{alert_section}' and {date_filter} GROUP BY bu, alert_section, severity"""
    alerts = await hpcl_ceg_model.Alerts.get_aggr_data(query)
    
    # total open alerts 
    total_open_alerts_query = f"""SELECT count(alert_status), bu, alert_section FROM alerts where alert_status='Open' and 
    alert_section='{alert_section}' and {date_filter} GROUP BY bu, alert_section"""
    if alert_section in ["VTS"]:
        total_open_alerts_query = f"""SELECT count(alert_status), bu, alert_section FROM alerts where vehicle_unblocked_date is null and 
                    alert_section='{alert_section}' and {date_filter} GROUP BY bu, alert_section"""
    total_open_alerts = await hpcl_ceg_model.Alerts.get_aggr_data(total_open_alerts_query)

    # total No of open alerts finacial year to date;
    fy_open_alerts_query = f"""
                    SELECT count(alert_status) as fy_total, alert_section, bu
                    FROM alerts
                    WHERE alert_status = 'Open'
                    AND alert_section = '{alert_section}'
                    AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE <= '{date_yes.strftime('%Y-%m-%d')}'
                    GROUP BY alert_section, bu
                """
    
    if alert_section in ["VTS"]:
        fy_open_alerts_query = f"""
                    SELECT count(alert_status) as fy_total, alert_section, bu
                    FROM alerts
                    WHERE vehicle_unblocked_date is null
                    AND alert_section = '{alert_section}'
                    AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE <= '{date_yes.strftime('%Y-%m-%d')}'
                    GROUP BY alert_section, bu
                """
    fy_open_alerts = await hpcl_ceg_model.Alerts.get_aggr_data(fy_open_alerts_query)


    data = {}
    for alert in alerts['data']:
        if alert["severity"] == "Critical":
            data.update({f"{alert_section.lower()}_critical_{alert['bu'].lower()}": alert["count"]})
        if alert["severity"] == "High":
            data.update({f"{alert_section.lower()}_high_{alert['bu'].lower()}": alert["count"]})
    
    for row in total_open_alerts['data']:
        data.update({f"{alert_section.lower()}_total_{row['bu'].lower()}": row["count"]})

    for row in fy_open_alerts['data']:
        data.update({f"{alert_section.lower()}_total_fy_{row['bu'].lower()}": row["fy_total"]})

    for severity in ["critical", "high", "total", "total_fy"]:
        for bu in ["lpg", "ro", "tas"]:
            if f"{alert_section.lower()}_{severity}_{bu}" not in data.keys():
                data.update({f"{alert_section.lower()}_{severity}_{bu}": 0})
    return data


async def get_vts_route_deviation():
    date = urdhva_base.utilities.get_present_time()
    date_yes = helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                               date_time_format=None)
    month_start = helpers.get_time_stamp_by_delta(date_yes, days=0, with_month_start_day=True,
                                               date_time_format="%Y-%m-%d")
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    date_filter = f"a.created_at::DATE <= '{date_yes.strftime('%Y-%m-%d')}'"
    tas_query = f"""SELECT 
                    COALESCE(lm.name, a.location_name) AS "Terminal Name",
                    a.sap_id AS "Terminal Id",
                    COALESCE(lm.zone, a.zone) AS "Zone",
                    COUNT(*) AS "Open Alerts"
                FROM alerts a
                LEFT JOIN location_master lm 
                    ON a.sap_id = lm.sap_id
                WHERE a.alert_status = 'Open'
                AND a.alert_section = 'VTS'
                AND a.violation_type = 'route_deviation_count'
                AND a.bu = 'TAS' AND {date_filter}
                AND COALESCE(lm.name, a.location_name) IS NOT NULL
                AND COALESCE(lm.name, a.location_name) <> ''
                GROUP BY COALESCE(lm.name, a.location_name), a.sap_id, COALESCE(lm.zone, a.zone)
                ORDER BY "Zone", "Terminal Name"
                """
    
    lpg_query = f"""SELECT 
                    COALESCE(lm.name, a.location_name) AS "Plant Name",
                    a.sap_id AS "Plant Id",
                    COALESCE(lm.zone, a.zone) AS "Zone",
                    COUNT(*) AS "Open Alerts"
                FROM alerts a
                LEFT JOIN location_master lm 
                    ON a.sap_id = lm.sap_id
                WHERE a.alert_status = 'Open'
                AND a.violation_type = 'route_deviation_count'
                AND a.alert_section = 'VTS'
                AND a.bu = 'LPG' AND {date_filter}
                AND COALESCE(lm.name, a.location_name) IS NOT NULL
                AND COALESCE(lm.name, a.location_name) <> ''
                GROUP BY COALESCE(lm.name, a.location_name), a.sap_id, COALESCE(lm.zone, a.zone)
                ORDER BY "Zone", "Plant Name"
            """
    tas_alerts = await function(query=tas_query)
    lpg_alerts = await function(query=lpg_query)

    tas_alerts = pd.DataFrame(tas_alerts)
    lpg_alerts = pd.DataFrame(lpg_alerts)
    return {"lpg_vts_data": lpg_alerts, "tas_vts_data": tas_alerts}