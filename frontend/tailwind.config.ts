export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        pitch:        '#00b341',
        'pitch-dark': '#008f33',
        'pitch-light':'#00e054',
        electric:     '#00ff87',
        gold:         '#f59e0b',
        'gold-dark':  '#d97706',
        'bg-light':   '#f4f7f4',
        'bg-dark':    '#071a0e',
        'bg-pitch':   '#0a1f10',
      },
      fontFamily: {
        headline: ['Bebas Neue', 'sans-serif'],
        body:     ['Outfit', 'sans-serif'],
        mono:     ['JetBrains Mono', 'monospace'],
        sans:     ['Outfit', 'sans-serif'],
      },
      boxShadow: {
        'green-glow': '0 0 40px rgba(0,179,65,0.25)',
        'gold-glow':  '0 0 40px rgba(245,158,11,0.3)',
        'white-glow': '0 0 40px rgba(255,255,255,0.15)',
      },
    },
  },
  plugins: [],
}
