import anyio
import respx
from httpx import Response

from app.services.canvas_client import CanvasAPIError, CanvasClient

BASE = "https://canvas.test"
TOKEN = "test-token"


def make_client() -> CanvasClient:
    return CanvasClient(base_url=BASE, token=TOKEN)


def run(coro):
    """Run an async coroutine synchronously via anyio."""
    return anyio.from_thread.run_sync(lambda: anyio.run(lambda: coro))


def test_get_accounts_single_page():
    with respx.mock:
        respx.get(f"{BASE}/api/v1/accounts").mock(
            return_value=Response(200, json=[{"id": 1, "name": "Root"}])
        )
        result = anyio.run(make_client().get_accounts)
    assert result == [{"id": 1, "name": "Root"}]


def test_get_accounts_pagination():
    page2_url = f"{BASE}/api/v1/accounts?page=2"
    with respx.mock:
        respx.get(f"{BASE}/api/v1/accounts").mock(
            return_value=Response(
                200,
                json=[{"id": 1, "name": "Root"}],
                headers={"Link": f'<{page2_url}>; rel="next"'},
            )
        )
        respx.get(page2_url).mock(
            return_value=Response(200, json=[{"id": 2, "name": "Sub"}])
        )
        result = anyio.run(make_client().get_accounts)
    assert len(result) == 2
    assert result[1]["name"] == "Sub"


def test_get_courses_passes_search_term():
    with respx.mock:
        route = respx.get(f"{BASE}/api/v1/accounts/1/courses").mock(
            return_value=Response(200, json=[])
        )
        anyio.run(lambda: make_client().get_courses(account_id=1, term_ids=[], keywords=["math"]))
    assert route.called
    assert b"search_term=math" in route.calls.last.request.url.query


def test_get_course_students_filters_enrollment_type():
    enrollments = [
        {"type": "StudentEnrollment", "user": {"name": "Alice"}},
        {"type": "TeacherEnrollment", "user": {"name": "Bob"}},
        {"type": "StudentEnrollment", "user": {"name": "Carol"}},
    ]
    with respx.mock:
        respx.get(f"{BASE}/api/v1/courses/5/enrollments").mock(
            return_value=Response(200, json=enrollments)
        )
        result = anyio.run(lambda: make_client().get_course_students(course_id=5))
    assert len(result) == 2
    assert all(e["type"] == "StudentEnrollment" for e in result)


def test_get_course_students_requests_total_scores():
    with respx.mock:
        route = respx.get(f"{BASE}/api/v1/courses/5/enrollments").mock(
            return_value=Response(200, json=[])
        )
        anyio.run(lambda: make_client().get_course_students(course_id=5))
    assert route.called
    query = route.calls.last.request.url.params
    assert query.get_list("include[]") == ["user", "total_scores"]


def test_canvas_api_error_on_4xx():
    with respx.mock:
        respx.get(f"{BASE}/api/v1/accounts").mock(
            return_value=Response(401, json={"errors": [{"message": "Unauthorized"}]})
        )
        try:
            anyio.run(make_client().get_accounts)
            assert False, "Expected CanvasAPIError"
        except CanvasAPIError as e:
            assert e.status_code == 401
