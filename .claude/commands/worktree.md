---
description: Crea un git worktree aislado en .trees/<name> y ejecuta ahí las instrucciones
argument-hint: <instrucciones de la tarea>
allowed-tools: Bash(git worktree:*), Bash(git -C:*), Bash(git status:*), Bash(git branch:*)
---

Instrucciones recibidas: $ARGUMENTS

Sigue estos pasos:

1. **Nombre**: deriva de las instrucciones un nombre corto en kebab-case, ASCII,
   sin acentos, 2–4 palabras (ej. "añadir power-up de escudo" → `powerup-escudo`).
   Si `.trees/<name>` o la rama `<name>` ya existen, añade un sufijo `-2`, `-3`, ...
2. **Crear worktree** desde la raíz del repo:
   `git worktree add .trees/<name>`
   (crea la rama `<name>` a partir de HEAD). Si falla, detente y reporta el error.
3. **Trabajar aislado**: TODAS las lecturas, ediciones y comandos de la tarea se hacen
   sobre `.trees/<name>/...` usando rutas absolutas a ese directorio (para git usa
   `git -C .trees/<name> ...`). No modifiques ningún archivo fuera de `.trees/<name>`.
4. **Ejecutar** las instrucciones dentro del worktree siguiendo el CLAUDE.md del proyecto.
5. **No** hagas commit, merge ni push salvo que las instrucciones lo pidan explícitamente.
6. **Resumen final**: nombre del worktree, rama, archivos cambiados, cómo probarlo
   (abrir `.trees/<name>/index.html`) y cómo integrarlo/eliminarlo:
   `git merge <name>` / `git worktree remove .trees/<name>`.
