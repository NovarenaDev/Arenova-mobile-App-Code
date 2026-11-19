/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: '#FF5100', // Vibrant Orange
        secondary: '#0F2C59', // Deep Navy Blue
        background: '#EEF3F9', // Light blue-gray backgroundbluish grey
        card: '#FFFFFF',
        text: {
          DEFAULT: '#111827',
          muted: '#6B7280',
          light: '#9CA3AF'
        },
        border: '#E5E7EB'
      },
      fontFamily: {
        outfit: ['Outfit_400Regular', 'sans-serif'],
        'outfit-medium': ['Outfit_500Medium', 'sans-serif'],
        'outfit-semibold': ['Outfit_600SemiBold', 'sans-serif'],
        'outfit-bold': ['Outfit_700Bold', 'sans-serif'],
      },
      boxShadow: {
        sm: '0 2px 10px -2px rgba(15, 44, 89, 0.08)',
        md: '0 4px 16px -4px rgba(15, 44, 89, 0.12)',
      }
    },
  },
  plugins: [],
}
