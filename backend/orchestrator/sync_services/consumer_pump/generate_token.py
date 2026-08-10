import urdhva_base
import time
import pandas as pd
import requests
import utilities.connection_mapping as connection_mapping
import asyncio
from dashboard_studio_model import Charts_Connection_Vault_RoutingParams
from charts_actions import charts_connection_vault_routing


class TokenManager:
    def __init__(self):
        self.token = None
        self.expiry_time = 0

    def create_bearer_token(self):
        url = "https://identity.prime360vr.com/connect/token"
        client_id = "NCL-BINA-HPCL"
        client_secret = 'HtXc<U4gR'

        payload = {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "GAFS.Diamond.Api"
        }

        response = requests.post(url, data=payload)

        if response.status_code == 200:
            token_data = response.json()
            self.token = token_data.get("access_token")
            expires_in = token_data.get("expires_in", 3600)
            self.expiry_time = time.time() + expires_in - 60
            return self.token
        else:
            print(f"Failed to fetch token. Status code: {response.status_code}, Response: {response.text}")
            return None

    def get_token(self):
        if self.token is None or time.time() >= self.expiry_time:
            return self.create_bearer_token()
        return self.token


def common_flattener(data, dict_columns):
    if dict_columns:
        for dict_column in dict_columns:
            if dict_column in data[0]:
                dict_expanded = pd.json_normalize([row[dict_column] for row in data if row[dict_column] is not None])

                for col in dict_expanded.columns:
                    for idx, row in enumerate(data):
                        row[col] = dict_expanded.iloc[idx][col]

                for row in data:
                    del row[dict_column]
        return data
    return data


def flatten_dict_columns(data, api_type):
    if api_type == 'transactions':
        dict_columns = ['product', 'tank', 'pump', 'vehicle']
        data = common_flattener(data, dict_columns)
        for row in data:
            if 'nozzle' in row and row['nozzle'] is not None:
                nozzle_info = row['nozzle'].get('id', {})
                row['localNozzleID'] = nozzle_info.get('localNozzleID')
                row['globalNozzleID'] = nozzle_info.get('globalNozzleID')

            row.pop('nozzle', None)

    elif api_type == 'receipts':
        dict_columns = ['product', 'invoiceInfo', 'tank']
        data = common_flattener(data, dict_columns)

    elif api_type == 'stocks':
        dict_columns = ['product', 'tank']
        data = common_flattener(data, dict_columns)

    return data


def modify_datetime(df, column_names):
    for column_name in column_names:
        df[column_name] = pd.to_datetime(df[column_name])
        if df[column_name].dt.tz is None:
            df[column_name] = df[column_name].dt.tz_localize('UTC')
        else:
            df[column_name] = df[column_name].dt.tz_convert('UTC')
    return df


async def get_last_unique_txn_id(api_type):
    api_mapping = {
        'transactions': ('UniquetxnID', 'consumer_pump_transactions'),
        'receipts': ('uniquetxnID', 'consumer_pump_stocks_receipts'),
        'stocks': ('UniquetxnID', 'consumer_pump_tank_inventory'),
    }

    if api_type not in api_mapping:
        raise ValueError("Unsupported API Endpoint")

    uniquetxnID, table_name = api_mapping[api_type]
    query = f'SELECT unique_txn_id FROM {table_name} ORDER BY id DESC LIMIT 1'
    Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get("hpcl_ceg", "1")
    Charts_Connection_Vault_RoutingParams.action = 'execute_query'
    function = await charts_connection_vault_routing(Charts_Connection_Vault_RoutingParams)
    resp = await function(query=query)
    last_rec_id = resp[0]['unique_txn_id'] if resp else 1

    return uniquetxnID, last_rec_id


