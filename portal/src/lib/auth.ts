/**
 * Auth — Phase 1 stub.
 *
 * Real auth is Keycloak (per spec §3 / D3 in the open-decisions table).
 * Until Keycloak is provisioned, this module returns a dev-only mock session
 * gated by the DEV_MOCK_AUTH env var. In any non-local environment the
 * portal hard-fails on startup if DEV_MOCK_AUTH is set — see `assertProductionAuthSafety()`.
 *
 * When Keycloak lands, replace `getCurrentSession()` with the real OIDC
 * session-cookie + refresh-token flow. The shape of the returned `Session`
 * type is the contract every caller depends on; keep that stable.
 */
import { cookies, headers } from "next/headers";
import type { UserRole } from "@prisma/client";

export interface Session {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  /** Used by the audit log helper (spec §9.5). Always present. */
  ip: string;
  userAgent: string;
}

const VALID_ROLES = [
  "dme_admin",
  "dme_staff",
  "physician",
  "office_staff",
  "sales_rep",
  "patient",
  "auditor",
] as const satisfies readonly UserRole[];

function isMockAuthEnabled(): boolean {
  return process.env.DEV_MOCK_AUTH === "true";
}

/** Throws on startup if a non-local environment has DEV_MOCK_AUTH=true. */
export function assertProductionAuthSafety(): void {
  if (!isMockAuthEnabled()) return;
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
  if (env !== "development" && env !== "test") {
    throw new Error(
      "DEV_MOCK_AUTH is enabled in a non-development environment. " +
        "Mock auth is for local dev only — provision Keycloak before deploying.",
    );
  }
}

/**
 * Get the current session from the request, or null if not signed in.
 * Server Components and Route Handlers can call this directly.
 */
export async function getCurrentSession(): Promise<Session | null> {
  if (!isMockAuthEnabled()) {
    // TODO: replace with the Keycloak OIDC session lookup.
    // For now, hard-deny in non-mock environments so we don't accidentally
    // run unauthenticated.
    return null;
  }

  const hdrs = await headers();
  const cookieJar = await cookies();
  const ip = hdrs.get("cf-connecting-ip") ?? hdrs.get("x-real-ip") ?? "127.0.0.1";
  const userAgent = hdrs.get("user-agent") ?? "unknown";

  // Mock session: read role from cookie if set, else fall back to env default.
  const cookieRole = cookieJar.get("dev_mock_role")?.value as UserRole | undefined;
  const envRole = (process.env.DEV_MOCK_ROLE ?? "dme_admin") as UserRole;
  const role = cookieRole && (VALID_ROLES as readonly string[]).includes(cookieRole)
    ? cookieRole
    : envRole;

  return {
    userId: "00000000-0000-0000-0000-000000000001",
    email: "dev-mock@petersonmedicalequipment.com",
    fullName: "Dev Mock User",
    role,
    ip,
    userAgent,
  };
}

/** Throw a redirect-friendly error if there's no session. */
export async function requireSession(): Promise<Session> {
  const s = await getCurrentSession();
  if (!s) {
    // In Next.js App Router, throw `redirect("/login")` — caller is responsible
    // for handling. We export this as a separate function to keep redirect
    // out of the lib (so this file can be unit-tested without next/navigation).
    throw new Error("UNAUTHENTICATED");
  }
  return s;
}

/** Whether the role is allowed to reach a given portal area. */
export function isAllowedIn(area: "provider" | "admin" | "rep", role: UserRole): boolean {
  switch (area) {
    case "admin":
      return role === "dme_admin" || role === "dme_staff";
    case "rep":
      return role === "sales_rep";
    case "provider":
      return role === "physician" || role === "office_staff";
    default:
      return false;
  }
}
