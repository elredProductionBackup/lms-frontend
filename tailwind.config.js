/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette derived from the "the Professionals Network" logo:
        //   crimson  #C01823  +  neutral gray  #67686B  +  white.
        // Surfaces ("cream" kept as the token name for a clean cascade) — now
        // white and cool light grays instead of the old warm cream.
        cream: {
          DEFAULT: "#F5F5F6",
          50: "#FFFFFF", // elevated surfaces / cards
          100: "#F6F6F7", // page background
          200: "#ECECEE", // subtle fills / hover
          300: "#DEDEE1", // borders / dividers
        },
        // Text + structure — neutral near-black, with "muted" set to the
        // logo's own gray so labels read as a brand element.
        ink: {
          DEFAULT: "#1E1F21",
          soft: "#3B3C3F",
          muted: "#6B6C6F",
        },
        // Category tracks — three clearly distinguishable tones, all on-brand:
        // red / gray / charcoal.
        frontend: { DEFAULT: "#C01823", dark: "#99121B", light: "#DB4A53" },
        general: { DEFAULT: "#6B6C6F", dark: "#48494C", light: "#9A9B9E" },
        backend: { DEFAULT: "#2E2F31", dark: "#1E1F21", light: "#54565A" },
        // Semantic — success stays green so "active/available" is never
        // confused with the brand red or with error states.
        available: "#188A48",
        closed: "#8A8B8E",
        // Primary accent alias (was teal). Now the brand crimson so links,
        // focus rings, active tabs, avatars and key CTAs pick it up.
        teal: { DEFAULT: "#C01823", dark: "#99121B", light: "#DB4A53" },
        // Brand aliases (available if you want to reference them by name).
        brand: { DEFAULT: "#C01823", dark: "#99121B", light: "#DB4A53" },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(30,31,33,0.04), 0 8px 24px rgba(30,31,33,0.06)",
        soft: "0 1px 3px rgba(30,31,33,0.06)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: 0, transform: "translateY(6px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.35 },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out both",
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
