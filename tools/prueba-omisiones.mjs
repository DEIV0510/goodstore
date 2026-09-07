// Comprueba que los valores por omisión del pago coinciden entre la tienda y
// el servidor.
//
//   node tools/prueba-omisiones.mjs
//
// Existe por un fallo real: la tienda venía con `enabled: true` y el servidor
// suponía `false` cuando la sección nunca se había guardado. Resultado en
// producción: el carrito enseñaba «Pagar en línea», el cliente rellenaba sus
// datos y el servidor contestaba «no está disponible». Ningún error en
// consola, ningún 500 en los registros: simplemente nadie podía comprar.
//
// Este archivo vive en tools/ y no se publica nunca.
import fs from 'node:fs'

const TIENDA = 'src/services/ajustes.ts'
const SERVIDOR = 'public/api/rutas/pago.php'

const ts = fs.readFileSync(TIENDA, 'utf8')
const php = fs.readFileSync(SERVIDOR, 'utf8')

/** El bloque `payments: { … }` de los valores por omisión de la tienda. */
const bloque = ts.match(/payments:\s*\{([\s\S]*?)\n\s{2}\},/)
if (!bloque) {
  console.error('No se encontró el bloque payments en ' + TIENDA)
  process.exit(1)
}

const deLaTienda = (clave) => {
  const m = bloque[1].match(new RegExp(clave + ":\\s*(true|false|'([^']*)')"))
  if (!m) return undefined
  return m[1] === 'true' ? true : m[1] === 'false' ? false : m[2]
}

const delServidor = (constante) => {
  const m = php.match(new RegExp('const ' + constante + " = (true|false|'([^']*)');"))
  if (!m) return undefined
  return m[1] === 'true' ? true : m[1] === 'false' ? false : m[2]
}

const pares = [
  ['enabled', 'GG_PAGO_ACTIVO_OMISION'],
  ['mode', 'GG_PAGO_MODO_OMISION'],
  ['provider', 'GG_PAGO_PROVEEDOR_OMISION'],
  ['link', 'GG_PAGO_ENLACE_OMISION'],
]

let fallos = 0
for (const [claveTs, constPhp] of pares) {
  const a = deLaTienda(claveTs)
  const b = delServidor(constPhp)
  const bien = a !== undefined && a === b
  console.log(
    `${bien ? 'OK   ' : 'FALLA'}  ${claveTs.padEnd(9)} tienda ${JSON.stringify(a)}  ·  servidor ${JSON.stringify(b)}`
  )
  if (!bien) fallos++
}

console.log(
  fallos === 0
    ? '\nLa tienda y el servidor parten de lo mismo.\n'
    : `\n${fallos} valor(es) descuadrado(s). Con esto, el botón de pagar puede aparecer y no funcionar.\n`
)
process.exit(fallos === 0 ? 0 : 1)
