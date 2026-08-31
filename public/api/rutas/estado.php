<?php
declare(strict_types=1);

/**
 * GET /api/estado
 *
 * Lo primero que consulta el panel al abrirse. Responde a tres preguntas:
 * ¿hay ya un administrador?, ¿tengo sesión?, ¿este servidor puede con todo?
 *
 * El diagnóstico es deliberadamente explícito: si algo del hosting falta, se
 * dice cuál y cómo activarlo, en vez de que el panel falle más adelante sin
 * que se sepa por qué.
 */

if (gg_metodo() !== 'GET') {
    gg_error('Ese método no está permitido aquí.', 405);
}

$usuario = gg_usuario();

$avisos = [];
$carpetaDatos = null;
$datosFuera = false;

try {
    $carpetaDatos = gg_carpeta_datos();
    $raiz = rtrim(str_replace('\\', '/', $_SERVER['DOCUMENT_ROOT'] ?? ''), '/');
    $datosFuera = $raiz === '' || !str_starts_with($carpetaDatos, $raiz);
    if (!$datosFuera) {
        $avisos[] = 'La base de datos quedó dentro de la carpeta pública porque el ' .
            'hosting no dejó crearla fuera. Está protegida con .htaccess, pero es ' .
            'preferible moverla si más adelante se puede.';
    }
} catch (Throwable $e) {
    $avisos[] = $e->getMessage();
}

if (!extension_loaded('gd')) {
    $avisos[] = 'La extensión GD no está activa: se podrán subir imágenes, pero no ' .
        'comprobar sus dimensiones. Actívala en hPanel → Avanzado → Configuración PHP.';
}
if (!gg_es_https()) {
    $avisos[] = 'La conexión no es HTTPS. La sesión del panel viaja sin cifrar; ' .
        'activa el certificado SSL antes de usarlo en producción.';
}

$sinInstalar = gg_sin_instalar();

// Al abrir por primera vez, el catálogo se carga solo. Se hace aquí y no en la
// instalación para que la tienda tenga datos aunque nadie entre nunca al panel.
$semilla = ['sembrado' => false];
try {
    $semilla = gg_sembrar_si_hace_falta();
} catch (Throwable $e) {
    $avisos[] = 'No se pudo cargar el catálogo inicial: ' . $e->getMessage();
}

gg_responder([
    'version'     => GG_VERSION,
    'instalado'   => !$sinInstalar,
    'rescate'     => $sinInstalar ? false : gg_rescate_pedido(),
    'sesion'      => $usuario ? gg_publico_usuario($usuario) : null,
    'diagnostico' => [
        'php'          => PHP_VERSION,
        'sqlite'       => extension_loaded('pdo_sqlite'),
        'gd'           => extension_loaded('gd'),
        'https'        => gg_es_https(),
        // Con qué puede el servidor preguntarle a la pasarela si un pago se
        // aprobó. Sin ninguna de las dos, el Checkout Web se puede cobrar pero
        // la tienda no podría confirmar el resultado por su cuenta.
        'salidaWeb'    => function_exists('curl_init')
            ? 'curl'
            : ((bool) ini_get('allow_url_fopen') ? 'fopen' : 'no'),
        'datosFuera'   => $datosFuera,
        'carpetaDatos' => $carpetaDatos,
        'productos'    => (int) gg_valor('SELECT COUNT(*) FROM productos'),
        'sembradoAhora' => (bool) ($semilla['sembrado'] ?? false),
    ],
    'avisos' => $avisos,
]);
