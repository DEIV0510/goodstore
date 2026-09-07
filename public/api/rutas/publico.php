<?php
declare(strict_types=1);

/**
 * GET /api/publico
 *
 * Todo lo que la tienda necesita, en UNA sola petición: catálogo, categorías,
 * preguntas, banners vigentes, contenido de la portada y configuración.
 *
 * Se hizo así por rendimiento. Siete peticiones separadas significan siete
 * viajes de ida y vuelta antes de que el cliente vea un producto, y en móvil
 * con datos eso se nota mucho.
 *
 * Aquí NO se expone nada privado: ni clientes, ni pedidos, ni usuarios, ni
 * productos en borrador. Es la única ruta de la API que responde sin sesión.
 */

if (gg_metodo() !== 'GET') {
    gg_error('Ese método no está permitido aquí.', 405);
}

// Solo lo publicado: los borradores son invisibles fuera del panel, aunque
// alguien adivine la dirección.
$productos = array_map(
    'gg_salida_producto',
    gg_filas("SELECT * FROM productos WHERE estado = 'publicado' ORDER BY orden ASC, nombre ASC")
);

$portadas = gg_portadas_por_slug();
$categorias = array_map(
    static fn($f) => gg_salida_categoria($f, $portadas),
    gg_filas('SELECT * FROM categorias WHERE activa = 1 ORDER BY orden ASC')
);

$preguntas = array_map(
    'gg_salida_pregunta',
    gg_filas('SELECT * FROM preguntas WHERE activa = 1 ORDER BY orden ASC')
);

// Banners activos y dentro de su ventana de fechas. El filtro va en SQL para
// que un banner caducado no llegue siquiera al navegador.
$ahora = gg_ahora();
$banners = array_map(
    'gg_salida_banner',
    gg_filas(
        'SELECT * FROM banners
         WHERE activo = 1
           AND (desde IS NULL OR desde <= ?)
           AND (hasta IS NULL OR hasta >= ?)
         ORDER BY orden ASC',
        [$ahora, $ahora]
    )
);

// ── Ajustes, quitando lo que es del negocio y no del público ────────────────
//
// Esta respuesta la lee cualquier visitante. La sección de pagos mezcla cosas
// que la tienda sí necesita (si el pago está activo, el enlace de cobro, cómo
// se llama el medio, la llave pública —que es pública por diseño—) con cosas
// que son del negocio y de nadie más.
const GG_PUBLICO_FUERA = [
    // El correo al que llegan los pedidos. Publicarlo es regalar una dirección
    // para spam, y al navegador no le sirve para nada.
    'orderEmail',
];

$ajustes = gg_opciones('ajustes');
if (is_array($ajustes['payments'] ?? null)) {
    foreach (GG_PUBLICO_FUERA as $clave) {
        unset($ajustes['payments'][$clave]);
    }
}

gg_responder([
    'productos'  => $productos,
    'categorias' => $categorias,
    'preguntas'  => $preguntas,
    'banners'    => $banners,
    'contenido'  => gg_opciones('contenido'),
    'ajustes'    => $ajustes,
    'whatsapp'   => gg_opciones('whatsapp'),
]);
