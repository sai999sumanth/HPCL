import redis
import urdhva_base.settings
import urdhva_base.utilities
from redis import asyncio as aioredis


# Async redis connection pool
@urdhva_base.utilities.run_once
async def get_redis_connection() -> aioredis.Redis:
    redis_url = urdhva_base.settings.db_urls['redis'][0]
    pool = aioredis.ConnectionPool.from_url(url=redis_url.unicode_string(),
                                            max_connections=urdhva_base.settings.max_redis_connections, encoding='utf8',
                                            socket_timeout=10, retry_on_timeout=True)
    return aioredis.Redis.from_pool(pool)


# Synchronous redis connection pool
@urdhva_base.utilities.run_once
def get_synchronous_redis_connection():
    redis_url = urdhva_base.settings.db_urls['redis'][0]
    redis_pool = redis.ConnectionPool.from_url(url=redis_url.unicode_string(),
                                               max_connections=urdhva_base.settings.max_redis_connections,
                                               encoding='utf8', socket_timeout=10, retry_on_timeout=True)
    return redis.StrictRedis(connection_pool=redis_pool)


# Code Derived From http://peter-hoffmann.com/2012/python-simple-queue-redis-queue.html
class RedisQueue(object):
    """Simple Queue with Redis Backend"""
    def __init__(self, name, base_name=urdhva_base.settings.app_name.lower(), namespace='queue', **redis_kwargs):
        """The default connection parameters are: host='localhost', port=6379, db=0"""
        self.key = '%s:%s:%s' % (base_name, namespace, name)

    @classmethod
    async def client(cls) -> aioredis.Redis:
        return await get_redis_connection()

    async def qsize(self, client=None):
        """Return the approximate size of the queue."""
        if not client:
            client = await self.client()
        return await client.llen(self.key)

    async def empty(self, client=None):
        """Return True if the queue is empty, False otherwise."""
        return await self.qsize(client) == 0

    async def put(self, item, skip_on_exists=False):
        """Put item into the queue."""
        client = await self.client()
        if skip_on_exists:
            if await self.qsize(client):
                data = await client.lrange(self.key, 0, -1)
                if data and item in data:
                    return
        await client.rpush(self.key, item)

    async def get(self, block=True, timeout=0):
        """Remove and return an item from the queue.

        If optional args block is true and timeout is None (the default), block
        if necessary until an item is available."""
        client = await self.client()
        if block:
            item = await client.blpop(self.key, timeout=timeout)
        else:
            item = await client.lpop(self.key)

        if item:
            item = item[1]
        return item

    async def get_nowait(self):
        """Equivalent to get(False)."""
        return await self.get(False)
