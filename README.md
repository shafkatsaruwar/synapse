# Synapse Repo Guide

This repository currently contains two Expo apps.

## Active Mobile App

The active mobile app is:

- [`synapse-reset/`](/Users/mohammed/Developer/Synapse/synapse-reset)

This is the app that recent mobile feature work has been landing in, and it should be treated as the current source of truth for the mobile product.

Key app entrypoints:

- [`synapse-reset/app/`](/Users/mohammed/Developer/Synapse/synapse-reset/app)
- [`synapse-reset/screens/`](/Users/mohammed/Developer/Synapse/synapse-reset/screens)
- [`synapse-reset/components/`](/Users/mohammed/Developer/Synapse/synapse-reset/components)
- [`synapse-reset/lib/`](/Users/mohammed/Developer/Synapse/synapse-reset/lib)

Run it with:

```bash
cd synapse-reset
npm install
npm run ios
```

Or:

```bash
cd synapse-reset
npm start
```

## Legacy Root App

The repo root also contains an older Expo app:

- [`app/`](/Users/mohammed/Developer/Synapse/app)
- [`screens/`](/Users/mohammed/Developer/Synapse/screens)
- [`components/`](/Users/mohammed/Developer/Synapse/components)
- [`lib/`](/Users/mohammed/Developer/Synapse/lib)

That root app appears to be an older/original app variant and should not be assumed to be the active mobile app unless you intentionally mean to work on it.

## Important Note

`synapse-reset` is mostly self-contained for app code, but the repository still shares some root-level infrastructure such as:

- `.git`
- `eas.json`
- root docs
- root `.env` fallback used by [`synapse-reset/app.config.js`](/Users/mohammed/Developer/Synapse/synapse-reset/app.config.js)

Because of that, do not delete or move either app folder casually. Prefer clarifying documentation first, then doing a planned consolidation later.
