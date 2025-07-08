/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    fontFamily: {
      sans: ['Poppins', 'sans-serif'],
    },
    extend: {
      colors: {
        primary: '#3da35d',
        secondary: '#ff6b35',
      },
      backgroundSize: {
        '200%': '200% 200%',
      },
      animation: {
        'gradient-x': 'gradient-x 6s ease infinite',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': {'background-position': '0% 50%'},
          '50%': {'background-position': '100% 50%'},
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography')
  ],
}
