# Implementation notes: Grade workaround (feedback16)

Companion to `feedback16-Grade.md`.

## The workaround

`feedback15`'s Student Course Audit hit a 403 trying to fetch letter grades via
`GET /users/sis_user_id:{id}/enrollments?include[]=grades` — that endpoint needs both "Read SIS
Data" and "View all grades" permissions, neither grantable in this environment (see
`feedback15-StudentAudit-Implementation.md`). That path was removed entirely.

This feedback asks for a different, lighter-weight source: the course-scoped enrollments call
already used successfully by the roster feature (Student List, course counts, and now Student
Audit) supports `include[]=total_scores`, which adds each enrollment's overall percentage grade
(`grades.final_score` / `current_score`). Canvas's documented behavior for this include is to
silently omit it — not reject the request — when the caller lacks grade-view permission for that
course, so it's safe to always request without risking the roster call that already works.

## Changes

- `backend/app/services/canvas_client.py` — `get_course_students` now requests
  `include[]=["user", "total_scores"]` instead of just `["user"]`.
- `backend/app/models/student.py` — `Student` gained `grade: str | None = None`.
- `backend/app/api/routes/students.py` — new `_parse_grade(enrollment)`: prefers
  `grades.final_score`, falls back to `grades.current_score`, formats as `"{score:g}%"` (e.g.
  `"87.5%"`, `"90%"`), returns `None` if neither is present (unauthorized or ungraded).
- `frontend/src/api/types.ts` — `Student.grade` widened to `string | null` to match the backend's
  `Optional[str]` (previously typed as if it could only be absent, never `null`).
- `frontend/src/components/StudentList/StudentList.tsx` — added a Grade column (`s.grade ?? '—'`).
- **Student Course Audit needed no changes.** It already reads `grade` off the `Student` objects
  returned by the same `getStudents` call (see `feedback15-StudentAudit-Implementation.md`), so
  it started showing real percentage grades in live Canvas mode as soon as the backend started
  returning them.
- Mock backend is untouched — it already returns a demo letter grade (e.g. `"B+"`) per enrollment,
  unrelated to this permission workaround, so both real and mock modes show *something* under
  Grade, just with different fidelity (percentage vs. demo letter), which is the same pattern the
  app already has for other data.

## Verification

- New backend tests cover: `final_score` preferred over `current_score`, fallback to
  `current_score` alone, and the "no grades key at all" case returning `None` (not an error) —
  simulating an unauthorized caller. Also asserts `include[]` is exactly `["user", "total_scores"]`.
- New frontend tests cover the Grade column rendering a value and rendering `—` when null.
- Full suites pass: backend 23/23 (excluding the same 3 pre-existing unrelated failures), frontend
  `tsc --noEmit` clean, `vitest run` 31/31.
- Confirmed the mock backend's existing grade behavior is unaffected by re-hitting it live.
- Could not verify the percentage actually resolves against the real Canvas instance from here —
  that requires trying it against production Canvas, which only you can do. If `total_scores` is
  *also* blocked by permissions, the code already degrades gracefully (grade shows as `—`
  everywhere) rather than erroring, so worst case is no regression.
