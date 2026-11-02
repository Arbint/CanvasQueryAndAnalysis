from pydantic import BaseModel

from app.models.student import Student


class GradebookAssignment(BaseModel):
    id: int
    name: str
    group_name: str
    points_possible: float | None = None


class GradebookCell(BaseModel):
    score: float | None = None
    grade: str | None = None
    excused: bool = False
    missing: bool = False
    late: bool = False


class GradebookStudent(Student):
    # Keyed by assignment id; assignments with no submission record are absent.
    cells: dict[int, GradebookCell] = {}


class Gradebook(BaseModel):
    assignments: list[GradebookAssignment]
    students: list[GradebookStudent]
