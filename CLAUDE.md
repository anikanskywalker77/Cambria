# Cambria — Project Context

*Peterson Medical Equipment — provider portal & marketing site*

> **What this file is.** A single-source briefing for Claude Code (or any AI coding assistant) working on the Peterson Medical Equipment website + provider portal build. Read this before touching code. It encodes business identity, regulatory constants that must not drift, architectural decisions, what's been built, what's pending, and where to find the long-form specs.
>
> **How to keep it useful.** Update the "Current state" and "Open decisions" sections every time something lands. Don't duplicate the long specs in here — link to them. The append-only build journal lives at [`docs/build-log.md`](docs/build-log.md).
>
> **Last updated:** 2026-05-12 (synced into this repo; original context doc dated 2026-04-27)

---

## 1. Project at a glance

**Company:** Peterson Medical LLC, DBA Peterson Medical Equipment
**Domain:** petersonmedicalequipment.com
**Mission:** HIPAA-compliant DMEPOS supplier focused on spinal care across Washington and Oregon, with a strong UX bias toward making provider ordering and patient education effortless.
**Build goal:** Replace fax-back SWOs with a verified web portal; ship a marketing site that converts referring providers.

**Critical business identifiers (do not change):**

| Field | Value |
|---|---|
| Legal entity | Peterson Medical LLC |
| DBA | Peterson Medical Equipment |
| NPI | 1528924479 |
| EIN | 39-5095641 |
| Address | 4415 W Clearwater Ave, Suite 11, Kennewick, WA 99336 |
| Phone | 509-783-7501 |
| Fax | 509-980-7062 |
| Owner email | jmarquardt@petersonmedicalequipment.com |
| Orders email | rx@petersonmedicalequipment.com |
| Owner | Josh Marquardt |
| States licensed | WA, OR |

---

## 2. Product portfolio (three lines)

Every product line is referenced by its HCPCS code throughout the codebase. Memorize these.

### 2.1 Spinal bone stimulator — HCPCS E0748
- Manufacturers carried: Zimmer Biomet SpinalPak II, Enovis/DJO SpinalLogic, Orthofix Spinal-Stim (and Cervical-Stim on request)
- Default dispensing: **NU** (new purchase). 270-day single treatment episode.
- Governing LCD: **L33796** (Osteogenesis Stimulators)
- PA: not required (clinical review per payer)

### 2.2 Spinal orthoses — Trend product line
| HCPCS | Trend SKU | Description | PA required? |
|---|---|---|---|
| L0457 | Trend Correx TLSO (DCT-5657) | TLSO, flexible trunk, SJ-SS, prefab OTS | No |
| L0464 | Trend Correx SP TLSO (DCT-0464) | TLSO, 4 rigid panels, sacro-scapular, prefab OTS | No |
| L0648 | Trend LSO (DCT-31) | LSO, sagittal, rigid ant/post panels, prefab OTS | **Yes (since 2022)** |
| L0650 | Trend Pro LSO (DCT-37) | LSO, sagittal-coronal, rigid ant/post panels, prefab OTS | **Yes (since 2022)** |
| L0651 | Trend Extend LSO (DCT-3951) | LSO, sagittal-coronal, shell & panel, prefab OTS | **Yes (effective 2026-04-13)** |

- Governing LCD: **L33790** (Spinal Orthoses: TLSO and LSO)
- WOPD (Written Order Prior to Delivery) **always required** for L0648 / L0650 / L0651

### 2.3 Surgical dressings — Vitalé line
| HCPCS | Product | Sizes |
|---|---|---|
| A6010 | Collagen Powder | 1g packets |
| A6021 | Collagen Dressing | 2" × 2" |
| A6023 | Collagen Dressing | 7" × 7" |
| A6203 | Composite Island Dressing | 4" × 6", 4" × 10" |
| A6203 | Silicone Composite Dressing | 3.5" × 4" |
| A6204 | Composite Island Dressing | 4" × 14" |
| A6204 | Silicone Composite Dressing | 9" × 9" |

- Governing LCD: **L33831** (Surgical Dressings)
- Vitalé relationship is informal (samples-only); other dressings (alginate, foam, hydrogel) may be sourced on request

