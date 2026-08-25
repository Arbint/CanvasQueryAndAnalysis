import asyncio
from typing import Any

import httpx


class CanvasAPIError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class CanvasClient:
    _MAX_RETRIES = 4
    _BASE_BACKOFF_SECONDS = 1.0

    def __init__(self, base_url: str, token: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {token}"}
        self._client: httpx.AsyncClient | None = None
        self._client_loop: asyncio.AbstractEventLoop | None = None

    def _http(self) -> httpx.AsyncClient:
        # One pooled client reused across calls, so requests to Canvas — including
        # every course in a Student Audit — share connections instead of paying a
        # fresh TCP+TLS handshake each time. Recreated if the running event loop
        # has changed (httpx clients can't be reused across loops; this only
        # happens across separate test runs, never in a running server).
        loop = asyncio.get_running_loop()
        if self._client is None or self._client_loop is not loop:
            self._client = httpx.AsyncClient(headers=self._headers)
            self._client_loop = loop
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()

    async def _get(self, url: str, params: dict | None = None) -> httpx.Response:
        # Canvas enforces a per-token request-cost budget and returns 429 once
        # it's exhausted — a burst of concurrent calls (e.g. Student Audit
        # checking many courses at once) can trip it even with a concurrency
        # cap in front of it. Retry with backoff instead of failing outright.
        client = self._http()
        response = await client.get(url, params=params)
        for attempt in range(self._MAX_RETRIES):
            if response.status_code != 429:
                break
            retry_after = response.headers.get("Retry-After")
            delay = float(retry_after) if retry_after else self._BASE_BACKOFF_SECONDS * (2**attempt)
            await asyncio.sleep(delay)
            response = await client.get(url, params=params)
        return response

    @staticmethod
    def _raise_for_error(response: httpx.Response) -> None:
        if response.status_code >= 400:
            raise CanvasAPIError(
                response.status_code,
                f"Canvas API error {response.status_code} for "
                f"{response.request.method} {response.request.url}: {response.text}",
            )

    async def _paginate(self, url: str, params: dict | None = None) -> list[dict]:
        results: list[dict] = []
        next_url: str | None = url
        next_params: dict | None = params

        while next_url:
            response = await self._get(next_url, next_params)
            self._raise_for_error(response)
            results.extend(response.json())
            next_url = self._extract_next_link(response)
            next_params = None  # params are already encoded in next_url

        return results

    @staticmethod
    def _extract_next_link(response: httpx.Response) -> str | None:
        link_header = response.headers.get("Link", "")
        for part in link_header.split(","):
            part = part.strip()
            if 'rel="next"' in part:
                url_part = part.split(";")[0].strip()
                return url_part.lstrip("<").rstrip(">")
        return None

    async def get_accounts(self) -> list[dict]:
        return await self._paginate(
            f"{self._base_url}/api/v1/accounts",
            {"per_page": 100},
        )

    async def get_terms(self, account_id: int) -> list[dict]:
        # Canvas enrollment terms live on the root account only. Sub-account IDs
        # return empty enrollment_terms. Using "self" always resolves to the root.
        # Canvas wraps the response in {"enrollment_terms": [...]}, so _paginate
        # (which assumes a top-level list) cannot be used here.
        terms: list[dict] = []
        next_url: str | None = f"{self._base_url}/api/v1/accounts/self/terms"
        next_params: dict | None = {"per_page": 100}

        while next_url:
            response = await self._get(next_url, next_params)
            self._raise_for_error(response)
            data = response.json()
            terms.extend(data.get("enrollment_terms", []))
            next_url = self._extract_next_link(response)
            next_params = None

        return terms

    async def get_courses(
        self,
        account_id: int,
        term_ids: list[int],
        keywords: list[str],
    ) -> list[dict]:
        base_params: dict[str, Any] = {"per_page": 100, "include[]": ["teachers", "term"]}
        if keywords:
            base_params["search_term"] = keywords[0]

        url = f"{self._base_url}/api/v1/accounts/{account_id}/courses"

        if not term_ids:
            courses = await self._paginate(url, base_params)
        else:
            seen: set[int] = set()
            courses: list[dict] = []
            for term_id in term_ids:
                params = {**base_params, "enrollment_term_id": term_id}
                for course in await self._paginate(url, params):
                    cid = course.get("id")
                    if cid not in seen:
                        seen.add(cid)
                        courses.append(course)

        for kw in keywords[1:]:
            kw_lower = kw.lower()
            courses = [c for c in courses if kw_lower in c.get("name", "").lower()]

        return courses

    async def get_course_student_count(self, course_id: int) -> int:
        # Single request using Canvas's total_students include — far faster than
        # paginating all enrollments.
        response = await self._get(
            f"{self._base_url}/api/v1/courses/{course_id}",
            {"include[]": "total_students"},
        )
        self._raise_for_error(response)
        return response.json().get("total_students", 0)

    async def get_course_teacher(self, course_id: int) -> dict | None:
        # include[]=email adds the user's primary email address when the caller
        # has permission to view it; Canvas omits the key (not an error) rather
        # than rejecting the request when it doesn't, mirroring total_scores above.
        enrollments = await self._paginate(
            f"{self._base_url}/api/v1/courses/{course_id}/enrollments",
            {"type[]": "TeacherEnrollment", "per_page": 100, "include[]": ["user", "email"]},
        )
        teachers = [e for e in enrollments if e.get("type") == "TeacherEnrollment"]
        return teachers[0] if teachers else None

    async def get_course_students(self, course_id: int) -> list[dict]:
        # total_scores adds each enrollment's overall percentage grade. Canvas
        # silently omits it (rather than rejecting the request) for callers who
        # lack grade-view permission, so this is safe to always request.
        enrollments = await self._paginate(
            f"{self._base_url}/api/v1/courses/{course_id}/enrollments",
            {"type[]": "StudentEnrollment", "per_page": 100, "include[]": ["user", "total_scores"]},
        )
        return [e for e in enrollments if e.get("type") == "StudentEnrollment"]
