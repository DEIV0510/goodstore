<?php
declare(strict_types=1);

/**
 * GOOD GAME · API
 *
 * Punto de entrada único. Todas las peticiones a /api/... llegan aquí (lo hace
 * el .htaccess de esta carpeta) y desde aquí se reparten.
 *
 * Vive dentro del mismo hosting que la tienda: no hay servicios externos, ni
 * cuentas aparte, ni claves que copiar. La base de datos se crea sola la
 * primera vez que alguien abre el panel.
 */

// Los errores se devuelven como JSON, nunca como una página de PHP: un volcado
// de error en pantalla filtra rutas del servidor y versiones de software.
ini_set('display_errors', '0');
error_reporting(E_ALL);

require __DIR__ . '/nucleo/config.php';
require __DIR__ . '/nucleo/http.php';
require __DIR__ . '/nucleo/db.php';
require __DIR__ . '/nucleo/auth.php';
require __DIR__ . '/nucleo/auditoria.php';
require __DIR__ . '/nucleo/semilla.php';
require __DIR__ . '/nucleo/salidas.php';

// ── Cabeceras de seguridad ───────────────────────────────────────────────────
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header_remove('X-Powered-By');

/** Ruta pedida, ya limpia: "productos/abc-123" → ['productos', 'abc-123'] */
function gg_ruta(): array
{
    $r = $_GET['gg_ruta'] ?? '';
    if ($r === '') {
        // Reserva por si el .htaccess no pudo pasar el parámetro.
        $uri = parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH) ?: '';
        $r = preg_replace('#^.*/api/?#', '', $uri) ?? '';
    }
    $r = trim((string) $r, '/');
    if ($r === '') {
        return [];
    }
    // Se descartan segmentos vacíos y se limita el largo: una ruta de mil
    // segmentos solo puede venir de alguien probando cosas.
    return array_slice(array_values(array_filter(explode('/', $r), fn($s) => $s !== '')), 0, 5);
}

try {
    gg_exigir_origen();

    $ruta = gg_ruta();
    $recurso = $ruta[0] ?? '';

    // El esquema se crea o actualiza solo, en cada arranque. Es idempotente.
    gg_db();

    switch ($recurso) {
        case '':
        case 'estado':
            require __DIR__ . '/rutas/estado.php';
            break;
        case 'sesion':
            require __DIR__ . '/rutas/sesion.php';
            break;
        case 'publico':
            require __DIR__ . '/rutas/publico.php';
            break;
        case 'productos':
            require __DIR__ . '/rutas/productos.php';
            break;
        case 'categorias':
            require __DIR__ . '/rutas/categorias.php';
            break;
        case 'pedidos':
            require __DIR__ . '/rutas/pedidos.php';
            break;
        case 'clientes':
            require __DIR__ . '/rutas/clientes.php';
            break;
        case 'contenido':
        case 'banners':
        case 'preguntas':
            require __DIR__ . '/rutas/contenido.php';
            break;
        case 'ajustes':
        case 'whatsapp':
            require __DIR__ . '/rutas/ajustes.php';
            break;
        case 'equipo':
        case 'historial':
            require __DIR__ . '/rutas/equipo.php';
            break;
        case 'pago':
            require __DIR__ . '/rutas/pago.php';
            break;
        case 'medios':
            require __DIR__ . '/rutas/medios.php';
            break;
        default:
            gg_error('No existe esa dirección en la API.', 404);
    }

    gg_error('Ese método no está permitido en esta dirección.', 405);
} catch (GgError $e) {
    gg_error($e->getMessage(), $e->http);
} catch (PDOException $e) {
    // El mensaje de la base de datos puede revelar nombres de tablas y rutas
    // del servidor: se registra en el log del hosting y al navegador va un
    // mensaje neutro.
    error_log('[GOOD GAME] ' . $e->getMessage());
    gg_error('Error de base de datos. Vuelve a intentarlo en un momento.', 500);
} catch (Throwable $e) {
    error_log('[GOOD GAME] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    gg_error('Ocurrió un error inesperado en el servidor.', 500);
}
