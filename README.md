# MEDORA v0.1 — Upload Package

**Tagline:** Your life. Your goals. Your people.

This is the first working Medora frontend package. It is intentionally a **static, no-build website**, so it can be uploaded directly to a GitHub repository and served by GitHub Pages.

## What is already working

- Supabase email/password sign-up and sign-in
- First-time 3-step onboarding
- Medora personal profile
- Professional profile
- My Day dashboard
- Planner / tasks
- Goals with progress tracking
- Private circles
- Achievements / progress
- Mobile responsive navigation
- PWA manifest + basic service worker
- Live connection to the Medora Supabase backend

## Supabase connection

This package is already configured for:

- Project: `eoitruybmrgsrnbyioze`
- URL: `https://eoitruybmrgsrnbyioze.supabase.co`
- Client key: modern Supabase **publishable key**

The publishable key in `config.js` is intentionally safe for browser use.  
**Never put a `service_role`, secret key, database password, or private API token in this repository.**

## Upload to GitHub

1. Extract this ZIP.
2. Open the extracted `Medora_v0.1_upload_package` folder.
3. Upload **the contents of the folder** to the root of your Medora GitHub repository:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `config.js`
   - `manifest.webmanifest`
   - `service-worker.js`
   - `.nojekyll`
   - `assets/`
4. Commit the upload.
5. In GitHub: **Settings → Pages**.
6. Under **Build and deployment**, choose **Deploy from a branch**.
7. Select your main branch and `/ (root)`.
8. Save.

## Important Supabase Auth setting after you know the final website URL

In Supabase Dashboard:

**Authentication → URL Configuration**

Set:
- **Site URL** to your final Medora website URL.
- Add the same URL under **Redirect URLs**.

This is especially important if email confirmation or password recovery is enabled.

## First account test

1. Open the published website.
2. Choose **Create account**.
3. Enter name, email and password.
4. If email confirmation is enabled, confirm the email.
5. Sign in.
6. Complete the Medora onboarding flow.
7. Add:
   - one task,
   - one goal,
   - one achievement,
   - one private circle.

If all four save and remain after refresh, the frontend↔Supabase connection is working.

## Brand asset note

`assets/medora-mark.svg` is the clean vector mark used by this starter package, following the approved teal→purple Medora identity and heart/ECG motif. When the original final exported logo asset is available as a standalone SVG/PNG, it can replace this file without changing the application code.

## Version

Medora v0.1 — Auth + Onboarding + Core Dashboard
