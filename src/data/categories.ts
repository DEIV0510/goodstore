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
      '/games/the-last-of-us-2-ps4.webp',
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
    id: 'switch2',
    title: 'Nintendo Switch 2',
    subtitle: 'Lo nuevo de la consola de Nintendo',
    href: '/catalogo?plataforma=switch2',
    covers: [
      '/games/pokemon-legends-z-a-switch-2-edition-switch2.webp',
      '/games/resident-evil-9-switch2.webp',
      '/games/yoshi-and-the-mysterious-book-switch2.webp',
    ],
  },
  {
    id: 'usados',
    title: 'Juegos usados',
    subtitle: 'Precios más bajos, mismos títulos',
    href: '/catalogo?estado=usado',
    covers: [
      '/games/the-last-of-us-remastered-ps4.webp',
      '/games/god-of-war-3-ps4.webp',
      '/games/rayman-ps4.webp',
    ],
  },
  {
    id: 'accesorios',
    title: 'Controles y accesorios',
    subtitle: 'Controles, memorias y complementos',
    href: '/catalogo?categoria=accesorios',
    covers: [],
  },
]
