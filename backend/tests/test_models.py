import pytest
from pydantic import ValidationError

from app.models.account import Account, Term
from app.models.course import Course
from app.models.student import Student


def test_account_valid():
    a = Account(id=1, name="Root Account")
    assert a.id == 1
    assert a.name == "Root Account"


def test_course_missing_required_field():
    with pytest.raises(ValidationError):
        Course(id=1, name="Math 101")  # missing course_code, instructor, term_name


def test_course_student_count_optional():
    c = Course(id=1, name="Math 101", course_code="MATH-101", instructor="Smith", term_name="Fall 2024")
    assert c.student_count is None


def test_student_valid():
    s = Student(
        id=10,
        first_name="Jane",
        last_name="Doe",
        ssid="123456",
        login_id="jdoe",
        enrollment_state="active",
    )
    assert s.email == "jdoe@student.uiwtx.edu"


def test_student_invalid_enrollment_state():
    with pytest.raises(ValidationError):
        Student(
            id=10,
            first_name="Jane",
            last_name="Doe",
            ssid="123456",
            login_id="jdoe",
            enrollment_state="observer",
        )


def test_student_email_composed_correctly():
    s = Student(
        id=5,
        first_name="Alex",
        last_name="Jones",
        ssid="999",
        login_id="ajones22",
        enrollment_state="inactive",
    )
    assert s.email == "ajones22@student.uiwtx.edu"
