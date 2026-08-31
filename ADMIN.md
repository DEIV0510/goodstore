# Panel de administración · GOOD GAME

Guía del panel en `/admin`.

**No hay nada que configurar.** No hace falta crear cuentas en ningún servicio,
ni copiar claves, ni ejecutar comandos. Se publica el sitio y el panel funciona.

---

## 1. Cómo funciona

La tienda y el panel son el mismo proyecto, y comparten los datos: lo que
cambias en `/admin` se ve en la tienda al instante, sin volver a publicar nada.

```
goodgamecol.shop/           tienda pública      · cualquiera
goodgamecol.shop/admin      panel privado       · solo con sesión
goodgamecol.shop/api        el motor de los dos · PHP
```

| Capa | Dónde vive | Qué hace |
|---|---|---|
| Tienda | `src/pages/public/` | Lo que ve el cliente |
| Panel | `src/pages/admin/` | Las 16 pantallas de gestión |
| Servicios | `src/services/` | Única puerta a los datos, para ambos |
| API | `public/api/` | PHP: valida, decide permisos y guarda |
| Base de datos | `gg-datos/goodgame.sqlite` | Un archivo, fuera de la carpeta pública |

Todo corre **dentro del hosting que ya pagas**. Sin servicios externos, sin
cuentas de terceros, sin nada que renovar aparte.

### Por qué SQLite y no MySQL

SQLite guarda toda la base en un solo archivo. Para una tienda de 318 productos
y dos o tres administradores va sobrado, y a cambio:

- no hay que crear ninguna base de datos ni usuario en hPanel;
- no hay contraseñas de base de datos que guardar en ningún sitio;
- la copia de seguridad es copiar un archivo, y restaurar es devolverlo;
- si algún día hiciera falta MySQL, solo cambia `public/api/nucleo/db.php`.

---

## 2. Primer arranque

1. Publica el sitio (ver §7).
2. Entra a **tudominio.com/admin**.
3. Rellena tu nombre, tu correo y una contraseña. Esa será la cuenta principal,
   con acceso total.
4. **Guarda el código de recuperación** que aparece a continuación.

Eso es todo. En esa primera visita, el servidor:

- crea la base de datos,
- carga los 318 productos, las 6 categorías y las 9 preguntas frecuentes,
- crea las carpetas internas y las protege.

> El formulario de creación de cuenta **solo funciona mientras no exista
> ninguna**. En cuanto la creas, esa dirección responde «el panel ya está
> instalado» a cualquiera que lo intente.

### El código de recuperación

Se muestra **una sola vez**: el servidor guarda solo su huella, no el código.
Es lo que te deja volver a entrar si olvidas la contraseña.

Guárdalo donde guardas tus contraseñas, o escríbelo en papel.

Sustituye al típico «te enviamos un correo» porque el envío de correo en
hosting compartido es poco fiable y dependería de otro servicio. Puedes generar
uno nuevo cuando quieras desde **Mi perfil**; el anterior deja de servir.

### Si pierdes la contraseña Y el código

Hay una salida, y requiere entrar al hosting, que es justo lo que la hace
segura: quien puede hacerlo ya es dueño del servidor.

1. Entra al administrador de archivos de Hostinger.
2. Crea un archivo vacío llamado `RESCATE.txt` dentro de la carpeta `gg-datos`
   (está al mismo nivel que `public_html`, no dentro).
3. Vuelve a `/admin`. Podrás definir de nuevo la cuenta principal.
4. El archivo se borra solo al usarlo.

---

## 3. Los tres roles

| Rol | Catálogo y contenido | Eliminar | Pedidos y clientes | Ajustes y usuarios |
|---|---|---|---|---|
| **Super admin** | Sí | Sí | Sí | Sí |
| **Admin** | Sí | Sí | Sí | No |
| **Editor** | Sí | No | No | No |

Esto **no** es esconder botones. Cada regla se comprueba en el servidor, en
cada petición. Verificado: un editor que lanza `DELETE /api/productos/…` desde
la consola del navegador recibe `403 Tu rol no tiene permiso para hacer esto`.

### Dar de alta a alguien

En **Administradores → Dar de alta**, escribes su correo, su nombre y su rol.
La cuenta se crea al momento y el panel te devuelve un **código de un solo
uso**, que se muestra una única vez: se lo entregas en mano o por WhatsApp.

Esa persona entra en `/admin`, pulsa «¿Olvidaste tu contraseña?», escribe su
correo y el código, y elige **su propia** contraseña. Así ninguna contraseña
ajena pasa nunca por tus manos.

No se envía ningún correo, y es a propósito: el envío desde un hosting
compartido no es fiable y dependería de otro servicio.

En esa misma lista, cada fila tiene **Código** (genera uno nuevo si lo perdió;
el anterior deja de servir), **Suspender** (le cierra el paso sin borrar nada) y
**Borrar**. Tu propia fila va bloqueada en las tres: nadie se degrada, se
suspende ni se borra a sí mismo. Y el panel no te deja quedarte sin ningún
super administrador activo.

