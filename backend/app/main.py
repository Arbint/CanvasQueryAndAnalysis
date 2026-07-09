from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import accounts, courses, students
from app.dependencies import get_canvas_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await get_canvas_client().aclose()


app = FastAPI(title="Canvas Query and Analysis", lifespan=lifespan)

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
