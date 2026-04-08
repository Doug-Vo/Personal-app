# Security Rules

## Checklist

- **User data isolation**: all queries on `journal`, `board_tasks`, `board_archive` must include `user_id: current_user.id` — a missing filter leaks one user's data to another
- **CSRF**: POST/PATCH/DELETE routes use Flask-WTF. Forms need `{{ csrf_token() }}` hidden input; AJAX reads the token from `<meta name="csrf-token">` and sends it as `X-CSRFToken` header
- **ObjectId safety**: always wrap `task_id` / `entry_id` in `ObjectId(...)` inside a `try/except` — malformed IDs crash the route with a 500 instead of returning a clean 400
- **Rate limits**: `/api/translate` (40/min), `/login` (20/hr), `/register` (10/hr), `/change-password` (10/hr). Any new auth-adjacent or external-API route must have one too

## Input Limits

Enforce on **both** frontend (before fetch) and backend (before DB write):

| Field | Limit |
| --- | --- |
| Task title | 120 chars |
| Task notes | 2000 chars |
| Subtask text | 200 chars |
| Subtasks per task | 20 |
| Journal score | Integer 1–10 |
