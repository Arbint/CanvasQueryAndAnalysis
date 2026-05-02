from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_canvas_client
from app.models.student import Student
from app.services.canvas_client import CanvasAPIError, CanvasClient

router = APIRouter()


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
