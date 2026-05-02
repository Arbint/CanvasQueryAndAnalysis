from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx


class CanvasAPIError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class CanvasClient:
    def __init__(self, base_url: str, token: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {token}"}

    async def _paginate(self, url: str, params: dict | None = None) -> list[dict]:
        results: list[dict] = []
        next_url: str | None = url
        next_params: dict | None = params

        async with httpx.AsyncClient(headers=self._headers) as client:
            while next_url:
                response = await client.get(next_url, params=next_params)
                if response.status_code >= 400:
                    raise CanvasAPIError(
                        response.status_code,
                        f"Canvas API error {response.status_code}: {response.text}",
                    )
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
        raw = await self._paginate(
            f"{self._base_url}/api/v1/accounts/{account_id}/terms",
            {"per_page": 100},
        )
        # Canvas wraps terms in {"enrollment_terms": [...]}
        terms: list[dict] = []
        for item in raw:
            if "enrollment_terms" in item:
                terms.extend(item["enrollment_terms"])
            else:
                terms.append(item)
        return terms

    async def get_courses(
        self,
        account_id: int,
        term_ids: list[int],
        keywords: list[str],
    ) -> list[dict]:
        params: dict[str, Any] = {"per_page": 100, "include[]": ["teachers", "term"]}
        if term_ids:
            params["enrollment_term_id"] = term_ids[0]
        if keywords:
            params["search_term"] = keywords[0]

        courses = await self._paginate(
            f"{self._base_url}/api/v1/accounts/{account_id}/courses",
            params,
        )

        # Client-side filtering for additional term_ids and keywords
        if len(term_ids) > 1:
            extra_terms = set(term_ids[1:])
            courses = [
                c for c in courses if c.get("enrollment_term_id") in extra_terms
            ] + [c for c in courses if c.get("enrollment_term_id") == term_ids[0]]

        for kw in keywords[1:]:
            kw_lower = kw.lower()
            courses = [c for c in courses if kw_lower in c.get("name", "").lower()]

        return courses

    async def get_course_student_count(self, course_id: int) -> int:
        enrollments = await self._paginate(
            f"{self._base_url}/api/v1/courses/{course_id}/enrollments",
            {"type[]": "StudentEnrollment", "per_page": 1, "page": 1},
        )
        # Canvas doesn't expose a count endpoint; use the total from Link header workaround.
        # Fall back to fetching all and counting.
        return len(
            await self._paginate(
                f"{self._base_url}/api/v1/courses/{course_id}/enrollments",
                {"type[]": "StudentEnrollment", "per_page": 100},
            )
        )

    async def get_course_students(self, course_id: int) -> list[dict]:
        enrollments = await self._paginate(
            f"{self._base_url}/api/v1/courses/{course_id}/enrollments",
            {"type[]": "StudentEnrollment", "per_page": 100, "include[]": ["user"]},
        )
        return [e for e in enrollments if e.get("type") == "StudentEnrollment"]
