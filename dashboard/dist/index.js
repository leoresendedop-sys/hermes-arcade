/* Hermes Arcade — neon mini-games tab for the Hermes dashboard.
 * Plain IIFE, no build step. React comes from window.__HERMES_PLUGIN_SDK__.
 */
(function () {
  "use strict";

  const SDK = window.__HERMES_PLUGIN_SDK__;
  const { React } = SDK;
  const API = "/api/plugins/hermes-arcade";

  const W = 720;
  const H = 540;

  const COLORS = {
    cyan: "#22e6ff",
    magenta: "#ff2fd6",
    yellow: "#ffe94a",
    green: "#52ff8a",
    red: "#ff3a5e",
    white: "#e8fbff",
  };

  /* ------------------------------------------------------------------ */
  /* Audio: tiny synth for arcade blips                                 */
  /* ------------------------------------------------------------------ */

  function createSfx() {
    let ac = null;
    function ensure() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
      }
      if (ac.state === "suspended") ac.resume();
      return ac;
    }
    function tone(freq, dur, type, vol, slideTo) {
      const ctx = ensure();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(vol || 0.05, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
    return {
      blip() { tone(660, 0.07, "square", 0.045); },
      eat() { tone(520, 0.08, "square", 0.05, 880); },
      hit() { tone(220, 0.06, "sawtooth", 0.05); },
      wall() { tone(160, 0.09, "sawtooth", 0.05); },
      die() { tone(320, 0.5, "sawtooth", 0.06, 60); },
      win() {
        tone(523, 0.12, "square", 0.05);
        setTimeout(() => tone(659, 0.12, "square", 0.05), 110);
        setTimeout(() => tone(784, 0.12, "square", 0.05), 220);
        setTimeout(() => tone(1047, 0.22, "square", 0.06), 330);
      },
      letter() { tone(880, 0.04, "square", 0.04); },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Particles                                                          */
  /* ------------------------------------------------------------------ */

  function createParticles() {
    let parts = [];
    return {
      burst(x, y, color, n, speed) {
        for (let i = 0; i < (n || 14); i++) {
          const a = Math.random() * Math.PI * 2;
          const v = (0.4 + Math.random() * 0.9) * (speed || 160);
          parts.push({
            x, y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            life: 0.5 + Math.random() * 0.4,
            age: 0,
            color,
            size: 2 + Math.random() * 3,
          });
        }
      },
      update(dt) {
        parts = parts.filter((p) => {
          p.age += dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.96;
          p.vy *= 0.96;
          return p.age < p.life;
        });
      },
      draw(ctx) {
        for (const p of parts) {
          const a = 1 - p.age / p.life;
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      },
      clear() { parts = []; },
    };
  }

  function glowText(ctx, text, x, y, size, color, font) {
    ctx.save();
    ctx.font = size + "px " + (font || "'Press Start 2P', monospace");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* GAME: Neon Snake                                                   */
  /* ------------------------------------------------------------------ */

  function snakeGame(api) {
    const CELL = 24;
    const COLS = 30;
    const ROWS = 22;
    const OY = (H - ROWS * CELL) / 2;
    let snake, dir, nextDir, food, score, speed, acc, dead, started;

    function placeFood() {
      while (true) {
        const f = {
          x: Math.floor(Math.random() * COLS),
          y: Math.floor(Math.random() * ROWS),
        };
        if (!snake.some((s) => s.x === f.x && s.y === f.y)) return f;
      }
    }

    function reset() {
      snake = [{ x: 8, y: 11 }, { x: 7, y: 11 }, { x: 6, y: 11 }];
      dir = { x: 1, y: 0 };
      nextDir = dir;
      food = placeFood();
      score = 0;
      speed = 7;
      acc = 0;
      dead = false;
      started = false;
      api.status({ score: 0, extra: "" });
    }

    function step() {
      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (
        head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
        snake.some((s) => s.x === head.x && s.y === head.y)
      ) {
        dead = true;
        api.sfx.die();
        api.shake();
        api.flash();
        api.gameOver(score);
        return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 10;
        speed = Math.min(20, speed + 0.35);
        api.sfx.eat();
        api.particles.burst(
          head.x * CELL + CELL / 2,
          OY + head.y * CELL + CELL / 2,
          COLORS.green, 18, 200
        );
        food = placeFood();
        api.status({ score: score });
      } else {
        snake.pop();
      }
    }

    let t = 0;
    return {
      name: "snake",
      title: "NEON SNAKE",
      hint: "ARROWS / WASD to steer · ENTER to start",
      reset,
      keydown(e) {
        const k = e.key.toLowerCase();
        const map = {
          arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 },
          arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
          arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
          arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 },
        };
        const nd = map[k];
        if (nd && (nd.x !== -dir.x || nd.y !== -dir.y)) {
          nextDir = nd;
          started = true;
          return true;
        }
        return !!nd;
      },
      update(dt) {
        t += dt;
        api.particles.update(dt);
        if (dead || !started) return;
        acc += dt;
        const iv = 1 / speed;
        while (acc >= iv) {
          acc -= iv;
          step();
          if (dead) break;
        }
      },
      think() {
        // autopilot: greedily seek food, avoid walls/self, prefer straight lines
        const head = snake[0];
        const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
        const options = dirs.filter((dd) => !(dd.x === -dir.x && dd.y === -dir.y));
        const safe = (dd) => {
          const hx = head.x + dd.x;
          const hy = head.y + dd.y;
          if (hx < 0 || hx >= COLS || hy < 0 || hy >= ROWS) return false;
          return !snake.some((s, i) => i < snake.length - 1 && s.x === hx && s.y === hy);
        };
        let bestD = null;
        let bestScore = -Infinity;
        for (const dd of options) {
          if (!safe(dd)) continue;
          const dist = Math.abs(food.x - (head.x + dd.x)) + Math.abs(food.y - (head.y + dd.y));
          const sc = -dist + (dd.x === dir.x && dd.y === dir.y ? 0.5 : 0);
          if (sc > bestScore) { bestScore = sc; bestD = dd; }
        }
        if (bestD) { nextDir = bestD; started = true; }
      },
      render(ctx) {
        ctx.fillStyle = "#02030a";
        ctx.fillRect(0, 0, W, H);
        // faint grid
        ctx.strokeStyle = "rgba(34,230,255,0.05)";
        ctx.lineWidth = 1;
        for (let x = 0; x <= COLS; x++) {
          ctx.beginPath(); ctx.moveTo(x * CELL, OY); ctx.lineTo(x * CELL, OY + ROWS * CELL); ctx.stroke();
        }
        for (let y = 0; y <= ROWS; y++) {
          ctx.beginPath(); ctx.moveTo(0, OY + y * CELL); ctx.lineTo(COLS * CELL, OY + y * CELL); ctx.stroke();
        }
        // food
        const pulse = 1 + Math.sin(t * 6) * 0.18;
        const fx = food.x * CELL + CELL / 2;
        const fy = OY + food.y * CELL + CELL / 2;
        ctx.fillStyle = COLORS.magenta;
        ctx.shadowColor = COLORS.magenta;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(fx, fy, (CELL / 3) * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // snake
        snake.forEach((s, i) => {
          const ratio = i / snake.length;
          const color = i === 0 ? COLORS.green : ratio < 0.5 ? COLORS.cyan : "#1b7fa8";
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = i === 0 ? 16 : 8;
          const px = s.x * CELL + 2;
          const py = OY + s.y * CELL + 2;
          ctx.fillRect(px, py, CELL - 4, CELL - 4);
        });
        ctx.shadowBlur = 0;
        api.particles.draw(ctx);
        if (!started && !dead) {
          glowText(ctx, "PRESS AN ARROW KEY", W / 2, H / 2 - 10, 16, COLORS.cyan);
          glowText(ctx, "TO START", W / 2, H / 2 + 18, 16, COLORS.cyan);
        }
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* GAME: Neon Breakout                                                */
  /* ------------------------------------------------------------------ */

  function breakoutGame(api) {
    const PADDLE_W = 96;
    const PADDLE_H = 12;
    const BALL_R = 7;
    const BRICK_ROWS = 5;
    const BRICK_COLS = 10;
    const BRICK_TOP = 64;
    const BRICK_H = 20;
    const BRICK_GAP = 6;
    const brickW = (W - 40 - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;
    const ROW_COLORS = [COLORS.red, COLORS.magenta, COLORS.yellow, COLORS.green, COLORS.cyan];
    const ROW_POINTS = [50, 40, 30, 20, 10];

    let paddleX, ball, bricks, score, lives, level, dead, started;

    function buildBricks() {
      bricks = [];
      for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          bricks.push({
            x: 20 + c * (brickW + BRICK_GAP),
            y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
            alive: true,
            color: ROW_COLORS[r],
            points: ROW_POINTS[r],
          });
        }
      }
    }

    function serveBall() {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
      const sp = 330 + (level - 1) * 35;
      ball = {
        x: paddleX + PADDLE_W / 2,
        y: H - 60,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        speed: sp,
      };
    }

    function reset() {
      paddleX = W / 2 - PADDLE_W / 2;
      score = 0;
      lives = 3;
      level = 1;
      dead = false;
      started = false;
      buildBricks();
      serveBall();
      api.status({ score: 0, extra: "LIVES 3" });
    }

    function loseLife() {
      lives -= 1;
      api.sfx.die();
      api.shake();
      if (lives <= 0) {
        dead = true;
        api.flash();
        api.gameOver(score);
      } else {
        serveBall();
        started = false;
        api.status({ extra: "LIVES " + lives });
      }
    }

    return {
      name: "breakout",
      title: "NEON BREAKOUT",
      hint: "ARROWS / MOUSE to move · SPACE to launch",
      reset,
      keydown(e) {
        const k = e.key.toLowerCase();
        if (k === " ") { started = true; return true; }
        if (k === "arrowleft" || k === "a") { paddleX = Math.max(0, paddleX - 42); return true; }
        if (k === "arrowright" || k === "d") { paddleX = Math.min(W - PADDLE_W, paddleX + 42); return true; }
        return false;
      },
      mousemove(x) { paddleX = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2)); },
      update(dt) {
        api.particles.update(dt);
        if (dead || !started) {
          ball.x = paddleX + PADDLE_W / 2;
          ball.y = H - 34 - BALL_R - 2;
          return;
        }
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); api.sfx.wall(); }
        if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); api.sfx.wall(); }
        if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); api.sfx.wall(); }
        if (ball.y > H + 20) { loseLife(); return; }
        // paddle
        const py = H - 34;
        if (
          ball.vy > 0 &&
          ball.y + BALL_R >= py && ball.y + BALL_R <= py + PADDLE_H + 6 &&
          ball.x >= paddleX - BALL_R && ball.x <= paddleX + PADDLE_W + BALL_R
        ) {
          const off = (ball.x - (paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
          const ang = -Math.PI / 2 + off * 1.05;
          ball.vx = Math.cos(ang) * ball.speed;
          ball.vy = Math.sin(ang) * ball.speed;
          ball.y = py - BALL_R;
          api.sfx.blip();
        }
        // bricks
        for (const b of bricks) {
          if (!b.alive) continue;
          if (
            ball.x + BALL_R > b.x && ball.x - BALL_R < b.x + brickW &&
            ball.y + BALL_R > b.y && ball.y - BALL_R < b.y + BRICK_H
          ) {
            b.alive = false;
            score += b.points;
            ball.speed += 4;
            const ovX = Math.min(ball.x + BALL_R - b.x, b.x + brickW - (ball.x - BALL_R));
            const ovY = Math.min(ball.y + BALL_R - b.y, b.y + BRICK_H - (ball.y - BALL_R));
            if (ovX < ovY) ball.vx = -ball.vx; else ball.vy = -ball.vy;
            api.sfx.hit();
            api.particles.burst(b.x + brickW / 2, b.y + BRICK_H / 2, b.color, 16, 220);
            api.status({ score });
            break;
          }
        }
        if (bricks.every((b) => !b.alive)) {
          level += 1;
          score += 250;
          api.sfx.win();
          buildBricks();
          serveBall();
          started = false;
          api.status({ score, extra: "LIVES " + lives + " · LEVEL " + level });
        }
      },
      think() {
        // autopilot: shadow the ball with a touch of lag, auto-launch
        started = true;
        const target = ball.x - PADDLE_W / 2 + (Math.random() - 0.5) * 10;
        const dx = target - paddleX;
        paddleX += Math.max(-9, Math.min(9, dx));
        paddleX = Math.max(0, Math.min(W - PADDLE_W, paddleX));
      },
      render(ctx) {
        ctx.fillStyle = "#02030a";
        ctx.fillRect(0, 0, W, H);
        for (const b of bricks) {
          if (!b.alive) continue;
          ctx.fillStyle = b.color;
          ctx.shadowColor = b.color;
          ctx.shadowBlur = 10;
          ctx.fillRect(b.x, b.y, brickW, BRICK_H);
        }
        ctx.shadowBlur = 0;
        // paddle
        ctx.fillStyle = COLORS.cyan;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 14;
        ctx.fillRect(paddleX, H - 34, PADDLE_W, PADDLE_H);
        // ball
        ctx.fillStyle = COLORS.white;
        ctx.shadowColor = COLORS.white;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        api.particles.draw(ctx);
        if (!started && !dead) {
          glowText(ctx, "SPACE TO LAUNCH", W / 2, H / 2 + 60, 14, COLORS.cyan);
        }
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* GAME: Neon Pong                                                    */
  /* ------------------------------------------------------------------ */

  function pongGame(api) {
    const PADDLE_W = 12;
    const PADDLE_H = 88;
    const BALL_R = 8;
    const WIN_SCORE = 7;

    let playerY, aiY, ball, pScore, aiScore, dead, started, trail;

    function serve(dirToPlayer) {
      const a = (Math.random() - 0.5) * 0.9 + (dirToPlayer ? Math.PI : 0);
      ball = { x: W / 2, y: H / 2, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, speed: 360 };
      trail = [];
    }

    function reset() {
      playerY = H / 2 - PADDLE_H / 2;
      aiY = playerY;
      pScore = 0;
      aiScore = 0;
      dead = false;
      started = false;
      serve(Math.random() < 0.5);
      api.status({ score: 0, extra: "YOU 0 · CPU 0" });
    }

    function endGame() {
      dead = true;
      const won = pScore >= WIN_SCORE;
      const score = pScore * 100 + (won ? 500 : 0);
      if (won) api.sfx.win(); else api.sfx.die();
      api.flash();
      api.gameOver(score);
    }

    return {
      name: "pong",
      title: "NEON PONG",
      hint: "UP/DOWN ARROWS or MOUSE · first to 7 · ENTER to start",
      reset,
      keydown(e) {
        const k = e.key.toLowerCase();
        if (k === "arrowup" || k === "w") { playerY = Math.max(0, playerY - 44); started = true; return true; }
        if (k === "arrowdown" || k === "s") { playerY = Math.min(H - PADDLE_H, playerY + 44); started = true; return true; }
        return false;
      },
      mousemove(y) { playerY = Math.max(0, Math.min(H - PADDLE_H, y - PADDLE_H / 2)); started = true; },
      update(dt) {
        api.particles.update(dt);
        if (dead || !started) return;
        // AI: limited speed + sloppy when ball is far
        const aiCenter = aiY + PADDLE_H / 2;
        const target = ball.vx > 0 ? ball.y : H / 2;
        const aiSpeed = 300;
        if (target < aiCenter - 8) aiY = Math.max(0, aiY - aiSpeed * dt);
        else if (target > aiCenter + 8) aiY = Math.min(H - PADDLE_H, aiY + aiSpeed * dt);

        trail.push({ x: ball.x, y: ball.y });
        if (trail.length > 14) trail.shift();

        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); api.sfx.wall(); }
        if (ball.y > H - BALL_R) { ball.y = H - BALL_R; ball.vy = -Math.abs(ball.vy); api.sfx.wall(); }

        // player paddle
        if (
          ball.vx < 0 && ball.x - BALL_R < 28 + PADDLE_W && ball.x > 20 &&
          ball.y > playerY - BALL_R && ball.y < playerY + PADDLE_H + BALL_R
        ) {
          const off = (ball.y - (playerY + PADDLE_H / 2)) / (PADDLE_H / 2);
          ball.speed += 18;
          const ang = off * 1.0;
          ball.vx = Math.cos(ang) * ball.speed;
          ball.vy = Math.sin(ang) * ball.speed;
          ball.x = 28 + PADDLE_W + BALL_R;
          api.sfx.blip();
        }
        // AI paddle
        const aiX = W - 28 - PADDLE_W;
        if (
          ball.vx > 0 && ball.x + BALL_R > aiX && ball.x < W - 20 &&
          ball.y > aiY - BALL_R && ball.y < aiY + PADDLE_H + BALL_R
        ) {
          const off = (ball.y - (aiY + PADDLE_H / 2)) / (PADDLE_H / 2);
          ball.speed += 18;
          const ang = Math.PI - off * 1.0;
          ball.vx = Math.cos(ang) * ball.speed;
          ball.vy = -Math.sin(ang) * ball.speed;
          ball.x = aiX - BALL_R;
          api.sfx.blip();
        }
        // scoring
        if (ball.x < -20) {
          aiScore += 1;
          api.sfx.die();
          api.shake();
          api.particles.burst(40, ball.y, COLORS.red, 18, 240);
          api.status({ extra: "YOU " + pScore + " · CPU " + aiScore });
          if (aiScore >= WIN_SCORE) { endGame(); return; }
          serve(true);
        }
        if (ball.x > W + 20) {
          pScore += 1;
          api.sfx.eat();
          api.particles.burst(W - 40, ball.y, COLORS.green, 18, 240);
          api.status({ score: pScore * 100, extra: "YOU " + pScore + " · CPU " + aiScore });
          if (pScore >= WIN_SCORE) { endGame(); return; }
          serve(false);
        }
      },
      think() {
        // autopilot: chase the ball like the CPU does
        started = true;
        const center = playerY + PADDLE_H / 2;
        if (ball.y < center - 6) playerY = Math.max(0, playerY - 7);
        else if (ball.y > center + 6) playerY = Math.min(H - PADDLE_H, playerY + 7);
      },
      render(ctx) {
        ctx.fillStyle = "#02030a";
        ctx.fillRect(0, 0, W, H);
        // center line
        ctx.strokeStyle = "rgba(34,230,255,0.25)";
        ctx.setLineDash([8, 12]);
        ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
        ctx.setLineDash([]);
        // trail
        trail.forEach((p, i) => {
          ctx.globalAlpha = (i / trail.length) * 0.35;
          ctx.fillStyle = COLORS.yellow;
          ctx.beginPath(); ctx.arc(p.x, p.y, BALL_R * (i / trail.length), 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;
        // paddles
        ctx.fillStyle = COLORS.cyan;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 14;
        ctx.fillRect(28, playerY, PADDLE_W, PADDLE_H);
        ctx.fillStyle = COLORS.magenta;
        ctx.shadowColor = COLORS.magenta;
        ctx.fillRect(W - 28 - PADDLE_W, aiY, PADDLE_W, PADDLE_H);
        // ball
        ctx.fillStyle = COLORS.yellow;
        ctx.shadowColor = COLORS.yellow;
        ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        api.particles.draw(ctx);
        if (!started && !dead) {
          glowText(ctx, "MOVE TO START", W / 2, H / 2 - 80, 14, COLORS.cyan);
        }
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Attract mode (menu background)                                     */
  /* ------------------------------------------------------------------ */

  function attractMode() {
    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      z: 0.3 + Math.random() * 0.7,
    }));
    let t = 0;
    return {
      name: "attract",
      title: "HERMES ARCADE",
      hint: "Pick a game above",
      reset() {},
      keydown() { return false; },
      update(dt) {
        t += dt;
        for (const s of stars) {
          s.x -= 40 * s.z * dt;
          if (s.x < 0) { s.x = W; s.y = Math.random() * H; }
        }
      },
      render(ctx) {
        ctx.fillStyle = "#02030a";
        ctx.fillRect(0, 0, W, H);
        for (const s of stars) {
          ctx.globalAlpha = s.z * (0.5 + 0.5 * Math.sin(t * 2 + s.y));
          ctx.fillStyle = COLORS.cyan;
          ctx.fillRect(s.x, s.y, 2, 2);
        }
        ctx.globalAlpha = 1;
        glowText(ctx, "HERMES", W / 2, H / 2 - 56, 44, COLORS.magenta);
        glowText(ctx, "ARCADE", W / 2, H / 2 + 2, 44, COLORS.cyan);
        if (Math.floor(t * 1.4) % 2 === 0) {
          glowText(ctx, "— SELECT A GAME —", W / 2, H / 2 + 72, 14, COLORS.yellow);
        }
        glowText(ctx, "SNAKE · BREAKOUT · PONG", W / 2, H - 48, 11, "rgba(215,246,255,0.6)");
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Cabinet controller                                                 */
  /* ------------------------------------------------------------------ */

  const GAME_FACTORIES = { snake: snakeGame, breakout: breakoutGame, pong: pongGame };
  const INITIAL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");

  function createArcade(root, sdk) {
    const sfx = createSfx();
    const particles = createParticles();
    const fetchJSON = sdk.fetchJSON;

    /* ---- DOM ---- */
    root.innerHTML = "";
    const shell = el("div", "ha-shell");
    const left = el("div");
    const gamesBar = el("div", "ha-games");
    const cabinet = el("div", "ha-cabinet");
    const marquee = el("div", "ha-marquee");
    const marqueeTitle = el("div", "ha-marquee-title");
    marqueeTitle.textContent = "HERMES ARCADE";
    const lights = el("div", "ha-marquee-lights");
    for (let i = 0; i < 4; i++) lights.appendChild(el("div", "ha-light"));
    marquee.appendChild(marqueeTitle);
    marquee.appendChild(lights);

    const stage = el("div", "ha-stage ha-crt");
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    stage.appendChild(canvas);

    const statusbar = el("div", "ha-statusbar");
    const statScore = stat("SCORE");
    const statBest = stat("BEST");
    const statExtra = stat("");
    statusbar.appendChild(statScore.wrap);
    statusbar.appendChild(statExtra.wrap);
    statusbar.appendChild(statBest.wrap);

    const hint = el("div", "ha-hint");

    cabinet.appendChild(marquee);
    cabinet.appendChild(stage);
    cabinet.appendChild(statusbar);
    cabinet.appendChild(hint);
    left.appendChild(gamesBar);
    left.appendChild(cabinet);

    const sidebar = el("div", "ha-sidebar");
    const boardPanel = el("div", "ha-panel");
    const boardTitle = el("div", "ha-panel-title");
    boardTitle.textContent = "HIGH SCORES";
    const boardList = el("ol", "ha-board");
    boardPanel.appendChild(boardTitle);
    boardPanel.appendChild(boardList);

    const summaryPanel = el("div", "ha-panel");
    const summaryTitle = el("div", "ha-panel-title");
    summaryTitle.textContent = "CABINET STATS";
    const summaryGrid = el("div", "ha-summary");
    summaryPanel.appendChild(summaryTitle);
    summaryPanel.appendChild(summaryGrid);

    const coin = el("div", "ha-coin");
    coin.textContent = "· INSERT COIN ·";

    sidebar.appendChild(boardPanel);
    sidebar.appendChild(summaryPanel);
    sidebar.appendChild(coin);

    shell.appendChild(left);
    shell.appendChild(sidebar);
    root.appendChild(shell);

    function el(tag, cls) {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      return n;
    }
    function stat(labelText) {
      const wrap = el("div", "ha-stat");
      const label = document.createElement("span");
      label.textContent = labelText;
      const b = document.createElement("b");
      b.textContent = "0";
      wrap.appendChild(label);
      wrap.appendChild(b);
      return { wrap, b };
    }

    /* ---- state ---- */
    const ctx = canvas.getContext("2d");
    let mode = "attract"; // attract | ready | playing | initials | gameover
    let game = attractMode();
    let gameId = null;
    let finalScore = 0;
    let best = 0;
    let raf = 0;
    let lastT = 0;
    let destroyed = false;
    let initials = { chars: ["A", "A", "A"], slot: 0 };
    let boards = {};
    let demo = false;
    let demoClock = 0;
    const DEMO_SECONDS = 24;
    const GAME_ORDER = ["snake", "breakout", "pong"];

    const api = {
      sfx,
      particles,
      shake() {
        stage.classList.remove("ha-shake");
        void stage.offsetWidth;
        stage.classList.add("ha-shake");
      },
      flash() {
        stage.classList.remove("ha-flash");
        void stage.offsetWidth;
        stage.classList.add("ha-flash");
      },
      status(patch) {
        if (patch.score !== undefined) statScore.b.textContent = String(patch.score);
        if (patch.extra !== undefined) statExtra.b.textContent = patch.extra || "";
        statBest.b.textContent = String(best);
      },
      gameOver(score) {
        finalScore = score;
        mode = "gameover";
        setTimeout(() => {
          if (destroyed) return;
          if (demo) return; // attract mode: linger on GAME OVER, then cycle
          const qualifies =
            score > 0 &&
            (!boards[gameId] || boards[gameId].length < 10 ||
              score > boards[gameId][boards[gameId].length - 1].score);
          mode = qualifies ? "initials" : "gameover";
        }, 700);
      },
    };

    /* ---- game switching ---- */
    const buttons = {};
    Object.keys(GAME_FACTORIES).forEach((gid) => {
      const b = document.createElement("button");
      b.className = "ha-game-btn";
      b.textContent = gid.toUpperCase();
      b.addEventListener("click", () => { setDemo(false); selectGame(gid); });
      gamesBar.appendChild(b);
      buttons[gid] = b;
    });
    const demoBtn = document.createElement("button");
    demoBtn.className = "ha-game-btn";
    demoBtn.textContent = "▶ ATTRACT";
    demoBtn.title = "Attract mode — the cabinet plays itself";
    demoBtn.addEventListener("click", () => setDemo(true));
    gamesBar.appendChild(demoBtn);

    function setDemo(on) {
      demo = on;
      demoClock = 0;
      demoBtn.classList.toggle("active", on);
      if (on) {
        const next = GAME_ORDER[Math.floor(Math.random() * GAME_ORDER.length)];
        selectGame(next);
      }
    }

    function selectGame(gid) {
      gameId = gid;
      game = GAME_FACTORIES[gid](api);
      mode = "ready";
      particles.clear();
      marqueeTitle.textContent = game.title;
      hint.textContent = demo ? "ATTRACT MODE — the cabinet plays itself" : game.hint;
      Object.values(buttons).forEach((b) => b.classList.remove("active"));
      buttons[gid].classList.add("active");
      const entry = boards[gid];
      best = entry && entry.length ? entry[0].score : 0;
      game.reset();
      api.status({ score: 0, extra: "" });
      if (!demo) {
        fetchJSON(API + "/play", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game: gid }),
        }).then(loadSummary).catch(() => {});
      }
      loadBoard();
    }

    /* ---- data ---- */
    function loadBoard() {
      const q = gameId ? "?game=" + gameId : "";
      fetchJSON(API + "/scores" + q)
        .then((data) => {
          if (gameId) {
            boards[gameId] = data.scores || [];
            best = boards[gameId].length ? boards[gameId][0].score : 0;
            statBest.b.textContent = String(best);
          }
          renderBoard();
        })
        .catch(() => {
          boardList.innerHTML = "";
          const d = el("div", "ha-empty");
          d.textContent = "Score service offline — play anyway!";
          boardList.appendChild(d);
        });
    }

    function loadSummary() {
      fetchJSON(API + "/summary")
        .then((data) => {
          summaryGrid.innerHTML = "";
          const total = el("div", "ha-chip");
          total.innerHTML = "TOTAL PLAYS<b></b>";
          total.querySelector("b").textContent = String(data.total_plays || 0);
          summaryGrid.appendChild(total);
          Object.keys(data.games || {}).forEach((gid) => {
            const g = data.games[gid];
            const chip = el("div", "ha-chip");
            const bestTxt = g.best ? g.best.initials + " " + g.best.score : "—";
            chip.innerHTML = gid.toUpperCase() + " CHAMP<b></b>";
            chip.querySelector("b").textContent = bestTxt;
            summaryGrid.appendChild(chip);
          });
        })
        .catch(() => {});
    }

    function renderBoard() {
      boardList.innerHTML = "";
      boardTitle.textContent = gameId
        ? "HIGH SCORES · " + gameId.toUpperCase()
        : "HIGH SCORES";
      const rows = gameId ? boards[gameId] || [] : [];
      if (!rows.length) {
        const d = el("div", "ha-empty");
        d.textContent = gameId
          ? "No scores yet — be the first legend."
          : "Pick a game to see its legends.";
        boardList.appendChild(d);
        return;
      }
      rows.forEach((s, i) => {
        const li = document.createElement("li");
        const rank = el("span", "ha-rank");
        rank.textContent = String(i + 1).padStart(2, "0");
        const who = document.createElement("span");
        who.textContent = s.initials;
        const sc = el("span", "ha-score");
        sc.textContent = String(s.score);
        li.appendChild(rank);
        li.appendChild(who);
        li.appendChild(sc);
        boardList.appendChild(li);
      });
    }

    function submitScore() {
      return fetchJSON(API + "/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game: gameId,
          initials: initials.chars.join(""),
          score: finalScore,
        }),
      })
        .then(() => {
          sfx.win();
          loadBoard();
          loadSummary();
        })
        .catch(() => {});
    }

    /* ---- input ---- */
    function onKeydown(e) {
      const k = e.key.toLowerCase();
      const gameKeys = [
        "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter",
        "w", "a", "s", "d",
      ];
      if (gameKeys.includes(k)) e.preventDefault();

      if (mode === "ready") {
        if (k === "enter" || k === " ") {
          mode = "playing";
          game.reset();
          game.keydown(e);
          sfx.blip();
          return;
        }
        if (game.keydown(e)) { mode = "playing"; sfx.blip(); }
        return;
      }
      if (mode === "playing") {
        game.keydown(e);
        return;
      }
      if (mode === "initials") {
        const slot = initials.slot;
        const idx = INITIAL_CHARS.indexOf(initials.chars[slot]);
        if (k === "arrowup" || k === "w") {
          initials.chars[slot] = INITIAL_CHARS[(idx + 1) % INITIAL_CHARS.length];
          sfx.letter();
        } else if (k === "arrowdown" || k === "s") {
          initials.chars[slot] =
            INITIAL_CHARS[(idx - 1 + INITIAL_CHARS.length) % INITIAL_CHARS.length];
          sfx.letter();
        } else if (k === "arrowleft" || k === "a") {
          initials.slot = (slot + 2) % 3;
          sfx.letter();
        } else if (k === "arrowright" || k === "d") {
          initials.slot = (slot + 1) % 3;
          sfx.letter();
        } else if (k === "enter") {
          mode = "gameover";
          submitScore();
        }
        return;
      }
      if (mode === "gameover") {
        if (k === "enter") {
          mode = "ready";
          game.reset();
          api.status({ score: 0, extra: "" });
          sfx.blip();
        }
      }
    }

    function onMouseMove(e) {
      if (mode !== "playing" || !game.mousemove) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;
      game.mousemove(x, y);
    }

    function onClick() {
      // unlock audio on first interaction
      sfx.blip();
    }

    window.addEventListener("keydown", onKeydown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);

    // Debug/introspection handle (also handy for e2e tests).
    root.__arcade = {
      getMode: () => mode,
      selectGame,
      setDemo,
      press: (key) => onKeydown(new KeyboardEvent("keydown", { key })),
    };

    /* ---- overlays ---- */
    function drawOverlay() {
      if (mode === "ready") {
        glowText(ctx, game.title, W / 2, H / 2 - 20, 22, COLORS.yellow);
        glowText(ctx, "PRESS ENTER", W / 2, H / 2 + 20, 14, COLORS.cyan);
        return;
      }
      if (mode === "gameover") {
        ctx.fillStyle = "rgba(2,3,10,0.72)";
        ctx.fillRect(0, 0, W, H);
        glowText(ctx, "GAME OVER", W / 2, H / 2 - 46, 30, COLORS.red);
        glowText(ctx, "SCORE  " + finalScore, W / 2, H / 2 + 4, 16, COLORS.white);
        glowText(ctx, "PRESS ENTER TO RETRY", W / 2, H / 2 + 52, 12, COLORS.cyan);
        return;
      }
      if (mode === "initials") {
        ctx.fillStyle = "rgba(2,3,10,0.78)";
        ctx.fillRect(0, 0, W, H);
        glowText(ctx, "NEW HIGH SCORE!", W / 2, H / 2 - 90, 22, COLORS.yellow);
        glowText(ctx, String(finalScore), W / 2, H / 2 - 52, 18, COLORS.white);
        glowText(ctx, "ENTER YOUR INITIALS", W / 2, H / 2 - 12, 12, COLORS.cyan);
        initials.chars.forEach((ch, i) => {
          const x = W / 2 + (i - 1) * 64;
          const active = i === initials.slot;
          glowText(ctx, ch, x, H / 2 + 42, 30, active ? COLORS.magenta : COLORS.white);
          if (active) {
            ctx.fillStyle = COLORS.magenta;
            ctx.shadowColor = COLORS.magenta;
            ctx.shadowBlur = 10;
            ctx.fillRect(x - 22, H / 2 + 70, 44, 3);
            ctx.shadowBlur = 0;
          }
        });
        glowText(ctx, "▲▼ LETTER · ◄► SLOT · ENTER OK", W / 2, H / 2 + 108, 9, "rgba(215,246,255,0.65)");
      }
    }

    /* ---- main loop ---- */
    let overClock = 0;
    function frame(ts) {
      if (destroyed) return;
      const dt = Math.min(0.05, (ts - lastT) / 1000 || 0);
      lastT = ts;
      if (demo) {
        demoClock += dt;
        if (mode === "ready") {
          mode = "playing";
          game.reset();
        } else if (mode === "playing" && game.think) {
          game.think();
        }
        if (mode === "gameover" || mode === "initials") overClock += dt;
        else overClock = 0;
        if (demoClock > DEMO_SECONDS || overClock > 2.2) {
          const idx = GAME_ORDER.indexOf(gameId);
          selectGame(GAME_ORDER[(idx + 1) % GAME_ORDER.length]);
          demoClock = 0;
          overClock = 0;
        }
      }
      if (mode === "playing" || mode === "attract") {
        game.update(dt);
      } else {
        particles.update(dt);
      }
      if (mode === "ready") {
        ctx.fillStyle = "#02030a";
        ctx.fillRect(0, 0, W, H);
      } else {
        game.render(ctx);
      }
      drawOverlay();
      raf = requestAnimationFrame(frame);
    }

    game.reset();
    hint.textContent = game.hint;
    renderBoard();
    loadSummary();
    loadBoard();
    if (/[?&]attract=1/.test(location.search)) setDemo(true);
    raf = requestAnimationFrame(frame);

    return {
      destroy() {
        destroyed = true;
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", onKeydown);
        canvas.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("click", onClick);
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Plugin registration                                                */
  /* ------------------------------------------------------------------ */

  function ArcadePage() {
    const ref = React.useRef(null);
    React.useEffect(() => {
      if (!ref.current) return undefined;
      const app = createArcade(ref.current, SDK);
      return () => app.destroy();
    }, []);
    return React.createElement("div", {
      ref,
      className: "hermes-arcade-root",
      style: { padding: "4px 0 24px" },
    });
  }

  window.__HERMES_PLUGINS__.register("hermes-arcade", ArcadePage);
})();
