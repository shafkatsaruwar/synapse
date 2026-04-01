# Synapse Repo Guide

This repository now has one active Expo app and one archived legacy app.

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

## Archived Legacy App

The old root Expo app has been retired and archived here:

- [`legacy/root-expo-app/`](/Users/mohammed/Developer/Synapse/legacy/root-expo-app)

It should not be used for current mobile or web work.

## Important Note

`synapse-reset` is mostly self-contained for app code, but the repository still shares some root-level infrastructure such as:

- `.git`
- `eas.json`
- root docs
- root `.env` fallback used by [`synapse-reset/app.config.js`](/Users/mohammed/Developer/Synapse/synapse-reset/app.config.js)

Because of that, `synapse-reset` remains the only active app entrypoint, while the old root app stays archived for reference only.
