# Build Plan

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Backend runtime | Python 3.11+ | Specified; analytics-ready |
| Backend framework | FastAPI | Async, typed, auto-docs, minimal boilerplate |
| Canvas HTTP client | httpx (async) | Pairs naturally with FastAPI; supports pagination |
| Backend data models | Pydantic v2 | Validated, serializable, integrates with FastAPI |
| Backend tests | pytest + respx | respx mocks httpx at transport layer |
| Frontend bundler | Vite | Fast HMR, first-class TS |
| Frontend framework | React + TypeScript | Component model fits the 3-column + node editor |
| Node graph | React Flow | Handles pins, edges, drag-connect, marquee out of the box |
| Global state | Zustand | Minimal, no boilerplate; stores course list and active node output |
| Frontend tests | Vitest + React Testing Library | Same config as Vite; RTL for component-level |

## Repository Layout

```
canvas-query/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app factory
│   │   ├── config.py             # pydantic-settings: CANVAS_API_TOKEN, CANVAS_API_URL
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── accounts.py
│   │   │       ├── courses.py
│   │   │       └── students.py
│   │   ├── services/
│   │   │   └── canvas_client.py  # All Canvas API calls live here
│   │   └── models/
│   │       ├── account.py
│   │       ├── course.py
│   │       └── student.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_canvas_client.py
│   │   ├── test_models.py
│   │   ├── test_routes_accounts.py
│   │   ├── test_routes_courses.py
│   │   └── test_routes_students.py
│   ├── requirements.txt
│   └── requirements-dev.txt
└── frontend/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── styles/
    │   │   └── theme.css          # Single source of truth for all styles
    │   ├── api/
    │   │   ├── client.ts          # Typed fetch wrappers
    │   │   └── types.ts           # Mirrors backend Pydantic models
    │   ├── store/
    │   │   └── appStore.ts        # Zustand store
    │   ├── components/
    │   │   ├── layout/
    │   │   │   └── ResizableColumns.tsx
    │   │   ├── CourseSearch/
    │   │   │   ├── CourseSearch.tsx
    │   │   │   ├── AccountDropdown.tsx
    │   │   │   ├── ChipInput.tsx
    │   │   │   └── CourseList.tsx
    │   │   ├── NodeGraph/
    │   │   │   ├── NodeGraph.tsx
    │   │   │   ├── NodePalette.tsx
    │   │   │   ├── graphEngine.ts  # Graph evaluation (pure TS, no React)
    │   │   │   └── nodes/
    │   │   │       ├── CourseNode.tsx
    │   │   │       ├── UnionNode.tsx
    │   │   │       ├── IntersectNode.tsx
    │   │   │       └── SubtractNode.tsx
    │   │   └── StudentList/
    │   │       ├── StudentList.tsx
    │   │       └── exportUtils.ts
    │   └── lib/
    │       └── setOperations.ts   # Pure set math (no React)
    ├── tests/
    │   ├── setup.ts
    │   ├── lib/
    │   │   └── setOperations.test.ts
    │   └── components/
    │       ├── ChipInput.test.tsx
    │       ├── CourseList.test.tsx
    │       └── StudentList.test.tsx
    ├── index.html
    ├── vite.config.ts
    └── package.json
```

## Commands Reference

```bash
# Backend
cd backend
pip install -r requirements-dev.txt
uvicorn app.main:app --reload           # dev server on :8000
pytest                                   # all tests
pytest tests/test_canvas_client.py      # single file
pytest -k "test_get_courses"            # single test by name

# Frontend
cd frontend
npm install
npm run dev                              # dev server on :5173
npm test                                 # Vitest watch mode
npm run test:run                         # single run (CI)
npm run build                            # production build
```

---

## Steps

Each step is self-contained: implement → test → move on.

---

### Step 1 — Backend Scaffolding

**Goal:** A running FastAPI app with env loading and a health endpoint.

**Create:**
- `backend/requirements.txt` — `fastapi`, `uvicorn[standard]`, `httpx`, `pydantic-settings`
- `backend/requirements-dev.txt` — `pytest`, `pytest-asyncio`, `respx`, `httpx`
- `backend/app/main.py` — FastAPI app with `GET /health → {"status": "ok"}`
- `backend/app/config.py` — `pydantic_settings.BaseSettings` loading `CANVAS_API_TOKEN` and `CANVAS_API_URL` from env; raises `ValidationError` on startup if either is missing
- `backend/tests/conftest.py` — `AsyncClient` fixture using `httpx.AsyncClient(app=app, base_url="http://test")`

