from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class CreationServiceError(Exception):
    def __init__(self, detail: str, status_code: int = 500):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class InvalidUrlInputError(CreationServiceError):
    def __init__(self, detail: str = "Invalid long URL"):
        super().__init__(detail=detail, status_code=400)


class UrlPersistenceError(CreationServiceError):
    def __init__(self, detail: str = "Unable to store URL mapping"):
        super().__init__(detail=detail, status_code=503)


class UnexpectedCreationError(CreationServiceError):
    def __init__(self, detail: str = "Unexpected creation service failure"):
        super().__init__(detail=detail, status_code=500)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(CreationServiceError)
    def handle_creation_service_error(_: Request, exc: CreationServiceError):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
