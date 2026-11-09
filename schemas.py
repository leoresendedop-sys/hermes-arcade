"""Tool schemas — what the LLM sees for Hermes Arcade."""

ARCADE_GAMES = {
    "name": "arcade_games",
    "description": (
        "List the games available in Hermes Arcade (the dashboard arcade tab), "
        "with a short description of each and how to open the arcade. Use this "
        "when the user asks what games exist or how to play."
    ),
    "parameters": {"type": "object", "properties": {}},
}

ARCADE_TOP_SCORES = {
    "name": "arcade_top_scores",
    "description": (
        "Get the high-score leaderboard for Hermes Arcade games. Returns the "
        "top 10 scores (initials + points) per game, plus each game's play "
        "count. Use this whenever the user asks about high scores, records, "
        "leaderboards, or how well they've played."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "game": {
                "type": "string",
                "description": (
                    "Which game to read: 'snake', 'breakout' or 'pong'. "
                    "Omit to get leaderboards for all games."
                ),
                "enum": ["snake", "breakout", "pong"],
            },
        },
    },
}

ARCADE_PLAYER_STATS = {
    "name": "arcade_player_stats",
    "description": (
        "Get aggregate Hermes Arcade statistics: total games played, plays "
        "per game, and each game's current champion (initials + score). "
        "Optionally filter the leaderboard entries by a player's initials."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "initials": {
                "type": "string",
                "description": (
                    "Optional 1-3 letter arcade initials (e.g. 'LEO') to list "
                    "that player's scores across all games."
                ),
            },
        },
    },
}
