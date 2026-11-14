# Synapse Security Roadmap — Project Shield

Companion to `SECURITY_AUDIT.md`. **No remediations implemented yet** — this is the prioritized plan only.

**Legend**

- **Complexity:** S (hours) / M (days of focused work) / L (multi-area redesign)
- **Data-loss risk:** whether a botched change could erase user PHI or backups
- **Feature-break risk:** whether users may lose a working path (SIWA backup, AI, Plus, caregivers)

---

## P0 — Must fix / verify before release

| ID | Action | Complexity | Data-loss risk | Feature-break risk | Notes |
| --- | --- | --- | --- | --- | --- |
| SHIELD-005 | Authenticate caregiver Edge Functions **or** disable/delete them until fixed | S–M | Low | Caregiver push stops until fixed | Prefer JWT + link ownership check; staging test first |
| SHIELD-S1 | Operator verify production caregiver RLS matches lockdown SQL | S (ops) | **High if wrong RLS edit** | Caregiver sync | **Do not** change prod policies without backup + staging; audit-only verification first |
| SHIELD-006 | Replace client shared secret with verified user JWT for AI routes | M | Low | AI calls fail until clients ship | Keep temporary dual-auth only in staging |
| Claims | Align App Store / in-app privacy language with reality (no AES/HIPAA claims for AsyncStorage / SIWA jsonb) | S | None | Marketing only | Blocks trust/compliance review |
| SHIELD-004 (if marketed as secure) | Encrypt SIWA backups client-side **or** remove/feature-flag SIWA PHI upload | M–L | **High** (restore incompatibility) | SIWA restore | Migrate carefully; dual-read old plaintext once |

**P0 exit criteria**

- Staging: unauthenticated caregiver function invoke fails.  
- Production caregiver RLS confirmed lockdown **or** caregiver cloud features off.  
- AI endpoints reject requests without a valid user session (or AI feature flagged off).  
- Public copy does not claim encryption for unencrypted stores.

---

## P1 — High-priority fixes

| ID | Action | Complexity | Data-loss risk | Feature-break risk |
| --- | --- | --- | --- | --- |
| SHIELD-003 | Persist Supabase session in SecureStore | M | Low (session re-login) | Forced re-auth once |
| SHIELD-001 / messaging | Reduce AsyncStorage PHI exposure narrative + App Lock defaults; plan field-level encryption | L for crypto; S for UX | High if encrypt-migrate wrong | All local features |
| SHIELD-007 | Wire rate limits + server Zod + smaller body limits | S–M | None | Large AI payloads rejected |
| SHIELD-009 | Generic notification bodies by default; opt-in detail | S | None | Users miss med names until opt-in |
| SHIELD-010 | App Lock enabled flag in SecureStore | S | None | Lock stuck if SecureStore fails — need safe recovery |
| SHIELD-S4 | Reconcile EAS Supabase URL/anon with live project | S (ops) | None | Auth/backup until rebuild |
| Owner alerts (PR #102) | Deploy **only** after ASSN secrets + JWT gates reviewed | M | Low | Owner spam if misconfigured |
| SHIELD-014 | Triage runtime Critical/High deps; avoid force-major Expo upgrades blindly | M | Low | Build breaks |

---

## P2 — Planned improvements

| ID | Action | Complexity | Data-loss / break notes |
| --- | --- | --- | --- |
| SHIELD-002 | Quarantine / rename fake `encryption` & `secure-storage` modules | S | Breaks any stray callers — grep first |
| SHIELD-008 | Optional App Store Server API entitlement verification | M–L | Plus unlocks fail offline if over-strict |
| SHIELD-011 | CSPRNG for caregiver codes | S | None |
| SHIELD-012 | Clamp CloudKit scrypt params | S | Old malicious envelopes reject (good) |
| SHIELD-013 | Sync `SECURITY.md` with `cloudKitBackupEnabled: true` | S | Docs only |
| Widgets | Minimize App Group PHI; empty snapshot when App Lock on | M | Widget usefulness drops |
| MCP | Require `SYNAPSE_OWNER_USER_ID` (or disable MCP) in production | S | Breaks multi-tenant MCP if any |
| Logging | Audit `console.log` of health payloads in release builds | S | None |
| CloudKit Production | Confirm `UserData` record type + indexes live | S (ops) | Backup/restore failures if missing |

---

## P3 — Optional hardening

| Action | Complexity | Notes |
| --- | --- | --- |
| Certificate pinning for Supabase / API hosts | M | Breaks on cert rotation |
| Jailbreak / debugger detection (advisory only) | M | False positives |
| Hardware-backed DEK for all AsyncStorage PHI | L | Large migration; high data-loss risk |
| Formal threat model + annual third-party review | L | Process |
| Delete unused Replit integration routes from production builds | S | Confirm unused first |
| Push receipt / ASSN monitoring dashboards | M | Ops |

---

## Suggested sequence (after approval)

1. **Verify, don’t rewrite:** production RLS + Edge JWT settings (ops checklist).  
2. **Disable or gate** caregiver push functions if auth cannot be confirmed this week.  
3. **AI auth + rate limits** on server; ship client that sends user JWT.  
4. **Copy / Privacy** honesty pass.  
5. **Session → SecureStore** + **notification privacy defaults**.  
6. **SIWA backup encryption** design (separate PR; migration plan mandatory).  
7. **IAP server verify** only if revenue abuse matters.  
8. Dependency triage on a dedicated branch with full EAS smoke.

---

## Explicit non-goals (this roadmap)

- No automatic credential rotation.  
- No production Supabase policy edits without human approval + staging proof.  
- No rewrite of working SIWA / CloudKit / Care crypto systems in a single PR.  
- No StoreKit price or product-id changes for “security.”  
- No deploy of owner-alerts or Edge changes without explicit approval.  
- No `npm install` / lockfile churn without approval.

---

## Complexity & risk summary

| Priority | Approx. engineering scope | Highest risk change |
| --- | --- | --- |
| P0 | Mostly server/edge auth + ops verification + copy | Encrypting or removing SIWA jsonb; wrong RLS |
| P1 | Client storage + notifications + rate limits | Session migration; encrypting AsyncStorage |
| P2–P3 | Hardening and hygiene | Full-device PHI crypto; pinning |

---

## Next actions (awaiting your approval)

1. Review `SECURITY_AUDIT.md` findings SHIELD-001–014 and suspected SHIELD-S1–S6.  
2. Decide which P0 items to implement first (recommended: **SHIELD-005 verify/disable**, **SHIELD-S1 RLS confirm**, **SHIELD-006 AI JWT**, **privacy copy**).  
3. Approve a staging-only authorization test run with two throwaway accounts.  
4. Approve package installs only if a specific dependency fix is selected.  
5. Do **not** treat `npm audit` alone as a green light to ship.

*No code remediations have been applied as part of this audit.*
