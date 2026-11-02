import type { Config } from 'tailwindcss'
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { ink: '#1c2733', paper: '#eef0f2', rule: '#d5dae0', brand: '#1d4e5f', warn: '#a15c07' } } },
  plugins: [],
} satisfies Config
