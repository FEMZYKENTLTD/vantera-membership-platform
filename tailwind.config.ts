import type { Config } from 'tailwindcss';

/**
 * Vantera design tokens.
 * Deep black base, champagne gold accents, warm ivory light surfaces.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1200px' }
    },
    extend: {
      colors: {
        noir: {
          DEFAULT: '#0A0A09',
          950: '#060606',
          900: '#0A0A09',
          850: '#100F0E',
          800: '#161514',
          700: '#1E1C1A',
          600: '#292623'
        },
        gold: {
          50: '#FBF7EE',
          100: '#F5ECD9',
          200: '#EAD9B4',
          300: '#DDC189',
          400: '#CFA967',
          500: '#C6A468',
          600: '#B08D4E',
          700: '#8C6F3E',
          800: '#6B5430',
          900: '#4A3A22',
          DEFAULT: '#C6A468'
        },
        ivory: {
          50: '#FBF9F4',
          100: '#F5F1E8',
          200: '#EAE3D3',
          300: '#DDD2BA',
          DEFAULT: '#F5F1E8'
        },
        border: 'rgba(245, 241, 232, 0.08)',
        'border-light': 'rgba(10, 10, 9, 0.10)',
        success: '#4E7A5A',
        danger: '#A34A3E',
        warning: '#B08A3E',
        info: '#5A6E8C'
      },
      fontFamily: {
        display: [
          'Didot',
          'Bodoni MT',
          'Playfair Display',
          'Georgia',
          'Times New Roman',
          'serif'
        ],
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ]
      },
      letterSpacing: {
        widest2: '0.35em'
      },
      maxWidth: {
        prose: '65ch'
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'fade-up': 'fade-up 0.5s ease-out both'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};

export default config;
