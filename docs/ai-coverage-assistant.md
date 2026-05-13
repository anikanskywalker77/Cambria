# AI feature — the "Coverage & SWO Requirements" assistant

A provider-facing assistant on the marketing site. A referring clinician (or their staff) types a general question about ordering / documentation requirements — by HCPCS code or product — and gets a short answer drawn from the governing LCDs and federal rules, with each claim cited. It is **not** a coverage determination and **not** for patient data.

- Front-end widget: [`marketing-site/assets/js/coverage-assistant.js`](../marketing-site/assets/js/coverage-assistant.js), styled by `.assistant` in `styles.css`, embedded on Home, For Providers, and Insurance & Coverage.
- Backend: [`marketing-site/functions/api/coverage-assistant.js`](../marketing-site/functions/api/coverage-assistant.js) — a Cloudflare Pages Function that calls the Anthropic Messages API.
- Reference data (browser copy): [`marketing-site/assets/js/coverage-data.js`](../marketing-site/assets/js/coverage-data.js).

---

## 1. Why this, and why now

It's the highest-value, lowest-risk AI feature in scope:

- **Useful to the actual audience.** Referring offices routinely ask "what does the SWO for E0748 need?", "does L0651 need a PA now?", "which Trend braces need a WOPD?". Those are answerable from a small, stable knowledge base — exactly the §3 regulatory constants and §2 product data.
- **No PHI.** The questions are general (codes, product names, requirements). The widget refuses obviously-PHI input client-side, and the server refuses it again.
- **Grounded.** The entire knowledge base is in the system prompt; the model isn't asked to recall regulations from training, and citation codes/URLs come from our map, not the model.
- **Cheap.** Short prompts, short answers; single API call per question; no tool loop.

The *portal's* AI feature — parsing an uploaded patient roster into validated draft SWOs — is a different shape (multi-step, per-row validation, structured output) and is a good fit for the **Claude Agent SDK**. That's deferred to the portal phase. This one is deliberately **direct Anthropic API**: it's single-shot Q&A, so the Agent SDK would be overkill.

---

## 2. Scope

**In scope** (the model is told to answer only from the knowledge base):
- the six required elements of a Standard Written Order (CMS Article A55426);
- the face-to-face encounter requirement and its 6-month window (42 CFR 410.38);
- Written Order Prior to Delivery (WOPD) requirements;
- prior-authorization status and effective dates for the HCPCS codes Peterson carries (E0748; L0457/L0464/L0648/L0650/L0651; A6010–A6204);
- the product lines, their governing LCDs (L33796 / L33790 / L33831), and the manufacturers/products in each;
- how to place an order with Peterson.

**Out of scope** → the model says so briefly and points to `509-783-7501`:
- general clinical advice; coding for items Peterson doesn't carry; billing rates/amounts; anything patient-specific; anything not in the knowledge base.

**Hard rules** (in the system prompt, and partly enforced in code):
1. Never state/imply an item "will be covered" or "is approved" — only requirements and documentation.
2. If the input looks like patient PHI, refuse — return `{refused:true,message:...}`. The Function also pattern-checks for PHI before the call and after.
3. Every regulatory/coverage claim must carry a citation from the knowledge base (LCD number, CFR cite, CMS article, Federal Register cite).
4. Keep it tight — 2–6 sentences or a short bulleted list; plain text; no markdown headings/links.

---

## 3. Knowledge base

Two copies, both mirroring `CLAUDE.md` §2/§3 (which is the source of truth):
- `marketing-site/functions/api/coverage-assistant.js` → `COVERAGE` (server-side, authoritative for the model) and `CITE_URLS` (code → URL map).
- `marketing-site/assets/js/coverage-data.js` → `window.PME_COVERAGE` (browser, for chips and potential client-side quick facts).

**When a regulatory fact changes** (e.g. a new code added to the prior-auth list), update `CLAUDE.md` §3, then both files above, then add a row to `docs/build-log.md`. The L0651 prior-auth effective date (`2026-04-13`) is the most recent such change and is encoded in all three.

---

## 4. Request / response contract

`POST /api/coverage-assistant`
Request body: `{ "question": "<= 600 chars" }`

