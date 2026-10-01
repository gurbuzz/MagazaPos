/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#edf3fc',
          100: '#d7e4f9',
          200: '#b5ccf4',
          300: '#86abec',
          400: '#5282e2',
          500: '#2d5ed6',
          600: '#1a44bf',
          700: '#00268A', // Pantone PMS 280 C (Koyu Lacivert)
          800: '#001f70',
          900: '#001754',
          950: '#000e36',
        },
        navy: {
          50: '#f0f5ff',
          100: '#e0ebfe',
          200: '#bae0fd',
          300: '#7cc4fa',
          400: '#38a4f6',
          500: '#0e87ea',
          600: '#026bc9',
          700: '#00268A', // Official Brand Deep Navy
          800: '#001f70',
          900: '#001754',
          950: '#000d33',
        },
        pos: {
          bg: '#f8fafc',
          navy: '#00268A',
          card: '#ffffff',
          accent: '#00268A',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444'
        }
      }
    },
  },
  plugins: [],
}
