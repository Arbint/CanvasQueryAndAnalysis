from functools import lru_cache

from app.config import settings
from app.services.canvas_client import CanvasClient


@lru_cache
def get_canvas_client() -> CanvasClient:
    return CanvasClient(base_url=settings.canvas_api_url, token=settings.canvas_api_token)
