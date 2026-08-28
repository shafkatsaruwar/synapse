# Synapse MCP (personal health assistant)

Read-only [Model Context Protocol](https://modelcontextprotocol.io) connector so a Cursor / Grok assistant can query **the signed-in owner's** Synapse health data. Unauthenticated reads are rejected. Request bodies and health fields are never logged.

## What the current app actually stores

Synapse is **local-first**. The live product in `synapse-reset` keeps medications, check-ins, symptoms, appointments, vitals, labs, and recovery data on-device (AsyncStorage). Device backup is **iCloud / CloudKit**, which a remote assistant cannot read.

The remotely readable copy this MCP uses is the existing Supabase `user_backups` JSON blob (row-level security: `auth.uid() = user_id`), plus the `appointments` table when present. That path already existed as `synapse-reset/lib/backup.ts`; Account → **Assistant access** now syncs it when you are signed in.

A later “remove accounts / Supabase” change made the app usable fully offline. Supabase is still in the repo for optional sign-in, caregiver linking, and this backup table. This connector does **not** assume Postgres/Drizzle (`shared/schema.ts` is unused for health records).

## Tools (read-only)

| Tool | Purpose |
| --- | --- |
| `get_health_profile` | Name, conditions, allergy notes, sick/recovery flags |
| `get_health_summary` | Recent check-ins, symptoms, adherence, next appointments |
| `list_recent_symptoms` | Symptom logs, optional date range |
| `list_medications` | Meds + dose-log adherence |
| `list_upcoming_appointments` | Future non-cancelled visits |
| `list_recent_checkins` | Daily energy / mood / sleep logs |
| `list_recent_vitals` | Manual + Apple Health vitals |
| `list_recovery_status` | Sick mode, hydration, eating, averages |
| `list_lab_work` | Imported / logged labs |
| `query_health_data` | Dated query across chosen collections |

Writes are not exposed. Logging a symptom from chat would race the JSON backup blob and is not a natural existing API.

## 1. Put a copy of your data where MCP can read it

**Option A — cloud backup (needed for a remote HTTPS connector / Cloud Agent)**

1. Sign in on the app (Account → Assistant access → Sign in).
2. Tap **Sync now**. This upserts `user_backups` for your user id only.
3. Leave the app signed in so auto-sync can refresh after local edits.

**Option B — local export (stdio only)**

Privacy & Data → Export All Data, save the JSON, then set `SYNAPSE_BACKUP_JSON` to that file.

## 2. Run the MCP server

From the repo root, with Node 18+:

```bash
npm install
# HTTPS (same Express process as the existing backend)
SYNAPSE_MCP_TOKEN="replace-with-a-long-random-secret" npm run server:dev
```

Health check (no PHI): `GET http://localhost:5000/mcp/health`  
MCP endpoint: `POST http://localhost:5000/mcp`

Production: run `npm run server:prod` on any host that already runs Express (`PORT`, default 5000), then use `https://<your-host>/mcp`.

## 3. Add it in Cursor (custom MCP connector)

### Remote HTTPS (preferred for Cloud Agents / Grok Bot)

Cursor Settings → Tools & MCP → add a custom server, **or** put this in `~/.cursor/mcp.json` / project `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "synapse-health": {
      "url": "http://localhost:5000/mcp",
      "headers": {
        "Authorization": "Bearer ${env:SYNAPSE_MCP_TOKEN}"
      }
    }
  }
}
```

Replace the URL with your deployed Express origin, for example `https://YOUR_EXPRESS_HOST/mcp`. The web static app at `https://synapse-health.vercel.app` does **not** host this endpoint unless you also run the Express server.

Set `SYNAPSE_MCP_TOKEN` in your shell / Cursor env to the same value the server uses. Never commit the token.

### Local stdio

```json
{
  "mcpServers": {
    "synapse-health": {
      "command": "npx",
      "args": ["tsx", "mcp/stdio.ts"],
      "env": {
        "SYNAPSE_MCP_TOKEN": "${env:SYNAPSE_MCP_TOKEN}",
        "SYNAPSE_BACKUP_JSON": "${env:SYNAPSE_BACKUP_JSON}"
      }
    }
  }
}
```

Run the command from the repo root (or pass absolute paths in `args`). Equivalent script: `npm run mcp`.

## Auth and secrets

Always fail closed. No token → no data.

| Variable | Where | Purpose |
| --- | --- | --- |
| `SYNAPSE_MCP_TOKEN` | Server env **and** Cursor `headers` / stdio `env` | Long-lived personal token. Generate with `openssl rand -hex 32`. |
| `SYNAPSE_SUPABASE_URL` or `SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_URL` | Server | Existing Supabase project URL |
| `SYNAPSE_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Server | Anon key (RLS still applies when using a user JWT) |
| `SYNAPSE_OWNER_ACCESS_TOKEN` or `SYNAPSE_ACCESS_TOKEN` | Server (optional) | Your Supabase user access token, used only after the MCP token matches |
| `SYNAPSE_OWNER_USER_ID` | Server (optional) | Required if using the service role; queries are always `eq("user_id", this id)` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server (optional, high privilege) | Only to read **that** owner's `user_backups` row. Prefer a user JWT instead. |
| `SYNAPSE_BACKUP_JSON` | Server / stdio (optional) | Path to a Privacy export JSON. Stdio still requires `SYNAPSE_MCP_TOKEN`. |

HTTP requests send the token as:

- `Authorization: Bearer <SYNAPSE_MCP_TOKEN>` (preferred), or
- `X-Synapse-MCP-Token: <SYNAPSE_MCP_TOKEN>`

If `SYNAPSE_MCP_TOKEN` is unset, the bearer value is treated as a **Supabase user JWT**. The server calls `auth.getUser`, then reads `user_backups` as that user so RLS cannot return another person's row.

Headers accepted for JWT-only mode: `Authorization: Bearer <access_token>`.

## Security notes

- Owner-only: MCP token mode loads only the configured owner's snapshot; JWT mode loads `auth.uid()`'s row.
- Service role, if used, is always filtered by `SYNAPSE_OWNER_USER_ID`. Do not omit that id.
- Image URIs, document URIs, and emails are stripped before tool output.
- Express request logs for `/api` and `/mcp` record method, path, and status only.
- This is a personal consumer app, not a HIPAA product. See `synapse-reset/SECURITY.md`.

## Verify locally

```bash
npx tsx mcp/query.test.ts

export SYNAPSE_MCP_TOKEN="test-token"
export SYNAPSE_BACKUP_JSON="$PWD/mcp/fixtures/sample-backup.json"
npm run server:dev
```

In another terminal:

```bash
curl -s http://localhost:5000/mcp/health

curl -s http://localhost:5000/mcp \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'

curl -s http://localhost:5000/mcp \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

A request with no `Authorization` header must return **401**.
