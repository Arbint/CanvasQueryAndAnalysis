import respx
from httpx import Response

from app.dependencies import get_canvas_client
from app.main import app
from app.services.canvas_client import CanvasClient

CANVAS_BASE = "https://canvas.test"

test_canvas_client = CanvasClient(base_url=CANVAS_BASE, token="test")
app.dependency_overrides[get_canvas_client] = lambda: test_canvas_client


def test_list_accounts(client):
    with respx.mock:
        respx.get(f"{CANVAS_BASE}/api/v1/accounts").mock(
            return_value=Response(200, json=[{"id": 1, "name": "Root"}])
        )
        resp = client.get("/api/accounts")
    assert resp.status_code == 200
    assert resp.json() == [{"id": 1, "name": "Root"}]


def test_list_accounts_canvas_error_returns_502(client):
    with respx.mock:
        respx.get(f"{CANVAS_BASE}/api/v1/accounts").mock(
            return_value=Response(401, json={"errors": []})
        )
        resp = client.get("/api/accounts")
    assert resp.status_code == 502


def test_list_terms(client):
    with respx.mock:
        respx.get(f"{CANVAS_BASE}/api/v1/accounts/2/terms").mock(
            return_value=Response(
                200,
                json=[{"enrollment_terms": [{"id": 10, "name": "Fall 2024"}]}],
            )
        )
        resp = client.get("/api/accounts/2/terms")
    assert resp.status_code == 200
    assert resp.json() == [{"id": 10, "name": "Fall 2024"}]
