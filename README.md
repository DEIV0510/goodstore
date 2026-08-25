# goodgamecol.shop — sitio publicado

Esta rama **no se edita a mano**. Contiene el resultado de `npm run build`
del código que vive en la rama `main`, y es la que Hostinger clona dentro de
`public_html`.

Para publicar un cambio:

1. Se trabaja y se prueba en `main`.
2. `npm run build`
3. Se copia el contenido de `dist/` a esta rama y se sube.
4. En hPanel → Avanzado → GIT se pulsa **Deploy**.

El archivo `.htaccess` es el que hace que las rutas internas
(`/catalogo`, `/producto/<juego>`) funcionen al recargar, fija la caché de
las portadas y bloquea el acceso web a la carpeta `.git`.
