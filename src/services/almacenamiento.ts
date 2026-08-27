import { api, apiSubir } from '@/lib/api'

// ─────────────────────────────────────────────────────────────────────────────
// Subida de imágenes.
//
// Las fotos van a una carpeta del propio hosting y en la base de datos queda
// solo la URL. Guardar imágenes dentro de la base la vuelve lenta y cara de
// respaldar, y complica servirlas con caché.
//
// La validación de verdad la hace el servidor: comprueba el tipo real leyendo
// el CONTENIDO del archivo, no la extensión ni lo que diga el navegador, y le
// pone él mismo un nombre nuevo. Lo de aquí solo sirve para avisar antes de
// gastar la subida.
// ─────────────────────────────────────────────────────────────────────────────

export type Carpeta = 'productos' | 'categorias' | 'banners' | 'marca'

const TIPOS_ACEPTADOS = ['image/webp', 'image/png', 'image/jpeg', 'image/avif']
const TAMANO_MAXIMO = 5 * 1024 * 1024 // 5 MB

export function validarImagen(archivo: File): string | null {
  if (!TIPOS_ACEPTADOS.includes(archivo.type)) {
    return 'Formato no admitido. Usa WebP, PNG, JPG o AVIF.'
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

  const datos = new FormData()
  datos.append('archivo', archivo)
  datos.append('carpeta', carpeta)

  const r = await apiSubir<{ url: string }>('medios', datos)
  return r.url
}

/**
 * Borra una imagen del hosting.
 * Las portadas que vienen con el sitio (`/games/...`) no se tocan: son parte
 * del paquete publicado, no del almacén de subidas.
 */
export async function eliminarImagen(url: string): Promise<void> {
  if (!url.startsWith('/medios/')) return
  await api('medios', { metodo: 'DELETE', cuerpo: { url } })
}

/** Lee el tamaño real de una imagen para reservar su espacio y evitar saltos. */
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
