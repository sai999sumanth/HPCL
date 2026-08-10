from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
from orchestrator.sync_services.consumer_pump import generate_token

router = fastapi.APIRouter(prefix='/consumerpumptankinventory')


# Action bulk_update_cp_tank_inventory
@router.post('/bulk_update_cp_tank_inventory', tags=['ConsumerPumpTankInventory'])
async def consumerpumptankinventory_bulk_update_cp_tank_inventory(data: Consumerpumptankinventory_Bulk_Update_Cp_Tank_InventoryParams):
    token_manager = generate_token.TokenManager()
    stocks_api_url = "https://externalapi.prime360vr.com/api/ros/stocks"
    print('stocks_api_url: ', stocks_api_url)
    data = await generate_token.get_transactions_api(token_manager, stocks_api_url)

    if data:
        await ConsumerPumpTankInventory.bulk_update(data, upsert=True)
        print('***UPDATED STOCKS***')
        return {"status": True, "message": "success", "data": []}
    return {"status": False, "message": "Data couldn't fetch from API", "data": []}
