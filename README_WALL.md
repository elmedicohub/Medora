# Motivea Wall — Recreated Replacement Package

This recreates the social **Wall** as an additive feature for the existing static/no-build Motivea/Medora frontend.

## Included files

- `wall.html` — Wall screen
- `wall.css` — responsive Wall styling
- `wall.js` — Supabase-powered feed, composer, filters, support reactions and comments
- `wall-config.js` — public Supabase browser configuration
- `supabase-wall-setup.sql` — backend tables + RLS policies
- `NAV_PATCH.txt` — small navigation link to add to the existing app

## Wall behavior

- For You / Connections / My Posts filters
- Post types:
  - Update
  - Goal progress
  - Achievement
  - Question / ask for help
- Visibility:
  - Motivea community
  - Connections
  - One private circle
  - Only me
- Optional link to one of the user's existing goals or achievements
- Support reaction
- Comments
- Own-post deletion
- Responsive mobile layout
- Existing private planner/schedule data is never auto-posted

## Install

1. Run `supabase-wall-setup.sql` once in the Supabase SQL Editor.
2. Upload `wall.html`, `wall.css`, `wall.js`, and `wall-config.js` to the same repository root as your existing `index.html`.
3. Add the Wall navigation link from `NAV_PATCH.txt` wherever you want it in the existing navigation.
4. Open `wall.html` while signed in.

The page uses the same Supabase project already connected to the app and a browser-safe publishable key. No service-role key is included.
