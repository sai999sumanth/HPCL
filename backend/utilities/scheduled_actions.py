import urdhva_base
import json
import msgpack
import urdhva_base.redispool
import hpcl_ceg_model


async def get_queue_ins(worker_queue_name):
    return urdhva_base.redispool.RedisQueue(worker_queue_name)


async def location_master():
    """
    Location Master, Will collect all location of RO plant, post to queue which will collect location data
    :return: No Return
    """
    queue_ins = await get_queue_ins("location_master_processing")
    locations = await hpcl_ceg_model.LocationMaster.get_all()
    for location in locations:
        input_data = {"location_master": location}
        msg_data = msgpack.packb(input_data)
        await queue_ins.put(msg_data, skip_on_exists=True)


async def location_device():
    """
    Location Device, Will collect all location of RO plant, post to queue which will collect location data
    :return: No Return
    """
    queue_ins = await get_queue_ins("location_device_processing")
    locations = await hpcl_ceg_model.LocationDevice.get_all()
    for location in locations:
        input_data = {"location_device": location}
        msg_data = msgpack.packb(input_data)
        await queue_ins.put(msg_data, skip_on_exists=True)


async def role_master():
    queue_ins = await get_queue_ins("role_master_processing")
    roles = await hpcl_ceg_model.RoleMaster.get_all()
    for role in roles:
        input_data = {"roles": role}
        msg_data = msgpack.packb(input_data)
        await queue_ins.put(msg_data, skip_on_exists=True)


async def asset_master():
    queue_ins = await get_queue_ins("asset_master_processing")
    assets = await hpcl_ceg_model.AssetMaster.get_all()
    for asset in assets:
        input_data = {"assets": asset}
        msg_data = msgpack.packb(input_data)
        await queue_ins.put(msg_data, skip_on_exists=True)
