import asyncio

import respx
from httpx import Response

from app.api.routes.students import _MAX_CONCURRENT_COURSE_CHECKS
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
    assert student["grade"] is None


def test_list_students_grade_prefers_final_score(client):
    enrollment = {**SAMPLE_ENROLLMENT, "grades": {"final_score": 87.5, "current_score": 60}}
    with respx.mock:
        respx.get(f"{CANVAS_BASE}/api/v1/courses/5/enrollments").mock(
            return_value=Response(200, json=[enrollment])
        )
        resp = client.get("/api/courses/5/students")
    assert resp.json()[0]["grade"] == "87.5%"


def test_list_students_grade_falls_back_to_current_score(client):
    enrollment = {**SAMPLE_ENROLLMENT, "grades": {"current_score": 90}}
    with respx.mock:
        respx.get(f"{CANVAS_BASE}/api/v1/courses/5/enrollments").mock(
            return_value=Response(200, json=[enrollment])
        )
        resp = client.get("/api/courses/5/students")
    assert resp.json()[0]["grade"] == "90%"


def test_list_students_grade_omitted_when_unauthorized(client):
    # Canvas omits the "grades" key entirely rather than erroring when the
    # caller lacks grade-view permission for the course.
    enrollment = {**SAMPLE_ENROLLMENT}
    enrollment.pop("grades", None)
    with respx.mock:
        respx.get(f"{CANVAS_BASE}/api/v1/courses/5/enrollments").mock(
            return_value=Response(200, json=[enrollment])
        )
        resp = client.get("/api/courses/5/students")
    assert resp.json()[0]["grade"] is None


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


def test_audit_requires_course_ids(client):
    resp = client.get("/api/students/SIS-001/audit")
    assert resp.status_code == 422  # missing param entirely
    resp = client.get("/api/students/SIS-001/audit?course_ids=")
    assert resp.status_code == 400  # present but blank


def test_audit_checks_every_course_concurrently_and_returns_matches(client):
    other_enrollment = {
        **SAMPLE_ENROLLMENT,
        "user": {**SAMPLE_ENROLLMENT["user"], "id": 100, "sis_user_id": "SIS-002", "sortable_name": "Roe, Rick"},
    }
    with respx.mock:
        route_1 = respx.get(f"{CANVAS_BASE}/api/v1/courses/1/enrollments").mock(
            return_value=Response(200, json=[SAMPLE_ENROLLMENT])
        )
        route_2 = respx.get(f"{CANVAS_BASE}/api/v1/courses/2/enrollments").mock(
            return_value=Response(200, json=[other_enrollment])
        )
        route_3 = respx.get(f"{CANVAS_BASE}/api/v1/courses/3/enrollments").mock(
            return_value=Response(200, json=[other_enrollment])
        )
        resp = client.get("/api/students/SIS-001/audit?course_ids=1,2,3")
    assert resp.status_code == 200
    assert route_1.call_count == 1
    assert route_2.call_count == 1
    assert route_3.call_count == 1  # every course checked, not short-circuited
    matches = resp.json()
    assert len(matches) == 1
    assert matches[0] == {"course_id": 1, "first_name": "Jane", "last_name": "Doe", "grade": None}


def test_audit_matches_ssid_case_insensitively(client):
    with respx.mock:
        respx.get(f"{CANVAS_BASE}/api/v1/courses/1/enrollments").mock(
            return_value=Response(200, json=[SAMPLE_ENROLLMENT])
        )
        resp = client.get("/api/students/sis-001/audit?course_ids=1")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_audit_no_match_returns_empty_list(client):
    with respx.mock:
        respx.get(f"{CANVAS_BASE}/api/v1/courses/1/enrollments").mock(
            return_value=Response(200, json=[SAMPLE_ENROLLMENT])
        )
        resp = client.get("/api/students/NOBODY/audit?course_ids=1")
    assert resp.status_code == 200
    assert resp.json() == []


def test_audit_propagates_canvas_error(client):
    with respx.mock:
        respx.get(f"{CANVAS_BASE}/api/v1/courses/1/enrollments").mock(
            return_value=Response(200, json=[SAMPLE_ENROLLMENT])
        )
        respx.get(f"{CANVAS_BASE}/api/v1/courses/2/enrollments").mock(
            return_value=Response(403, json={"status": "unauthorized"})
        )
        resp = client.get("/api/students/SIS-001/audit?course_ids=1,2")
    assert resp.status_code == 502


def test_audit_caps_concurrent_course_checks(client):
    state = {"current": 0, "peak": 0}
    course_count = _MAX_CONCURRENT_COURSE_CHECKS * 3

    async def slow_empty_roster(request):
        state["current"] += 1
        state["peak"] = max(state["peak"], state["current"])
        await asyncio.sleep(0.03)
        state["current"] -= 1
        return Response(200, json=[])

    with respx.mock:
        for course_id in range(1, course_count + 1):
            respx.get(f"{CANVAS_BASE}/api/v1/courses/{course_id}/enrollments").mock(
                side_effect=slow_empty_roster
            )
        course_ids = ",".join(str(i) for i in range(1, course_count + 1))
        resp = client.get(f"/api/students/SIS-001/audit?course_ids={course_ids}")

    assert resp.status_code == 200
    assert state["peak"] <= _MAX_CONCURRENT_COURSE_CHECKS
    assert state["peak"] > 1  # actually ran concurrently, not serialized
