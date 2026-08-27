<?php
declare(strict_types=1);

/**
 * GOOD GAME · Traducción de filas a JSON
 *
 * La base de datos usa nombres en español y guarda los booleanos como 0/1.
 * La interfaz espera los nombres del modelo que ya tenía la tienda. Aquí se
 * hace esa traducción, en un único sitio.
 *
 * Gracias a esto la parte de JavaScript no cambió: las 16 pantallas del panel
 * y toda la tienda siguen recibiendo exactamente la misma forma de datos.
 */

function gg_salida_producto(array $f): array
{
    return [
        'id'          => $f['id'],
        'slug'        => $f['slug'],
        'name'        => $f['nombre'],
        'platform'    => $f['plataforma'],
        'category'    => $f['categoria'],
        'genre'       => $f['genero'],
        'condition'   => $f['estado_copia'],
        'region'      => $f['region'],
        // Se conserva el null: significa "sin confirmar", que no es lo mismo
        // que cero. La tienda muestra "Consultar precio".
        'price'       => $f['precio'] === null ? null : (int) $f['precio'],
        'oldPrice'    => $f['precio_antes'] === null ? null : (int) $f['precio_antes'],
        'stock'       => $f['stock'] === null ? null : (int) $f['stock'],
        'sku'         => $f['sku'],
        'images'      => gg_json($f['imagenes']),
        'imageSize'   => ($f['imagen_w'] && $f['imagen_h'])
            ? ['w' => (int) $f['imagen_w'], 'h' => (int) $f['imagen_h']]
            : null,
        'description' => (string) $f['descripcion'],
        'note'        => $f['nota'],
        'tags'        => gg_json($f['etiquetas']),
        'featured'    => gg_bool($f['destacado']),
        'onSale'      => gg_bool($f['oferta']),
        'newRelease'  => gg_bool($f['lanzamiento']),
        'bestSeller'  => gg_bool($f['mas_vendido']),
        'status'      => $f['estado'],
        'views'       => (int) $f['vistas'],
        'createdAt'   => $f['creado'],
        'updatedAt'   => $f['actualizado'],
    ];
}

/**
 * Las portadas de una categoría se guardan por SLUG de producto, no por ruta
 * de imagen: así no se rompen cuando se corrige el nombre de un juego. Aquí se
 * resuelven a rutas reales, y las que ya no existan simplemente se omiten.
 */
function gg_salida_categoria(array $f, array $portadasPorSlug = []): array
{
    $slugs = gg_json($f['portadas']);
    $covers = [];
    foreach ($slugs as $s) {
        if (isset($portadasPorSlug[$s])) {
            $covers[] = $portadasPorSlug[$s];
        }
    }

    return [
        'id'          => $f['id'],
        'slug'        => $f['slug'],
        'title'       => $f['titulo'],
        'subtitle'    => (string) $f['subtitulo'],
        'description' => (string) $f['descripcion'],
        'href'        => $f['enlace'],
        'imageUrl'    => $f['imagen'],
        'coverSlugs'  => $slugs,
        'covers'      => $covers,
        'sortOrder'   => (int) $f['orden'],
        'active'      => gg_bool($f['activa']),
        'soon'        => gg_bool($f['proximo']),
    ];
}

/** Mapa slug → primera imagen, para resolver las portadas de las categorías. */
function gg_portadas_por_slug(): array
{
    $mapa = [];
    foreach (gg_filas('SELECT slug, imagenes FROM productos') as $f) {
        $imgs = gg_json($f['imagenes']);
        if ($imgs) {
            $mapa[$f['slug']] = $imgs[0];
        }
    }
    return $mapa;
}

function gg_salida_cliente(array $f, ?array $resumen = null): array
{
    $salida = [
        'id'        => $f['id'],
        'name'      => $f['nombre'],
        'whatsapp'  => $f['whatsapp'],
        'email'     => $f['email'],
        'city'      => $f['ciudad'],
        'notes'     => $f['notas'],
        'createdAt' => $f['creado'],
    ];
    if ($resumen !== null) {
        $salida['orderCount'] = $resumen['n'];
        $salida['totalSpent'] = $resumen['total'];
        $salida['lastOrderAt'] = $resumen['ultimo'];
    }
    return $salida;
}

function gg_salida_pedido(array $f, array $lineas = [], ?array $cliente = null): array
{
    return [
        'id'            => $f['id'],
        'code'          => $f['codigo'],
        'customerId'    => $f['cliente_id'],
        'customer'      => $cliente ? gg_salida_cliente($cliente) : null,
        'status'        => $f['estado'],
        'paymentMethod' => $f['pago'],
        'channel'       => $f['canal'],
        'subtotal'      => (int) $f['subtotal'],
        'shipping'      => (int) $f['envio'],
        'total'         => (int) $f['total'],
        'notes'         => $f['notas'],
        'createdAt'     => $f['creado'],
        'updatedAt'     => $f['actualizado'],
        'items'         => array_map(static fn($l) => [
            'id'         => $l['id'],
            'productId'  => $l['producto_id'],
            'name'       => $l['nombre'],
            'platform'   => $l['plataforma'],
            'image'      => $l['imagen'],
            'unitPrice'  => (int) $l['precio_unit'],
            'qty'        => (int) $l['cantidad'],
        ], $lineas),
    ];
}

function gg_salida_banner(array $f): array
{
    return [
        'id'        => $f['id'],
        'title'     => $f['titulo'],
        'subtitle'  => (string) $f['subtitulo'],
        'imageUrl'  => $f['imagen'],
        'ctaLabel'  => (string) $f['cta_texto'],
        'ctaHref'   => $f['cta_enlace'],
        'startsAt'  => $f['desde'],
        'endsAt'    => $f['hasta'],
        'active'    => gg_bool($f['activo']),
        'sortOrder' => (int) $f['orden'],
    ];
}

function gg_salida_pregunta(array $f): array
{
    return [
        'id'        => $f['id'],
        'question'  => $f['pregunta'],
        'answer'    => $f['respuesta'],
        'sortOrder' => (int) $f['orden'],
        'active'    => gg_bool($f['activa']),
    ];
}

function gg_salida_auditoria(array $f): array
{
    return [
        'id'        => (int) $f['id'],
        'actorId'   => $f['actor_id'],
        'actorName' => $f['actor'],
        'action'    => $f['accion'],
        'entity'    => $f['entidad'],
        'entityId'  => $f['entidad_id'],
        'label'     => $f['etiqueta'],
        'detail'    => gg_json($f['detalle'], []),
        'createdAt' => $f['creado'],
    ];
}

// ── Opciones (clave → JSON) ──────────────────────────────────────────────────

function gg_opciones(string $grupo): array
{
    $salida = [];
    foreach (gg_filas('SELECT clave, valor FROM opciones WHERE grupo = ?', [$grupo]) as $f) {
        $salida[$f['clave']] = gg_json($f['valor'], []);
    }
    return $salida;
}

function gg_guardar_opcion(string $grupo, string $clave, $valor): void
{
    gg_ejecutar(
        'INSERT INTO opciones (grupo, clave, valor, actualizado) VALUES (?, ?, ?, ?)
         ON CONFLICT (grupo, clave) DO UPDATE SET valor = excluded.valor, actualizado = excluded.actualizado',
        [$grupo, $clave, json_encode($valor, JSON_UNESCAPED_UNICODE) ?: '{}', gg_ahora()]
    );
}
