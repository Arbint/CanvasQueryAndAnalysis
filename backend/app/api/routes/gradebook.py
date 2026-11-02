import asyncio

from fastapi import APIRouter, Depends, HTTPException

from app.api.routes.students import _parse_student
from app.dependencies import get_canvas_client
from app.models.gradebook import Gradebook, GradebookAssignment, GradebookCell, GradebookStudent
from app.services.canvas_client import CanvasAPIError, CanvasClient

router = APIRouter()


def _parse_assignments(groups: list[dict]) -> list[GradebookAssignment]:
    assignments: list[GradebookAssignment] = []
    for group in sorted(groups, key=lambda g: g.get("position") or 0):
        items = sorted(group.get("assignments") or [], key=lambda a: a.get("position") or 0)
        for a in items:
            # Unpublished assignments aren't shown in the Canvas gradebook either.
            if a.get("published") is False:
                continue
            assignments.append(
                GradebookAssignment(
                    id=a["id"],
                    name=a.get("name", ""),
                    group_name=group.get("name", ""),
                    points_possible=a.get("points_possible"),
                )
            )
    return assignments


def _current_total(enrollment: dict) -> str | None:
    # Matches the Total column of the Canvas gradebook, which by default leaves
    # ungraded assignments out (current_score). final_score counts them as 0.
    grades = enrollment.get("grades") or {}
    score = grades.get("current_score")
    if score is None:
        score = grades.get("final_score")
    if score is None:
        return None
    return f"{score:g}%"


def _parse_cell(submission: dict) -> GradebookCell:
    return GradebookCell(
        score=submission.get("score"),
        grade=submission.get("grade"),
        excused=bool(submission.get("excused")),
        missing=bool(submission.get("missing")),
        late=bool(submission.get("late")),
    )


@router.get("/courses/{course_id}/gradebook", response_model=Gradebook)
async def get_gradebook(course_id: int, canvas: CanvasClient = Depends(get_canvas_client)):
    try:
        enrollments, groups, submissions = await asyncio.gather(
            canvas.get_course_students(course_id),
            canvas.get_course_assignment_groups(course_id),
            canvas.get_course_submissions(course_id),
        )
    except CanvasAPIError as e:
        if e.status_code in (401, 403):
            raise HTTPException(
                status_code=403,
                detail="The Canvas token is not allowed to view assignment grades for this course.",
            )
        raise HTTPException(status_code=502, detail=e.message)

    assignments = _parse_assignments(groups)
    assignment_ids = {a.id for a in assignments}

    cells_by_user: dict[int, dict[int, GradebookCell]] = {}
    for sub in submissions:
        assignment_id = sub.get("assignment_id")
        if assignment_id in assignment_ids:
            cells_by_user.setdefault(sub.get("user_id"), {})[assignment_id] = _parse_cell(sub)

    students: list[GradebookStudent] = []
    seen: set[int] = set()
    for enrollment in enrollments:
        student = _parse_student(enrollment)
        # A student in several sections has one enrollment per section.
        if student.id in seen:
            continue
        seen.add(student.id)
        students.append(
            GradebookStudent(
                **student.model_dump(exclude={"email", "grade"}),
                grade=_current_total(enrollment),
                cells=cells_by_user.get(student.id, {}),
            )
        )

    return Gradebook(assignments=assignments, students=students)
