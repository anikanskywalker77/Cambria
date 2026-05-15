import { redirect } from "next/navigation";
import { getCurrentSession, isAllowedIn } from "@/lib/auth";
import PortalShell from "@/components/PortalShell";

export default async function ProviderHome() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  // Role-based home redirects: admin/staff land in /admin, reps land in /rep,
  // physicians + office staff land here.
  if (isAllowedIn("admin", session.role)) redirect("/admin");
  if (isAllowedIn("rep", session.role)) redirect("/rep");
  if (!isAllowedIn("provider", session.role)) {
    // Patient + auditor roles aren't supported in Phase 1.
    redirect("/login?reason=role_not_supported");
  }

  return (
    <PortalShell area="provider" session={session}>
      <h1 className="text-3xl font-semibold text-navy mb-2">Welcome, {session.fullName.split(" ")[0]}</h1>
      <p className="text-slate mb-8">
        This is the provider portal stub. Real features land in subsequent build phases.
      </p>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">Start a new order</h3>
          <p className="text-sm text-muted">
            Single-line E0748 (bone growth stimulator) — the Phase 1 wizard.
          </p>
          <p className="mt-4 text-xs text-muted italic">Wizard not yet built.</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">Drafts awaiting your signature</h3>
          <p className="text-sm text-muted">Orders prepared by office staff and waiting on you to sign.</p>
          <p className="mt-4 text-xs text-muted italic">Empty — no orders in the system yet.</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">Recent orders</h3>
          <p className="text-sm text-muted">Your last 10 signed orders, with status.</p>
          <p className="mt-4 text-xs text-muted italic">Empty — no orders in the system yet.</p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-navy mb-3">Phase 1 scope reminder</h2>
        <ul className="text-sm text-slate list-disc list-inside space-y-1">
          <li>E0748 single-line wizard end-to-end (no PA, no WOPD).</li>
          <li>Atomic three-way write on signature: Postmark email + Drive archive + Postgres status.</li>
          <li>Append-only audit log with SHA-256 hash chain + IP / IP-derived geolocation per row.</li>
          <li>Provider, office-staff, DME admin, DME staff roles. (Sales rep + auditor are Phase 2/3.)</li>
        </ul>
      </section>

      <p className="mt-12 text-xs text-muted">
        Signed in as <code>{session.role}</code> · IP {session.ip} · {session.userAgent.slice(0, 60)}…
      </p>
    </PortalShell>
  );
}
