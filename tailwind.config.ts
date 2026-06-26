import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 1px 2px rgba(17, 24, 39, .05), 0 10px 28px rgba(17, 24, 39, .08)",
        lift: "0 18px 44px rgba(17, 24, 39, .12)"
      }
    }
  },
  plugins: []
} satisfies Config;
