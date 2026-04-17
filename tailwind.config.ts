import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gold: '#C9A84C',
        'gold-bright': '#E2C060',
        'gold-dim': '#8B6E2E',
        ink: '#07080A',
        sophia: {
          bg: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          overlay: 'var(--bg-overlay)',
          glass: 'var(--glass-bg)',
          text: 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          'text-muted': 'var(--text-muted)',
          brand: 'var(--brand-primary)',
          'brand-hover': 'var(--brand-primary-hover)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 300ms ease-out',
        'fade-up': 'fade-up 400ms ease-out',
        'slide-in': 'slide-in 300ms ease-out',
      },
    },
  },
  plugins: [],
}

export default config