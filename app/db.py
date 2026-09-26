"""Подключение к SQLite и инициализация схемы.

БД — один файл (по умолчанию data/app.db, переопределяется DATABASE_PATH).
ORM нет: используем stdlib sqlite3, время храним как UTC ISO 8601 строки.
"""

import os
import sqlite3
from pathlib import Path

DEFAULT_DB_PATH = Path("data/app.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_utc TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id INTEGER NOT NULL UNIQUE REFERENCES slots (id),
    name TEXT NOT NULL,
    comment TEXT,
    created_utc TEXT NOT NULL
);
"""


def get_db_path() -> Path:
    return Path(os.environ.get("DATABASE_PATH", DEFAULT_DB_PATH))


def connect() -> sqlite3.Connection:
    path = get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)