---

## 4. Qué hay en el panel

| Pantalla | Para qué |
|---|---|
| **Panel** | Cifras del negocio, gráficos y aviso de stock bajo |
| **Productos** | Crear, editar, duplicar y eliminar; filtros y búsqueda |
| **Inventario** | Ajustar unidades rápido, con umbral de stock bajo |
| **Categorías** | Las tarjetas de «Explora por categoría» |
| **Pedidos** | Registrar y seguir las ventas cerradas por WhatsApp |
| **Clientes** | Quién compra, cuánto y cuándo |
| **Portada** | Hero, beneficios, qué secciones se muestran y destacados |
| **Banners** | Franjas promocionales, con fechas de inicio y fin |
| **Preguntas** | El bloque de preguntas frecuentes |
| **WhatsApp** | El número y las plantillas de cada mensaje |
| **General** | Empresa, redes, envíos, SEO y **pagos en línea** |
| **Administradores** | Quién entra y con qué rol |
| **Historial** | Quién cambió qué, con el valor anterior y el nuevo |

---

## 5. Pagos en línea

Se configuran en **General → Pagos**. Hoy está puesto el enlace de cobro de
Wompi/Nequi a nombre de «Good game david correa».

### Cómo llega el dinero, en concreto

1. El cliente arma el carrito y pulsa **Pagar en línea**.
2. La tienda le da una **referencia** (`GG-7F3K`) y le pide que te mande el
   pedido por WhatsApp. Ese mensaje lleva la referencia y la lista de juegos.
3. Le copia el **total exacto** al portapapeles.
4. Lo lleva a la pasarela, donde pega el valor, elige medio de pago y escribe
   su dirección de envío.

Tú recibes **dos cosas por separado**: el pedido por WhatsApp (con la
referencia) y el pago en la pasarela (con el importe y la dirección). La
referencia es lo que los une.

> ⚠️ **Por qué el cliente escribe el total y no viaja solo.**
> Un enlace de cobro no acepta que se le pase el importe: se probó contra el
> enlace real con `?amount=`, `?amount-in-cents=` y `?reference=` y Wompi los
> descarta. Por eso la tienda copia el valor al portapapeles, que es lo más
> cerca que se puede estar de que no haya errores. **Coteja siempre el importe
> recibido con el total del pedido antes de despachar.**

### Cuándo NO aparece el botón

A propósito, para que nadie pague un valor equivocado:

- si en **General → Pagos** está apagado, o el enlace está vacío;
- si el carrito tiene **algún producto sin precio publicado**: ahí el total no
  es definitivo, así que la tienda manda a WhatsApp a cuadrarlo.

### Si cambias de pasarela

Pega el enlace nuevo en **General → Pagos** y cambia el nombre que ve el
cliente. Solo se admiten enlaces `https://`; el panel te muestra el dominio al
que apunta para que compruebes que es el correcto antes de guardar. Queda
registrado en el **Historial**, con el enlace anterior y el nuevo.

---

## 5-bis. Checkout Web · que el cliente no escriba el total

Ya está montado. Se enciende en **General → Pagos → Cómo cobras → Checkout
Web**, y necesita dos datos de tu panel de Wompi.

### Cómo activarlo

1. Entra a tu cuenta de Wompi → **Desarrolladores** → **Configuración técnica**.
2. Copia la **llave pública** (`pub_prod_…`) y el **secreto de integridad**
   (`prod_integrity_…`).
3. En **General → Pagos**, cambia «Cómo cobras» a **Checkout Web** y pégalos.
4. Guarda. La tienda cambia sola: el botón pasa a ser uno solo, «Pagar».

> Si quieres probar antes sin mover dinero, usa las llaves de prueba
> (`pub_test_…` y `test_integrity_…`). La tienda detecta el prefijo y habla
> sola con el entorno de pruebas de Wompi.

### Qué cambia para el cliente

| | Enlace de cobro | Checkout Web |
|---|---|---|
| Escribe el total | Sí, lo copia y lo pega | **No** |
| Referencia | Se la damos y la manda por WhatsApp | Viaja sola |
| El pedido | Lo mandas tú por WhatsApp | **Se registra solo** en Pedidos |
| Confirmación | La miras en el panel de Wompi | **El sitio la comprueba** |

### Lo que impide que te paguen de menos

El total **lo calcula el servidor** leyendo los precios de tu catálogo, no el
navegador. Da igual lo que alguien intente enviar desde su equipo: se comprobó
mandando `price`, `total` y `amount-in-cents` falsos, y el importe firmado
siguió siendo el real. Además:

- si un producto del carrito **no tiene precio**, no deja pagar;
- si **no queda stock** suficiente, no deja pagar;
- al volver, si el importe cobrado **no cuadra** con el del pedido, el pedido
  NO se da por bueno: sale un aviso para que lo revises con el cliente.

### Sobre el secreto de integridad

