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

Rayo power-up: every `RAYO_EVERY` (7) cleared lines, `addLines()` (shared by `clearLines()` and `zap()`) sets `rayPending` (tracked against `raysAwarded`), and `spawn()` makes the new `next` a 1x1 Rayo (`RAYO_H` 14; bomb has priority if both are pending). Up/X rotate toggles it between `RAYO_H` (clears the row, with gravity, counts as 1 line) and `RAYO_V` (empties the column, no gravity) in `tryRotate()`. `lockPiece()` calls `zap()`; `draw()` shades the affected row/column as the ghost.

Tinte power-up: every `TINTE_EVERY` (9) cleared lines, `addLines()` sets `tintePending` (tracked against `tintesAwarded`), and `spawn()` makes the new `next` a 1x1 Tinte (`TINTE_TYPE` 16; priority bomb > rayo > tinte). On lock, `tint()` takes the color of the block directly below (`tintTarget()`; none if floor or already wild) and converts every board cell of that color to `WILD` (17, board-only, `PIECES[17]` is null), then calls `clearLines()`. `isRowClear()` clears a row when its empty cells ≤ its `WILD` cells. `draw()` highlights the cells that will be converted as the ghost.

Congelar power-up: every `CONGELAR_EVERY` (11) cleared lines, `addLines()` sets `congelarPending` (tracked against `congelarAwarded`), and `spawn()` makes the new `next` a 1x1 Congelar (`CONGELAR_TYPE` 18; priority bomb > rayo > tinte > congelar). On lock, `lockPiece()` sets `freezeLeft = FREEZE_MS` (5000) and places nothing on the board. `loop()` counts `freezeLeft` down by `dt` and skips gravity accumulation while it is > 0 (player movement/drops still work; pause stops the countdown since `lastTime` resets on resume). `draw()` tints the board and shows the countdown.

Modo desafío: the game starts on the `#menu` overlay (`showMenu()`, `inMenu` blocks input and the loop); `startGame(m)` sets `mode` (`'clasico'`/`'desafio'`) and calls `init()`; the overlay's "Menú" button returns to it. DESAFÍO/MEDALLAS panel sections are only shown in desafío (medals also show in the menu). In desafío, `init()` fills `challengeQueue` with indices into `CHALLENGES` (goal `lines`/`score`/`tetris`, `target`, `timeMs`, `bonus`, `medal`) and `startChallenge()` clears the board and the clock while `score`/`lines`/`level` keep accumulating. `loop()` counts `challengeLeft` down and calls `checkChallenge()`: `completeChallenge()` adds the bonus, increments `medals[id]` (persisted in localStorage `medals`, rendered by `renderMedals()` in both modes) and shows a banner; `failChallenge()` (timeout, or a spawn collision) moves the level to the END of the queue. During the banner (`bannerLeft`) gravity and input are suspended. Goal `survive` uses elapsed seconds as progress (won when the clock runs out) and `garbageEvery` makes `loop()` call `addGarbage()` on that interval: it pushes a `GARBAGE` (19, board-only) row with one random hole from below, or fails the level if the top row is occupied. A level with `preset` (array of strings, `#` = block) starts with those rows pre-placed at the bottom as `GARBAGE` cells (clearable like any line). A level with `invisible` makes `boardHidden()` true so `draw()` skips the board cells and the ghost/power-up previews (logic is unchanged); `addLines()` sets `revealLeft` (`REVEAL_MS`) to flash the board briefly, and the banner always shows it. Levels may set `reverseRotation` (`tryRotate()` uses `rotateCCW`) and `minSpeedLevel` (gravity uses `max(level, minSpeedLevel)` via `updateDropInterval()`; `level`/scoring stay real); both only apply while `activeChallenge()` returns that level. An empty queue ends the run with the "¡DESAFÍOS COMPLETADOS!" overlay. The challenge clock is not stopped by Congelar, only by pause.

Scoring: `LINE_SCORES[cleared] * level`, +1 per soft-drop cell, +2 per hard-drop cell, +`BOMB_CELL_SCORE * level` per cell destroyed by a bomb, +`RAYO_CELL_SCORE * level` per cell destroyed by a Rayo, +`TINTE_CELL_SCORE * level` per cell converted by a Tinte. Level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)` (computed in `updateDropInterval()`).

Board canvas size (300x600) in `index.html` must stay consistent with `COLS * BLOCK` / `ROWS * BLOCK` in `game.js`.