async def get_transactions_api(token_manager, api_url):
    api_type = api_url.split('/')[-1]
    token = token_manager.get_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    all_data = []
    uniquetxnID, last_rec_id = await get_last_unique_txn_id(api_type)

    while True:
        payload = {
            "lastRecId": last_rec_id,
            "maxRec": 255
        }
        response = requests.get(api_url, headers=headers, params=payload)
        print("Status Code:", response.status_code)

        if response.status_code == 200:
            try:
                data = response.json()
                if not data:
                    print("No more data to fetch.")
                    break

                all_data.extend(data)
                last_rec_id = data[-1][uniquetxnID]
                print(f"Fetching next data after UniquetxnID: {last_rec_id}")

            except requests.exceptions.JSONDecodeError:
                print("Response is not JSON. Raw response text:")
                print(response.text)
                break
        else:
            print(f"Failed to fetch data. Status code: {response.status_code}")
            break

    if all_data:
        all_data = flatten_dict_columns(all_data, api_type)
        print("Total Data Collected: ", len(all_data))
        df = pd.DataFrame(all_data)
        print("#"*50)
        if api_type == 'transactions':
            transaction_columns = ['UniquetxnID', 'ROID', 'txnID', 'txnType', 'txnDate', 'txnStartTime', 'txnEndTime',
                                   'price', 'quantity', 'amount', 'fuelEquipType', 'vehicleNo', 'localProductID',
                                   'productName', 'localTankID', 'tankName', 'localPumpID', 'localNozzleID',
                                   'globalNozzleID']
            df = df[transaction_columns]
            rename_columns = {'ROID': 'sap_id',
                              'UniquetxnID': 'unique_txn_id',
                              'txnID': 'txn_id',
                              'txnType': 'txn_type',
                              'txnDate': 'transaction_date',
                              'txnStartTime': 'txn_start_time',
                              'txnEndTime': 'txn_end_time',
                              'productName': 'product',
                              'fuelEquipType': 'fuel_equip_type',
                              'vehicleNo': 'vehicle_no',
                              'localProductID': 'product_id',
                              'localTankID': 'tank_no',
                              'tankName': 'tank_name',
                              'localPumpID': 'pump_no',
                              'localNozzleID': 'nozzle_id',
                              'globalNozzleID': 'global_nozzle_id'}
            df = df.rename(columns=rename_columns)
            df["product"] = df["product"].replace("High Speed Diesel", "HSD")
            dt_conversion_columns = ['transaction_date', 'txn_start_time', 'txn_end_time']
            df = modify_datetime(df, dt_conversion_columns)

        elif api_type == 'receipts':
            receipts_column = ['uniquetxnID', 'roid', 'stockReceiptID', 'source', 'prodQtyStart', 'prodQtyEnd',
                               'localProductID', 'productName', 'quantity',
                               'density', 'amount', 'localTankID', 'tankName', 'decantationStartedAt',
                               'decantationEndedAt']
            df = df[receipts_column]
            df["productName"] = df["productName"].replace("High Speed Diesel", "HSD")
            rename_columns = {'uniquetxnID': 'unique_txn_id',
                              'roid': 'sap_id',
                              'stockReceiptID': 'stock_receipt_id',
                              'prodQtyStart': 'prod_qty_start',
                              'prodQtyEnd': 'prod_qty_end',
                              'localProductID': 'product_id',
                              'productName': 'product',
                              'localTankID': 'tank_no',
                              'tankName': 'tank_name',
                              'decantationStartedAt': 'decantation_start_time',
                              'decantationEndedAt': 'decantation_end_time',
                              }
            df = df.rename(columns=rename_columns)
            dt_conversion_columns = ['decantation_start_time', 'decantation_end_time']
            df = modify_datetime(df, dt_conversion_columns)
            print('receipts_columns:', df.columns)

        elif api_type == 'stocks':
            stocks_column = ['UniquetxnID', 'ROID', 'inventoryDate', 'localTankId', 'tankName', 'stkTxnCode',
                             'stkTxnID', 'localProductId', 'productName', 'prodGrossQty', 'tankCapacity',
                             'netProductVolume', 'ullage', 'productLevel',
                             'density', 'densityAt15']
            df = df[stocks_column]
            df["productName"] = df["productName"].replace("High Speed Diesel", "HSD")
            rename_columns = {'ROID': 'sap_id',
                              'UniquetxnID': 'unique_txn_id',
                              'inventoryDate': 'inventory_date',
                              'localTankId': 'tank_id',
                              'tankName': 'tank_name',
                              'stkTxnCode': 'stock_txn_code',
                              'stkTxnID': 'stock_txn_id',
                              'localProductId': 'product_id',
                              'productName': 'product',
                              'prodGrossQty': 'prod_gross_qty',
                              'tankCapacity': 'tank_capacity',
                              'netProductVolume': 'product_volume',
                              'productLevel': 'product_level',
                              'densityAt15': 'density_at_15'
                              }
            df = df.rename(columns=rename_columns)
            df['inventory_date'] = pd.to_datetime(df['inventory_date'])

            print('stock_columns: ', df.columns)

        df['bu'] = 'cp'
        return df.to_dict(orient='records')
    return []


if __name__ == '__main__':
    token_manager = TokenManager()
    transactions_api_url = "https://externalapi.prime360vr.com/api/ros/transactions"
    receipts_api_url = "https://externalapi.prime360vr.com/api/ros/stocks/receipts"
    stocks_api_url = "https://externalapi.prime360vr.com/api/ros/stocks"
    alarms_api_url = "https://externalapi.prime360vr.com/api/ros/alarms"
    print(asyncio.run(get_transactions_api(token_manager, receipts_api_url)))
