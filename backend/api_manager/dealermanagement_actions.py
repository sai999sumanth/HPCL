from field_force_enum import *
from field_force_model import *
import fastapi

router = fastapi.APIRouter(prefix='/dealermanagement')


# Action get_last_transactions
@router.post('/get_last_transactions', tags=['DealerManagement'])
async def dealermanagement_get_last_transactions(data: Dealermanagement_Get_Last_TransactionsParams):
    ...


# Action get_retail_ledger_transactions
@router.post('/get_retail_ledger_transactions', tags=['DealerManagement'])
async def dealermanagement_get_retail_ledger_transactions(data: Dealermanagement_Get_Retail_Ledger_TransactionsParams):
    ...


# Action get_total_outstanding_dues
@router.post('/get_total_outstanding_dues', tags=['DealerManagement'])
async def dealermanagement_get_total_outstanding_dues(data: Dealermanagement_Get_Total_Outstanding_DuesParams):
    ...


# Action get_top_outstanding_dealers
@router.post('/get_top_outstanding_dealers', tags=['DealerManagement'])
async def dealermanagement_get_top_outstanding_dealers(data: Dealermanagement_Get_Top_Outstanding_DealersParams):
    ...


# Action get_outstanding_by_days_group
@router.post('/get_outstanding_by_days_group', tags=['DealerManagement'])
async def dealermanagement_get_outstanding_by_days_group(data: Dealermanagement_Get_Outstanding_By_Days_GroupParams):
    ...


# Action get_dealer_outstanding_table
@router.post('/get_dealer_outstanding_table', tags=['DealerManagement'])
async def dealermanagement_get_dealer_outstanding_table(data: Dealermanagement_Get_Dealer_Outstanding_TableParams):
    ...


# Action get_outstanding_details
@router.post('/get_outstanding_details', tags=['DealerManagement'])
async def dealermanagement_get_outstanding_details(data: Dealermanagement_Get_Outstanding_DetailsParams):
    ...


# Action get_outstanding_dealers
@router.post('/get_outstanding_dealers', tags=['DealerManagement'])
async def dealermanagement_get_outstanding_dealers(data: Dealermanagement_Get_Outstanding_DealersParams):
    ...
