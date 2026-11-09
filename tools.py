"""Tool handlers for Hermes Arcade.

Handlers receive the args dict the LLM built and ALWAYS return a JSON string,
never raising — errors come back as {"error": ...} payloads.
"""

from __future__ import annotations

import json

from . import store

_DASHBOARD_HINT = "Open the arcade with `hermes dashboard` → Arcade tab."


def arcade_games(args: dict, **kwargs) -> str:
    games = [
        {"id": gid, "label": meta["label"], "blurb": meta["blurb"]}
        for gid, meta in store.GAMES.items()
    ]
    return json.dumps({"games": games, "how_to_play": _DASHBOARD_HINT})


def arcade_top_scores(args: dict, **kwargs) -> str:
    game = (args.get("game") or "").strip().lower() if args else ""
    doc = store.load()
    if game:
        if game not in store.GAMES:
            return json.dumps(
                {"error": f"unknown game '{game}'", "known": sorted(store.GAMES)}
            )
        entry = doc["games"][game]
        return json.dumps(
            {
                "game": game,
                "label": store.GAMES[game]["label"],
                "plays": entry["plays"],
                "top_scores": entry["scores"],
            }
        )
    boards = {
        gid: {
            "label": store.GAMES[gid]["label"],
            "plays": doc["games"][gid]["plays"],
            "top_scores": doc["games"][gid]["scores"],
        }
        for gid in store.GAMES
    }
    return json.dumps({"leaderboards": boards})


def arcade_player_stats(args: dict, **kwargs) -> str:
    initials = (args.get("initials") or "").strip().upper() if args else ""
    result = {"summary": store.summary(), "how_to_play": _DASHBOARD_HINT}
    if initials:
        doc = store.load()
        mine = {}
        for gid in store.GAMES:
            hits = [
                {"rank": i + 1, "score": s["score"], "ts": s["ts"]}
                for i, s in enumerate(doc["games"][gid]["scores"])
                if s["initials"] == initials
            ]
            if hits:
                mine[gid] = hits
        result["player"] = initials
        result["player_scores"] = mine
        if not mine:
            result["note"] = f"No leaderboard entries for {initials} yet."
    return json.dumps(result)
