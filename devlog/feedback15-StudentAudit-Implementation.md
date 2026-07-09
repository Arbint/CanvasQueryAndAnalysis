# Implementation notes: Student Course Audit (feedback15)

Companion to `feedback15-StudentAudit.md` and `feedback15-StudentAuditAlt.md`, describing how
the requested feature was built and why it ended up in its current shape.

## Summary

Added a third tab, "Student Course Audit," next to Aggregation Graph and Trend Analysis in
the center working area. It looks up a student by ID and lists every course they took *among
the courses currently in Column 1's course list*, with sortable columns for name, code,
instructor, term, and grade.

The app is read-only throughout: every route (`app.get`/`router.get`) and every `CanvasClient`
call is a GET, CORS is locked to `allow_methods=["GET"]` on both the real and mock backend, and
the frontend has exactly one network call site (`api/client.ts`'s `get<T>` helper) — no other
`fetch`/`axios` call exists anywhere in the app. This feature doesn't change any of that.

## Why "always use the course list" — this went through two prior designs first

This is the third shape this feature has taken, each one dropped for a concrete reason:

1. **First pass:** a single `/audit` endpoint that always fetched the student's full Canvas
   enrollment history via `GET /api/v1/users/sis_user_id:{id}/enrollments`, then issued one
   `GET /api/v1/courses/{id}` call *per enrolled course* to get course details, filtering by
   term afterward. Dropped for being call-inefficient — auditing one semester for a graduating
   senior could mean 30-40 Canvas calls to answer a question about 5 courses.

2. **Second pass:** split into a `/grades` endpoint (course-list mode, 1 Canvas call total) and
   an `/audit` endpoint (semester-range mode, 1 call + 1 per selected term via the existing bulk
   `get_courses`). Both still opened with the same `users/sis_user_id:{id}/enrollments` call.
   Dropped after hitting `Canvas API error 403: user not authorized to perform that action` in
   real usage — the `sis_user_id:` URL prefix requires Canvas's "Read SIS Data" permission, and
   `include[]=grades` on that endpoint requires "View all grades" — both more sensitive than
   anything else this app asks for, and not grantable in this environment.

3. **Current design:** the "use course list" checkbox and the Start/End Semester range were
   removed entirely (per `feedback15-StudentAuditAlt.md`) — the audit now always checks against
   whatever is currently loaded in Column 1. This isn't just a UI simplification: it's what makes
   the permission-safe implementation possible. Instead of one global "what has this student ever
   taken" lookup, the audit checks *membership* in each course already in the list, one roster at
   a time, using `GET /api/v1/courses/{id}/enrollments` — the exact same call
   `CanvasClient.get_course_students` already makes for the Column 3 Student List and course
   counts, which is proven to work under this app's existing Canvas permissions. No SIS ID
   lookup, no grades include, no new permission required at all.

The trade-off: in live Canvas mode there is no real grade data available through this path
(grades were only ever reachable through the now-removed, more sensitive endpoint), so the Grade
column shows "—" for unmatched/unavailable values in real mode. This mirrors an existing,
pre-existing limitation elsewhere in the app — Trend Analysis has never had real grades in live
Canvas mode either, for the same underlying permission reason. The mock backend is unaffected: it
already returns a demo grade with every course roster, so mock-mode Student Audit shows a grade
exactly as it did before.

## Backend

No dedicated audit endpoint exists anymore. `backend/app/api/routes/students.py` is back to just
`GET /courses/{course_id}/student-count` and `GET /courses/{course_id}/students` — both
pre-existing. Everything the audit needs comes from the second one, called once per course in the
list.

Removed entirely (all now unused): `CanvasClient.get_user_enrollments`, the
`/students/{student_id}/grades` and `/students/{student_id}/audit` routes, the `AuditCourse` and
`CourseGrade` Pydantic models, and the mock backend's equivalent `/grades`/`/audit` endpoints and
their `_student_by_ssid`/`_course_map` lookup tables. `canvas_client.py` did keep one improvement
from that dead end: `CanvasAPIError` messages now include the failing request's method and URL
(`_raise_for_error`), which is how the 403 above got pinned down to a specific call instead of
being a mystery.

## Frontend

- `frontend/src/components/StudentAudit/StudentAudit.tsx` (+ `.css`) — now just a Student ID
  input and an Audit button. `handleAudit`:
  - Requires a non-empty Student ID and a non-empty Column 1 course list (clear error otherwise).
  - `Promise.all`s `api.getStudents(course.id)` across every course in `store.courses` — the same
    call and the same concurrency pattern `CourseSearch.tsx`'s "Query Student Count" button
    already uses.
  - For each course, finds the roster row whose `ssid` matches the typed Student ID
    (case-insensitive, trimmed) and turns a match into a table row using course metadata already
    on hand (name/code/instructor/term) plus that student's `grade` field if the roster included
    one.
  - Results render in the same sortable-header table as before (`CourseList.tsx`-style
    `sortKey`/`sortDir` state).
- `frontend/src/components/StudentAudit/SearchableSelect.tsx` (+ `.css`, + test) — deleted. It
  existed only to make the since-removed Start/End Semester fields searchable.
- `frontend/src/api/types.ts` / `frontend/src/api/client.ts` — `AuditCourse`, `CourseGrade`,
  `getStudentGrades`, `getStudentAudit` all removed; nothing in the audit feature talks to a
  dedicated backend endpoint anymore, just the pre-existing `getStudents`.
- `WorkingArea.tsx` is unchanged from the earlier pass — still a third `'audit'` tab rendering
  `<StudentAudit />`.

## Verification

- Confirmed read-only: no `POST`/`PUT`/`PATCH`/`DELETE` anywhere in `backend/`, `mock_backend/`,
  or `frontend/src/`; every route is a GET; CORS is `allow_methods=["GET"]` on both backends;
  `frontend/src/api/client.ts` has the app's only `fetch` call site.
- Removed the now-obsolete backend/frontend tests for the deleted endpoints and component; full
  suites pass: backend 19/19 (excluding the same 3 pre-existing, unrelated failures confirmed via
  `git stash` to predate this feature entirely); frontend `tsc --noEmit` clean, `vitest run` 29/29.
- Verified the actual algorithm end-to-end against an isolated mock backend instance: fetching a
  known course's roster correctly finds a student who took it (`DEMO00001` in course `1001`) and
  correctly finds no match in a course they didn't take (course `1002`) — confirming the
  roster-membership approach behaves as the frontend now assumes.
