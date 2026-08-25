from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_canvas_client
from app.models.course import Course, Instructor
from app.services.canvas_client import CanvasAPIError, CanvasClient
from app.services.canvas_format import extract_instructor, extract_term_name

router = APIRouter()


@router.get("/courses", response_model=list[Course])
async def list_courses(
    account_id: int,
    term_ids: str = Query(default=""),
    keywords: str = Query(default=""),
    canvas: CanvasClient = Depends(get_canvas_client),
):
    parsed_term_ids = [int(t) for t in term_ids.split(",") if t.strip()] if term_ids else []
    parsed_keywords = [k for k in keywords.split(",") if k.strip()] if keywords else []

    try:
        raw = await canvas.get_courses(
            account_id=account_id,
            term_ids=parsed_term_ids,
            keywords=parsed_keywords,
        )
    except CanvasAPIError as e:
        raise HTTPException(status_code=502, detail=e.message)

    return [
        Course(
            id=c["id"],
            name=c["name"],
            course_code=c.get("course_code", ""),
            instructor=extract_instructor(c),
            term_name=extract_term_name(c),
        )
        for c in raw
    ]


@router.get("/courses/{course_id}/instructor", response_model=Instructor)
async def get_course_instructor(course_id: int, canvas: CanvasClient = Depends(get_canvas_client)):
    try:
        teacher_enrollment = await canvas.get_course_teacher(course_id)
    except CanvasAPIError as e:
        raise HTTPException(status_code=502, detail=e.message)

    if not teacher_enrollment:
        return Instructor()

    user = teacher_enrollment.get("user", {})
    return Instructor(name=user.get("name") or user.get("display_name"), email=user.get("email"))
