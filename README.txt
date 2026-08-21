MEDORA GOALS REDESIGN — REPLACEMENT PACKAGE

Replace / add these files:
1. goals.html
2. assets/css/goals-redesign.css
3. assets/js/goals-redesign.js

What changed:
- One compact Goals header (no duplicate hero/title).
- + New Goal opens a modal instead of occupying permanent page space.
- Summary: Active / On track / Due soon / Overall progress.
- Active, This week, Completed, Paused/Archived views.
- Structured life-domain categories only.
- Milestones per goal.
- "Break this goal down" helper.
- Weekly commitment.
- Goal progress based on completed milestones.
- Next milestone shown on every goal card.
- Weekly actions automatically collected from active goals.
- Search + category filtering.
- Responsive desktop/mobile design.

Storage:
This version uses localStorage key `medora_goals_v2` so it can be dropped in
without requiring a database migration. When your Supabase goal table is ready,
the storage functions in goals-redesign.js can be swapped to Supabase without
changing the UI.

Important:
If your existing filenames differ, you can rename goals.html or copy its
<main> section into your existing Goals page.
