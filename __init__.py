"""Hermes Arcade — neon mini-games in the dashboard with agent-readable scores.

Three layers live in this one plugin directory:

- ``plugin.yaml`` + this file: agent-facing tools (leaderboards, stats).
- ``dashboard/manifest.json`` + ``dashboard/dist/``: the playable arcade tab.
- ``dashboard/plugin_api.py``: FastAPI routes the tab uses to persist scores.

Scores are shared between the agent tools and the dashboard through
``store.py`` (JSON under ``$HERMES_HOME/plugin-data/hermes-arcade/``).
"""

from __future__ import annotations

import logging

from . import schemas, tools

logger = logging.getLogger(__name__)


def _cmd_arcade(args: str = "", **kwargs) -> str:
    """Slash command: /arcade — tell the user where to play."""
    return (
        "🕹️  Hermes Arcade lives in the dashboard: run `hermes dashboard` and "
        "open the Arcade tab. Games: Neon Snake, Neon Breakout, Neon Pong. "
        "Ask me for `arcade_top_scores` any time."
    )


def register(ctx):
    """Wire schemas to handlers."""
    ctx.register_tool(
        name="arcade_games",
        toolset="hermes-arcade",
        schema=schemas.ARCADE_GAMES,
        handler=tools.arcade_games,
    )
    ctx.register_tool(
        name="arcade_top_scores",
        toolset="hermes-arcade",
        schema=schemas.ARCADE_TOP_SCORES,
        handler=tools.arcade_top_scores,
    )
    ctx.register_tool(
        name="arcade_player_stats",
        toolset="hermes-arcade",
        schema=schemas.ARCADE_PLAYER_STATS,
        handler=tools.arcade_player_stats,
    )
    try:
        ctx.register_command("arcade", _cmd_arcade)
    except Exception as exc:  # slash commands are a bonus — never block load
        logger.debug("arcade: slash command registration skipped: %s", exc)
