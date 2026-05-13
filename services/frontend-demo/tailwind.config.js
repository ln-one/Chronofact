/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      boxShadow: {
        card: "0 12px 30px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
