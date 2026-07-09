from typing import Literal

from pydantic import BaseModel, computed_field


class Student(BaseModel):
    id: int
    first_name: str
    last_name: str
    ssid: str
    login_id: str
    enrollment_state: Literal["active", "inactive"]
    grade: str | None = None

    @computed_field
    @property
    def email(self) -> str:
        return f"{self.login_id}@student.uiwtx.edu"
