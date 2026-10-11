# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris in vanilla JavaScript + HTML5 Canvas. No dependencies, no build step, no package.json, no tests, no linter. README and UI text are in Spanish; keep user-facing strings in Spanish.

## Running

Open `index.html` directly, or serve statically (`python -m http.server 8000`, then http://localhost:8000). Verify changes manually in the browser.

## Architecture

Three files: `index.html` (DOM + canvases), `style.css`, and `game.js` (all logic, loaded as a classic script with `'use strict'`, no modules).

`game.js` is a single global-state game:
- State lives in module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, ...), all reset in `init()`. `init()` is also the restart handler.
- Board is a `ROWS x COLS` (20x10) matrix of color indices; `0` = empty, `1–7` index into both `COLORS` and `PIECES` (the piece's matrix cells hold its own type index, so the shape doubles as its color map).
- Game loop: `loop(ts)` via `requestAnimationFrame` accumulates `dropAccum` and gravity-drops when it exceeds `dropInterval`; it also calls `draw()` every frame. Pause/game-over work by `cancelAnimationFrame(animId)`; `togglePause` restarts the loop.
- Piece lifecycle: `lockPiece()` → `merge()` → `clearLines()` (updates score/level/`dropInterval`) → `spawn()` (promotes `next`, game over if the spawn collides).
- Rotation is `rotateCW` plus horizontal wall kicks `[0,-1,1,-2,2]` in `tryRotate` (not SRS). `collide()` is the single collision check used for movement, rotation, ghost, and spawn.
- Input is one `keydown` listener (arrows, X/Up rotate, Space hard drop, P pause); it ignores input while paused/game over.
- Overlay (`#overlay`) is shared by PAUSA and GAME OVER; toggled with the `hidden` class.

Bomb power-up: every `BOMB_EVERY` (5) cleared lines, `clearLines()` sets `bombPending` (tracked against `bombsAwarded`), and `spawn()` makes the new `next` a 1x1 bomb (`BOMB_TYPE` 13, excluded from `randomPiece`'s draw; built via `makePiece`). When a bomb locks, `lockPiece()` calls `explode()` instead of merge/clearLines: it clears the 3x3 around the bomb with no gravity. `draw()` shows the 3x3 blast area as the ghost.

Scoring: `LINE_SCORES[cleared] * level`, +1 per soft-drop cell, +2 per hard-drop cell, +`BOMB_CELL_SCORE * level` per cell destroyed by a bomb. Level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.

Board canvas size (300x600) in `index.html` must stay consistent with `COLS * BLOCK` / `ROWS * BLOCK` in `game.js`.
