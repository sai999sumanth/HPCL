import urdhva_base
import sys
import asyncio
import datetime
import pandas as pd

product_mapping = {'2811000': 'MS', '2812000': 'HSD', '3912000': 'TURBO', '2822000': 'E20',
                   '3672000': 'POWER 95', '2816000': 'POWER 99', '3373000': 'POWER 100'}


async def get_day_alert_history(date):
    query = f"""select * from dry_out_daily_report where created_at::DATE='{date}'"""
    dry_out_daily_report = await urdhva_base.BasePostgresModel.get_aggr_data(query)
    if not dry_out_daily_report['data']:
        return []
    return dry_out_daily_report['data'][0]['dry_out_alert_ids']


async def get_dry_out_day_report(date):
    alerts = await get_day_alert_history(date)
    keys_required = {'location_name': 'RO Name', 'sap_id': 'RO ID', 'sales_area': 'Sales Area',
                     'zone': 'Zone', 'region': 'Region', 'product_code': "Product No",
                     'indent_no': 'Indent No', 'terminal_plant_id': 'Plant Id',
                     'terminal_plant_name': 'Plant Name',
                     'dry_out_start_time': 'Dry Out Start Time'}
    dry_out_data = []
    for index in range(0, len(alerts), 100):
        alerts_ids = alerts[index : index + 100]
        alerts_ids = f"{','.join(map(str, alerts_ids))}"
        query = f"""select {','.join(list(keys_required.keys()))} from alerts where id in ({alerts_ids})"""
        alert_data = await urdhva_base.BasePostgresModel.get_aggr_data(query)
        dry_out_data.extend(alert_data['data'])
    df = pd.DataFrame(dry_out_data)
    df.rename(columns=keys_required, inplace=True)
    df['Product Name'] = df["Product No"].apply(lambda x: product_mapping.get(x, x))
    df.to_excel(f'dry_out_day_report_{date.replace("-", "_")}.xlsx', index=False)


if __name__ == '__main__':
    input_date = sys.argv[1] if len(sys.argv) > 1 else datetime.datetime.now().strftime("%Y-%m-%d")
    asyncio.run(get_dry_out_day_report(input_date))
