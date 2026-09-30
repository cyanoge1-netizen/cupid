/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        status: {
          active: '#16a34a',
          proposal: '#d97706',
          fixed: '#2563eb',
          married: '#6b7280',
          hold: '#9ca3af',
        }
      },
      minHeight: {
        touch: '48px',
      },
      minWidth: {
        touch: '48px',
      },
      fontSize: {
        base: ['16px', '24px'],
      }
    },
  },
  plugins: [],
}
