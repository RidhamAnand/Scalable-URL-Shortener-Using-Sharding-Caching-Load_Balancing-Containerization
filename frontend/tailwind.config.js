/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        ember: "#f97316",
        mint: "#2dd4bf",
        skyglass: "#0ea5e9"
      },
      boxShadow: {
        glow: "0 0 40px rgba(14, 165, 233, 0.35)"
      }
    }
  },
  plugins: []
};
