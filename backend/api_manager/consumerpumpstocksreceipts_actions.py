from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
from orchestrator.sync_services.consumer_pump import generate_token

router = fastapi.APIRouter(prefix='/consumerpumpstocksreceipts')


# Action bulk_update_cp_stock_receipts
@router.post('/bulk_update_cp_stock_receipts', tags=['ConsumerPumpStocksReceipts'])
async def consumerpumpstocksreceipts_bulk_update_cp_stock_receipts(data: Consumerpumpstocksreceipts_Bulk_Update_Cp_Stock_ReceiptsParams):
    token_manager = generate_token.TokenManager()
    receipts_api_url = "https://externalapi.prime360vr.com/api/ros/stocks/receipts"
    print("receipts_api_url: ", receipts_api_url)
    data = await generate_token.get_transactions_api(token_manager, receipts_api_url)

    if data:
        await ConsumerPumpStocksReceipts.bulk_update(data, upsert=True)
        print('***UPDATED RECEIPTS***')
        return {"status": True, "message": "success", "data": []}
    return {"status": False, "message": "Data couldn't fetch from API", "data": []}
