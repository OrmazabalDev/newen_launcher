module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          base: '#121212',
          panel: '#1B1E23',
          border: '#2A2E35',
          accent: '#FF8C00',
          'accent-deep': '#B87333',
          info: '#26619C',
        },
        gray: {
          950: '#121212',
          900: '#1B1E23',
          800: '#2A2E35',
          700: '#3A3F47',
          600: '#4B515B',
          500: '#6B7280',
          400: '#9CA3AF',
          300: '#D1D5DB',
          200: '#E5E7EB',
          100: '#F3F4F6',
        },
      },
      fontFamily: {
        ui: ['Rajdhani', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
