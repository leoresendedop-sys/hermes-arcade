# 🕹️ Hermes Arcade

A neon arcade cabinet **inside** Hermes Agent. Three playable games in the
dashboard, a persistent high-score board with arcade-style initials entry,
and agent-facing tools so Hermes itself can answer "what's my high score?".

![Games](https://img.shields.io/badge/games-3-ff2fd6) ![Stack](https://img.shields.io/badge/stack-python%20%2B%20canvas-22e6ff)

## Games

| Game | How it plays | Scoring |
|------|--------------|---------|
| **Neon Snake** | Arrows/WASD. Speed ramps with every pellet. | 10 pts per pellet |
| **Neon Breakout** | Arrows or mouse. Ball angles off the paddle edges, speeds up per brick. 3 lives, levels regenerate faster. | 10–50 pts per brick, 250 bonus per level |
| **Neon Pong** | Arrows or mouse vs the machine, first to 7. | 100 per point, 500 win bonus |

Everything is hand-drawn on HTML5 canvas: glow trails, particle bursts,
screen shake, CRT scanlines, and a WebAudio chiptune synth for sound effects.
No game engine, no build step — one IIFE bundle.

## Why it's more than a prompt

Hermes Arcade uses **three plugin surfaces at once**:

1. **Dashboard UI plugin** (`dashboard/manifest.json` + `dist/index.js`) —
   the playable arcade tab, registered at `/arcade`.
2. **Dashboard backend plugin** (`dashboard/plugin_api.py`) — FastAPI routes
   under `/api/plugins/hermes-arcade/` that persist plays and scores.
3. **Agent plugin** (`plugin.yaml` + `__init__.py`) — LLM-callable tools and
   a `/arcade` slash command.

Scores flow between the browser and the agent through a shared store
(`store.py`, JSON under `$HERMES_HOME/plugin-data/hermes-arcade/`), so the
agent can read the same leaderboard you just played on.

### Agent tools

- `arcade_games` — list the cabinet's games and how to open the arcade.
- `arcade_top_scores` — top-10 leaderboard for one game or all of them.
- `arcade_player_stats` — total plays, per-game champions, and optionally
  every leaderboard entry for a given player's initials.

Try asking Hermes: *"how many times have I played pong and who's the snake champion?"*

## Install

```bash
cp -R hermes-arcade ~/.hermes/plugins/
hermes plugins enable hermes-arcade
hermes plugins doctor ~/.hermes/plugins/hermes-arcade   # optional sanity check
```

Then play:

```bash
hermes dashboard   # → open the "Arcade" tab
```

If the dashboard was already running, restart it (backend routes mount at
startup) or hit `GET /api/dashboard/plugins/rescan` for the tab alone.

## Controls

- **Select a game** with the cabinet buttons, **ENTER** to start.
- In game: arrows / WASD / mouse (Breakout and Pong).
- **New high score?** Enter your initials arcade-style:
  ▲▼ changes the letter, ◄► changes the slot, ENTER locks it in.

## Attract mode

The cabinet plays itself: click **▶ ATTRACT** in the tab (or open
`/arcade?attract=1`) and it cycles Snake → Breakout → Pong with built-in
autopilots — perfect for demos and screen recordings. Attract runs never
touch the leaderboard or play counters.

## Files

```
hermes-arcade/
├── plugin.yaml              # agent plugin manifest
├── __init__.py              # tool + slash command registration
├── schemas.py               # tool schemas (what the LLM sees)
├── tools.py                 # tool handlers (JSON in, JSON out)
├── store.py                 # shared score store (agent ⇄ dashboard)
└── dashboard/
    ├── manifest.json        # dashboard tab registration
    ├── plugin_api.py        # FastAPI routes for plays/scores
    └── dist/
        ├── index.js         # the arcade (canvas games, no build step)
        └── style.css        # neon CRT styling
```

## License

MIT
