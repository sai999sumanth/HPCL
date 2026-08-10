import urdhva_base
import asyncio
import datetime
import urdhva_base.redispool
from consumerpumpstocksreceipts_actions import *
from consumerpumptankinventory_actions import *
from consumerpumptransactions_actions import *
from hpcl_ceg_model import *

async def execute_daily_consumerpump_data():
    print("Calling Transactions...")
    await consumerpumptransactions_bulk_update_cp_transactions(
        Consumerpumptransactions_Bulk_Update_Cp_TransactionsParams
    )
    print('Calling Inventory(stocks)...')
    await consumerpumptankinventory_bulk_update_cp_tank_inventory(
        Consumerpumptankinventory_Bulk_Update_Cp_Tank_InventoryParams
    )
    print('Calling Receipts...')
    await consumerpumpstocksreceipts_bulk_update_cp_stock_receipts(
        Consumerpumpstocksreceipts_Bulk_Update_Cp_Stock_ReceiptsParams
    )

if __name__ == "__main__":
    asyncio.run(execute_daily_consumerpump_data())
