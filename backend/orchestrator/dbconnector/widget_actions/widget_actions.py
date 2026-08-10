import urdhva_base
import re
import polars as pl
pl.Config(set_fmt_float="full")
from orchestrator.dbconnector import global_analytics
from orchestrator.dbconnector.widget_actions import (
    lpg_plant, 
    lpg_cdcms, 
    model_mapping, 
    vts_analytics,
    lpg_plant_queries, 
    lpg_plant_operations,    
    )
import hpcl_ceg_model

lpg_dashboard_actions = [
    'get_production_details',
    'get_productivity_cyl_per_hour',
    'get_rejections_by_zones',
    'get_daily_productivity_cyl_per_hour',
    'get_cyl_rejection_in_check_scale',
    'get_cyl_rejection_in_gd',
    'get_cyl_rejection_in_pt',
    'get_cyl_count_by_carousel',
    'get_cyl_count_by_zone',
    'get_bottom_cs_plants',
    'get_bottom_gd_plants',
    'get_bottom_pt_plants',
    'get_bottom_productivity_plants',
    'get_productivity_by_zone',
    'get_productivity_by_location',
    'get_consolidated_table',
    'get_top_productivity_plants',
    'high_alert_locations',
    'critical_alert_locations',
    'sod_terminal',
    'alert_categories',
    'tas_alerts',
    'non_tas_alerts',
    'no_of_terminals',
    'alert_ageing',
    'alert_distributions',
    'analytics',
    'no_of_locations',
    'day_wise_alerts',
    'location_severity_count',
    'severity_count',
    'hourly_alerts',
    'sales_performance',
    'sales_growth',
    'sales_yearly_performance',
    'lpg_cdcms',
    'cdcms_order_source',
    'overall_ctc_statistics',
    'lpg_cdcms_month',
    'cumulative_sales_pmuy_npmuy',
    'location_wise_distribution',
    'm60_performance',
    'retail_tar',
    'yearly_sales_performance',
    'overall_safety_check_pending',
    'total_suvidha',
    'lpg_cdcms_ageing',
    'total_consumers',
    'sales_growth_ytd',
    'ekyc_statistics',
    'cdcms_dropdown',
    'lpg_operations_productivity_zone',
    'lpg_operations_production_zone',
    'lpg_operations_filled_cylinder',
    'lpg_operations_rejections',
    'subsidy_failure_stats',
    'subsidy_exception_stats',
    'lpg_cdcms_subsidy_central_consumers',
    'lpg_cdcms_subsidy_central_transaction',
    'lpg_cdcms_subsidy_central_amount',
    'lpg_cdcms_subsidy_state_consumers',
    'lpg_cdcms_subsidy_state_transaction',
    'lpg_cdcms_subsidy_state_amount',
    'lpg_cdcms_sales_comparision',
    'lpg_cdcms_pcc',
    'lpg_cdcms_dbc_enrollments',
    'lpg_cdcms_nc_stats',
    'card_chart',
    'lpg_domestic_sale_table',
    'lpg_consumer_table',
    'industry_performance',
    'present_previous_month_sales_by_product',
    'sales_drop_down',
    'indent_dryout_counts',
    'indent_status_summary',
    'dryout_summary_by_product',
    'detailed_dryout_summary',
    'detailed_indent_status_summary',
    'dryout_product_report',
    'dryout_indent_report',
    'product_quantity_by_location',
    'ims_report',
    'lpg_operations_connected_plants',
    'lpg_operations_total_plants',
    'lpg_operations_total_handled',
    'lpg_operations_daywise_productivity',
    'lpg_operations_monthwise_productivity',
    'lpg_operations_monthwise_rejections',
    'lpg_operations_daywise_production',
    'cdcms_current_date_pending_count',
    'cdcms_current_date_bookings_count',
    'cdcms_current_date_sales_count',
    'maintenance_fault',
    'interlock_name_count',
    'tas_maintenance_fault',
    'tas_maintenance_fault_dropdown',
    'tas_normal_count',
    'tas_analog_count',
    'local_loaded',
    'unauthorised_flow',
    'sick_tts',
    'cancelled_tts',
    'kfactor',
    'manualfanprinted',
    'overloaded_tts',
    'mfmkfactor',
    'bay_reassignment'
    'get_total_production_today_data',
    'get_total_productivity_today_data',
    'get_productivity_moving_average',
    'get_productivity_summary',
    'get_eld_old_rejections',
    'get_eld_drill_down',
    'get_old_drill_down',
    'underfill_overfill_scales',
    'under_performance_scales',
    'plant_month_analysis'
]

