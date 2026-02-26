/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        win: '#39FF14',
        earn: '#FFD700',
        surface: {
          DEFAULT: '#1F2937',
          light: '#374151',
        },
      },
      backgroundColor: {
        glass: 'rgba(31, 41, 55, 0.8)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
