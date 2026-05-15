---
description: Add a new Flask route to app.py following the project's conventions
---

Add a new route to this Flask app. Follow these steps:

1. Read `app.py` to understand the existing route patterns before writing anything.
2. Add the route to `app.py` — place it in the correct group (Auth / Translator / Journal / Board / Summary / YKI).
3. If the route mutates data (POST/PATCH/DELETE):
   - Ensure Flask-WTF CSRF protection is active (it's global, but verify no `@csrf.exempt` was added)
   - Add a Flask-Limiter rate limit if the route is auth-adjacent or calls an external API
   - Filter all MongoDB queries by `user_id: current_user.id`
   - Wrap any `task_id` / `entry_id` in `ObjectId(...)` inside a `try/except`
4. If the route needs a frontend call, update the relevant `static/js/` file:
   - Read CSRF token from `<meta name="csrf-token">` and send as `X-CSRFToken` header on all non-GET fetches
   - Handle error responses — don't silently swallow them
5. If the route needs a new page, create the template in `templates/` extending `base.html`.

Tell Doug what you added, which file(s) changed, and flag anything that needs manual wiring (e.g., adding a nav link in `base.html`).
