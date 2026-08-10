import urdhva_base
import asyncio
import hpcl_ceg_model
import charts_actions
import urdhva_base.redispool
import dashboard_studio_model
import orchestrator.alerting.alert_helper as alert_helper


async def sync_location_data_to_redis():
    redis_client = await urdhva_base.redispool.get_redis_connection()
    query = "SELECT * from location_master"
    resp = await hpcl_ceg_model.LocationMaster.get_aggr_data(query, limit=100000)
    for rec in resp['data']:
        for key in ["created_at", "updated_at"]:
            if key in rec:
                del rec[key]
        await alert_helper.set_location_details(rec["bu"], rec["sap_id"], rec, redis_client)


async def updated_terminal_plant_id():
    import pandas as pd
    df = pd.read_excel("/opt/update_location_master.xlsx", dtype=str)
    df['terminal_plant_id'] = df['terminal_plant_id'].fillna("").astype(str)
    for record in df.to_dict("records"):
        query = f"""update location_master set terminal_plant_id='{record["updated_terminal_plant_id"]}' """ \
                f"""where sap_id = '{record["sap_id"]}' and terminal_plant_id = '{record['terminal_plant_id']}' """ \
                f"""and bu = 'RO'"""
        print("Query: ", query)
        exit()
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = "1"
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        data = await function(query=query)
        print(data)

async def update_terminal_plant_id_alerts():
    import pandas as pd
    df = pd.read_excel("/opt/update_location_master.xlsx", dtype=str)
    df['terminal_plant_id'] = df['terminal_plant_id'].fillna("").astype(str)
    count = 1
    for record in df.to_dict("records"):
        query = f"""update alerts set terminal_plant_id='{record["updated_terminal_plant_id"]}' """ \
                f"""where sap_id = '{record["sap_id"]}' and terminal_plant_id = '{record['terminal_plant_id']}' """ \
                f"""and bu = 'RO' and interlock_name = 'Dry Out Each Indent Wise MainFlow' """
        print("Query: ", query)
        exit()
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = "1"
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
        data = await function(query=query)
        count += 1
    print("Count: ", count)


if __name__ == "__main__":
    asyncio.run(sync_location_data_to_redis())