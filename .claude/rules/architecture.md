# Architecture

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | Flask, Flask-Login, Flask-WTF (CSRF), Flask-Limiter, PyMongo, bcrypt |
| Frontend | Vanilla ES6, Jinja2 templates, custom CSS |
| Database | MongoDB (`db_webpage`) |
| External API | Azure Cognitive Services (translation) |
| Hosting | Azure App Service B1, Sweden Central (`oinky.azurewebsites.net`), Docker image `dougvo/bdapp` |

## Config Notes

| Setting | Value | Reason |
| --- | --- | --- |
| `WTF_CSRF_TIME_LIMIT` | `None` | YKI exam sessions can exceed 1 hour; disabling expiry prevents POST failures without weakening CSRF protection (token still validates against the session) |

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
│   │   ├── summary.css             # Summary dashboard
│   │   ├── yki.css                 # YKI feature-scoped styles
│   │   └── birthday.css            # Birthday hat + floating button + 3-act overlay animations
│   ├── js/
│   │   ├── script.js               # Translator page (debounced input → POST /api/translate)
│   │   ├── journal.js              # Journal tabs: write / entries / heatmap
│   │   ├── board.js                # Kanban drag-and-drop, task modal, calendar tab
│   │   ├── summary.js              # Exploding donut charts, mood piglet swap
│   │   ├── yki.js                  # YKI exam state machine + timers + audio + inline translator
│   │   └── birthday.js             # Birthday sequence orchestration: present → cake → dancing Oinky
│   ├── sound/
│   │   └── crowd-sound.mp3         # Crowd noise played during YKI speaking phase
│   └── image/
│       └── piglet.png
└── templates/
    ├── base.html                   # Shared layout: navbar, dark mode toggle, CSRF meta tag, birthday overlay
    ├── index.html                  # Landing / home page
    ├── login.html
    ├── register.html
    ├── change_password.html
    ├── journal.html
    ├── board.html
    ├── summary.html
    ├── yki.html                    # YKI speaking exam — START / EXAM / DONE / HISTORY panels; peel-reveal translations, floating timer, inline translator, notes area
    └── partials/                   # Inline SVG piglet illustrations (one per mood)
        ├── piglet.html             # Default piglet (used in navbar/header); includes birthday hat inside #piglet-group
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
| YKI | `GET /yki`, `POST /api/yki/question`, `GET /api/yki/questions`, `GET /api/yki/prefs`, `POST /api/yki/prefs`, `GET /api/yki/notes`, `POST /api/yki/notes` |
| Health | `GET /healthz` |

## MongoDB Collections

| Collection | Fields |
| --- | --- |
| `account` | `username`, `password` (bcrypt), `yki_volume` (float, optional), `yki_muted` (bool, optional) |
| `journal` | `user_id`, `date`, `feeling`, `score`, `challenged`, `reflect` |
| `board_tasks` | `user_id`, `title`, `column`, `priority`, `due_date`, `due_time`, `recur`, `subtasks[]`, `notes` |
| `board_archive` | `user_id`, `week_start`, `week_label`, `tasks[]` |
| `yki-speaking-question` | `Category`, `Topic`, `Main question`, `Translation of the main question in English`, `Hint`, `Translation of the hint` — field names are title-case with spaces (match exactly) |
| `yki_notes` | `user_id`, `question` (text, unique key per user), `notes`, `updated_at` — index on `(user_id, question)` |

## Supported Languages

`en` (English), `fi` (Finnish), `vi` (Vietnamese), `zh-Hans` (Simplified Chinese)
