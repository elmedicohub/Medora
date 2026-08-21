MEDORA RECOVERY REPLACEMENT PACKAGE

Replace these four files in the ROOT of elmedicohub/Medora:

1. wall-integration.js
2. service-worker.js
3. planner-brain.js
4. planner-duration-patch.js

This recovery build:
- restores the normal Medora core app,
- keeps Wall integrated,
- temporarily restores the original stable Planner,
- disables the Life Mind injection that caused the loading failure,
- deletes old Medora PWA caches,
- uses network-first loading to prevent stale broken JavaScript.

After replacing:
1. Wait 30-60 seconds for GitHub Pages.
2. Close every Medora tab.
3. Open https://elmedicohub.github.io/Medora/
4. Press Ctrl + Shift + R once.

Do NOT delete your Supabase Life Mind tables. They can remain safely.
