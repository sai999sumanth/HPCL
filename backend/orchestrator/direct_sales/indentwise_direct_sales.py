import urdhva_base
import asyncio
import fastapi
import re
import charts_actions
import dashboard_studio_model
import ast
import polars as pl

logger = urdhva_base.logger.Logger.getInstance("direct-sales-logging")

class IndentDryOutDirectSales:

    async def flatten_sales_areas(self, rows):
        out = []

        for rec in rows:
            val = rec['sales_area']

            # CASE 1: value is a string that looks like a list
            if isinstance(val, str) and val.startswith('[') and val.endswith(']'):
                try:
                    parsed = ast.literal_eval(val)  # convert string → actual list
                    out.extend(parsed)
                except:
                    out.append(val)

            # CASE 2: value is a real list
            elif isinstance(val, list):
                out.extend(val)

            # CASE 3: normal single string
            else:
                if val:  # skip empty strings
                    out.append(val)

        cleaned = list(set(out))

        print('*' * 100)
        print('Flattened sales_area:', cleaned)
        print('*' * 100)

        return cleaned
    
    async def get_clause_conditions(self):
        clause_conditions = {}
        if urdhva_base.ctx.exists():
            rpt = urdhva_base.context.context.get('rpt', {})
            sap_id = rpt.get('sap_id')
            if sap_id:
                clause_conditions['DEALER_CODE'] = sap_id
            elif rpt.get('sales_area'):
                clause_conditions['SALES_AREA'] = rpt.get('sales_area')
            elif rpt.get('region'):
                regions = "', '".join(rpt['region'])
                query = f"""select DISTINCT sales_area from location_master where region IN ('{regions}') and bu='DS' """
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
                if resp['data']:
                    clause_conditions['SALES_AREA'] = await self.flatten_sales_areas(resp['data'])
            elif rpt.get('zone'):
                zones = "', '".join(rpt['zone'])
                query = f"""select DISTINCT sales_area from location_master where region IN ('{zones}') and bu='DS' """
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
                if resp['data']:
                    clause_conditions['SALES_AREA'] = await self.flatten_sales_areas(resp['data'])
        return [{'key': key, 'value': value} for key, value in clause_conditions.items()]
    
    async def generate_filters(self, data):
        filters = {}
        for record in data.filters:
            if record.key == "dealer_id" and record.value:
                filters['DEALER_CODE'] = record.value
            elif record.key == "sales_area" and record.value:
                filters['SALES_AREA'] = record.value
            elif record.key == "product_code" and record.value:
                filters['PROD'] = record.value
            elif record.key == "region" and record.value:
                regions = "', '".join(record.value)
                query = f"""select DISTINCT sales_area from location_master where region IN ('{regions}') and bu='DS' """
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
                if resp['data']:
                    filters['SALES_AREA'] = await self.flatten_sales_areas(resp['data'])
            elif record.key == "zone" and record.value:
                zones = "', '".join(record.value)
                query = f"""select DISTINCT sales_area from location_master where zone IN ('{zones}') and bu='DS' """
                resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
                if resp['data']:
                    filters['SALES_AREA'] = await self.flatten_sales_areas(resp['data'])

        return [{'key': key, 'value': value} for key, value in filters.items()]
    
    async def build_clause_conditions(self, data):
        clause_conditions = await self.get_clause_conditions()
        filters = await self.generate_filters(data)
        return clause_conditions + filters

    async def get_indent_raised_direct_sales(self,data):
        for rec in data.filters:
            for index, val in enumerate(rec.value):
                if not val:
                    continue
                if not re.fullmatch('^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$', val):
                    raise fastapi.HTTPException(
                        status_code=422,
                        detail=f"values[{index}] not matching criteria"
                    )
        
        conditions = await self.build_clause_conditions(data)
        where_clause = []
        for condition in conditions:
            condition_key = condition['key']
            condition_value = condition['value']
            if condition_key == 'DEALER_CODE':
                dealers = "', '".join(condition_value)
                where_clause.append(f"""SUBSTR(ir."DEALER_CODE",3,8) IN ('{dealers}')""")
            elif condition_key == 'SALES_AREA':
                sales_area = "', '".join(condition_value)
                where_clause.append(f"""dd."SAREA_DESC" IN ('{sales_area}')""")
            elif condition_key == 'PROD':
                product_code = "', '".join(condition_value)
                where_clause.append(f"""ip."PROD" IN ('{product_code}')""")
        
        ims_query = f"""
                    SELECT DISTINCT ir."INDENT_NO", ir."INDENT_DATE",ip."PROD", ir."PROD_REQD_DT", SUBSTR(ir."DEALER_CODE",3,8) AS "DEALER_CODE",
                    dd."DEALER_NAME" AS "CUSTOMER NAME", ir."TRUCK_REGNO", ir."VALID_INDENT", ir."CANCEL_INDENT"
                    FROM "IMS_SAP"."INDENT_REQUEST" ir 
                    INNER JOIN "IMS_SAP"."DEALER_DETAILS" dd ON ir.DEALER_CODE = dd.DEALER_CODE
                    INNER JOIN "IMS_SAP"."INDENT_PRODUCTS" ip ON ir."DEALER_CODE" = ip."DEALER_CODE"
                    WHERE 
                    TO_CHAR(ir."PROD_REQD_DT",'yyyymmdd') =  TO_CHAR(SYSDATE,'yyyymmdd')
                    AND SUBSTR(ir."DEALER_CODE",15,2)='12'
                    """
        
        if where_clause:
            ims_query +=  ' AND ' + ' AND '.join(where_clause)

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        indent_raised_resp = await function(query=ims_query)
        if indent_raised_resp:
            df = pl.DataFrame(indent_raised_resp)
            return {
                "status": "success",
                "indent_raised_count": len(indent_raised_resp),
                "data": df.to_dicts()
            }
        return {
            "status": "success",
            "indent_raised_count": 0,
            "data": []
            }
        
    async def get_indent_on_hold_direct_sales(self,data):
        for rec in data.filters:
            for index, val in enumerate(rec.value):
                if not val:
                    continue
                if not re.fullmatch('^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$', val):
                    raise fastapi.HTTPException(
                        status_code=422,
                        detail=f"values[{index}] not matching criteria"
                    )
                
        conditions = await self.build_clause_conditions(data)
        where_clause = []
        for condition in conditions:
            condition_key = condition['key']
            condition_value = condition['value']
            if condition_key == 'DEALER_CODE':
                dealers = "', '".join(condition_value)
                where_clause.append(f"""SUBSTR(ir."DEALER_CODE",3,8) IN ('{dealers}')""")
            elif condition_key == 'SALES_AREA':
                sales_area = "', '".join(condition_value)
                where_clause.append(f"""dd."SAREA_DESC" IN ('{sales_area}')""")
            elif condition_key == 'PROD':
                product_code = "', '".join(condition_value)
                where_clause.append(f"""ip."PROD" IN ('{product_code}')""")

        ims_query = f"""
                        SELECT DISTINCT ir."INDENT_NO", ir."INDENT_DATE",ip."PROD", ir."PROD_REQD_DT", SUBSTR(ir."DEALER_CODE",3,8) AS "DEALER_CODE",
                        dd."DEALER_NAME" AS "CUSTOMER NAME", ir."TRUCK_REGNO", ir."VALID_INDENT", ir."CANCEL_INDENT" 
                        FROM "IMS_SAP"."INDENT_REQUEST" ir 
                        INNER JOIN "IMS_SAP"."DEALER_DETAILS" dd ON ir.DEALER_CODE = dd.DEALER_CODE 
                        INNER JOIN "IMS_SAP"."INDENT_PRODUCTS" ip ON ir."DEALER_CODE" = ip."DEALER_CODE"
                        WHERE 
                        TO_CHAR(ir."PROD_REQD_DT",'yyyymmdd') =  TO_CHAR(SYSDATE,'yyyymmdd') 
                        AND SUBSTR(ir."DEALER_CODE",15,2)='12' AND ir."VALID_INDENT" = 'N' 
                        AND (ir."CANCEL_INDENT" IS NULL OR ir."CANCEL_INDENT" <> 'Y')
                    """
        
        if where_clause:
            ims_query +=  ' AND ' + ' AND '.join(where_clause)

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        indent_raised_resp = await function(query=ims_query)
        if indent_raised_resp:
            df = pl.DataFrame(indent_raised_resp)
            return {
                "status": "success",
                "indent_on_hold_count": len(indent_raised_resp),
                "data": df.to_dicts()
            }
        return {
            "status": "success",
            "indent_on_hold_count": 0,
            "data": []
            }

    async def get_pending_indents_direct_sales(self,data):
        for rec in data.filters:
            for index, val in enumerate(rec.value):
                if not val:
                    continue
                if not re.fullmatch('^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$', val):
                    raise fastapi.HTTPException(
                        status_code=422,
                        detail=f"values[{index}] not matching criteria"
                    )
        
        conditions = await self.build_clause_conditions(data)
        where_clause = []
        for condition in conditions:
            condition_key = condition['key']
            condition_value = condition['value']
            if condition_key == 'DEALER_CODE':
                dealers = "', '".join(condition_value)
                where_clause.append(f"""SUBSTR(ir."DEALER_CODE",3,8) IN ('{dealers}')""")
            elif condition_key == 'SALES_AREA':
                sales_area = "', '".join(condition_value)
                where_clause.append(f"""dd."SAREA_DESC" IN ('{sales_area}')""")
            elif condition_key == 'PROD':
                product_code = "', '".join(condition_value)
                where_clause.append(f"""ip."PROD" IN ('{product_code}')""")

        ims_query = f"""
                        SELECT DISTINCT ir."INDENT_NO", ir."INDENT_DATE", ip."PROD", ir."PROD_REQD_DT", SUBSTR(ir."DEALER_CODE",3,8) AS "DEALER_CODE", 
                        dd."DEALER_NAME" AS "CUSTOMER NAME", ir."TRUCK_REGNO",
                        ir."VALID_INDENT", ir."CANCEL_INDENT" FROM "IMS_SAP"."INDENT_REQUEST" ir 
                        INNER JOIN "IMS_SAP"."DEALER_DETAILS" dd ON ir.DEALER_CODE = dd.DEALER_CODE 
                        INNER JOIN "IMS_SAP"."INDENT_PRODUCTS" ip ON ir."DEALER_CODE" = ip."DEALER_CODE"
                        WHERE 
                        TO_CHAR(ir."PROD_REQD_DT",'yyyymmdd') =  TO_CHAR(SYSDATE,'yyyymmdd')
                        AND SUBSTR(ir."DEALER_CODE",15,2)='12' AND ir."TRUCK_REGNO" IS NULL 
                        AND ir."VALID_INDENT" <> 'N' 
                        AND (ir."CANCEL_INDENT" IS NULL OR ir."CANCEL_INDENT" <> 'Y')
                    """
        
        if where_clause:
            ims_query +=  ' AND ' + ' AND '.join(where_clause)

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        indent_raised_resp = await function(query=ims_query)
        if indent_raised_resp:
            df = pl.DataFrame(indent_raised_resp)
            return {
                "status": "success",
                "pending_indent_count": len(indent_raised_resp),
                "data": df.to_dicts()
            }
        return {
            "status": "success",
            "pending_indent_count": 0,
            "data": []
            }
    
    async def get_valid_indent_direct_sales(self,data):
        for rec in data.filters:
            for index, val in enumerate(rec.value):
                if not val:
                    continue
                if not re.fullmatch('^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$', val):
                    raise fastapi.HTTPException(
                        status_code=422,
                        detail=f"values[{index}] not matching criteria"
                    )
        
        conditions = await self.build_clause_conditions(data)
        where_clause = []
        for condition in conditions:
            condition_key = condition['key']
            condition_value = condition['value']
            if condition_key == 'DEALER_CODE':
                dealers = "', '".join(condition_value)
                where_clause.append(f"""SUBSTR(ir."DEALER_CODE",3,8) IN ('{dealers}')""")
            elif condition_key == 'SALES_AREA':
                sales_area = "', '".join(condition_value)
                where_clause.append(f"""dd."SAREA_DESC" IN ('{sales_area}')""")
            elif condition_key == 'PROD':
                product_code = "', '".join(condition_value)
                where_clause.append(f"""ip."PROD" IN ('{product_code}')""")

        ims_query = f"""
                        SELECT DISTINCT ir."INDENT_NO", ir."INDENT_DATE", ip."PROD", ir."PROD_REQD_DT", SUBSTR(ir."DEALER_CODE",3,8) AS "DEALER_CODE", 
                        dd."DEALER_NAME" AS "CUSTOMER NAME", ir."TRUCK_REGNO",
                        ir."VALID_INDENT", ir."CANCEL_INDENT" 
                        FROM "IMS_SAP"."INDENT_REQUEST" ir 
                        INNER JOIN "IMS_SAP"."DEALER_DETAILS" dd ON ir.DEALER_CODE = dd.DEALER_CODE 
                        INNER JOIN "IMS_SAP"."INDENT_PRODUCTS" ip ON ir."DEALER_CODE" = ip."DEALER_CODE"
                        WHERE 
                        TO_CHAR(ir."PROD_REQD_DT",'yyyymmdd') =  TO_CHAR(SYSDATE,'yyyymmdd')
                        AND SUBSTR(ir."DEALER_CODE",15,2)='12' AND ir."VALID_INDENT" IN ('Y','H') 
                        AND (ir."CANCEL_INDENT" IS NULL OR ir."CANCEL_INDENT" <> 'Y')
                        AND ir."TRUCK_REGNO" IS NOT NULL
                    """
        
        if where_clause:
            ims_query +=  ' AND ' + ' AND '.join(where_clause)

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        indent_raised_resp = await function(query=ims_query)
        if indent_raised_resp:
            df = pl.DataFrame(indent_raised_resp)
            return {
                "status": "success",
                "valid_indent_count": len(indent_raised_resp),
                "data": df.to_dicts()
            }
        return {
            "status": "success",
            "valid_indent_count": 0,
            "data": []
            }
    
    async def get_cancelled_indent_direct_sales(self,data):
        for rec in data.filters:
            for index, val in enumerate(rec.value):
                if not val:
                    continue
                if not re.fullmatch('^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$', val):
                    raise fastapi.HTTPException(
                        status_code=422,
                        detail=f"values[{index}] not matching criteria"
                    )
        conditions = await self.build_clause_conditions(data)
        where_clause = []
        for condition in conditions:
            condition_key = condition['key']
            condition_value = condition['value']
            if condition_key == 'DEALER_CODE':
                dealers = "', '".join(condition_value)
                where_clause.append(f"""SUBSTR(ir."DEALER_CODE",3,8) IN ('{dealers}')""")
            elif condition_key == 'SALES_AREA':
                sales_area = "', '".join(condition_value)
                where_clause.append(f"""dd."SAREA_DESC" IN ('{sales_area}')""")
            elif condition_key == 'PROD':
                product_code = "', '".join(condition_value)
                where_clause.append(f"""ip."PROD" IN ('{product_code}')""")
        
        ims_query = f"""
                    SELECT DISTINCT ir."INDENT_NO", ir."INDENT_DATE", ip."PROD", ir."PROD_REQD_DT", SUBSTR(ir."DEALER_CODE",3,8) AS "DEALER_CODE", 
                    dd."DEALER_NAME" AS "CUSTOMER NAME", ir."TRUCK_REGNO", 
                    ir."VALID_INDENT", ir."CANCEL_INDENT"
                    FROM "IMS_SAP"."INDENT_REQUEST" ir 
                    INNER JOIN "IMS_SAP"."DEALER_DETAILS" dd ON ir.DEALER_CODE = dd.DEALER_CODE
                    INNER JOIN "IMS_SAP"."INDENT_PRODUCTS" ip ON ir."DEALER_CODE" = ip."DEALER_CODE" 
                    WHERE 
                    TO_CHAR(ir."PROD_REQD_DT",'yyyymmdd') =  TO_CHAR(SYSDATE,'yyyymmdd')
                    AND SUBSTR(ir."DEALER_CODE",15,2)='12' AND ir."CANCEL_INDENT" = 'Y'
                    """
        if where_clause:
            ims_query +=  ' AND ' + ' AND '.join(where_clause)
        
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        indent_raised_resp = await function(query=ims_query)
        if indent_raised_resp:
            df = pl.DataFrame(indent_raised_resp)
            return {
                "status": "success",
                "cancelled_indent_count": len(indent_raised_resp),
                "data": df.to_dicts()
            }
        return {
            "status": "success",
            "cancelled_indent_count": 0,
            "data": []
            }
    
    async def get_truck_allocated_direct_sales(self,data):
        for rec in data.filters:
            for index, val in enumerate(rec.value):
                if not val:
                    continue
                if not re.fullmatch('^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$', val):
                    raise fastapi.HTTPException(
                        status_code=422,
                        detail=f"values[{index}] not matching criteria"
                    )
        
        conditions = await self.build_clause_conditions(data)
        where_clause = []
        for condition in conditions:
            condition_key = condition['key']
            condition_value = condition['value']
            if condition_key == 'DEALER_CODE':
                dealers = "', '".join(condition_value)
                where_clause.append(f"""SUBSTR(ir."DEALER_CODE",3,8) IN ('{dealers}')""")
            elif condition_key == 'SALES_AREA':
                sales_area = "', '".join(condition_value)
                where_clause.append(f"""dd."SAREA_DESC" IN ('{sales_area}')""")
            elif condition_key == 'PROD':
                product_code = "', '".join(condition_value)
                where_clause.append(f"""ip."PROD" IN ('{product_code}')""")

        ims_query = f"""
                        SELECT DISTINCT ir."INDENT_NO", ir."INDENT_DATE", ip."PROD", ir."PROD_REQD_DT", SUBSTR(ir."DEALER_CODE",3,8) AS "DEALER_CODE", 
                        dd."DEALER_NAME" AS "CUSTOMER NAME", ir."TRUCK_REGNO",
                        ir."VALID_INDENT", ir."CANCEL_INDENT" FROM "IMS_SAP"."INDENT_REQUEST" ir 
                        INNER JOIN "IMS_SAP"."DEALER_DETAILS" dd ON ir.DEALER_CODE = dd.DEALER_CODE 
                        INNER JOIN "IMS_SAP"."INDENT_PRODUCTS" ip ON ir."DEALER_CODE" = ip."DEALER_CODE"
                        WHERE 
                        TO_CHAR(ir."PROD_REQD_DT",'yyyymmdd') =  TO_CHAR(SYSDATE,'yyyymmdd')
                        AND SUBSTR(ir."DEALER_CODE",15,2)='12' AND ir."VALID_INDENT" IN ('Y','H') 
                        AND (ir."CANCEL_INDENT" IS NULL OR ir."CANCEL_INDENT" <> 'Y')
                        AND ir."TRUCK_REGNO" IS NOT NULL AND ir."SEND_TO_JDE_TIME" IS NULL
                    """
        
        if where_clause:
            ims_query +=  ' AND ' + ' AND '.join(where_clause)

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        indent_raised_resp = await function(query=ims_query)
        if indent_raised_resp:
            df = pl.DataFrame(indent_raised_resp)
            return {
                "status": "success",
                "truck_allocated_count": len(indent_raised_resp),
                "data": df.to_dicts()
            }
        return {
            "status": "success",
            "truck_allocated_count": 0,
            "data": []
            }
    
    async def get_send_to_sap_direct_sales(self,data):
        for rec in data.filters:
            for index, val in enumerate(rec.value):
                if not val:
                    continue
                if not re.fullmatch('^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$', val):
                    raise fastapi.HTTPException(
                        status_code=422,
                        detail=f"values[{index}] not matching criteria"
                    )
        
        conditions = await self.build_clause_conditions(data)
        where_clause = []
        for condition in conditions:
            condition_key = condition['key']
            condition_value = condition['value']
            if condition_key == 'DEALER_CODE':
                dealers = "', '".join(condition_value)
                where_clause.append(f"""SUBSTR(ir."DEALER_CODE",3,8) IN ('{dealers}')""")
            elif condition_key == 'SALES_AREA':
                sales_area = "', '".join(condition_value)
                where_clause.append(f"""dd."SAREA_DESC" IN ('{sales_area}')""")
            elif condition_key == 'PROD':
                product_code = "', '".join(condition_value)
                where_clause.append(f"""ip."PROD" IN ('{product_code}')""")

        ims_query = f"""
                        SELECT DISTINCT ir."INDENT_NO", ir."INDENT_DATE", ip."PROD", ir."PROD_REQD_DT", SUBSTR(ir."DEALER_CODE",3,8) AS "DEALER_CODE", 
                        dd."DEALER_NAME" AS "CUSTOMER NAME", ir."TRUCK_REGNO",
                        ir."VALID_INDENT", ir."CANCEL_INDENT" FROM "IMS_SAP"."INDENT_REQUEST" ir 
                        INNER JOIN "IMS_SAP"."DEALER_DETAILS" dd ON ir.DEALER_CODE = dd.DEALER_CODE 
                        INNER JOIN "IMS_SAP"."INDENT_PRODUCTS" ip ON ir."DEALER_CODE" = ip."DEALER_CODE"
                        WHERE 
                        TO_CHAR(ir."PROD_REQD_DT",'yyyymmdd') =  TO_CHAR(SYSDATE,'yyyymmdd')
                        AND SUBSTR(ir."DEALER_CODE",15,2)='12' AND ir."TRUCK_REGNO" IS NOT NULL 
                        AND (ir."CANCEL_INDENT" IS NULL OR ir."CANCEL_INDENT" <> 'Y')
                        AND ir."VALID_INDENT" IN ('Y','H') AND ir."SEND_TO_JDE_TIME" IS NOT NULL
                    """
        
        if where_clause:
            ims_query +=  ' AND ' + ' AND '.join(where_clause)

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        indent_raised_resp = await function(query=ims_query)
        if indent_raised_resp:
            df = pl.DataFrame(indent_raised_resp)
            return {
                "status": "success",
                "indent_send_sap_count": len(indent_raised_resp),
                "data": df.to_dicts()
            }
        return {
            "status": "success",
            "indent_send_sap_count": 0,
            "data": []
            }
    
    async def get_sales_order_placed_direct_sales(self,data):
        for rec in data.filters:
            for index, val in enumerate(rec.value):
                if not val:
                    continue
                if not re.fullmatch('^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$', val):
                    raise fastapi.HTTPException(
                        status_code=422,
                        detail=f"values[{index}] not matching criteria"
                    )
        
        conditions = await self.build_clause_conditions(data)
        where_clause = []
        for condition in conditions:
            condition_key = condition['key']
            condition_value = condition['value']
            if condition_key == 'DEALER_CODE':
                dealers = "', '".join(condition_value)
                where_clause.append(f"""SUBSTR(ir."DEALER_CODE",3,8) IN ('{dealers}')""")
            elif condition_key == 'SALES_AREA':
                sales_area = "', '".join(condition_value)
                where_clause.append(f"""dd."SAREA_DESC" IN ('{sales_area}')""")
            elif condition_key == 'PROD':
                product_code = "', '".join(condition_value)
                where_clause.append(f"""ip."PROD" IN ('{product_code}')""")

        ims_query = f"""
                        SELECT DISTINCT ir."INDENT_NO", ir."INDENT_DATE", ip."PROD", ir."PROD_REQD_DT", SUBSTR(ir."DEALER_CODE",3,8) AS "DEALER_CODE", 
                        dd."DEALER_NAME" AS "CUSTOMER NAME", ir."TRUCK_REGNO", 
                        ir."VALID_INDENT", ir."CANCEL_INDENT"
                        FROM "IMS_SAP"."INDENT_REQUEST" ir INNER JOIN  
                        "IMS_SAP"."INDENT_PRODUCTS" ip ON ir."LOCN_CODE" = ip."LOCN_CODE"
                        INNER JOIN "IMS_SAP"."DEALER_DETAILS" dd ON ir."DEALER_CODE" = dd."DEALER_CODE"
                        WHERE SUBSTR(ir."DEALER_CODE",15,2) = '12'
                        AND TO_CHAR(ir."PROD_REQD_DT",'yyyymmdd') =  TO_CHAR(SYSDATE,'yyyymmdd') 
                        AND ir."CANCEL_INDENT" IS NULL AND ir."TRUCK_REGNO" IS NOT NULL 
                        AND (ir."VALID_INDENT" = 'Y' OR ir."VALID_INDENT" = 'H')
                        AND ir."BATCH_FLAG" = 'Y' AND ip."SALES_ORDERNO" IS NOT NULL
                        AND ir."INDENT_NO"=ip."INDENT_NO"
                    """
        
        if where_clause:
            ims_query +=  ' AND ' + ' AND '.join(where_clause)

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        indent_raised_resp = await function(query=ims_query)
        if indent_raised_resp:
            df = pl.DataFrame(indent_raised_resp)
            return {
                "status": "success",
                "sales_order_placed_count": len(indent_raised_resp),
                "data": df.to_dicts()
            }
        return {
            "status": "success",
            "sales_order_placed_count": 0,
            "data": []
        }
    
    async def get_r2_swipe_direct_sales(self,data):
        for rec in data.filters:
            for index, val in enumerate(rec.value):
                if not val:
                    continue
                if not re.fullmatch('^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$', val):
                    raise fastapi.HTTPException(
                        status_code=422,
                        detail=f"values[{index}] not matching criteria"
                    )
        
        conditions = await self.build_clause_conditions(data)
        where_clause = []
        for condition in conditions:
            condition_key = condition['key']
            condition_value = condition['value']
            if condition_key == 'DEALER_CODE':
                dealers = "', '".join(condition_value)
                where_clause.append(f"""SUBSTR(ir."DEALER_CODE",3,8) IN ('{dealers}')""")
            elif condition_key == 'SALES_AREA':
                sales_area = "', '".join(condition_value)
                where_clause.append(f"""dd."SAREA_DESC" IN ('{sales_area}')""")
            elif condition_key == 'PROD':
                product_code = "', '".join(condition_value)
                where_clause.append(f"""ip."PROD" IN ('{product_code}')""")

        ims_query = f"""
                        SELECT  DISTINCT ir."INDENT_NO", ir."INDENT_DATE", ip."PROD", ir."PROD_REQD_DT", SUBSTR(ir."DEALER_CODE",3,8) AS "DEALER_CODE", 
                        dd."DEALER_NAME" AS "CUSTOMER NAME", ir."TRUCK_REGNO", 
                        ir."VALID_INDENT", ir."CANCEL_INDENT"
                        FROM "IMS_SAP"."INDENT_REQUEST" ir 
                        INNER JOIN "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" ts ON ir."LOCN_CODE" = ts."LOCN_CODE"
                        INNER JOIN "IMS_SAP"."DEALER_DETAILS" dd ON ir."DEALER_CODE" = dd."DEALER_CODE"
                        INNER JOIN "IMS_SAP"."INDENT_PRODUCTS" ip ON ir."DEALER_CODE" = ip."DEALER_CODE"
                        WHERE TO_CHAR(ir."PROD_REQD_DT",'yyyymmdd') =  TO_CHAR(SYSDATE,'yyyymmdd')
                        AND ir."TRUCK_REGNO" = ts."TRUCK_REGNO"
                        AND ts."CARD_STATUS" = 'I'
                        AND ir."PROD_REQD_DT" = ts."CARD_DATE"
                        AND SUBSTR(ir."DEALER_CODE",15,2)='12'
                        """
        
        if where_clause:
            ims_query +=  ' AND ' + ' AND '.join(where_clause)

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        indent_raised_resp = await function(query=ims_query)
        if indent_raised_resp:
            df = pl.DataFrame(indent_raised_resp)
            return {
                "status": "success",
                "r2_swiped_count": len(indent_raised_resp),
                "data": df.to_dicts()
            }
        return {
            "status": "success",
            "r2_swiped_count": 0,
            "data": []
        }

    async def get_is_invoice_created_direct_sales(self,data):
        for rec in data.filters:
            for index, val in enumerate(rec.value):
                if not val:
                    continue
                if not re.fullmatch('^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$', val):
                    raise fastapi.HTTPException(
                        status_code=422,
                        detail=f"values[{index}] not matching criteria"
                    )
        
        conditions = await self.build_clause_conditions(data)
        where_clause = []
        for condition in conditions:
            condition_key = condition['key']
            condition_value = condition['value']
            if condition_key == 'DEALER_CODE':
                dealers = "', '".join(condition_value)
                where_clause.append(f"""SUBSTR(ir."DEALER_CODE",3,8) IN ('{dealers}')""")
            elif condition_key == 'SALES_AREA':
                sales_area = "', '".join(condition_value)
                where_clause.append(f"""dd."SAREA_DESC" IN ('{sales_area}')""")
            elif condition_key == 'PROD':
                product_code = "', '".join(condition_value)
                where_clause.append(f"""ip."PROD" IN ('{product_code}')""")


        ims_query = f"""
                        SELECT DISTINCT ir."INDENT_NO", ir."INDENT_DATE", ip."PROD", ir."PROD_REQD_DT", SUBSTR(ir."DEALER_CODE",3,8) AS "DEALER_CODE", 
                        dd."DEALER_NAME" AS "CUSTOMER NAME", ir."TRUCK_REGNO", 
                        ir."VALID_INDENT", ir."CANCEL_INDENT"
                        FROM "IMS_SAP"."INDENT_REQUEST" ir
                        INNER JOIN "IMS_SAP"."INDENT_PRODUCTS" ip ON ir."LOCN_CODE" = ip."LOCN_CODE"
                        INNER JOIN "IMS_SAP"."DEALER_DETAILS" dd ON ir."DEALER_CODE" = dd."DEALER_CODE"
                        WHERE SUBSTR(ir."DEALER_CODE",15,2) = '12' 
                        AND TO_CHAR(ir."PROD_REQD_DT",'yyyymmdd') = TO_CHAR(SYSDATE,'yyyymmdd')
                        AND ir."CANCEL_INDENT" IS NULL
                        AND ir."DEALER_CODE" = ip."DEALER_CODE" 
                        AND ir."INDENT_NO" = ip."INDENT_NO" AND ip."INVOICE_NO" IS NOT NULL
                    """
        
        if where_clause:
            ims_query +=  ' AND ' + ' AND '.join(where_clause)

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        indent_raised_resp = await function(query=ims_query)
        if indent_raised_resp:
            df = pl.DataFrame(indent_raised_resp)
            return {
                "status": "success",
                "is_invoice_created_count": len(indent_raised_resp),
                "data": df.to_dicts()
            }
        return {
            "status": "success",
            "is_invoice_created_count": 0,
            "data": []
        }
    
    async def get_r3_swiped_direct_sales(self,data):
        for rec in data.filters:
            for index, val in enumerate(rec.value):
                if not val:
                    continue
                if not re.fullmatch('^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$', val):
                    raise fastapi.HTTPException(
                        status_code=422,
                        detail=f"values[{index}] not matching criteria"
                    )
        
        conditions = await self.build_clause_conditions(data)
        where_clause = []
        for condition in conditions:
            condition_key = condition['key']
            condition_value = condition['value']
            if condition_key == 'DEALER_CODE':
                dealers = "', '".join(condition_value)
                where_clause.append(f"""SUBSTR(ir."DEALER_CODE",3,8) IN ('{dealers}')""")
            elif condition_key == 'SALES_AREA':
                sales_area = "', '".join(condition_value)
                where_clause.append(f"""dd."SAREA_DESC" IN ('{sales_area}')""")
            elif condition_key == 'PROD':
                product_code = "', '".join(condition_value)
                where_clause.append(f"""ip."PROD" IN ('{product_code}')""")


        ims_query = f"""
                        SELECT DISTINCT ir."INDENT_NO", ir."INDENT_DATE", ip."PROD", ir."PROD_REQD_DT", SUBSTR(ir."DEALER_CODE",3,8) AS "DEALER_CODE", 
                        dd."DEALER_NAME" AS "CUSTOMER NAME", ir."TRUCK_REGNO", 
                        ir."VALID_INDENT", ir."CANCEL_INDENT"
                        FROM "IMS_SAP"."INDENT_REQUEST" ir
                        INNER JOIN "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" ts ON ir."LOCN_CODE" = ts."LOCN_CODE"
                        INNER JOIN "IMS_SAP"."DEALER_DETAILS" dd ON ir."DEALER_CODE" = dd."DEALER_CODE"
                        INNER JOIN "IMS_SAP"."INDENT_PRODUCTS" ip ON ir."DEALER_CODE" = ip."DEALER_CODE"
                        WHERE TO_CHAR(ir."PROD_REQD_DT",'yyyymmdd') = TO_CHAR(SYSDATE,'yyyymmdd')
                        AND ir."TRUCK_REGNO" = ts."TRUCK_REGNO"
                        AND ts."CARD_STATUS" = 'O'
                        AND ir."PROD_REQD_DT" = ts."CARD_DATE"
                        AND SUBSTR(ir."DEALER_CODE",15,2)='12'
                        """
        
        if where_clause:
            ims_query +=  ' AND ' + ' AND '.join(where_clause)

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        indent_raised_resp = await function(query=ims_query)
        if indent_raised_resp:
            df = pl.DataFrame(indent_raised_resp)
            return {
                "status": "success",
                "r3_swiped_count": 0,
                "data": []
            }
        return {
            "status": "success",
            "r3_swiped_count": 0,
            "data": []
        }
    
    async def get_vts_direct_sales(self,data):
        for rec in data.filters:
            for index, val in enumerate(rec.value):
                if not val:
                    continue
                if not re.fullmatch('^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$', val):
                    raise fastapi.HTTPException(
                        status_code=422,
                        detail=f"values[{index}] not matching criteria"
                    )
        
        conditions = await self.build_clause_conditions(data)
        where_clause = []
        for condition in conditions:
            condition_key = condition['key']
            condition_value = condition['value']
            if condition_key == 'DEALER_CODE':
                dealers = "', '".join(condition_value)
                where_clause.append(f"""SUBSTR(ir."DEALER_CODE",3,8) IN ('{dealers}')""")
            elif condition_key == 'SALES_AREA':
                sales_area = "', '".join(condition_value)
                where_clause.append(f"""dd."SAREA_DESC" IN ('{sales_area}')""")
            elif condition_key == 'PROD':
                product_code = "', '".join(condition_value)
                where_clause.append(f"""ip."PROD" IN ('{product_code}')""")

        ims_query = f"""
                        SELECT DISTINCT ir."INDENT_NO", ir."INDENT_DATE", ip."PROD", ir."PROD_REQD_DT", SUBSTR(ir."DEALER_CODE",3,8) AS "DEALER_CODE", 
                        dd."DEALER_NAME" AS "CUSTOMER NAME", ir."TRUCK_REGNO", 
                        ir."VALID_INDENT", ir."CANCEL_INDENT"
                        FROM "IMS_SAP"."INDENT_REQUEST" ir
                        INNER JOIN "IMS_SAP"."TRUCK_SWIPE_ENTRY_SAP" ts ON ir."LOCN_CODE" = ts."LOCN_CODE"
                        INNER JOIN "IMS_SAP"."DEALER_DETAILS" dd ON ir."DEALER_CODE" = dd."DEALER_CODE"
                        INNER JOIN "IMS_SAP"."INDENT_PRODUCTS" ip ON ir."DEALER_CODE" = ip."DEALER_CODE"
                        WHERE TO_CHAR(ir."PROD_REQD_DT",'yyyymmdd') = TO_CHAR(SYSDATE,'yyyymmdd')
                        AND ir."TRUCK_REGNO" = ts."TRUCK_REGNO"
                        AND ts."CARD_STATUS" = 'O'
                        AND ir."PROD_REQD_DT" = ts."CARD_DATE"
                        AND SUBSTR(ir."DEALER_CODE",15,2)='12'
                        """
        
        if where_clause:
            ims_query +=  ' AND ' + ' AND '.join(where_clause)

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        indent_raised_resp = await function(query=ims_query)
        if indent_raised_resp:
            df = pl.DataFrame(indent_raised_resp)
            return {
                "status": "success",
                "vts_count": len(indent_raised_resp),
                "data": df.to_dicts()
            }
        return {
            "status": "success",
            "vts_count": 0,
            "data": []
        }
    
    async def get_delivery_confirmation_direct_sales(self,data):
        for rec in data.filters:
            for index, val in enumerate(rec.value):
                if not val:
                    continue
                if not re.fullmatch('^[a-zA-Z0-9,\\/+\\[\\]\\{\\}\\(\\)&><#_.\\-=" ]*$', val):
                    raise fastapi.HTTPException(
                        status_code=422,
                        detail=f"values[{index}] not matching criteria"
                    )
        
        conditions = await self.build_clause_conditions(data)
        where_clause = []
        for condition in conditions:
            condition_key = condition['key']
            condition_value = condition['value']
            if condition_key == 'DEALER_CODE':
                dealers = "', '".join(condition_value)
                where_clause.append(f"""SUBSTR(ir."DEALER_CODE",3,8) IN ('{dealers}')""")
            elif condition_key == 'SALES_AREA':
                sales_area = "', '".join(condition_value)
                where_clause.append(f"""dd."SAREA_DESC" IN ('{sales_area}')""")
            elif condition_key == 'PROD':
                product_code = "', '".join(condition_value)
                where_clause.append(f"""ir."PROD" IN ('{product_code}')""")

        ims_query = f"""
                        SELECT  ir."INDENT_NO", ir."INDENT_DATE", ir."PROD", SUBSTR(ir."DEALER_CODE",3,8) AS "DEALER_CODE", 
                        dd."DEALER_NAME" AS "CUSTOMER NAME", ir."JDE_TRUCK_NO" AS "TRUCK_REGNO"
                        FROM "IMS_SAP"."INDENT_PRODUCTS" ir
                        INNER JOIN "IMS_SAP"."DEALER_DETAILS" dd ON ir."DEALER_CODE" = dd."DEALER_CODE"
                        INNER JOIN "IMS_SAP"."AUTO_DC_REQUESTS" ar ON SUBSTR(ir."DEALER_CODE", 1, 10) = ar."SHIP_TO_CUST" 
                        WHERE SUBSTR(ir."DEALER_CODE", 15, 2) = '12'     
                        AND ir."LOCN_CODE" = ar."ORIGIN_LOCN" 
                        AND ir."INVOICE_NO" = ar."INVOICE_NO"
                        AND ar."SHIPMENT_DATE" = TO_CHAR(SYSDATE,'yyyymmdd')
                        """
        
        if where_clause:
            ims_query +=  ' AND ' + ' AND '.join(where_clause)

        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 3
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        indent_raised_resp = await function(query=ims_query)
        if indent_raised_resp:
            df = pl.DataFrame(indent_raised_resp)
            return {
                "status": "success",
                "delivery_confirmation_count": len(indent_raised_resp),
                "data": df.to_dicts()
            }
        return {
            "status": "success",
            "delivery_confirmation_count": 0,
            "data": []
        }
    
# async def main():
#     obj = IndentDryOutDirectSales()
#     summary = {
#         "indent_raised": await obj.get_indent_raised_direct_sales(),
#         "indent_on_hold": await obj.get_indent_on_hold_direct_sales(),
#         "pending_indent": await obj.get_pending_indents_direct_sales(),
#         "valid_indent": await obj.get_valid_indent_direct_sales(),
#         "truck_allocated": await obj.get_truck_allocated_direct_sales(),
#         "indent_send_sap": await obj.get_send_to_sap_direct_sales(),
#         "sales_order_placed": await obj.get_sales_order_placed_direct_sales(),
#     }

#     print("Summary:", summary)

# if __name__ == "__main__":
#     asyncio.run(main())

