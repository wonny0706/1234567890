(() => {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30;

  const COLORS = {
    I: "#4db8ff",
    O: "#ffc14a",
    T: "#f472b6",
    S: "#5eead4",
    Z: "#ff6b4a",
    J: "#60a5fa",
    L: "#fb923c",
  };

  const SHAPES = {
    I: [
      [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
      ],
    ],
    O: [
      [
        [1, 1],
        [1, 1],
      ],
    ],
    T: [
      [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 1, 0],
        [1, 1, 0],
        [0, 1, 0],
      ],
    ],
    S: [
      [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 1],
        [0, 0, 1],
      ],
    ],
    Z: [
      [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
      ],
    ],
    J: [
      [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 1],
        [0, 1, 0],
        [0, 1, 0],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [0, 0, 1],
      ],
      [
        [0, 1, 0],
        [0, 1, 0],
        [1, 1, 0],
      ],
    ],
    L: [
      [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 1],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [1, 0, 0],
      ],
      [
        [1, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
      ],
    ],
  };

  const TYPES = Object.keys(SHAPES);
  const LINE_SCORES = [0, 100, 300, 500, 800];

  const boardEl = document.getElementById("board");
  const nextEl = document.getElementById("next");
  const ctx = boardEl.getContext("2d");
  const nextCtx = nextEl.getContext("2d");

  const scoreEl = document.getElementById("score");
  const linesEl = document.getElementById("lines");
  const levelEl = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayHint = document.getElementById("overlay-hint");
  const btnStart = document.getElementById("btn-start");

  let grid;
  let piece;
  let nextType;
  let score;
  let lines;
  let level;
  let dropInterval;
  let lastDrop;
  let animId;
  let state; // "ready" | "playing" | "paused" | "over"
  let bag = [];
  let clearFlash = null;

  function createGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function shuffleBag() {
    bag = [...TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }

  function pullType() {
    if (bag.length === 0) shuffleBag();
    return bag.pop();
  }

  function spawnPiece(type) {
    const rotations = SHAPES[type];
    const matrix = rotations[0];
    return {
      type,
      rotation: 0,
      matrix,
      x: Math.floor((COLS - matrix[0].length) / 2),
      y: 0,
    };
  }

  function getMatrix(type, rotation) {
    const rotations = SHAPES[type];
    return rotations[rotation % rotations.length];
  }

  function collides(p, ox = 0, oy = 0, matrix = p.matrix) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (!matrix[y][x]) continue;
        const nx = p.x + x + ox;
        const ny = p.y + y + oy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && grid[ny][nx]) return true;
      }
    }
    return false;
  }

  function merge() {
    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (!piece.matrix[y][x]) continue;
        const gy = piece.y + y;
        const gx = piece.x + x;
        if (gy >= 0) grid[gy][gx] = piece.type;
      }
    }
  }

  function clearLines() {
    const full = [];
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every((cell) => cell)) full.push(y);
    }
    if (full.length === 0) return 0;

    clearFlash = { rows: full, until: performance.now() + 120 };

    for (const y of full) {
      grid.splice(y, 1);
      grid.unshift(Array(COLS).fill(null));
    }

    const cleared = full.length;
    const points = LINE_SCORES[cleared] * level;
    score += points;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(80, 1000 - (level - 1) * 80);
    bumpStat(scoreEl);
    bumpStat(linesEl);
    bumpStat(levelEl);
    updateHUD();
    return cleared;
  }

  function bumpStat(el) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  function updateHUD() {
    scoreEl.textContent = score.toLocaleString("ko-KR");
    linesEl.textContent = String(lines);
    levelEl.textContent = String(level);
  }

  function hardDrop() {
    let dist = 0;
    while (!collides(piece, 0, 1)) {
      piece.y++;
      dist++;
    }
    score += dist * 2;
    lockPiece();
    updateHUD();
  }

  function softDrop() {
    if (!collides(piece, 0, 1)) {
      piece.y++;
      score += 1;
      updateHUD();
      lastDrop = performance.now();
      return true;
    }
    lockPiece();
    return false;
  }

  function move(dx) {
    if (!collides(piece, dx, 0)) piece.x += dx;
  }

  function rotate() {
    const rotations = SHAPES[piece.type];
    const nextRot = (piece.rotation + 1) % rotations.length;
    const nextMatrix = rotations[nextRot];
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collides(piece, kick, 0, nextMatrix)) {
        piece.rotation = nextRot;
        piece.matrix = nextMatrix;
        piece.x += kick;
        return;
      }
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    piece = spawnPiece(nextType);
    nextType = pullType();
    drawNext();
    lastDrop = performance.now();
    if (collides(piece)) {
      state = "over";
      showOverlay("GAME OVER", "다시 시작하려면 스페이스 / 시작", "다시 시작");
      cancelAnimationFrame(animId);
      drawBoard();
    }
  }

  function drawCell(c, x, y, color, size = BLOCK, alpha = 1) {
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    c.fillStyle = "rgba(255,255,255,0.28)";
    c.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    c.fillStyle = "rgba(0,0,0,0.22)";
    c.fillRect(x * size + 1, y * size + size - 5, size - 2, 4);
    c.restore();
  }

  function ghostY() {
    let gy = 0;
    while (!collides(piece, 0, gy + 1)) gy++;
    return piece.y + gy;
  }

  function drawBoard() {
    ctx.clearRect(0, 0, boardEl.width, boardEl.height);
    ctx.fillStyle = "#132033";
    ctx.fillRect(0, 0, boardEl.width, boardEl.height);

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * BLOCK, 0);
      ctx.lineTo(x * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * BLOCK);
      ctx.lineTo(COLS * BLOCK, y * BLOCK);
      ctx.stroke();
    }

    const flashing =
      clearFlash && performance.now() < clearFlash.until
        ? new Set(clearFlash.rows)
        : null;
    if (clearFlash && !flashing) clearFlash = null;

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = grid[y][x];
        if (!cell) continue;
        if (flashing && flashing.has(y)) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
        } else {
          drawCell(ctx, x, y, COLORS[cell]);
        }
      }
    }

    if (piece && state === "playing") {
      const gy = ghostY();
      for (let y = 0; y < piece.matrix.length; y++) {
        for (let x = 0; x < piece.matrix[y].length; x++) {
          if (!piece.matrix[y][x]) continue;
          drawCell(ctx, piece.x + x, gy + y, COLORS[piece.type], BLOCK, 0.22);
        }
      }
      for (let y = 0; y < piece.matrix.length; y++) {
        for (let x = 0; x < piece.matrix[y].length; x++) {
          if (!piece.matrix[y][x]) continue;
          const py = piece.y + y;
          if (py < 0) continue;
          drawCell(ctx, piece.x + x, py, COLORS[piece.type]);
        }
      }
    }
  }

  function drawNext() {
    nextCtx.clearRect(0, 0, nextEl.width, nextEl.height);
    nextCtx.fillStyle = "#132033";
    nextCtx.fillRect(0, 0, nextEl.width, nextEl.height);
    if (!nextType) return;
    const matrix = getMatrix(nextType, 0);
    const size = 24;
    const w = matrix[0].length * size;
    const h = matrix.length * size;
    const ox = (nextEl.width - w) / 2 / size;
    const oy = (nextEl.height - h) / 2 / size;
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (!matrix[y][x]) continue;
        drawCell(nextCtx, ox + x, oy + y, COLORS[nextType], size);
      }
    }
  }

  function showOverlay(title, hint, btnText) {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = title;
    overlayHint.textContent = hint;
    btnStart.textContent = btnText;
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function resetGame() {
    grid = createGrid();
    bag = [];
    shuffleBag();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    clearFlash = null;
    nextType = pullType();
    piece = spawnPiece(pullType());
    updateHUD();
    drawNext();
  }

  function startGame() {
    resetGame();
    state = "playing";
    hideOverlay();
    lastDrop = performance.now();
    cancelAnimationFrame(animId);
    loop(lastDrop);
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      showOverlay("PAUSED", "이어서 하려면 P / 시작", "계속");
      cancelAnimationFrame(animId);
    } else if (state === "paused") {
      state = "playing";
      hideOverlay();
      lastDrop = performance.now();
      loop(lastDrop);
    }
  }

  function loop(now) {
    if (state !== "playing") return;
    if (now - lastDrop >= dropInterval) {
      if (collides(piece, 0, 1)) lockPiece();
      else piece.y++;
      lastDrop = now;
    }
    drawBoard();
    if (state === "playing") animId = requestAnimationFrame(loop);
  }

  function onKey(e) {
    const key = e.key;
    if (key === " " || key === "Spacebar") {
      e.preventDefault();
      if (state === "ready" || state === "over") {
        startGame();
        return;
      }
      if (state === "playing") hardDrop();
      return;
    }

    if (key === "p" || key === "P") {
      e.preventDefault();
      if (state === "playing" || state === "paused") togglePause();
      return;
    }

    if (state !== "playing") return;

    if (key === "ArrowLeft") {
      e.preventDefault();
      move(-1);
    } else if (key === "ArrowRight") {
      e.preventDefault();
      move(1);
    } else if (key === "ArrowDown") {
      e.preventDefault();
      softDrop();
    } else if (key === "ArrowUp" || key === "x" || key === "X") {
      e.preventDefault();
      rotate();
    }
    drawBoard();
  }

  btnStart.addEventListener("click", () => {
    if (state === "paused") togglePause();
    else startGame();
  });

  document.getElementById("btn-left").addEventListener("click", () => {
    if (state === "playing") {
      move(-1);
      drawBoard();
    }
  });
  document.getElementById("btn-right").addEventListener("click", () => {
    if (state === "playing") {
      move(1);
      drawBoard();
    }
  });
  document.getElementById("btn-rotate").addEventListener("click", () => {
    if (state === "playing") {
      rotate();
      drawBoard();
    }
  });
  document.getElementById("btn-down").addEventListener("click", () => {
    if (state === "playing") softDrop();
    drawBoard();
  });
  document.getElementById("btn-drop").addEventListener("click", () => {
    if (state === "ready" || state === "over") startGame();
    else if (state === "playing") hardDrop();
    drawBoard();
  });

  document.addEventListener("keydown", onKey);

  // initial idle board
  state = "ready";
  grid = createGrid();
  score = 0;
  lines = 0;
  level = 1;
  piece = null;
  nextType = null;
  updateHUD();
  drawBoard();
  drawNext();
})();
