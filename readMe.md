# Ỉn Ỉn — Personal Productivity App

Ỉn Ỉn is a personal web app built around a piglet mascot. It started as a simple translator (PeTS) and has grown into a full productivity suite with journaling, task planning, a summary dashboard, and a YKI Finnish speaking exam simulator — all behind a user account system.

**Live:** [oinky.azurewebsites.net](https://oinky.azurewebsites.net/summary)

---

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

### 🎤 YKI Speaking Exam

A Finnish speaking exam simulator with three question categories:

- **Kertominen** — narrative tasks (90s prep / 90s speak)
- **Mielipide** — opinion tasks (120s prep / 120s speak)
- **Reagointi** — reaction tasks (20s prep / 30s speak)

Features:

- **SVG countdown ring timer** — floats to the bottom-right corner when you scroll past it, so it stays visible
- **Question picker** — when a named topic is selected, browse all available questions before starting; previously-answered questions are marked with an amber ✓
- **Peel-reveal translations** — the English translation of the Finnish question and hint are hidden behind a frosted-glass cover; click to slide it open, click again to re-seal
- **Notes area** — jot prep notes during the preparation phase; notes are saved per-question and pre-filled next time you practice the same question
- **History panel** — last 10 completed sessions (with notes) stored locally; replay any past question directly from history
- **Crowd-noise audio** — plays during speaking time; volume and mute state persist across sessions (saved server-side)
- **Inline translator** — collapsible two-column translator panel below the action row for quick word lookups without leaving the page
- **Pause / resume** — pause both the timer and the audio at any time during the exam

### 🎂 Birthday Surprise

A hidden celebration feature for authenticated users. A floating 🎁 button pulses in the bottom-right corner. Clicking it launches a fullscreen 3-act animation sequence:

- **Act 1** — a CSS-drawn present box shakes and its lid flies off with burst emoji stars
- **Act 2** — a two-tier birthday cake with 5 flickering candles; candles blow out one by one, then the cake explodes
- **Act 3** — 55 confetti pieces scatter from centre while Oinky pops out and cycles through 6 dance moves (dance, jump, wave, spin, shimmy, victory); a personalised "Happy Birthday" message bounces in

Oinky's birthday hat is visible at all times in the navbar and follows every animation (idle sway, bounce, wiggle, spin) because it lives inside the same SVG group. Close any time with ✕, Escape, or a click on the backdrop.

### 🔐 Auth

Username/password accounts (bcrypt). Supports register, login, logout, and change password. Validation enforces username length/characters and password strength (uppercase, lowercase, digit, special character).

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | Python 3.12, Flask, Gunicorn |
| Database | MongoDB (pymongo) |
| Translation | Azure Cognitive Services Translator |
| Auth | Flask-Login, bcrypt, Flask-WTF (CSRF) |
| Security | Flask-Talisman, Flask-Limiter |
| Frontend | Vanilla JS (ES6), Jinja2 templates, custom CSS |
| Containerization | Docker |
| Hosting | Azure App Service (Sweden Central) |

---

## Setup

### Local development

```bash
# Install dependencies
pip install -r requirements.txt

# Copy and fill in your env vars
cp .env.example .env

python app.py
# → http://127.0.0.1:8000
```

### Docker

```bash
docker build -t in-in .
docker run -p 8000:8000 --env-file .env in-in
```

### Environment Variables

| Variable | Purpose |
| --- | --- |
| `SECRET_KEY` | Flask session secret |
| `MONGO_URI` | MongoDB connection string |
| `AZURE_TRANSLATOR_KEY` | Azure Cognitive Services key |
| `AZURE_TRANSLATOR_LOCATION` | Azure region (e.g. `swedencentral`) |
| `SESSION_COOKIE_SECURE` | Set to `true` in production |
| `WEBSITES_PORT` | `8000` — required for Azure App Service |

---

## How It Works

1. **Frontend** — Each page's JS file fetches data from a JSON API on the same Flask server. Forms use CSRF tokens provided by Flask-WTF. Dark mode is persisted in `localStorage` and applied before first paint to avoid a flash.

2. **Translator** — On each keystroke (debounced 600 ms), the active text box's language is detected and a `POST /api/translate` request fires. The response populates the other three boxes simultaneously.

3. **Journal chart** — `GET /journal/chart-data` returns all entries for the user; `journal.js` builds the heatmap client-side, rendering one colored square per logged day.

4. **Board** — `GET /board/data` triggers `_maybe_archive()` on the server (Monday-only, idempotent) then returns all active tasks and archived weeks as JSON. Drag-and-drop column changes are `PATCH`ed immediately.

5. **Summary** — `GET /summary/data` runs two MongoDB aggregation pipelines (task counts by column, by priority) plus a journal query for the current month, and returns everything in one JSON payload.

6. **YKI** — Questions are stored in MongoDB (`yki-speaking` collection, 169 documents). On category select, a random question is fetched via `POST /api/yki/question`. Pre-stored English translations are shown instantly on demand — no real-time Azure call needed.