---

## 3. Regulatory constants — DO NOT DRIFT

These dates and rule references are embedded in business logic (especially the portal's status engine, and the marketing site's coverage assistant). Any change requires explicit confirmation from Josh.

| Constant | Value | Source |
|---|---|---|
| L0651 PA effective date | **2026-04-13** | CMS-6097-N, 91 FR 1250 |
| L0648, L0650 PA effective date | 2022-04-13 (already in effect) | 87 FR 2051 |
| DMEPOS supplier-enrollment moratorium effective | **2026-02-27** | CMS-6099-N, 91 FR 9855 |
| DMEPOS moratorium exemption | applies to 855S apps received **before** 2026-02-27 | § 424.570(a)(1)(iv) |
| SWO big-six requirements | per CMS Article A55426 | A55426 |
| F2F encounter window | **within 6 months** of order | 42 CFR 410.38 |
| DMEPOS record retention minimum | 7 years (we use **10**) | 42 CFR 424.57(c)(9) |
| HIPAA technical safeguards | 45 CFR 164.312 | HIPAA Security Rule |
| Identity assurance target | NIST SP 800-63-3 **IAL2 / AAL2** | NIST SP 800-63-3 |

**The L0651 effective-date rule must be encoded in the portal's status engine.** Orders signed before `2026-04-13T00:00:00-07:00` route without PA; orders signed on or after that date trigger the PA workflow. See §9.4 of the portal spec.

