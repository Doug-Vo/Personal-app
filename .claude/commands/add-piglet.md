---
description: Add a new mood state with a piglet SVG illustration to the journal and summary
---

Add a new mood / piglet to the app. Follow these steps:

1. Read `templates/partials/piglet_happy.html` to understand the SVG structure before creating a new one.
2. Create `templates/partials/piglet_<mood>.html` with the SVG illustration.
3. Read `app.py` and find where the `feeling` field is validated — add the new mood to the allowed enum.
4. Read `templates/summary.html` and add a hidden pre-render div for the new mood (matching the pattern of the existing moods).
5. Read `static/js/summary.js` and add the new mood to the mood→piglet mapping.
6. Read `templates/journal.html` and add the new mood to the feeling selector if it's not dynamically generated.

Tell Doug each file changed and what was added.
