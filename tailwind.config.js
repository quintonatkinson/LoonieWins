/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Channel form so bg-win/20 etc. track the active accent */
        win: 'rgb(var(--color-win) / <alpha-value>)',
        'on-win': 'rgb(var(--color-on-win) / <alpha-value>)',
        earn: 'rgb(var(--color-earn) / <alpha-value>)',
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
