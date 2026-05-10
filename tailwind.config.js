/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand palette
        brand: {
          50: '#e0fffe',
          100: '#b3fffd',
          200: '#7dfffe',
          300: '#3dfffd',
          400: '#00eeff',
          500: '#00d2ff',  // primary accent — electric teal
          600: '#00a8cc',
          700: '#007899',
          800: '#005066',
          900: '#002c38',
        },
        surface: {
          950: '#07090f',
          900: '#0d1117',
          800: '#131922',
          700: '#1a2332',
          600: '#223044',
          500: '#2c3e52',
        },
        muted: '#6b7a90',
        border: '#1e2d3d',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(0,210,255,0.15)',
        'glow-lg': '0 0 40px rgba(0,210,255,0.2)',
        card: '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
