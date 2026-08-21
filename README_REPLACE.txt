MEDORA LIFE MIND — SAFE REPLACEMENT PACKAGE

Replace these 5 files in the ROOT of your elmedicohub/Medora repository:

1. planner-brain.js
2. life-mind.css
3. wall-integration.js
4. service-worker.js
5. planner-duration-patch.js

WHAT THIS RESTORES
------------------
- Full Medora Life Mind Planner
- Today / Plans / Explore / Shared
- Visible plan-length choices:
  1W / 1M / 3M / 6M / 1Y / Custom
- Gym, walking, languages, Quran, daily prayers, mosque/church,
  Sadaqah, Zakah, helping people, music, travel, custom plans
- Daily or selected days
- Due time
- Target and unit
- Done / Partly / Not done / congregation bonus
- Compliance calculation
- Private / Accountability / Together
- Shared-plan comparison
- Browser due-time reminders while Medora is open
- Planner page and subpage remembered after refresh

WHY THIS VERSION IS SAFER
-------------------------
The Life Mind module is loaded AFTER the normal Medora application has booted.
It never modifies the main app startup, auth startup, or app.js.
If Life Mind itself fails, the main Medora site still loads.

The Supabase Life Mind tables already exist and are reused.

AFTER UPLOADING
---------------
1. Replace all 5 files.
2. Wait 30-60 seconds for GitHub Pages.
3. Close every Medora tab.
4. Re-open https://elmedicohub.github.io/Medora/
5. Press Ctrl + Shift + R once.
6. Open Planner.
