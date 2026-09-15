import { site } from '@/data/site'
import { cop } from '@/lib/format'

// Las tarifas de envío se dicen en cuatro sitios —la barra de arriba, el
// carrito, el formulario del pago y la ficha de cada juego— y tienen que decir
// exactamente lo mismo en los cuatro. Por eso la frase sale de aquí y no se
// escribe a mano en cada componente.
//
// La zona se nombra («Valle de Aburrá») y no se dice solo «área metropolitana»:
// la tienda vende a todo el país, y alguien de Barranquilla o Bucaramanga leería
// que en SU área metropolitana también le toca la tarifa baja.
//
// «Envío gratis desde» no sale aquí a propósito: el negocio no lo pidió, y es
// una promesa que no se publica sin que la haga él.

/** Si hay alguna tarifa publicada. Sin ninguna, la tienda no habla de precios de envío. */
export function hayTarifasEnvio(): boolean {
  return site.envio.area !== null || site.envio.nacional !== null
}

/** «Valle de Aburrá $15.000 · Resto del país $18.500». */
export function tarifasEnvioTexto(): string {
  const partes: string[] = []
  if (site.envio.area !== null) partes.push(`Valle de Aburrá ${cop(site.envio.area)}`)
  if (site.envio.nacional !== null) partes.push(`Resto del país ${cop(site.envio.nacional)}`)
  return partes.join(' · ')
}
