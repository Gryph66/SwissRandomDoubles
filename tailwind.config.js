/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Crokinole-inspired palette - warm wood tones with accent colors
        'crok': {
          50: '#fdf8f3',
          100: '#f9ede0',
          200: '#f2d9bf',
          300: '#e9be94',
          400: '#de9d67',
          500: '#d58348',
          600: '#c76c3d',
          700: '#a55434',
          800: '#854530',
          900: '#6c3a29',
          950: '#3a1c13',
        },
        'board': {
          light: '#d4a574',
          medium: '#b8956e',
          dark: '#8b6914',
          ring: '#1a1a1a',
        },
      },
      fontFamily: {
        'display': ['Instrument Sans', 'system-ui', 'sans-serif'],
        'body': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

