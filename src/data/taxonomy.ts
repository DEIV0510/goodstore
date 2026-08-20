import type { Condition, Genre, Platform } from '@/types'

export const PLATFORMS: { id: Platform; label: string; short: string }[] = [
  { id: 'ps5', label: 'PlayStation 5', short: 'PS5' },
  { id: 'ps4', label: 'PlayStation 4', short: 'PS4' },
  { id: 'switch', label: 'Nintendo Switch', short: 'Switch' },
]

export const platformLabel = (p: Platform) =>
  PLATFORMS.find((x) => x.id === p)?.label ?? p
export const platformShort = (p: Platform) =>
  PLATFORMS.find((x) => x.id === p)?.short ?? p

export const GENRES: { id: Genre; label: string }[] = [
  { id: 'accion', label: 'Acción' },
  { id: 'aventura', label: 'Aventura' },
  { id: 'rpg', label: 'RPG' },
  { id: 'terror', label: 'Terror' },
  { id: 'deportes', label: 'Deportes' },
  { id: 'carreras', label: 'Carreras' },
  { id: 'familiar', label: 'Familiar' },
  { id: 'plataformas', label: 'Plataformas' },
  { id: 'lucha', label: 'Lucha' },
]

export const genreLabel = (g: Genre) => GENRES.find((x) => x.id === g)?.label ?? g

export const CONDITIONS: { id: Condition; label: string }[] = [
  { id: 'nuevo', label: 'Nuevo' },
  { id: 'usado', label: 'Usado' },
  { id: 'consultar', label: 'Por confirmar' },
]

export const conditionLabel = (c: Condition) =>
  CONDITIONS.find((x) => x.id === c)?.label ?? c

export const PRICE_RANGES: { id: string; label: string; min: number; max: number }[] = [
  { id: 'r1', label: 'Menos de $50.000', min: 0, max: 49999 },
  { id: 'r2', label: '$50.000 – $100.000', min: 50000, max: 100000 },
  { id: 'r3', label: '$100.000 – $200.000', min: 100001, max: 200000 },
  { id: 'r4', label: 'Más de $200.000', min: 200001, max: Number.MAX_SAFE_INTEGER },
]

export const SORTS: { id: import('@/types').SortKey; label: string }[] = [
  { id: 'destacados', label: 'Destacados' },
  { id: 'recientes', label: 'Más recientes' },
  { id: 'precio-asc', label: 'Precio: menor a mayor' },
  { id: 'precio-desc', label: 'Precio: mayor a menor' },
  { id: 'nombre', label: 'Nombre (A–Z)' },
]
