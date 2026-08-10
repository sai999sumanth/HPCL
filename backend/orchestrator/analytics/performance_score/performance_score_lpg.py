import os
import json
import pandas as pd
import hpcl_ceg_model
from datetime import datetime
from collections import defaultdict
from utilities.helpers import map_device_category
import orchestrator.analytics.va_analysis as va_analysis
from orchestrator.dbconnector.widget_actions import widget_actions
import orchestrator.analytics.performance_score.performance_score_factory as performance_score_factory
from orchestrator.analytics.performance_score.performance_score_insights import (
    enhance_result_with_insights,
    generate_summary_insights
)


class LPGPerformanceScore(performance_score_factory.PerformanceIndex):
    def __init__(self):
        super().__init__()
        self.bu = "LPG"
        self.config = None  # Initialize as None
        self.va_data = {}

    async def initialize(self):
        """Async method to load performance index rules for LPG."""
        file_path = f"{os.path.dirname(performance_score_factory.__file__)}/pi_masters/lpg_performance_rules.json"
        with open(file_path) as f:
            self.config = json.load(f)

    async def configure_va(self, va_data):
        self.va_data = va_data

    async def generate_performance_index(self, location_id=None):
        module_scores = {}
        total_weight = sum(module["weightage"] for module in self.config.values())
        for module_name, module in self.config.items():
            mod = getattr(self, f'_compute_{module_name.lower()}_pi_score')
            module_score = await mod(module_name, module, location_id)
            module_scores[module_name] = module_score
        return module_scores, total_weight

    async def _compute_pq_pi_score(self, name, rules, location_id):
        """
        Compute PI score for PQ based Alerts & Percentage Rejections.
        """
        pi_score = []

        interlocks = list(set([rule['interlock_name'] for rule in rules['rules']]))
        in_clause_raw = ", ".join(f"'{value}'" for value in interlocks)
        query = (
            f"SELECT interlock_name, device_name, count(device_name) as alert_count "
            f"FROM alerts "
            f"WHERE interlock_name IN ({in_clause_raw}) "
            f"AND sap_id = '{location_id}' "
            f"AND alert_status != 'Close' "
            f"AND alert_section = 'LPG' "
            f"AND bu = 'LPG' "
            f"AND created_at::DATE >= '2025-09-01' "
            f"GROUP BY interlock_name, device_name"
        )
        data = await hpcl_ceg_model.Alerts.get_aggr_data(query)
        open_alerts = {rec['interlock_name']: rec['device_name'] for rec in data['data']}
        alert_count = defaultdict(int)
        for x in data['data']:
            alert_count[f"{x['interlock_name']}_count"] += x['alert_count']
        alert_count = dict(alert_count)
        rejection_query = (
            f"SELECT "
            f"ROUND((SUM(cs_sortout) / NULLIF(SUM(cs_handled), 0)) * 100, 2) AS cs_rejection, "
            f"ROUND((SUM(gd_sortout) / NULLIF(SUM(gd_handled), 0)) * 100, 2) AS gd_rejection, "
            f"ROUND((SUM(pt_sortout) / NULLIF(SUM(pt_handled), 0)) * 100, 2) AS pt_rejection "
            f"FROM lpg_plant_operations "
            f"WHERE sap_id = '{location_id}' and process_date::DATE = CURRENT_DATE - INTERVAL '1 day'"
        )
        rej_data = await hpcl_ceg_model.LpgPlantOperations.get_aggr_data(rejection_query)
        rejection_values = rej_data["data"][0] if rej_data["data"] else {}
        msg = ""
        for rule in rules["rules"]:
            rule_weightage = rule["weightage"]
            score = 0

            # Open Alerts
            if rule["model"] == "open_alerts":
                if rule["interlock_name"] in open_alerts:
                    score = 0
                    interlock_name_count = f"{rule['interlock_name']}_count"
                    count_value = alert_count.get(interlock_name_count, 0)
                    verb = "is" if count_value == 1 else "are"
                    verb_alert = "alert" if count_value == 1 else "alerts"
                    msg = f"There {verb} {count_value} open {verb_alert} for {rule['interlock_name']}"
                else:
                    score = 100
                    system_name = rule.get('name', rule['interlock_name'])
                    msg = f"No open alerts. {system_name} system operating normally."

            # Percentage Rejection
            elif rule["model"] == "percentage_rejection":
                # mapping interlock to correct column in lpg_plant_operations
                if "Check Scale" in rule["interlock_name"]:
                    value_rejection = rejection_values.get("cs_rejection", 0) or 0
                elif "Valve Leak" in rule["interlock_name"]:
                    value_rejection = rejection_values.get("gd_rejection", 0) or 0
                elif "O-Ring" in rule["interlock_name"]:
                    value_rejection = rejection_values.get("pt_rejection", 0) or 0
                else:
                    value_rejection = 0

                if value_rejection is None:
                    value_rejection = 0
                if rule["interlock_name"] == "O-Ring Leak Rejection":
                    if value_rejection == 0:
                        extra_score = 0
                        msg_extra = f"{rule['interlock_name']} rejection is 0. Score = 0"
                    elif value_rejection >= 6:
                        extra_score = rule_weightage
                        msg_extra = f"{rule['interlock_name']} rejection >= 6. Full score = {extra_score}"
                    else:
                        min_val = 0
                        max_val = 6
                        extra_score = float(rule_weightage) if value_rejection > 5.99 else (float(value_rejection) / 6) * float(rule_weightage)
                        msg_extra = f"{rule['interlock_name']} is {value_rejection}; Formula: ({value_rejection} / 6) * {rule_weightage} = {extra_score}"
                else:
                    extra_score = 0
                    msg_extra = ""
                # Apply thresholds
                score = 0
                for percentage_rule in rule.get("rules", []):
                    min_val = float(percentage_rule["min"])
                    max_val = float(percentage_rule["max"])
                    base = rule_weightage  # base = weightage

                    if value_rejection < min_val:
                        score = base  # full score
                        system_name = rule.get('name', rule['interlock_name'])
                        msg = f"No open alerts. {system_name} system operating normally."
                        break
                    elif value_rejection > max_val:
                        score = 0
                        msg = f"{rule['interlock_name']} is more than {max_val}. Current rejection is {value_rejection}"
                        continue
                    else:
                        score = ((float(max_val) - float(value_rejection)) / (float(max_val) - float(min_val))) * float(base)
                        msg = f"Current rejection rate is {float(value_rejection)}, Calculation : (({float(max_val)} - {float(value_rejection)}) / ({float(max_val)} - {float(min_val)})) * {float(base)}"
                        break
                if rule["interlock_name"] == "O-Ring Leak Rejection":
                    score = extra_score
                    if msg_extra:
                        msg = msg_extra 

                # Convert to percentage of rule weightage
                score = (score / base) * 100 if base > 0 else 0

            # Weightage scaling
            score = (score * rule_weightage) / 100

            result_item = {
                "name": rule["name"],
                "score": round(score, 2),
                "weightage": rule_weightage,
                "module": rules.get("name", name),
                "msg": msg,
                "details": {
                    "current_value": float(value_rejection) if rule["model"] == "percentage_rejection" else None,
                    "threshold_min": min_val if rule["model"] == "percentage_rejection" else None,
                    "threshold_max": max_val if rule["model"] == "percentage_rejection" else None,
                    "alert_count": alert_count.get(f"{rule['interlock_name']}_count", 0) if rule["model"] == "open_alerts" else None
                }
            }
            
            # Enhance with insights
            module_type = rule["model"]
            result_item = enhance_result_with_insights(result_item, module_type)
            pi_score.append(result_item)

        # Final PI Score
        print("-"*20)
        print("pi_score :", pi_score)
        print("-"*20)
        alert_score = sum(
            s["score"] for s in pi_score
            if "alert" in s["name"].lower()  
        )

        rej_score = sum(
            s["score"] for s in pi_score
            if "alert" not in s["name"].lower()  
        )

        # alert_score = round((alert_score * 10) / 100, 2)
        # rej_score = round((rej_score * 90) / 100, 2)

        final_score = alert_score + rej_score
        final_score = round((final_score * rules["weightage"]) / 100, 2)

        module_result = {
            "name": rules.get("name", name),
            "score": final_score,
            "weightage": rules["weightage"],
            "results": pi_score
        }
        
        # Add module-level summary insights
        module_result["insights"] = generate_summary_insights(module_result)
        
        return module_result

    async def _compute_va_pi_score(self, name, rules, location_id):
        pi_score = []
        msg = ""
        for rule in rules['rules']:
            score = 0
            if rule['model'] == 'va_portal':
                if self.va_data:
                    va_overall_score = float(self.va_data.get('OVERALL_SCORE', 0))
                    score = round((va_overall_score * 10 * rule['weightage']) / 100, 2)
                    if abs(score - rule['weightage']) < 0.01:  # Full score achieved
                        msg = f"No open alerts. VA Portal system operating normally."
                    elif va_overall_score == 0:
                        msg = f"VA Portal overall score is 0, resulting in 0 points out of {rule['weightage']}. Review VA Portal metrics to improve score."
                    else:
                        msg = f"VA Portal overall score: {va_overall_score} (calculated as {va_overall_score} * 10 * {rule['weightage']} / 100 = {score} points)"
                else:
                    score = 0
                    msg = "VA Portal data not available, score set to 0"
            elif rule['model'] == 'va_alerts':
                severity = list(set([rule_['interlock_name'] for rule_ in rule['rules']]))
                in_clause_raw = ", ".join(f"'{value}'" for value in severity)
                # For all open alerts
                query_open = (
                    f"select severity, count(device_name) as count from alerts where severity in ({in_clause_raw}) and "
                    f"sap_id = '{location_id}' and alert_status != 'Close' and alert_section = 'VA' and "
                    f"bu = 'LPG' and created_at::DATE >= '2025-09-01' and created_at >= NOW() - INTERVAL '30 days ' group by severity")
                data = await hpcl_ceg_model.Alerts.get_aggr_data(query_open)
                open_alerts = {data['severity']: data['count'] for data in data['data']}

                # For all closure alerts in last 24 hours
                query_close = (
                    f"select severity, count(device_name) as count from alerts where severity in ({in_clause_raw}) and "
                    f"sap_id = '{location_id}' and alert_status = 'Close' and alert_section = 'VA' and "
                    f"bu = 'LPG'and created_at::DATE >= '2025-09-01' and updated_at >= NOW() - INTERVAL '24 hours' group by severity")
                data = await hpcl_ceg_model.Alerts.get_aggr_data(query_close)
                close_alerts = {data['severity']: data['count'] for data in data['data']}
                alert_score = []

                for rule_ in rule['rules']:
                    int_name = rule_['interlock_name']
                    if not open_alerts and not close_alerts:
                        alert_score.append(rule_['weightage'])
                        print("alert_score:",alert_score)
                    elif int_name in open_alerts or int_name in close_alerts:
                        close_percentage = rule_['weightage'] * (close_alerts.get(int_name, 0) /
                                                                 (close_alerts.get(int_name, 0) +
                                                                  open_alerts.get(int_name, 0)))
                        alert_score.append(close_percentage)
                    else:
                        alert_score.append(rule_['weightage'])
                print(alert_score, rule['weightage'])
                total_alerts = sum(open_alerts.values()) + sum(close_alerts.values())
                closed_alerts = sum(close_alerts.values())
                if all(s == 0 for s in alert_score):
                    # If perfect compliance is achieved, force the module score to 100.0
                    score = rule['weightage']
                else:
                    score = round((sum(alert_score) * rule['weightage']) / 100, 2)
                
                if abs(score - rule['weightage']) < 0.01:  # Full score achieved
                    msg = f"No open alerts. VA Alert Severity system operating normally."
                else:
                    msg = f"Total alerts: {total_alerts}. closed_alerts :{closed_alerts} .Calculation: ({round(sum(alert_score), 2)}) * ({rule['weightage']}) / 100"
            else:
                ...
            result_item = {
                "name": rule['name'], 
                "score": score, 
                "weightage": rule['weightage'],
                'module': rules.get('name', name),
                "msg": msg,
                "details": {
                    "va_portal_score": self.va_data.get('OVERALL_SCORE') if rule['model'] == 'va_portal' and self.va_data else None,
                    "total_alerts": total_alerts if rule['model'] == 'va_alerts' else None,
                    "closed_alerts": closed_alerts if rule['model'] == 'va_alerts' else None
                }
            }
            
            # Enhance with insights
            module_type = rule['model']
            result_item = enhance_result_with_insights(result_item, module_type)
            pi_score.append(result_item)
        # final_score = sum([score['score'] for score in pi_score])
        
        print("-"*20)
        print("pi_score :", pi_score)
        print("-"*20)
        alert_score = sum(
            s["score"] for s in pi_score
            if "alert" in s["name"].lower()
        )

        va_portal_score = sum(
            s["score"] for s in pi_score
            if "alert" not in s["name"].lower()  
        )

        # alert_score = round((alert_score * 10) / 100, 2)
        # va_portal_score = round((va_portal_score * 90) / 100, 2)

        final_score = alert_score + va_portal_score
        final_score = round((final_score * rules['weightage']) / 100, 2)
        for rec in pi_score:
            rec['score'] = round(rec['score'], 2)
        
        module_result = {"name": rules.get('name', name), "score": final_score, "weightage": rules['weightage'], "results": pi_score}
        
        # Add module-level summary insights
        module_result["insights"] = generate_summary_insights(module_result)
        
        return module_result

    async def _compute_vts_pi_score(self, name, rules, location_id):
        pi_score = []
        total_vehicles = 190
        msg = ""
        for rule in rules['rules']:
            alert_score = []
            if rule['model'] == 'vts_interlock':
                continue
                search_values = [rec['search_value'] for rec in rule['rules']]
                query_clause = " or ".join([f"interlock_name like '%{value}%'" for value in search_values])
                query = (f"select interlock_name, count(vehicle_number) as count from alerts where "
                         f"sap_id = '{location_id}' and ({query_clause}) and bu='LPG' and alert_section='VTS' and "
                         f"alert_status != 'Close'and  created_at::DATE >= '2025-09-01' group by interlock_name")
                data = await hpcl_ceg_model.VTS.get_aggr_data(query)
                alert_data = {}
                for record in data['data']:
                    for rule_ in rule['rules']:
                        if rule_['search_value'] in record['interlock_name']:
                            if rule_['search_value'] not in alert_data:
                                alert_data[rule_['search_value']] = 0
                            alert_data[rule_['search_value']] += record['count']
                # Todo:- Need to calculate total no of vehicles

                for rule_ in rule['rules']:
                    if rule_['search_value'] in alert_data:
                        score = ((total_vehicles - alert_data[rule_['search_value']]) / total_vehicles)
                        score = round(score * (rule_['weightage'] / 100), 2)
                        msg = f"(({total_vehicles} - {alert_data[rule_['search_value']]}) / {total_vehicles})"
                        alert_score.append(score)
                    else:
                        msg = "Provided full score"
                        alert_score.append(rule_['weightage'])
            # Generating score by comparing number of active vehicles with no of open alerts
            elif rule['model'] == 'vts_active_vehicles':
                continue
                query = (f"select DISTINCT(vehicle_number), count(vehicle_number) as count from alerts "
                         f"where sap_id = '{location_id}' and alert_status != 'Close' and "
                         f"bu='LPG' and alert_section='VTS' and  created_at::DATE >= '2025-09-01' group by vehicle_number")
                data = await hpcl_ceg_model.VTS.get_aggr_data(query)
                alert_data = {}
                for record in data['data']:
                    for rule_ in rule.get('rules', []):
                        if rule_['search_value'] in record['interlock_name']:
                            if rule_['search_value'] not in alert_data:
                                alert_data[rule_['search_value']] = 0
                            alert_data[rule_['search_value']] += record['count']
                if rule['weightage'] == 0:
                    msg = "Not applicable for Bulk"
                else:
                    msg = f"Total active vehicles found: {len(data['data'])}"

            # Generating PI score base don total open and total close alerts
            elif rule['model'] == 'vts_alerts':
                severity = list(set([rule_['interlock_name'] for rule_ in rule['rules']]))
                in_clause_raw = ", ".join(f"'{value}'" for value in severity)
                # For all open alerts
                query_open = (
                    f"select severity, count(device_name) as count from alerts where severity in ({in_clause_raw}) and "
                    f"sap_id = '{location_id}' and alert_status != 'Close' and alert_section = 'VTS' and "
                    f"bu = 'LPG' and  created_at::DATE >= '2025-09-01' group by severity")
                data = await hpcl_ceg_model.Alerts.get_aggr_data(query_open)
                open_alerts = {}
                close_alerts = {}
                total_open = 0
                total_closed = 0
                
                if not data.get("data", None):
                    msg = f"No open alerts. VTS Alerts system operating normally."
                    alert_score.append(rule['weightage'])
                else:
                    open_alerts = {data['severity']: data['count'] for data in data['data']}
                    total_open = sum(open_alerts.values())

                    # For all closure alerts in last 24 hours
                    query_close = (
                        f"select severity, count(device_name) as count from alerts where severity in ({in_clause_raw}) and "
                        f"sap_id = '{location_id}' and alert_status = 'Close' and alert_section = 'VTS' and "
                        f"bu = 'LPG' and  created_at::DATE >= '2025-09-01' and updated_at >= NOW() - INTERVAL '24 hours' group by severity")
                    data = await hpcl_ceg_model.Alerts.get_aggr_data(query_close)
                    if data.get("data"):
                        close_alerts = {data['severity']: data['count'] for data in data['data']}
                        total_closed = sum(close_alerts.values())

                    for rule_ in rule['rules']:
                        int_name = rule_['interlock_name']
                        if int_name in open_alerts or int_name in close_alerts:
                            open_count = open_alerts.get(int_name, 0)
                            closed_count = close_alerts.get(int_name, 0)
                            total_for_severity = open_count + closed_count
                            close_percentage = rule_['weightage'] * (closed_count / total_for_severity) if total_for_severity > 0 else 0
                            alert_score.append(close_percentage)
                        else:   
                            alert_score.append(0)
                    
                    # Generate appropriate message based on score
                    score_sum = sum(alert_score)
                    final_score = round((score_sum * rule['weightage']) / 100, 2)
                    if abs(final_score - rule['weightage']) < 0.01:  # Full score achieved
                        msg = f"No open alerts. VTS Alerts system operating normally."
                    elif final_score == 0:
                        msg = f"VTS Alerts: {total_open} open alerts with low closure rate, resulting in 0 points out of {rule['weightage']}. Focus on closing open alerts promptly."
                    else:
                        closure_rate = round((total_closed / (total_open + total_closed) * 100), 2) if (total_open + total_closed) > 0 else 0
                        msg = f"VTS Alerts: {total_open} open alerts, {total_closed} closed in last 24 hours (closure rate: {closure_rate}%). Score: {round(final_score, 2)} out of {rule['weightage']}"
                    print(alert_score, rules['weightage'])
            else:
                final_score = round((sum(alert_score) * rule['weightage']) / 100, 2) if alert_score else 0
            
            score = final_score if 'final_score' in locals() else round((sum(alert_score) * rule['weightage']) / 100, 2)            
            pi_score.append({"name": rule['name'], 
                             "score": score, 
                             "weightage": rule['weightage'],
                             'module': rules.get('name', name),
                             "msg": msg
                             })
        # final_score = sum([score['score'] for score in pi_score])
        # final_score = round((final_score * rules['weightage']) / 100, 2)
        final_score = rules['weightage']
        for rec in pi_score:
            rec['score'] = round(rec['score'], 2)
        return {"name": rules.get('name', name), "score": final_score, "weightage": rules['weightage'], "results": pi_score}

    async def _compute_production_pi_score(self, name, rules, location_id):
        score = 0
        query_week_sale = f""" SELECT
                                DATE(process_date) AS date,
                                ROUND(SUM(total_production)::NUMERIC, 2) AS avg_production
                            FROM lpg_plant_operations
                            WHERE process_date::DATE >= CURRENT_DATE - INTERVAL '8 days' and process_date::DATE < CURRENT_DATE - INTERVAL '1 day'
                            and sap_id = '{location_id}' GROUP BY DATE(process_date) ORDER BY date desc """

        resp = await hpcl_ceg_model.Alerts.get_aggr_data(query_week_sale)
        production_data = [float(rec['avg_production']) for rec in resp['data'] if rec['avg_production']]
        production_avg = round(float(sum(production_data) / len(production_data) if production_data else 0), 2)

        query_yesterday_sale = f"""SELECT ROUND(SUM(total_production)::NUMERIC, 2)
        as production_yesterday FROM lpg_plant_operations WHERE process_date::DATE = CURRENT_DATE - INTERVAL '1 day'
        and sap_id = '{location_id}' """


        production = await hpcl_ceg_model.Alerts.get_aggr_data(query_yesterday_sale)
        production_yesterday = float(production['data'][0]['production_yesterday'] if
                                     production['data'] and production['data'][0].get('production_yesterday') else 0)
        if production_yesterday < production_avg:
            score = (((production_yesterday / production_avg) * 100) * rules['weightage']) / 100
        else:
            score = rules['weightage']
        if production_yesterday < production_avg:
            msg = f"Yesterday's Production ({production_yesterday}) is less than Last Week Avg Production ({production_avg})"
        elif production_yesterday > production_avg:
            msg = f"Yesterday's Production ({production_yesterday}) is greater than Last Week Avg Production ({production_avg})"
        else:
            msg = f"Yesterday's Production ({production_yesterday}) is equal to Last Week Avg Production ({production_avg})"
        return {"name": rules.get('name', name), "score": round(score, 2), "weightage": rules['weightage'],
                "results": [{"name": rules['name'], "score": round(score, 2), "weightage": rules['weightage'],
                             'module': rules['name'], "msg": msg}]}

    async def _compute_productivity_pi_score(self, name, rules, location_id):
        query = f"""
            SELECT
                o.filling_head AS filling_heads,
                o.carousel,
                COALESCE(SUM(o.total_production), 0) AS total_production,
                COALESCE(
                    ROUND(
                        SUM(o.total_production) /
                        NULLIF(SUM(o.net_bottling_hours), 0),
                        2
                    ),
                    0
                ) AS productivity_yesterday,
                c.min_productivity,
                c.max_productivity
            FROM lpg_plant_operations o
            LEFT JOIN lpg_carousals c
                ON o.sap_id::int = c.sap_id
                AND o.carousel::int = c.carousal_id
            WHERE
                o.process_date::DATE = CURRENT_DATE - INTERVAL '1 day'
                AND o.sap_id = '{location_id}'
            GROUP BY
                o.filling_head,
                o.carousel,
                c.min_productivity,
                c.max_productivity
        """
        resp = await hpcl_ceg_model.Alerts.get_aggr_data(query)
        # productivity = {rec['filling_heads']: float(rec['productivity_yesterday']) for rec in resp['data']}
        productivity = {}
        zero_carousels = []
        for rec in resp['data']:
            head = rec['filling_heads']
            car = rec['carousel']
            production = float(rec.get("total_production") or 0)
            val = float(rec['productivity_yesterday'])
            # only consider if production / productivity > 0
            if production <= 0 or val <= 0:
                zero_carousels.append(str(car))
                continue
            productivity.setdefault(head, {})[car] = {
                "value": val,
                "min": float(rec.get("min_productivity") or 0),
                "max": float(rec.get("max_productivity") or 0)
            }
        zero_msg = f" Carousel {', '.join(zero_carousels)} production is 0." if zero_carousels else ""
        pi_score = []
        msg = ""
        for rule in rules['rules']:
            head = rule['search_value']
            if head not in productivity:
                continue

            # weightage = float(rule['weightage'])
            weightage = float(rule.get('weightage', 100))
            # subrules = rule['rules']
            num_carousels = len(productivity[head])
            per_carousel_weightage = float(rule['weightage']) / num_carousels

            # for carousel, val in productivity[head].items():
            for carousel, data in productivity[head].items():
                val = data["value"]
                min_val = data["min"]
                max_val = data["max"]
                score = 0.0
                msg = ""
                if min_val == 0 or max_val == 0:
                    print(f"Skipping carousel {carousel} because min/max not configured")
                    continue

                if val < min_val:
                    score = 0
                    msg = f"Productivity of {head} Carousel {carousel} is {val} which is less than {min_val}.{zero_msg}"
                elif val > max_val:
                    score = 100
                    msg = f"Productivity of {head} Carousel {carousel} is {val} which is more than {max_val}.{zero_msg}"
                else:
                    score = 100 - (((max_val - val) / (max_val - min_val)) * 100)
                    msg = (
                            f"Productivity of {head} Carousel {carousel} is {val}. "
                            f"Calculation : 100 - ((max_value: {max_val} - productivity: {val}) / "
                            f"(max_value: {max_val} - min_value: {min_val}) * 100).{zero_msg}"
                        )

                score = max(0, min(100, score))
                pi_score.append(
                    {
                        "name": f"{rule['name']} - Carousel {carousel}",
                        "score": round(score, 2),
                        "weightage": per_carousel_weightage,
                        "module": rules.get(
                            "name",
                            "Productivity"
                        ),
                        "msg": msg,
                    })

        if pi_score:
            total_weight = sum(s["weightage"] for s in pi_score)
            weighted_sum = sum(s["score"] * s["weightage"] for s in pi_score)
            avg_score = weighted_sum / total_weight
            final_score = round(avg_score * (rules["weightage"] / 100),2)
        else:
            final_score = 0
        
        print("pi_score->", pi_score)
        return {
            "name": rules.get("name", "Productivity"),
            "score": final_score,
            "weightage": rules["weightage"],
            "results": pi_score,
        }


    async def _compute_break_down_pi_score(self, name, rules, location_id):
        # file_path = f"{os.path.dirname(performance_score_factory.__file__)}/pi_masters/lpg_working_hours.xlsx"
        # df_working_hours = pd.read_excel(file_path).fillna(0)
        # df_working_hours['PlantID'] = df_working_hours['PlantID'].astype(str)
        working_hours_query = f""" SELECT carousal_id, production_hrs, breaks FROM lpg_carousals WHERE sap_id = '{location_id}'  """
        resp = await hpcl_ceg_model.Alerts.get_aggr_data(working_hours_query)

        fmt = "%H:%M:%S"
        working_hours = {}
        for rec in resp["data"]:
            shift_hours = sum(
                ((datetime.strptime(s["stop_time"], fmt) - datetime.strptime(s["start_time"], fmt)).total_seconds() % 86400) / 3600
                for s in (rec["production_hrs"] or []))

            break_hours = sum(
                ((datetime.strptime(b["stop_time"], fmt) - datetime.strptime(b["start_time"], fmt)).total_seconds() % 86400) / 3600
                for b in (rec["breaks"] or []))

            working_hours[int(rec["carousal_id"])] = shift_hours - break_hours

        distinct_carousels_query = f"""
        SELECT
            DISTINCT carousel, filling_head as filling_heads FROM lpg_plant_operations
        WHERE process_date::DATE = CURRENT_DATE - INTERVAL '1 day' and sap_id='{location_id}'
        group by carousel, filling_head
        """

        resp = await hpcl_ceg_model.Alerts.get_aggr_data(distinct_carousels_query)
        distinct_carousels = {rec['carousel']: rec['filling_heads'] for rec in resp['data']}

        query = f"""
        SELECT
            DISTINCT carousel, filling_head as filling_heads, SUM(lpg_breakdown) as lpg_breakdown
        FROM lpg_plant_operations WHERE process_date::DATE = CURRENT_DATE - INTERVAL '1 day' and
        sap_id='{location_id}' group by carousel, filling_heads
        """

        resp = await hpcl_ceg_model.Alerts.get_aggr_data(query)
        break_down = {}
        for rec in resp['data']:
            rec['carousel'] = int(rec['carousel'])
            if rec['carousel'] not in break_down:
                break_down[rec['carousel']] = []
            break_down[rec['carousel']].append(rec['lpg_breakdown'])
        # Todo:- need to fetch no of carousels and what was the max run time
        break_down = {key: max(value) for key, value in break_down.items()}
        carousel_msg = []  
        total_hours = 0
        for carousel in distinct_carousels:
            hours = float(working_hours.get(int(carousel), 0) or 0)
            total_hours += hours
            carousel_msg.append(f"Carousel {carousel}: {hours}")
        if not total_hours:
            total_hours = 16
        uptime = 100 - (float(float((sum([value for _, value in break_down.items()]))) / float(total_hours)) * 100)
        # return {"name": rules.get('name', name), "score": round((uptime * rules['weightage']) / 100, 2),
        #         "weightage": rules['weightage'], "results": []}
        final_score = round((uptime * rules['weightage']) / 100, 2)

        msg = (
            f"Carousel Hours → {', '.join(carousel_msg)} | "
            f"Total Breakdown = {round(sum(break_down.values()), 2)} | "
            f"Uptime = 100 - (({round(sum(break_down.values()),2)} / {total_hours}) * 100) = {round(uptime,2)}%"
        )

        results = [{
            "name": "Uptime Calculation",
            "score": round(uptime, 2),
            "module": rules.get("name", name),
            "weightage": rules["weightage"],
            "msg": msg
        }]

        return {
            "name": rules.get('name', name),
            "score": final_score,
            "weightage": rules['weightage'],
            "results": results
        }
