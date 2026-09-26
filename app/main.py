"""Точка входа FastAPI-приложения «Запись на звонок».

Один процесс отдаёт и API (/api/*), и статичный фронтенд из app/static.
Контракт API зафиксирован в docs/api.md — реализация должна ему соответствовать.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.db import init_db

STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


app = FastAPI(title="Запись на звонок", lifespan=lifespan)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# TODO(этап 3): реализовать эндпоинты по контракту docs/api.md:
#   POST /api/slots, GET /api/slots, POST /api/bookings, GET /api/bookings

app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
