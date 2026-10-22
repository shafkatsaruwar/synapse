# Synapse Web

Marketing site for Synapse Health Companion. It is not the Expo app. The app stays in `synapse-reset/`. Production at https://synapse-health.vercel.app builds this Next.js app (Vercel root directory `synapse-web`).

```bash
cd synapse-web
npm install
npm run dev
```

Open http://localhost:3000.

`npm run test:scene` checks the scroll choreography, including a two-panel subset and the five-panel scene. `npm run test:api` runs auth-callback unit tests.

Sign-up mail redirects to `/` and password-reset mail can redirect to `/reset-password`. Those pages tell the person to finish in the iPhone app. They do not set a password or store the token. Auth email is handled by Supabase (optional custom SMTP), not by this site.

## Deploy

Git deploys use `synapse-web/vercel.json` (framework `nextjs`, `npm install`, `npm run build`). The repository root `vercel.json` no longer selects the Expo web export.

Set `NEXT_PUBLIC_SITE_URL` to the production origin so canonical URLs match.

`?phase=INTRO` (or `SCATTERED`, `DISCONNECTION`, `RELEASE`, `FALL`, `STACK`, `ALIGN`, `MERGE`, `REVEAL`) holds the studio on that beat.

See `AUDIT.md` for what was verified, and `ASSET-SPEC.md` for the studio contract.
