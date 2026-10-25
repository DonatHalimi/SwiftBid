/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: { center: true, padding: '1.25rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        brand: {
          50: '#eff8ff',
          100: '#dbeefe',
          500: '#0284c7',
          600: '#0265d2',
          700: '#034da2',
        },
        auction: {
          active: '#10b981',
          ending: '#f59e0b',
          closed: '#ef4444',
          badge: '#8b5cf6',
        },
        dark: {
          bg: '#0f172a',
          card: '#1e293b',
          border: '#334155',
        },

        // Semantic tokens wired to the CSS variables in index.css.
        // The <alpha-value> placeholder lets bg-sage/15, border-line/50, etc. work.
        background: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--color-surface-2) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        border: 'rgb(var(--color-line) / <alpha-value>)', // alias used by .admin-select
        sage: {
          DEFAULT: 'rgb(var(--color-sage) / <alpha-value>)',
          dark: 'rgb(var(--color-sage-dark) / <alpha-value>)',
          bright: 'rgb(var(--color-sage-bright) / <alpha-value>)',
        },
        text: 'rgb(var(--color-text) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.78', transform: 'scale(1.02)' },
        },
        bidFlash: {
          '0%': { backgroundColor: 'rgba(16,185,129,.22)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'bid-flash': 'bidFlash 1s ease-out 1',
      },
    },
  },
  plugins: [],
};