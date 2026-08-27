import { api } from '@/lib/api'
import type { AdminProfile, AdminRole, AuditEntry } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Administradores e historial de cambios.
//
// Un administrador NO se crea escribiéndole una contraseña: se le entrega un
// código de recuperación que él canjea por la suya. Así ninguna contraseña
// ajena pasa nunca por las manos de otra persona.
// ─────────────────────────────────────────────────────────────────────────────

export async function listarAdministradores(): Promise<AdminProfile[]> {
  const r = await api<{ administradores: AdminProfile[] }>('equipo')
  return r.administradores
}

/**
 * Da de alta un administrador y devuelve su código de recuperación, que se
 * muestra UNA sola vez. Con él, esa persona entra y elige su contraseña.
 */
export async function crearAdministrador(
  email: string,
  nombre: string,
  rol: AdminRole
): Promise<{ administrador: AdminProfile; codigo: string }> {
  return api<{ administrador: AdminProfile; codigo: string }>('equipo', {
    metodo: 'POST',
    cuerpo: { email: email.trim(), nombre, rol },
  })
}

export async function cambiarRol(id: string, rol: AdminRole): Promise<void> {
  await api(`equipo/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: { rol } })
}

export async function cambiarEstadoAdmin(
  id: string,
  estado: 'activo' | 'suspendido'
): Promise<void> {
  await api(`equipo/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: { estado } })
}

export async function eliminarAdministrador(id: string): Promise<void> {
  await api(`equipo/${encodeURIComponent(id)}`, { metodo: 'DELETE' })
}

/** Código nuevo para alguien que perdió el suyo. Se muestra una sola vez. */
export async function regenerarCodigo(id: string): Promise<string> {
  const r = await api<{ codigo: string }>(`equipo/${encodeURIComponent(id)}/codigo`, {
    metodo: 'POST',
  })
  return r.codigo
}

// ── Historial ────────────────────────────────────────────────────────────────

export async function listarHistorial(
  opciones: { limite?: number; entidad?: string } = {}
): Promise<AuditEntry[]> {
  const r = await api<{ historial: AuditEntry[] }>('historial', {
    parametros: { limite: opciones.limite, entidad: opciones.entidad },
  })
  return r.historial
}

/** Nombres legibles de las tablas, para el historial. */
export const ETIQUETA_ENTIDAD: Record<string, string> = {
  productos: 'producto',
  categorias: 'categoría',
  banners: 'banner',
  preguntas: 'pregunta frecuente',
  contenido: 'contenido',
  ajustes: 'configuración',
  whatsapp: 'WhatsApp',
  pedidos: 'pedido',
  clientes: 'cliente',
  usuarios: 'administrador',
  medios: 'imagen',
  sesion: 'sesión',
}

/** Nombres legibles de los campos, para no mostrar `precio_antes` al usuario. */
export const ETIQUETA_CAMPO: Record<string, string> = {
  nombre: 'nombre',
  slug: 'slug',
  precio: 'precio',
  precio_antes: 'precio anterior',
  stock: 'stock',
  estado: 'estado',
  estado_copia: 'estado del producto',
  destacado: 'destacado',
  plataforma: 'plataforma',
  categoria: 'categoría',
  genero: 'género',
  region: 'región',
  descripcion: 'descripción',
  imagenes: 'imágenes',
  etiquetas: 'etiquetas',
  sku: 'SKU',
  activa: 'activa',
  activo: 'activo',
  titulo: 'título',
  subtitulo: 'subtítulo',
  pregunta: 'pregunta',
  respuesta: 'respuesta',
  orden: 'orden',
  rol: 'rol',
  oferta: 'en oferta',
  lanzamiento: 'lanzamiento',
  mas_vendido: 'más vendido',
  valor: 'valor',
  enlace: 'enlace',
  imagen: 'imagen',
  portadas: 'portadas',
  nota: 'nota',
  notas: 'notas',
  envio: 'envío',
  total: 'total',
  pago: 'método de pago',
  whatsapp: 'WhatsApp',
  ciudad: 'ciudad',
  email: 'correo',
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
      const campos = Object.keys(e.detail ?? {}).map((c) => ETIQUETA_CAMPO[c] ?? c)
      if (campos.length === 0) return `actualizó ${entidad}${nombre}`
      const lista =
        campos.length <= 3
          ? campos.join(', ')
          : `${campos.slice(0, 3).join(', ')} y ${campos.length - 3} campo(s) más`
      return `cambió ${lista} de ${entidad}${nombre}`
    }
  }
}
