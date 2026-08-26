import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { subirImagen, medirImagen, validarImagen, type Carpeta } from '@/services/almacenamiento'
import { useAvisos } from './Avisos'

// ─────────────────────────────────────────────────────────────────────────────
// Gestor de imágenes de un producto.
//
// La primera imagen es la portada: es la que sale en el catálogo y en el
// carrito, así que se puede reordenar para elegir cuál va delante.
//
// Un producto sin imagen NO es un error: la tienda dibuja una portada de marca
// con su título. Nunca se le pone la carátula de otro juego.
// ─────────────────────────────────────────────────────────────────────────────

export function GestorImagenes({
  imagenes,
  onChange,
  carpeta = 'productos',
  onMedida,
  maximo = 6,
}: {
  imagenes: string[]
  onChange: (urls: string[]) => void
  carpeta?: Carpeta
  /** Tamaño real de la portada, para reservar su espacio y evitar saltos. */
  onMedida?: (m: { w: number; h: number }) => void
  maximo?: number
}) {
  const avisos = useAvisos()
  const [subiendo, setSubiendo] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  async function alElegir(archivos: FileList | null) {
    if (!archivos || archivos.length === 0) return

    const hueco = maximo - imagenes.length
    if (hueco <= 0) {
      avisos.aviso(`Ya hay ${maximo} imágenes. Elimina alguna para añadir otra.`)
      return
    }

    const lista = [...archivos].slice(0, hueco)
    if (archivos.length > hueco) {
      avisos.aviso(`Solo caben ${hueco} imagen(es) más; el resto se omitió.`)
    }

    setSubiendo(true)
    const nuevas: string[] = []
    try {
      for (const archivo of lista) {
        const problema = validarImagen(archivo)
        if (problema) {
          avisos.aviso(`${archivo.name}: ${problema}`)
          continue
        }
        const url = await subirImagen(archivo, carpeta)
        nuevas.push(url)

        // Solo se mide la que va a quedar de portada.
        if (onMedida && imagenes.length === 0 && nuevas.length === 1) {
          const medida = await medirImagen(archivo)
          if (medida) onMedida(medida)
        }
      }
      if (nuevas.length > 0) {
        onChange([...imagenes, ...nuevas])
        avisos.exito(
          nuevas.length === 1 ? 'Imagen subida.' : `${nuevas.length} imágenes subidas.`
        )
      }
    } catch (e) {
      avisos.error(e)
    } finally {
      setSubiendo(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  function mover(desde: number, hacia: number) {
    if (hacia < 0 || hacia >= imagenes.length) return
    const copia = [...imagenes]
    const [sacada] = copia.splice(desde, 1)
    copia.splice(hacia, 0, sacada)
    onChange(copia)
  }

  /**
   * Quita la imagen de la ficha pero NO la borra del almacenamiento: puede
   * estar en uso en otro producto. La limpieza del depósito es una decisión
   * aparte y consciente.
   */
  function quitar(i: number) {
    onChange(imagenes.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="adm-label mb-0">Imágenes</span>
        <span className="text-[12px] text-slate-400">
          {imagenes.length} de {maximo}
        </span>
      </div>

      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {imagenes.map((url, i) => (
          <li
            key={`${url}-${i}`}
            className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
          >
            <span className="block aspect-[3/4]">
              <img
                src={url}
                alt={i === 0 ? 'Portada del producto' : `Imagen ${i + 1}`}
                className="h-full w-full object-contain p-1.5"
                loading="lazy"
              />
            </span>

            {i === 0 && (
              <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-black uppercase text-ink-900">
                <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                Portada
              </span>
            )}

            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-white/95 p-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => mover(i, i - 1)}
                disabled={i === 0}
                aria-label={`Mover la imagen ${i + 1} hacia la izquierda`}
                className="grid h-8 w-8 place-items-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => mover(i, i + 1)}
                disabled={i === imagenes.length - 1}
                aria-label={`Mover la imagen ${i + 1} hacia la derecha`}
                className="grid h-8 w-8 place-items-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              >
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => quitar(i)}
                aria-label={`Quitar la imagen ${i + 1}`}
                className="grid h-8 w-8 place-items-center rounded text-alert-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}

        {imagenes.length < maximo && (
          <li>
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              disabled={subiendo}
              className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 disabled:opacity-50"
            >
              {subiendo ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <ImagePlus className="h-5 w-5" aria-hidden="true" />
              )}
              <span className="text-[11.5px] font-semibold">
                {subiendo ? 'Subiendo…' : 'Añadir'}
              </span>
            </button>
          </li>
        )}
      </ul>

      <input
        ref={entrada}
        type="file"
        accept="image/webp,image/png,image/jpeg,image/avif"
        multiple
        aria-label="Seleccionar imágenes del producto"
        onChange={(e) => void alElegir(e.target.files)}
        className="sr-only"
        tabIndex={-1}
      />

      <p className="adm-ayuda">
        WebP, PNG, JPG o AVIF, hasta 5 MB. La primera imagen es la portada. Sin
        imágenes, la tienda dibuja una portada de marca con el nombre del producto.
      </p>
    </div>
  )
}

/** Subida de una sola imagen (categorías, banners, logo). */
export function SubirUna({
  url,
  onChange,
  carpeta,
  label,
  ayuda,
  proporcion = 'aspect-[16/7]',
}: {
  url: string | null
  onChange: (url: string | null) => void
  carpeta: Carpeta
  label: string
  ayuda?: string
  proporcion?: string
}) {
  const avisos = useAvisos()
  const [subiendo, setSubiendo] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  async function alElegir(archivo: File | undefined) {
    if (!archivo) return
    const problema = validarImagen(archivo)
    if (problema) {
      avisos.aviso(problema)
      return
    }
    setSubiendo(true)
    try {
      onChange(await subirImagen(archivo, carpeta))
      avisos.exito('Imagen subida.')
    } catch (e) {
      avisos.error(e)
    } finally {
      setSubiendo(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  return (
    <div>
      <span className="adm-label">{label}</span>
      {url ? (
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <img src={url} alt="" className={`w-full object-cover ${proporcion}`} />
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              className="rounded-md bg-white/95 px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 shadow hover:bg-white"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label="Quitar la imagen"
              className="grid h-8 w-8 place-items-center rounded-md bg-white/95 text-alert-600 shadow hover:bg-white"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={subiendo}
          className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 disabled:opacity-50 ${proporcion}`}
        >
          {subiendo ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
          )}
          <span className="text-[12px] font-semibold">
            {subiendo ? 'Subiendo…' : 'Subir imagen'}
          </span>
        </button>
      )}
      <input
        ref={entrada}
        type="file"
        accept="image/webp,image/png,image/jpeg,image/avif,image/svg+xml"
        aria-label={`Seleccionar ${label.toLowerCase()}`}
        onChange={(e) => void alElegir(e.target.files?.[0])}
        className="sr-only"
        tabIndex={-1}
      />
      {ayuda && <p className="adm-ayuda">{ayuda}</p>}
    </div>
  )
}
