# Canvas Query and Analysis

Canvas Query and Analysis is a read-only web app for searching Canvas LMS courses, inspecting student rosters, combining rosters with set operations, and analyzing enrollment trends across course sequences.

The app is intentionally stateless and query-only. It does not write to Canvas or modify Canvas data.

## What The App Does

- Search Canvas courses by account, semester, and keywords.
- Query student counts for returned courses.
- Build student-list pipelines with a node graph:
  - course nodes
  - course collection nodes
  - union nodes
  - intersection nodes
  - subtract nodes
- Double-click graph nodes to send their output to the Student List panel.
- Filter, sort, export CSV, and copy email addresses from student lists.
- Build Trend Analysis views across sequences of courses, with enrollment counts, retained/lost/new student comparisons, CSV exports, and course-column roster review.
- Generate a Grade Reporter table across a filtered collection of courses, with a percent grade-range filter to surface students inside (or outside) a given range.
- Run against either a real Canvas API backend or a local mock backend.

## Quick Start

### Mock Mode

Mock mode is the easiest way to try the app. It does not require Canvas credentials.

```bat
launchMock.bat
```

The launcher asks whether to allow access from other devices on the LAN, or restrict access to this computer only (the default). Choosing LAN prints the LAN URLs to use from another device.

This starts:

- Mock backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

The mock backend uses [mock_backend/db.json](mock_backend/db.json), which includes course, term, student, and enrollment data for demos and testing.

### Real Canvas Mode

Real Canvas mode requires Canvas API credentials.

Create `backend/.env` using [backend/.env.example](backend/.env.example):

```env
CANVAS_API_TOKEN=your_canvas_api_token_here
CANVAS_API_URL=https://your.canvas.instance.edu
```

Then run:

```bat
launch.bat
```

The launcher asks whether to allow access from other devices on the LAN, or restrict access to this computer only (the default). Choosing LAN prints the LAN URLs to use from another device.

This starts:

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

## Requirements

- Python 3.11 or newer
- Node.js 20 or newer
- npm

The launcher scripts install missing backend and frontend dependencies when needed.

For manual setup:

```bat
cd backend
pip install -r requirements.txt

cd ..\frontend
npm install
```

## Manual Development Commands

Run the real backend:

```bat
cd backend
uvicorn app.main:app --reload
```

Run the mock backend:

```bat
cd mock_backend
uvicorn app.main:app --reload
```

Run the frontend:

```bat
cd frontend
npm run dev
```

Build the frontend:

```bat
cd frontend
npm run build
```

Run frontend tests:

```bat
cd frontend
npm run test:run
```

Run backend tests:

```bat
cd backend
pip install -r requirements-dev.txt
pytest
```

## Using The App

### 1. Search For Courses

Use the left Course Search panel.

1. Select a Canvas account.
2. Add one or more semesters.
3. Add optional keyword filters.
4. Click `Search`.
5. Click `Query Student Count` to populate course counts.

Clicking a course row adds it to the Aggregation Graph as a course node.

### 2. Use The Aggregation Graph

Open the `Aggregation Graph` tab in the center working area.

- Press `Tab` inside the graph to open the node palette.
- Add course, course collection, union, intersect, or subtract nodes.
- Connect node pins to build a student-list pipeline.
- Double-click a node to show that node's output in the right Student List panel.
- Use `Delete` to remove selected nodes or edges.
- Use `Shift` for multi-select behavior.

### 3. Review Student Lists

Use the right Student List panel.

- Filter by active or inactive enrollment state.
- Sort by first name, last name, or SSID.
- Download the current list as CSV.
- Copy generated student email addresses.

Emails are derived from Canvas login IDs using:

```text
<login_id>@student.uiwtx.edu
```

### 4. Use Trend Analysis

Open the `Trend Analysis` tab in the center working area.

- Click `+` to add a course column.
- Choose a course in each column.
- The graph above shows student counts over the selected course sequence.
- Hover graph points to view retained, lost, and new student counts.
- Right-click graph points to export or copy retained/lost/new student groups.
- Resize course columns by dragging the right edge of a column.
- Double-click a course column to send that course roster to the Student List panel.
- Scroll over the course-column area to move horizontally through long sequences.

Trend Analysis works best after you have searched for a broad enough set of courses in the Course Search panel.

### 5. Use Grade Reporter

Open the `Grade Reporter` tab in the center working area.

- In the Filter Column, pick terms, an optional department, and Include/Exclude course-number filters — the same filtering as the Course Collection node in the Aggregation Graph.
- Click `Generate Report` to fetch every matched course's roster.
- The Grade Column shows one row per student — Name, SSID, Email — and one column per matched course, with that student's percent grade in each course (or `—` if they aren't enrolled or have no grade yet). Each course header also shows the instructor's name and email when Canvas exposes it.
- Click any column header to sort by it, ascending or descending — including sorting a course column by grade.
- Use the grade range filter (defaults to 0%–100%) above the table to show only students who have at least one grade within that range — handy for finding students who are failing or at risk across a set of courses. Grades that fall in the active range are highlighted in green.
- Click `Download CSV` or `Download XLSX` to export the table exactly as currently filtered and sorted, including each course's instructor name/email in the header. The XLSX export also color-codes in-range grades in green.

