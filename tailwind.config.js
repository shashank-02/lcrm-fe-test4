/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        bg: 'rgb(var(--bg-rgb) / <alpha-value>)', surface: 'rgb(var(--surface-rgb) / <alpha-value>)', 'surface-2': 'rgb(var(--surface-2-rgb) / <alpha-value>)', line: 'rgb(var(--border-rgb) / <alpha-value>)',
        ink: 'rgb(var(--text-rgb) / <alpha-value>)', 'ink-2': 'rgb(var(--text-2-rgb) / <alpha-value>)', 'ink-3': 'rgb(var(--text-3-rgb) / <alpha-value>)',
        primary: 'rgb(var(--primary-rgb) / <alpha-value>)', 'primary-hover': 'rgb(var(--primary-hover-rgb) / <alpha-value>)', 'primary-soft': 'rgb(var(--primary-soft-rgb) / <alpha-value>)', navy: 'rgb(var(--navy-rgb) / <alpha-value>)',
        success: 'rgb(var(--success-rgb) / <alpha-value>)', warning: 'rgb(var(--warning-rgb) / <alpha-value>)', danger: 'rgb(var(--danger-rgb) / <alpha-value>)', info: 'rgb(var(--info-rgb) / <alpha-value>)',
      },
      boxShadow: { pop: '0 8px 24px -8px rgba(20,33,61,.18), 0 2px 6px -2px rgba(20,33,61,.08)' },
      borderRadius: { md: '6px', lg: '10px' },
    },
  },
  plugins: [],
};
