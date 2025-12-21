/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        enterpriseBlue: {
          DEFAULT: "#0f1e45",
        },
      },
    },
  },
  plugins: [],
}