## Project Structure

```text
.
├── assets/                 Shared static assets
├── backend/                Real Canvas API backend
├── devlog/                 Feedback notes and implementation history
├── frontend/               React/Vite frontend
├── knowledgeBase/          Product and component design documentation
├── mock_backend/           Local mock API backend and mock db.json
├── launch.bat              Real Canvas mode launcher
├── launchMock.bat          Mock mode launcher
└── README.md
```

## Backend Structure

```text
backend/
├── app/
│   ├── api/routes/         FastAPI route modules
│   ├── models/             Response models
│   ├── services/           Canvas client integration
│   ├── config.py           Environment-backed settings
│   ├── dependencies.py     FastAPI dependencies
│   └── main.py             FastAPI app entrypoint
├── tests/                  Backend test suite
├── requirements.txt
└── requirements-dev.txt
```

Main real-backend endpoints:

- `GET /health`
- `GET /api/accounts`
- `GET /api/accounts/{account_id}/terms`
- `GET /api/courses`
- `GET /api/courses/{course_id}/student-count`
- `GET /api/courses/{course_id}/students`
- `GET /api/courses/{course_id}/instructor`

## Frontend Structure

```text
frontend/src/
├── api/                    API client and shared API types
├── components/
│   ├── CourseSearch/       Account, term, keyword, and course result UI
│   ├── layout/             Resizable three-column layout
│   ├── NodeGraph/          Aggregation graph and node implementations
│   ├── StudentList/        Student list, export, and copy tools
│   ├── TrendAnalysis/      Course sequence trend graph
│   └── WorkingArea/        Center tab shell
├── lib/                    Shared set-operation logic
├── store/                  Zustand app store
├── styles/                 Shared theme CSS
├── App.tsx
└── main.tsx
```

The frontend stack is:

- React
- TypeScript
- Vite
- Zustand
- React Flow
- Vitest
- ExcelJS (Grade Reporter XLSX export, lazy-loaded)

## Mock Backend

The mock backend lives in [mock_backend](mock_backend). It mirrors the frontend-facing API used by the real backend but reads from [mock_backend/db.json](mock_backend/db.json).

Use it for:

- demos
- local UI development
- testing without Canvas credentials
- trend-analysis workflows with stable sample data

The mock data includes full term labels, course sequences, students, grades, enrollment states, and meeting-time values.

## Documentation Guide

The repository uses two documentation folders:

### knowledgeBase

[knowledgeBase](knowledgeBase) contains product and component design documentation. Use this when you want to understand the intended behavior.

Important files:

- [appDesignDocument.md](knowledgeBase/appDesignDocument.md): overall app purpose, layout, and constraints
- [CourseSearchComponent.md](knowledgeBase/appDesignComponents/CourseSearchComponent.md): Course Search panel behavior
- [AggregationNodeGraph.md](knowledgeBase/appDesignComponents/AggregationNodeGraph.md): node graph behavior and node types
- [StudentList.md](knowledgeBase/appDesignComponents/StudentList.md): Student List panel behavior
- [trendAnalysis.md](knowledgeBase/appDesignComponents/trendAnalysis.md): Trend Analysis behavior
- [Theme.md](knowledgeBase/appDesignComponents/Theme.md): theme guidance

### devlog

[devlog](devlog) contains feedback notes and incremental feature requests. Use this when you want to understand why a feature was added or adjusted.

Examples:

- `feedback08-CreateAMockBackend.md`: mock backend request
- `feedback09-AddTrendAnalysis.md`: trend-analysis feature request
- `feedback10-PopulateMoreMockData.md`: richer mock data request
- `feedback11.md` and `feedback12.md`: trend-analysis refinements

## Development Notes

- The app should remain read-only against Canvas.
- The page itself should not vertically scroll; panels own their internal scrolling.
- Keep the mock backend API shape aligned with the real backend's frontend-facing responses.
- Prefer adding behavior through existing component boundaries rather than creating unrelated parallel UI.
- Do not commit credentials or local `.env` files.

## Troubleshooting

### Frontend Cannot Reach Backend

Confirm the backend is running at:

```text
http://localhost:8000
```

The frontend defaults to this API URL unless `VITE_API_URL` is set.

### Real Canvas Mode Fails On Startup

Check that `backend/.env` exists or that these environment variables are set:

```text
CANVAS_API_TOKEN
CANVAS_API_URL
```

### Mock Mode Has Stale Data

Restart the mock backend after editing [mock_backend/db.json](mock_backend/db.json). The mock backend reads the JSON file at startup.

### Ports Are Already In Use

Stop the old backend/frontend terminal windows, or manually run the backend/frontend on alternate ports.

## Safety

Canvas Query and Analysis is designed as a read-only analysis tool. It queries Canvas accounts, terms, courses, counts, and enrollments, then performs local analysis in the browser. It does not create, update, or delete Canvas records.
