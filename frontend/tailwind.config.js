/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        glow: {
          orange: '#ff7b00',
          amber: '#ff9d3f',
          agent: '#00d4ff',
        }
      },
      boxShadow: {
        'hologram': '0 0 15px rgba(255, 123, 0, 0.15)',
        'hologram-bright': '0 0 25px rgba(255, 123, 0, 0.45)',
        'agent': '0 0 20px rgba(0, 212, 255, 0.25)',
        'agent-bright': '0 0 35px rgba(0, 212, 255, 0.5)',
      },
      animation: {
        'spin-slow': 'spin 6s linear infinite',
      },
      fontFamily: {
        'mono': ['"JetBrains Mono"', '"Courier New"', 'monospace'],
        'sans': ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
