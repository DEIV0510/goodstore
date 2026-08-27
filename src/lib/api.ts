import type { AdminProfile } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Cliente de la API
//
// La API vive en el mismo hosting que la tienda, en /api. No hay servicios
// externos, ni claves, ni configuración: si el sitio está publicado, la API
// está publicada.
//
// La sesión viaja en una cookie que el navegador manda sola. Aquí no se guarda
// ningún token: si se guardara en localStorage, cualquier script inyectado en
// la página podría leerlo. La cookie es HttpOnly y JavaScript no la ve.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = '/api'

export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    public http: number
  ) {
    super(mensaje)
    this.name = 'ErrorApi'
  }
}

interface Opciones {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  cuerpo?: unknown
  /** Parámetros de consulta; los valores undefined se omiten. */
  parametros?: Record<string, string | number | boolean | undefined>
}

export async function api<T = unknown>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const metodo = opciones.metodo ?? 'GET'

  let url = `${BASE}/${ruta.replace(/^\//, '')}`
  if (opciones.parametros) {
    const qs = new URLSearchParams()
    for (const [clave, valor] of Object.entries(opciones.parametros)) {
      if (valor !== undefined) qs.set(clave, String(valor))
    }
    const texto = qs.toString()
    if (texto) url += `?${texto}`
  }

  const cabeceras: Record<string, string> = { Accept: 'application/json' }
  if (opciones.cuerpo !== undefined) {
    cabeceras['Content-Type'] = 'application/json'
  }
  // El servidor exige esta cabecera en todo lo que modifica. Un formulario de
  // otra web puede provocar un POST, pero NO puede añadir una cabecera propia
  // sin pasar antes por una comprobación que este servidor no concede. Es la
  // barrera contra CSRF que acompaña a SameSite=Strict.
  if (metodo !== 'GET') cabeceras['X-GG'] = '1'

  let respuesta: Response
  try {
    respuesta = await fetch(url, {
      method: metodo,
      headers: cabeceras,
      // Sin esto la cookie de sesión no viaja y el panel no reconocería a nadie.
      credentials: 'same-origin',
      body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
    })
  } catch {
    throw new ErrorApi(
      'No se pudo contactar con el servidor. Revisa tu conexión a internet.',
      0
    )
  }

  const tipo = respuesta.headers.get('content-type') ?? ''
  if (!tipo.includes('application/json')) {
    // Respuesta que no es JSON: casi siempre significa que el servidor no está
    // ejecutando PHP y ha devuelto el HTML de la tienda o una página de error.
    if (respuesta.status === 404) {
      throw new ErrorApi(
        'La API no responde en /api. Comprueba que los archivos de la carpeta ' +
          'api se subieron al hosting y que el servidor ejecuta PHP.',
        404
      )
    }
    throw new ErrorApi(
      `El servidor respondió algo inesperado (código ${respuesta.status}).`,
      respuesta.status
    )
  }

  const datos = (await respuesta.json().catch(() => null)) as
    | (T & { error?: string })
    | null

  if (!respuesta.ok) {
    throw new ErrorApi(
      datos?.error ?? `Error del servidor (código ${respuesta.status}).`,
      respuesta.status
    )
  }
  return datos as T
}

/** Subida de archivos: va como multipart, no como JSON. */
export async function apiSubir<T = unknown>(ruta: string, datos: FormData): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(`${BASE}/${ruta.replace(/^\//, '')}`, {
      method: 'POST',
      // El Content-Type lo pone el navegador con su propio separador: fijarlo
      // a mano rompe la subida.
      headers: { Accept: 'application/json', 'X-GG': '1' },
      credentials: 'same-origin',
      body: datos,
    })
  } catch {
    throw new ErrorApi('No se pudo subir el archivo. Revisa tu conexión.', 0)
  }

  const cuerpo = (await respuesta.json().catch(() => null)) as
    | (T & { error?: string })
    | null

  if (!respuesta.ok) {
    throw new ErrorApi(
      cuerpo?.error ?? `No se pudo subir el archivo (código ${respuesta.status}).`,
      respuesta.status
    )
  }
  return cuerpo as T
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado del backend
//
// Se consulta una vez al arrancar y responde a tres preguntas: ¿existe ya un
// administrador?, ¿tengo sesión?, ¿este servidor puede con todo?
// ─────────────────────────────────────────────────────────────────────────────

export interface Diagnostico {
  php: string
  sqlite: boolean
  gd: boolean
  https: boolean
  datosFuera: boolean
  carpetaDatos: string | null
  productos: number
  sembradoAhora: boolean
}

export interface EstadoApi {
  version: string
  instalado: boolean
  rescate: boolean
  sesion: AdminProfile | null
  diagnostico: Diagnostico
  avisos: string[]
}

let cache: EstadoApi | null = null
let enCurso: Promise<EstadoApi> | null = null

export async function consultarEstado(forzar = false): Promise<EstadoApi> {
  if (!forzar && cache) return cache
  // Si dos partes de la aplicación preguntan a la vez, comparten la misma
  // petición en lugar de lanzar dos.
  if (!forzar && enCurso) return enCurso

  enCurso = api<EstadoApi>('estado')
    .then((e) => {
      cache = e
      return e
    })
    .finally(() => {
      enCurso = null
    })

  return enCurso
}

/** Se llama tras entrar, salir o instalar, para que el estado no quede viejo. */
export function olvidarEstado(): void {
  cache = null
}

/** Mensaje legible a partir de cualquier error. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorApi) return error.message
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Ocurrió un error inesperado.'
}
