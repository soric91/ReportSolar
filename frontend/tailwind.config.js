/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef4ed',
          100: '#fde8db',
          200: '#fac896',
          300: '#f7b574',
          400: '#f4a152',
          500: '#e68c30',
          600: '#c86400',
          700: '#a84c00',
          800: '#883900',
          900: '#6b2c00',
        },
        secondary: {
          50: '#fef9f5',
          100: '#fdf3eb',
          200: '#fbddc7',
          300: '#f9c7a3',
          400: '#f7b17f',
          500: '#f59b5b',
          600: '#d97f3f',
          700: '#b96633',
          800: '#994d27',
          900: '#79341b',
        },
      },
    },
  },
  plugins: [],
}
