import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        raised: "var(--raised)",
        ink: "var(--text)",
        muted: "var(--muted)",
        line: "var(--line)",
        accent: "var(--accent)",
        tint: "var(--accent-tint)",
        ok: "var(--success)",
        warn: "var(--warning)",
        bad: "var(--danger)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-deva)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "var(--font-deva)", "Georgia", "serif"],
        hand: ["var(--font-hand)", "cursive"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { xl2: "1.25rem", xl3: "1.75rem" },
      transitionTimingFunction: { spring: "cubic-bezier(.34,1.56,.64,1)" },
    },
  },
  plugins: [],
};

export default config;