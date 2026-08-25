import { coversBySlug } from './covers'

// Tarjetas de la sección "Explora por categoría".
// Las portadas se referencian por SLUG de producto, no por nombre de archivo:
// así no se rompen cuando se corrige el nombre de un juego.

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
    covers: coversBySlug([
      'elden-ring-ps5',
      'god-of-war-ragnarok-ps5',
      'hogwarts-legacy-ps5',
    ]),
  },
  {
    id: 'ps4',
    title: 'PlayStation 4',
    subtitle: 'Clásicos y grandes exclusivos',
    href: '/catalogo?plataforma=ps4',
    covers: coversBySlug([
      'ghost-of-tsushima-ps4',
      'the-last-of-us-part-ii-ps4',
      'marvels-spider-man-miles-morales-ps4',
    ]),
  },
  {
    id: 'switch',
    title: 'Nintendo Switch',
    subtitle: 'Para jugar solo o con toda la familia',
    href: '/catalogo?plataforma=switch',
    covers: coversBySlug([
      'the-legend-of-zelda-breath-of-the-wild-switch',
      'super-mario-odyssey-switch',
      'mario-kart-8-deluxe-switch',
    ]),
  },
  {
    id: 'switch2',
    title: 'Nintendo Switch 2',
    subtitle: 'Lo nuevo de la consola de Nintendo',
    href: '/catalogo?plataforma=switch2',
    covers: coversBySlug([
      'pokemon-legends-z-a-switch-2-edition-switch2',
      'resident-evil-requiem-switch2',
      'mario-kart-world-switch2',
    ]),
  },
  {
    id: 'usados',
    title: 'Juegos usados',
    subtitle: 'Precios más bajos, mismos títulos',
    href: '/catalogo?estado=usado',
    covers: coversBySlug([
      'the-last-of-us-remasterizado-ps4',
      'god-of-war-iii-remastered-ps4',
      'rayman-legends-ps4',
    ]),
  },
  {
    id: 'accesorios',
    title: 'Controles y accesorios',
    subtitle: 'Controles, memorias y complementos',
    href: '/catalogo?categoria=accesorios',
    covers: [],
  },
]
