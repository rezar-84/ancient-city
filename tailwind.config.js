/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
        serif: ['"EB Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        travertine: '#f4efe6',
        parchment: '#efe2c4',
        ink: '#2b2118',
        terracotta: '#b5653f',
        aegean: '#2f6f86',
        gold: '#c9a45c',
      },
    },
  },
  plugins: [],
}
