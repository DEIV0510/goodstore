// postcss-import va PRIMERO: incorpora el contenido de `@import './admin.css'`
// dentro del archivo antes de que Tailwind procese las capas. Sin él, la hoja
// del panel quedaría fuera de @layer y sus clases no se generarían.
export default {
  plugins: { 'postcss-import': {}, tailwindcss: {}, autoprefixer: {} },
}
