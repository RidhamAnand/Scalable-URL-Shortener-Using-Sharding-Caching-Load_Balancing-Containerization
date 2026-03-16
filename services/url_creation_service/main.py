import os

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from utilities import redis_client, shard_router
from utilities.exceptions import (
    InvalidUrlInputError,
    UnexpectedCreationError,
    UrlPersistenceError,
    register_exception_handlers,
)
from shorterUrlCreator import *

# Request model for URL creation
class UrlRequest(BaseModel):
    long_url: str

# Response model for URL creation
class UrlResponse(BaseModel):
    short_url: str

app = FastAPI(root_path="/create")
register_exception_handlers(app)

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

machine_id = os.getenv("MACHINE_ID")

if machine_id is None:
    raise Exception("MACHINE_ID environment variable is required")

@app.post("/", status_code=status.HTTP_201_CREATED)
async def return_short_url(req: UrlRequest) -> UrlResponse:
    long_url = req.long_url.strip()
    if not long_url:
        raise InvalidUrlInputError("URL cannot be empty")

    try:
        sequence = redis_client.get_next_sequence(machine_id)
        print("MACHINE_ID: ", machine_id)
        print("Sequence: ", sequence)

        short_url = generate_short_url(long_url, machine_id=machine_id, sequence_number=sequence)
        shard_router.insert_url_mapping(machine_id, short_url, long_url)
        return UrlResponse(short_url=short_url)
    except InvalidUrlInputError:
        raise
    except ValueError as exc:
        raise UrlPersistenceError(str(exc)) from exc
    except UrlPersistenceError:
        raise
    except Exception as exc:
        raise UnexpectedCreationError() from exc


