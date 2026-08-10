import urdhva_base
import os
import sys
import asyncio
import hpcl_ceg_model
import pandas as pd


def convert_float_string(value):
    try:
        return str(int(float(value.strip()))) if value and value.strip() else ''
    except:
        return value if isinstance(value, str) else f"{value}"


async def sync_users(file_path):
    if not os.path.exists(file_path):
        print(f"Given file {file_path} not exists")
        return

    if file_path.endswith(".csv"):
        df = pd.read_csv(file_path)
    elif file_path.endswith(".xlsx"):
        df = pd.read_excel(file_path)
    else:
        print(f"Invalid file format")
        return


    ##### Host_UnauthorizedFlow.csv ####
    # df = df[df['EMPLOYEE_NUMBER'].notna()]
    # df = df.fillna('')
    df['BAY_NUMBER'] = df['BAY_NUMBER'].astype(str).apply(lambda x: convert_float_string(x))
    df['bay_number'] = df['BAY_NUMBER']
    df['bcu_number'] = df['BCU_NUMBER']
    df['meter_number'] = df['METER_NUMBER']
    df['timestamp'] = df['TIMESTAMP']
    df['start_totalizer'] = df['START_TOTALIZER'].astype(int)
    df['end_totalizer'] = df['END_TOTALIZER'].astype(int)
    df['net_totalizer'] = df['NET_TOTALIZER'].astype(int)
    df["timestamp"] = pd.to_datetime(df["timestamp"], format="%Y-%m-%d %H:%M:%S", errors="coerce")
    # df["timestamp"] = pd.to_datetime(df["timestamp"], format="%d-%b-%y %I.%M.%S", errors="coerce")

    df = df[['bay_number', 'bcu_number', 'meter_number', 'timestamp', 'start_totalizer', 'end_totalizer', 'net_totalizer']]

    #BAY RE ASSIGNMENT

    # df['FAN_NUMBER'] = df['FAN_NUMBER'].astype(str).apply(lambda x: convert_float_string(x))
    # df['REASSIGNED_BAY'] = df['REASSIGNED_BAY'].astype(str).apply(lambda x: convert_float_string(x))
    # df['created_date'] = df['CREATED_DATE']
    # df['load_number'] = df['LOAD_NUMBER']
    # df['fan_number'] = df['FAN_NUMBER']
    # df['truck_number'] = df['TRUCK_NUMBER']
    # df['customer_name'] = df['CUSTOMER_NAME']
    # df['compartment_number'] = df['COMPARTMENT_NUMBER']
    # df['product_name'] = df['PRODUCT_NAME']
    # df['required_qty'] = df['REQUIRED_QTY']
    # df['loaded_qty'] = df['LOADED_QTY']
    # df['reassigned_bay'] = df['REASSIGNED_BAY']
    # df['bay_reassignment_time'] = df['BAY_REASSIGNMENT_TIME']
    # df['remarks'] = df['REMARKS']
    # df["created_date"] = pd.to_datetime(df["created_date"], format="%d-%b-%y %H.%M.%S", errors="coerce")
    # df["bay_reassignment_time"] = pd.to_datetime(df["bay_reassignment_time"], format="%d-%b-%y %H.%M.%S", errors="coerce")

    # df = df[['created_date', 'load_number', 'fan_number', 'truck_number', 'customer_name', 
    #             'compartment_number', 'product_name', 'required_qty', 'loaded_qty', 'reassigned_bay', 
    #             'bay_reassignment_time', 'remarks']]
    
    # CANCELLED TTS

    # df['load_number'] = df['LOAD_NUMBER']
    # df['truck_number'] = df['TRUCK_NUMBER']
    # df['created_date'] = df['CREATED_DATE']
    # df['customer_name'] = df['CUSTOMER_NAME']
    # df['product_name'] = df['PRODUCT_NAME']
    # df['required_qty'] = df['REQUIRED_QTY']
    # df['cancelled_by'] = df['CANCELLED_BY'].astype(str)
    # df['cancelled_date'] = df['CANCELLED_DATE']
    # df["created_date"] = pd.to_datetime(df["created_date"], format="%Y-%m-%d %H:%M:%S", errors="coerce")
    # print(df["cancelled_date"])
    # df["cancelled_date"] = pd.to_datetime(df["cancelled_date"], format="%Y-%m-%d %H:%M:%S", errors="coerce")

    # LOCALLOADED TTS

    # df['sr_number'] = df['SR_NUMBER']
    # df['bay_number'] = df['BAY_NUMBER']
    # df['bcu_number'] = df['BCU_NUMBER']
    # df['recipe_number'] = df['RECIPE_NAME']
    # df['truck_number'] = df['TRUCK_NUMBER']
    # df['card_number'] = df['CARD_NUMBER']
    # df['start_totalizer'] = df['START_TOTALIZER'].astype(str)
    # df['end_totalizer'] = df['END_TOTALIZER']
    # df["loaded_qty"] = df['LOADED_QTY']
    # df["transaction_end_time"] = pd.to_datetime(df["TRANSACTION_END_TIME"], format="%d-%b-%y %H.%M.%S", errors="coerce")
    
    # MANUAL FAN PRINTED

    # df['manual_fan_count'] = df['MANUAL_FAN_COUNT']
    # df['auto_fan_count'] = df['AUTO_FAN_COUNT']
    # df['total_count'] = df['TOTAL_COUNT']

    #OVER LOADED 
    # df['load_number'] = df['LOAD_NUMBER'] 
    # df['truck_number'] = df['TRUCK_NUMBER']
    # df['compartment_number'] = df['COMPARTMENT_NUMBER']
    # df['product_name'] = df['BLEND_NAME']
    # df['required_qty'] = df['REQUIRED_QTY']
    # df['loaded_qty'] = df['LOADED_QTY']

    data = df.to_dict(orient='records')

    await hpcl_ceg_model.HostUnauthorisedFlow.bulk_update(data, upsert=False)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"{sys.argv[0]} <FILE PATH>")
        sys.exit(0)
    asyncio.run(sync_users(sys.argv[1]))
