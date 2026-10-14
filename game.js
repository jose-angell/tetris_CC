'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
  '#90a4ae', // N - steel gray (tuerca)
  '#f06292', // P - pink (punto)
  '#4db6ac', // U - teal
  '#aed581', // Y - lime
  '#ffb74d', // X - amber (cruz)
  '#ff1744', // B - red (bomba)
  '#ffee58', // R - yellow (rayo horizontal)
  '#ffee58', // R - yellow (rayo vertical)
  '#e040fb', // T - magenta (tinte)
  '#ffffff', // W - blanco (comodín, solo en el tablero)
  '#80deea', // C - celeste hielo (congelar)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N (tuerca)
  [[9]],                                       // P (punto 1x1)
  [[10,0,10],[10,0,10],[10,10,10]],            // U
  [[11,0,11],[0,11,0],[0,11,0]],             // Y
  [[0,12,0],[12,12,12],[0,12,0]],            // X (cruz)
  [[13]],                                      // B (bomba 1x1, power-up)
  [[14]],                                      // R horizontal (rayo 1x1, power-up)
  [[15]],                                      // R vertical (rayo 1x1, power-up)
  [[16]],                                      // T (tinte 1x1, power-up)
  null,                                        // W (comodín: solo celda de tablero)
  [[18]],                                      // C (congelar 1x1, power-up)
];

const BOMB_TYPE = 13;
const BOMB_EVERY = 5;
const BOMB_CELL_SCORE = 10;

const RAYO_H = 14;
const RAYO_V = 15;
const RAYO_EVERY = 7;
const RAYO_CELL_SCORE = 10;

const TINTE_TYPE = 16;
const WILD = 17;
const TINTE_EVERY = 9;
const TINTE_CELL_SCORE = 5;

const CONGELAR_TYPE = 18;
const CONGELAR_EVERY = 11;
const FREEZE_MS = 5000;

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, bombsAwarded, bombPending, raysAwarded, rayPending, tintesAwarded, tintePending, congelarAwarded, congelarPending, freezeLeft;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  return makePiece(Math.floor(Math.random() * (BOMB_TYPE - 1)) + 1);
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  if (current.type === RAYO_H || current.type === RAYO_V) {
    current.type = current.type === RAYO_H ? RAYO_V : RAYO_H;
    current.shape = [[current.type]];
    return;
  }
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function isRowClear(row) {
  const holes = row.filter(v => v === 0).length;
  const wilds = row.filter(v => v === WILD).length;
  return holes <= wilds;
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (isRowClear(board[r])) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    score += (LINE_SCORES[cleared] || 0) * level;
    addLines(cleared);
  }
}

function addLines(n) {
  lines += n;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  if (Math.floor(lines / BOMB_EVERY) > bombsAwarded) {
    bombsAwarded = Math.floor(lines / BOMB_EVERY);
    bombPending = true;
  }
  if (Math.floor(lines / RAYO_EVERY) > raysAwarded) {
    raysAwarded = Math.floor(lines / RAYO_EVERY);
    rayPending = true;
  }
  if (Math.floor(lines / TINTE_EVERY) > tintesAwarded) {
    tintesAwarded = Math.floor(lines / TINTE_EVERY);
    tintePending = true;
  }
  if (Math.floor(lines / CONGELAR_EVERY) > congelarAwarded) {
    congelarAwarded = Math.floor(lines / CONGELAR_EVERY);
    congelarPending = true;
  }
  updateHUD();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function explode(cx, cy) {
  let destroyed = 0;
  for (let r = cy - 1; r <= cy + 1; r++) {
    for (let c = cx - 1; c <= cx + 1; c++) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (board[r][c]) {
        board[r][c] = 0;
        destroyed++;
      }
    }
  }
  score += destroyed * BOMB_CELL_SCORE * level;
  updateHUD();
}

function zap(cx, cy) {
  let destroyed = 0;
  if (current.type === RAYO_H) {
    destroyed = board[cy].filter(v => v !== 0).length;
    if (destroyed) {
      board.splice(cy, 1);
      board.unshift(new Array(COLS).fill(0));
    }
  } else {
    for (let r = 0; r < ROWS; r++) {
      if (board[r][cx]) {
        board[r][cx] = 0;
        destroyed++;
      }
    }
  }
  score += destroyed * RAYO_CELL_SCORE * level;
  if (current.type === RAYO_H && destroyed) addLines(1);
  else updateHUD();
}

function tintTarget(cx, cy) {
  const v = cy + 1 < ROWS ? board[cy + 1][cx] : 0;
  return v && v !== WILD ? v : 0;
}

function tint(cx, cy) {
  const target = tintTarget(cx, cy);
  if (target) {
    let converted = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (board[r][c] === target) {
          board[r][c] = WILD;
          converted++;
        }
    score += converted * TINTE_CELL_SCORE * level;
  }
  clearLines();
  updateHUD();
}

