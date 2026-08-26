import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Conexión con el backend.
//
// Las credenciales llegan por variables de entorno; NUNCA se escriben aquí.
// La clave anónima está pensada para vivir en el navegador: por sí sola no da
// acceso a nada, porque quien decide qué puede hacer cada quien son las
// políticas de la base de datos (supabase/migrations/0002_permisos.sql).
//
// CARGA DIFERIDA
// La librería de Supabase pesa unos 68 kB comprimidos. Importándola de forma
// normal, ese peso lo pagaba TODO el que abriera la tienda a comprar, aunque
// nunca fuera a usarla. Con `import()` dinámico solo se descarga cuando de
// verdad hace falta: la primera consulta a la base de datos.
//
// Si las variables no están puestas, `cliente()` devuelve null, la tienda
// funciona con el catálogo incluido en el paquete y la librería no se descarga
// jamás. El panel, en ese caso, no finge un inicio de sesión: muestra las
// instrucciones para conectarlo.
// ─────────────────────────────────────────────────────────────────────────────

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/** true cuando hay credenciales y por tanto base de datos real. */
export const backendConfigurado = Boolean(url && anonKey)

let promesa: Promise<SupabaseClient> | null = null

/**
 * Devuelve el cliente, descargando la librería la primera vez.
 * null cuando no hay credenciales configuradas.
 */
export async function cliente(): Promise<SupabaseClient | null> {
  if (!backendConfigurado) return null

  // Se guarda la PROMESA, no el cliente: si dos llamadas coinciden antes de que
  // termine la descarga, ambas esperan a la misma y no se crean dos clientes
  // (dos clientes = dos suscripciones y sesiones que se pisan).
  promesa ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url as string, anonKey as string, {
      auth: {
        // La sesión sobrevive a recargar la página y se renueva sola.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'gg.admin.auth',
      },
    })
  )

  return promesa
}

/**
 * Devuelve el cliente o lanza. Se usa en las funciones de ESCRITURA: si no hay
 * backend no deben fingir que guardaron algo.
 */
export async function exigirBackend(): Promise<SupabaseClient> {
  const db = await cliente()
  if (!db) {
    throw new Error(
      'La base de datos no está conectada. Copia .env.example a .env, ' +
        'pon las credenciales de tu proyecto Supabase y reinicia el servidor.'
    )
  }
  return db
}

/** Mensaje legible a partir de un error de Supabase o de red. */
export function mensajeDeError(error: unknown): string {
  if (!error) return 'Ocurrió un error inesperado.'
  const e = error as { message?: string; code?: string; hint?: string }
  const msg = e.message ?? String(error)

  const traducciones: Record<string, string> = {
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'Email not confirmed': 'Falta confirmar el correo. Revisa tu bandeja de entrada.',
    'User already registered': 'Ya existe una cuenta con ese correo.',
    'Password should be at least 6 characters':
      'La contraseña debe tener al menos 6 caracteres.',
    'For security purposes, you can only request this after 60 seconds':
      'Por seguridad debes esperar un minuto antes de volver a intentarlo.',
    'Failed to fetch':
      'No se pudo contactar con el servidor. Revisa tu conexión a internet.',
  }
  for (const [ingles, español] of Object.entries(traducciones)) {
    if (msg.includes(ingles)) return español
  }

  // Permiso denegado por las políticas de la base de datos.
  if (e.code === '42501' || msg.includes('row-level security')) {
    return 'Tu rol no tiene permiso para hacer este cambio.'
  }
  if (e.code === '23505') {
    return 'Ya existe un registro con ese valor único (revisa el slug o el WhatsApp).'
  }
  return msg
}
