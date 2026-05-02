# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Canvas Query and Analysis** is a read-only web app for querying Canvas LMS courses and performing set operations on student lists. It never modifies Canvas data and is stateless.

Canvas access is via two environment variables:
- `CANVAS_API_TOKEN`
- `CANVAS_API_URL`

Do not use Docker during development. The app must be easy to launch locally.

## Architecture

### Stack
- **Backend:** Python (chosen to support future analytics). Endpoints are driven by frontend needs.
- **Frontend:** Propose a modern framework suited to the task. The app icon (`./assets/uiw3d_Logo_PNG_White.png`) is used in the top-left corner and as the favicon.

### 3-Column Layout

The page does **not** scroll vertically. Each column's internal list scrolls independently. Columns are separated by draggable resize bars.

**Column 1 — Course Search** (`knowledgeBase/appDesignComponents/CourseSearchComponent.md`)
- Account dropdown (Canvas API accounts)
- Semester filter: multi-select chip input (+ button opens search, Enter adds); same pattern for keyword filter
- Search button → populates Course List
- Query Student Count button → fills in student count per course
- Course List rows: Course Name, Course Number, Instructor, Semester, Student Count

**Column 2 — Aggregation Node Graph** (`knowledgeBase/appDesignComponents/AggregationNodeGraph.md`)
- Blueprint-style node editor (similar to Unreal Engine)
- Tab key opens node search/creation at cursor
- Standard selection: marquee, Shift to add, Ctrl to deselect, Delete to remove
- Connecting pins: drag pin-to-pin; dragging onto an occupied pin disconnects the existing connection
- Node types:
  - **Course node:** dropdown to pick a course; one output pin (student list); no input
  - **Union node:** 2+ input pins (student lists) → union output; + button adds inputs, Alt-click removes
  - **Intersect node:** same pins as Union → intersection output
  - **Subtract node:** one "from" pin + one or more "subtract" pins (+ to add more) → difference output
- Double-clicking any node sends its output to the Student List column

**Column 3 — Student List** (`knowledgeBase/appDesignComponents/StudentList.md`)
- Populated when a node is double-clicked in the graph
- Top controls: active/inactive filter, sort by first name / last name / SSID, CSV download, copy emails (comma-separated)
- Student fields: First Name, Last Name, SSID, Login ID, Email (`<loginId>@student.uiwtx.edu`)

### Theme
One Dark Pro-inspired dark theme. All styles managed in a single centralized CSS file. Ensure sufficient contrast between text and background.
