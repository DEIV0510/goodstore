<?php
declare(strict_types=1);

/**
 * GOOD GAME · Carga inicial automática
 *
 * La primera vez que se abre el panel, la base de datos está vacía. En vez de
 * pedirle al administrador que ejecute nada por línea de comandos, el catálogo
 * se carga solo desde `semilla.json`, un archivo que se genera al compilar el
 * sitio a partir del inventario real del negocio.
 *
 * Los 318 productos, las 6 categorías y las 9 preguntas frecuentes que hoy
 * tiene la tienda quedan dentro de la base de datos sin que nadie haga nada.
 *
 * Es idempotente: si ya hay productos, no toca nada. Nunca duplica ni pisa lo
 * que el negocio haya editado después.
 */

function gg_sembrar_si_hace_falta(): array
{
    $resumen = ['productos' => 0, 'categorias' => 0, 'preguntas' => 0, 'sembrado' => false];

    // Si ya hay algo, no se toca. Un administrador puede haber archivado
    // productos a propósito, y volver a sembrar los resucitaría.
    if ((int) gg_valor('SELECT COUNT(*) FROM productos') > 0) {
        return $resumen;
    }

    $archivo = dirname(__DIR__) . '/semilla.json';
    if (!is_file($archivo)) {
        return $resumen;
    }

    $datos = json_decode((string) file_get_contents($archivo), true);
    if (!is_array($datos)) {
        return $resumen;
    }

    $db = gg_db();
    $ahora = gg_ahora();
    $db->beginTransaction();

    try {
        foreach ($datos['productos'] ?? [] as $i => $p) {
            $precio = $p['price'] ?? null;
            $antes = $p['oldPrice'] ?? null;

            gg_insertar('productos', [
                'id'           => gg_id(),
                'slug'         => (string) $p['slug'],
                'nombre'       => (string) $p['name'],
                'plataforma'   => (string) $p['platform'],
                'categoria'    => (string) ($p['category'] ?? 'videojuegos'),
                'genero'       => $p['genre'] ?? null,
                'estado_copia' => (string) ($p['condition'] ?? 'consultar'),
                'region'       => $p['region'] ?? null,
                'precio'       => $precio,
                'precio_antes' => $antes,
                'stock'        => $p['stock'] ?? null,
                'sku'          => null,
                'imagenes'     => json_encode($p['images'] ?? [], JSON_UNESCAPED_SLASHES),
                'imagen_w'     => $p['imageSize']['w'] ?? null,
                'imagen_h'     => $p['imageSize']['h'] ?? null,
                'descripcion'  => (string) ($p['description'] ?? ''),
                'nota'         => $p['note'] ?? null,
                'etiquetas'    => json_encode($p['tags'] ?? [], JSON_UNESCAPED_UNICODE),
                'destacado'    => !empty($p['featured']) ? 1 : 0,
                // La oferta se deduce del propio dato, no se inventa: solo si
                // hay un precio anterior mayor que el actual.
                'oferta'       => ($antes !== null && $precio !== null && $antes > $precio) ? 1 : 0,
                'lanzamiento'  => 0,
                'mas_vendido'  => 0,
                'estado'       => 'publicado',
                // Conserva el orden del catálogo, que ya está trabajado.
                'orden'        => $i,
                'vistas'       => 0,
                'creado'       => $ahora,
                'actualizado'  => $ahora,
            ]);
            $resumen['productos']++;
        }

        foreach ($datos['categorias'] ?? [] as $i => $c) {
            gg_insertar('categorias', [
                'id'          => gg_id(),
                'slug'        => (string) $c['slug'],
                'titulo'      => (string) $c['title'],
                'subtitulo'   => (string) ($c['subtitle'] ?? ''),
                'descripcion' => '',
                'enlace'      => (string) ($c['href'] ?? '/catalogo'),
                'imagen'      => null,
                'portadas'    => json_encode($c['coverSlugs'] ?? [], JSON_UNESCAPED_SLASHES),
                'orden'       => $i,
                'activa'      => 1,
                'proximo'     => !empty($c['soon']) ? 1 : 0,
                'creado'      => $ahora,
                'actualizado' => $ahora,
            ]);
            $resumen['categorias']++;
        }

        foreach ($datos['preguntas'] ?? [] as $i => $q) {
            gg_insertar('preguntas', [
                'id'          => gg_id(),
                'pregunta'    => (string) $q['question'],
                'respuesta'   => (string) $q['answer'],
                'orden'       => $i,
                'activa'      => 1,
                'creado'      => $ahora,
                'actualizado' => $ahora,
            ]);
            $resumen['preguntas']++;
        }

        gg_meta_set($db, 'sembrado', $ahora);
        $db->commit();
        $resumen['sembrado'] = true;
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }

    return $resumen;
}

/** true cuando todavía no existe ningún administrador. */
function gg_sin_instalar(): bool
{
    return (int) gg_valor('SELECT COUNT(*) FROM usuarios') === 0;
}

/**
 * Rescate cuando se pierde la contraseña Y el código de recuperación.
 *
 * Basta con crear un archivo vacío llamado `RESCATE.txt` en la carpeta de
 * datos, usando el administrador de archivos del hosting. Al detectarlo, la
 * API permite crear de nuevo la cuenta principal y borra el archivo.
 *
 * Es seguro porque para dejar ese archivo hay que entrar antes al panel de
 * Hostinger: quien puede hacerlo ya es dueño del servidor. Es el equivalente a
 * arrancar un ordenador en modo recuperación con la máquina delante.
 */
function gg_rescate_pedido(): bool
{
    return is_file(gg_carpeta_datos() . '/RESCATE.txt');
}

function gg_consumir_rescate(): void
{
    @unlink(gg_carpeta_datos() . '/RESCATE.txt');
}
