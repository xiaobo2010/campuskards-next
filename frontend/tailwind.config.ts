import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        elite: "#6366f1",
        arts: "#f59e0b",
        mass: "#ef4444",
        global: "#10b981",
        rush: "#8b5cf6",
        surface: "var(--bg-primary)",
        panel: "var(--bg-secondary)",
        card: "var(--bg-card)",
        border: "var(--border)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        danger: "var(--danger)",
        success: "var(--success)",
        warning: "var(--warning)",
        muted: "var(--text-secondary)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        legendaryGlow: { "0%, 100%": { boxShadow: "0 0 8px 2px rgba(245,158,11,0.15)" }, "50%": { boxShadow: "0 0 16px 4px rgba(245,158,11,0.3)" } },
        legendaryGlowStrong: { "0%, 100%": { boxShadow: "0 0 12px 4px rgba(245,158,11,0.2)" }, "50%": { boxShadow: "0 0 24px 8px rgba(245,158,11,0.45)" } },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
