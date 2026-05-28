/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gh: {
          bg:      '#0d1117',
          surface: '#161b22',
          border:  '#30363d',
          text:    '#e6edf3',
          muted:   '#8b949e',
          accent:  '#1f6feb',
          green:   '#238636',
          red:     '#da3633',
          yellow:  '#9e6a03',
          purple:  '#8957e5',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      }
    },
  },
  plugins: [],
};
