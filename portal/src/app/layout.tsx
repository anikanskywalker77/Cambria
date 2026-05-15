import type { Metadata } from "next";
import "../styles/globals.css";
import { assertProductionAuthSafety } from "@/lib/auth";

// Hard-fail at startup if mock auth is enabled in a non-dev environment.
assertProductionAuthSafety();

export const metadata: Metadata = {
  title: "Peterson Medical Equipment — Provider Portal",
  description:
    "Peterson Medical Equipment provider portal. Standard Written Order intake, " +
    "signing, and records management for referring clinics in Washington and Oregon.",
  robots: { index: false, follow: false }, // portal is auth-walled; never index
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Same brand fonts as the marketing site */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Poppins:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
