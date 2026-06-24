/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fbf6',
          100: '#dcf6e9',
          200: '#bcecd4',
          300: '#8cdcba',
          400: '#56c498',
          500: '#32a87a',
          600: '#238860',
          700: '#1e6d4f',
          800: '#1b5640',
          900: '#174735',
          950: '#0c281e',
        }
      }
    },
  },
  plugins: [],
}
