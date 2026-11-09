"""Backend routes for the Hermes Arcade dashboard tab.

Mounted at /api/plugins/hermes-arcade/. Shares the score store with the
agent-facing tools via store.py (loaded by file path so this module works
regardless of how the dashboard imports it).
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel, Field

_STORE_PATH = Path(__file__).resolve().parent.parent / "store.py"
_spec = importlib.util.spec_from_file_location("hermes_arcade_store", _STORE_PATH)
store = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(store)

router = APIRouter()


class PlayBody(BaseModel):
    game: str


class ScoreBody(BaseModel):
    game: str
    initials: str = Field(default="???", max_length=8)
    score: int = Field(default=0, ge=0, le=10_000_000)


@router.get("/games")
def games():
    return {"games": store.GAMES}


@router.get("/summary")
def get_summary():
    return store.summary()


@router.get("/scores")
def get_scores(game: str = ""):
    if game:
        if game not in store.GAMES:
            return {"error": f"unknown game: {game}"}
        return {"game": game, **store.load()["games"][game]}
    return {"games": store.load()["games"]}


@router.post("/play")
def post_play(body: PlayBody):
    if body.game not in store.GAMES:
        return {"ok": False, "error": f"unknown game: {body.game}"}
    store.record_play(body.game)
    return {"ok": True}


@router.post("/scores")
def post_score(body: ScoreBody):
    result = store.submit_score(body.game, body.initials, body.score)
    if "error" in result:
        return {"ok": False, **result}
    return {"ok": True, **result, "board": store.load()["games"].get(body.game, {})}
