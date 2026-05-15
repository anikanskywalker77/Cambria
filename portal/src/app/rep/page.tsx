import { redirect } from "next/navigation";
import { getCurrentSession, isAllowedIn } from "@/lib/auth";
import PortalShell from "@/components/PortalShell";

export default async function RepHome() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isAllowedIn("rep", session.role)) redirect("/");

  return (
    <PortalShell area="rep" session={session}>
      <h1 className="text-3xl font-semibold text-navy mb-2">Sales rep dashboard</h1>
      <p className="text-slate mb-8">
        Your assigned clinics and your commission ledger. Spec §17.{" "}
        <strong>Zero PHI.</strong> No patient names, MBIs, dates of birth, or clinical info ever appears here.
      </p>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Stat label="MTD gross collected" value="$ — " />
        <Stat label="YTD gross collected" value="$ — " />
        <Stat label="Commission earned (locked in)" value="$ — " />
        <Stat label="Balance owed (earned − paid)" value="$ — " />
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">My clinics</h3>
          <p className="text-sm text-muted">Practices currently assigned to you, with order count and revenue per clinic.</p>
          <p className="mt-4 text-xs text-muted italic">Empty — no rep assignments yet.</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">Recent commission events</h3>
          <p className="text-sm text-muted">Per-order ledger: HCPCS, clinic, date, amount, status (accrued / earned / paid).</p>
          <p className="mt-4 text-xs text-muted italic">Empty — no orders signed yet.</p>
        </div>
      </section>

      <p className="mt-12 text-xs text-muted">
        Signed in as <code>{session.role}</code> · IP {session.ip}
      </p>
    </PortalShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wider text-muted font-ui font-semibold">{label}</p>
      <p className="text-2xl font-ui font-semibold text-navy mt-1">{value}</p>
    </div>
  );
}
