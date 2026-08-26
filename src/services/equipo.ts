import { cliente, exigirBackend } from '@/lib/supabase'
import { perfilDesdeFila } from './autenticacion'
import type { AdminProfile, AdminRole, AuditEntry } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Administradores e historial de cambios.
//
// Un administrador NO se crea desde aquí escribiendo una contraseña: se le
// envía una invitación por correo y él elige su clave. Así ninguna contraseña
// pasa por esta aplicación en ningún momento.
// ─────────────────────────────────────────────────────────────────────────────

export async function listarAdministradores(): Promise<AdminProfile[]> {
  const db = await cliente()
  if (!db) return []
  const { data, error } = await db
    .from('profiles')
    .select('id, email, name, role, status, last_login_at, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(perfilDesdeFila)
}

export async function cambiarRol(id: string, rol: AdminRole): Promise<void> {
  const db = await exigirBackend()
  const { error } = await db.from('profiles').update({ role: rol }).eq('id', id)
  if (error) throw error
}

export async function cambiarEstadoAdmin(
  id: string,
  estado: 'activo' | 'suspendido'
): Promise<void> {
  const db = await exigirBackend()
  const { error } = await db.from('profiles').update({ status: estado }).eq('id', id)
  if (error) throw error
}

/**
 * Invita a un nuevo administrador por correo.
 *
 * Se usa el flujo de recuperación de contraseña porque la invitación directa
 * exige la clave de servicio, que jamás debe estar en el navegador. La persona
 * recibe un enlace, define su contraseña y entra con el rol 'editor'; luego un
 * super administrador lo asciende si corresponde.
 */
export async function invitarAdministrador(email: string): Promise<void> {
  const db = await exigirBackend()
  const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/admin/nueva-clave`,
  })
  if (error) throw error
}

// ── Historial ────────────────────────────────────────────────────────────────

interface FilaLog {
  id: number
  actor_id: string | null
  actor_name: string
  action: AuditEntry['action']
  entity: string
  entity_id: string | null
  label: string
  detail: Record<string, { antes: unknown; ahora: unknown }> | null
  created_at: string
}

const logDesdeFila = (f: FilaLog): AuditEntry => ({
  id: f.id,
  actorId: f.actor_id,
  actorName: f.actor_name,
  action: f.action,
  entity: f.entity,
  entityId: f.entity_id,
  label: f.label,
  detail: f.detail ?? {},
  createdAt: f.created_at,
})

export async function listarHistorial(
  opciones: { limite?: number; entidad?: string } = {}
): Promise<AuditEntry[]> {
  const db = await cliente()
  if (!db) return []

  let consulta = db
    .from('admin_logs')
    .select('id, actor_id, actor_name, action, entity, entity_id, label, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(opciones.limite ?? 200)

  if (opciones.entidad) consulta = consulta.eq('entity', opciones.entidad)

  const { data, error } = await consulta
  if (error) throw error
  return (data as unknown as FilaLog[]).map(logDesdeFila)
}

/** Nombres legibles de las tablas para el historial. */
export const ETIQUETA_ENTIDAD: Record<string, string> = {
  products: 'producto',
  categories: 'categoría',
  banners: 'banner',
  faq: 'pregunta frecuente',
  site_content: 'contenido',
  settings: 'configuración',
  whatsapp_settings: 'WhatsApp',
  orders: 'pedido',
  customers: 'cliente',
  profiles: 'administrador',
  sesion: 'sesión',
}

/** Nombres legibles de los campos, para no mostrar `old_price` al usuario. */
export const ETIQUETA_CAMPO: Record<string, string> = {
  name: 'nombre',
  slug: 'slug',
  price: 'precio',
  old_price: 'precio anterior',
  stock: 'stock',
  status: 'estado',
  featured: 'destacado',
  platform: 'plataforma',
  category: 'categoría',
  genre: 'género',
  condition: 'estado del producto',
  region: 'región',
  description: 'descripción',
  images: 'imágenes',
  tags: 'etiquetas',
  sku: 'SKU',
  active: 'activo',
  title: 'título',
  subtitle: 'subtítulo',
  question: 'pregunta',
  answer: 'respuesta',
  sort_order: 'orden',
  role: 'rol',
  on_sale: 'en oferta',
  new_release: 'lanzamiento',
  best_seller: 'más vendido',
  value: 'valor',
}

/** Frase corta que describe una entrada del historial. */
export function describirEntrada(e: AuditEntry): string {
  const entidad = ETIQUETA_ENTIDAD[e.entity] ?? e.entity
  const nombre = e.label ? ` «${e.label}»` : ''
  switch (e.action) {
    case 'crear':
      return `creó ${entidad}${nombre}`
    case 'eliminar':
      return `eliminó ${entidad}${nombre}`
    case 'acceso':
      return 'inició sesión'
    default: {
      const campos = Object.keys(e.detail).map((c) => ETIQUETA_CAMPO[c] ?? c)
      if (campos.length === 0) return `actualizó ${entidad}${nombre}`
      const lista =
        campos.length <= 3
          ? campos.join(', ')
          : `${campos.slice(0, 3).join(', ')} y ${campos.length - 3} campo(s) más`
      return `cambió ${lista} de ${entidad}${nombre}`
    }
  }
}
