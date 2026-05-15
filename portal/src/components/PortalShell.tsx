/**
 * Shared header/footer chrome for the three portal areas (provider / admin / rep).
 * Variant changes the nav links and the visual emphasis (admin = navy bar to
 * signal "you're in the back office"; rep = teal accent; provider = neutral).
 */
import Link from "next/link";
import type { Session } from "@/lib/auth";

export type PortalArea = "provider" | "admin" | "rep";

interface Props {
  area: PortalArea;
  session: Session;
  children: React.ReactNode;
}

const NAV: Record<PortalArea, Array<{ href: string; label: string }>> = {
  provider: [
    { href: "/", label: "Dashboard" },
    { href: "/orders", label: "Orders" },
    { href: "/patients", label: "Patients" },
    { href: "/help", label: "Help" },
  ],
  admin: [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/practices", label: "Practices" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/audit", label: "Audit log" },
    { href: "/admin/compliance", label: "Compliance" },
  ],
  rep: [
    { href: "/rep", label: "Dashboard" },
    { href: "/rep/clinics", label: "Clinics" },
    { href: "/rep/commissions", label: "Commissions" },
    { href: "/rep/payouts", label: "Payouts" },
    { href: "/rep/profile", label: "Profile" },
  ],
};

const LABEL: Record<PortalArea, string> = {
  provider: "Provider portal",
  admin: "Admin",
  rep: "Sales rep portal",
};

const BAR_CLASS: Record<PortalArea, string> = {
  provider: "bg-white border-b border-line",
  admin: "bg-navy text-white",
  rep: "bg-white border-b border-line",
};

const LINK_CLASS: Record<PortalArea, string> = {
  provider: "text-navy hover:text-teal-dark",
  admin: "text-white/80 hover:text-white",
  rep: "text-navy hover:text-teal-dark",
};

export default function PortalShell({ area, session, children }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className={BAR_CLASS[area]}>
        <div className="max-w-layout mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link href={areaHomeFor(area)} className="font-ui font-semibold text-lg">
              Peterson Medical Equipment
            </Link>
            <span
              className={
                "pill " +
                (area === "admin"
                  ? "bg-teal/20 text-teal"
                  : area === "rep"
                    ? "bg-teal-soft text-teal-dark"
                    : "bg-cloud text-muted")
              }
            >
              {LABEL[area]}
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            {NAV[area].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={"text-sm font-ui font-medium " + LINK_CLASS[area]}
              >
                {item.label}
              </Link>
            ))}
            <span className={"text-sm font-ui " + (area === "admin" ? "text-white/70" : "text-muted")}>
              {session.fullName}
            </span>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-layout mx-auto w-full px-6 py-10">{children}</main>

      <footer className="border-t border-line">
        <div className="max-w-layout mx-auto px-6 py-6 text-xs text-muted flex flex-wrap justify-between gap-4">
          <span>Peterson Medical LLC · NPI 1528924479 · Kennewick, WA</span>
          <span>
            Need help? Call <a href="tel:+15097837501" className="underline">509-783-7501</a>
          </span>
        </div>
      </footer>
    </div>
  );
}

function areaHomeFor(area: PortalArea): string {
  return area === "admin" ? "/admin" : area === "rep" ? "/rep" : "/";
}
