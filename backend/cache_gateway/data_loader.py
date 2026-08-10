import urdhva_base
import json
import asyncio
import traceback
import polars as pl
import hpcl_ceg_model
import urdhva_base.redispool
import cache_gateway.data_cache_handler as cache_handler

class CacheDataInstance:
    _instances = {}

    @classmethod
    def get_instance(cls, cache_key, loader_func, fetch_args=None):
        """
        Get instance for the given cache_key
        """
        if cache_key not in CacheDataInstance._instances:
            print(f"Cache Key Not Available {cache_key}")
            CacheDataInstance._instances[cache_key] = CacheDataInstance(loader_func, fetch_args).cache_handler

        return CacheDataInstance._instances[cache_key]

    def __init__(self, loader_func, fetch_args):
        """
        Initializing cache class
        """
        self.cache_handler = cache_handler.InMemTTLCache(
            ttl_seconds=urdhva_base.settings.default_masters_cache_seconds,
            fetch_function=loader_func,
            fetch_args=fetch_args if fetch_args is not None else ()
        )


async def load_location_master():
    """
    Loading location master from redis database
    :return:
    """
    print(f"Loading data")
    count = 0
    while count < 3:
        try:
            redis_ins = urdhva_base.redispool.get_synchronous_redis_connection()
            try:
                location_data = redis_ins.hgetall("location_master")
                location_data = {key.decode(): json.loads(value) for key, value in location_data.items()}
                return location_data
            except Exception as e:
                print(f"Redis Exception: {e}, Traceback {traceback.format_exc()}")
                # return {}
            finally:
                try:
                    redis_ins.close()
                except Exception as e:
                    print(f"Exception in closing redis connection {e}")
        except Exception as e:
            print(f"Error in getting redis connection, retrying")
        # Sleeping a second before retry
        await asyncio.sleep(1)
        count += 1
    return {}

async def load_roles_master(bu, sap_id, role):
    """
    Loading roles master from redis database
    :return:
    """
    print(f"Loading data")
    params = urdhva_base.queryparams.QueryParams(limit=10000, q=f"bu='{{{bu}}}'")
    resp = await hpcl_ceg_model.Users.get_all(params)
    resp_dict = resp.__dict__
    if resp_dict.get('body'):
        # Decode the byte string to a normal string
        body_str = resp_dict['body'].decode('utf-8')
        data = json.loads(body_str)
        resp = data["data"]
    for record in resp:
        for key, value in record.items():
            if isinstance(value, list) and not value:
                record[key] = [None]  # Fill empty lists with None
            elif isinstance(value, list) and all(isinstance(v, str) for v in value):
                record[key] = value  # Keep as list of strings
            elif isinstance(value, str):
                record[key] = value  # Keep as string
            else:
                record[key] = str(value)  # Convert everything else to string
    # Now create the DataFrame
    df = pl.DataFrame(resp)
    # Now apply the filter with .arr.contains for all list columns
    print("role before resp_filtered ", role)
    role_condition = None
    if role:
        role = role.split(",") 
        role = [r.strip() for r in role]
        for r in role:
            cond = pl.col("novex_role").list.contains(r)
            role_condition = cond if role_condition is None else (role_condition | cond)

    # Base condition (always applied)
    base_condition = pl.col("sap_id").list.contains(str(sap_id))

    # Apply role condition only if it exists
    if role_condition is not None:
        resp_filtered = df.filter(base_condition & role_condition)
    else:
        resp_filtered = df.filter(base_condition)
        
    return resp_filtered.to_dicts()


async def get_location_details(bu, sap_id):
    """
        Retrieves location details based on the provided business unit and SAP ID.

        Parameters:
        bu (str): The business unit identifier.
        sap_id (str): The SAP ID of the location.

        Returns:
        dict: Location details, including name, address, coordinates, etc., or None if not found.
        """
    if not bu or not sap_id:
        print("Invalid parameters: 'bu' and 'sap_id' are required.")
        return False, {"msg": "Invalid parameters: 'bu' and 'sap_id' are required."}
    ins = CacheDataInstance.get_instance("location_master", load_location_master, None)
    location_data = await ins.get(f"location_master")
    if not location_data or f"{bu.upper()}_{sap_id}" not in location_data:
        return False, {}
    return True, location_data[f"{bu.upper()}_{sap_id}"]

async def get_roles(bu, sap_id, role):
    """
    Retrieves roles based on the provided business unit and SAP ID.
    """
    print("role in get roles ", role)
    if not bu or not sap_id:
        print("Invalid parameters: 'bu' and 'sap_id' are required.")
        return False, {"msg": "Invalid parameters: 'bu' and 'sap_id' are required."}
    
    fetch_args = (bu, sap_id, role)
    print("fetch_args", fetch_args)
    ins = CacheDataInstance.get_instance("roles_master", load_roles_master, fetch_args)
    print("ins roles_data --> ", ins)
    roles_data = await ins.get(f"roles_master", fetch_args)
    print("get_roles roles_data --> ", roles_data)
    if not roles_data:
        return False, {}
    return True, roles_data
