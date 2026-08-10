import urdhva_base
import hpcl_ceg_model
import charts_actions
import dashboard_studio_model
import utilities.connection_mapping as connection_mapping


async def enable_all_daily_email_notifications():
    try:
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
        dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
        function = await charts_actions.charts_connection_vault_routing(
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams
        )
        query = """ 
                UPDATE daily_email_notification_users 
                SET enabled = 'true' 
                WHERE enabled = 'false' 
                RETURNING *;
            """
        
        print("query ---->\n", query)
        result = await function(query=query)

        print("Update records:")
        for row in result:
            print(row)

    except Exception as e:
        print("Error:", str(e))


if __name__ == "__main__":
    import asyncio
    asyncio.run(enable_all_daily_email_notifications())