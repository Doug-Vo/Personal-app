---
description: Update an input length or count limit across the frontend and backend
---

Update an input limit in this app. Limits must be enforced in two places — enforce them in **both** or skip neither:

1. **Backend** (`app.py`): find the route that writes to MongoDB and add/update the validation before the DB call. Return a 400 with a descriptive error message if the limit is exceeded.
2. **Frontend** (`static/js/`): find the fetch call or form submit handler and add client-side validation before the request is sent. Surface the error to the user — don't silently block.

Current limits for reference:
- Task title: 120 chars
- Task notes: 2000 chars
- Subtask text: 200 chars, max 20 subtasks
- Journal score: integer 1–10

Tell Doug both locations that were changed.
