/** Formatea un precio en pesos colombianos: 189000 → "$189.000". */
export const cop = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  })
    .format(value)
    // es-CO intercala un espacio duro tras el símbolo: "$ 85.000" → "$85.000"
    .replace(/\s/g, '')

/** Texto del precio de un producto, contemplando el caso "sin precio". */
export const priceLabel = (price: number | null) =>
  price === null ? 'Consultar precio' : cop(price)

/** Quita tildes y pasa a minúsculas: para buscar sin importar los acentos. */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export const pluralize = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`
