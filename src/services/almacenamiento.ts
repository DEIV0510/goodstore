import { cliente, exigirBackend } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Subida de imágenes.
//
// Las fotos van al almacenamiento de Supabase y en la base de datos queda solo
// la URL. Guardar imágenes dentro de la base la vuelve lenta y cara de
// respaldar, y complica servirlas con caché.
// ─────────────────────────────────────────────────────────────────────────────

export const DEPOSITO = 'gg-media'

export type Carpeta = 'productos' | 'categorias' | 'banners' | 'marca'

const TIPOS_ACEPTADOS = [
  'image/webp',
  'image/png',
  'image/jpeg',
  'image/avif',
  'image/svg+xml',
]
const TAMANO_MAXIMO = 5 * 1024 * 1024 // 5 MB

/** Nombre de archivo seguro: sin tildes, espacios ni caracteres raros. */
function nombreSeguro(original: string): string {
  const punto = original.lastIndexOf('.')
  const base = punto > 0 ? original.slice(0, punto) : original
  const ext = punto > 0 ? original.slice(punto).toLowerCase() : ''
  const limpio = base
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // quita las tildes que NFD dejó sueltas
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  // Sufijo de tiempo: evita pisar una imagen anterior que otro producto use.
  return `${limpio || 'imagen'}-${Date.now().toString(36)}${ext}`
}

export function validarImagen(archivo: File): string | null {
  if (!TIPOS_ACEPTADOS.includes(archivo.type)) {
    return 'Formato no admitido. Usa WebP, PNG, JPG, AVIF o SVG.'
  }
  if (archivo.size > TAMANO_MAXIMO) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1)
    return `La imagen pesa ${mb} MB y el máximo son 5 MB.`
  }
  return null
}

/** Sube una imagen y devuelve su URL pública. */
export async function subirImagen(
  archivo: File,
  carpeta: Carpeta = 'productos'
): Promise<string> {
  const problema = validarImagen(archivo)
  if (problema) throw new Error(problema)

  const db = await exigirBackend()
  const ruta = `${carpeta}/${nombreSeguro(archivo.name)}`

  const { error } = await db.storage.from(DEPOSITO).upload(ruta, archivo, {
    cacheControl: '31536000',
    upsert: false,
    contentType: archivo.type,
  })
  if (error) throw error

  const { data } = db.storage.from(DEPOSITO).getPublicUrl(ruta)
  return data.publicUrl
}

/**
 * Borra una imagen del almacenamiento a partir de su URL pública.
 * Las portadas que vienen con el sitio (`/games/...`) no viven en el
 * almacenamiento: para esas no hay nada que borrar.
 */
export async function eliminarImagen(url: string): Promise<void> {
  const db = await cliente()
  if (!db || !url.includes(`/${DEPOSITO}/`)) return
  const ruta = url.split(`/${DEPOSITO}/`)[1]?.split('?')[0]
  if (!ruta) return
  await db.storage.from(DEPOSITO).remove([decodeURIComponent(ruta)])
}

/** Lee el tamaño real de una imagen para guardarlo y evitar saltos de maquetación. */
export function medirImagen(archivo: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolver) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolver({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolver(null)
    }
    img.src = url
  })
}