**Test criteria:**
```bash
cd backend
uvicorn app.main:app --reload
# curl http://localhost:8000/health  →  {"status":"ok"}
pytest tests/  # 1 test: health returns 200
```

---

### Step 2 — Canvas API Client

**Goal:** A single service class that wraps all Canvas REST calls, fully mockable via respx.

**Create:** `backend/app/services/canvas_client.py`

```python
class CanvasClient:
    def __init__(self, base_url: str, token: str): ...

    async def get_accounts(self) -> list[dict]: ...
    async def get_terms(self, account_id: int) -> list[dict]: ...
    async def get_courses(
        self, account_id: int, term_ids: list[int], keywords: list[str]
    ) -> list[dict]: ...
    async def get_course_student_count(self, course_id: int) -> int: ...
    async def get_course_students(self, course_id: int) -> list[dict]: ...
```

Implement a private `_paginate(url, params)` method that follows Canvas `Link: <url>; rel="next"` headers and returns the full merged list. All public methods go through `_paginate`.

Raise a typed `CanvasAPIError(status_code, message)` for any non-2xx Canvas response.

**Test criteria (`tests/test_canvas_client.py`):**
- `get_accounts` merges a mocked 2-page response into a single list
- `get_courses` passes `search_term` query param for the first keyword
- `get_course_students` filters to only `type == "StudentEnrollment"` entries
- A mocked 401 response raises `CanvasAPIError` with `status_code=401`

```bash
pytest tests/test_canvas_client.py
```

---

### Step 3 — Pydantic Models

**Goal:** Typed, validated response shapes used by routes and tests.

**Create:**
- `backend/app/models/account.py` — `Account(id: int, name: str)`
- `backend/app/models/course.py` — `Course(id: int, name: str, course_code: str, instructor: str, term_name: str, student_count: int | None = None)`
- `backend/app/models/student.py` — `Student(id: int, first_name: str, last_name: str, ssid: str, login_id: str, enrollment_state: Literal["active", "inactive"])` with computed `email: str` property

**Test criteria (`tests/test_models.py`):**
- Missing required field on `Course` raises `ValidationError`
- `enrollment_state` outside `{"active", "inactive"}` raises `ValidationError`
- `Student.email` returns `f"{login_id}@student.uiwtx.edu"`

```bash
pytest tests/test_models.py
```

---

### Step 4 — Accounts & Terms Routes

**Goal:** Two endpoints that populate the Account dropdown and Semester chip-input on the frontend.

**Create:** `backend/app/api/routes/accounts.py`

```
GET /api/accounts               → list[Account]
GET /api/accounts/{id}/terms    → list[{"id": int, "name": str}]
```

Register the router in `main.py` with `prefix="/api"`. Inject `CanvasClient` via FastAPI dependency (built from `config`).

**Test criteria (`tests/test_routes_accounts.py`):**
- `GET /api/accounts` returns 200 with shaped account list
- `GET /api/accounts/99/terms` calls `canvas_client.get_terms(99)` and returns the result
- A `CanvasAPIError` from the client propagates as HTTP 502

```bash
pytest tests/test_routes_accounts.py
```

---

### Step 5 — Courses & Students Routes

**Goal:** Endpoints that drive the Course List and Node Graph data loading.

**Create:**
- `backend/app/api/routes/courses.py`
- `backend/app/api/routes/students.py`

```
GET /api/courses?account_id=1&term_ids=10,11&keywords=math,lab  → list[Course]
GET /api/courses/{id}/student-count                              → {"count": int}
GET /api/courses/{id}/students                                   → list[Student]
```

- `term_ids` and `keywords` are comma-separated strings parsed into `list[int]` and `list[str]`.
- `GET /api/courses/{id}/students` includes the derived `email` field in each student object.

**Test criteria (`tests/test_routes_courses.py`, `tests/test_routes_students.py`):**
- Courses route forwards all filter params to `CanvasClient`
- Student objects in the response include `email`
- Empty result returns `[]`, not 404
- Malformed `account_id` (non-integer) returns 422

```bash
pytest   # full backend suite — all steps green
```

---

### Step 6 — Frontend Scaffolding

