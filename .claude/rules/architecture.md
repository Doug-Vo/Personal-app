# Architecture

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | Flask, Flask-Login, Flask-WTF (CSRF), Flask-Limiter, PyMongo, bcrypt |
| Frontend | Vanilla ES6, Jinja2 templates, custom CSS |
| Database | MongoDB (`db_webpage`) |
| External API | Azure Cognitive Services (translation) |
| Hosting | Azure App Service B1, Sweden Central (`oinky.azurewebsites.net`), Docker image `dougvo/bdapp` |

## File Structure

```text
Personal-Translator/
├── app.py                          # Entire backend — all routes, models, helpers
├── requirements.txt
├── Dockerfile
├── CLAUDE.md
├── static/
│   ├── css/
│   │   ├── base.css                # Global styles, navbar, dark mode
│   │   ├── board.css               # Kanban board + calendar tab
│   │   ├── journal.css             # Journal page
│   │   └── summary.css             # Summary dashboard
│   ├── js/
│   │   ├── script.js               # Translator page (debounced input → POST /api/translate)
│   │   ├── journal.js              # Journal tabs: write / entries / heatmap
│   │   ├── board.js                # Kanban drag-and-drop, task modal, calendar tab
│   │   ├── summary.js              # Exploding donut charts, mood piglet swap
│   │   └── yki.js                  # YKI exam state machine + timers + audio
│   ├── css/
│   │   └── yki.css                 # YKI feature-scoped styles
│   ├── sound/
│   │   └── crowd-sound.mp3         # Crowd noise played during YKI speaking phase
│   └── image/
│       └── piglet.png
└── templates/
    ├── base.html                   # Shared layout: navbar, dark mode toggle, CSRF meta tag
    ├── index.html                  # Landing / home page
    ├── login.html
    ├── register.html
    ├── change_password.html
    ├── journal.html
    ├── board.html
    ├── summary.html
    ├── yki.html                    # YKI speaking exam — 4-panel UI
    └── partials/                   # Inline SVG piglet illustrations (one per mood)
        ├── piglet.html             # Default piglet (used in navbar/header)
        ├── piglet_excited.html
        ├── piglet_happy.html
        ├── piglet_calm.html
        ├── piglet_neutral.html
        ├── piglet_tired.html
        ├── piglet_sad.html
        ├── piglet_anxious.html
        └── piglet_frustrated.html
```

## Routes

| Group | Routes |
| --- | --- |
| Auth | `GET/POST /login`, `GET/POST /register`, `GET /logout`, `GET/POST /change-password` |
| Translator | `GET /translator`, `POST /api/translate` |
| Journal | `GET /journal`, `POST /journal/new`, `POST /journal/delete/<id>`, `GET /journal/chart-data` |
| Board | `GET /board`, `GET /board/data`, `POST /board/task`, `PATCH /board/task/<id>`, `DELETE /board/task/<id>`, `POST /board/task/<id>/archive`, `DELETE /board/archive/delete` |
| Summary | `GET /summary`, `GET /summary/data` |
| YKI | `GET /yki`, `POST /api/yki/question` |
| Health | `GET /healthz` |

## MongoDB Collections

| Collection | Fields |
| --- | --- |
| `account` | `username`, `password` (bcrypt) |
| `journal` | `user_id`, `date`, `feeling`, `score`, `challenged`, `reflect` |
| `board_tasks` | `user_id`, `title`, `column`, `priority`, `due_date`, `due_time`, `recur`, `subtasks[]`, `notes` |
| `board_archive` | `user_id`, `week_start`, `week_label`, `tasks[]` |
| `yki-speaking` | `category`, `main_question`, `hint`, `translation` (169 docs) |

## Supported Languages

`en` (English), `fi` (Finnish), `vi` (Vietnamese), `zh-Hans` (Simplified Chinese)
