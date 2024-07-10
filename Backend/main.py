import uvicorn
import os
import logging
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from app.settings import init_settings
from app.api.routers.chat import chat_router
from dotenv import load_dotenv

load_dotenv()


app = FastAPI()

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


def mount_static_files(directory, path):
    if os.path.exists(directory):
        app.mount(path, StaticFiles(directory=directory),
                  name=f"{directory}-static")


# Mount the data files to serve the file viewer
mount_static_files("data", "/api/files/data")
# Mount the output files from tools
mount_static_files("tool-output", "/api/files/tool-output")

app.include_router(chat_router, prefix="/api/chat")


if __name__ == "__main__":
    app_host = os.getenv("APP_HOST", "0.0.0.0")
    app_port = int(os.getenv("APP_PORT", "8000"))
    reload = True if environment == "dev" else False

    uvicorn.run(app="main:app", host=app_host, port=app_port, reload=reload)
