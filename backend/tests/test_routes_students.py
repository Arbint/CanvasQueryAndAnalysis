import respx
from httpx import Response

from app.dependencies import get_canvas_client
from app.main import app
from app.services.canvas_client import CanvasClient

CANVAS_BASE = "https://canvas.test"
test_canvas_client = CanvasClient(base_url=CANVAS_BASE, token="test")
app.dependency_overrides[get_canvas_client] = lambda: test_canvas_client

SAMPLE_ENROLLMENT = {
    "type": "StudentEnrollment",
    "enrollment_state": "active",
    "user": {
        "id": 99,
        "sortable_name": "Doe, Jane",
        "login_id": "jdoe22",
        "sis_user_id": "SIS-001",
    },
}


def test_list_students(client):
    with respx.mock:
        respx.get(f"{CANVAS_BASE}/api/v1/courses/5/enrollments").mock(
            return_value=Response(200, json=[SAMPLE_ENROLLMENT])
        )
        resp = client.get("/api/courses/5/students")
    assert resp.status_code == 200
    student = resp.json()[0]
    assert student["first_name"] == "Jane"
    assert student["last_name"] == "Doe"
    assert student["login_id"] == "jdoe22"
    assert student["ssid"] == "SIS-001"
    assert student["email"] == "jdoe22@student.uiwtx.edu"
    assert student["enrollment_state"] == "active"


def test_list_students_empty(client):
    with respx.mock:
        respx.get(f"{CANVAS_BASE}/api/v1/courses/5/enrollments").mock(
            return_value=Response(200, json=[])
        )
        resp = client.get("/api/courses/5/students")
    assert resp.status_code == 200
    assert resp.json() == []


def test_student_count(client):
    enrollments = [
        SAMPLE_ENROLLMENT,
        {**SAMPLE_ENROLLMENT, "user": {**SAMPLE_ENROLLMENT["user"], "id": 100}},
    ]
    with respx.mock:
        respx.get(f"{CANVAS_BASE}/api/v1/courses/5/enrollments").mock(
            return_value=Response(200, json=enrollments)
        )
        resp = client.get("/api/courses/5/student-count")
    assert resp.status_code == 200
    assert resp.json()["count"] == 2
