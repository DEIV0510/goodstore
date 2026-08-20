// Tarjetas de la sección "Explora por categoría".
// Las imágenes son portadas reales del inventario fotografiado por el negocio.

export interface CategoryCard {
  id: string
  title: string
  subtitle: string
  href: string
  /** Portadas reales usadas como imagen de la categoría. */
  covers: string[]
  /** Categorías sin inventario confirmado se muestran en estado "Próximamente". */
  soon?: boolean
}

export const categories: CategoryCard[] = [
  {
    id: 'ps5',
    title: 'PlayStation 5',
    subtitle: 'Los lanzamientos más recientes',
    href: '/catalogo?plataforma=ps5',
    covers: [
      '/games/elden-ring-ps5.webp',
      '/games/god-of-war-ragnarok-ps5.webp',
      '/games/hogwarts-legacy-ps5.webp',
    ],
  },
  {
    id: 'ps4',
    title: 'PlayStation 4',
    subtitle: 'Clásicos y grandes exclusivos',
    href: '/catalogo?plataforma=ps4',
    covers: [
      '/games/ghost-of-tsushima-ps4.webp',
      '/games/the-last-of-us-part-ii-ps4.webp',
      '/games/marvels-spider-man-miles-morales-ps4.webp',
    ],
  },
  {
    id: 'switch',
    title: 'Nintendo Switch',
    subtitle: 'Para jugar solo o con toda la familia',
    href: '/catalogo?plataforma=switch',
    covers: [
      '/games/the-legend-of-zelda-breath-of-the-wild-switch.webp',
      '/games/super-mario-odyssey-switch.webp',
      '/games/mario-kart-8-deluxe-switch.webp',
    ],
  },
  {
    id: 'usados',
    title: 'Juegos usados',
    subtitle: 'Compra, venta y entrega como parte de pago',
    href: '/usados',
    covers: [
      '/games/resident-evil-4-portada-clasica-ps4.webp',
      '/games/god-of-war-iii-remastered-ps4.webp',
      '/games/the-last-of-us-remastered-ps4.webp',
    ],
  },
  {
    id: 'consolas',
    title: 'Consolas',
    subtitle: 'PlayStation y Nintendo Switch',
    href: '/catalogo?categoria=consolas',
    covers: [],
    soon: true,
  },
  {
    id: 'accesorios',
    title: 'Controles y accesorios',
    subtitle: 'Controles, cables y complementos',
    href: '/catalogo?categoria=accesorios',
    covers: [],
    soon: true,
  },
]
