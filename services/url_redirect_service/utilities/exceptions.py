from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class UrlServiceError(Exception):
    def __init__(self, detail: str, status_code: int = 500):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class UrlNotFoundError(UrlServiceError):
    def __init__(self, detail: str = "Short URL not found"):
        super().__init__(detail=detail, status_code=404)


class CacheLookupError(UrlServiceError):
    def __init__(self, detail: str = "Cache lookup failed"):
        super().__init__(detail=detail, status_code=503)


class DataStoreLookupError(UrlServiceError):
    def __init__(self, detail: str = "Database lookup failed"):
        super().__init__(detail=detail, status_code=503)


class UnexpectedServiceError(UrlServiceError):
    def __init__(self, detail: str = "Unexpected service failure"):
        super().__init__(detail=detail, status_code=500)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(UrlServiceError)
    def handle_url_service_error(_: Request, exc: UrlServiceError):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
