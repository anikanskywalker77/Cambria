# Cambria — Build Log

Append-only. Newest entry at the top. Every meaningful change gets an entry: what, why, and anything the next person needs to know. Dates are ISO (`YYYY-MM-DD`).

---

## 2026-05-12 — Project bootstrap + marketing site v1

**Context.** Josh asked to start coding the Peterson Medical Equipment website from the Cambria context doc (pulled from Google Drive, file ID `1GZa0zHyVsEcy65qkamueQXle48X3g9Ca`). Decisions reached at kickoff:

- **Build order:** marketing site first. The provider portal is blocked by 7 open decisions (§7.3 of `CLAUDE.md`); the marketing site has zero such dependencies and zero PHI.
- **Repo location:** `C:\Users\tchom\cambria\`, `git init`'d. Not yet committed (waiting on Josh's go-ahead to make the first commit / push).
- **HIPAA / dev environment:** the repo and dev machine do **not** need to be a "HIPAA environment." Source code isn't PHI. HIPAA obligations attach to production hosting + runtime data. Rule encoded in `.gitignore` and `CLAUDE.md` §12: never commit real patient data; synthetic only; production infra needs BAAs.
- **Marketing-site tech:** the context doc specs WordPress + WP Engine. Changed to a **hand-built static site** (semantic HTML5 + one CSS design-token file + minimal vanilla JS), deployed to **Cloudflare Pages**. Reasons: (1) Node.js is not installed on the dev machine — no `node`/`npm`/`npx` on PATH — so a Next.js build chain wasn't available; (2) "least friction" was Josh's explicit goal; (3) a 9-page marketing site genuinely doesn't need a framework; (4) Cloudflare is already the planned DNS/WAF vendor (§5.2), so Pages is a natural fit and gives us serverless Functions for the contact form + AI assistant without standing up separate infra. Migrating to Next.js later (when the portal phase brings Node in) is a reasonable option but not required.
- **AI feature:** added a provider-facing **"Coverage & SWO Requirements" assistant**. It answers "what does an SWO for E0748 need? does L0651 need a PA? what's the F2F window?" — grounded in the §3 regulatory constants and §2 product portfolio. Implemented as a Cloudflare Pages Function (`functions/api/coverage-assistant.js`) calling the **Anthropic API directly** (not the Agent SDK — it's single-shot Q&A, no tool loop needed). Hard constraints: refuses PHI input, pins every coverage claim to an LCD/CFR cite, always disclaims "not a coverage guarantee." The Excel-roster parser (the *portal's* AI feature) is a better fit for the Agent SDK and is deferred to the portal phase. See `docs/ai-coverage-assistant.md`.
- **Existing assets:** the `/outputs` deliverables referenced in the context doc §7.1 (website copy, brand sheet, SWO PDFs, portal spec) were **not** in Josh's Drive — only a `Logo` folder with two raw AI-concept images and an old Google Sites site. So the site was built fresh from the brand system in §4 (colors, fonts, voice, "curved-P spinal-vertebra" logo direction) and the 9-page list in §7.1. The logo mark was drawn from scratch as an SVG matching the "curved-P built from stacked vertebra segments" description.

**What got built.**

| Path | What |
|---|---|
| `CLAUDE.md` | The Cambria context doc, cleaned and synced into the repo; §5.1/§7/§14 updated to reflect as-built reality. |
| `.gitignore` | Standard ignores + an explicit PHI-safeguard block. |
| `README.md` | Repo intro: what this is, how to preview the site locally, how to deploy to Cloudflare Pages, where the docs are. |
| `docs/build-log.md` | This file. |
| `docs/marketing-site.md` | Marketing site design doc: IA / sitemap, page-by-page content outline, design system summary, accessibility + performance notes, deploy runbook. |
| `docs/ai-coverage-assistant.md` | AI feature design doc: purpose, scope, prompt design, the no-PHI guardrail, citation requirement, the regulatory knowledge base, request/response contract, deployment + secrets, cost notes, future work. |
| `marketing-site/assets/css/styles.css` | Single CSS file. `:root` design tokens (the §4 palette + a type scale + spacing scale), base/reset, layout primitives (`.container`, `.section`, `.grid`), components (buttons, cards, nav, hero, footer, the assistant widget), utilities, responsive breakpoints, `prefers-reduced-motion` handling. |
| `marketing-site/assets/img/logo-mark.svg` | The curved-P / stacked-vertebra mark. Navy with one teal accent segment. |
| `marketing-site/assets/img/logo-primary.svg` | Horizontal lockup: mark + "Peterson Medical Equipment" wordmark in Poppins. |
| `marketing-site/assets/img/logo-footer.svg` | White/reversed lockup for the dark footer. |
| `marketing-site/assets/img/favicon.svg` | Simplified mark for the browser tab. |
| `marketing-site/assets/img/icon-bone-stim.svg`, `icon-orthosis.svg`, `icon-dressing.svg`, `icon-portal.svg` | Line-style product/portal icons. |
| `marketing-site/index.html` | Home: hero, the value prop (replace fax-back SWOs), three product cards, "built for referring providers" section, the coverage-assistant CTA, trust/compliance strip, contact CTA. |
| `marketing-site/about.html` | About: company, mission, where we operate (WA/OR), compliance posture, the people / contact. |
| `marketing-site/providers.html` | For Providers: how ordering works today vs. with the portal, the SWO requirements primer (links to the assistant), the Excel-roster preview, "become a referring provider" CTA. |
| `marketing-site/patients.html` | For Patients: what we supply, what to expect, insurance basics, how to reach us — reassuring tone, no jargon dumping. |
| `marketing-site/insurance.html` | Insurance & coverage: Medicare/Medicaid, the SWO + F2F + WOPD requirements explained plainly, PA notes per product line, "we handle the paperwork" framing. |
| `marketing-site/contact.html` | Contact: address/phone/fax, the non-PHI contact form, hours, a "for urgent order questions, call" note, map embed placeholder. |
| `marketing-site/products/bone-stimulators.html` | E0748 — what it is, who it's for, the manufacturers carried, LCD L33796, no-PA note, how to order. |
| `marketing-site/products/spinal-orthoses.html` | The Trend line L0457–L0651 — the full HCPCS table, which need PA (incl. the 2026-04-13 L0651 change), WOPD note, LCD L33790, how to order. |
| `marketing-site/products/surgical-dressings.html` | The Vitalé line A6010–A6204 — the product table, LCD L33831, how to order, note on sourcing other dressings. |
| `marketing-site/assets/js/main.js` | Mobile nav toggle, current-year in footer, smooth in-page scroll, small reveal-on-scroll, sets `aria-current` on the active nav link. |
| `marketing-site/assets/js/coverage-data.js` | Machine-readable mirror of §2 (product portfolio) + §3 (regulatory constants). Exported so the front-end assistant can show quick facts without a round-trip. The Function has its own server-side copy (do not trust the client's). |
| `marketing-site/assets/js/coverage-assistant.js` | The assistant widget front-end: opens a panel, posts the question to `/api/coverage-assistant`, renders the answer + citations, blocks obvious PHI-looking input client-side before sending, degrades to "call/email us" if the Function is unreachable. |
| `marketing-site/functions/api/coverage-assistant.js` | Cloudflare Pages Function. Validates input, refuses PHI (before and after the call), builds the system prompt from the embedded regulatory KB + today's date, calls the Anthropic Messages API (model = `env.ASSISTANT_MODEL || "claude-sonnet-4-6"`; `temperature: 0.2`; assistant-turn prefilled with `{` to force JSON), maps citation codes → URLs from a fixed table, returns `{ answer, citations, disclaimer }` or `{ refused, message }`. Needs the `ANTHROPIC_API_KEY` env var (set as a Cloudflare secret, never committed). |
| `marketing-site/functions/api/contact.js` | Cloudflare Pages Function for the contact form. Validates + rate-limits, then **stub**: currently just logs receipt and returns success. TODO: wire to Postmark / Resend / MailChannels to actually deliver to `rx@` (kept non-PHI on purpose). |
| `marketing-site/_headers` | Cloudflare Pages headers: a strict-ish CSP (allows the Google Fonts origins + `self` + the Anthropic call is server-side so no client CSP entry needed for it), HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. |
| `marketing-site/_redirects` | `/index.html` → `/`, trailing-slash normalization, and a couple of friendly aliases (`/providers` etc. already resolve since files are at that path; mostly future-proofing). |
| `marketing-site/robots.txt`, `marketing-site/sitemap.xml` | Standard. Sitemap lists all 9 pages. |

**Known gaps / next steps** (also tracked in `CLAUDE.md` §7.2):
- `functions/api/contact.js` doesn't send email yet — needs an email provider.
- No analytics snippet yet (Plausible planned).
- Imagery is brand illustration + placeholders; needs real photos/headshots when available.
- Static-site Functions weren't run locally (no Node → no `wrangler`). To test before deploy: install Node LTS, `npm i -g wrangler`, `cd marketing-site`, set `ANTHROPIC_API_KEY` in a `.dev.vars` file, `wrangler pages dev .` — then exercise `/api/coverage-assistant`.
- Initial commit made (`chore: bootstrap Cambria repo + marketing site v1`, root commit `6dda44a`, 34 files). Author identity was passed per-invocation (Josh Marquardt / jmarquardt@petersonmedicalequipment.com) — no git config was written; run `git config user.email ...` locally if you want it persistent.
- Branch renamed `master` → `main`. Remote `origin` = `https://github.com/anikanskywalker77/Cambria.git` (private GitHub repo); pushed `main`. Cloudflare Pages can now "import an existing Git repository" → pick `anikanskywalker77/Cambria` → Build output directory `marketing-site`, Build command blank → then add the `ANTHROPIC_API_KEY` secret in Pages settings.
- Consider adding a `.gitattributes` (`* text=auto eol=lf`) to stop the LF↔CRLF churn warnings on Windows.

**Open questions raised for Josh** (see also `docs/ai-coverage-assistant.md` §7): the assistant defaults to `claude-sonnet-4-6`; set the `ASSISTANT_MODEL` env var to `claude-haiku-4-5-20251001` for a cheaper/faster variant (no redeploy). Is the assistant gated (provider email required) or open? Currently open, with PHI guardrails. Should we add Anthropic prompt caching on the static system block and a Cloudflare rate-limit rule on `/api/*` before launch? Recommended yes.

---

<!-- New entries go ABOVE this line, under a new "## YYYY-MM-DD — title" heading. -->