function lockPiece() {
  if (current.type === BOMB_TYPE) {
    explode(current.x, current.y);
  } else if (current.type === TINTE_TYPE) {
    tint(current.x, current.y);
  } else if (current.type === RAYO_H || current.type === RAYO_V) {
    zap(current.x, current.y);
  } else if (current.type === CONGELAR_TYPE) {
    freezeLeft = FREEZE_MS;
    dropAccum = 0;
  } else {
    merge();
    clearLines();
  }
  spawn();
}

function spawn() {
  current = next;
  if (bombPending) {
    next = makePiece(BOMB_TYPE);
    bombPending = false;
  } else if (rayPending) {
    next = makePiece(RAYO_H);
    rayPending = false;
  } else if (tintePending) {
    next = makePiece(TINTE_TYPE);
    tintePending = false;
  } else if (congelarPending) {
    next = makePiece(CONGELAR_TYPE);
    congelarPending = false;
  } else {
    next = randomPiece();
  }
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  if (colorIndex === BOMB_TYPE) {
    context.fillStyle = '#212121';
    context.beginPath();
    context.arc(x * size + size / 2, y * size + size / 2, size / 2 - 2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = color;
    context.beginPath();
    context.arc(x * size + size / 2, y * size + size / 2, size / 5, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    return;
  }
  if (colorIndex === RAYO_H || colorIndex === RAYO_V) {
    const px = x * size, py = y * size;
    context.fillStyle = '#212121';
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
    context.fillStyle = color;
    if (colorIndex === RAYO_H) context.fillRect(px + 3, py + size / 2 - 2, size - 6, 4);
    else context.fillRect(px + size / 2 - 2, py + 3, 4, size - 6);
    // zigzag de rayo
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(px + size * 0.6, py + 4);
    context.lineTo(px + size * 0.35, py + size * 0.5);
    context.lineTo(px + size * 0.65, py + size * 0.5);
    context.lineTo(px + size * 0.4, py + size - 4);
    context.stroke();
    context.globalAlpha = 1;
    return;
  }
  if (colorIndex === TINTE_TYPE) {
    context.fillStyle = '#212121';
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(x * size + size / 2, y * size + 4);
    context.quadraticCurveTo(x * size + size - 4, y * size + size * 0.6, x * size + size / 2, y * size + size - 4);
    context.quadraticCurveTo(x * size + 4, y * size + size * 0.6, x * size + size / 2, y * size + 4);
    context.fill();
    context.globalAlpha = 1;
    return;
  }
  if (colorIndex === CONGELAR_TYPE) {
    const cx = x * size + size / 2, cy = y * size + size / 2, rad = size / 2 - 5;
    context.fillStyle = '#212121';
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      context.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      context.lineTo(cx - Math.cos(a) * rad, cy - Math.sin(a) * rad);
    }
    context.stroke();
    context.globalAlpha = 1;
    return;
  }
  if (colorIndex === WILD) {
    const px = x * size, py = y * size;
    const g = context.createLinearGradient(px, py, px + size, py + size);
    g.addColorStop(0, COLORS[1]);
    g.addColorStop(0.33, COLORS[3]);
    g.addColorStop(0.66, COLORS[5]);
    g.addColorStop(1, COLORS[2]);
    context.fillStyle = g;
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.strokeRect(px + 2, py + 2, size - 4, size - 4);
    context.globalAlpha = 1;
    return;
  }
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid');
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  if (current.type === BOMB_TYPE) {
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = COLORS[BOMB_TYPE];
    for (let r = gy - 1; r <= gy + 1; r++)
      for (let c = current.x - 1; c <= current.x + 1; c++)
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS)
          ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, BLOCK - 2);
    ctx.globalAlpha = 1;
  } else if (current.type === RAYO_H || current.type === RAYO_V) {
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = COLORS[current.type];
    if (current.type === RAYO_H) ctx.fillRect(1, gy * BLOCK + 1, COLS * BLOCK - 2, BLOCK - 2);
    else ctx.fillRect(current.x * BLOCK + 1, 1, BLOCK - 2, ROWS * BLOCK - 2);
    ctx.globalAlpha = 1;
  } else if (current.type === TINTE_TYPE) {
    const target = tintTarget(current.x, gy);
    if (target) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#ffffff';
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (board[r][c] === target)
            ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, BLOCK - 2);
      ctx.globalAlpha = 1;
    }
  }
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  // congelado: tinte celeste + contador
  if (freezeLeft > 0) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = COLORS[CONGELAR_TYPE];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS[CONGELAR_TYPE];
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`❄ ${Math.ceil(freezeLeft / 1000)}s`, 8, 22);
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - dt);
    dropAccum = 0;
  } else {
    dropAccum += dt;
  }
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  bombsAwarded = 0;
  bombPending = false;
  raysAwarded = 0;
  rayPending = false;
  tintesAwarded = 0;
  tintePending = false;
  congelarAwarded = 0;
  congelarPending = false;
  freezeLeft = 0;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === 'dark' ? '☀ Modo claro' : '🌙 Modo oscuro';
  try { localStorage.setItem('theme', theme); } catch (e) {}
}

themeBtn.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeBtn.blur(); // evita que Space active el botón durante el juego
});

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
applyTheme(savedTheme === 'light' ? 'light' : 'dark');

init();
