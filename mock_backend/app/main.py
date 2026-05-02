import json
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

DB_PATH = Path(__file__).parent.parent / "db.json"
db: dict = json.loads(DB_PATH.read_text(encoding="utf-8"))

# Pre-build lookup tables once at startup
_student_map: dict[int, dict] = {s["id"]: s for s in db["students"]}
_term_map: dict[int, str] = {t["id"]: t["name"] for t in db["terms"]}
_course_ids: set[int] = {c["id"] for c in db["courses"]}

app = FastAPI(title="Canvas Query and Analysis — Mock Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
        })
    return results


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
        })
    return result
