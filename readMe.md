# Ỉn Ỉn — Personal Productivity App

Ỉn Ỉn is a personal web app built around a piglet mascot. It started as a simple translator (PeTS) and has grown into a full productivity suite with journaling, task planning, and a summary dashboard — all behind a user account system.


## Features

### 🌐 Translator

Real-time translation across four languages — **English**, **Finnish**, **Vietnamese**, and **Mandarin Chinese** — as you type (600 ms debounce). 

### 📓 Journal

A mood-tracking journal with three tabs:

- **Write** — log a daily entry: pick a mood (Excited / Happy / Calm / Neutral / Tired / Sad / Anxious / Frustrated), optionally note what challenged you, and write a reflection. Each mood maps to a unique piglet SVG illustration.
- **Entries** — browse all past entries in reverse chronological order with inline delete confirmation.
- **Feelings** — a monthly heatmap calendar color-coded by mood, with month navigation, summary stats, and a tooltip on hover.

### 🗂️ Planner (Kanban Board)

A two-tab task manager:

- **Board tab** — three columns (To Do / In Progress / Done) with drag-and-drop. Each task supports priority (none / low / medium / high), due date, due time, recurrence (daily / weekly / monthly), a rich-text notes editor, and up to 20 subtasks. Done tasks are auto-archived every Monday. Manual archive is also available per task. Archived weeks are browsable in a slide-out drawer with bulk-delete options (>1 week, >1 month, all).
- **Calendar tab** — a monthly calendar showing tasks by due date, color-coded by priority. Click any day to see its tasks and quick-add new ones.

### 📊 Summary

A dashboard showing this month at a glance:

- Donut chart of active tasks by status (To Do / In Progress / Done + archived total)
- Donut chart of active tasks by priority
- Mood bar chart for the current month with average mood score (out of 7), dominant-mood piglet illustration, and a link to the journal feelings tab

### 🔐 Auth

Username/password accounts (bcrypt). Supports register, login, logout, and change password. Validation enforces username length/characters and password strength (uppercase, lowercase, digit, special character).

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | Python 3.11, Flask, Gunicorn |
| Database | MongoDB (pymongo) |
| Translation | Azure Cognitive Services Translator |
| Auth | Flask-Login, bcrypt, Flask-WTF (CSRF) |
| Security | Flask-Talisman, Flask-Limiter |
| Frontend | Vanilla JS (ES6), Tailwind CSS (CDN), custom CSS |
| Containerization | Docker |

---

## Setup

### Local development

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export SECRET_KEY=...
export MONGO_URI=...
export AZURE_TRANSLATOR_KEY=...
export AZURE_TRANSLATOR_LOCATION=...   # e.g. eastus

python app.py
# → http://127.0.0.1:8000
```

### Docker

```bash
docker build -t in-in .
docker run -p 8000:8000 \
  -e SECRET_KEY=... \
  -e MONGO_URI=... \
  -e AZURE_TRANSLATOR_KEY=... \
  -e AZURE_TRANSLATOR_LOCATION=... \
  in-in
```

---

## How It Works

1. **Frontend** — Each page's JS file fetches data from a JSON API on the same Flask server. Forms use CSRF tokens provided by Flask-WTF. Dark mode is persisted in `localStorage` and applied before first paint to avoid a flash.

2. **Translator** — On each keystroke (debounced 600 ms), the active text box's language is detected and a `POST /api/translate` request fires. The response populates the other three boxes simultaneously.

3. **Journal chart** — `GET /journal/chart-data` returns all entries for the user; `journal.js` builds the heatmap client-side, rendering one colored square per logged day.

4. **Board** — `GET /board/data` triggers `_maybe_archive()` on the server (Monday-only, idempotent) then returns all active tasks and archived weeks as JSON. Drag-and-drop column changes are `PATCH`ed immediately.

5. **Summary** — `GET /summary/data` runs two MongoDB aggregation pipelines (task counts by column, by priority) plus a journal query for the current month, and returns everything in one JSON payload.
