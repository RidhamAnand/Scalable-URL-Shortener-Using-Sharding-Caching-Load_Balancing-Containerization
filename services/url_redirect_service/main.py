import os
from fastapi import FastAPI, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from prometheus_fastapi_instrumentator import Instrumentator
from typing import Annotated
import logging
import time
from urllib.parse import urlparse

from utilities import redis_client, shard_router
from utilities.exceptions import (
    CacheLookupError,
    DataStoreLookupError,
    UnexpectedServiceError,
    UrlNotFoundError,
    register_exception_handlers,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _is_truthy(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


ENABLE_REDIS_CACHE = _is_truthy(os.getenv("ENABLE_REDIS_CACHE", "true"))

app = FastAPI()
register_exception_handlers(app)
Instrumentator().instrument(app).expose(app)

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


def normalize_redirect_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme:
        return url

    normalized = f"https://{url}"
    logger.info("Normalized redirect URL from '%s' to '%s'", url, normalized)
    return normalized


def fetch_long_url(short_url: str) -> tuple[str, str]:
    if ENABLE_REDIS_CACHE:
        try:
            long_url = redis_client.get(short_url)
        except Exception as exc:
            raise CacheLookupError("Unable to read from Redis") from exc

        if long_url:
            return long_url, "redis"

    try:
        long_url = shard_router.get_long_url(short_url)
    except ValueError as exc:
        raise UrlNotFoundError(str(exc)) from exc
    except Exception as exc:
        raise DataStoreLookupError("Unable to read from Mongo shard") from exc

    if ENABLE_REDIS_CACHE:
        try:
            redis_client.cache_url_mapping(short_url, long_url)
        except Exception:
            logger.warning("Failed to warm Redis cache for short_url=%s", short_url)

    return long_url, "mongo"




@app.get("/resolve/{short_url}")
def resolve_long_url(
    short_url: Annotated[str, Path()]
):
    total_start = time.perf_counter()

    try:
        redis_lookup_ms = None
        if ENABLE_REDIS_CACHE:
            redis_start = time.perf_counter()
            cached_url = redis_client.get(short_url)
            redis_lookup_ms = (time.perf_counter() - redis_start) * 1000

            if cached_url:
                total_latency_ms = (time.perf_counter() - total_start) * 1000
                return {
                    "short_url": short_url,
                    "long_url": cached_url,
                    "source": "redis",
                    "redis_lookup_ms": round(redis_lookup_ms, 3),
                    "db_lookup_ms": None,
                    "total_latency_ms": round(total_latency_ms, 3),
                }

        db_start = time.perf_counter()
        long_url, source = fetch_long_url(short_url)
        db_lookup_ms = (time.perf_counter() - db_start) * 1000 if source == "mongo" else None
        total_latency_ms = (time.perf_counter() - total_start) * 1000
        return {
            "short_url": short_url,
            "long_url": long_url,
            "source": source,
            "redis_lookup_ms": round(redis_lookup_ms, 3) if redis_lookup_ms is not None else None,
            "db_lookup_ms": round(db_lookup_ms, 3) if db_lookup_ms is not None else None,
            "total_latency_ms": round(total_latency_ms, 3),
        }
    except UrlNotFoundError:
        raise
    except (CacheLookupError, DataStoreLookupError):
        raise
    except Exception as exc:
        raise UnexpectedServiceError() from exc


@app.get("/{short_url}")
def redirect_to_long_url(
    short_url: Annotated[str, Path()]
):

    try:
        long_url, _ = fetch_long_url(short_url)
        return RedirectResponse(url=normalize_redirect_url(long_url), status_code=301)
    except UrlNotFoundError:
        raise
    except (CacheLookupError, DataStoreLookupError):
        raise
    except Exception as exc:
        raise UnexpectedServiceError() from exc

