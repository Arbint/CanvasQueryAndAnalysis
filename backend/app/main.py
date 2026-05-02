from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import accounts, courses, students

app = FastAPI(title="Canvas Query and Analysis")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(accounts.router, prefix="/api")
app.include_router(courses.router, prefix="/api")
app.include_router(students.router, prefix="/api")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
