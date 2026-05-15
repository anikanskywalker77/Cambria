import { redirect } from "next/navigation";
import { getCurrentSession, isAllowedIn } from "@/lib/auth";
import PortalShell from "@/components/PortalShell";

export default async function AdminHome() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isAllowedIn("admin", session.role)) redirect("/");

  return (
    <PortalShell area="admin" session={session}>
      <h1 className="text-3xl font-semibold mb-2">Admin dashboard</h1>
      <p className="text-slate mb-8">
        Internal back-office for Peterson staff. Spec §15. Phase 1 baseline below.
      </p>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Tile title="Order queue" description="All orders across all practices. Filter by status, HCPCS, practice, signer, date." href="/admin/orders" />
        <Tile title="Practices" description="Every clinic with at least one user or one order. Members, orders, assigned rep, lifetime volume." href="/admin/practices" />
        <Tile title="Users" description="Provision practitioner accounts (kicks off NPPES + LEIE + state-license verification), invite office staff, suspend, revoke, reset MFA." href="/admin/users" />
        <Tile title="Audit log" description="Query the append-only audit_log by actor, subject, action, date range. IP and geo visible. Used during records requests + investigations." href="/admin/audit" />
        <Tile title="Records requests" description="Create an Auditor scope (date range + patient/order list) and mint a time-boxed activation link. Track active scopes; revoke on demand." href="/admin/records-requests" />
        <Tile title="Compliance dashboard" description="Orders awaiting PA, F2F docs expiring within 30 days, signed PDFs that failed to archive, hash-chain status, monthly LEIE refresh status, NSC 855S enrollment tracking." href="/admin/compliance" />
      </section>

      <p className="mt-12 text-xs text-white/60">
        Signed in as <code className="text-white/80">{session.role}</code> · IP {session.ip} · Mock auth ENABLED
      </p>
    </PortalShell>
  );
}

function Tile({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted">{description}</p>
      <p className="mt-4 text-xs text-muted italic">
        Stub: <code>{href}</code> not yet implemented.
      </p>
    </div>
  );
}
