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
        zn: {
          // Page / surface
          page:        '#F4F5F7',
          surface:     '#FFFFFF',
          'surface-2': '#F8F9FA',
          'surface-3': '#F0F1F3',
          // Borders
          border:      '#E5E7EB',
          'border-2':  '#D1D5DB',
          // Gold (Z letterform — brand primary)
          gold:        '#C9A96E',
          'gold-dark': '#A8843A',
          'gold-dim':  '#8B7149',
          // Silver (N letterform)
          silver:      '#6B7280',
          'silver-dim':'#9CA3AF',
          // Text
          'text-1':    '#111827',
          'text-2':    '#4B5563',
          'text-3':    '#9CA3AF',
          // Sidebar
          sidebar:     '#111827',
          'sidebar-2': '#1F2937',
          // Semantic
          success:     '#059669',
          warning:     '#D97706',
          danger:      '#DC2626',
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        md:  '8px',
        lg:  '12px',
        xl:  '16px',
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
    },
  },
  plugins: [],
}

export default config
