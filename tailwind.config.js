/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#fc6603",
          light: "#fd8535",
          dark: "#d95200",
        },
      },
    },
  },
  plugins: [],
};
