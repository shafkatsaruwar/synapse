# Synapse Web

Marketing site for Synapse Health Companion. It is not the Expo app. The app stays in `synapse-reset/`. Production at https://synapse-health.vercel.app builds this Next.js app (Vercel root directory `synapse-web`).

```bash
cd synapse-web
npm install
npm run dev
```

Open http://localhost:3000.

`npm run test:scene` checks the scroll choreography, including a two-panel subset and the five-panel scene. `npm run test:api` compares `app/api/send-email` with the root Vercel function `api/send-email.ts`.

## Email API

`POST /api/send-email` is the same route the iOS app calls on `https://synapse-health.vercel.app` (`synapse-reset/lib/api.ts`). The root file `api/send-email.ts` stays where it is so the current Vercel project can be rolled back. This Next route is what answers that path after the project root directory becomes `synapse-web`.

It expects the same server environment variables: `API_SHARED_SECRET`, `RESEND_API_KEY`, and optional `RESEND_FROM_EMAIL`. No other root `api/*` function exists. Document analysis, health insights, and medication comparison are Express routes in `server/routes.ts`; they are not Vercel functions in this repo.

Sign-up mail redirects to `/` and password-reset mail can redirect to `/reset-password`. Those pages tell the person to finish in the iPhone app. They do not set a password or store the token.

## Deploy

Git deploys use `synapse-web/vercel.json` (framework `nextjs`, `npm install`, `npm run build`). The repository root `vercel.json` no longer selects the Expo web export. That file was still applied on git deploys after the project root directory changed, and `cd synapse-reset && npm install` failed the build. The root `api/send-email.ts` file remains in the repo and is not part of this app; the live route is `app/api/send-email`.

Set `NEXT_PUBLIC_SITE_URL` to the production origin so canonical URLs match.

`?phase=INTRO` (or `SCATTERED`, `DISCONNECTION`, `RELEASE`, `FALL`, `STACK`, `ALIGN`, `MERGE`, `REVEAL`) holds the studio on that beat.

See `AUDIT.md` for what was verified, and `ASSET-SPEC.md` for the studio contract.
