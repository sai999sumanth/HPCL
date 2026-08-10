import urdhva_base
import asyncio
import dashboard_studio_model
import charts_actions
import traceback

logger = urdhva_base.logger.Logger.getInstance('nrd_alert_log')


async def get_transporter_code(vehicle_number):
    MAX_RETRIES = 3
    RETRY_DELAY = 10

    transporter_resp = {}

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            # Fetching voilations from VTS DB
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = 5
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = 'execute_query'
            function = await charts_actions.charts_connection_vault_routing(dashboard_studio_model.Charts_Connection_Vault_RoutingParams)
            query = f"""
                        SELECT DISTINCT ERP_TRANSPORTER_CODE FROM COMPLETED_TRIP 
                        WHERE VEHICLE_RTO_NO = '{vehicle_number}' 
                    """
            transporter_resp = await function(query=query)

            # Break retry loop if valid response received
            if len(transporter_resp.get('ERP_TRANSPORTER_CODE',[])):
                break

        except Exception as e:
            print(traceback.format_exc())
            logger.error(f"Vehicle Track DB query failed for getting transporter_code : Traceback: {traceback.format_exc()}")
            logger.error(
                f"Vehicle Track DB query failed (attempt {attempt}/{MAX_RETRIES}) "
                f"Error={e}"
                )
            
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY)
    
    transporter_code = transporter_resp.get("ERP_TRANSPORTER_CODE") or []

    if len(transporter_code) > 0:
        return transporter_code[0].lstrip("P").lstrip("00")
    
    return ""

if __name__ == '__main__':
    transporter_code = asyncio.run(get_transporter_code('RJ50GA8318'))
    if len(transporter_code)>0:
        print('*'*200)
        print(transporter_code)
        print('*'*200)