"""SQLite storage for group trip profiles.

The database file lives at backend/data/tripmaxxing.db and is meant for local
development. Set TRIPMAXXING_DB to point tests or another checkout elsewhere.

Each profile stores the trip inputs called out in the midterm slides:

- destination and extra stops (location, multi-stop trip)
- start and end dates
- budget
- daily time window and pace (time limits)
- dietary requirements and exclusions
- interests, plus the group's combined interests
- crowd preference (ratings and popularity)
- category variety
- cost preference
- transportation
- whether ticketed events should be included
- whether the person is open to spontaneous changes
- meal style and indoor or outdoor setting (this-or-that choices)
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parent
DEFAULT_DB = ROOT / "data" / "tripmaxxing.db"
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

SCHEMA = """
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    destination TEXT NOT NULL,
    stops_json TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    budget_usd INTEGER NOT NULL,
    day_start TEXT NOT NULL,
    day_end TEXT NOT NULL,
    interests_json TEXT NOT NULL,
    dietary_json TEXT NOT NULL,
    exclusions_json TEXT NOT NULL,
    pace TEXT NOT NULL,
    food_style TEXT NOT NULL,
    setting TEXT NOT NULL,
    crowd TEXT NOT NULL,
    variety TEXT NOT NULL,
    cost_preference TEXT NOT NULL,
    transport TEXT NOT NULL,
    include_ticketed INTEGER NOT NULL,
    open_to_spontaneous INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS profiles_group_id ON profiles(group_id);
"""


def db_path() -> Path:
    return Path(os.environ.get("TRIPMAXXING_DB", DEFAULT_DB))


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    try:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _member_id(requested: str | None, taken: set[str]) -> str:
    if requested and UUID_RE.fullmatch(requested) and requested not in taken:
        taken.add(requested)
        return requested
    new_id = str(uuid4())
    taken.add(new_id)
    return new_id


def _insert_members(conn: sqlite3.Connection, group_id: str, members: list[dict], taken: set[str]) -> None:
    for position, member in enumerate(members):
        conn.execute(
            """
            INSERT INTO profiles (
                id, group_id, position, name, destination, stops_json, start_date, end_date,
                budget_usd, day_start, day_end, interests_json, dietary_json, exclusions_json,
                pace, food_style, setting, crowd, variety, cost_preference, transport,
                include_ticketed, open_to_spontaneous
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                _member_id(member.get("id"), taken),
                group_id,
                position,
                member["name"],
                member["destination"],
                json.dumps(member["stops"]),
                member["startDate"],
                member["endDate"],
                member["budgetUsd"],
                member["dayStart"],
                member["dayEnd"],
                json.dumps(member["interests"]),
                json.dumps(member["dietary"]),
                json.dumps(member["exclusions"]),
                member["pace"],
                member["foodStyle"],
                member["setting"],
                member["crowd"],
                member["variety"],
                member["costPreference"],
                member["transport"],
                1 if member["includeTicketed"] else 0,
                1 if member["openToSpontaneous"] else 0,
            ),
        )


def _profile(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "destination": row["destination"],
        "stops": json.loads(row["stops_json"]),
        "startDate": row["start_date"],
        "endDate": row["end_date"],
        "budgetUsd": row["budget_usd"],
        "dayStart": row["day_start"],
        "dayEnd": row["day_end"],
        "interests": json.loads(row["interests_json"]),
        "dietary": json.loads(row["dietary_json"]),
        "exclusions": json.loads(row["exclusions_json"]),
        "pace": row["pace"],
        "foodStyle": row["food_style"],
        "setting": row["setting"],
        "crowd": row["crowd"],
        "variety": row["variety"],
        "costPreference": row["cost_preference"],
        "transport": row["transport"],
        "includeTicketed": bool(row["include_ticketed"]),
        "openToSpontaneous": bool(row["open_to_spontaneous"]),
    }


def _assemble(conn: sqlite3.Connection, group: sqlite3.Row) -> dict:
    rows = conn.execute(
        "SELECT * FROM profiles WHERE group_id = ? ORDER BY position, name",
        (group["id"],),
    ).fetchall()
    members = [_profile(row) for row in rows]
    interests: list[str] = []
    seen: set[str] = set()
    for member in members:
        for interest in member["interests"]:
            if interest not in seen:
                seen.add(interest)
                interests.append(interest)
    return {
        "id": group["id"],
        "name": group["name"],
        "createdAt": group["created_at"],
        "updatedAt": group["updated_at"],
        "groupInterests": sorted(interests),
        "members": members,
    }


def list_groups() -> list[dict]:
    with connect() as conn:
        groups = conn.execute("SELECT * FROM groups ORDER BY updated_at DESC, name").fetchall()
        return [_assemble(conn, group) for group in groups]


def get_group(group_id: str) -> dict | None:
    with connect() as conn:
        group = conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
        if group is None:
            return None
        return _assemble(conn, group)


def _taken_ids(conn: sqlite3.Connection, group_id: str | None) -> set[str]:
    if group_id is None:
        rows = conn.execute("SELECT id FROM profiles").fetchall()
    else:
        rows = conn.execute("SELECT id FROM profiles WHERE group_id != ?", (group_id,)).fetchall()
    return {row["id"] for row in rows}


def create_group(payload: dict) -> dict:
    group_id = str(uuid4())
    now = _now()
    with connect() as conn:
        taken = _taken_ids(conn, None)
        conn.execute(
            "INSERT INTO groups (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (group_id, payload["name"], now, now),
        )
        _insert_members(conn, group_id, payload["members"], taken)
    saved = get_group(group_id)
    if saved is None:
        raise RuntimeError("Group was not saved.")
    return saved


def update_group(group_id: str, payload: dict) -> dict | None:
    now = _now()
    with connect() as conn:
        existing = conn.execute("SELECT id FROM groups WHERE id = ?", (group_id,)).fetchone()
        if existing is None:
            return None
        taken = _taken_ids(conn, group_id)
        conn.execute(
            "UPDATE groups SET name = ?, updated_at = ? WHERE id = ?",
            (payload["name"], now, group_id),
        )
        conn.execute("DELETE FROM profiles WHERE group_id = ?", (group_id,))
        _insert_members(conn, group_id, payload["members"], taken)
    return get_group(group_id)


def delete_group(group_id: str) -> bool:
    with connect() as conn:
        cursor = conn.execute("DELETE FROM groups WHERE id = ?", (group_id,))
        return cursor.rowcount > 0
