from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from db import create_group, delete_group, get_group, init_db, list_groups, update_group
from schemas import GroupIn, ProfileError, normalize_group


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="TripMaxxing", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


def _payload(body: GroupIn) -> dict:
    try:
        return normalize_group(body)
    except ProfileError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/groups")
def read_groups():
    return list_groups()


@app.post("/api/groups", status_code=201)
def post_group(body: GroupIn):
    return create_group(_payload(body))


@app.get("/api/groups/{group_id}")
def read_group(group_id: str):
    group = get_group(group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found.")
    return group


@app.put("/api/groups/{group_id}")
def put_group(group_id: str, body: GroupIn):
    group = update_group(group_id, _payload(body))
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found.")
    return group


@app.delete("/api/groups/{group_id}", status_code=204)
def remove_group(group_id: str):
    if not delete_group(group_id):
        raise HTTPException(status_code=404, detail="Group not found.")
    return Response(status_code=204)
