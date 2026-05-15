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

### YKI Speaking Exam (`yki.js`)

`yki.js` is the most complex frontend file after `board.js`. It runs a state machine: **START → PREP → SPEAK → DONE**, with **HISTORY** accessible from START and DONE.

**Button roles**
- `✕ Quit` (red, `yki-ctrl-quit`) — exits to START via unsaved-warning modal when exam is in progress
- `✓ Complete Exam` (green, `yki-ctrl-complete`) — hidden during PREP, only revealed when `enterSpeak()` fires. Never make it visible during the prep phase.
- `⏸ Pause` in the action row and `⏸` in the timer block both call `togglePause()` — kept in sync by `setPauseUI(paused)` which updates both simultaneously.

**Peel-reveal translations** — Finnish question and hint are always visible. Their English translations sit behind a frosted-glass cover (`.yki-peel-cover`, `position: absolute; inset: 0`). Clicking the cover slides it off (`translateY(-110%)`); the `▲ Hide` button (opacity 0 until `.yki-revealed`) re-seals it by removing `.yki-revealed`. The hint translation box follows the same pattern independently.

**Floating timer** — an `IntersectionObserver` watches a 1 px sentinel div (`#yki-timer-sentinel`) placed immediately after the timer block. When the sentinel scrolls off-screen, the timer gets `.yki-popped` (`position: fixed`, bottom-right). When the sentinel re-enters, the class is removed. The sentinel is observed instead of the timer block itself because a `position: fixed` element always reports as intersecting the viewport.

**Inline translator** — a collapsible panel below the action row (`#yki-translator-panel`). Two-column layout (textarea input | output div). FI/EN/VI language dropdowns + swap button + manual Translate button — calls `POST /api/translate`. Not auto-translating; the user must click Translate.

**Sound warning** — during PREP only, `#yki-prep-sound-warning` is shown to alert the user that crowd noise will play when speaking time starts. Hidden during SPEAK.

**Volume persistence** — crowd noise volume and mute state are saved server-side in the `account` collection (`yki_volume`, `yki_muted`) via `POST /api/yki/prefs`. On init, preferences are fetched from `GET /api/yki/prefs` and fall back to `localStorage` if the request fails. Saves are debounced 800 ms.

**Notes persistence** — when entering a question (prep phase), `GET /api/yki/notes?question=...` pre-fills the textarea with any previously saved notes for that question. On `finishExam()`, notes are written to the `yki_notes` collection via `POST /api/yki/notes`. The `yki_notes` collection is keyed on `(user_id, question)` with a unique compound index.

**History** — the last 10 completed questions (including notes) are stored in `localStorage` under `yki_history`. Each entry is prepended on `finishExam()` and the array is trimmed to 10. The HISTORY panel renders from this array.

**Topic tracking** — `state.topicActual` stores the DB-returned topic (the real topic even when the user picked "Random"). The badge shows "Random · Arkielämä" when user selection was random. Always store `topicActual` in history entries so cards display the real topic.

**Practice from history** — clicking a Practice button on a history card calls `enterPrep(category, topic, preloaded)` with the stored question object. This bypasses the API fetch and reuses the saved data. Event delegation on `#yki-history-list` handles these dynamically rendered buttons via `data-practice-idx` attributes.

**Shared unsaved-warning modal** — both `🔀 Pick Another` and `✕ Quit` use the same `#yki-unsaved-modal`. A `pendingAction` variable (`'pickAnother'` or `'quit'`) records which button triggered it so the confirm handler knows what to do.
