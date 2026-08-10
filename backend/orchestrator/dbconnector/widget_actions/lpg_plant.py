import urdhva_base
import utilities.helpers as helpers
import orchestrator.dbconnector.connector_factory as connector_factory
import orchestrator.dbconnector.widget_actions.lpg_plant_queries as lpg_plant_queries
from orchestrator.dashboard.chart_factory import charts_functions as execution_helpers
from orchestrator.dbconnector.widget_actions import widget_actions
import hpcl_ceg_model
import dashboard_studio_model
import psycopg2
from psycopg2 import sql, errors


class LPGPlantActions:
    @staticmethod
    async def get_next_level_drill_params(present_group):
        next_level_drill_params = {
                                   "column": "zone",
                                   "zone": "short_name",
                                   "short_name": "name",
                                   "name": "carousel",
                                   "carousel": ""}
        return next_level_drill_params.get(present_group, "")

    @staticmethod
    async def get_production_details(filters, drill_state):
        production_query = lpg_plant_queries.lpg_plant_query.get("production_query")
        print(production_query)
        if filters:
            production_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(production_query, filters, drill_state)
        else:
            production_query_ = production_query
        try:
            prod_keys, production_res = connector_factory.PostgreSQLConnector().execute_query(production_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            prod_keys, production_res = connector_factory.PostgreSQLConnector().execute_query(production_query)
        production_data = connector_factory.PostgreSQLConnector().process_recommendations(prod_keys, production_res)
        total_prod = production_data[0]["total_production"]
        avg_prod = production_data[0]["average_production"]

        rejection_query = lpg_plant_queries.lpg_plant_query.get("rejection_query")
        if filters:
            rejection_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(rejection_query, filters, drill_state )
        else:
            rejection_query_ = rejection_query
        try:
            rej_keys, rejection_res = connector_factory.PostgreSQLConnector().execute_query(rejection_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            rej_keys, rejection_res = connector_factory.PostgreSQLConnector().execute_query(rejection_query)
        cs_rejection_data = connector_factory.PostgreSQLConnector().process_recommendations(rej_keys, rejection_res)
        cs_rejection_data = cs_rejection_data[0]["cs_rejections"]
        
        total_gd_rejection = lpg_plant_queries.lpg_plant_query.get("total_gd_rejection")
        if filters:
            total_gd_rejection_ = await widget_actions.WidgetActions.apply_filter_drilldown(total_gd_rejection, filters, drill_state )
        else:
            total_gd_rejection_ = total_gd_rejection
        try:
            gd_rej_keys, gd_rejection_res = connector_factory.PostgreSQLConnector().execute_query(total_gd_rejection_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            gd_rej_keys, gd_rejection_res = connector_factory.PostgreSQLConnector().execute_query(total_gd_rejection)
        gd_rejection_data = connector_factory.PostgreSQLConnector().process_recommendations(gd_rej_keys, gd_rejection_res)
        gd_rejection_data = gd_rejection_data[0]["Percentage"]

        total_pt_rejection = lpg_plant_queries.lpg_plant_query.get("total_pt_rejection")
        if filters:
            total_pt_rejection_ = await widget_actions.WidgetActions.apply_filter_drilldown(total_pt_rejection, filters, drill_state )
        else:
            total_pt_rejection_ = total_pt_rejection
        try:
            pt_rej_keys, pt_rejection_res = connector_factory.PostgreSQLConnector().execute_query(total_pt_rejection_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            pt_rej_keys, pt_rejection_res = connector_factory.PostgreSQLConnector().execute_query(total_pt_rejection)
        pt_rejection_data = connector_factory.PostgreSQLConnector().process_recommendations(pt_rej_keys, pt_rejection_res)
        pt_rejection_data = pt_rejection_data[0]["AVG(sortoutpercentage)/100"]

        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data":
                    {
                      "Total Production (MT)": total_prod,
                      "Total Productivity (Cyl/Hr)": avg_prod,
                      "Total CS Rejection": cs_rejection_data,
                      "Total GD Rejection": gd_rejection_data,
                      "Total PT Rejection": pt_rejection_data
                    },
                "drill_down_column": drill_down_column
              }
    
    @staticmethod
    async def get_productivity_cyl_per_hour(filters, drill_state):
        productivity_cyl_per_hour = lpg_plant_queries.lpg_plant_query.get("productivity_cyl_per_hour")
        productivity_cyl_per_hour_= productivity_cyl_per_hour
        if filters:
            productivity_cyl_per_hour_ = await widget_actions.WidgetActions.apply_filter_drilldown(productivity_cyl_per_hour, filters, drill_state )
        try:
            keys, res = connector_factory.PostgreSQLConnector().execute_query(productivity_cyl_per_hour_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(productivity_cyl_per_hour)
        data = connector_factory.PostgreSQLConnector().process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}

    @staticmethod
    async def get_rejections_by_zones(filters, drill_state):
        rejections_by_zones_query = lpg_plant_queries.lpg_plant_query.get("rejections_by_zones")
        rejections_by_zones_query_ = rejections_by_zones_query
        if filters:
            rejections_by_zones_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(rejections_by_zones_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector().execute_query(rejections_by_zones_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(rejections_by_zones_query)
        data = connector_factory.PostgreSQLConnector().process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def get_daily_productivity_cyl_per_hour(filters, drill_state):
        daily_prod_query = lpg_plant_queries.lpg_plant_query.get("daily_productivity_cyl_per_hour")
        daily_prod_query_ = daily_prod_query
        if filters:
            daily_prod_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(daily_prod_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector().execute_query(daily_prod_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(daily_prod_query)
        print(res)
        keys, res = connector_factory.PostgreSQLConnector().execute_query(daily_prod_query)
        data = connector_factory.PostgreSQLConnector().process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def get_cyl_rejection_in_check_scale(filters, drill_state):
        cyl_rej_query = lpg_plant_queries.lpg_plant_query.get("cyl_rejection_in_check_scale")
        cyl_rej_query_ = cyl_rej_query
        if filters:
            cyl_rej_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(cyl_rej_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector().execute_query(cyl_rej_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(cyl_rej_query)
        print(res)
        data = connector_factory.PostgreSQLConnector().process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}

    @staticmethod
    async def get_cyl_rejection_in_gd(filters, drill_state):
        cyl_rej_query = lpg_plant_queries.lpg_plant_query.get("cyl_rejection_in_gd")
        cyl_rej_query_ = cyl_rej_query
        print("*"*100)
        if filters:
            cyl_rej_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(cyl_rej_query, filters, drill_state)
        try:
            print("cyl_rej_query updated: ", cyl_rej_query_)
            print("-"*100)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(cyl_rej_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            print("cyl_rej_query original: ", cyl_rej_query)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(cyl_rej_query)
        print(res)
        data = connector_factory.PostgreSQLConnector().process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def get_cyl_rejection_in_pt(filters, drill_state):
        cyl_rej_query = lpg_plant_queries.lpg_plant_query.get("cyl_rejection_in_pt")
        cyl_rej_query_ = cyl_rej_query
        if filters:
            cyl_rej_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(cyl_rej_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector().execute_query(cyl_rej_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(cyl_rej_query)
        print(res)
        data = connector_factory.PostgreSQLConnector().process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def get_cyl_count_by_carousel(filters, drill_state):
        cyl_carousel_query = lpg_plant_queries.lpg_plant_query.get("cyl_count_by_carousel")
        cyl_carousel_query_ = cyl_carousel_query
        if filters:
            cyl_carousel_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(cyl_carousel_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector().execute_query(cyl_carousel_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(cyl_carousel_query)
        data = connector_factory.PostgreSQLConnector().process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def get_cyl_count_by_zone(filters, drill_state):
        cyl_zone_query = lpg_plant_queries.lpg_plant_query.get("cyl_count_by_zone")
        cyl_zone_query_ = cyl_zone_query
        if filters:
            cyl_zone_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(cyl_zone_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector().execute_query(cyl_zone_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(cyl_zone_query)
        data = connector_factory.PostgreSQLConnector().process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def get_bottom_cs_plants(filters, drill_state):
        cs_plants_query = lpg_plant_queries.lpg_plant_query.get("bottom_cs_plants")
        cs_plants_query_ = cs_plants_query
        if filters:
            cs_plants_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(cs_plants_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector().execute_query(cs_plants_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(cs_plants_query)
        data = connector_factory.PostgreSQLConnector().process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def get_bottom_gd_plants(filters, drill_state):
        gd_plants_query = lpg_plant_queries.lpg_plant_query.get("bottom_gd_plants")
        gd_plants_query_ = gd_plants_query
        if filters:
            gd_plants_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(gd_plants_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector().execute_query(gd_plants_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(gd_plants_query)
        data = connector_factory.PostgreSQLConnector().process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def get_bottom_pt_plants(filters, drill_state):
        pt_plants_query = lpg_plant_queries.lpg_plant_query.get("bottom_pt_plants")
        pt_plants_query_ = pt_plants_query
        if filters:
            pt_plants_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(pt_plants_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector().execute_query(pt_plants_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(pt_plants_query)
        data = connector_factory.PostgreSQLConnector().process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def get_bottom_productivity_plants(filters, drill_state):
        prod_plants_query = lpg_plant_queries.lpg_plant_query.get("bottom_productivity_plants")
        prod_plants_query_ = prod_plants_query
        if filters:
            prod_plants_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(prod_plants_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector().execute_query(prod_plants_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(prod_plants_query)
        data = connector_factory.PostgreSQLConnector().process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def get_productivity_by_zone(filters, drill_state):
        prod_by_zone_query = lpg_plant_queries.lpg_plant_query.get("productivity_by_zone")
        prod_by_zone_query_ = prod_by_zone_query
        if filters:
            prod_by_zone_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(prod_by_zone_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector().execute_query(prod_by_zone_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(prod_by_zone_query)
        data = connector_factory.PostgreSQLConnector().process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def get_productivity_by_location(filters, drill_state):
        prod_by_location_query = lpg_plant_queries.lpg_plant_query.get("productivity_by_location")
        prod_by_location_query_ = prod_by_location_query
        if filters:
            prod_by_location_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(prod_by_location_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector().execute_query(prod_by_location_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(prod_by_location_query)
        data = connector_factory.PostgreSQLConnector().process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def get_consolidated_table(filters, drill_state):
        consolidated_tab_query = lpg_plant_queries.lpg_plant_query.get("consolidated_table")
        consolidated_tab_query_ = consolidated_tab_query
        if filters:
            consolidated_tab_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(consolidated_tab_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector().execute_query(consolidated_tab_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(consolidated_tab_query)
        data = connector_factory.PostgreSQLConnector().process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def get_top_productivity_plants(filters, drill_state):
        top_prod_query = lpg_plant_queries.lpg_plant_query.get("top_productivity_plants")
        top_prod_query_ =  top_prod_query
        if filters:
            top_prod_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(top_prod_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector().execute_query(top_prod_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector().execute_query(top_prod_query)
        data = connector_factory.PostgreSQLConnector().process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def high_alert_locations(filters, drill_state):
        high_alert_query = lpg_plant_queries.lpg_plant_query.get("high_alert_locations")
        high_alert_query_ = high_alert_query
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            high_alert_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(high_alert_query, filters, drill_state)
            print("high_alert_query_ --> ", high_alert_query_)
        try:
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(high_alert_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(high_alert_query)
        data = connector_factory.PostgreSQLConnector('LPG_PLANT').process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}

    @staticmethod
    async def critical_alert_locations(filters, drill_state):
        critical_alert_query = lpg_plant_queries.lpg_plant_query.get("critical_alert_locations")
        critical_alert_query_ = critical_alert_query
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            critical_alert_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(critical_alert_query, filters, drill_state)
            print("critical_alert_locations --> ", critical_alert_query_)
        try:
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(critical_alert_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(critical_alert_query)
        data = connector_factory.PostgreSQLConnector('LPG_PLANT').process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}

    @staticmethod
    async def sod_terminal(filters, drill_state):
        sod_terminal_query = lpg_plant_queries.lpg_plant_query.get("sod_terminal")
        sod_terminal_query_ = sod_terminal_query
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            sod_terminal_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(sod_terminal_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(sod_terminal_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(sod_terminal_query)
        data = connector_factory.PostgreSQLConnector('LPG_PLANT').process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def alert_categories(filters, drill_state):
        alert_categories_query = lpg_plant_queries.lpg_plant_query.get("alert_categories")
        alert_categories_query_ = alert_categories_query
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            alert_categories_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(alert_categories_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(alert_categories_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(alert_categories_query)
        data = connector_factory.PostgreSQLConnector('LPG_PLANT').process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}

    @staticmethod
    async def tas_alerts(filters, drill_state):
        tas_alerts_query = lpg_plant_queries.lpg_plant_query.get("tas_alerts")
        tas_alerts_query_ = tas_alerts_query
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            tas_alerts_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(tas_alerts_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(tas_alerts_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(tas_alerts_query)
        data = connector_factory.PostgreSQLConnector('LPG_PLANT').process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def non_tas_alerts(filters, drill_state):
        non_tas_alerts_query = lpg_plant_queries.lpg_plant_query.get("non_tas_alerts")
        non_tas_alerts_query_ = non_tas_alerts_query
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            non_tas_alerts_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(non_tas_alerts_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(non_tas_alerts_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(non_tas_alerts_query)
        data = connector_factory.PostgreSQLConnector('LPG_PLANT').process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
    
    @staticmethod
    async def no_of_terminals(filters, drill_state):
        no_of_terminals_query = lpg_plant_queries.lpg_plant_query.get("no_of_terminals")
        no_of_terminals_query_ = no_of_terminals_query
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            no_of_terminals_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(no_of_terminals_query, filters, drill_state)
        try:
            print("no_of_terminals_query_ --> ", no_of_terminals_query_)
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(no_of_terminals_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(no_of_terminals_query)
        data = connector_factory.PostgreSQLConnector('LPG_PLANT').process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}

    # @staticmethod
    # async def alert_ageing(filters, drill_state):
    #     alert_ageing_query = lpg_plant_queries.lpg_plant_query.get("alert_ageing")
    #     alert_ageing_query_ = alert_ageing_query
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
    #     if filters:
    #         alert_ageing_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(alert_ageing_query, filters, drill_state)
    #     try:
    #         keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(alert_ageing_query_)
    #     except psycopg2.errors.UndefinedColumn as e:
    #         print(e)
    #         keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(alert_ageing_query)
    #     data = connector_factory.PostgreSQLConnector('LPG_PLANT').process_recommendations(keys, res)
    #     if not drill_state:
    #         drill_state = "column"
    #     drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
    #     return {"status": True, "message": "success", "data": data,
    #             "drill_down_column": drill_down_column}
    
    @staticmethod
    async def alert_distributions(filters, drill_state):
        alert_distributions_query = lpg_plant_queries.lpg_plant_query.get("alert_distributions")
        alert_distributions_query_ = alert_distributions_query
        filters += [dashboard_studio_model.WidgetFiltersCreate(**rec)
                                      for rec in await hpcl_ceg_model.Alerts.get_clause_conditions(formated=True)]
        if filters:
            alert_distributions_query_ = await widget_actions.WidgetActions.apply_filter_drilldown(alert_distributions_query, filters, drill_state)
        try:
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(alert_distributions_query_)
        except psycopg2.errors.UndefinedColumn as e:
            print(e)
            keys, res = connector_factory.PostgreSQLConnector('LPG_PLANT').execute_query(alert_distributions_query)
        data = connector_factory.PostgreSQLConnector('LPG_PLANT').process_recommendations(keys, res)
        if not drill_state:
            drill_state = "column"
        drill_down_column = await LPGPlantActions.get_next_level_drill_params(drill_state)
        return {"status": True, "message": "success", "data": data,
                "drill_down_column": drill_down_column}
