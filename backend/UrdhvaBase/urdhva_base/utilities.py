import re
import pytz
import asyncio
import datetime
import functools
import threading


# Custom JSON serializer for datetime objects
def datetime_serializer(obj):
    if isinstance(obj, datetime.datetime):
        return obj.isoformat()


def run_once(func):
    """
    This decorator wraps a function and makes sure it is executed only once for the lifetime of the process.
    Depending on whether the wrapped function is normal or async it wraps accordingly.
    It cache's the response returned by the original function and returns the cached response on subsequent calls.

    Usage:
    @run_once
    def foo():
        pass

    @run_once
    async def async_foo():
        pass
    
    """
    if asyncio.iscoroutinefunction(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            async with wrapper.lock:
                if not wrapper.has_executed:
                    wrapper.has_executed = True
                    wrapper.response = await func(*args, **kwargs)
            return wrapper.response
        wrapper.lock = asyncio.Lock()
    else:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            with wrapper.lock:
                if not wrapper.has_executed:
                    wrapper.has_executed = True
                    wrapper.response = func(*args, **kwargs)
            return wrapper.response
                    
        wrapper.lock = threading.Lock()
    wrapper.has_executed = False
    return wrapper


def generate_unique_id(name, table_args):
    unique_constraint = f"{snake_case(name)}_{'_'.join(table_args).replace('UrdhvaPostgresBase.', '')}"
    if len(unique_constraint) > 63:
        unique_constraint = f"{snake_case(name)}_{'_'.join([args.replace('_', '')[0:5] for args in table_args]).replace('UrdhvaPostgresBase.', '')}"[0:62]
    return unique_constraint


def snake_case(s):
    """
    Convert CamelCase / PascalCase / mixed strings to snake_case.
    :param s: string
    :return: converted snake case string
    Example:- snake_case("AlgoFusion")
              return:- algo_fusion
    """
    s = re.sub(r'(.)([A-Z][a-z]+)', r'\1_\2', str(s))
    s = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', s)
    return s.lower()


def get_present_time(utc=False):
    """
    Function to get present time in utc or local format
    :param utc:
    :return:
    """
    time_stamp = datetime.datetime.now(datetime.timezone.utc)
    if not utc:
        time_stamp = time_stamp.astimezone(pytz.timezone('Asia/Kolkata'))
    return time_stamp
