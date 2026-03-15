import redis
import os

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))

redis_client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    db=REDIS_DB,
    decode_responses=True
)


def set(key: str, value: str):
    redis_client.set(key, value)


def cache_url_mapping(short_url: str, long_url: str):
    redis_client.set(short_url, long_url)

def get_next_sequence(machine_id: str) -> int:
    redis_client.ping()
    key = f"counter:{machine_id}"
    sequence = redis_client.incr(key)
    return sequence