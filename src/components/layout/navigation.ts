export interface NavItem {
  label: string
  to: string
  /** Coincidencia para marcar el enlace activo. */
  match?: (path: string, search: string) => boolean
}

const has = (search: string, key: string, value: string) =>
  (new URLSearchParams(search).get(key) ?? '').split(',').includes(value)

export const NAV: NavItem[] = [
  { label: 'Inicio', to: '/', match: (p) => p === '/' },
  {
    label: 'PlayStation',
    to: '/catalogo?plataforma=ps5,ps4',
    match: (p, s) => p === '/catalogo' && (has(s, 'plataforma', 'ps5') || has(s, 'plataforma', 'ps4')),
  },
  {
    label: 'Nintendo Switch',
    to: '/catalogo?plataforma=switch,switch2',
    match: (p, s) =>
      p === '/catalogo' && (has(s, 'plataforma', 'switch') || has(s, 'plataforma', 'switch2')),
  },
  {
    label: 'Videojuegos',
    to: '/catalogo',
    match: (p, s) => p === '/catalogo' && !s,
  },
  {
    label: 'Usados',
    to: '/catalogo?estado=usado',
    match: (p, s) => p === '/catalogo' && has(s, 'estado', 'usado'),
  },
  {
    label: 'Accesorios',
    to: '/catalogo?categoria=accesorios',
    match: (p, s) => p === '/catalogo' && has(s, 'categoria', 'accesorios'),
  },
  { label: 'Vender mi juego', to: '/usados', match: (p) => p === '/usados' },
]
