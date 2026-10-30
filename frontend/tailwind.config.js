/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#090a0f',
        surface: {
          DEFAULT: '#11131a',
          hover: '#171a24',
          active: '#1e2230',
          border: '#242938',
        },
        primary: {
          DEFAULT: '#4f46e5',
          hover: '#4338ca',
          light: '#6366f1',
          subtle: 'rgba(79, 70, 229, 0.1)',
        },
        accent: {
          DEFAULT: '#06b6d4',
          subtle: 'rgba(6, 182, 212, 0.1)',
        },
        success: {
          DEFAULT: '#10b981',
          subtle: 'rgba(16, 185, 129, 0.12)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          subtle: 'rgba(245, 158, 11, 0.12)',
        },
        danger: {
          DEFAULT: '#ef4444',
          subtle: 'rgba(239, 68, 68, 0.12)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
