# Marketing site — design, IA & deploy

The public website for Peterson Medical Equipment. Hand-built static site (HTML + one CSS file + a little vanilla JS), plus two Cloudflare Pages Functions. Lives in [`/marketing-site`](../marketing-site/). Deploys to Cloudflare Pages.

See also: [`CLAUDE.md`](../CLAUDE.md) (§4 brand, §5.1 architecture), [`docs/ai-coverage-assistant.md`](ai-coverage-assistant.md) (the AI feature), [`docs/build-log.md`](build-log.md).

---

## 1. Why static (and not WordPress / Next.js)

The original context doc specced WordPress + WP Engine. We changed course:

- **No Node on the dev machine.** A Next.js build chain wasn't available, and "least friction" was the explicit goal.
- **A 9-page marketing site doesn't need a framework.** Plain HTML keeps it trivially previewable (open a file), trivially deployable (upload a folder), and dependency-free.
- **Cloudflare Pages is already the planned vendor.** DNS/WAF were going to be Cloudflare anyway (`CLAUDE.md` §5.2). Pages gives us serverless Functions for the contact form and the AI assistant without standing up extra infra.
- **Zero PHI.** Nothing on the public site touches patient data, so HIPAA hosting (WP Engine, BAAs) isn't required here. That changes for the portal, not for this.

If a CMS becomes desirable later, or when the portal phase brings Node into the toolchain, migrating the marketing site to Next.js (App Router, static export) is a clean option — but it isn't needed.

---

## 2. Information architecture

Nine pages (matches the original §7.1 list). Navigation: a **Products** dropdown (the 3 product pages), then **For Providers**, **For Patients**, **Insurance & Coverage**, **About**, and a **Contact** button. The logo is Home.

```
/                              Home — hero, value prop (replace fax-back SWOs), 3 product cards,
                                      "built for providers", the coverage-assistant widget,
                                      a compliance strip (A55426 / 42 CFR 410.38 / 424.57), CTA band
/about.html                    About — company identity, mission, narrow-catalog rationale, "at a glance" card
/providers.html                For Providers — how ordering works today (3 steps), the SWO 6-element primer,
                                      "coming: the portal" incl. roster upload, an embedded assistant widget, CTA
/patients.html                 For Patients — reassuring, plain language: what to expect (4 steps), what we supply,
                                      insurance basics, a short FAQ, "call us, don't web-form patient details"
/insurance.html                Insurance & Coverage — the 4 building blocks (SWO, F2F, WOPD, prior auth),
                                      a prior-auth-by-product-line table, "what we do about it", an embedded assistant
/contact.html                  Contact — phone/fax/email/address, the non-PHI inquiry form, map placeholder,
                                      a privacy note (don't put PHI in the form)
/products/bone-stimulators.html   E0748 — what it is, quick facts, manufacturers carried, how to order. No PA, no WOPD.
/products/spinal-orthoses.html    L0457–L0651 (Trend line) — full HCPCS table with PA/WOPD flags incl. the
                                      L0651 2026-04-13 PA change, how to order. LCD L33790.
/products/surgical-dressings.html A6010–A6204 (Vitalé line) — product/code/size table, "other categories on
                                      request", how to order. LCD L33831. No PA, no WOPD.
```

The coverage-assistant widget appears on **Home** (full), **For Providers**, and **Insurance & Coverage** (compact). Product pages link to it rather than embedding it.

---

## 3. Design system

Tokens live in `:root` in `marketing-site/assets/css/styles.css`. Pulled straight from `CLAUDE.md` §4.

