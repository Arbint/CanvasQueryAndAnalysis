import respx
from httpx import Response

from app.dependencies import get_canvas_client
from app.main import app
from app.services.canvas_client import CanvasClient

CANVAS_BASE = "https://canvas.test"
test_canvas_client = CanvasClient(base_url=CANVAS_BASE, token="test")
app.dependency_overrides[get_canvas_client] = lambda: test_canvas_client

SAMPLE_COURSE = {
    "id": 42,
    "name": "Math 101",
    "course_code": "MATH-101",
    "teachers": [{"display_name": "Dr. Smith"}],
    "term": {"name": "Fall 2024"},
    "enrollment_term_id": 10,
}


def test_list_courses(client):
    with respx.mock:
        respx.get(f"{CANVAS_BASE}/api/v1/accounts/1/courses").mock(
            return_value=Response(200, json=[SAMPLE_COURSE])
        )
        resp = client.get("/api/courses?account_id=1")
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["name"] == "Math 101"
    assert data[0]["instructor"] == "Dr. Smith"
    assert data[0]["term_name"] == "Fall 2024"
    assert data[0]["student_count"] is None


def test_list_courses_empty(client):
    with respx.mock:
        respx.get(f"{CANVAS_BASE}/api/v1/accounts/1/courses").mock(
            return_value=Response(200, json=[])
        )
        resp = client.get("/api/courses?account_id=1")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_courses_invalid_account_id(client):
    resp = client.get("/api/courses?account_id=notanumber")
    assert resp.status_code == 422


def test_list_courses_canvas_error(client):
    with respx.mock:
        respx.get(f"{CANVAS_BASE}/api/v1/accounts/1/courses").mock(
            return_value=Response(500, json={})
        )
        resp = client.get("/api/courses?account_id=1")
    assert resp.status_code == 502
