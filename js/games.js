/* ============================================================
   Mars Jarvis — games.js
   A built-in library of simple canvas games. No API, no network,
   no cost — everything runs from code already in this file.
   Each game exposes: start(canvas, statusEl), stop().
   ============================================================ */

const JarvisGames = (() => {

  const registry = {};

  function register(key, def) { registry[key] = def; }
  function list() { return Object.entries(registry).map(([key, g]) => ({ key, name: g.name })); }
  function get(key) { return registry[key]; }

  /* Fuzzy-match a spoken/typed phrase against game names + aliases */
  function findByPhrase(phrase) {
    const q = (phrase || '').toLowerCase().trim();
    if (!q) return null;
    for (const [key, g] of Object.entries(registry)) {
      const names = [g.name.toLowerCase(), ...(g.aliases || [])];
      if (names.some(n => q.includes(n) || n.includes(q))) return key;
    }
    return null;
  }

  /* ---------------- SNAKE ---------------- */
  register('snake', {
    name: 'Snake',
    aliases: ['schlange'],
    start(canvas, status) {
      const ctx = canvas.getContext('2d');
      const size = 16;
      const cols = Math.floor(canvas.width / size);
      const rows = Math.floor(canvas.height / size);
      let snake, dir, nextDir, food, score, over, raf, lastTime = 0;

      function reset() {
        snake = [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }];
        dir = { x: 1, y: 0 };
        nextDir = dir;
        score = 0;
        over = false;
        placeFood();
        status.textContent = 'Score: 0 — Pfeiltasten zum Steuern';
      }
      function placeFood() {
        food = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
      }
      function onKey(e) {
        const map = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 } };
        const d = map[e.key];
        if (!d) return;
        if (d.x === -dir.x && d.y === -dir.y) return; // no reverse
        nextDir = d;
      }
      function step() {
        dir = nextDir;
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows || snake.some(s => s.x === head.x && s.y === head.y)) {
          over = true;
          status.textContent = `Game Over — Score: ${score}. Tippe "Neu starten".`;
          return;
        }
        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
          score++;
          status.textContent = `Score: ${score}`;
          placeFood();
        } else {
          snake.pop();
        }
      }
      function draw() {
        ctx.fillStyle = '#05070c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffb454';
        ctx.fillRect(food.x * size, food.y * size, size - 2, size - 2);
        snake.forEach((s, i) => {
          ctx.fillStyle = i === 0 ? '#4ce0ff' : 'rgba(76,224,255,0.65)';
          ctx.fillRect(s.x * size, s.y * size, size - 2, size - 2);
        });
      }
      function loop(t) {
        if (over) return;
        if (t - lastTime > 110) { step(); draw(); lastTime = t; }
        raf = requestAnimationFrame(loop);
      }

      reset();
      draw();
      window.addEventListener('keydown', onKey);
      raf = requestAnimationFrame(loop);

      return {
        stop() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); },
        restart() { reset(); draw(); if (over) { over = false; } lastTime = 0; }
      };
    }
  });

  /* ---------------- PONG ---------------- */
  register('pong', {
    name: 'Pong',
    aliases: [],
    start(canvas, status) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      let playerY = H / 2 - 30, aiY = H / 2 - 30, ballX = W / 2, ballY = H / 2;
      let ballVX = 4, ballVY = 3, playerScore = 0, aiScore = 0, raf;
      const paddleH = 60, paddleW = 10;

      function onMove(e) {
        const rect = canvas.getBoundingClientRect();
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        playerY = clientY - rect.top - paddleH / 2;
        playerY = Math.max(0, Math.min(H - paddleH, playerY));
      }
      function resetBall() {
        ballX = W / 2; ballY = H / 2;
        ballVX = (Math.random() > 0.5 ? 1 : -1) * 4;
        ballVY = (Math.random() * 2 - 1) * 3;
      }
      function step() {
        ballX += ballVX; ballY += ballVY;
        if (ballY <= 0 || ballY >= H) ballVY *= -1;

        const aiCenter = aiY + paddleH / 2;
        if (aiCenter < ballY - 10) aiY += 3.2; else if (aiCenter > ballY + 10) aiY -= 3.2;
        aiY = Math.max(0, Math.min(H - paddleH, aiY));

        if (ballX <= paddleW && ballY > playerY && ballY < playerY + paddleH) ballVX *= -1.05;
        if (ballX >= W - paddleW && ballY > aiY && ballY < aiY + paddleH) ballVX *= -1.05;

        if (ballX < 0) { aiScore++; resetBall(); }
        if (ballX > W) { playerScore++; resetBall(); }
        status.textContent = `Du: ${playerScore}  —  Jarvis: ${aiScore}`;
      }
      function draw() {
        ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(120,200,255,0.2)';
        ctx.setLineDash([6, 8]);
        ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#4ce0ff';
        ctx.fillRect(0, playerY, paddleW, paddleH);
        ctx.fillStyle = '#ffb454';
        ctx.fillRect(W - paddleW, aiY, paddleW, paddleH);
        ctx.beginPath(); ctx.arc(ballX, ballY, 6, 0, Math.PI * 2); ctx.fillStyle = '#e7f2ff'; ctx.fill();
      }
      function loop() { step(); draw(); raf = requestAnimationFrame(loop); }

      status.textContent = 'Maus/Finger bewegen, um zu spielen.';
      canvas.addEventListener('mousemove', onMove);
      canvas.addEventListener('touchmove', onMove);
      draw();
      raf = requestAnimationFrame(loop);

      return {
        stop() { cancelAnimationFrame(raf); canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('touchmove', onMove); },
        restart() { playerScore = 0; aiScore = 0; resetBall(); }
      };
    }
  });

  /* ---------------- TIC TAC TOE ---------------- */
  register('tictactoe', {
    name: 'Tic Tac Toe',
    aliases: ['drei gewinnt', 'tic-tac-toe'],
    start(canvas, status) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height, cell = Math.min(W, H) / 3;
      let board, turn, over;

      function reset() {
        board = Array(9).fill(null);
        turn = 'X';
        over = false;
        status.textContent = 'Du bist X. Tippe ein Feld an.';
        draw();
      }
      function winner() {
        const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        for (const [a,b,c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
        return board.every(Boolean) ? 'draw' : null;
      }
      function aiMove() {
        const empty = board.map((v, i) => v ? null : i).filter(v => v !== null);
        if (!empty.length) return;
        const pick = empty[Math.floor(Math.random() * empty.length)];
        board[pick] = 'O';
      }
      function onClick(e) {
        if (over) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        const col = Math.floor(x / cell), row = Math.floor(y / cell);
        const idx = row * 3 + col;
        if (idx < 0 || idx > 8 || board[idx]) return;
        board[idx] = 'X';
        let w = winner();
        if (!w) { aiMove(); w = winner(); }
        draw();
        if (w) {
          over = true;
          status.textContent = w === 'draw' ? 'Unentschieden!' : (w === 'X' ? 'Du hast gewonnen!' : 'Jarvis gewinnt!');
        }
      }
      function draw() {
        ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(120,200,255,0.3)'; ctx.lineWidth = 2;
        for (let i = 1; i < 3; i++) {
          ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, H); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(W, i * cell); ctx.stroke();
        }
        ctx.font = `${cell * 0.5}px Orbitron, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        board.forEach((v, i) => {
          if (!v) return;
          const col = i % 3, row = Math.floor(i / 3);
          ctx.fillStyle = v === 'X' ? '#4ce0ff' : '#ffb454';
          ctx.fillText(v, col * cell + cell / 2, row * cell + cell / 2);
        });
      }

      canvas.addEventListener('click', onClick);
      canvas.addEventListener('touchstart', onClick);
      reset();

      return {
        stop() { canvas.removeEventListener('click', onClick); canvas.removeEventListener('touchstart', onClick); },
        restart() { reset(); }
      };
    }
  });

  /* ---------------- BREAKOUT ---------------- */
  register('breakout', {
    name: 'Breakout',
    aliases: ['ballspiel', 'arkanoid'],
    start(canvas, status) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const paddleW = 80, paddleH = 10;
      let paddleX, ballX, ballY, ballVX, ballVY, bricks, score, over, raf;

      function reset() {
        paddleX = W / 2 - paddleW / 2;
        ballX = W / 2; ballY = H - 40;
        ballVX = 3; ballVY = -3;
        score = 0; over = false;
        const cols = 8, rows = 4, bw = W / cols, bh = 18;
        bricks = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) bricks.push({ x: c * bw, y: r * bh + 30, w: bw - 2, h: bh - 2, alive: true });
        status.textContent = 'Score: 0 — Maus/Finger bewegt das Paddle';
      }
      function onMove(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        paddleX = clientX - rect.left - paddleW / 2;
        paddleX = Math.max(0, Math.min(W - paddleW, paddleX));
      }
      function step() {
        if (over) return;
        ballX += ballVX; ballY += ballVY;
        if (ballX <= 0 || ballX >= W) ballVX *= -1;
        if (ballY <= 0) ballVY *= -1;
        if (ballY >= H) { over = true; status.textContent = `Game Over — Score: ${score}. Tippe "Neu starten".`; return; }
        if (ballY >= H - paddleH - 6 && ballX > paddleX && ballX < paddleX + paddleW) ballVY = -Math.abs(ballVY);
        for (const b of bricks) {
          if (!b.alive) continue;
          if (ballX > b.x && ballX < b.x + b.w && ballY > b.y && ballY < b.y + b.h) {
            b.alive = false; ballVY *= -1; score += 10;
            status.textContent = `Score: ${score}`;
            break;
          }
        }
        if (bricks.every(b => !b.alive)) { over = true; status.textContent = `Gewonnen! Score: ${score}`; }
      }
      function draw() {
        ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);
        bricks.forEach(b => { if (b.alive) { ctx.fillStyle = '#ffb454'; ctx.fillRect(b.x, b.y, b.w, b.h); } });
        ctx.fillStyle = '#4ce0ff';
        ctx.fillRect(paddleX, H - paddleH - 4, paddleW, paddleH);
        ctx.beginPath(); ctx.arc(ballX, ballY, 6, 0, Math.PI * 2); ctx.fillStyle = '#e7f2ff'; ctx.fill();
      }
      function loop() { step(); draw(); raf = requestAnimationFrame(loop); }

      canvas.addEventListener('mousemove', onMove);
      canvas.addEventListener('touchmove', onMove);
      reset(); draw();
      raf = requestAnimationFrame(loop);

      return {
        stop() { cancelAnimationFrame(raf); canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('touchmove', onMove); },
        restart() { reset(); }
      };
    }
  });

  /* ---------------- MEMORY ---------------- */
  register('memory', {
    name: 'Memory',
    aliases: ['gedächtnisspiel', 'memoryspiel', 'merkspiel'],
    start(canvas, status) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const cols = 4, rows = 4, gap = 6;
      const cw = (W - gap * (cols + 1)) / cols, ch = (H - gap * (rows + 1)) / rows;
      const symbols = ['◈','◎','☰','⚙','◉','✦','▲','●'];
      let cards, flipped, matched, lock, moves;

      function reset() {
        const pairs = [...symbols, ...symbols];
        for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; }
        cards = pairs.map((s, i) => ({ sym: s, col: i % cols, row: Math.floor(i / cols), open: false }));
        flipped = []; matched = 0; lock = false; moves = 0;
        status.textContent = 'Finde alle Paare — Züge: 0';
        draw();
      }
      function cardAt(x, y) {
        const col = Math.floor(x / (cw + gap)), row = Math.floor(y / (ch + gap));
        return cards.find(c => c.col === col && c.row === row);
      }
      function onClick(e) {
        if (lock) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        const c = cardAt(x, y);
        if (!c || c.open) return;
        c.open = true; flipped.push(c);
        draw();
        if (flipped.length === 2) {
          moves++;
          lock = true;
          setTimeout(() => {
            const [a, b] = flipped;
            if (a.sym === b.sym) { matched += 2; } else { a.open = false; b.open = false; }
            flipped = []; lock = false;
            status.textContent = matched === cards.length ? `Fertig in ${moves} Zügen! 🎉` : `Finde alle Paare — Züge: ${moves}`;
            draw();
          }, 650);
        }
      }
      function draw() {
        ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);
        cards.forEach(c => {
          const x = gap + c.col * (cw + gap), y = gap + c.row * (ch + gap);
          ctx.fillStyle = c.open ? 'rgba(76,224,255,0.18)' : 'rgba(120,200,255,0.08)';
          ctx.strokeStyle = 'rgba(120,200,255,0.35)';
          ctx.lineWidth = 1.5;
          ctx.fillRect(x, y, cw, ch); ctx.strokeRect(x, y, cw, ch);
          if (c.open) {
            ctx.fillStyle = '#4ce0ff';
            ctx.font = `${Math.min(cw, ch) * 0.45}px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(c.sym, x + cw / 2, y + ch / 2);
          }
        });
      }

      canvas.addEventListener('click', onClick);
      canvas.addEventListener('touchstart', onClick);
      reset();

      return {
        stop() { canvas.removeEventListener('click', onClick); canvas.removeEventListener('touchstart', onClick); },
        restart() { reset(); }
      };
    }
  });

  /* ---------------- 2048 ---------------- */
  register('2048', {
    name: '2048',
    aliases: ['zweitausendachtundvierzig'],
    start(canvas, status) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const size = 4, gap = 8;
      const cell = (Math.min(W, H) - gap * (size + 1)) / size;
      let grid, score, over;

      function reset() {
        grid = Array.from({ length: size }, () => Array(size).fill(0));
        score = 0; over = false;
        addTile(); addTile();
        status.textContent = 'Score: 0 — Pfeiltasten zum Spielen';
        draw();
      }
      function addTile() {
        const empty = [];
        for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!grid[r][c]) empty.push([r, c]);
        if (!empty.length) return;
        const [r, c] = empty[Math.floor(Math.random() * empty.length)];
        grid[r][c] = Math.random() < 0.9 ? 2 : 4;
      }
      function slide(row) {
        let arr = row.filter(v => v);
        for (let i = 0; i < arr.length - 1; i++) {
          if (arr[i] === arr[i + 1]) { arr[i] *= 2; score += arr[i]; arr.splice(i + 1, 1); }
        }
        while (arr.length < size) arr.push(0);
        return arr;
      }
      function rotate(g) {
        const n = g.length, res = Array.from({ length: n }, () => Array(n).fill(0));
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) res[c][n - 1 - r] = g[r][c];
        return res;
      }
      function move(dir) {
        let g = grid.map(r => r.slice());
        let rotations = { left: 0, up: 1, right: 2, down: 3 }[dir];
        for (let i = 0; i < rotations; i++) g = rotate(g);
        const newG = g.map(slide);
        let result = newG;
        for (let i = 0; i < (4 - rotations) % 4; i++) result = rotate(result);
        const changed = JSON.stringify(result) !== JSON.stringify(grid);
        grid = result;
        if (changed) { addTile(); }
        if (!hasMoves()) { over = true; status.textContent = `Game Over — Score: ${score}. Tippe "Neu starten".`; }
        else status.textContent = `Score: ${score}`;
        draw();
      }
      function hasMoves() {
        for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
          if (!grid[r][c]) return true;
          if (c < size - 1 && grid[r][c] === grid[r][c + 1]) return true;
          if (r < size - 1 && grid[r][c] === grid[r + 1][c]) return true;
        }
        return false;
      }
      function onKey(e) {
        if (over) return;
        const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
        if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
      }
      let touchStart = null;
      function onTouchStart(e) { touchStart = e.touches[0]; }
      function onTouchEnd(e) {
        if (!touchStart) return;
        const dx = e.changedTouches[0].clientX - touchStart.clientX;
        const dy = e.changedTouches[0].clientY - touchStart.clientY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
        if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
        else move(dy > 0 ? 'down' : 'up');
        touchStart = null;
      }
      function tileColor(v) {
        const colors = { 2: '#1d3550', 4: '#22456b', 8: '#2a6f8f', 16: '#2f8fa6', 32: '#4ce0ff', 64: '#6be8ff',
          128: '#ffb454', 256: '#ffa23d', 512: '#ff8c2b', 1024: '#ff7a1a', 2048: '#ff5470' };
        return colors[v] || '#ff5470';
      }
      function draw() {
        ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);
        for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
          const x = gap + c * (cell + gap), y = gap + r * (cell + gap);
          const v = grid[r][c];
          ctx.fillStyle = v ? tileColor(v) : 'rgba(120,200,255,0.06)';
          ctx.fillRect(x, y, cell, cell);
          if (v) {
            ctx.fillStyle = v <= 4 ? '#cfeeff' : '#06131c';
            ctx.font = `bold ${cell * 0.4}px Orbitron, sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(v, x + cell / 2, y + cell / 2);
          }
        }
      }

      window.addEventListener('keydown', onKey);
      canvas.addEventListener('touchstart', onTouchStart);
      canvas.addEventListener('touchend', onTouchEnd);
      reset();

      return {
        stop() {
          window.removeEventListener('keydown', onKey);
          canvas.removeEventListener('touchstart', onTouchStart);
          canvas.removeEventListener('touchend', onTouchEnd);
        },
        restart() { reset(); }
      };
    }
  });

  /* ---------------- FLAPPY BIRD ---------------- */
  register('flappybird', {
    name: 'Flappy Bird',
    aliases: ['flappy', 'vogel spiel'],
    start(canvas, status) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      let birdY, velocity, pipes, score, over, raf, frame;
      const gravity = 0.35, flap = -6.5, pipeGap = 130, pipeW = 50;

      function reset() {
        birdY = H / 2; velocity = 0; pipes = []; score = 0; over = false; frame = 0;
        status.textContent = 'Tippen zum Fliegen — Score: 0';
      }
      function onFlap() {
        if (over) { reset(); return; }
        velocity = flap;
      }
      function onKey(e) { if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); onFlap(); } }
      function step() {
        if (over) return;
        frame++;
        velocity += gravity;
        birdY += velocity;
        if (frame % 90 === 0) {
          const gapStart = 40 + Math.random() * (H - pipeGap - 80);
          pipes.push({ x: W, gapStart, passed: false });
        }
        pipes.forEach(p => p.x -= 2.6);
        pipes = pipes.filter(p => p.x > -pipeW);

        pipes.forEach(p => {
          if (!p.passed && p.x + pipeW < W / 2 - 15) { p.passed = true; score++; status.textContent = `Score: ${score}`; }
          const birdX = W / 2 - 15;
          if (birdX + 15 > p.x && birdX - 15 < p.x + pipeW) {
            if (birdY - 12 < p.gapStart || birdY + 12 > p.gapStart + pipeGap) { over = true; }
          }
        });
        if (birdY - 12 < 0 || birdY + 12 > H) over = true;
        if (over) status.textContent = `Game Over — Score: ${score}. Tippen zum Neustart.`;
      }
      function draw() {
        ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffb454';
        pipes.forEach(p => {
          ctx.fillRect(p.x, 0, pipeW, p.gapStart);
          ctx.fillRect(p.x, p.gapStart + pipeGap, pipeW, H - p.gapStart - pipeGap);
        });
        ctx.beginPath();
        ctx.arc(W / 2 - 15, birdY, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#4ce0ff'; ctx.fill();
      }
      function loop() { step(); draw(); raf = requestAnimationFrame(loop); }

      canvas.addEventListener('click', onFlap);
      canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onFlap(); });
      window.addEventListener('keydown', onKey);
      reset(); draw();
      raf = requestAnimationFrame(loop);

      return {
        stop() {
          cancelAnimationFrame(raf);
          canvas.removeEventListener('click', onFlap);
          window.removeEventListener('keydown', onKey);
        },
        restart() { reset(); }
      };
    }
  });

  /* ---------------- REACTION TEST ---------------- */
  register('reaction', {
    name: 'Reaktionstest',
    aliases: ['reaktion', 'reaktionsspiel', 'reaction test'],
    start(canvas, status) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      let state = 'waiting';
      let timeoutId, startTime, lastResult = null;

      function draw() {
        ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '20px Rajdhani, sans-serif';
        if (state === 'waiting') {
          ctx.fillStyle = '#9fd6ee';
          ctx.fillText('Tippen, um zu starten', W / 2, H / 2);
        } else if (state === 'ready') {
          ctx.fillStyle = '#ff5470';
          ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = '#06131c';
          ctx.fillText('Warten…', W / 2, H / 2);
        } else if (state === 'go') {
          ctx.fillStyle = '#43ffb0';
          ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = '#06131c';
          ctx.font = 'bold 28px Orbitron, sans-serif';
          ctx.fillText('JETZT TIPPEN!', W / 2, H / 2);
        } else if (state === 'result') {
          ctx.fillStyle = '#4ce0ff';
          ctx.font = 'bold 28px Orbitron, sans-serif';
          ctx.fillText(`${lastResult} ms`, W / 2, H / 2 - 15);
          ctx.font = '16px Rajdhani, sans-serif';
          ctx.fillStyle = '#9fd6ee';
          ctx.fillText('Nochmal tippen für einen neuen Versuch', W / 2, H / 2 + 20);
        }
      }
      function onTap() {
        if (state === 'waiting' || state === 'result') {
          state = 'ready';
          status.textContent = 'Warte auf Grün…';
          draw();
          const delay = 1000 + Math.random() * 2500;
          timeoutId = setTimeout(() => {
            state = 'go';
            startTime = performance.now();
            status.textContent = 'JETZT!';
            draw();
          }, delay);
        } else if (state === 'ready') {
          clearTimeout(timeoutId);
          status.textContent = 'Zu früh! Nochmal tippen.';
          state = 'waiting';
          draw();
        } else if (state === 'go') {
          lastResult = Math.round(performance.now() - startTime);
          state = 'result';
          status.textContent = `Reaktionszeit: ${lastResult} ms`;
          draw();
        }
      }

      canvas.addEventListener('click', onTap);
      canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onTap(); });
      status.textContent = 'Tippen, um zu starten';
      draw();

      return {
        stop() { clearTimeout(timeoutId); canvas.removeEventListener('click', onTap); },
        restart() { clearTimeout(timeoutId); state = 'waiting'; status.textContent = 'Tippen, um zu starten'; draw(); }
      };
    }
  });

  return { list, get, findByPhrase, register };
})();
