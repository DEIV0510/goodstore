<?php
declare(strict_types=1);

/**
 * GOOD GAME · Configuración del backend
 *
 * No hay nada que rellenar aquí: el servidor se descubre solo. Se eligió así a
 * propósito, porque un archivo de configuración que hay que editar a mano es
 * la primera fuente de errores al publicar.
 *
 * Todo vive dentro del mismo hosting: ni servicios externos, ni cuentas
 * aparte, ni claves que copiar de un panel a otro.
 */

const GG_VERSION = '1.0.0';

/** Roles, de menos a más permisos. */
const GG_ROLES = ['editor', 'admin', 'super_admin'];

/** Intentos de acceso fallidos permitidos antes de bloquear temporalmente. */
const GG_MAX_INTENTOS = 8;
const GG_BLOQUEO_MINUTOS = 15;

/** Duración de la sesión sin actividad, en minutos. */
const GG_SESION_MINUTOS = 480;

/** Imágenes. El límite real lo aplica la API, no solo el php.ini. */
const GG_IMAGEN_MAX_BYTES = 5 * 1024 * 1024;
const GG_IMAGEN_TIPOS = [
    'image/webp' => 'webp',
    'image/png'  => 'png',
    'image/jpeg' => 'jpg',
    'image/avif' => 'avif',
];

/**
 * Carpeta donde se guardan la base de datos y los archivos internos.
 *
 * Se intenta primero FUERA de public_html: así ni siquiera un fallo de
 * configuración de Apache podría dejar la base de datos descargable desde
 * internet. Si el hosting no lo permite, se usa una carpeta dentro de la API
 * protegida con su propio .htaccess, y el diagnóstico lo avisa.
 */
function gg_carpeta_datos(): string
{
    static $ruta = null;
    if ($ruta !== null) {
        return $ruta;
    }

    $raiz = $_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__, 3);
    $raiz = rtrim(str_replace('\\', '/', $raiz), '/');

    $fuera = dirname($raiz) . '/gg-datos';
    if (gg_asegurar_carpeta($fuera)) {
        return $ruta = $fuera;
    }

    // Reserva: dentro de la API, blindada con .htaccess.
    $dentro = dirname(__DIR__) . '/datos';
    if (gg_asegurar_carpeta($dentro)) {
        gg_blindar_carpeta($dentro);
        return $ruta = $dentro;
    }

    throw new RuntimeException(
        'No se pudo crear la carpeta de datos. Revisa los permisos de escritura del hosting.'
    );
}

/** true si la carpeta existe y se puede escribir en ella. */
function gg_asegurar_carpeta(string $ruta): bool
{
    if (!is_dir($ruta) && !@mkdir($ruta, 0755, true) && !is_dir($ruta)) {
        return false;
    }
    return is_writable($ruta);
}

/**
 * Deja una carpeta fuera del alcance de la web.
 *
 * Se escriben las tres formas porque conviven servidores con Apache 2.2 y 2.4,
 * y la sintaxis cambió entre ellos. Sobra una, pero ninguna estorba.
 */
function gg_blindar_carpeta(string $ruta): void
{
    $htaccess = $ruta . '/.htaccess';
    if (is_file($htaccess)) {
        return;
    }
    @file_put_contents($htaccess, <<<'HTA'
# Carpeta interna de GOOD GAME. Nada de aquí debe servirse por web.
<IfModule mod_authz_core.c>
  Require all denied
</IfModule>
<IfModule !mod_authz_core.c>
  Order allow,deny
  Deny from all
</IfModule>
# Por si el módulo de autorización no estuviera disponible.
RedirectMatch 404 ^/.*$
HTA);
}

/** Carpeta pública donde se guardan las imágenes subidas. */
function gg_carpeta_medios(): string
{
    $raiz = rtrim(str_replace('\\', '/', $_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__, 3)), '/');
    $ruta = $raiz . '/medios';

    if (gg_asegurar_carpeta($ruta)) {
        // Las imágenes se sirven, pero NUNCA se ejecutan: si alguien lograra
        // colar un .php disfrazado de foto, aquí no correría.
        $htaccess = $ruta . '/.htaccess';
        if (!is_file($htaccess)) {
            @file_put_contents($htaccess, <<<'HTA'
# Solo imágenes. Aquí no se ejecuta código, pase lo que pase.
php_flag engine off
<IfModule mod_php.c>
  php_flag engine off
</IfModule>
RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8 .phps
RemoveType .php .phtml .php3 .php4 .php5 .php7 .php8 .phps
AddType text/plain .php .phtml .phps
Options -ExecCGI -Indexes
HTA);
        }
    }
    return $ruta;
}

/** URL pública de un archivo guardado en la carpeta de medios. */
function gg_url_medios(string $nombre): string
{
    return '/medios/' . $nombre;
}

/**
 * Dirección pública del sitio, deducida de la propia petición.
 *
 * Se usa para decirle a la pasarela a dónde devolver al cliente. No se guarda
 * en ningún ajuste a propósito: así funciona igual en el dominio de verdad y en
 * uno de pruebas, sin que nadie tenga que acordarse de actualizarlo.
 *
 * El Host lo manda el cliente, así que se comprueba antes de usarlo: solo
 * letras, dígitos, puntos, guiones y un puerto. Un Host manipulado no puede
 * convertir la URL de retorno en un enlace hacia otro sitio.
 */
function gg_url_sitio(): string
{
    $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
    if (!preg_match('/^[A-Za-z0-9.-]+(:\d{1,5})?$/', $host)) {
        $host = 'goodgamecol.shop';
    }
    return (gg_es_https() ? 'https://' : 'http://') . $host;
}

/** true si la petición llegó por HTTPS (contando el proxy del hosting). */
function gg_es_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    if (($_SERVER['SERVER_PORT'] ?? '') === '443') {
        return true;
    }
    // Hostinger termina el TLS en un proxy y lo indica con esta cabecera.
    return strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}
