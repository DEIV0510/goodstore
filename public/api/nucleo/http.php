<?php
declare(strict_types=1);

/**
 * GOOD GAME · Entrada y salida HTTP
 *
 * Todo lo que entra se valida y todo lo que sale es JSON. Los errores se
 * devuelven con un mensaje en español pensado para leerse en pantalla, no
 * volcados técnicos: el administrador tiene que entender qué pasó.
 */

/** Excepción con código HTTP. La captura el enrutador y la convierte en JSON. */
class GgError extends RuntimeException
{
    public function __construct(string $mensaje, public int $http = 400)
    {
        parent::__construct($mensaje);
    }
}

function gg_metodo(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

/** Cuerpo JSON de la petición, ya decodificado. */
function gg_cuerpo(): array
{
    static $cuerpo = null;
    if ($cuerpo !== null) {
        return $cuerpo;
    }

    $crudo = file_get_contents('php://input');
    if ($crudo === false || $crudo === '') {
        return $cuerpo = [];
    }

    $d = json_decode($crudo, true);
    if (!is_array($d)) {
        throw new GgError('El cuerpo de la petición no es JSON válido.', 400);
    }
    return $cuerpo = $d;
}

/** IP de quien llama, contando el proxy del hosting. */
function gg_ip(): string
{
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $c) {
        if (!empty($_SERVER[$c])) {
            // X-Forwarded-For puede traer varias: la primera es el cliente.
            $ip = trim(explode(',', (string) $_SERVER[$c])[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    return '0.0.0.0';
}

function gg_responder($datos, int $http = 200): never
{
    http_response_code($http);
    header('Content-Type: application/json; charset=utf-8');
    // La respuesta de la API no se guarda en caché jamás: contiene datos que
    // cambian y, en el panel, datos privados.
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('X-Content-Type-Options: nosniff');
    echo json_encode(
        $datos,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
    );
    exit;
}

function gg_error(string $mensaje, int $http = 400): never
{
    gg_responder(['error' => $mensaje], $http);
}

// ─────────────────────────────────────────────────────────────────────────────
// Validación de entrada
//
// Toda propiedad que llega del navegador pasa por aquí. Nada se guarda tal
// cual: ni un texto, ni un número, ni una lista.
// ─────────────────────────────────────────────────────────────────────────────

function gg_texto(array $datos, string $clave, int $maximo = 500, string $porOmision = ''): string
{
    if (!array_key_exists($clave, $datos) || $datos[$clave] === null) {
        return $porOmision;
    }
    if (!is_scalar($datos[$clave])) {
        throw new GgError("El campo «{$clave}» debe ser texto.");
    }
    $v = trim((string) $datos[$clave]);
    // Se quitan los caracteres de control, que no aportan nada y sí rompen
    // cosas más adelante (JSON, cabeceras, registros).
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    if (mb_strlen($v) > $maximo) {
        throw new GgError("El campo «{$clave}» no puede pasar de $maximo caracteres.");
    }
    return $v;
}

function gg_texto_obligatorio(array $datos, string $clave, int $maximo = 500): string
{
    $v = gg_texto($datos, $clave, $maximo);
    if ($v === '') {
        throw new GgError("El campo «{$clave}» es obligatorio.");
    }
    return $v;
}

/** Entero o null. Una cadena vacía significa "sin confirmar", no cero. */
function gg_entero(array $datos, string $clave, ?int $min = null, ?int $max = null): ?int
{
    if (!array_key_exists($clave, $datos)) {
        return null;
    }
    $v = $datos[$clave];
    if ($v === null || $v === '') {
        return null;
    }
    if (!is_numeric($v)) {
        throw new GgError("El campo «{$clave}» debe ser un número.");
    }
    $n = (int) $v;
    if ($min !== null && $n < $min) {
        throw new GgError("El campo «{$clave}» no puede ser menor que $min.");
    }
    if ($max !== null && $n > $max) {
        throw new GgError("El campo «{$clave}» no puede ser mayor que $max.");
    }
    return $n;
}

function gg_bool_entrada(array $datos, string $clave, bool $porOmision = false): bool
{
    if (!array_key_exists($clave, $datos)) {
        return $porOmision;
    }
    return filter_var($datos[$clave], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? $porOmision;
}

/** Valor que debe pertenecer a una lista cerrada. */
function gg_opcion(array $datos, string $clave, array $validos, ?string $porOmision = null): ?string
{
    if (!array_key_exists($clave, $datos) || $datos[$clave] === null || $datos[$clave] === '') {
        return $porOmision;
    }
    $v = (string) $datos[$clave];
    if (!in_array($v, $validos, true)) {
        throw new GgError("El valor de «{$clave}» no es válido.");
    }
    return $v;
}

/** Lista de textos cortos (etiquetas, slugs de portada, ciudades). */
function gg_lista(array $datos, string $clave, int $maximo = 40, int $largoItem = 200): array
{
    if (!array_key_exists($clave, $datos) || $datos[$clave] === null) {
        return [];
    }
    if (!is_array($datos[$clave])) {
        throw new GgError("El campo «{$clave}» debe ser una lista.");
    }
    $salida = [];
    foreach (array_slice($datos[$clave], 0, $maximo) as $item) {
        if (!is_scalar($item)) {
            continue;
        }
        $t = trim((string) $item);
        if ($t !== '' && mb_strlen($t) <= $largoItem) {
            $salida[] = $t;
        }
    }
    return array_values(array_unique($salida));
}

/**
 * Slug seguro para usar en una URL.
 * Se recalcula siempre en el servidor: aceptar el del navegador tal cual
 * permitiría meter barras o puntos y salirse de la ruta esperada.
 */
function gg_slug(string $texto): string
{
    $t = $texto;
    if (function_exists('iconv')) {
        $conv = @iconv('UTF-8', 'ASCII//TRANSLIT', $t);
        if ($conv !== false) {
            $t = $conv;
        }
    }
    $t = strtolower($t);
    $t = preg_replace('/[^a-z0-9]+/', '-', $t) ?? '';
    $t = trim($t, '-');
    return substr($t, 0, 120);
}

/**
 * Enlace interno o externo, saneado.
 * Solo se admiten rutas del propio sitio o http(s): así un enlace guardado en
 * el panel no puede acabar siendo un `javascript:` en la tienda.
 */
function gg_enlace(array $datos, string $clave, string $porOmision = '/catalogo'): string
{
    $v = gg_texto($datos, $clave, 400, $porOmision);
    if ($v === '') {
        return $porOmision;
    }
    if (str_starts_with($v, '/')) {
        return $v;
    }
    if (preg_match('#^https?://#i', $v)) {
        return $v;
    }
    throw new GgError("El enlace de «{$clave}» debe empezar por «/» o por «https://».");
}

/** Fecha ISO o null. */
function gg_fecha(array $datos, string $clave): ?string
{
    $v = gg_texto($datos, $clave, 40);
    if ($v === '') {
        return null;
    }
    $t = strtotime($v);
    if ($t === false) {
        throw new GgError("La fecha de «{$clave}» no es válida.");
    }
    return gmdate('Y-m-d\TH:i:s\Z', $t);
}

function gg_email(array $datos, string $clave): string
{
    $v = strtolower(gg_texto_obligatorio($datos, $clave, 190));
    if (!filter_var($v, FILTER_VALIDATE_EMAIL)) {
        throw new GgError('El correo electrónico no tiene un formato válido.');
    }
    return $v;
}
