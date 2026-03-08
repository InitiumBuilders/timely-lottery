import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dash: {
          blue:  '#008DE4',
          light: '#30BFFF',
        },
        cyan: {
          glow: '#00FFFF',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow':    'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float':         'float 6s ease-in-out infinite',
        'glow':          'glow 2s ease-in-out infinite alternate',
        'scan':          'scan 8s linear infinite',
        'ticker':        'ticker 20s linear infinite',
        'spin-slow':     'spin 20s linear infinite',
        'orbit':         'orbit 12s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-20px)' },
        },
        glow: {
          from: { textShadow: '0 0 10px #00FFFF, 0 0 20px #00FFFF' },
          to:   { textShadow: '0 0 20px #00FFFF, 0 0 40px #00FFFF, 0 0 60px #008DE4' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        ticker: {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        orbit: {
          '0%':   { transform: 'rotate(0deg) translateX(120px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(120px) rotate(-360deg)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass':      '0 8px 32px 0 rgba(0,255,255,0.08)',
        'glow-cyan':  '0 0 20px rgba(0,255,255,0.4), 0 0 40px rgba(0,255,255,0.1)',
        'glow-dash':  '0 0 20px rgba(0,141,228,0.4), 0 0 40px rgba(0,141,228,0.1)',
        'glow-sm':    '0 0 10px rgba(0,255,255,0.3)',
        'inner-glow': 'inset 0 0 30px rgba(0,255,255,0.05)',
      },
    },
  },
  plugins: [],
}

export default config
