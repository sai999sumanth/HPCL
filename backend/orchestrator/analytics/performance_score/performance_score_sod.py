import urdhva_base
import os
import json
import datetime
import traceback
import pandas as pd
import hpcl_ceg_model
from collections import defaultdict
import orchestrator.analytics.va_analysis as va_analysis
from orchestrator.dbconnector.widget_actions import widget_actions
import \
    orchestrator.analytics.performance_score.performance_score_factory as performance_score_factory
from utilities.helpers import map_device_category, fetch_oi_devices, fetch_device_data, \
    fetch_alarm_data
from orchestrator.analytics.performance_score.performance_score_insights import (
    enhance_result_with_insights,
    generate_summary_insights
)


class SODPerformanceScore(performance_score_factory.PerformanceIndex):
    def __init__(self):
        """
        Initialize an instance of the SODPerformanceScore class.

        This method initializes an instance of the SODPerformanceScore class. It
        sets the business unit to "TAS", initializes the `config` instance
        variable to `None`, and the `va_data` instance variable to an empty
        dictionary.

        Parameters:
            None

        Returns:
            None
        """
        super().__init__()
        self.bu = "TAS"
        self.config = None  # Initialize as None
        self.va_data = {}

    async def initialize(self):
        """
        Asynchronously load performance index rules for SOD.

        This method loads the performance index rules from
        `sod_performance_rules.json` file located in the
        `pi_masters` directory of the `performance_score_factory`
        module. The rules are loaded into the instance variable
        `config`.

        The rules are used to calculate the performance score for
        SOD.

        Returns:
            None
        """
        file_path = f"{os.path.dirname(performance_score_factory.__file__)}/pi_masters/sod_performance_rules.json"
        with open(file_path) as f:
            self.config = json.load(f)

    async def configure_va(self, va_data):
        """
        Asynchronously configure VA data for SODPerformanceScore.

        This method assigns the provided VA data to the instance variable `va_data`.
        It is intended to be used to set up the necessary VA data required for
        performance score calculations for SOD.

        Args:
            va_data (dict): A dictionary containing VA data to be configured.
        """
        self.va_data = va_data

    # async def generate_performance_index(self, location_id=None):
    #     """
    #     Async method to generate Performance Index score for SOD.

    #     :param location_id: Unique identifier of location
    #     :return: A tuple containing a dictionary of module scores and total weightage
    #     """
    #     module_scores = {}
    #     total_weight = sum(module["weightage"] for module in self.config.values())
    #     for module_name, module in self.config.items():
    #         mod = getattr(self, f'_compute_{module_name.lower()}_pi_score')
    #         module_score = await mod(module_name, module, location_id)
    #         module_scores[module_name] = module_score
    #     return module_scores, total_weight
    async def generate_performance_index(self, location_id=None):
        """
        Updated to support parent-level modules like 'TAS' which contain nested rule groups.
        """
        module_scores = {}
        total_weight = sum(module["weightage"] for module in self.config.values())

        for module_name, module in self.config.items():

            method_name = f"_compute_{module_name.lower()}_pi_score"

            # ------------------------------------------
            # CASE 1 → Compute function exists normally
            # ------------------------------------------
            if hasattr(self, method_name):
                mod = getattr(self, method_name)
                module_score = await mod(module_name, module, location_id)
                module_scores[module_name] = module_score
                continue

            # ------------------------------------------
            # CASE 2 → Parent module (like TAS)
            # ------------------------------------------
            print(f"[Parent Module] Processing: {module_name}")
            query = f"SELECT location_onboard FROM location_master WHERE sap_id = '{location_id}'"
            data = await hpcl_ceg_model.LocationMaster.get_aggr_data(query)

            raw_value = None
            if data.get("data"):
                raw_value = data["data"][0].get("location_onboard")

            # Normalize value
            # TRUE if: True, "True", "true", "TRUE"
            is_onboard = str(raw_value).strip().lower() == "true"

            if not is_onboard:
                # module_scores[module_name] = {
                #     "name": module_name,
                #     "score": module["weightage"],   # full score
                #     "weightage": module["weightage"],
                #     "results": [],
                #     "reason": f"location_onboard = {raw_value} → full score assigned"
                # }

                module_scores[module_name] = {
                    "name": module_name,
                    "score": 0,  # zero score
                    "weightage": module["weightage"],
                    "results": [],
                    "reason": f"location_onboard = {raw_value} → zero score assigned"
                }
                continue

            parent_results = []
            parent_score = 0

            # Loop through nested modules inside TAS
            for child in module.get("rules", []):
                child_name = child["name"]
                method_child = f"_compute_{child_name.lower()}_pi_score"

                if hasattr(self, method_child):
                    print(f" → Calling child method: {method_child}")
                    mod_child = getattr(self, method_child)
                    child_result = await mod_child(child_name, child, location_id)

                    parent_results.append(child_result)
                    parent_score += child_result.get("score", 0)

                else:
                    print(f"No compute method for child: {child_name}")

            # Apply parent module weightage
            parent_final = round((parent_score * module["weightage"]) / 100, 2)
            # parent_final = module["weightage"]

            module_scores[module_name] = {
                "name": module_name,
                "score": parent_final,
                "weightage": module["weightage"],
                "results": parent_results
            }

        return module_scores, total_weight

    async def _compute_safety_interlocks_pi_score(self, name, rules, location_id):
        """
        Computes the Performance Index (PI) score for safety interlocks based on the given rules.

        This function evaluates the performance of safety interlocks by analyzing open alerts 
        from the database and calculating scores based on the configured rules. It considers 
        the weightage of each rule and the number of alerts that match the interlocks specified 
        in the rules. The score reflects the health of the system by comparing the number of 
        affected devices to the total expected parameter count.

        Args:
            name (str): The name of the module or rule being processed.
            rules (dict): A dictionary containing the rules for safety interlocks, including 
                        interlock names, weightage, and model.
            location_id (str): The location identifier for filtering alerts.

        Returns:
            dict: A dictionary containing the module's name, calculated score, weightage, 
                and detailed results of each rule evaluation.
        """
        pi_score_results = []
        
        for rule in rules.get('rules', []):
            # --- CASE 1: HOOTER (NESTED RULES) ---
            if 'rules' in rule:
                hooter_combined_score = 0
                hooter_total_unhealthy = 0
                hooter_total_units = 0
                
                # Loop through Dyke, HCD, ESD to sum them up
                for sub_rule in rule['rules']:
                    eq_name = sub_rule.get('equipment_name')
                    interlocks = sub_rule.get('interlock_name', [])
                    if not interlocks or interlocks == "":
                        interlocks = sub_rule.get('search_value', [])
                    
                    if not isinstance(interlocks, list):
                        interlocks = [interlocks] if interlocks else []

                    # 1. Get Architecture Count
                    arch_q = f"SELECT count FROM architecture_data WHERE device_type = '{eq_name}' AND sap_id = '{location_id}'"
                    arch_res = await hpcl_ceg_model.ArchitectureData.get_aggr_data(arch_q)
                    p_count = int(arch_res['data'][0].get('count', 1) if arch_res.get('data') else 1)
                    hooter_total_units += p_count

                    # 2. Query for OPEN alerts
                    unhealthy_count = 0
                    if interlocks:
                        in_clause = ", ".join(f"'{val}'" for val in interlocks)
                        alert_q = f"SELECT COUNT(DISTINCT tas_device_name) as unhealthy_count FROM alerts WHERE interlock_name IN ({in_clause}) AND sap_id = '{location_id}' AND alert_status != 'Close'"
                        alert_res = await hpcl_ceg_model.Alerts.get_aggr_data(alert_q)
                        unhealthy_count = int(alert_res['data'][0].get('unhealthy_count', 0) if alert_res.get('data') else 0)
                    
                    hooter_total_unhealthy += unhealthy_count

                    # 3. Add to Hooter total (Summing individual Dyke/HCD/ESD scores)
                    sub_score = ((p_count - unhealthy_count) / p_count) * sub_rule['weightage']
                    hooter_combined_score += sub_score

                # Combine everything into ONE Hooter result
                hooter_result = {
                    "name": rule.get('name', 'Hooter'),
                    "score": round(hooter_combined_score, 2),
                    "weightage": rule['weightage'],
                    "msg": f"{hooter_total_unhealthy} open hooter alerts out of {hooter_total_units} units",
                    "details": {"unhealthy": hooter_total_unhealthy, "total": hooter_total_units}
                }
                pi_score_results.append(enhance_result_with_insights(hooter_result, "safety_interlocks"))

            # --- CASE 2: STANDARD SINGLE RULES ---
            else:
                eq_name = rule.get('equipment_name')
                interlocks = rule.get('interlock_name', [])
                if not interlocks or interlocks == "":
                    interlocks = rule.get('search_value', [])
                
                if not isinstance(interlocks, list):
                    interlocks = [interlocks] if interlocks else []

                arch_q = f"SELECT count FROM architecture_data WHERE device_type = '{eq_name}' AND sap_id = '{location_id}'"
                arch_res = await hpcl_ceg_model.ArchitectureData.get_aggr_data(arch_q)
                p_count = int(arch_res['data'][0].get('count', 1) if arch_res.get('data') else 1)

                unhealthy_count = 0
                if interlocks:
                    in_clause = ", ".join(f"'{val}'" for val in interlocks)
                    alert_q = f"SELECT COUNT(DISTINCT tas_device_name) as unhealthy_count FROM alerts WHERE interlock_name IN ({in_clause}) AND sap_id = '{location_id}' AND alert_status != 'Close'"
                    alert_res = await hpcl_ceg_model.Alerts.get_aggr_data(alert_q)
                    unhealthy_count = int(alert_res['data'][0].get('unhealthy_count', 0) if alert_res.get('data') else 0)

                rule_score = ((p_count - unhealthy_count) / p_count) * rule['weightage']
                
                result_item = {
                    "name": rule.get('name', eq_name),
                    "score": round(rule_score, 2),
                    "weightage": rule['weightage'],
                    "msg": f"{unhealthy_count} open alerts out of {p_count} units",
                    "details": {"unhealthy": unhealthy_count, "total": p_count}
                }
                pi_score_results.append(enhance_result_with_insights(result_item, "safety_interlocks"))

        return {
            "name": rules.get('name', "Safety Interlocks"),
            "score": round(sum(r['score'] for r in pi_score_results), 2),
            "weightage": rules['weightage'],
            "results": pi_score_results
        }

    async def _compute_gantry_interlocks_pi_score(self, name, rules, location_id):
        """
        Compute Gantry Interlocks Score.

        :param name: The name of the rule set as provided in the configuration.
        :param rules: The rule set as provided in the configuration.
        :param location_id: The location identifier for filtering alerts.

        :return: A dictionary containing the module's name, calculated score, weightage, 
            and detailed results of each rule evaluation.
        """
        gantry_score = []

        # Extract all interlock names from rules
        all_interlocks = []
        equipment_names = []
        for rule in rules['rules']:
            if rule['model'] != 'open_alerts':
                continue
            if isinstance(rule['interlock_name'], list):
                all_interlocks.extend(rule['interlock_name'])
                # equipment_names.append(rule['equipment_name'])
            else:
                all_interlocks.append(rule['interlock_name'])
                # equipment_names.append(rule['equipment_name'])

        # Remove duplicates
        interlocks = list(set(all_interlocks))
        equipment_set = list(set(equipment_names))

        if not interlocks:
            return {
                "name": rules.get('name', name),
                "score": 0,
                "weightage": rules['weightage'],
                "results": []
            }

        # Build SQL query for alert data
        in_clause_raw = ", ".join(f"'{value}'" for value in interlocks)
        in_clause_equipment = ", ".join(f"'{value}'" for value in equipment_set)

        current_date = datetime.datetime.now()
        first_day_of_month = current_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # For Gantry, most rules use month_calendar=True
        query = (
            f"SELECT interlock_name, tas_device_name, alert_status, DATE(created_at), alert_history FROM alerts "
            f"WHERE interlock_name IN ({in_clause_raw}) "
            # f"AND equipment_name IN ({in_clause_equipment}) "
            f"AND sap_id = '{location_id}' "
            f"AND alert_section = 'TAS' AND bu = 'TAS' "
            f"AND created_at::DATE >= '{first_day_of_month.strftime('%Y-%m-%d')}' "
            f"AND created_at::DATE <= '{current_date.strftime('%Y-%m-%d')}'"
        )

        # Fetch alerts
        data = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=0)
        open_alerts = defaultdict(list)
        lrc_alerts_info = {}  # To store LRC alerts with their history information

        for item in data.get('data', []):
            interlock_name = item['interlock_name']
            device_name = item['tas_device_name']
            open_alerts[interlock_name].append(device_name)

            # Store LRC alert history information for special handling
            if interlock_name == "LRC Master Switchover required in 30 days":
                alert_history = item.get('alert_history', [])
                if isinstance(alert_history, str):
                    try:
                        # Try to parse JSON if it's a string
                        alert_history = json.loads(alert_history)
                    except (json.JSONDecodeError, TypeError):
                        alert_history = []

                lrc_alerts_info[device_name] = {
                    'has_analog_input': any(
                        isinstance(entry, dict) and
                        entry.get('action_msg') == "Alert due to Analog input"
                        for entry in alert_history if isinstance(alert_history, list)
                    )
                }

        for rule in rules['rules']:
            if rule['model'] != 'open_alerts':
                continue

            rule_weightage = rule['weightage']
            equipment_name = rule['equipment_name']
            interlock_names = rule['interlock_name'] if isinstance(rule['interlock_name'],
                                                                   list) else [
                rule['interlock_name']]

            # Get parameter count from architecture_data
            special_interlocks = {
                "Manual FAN printed more than 5% of total TT loaded"
            }

            if any(interlock in special_interlocks for interlock in interlock_names):
                parameter_count = 1
            else:
                if isinstance(equipment_name, list):
                    device_types = ", ".join(f"'{item}'" for item in equipment_name)
                    query = f"""
                        SELECT count FROM architecture_data 
                        WHERE device_type IN ({device_types}) 
                        AND sap_id = '{location_id}'
                    """
                else:
                    query = f"""
                        SELECT count FROM architecture_data 
                        WHERE device_type = '{equipment_name}' 
                        AND sap_id = '{location_id}'
                    """
                architecture_data = await hpcl_ceg_model.ArchitectureData.get_aggr_data(query)
                parameter_count = architecture_data['data'][0].get('count',
                                                                   0) if architecture_data.get(
                    'data') else 100
                parameter_count = int(parameter_count) if isinstance(parameter_count,
                                                                     str) and parameter_count.isdigit() else int(
                    parameter_count or 0)

            if not parameter_count or parameter_count == 0:
                weightage = None
                score = 0
            else:
                today_date_str = current_date.strftime('%Y-%m-%d')
                if rule['name'] == "BCU Parameters Analysis":
                    # Query specifically for TODAY (includes Open + Closed alerts)
                    bcu_in_clause = ", ".join(f"'{i}'" for i in interlock_names)
                    daily_bcu_query = (
                        f"SELECT tas_device_name, COUNT(*) as alert_count FROM alerts "
                        f"WHERE interlock_name IN ({bcu_in_clause}) AND sap_id = '{location_id}' "
                        f"AND created_at::DATE = '{today_date_str}' "
                        f"AND alert_section = 'TAS' AND bu = 'TAS' GROUP BY tas_device_name"
                    )
                    daily_data = await hpcl_ceg_model.Alerts.get_aggr_data(daily_bcu_query)
                    daily_alert_map = {item['tas_device_name']: int(item['alert_count']) for item in daily_data.get('data', [])}

                    weight_per_unit = rule_weightage / parameter_count # e.g., 1.67 / 28 = 0.0596
                    module_total_score = 0
                    healthy_devices, medium_devices, unhealthy_devices = 0, 0, 0

                    # Calculate tiered score for each BCU (even those not in daily_alert_map)
                    alerted_names = list(daily_alert_map.keys())
                    for i in range(parameter_count):
                        count = daily_alert_map.get(alerted_names[i], 0) if i < len(alerted_names) else 0
                        
                        if count < 5:
                            module_total_score += weight_per_unit # 100% share
                            healthy_devices += 1
                        elif 5 <= count <= 15:
                            module_total_score += (weight_per_unit * 0.5) # 50% share
                            medium_devices += 1
                        else:
                            unhealthy_devices += 1 # 0% share

                    score = round(module_total_score, 4)
                    asset_unhealthy_count = unhealthy_devices + medium_devices
                    bcu_details = {
                        "healthy_devices": healthy_devices,
                        "medium_devices": medium_devices,
                        "unhealthy_devices": unhealthy_devices,
                        "total_devices": parameter_count,
                        "device_frequency_distribution": daily_alert_map
                    }

                # Special case for LRC Master
                elif rule['name'] == "LRC Master":
                    # Check for "LRC Master Switchover required in 30 days" alert
                    lrc_interlock = "LRC Master Switchover required in 30 days"

                    if lrc_interlock in open_alerts and any(open_alerts[lrc_interlock]):
                        # We have LRC alerts - check if any has "Alert due to Analog input"
                        has_analog_input_devices = [
                            device for device in open_alerts[lrc_interlock]
                            if device in lrc_alerts_info and lrc_alerts_info[device][
                                'has_analog_input']
                        ]

                        if has_analog_input_devices:
                            # If alerts with "Alert due to Analog input" exist, no unhealthy count
                            asset_unhealthy_count = 0
                        else:
                            # If alerts without "Alert due to Analog input" exist, no unhealthy count
                            asset_unhealthy_count = 1
                    else:
                        # No LRC alert found, consider 1 device unhealthy
                        asset_unhealthy_count = 0

                    score = ((parameter_count - asset_unhealthy_count) / parameter_count) * (
                        rule_weightage)
                    lrc_details = {
                        "unhealthy_devices": asset_unhealthy_count,
                        "total_devices": parameter_count,
                        "has_analog_input_alerts": len(
                            has_analog_input_devices) > 0 if 'has_analog_input_devices' in locals() else False
                    }

                else:
                    # Standard calculation for other Gantry rules
                    unique_devices = set()
                    for interlock_name in interlock_names:
                        if interlock_name in open_alerts:
                            for device_name in open_alerts[interlock_name]:
                                unique_devices.add(device_name)

                    asset_unhealthy_count = len(unique_devices)
                    score = ((parameter_count - asset_unhealthy_count) / parameter_count) * (
                        rule_weightage)

            final_rule_score = score

            # Build details based on rule type
            details = {
                "unhealthy_devices": asset_unhealthy_count if 'asset_unhealthy_count' in locals() else 0,
                "total_devices": parameter_count if parameter_count else 0,
                "affected_interlocks": interlock_names if 'interlock_names' in locals() else []
            }

            # Add rule-specific details
            if rule['name'] == "BCU Parameters Analysis" and 'bcu_details' in locals():
                details.update(bcu_details)
            elif rule['name'] == "LRC Master" and 'lrc_details' in locals():
                details.update(lrc_details)

            # Generate appropriate message
            if abs(final_rule_score - rule_weightage) < 0.01:  # Full score achieved
                system_name = rule.get('name', 'Gantry Interlocks')
                msg = f"No open alerts. {system_name} system operating normally."
            else:
                msg = f"Score: {round(final_rule_score, 4)} out of {rule_weightage}. {details.get('unhealthy_devices', 0)} out of {details.get('total_devices', 0)} devices have active alerts"

            result_item = {
                "name": rule['name'],
                "score": round(final_rule_score, 4),
                "weightage": rule_weightage,
                "module": rules.get('name', name),
                "msg": msg,
                "details": details
            }

            # Enhance with insights
            result_item = enhance_result_with_insights(result_item, "gantry_interlocks")
            gantry_score.append(result_item)

        # Final score scaled by weightage
        final_score = round(sum([score['score'] for score in gantry_score]), 2)
        # final_score = round((final_score * rules['weightage']) / 100, 2)

        for rec in gantry_score:
            rec['score'] = round(rec['score'], 2)

        print("Gantry final_score ----->", final_score)

        module_result = {
            "name": rules.get('name', name),
            "score": final_score,
            "weightage": rules['weightage'],
            "results": gantry_score
        }

        # Add module-level summary insights
        module_result["insights"] = generate_summary_insights(module_result)

        return module_result

    async def _compute_process_interlocks_pi_score(self, name, rules, location_id):
        """
        Compute Process Interlocks Score specifically handling maintenance checks.

        :param name: The name of the rule set as provided in the configuration.
        :param rules: The rule set as provided in the configuration.
        :param location_id: The location identifier for filtering alerts.

        :return: A dictionary containing the module's name, calculated score, weightage, 
            and detailed results of each rule evaluation.
        """
        process_score = []

        # Extract all interlock names and equipment names
        all_interlocks = []
        all_equipment_names = []
        for rule in rules['rules']:
            if rule['model'] != 'open_alerts' or not rule['interlock_name']:
                continue
            if isinstance(rule['interlock_name'], list):
                all_interlocks.extend(rule['interlock_name'])
            else:
                all_interlocks.append(rule['interlock_name'])
            all_equipment_names.append(rule['equipment_name'])

        # Remove duplicates
        interlocks = list(set(all_interlocks))
        equipment_set = list(set(all_equipment_names))

        in_clause_raw = ", ".join(f"'{value}'" for value in interlocks)
        in_clause_eq = ", ".join(f"'{value}'" for value in equipment_set)

        query = (
            f"SELECT interlock_name, tas_device_name FROM alerts "
            f"WHERE interlock_name IN ({in_clause_raw}) "
            f"AND equipment_name IN ({in_clause_eq}) "
            f"AND sap_id = '{location_id}' AND alert_status != 'Close' "
            f"AND alert_section = 'TAS' AND bu = 'TAS'"
        )
        print("process query --> ", query)

        # Fetch alerts
        data = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=100000)
        maintenance_alerts = defaultdict(list)
        for item in data.get('data', []):
            maintenance_alerts[item['interlock_name']].append(item['tas_device_name'])

        for rule in rules['rules']:
            if rule['model'] != 'open_alerts':
                continue

            rule_weightage = rule['weightage']
            equipment_name = rule['equipment_name']

            if not rule['interlock_name']:
                process_score.append({
                    "name": rule['name'],
                    "score": round(rule_weightage, 2),
                    "weightage": rule_weightage,
                    "module": rules.get('name')
                })
                continue

            interlock_names = rule['interlock_name'] if isinstance(rule['interlock_name'],
                                                                   list) else [
                rule['interlock_name']]

            if isinstance(equipment_name, list):
                device_types = ", ".join(f"'{item}'" for item in equipment_name)
                query = f"""
                    SELECT count FROM architecture_data 
                    WHERE device_type IN ({device_types}) 
                    AND sap_id = '{location_id}'
                """
            else:
                query = f"""
                    SELECT count FROM architecture_data 
                    WHERE device_type = '{equipment_name}' 
                    AND sap_id = '{location_id}'
                """

            architecture_data = await hpcl_ceg_model.ArchitectureData.get_aggr_data(query)
            parameter_count = architecture_data['data'][0].get('count', 0) if architecture_data.get(
                'data') else 100
            parameter_count = int(parameter_count) if isinstance(parameter_count,
                                                                 str) and parameter_count.isdigit() else int(
                parameter_count or 0)

            if not parameter_count:
                score = 0
            else:
                under_maintenance_devices = {
                    device_name
                    for interlock_name in interlock_names
                    for device_name in maintenance_alerts.get(interlock_name, [])
                }
                maintenance_count = len(under_maintenance_devices)
                score = ((parameter_count - maintenance_count) / parameter_count) * (rule_weightage)

            # Generate appropriate message
            if abs(score - rule_weightage) < 0.01:  # Full score achieved
                system_name = rule.get('name', 'Process Interlocks')
                msg = f"No open alerts. {system_name} system operating normally."
            else:
                msg = f"{maintenance_count} out of {parameter_count} devices under maintenance"

            result_item = {
                "name": rule['name'],
                "score": round(score, 2),
                "weightage": rule_weightage,
                "module": rules.get('name'),
                "msg": msg,
                "details": {
                    "unhealthy_devices": maintenance_count,
                    "total_devices": parameter_count,
                    "affected_interlocks": interlock_names if 'interlock_names' in locals() else []
                }
            }

            # Enhance with insights
            result_item = enhance_result_with_insights(result_item, "process_interlocks")
            process_score.append(result_item)

        # Final score
        final_score = round(sum([score['score'] for score in process_score]), 2)

        module_result = {
            "name": rules.get('name'),
            "score": final_score,
            "weightage": rules['weightage'],
            "results": process_score
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
                    f"bu = 'TAS' and created_at::DATE >= '2025-09-01' and created_at >= NOW() - INTERVAL '30 days ' group by severity")
                data = await hpcl_ceg_model.Alerts.get_aggr_data(query_open)
                open_alerts = {data['severity']: data['count'] for data in data['data']}

                # For all closure alerts in last 24 hours
                query_close = (
                    f"select severity, count(device_name) as count from alerts where severity in ({in_clause_raw}) and "
                    f"sap_id = '{location_id}' and alert_status = 'Close' and alert_section = 'VA' and "
                    f"bu = 'TAS'and created_at::DATE >= '2025-09-01' and updated_at >= NOW() - INTERVAL '24 hours' group by severity")
                data = await hpcl_ceg_model.Alerts.get_aggr_data(query_close)
                close_alerts = {data['severity']: data['count'] for data in data['data']}
                alert_score = []

                for rule_ in rule['rules']:
                    int_name = rule_['interlock_name']
                    if not open_alerts and not close_alerts:
                        alert_score.append(rule_['weightage'])
                        print("alert_score:", alert_score)
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
                    score = rule['weightage']  # rules['weightage']
                else:
                    score = round((sum(alert_score) * rule['weightage']) / 100, 2)
                if abs(score - rule['weightage']) < 0.01:  # Full score achieved
                    msg = "No open alerts. VA Alert Severity system operating normally."
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
                    "va_portal_score": self.va_data.get('OVERALL_SCORE') if rule[
                                                                                'model'] == 'va_portal' and self.va_data else None,
                    "total_alerts": total_alerts if 'total_alerts' in locals() else None,
                    "closed_alerts": closed_alerts if 'closed_alerts' in locals() else None
                }
            }

            # Enhance with insights
            module_type = rule['model']
            result_item = enhance_result_with_insights(result_item, module_type)
            pi_score.append(result_item)
        # final_score = sum([score['score'] for score in pi_score])

        # print("-"*20)
        # print("pi_score :", pi_score)
        # print("-"*20)
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

        module_result = {"name": rules.get('name', name), "score": final_score,
                         "weightage": rules['weightage'], "results": pi_score}

        # Add module-level summary insights
        module_result["insights"] = generate_summary_insights(module_result)

        return module_result

    async def _compute_vts_pi_score(self, name, rules, location_id):
        pi_score = []
        total_vehicles = 190
        tt_count_csv = os.path.join(os.path.dirname(hpcl_ceg_model.__file__), '..', 'orchestrator',
                                    'reporting_services', 'vehicle_master_count_of_tt_no.csv')
        df = pd.read_csv(tt_count_csv)
        df = df[df['sap_id'] == int(location_id)]

        if not df.empty:
            total_vehicles = df['count_of_tt_no'].sum()

        for rule in rules['rules']:
            alert_score = []
            score = 0
            if rule['model'] == 'vts_interlock':
                search_values = [rec['search_value'] for rec in rule['rules']]
                query_clause = " or ".join(
                    [f"interlock_name like '%{value}%'" for value in search_values])
                query = (f"select interlock_name, count(vehicle_number) as count from alerts where "
                         f"sap_id = '{location_id}' and ({query_clause}) and bu='TAS' and alert_section='VTS' and "
                         f"alert_status != 'Close' group by interlock_name")
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
                        score = ((total_vehicles - alert_data[
                            rule_['search_value']]) / total_vehicles)
                        score = round(score * (rule_['weightage']), 2)
                        alert_score.append(float(score))
                    else:
                        alert_score.append(rule_['weightage'])
            # Generating score by comparing number of active vehicles with no of open alerts
            elif rule['model'] == 'vts_active_vehicles':
                query = (
                    f"select DISTINCT(vehicle_number), count(vehicle_number) as count from alerts "
                    f"where sap_id = '{location_id}' and alert_status != 'Close' and "
                    f"bu='TAS' and alert_section='VTS' group by vehicle_number")
                data = await hpcl_ceg_model.VTS.get_aggr_data(query)
                alert_data = {}

                inactive_vehicles = len(data['data'])
                active_vehicles = total_vehicles - inactive_vehicles
                # Score = (active_vehicles / total_vehicles) * rule weightage (points 0–30)
                active_ratio = (active_vehicles / total_vehicles) if total_vehicles else 0.0
                rule_weightage_pts = float(rule.get('weightage', 30))
                if rule_weightage_pts <= 1:
                    rule_weightage_pts = 30.0  # guard: weightage must be in points (e.g. 30), not ratio
                score = round(active_ratio * rule_weightage_pts, 2)

                # Store for insights
                vts_active_vehicles_count = active_vehicles
                vts_total_vehicles_count = total_vehicles
            # Generating PI score base don total open and total close alerts
            elif rule['model'] == 'vts_alerts':
                severity = list(set([rule_['interlock_name'] for rule_ in rule['rules']]))
                in_clause_raw = ", ".join(f"'{value}'" for value in severity)
                # For all open alerts
                query_open = (
                    f"select severity, count(device_name) as count from alerts where severity in ({in_clause_raw}) and "
                    f"sap_id = '{location_id}' and alert_status != 'Close' and alert_section = 'VTS' and "
                    f"bu = 'TAS' group by severity")
                data = await hpcl_ceg_model.Alerts.get_aggr_data(query_open)
                open_alerts = {data['severity']: data['count'] for data in data['data']}

                # For all closure alerts in last 24 hours
                query_close = (
                    f"select severity, count(device_name) as count from alerts where severity in ({in_clause_raw}) and "
                    f"sap_id = '{location_id}' and alert_status = 'Close' and alert_section = 'VTS' and "
                    f"bu = 'TAS' and updated_at >= NOW() - INTERVAL '24 hours' group by severity")
                data = await hpcl_ceg_model.Alerts.get_aggr_data(query_close)
                close_alerts = {data['severity']: data['count'] for data in data['data']}

                for rule_ in rule['rules']:
                    int_name = rule_['interlock_name']
                    if int_name in open_alerts or int_name in close_alerts:
                        close_percentage = rule_['weightage'] * (close_alerts.get(int_name, 0) /
                                                                 (close_alerts.get(int_name, 0) +
                                                                  open_alerts.get(int_name, 0)))
                        alert_score.append(close_percentage)
                    else:
                        alert_score.append(rule_['weightage'])
                print(alert_score, rules['weightage'])

                # Store for insights
                vts_open_alerts_count = sum(open_alerts.values())
                vts_closed_alerts_count = sum(close_alerts.values())
            # For vts_active_vehicles, score already set above (points 0–weightage); do not overwrite
            if rule['model'] != 'vts_active_vehicles' and alert_score:
                score = round((sum(alert_score) * rule['weightage']) / 100, 2)

            # Build details based on rule model
            details = {}
            msg = ""
            if rule['model'] == 'vts_active_vehicles':
                active_count = vts_active_vehicles_count if 'vts_active_vehicles_count' in locals() else 0
                total_count = vts_total_vehicles_count if 'vts_total_vehicles_count' in locals() else 0
                details = {
                    "active_vehicles": active_count,
                    "total_vehicles": total_count,
                    "inactive_vehicles": (total_count - active_count) if total_count > 0 else 0
                }
                if abs(score - rule['weightage']) < 0.01:  # Full score achieved
                    msg = f"No open alerts. VTS Active Vehicles system operating normally."
                elif score == 0:
                    msg = f"VTS Active Vehicles: 0 out of {total_count} vehicles are active, resulting in 0 points out of {rule['weightage']}. Review vehicle status and VTS connectivity."
                else:
                    msg = f"VTS Active Vehicles: {active_count} out of {total_count} vehicles are active. Score: {round(score, 2)} out of {rule['weightage']}"
            elif rule['model'] == 'vts_alerts':
                open_count = vts_open_alerts_count if 'vts_open_alerts_count' in locals() else 0
                closed_count = vts_closed_alerts_count if 'vts_closed_alerts_count' in locals() else 0
                details = {
                    "open_alerts": open_count,
                    "closed_alerts": closed_count
                }
                if abs(score - rule['weightage']) < 0.01:  # Full score achieved
                    msg = f"No open alerts. VTS Alerts system operating normally."
                elif score == 0:
                    if open_count > 0:
                        msg = f"VTS Alerts: {open_count} open alerts with low closure rate, resulting in 0 points out of {rule['weightage']}. Focus on closing open alerts promptly."
                    else:
                        msg = f"VTS Alerts: No alerts found in the system. Score: {round(score, 2)} out of {rule['weightage']}"
                else:
                    if open_count == 0 and closed_count == 0:
                        msg = f"VTS Alerts: No alerts found. Full score of {round(score, 2)} out of {rule['weightage']} assigned."
                    else:
                        closure_rate = round((closed_count / (open_count + closed_count) * 100),
                                             2) if (open_count + closed_count) > 0 else 0
                        msg = f"VTS Alerts: {open_count} open alerts, {closed_count} closed in last 24 hours (closure rate: {closure_rate}%). Score: {round(score, 2)} out of {rule['weightage']}"
            elif rule['model'] == 'vts_interlock':
                affected_count = len(alert_data) if 'alert_data' in locals() else 0
                details = {
                    "affected_vehicles": affected_count,
                    "total_vehicles": total_vehicles
                }
                if abs(score - rule['weightage']) < 0.01:  # Full score achieved
                    msg = f"No open alerts. VTS Interlock system operating normally."
                elif score == 0:
                    msg = f"VTS Interlock: {affected_count} vehicles have active interlock alerts, resulting in 0 points out of {rule['weightage']}. Resolve interlock issues to improve score."
                else:
                    msg = f"VTS Interlock: {affected_count} out of {total_vehicles} vehicles have interlock alerts. Score: {round(score, 2)} out of {rule['weightage']}"
            else:
                # Default message for other VTS models
                msg = f"VTS {rule['model']} score: {round(score, 2)} out of {rule['weightage']}"

            result_item = {
                "name": rule['name'],
                "score": score,
                "weightage": rule['weightage'],
                'module': rules.get('name', name),
                "msg": msg,
                "details": details
            }

            # Enhance with insights
            result_item = enhance_result_with_insights(result_item, "vts")
            pi_score.append(result_item)
        final_score = sum([score['score'] for score in pi_score])
        final_score = round((final_score * rules['weightage']) / 100, 2)
        # final_score = rules['weightage'] 
        for rec in pi_score:
            rec['score'] = round(rec['score'], 2)

        module_result = {"name": rules.get('name', name), "score": final_score,
                         "weightage": rules['weightage'], "results": pi_score}

        # Add module-level summary insights
        module_result["insights"] = generate_summary_insights(module_result)

        return module_result

    async def _compute_water_quantity_pi_score(self, name, rules, location_id):
        """
        Computes the Performance Index (PI) score for water quantity based on device data.

        This function assesses the water availability in devices by comparing the available
        water against the required and target volumes. It calculates a percentage score
        based on water availability and applies the specified rules to compute the weighted
        PI score.

        Args:
            name (str): The name of the module or rule being processed.
            rules (dict): A dictionary containing the rules for water quantity, including 
                        rule names and weightage.
            location_id (str): The location identifier for filtering devices.

        Returns:
            dict: A dictionary containing the module's name, calculated score, weightage,
                and detailed results of each rule evaluation.

        Raises:
            Exception: If an error occurs during data fetching for a device.
        """
        WATER_THRESHOLD = 0
        all_devices = fetch_oi_devices(page_size=1000)

        # Filter only devices matching the location_id
        location_devices = [
            d for d in all_devices
            if
            d.get("type") == "OI" and d.get("additionalInfo", {}).get("location_id") == location_id
        ]

        pi_score = []

        if not location_devices:
            # ⚠️ No devices found for location → assign full score
            percentage = 100
            for rule in rules.get('rules', []):
                weightage = rule.get('weightage', 0)
                score = round((percentage * weightage) / 100, 2)
                pi_score.append({
                    "name": rule.get('name', ''),
                    "score": score,
                    "weightage": weightage,
                    "module": rules.get('name', '')
                })
        else:
            for device in location_devices:
                try:
                    device_id = device.get('id', {}).get('id')
                    required_kls, target_volume, available_water = fetch_device_data(device_id,
                                                                                     key="Water Volume")
                    WATER_THRESHOLD = required_kls
                    if available_water < WATER_THRESHOLD:
                        percentage = 0
                    elif available_water > target_volume:
                        percentage = 100
                    else:
                        percentage = (available_water / target_volume) * 100

                    for rule in rules.get('rules', []):
                        weightage = rule.get('weightage', 0)
                        score = round((percentage * weightage) / 100, 2)
                        
                        # Generate appropriate message
                        if abs(score - weightage) < 0.01:  # Full score achieved
                            msg = f"No open alerts. {rule.get('name', 'Water Quantity')} system operating normally."
                        else:
                            msg = f"Water quantity: {available_water} KL (Required: {required_kls} KL, Target: {target_volume} KL)"

                        result_item = {
                            "name": rule.get('name', ''),
                            "score": score,
                            "weightage": weightage,
                            "module": rules.get('name', ''),
                            "msg": msg,
                            "details": {
                                "available_quantity": available_water,
                                "required_quantity": required_kls,
                                "target_quantity": target_volume,
                                "percentage": round(percentage, 2)
                            }
                        }

                        # Enhance with insights
                        result_item = enhance_result_with_insights(result_item,
                                                                   "water_quantity")
                        pi_score.append(result_item)
                        break  # Only process the first matching device
                except Exception as e:
                    print(f"Error processing device {device.get('name', '')}: {e}")
                    continue

        # Final score
        final_score = round(sum([score['score'] for score in pi_score]), 2)

        print("final_score --->", final_score)

        return {
            "name": rules.get('name', ''),
            "score": final_score,
            "weightage": rules.get('weightage', 100),
            "results": pi_score
        }

    async def _compute_foam_quantity_pi_score(self, name, rules, location_id):
        """
        Computes the Performance Index (PI) score for foam quantity based on device data.

        This function evaluates the foam quantity in devices by comparing the available 
        foam against the required and target foam levels. It calculates a percentage 
        score based on the foam availability and applies the given rules to determine 
        the weighted PI score.

        Args:
            name (str): The name of the module or rule being processed.
            rules (dict): A dictionary containing the rules for foam quantity, including 
                        rule names and weightage.
            location_id (str): The location identifier for filtering devices.

        Returns:
            dict: A dictionary containing the module's name, calculated score, weightage, 
                and detailed results of each rule evaluation.

        Raises:
            Exception: If an error occurs during data fetching for a device.
        """
        FOAM_THRESHOLD = 0
        all_devices = fetch_oi_devices(page_size=1000)
        location_devices = [d for d in all_devices if
                            d.get("type") == "OI" and d.get("additionalInfo").get(
                                "location_id") == location_id]
        pi_score = []

        if not location_devices:
            # ⚠️ No devices found for location → assign full score
            percentage = 100
            for rule in rules.get('rules', []):
                weightage = rule.get('weightage', 0)
                score = round((percentage * weightage) / 100, 2)
                result_item = {
                    "name": rule.get('name', ''),
                    "score": score,
                    "weightage": weightage,
                    "module": rules.get('name', ''),
                    "msg": f"No open alerts. {rule.get('name', 'Foam Quantity')} system operating normally.",
                    "details": {
                        "available_quantity": 0,
                        "required_quantity": 0,
                        "target_quantity": 0,
                        "percentage": 100
                    }
                }
                result_item = enhance_result_with_insights(result_item, "foam_quantity")
                pi_score.append(result_item)
        else:
            for device in location_devices:
                if device.get("type") == "OI":
                    try:
                        device_id = device['id']['id']
                        required_kls, target_volume, available_water = fetch_device_data(device_id,
                                                                                         key="Foam Volume")
                        FOAM_THRESHOLD = required_kls
                        if available_water < FOAM_THRESHOLD:
                            percentage = 100
                        else:
                            percentage = (available_water / target_volume) * 100

                        for rule in rules['rules']:
                            weightage = rule.get('weightage', 0)
                            score = round((percentage * weightage) / 100, 2)
                            
                            # Generate appropriate message
                            if abs(score - weightage) < 0.01:  # Full score achieved
                                msg = f"No open alerts. {rule.get('name', 'Foam Quantity')} system operating normally."
                            else:
                                msg = f"Foam quantity: {available_water} KL (Required: {FOAM_THRESHOLD} KL, Target: {target_volume} KL)"

                            result_item = {
                                "name": rule['name'],
                                "score": score,
                                "weightage": weightage,
                                "module": rules.get('name', ''),
                                "msg": msg,
                                "details": {
                                    "available_quantity": available_water,
                                    "required_quantity": FOAM_THRESHOLD,
                                    "target_quantity": target_volume,
                                    "percentage": round(percentage, 2)
                                }
                            }

                            # Enhance with insights
                            result_item = enhance_result_with_insights(result_item, "foam_quantity")
                            pi_score.append(result_item)
                        break
                    except Exception as e:
                        print(f"Error processing device {device.get('name')}: {e}")
                        continue

        final_score = round(sum(r['score'] for r in pi_score), 2)

        print("final_score ---> ", final_score)

        module_result = {
            "name": rules.get('name', ''),
            "score": final_score,
            "weightage": rules['weightage'],
            "results": pi_score
        }

        # Add module-level summary insights
        module_result["insights"] = generate_summary_insights(module_result)

        return module_result

    async def _compute_fire_engines_in_auto_mode_pi_score(self, name, rules, location_id):
        """
        Computes the Performance Index (PI) score for fire engines in auto mode.

        This function evaluates the performance of fire engines by analyzing alarm data 
        from devices. It checks if any fire engine is in local mode with an active unacknowledged 
        alarm and adjusts the score accordingly. The score is calculated based on the configured 
        rules and their weightages. 

        Args:
            name (str): The name of the module or rule being processed.
            rules (dict): A dictionary containing the rules for fire engines, including 
                        rule names and weightages.
            location_id (str): The location identifier for filtering device data.

        Returns:
            dict: A dictionary containing the module's name, calculated score, weightage, 
                and detailed results of each rule evaluation.
        """
        all_devices = fetch_oi_devices(page_size=1000)
        pi_score = []

        # Filter devices for the given location
        location_devices = [
            d for d in all_devices
            if
            d.get("type") == "OI" and d.get("additionalInfo", {}).get("location_id") == location_id
        ]

        if not location_devices:
            # No devices found → assign full score
            score_percentage = 100
            for rule in rules.get('rules', []):
                weightage = rule.get('weightage', 0)
                score = round((score_percentage * weightage) / 100, 2)
                result_item = {
                    "name": rule.get('name', ''),
                    "score": score,
                    "weightage": weightage,
                    "module": rules.get('name', ''),
                    "msg": f"No open alerts. {rule.get('name', 'Fire Engines')} system operating normally.",
                    "details": {
                        "score_percentage": 100,
                        "has_local_mode_alarm": False
                    }
                }
                result_item = enhance_result_with_insights(result_item, "fire_engines_auto_mode")
                pi_score.append(result_item)
        else:
            for device in location_devices:
                try:
                    device_id = device.get('id', {}).get('id')
                    score_percentage = 100  # Start with full score

                    if not device_id:
                        # If no device ID, still give full score
                        pass
                    else:
                        alarms_data = fetch_alarm_data(device_id)

                        for alarm in alarms_data.get('data', []):
                            interlock_name = alarm.get('details', {}).get('additionalInfo', {}).get(
                                'interlockName')
                            status = alarm.get('status', '')

                            if interlock_name == 'Fire engine in local' and status == 'ACTIVE_UNACK':
                                score_percentage = 0
                                break

                    # Apply all rules using score_percentage
                    for rule in rules.get('rules', []):
                        weightage = rule.get('weightage', 0)
                        score = round((score_percentage * weightage) / 100, 2)
                        
                        # Generate appropriate message
                        if abs(score - weightage) < 0.01:  # Full score achieved
                            msg = f"No open alerts. {rule.get('name', 'Fire Engines')} system operating normally."
                        else:
                            msg = f"Fire engines auto mode status: {'Compliant' if score_percentage == 100 else 'Non-compliant - Fire engine in local mode detected'}"

                        result_item = {
                            "name": rule.get('name', ''),
                            "score": score,
                            "weightage": weightage,
                            "module": rules.get('name', ''),
                            "msg": msg,
                            "details": {
                                "score_percentage": score_percentage,
                                "has_local_mode_alarm": score_percentage == 0
                            }
                        }

                        # Enhance with insights
                        result_item = enhance_result_with_insights(result_item,
                                                                   "fire_engines_auto_mode")
                        pi_score.append(result_item)

                    break  # Process only the first matching device

                except Exception as e:
                    print(f"Error processing device {device.get('name', '')}: {e}")
                    continue

        # ✅ Final score calculation
        final_score = round(sum(r['score'] for r in pi_score), 2)
        print("final_score ---> ", final_score)

        module_result = {
            "name": rules.get('name', ''),
            "score": final_score,
            "weightage": rules.get('weightage', 100),
            "results": pi_score
        }

        # Add module-level summary insights
        module_result["insights"] = generate_summary_insights(module_result)

        return module_result

    async def _compute_hydrant_line_pi_score(self, name, rules, location_id):
        """
        Compute the Performance Index (PI) score for hydrant line and jockey pump systems.

        This function evaluates the performance of hydrant line and jockey pump systems by
        analyzing alarm data and calculating scores based on configured rules. It checks
        for active alarms indicating issues with the hydrant line pressure and jockey pump
        status and adjusts scores accordingly. The function aggregates scores for each rule
        and computes a final weighted score.

        Args:
            name (str): The name of the module or rule being processed.
            rules (dict): A dictionary containing the rules with names, weightages, and module data.
            location_id (str): The location identifier for filtering device data.

        Returns:
            dict: A dictionary containing the module's name, calculated score, weightage,
                and detailed results of each rule evaluation.
        """
        all_devices = fetch_oi_devices(page_size=1000)
        pi_score = []

        # Filter devices for given location_id
        location_devices = [
            d for d in all_devices
            if
            d.get("type") == "OI" and d.get("additionalInfo", {}).get("location_id") == location_id
        ]
        if not location_devices:
            # No devices found — assign full scores manually
            module_name = rules.get('name', '')
            pi_score.extend([
                {
                    'name': 'Pressurized Hydrant Line',
                    'score': 5.0,
                    'weightage': 5.0,
                    'module': module_name
                },
                {
                    'name': 'Jockey Pump',
                    'score': 5.0,
                    'weightage': 5.0,
                    'module': module_name
                }
            ])
        else:
            for device in location_devices:
                if device.get("type") == "OI":
                    try:
                        device_id = device.get('id', {}).get('id')  # Safely get device_id

                        if not device_id:
                            # No device_id, assign full scores
                            pressure_score = 5.0
                            jockey_score = 5.0
                        else:
                            alarms_data = fetch_alarm_data(device_id)

                            hydrant_alarm_active = False
                            jockey_alarm_active = False

                            for alarm in alarms_data.get('data', []):
                                interlock_name = alarm.get('details', {}).get('additionalInfo',
                                                                              {}).get(
                                    'interlockName')
                                status = alarm.get('status', '')
                                device_type = alarm.get('type', '')

                                if device_type == 'PT Alarm' and interlock_name == 'Hydrant Line PT is below 7 Kg' and status == 'ACTIVE_UNACK':
                                    hydrant_alarm_active = True
                                elif device_type == 'Jockey Alarm' and interlock_name == 'Jockey Pump not in Auto Remote' and status == 'ACTIVE_UNACK':
                                    jockey_alarm_active = True

                            pressure_score = 0.0 if hydrant_alarm_active else 5.0
                            jockey_score = 0.0 if jockey_alarm_active else 5.0

                        module_name = rules.get('name', '')
                        
                        # Generate appropriate messages
                        if abs(pressure_score - 5.0) < 0.01:  # Full score achieved
                            pressure_msg = f"No open alerts. Pressurized Hydrant Line system operating normally."
                        else:
                            pressure_msg = f"Hydrant line pressure: {'Below 7 Kg' if hydrant_alarm_active else 'Normal'}"
                        
                        if abs(jockey_score - 5.0) < 0.01:  # Full score achieved
                            jockey_msg = f"No open alerts. Jockey Pump system operating normally."
                        else:
                            jockey_msg = f"Jockey pump: {'Not in Auto Remote' if jockey_alarm_active else 'In Auto Remote'}"

                        pressure_result = {
                            'name': 'Pressurized Hydrant Line',
                            'score': pressure_score,
                            'weightage': 5.0,
                            'module': module_name,
                            'msg': pressure_msg,
                            'details': {
                                'pressure_alarm_active': hydrant_alarm_active,
                                'pressure_threshold': 7.0
                            }
                        }
                        pressure_result = enhance_result_with_insights(pressure_result,
                                                                       "hydrant_line")

                        jockey_result = {
                            'name': 'Jockey Pump',
                            'score': jockey_score,
                            'weightage': 5.0,
                            'module': module_name,
                            'msg': jockey_msg,
                            'details': {
                                'jockey_alarm_active': jockey_alarm_active
                            }
                        }
                        jockey_result = enhance_result_with_insights(jockey_result, "hydrant_line")

                        pi_score.extend([pressure_result, jockey_result])
                        break  # Only the first matching device
                    except Exception as e:
                        print(f"Error processing device {device.get('name', '')}: {e}")
                        continue

        final_score = round(sum(r['score'] for r in pi_score), 2)
        print("final_score ---> ", final_score)

        module_result = {
            "name": rules.get('name', ''),
            "score": final_score,
            "weightage": rules.get('weightage', 100),
            "results": pi_score
        }

        # Add module-level summary insights
        module_result["insights"] = generate_summary_insights(module_result)

        return module_result

    async def _compute_emlock_pi_score(self, name, rules, location_id):
        """
        Computes the Performance Index (PI) score for EMLock based on open alerts.

        This function evaluates the performance of EMLock by analyzing open alerts
        from the database and calculating scores based on the configured rules.
        It considers the weightage of each rule and the number of alerts that match
        the interlocks specified in the rules. The score reflects the health of the
        system by comparing the number of affected vehicles to the total number of
        vehicles.

        Args:
            name (str): The name of the module or rule being processed.
            rules (dict): A dictionary containing the rules for EMLock, including 
                        interlock names, weightage, and model.
            location_id (str): The location identifier for filtering alerts.

        Returns:
            list: A list containing a dictionary with the module's name, calculated
                score, weightage, and detailed results of each rule evaluation.
        """
        print("Inside _compute_emlock_pi_score")
        pi_score = []

        for rule in rules['rules']:
            if rule['model'] != 'EMLock':
                continue

            query = (
                f"SELECT DISTINCT(vehicle_number), interlock_name, severity "
                f"FROM alerts "
                f"WHERE sap_id = '{location_id}' "
                f"AND alert_status != 'Close' "
                f"AND bu = 'TAS' "
                f"AND alert_section = 'EMLock' "
                f"AND severity IN ('Critical', 'High')"
            )
            data = await hpcl_ceg_model.Alerts.get_aggr_data(query)

            vehicles_with_critical_or_high = {
                record['vehicle_number'] for record in data.get('data', [])
                if record.get('vehicle_number')
            }

            total_vehicles = 190  # Hardcoded total
            df = pd.read_csv(os.path.join(os.path.dirname(hpcl_ceg_model.__file__), '..',
                                          'orchestrator', 'reporting_services',
                                          'vehicle_master_count_of_tt_no.csv'))
            df = df[df['sap_id'] == int(location_id)]

            if not df.empty:
                total_vehicles = df['count_of_tt_no'].sum()
            affected_vehicles = len(vehicles_with_critical_or_high)
            print("total_vehicles -->", total_vehicles)
            print("affected_vehicles -->", affected_vehicles)

            # Compute percentage
            if total_vehicles > 0:
                percentage_score = round(
                    ((total_vehicles - affected_vehicles) / total_vehicles) * 100, 2)
            else:
                percentage_score = 100.0

            scaled_score = round((percentage_score * rule['weightage']) / 100, 2)
            print("percentage_score -->", percentage_score)
            print("scaled_score -->", scaled_score)

            # Generate appropriate message
            if abs(scaled_score - rule['weightage']) < 0.01:  # Full score achieved
                msg = f"No open alerts. EMLock system operating normally."
            else:
                msg = f"EMLock: {affected_vehicles} vehicles with Critical/High alerts out of {total_vehicles} total vehicles"

            result_item = {
                "name": rule['name'],
                "score": scaled_score,
                "weightage": rule['weightage'],
                "module": rules.get('name', ''),
                "msg": msg,
                "details": {
                    "affected_vehicles": affected_vehicles,
                    "total_vehicles": total_vehicles,
                    "percentage_score": percentage_score
                }
            }

            # Enhance with insights
            result_item = enhance_result_with_insights(result_item, "emlock")
            pi_score.append(result_item)

        print("emlock pi_score -->", pi_score)

        final_score = round(sum(r['score'] for r in pi_score), 2)
        print("emlock final_score -->", final_score)

        module_result = {
            "name": rules.get('name', ''),
            "score": final_score,
            "weightage": rules['weightage'],
            "results": pi_score
        }

        # Add module-level summary insights
        module_result["insights"] = generate_summary_insights(module_result)

        return module_result

    async def _compute_dryout_pi_score(self, name, rules, location_id):
        """
        Computes the Performance Index (PI) score for Dryouts and Carry forward based on open alerts.

        This function evaluates the performance of Dryouts and Carry forward by analyzing open alerts
        from the database and calculating scores based on the number of placed and executed carry
        forwards and dryouts. The score reflects the health of the system by comparing the number of
        placed carry forwards and dryouts to the number of executed ones.

        Args:
            name (str): The name of the module or rule being processed.
            rules (dict): A dictionary containing the rules for Dryouts and Carry forward, including 
                        interlock names, weightage, and model.
            location_id (str): The location identifier for filtering alerts.

        Returns:
            list: A list containing a dictionary with the module's name, calculated score, weightage, 
                and detailed results of each rule evaluation.
        """
        try:
            rule_list = rules['rules']  # Get the list inside the 'rules' key

            carry_forward_weight = [r['weightage'] for r in rule_list if
                                    r['name'] == 'Carry Forward']
            carry_forward_weight = carry_forward_weight[0] if carry_forward_weight else 0

            dryout_weight = [r['weightage'] for r in rule_list if r['name'] == 'Cat A Dryout']
            dryout_weight = dryout_weight[0] if dryout_weight else 0

            today_str = datetime.datetime.now().strftime('%Y-%m-%d')
            placed_carry_forward_count = 0
            placed_dryout_score = 0

            # Query for placed alerts (open and relevant conditions)
            query = """
                SELECT * FROM alerts 
                WHERE alert_status != 'Close' AND indent_status != 'Cancelled' 
                AND interlock_name = 'Dry Out Each Indent Wise MainFlow'
                AND progress_rate < 2 AND dry_out_in_days = '1'
            """
            data = await hpcl_ceg_model.Alerts.get_aggr_data(query)
            records = data.get('data', [])

            for record in records:
                alert_history = record.get('alert_history', [])

                if isinstance(alert_history, list):
                    for alert in alert_history:
                        if isinstance(alert, dict):
                            prod_reqd_dt = alert.get('prod_reqd_dt')

                            # Carry forward: prod_reqd_dt not today & category != R01
                            if prod_reqd_dt != today_str and record.get('category') != 'R01':
                                placed_carry_forward_count += 1

                # Cat A Dryout count
                if record.get('category') == 'R01':
                    placed_dryout_score += 1

            executed_carry_forward_count = 0
            executed_dryout_score = 0

            # Query for executed alerts (closed recently)
            query = """
                SELECT a.*, c.sap_id as c_sap_id, c.indent_no as c_indent_no
                FROM alerts a
                INNER JOIN carry_fwd_indent c
                    ON a.sap_id = c.sap_id AND a.indent_no = c.indent_no
                WHERE a.indent_status = 'Completed'
                AND a.interlock_name = 'Dry Out Each Indent Wise MainFlow'
                AND c.created_at >= CURRENT_DATE - INTERVAL '2 days'
                AND a.alert_status = 'Close' AND a.updated_at::date = NOW()::date
            """
            data = await hpcl_ceg_model.Alerts.get_aggr_data(query)
            records = data.get('data', [])

            for record in records:
                if record.get('category') != 'R01':
                    executed_carry_forward_count += 1

                if record.get('category') == 'R01':
                    executed_dryout_score += 1

            # Each part contributes 50 to total 100
            carry_forward_score = (
                (executed_carry_forward_count / placed_carry_forward_count) * 50
                if placed_carry_forward_count > 0 and executed_carry_forward_count > 0 else carry_forward_weight
            )

            dryout_score = (
                (executed_dryout_score / placed_dryout_score) * 50
                if placed_dryout_score > 0 and executed_dryout_score > 0 else dryout_weight
            )

            total_score = round(carry_forward_score + dryout_score, 2)
            print("Dryouts and Carry forward score -->", total_score)

            # Generate appropriate messages
            if abs(carry_forward_score - carry_forward_weight) < 0.01:  # Full score achieved
                carry_forward_msg = f"No open alerts. Carry Forward system operating normally."
            else:
                carry_forward_msg = f"Carry Forward: {executed_carry_forward_count} executed out of {placed_carry_forward_count} placed"
            
            if abs(dryout_score - dryout_weight) < 0.01:  # Full score achieved
                dryout_msg = f"No open alerts. Cat A Dryout system operating normally."
            else:
                dryout_msg = f"Cat A Dryout: {executed_dryout_score} executed out of {placed_dryout_score} placed"

            carry_forward_result = {
                "name": "Carry Forward",
                "score": carry_forward_score,
                "weightage": carry_forward_weight,
                "module": "Dryouts",
                "msg": carry_forward_msg,
                "details": {
                    "placed_count": placed_carry_forward_count,
                    "executed_count": executed_carry_forward_count,
                    "execution_rate": round(
                        (executed_carry_forward_count / placed_carry_forward_count * 100),
                        2) if placed_carry_forward_count > 0 else 0
                }
            }
            carry_forward_result = enhance_result_with_insights(carry_forward_result, "dryout")

            dryout_result = {
                "name": "Cat A Dryout",
                "score": dryout_score,
                "weightage": dryout_weight,
                "module": "Dryouts",
                "msg": dryout_msg,
                "details": {
                    "placed_count": placed_dryout_score,
                    "executed_count": executed_dryout_score,
                    "execution_rate": round((executed_dryout_score / placed_dryout_score * 100),
                                            2) if placed_dryout_score > 0 else 0
                }
            }
            dryout_result = enhance_result_with_insights(dryout_result, "dryout")

            module_result = {
                "name": "Dryouts and Carry forward",
                "score": total_score,
                "weightage": rules['weightage'],
                "results": [carry_forward_result, dryout_result]
            }

            # Add module-level summary insights
            module_result["insights"] = generate_summary_insights(module_result)

            return module_result

        except Exception as e:
            print(traceback.format_exc())
            print(f"Error calculating dryout/carry forward score: {e}")
            return {
                "name": "Dryouts and Carry forward",
                "score": 0.0,
                "weightage": rules['weightage'],
                "results": []
            }