**Goal:** Running Vite + React + TypeScript app with Vitest configured.

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install zustand @xyflow/react
npm install -D vitest @vitest/ui @testing-library/react @testing-library/user-event jsdom
```

Add to `vite.config.ts`:
```ts
test: { environment: "jsdom", globals: true, setupFiles: "./tests/setup.ts" }
```

Create `tests/setup.ts` with `import "@testing-library/jest-dom"`.

**Test criteria:**
```bash
npm run dev      # loads at localhost:5173, no console errors
npm run test:run # 0 failures
```

---

### Step 7 — Theme System

**Goal:** Centralized CSS custom properties; no component ever hard-codes a color.

**Create:** `src/styles/theme.css`

Define all values as custom properties:
- `--color-bg-*`, `--color-surface-*`, `--color-text-*`, `--color-accent-*`, `--color-border-*`
- `--space-*` (4px base scale), `--radius-*`, `--font-size-*`
- Colors inspired by One Dark Pro; all text/background pairs must pass WCAG AA (4.5:1 ratio)

Import once in `main.tsx`. All component `.css` files may only reference `var(--*)` — no raw hex.

**Test criteria:**
- Visual: dark background, legible text, clearly distinguishable interactive elements
- `grep -rn "#[0-9a-fA-F]\{3,6\}" src/components/` returns zero matches

---

### Step 8 — 3-Column Resizable Layout

**Goal:** App shell with icon, favicon, and three columns with draggable resize bars. Page never scrolls vertically.

**Create:**
- `src/components/layout/ResizableColumns.tsx`
  - Three flex children with drag handles between them
  - Drag handle moves pointer → updates column widths in local state
  - Each column enforces a `minWidth` (e.g. 180px)
  - Column content area uses `overflow-y: auto` for internal scroll
- `src/App.tsx` — UIW icon top-left, then `<ResizableColumns>` filling `100vh`
- `index.html` — favicon pointing at `/assets/uiw3d_Logo_PNG_White.png`

**Test criteria:**
- Dragging the divider resizes both adjacent columns
- Neither column collapses below min width
- No vertical scrollbar on `<body>` or `<html>`
- Favicon appears in browser tab; icon visible top-left

---

### Step 9 — Frontend API Client

**Goal:** Typed fetch wrappers in one module; all components import from here.

**Create:**
- `src/api/types.ts` — TypeScript interfaces mirroring backend models (`Account`, `Term`, `Course`, `Student`)
- `src/api/client.ts`

```ts
export class ApiError extends Error { constructor(public status: number, message: string) }

