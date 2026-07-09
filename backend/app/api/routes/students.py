import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_canvas_client
from app.models.student import AuditMatch, Student
from app.services.canvas_client import CanvasAPIError, CanvasClient

router = APIRouter()

# How many course rosters Student Audit fetches from Canvas at once. Canvas
# enforces a per-token request-cost budget, and firing every course in the
# list simultaneously (no cap) can trip its rate limiter (429).
_MAX_CONCURRENT_COURSE_CHECKS = 5


def _parse_grade(enrollment: dict) -> str | None:
    # Letter grades require a permission this app doesn't have (see feedback15);
    # the overall percentage total is visible under a lighter permission and
    # Canvas omits it gracefully rather than failing when even that's missing.
    grades = enrollment.get("grades") or {}
    score = grades.get("final_score")
    if score is None:
        score = grades.get("current_score")
    if score is None:
        return None
    return f"{score:g}%"


def _parse_student(enrollment: dict) -> Student:
    user = enrollment.get("user", {})
    sortable_name = user.get("sortable_name", ", ")
    parts = sortable_name.split(", ", 1)
    last_name = parts[0].strip() if len(parts) > 0 else ""
    first_name = parts[1].strip() if len(parts) > 1 else ""

    state = enrollment.get("enrollment_state", "inactive")
    if state not in ("active", "inactive"):
        state = "inactive"

    return Student(
        id=user.get("id", 0),
        first_name=first_name or user.get("name", "").split(" ")[0],
        last_name=last_name,
        ssid=user.get("sis_user_id") or "",
        login_id=user.get("login_id") or "",
        enrollment_state=state,
        grade=_parse_grade(enrollment),
    )


@router.get("/courses/{course_id}/student-count")
async def student_count(course_id: int, canvas: CanvasClient = Depends(get_canvas_client)):
    try:
        count = await canvas.get_course_student_count(course_id)
    except CanvasAPIError as e:
        raise HTTPException(status_code=502, detail=e.message)
    return {"count": count}


@router.get("/courses/{course_id}/students", response_model=list[Student])
async def list_students(course_id: int, canvas: CanvasClient = Depends(get_canvas_client)):
    try:
        raw = await canvas.get_course_students(course_id)
    except CanvasAPIError as e:
        raise HTTPException(status_code=502, detail=e.message)
    return [_parse_student(e) for e in raw]


@router.get("/students/{student_id}/audit", response_model=list[AuditMatch])
async def audit_student(
    student_id: str,
    course_ids: str = Query(),
    canvas: CanvasClient = Depends(get_canvas_client),
):
    """Find which of the given courses a student is enrolled in.

    Fans out one roster fetch per course id from the server — a single
    browser request that never touches the browser's per-origin connection
    cap, using the same pooled Canvas client and the same course-roster call
    (no elevated Canvas permission) as Student List. Concurrency is capped
    (see _MAX_CONCURRENT_COURSE_CHECKS) to stay under Canvas's rate limit.
    """
    parsed_course_ids = [int(c) for c in course_ids.split(",") if c.strip()]
    if not parsed_course_ids:
        raise HTTPException(status_code=400, detail="course_ids is required")

    target = student_id.strip().lower()
    semaphore = asyncio.Semaphore(_MAX_CONCURRENT_COURSE_CHECKS)

    async def check_course(course_id: int) -> AuditMatch | None:
        async with semaphore:
            raw = await canvas.get_course_students(course_id)
        for enrollment in raw:
            student = _parse_student(enrollment)
            if student.ssid.strip().lower() == target:
                return AuditMatch(
                    course_id=course_id,
                    first_name=student.first_name,
                    last_name=student.last_name,
                    grade=student.grade,
                )
        return None

    try:
        results = await asyncio.gather(*(check_course(cid) for cid in parsed_course_ids))
    except CanvasAPIError as e:
        raise HTTPException(status_code=502, detail=e.message)

    return [match for match in results if match is not None]
