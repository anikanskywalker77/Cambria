# Cambria — Provider portal

Next.js 14 (App Router) + TypeScript + Prisma + Tailwind. Three front-ends behind one app:

| Path | Audience | Notes |
|---|---|---|
| `/` | Physicians, office staff | Default landing for prescribing roles. |
| `/admin` | DME Admin (Josh), DME Staff | Internal back office. Spec §15. |
| `/rep` | Sales Reps | **Zero PHI.** Spec §17. |
| `/login` | Anyone | Phase 1: dev mock-role picker. Production: Keycloak OIDC. |

> **Read first:** [`../CLAUDE.md`](../CLAUDE.md) for project context and the regulatory constants in §3, then [`../docs/provider-portal-spec.md`](../docs/provider-portal-spec.md) for the full functional + technical spec the code is being built against.

---

## Status

**Phase 1 build, scaffolding stage.** What's in this commit:

- Project structure, `package.json`, TypeScript, Tailwind config (matching marketing brand)
- Full Prisma schema covering Phase 1 + Phase 2/3 tables (so we don't have to do disruptive migrations later)
- Pure-code core: `src/lib/constants.ts` (regulatory constants), `src/lib/status-engine.ts` (the L0651 PA-routing logic + F2F window check + order validation), `src/lib/audit.ts` (`recordAuditEvent` + hash-chain verifier), `src/lib/auth.ts` (mock for dev, Keycloak shape locked in)
- App Router pages: `/` (provider home stub), `/admin` (admin dashboard stub), `/rep` (rep dashboard stub), `/login` (mock-role picker)
- `PortalShell` chrome (header/footer per portal area)
- Strict CSP / HSTS / no-frame headers via `next.config.mjs` (same posture as the marketing site's `_headers`)
- `docker-compose.dev.yml` for local Postgres

What's **not** here yet (intentional — comes in subsequent phases):

- Real auth (Keycloak)
- E0748 wizard (the Phase 1 marquee feature)
- tRPC routers / API calls (currently the pages are stubs with no DB reads)
- Postmark / Drive / NPPES / OIG-LEIE wiring
- DocuSeal sidecar
- Excel roster upload + Agent SDK parser (Phase 2)
- Sales rep system + commissions + QBO integration (Phase 3)

---

## Run it locally

Prereqs: **Node.js 20+** (already installed — `node --version`), **Docker Desktop** (for the local Postgres container; alternative is a managed Neon / Supabase free tier).

### 1. Install deps

```sh
cd portal
npm install
```

### 2. Bring up local Postgres

```sh
docker compose -f docker-compose.dev.yml up -d
```

(If you don't have Docker, point `DATABASE_URL` in `.env.local` at any Postgres 14+ instance you have access to.)

### 3. Configure environment

```sh
cp .env.example .env.local
```

Open `.env.local` and confirm:

- `DATABASE_URL` matches your Postgres (default works with the docker-compose above)
- `DEV_MOCK_AUTH=true` for local dev (this is the only environment where mock auth is allowed — the app hard-fails at startup if it sees this in non-dev)
- `DEV_MOCK_ROLE=dme_admin` (or any of: `dme_staff`, `physician`, `office_staff`, `sales_rep`)

### 4. Push the schema

```sh
npm run db:push
```

This creates all the tables defined in `prisma/schema.prisma` against your DATABASE_URL. For Phase 1 we're using `db push` (fast iteration, no migration history); we switch to `db migrate` once the schema stabilises.

### 5. Start the dev server

```sh
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/login` first time — pick a role, you'll get a session cookie, and you'll land at the home for that role.

---

## Day-to-day workflow

```sh
# Run dev server
npm run dev

# Open Prisma Studio to poke at the DB visually
npm run db:studio

# Apply schema changes after editing prisma/schema.prisma
npm run db:push

# Generate the Prisma client (after pulling new commits)
npm run db:generate

# Type-check + lint
npm run typecheck
npm run lint
```

---

## Project layout

```
portal/
├── package.json · tsconfig.json · next.config.mjs · tailwind.config.ts
├── docker-compose.dev.yml         # local Postgres
├── .env.example                   # copy to .env.local and fill in
├── prisma/
│   └── schema.prisma              # full data model — spec §10.1
└── src/
    ├── app/                       # Next.js App Router
    │   ├── layout.tsx             # root layout, fonts, mock-auth safety check
    │   ├── page.tsx               # provider home (/)
    │   ├── admin/page.tsx         # admin home (/admin)
    │   ├── rep/page.tsx           # sales-rep home (/rep)
    │   └── login/page.tsx         # mock-role picker (Phase 1) → Keycloak (later)
    ├── components/
    │   └── PortalShell.tsx        # header/footer chrome per portal area
    ├── lib/
    │   ├── constants.ts           # CLAUDE.md §3 regulatory constants — load-bearing
    │   ├── status-engine.ts       # the L0651 PA-routing logic + F2F window + validation
    │   ├── audit.ts               # recordAuditEvent + hash-chain verifier (spec §9)
    │   ├── auth.ts                # mock auth for dev; Keycloak shape locked in
    │   └── prisma.ts              # Prisma client singleton
    └── styles/
        └── globals.css            # Tailwind base + brand component classes
```

---

## Conventions (from spec §11 / CLAUDE.md §11)

- **TypeScript strict mode** everywhere. `npm run typecheck` must be clean before pushing.
- **Zod** at every external boundary (HTTP body, file upload, third-party API response). Will land with the tRPC routers.
- **No PHI in logs ever.** `recordAuditEvent` strips known PHI field names server-side and throws in dev. Sentry scrubbing rules will mirror this in prod.
- **Audit-log writes go through `recordAuditEvent` exclusively.** Direct `prisma.auditLog.create()` is forbidden by Postgres role permissions (set in the migration that creates the table).
- **Server Actions for mutations.** Never expose Drive credentials or any third-party keys to the client.
- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`). PR self-review checklist: HIPAA-impact, security-impact, audit-log-impact.
- **Branch naming:** `feat/<short-desc>`, `fix/<ticket-id>`, `chore/<short-desc>`.
- **No real PHI in the repo** — synthetic test data only. The seed script (`prisma/seed.ts`, future) will use obviously-fake names like "Test Patient One".

---

## Where the regulatory rules live

The L0651 PA effective date (`2026-04-13`), F2F window (6 months), product-line definitions, and SWO required elements are in `src/lib/constants.ts`. **They must stay in sync with [`../CLAUDE.md`](../CLAUDE.md) §3 and the marketing-site copies** at:

- `marketing-site/assets/js/coverage-data.js` (browser)
- `marketing-site/functions/api/coverage-assistant.js` (assistant Function)

Any change requires updating all four places + an entry in [`../docs/build-log.md`](../docs/build-log.md).

---

## What's next (next-session worklog)

1. **tRPC routers + Zod schemas** — basic `auth`, `practices`, `orders` routers so the stub pages can read real data.
2. **Seed script** — populate the dev DB with synthetic practices, users, patients, and a few signed orders to develop against.
3. **Practitioner sign-up flow** — NPPES + LEIE check stubbed, real implementation behind feature flags.
4. **The E0748 wizard** — the Phase 1 marquee deliverable (steps: patient → item → clinical → review → send-to-physician).
5. **Signing UI + atomic three-way write** — wired via Server Actions, with `recordAuditEvent` calls on every state transition.
