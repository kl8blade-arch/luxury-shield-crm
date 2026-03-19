import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: '#C9A84C',
        'gold-bright': '#E2C060',
        'gold-dim': '#8B6E2E',
        ink: '#07080A',
      },
    },
  },
  plugins: [],
}

export default config