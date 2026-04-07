# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

**Local development:**
```bash
python app.py
# App runs on http://127.0.0.1:8000 (or PORT env var)
```

**Docker:**
```bash
docker build -t in-in .
docker run -p 8000:8000 \
  -e SECRET_KEY=... \
  -e MONGO_URI=... \
  -e AZURE_TRANSLATOR_KEY=... \
  -e AZURE_TRANSLATOR_LOCATION=... \
  in-in
```

## Required Environment Variables

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Flask session secret |
| `MONGO_URI` | MongoDB connection string |
| `AZURE_TRANSLATOR_KEY` | Azure Cognitive Services key |
| `AZURE_TRANSLATOR_LOCATION` | Azure region (e.g. `eastus`) |

## Architecture

Single-file Flask backend ([app.py](app.py)) with a multi-page frontend. No build step — templates are Jinja2, JS is vanilla ES6, CSS is custom (no Tailwind CDN dependency in production).

**Features / route groups:**
- **Auth** — `/login`, `/register`, `/logout`, `/change-password` (Flask-Login + bcrypt)
- **Translator** — `/translator` + `POST /api/translate` (hits Azure Cognitive Services, rate-limited to 40/min)
- **Journal** — `/journal`, `/journal/new`, `/journal/delete/<id>`, `/journal/chart-data` (mood tracking with piglet-illustrated entries)
- **Board** — `/board`, `/board/data`, `/board/task` CRUD, `/board/task/<id>/archive`, `/board/archive/delete` (Kanban: todo / inprogress / done; plus Calendar tab)
- **Summary** — `/summary`, `/summary/data` (aggregated view of board + journal data)
- **Health** — `/healthz`

**MongoDB collections** (all in `db_webpage`):
- `account` — users (username, bcrypt password)
- `journal` — entries per user (date, feeling, score, challenged, reflect)
- `board_tasks` — active kanban tasks (title, column, priority, due_date, due_time, recur, subtasks, notes)
- `board_archive` — weekly archived done-tasks (week_start, week_label, tasks[])

**Frontend JS files** in `static/js/`:
- `script.js` — translator page logic (debounced input → POST `/api/translate`)
- `journal.js` — journal write/entries/heatmap chart tabs
- `summary.js` — summary dashboard (exploding donut charts drawn on `<canvas>`, mood piglet)
- `board.js` — kanban drag-and-drop, task detail modal, calendar tab

**Jinja2 templates** in `templates/`:

- `base.html` — shared layout/navbar (account dropdown, "Productive" nav dropdown, mobile hamburger, dark mode toggle)
- `templates/partials/` — inline SVG piglet illustrations, one file per mood state (excited / happy / calm / neutral / tired / sad / anxious / frustrated), plus a default `piglet.html` used in the header

## Key Behaviors

- **Dark mode**: Toggled via a class on `<html>`, persisted in `localStorage`. Applied before first paint (inline script in `base.html`) to prevent flash.
- **Auto-archive**: On Mondays, `_maybe_archive()` is called on board load — it moves last week's "done" tasks from `board_tasks` into `board_archive`. Idempotent.
- **Board calendar tab**: Shares the same task data loaded from `/board/data`. Tasks appear on their `due_date`; clicking a day opens a slide-out panel with quick-add.
- **Task detail modal**: Rich-text notes (`contenteditable` + `execCommand`), subtasks (up to 20), priority, recurrence, due date/time — all saved via `PATCH /board/task/<id>`.
- **Chinese transliteration**: When translating to `zh-Hans`, the Azure response includes both Chinese characters and Pinyin romanization returned on a second line.
- **Supported languages**: `en`, `fi`, `vi`, `zh-Hans` (English, Finnish, Vietnamese, Simplified Chinese).
- **Rate limits**: `/api/translate` 40/min, `/login` 20/hr, `/register` 10/hr, `/change-password` 10/hr. Journal and Board routes have no limits.
- **CSRF**: Enabled globally via Flask-WTF. All POST forms need `{{ csrf_token() }}` in a hidden input, or the `X-CSRFToken` header for AJAX calls. The token is also embedded in `<meta name="csrf-token">` in `base.html` for JS to read.
- **Piglet mood in Summary**: The dominant mood's piglet SVG is pre-rendered server-side (hidden divs in `summary.html`) and cloned into view by `summary.js` to avoid extra fetch requests.
