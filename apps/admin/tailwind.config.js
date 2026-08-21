// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/button/dist/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/date-picker/dist/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/drawer/dist/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/dropdown/dist/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/input/dist/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/modal/dist/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/pagination/dist/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/progress/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [],
};
