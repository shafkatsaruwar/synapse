# Synapse Web

Marketing site for Synapse Health Companion. It is not the Expo app. The app stays in `synapse-reset/`, and the production Vercel project that serves https://synapse-health.vercel.app should keep building that app.

```bash
cd synapse-web
npm install
npm run dev
```

Open http://localhost:3000.

`npm run test:scene` checks the scroll choreography, including a two-panel subset and the five-panel scene.

## Preview

This app is not wired to the production Vercel project. To preview it hosted, create a **new** Vercel project (do not change the existing one’s root, build, or domain) with:

- Root directory: `synapse-web`
- Framework: Next.js
- Set `NEXT_PUBLIC_SITE_URL` to that preview’s origin so canonical URLs and the sitemap match it.

`?phase=INTRO` (or `SCATTERED`, `DISCONNECTION`, `RELEASE`, `FALL`, `STACK`, `ALIGN`, `MERGE`, `REVEAL`) holds the studio on that beat.

See `AUDIT.md` for what was verified, and `ASSET-SPEC.md` for the studio contract.
