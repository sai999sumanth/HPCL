import urdhva_base
import traceback
import polars as pl
import hpcl_ceg_model
import urdhva_base.redispool
import urdhva_base.queryparams
import orchestrator.alerting.alert_helper as alert_helper


async def upload_geo_master_data(df):
    redis_client = await urdhva_base.redispool.get_redis_connection()
    # Iterate through the rows of the CSV and extract `bu` and `sapid`
    try:
        df = df.with_columns(pl.lit(True).alias('is_active'))
        data = df.to_dicts()
        for data_dump in data:
            data_obj = hpcl_ceg_model.BuLevelGeoCoordinatesCreate(**data_dump)
            resp = await hpcl_ceg_model.BuLevelGeoCoordinates.get_all(urdhva_base.queryparams.QueryParams(
                q=f"sap_id='{data_dump['sap_id']}'"), resp_type='plain')
            if len(resp['data']):
                if len(resp['data']) > 1:
                    for rec in resp['data']:
                        await hpcl_ceg_model.BuLevelGeoCoordinates.delete(rec['id'])
                    await data_obj.create()
                else:
                    data_dump['id'] = resp['data'][0]['id']
                    await hpcl_ceg_model.BuLevelGeoCoordinates(**data_dump).modify()
            else:
                await data_obj.create()
            await alert_helper.set_location_details(data_dump["bu"], data_dump["sap_id"], data_dump, redis_client)
        return True, "Geo Master Uploaded Successfully"
    except Exception as e:
        print(traceback.format_exc())
        return False, str(e)
