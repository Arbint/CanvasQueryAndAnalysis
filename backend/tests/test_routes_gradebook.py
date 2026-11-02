import respx
from httpx import Response

from app.dependencies import get_canvas_client
from app.main import app
from app.services.canvas_client import CanvasClient

CANVAS_BASE = "https://canvas.test"
test_canvas_client = CanvasClient(base_url=CANVAS_BASE, token="test")
app.dependency_overrides[get_canvas_client] = lambda: test_canvas_client

ENROLLMENT = {
    "type": "StudentEnrollment",
    "enrollment_state": "active",
    "grades": {"current_score": 91.5, "final_score": 60},
    "user": {"id": 99, "sortable_name": "Doe, Jane", "login_id": "jdoe22", "sis_user_id": "SIS-001"},
}

GROUPS = [
    {
        "id": 2,
        "name": "Exams",
        "position": 2,
        "assignments": [{"id": 30, "name": "Final", "position": 1, "points_possible": 100, "published": True}],
    },
    {
        "id": 1,
        "name": "Homework",
        "position": 1,
        "assignments": [
            {"id": 11, "name": "HW 2", "position": 2, "points_possible": 10, "published": True},
            {"id": 10, "name": "HW 1", "position": 1, "points_possible": 10, "published": True},
            {"id": 12, "name": "Draft", "position": 3, "points_possible": 10, "published": False},
        ],
    },
]

SUBMISSIONS = [
    {"user_id": 99, "assignment_id": 10, "score": 9, "grade": "9", "late": True},
    {"user_id": 99, "assignment_id": 11, "score": None, "grade": None, "missing": True},
    {"user_id": 99, "assignment_id": 30, "score": None, "grade": None, "excused": True},
    {"user_id": 99, "assignment_id": 12, "score": 5, "grade": "5"},
]


def _mock_canvas(submissions_response: Response) -> None:
    respx.get(f"{CANVAS_BASE}/api/v1/courses/5/enrollments").mock(
        return_value=Response(200, json=[ENROLLMENT, ENROLLMENT])
    )
    respx.get(f"{CANVAS_BASE}/api/v1/courses/5/assignment_groups").mock(
        return_value=Response(200, json=GROUPS)
    )
    respx.get(f"{CANVAS_BASE}/api/v1/courses/5/students/submissions").mock(
        return_value=submissions_response
    )


def test_gradebook_orders_assignments_and_maps_cells(client):
    with respx.mock:
        _mock_canvas(Response(200, json=SUBMISSIONS))
        resp = client.get("/api/courses/5/gradebook")
    assert resp.status_code == 200
    body = resp.json()
    assert [a["name"] for a in body["assignments"]] == ["HW 1", "HW 2", "Final"]
    assert body["assignments"][2]["group_name"] == "Exams"

    assert len(body["students"]) == 1  # duplicate section enrollment collapsed
    student = body["students"][0]
    assert student["last_name"] == "Doe"
    assert student["grade"] == "91.5%"
    assert student["email"] == "jdoe22@student.uiwtx.edu"
    cells = student["cells"]
    assert set(cells) == {"10", "11", "30"}  # unpublished assignment dropped
    assert cells["10"] == {"score": 9, "grade": "9", "excused": False, "missing": False, "late": True}
    assert cells["11"]["missing"] is True
    assert cells["30"]["excused"] is True


def test_gradebook_unauthorized_returns_403(client):
    with respx.mock:
        _mock_canvas(Response(401, json={"status": "unauthorized"}))
        resp = client.get("/api/courses/5/gradebook")
    assert resp.status_code == 403
    assert "not allowed" in resp.json()["detail"]


def test_gradebook_total_falls_back_to_final_score(client):
    enrollment = {**ENROLLMENT, "grades": {"final_score": 75}}
    with respx.mock:
        _mock_canvas(Response(200, json=SUBMISSIONS))
        respx.get(f"{CANVAS_BASE}/api/v1/courses/5/enrollments").mock(
            return_value=Response(200, json=[enrollment])
        )
        resp = client.get("/api/courses/5/gradebook")
    assert resp.json()["students"][0]["grade"] == "75%"