Se guarda en el servidor, en un sitio que **ninguna dirección de la API
devuelve**. Ni el panel, ni la tienda, ni el historial pueden verlo: una vez
guardado, el campo aparece vacío y solo dice «Secreto configurado». Si lo
pierdes, sácalo otra vez de Wompi y pégalo de nuevo.

Déjalo vacío al guardar y se conserva el que ya estaba.

---

## 6. Reglas del negocio que el panel respeta

Vienen del brief del cliente y están escritas en el código, no solo aquí:

- **WhatsApp 3508271637.** Si en los ajustes se guarda un número que no tenga
  diez dígitos, el servidor lo rechaza y la tienda sigue con el oficial.
- **Sin dirección exacta.** Solo «Itagüí, Antioquia, Colombia» y los envíos.
- **Redes sociales pendientes.** Un campo vacío **no** pinta el icono. Nunca se
  publica una cuenta que no existe.
- **Nada inventado.** Un producto sin precio muestra «Consultar precio». Un
  gráfico sin datos dice que aún no los hay. Un producto sin fotografía muestra
  una portada de marca con su título, nunca la carátula de otro juego.

---

## 7. Publicar

```bash
npm run build
```

Y subir **todo** el contenido de `dist/` a `public_html`.

> ⚠️ Dos cosas que los administradores de archivos suelen ocultar y hay que
> subir igualmente: el archivo **`.htaccess`** de la raíz y la carpeta
> **`api`** completa (que a su vez lleva otro `.htaccess`). Activa «mostrar
> archivos ocultos» antes de subir.

Cambiar **datos** desde el panel no requiere publicar nada. Solo hay que volver
a publicar cuando cambia el **código**.

### Qué NO se debe borrar al republicar

La carpeta `gg-datos` (fuera de `public_html`) y la carpeta `medios` dentro de
`public_html`. Ahí están la base de datos y las imágenes que hayas subido. El
resto se puede sobrescribir sin miedo.

---

## 8. Copias de seguridad

Descarga `gg-datos/goodgame.sqlite` desde el administrador de archivos. Ese
único archivo contiene productos, pedidos, clientes, contenido e historial.

Para restaurar, súbelo de vuelta al mismo sitio.

Hostinger además hace copias semanales del hosting completo.

---

## 9. Seguridad, en corto

| Riesgo | Cómo se evita | Verificado |
|---|---|---|
| Entrar a `/admin` sin sesión | Redirección **y** la API responde 401 | Sí, 15 rutas |
| Un editor borra un producto | El servidor comprueba el rol en cada petición | Sí, devuelve 403 |
| Leer clientes o pedidos sin permiso | Esas rutas exigen rol admin | Sí, devuelve 403 |
| Un editor se asciende solo | La API prohíbe cambiarse el propio rol | Sí, devuelve 403 |
| Petición falsificada desde otra web (CSRF) | Cookie `SameSite=Strict` + cabecera propia obligatoria | Sí, devuelve 403 |
| Robo de la sesión con un script | La cookie es `HttpOnly`: JavaScript no la ve | — |
| Inyección SQL | Todo va por consultas preparadas; nunca se concatena | — |
| Probar contraseñas a lo bruto | 8 intentos y bloqueo de 15 minutos | — |
| Subir un `.php` disfrazado de foto | Se comprueba el contenido real, no la extensión; el servidor renombra; `.htaccess` desactiva PHP en esa carpeta | — |
| Descargar la base de datos | Vive fuera de `public_html` | — |
| Se borra algo por error | Toda acción destructiva pide confirmación | — |
| No se sabe quién cambió un precio | Historial con el valor anterior y el nuevo | — |

---

## 10. Desarrollo en local

Hacen falta dos servidores: uno para la interfaz y otro para la API.

```bash
npm run api    # PHP en el 8787
npm run dev    # Vite en el 5254
```

Vite redirige `/api` y `/medios` al de PHP, así que en el navegador todo va por
`http://127.0.0.1:5254` como si fuera producción.

Requiere PHP 8.0 o superior con `pdo_sqlite`.

---

## 11. Problemas frecuentes

**«El panel no puede conectar con el servidor»**
Falta subir la carpeta `api`, o el hosting no está ejecutando PHP. La propia
pantalla lista las tres causas habituales.

**«Tu rol no tiene permiso para hacer esto»**
Es correcto: el servidor rechazó la operación. Revisa el rol en
**Administradores**.

**«Demasiados intentos fallidos»**
Ocho fallos seguidos bloquean quince minutos. Es a propósito.

**Las imágenes no suben**
Comprueba que el archivo no pase de 5 MB y que sea WebP, PNG, JPG o AVIF. Si
falla igual, revisa que la carpeta `medios` tenga permisos de escritura.

**La tienda muestra productos viejos**
Si la API no responde, la tienda tira del catálogo que venía con la última
versión publicada, para no quedarse en blanco. Entra a `/admin`: si también
falla ahí, el problema es la API.
