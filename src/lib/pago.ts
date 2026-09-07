// ─────────────────────────────────────────────────────────────────────────────
// Pago en línea con enlace de cobro.
//
// El enlace que entregó el negocio (Wompi / Nequi) es de MONTO ABIERTO y no
// acepta que el importe viaje en la dirección: se probó contra el enlace real
// con `?amount=`, `?amount-in-cents=` y `?reference=`, y la pasarela los
// descarta y deja el campo vacío. Tampoco hay forma de mandarle una referencia.
//
// De ahí salen las dos piezas de este archivo:
//
//   · el pedido se registra en el servidor ANTES de pagar, y su código es la
//     referencia: así el negocio puede cuadrar un pago suelto de la pasarela
//     con el pedido que le llegó.
//
//   · `importeParaPegar()` — el total en dígitos pelados, sin «$» ni puntos,
//     que es lo único que el campo de la pasarela acepta sin pelearse.
//
// Si algún día se pasa al Checkout Web de Wompi (llave pública + secreto de
// integridad), el importe y la referencia viajarían solos y este archivo se
// quedaría solo con el formato.
// ─────────────────────────────────────────────────────────────────────────────

import { api } from '@/lib/api'

/**
 * El total tal como hay que escribirlo en la pasarela: solo dígitos.
 *
 * El campo del importe es un `type="tel"`, y pegarle «$ 250.000» puede dejarlo
 * en blanco o mal leído. Se copia «250000» y no hay forma de equivocarse.
 */
export const importeParaPegar = (total: number): string => String(Math.round(total))

// ─────────────────────────────────────────────────────────────────────────────
// Checkout Web
//
// Aquí NO se calcula ningún total ni se firma nada: el navegador solo dice qué
// quiere comprar. El servidor mira los precios en la base, suma, firma con el
// secreto —que nunca sale de allí— y devuelve los campos ya listos. Por eso
// nadie puede pagar mil pesos por una consola editando la petición.
// ─────────────────────────────────────────────────────────────────────────────

/** Los datos con los que el cliente cierra su compra él solo. */
export interface DatosCliente {
  nombre: string
  whatsapp: string
  email: string
  ciudad: string
  direccion: string
}

/**
 * Lo que devuelve el servidor tras registrar el pedido.
 *
 * En modo `checkout` trae el formulario firmado; en `enlace`, el enlace de cobro
 * y la referencia. En los dos casos el pedido YA quedó guardado y el negocio ya
 * recibió su aviso: lo que pase después en la pasarela no cambia eso.
 */
export type PedidoPreparado =
  | { modo: 'checkout'; url: string; pedido: string; total: number; campos: Record<string, string> }
  | { modo: 'enlace'; enlace: string; pedido: string; referencia: string; total: number }

/**
 * Registra el pedido y pide lo necesario para cobrarlo.
 * Lanza `ErrorApi` con un mensaje que ya se puede enseñar tal cual.
 */
export async function prepararPago(
  items: { slug: string; qty: number }[],
  cliente: DatosCliente
): Promise<PedidoPreparado> {
  return api<PedidoPreparado>('pago/preparar', {
    metodo: 'POST',
    cuerpo: { items, cliente },
  })
}

// ── Recordar los datos, para que un cliente que vuelve no los reescriba ──────

const CLAVE_DATOS = 'gg.datos.v1'

export const DATOS_VACIOS: DatosCliente = {
  nombre: '',
  whatsapp: '',
  email: '',
  ciudad: '',
  direccion: '',
}

/** Lo que este navegador recuerda del comprador. Nunca sale de su equipo. */
export function datosGuardados(): DatosCliente {
  try {
    const crudo = localStorage.getItem(CLAVE_DATOS)
    if (!crudo) return DATOS_VACIOS
    const d = JSON.parse(crudo) as Partial<DatosCliente>
    // Campo a campo: un localStorage manipulado no debe meter objetos raros.
    return {
      nombre: typeof d.nombre === 'string' ? d.nombre : '',
      whatsapp: typeof d.whatsapp === 'string' ? d.whatsapp : '',
      email: typeof d.email === 'string' ? d.email : '',
      ciudad: typeof d.ciudad === 'string' ? d.ciudad : '',
      direccion: typeof d.direccion === 'string' ? d.direccion : '',
    }
  } catch {
    return DATOS_VACIOS
  }
}

export function guardarDatos(d: DatosCliente): void {
  try {
    localStorage.setItem(CLAVE_DATOS, JSON.stringify(d))
  } catch {
    // Modo incógnito o almacenamiento lleno: se pierde la comodidad de que los
    // recuerde, y nada más. No es motivo para romper la compra.
  }
}

/**
 * Envía al cliente a la pasarela.
 *
 * Se hace con un formulario y no cambiando `location`, porque así los campos
 * viajan como los espera Wompi y no hay que armar a mano una dirección larga
 * donde un carácter mal escapado rompería la firma.
 */
export function irALaPasarela(f: { url: string; campos: Record<string, string> }): void {
  const form = document.createElement('form')
  form.method = 'GET'
  form.action = f.url
  form.style.display = 'none'

  for (const [nombre, valor] of Object.entries(f.campos)) {
    const campo = document.createElement('input')
    campo.type = 'hidden'
    campo.name = nombre
    campo.value = valor
    form.appendChild(campo)
  }

  document.body.appendChild(form)
  form.submit()
}

/**
 * Copia un texto al portapapeles. Devuelve si lo consiguió, para que la
 * interfaz no cante «copiado» cuando el navegador lo bloqueó.
 *
 * `navigator.clipboard` no existe en contextos sin HTTPS ni en algunos
 * navegadores dentro de apps, así que hay un respaldo con un campo temporal.
 */
export async function copiar(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch {
    // Sigue al respaldo: puede fallar por permisos o por no estar en foco.
  }

  try {
    const campo = document.createElement('textarea')
    campo.value = texto
    // Fuera de la vista, pero seleccionable: si se oculta con display:none o
    // visibility:hidden, la selección no funciona y la copia no ocurre.
    campo.setAttribute('readonly', '')
    campo.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0'
    document.body.appendChild(campo)
    campo.select()
    const bien = document.execCommand('copy')
    document.body.removeChild(campo)
    return bien
  } catch {
    return false
  }
}
