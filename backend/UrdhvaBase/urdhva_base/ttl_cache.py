import time
import threading
import traceback
import urdhva_base.settings
from typing import Callable


class InMemTTLCache:
    def __init__(self, ttl_seconds: int, fetch_function: Callable):
        """
        Initialize the cache with TTL and a fetch function to refresh data.

        :param ttl_seconds: Time-to-live (TTL) for each key in seconds.
        :param fetch_function: A callable function to fetch new data on expiry.
        """
        self.store = {}  # Dictionary to store key-value pairs with expiry
        self.ttl_seconds = ttl_seconds
        self.read_lock = threading.Lock()
        self.write_lock = threading.Lock()
        self.fetch_function = fetch_function

    @classmethod
    def _is_expired(cls, expiry_time: float) -> bool:
        """
        Check if the current time has passed the expiry time.
        :param expiry_time: Expiry time of the key.
        :return: True if expired, False otherwise.
        """
        return time.time() > expiry_time

    async def get(self, key):
        """
        Get the value for a key. If expired or not found, fetch and refresh it.
        :param key: The key to retrieve.
        :return: The value for the key.
        """
        with self.read_lock:
            try:
                if key in self.store:
                    value, expiry_time = self.store[key]
                    if value not in [{}, []] and not self._is_expired(expiry_time):
                        return value  # Return valid value

                # If key is not found or expired, fetch and refresh
                new_value = await self.fetch_function()
                await self.set(key, new_value)
                return new_value
            except Exception as e:
                print(f"Exception while doing get operation {e}, Traceback {traceback.format_exc()}")
                return None

    async def set(self, key, value):
        """
        Set a key-value pair in the cache with a new expiry time.
        :param key: The key to store.
        :param value: The value to store.
        """
        with self.write_lock:
            expiry_time = time.time() + self.ttl_seconds
            self.store[key] = (value, expiry_time)

    def __repr__(self):
        """
        String representation of the cache with non-expired items.
        """
        return str({k: v[0] for k, v in self.store.items() if not self._is_expired(v[1])})


class CacheDataInstance:
    _instances = {}

    @classmethod
    def get_instance(cls, cache_key, loader_func):
        """
        get instance for the given cache_key
        """
        if cache_key not in CacheDataInstance._instances:
            print(f"Cache Key Not Available {cache_key}")
            CacheDataInstance._instances[cache_key] = CacheDataInstance(loader_func).cache_handler

        return CacheDataInstance._instances[cache_key]

    def __init__(self, loader_func):
        """
        Initializing cache class
        """
        self.cache_handler = InMemTTLCache(ttl_seconds=urdhva_base.settings.default_masters_cache_seconds,
                                           fetch_function=loader_func)


"""
Example Code
async def fetch_from_source(key):
   print("Fetching data for cache")
   return "Value"

# Initializing the cache with a 5-second TTL and fetch function
cache = InMemTTLCache(ttl_seconds=5, fetch_function=fetch_from_source)
# fetch_from_source was the function from where it has to fetch on expiry
print(await cache.get("key1"))  # Fetches and caches the value
time.sleep(3)
print(await cache.get("key1"))  # Returns the cached value
time.sleep(3)
print(await cache.get("key1"))  # TTL expired, fetches again
print(cache)
"""