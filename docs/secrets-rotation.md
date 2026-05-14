# Secrets — inventory & rotation

Tracks the live secrets that the Cambria stack depends on, where each one lives, when it was created, when it was last rotated, and the procedure to rotate. **Never put actual secret values in this file** — it tracks names and locations only.

> **Default rotation cadence:** every 90 days, OR immediately if a secret is suspected exposed (committed to a repo, pasted in a chat that another party can see, sent through an unencrypted channel, etc.). Always rotate one at a time and verify the dependent feature still works before moving on.

---

## Live secrets

| # | Name | Where it lives | Used by | Created | Last rotated | Recommended next rotation | Status |
|---|---|---|---|---|---|---|---|
| 1 | **Cloudflare API token** (no fixed name; created via dashboard "Edit Cloudflare Workers" template — token id `c881d89a1fc00952271ab603a93e5fe3`) | Not stored in the project. Passed to `wrangler` per-command via the `CLOUDFLARE_API_TOKEN` env var. | Wrangler deploys (`wrangler pages deploy`, `wrangler pages secret put`) | 2026-05-14 (Josh, via Cloudflare profile) | — | **By 2026-05-21** (was pasted in a chat transcript) | ⚠️ exposed in chat |
| 2 | **Anthropic API key** ("Cambria New") | Cloudflare Pages secret on the `cambria` project, under name `ANTHROPIC_API_KEY` | `marketing-site/functions/api/coverage-assistant.js` — the Coverage & SWO Requirements assistant | 2026-05-14 (Josh, via console.anthropic.com) | — | **By 2026-05-21** (was pasted in a chat transcript) | ⚠️ exposed in chat |
| 3 | **Resend API key** ("cambria-contact-form") | Cloudflare Pages secret on the `cambria` project, under name `RESEND_API_KEY` | `marketing-site/functions/api/contact.js` — the contact form | 2026-05-14 (Josh, via resend.com) | — | **By 2026-05-21** (was pasted in a chat transcript) | ⚠️ exposed in chat |

---

## Non-secret config (safe to commit / share, but listed for completeness)

| Name | Where | Value | Notes |
|---|---|---|---|
| `CONTACT_FROM` | Cloudflare Pages secret on `cambria` (set as a secret for convenience but not actually sensitive) | `noreply@petersonmedicalequipment.com` | The FROM address the contact form sends as. To change, `wrangler pages secret put CONTACT_FROM ...` and redeploy. |
| `CONTACT_TO` | Cloudflare Pages secret on `cambria` | `rx@petersonmedicalequipment.com` | Where contact-form messages are delivered. |
| `ASSISTANT_MODEL` | Not currently set (defaults to `claude-sonnet-4-6`) | — | Optional override. Set to `claude-haiku-4-5-20251001` to switch to the cheaper/faster model. |

---

## Rotation procedures

### 1. Cloudflare API token

1. **dash.cloudflare.com → My Profile → API Tokens** (https://dash.cloudflare.com/profile/api-tokens).
2. Find the existing token by id (`c881d89a...`) → **⋯** → **Delete**. Confirm.
3. Click **Create Token** → use **"Edit Cloudflare Workers"** template → defaults are fine → **Continue to summary** → **Create Token**.
4. Copy the new token immediately (only shown once).
5. Paste it to me in chat or save it in a password manager. To use, pass it inline to wrangler via `CLOUDFLARE_API_TOKEN=cfut_…`. Nothing in the repo references the token directly — no code changes needed.
6. **Verify:** `CLOUDFLARE_API_TOKEN=… wrangler pages project list` should show the `cambria` project.
7. **Update this file:** new token id, today's date in "Last rotated", new "Recommended next rotation" 90 days out.

### 2. Anthropic API key

1. **console.anthropic.com → Settings → API Keys**.
2. Find **"Cambria New"** → **Delete** (or rename old, doesn't matter — the goal is a new key).
3. **Create Key** → name it (e.g. `cambria-prod-2026-Q3`) → **Create**.
4. Copy the new `sk-ant-…` key (only shown once).
5. Set it as the Cloudflare secret: `printf '%s' "sk-ant-…" | CLOUDFLARE_API_TOKEN=… wrangler pages secret put ANTHROPIC_API_KEY --project-name cambria`
6. Redeploy so the new secret takes effect: `cd marketing-site && CLOUDFLARE_API_TOKEN=… wrangler pages deploy . --project-name cambria --branch main`
7. **Verify:** `curl -s -X POST https://petersonmedicalequipment.com/api/coverage-assistant -H "Content-Type: application/json" -d '{"question":"What does an SWO need?"}'` should return a real sourced answer (not an `error`).
8. **Update this file:** new key name, today's date in "Last rotated".

### 3. Resend API key

1. **resend.com → API Keys**.
2. Find **"cambria-contact-form"** → **Delete**.
3. **Create API Key** → name it (e.g. `cambria-contact-form-2026-Q3`), **Sending access**, restricted to the `petersonmedicalequipment.com` domain → **Create**.
4. Copy the new `re_…` key.
5. Set it as the Cloudflare secret: `printf '%s' "re_…" | CLOUDFLARE_API_TOKEN=… wrangler pages secret put RESEND_API_KEY --project-name cambria`
6. Redeploy: same as step 6 above.
7. **Verify:** submit a test message via `https://petersonmedicalequipment.com/contact.html` (or via curl to `/api/contact`); confirm it lands in `rx@`.
8. **Update this file:** new key name, today's date in "Last rotated".

---

## When (not just "every 90 days") to rotate

Rotate **immediately** if any of these happen:

- A secret was committed to a public or private git repo (even if reverted — assume it's leaked).
- A secret was pasted in a chat, ticket, or email that anyone outside Peterson could see.
- A laptop or workstation that had a secret saved was lost, stolen, or sold.
- A team member with access leaves the project.
- Cloudflare, Anthropic, or Resend notify you of a breach affecting your account.
- A vendor support agent asked you to share the secret with them (rotate it after, even if the vendor is legitimate).

---

## How rotation reminders are scheduled

A one-time Claude Code scheduled run is set up for ~7 days after the initial create-date (see Skill: `schedule`). When that fires, it will surface this file in chat and ask Josh to walk through procedures 1–3. Future quarterly reminders should be set after the first rotation completes — update this file and re-schedule.

---

## Change log for this file

| Date | What changed |
|---|---|
| 2026-05-14 | File created. All three live secrets logged as "exposed in chat" with a one-week rotation deadline. Reminder scheduled. |
