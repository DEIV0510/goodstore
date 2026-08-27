<?php
declare(strict_types=1);

/**
 * Enrutador para el servidor de desarrollo de PHP.
 *
 *   php -S 127.0.0.1:8787 -t public tools/servidor-local.php
 *
 * SOLO para desarrollo. El servidor incorporado de PHP no lee .htaccess, así
 * que aquí se imita lo que hace Apache en producción: mandar todo lo que llegue
 * a /api/... al enrutador de la API, y servir tal cual el resto de archivos.
 *
 * Este archivo vive en tools/ y no se publica nunca.
 */

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$publico = __DIR__ . '/../public';

// ── API ──────────────────────────────────────────────────────────────────────
if (str_starts_with($uri, '/api')) {
    $resto = ltrim(substr($uri, 4), '/');

    // Igual que hace el .htaccess de producción.
    $_GET['gg_ruta'] = $resto;
    $_SERVER['DOCUMENT_ROOT'] = realpath($publico) ?: $publico;
    $_SERVER['SCRIPT_NAME'] = '/api/index.php';

    require $publico . '/api/index.php';
    return true;
}

// ── Archivos reales (imágenes subidas, portadas, marca…) ─────────────────────
$archivo = $publico . $uri;
if ($uri !== '/' && is_file($archivo)) {
    // false = que lo sirva el servidor incorporado, con su tipo MIME.
    return false;
}

// ── Cualquier otra cosa ──────────────────────────────────────────────────────
// En desarrollo, la interfaz la sirve Vite en otro puerto; aquí solo se
// responde para que quede claro que se llamó al sitio equivocado.
http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo "Servidor de la API de GOOD GAME.\n\n";
echo "La interfaz la sirve Vite en http://127.0.0.1:5254\n";
echo "Aquí solo se atiende /api/... y los archivos de public/\n";
return true;
