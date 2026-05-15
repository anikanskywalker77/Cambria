import type { Config } from "tailwindcss";

/**
 * Brand tokens mirror the marketing site (CLAUDE.md §4 / marketing-site/assets/css/styles.css).
 * Same navy / teal / Poppins / Lato treatment so the portal feels like a continuation
 * of petersonmedicalequipment.com, not a different product.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0B2545", deep: "#061E3A" },
        teal: { DEFAULT: "#13B5A5", dark: "#0E8E82", soft: "#E3F6F3" },
        cloud: "#F5F7FA",
        slate: { DEFAULT: "#334155" },
        muted: "#64748B",
        line: "#E2E8F0",
        ink: "#0B1726",
      },
      fontFamily: {
        ui: ['"Poppins"', '"Segoe UI"', "system-ui", "-apple-system", "Arial", "sans-serif"],
        body: ['"Lato"', '"Segoe UI"', "system-ui", "-apple-system", "Arial", "sans-serif"],
      },
      borderRadius: {
        sm: "6px", md: "10px", lg: "16px", xl: "24px",
      },
      boxShadow: {
        "elevation-sm": "0 1px 2px rgba(11,37,69,0.06), 0 1px 3px rgba(11,37,69,0.08)",
        "elevation-md": "0 4px 12px rgba(11,37,69,0.08), 0 2px 4px rgba(11,37,69,0.06)",
        "elevation-lg": "0 18px 40px rgba(11,37,69,0.14), 0 4px 12px rgba(11,37,69,0.08)",
      },
      maxWidth: {
        narrow: "760px",
        layout: "1160px",
      },
    },
  },
  plugins: [],
};

export default config;
