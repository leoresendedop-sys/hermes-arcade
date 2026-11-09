"""Shared score store for Hermes Arcade.

Used by both the agent-facing tools (tools.py) and the dashboard backend
(dashboard/plugin_api.py). Persists scores as JSON under the Hermes home
directory so data survives plugin updates.

Layout of the JSON document:
{
  "games": {
    "snake": {
      "plays": 12,
      "scores": [{"initials": "LEO", "score": 340, "ts": 1731000000.0}, ...]
    },
    ...
  }
}
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
import time
from pathlib import Path

GAMES = {
    "snake": {
        "label": "Neon Snake",
        "blurb": "Eat the pellets, don't bite yourself. Speed ramps with every pellet.",
    },
    "breakout": {
        "label": "Neon Breakout",
        "blurb": "Smash the brick wall. Angle the ball off the paddle edges.",
    },
    "pong": {
        "label": "Neon Pong",
        "blurb": "First to 7 against the machine. It does not miss often.",
    },
}

MAX_SCORES_PER_GAME = 10
VALID_INITIALS_LEN = 3

_lock = threading.Lock()


def _hermes_home() -> Path:
    home = os.environ.get("HERMES_HOME")
    if home:
        return Path(home)
    return Path.home() / ".hermes"


def data_dir() -> Path:
    d = _hermes_home() / "plugin-data" / "hermes-arcade"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _store_path() -> Path:
    return data_dir() / "scores.json"


def _empty() -> dict:
    return {"games": {g: {"plays": 0, "scores": []} for g in GAMES}}


def load() -> dict:
    path = _store_path()
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return _empty()
    games = doc.get("games")
    if not isinstance(games, dict):
        return _empty()
    # Normalise: ensure every known game exists and scores are well-formed.
    out = _empty()
    for game in GAMES:
        entry = games.get(game) or {}
        scores = entry.get("scores") or []
        clean = []
        for s in scores:
            try:
                clean.append(
                    {
                        "initials": str(s.get("initials", "???"))[:VALID_INITIALS_LEN].upper(),
                        "score": int(s.get("score", 0)),
                        "ts": float(s.get("ts", 0.0)),
                    }
                )
            except Exception:
                continue
        clean.sort(key=lambda s: s["score"], reverse=True)
        out["games"][game] = {
            "plays": int(entry.get("plays", 0) or 0),
            "scores": clean[:MAX_SCORES_PER_GAME],
        }
    return out


def _save(doc: dict) -> None:
    path = _store_path()
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(doc, f, indent=1)
        os.replace(tmp, path)
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def record_play(game: str) -> None:
    """Increment the play counter for a game (called when a run starts)."""
    if game not in GAMES:
        return
    with _lock:
        doc = load()
        doc["games"][game]["plays"] += 1
        _save(doc)


def submit_score(game: str, initials: str, score: int) -> dict:
    """Insert a score; returns {rank, made_board, best}."""
    if game not in GAMES:
        return {"error": f"unknown game: {game}"}
    initials = "".join(c for c in str(initials).upper() if c.isalnum())[:VALID_INITIALS_LEN]
    if not initials:
        initials = "???"
    try:
        score = max(0, int(score))
    except Exception:
        return {"error": "score must be an integer"}
    with _lock:
        doc = load()
        board = doc["games"][game]["scores"]
        entry = {"initials": initials, "score": score, "ts": time.time()}
        board.append(entry)
        board.sort(key=lambda s: s["score"], reverse=True)
        rank = board.index(entry) + 1
        made_board = rank <= MAX_SCORES_PER_GAME
        doc["games"][game]["scores"] = board[:MAX_SCORES_PER_GAME]
        _save(doc)
    return {
        "rank": rank if made_board else None,
        "made_board": made_board,
        "best": doc["games"][game]["scores"][0]["score"] if doc["games"][game]["scores"] else score,
    }


def summary() -> dict:
    """Aggregate stats across all games."""
    doc = load()
    out = {"total_plays": 0, "games": {}}
    for game, meta in GAMES.items():
        entry = doc["games"][game]
        best = entry["scores"][0] if entry["scores"] else None
        out["games"][game] = {
            "label": meta["label"],
            "plays": entry["plays"],
            "best": best,
        }
        out["total_plays"] += entry["plays"]
    return out
