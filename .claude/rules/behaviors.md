# Key Behaviors

### Dark Mode

Toggled via a `dark` class on `<html>`, persisted in `localStorage`. Applied before first paint via an inline script in `base.html` to prevent flash. Canvas-based charts in `summary.js` must redraw when this class toggles.

### Auto-Archive

`_maybe_archive()` runs on every board page load. On Mondays, it moves last week's "done" tasks from `board_tasks` into `board_archive`. Idempotent — safe to call multiple times.

### Board Calendar Tab

Shares the same task data loaded from `/board/data`. Tasks appear on their `due_date`. Clicking a day opens a slide-out panel with a quick-add form.

### Task Detail Modal

Rich-text notes (`contenteditable` + `execCommand`), subtasks (max 20), priority, recurrence, due date/time. All saved via `PATCH /board/task/<id>`.

### Chinese Transliteration

When translating to `zh-Hans`, Azure returns both Chinese characters and Pinyin romanization. The Pinyin is returned on a second line in the response. Any code touching translation responses must handle this two-line format.

### Piglet Mood in Summary

The dominant mood's piglet SVG is pre-rendered server-side in hidden `<div>`s inside `summary.html`. `summary.js` clones the matching element into view — no extra fetch requests.
