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
    to: '/catalogo?plataforma=switch',
    match: (p, s) => p === '/catalogo' && has(s, 'plataforma', 'switch'),
  },
  {
    label: 'Videojuegos',
    to: '/catalogo',
    match: (p, s) => p === '/catalogo' && !s,
  },
  {
    label: 'Consolas',
    to: '/catalogo?categoria=consolas',
    match: (p, s) => p === '/catalogo' && has(s, 'categoria', 'consolas'),
  },
  {
    label: 'Accesorios',
    to: '/catalogo?categoria=accesorios',
    match: (p, s) => p === '/catalogo' && has(s, 'categoria', 'accesorios'),
  },
  { label: 'Usados', to: '/usados', match: (p) => p === '/usados' },
]
