from hpcl_ceg_enum import *
from hpcl_ceg_model import *
import fastapi
from orchestrator.sync_services.consumer_pump import generate_token

router = fastapi.APIRouter(prefix='/consumerpumptransactions')


# Action bulk_update_cp_transactions
@router.post('/bulk_update_cp_transactions', tags=['ConsumerPumpTransactions'])
async def consumerpumptransactions_bulk_update_cp_transactions(data: Consumerpumptransactions_Bulk_Update_Cp_TransactionsParams):
    token_manager = generate_token.TokenManager()
    transactions_api_url = "https://externalapi.prime360vr.com/api/ros/transactions"
    print('transactions_api_url: ', transactions_api_url)
    data = await generate_token.get_transactions_api(token_manager, transactions_api_url)

    if data:
        await ConsumerPumpTransactions.bulk_update(data, upsert=True)
        print('***UPDATED TRANSACTIONS***')
        return {"status": True, "message": "success", "data": []}
    return {"status": False, "message": "Data couldn't fetch from API", "data": []}
