---
description: Update project docs after finishing a new feature — routes table, behaviors, security limits, and architecture rules
---

After finishing a new feature, sync the project documentation. Work through each step and only update files that actually changed.

## 1. Routes table — `.claude/rules/architecture.md`

Open the **Routes** table. For every new Flask route added:
- Add it to the correct group row (Auth / Translator / Journal / Board / Summary / YKI / Health)
- Use the format `METHOD /path` — e.g. `GET /api/yki/questions`
- If a whole new group was added, add a new row

## 2. MongoDB collections — `.claude/rules/architecture.md`

Open the **MongoDB Collections** table. For every new collection or new field on an existing collection:
- Add a new row, or extend the Fields cell of an existing row
- Note any unique indexes (e.g. `index on (user_id, question)`)

## 3. Behaviors — `.claude/rules/behaviors.md`

For each non-trivial behavior introduced (state machine, persistence rule, UI pattern, non-obvious interaction):
- Add a `### Feature Name` section with a concise prose description
- Cover: what triggers it, what it does, where state is stored, any edge cases a future developer would need to know
- If it modifies an existing behavior, edit the existing section — don't add a duplicate

## 4. Security limits — `.claude/rules/security.md`

- If a new rate limit was added: note the route and limit in the **Rate limits** bullet list
- If a new input field was added with a character/count limit: add it to the **Input Limits** table (frontend + backend both enforced)
- If a new route accesses user data: verify and document the `user_id` filter requirement

## 5. File structure — `.claude/rules/architecture.md`

If new files were added (JS, CSS, templates, partials):
- Add them to the `File Structure` tree in the correct location
- One line per file with a short inline comment describing its role

## Done

After updating, briefly tell Doug:
- Which doc files changed and what was added/updated
- Any behavior or constraint that was non-obvious and worth remembering
