# Deploying Synapse web to Vercel

If the web app shows a **blank white page** (e.g. at https://synapse-health.vercel.app), use the steps below.

## 1. Build the web bundle

From the **synapse-reset** folder:

```bash
cd synapse-reset
npm run export:web
```

This creates a static export in the **dist** folder.

## 2. Vercel project settings

- **Root Directory:** Set to `synapse-reset` (if the repo root is the project root).
- **Build Command:** `npm run export:web` or `npx expo export --platform web`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

## 3. Environment variables (optional)

For sign-in on the deployed site, add in Vercel → Settings → Environment Variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_URL` (e.g. `https://synapse-health.vercel.app`)

Then trigger a new deployment so the build uses them.

## 4. Local web (no deploy)

To run the app in the browser locally:

```bash
cd synapse-reset
npm run web
```

Then open http://localhost:8081 (or the URL shown in the terminal). If you see a blank page, open the browser dev tools (F12) → Console and check for red errors; those usually point to the cause.