# Todo:- import all widget action modules here
widget_mapping = {
    'lpg_production': {},
    'lpg_productivity_cyl_per_hour':{},
    'get_production_details': {},
    'get_productivity_cyl_per_hour': {},
    'get_rejections_by_zones':{},
    'get_daily_productivity_cyl_per_hour': {},
    'get_cyl_rejection_in_check_scale': {},
    'get_cyl_rejection_in_gd': {},
    'get_cyl_rejection_in_pt': {},
    'get_cyl_count_by_carousel': {},
    'get_cyl_count_by_zone': {},
    'get_bottom_cs_plants': {},
    'get_bottom_gd_plants': {},
    'get_bottom_pt_plants': {},
    'get_bottom_productivity_plants': {},
    'get_productivity_by_zone': {},
    'get_productivity_by_location': {},
    'get_consolidated_table': {},
    'get_top_productivity_plants': {},
    'high_alert_locations': {},
    'critical_alert_locations': {},
    'sod_terminal': {},
    'alert_categories': {},
    'tas_alerts': {},
    'non_tas_alerts':{},
    'no_of_terminals':{},
    'alert_ageing': {},
    'alert_distributions': {},
    'analytics': {},
    'no_of_locations': {},
    'day_wise_alerts': {},
    'location_severity_count': {},
    'severity_count': {},
    'hourly_alerts': {},
    'sales_performance': {},
    'sales_growth': {},
    'sales_yearly_performance': {},
    'lpg_cdcms': {},
    'cdcms_order_source': {},
    'lpg_cdcms_month': {},
    'cumulative_sales_pmuy_npmuy': {},
    'overall_ctc_statistics': {},
    'location_wise_distribution': {},
    'm60_performance': {},
    'retail_tar': {},
    'yearly_sales_performance': {},
    'overall_safety_check_pending': {},
    'tibco_lubes_production': {'module_name': '', 'func_name': ''},
    'lpg_ca_cdm': {'module_name': '', 'func_name': ''},
    'total_suvidha': {},
    'lpg_cdcms_ageing': {},
    'total_consumers': {},
    'ekyc_statistics': {},
    'sales_growth_ytd': {},
    'carry_forward_analysis': {},
    'cdcms_dropdown': {},
    'lpg_operations_productivity_zone': {},
    'lpg_operations_production_zone': {},
    'lpg_operations_filled_cylinder': {},
    'lpg_operations_rejections': {},
    'subsidy_failure_stats': {},
    'subsidy_exception_stats': {},
    'lpg_cdcms_subsidy_central_consumers': {},
    'lpg_cdcms_subsidy_central_transaction': {},
    'lpg_cdcms_subsidy_central_amount': {},
    'lpg_cdcms_subsidy_state_consumers': {},
    'lpg_cdcms_subsidy_state_transaction': {},
    'lpg_cdcms_subsidy_state_amount': {},
    'lpg_cdcms_sales_comparision': {},
    'lpg_cdcms_pcc': {},
    'lpg_cdcms_dbc_enrollments': {},
    'lpg_cdcms_nc_stats': {},
    'card_chart': {},
    'lpg_domestic_sale_table': {},
    'lpg_consumer_table': {},
    'industry_performance':{},
    'present_previous_month_sales_by_product': {},
    'sales_drop_down': {},
    'indent_dryout_counts': {},
    'indent_status_summary': {},
    'dryout_summary_by_product': {},
    'detailed_dryout_summary': {},
    'detailed_indent_status_summary': {},
    'dryout_product_report': {},
    'dryout_indent_report': {},
    'product_quantity_by_location': {},
    'ims_report': {},
    'lpg_operations_connected_plants': {},
    'lpg_operations_total_plants': {},
    'lpg_operations_total_handled': {},
    'lpg_operations_daywise_productivity': {},
    'lpg_operations_monthwise_productivity': {},
    'lpg_operations_monthwise_rejections': {},
    'lpg_operations_daywise_production': {},
    'cdcms_current_date_pending_count': {},
    'cdcms_current_date_bookings_count': {},
    'cdcms_current_date_sales_count': {},
    'maintenance_fault': {},
    'interlock_name_count': {},
    'tas_maintenance_fault': {},
    'tas_maintenance_fault_dropdown': {},
    'tas_normal_count': {},
    'tas_analog_count': {},
    'local_loaded': {},
    'unauthorised_flow': {},
    'sick_tts': {},
    'cancelled_tts': {},
    'kfactor': {},
    'manualfanprinted': {},
    'overloaded_tts': {},
    'mfmkfactor': {},
    'bay_reassignment': {},
    'get_total_production_today_data': {},
    'get_total_productivity_today_data': {},
    'get_productivity_moving_average': {},
    'get_productivity_summary': {},
    'get_eld_old_rejections': {},
    'get_eld_drill_down': {},
    'get_old_drill_down': {},
    'underfill_overfill_scales': {},
    'under_performance_scales': {},
    'plant_month_analysis':{}
}


