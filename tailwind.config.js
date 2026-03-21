/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f3f8',
          100: '#d9e0ed',
          200: '#b3c1db',
          300: '#8da2c9',
          400: '#6783b7',
          500: '#4164a5',
          600: '#2c4f8a',
          700: '#1B365D',
          800: '#142847',
          900: '#0d1a30',
        },
        lotus: {
          50: '#e6f5ed',
          100: '#b3e0c9',
          200: '#80cca6',
          300: '#4db882',
          400: '#1aa35e',
          500: '#00843D',
          600: '#006d32',
          700: '#005627',
          800: '#003f1c',
          900: '#002811',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
