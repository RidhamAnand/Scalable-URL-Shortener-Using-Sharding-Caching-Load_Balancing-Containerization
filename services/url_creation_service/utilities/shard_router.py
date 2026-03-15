import os
from pymongo import MongoClient

clients = {
    "a": MongoClient(os.getenv("MONGO_A_URL")),
    "b": MongoClient(os.getenv("MONGO_B_URL")),
    "c": MongoClient(os.getenv("MONGO_C_URL")),
    "d": MongoClient(os.getenv("MONGO_D_URL")),
}

def get_collection(key: str):

    key = key.lower()

    if key not in clients:
        raise ValueError("Invalid shard key")

    db = clients[key]["url_shortener"]

    return db["urls"]

def insert_url_mapping(key: str, short_url: str, long_url: str):
    collection = get_collection(key)
    collection.insert_one({"short_url": short_url, "long_url": long_url})