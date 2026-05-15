/**
 * Phase 1 stub login page.
 *
 * In production this is replaced by the Keycloak OIDC redirect flow.
 * For local dev, it shows a role picker so you can simulate signing in as
 * any of the supported roles to test the role-gated routes.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";

const ROLES: Array<{ value: UserRole; label: string; lands: string }> = [
  { value: "dme_admin",    label: "DME Admin (Josh)",                    lands: "/admin" },
  { value: "dme_staff",    label: "DME Staff (Peterson intake/fitter)",  lands: "/admin" },
  { value: "physician",    label: "Physician (signing prescriber)",      lands: "/" },
  { value: "office_staff", label: "Office Staff (MA / coordinator)",     lands: "/" },
  { value: "sales_rep",    label: "Sales Rep (non-PHI portal)",          lands: "/rep" },
];

async function pickRole(formData: FormData) {
  "use server";
  const role = formData.get("role")?.toString();
  if (!role) return;
  const cookieJar = await cookies();
  cookieJar.set("dev_mock_role", role, { httpOnly: false, sameSite: "lax", path: "/" });
  redirect("/");
}

export default function LoginPage() {
  const isMock = process.env.DEV_MOCK_AUTH === "true";

  return (
    <div className="min-h-screen flex items-center justify-center bg-cloud px-6">
      <div className="card w-full max-w-narrow">
        <h1 className="text-2xl font-semibold text-navy mb-2">Provider portal — sign in</h1>

        {!isMock ? (
          <>
            <p className="text-slate mb-6">
              Real auth (Keycloak OIDC) is not yet provisioned for this environment.
              Set <code>DEV_MOCK_AUTH=true</code> in <code>.env.local</code> to use the
              mock-role picker for local development.
            </p>
            <p className="text-xs text-muted">
              See <code>portal/README.md</code> for the local dev walkthrough.
            </p>
          </>
        ) : (
          <>
            <p className="text-slate mb-6">
              <strong>Local dev mode.</strong> Pick a role to simulate signing in.
              In production this page is replaced by Keycloak's hosted login.
            </p>
            <form action={pickRole} className="space-y-3">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="submit"
                  name="role"
                  value={r.value}
                  className="btn-ghost w-full justify-between text-left"
                >
                  <span>{r.label}</span>
                  <span className="text-xs text-muted font-normal normal-case">
                    lands at <code>{r.lands}</code>
                  </span>
                </button>
              ))}
            </form>
            <p className="mt-6 text-xs text-muted">
              Patient and Auditor roles are not in Phase 1 scope (spec §11). They'll appear here later.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
