import os
import logging
from pymongo import MongoClient

logger = logging.getLogger(__name__)

clients = {
    "a": MongoClient(os.getenv("MONGO_A_URL")),
    "b": MongoClient(os.getenv("MONGO_B_URL")),
    "c": MongoClient(os.getenv("MONGO_C_URL")),
    "d": MongoClient(os.getenv("MONGO_D_URL")),
}

def get_collection(key: str):

    key = key.lower()
    logger.info("Resolving shard key: %s", key)

    if key not in clients:
        logger.warning("Invalid shard key received: %s", key)
        raise ValueError("Invalid shard key")

    db = clients[key]["url_shortener"]

    return db["urls"]


def get_long_url(short_url: str) -> str:
    key = short_url[0].lower()
    logger.info("Lookup request routed to shard key: %s", key)
    collection = get_collection(key)
    result = collection.find_one({"short_url": short_url})
    if result:
        return result["long_url"]
    else:
        raise ValueError("Short URL not found")