Responses (`200` unless noted):
- Success: `{ "answer": "<plain text>", "citations": [{ "code": "L33790", "label": "...", "url": "https://..." }, ...], "disclaimer": "<fixed string>" }`
- PHI refusal: `{ "refused": true, "message": "<polite redirect with the phone number>" }`
- Validation errors: `{ "error": "..." }` with `400` (bad/empty), `413` (too long).
- Service errors: `{ "error": "..." }` with `503` (no API key configured), `502` (Anthropic unreachable / errored / bad shape). Provider error bodies are never forwarded to the client.

The widget renders `answer` as text nodes (never `innerHTML`), shows `citations` as a list with `<code>` + label + a "source" link when a URL is known, and shows `disclaimer` verbatim. On any non-success or network failure it shows: *"This assistant isn't available right now — call 509-783-7501 or email rx@petersonmedicalequipment.com…"*.

### Model call details
- Endpoint: `https://api.anthropic.com/v1/messages`, headers `x-api-key`, `anthropic-version: 2023-06-01`.
- `model`: `env.ASSISTANT_MODEL || "claude-sonnet-4-6"`.
- `max_tokens: 1024`, `temperature: 0.2`.
- `system`: instructions + the JSON knowledge base + today's date (so the model can say whether a dated rule is currently in effect).
- `messages`: `[ { role:"user", content: <question> }, { role:"assistant", content:"{" } ]` — the assistant turn is prefilled with `{` to force a JSON object; the Function prepends `{` when parsing and tolerates trailing prose.

---

## 5. Deployment & secrets

Cloudflare Pages env vars (Pages → Settings → Environment variables):
- `ANTHROPIC_API_KEY` — **required**. Mark as a Secret. Without it the endpoint returns `503` and the widget shows the call/email fallback.
- `ASSISTANT_MODEL` — optional. Default `claude-sonnet-4-6`. Set to `claude-haiku-4-5-20251001` for a cheaper, faster, slightly thinner assistant.

Never commit keys. Local testing uses a gitignored `marketing-site/.dev.vars` with `wrangler pages dev .` (needs Node + Wrangler — Node isn't installed on the dev machine yet).

---

## 6. Cost & abuse notes

- Each question is one Messages API call. The system prompt is a few thousand tokens (mostly the static knowledge base) and answers are short, so cost per question is small. If volume grows, consider Anthropic **prompt caching** on the system block — the knowledge base is identical across requests, so it caches well; this would cut cost and latency. (Not implemented yet — a worthwhile follow-up.)
- Abuse / rate limiting: there's a 600-char input cap and a 25s client timeout, but no per-IP rate limit in the Function (no KV binding wired). Add a Cloudflare rate-limiting rule on `/api/coverage-assistant` (e.g. N requests / IP / minute) before launch. Bot traffic to `/api/*` is also covered by Cloudflare's WAF/bot management if enabled.
- Logging: the Function logs nothing about the request body. Keep it that way — even though no PHI should reach it, don't log questions.

---

## 7. Open questions for Josh

- **Gating:** the assistant is currently open (anyone can use it) with PHI guardrails. Do you want it gated behind a provider email or a simple form? Currently open is the recommendation — it's reference info, and gating adds friction for the exact people you want using it.
- **Model:** default is `claude-sonnet-4-6`. If answers feel over-built for the audience (or you want to cut cost), switch `ASSISTANT_MODEL` to `claude-haiku-4-5-20251001` — no redeploy needed, just the env var. If answers ever feel too thin, Sonnet is already the default; Opus would be overkill for this.
- **Prompt caching:** worth adding for cost/latency once the feature is live and we see real traffic.
- **Scope creep:** if you later want it to also field "is this patient covered?" style questions, that's a different system — it would need real eligibility/medical-record data and a BAA-covered model deployment. Out of scope for the public site by design.

---

## 8. Future work

- Add Anthropic prompt caching on the system block.
- Add a Cloudflare rate-limiting rule on `/api/*`.
- When the portal is built, the *portal* gets the Agent-SDK roster parser (different feature — see `CLAUDE.md` §5.2 and §6); consider whether the portal should expose an internal MCP server over order data for an admin assistant. None of that affects this marketing-site assistant.
- Consider a small set of canned answers / a static FAQ rendered from `coverage-data.js` for the JS-disabled and offline case (currently it just points to phone/email).
