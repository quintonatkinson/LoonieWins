/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './App.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
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
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
