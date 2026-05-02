import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("CANVAS_API_TOKEN", "test-token")
os.environ.setdefault("CANVAS_API_URL", "https://canvas.test")

from app.main import app  # noqa: E402 — env must be set before import


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
