import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "rgb(var(--c-page) / <alpha-value>)",
        card: "rgb(var(--c-card) / <alpha-value>)",
        accent: "rgb(var(--c-accent) / <alpha-value>)",
        "accent-pressed": "rgb(var(--c-accent-pressed) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        success: "rgb(var(--c-success) / <alpha-value>)",
        danger: "rgb(var(--c-danger) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        "on-accent": "#FFFBF5",
      },
      borderRadius: {
        card: "16px",
        control: "12px",
      },
      fontFamily: {
        sans: ["Heebo", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
