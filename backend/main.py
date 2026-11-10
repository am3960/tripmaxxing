import os
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from db import create_group, delete_group, get_group, init_db, list_groups, update_group
from schemas import GroupIn, ProfileError, normalize_group

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").rstrip("/")
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", FRONTEND_ORIGIN)
SESSION_SECRET = os.getenv("SESSION_SECRET", "")

TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="TripMaxxing", lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET or "dev-only-unset",
    session_cookie="tripmaxxing_session",
    same_site="lax",
    https_only=False,
    max_age=14 * 24 * 60 * 60,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


def _configured() -> bool:
    return bool(CLIENT_ID and CLIENT_SECRET and SESSION_SECRET)


class GoogleCode(BaseModel):
    code: str


def _user_from_profile(profile: dict) -> dict:
    return {
        "sub": profile.get("sub") or "",
        "email": profile.get("email") or "",
        "name": profile.get("name") or profile.get("email") or "Google user",
        "picture": profile.get("picture") or "",
    }


def _payload(body: GroupIn) -> dict:
    try:
        return normalize_group(body)
    except ProfileError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/health")
def health():
    return {"ok": True, "google_auth": _configured()}


@app.get("/api/auth/config")
def auth_config():
    if not _configured():
        raise HTTPException(status_code=503, detail="config")
    return {"clientId": CLIENT_ID, "redirectUri": REDIRECT_URI}


@app.post("/api/auth/google/code")
async def google_code(body: GoogleCode, request: Request):
    if not _configured():
        raise HTTPException(status_code=503, detail="config")
    async with httpx.AsyncClient(timeout=15) as client:
        token_res = await client.post(
            TOKEN_URL,
            data={
                "code": body.code,
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "redirect_uri": REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail="token")
        access_token = token_res.json().get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="token")
        user_res = await client.get(
            USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if user_res.status_code != 200:
            raise HTTPException(status_code=400, detail="profile")
        profile = user_res.json()
    request.session["user"] = _user_from_profile(profile)
    return {"user": request.session["user"]}


@app.get("/api/auth/me")
def me(request: Request):
    return {"user": request.session.get("user")}


@app.post("/api/auth/logout")
def logout(request: Request):
    request.session.clear()
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
