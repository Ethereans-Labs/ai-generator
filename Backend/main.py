from app.api.routers.code_generation import code_generation_router
from app.settings import init_settings
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.concurrency import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from typing import Dict
import logging
import os
import uvicorn

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    calls_per_user: Dict[str, list] = {}
    yield {"calls_per_user": calls_per_user}


app = FastAPI(lifespan=lifespan)

init_settings()

# Default to 'development' if not set
environment = os.getenv("ENVIRONMENT", "dev")

if environment == "dev":
    logger = logging.getLogger("uvicorn")
    logger.warning(
        "Running in development mode - allowing CORS for all origins")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Redirect to documentation page when accessing base URL
    @app.get("/")
    async def redirect_to_docs():
        return RedirectResponse(url="/docs")


app.include_router(code_generation_router, prefix="/api/code")


if __name__ == "__main__":
    app_host = os.getenv("APP_HOST", "0.0.0.0")
    app_port = int(os.getenv("APP_PORT", "8000"))
    reload = True if environment == "dev" else False

    uvicorn.run(app="main:app", host=app_host, port=app_port, reload=reload)
