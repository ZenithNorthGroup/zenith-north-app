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
        // Brand colors from ZN logo
        zn: {
          black:       '#0E0E0E',
          surface:     '#131313',
          'surface-2': '#1A1A1A',
          'surface-3': '#222222',
          border:      '#2A2A2A',
          'border-2':  '#363636',
          // Gold — from Z letterform
          gold:        '#C9A96E',
          'gold-dim':  '#8B7149',
          // Silver — from N letterform
          silver:      '#D4D8DC',
          'silver-dim':'#8A9099',
          // Text scale
          'text-1':    '#E8EAE8',
          'text-2':    '#8A9099',
          'text-3':    '#4A5260',
          // Semantic
          success:     '#4D9E6E',
          warning:     '#C4882A',
          danger:      '#B84040',
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '4px',
        md: '6px',
        lg: '10px',
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs:    ['11px', '16px'],
        sm:    ['12px', '18px'],
        base:  ['13px', '20px'],
        md:    ['14px', '20px'],
        lg:    ['16px', '24px'],
        xl:    ['18px', '26px'],
        '2xl': ['20px', '28px'],
      },
      keyframes: {
        pulse: {
          '0%':   { opacity: '0.8', transform: 'scale(0.6)' },
          '100%': { opacity: '0',   transform: 'scale(2)' },
        },
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'ping-slow':  'pulse 2.8s ease-out infinite',
        'fade-in':    'fade-in 0.15s ease-out',
      },
    },
  },
  plugins: [],
}

export default config
