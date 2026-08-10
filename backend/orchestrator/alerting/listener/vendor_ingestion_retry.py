import urdhva_base
import json
import asyncio
import datetime
import requests
import traceback
import pandas as pd
import hpcl_ceg_model


async def ingestion_retry(to_day=urdhva_base.utilities.get_present_time()):
    to_day = (to_day - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    query = f"""select * from vendor_api_audit where created_at::date >= '{to_day}'"""
    retry_data = await hpcl_ceg_model.VendorApiAudit.get_aggr_data(query=query, limit=0)
    if retry_data.get("data", []):
        retry_data = retry_data.get("data", [])
        retry_data = pd.DataFrame(retry_data)
        retry_data["response_msg"] = retry_data["response_msg"].apply(json.loads)
        resp = await cris_retry(retry_data[retry_data['vendor'] == 'CRIS'])

async def cris_retry(retry_data):
    retry_data = retry_data.to_dict(orient='records')
    filtered_records = [
        record for record in retry_data
        if not record.get('response')
           or record['response_msg'].get('status_code') not in (200, 201)
           or not record['response_msg'].get('response', {}).get('strSuccessId', '')
    ]
    filtered_records = [
        record for record in filtered_records
        if record['response_msg'].get('response', {}).get('strFailureMsg', '') != 'Req no already exist.'
    ]

    default_headers = {"Content-Type": "application/json"}

    for record in filtered_records:
        url = record['url']
        try:
            response = requests.post(url, json=record['payload'], headers=default_headers)
            response_data = response.json()
            log_payload = {"status_code": response.status_code, "response": response_data}
            record['response'] = str(response.status_code)
            record['response_msg'] = json.dumps(log_payload)
            await hpcl_ceg_model.VendorApiAudit(**record).modify()
        except Exception as e:
            print(traceback.format_exc())
            print(f"Error while disabling interlock {e}")
            return {"status": False, "message": "Failed to retry"}

    return {"status": True, "message": "Success"}

if __name__ == "__main__":
    asyncio.run(ingestion_retry())