export const api = {
  getAccounts(): Promise<Account[]>
  getTerms(accountId: number): Promise<Term[]>
  getCourses(params: CourseQuery): Promise<Course[]>
  getStudentCount(courseId: number): Promise<number>
  getStudents(courseId: number): Promise<Student[]>
}
```

Base URL from `import.meta.env.VITE_API_URL ?? "http://localhost:8000"`. Throws `ApiError` on non-2xx.

**Test criteria:**
- Mock `globalThis.fetch` in Vitest; assert each function calls the correct URL and returns typed data
- Non-2xx response throws `ApiError` with the correct `status`

```bash
npm run test:run
```

---

### Step 10 — Zustand Store

**Goal:** Global state shared across all three columns.

**Create:** `src/store/appStore.ts`

```ts
interface AppStore {
  selectedAccountId: number | null
  setSelectedAccountId(id: number): void
  courses: Course[]
  setCourses(courses: Course[]): void
  activeStudentList: Student[]
  setActiveStudentList(students: Student[]): void
}
```

**Test criteria:**
- `setCourses` replaces the list; `setActiveStudentList` is independent
- Setting `selectedAccountId` does not clear `courses` or `activeStudentList`

```bash
npm run test:run
```

---

### Step 11 — ChipInput Component

**Goal:** Reusable multi-value chip input used for Semester and Keyword filters.

**Behavior:**
- Renders existing values as removable chips (chip + × button)
- A `+` button appends a text input; Enter commits the value as a new chip; Escape cancels without adding
- Duplicate values are silently ignored

**Create:** `src/components/CourseSearch/ChipInput.tsx`

Props: `{ values: string[], onChange(values: string[]): void, placeholder?: string }`

**Test criteria (`tests/components/ChipInput.test.tsx`):**
- Clicking `+` renders an `<input>`
- Typing a value and pressing Enter adds it as a chip; input disappears
- Pressing Escape cancels without adding a chip
- Clicking `×` on a chip removes it from the list
- Re-entering an existing value does not duplicate it

```bash
npm run test:run
```

---

### Step 12 — Course Search Column

**Goal:** Fully wired Course Search column connected to the backend.

**Create:**
- `src/components/CourseSearch/AccountDropdown.tsx` — calls `api.getAccounts()` on mount; controlled `<select>`; writes `selectedAccountId` to store
- `src/components/CourseSearch/CourseList.tsx` — reads `courses` from store; renders rows; student count shows `—` until populated
- `src/components/CourseSearch/CourseSearch.tsx` — composes the above with two `<ChipInput>`s (Semester, Keyword), a Search button, and a Query Student Count button

**State flow:**
- Search → `api.getCourses(...)` → `store.setCourses(...)`
- Query Student Count → `Promise.all(courses.map(c => api.getStudentCount(c.id)))` → merge counts back into store

**Test criteria (`tests/components/CourseList.test.tsx`):**
- Renders name, course_code, instructor, term_name per row
- `student_count: null` renders as `—`
- Loading spinner visible while fetch is in-flight
- Error banner shown on `ApiError`

```bash
npm run test:run
# Manual: run both servers, search for courses, verify list populates
```

---

### Step 13 — Set Operation Engine

**Goal:** Pure TypeScript functions for student list math; zero React dependencies.

**Create:** `src/lib/setOperations.ts`

```ts
// Deduplication is by student.id
export function union(...lists: Student[][]): Student[]
export function intersect(...lists: Student[][]): Student[]
export function subtract(from: Student[], ...subtractLists: Student[][]): Student[]
```

**Test criteria (`tests/lib/setOperations.test.ts`):**
- `union([A,B],[B,C])` → `[A,B,C]` (no duplicates)
- `intersect([A,B,C],[B,C,D])` → `[B,C]`
- `subtract([A,B,C],[B])` → `[A,C]`
- `subtract([A,B],[B,C],[A])` → `[]`
- All three functions handle empty input lists without throwing
- Single-list input: returns a copy of that list (identity behavior)

```bash
npm run test:run
```

---

### Step 14 — Node Graph Canvas & Node Palette

**Goal:** React Flow canvas with Tab-to-create palette and keyboard node management.

**Create:**
- `src/components/NodeGraph/NodeGraph.tsx`
  - `<ReactFlow>` with `selectionOnDrag` (marquee), `multiSelectionKeyCode="Shift"`, `deleteKeyCode="Delete"`
  - `onKeyDown`: intercept Tab → open palette at pointer position; prevent default tab behavior
- `src/components/NodeGraph/NodePalette.tsx`
  - Popover anchored at cursor; searchable list of node types (Course, Union, Intersect, Subtract)
  - Enter or click → add node at recorded cursor position → close palette

**Test criteria:**
- Press Tab → palette renders with all four node types listed
- Type "uni" → only Union node shown
- Click Union → node appears in graph; palette closes
- Select a node → press Delete → node removed from graph

---

### Step 15 — Course Node

**Goal:** Course node that picks a course and fetches its student list.

**Create:** `src/components/NodeGraph/nodes/CourseNode.tsx`

- Dropdown populated from `store.courses`
- One source handle (output pin) for the student list
- On course selection: calls `api.getStudents(courseId)` and stores the result in the node's `data`
- Shows a loading indicator while fetching

**Test criteria:**
- Dropdown lists all courses from mock store
- Selecting a course triggers `api.getStudents` (mock it); node data updated
- Source handle is present and accepts connections
- Loading state shown during fetch; clears on completion

---

### Step 16 — Aggregation Nodes

**Goal:** Union, Intersect, and Subtract nodes with dynamic, removable input handles.

**Create:**
- `src/components/NodeGraph/nodes/UnionNode.tsx`
- `src/components/NodeGraph/nodes/IntersectNode.tsx`
- `src/components/NodeGraph/nodes/SubtractNode.tsx`

**Shared behavior:**
- `+` button adds a new target handle with a unique ID
- Alt-click on a handle removes it and disconnects its edge (minimum 2 inputs for Union/Intersect)
- Dragging a new edge to an occupied handle disconnects the existing edge first
- One source handle (output)

**Subtract specifics:**
- First target handle is permanently labelled "from" and cannot be removed
- Additional target handles are labelled "subtract"; minimum 1 subtract handle
- Alt-click removable only on "subtract" handles

**Test criteria:**
- Clicking `+` increases handle count
- Alt-clicking a non-minimum handle removes it
- Alt-clicking when at minimum count has no effect
- Subtract node "from" handle is not removable regardless of alt-click

---

### Step 17 — Graph Evaluation Engine

**Goal:** Traverse the React Flow graph topology and compute each node's output using the set operation engine.

**Create:** `src/components/NodeGraph/graphEngine.ts`

```ts
export class GraphCycleError extends Error {}