- **Colour:** Navy `#0B2545` (primary), Navy Deep `#061E3A`, Teal `#13B5A5` (accent), Cloud `#F5F7FA` (alt bg), Slate `#334155` (body), Muted `#64748B`, Line `#E2E8F0`. Dark sections use the navy gradient; the teal is used sparingly as an accent.
- **Type:** Poppins (400/500/600) for headings, the wordmark, and UI; Lato (400/700) for body. Loaded from Google Fonts with `preconnect`. Fluid type scale via `clamp()`.
- **Spacing/radii/shadows:** small numeric scales; rounded corners 6–24px; three shadow levels.
- **Components:** buttons (primary/navy/ghost/ghost-light/link, plus `--lg`), cards (`.card`, `.card--link` hover lift), `.icon-tile`, `.feature`, `.steps` (numbered), `.trust-pill`, `.callout`, `.pill-tag` (`--ok` green / `--pa` red / `--info` teal / `--neutral`), `.data-table` (in a `.table-wrap` for horizontal scroll), `.faq` (`<details>`), `.cta-band`, `.contact-lines`, the `.assistant` widget, the `.hero`/`.hero--invert`, and the `.site-header`/`.site-footer`.
- **Logo:** the "curved-P / stacked-vertebra" mark, drawn from scratch as SVG (the §7.1 brand assets weren't in Drive). Files in `assets/img/`: `logo-mark.svg`, `logo-primary.svg` (horizontal lockup with Poppins wordmark), `logo-footer.svg` (white/reversed), `favicon.svg`. Product icons: `icon-bone-stim.svg`, `icon-orthosis.svg`, `icon-dressing.svg`, `icon-portal.svg` — these are also inlined directly in the HTML where they sit inside an `.icon-tile` (so they inherit `currentColor`); the standalone files are the canonical source.
- **Voice:** efficient / modern / no-nonsense (SaaS-quality, not "family business" warm), per the brand. Providers are addressed as peers; patients with reassurance, not infantilisation. Tone rule that's load-bearing here: **never overpromise on coverage; pin coverage claims to the governing LCD or federal rule.** Every page that touches coverage carries that disclaimer, and the footer has a site-wide one.

---

## 4. Behaviour / JS

All JS is in `assets/js/` (no inline scripts — keeps the CSP `script-src 'self'`). Progressive enhancement: the site is fully usable with JS off; only the coverage assistant is JS-only, and it has a `<noscript>` fallback pointing to the same phone/email.

- `main.js` — mobile nav toggle (with focus trap-ish behaviour, Escape to close, resize handling), current-year stamping, `aria-current` safety net, reveal-on-scroll via `IntersectionObserver` (respects `prefers-reduced-motion`), sticky-header-aware anchor scrolling.
- `coverage-data.js` — sets `window.PME_COVERAGE` and `window.PME_ASSISTANT_PROMPTS` (the suggestion chips). Mirrors `CLAUDE.md` §2/§3. **Source of truth = `CLAUDE.md`; keep this and the Function's copy in sync.**
- `coverage-assistant.js` — the widget: renders chips, posts to `/api/coverage-assistant`, safely renders the answer (text nodes, never `innerHTML`), shows citations, blocks obvious-PHI input client-side, degrades to a "call/email us" message on any failure. Supports multiple widget instances per page.
- `contact-form.js` — validates the contact form, blocks obvious-PHI in the message, posts to `/api/contact`, shows a status message.

---

## 5. Accessibility & performance notes

- Skip link on every page; semantic landmarks (`header`/`nav`/`main`/`footer`); breadcrumbs on inner pages; `aria-current="page"` on the active nav item; `aria-live` regions on the assistant and contact-form status.
- Colour contrast: navy on white and white on navy both clear AA; the teal is used for accents/borders, not body text; `pill-tag` colours chosen for contrast.
- `prefers-reduced-motion` honoured (reveal animations and the spinner degrade).
- No web fonts blocking render hard — `display=swap`; system-font fallbacks defined.
- Images are SVG (tiny, scalable). No JS framework, no jQuery, ~4 small JS files total.
- Inline `style="..."` attributes are used in a few places — they require `'unsafe-inline'` in the CSP `style-src` (scripts are still locked to `'self'`). A future cleanup pass could move those into `styles.css` classes and drop `'unsafe-inline'`.

---

## 6. Deploy runbook (Cloudflare Pages)

1. **Create the Pages project**, connected to this repo:
   - Build command: *(none)*
   - Build output directory: `marketing-site`
2. **Set environment variables** (Pages → Settings → Environment variables):
   - `ANTHROPIC_API_KEY` — **required** for the assistant; mark as a Secret.
   - `ASSISTANT_MODEL` — optional; default `claude-sonnet-4-6`. Use `claude-haiku-4-5-20251001` for a cheaper/faster variant.
   - `RESEND_API_KEY` + `CONTACT_FROM` (verified sender) + `CONTACT_TO` (default `rx@petersonmedicalequipment.com`) — optional; until set, the contact form accepts submissions and shows the thank-you but does **not** send email.
3. **Add the custom domain** `petersonmedicalequipment.com` (and `www` → apex redirect). Keep Cloudflare DNS/WAF; consider a rate-limiting rule on `/api/*`.
4. **Verify** after first deploy: every page loads; the assistant returns a sourced answer; the assistant refuses a PHI-looking input; the contact form validates and submits; `_headers` are present (check response headers); `/index.html` redirects to `/`.
5. **Analytics:** add the Plausible snippet (cookie-free) when ready — not yet in the pages.

---

## 7. Known gaps (also in `CLAUDE.md` §7.2 and `docs/build-log.md`)

- Contact form doesn't send email until a provider (Resend / MailChannels / Postmark) is wired into `functions/api/contact.js`.
- No analytics yet.
- Imagery is brand illustration (inline SVG) + placeholders (e.g. the contact-page map block). Swap in real photos/headshots when available.
- The Functions weren't run locally (no Node → no Wrangler). Test before go-live per the README.
- A few inline styles could be moved into CSS to tighten the CSP.
