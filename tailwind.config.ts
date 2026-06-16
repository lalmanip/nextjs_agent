import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    // NOTE: repo contains both `src/components` and `src/Components` (Windows is case-insensitive,
    // Linux is not). Include both so production purge doesn't drop styles.
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/Components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#FC6603",
        "primary-dark": "#e55a03",
        brand: {
          DEFAULT: "#fc6603",
          light: "#fd8535",
          dark: "#d95200",
        },
      },
    },
  },
  plugins: [],
  safelist: [
    "bg-gradient-to-br",
    "from-orange-950",
    "via-orange-900",
    "to-stone-900",
    "bg-white/10",
    "backdrop-blur-md",
    "text-orange-200",
  ],
};
export default config;