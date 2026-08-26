# Panel de administración · GOOD GAME

Guía para poner en marcha `/admin` y para usarlo día a día.

La tienda pública y el panel son **el mismo proyecto**. Comparten los datos: lo
que cambias en el panel se ve en la tienda sin tocar código y sin volver a
publicar nada.

---

## 1. Cómo está montado

```
goodgamecol.shop/           tienda pública      · cualquiera
goodgamecol.shop/admin      panel privado       · solo con sesión
```

| Capa | Dónde vive | Qué hace |
|---|---|---|
| Tienda | `src/pages/public/` | Lo que ve el cliente. No cambió su aspecto. |
| Panel | `src/pages/admin/` | Gestión. Se descarga solo al entrar a `/admin`. |
| Servicios | `src/services/` | Única puerta a los datos. La usan los dos lados. |
| Base de datos | Supabase | Productos, pedidos, contenido, historial. |

El cliente que entra a comprar **no descarga nada del panel**: todo `/admin` va
en fragmentos aparte que solo se piden al visitarlo.

### Mientras no haya base de datos

El proyecto funciona igual que hoy: la tienda muestra su catálogo de 318
productos, incluido en el paquete. `/admin` **no muestra un formulario de
acceso**, sino las instrucciones para conectarla — un inicio de sesión que no
comprueba nada no protegería nada.

---

## 2. Puesta en marcha (una sola vez)

### 2.1 Crear el proyecto

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto.
2. Elige la región más cercana a Colombia (**East US** suele ser la mejor).
3. Guarda la contraseña de la base de datos que te pida: es la del servidor, no
   la del panel.

### 2.2 Crear las tablas

En **SQL Editor**, pega y ejecuta **en orden** los cuatro archivos de
`supabase/migrations/`:

| Archivo | Qué crea |
|---|---|
| `0001_esquema.sql` | Las tablas y el alta automática de perfiles |
| `0002_permisos.sql` | Quién puede hacer qué (la seguridad real) |
| `0003_auditoria.sql` | El registro de cambios |
| `0004_almacenamiento.sql` | El depósito de imágenes |

Se pueden volver a ejecutar sin romper nada.

### 2.3 Conectar la aplicación

En **Project Settings → API** copia dos cosas:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

Reinicia el servidor (`npm run dev`).

> La clave `anon` está **pensada** para estar en el navegador. Por sí sola no da
> acceso a nada: quien decide qué puede hacer cada quien son las políticas de
> `0002_permisos.sql`, que se aplican en el servidor.
>
> La clave `service_role` **nunca** va en `.env` ni en ninguna variable `VITE_*`:
> todo lo que empieza por `VITE_` acaba dentro del paquete que descarga el
> navegador, y esa clave se salta todas las políticas.

### 2.4 Cargar el catálogo

```bash
# Windows (PowerShell)
$env:SUPABASE_SERVICE_KEY="eyJ..."; npm run sembrar

# macOS / Linux
SUPABASE_SERVICE_KEY="eyJ..." npm run sembrar
```

Sube los 318 productos, las 6 categorías y las 9 preguntas frecuentes que hoy
tiene la tienda. Se puede repetir: identifica cada producto por su slug, así que
actualiza en vez de duplicar.

### 2.5 Crear tu cuenta

En **Authentication → Users → Add user**, con tu correo y una contraseña.

El **primero** que se registra queda como **super administrador**
automáticamente. Los siguientes entran como *editor* y tú decides si los
asciendes desde `/admin/administradores`.

> No hay ninguna contraseña escrita en el proyecto. La eliges tú en Supabase, se
> guarda con hash en el servidor y nunca pasa por este código.

### 2.6 Recuperación de contraseña

Para que el enlace del correo funcione, en **Authentication → URL Configuration**
añade a *Redirect URLs*:

```
https://goodgamecol.shop/admin/nueva-clave
http://localhost:5254/admin/nueva-clave
```

---

## 3. Los tres roles

| Rol | Catálogo y contenido | Eliminar | Pedidos y clientes | Ajustes y usuarios |
|---|---|---|---|---|
| **Super admin** | Sí | Sí | Sí | Sí |
| **Admin** | Sí | Sí | Sí | No |
| **Editor** | Sí | No | No | No |

Esto **no** es solo esconder botones. Cada regla está escrita como política de
la base de datos: si un editor intentara borrar un producto lanzando la petición
desde la consola del navegador, el servidor la rechaza igual.

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
| **General** | Empresa, redes, envíos y SEO |
| **Administradores** | Quién entra y con qué rol |
| **Historial** | Quién cambió qué y cuándo |

---

## 5. Reglas del negocio que el panel respeta

Vienen del brief del cliente y están puestas en el código, no solo en la
documentación:

- **WhatsApp 3508271637.** Si en los ajustes se guarda un número que no tenga
  diez dígitos, la tienda sigue usando el oficial en vez de publicar un enlace
  roto.
- **Sin dirección exacta.** Solo «Itagüí, Antioquia, Colombia» y los envíos.
- **Redes sociales pendientes.** Un campo vacío **no** pinta el icono. Nunca se
  publica una cuenta que no existe.
- **Nada inventado.** Un producto sin precio muestra «Consultar precio», no un
  número de relleno. Un gráfico sin datos dice que aún no los hay. Un producto
  sin fotografía muestra una portada de marca con su título, nunca la carátula
  de otro juego.
- **Los juegos marcados con X roja** en las fotos originales quedan como
  agotados hasta que el administrador cambie su estado.

---

## 6. Publicar los cambios

Cambiar datos desde el panel **no** requiere publicar nada: la tienda los lee de
la base de datos.

Solo hay que volver a publicar cuando cambia el **código**:

```bash
npm run build
```

y subir el contenido de `dist/` a `public_html` en Hostinger. Con la base de
datos conectada, `dist/` incluye el catálogo como respaldo, pero la tienda usa
el de la base.

---

## 7. Seguridad, en corto

| Riesgo | Cómo se evita |
|---|---|
| Entrar a `/admin` sin sesión | Redirección al acceso **y** políticas en la base de datos |
| Un editor borra un producto | La política `productos_borrar` solo admite admin y super admin |
| Alguien lee los clientes con la clave anónima | Las tablas de clientes y pedidos exigen sesión con rol |
| Un editor se asciende a super admin | La política de perfiles prohíbe cambiarse el rol a uno mismo |
| Se borra algo por error | Toda acción destructiva pide confirmación |
| No se sabe quién cambió un precio | Disparadores de auditoría con el valor anterior y el nuevo |
| Se filtra el código fuente por `.git` | `.htaccess` devuelve 404 en esa ruta |

---

## 8. Problemas frecuentes

**«Falta conectar la base de datos» al entrar a `/admin`**
No hay `.env`, está vacío o no se reinició el servidor tras crearlo.

**«Tu rol no tiene permiso para hacer este cambio»**
Es correcto: la base de datos rechazó la operación. Revisa el rol en
`/admin/administradores`.

**«Tu cuenta existe pero no tiene un perfil de administrador»**
El usuario se creó antes de ejecutar `0001_esquema.sql`. Bórralo en Supabase y
créalo de nuevo, o inserta su fila a mano en `profiles`.

**No llega el correo de recuperación**
Falta la URL en *Redirect URLs* (paso 2.6), o el correo cayó en no deseado.
Supabase limita los envíos en el plan gratuito.

**Las imágenes no suben**
No se ejecutó `0004_almacenamiento.sql`, o el archivo pasa de 5 MB.
