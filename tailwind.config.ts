import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0A0E0C",
          900: "#0F1512",
          800: "#161E1A",
          700: "#1E2924",
          600: "#2A3831",
          500: "#3D4E45",
          400: "#5C6F66",
          300: "#8A9A92",
          200: "#B8C4BE",
          100: "#E4E9E6",
        },
        schloss: {
          DEFAULT: "#2F8F4E",
          bright: "#3DB365",
          deep: "#1E5631",
          shadow: "#164426",
          tint: "#142821",
          glow: "#9FE1CB",
        },
        sandbaggers: {
          DEFAULT: "#3B8BE8",
          deep: "#185FA5",
          shadow: "#042C53",
          tint: "#0F1D2E",
        },
        tbc: {
          DEFAULT: "#E24B4A",
          deep: "#A32D2D",
          shadow: "#501313",
          tint: "#2A1515",
        },
        shot: {
          bg: "#3A2A10",
          accent: "#FAC775",
          text: "#FCE1A8",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "hero": ["clamp(3.5rem, 10vw, 6.5rem)", { lineHeight: "0.95", letterSpacing: "-0.03em", fontWeight: "300" }],
        "display": ["clamp(2rem, 5vw, 3.5rem)", { lineHeight: "1.0", letterSpacing: "-0.02em", fontWeight: "400" }],
        "score": ["clamp(2.5rem, 6vw, 4rem)", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "300" }],
        "eyebrow": ["0.6875rem", { lineHeight: "1", letterSpacing: "0.15em", fontWeight: "500" }],
      },
      animation: {
        "pulse-live": "pulse-live 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fade-in 0.6s ease-out",
      },
      keyframes: {
        "pulse-live": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 rgba(61, 179, 101, 0.5)" },
          "50%": { opacity: "0.85", boxShadow: "0 0 0 6px rgba(61, 179, 101, 0)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