export function evaluateGraph(
  nodes: Node[],
  edges: Edge[],
  courseStudents: Record<string, Student[]>   // keyed by course node id
): Record<string, Student[]>                   // keyed by node id
```

Algorithm: build adjacency list → topological sort (Kahn's algorithm) → evaluate each node in order using `setOperations`. A disconnected handle is treated as an empty list.

**Test criteria (`tests/lib/graphEngine.test.ts`):**
- Linear chain: two Course nodes → Union → correct union output
- Diamond: Course node output shared by two Union nodes; set ops applied correctly
- Disconnected handle on Union: treated as empty list, no error thrown
- Graph with a cycle: throws `GraphCycleError`

```bash
npm run test:run
```

---

### Step 18 — Node Double-Click → Student List

**Goal:** Double-clicking any node evaluates the graph and pushes that node's output to the Student List column.

**In `NodeGraph.tsx`:**
- Track pointer position in `onMouseMove` to know cursor coordinates for palette
- `onNodeDoubleClick(event, node)` → call `evaluateGraph` with current graph state → `store.setActiveStudentList(result[node.id])`

**Test criteria:**
- Double-click a Course node → `setActiveStudentList` called with that course's student list (mocked)
- Double-click a Union node with two connected Course nodes → called with union result
- Double-click a Union node with no connections → called with `[]`

---

### Step 19 — Student List Column

**Goal:** Display, filter, sort, and export the active student list from the store.

**Create:**
- `src/components/StudentList/exportUtils.ts`
  - `toCSV(students: Student[]): string` — header row + one row per student, all five fields
  - `emailsString(students: Student[]): string` — comma-separated `email` values
- `src/components/StudentList/StudentList.tsx`
  - Reads `activeStudentList` from store
  - Filter control: All / Active / Inactive (on `enrollment_state`)
  - Sort control: First Name / Last Name / SSID (stable alpha sort)
  - Download CSV: creates a temporary `<a download>` and clicks it
  - Copy Emails: writes `emailsString(filtered)` to `navigator.clipboard`
  - Table: First Name, Last Name, SSID, Login ID, Email

**Test criteria (`tests/components/StudentList.test.tsx`):**
- "Active" filter hides students with `enrollment_state: "inactive"`
- Sort by Last Name: rows are in alphabetical order
- `toCSV` header row matches expected columns; data rows are correct
- `emailsString` produces `login_id@student.uiwtx.edu` values, comma-separated

```bash
npm run test:run
```

---

### Step 20 — Integration & End-to-End Verification

**Goal:** Full user journey works with both servers running.

**Checklist (manual):**

1. `cd backend && uvicorn app.main:app --reload`
2. `cd frontend && npm run dev`
3. Open `http://localhost:5173`
4. Select an account → semester filter: add chips → keyword filter: add chips → Search → course list populates
5. Click "Query Student Count" → counts fill in for each row
6. Press Tab on node graph canvas → palette opens at cursor; Escape closes it
7. Create two Course nodes; assign different courses to each
8. Create a Union node; connect both Course node outputs to Union inputs
9. Double-click Union node → Student List shows merged, deduplicated student list
10. Add a third Course node; create Intersect node; verify intersection output
11. Create Subtract node; verify "from" handle is non-removable; connect and verify subtraction
12. Filter student list to "Active only" → inactive students removed
13. Sort by Last Name → rows reorder alphabetically
14. Download CSV → file opens with correct headers and student data
15. Copy Emails → paste into text editor; verify comma-separated `@student.uiwtx.edu` addresses
16. Drag column dividers → columns resize without triggering page scroll

**Final automated check:**
```bash
cd backend && pytest                # all backend tests green
cd frontend && npm run test:run     # all frontend tests green
cd frontend && npm run build        # TypeScript build succeeds, zero errors
```

---

## Definition of Done

- `pytest` and `npm run test:run` pass with zero failures
- `npm run build` completes with no TypeScript errors
- No raw hex codes outside `src/styles/theme.css` (`grep -rn "#[0-9a-fA-F]\{3,6\}" src/components/` → zero matches)
- No Canvas write calls anywhere (`grep -rn "\"POST\"\|\"PUT\"\|\"PATCH\"\|\"DELETE\"" backend/app/services/` → zero matches)
