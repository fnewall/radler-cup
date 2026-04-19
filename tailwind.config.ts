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
        schloss: {
          DEFAULT: "#1E5631",
          tint: "#E8F0E6",
          dark: "#164426",
        },
        sandbaggers: {
          DEFAULT: "#185FA5",
          dark: "#042C53",
          tint: "#E6F1FB",
          border: "#378ADD",
        },
        tbc: {
          DEFAULT: "#A32D2D",
          dark: "#501313",
          tint: "#FCEBEB",
          border: "#E24B4A",
        },
        shot: {
          bg: "#FAC775",
          border: "#BA7517",
          dark: "#412402",
          sub: "#633806",
        },
        live: "#9FE1CB",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
