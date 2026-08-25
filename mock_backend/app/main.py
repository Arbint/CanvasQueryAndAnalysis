import json
import re
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

DB_PATH = Path(__file__).parent.parent / "db.json"
db: dict = json.loads(DB_PATH.read_text(encoding="utf-8-sig"))

# Pre-build lookup tables once at startup
_student_map: dict[int, dict] = {s["id"]: s for s in db["students"]}
_term_map: dict[int, str] = {t["id"]: t["name"] for t in db["terms"]}
_course_map: dict[int, dict] = {c["id"]: c for c in db["courses"]}
_course_ids: set[int] = set(_course_map)
_meeting_patterns = [
    "Mon/Wed 9:00-10:15 AM",
    "Mon/Wed 10:30-11:45 AM",
    "Tue/Thu 9:30-10:45 AM",
    "Tue/Thu 1:30-2:45 PM",
    "Wed 6:00-8:45 PM",
    "Online async",
]
def _mock_instructor_email(name: str) -> str:
    cleaned = re.sub(r"^(prof|dr|mr|ms|mrs)\.?\s+", "", name, flags=re.IGNORECASE).strip()
    slug = re.sub(r"[^a-z]+", ".", cleaned.lower()).strip(".") or "instructor"
    return f"{slug}@uiwtx.edu"


def _mock_grade(student_id: int, course_id: int) -> str:
    # Deterministic percent grade (matches the real backend's Total-column
    # percent format, e.g. "71%") so the same student+course always shows
    # the same demo grade, and range-based filtering has something to filter.
    percent = (student_id * 7 + course_id * 13) % 101
    return f"{percent}%"

app = FastAPI(title="Canvas Query and Analysis — Mock Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "mode": "mock"}


@app.get("/api/accounts")
def list_accounts() -> list[dict]:
    return db["accounts"]


@app.get("/api/accounts/{account_id}/terms")
def list_terms(account_id: int) -> list[dict]:
    return db["terms"]


@app.get("/api/courses")
def list_courses(
    account_id: int,
    term_ids: str = Query(default=""),
    keywords: str = Query(default=""),
) -> list[dict]:
    parsed_term_ids = {int(t) for t in term_ids.split(",") if t.strip()} if term_ids else set()
    parsed_keywords = [k.strip().lower() for k in keywords.split(",") if k.strip()] if keywords else []

    results = []
    for course in db["courses"]:
        if course["account_id"] != account_id:
            continue
        if parsed_term_ids and course["term_id"] not in parsed_term_ids:
            continue
        if parsed_keywords:
            haystack = (course["name"] + " " + course["course_code"]).lower()
            if not all(kw in haystack for kw in parsed_keywords):
                continue
        results.append({
            "id": course["id"],
            "name": course["name"],
            "course_code": course["course_code"],
            "instructor": course["instructor"],
            "term_name": _term_map.get(course["term_id"], "Unknown"),
            "student_count": None,
            "meeting_time": course.get("meeting_time", _meeting_patterns[course["id"] % len(_meeting_patterns)]),
        })
    return results


@app.get("/api/courses/{course_id}/instructor")
def course_instructor(course_id: int) -> dict:
    course = _course_map.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    name = course.get("instructor") or None
    return {"name": name, "email": _mock_instructor_email(name) if name else None}


@app.get("/api/courses/{course_id}/student-count")
def student_count(course_id: int) -> dict:
    if course_id not in _course_ids:
        raise HTTPException(status_code=404, detail="Course not found")
    count = sum(1 for e in db["enrollments"] if e["course_id"] == course_id)
    return {"count": count}


@app.get("/api/courses/{course_id}/students")
def list_students(course_id: int) -> list[dict]:
    if course_id not in _course_ids:
        raise HTTPException(status_code=404, detail="Course not found")
    result = []
    for enrollment in db["enrollments"]:
        if enrollment["course_id"] != course_id:
            continue
        student = _student_map.get(enrollment["student_id"])
        if not student:
            continue
        state: Literal["active", "inactive"] = (
            enrollment["state"] if enrollment["state"] in ("active", "inactive") else "inactive"
        )
        result.append({
            "id": student["id"],
            "first_name": student["first_name"],
            "last_name": student["last_name"],
            "ssid": student["ssid"],
            "login_id": student["login_id"],
            "enrollment_state": state,
            "email": f"{student['login_id']}@student.uiwtx.edu",
            "grade": enrollment.get("grade", _mock_grade(student["id"], course_id)),
        })
    return result


@app.get("/api/students/{student_id}/audit")
def audit_student(student_id: str, course_ids: str = Query()) -> list[dict]:
    parsed_course_ids = {int(c) for c in course_ids.split(",") if c.strip()}
    if not parsed_course_ids:
        raise HTTPException(status_code=400, detail="course_ids is required")

    target = student_id.strip().lower()
    result = []
    for enrollment in db["enrollments"]:
        if enrollment["course_id"] not in parsed_course_ids:
            continue
        student = _student_map.get(enrollment["student_id"])
        if not student or student["ssid"].strip().lower() != target:
            continue
        result.append({
            "course_id": enrollment["course_id"],
            "first_name": student["first_name"],
            "last_name": student["last_name"],
            "grade": enrollment.get("grade", _mock_grade(student["id"], enrollment["course_id"])),
        })
    return result
