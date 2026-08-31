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
//   · `referenciaDePedido()` — un código corto que la tienda le da al cliente
//     y que viaja en el mensaje de WhatsApp. Es lo que le permite al negocio
//     cuadrar un pago suelto de la pasarela con el pedido que le llegó.
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
 * Alfabeto sin caracteres que se confunden al dictar o al copiar a mano:
 * fuera 0/O, 1/I/L y 5/S. La referencia se lee por WhatsApp o por teléfono.
 */
const ALFABETO = 'ABCDEFGHJKMNPQRTUVWXYZ2346789'

/**
 * Código corto de pedido, del estilo `GG-7F3K`.
 *
 * No pretende ser único en el mundo: solo distinguir los pedidos de un mismo
 * día en una tienda pequeña. Con 29⁴ combinaciones (≈707.000) es de sobra.
 */
export function referenciaDePedido(): string {
  let codigo = ''
  // crypto está en todos los navegadores que la tienda soporta; el respaldo
  // con Math.random evita que un entorno raro rompa el carrito por un código.
  const aleatorio =
    typeof crypto !== 'undefined' && crypto.getRandomValues
      ? Array.from(crypto.getRandomValues(new Uint32Array(4)))
      : Array.from({ length: 4 }, () => Math.floor(Math.random() * 0xffffffff))

  for (const n of aleatorio) codigo += ALFABETO[n % ALFABETO.length]
  return `GG-${codigo}`
}

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

interface FormularioDePago {
  url: string
  pedido: string
  total: number
  campos: Record<string, string>
}

/**
 * Pide al servidor el formulario firmado para este carrito.
 * Lanza `ErrorApi` con un mensaje que ya se puede enseñar tal cual.
 */
export async function prepararPago(
  items: { slug: string; qty: number }[]
): Promise<FormularioDePago> {
  return api<FormularioDePago>('pago/preparar', { metodo: 'POST', cuerpo: { items } })
}

/**
 * Envía al cliente a la pasarela.
 *
 * Se hace con un formulario y no cambiando `location`, porque así los campos
 * viajan como los espera Wompi y no hay que armar a mano una dirección larga
 * donde un carácter mal escapado rompería la firma.
 */
export function irALaPasarela(f: FormularioDePago): void {
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