The canonical machine-readable version of the regulatory data (used by the marketing site's coverage assistant) lives at [`marketing-site/assets/js/coverage-data.js`](marketing-site/assets/js/coverage-data.js) and `marketing-site/functions/api/coverage-assistant.js`. Keep those in sync with this table.

---

## 4. Brand system

Reference: [`docs/marketing-site.md`](docs/marketing-site.md) and the CSS design tokens in `marketing-site/assets/css/styles.css`.

- **Colors:** Navy `#0B2545` (primary), Navy Deep `#061E3A`, Teal `#13B5A5` (accent), Cloud `#F5F7FA` (bg), Slate `#334155` (body), Muted `#64748B`, Line `#E2E8F0`
- **Fonts:** Poppins (wordmark, UI, headings), Lato (long-form body alternative). Both via Google Fonts.
- **Voice:** Efficient / modern / no-nonsense (SaaS-quality, not "family business" warm). Per Josh's intake C5.
- **Logo direction:** Concept 2 / curved-P spinal-vertebra mark, promoted to primary. Mark is `marketing-site/assets/img/logo-mark.svg`; horizontal lockup `marketing-site/assets/img/logo-primary.svg`.
- **Tone rules:** never overpromise on Medicare; always pin claims to LCDs and federal rules; address providers as peers; address patients with reassurance without infantilizing.

---

## 5. Architecture

Full reference: [`docs/provider-portal-spec.md`](docs/provider-portal-spec.md) (drafted 2026-05-14 — covers roles, sign-up + identity verification, the order lifecycle / status engine, the SWO wizards, the Excel roster upload + Agent SDK parser, the signing ceremony, the atomic three-way write on signature, the audit log + hash chain, the architecture, the phased build plan, and the seven open decisions). `docs/hosting-stack-recommendation.md` is still to be authored when vendor selection moves into procurement.

### 5.1 Marketing site — AS BUILT (2026-05-12)
- **Implementation:** Hand-built static site (semantic HTML5 + a single CSS design-token system + minimal vanilla JS). No build step, no framework. Rationale: Node.js was not installed on the dev machine, "least friction" was the explicit goal, and a 9-page marketing site does not need a framework. Migration to Next.js can be revisited when the portal phase brings Node into the toolchain.
- **Host:** Cloudflare Pages (you already use Cloudflare for DNS/WAF per §5.2). Was: WP Engine HIPAA Secure Hosting — no longer needed for the marketing site since it holds zero PHI. Reserve WP Engine / Kinsta discussion for if a CMS is ever wanted.
- **Forms (non-PHI):** the public contact form posts to a Cloudflare Pages Function (`functions/api/contact.js`) which forwards to email via **Resend** (free tier). Sender domain `petersonmedicalequipment.com` is verified in Resend; SPF/DKIM/DMARC records live in Cloudflare DNS. Secrets `RESEND_API_KEY`, `CONTACT_FROM` (`noreply@petersonmedicalequipment.com`), `CONTACT_TO` (`rx@petersonmedicalequipment.com`) are set in Cloudflare Pages. No PHI is ever collected by the public site.
- **AI feature:** Provider "Coverage & SWO Requirements" assistant — a Cloudflare Pages Function (`functions/api/coverage-assistant.js`) calls the Anthropic Messages API directly (not the Agent SDK — it's single-shot Q&A, not agentic). Model: `env.ASSISTANT_MODEL || "claude-sonnet-4-6"` (set the env var to `claude-haiku-4-5-20251001` for a cheaper/faster variant — no redeploy needed). Grounded in the §3 regulatory constants + §2 product portfolio. Hard rules: no PHI input accepted; every coverage claim pinned to an LCD or CFR cite; disclaimer that it is not a coverage guarantee. Needs `ANTHROPIC_API_KEY` as a Cloudflare secret. See [`docs/ai-coverage-assistant.md`](docs/ai-coverage-assistant.md).
- **Analytics:** Plausible (cookie-free) — to be added; avoid GA4 with PHI-adjacent URLs.

### 5.2 Provider portal — NOT YET BUILT (target architecture)
- **Framework:** Next.js 14 (App Router) + TypeScript, server components preferred
- **API layer:** tRPC + Zod (type-safe end-to-end)
- **Auth:** Keycloak self-hosted (default; Auth0 B2B + HIPAA add-on is alternate) — password + TOTP, 15-min idle timeout
- **Database:** Google Cloud SQL for PostgreSQL 16, region `us-west1` (Oregon), Prisma ORM, row-level security policies
- **Compute:** Google Cloud Run (auto-scale to zero), both for Next.js app and the DocuSeal sidecar
- **E-signature:** **DocuSeal self-hosted** (MIT licensed) — produces signed PDF + Certificate of Completion. No vendor BAA needed.
- **Identity verification at signup:** NPPES NPI Registry API + monthly OIG LEIE list + state license check (FSMB DocInfo or per-state board scrape)
- **File archive:** **Google Workspace Shared Drive** named `Peterson DMEPOS Records`, folder structure `/SWOs/<YYYY>/<MM>/<PHYSICIAN_NPI>/`, filename `SWO_<PatientLast>_<PatientFirst>_<MBI4>_<HCPCS>_<OrderDate-YYYYMMDD>_<PhysicianNPI>.pdf`
- **Object storage (temp uploads):** GCP Cloud Storage with 30-day TTL lifecycle rule
- **Audit log:** Postgres append-only table with SHA-256 row-level hash chaining; daily snapshot to GCS object-lock bucket (10-year retention)
- **Email:** Postmark (HIPAA plan) for transactional notifications; Google Workspace for `rx@` intake
- **DNS / CDN / WAF:** Cloudflare (Enterprise for BAA)
- **Error monitoring:** Sentry Business + HIPAA add-on; PHI scrubbing rules required
- **AI (planned):** Excel-roster-upload parsing + per-row validation assist — this one is a good fit for the **Claude Agent SDK** (multi-step: parse → validate each row against §6 rules → flag issues → emit clean draft SWOs). Build it then, not now.

### 5.3 Roles (the "Cambria" model — Josh's prior naming)

The portal has three front-ends behind one Next.js app, gated by role at the route level:

- **Provider portal** (default landing) — physicians and office staff.
- **Admin portal** (`/admin`) — DME Admin and DME Staff.
- **Sales rep portal** (`/rep`) — Sales Reps. Non-PHI projection only.

| Role | Notes |
|---|---|
| **DME Admin** | Peterson super-admin; full audit; can impersonate (logged); manages reps and commission rules; runs payout batches. Lands at `/admin`. |
| **DME Staff** | Peterson intake/fitter; sees orders + patients; can't sign. Lands at `/admin` with reduced nav. |
| **Physician** | Credentialed prescriber; **only role that can e-sign an SWO**. |
| **Office Staff** | Prescriber's delegate (MA, scheduler); can prepare but never sign. |
| **Sales Rep** | **Zero PHI access.** Sees own assigned clinics' order count + revenue, own commission ledger, own payout history. Lands at `/rep`. See `docs/provider-portal-spec.md` §17. |
| **Patient** | Phase 2; minimal at launch |
| **Auditor** | Time-boxed read-only; provisioned per records-request ID; auto-revoke 30 days |

### 5.4 Output destinations for every signed SWO

Three writes happen atomically on signature:

1. Email to `rx@petersonmedicalequipment.com` with PDF attached
2. Upload to Google Shared Drive at the canonical path
3. `orders.status = 'submitted'` row in Postgres with `signed_pdf_url` populated

If any of the three fails, the signature transaction rolls back and the order returns to `draft` status with an error toast.

---

## 6. The Excel-upload differentiator

Per Josh's intake C3, the marquee provider feature is **Excel roster upload**: a physician's office uploads an `.xlsx` of patients and the portal auto-populates N draft SWOs. The physician then signs each individually (regulatory — no batch e-sign across separate patients allowed under Medicare). UX speed-up: a stacked-signing ceremony walks the physician through all valid rows with re-auth once per 10 signatures.

Template columns (bracing example):
```
patient_last, patient_first, patient_dob, patient_mbi, patient_addr1, patient_addr2,
patient_city, patient_state, patient_zip, patient_phone, hcpcs, size, indication_code,
f2f_date, icd10, length_of_need_months, clinical_notes, supporting_docs_file_urls
```

Validation rules: MBI format check, state ∈ {WA, OR}, F2F date within 6 months, ICD-10 valid against current year's CMS code set.

---

## 7. Current state

### 7.1 Already shipped (in this repo)

- `marketing-site/` — hand-built static marketing site:
  - `index.html` (Home), `about.html`, `providers.html` (For Providers), `patients.html` (For Patients), `insurance.html`, `contact.html`
  - `products/bone-stimulators.html`, `products/spinal-orthoses.html`, `products/surgical-dressings.html`
  - `assets/css/styles.css` — full design-token system from §4
  - `assets/img/` — `logo-mark.svg`, `logo-primary.svg`, `logo-footer.svg`, `favicon.svg`, product/portal icon SVGs
  - `assets/js/main.js` — nav, smooth scroll, small UI behaviors
  - `assets/js/coverage-data.js` — machine-readable regulatory + product data (mirrors §2/§3)
  - `assets/js/coverage-assistant.js` — front-end for the AI assistant widget
  - `functions/api/coverage-assistant.js` — Cloudflare Pages Function: calls Anthropic API
  - `functions/api/contact.js` — Cloudflare Pages Function: contact form → Resend → `rx@petersonmedicalequipment.com` (live as of 2026-05-14)
  - `_headers`, `_redirects`, `robots.txt`, `sitemap.xml`
- `docs/build-log.md` — append-only build journal
- `docs/marketing-site.md` — marketing-site design + IA + deploy doc
- `docs/ai-coverage-assistant.md` — design doc for the AI feature
- `README.md` — repo intro / how to run / how to deploy

### 7.2 Pending / not yet built

- ~~Wire the contact form Function to a real email sender~~ ✅ done 2026-05-14 (Resend; see `docs/build-log.md`)
- Provision Cloudflare Pages project + custom domain + `ANTHROPIC_API_KEY` secret
- Plausible analytics snippet
- Real photography / headshots (currently using brand illustration + placeholders)
- Next.js portal codebase + everything in §5.2
- ~~`docs/provider-portal-spec.md`~~ ✅ drafted 2026-05-14, `docs/hosting-stack-recommendation.md`, `docs/next-steps-action-items.md`
- HIPAA risk analysis, Notice of Privacy Practices, workforce training, cyber insurance, third-party pen test

### 7.3 Open decisions (block portal build start — NOT the marketing site)

1. **NSC call** — Josh must confirm 855S status under EIN 39-5095641 (CMS-6099-N moratorium implication)
2. **Identity:** Keycloak self-host vs. Auth0 + HIPAA
3. **E-sign:** DocuSeal self-host (default) vs. SignWell
4. **Build approach:** AI agent builds + MSP retainer, vs. 1099 contractor, vs. skip-build with vertical SaaS (Brightree / Bonafide / Nikohealth)
5. **Phase 1 scope:** marketing + portal parallel vs. marketing-first → **DECIDED 2026-05-12: marketing-first.**
6. **Pilot provider list:** top 5 referring clinics

---

## 8. Repository structure (current)

```
cambria/
├─ CLAUDE.md                  ← this file (project context)
├─ README.md                  ← human-facing repo intro
├─ .gitignore
├─ docs/
│  ├─ build-log.md            ← append-only build journal
│  ├─ marketing-site.md       ← marketing-site design/IA/deploy doc
│  ├─ ai-coverage-assistant.md← AI feature design doc
│  ├─ provider-portal-spec.md ← drafted 2026-05-14
│  └─ hosting-stack-recommendation.md ← (future)
├─ marketing-site/            ← hand-built static site (deploys to Cloudflare Pages)
│  ├─ index.html · about.html · providers.html · patients.html · insurance.html · contact.html
│  ├─ products/               ← 3 product pages
│  ├─ assets/css · assets/js · assets/img
│  ├─ functions/api/          ← Cloudflare Pages Functions (coverage-assistant, contact)
│  ├─ _headers · _redirects · robots.txt · sitemap.xml
└─ portal/                    ← (future) Next.js 14 app — see §5.2
```

---

## 9. Critical files outside the codebase

These live in Peterson's Google Workspace, not the repo:

- **Shared Drive:** `Peterson DMEPOS Records` (root for all SWO archives, supporting docs, audit log snapshots)
- **Drive folders:** `/SWOs/<YYYY>/<MM>/<NPI>/`, `/audit-logs/<YYYY>/`, `/risk-analysis/`, `/BAAs-signed/`
- **Email distribution:** `rx@petersonmedicalequipment.com` (group delivering to Josh + intake staff)

---

## 10. Glossary

| Term | Meaning |
|---|---|
| **Cambria** | Project codename for the Peterson provider portal + marketing site build (Josh's naming) |
| **DMEPOS** | Durable Medical Equipment, Prosthetics, Orthotics, Supplies |
| **SWO** | Standard Written Order (Medicare-required prescription document) |
| **WOPD** | Written Order Prior to Delivery |
| **F2F** | Face-to-face encounter (Medicare-required for many DME items) |
| **LCD** | Local Coverage Determination |
| **NCD** | National Coverage Determination |
| **PA / PAR** | Prior Authorization / Prior Authorization Request |
| **MBI** | Medicare Beneficiary Identifier (11-character alphanumeric) |
| **MAC** | Medicare Administrative Contractor |
| **DME MAC** | DME-specific MAC (Noridian handles Jurisdiction D, which covers WA/OR) |
| **NSC** | National Supplier Clearinghouse (handles DMEPOS 855S enrollment) |
| **NPI / NPPES** | National Provider Identifier / National Plan & Provider Enumeration System |
| **LEIE** | List of Excluded Individuals/Entities (OIG) |
| **HCPCS** | Healthcare Common Procedure Coding System |
| **TOTP** | Time-based One-Time Password (RFC 6238) |
| **IAL / AAL** | Identity Assurance Level / Authenticator Assurance Level (NIST 800-63-3) |
| **BAA** | Business Associate Agreement (HIPAA contract) |
| **NU / RR / UE** | Medicare modifiers: New Purchase / Rental / Used Equipment |
| **The portal** | The provider-facing web app at `portal.petersonmedicalequipment.com` |
| **The site** | The marketing static site at the root domain |

---

## 11. Style / coding conventions

**Marketing site (current):**
- Plain HTML5, no framework. One shared `<head>` partial pattern copied across pages (kept in sync manually — small site).
- CSS: a single `styles.css` with `:root` design tokens from §4. BEM-ish class names. No CSS framework.
- JS: vanilla, progressive enhancement. The site must fully work with JS disabled (the AI assistant is the only JS-only feature, and it degrades to a "call us / email rx@" message).
- **No PHI ever** touches the public site. The contact form collects name / email / phone / org / message only — never patient data. Server Functions log nothing sensitive.
- AI Function: all coverage claims must carry an LCD or CFR citation; refuse and redirect if a user pastes anything that looks like patient data; never present output as a coverage guarantee.

**Provider portal (future):**
- TypeScript strict mode on everywhere
- Zod for every external boundary (HTTP body, form input, file upload, third-party API response)
- Prisma schema-first; migrations checked in
- No PHI in logs ever. Sentry data scrubbing rules block patient fields by name (`patient_name`, `mbi`, `dob`, `address*`).
- All audit-log writes via a single `recordAuditEvent()` helper that hashes the previous row before append. Direct INSERTs into `audit_log` are forbidden.
- Server actions for any mutation; never expose Drive credentials to the client
- Tests: Vitest for unit, Playwright for end-to-end. Every SWO product-line wizard needs an end-to-end test that goes signup → sign → Drive.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). PRs require self-review checklist (HIPAA-impact, security-impact, audit-log-impact).
- Branch naming: `feat/<short-desc>`, `fix/<ticket-id>`, `chore/<short-desc>`.

---

## 12. When in doubt

- **Regulatory question?** Cite the CFR or LCD section. If it's not in this file, search CMS.gov before committing logic.
- **PHI exposure question?** Default to NO. Don't log it, don't send it to a non-BAA vendor, don't store it outside encrypted-at-rest tables.
- **UX question?** Refer to the brand voice in §4. When unsure, ship the more efficient / fewer-clicks variant.
- **Build vs. buy?** If the same problem is solved by a HIPAA-eligible managed service for less than 0.5 FTE-month of build effort, buy.
- **Ambiguous user-role permission?** Default deny. Surface to DME Admin for explicit grant.
- **Dev environment / HIPAA?** The repo and dev machine are NOT a "HIPAA environment" and don't need to be — source code isn't PHI. HIPAA obligations attach to production hosting + runtime data. The rule: never commit or store real patient data (synthetic only), and production infra needs signed BAAs.

---

## 13. Pointers to the long-form specs

- Marketing site — design / IA / deploy: [`docs/marketing-site.md`](docs/marketing-site.md)
- AI coverage assistant — design: [`docs/ai-coverage-assistant.md`](docs/ai-coverage-assistant.md)
- Build journal: [`docs/build-log.md`](docs/build-log.md)
- Provider portal — full functional + technical spec: [`docs/provider-portal-spec.md`](docs/provider-portal-spec.md) ✅ drafted 2026-05-14, expanded same day with admin portal (§15), sales rep tracking + commissions (§16), sales rep non-PHI portal (§17)
- Build vs buy — steel-manned vertical-SaaS comparison: [`docs/build-vs-buy-portal.md`](docs/build-vs-buy-portal.md) ✅ 2026-05-14 (recommendation: Claude-built for Phase 1, re-evaluate at retrospective)
- Hosting + stack — vendor decisions, BAAs, launch plan: `docs/hosting-stack-recommendation.md` *(to be authored)*
- Original Cambria context doc (Google Drive): file ID `1GZa0zHyVsEcy65qkamueQXle48X3g9Ca`

---

## 14. Change log

| Date | What changed | Source |
|---|---|---|
| 2026-04-27 | Initial Cambria context file created | original Drive doc |
| 2026-05-12 | Synced into the `cambria` git repo. Decisions: marketing-first; marketing site built as a hand-built static site (no Node available, least-friction goal) deployed to Cloudflare Pages instead of WordPress/WP Engine; added a provider "Coverage & SWO Requirements" AI assistant (Anthropic direct API via a Cloudflare Pages Function). Built the full 9-page marketing site, brand assets, and design docs. | this repo — see `docs/build-log.md` |

(Append every meaningful change here — new regulatory rule, vendor switch, scope cut, etc. Keep entries one line, with a source link or PR number.)
