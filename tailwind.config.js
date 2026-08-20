/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Marca GOOD GAME ────────────────────────────────────────────
        // El azul domina la interfaz; el amarillo es el acento de acción.
        blue: {
          50: '#EEF0FF',
          100: '#DCE0FF',
          200: '#B7BEFF',
          300: '#8B95FF',
          400: '#5B67F5',
          500: '#3641DC',
          600: '#2029C4',
          700: '#141BA4',
          800: '#0C1287',
          900: '#070A78', // azul principal del logo
          950: '#04053F', // fondo profundo
        },
        // Azules profundos: el fondo es AZUL, no negro (requisito de marca).
        ink: {
          900: '#070C42', // fondo base de la página
          800: '#091052', // secciones elevadas
          700: '#0C1566', // superficies y tarjetas
          600: '#101B7C',
          500: '#121C85',
        },
        gold: {
          300: '#FFF86B',
          400: '#FFF54D',
          500: '#FFF000', // amarillo gamer del logo
          600: '#E0D300',
          700: '#B8AD00',
        },
        alert: {
          400: '#FF4747',
          500: '#FF1717', // rojo de acento (uso moderado)
          600: '#D40000',
        },
      },
      fontFamily: {
        display: ['Archivo', 'Segoe UI', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
      spacing: {
        13: '3.25rem',
        18: '4.5rem',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        card: '14px',
        xl2: '20px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.65)',
        'card-hover': '0 2px 4px rgba(0,0,0,.45), 0 24px 48px -20px rgba(4,5,63,.95)',
        gold: '0 0 0 1px rgba(255,240,0,.35), 0 10px 30px -12px rgba(255,240,0,.35)',
        inset: 'inset 0 1px 0 0 rgba(255,255,255,.06)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to bottom, rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,.05) 1px, transparent 1px)',
      },
      backgroundSize: { grid: '44px 44px' },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translate3d(0,18px,0)' },
          to: { opacity: '1', transform: 'none' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(.96)' },
          to: { opacity: '1', transform: 'none' },
        },
        'slide-left': {
          from: { transform: 'translate3d(100%,0,0)' },
          to: { transform: 'none' },
        },
        'slide-up': {
          from: { transform: 'translate3d(0,100%,0)' },
          to: { transform: 'none' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        scan: { '0%': { top: '-10%' }, '100%': { top: '110%' } },
        'pulse-ring': {
          '0%': { transform: 'scale(.85)', opacity: '.7' },
          '70%,100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'cart-bump': {
          '0%,100%': { transform: 'scale(1)' },
          '35%': { transform: 'scale(1.28)' },
        },
        marquee: { from: { transform: 'none' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: {
        'fade-up': 'fade-up .55s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in': 'fade-in .4s ease-out both',
        'scale-in': 'scale-in .28s cubic-bezier(0.16,1,0.3,1) both',
        'slide-left': 'slide-left .32s cubic-bezier(0.16,1,0.3,1) both',
        'slide-up': 'slide-up .32s cubic-bezier(0.16,1,0.3,1) both',
        shimmer: 'shimmer 1.6s infinite',
        scan: 'scan 2.2s linear infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.4,0,0.6,1) infinite',
        'cart-bump': 'cart-bump .4s ease-out',
        marquee: 'marquee 38s linear infinite',
      },
    },
  },
  plugins: [],
}
