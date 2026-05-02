from pydantic import BaseModel


class Account(BaseModel):
    id: int
    name: str


class Term(BaseModel):
    id: int
    name: str