class WidgetActions:
    @staticmethod
    # Safely resolve the module and function
    async def execute_widget_action(func_name, filters, cross_filters, drill_state, limit=0, time_grain="Monthly",
                                    resp_format='',resp_level='', payload={}):
        try:                       
            # Debugging: Log the input function name
            print(f"Received func_name: {func_name}")
            lp_operation = False
            vts = False
            # Determine the module containing the function
            if hasattr(lpg_plant.LPGPlantActions, func_name):
                module = lpg_plant.LPGPlantActions
                print(f"Function {func_name} found in LPGPlantActions.")
            elif hasattr(lpg_cdcms.LPGCDCMSActions, func_name):
                module = lpg_cdcms.LPGCDCMSActions
                print(f"Function {func_name} found in LPGCDCMSActions.")
            elif hasattr(lpg_plant_operations.LPGOperationsActions, func_name):
                module = lpg_plant_operations.LPGOperationsActions
                lp_operation = True
                print(f"Function {func_name} found in LPGOperationsActions.")
            elif hasattr(vts_analytics.VTSAnalyticsActions, func_name):
                module = vts_analytics.VTSAnalyticsActions
                vts = True
                print(f"Function {func_name} found in VTSAnalyticsActions.")
            
            elif func_name in ["get_tt_risk_score", "get_transporter_risk_score", "get_completed_trips_risk_score", "Cluster_master", "get_location_risk_score"]:
                # Special routing for risk score functions
                if not isinstance(payload, dict):
                    payload = {}
                payload['action'] = func_name  # Pass original function name in payload
                module = vts_analytics.VTSAnalyticsActions
                func_name = "risk_score"  # Route to the generic risk_score method
                vts = True

            elif hasattr(global_analytics.GlobalAnalytics, func_name):
                module = global_analytics.GlobalAnalytics
                print(f"Function {func_name} found in GlobalAnalytics.")
            else:
                raise AttributeError(f"Function {func_name} not found in either module.")

            # Retrieve the function from the resolved module
            func = getattr(module, func_name)
            # print(f"Resolved function: {dir(func)}")

            # Execute the function asynchronously
            if func_name in ['present_previous_month_sales_by_product']:
                res = await func(filters=filters, cross_filters=cross_filters, drill_state=drill_state, limit=limit, time_grain=time_grain)
            elif func_name in ['m60_performance', 'industry_performance', 'retail_tar']:
                res = await func(filters=filters, cross_filters=cross_filters, drill_state=drill_state,
                                 time_grain=time_grain, resp_format=resp_format,resp_level=resp_level)
            elif func_name in ['lpg_cdcms_booking_vs_sales_vs_pending']:
                res = await func(filters=filters, cross_filters=cross_filters, drill_state=drill_state,payload=payload)
            elif func_name in ['dry_out_ro_loss']:
                res = await func(filters=filters, cross_filters=cross_filters, drill_state=drill_state, resp_level=resp_level)
            elif lp_operation:
                res = await func(data=payload)
            elif vts:
                res = await func(filters=filters, cross_filters=cross_filters, drill_state=drill_state, payload=payload)
            else:
                res = await func(filters=filters, cross_filters=cross_filters, drill_state=drill_state)
            return res
        
        except AttributeError as e:
            # Handle case where the function name is invalid
            raise RuntimeError(
                f"Error resolving function: {func_name} not found. "
                f"Checked in LPGPlantActions: {hasattr(lpg_plant.LPGPlantActions, func_name)}, "
                f"and GlobalAnalytics: {hasattr(global_analytics.GlobalAnalytics, func_name)}. "
                f"Original error: {e}"
            )


    @staticmethod
    async def execute_cross_filters(filters):
        final_data = []
        for func in lpg_dashboard_actions:
            final_data.append({func: await eval(f"lpg_plant.LPGPlantActions.{func}")(filters, "")})
        return {"status": True, "message": "success", "data": final_data}
    
    @staticmethod
    async def generate_filter_clause(filters):
        conditions = []
        for filter_item in filters:
            if not isinstance(filter_item, dict):
                filter_item = filter_item.dict()
            key = filter_item['key']
            condition = filter_item['cond']
            value = filter_item['value']

            if condition in ['=', 'equals']:
                if '.' in key:
                    if isinstance(value, int):
                        conditions.append(f''' {key} = {value} ''')
                    else:
                        conditions.append(f''' {key} = '{value}' ''')
                else:
                    if isinstance(value, int):
                        conditions.append(f''' "{key}" = {value} ''')
                    else:
                        conditions.append(f''' "{key}" = '{value}' ''')
            elif condition == 'prefix':
                conditions.append(f"{key} LIKE '{value}%'")
            elif condition == 'contains':
                conditions.append(f"{key} LIKE '%{value}%'")
            elif condition == 'suffix':
                conditions.append(f"{key} LIKE '%{value}'")
            # elif condition in [' ', 'one-off', 'in'] and isinstance(value, list):
            #     values = "', '".join(map(str, value))
            #     conditions.append(f''' "{key}" IN ('{values}') ''')
            elif condition in [' ', 'one-off', 'in']:
                if isinstance(value, str):
                    values_list = [v.strip() for v in value.split(',')]
                elif isinstance(value, list):
                    values_list = [str(v).strip() for v in value]
                else:
                    values_list = []
                values = "', '".join(values_list)
                conditions.append(f''' "{key}" IN ('{values}') ''')
            elif condition == 'pattern':
                conditions.append(f"{key} ILIKE '%{value}%'")
            elif condition == 'date_filter':
                if value == '24h':
                    conditions.append(f"{key} >= CURRENT_TIMESTAMP - INTERVAL '24 hours'")
                elif value == 't':
                    conditions.append(f"{key}::DATE = CURRENT_DATE")
                elif value == '1d' or value == '1y':
                    conditions.append(f"{key}::DATE = CURRENT_DATE - INTERVAL '1 DAY'")
                elif value == '1w':
                    conditions.append(f"{key}::DATE >= CURRENT_DATE - INTERVAL '7 DAY'")
                elif value == '15d':
                    conditions.append(f"{key}::DATE >= CURRENT_DATE - INTERVAL '15 DAY'")
                elif value == '1m':
                    conditions.append(f"{key}::DATE >= CURRENT_DATE - INTERVAL '1 MONTH'") 
                elif value == '3m':
                    conditions.append(f"{key}::DATE >= CURRENT_DATE - INTERVAL '3 MONTH'")
                elif len(value.split(",")) == 2:
                    value = value.split(",")
                    start, end = value
                    if not isinstance(value, str):
                        if len(value) == 1:
                            conditions.append(f"{key}::DATE = '{value}'")
                        else:
                            conditions.append(f"{key}::DATE BETWEEN '{start}' AND '{end}'")
            elif condition == 'date_range':
                value = value.split(",")
                start, end = value
                if not isinstance(value, str):
                    if len(value) == 1:
                        conditions.append(f"{key}::DATE = '{value}'")
                    else:
                        conditions.append(f"{key}::DATE BETWEEN '{start}' AND '{end}'")   
            else:
                raise ValueError(f"Unsupported condition: {condition}")
        conditions_ = " AND ".join(conditions)
        # print("conditions_: ", conditions_)
        return conditions_
    
    @staticmethod
    async def get_not_join_query(user_query, filters, drill_column):
        # query contains where clause, add organization id directly in the where clause
        filter_conditions = await WidgetActions.generate_filter_clause(filters)
        if re.search(r'\bwhere\b', user_query, re.IGNORECASE):
            splitted_query = re.split(r'\bwhere\b', user_query, flags=re.IGNORECASE)
            splitted_query[1] = filter_conditions + " AND " + splitted_query[1]
            user_query_ = f"{splitted_query[0]} WHERE {splitted_query[1]}"
            return user_query_

        # query doesn't contain where clause, check for group by clause or order by clause or limit
        #   -> to place the where condition of organization id before the group by or order by or limit

        elif not re.search(r'\bwhere\b', user_query, re.IGNORECASE):
            where_cond = f" WHERE {filter_conditions}"
            user_query = user_query.strip().rstrip(';')

            if re.search(r'\bgroup by\b', user_query, re.IGNORECASE):
                clause_split = re.split(r'\bgroup by\b', user_query, flags=re.IGNORECASE)
                user_q = f"{clause_split[0]}{where_cond} GROUP BY {clause_split[1]}"

            elif re.search(r'\border by\b', user_query, re.IGNORECASE):
                clause_split = re.split(r'\border by\b', user_query, flags=re.IGNORECASE)
                user_q = f"{clause_split[0]}{where_cond} ORDER BY {clause_split[1]}"

            elif re.search(r'\blimit\b', user_query, re.IGNORECASE):
                clause_split = re.split(r'\blimit\b', user_query, flags=re.IGNORECASE)
                user_q = f"{clause_split[0]}{where_cond} LIMIT {clause_split[1]}"

            else:
                user_query += where_cond
                user_q = user_query
            return user_q
    
    @staticmethod
    async def get_join_query(user_query, filters, drill_column):
        aliases = re.findall(r'\bFROM\s+\w+\s+as\s+(\w+)|\bJOIN\s+\w+\s+as\s+(\w+)', user_query, re.IGNORECASE)
        table_aliases = [alias for group in aliases for alias in group if alias]
        # org_id_condition = " AND".join(f" {alias}.organization_id = {organization_id}" for alias in table_aliases)
        # print("org_id_condition: ",org_id_condition)
        filter_conditions = await WidgetActions.generate_filter_clause(filters)

        # query contains where clause, add organization id directly in the where clause
        if re.search(r'\bwhere\b', user_query, re.IGNORECASE):
            splitted_query = re.split(r'\bwhere\b', user_query, flags=re.IGNORECASE, maxsplit=1)
            splitted_query[1] = f"{filter_conditions} AND " + splitted_query[1]
            user_query_ = f"{splitted_query[0]} WHERE {splitted_query[1]}"
            
            return user_query_

        # query doesn't contain where clause, check for group by clause or order by clause or limit
        #   -> to place the where condition of organization id before the group by or order by or limit

        elif not re.search(r'\bwhere\b', user_query, re.IGNORECASE):
            where_cond = f" WHERE {filter_conditions}"
            if re.search(r'\bgroup by\b', user_query, re.IGNORECASE):
                clause_split = re.split(r'\bgroup by\b', user_query, flags=re.IGNORECASE)
                user_q = f"{clause_split[0]}{where_cond} GROUP BY {clause_split[1]}"

            elif re.search(r'\border by\b', user_query, re.IGNORECASE):
                clause_split = re.split(r'\border by\b', user_query, flags=re.IGNORECASE)
                user_q = f"{clause_split[0]}{where_cond} ORDER BY {clause_split[1]}"

            elif re.search(r'\blimit\b', user_query, re.IGNORECASE):
                clause_split = re.split(r'\blimit\b', user_query, flags=re.IGNORECASE)
                user_q = f"{clause_split[0]}{where_cond} LIMIT {clause_split[1]}"

            else:
                user_query += where_cond
                user_q = user_query
            return user_q
        
    @staticmethod
    async def apply_filter_drilldown(query, filters, drilldown):
        if filters:
            if 'join' in query.lower():
                updated_query = await WidgetActions.get_join_query(query, filters, drilldown)
            else:
                updated_query = await WidgetActions.get_not_join_query(query, filters,drilldown)
            return updated_query
        else:
            return query
        
