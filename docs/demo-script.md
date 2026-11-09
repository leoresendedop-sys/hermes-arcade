# Hermes Arcade — roteiro do vídeo demo (90s)

Assets prontos em `docs/assets/`:

- `demo-raw.mov` — take de tela de 95s do attract mode (jogando sozinho)
- `demo.gif` — loop de 12s já cortado e tratado (Snake → Pong → Breakout), pronto pro X
- `thumbnail.png` — 1280×720, estilo terminal Hermes + blocos ASCII + VHS
- `social-card.png` — 1200×630, link preview do X

## Estrutura (90s)

| Tempo | Cena | Take |
|-------|------|------|
| 0–5s | Cold open: thumbnail/terminal | `thumbnail.png` ou take digitando `hermes plugins enable hermes-arcade` |
| 5–15s | Abre o dashboard, clica na aba **Arcade** | tela real — o attract mode começa sozinho |
| 15–35s | **Snake** se jogando | `demo-raw.mov` (início) — dá pra intercalar com o `demo.gif` |
| 35–50s | **Breakout** — tijolos explodindo em partículas | meio do take |
| 50–60s | **Pong** — rali com rastro neon | meio do take |
| 60–75s | A parte que impressiona jurado: no chat do Hermes, perguntar *"quem é o campeão de snake?"* → o agente responde com `arcade_top_scores` | tela real do CLI/Desktop |
| 75–85s | Leaderboard com iniciais estilo fliperama + CABINET STATS | aba Arcade |
| 85–90s | Fecha com a social card + "plugin open source, link no post" | `social-card.png` |

## Dicas de gravação

- O attract mode liga sozinho com `http://127.0.0.1:9119/arcade?attract=1` — não precisa tocar no teclado durante o take.
- Cada jogo roda ~24s e o gabinete cicla Snake → Breakout → Pong.
- `demo-raw.mov` é tela cheia: recorte a região do painel do arcade no iMovie/QuickTime (o GIF já está recortado, se preferir).
- Legendas: mencione que são **3 superfícies de plugin** (dashboard UI + FastAPI backend + tools do agente) com placar compartilhado.

## Texto sugerido pro post no X

> 🕹️ Hermes Arcade — um fliperama neon DENTRO do @NousResearch Hermes Agent.
> 3 jogos, attract mode que se joga sozinho, placar persistente estilo fliperama
> e o próprio agente responde seus high scores. Plugin open source 👇
> #HermesHackathon
