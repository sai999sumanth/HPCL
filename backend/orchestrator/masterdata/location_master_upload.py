import urdhva_base
import traceback
import polars as pl
import hpcl_ceg_model
import urdhva_base.redispool
import urdhva_base.queryparams
import utilities.bu_key_mapping as bu_key_mapping
import orchestrator.alerting.alert_helper as alert_helper


async def upload_location_master_data(df):
    """
    Upload Location Master data.
    :param df: polars dataframe
    :return: status, message
    """
    redis_client = await urdhva_base.redispool.get_redis_connection()
    # Iterate through the rows of the CSV and extract `bu` and `sapid`
    if df['LocationType'][0] == 'TAS':
        df = df.rename(bu_key_mapping.TAS)
    elif df['LocationType'][0] == 'LPG':
        df = df.rename(bu_key_mapping.LPG)
    elif df['LocationType'][0] == 'RO':
        df = df.rename(bu_key_mapping.RO)
    try:
        df = df.with_columns(pl.lit(True).alias('is_active'))
        data = df.to_dicts()
        for data_dump in data:
            data_obj = hpcl_ceg_model.LocationMasterCreate(**data_dump)
            resp = await hpcl_ceg_model.LocationMaster.get_all(urdhva_base.queryparams.QueryParams(
                q=f"sap_id='{data_dump['sap_id']}'"), resp_type='plain')
            if len(resp['data']):
                if len(resp['data']) > 1:
                    for rec in resp['data']:
                        await hpcl_ceg_model.LocationMaster.delete(rec['id'])
                    await data_obj.create()
                else:
                    data_dump['id'] = resp['data'][0]['id']
                    await hpcl_ceg_model.LocationMaster(**data_dump).modify()
            else:
                await data_obj.create()
            await alert_helper.set_location_details(data_dump["bu"], data_dump["sap_id"], data_dump, redis_client)
        return True, "Location Master Uploaded Successfully"
    except Exception as e:
        print(traceback.format_exc())
        return False, str(e)
