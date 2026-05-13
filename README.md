# Cambria

Website + (future) provider portal for **Peterson Medical Equipment** — a HIPAA-aligned DMEPOS supplier focused on spinal care across Washington and Oregon.

> **Read [`CLAUDE.md`](CLAUDE.md) first.** It is the single source of truth for business identifiers, the regulatory constants that must not drift, the architecture, what's built, and what's pending. The build journal is [`docs/build-log.md`](docs/build-log.md).

---

## What's in this repo

| Path | What |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Project context — read before touching anything. |
| [`marketing-site/`](marketing-site/) | The public website — a hand-built static site (no framework, no build step). Deploys to Cloudflare Pages. |
| [`docs/`](docs/) | Build log + design docs. |
| `portal/` | *(not yet created)* the Next.js 14 provider portal — see `CLAUDE.md` §5.2. |

### `marketing-site/` layout

```
marketing-site/
├─ index.html · about.html · providers.html · patients.html · insurance.html · contact.html
├─ products/  bone-stimulators.html · spinal-orthoses.html · surgical-dressings.html
├─ assets/
│  ├─ css/styles.css            single design-token stylesheet
│  ├─ js/main.js                nav, reveal-on-scroll, small UI behaviours
│  ├─ js/coverage-data.js       regulatory + product reference data (browser copy)
│  ├─ js/coverage-assistant.js  the "Coverage & SWO Requirements" widget front-end
│  └─ js/contact-form.js        contact form handler
│  └─ img/                      logo system, favicon, product/portal icons (SVG)
├─ functions/api/
│  ├─ coverage-assistant.js     Cloudflare Pages Function → calls the Anthropic API
│  └─ contact.js                Cloudflare Pages Function → contact form → email (stub until a provider is wired)
├─ _headers · _redirects · robots.txt · sitemap.xml
```

---

## Preview locally

It's plain static files plus Cloudflare Pages Functions. Two options:

**1. Just the pages (no Functions)** — open `marketing-site/index.html` in a browser, or serve the folder with any static server. The site works; the coverage assistant and contact form will show their "call/email us instead" fallback because the `/api/*` Functions aren't running.

```sh
# python (if installed)
cd marketing-site && python -m http.server 8080
# then visit http://localhost:8080
```

**2. With the Functions** — needs Node.js + Wrangler (Node is **not** currently installed on the dev machine; install Node LTS first):

```sh
npm i -g wrangler
cd marketing-site
# create a .dev.vars file (gitignored) with your secrets:
#   ANTHROPIC_API_KEY=sk-ant-...
#   ASSISTANT_MODEL=claude-sonnet-4-6        # optional
#   RESEND_API_KEY=...                       # optional, for the contact form
#   CONTACT_FROM=hello@yourverifieddomain    # optional
#   CONTACT_TO=rx@petersonmedicalequipment.com  # optional
wrangler pages dev .
```

---

## Deploy (Cloudflare Pages)

1. Create a Cloudflare Pages project, connected to this repo, with:
   - **Build command:** *(none)* — there is no build step.
   - **Build output directory:** `marketing-site`
2. Add the environment variables / secrets in the Pages project settings:
   - `ANTHROPIC_API_KEY` — **required** for the coverage assistant. Mark it as a secret.
   - `ASSISTANT_MODEL` — optional; defaults to `claude-sonnet-4-6`. Set to `claude-haiku-4-5-20251001` for a cheaper/faster (slightly thinner) assistant.
   - `RESEND_API_KEY`, `CONTACT_FROM`, `CONTACT_TO` — optional, to make the contact form actually send email (until then it accepts submissions and shows the thank-you, but doesn't deliver — see `docs/build-log.md`).
3. Add the custom domain `petersonmedicalequipment.com`. Cloudflare DNS + WAF + rate-limiting recommended (matches the planned stack in `CLAUDE.md` §5.2).
4. The `_headers` file sets the CSP, HSTS, and other security headers. The `_redirects` file normalises `/index.html` → `/`.

**Nothing in this repo is PHI.** The public site never collects patient data; the Functions log nothing sensitive; `.gitignore` blocks the obvious PHI-shaped paths. Keep it that way.

---

## Conventions

See `CLAUDE.md` §11. Short version for the marketing site: plain HTML5, one shared header/footer pattern copied across pages, design tokens in `:root`, vanilla JS with progressive enhancement, no PHI anywhere, and every coverage claim the assistant makes must cite an LCD or CFR section.
