# Ỉn Ỉn — Personal Translator & Productivity App

## Project Overview

Full-stack personal web app with a language translator, mood journal, Kanban board, and summary dashboard. Single-file Flask backend (`app.py`) with a vanilla JS + Jinja2 frontend. No build step required.

## Running the App

**Local development:**

```bash
python app.py
# Runs on http://127.0.0.1:8000 (or PORT env var)
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

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `SECRET_KEY` | Flask session secret |
| `MONGO_URI` | MongoDB connection string |
| `AZURE_TRANSLATOR_KEY` | Azure Cognitive Services key |
| `AZURE_TRANSLATOR_LOCATION` | Azure region (e.g. `eastus`) |

## Notes

- Keep the single-file backend — all Python logic stays in `app.py`
- No build step — edit HTML/CSS/JS directly, refresh to see changes
- `board.js` is the most complex file; the calendar tab and task modal share the same data loaded on page init
- `summary.js` draws charts on `<canvas>` — verify redraws work correctly after dark mode toggle

@.claude/rules/architecture.md
@.claude/rules/behaviors.md
@.claude/rules/security.md
