from pydantic import BaseModel


class Course(BaseModel):
    id: int
    name: str
    course_code: str
    instructor: str
    term_name: str
    student_count: int | None = None


class Instructor(BaseModel):
    name: str | None = None
    email: str | None = None
